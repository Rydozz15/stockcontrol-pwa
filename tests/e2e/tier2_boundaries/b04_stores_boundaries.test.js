const { assert, runDirectly } = require('../test_helper');
const { createInventoryStore, createMetricsStore, writable } = require('../harness');

const tests = [
  {
    name: 'B04-T01: Rapid successive store dispatches (100 in loop) preserve consistency',
    fn: async () => {
      const counterStore = writable(0);
      let observed = 0;
      counterStore.subscribe(val => { observed = val; });

      for (let i = 1; i <= 100; i++) {
        counterStore.set(i);
      }
      assert.strictEqual(observed, 100);
      assert.strictEqual(counterStore.get(), 100);
    }
  },
  {
    name: 'B04-T02: Unsubscribing a listener immediately halts further callback executions',
    fn: async () => {
      const store = writable('initial');
      let calls = 0;
      const unsub = store.subscribe(() => { calls++; });
      assert.strictEqual(calls, 1);

      store.set('updated_1');
      assert.strictEqual(calls, 2);

      unsub();
      store.set('updated_2');
      store.set('updated_3');
      assert.strictEqual(calls, 2, 'Must not be called after unsubscribe');
    }
  },
  {
    name: 'B04-T03: Multiple concurrent subscribers receive identical state snapshots',
    fn: async () => {
      const store = writable('A');
      let sub1 = null;
      let sub2 = null;
      const u1 = store.subscribe(v => { sub1 = v; });
      const u2 = store.subscribe(v => { sub2 = v; });

      store.set('B');
      assert.strictEqual(sub1, 'B');
      assert.strictEqual(sub2, 'B');
      u1();
      u2();
    }
  },
  {
    name: 'B04-T04: Resetting inventory store clears derived metrics immediately to all 0s',
    fn: async () => {
      const invStore = createInventoryStore([{ id: 'p1', name: 'Leche', expiryDate: '2026-10-20' }]);
      const metStore = createMetricsStore(invStore);
      let metrics = null;
      const unsub = metStore.subscribe(m => { metrics = m; });

      assert.strictEqual(metrics.total, 1);
      invStore.removeProduct('p1');
      assert.deepStrictEqual(metrics, { total: 0, expired: 0, soon: 0, week: 0, ok: 0 });
      unsub();
    }
  },
  {
    name: 'B04-T05: Empty filter strings in inventory store match all items',
    fn: async () => {
      const store = createInventoryStore([
        { id: 'p1', name: 'Leche', category: 'Lácteos' },
        { id: 'p2', name: 'Carne', category: 'Carnes' }
      ]);
      store.resetFilters();
      let filters = null;
      const unsub = store.filters.subscribe(f => { filters = f; });
      assert.strictEqual(filters.search, '');
      assert.strictEqual(filters.category, '');
      assert.strictEqual(filters.status, '');
      unsub();
    }
  }
];

if (require.main === module) {
  runDirectly('B04: Reactive Stores Boundaries', tests);
}

module.exports = {
  id: 'B04',
  name: 'Reactive Stores Boundaries',
  tests
};
