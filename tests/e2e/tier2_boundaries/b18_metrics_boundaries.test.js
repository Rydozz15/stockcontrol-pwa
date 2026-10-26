const { assert, runDirectly } = require('../test_helper');
const { calculateMetrics } = require('../harness');

const REF_DATE = new Date('2026-10-25T00:00:00');

const tests = [
  {
    name: 'B18-T01: Empty inventory returns strictly zeroed metrics without NaN or undefined fields',
    fn: async () => {
      const m = calculateMetrics([], REF_DATE);
      assert.deepStrictEqual(m, { total: 0, expired: 0, soon: 0, week: 0, ok: 0 });
    }
  },
  {
    name: 'B18-T02: Large inventory (1,000 items) executes metrics calculation in under 20ms',
    fn: async () => {
      const largeList = [];
      for (let i = 0; i < 1000; i++) {
        largeList.push({
          name: `Item ${i}`,
          expiryDate: i % 2 === 0 ? '2026-10-20' : '2026-11-15',
          isDiscarded: false,
          isConsumed: false
        });
      }
      const t0 = Date.now();
      const m = calculateMetrics(largeList, REF_DATE);
      const elapsed = Date.now() - t0;

      assert.strictEqual(m.total, 1000);
      assert.strictEqual(m.expired, 500);
      assert.ok(elapsed < 20, `Execution took ${elapsed}ms, must be < 20ms`);
    }
  },
  {
    name: 'B18-T03: Item expiring today strictly counts as soon and not as expired',
    fn: async () => {
      const todayItem = [{ name: 'Vence Hoy', expiryDate: '2026-10-25', isDiscarded: false, isConsumed: false }];
      const m = calculateMetrics(todayItem, REF_DATE);
      assert.strictEqual(m.expired, 0, 'Must not be counted as expired');
      assert.strictEqual(m.soon, 1, 'Must be counted as soon');
    }
  },
  {
    name: 'B18-T04: When all items in inventory are expired, total strictly equals expired',
    fn: async () => {
      const allExpired = [
        { name: 'A', expiryDate: '2026-10-01', isDiscarded: false, isConsumed: false },
        { name: 'B', expiryDate: '2026-10-10', isDiscarded: false, isConsumed: false }
      ];
      const m = calculateMetrics(allExpired, REF_DATE);
      assert.strictEqual(m.total, 2);
      assert.strictEqual(m.expired, 2);
      assert.strictEqual(m.soon, 0);
      assert.strictEqual(m.ok, 0);
    }
  },
  {
    name: 'B18-T05: Decimal product quantities (0.25 kg) do not distort integer metric counts',
    fn: async () => {
      const fractionalItems = [
        { name: 'Pimienta', quantity: 0.25, expiryDate: '2026-11-20', isDiscarded: false, isConsumed: false },
        { name: 'Canela', quantity: 0.1, expiryDate: '2026-11-20', isDiscarded: false, isConsumed: false }
      ];
      const m = calculateMetrics(fractionalItems, REF_DATE);
      assert.strictEqual(m.total, 2);
      assert.strictEqual(m.ok, 2);
    }
  }
];

if (require.main === module) {
  runDirectly('B18: Metrics Dashboard Boundaries', tests);
}

module.exports = {
  id: 'B18',
  name: 'Metrics Dashboard Boundaries',
  tests
};
