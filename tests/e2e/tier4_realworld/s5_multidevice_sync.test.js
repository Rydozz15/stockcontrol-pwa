const { assert, runDirectly } = require('../test_helper');
const {
  InMemoryWorkspaceRepository,
  createInventoryStore,
  createMetricsStore,
  isTabletSplitLayout
} = require('../harness');

const REF_DATE = new Date('2026-10-25T00:00:00');

const tests = [
  {
    name: 'Scenario 5: Multi-Device Real-Time Kitchen Synchronization (Tablet & Phone)',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const sharedWorkspace = 'cocina-central';

      // Seed initial steak stock
      const steakId = await repo.createProduct(sharedWorkspace, {
        name: 'Bife de Chorizo Angus',
        category: 'Carnes',
        quantity: 5,
        unit: 'kg',
        expiryDate: '2026-10-28',
        location: 'Refrigerador'
      }, 'Bodega');

      // 1. Device A: Chef Station on Apple iPad Tablet (1024x768)
      const isTabletA = isTabletSplitLayout(1024);
      assert.strictEqual(isTabletA, true, 'Device A must render in tablet split-screen layout');

      let deviceAInventory = [];
      let deviceAMetrics = null;
      let deviceASelectedProduct = null;

      const deviceAStore = createInventoryStore([]);
      const deviceAMetricsStore = createMetricsStore(deviceAStore, REF_DATE);

      deviceAStore.subscribe(p => {
        deviceAInventory = p;
        if (deviceASelectedProduct) {
          deviceASelectedProduct = p.find(x => x.id === deviceASelectedProduct.id) || null;
        }
      });
      deviceAMetricsStore.subscribe(m => { deviceAMetrics = m; });

      // Subscribe Device A to Firestore real-time onSnapshot listener
      const unsubDeviceA = repo.subscribeProducts(sharedWorkspace, products => {
        deviceAStore.set(products);
      });

      // Chef selects steak in left pane, viewing detail in right split pane
      deviceASelectedProduct = deviceAInventory.find(p => p.id === steakId);
      assert.strictEqual(deviceASelectedProduct.quantity, 5);
      assert.strictEqual(deviceAMetrics.total, 1);

      // 2. Device B: Grill Cook on Android Phone (390x844)
      const isTabletB = isTabletSplitLayout(390);
      assert.strictEqual(isTabletB, false, 'Device B must render in mobile single-column layout');

      let deviceBInventory = [];
      const unsubDeviceB = repo.subscribeProducts(sharedWorkspace, products => {
        deviceBInventory = products;
      });

      assert.strictEqual(deviceBInventory.length, 1);
      assert.strictEqual(deviceBInventory[0].quantity, 5);

      // 3. Cook on Device B consumes 2 kg of steak during order service
      const cookAlias = 'Juan - Parrilla';
      const log = await repo.consumeStock(sharedWorkspace, steakId, 2, cookAlias, 'Mesa 4');
      assert.strictEqual(log.amount, 2);
      assert.strictEqual(log.operator, cookAlias);

      // 4. Verify Device A reflects live update in real-time without page reload:
      // A: Stock decrements from 5 to 3 in Device A inventory list
      assert.strictEqual(deviceAInventory[0].quantity, 3);
      // B: Split-screen right detail pane displays updated quantity 3
      assert.strictEqual(deviceASelectedProduct.quantity, 3);
      // C: Metrics dashboard remains accurate
      assert.strictEqual(deviceAMetrics.total, 1);
      // D: Device B also shows 3 kg
      assert.strictEqual(deviceBInventory[0].quantity, 3);

      // 5. Verify audit trail is accessible on both devices
      const history = repo.getHistory(sharedWorkspace);
      assert.strictEqual(history[0].operator, 'Juan - Parrilla');
      assert.strictEqual(history[0].action, 'consume');

      unsubDeviceA();
      unsubDeviceB();
    }
  }
];

if (require.main === module) {
  runDirectly('Tier 4: Scenario 5 - Multi-Device Kitchen Sync', tests);
}

module.exports = {
  id: 'S5',
  name: 'Scenario 5: Multi-Device Kitchen Sync',
  tests
};
