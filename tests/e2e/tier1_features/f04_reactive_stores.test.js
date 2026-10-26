const { assert, runDirectly } = require('../test_helper');
const {
  createWorkspaceStore,
  createConnectivityStore,
  createToastStore,
  createInventoryStore,
  createMetricsStore
} = require('../harness');

const REF_DATE = new Date('2026-10-25T00:00:00');

const tests = [
  {
    name: 'F04-T01: workspaceStore updates workspaceId and operator alias reactively',
    fn: async () => {
      const store = createWorkspaceStore({ workspaceId: 'cocina-principal', operator: 'Ana' });
      let state = null;
      const unsub = store.subscribe(s => { state = s; });

      assert.strictEqual(state.workspaceId, 'cocina-principal');
      assert.strictEqual(state.operator, 'Ana');

      store.setWorkspace('sucursal-norte');
      assert.strictEqual(state.workspaceId, 'sucursal-norte');

      store.setOperator('Pedro - Parrilla');
      assert.strictEqual(state.operator, 'Pedro - Parrilla');
      unsub();
    }
  },
  {
    name: 'F04-T02: connectivityStore manages online state and pending writes counter',
    fn: async () => {
      const store = createConnectivityStore({ isOnline: true, pendingWrites: 0 });
      let state = null;
      const unsub = store.subscribe(s => { state = s; });

      assert.strictEqual(state.isOnline, true);
      assert.strictEqual(state.pendingWrites, 0);

      store.setOnline(false);
      store.incrementPending();
      store.incrementPending();
      assert.strictEqual(state.isOnline, false);
      assert.strictEqual(state.pendingWrites, 2);

      store.decrementPending();
      assert.strictEqual(state.pendingWrites, 1);
      store.clearPending();
      assert.strictEqual(state.pendingWrites, 0);
      unsub();
    }
  },
  {
    name: 'F04-T03: toastStore triggers notification and dismisses on demand',
    fn: async () => {
      const store = createToastStore();
      let state = null;
      const unsub = store.subscribe(s => { state = s; });

      assert.strictEqual(state, null);
      store.show('Producto guardado correctamente', 'success', 0);
      assert.strictEqual(state.message, 'Producto guardado correctamente');
      assert.strictEqual(state.type, 'success');

      store.dismiss();
      assert.strictEqual(state, null);
      unsub();
    }
  },
  {
    name: 'F04-T04: inventoryStore notifies subscribers on mutations (add/update/remove)',
    fn: async () => {
      const store = createInventoryStore([]);
      let list = [];
      const unsub = store.subscribe(l => { list = l; });

      assert.strictEqual(list.length, 0);
      store.addProduct({ id: 'p1', name: 'Leche', quantity: 4 });
      assert.strictEqual(list.length, 1);
      assert.strictEqual(list[0].quantity, 4);

      store.updateProduct('p1', { quantity: 3 });
      assert.strictEqual(list[0].quantity, 3);

      store.removeProduct('p1');
      assert.strictEqual(list.length, 0);
      unsub();
    }
  },
  {
    name: 'F04-T05: metricsStore reactively derives totals from inventory updates',
    fn: async () => {
      const invStore = createInventoryStore([]);
      const metStore = createMetricsStore(invStore, REF_DATE);
      let metrics = null;
      const unsub = metStore.subscribe(m => { metrics = m; });

      assert.deepStrictEqual(metrics, { total: 0, expired: 0, soon: 0, week: 0, ok: 0 });

      invStore.addProduct({ id: 'p1', name: 'Yogurt', expiryDate: '2026-10-24', isDiscarded: false, isConsumed: false }); // expired
      invStore.addProduct({ id: 'p2', name: 'Pollo', expiryDate: '2026-10-26', isDiscarded: false, isConsumed: false });  // soon (1d)
      invStore.addProduct({ id: 'p3', name: 'Arroz', expiryDate: '2026-11-20', isDiscarded: false, isConsumed: false });  // ok

      assert.strictEqual(metrics.total, 3);
      assert.strictEqual(metrics.expired, 1);
      assert.strictEqual(metrics.soon, 1);
      assert.strictEqual(metrics.ok, 1);
      unsub();
    }
  }
];

if (require.main === module) {
  runDirectly('F04: Reactive Core Stores', tests);
}

module.exports = {
  id: 'F04',
  name: 'Reactive Core Stores',
  tests
};
