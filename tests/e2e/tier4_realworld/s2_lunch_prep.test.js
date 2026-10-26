const { assert, runDirectly } = require('../test_helper');
const {
  InMemoryWorkspaceRepository,
  createInventoryStore,
  createMetricsStore,
  createToastStore,
  consumeStock,
  undoConsumption,
  discardStock,
  createProduct
} = require('../harness');

const REF_DATE = new Date('2026-10-25T00:00:00');

const tests = [
  {
    name: 'Scenario 2: Lunch Prep Shift 1-Tap Consumption & Undo Workflow',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const ws = 'cocina-central';
      const cook = 'Carlos - Línea Caliente';

      // Initial inventory before lunch shift
      const burgerId = await repo.createProduct(ws, {
        name: 'Hamburguesas Vacuno 150g',
        category: 'Carnes',
        quantity: 20,
        unit: 'unidad(es)',
        expiryDate: '2026-10-27'
      }, 'Bodega');

      const cheddarId = await repo.createProduct(ws, {
        name: 'Queso Cheddar Laminado',
        category: 'Lácteos',
        quantity: 15,
        unit: 'paquete(s)',
        expiryDate: '2026-11-05'
      }, 'Bodega');

      const creamId = await repo.createProduct(ws, {
        name: 'Crema de Leche',
        category: 'Lácteos',
        quantity: 2,
        unit: 'L',
        expiryDate: '2026-10-24' // expired yesterday
      }, 'Bodega');

      // Wire up reactive stores
      const initialProducts = Array.from(repo._getWorkspaceMap(ws).values());
      const invStore = createInventoryStore(initialProducts);
      const metStore = createMetricsStore(invStore, REF_DATE);
      const toastStore = createToastStore();

      let currentMetrics;
      metStore.subscribe(m => { currentMetrics = m; });
      assert.strictEqual(currentMetrics.total, 3);
      assert.strictEqual(currentMetrics.expired, 1);

      // 1. Carlos consumes 2 units of burgers
      await repo.consumeStock(ws, burgerId, 2, cook, 'Prep almuerzo');
      const updatedBurger = Array.from(repo._getWorkspaceMap(ws).values()).find(p => p.id === burgerId);
      invStore.updateProduct(burgerId, updatedBurger);
      assert.strictEqual(updatedBurger.quantity, 18);

      // 2. Carlos accidentally taps Cheddar twice (intended 1 package, tapped 2)
      await repo.consumeStock(ws, cheddarId, 1, cook);
      let updatedCheddar = Array.from(repo._getWorkspaceMap(ws).values()).find(p => p.id === cheddarId);
      invStore.updateProduct(cheddarId, updatedCheddar);
      assert.strictEqual(updatedCheddar.quantity, 14);

      // Second accidental tap
      await repo.consumeStock(ws, cheddarId, 1, cook);
      updatedCheddar = Array.from(repo._getWorkspaceMap(ws).values()).find(p => p.id === cheddarId);
      invStore.updateProduct(cheddarId, updatedCheddar);
      assert.strictEqual(updatedCheddar.quantity, 13);

      // Toast displays with undo action
      let lastUndoAction = () => {
        const { product: restored } = undoConsumption(updatedCheddar, 1, cook);
        invStore.updateProduct(cheddarId, restored);
        return restored;
      };
      toastStore.show('Consumida 1 unidad de Queso Cheddar', 'info', 5000, lastUndoAction);

      // Carlos taps "Deshacer" in the toast
      const restored = lastUndoAction();
      assert.strictEqual(restored.quantity, 14, 'Cheddar quantity restored from 13 to 14');
      toastStore.dismiss();

      // 3. Carlos inspects the expired heavy cream and performs 1-Tap Merma
      const logMerma = await repo.discardStock(ws, creamId, 'vencimiento', cook);
      const discardedCream = Array.from(repo._getWorkspaceMap(ws).values()).find(p => p.id === creamId);
      invStore.updateProduct(creamId, discardedCream);

      assert.strictEqual(discardedCream.isDiscarded, true);
      assert.strictEqual(logMerma.reason, 'vencimiento');
      assert.strictEqual(logMerma.operator, cook);

      // 4. Verify metrics dashboard reactively updated: expired count is now 0 (discarded item removed from active)
      assert.strictEqual(currentMetrics.expired, 0, 'Expired item must be cleared from active alerts');
      assert.strictEqual(currentMetrics.total, 2);
    }
  }
];

if (require.main === module) {
  runDirectly('Tier 4: Scenario 2 - Lunch Prep Shift Consumption', tests);
}

module.exports = {
  id: 'S2',
  name: 'Scenario 2: Lunch Prep Shift Consumption',
  tests
};
