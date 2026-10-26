const { assert, runDirectly } = require('../test_helper');
const { calculateMetrics } = require('../harness');

const REF_DATE = new Date('2026-10-25T00:00:00');

const tests = [
  {
    name: 'F18-T01: Computes total count of active registered products',
    fn: async () => {
      const items = [
        { name: 'Leche', expiryDate: '2026-10-30', isDiscarded: false, isConsumed: false },
        { name: 'Yogurt', expiryDate: '2026-11-05', isDiscarded: false, isConsumed: false }
      ];
      const m = calculateMetrics(items, REF_DATE);
      assert.strictEqual(m.total, 2);
    }
  },
  {
    name: 'F18-T02: Computes expired product count accurately',
    fn: async () => {
      const items = [
        { name: 'Pollo Vencido', expiryDate: '2026-10-23', isDiscarded: false, isConsumed: false },
        { name: 'Carne Vencida', expiryDate: '2026-10-24', isDiscarded: false, isConsumed: false },
        { name: 'Arroz Vigente', expiryDate: '2026-12-01', isDiscarded: false, isConsumed: false }
      ];
      const m = calculateMetrics(items, REF_DATE);
      assert.strictEqual(m.expired, 2);
    }
  },
  {
    name: 'F18-T03: Computes soon (<=3 days) product count accurately',
    fn: async () => {
      const items = [
        { name: 'Vence Hoy', expiryDate: '2026-10-25', isDiscarded: false, isConsumed: false },
        { name: 'Vence en 2d', expiryDate: '2026-10-27', isDiscarded: false, isConsumed: false },
        { name: 'Vence en 6d', expiryDate: '2026-10-31', isDiscarded: false, isConsumed: false }
      ];
      const m = calculateMetrics(items, REF_DATE);
      assert.strictEqual(m.soon, 2);
    }
  },
  {
    name: 'F18-T04: Computes week (4..7 days) product count accurately',
    fn: async () => {
      const items = [
        { name: 'Vence en 4d', expiryDate: '2026-10-29', isDiscarded: false, isConsumed: false },
        { name: 'Vence en 7d', expiryDate: '2026-11-01', isDiscarded: false, isConsumed: false },
        { name: 'Vence en 8d', expiryDate: '2026-11-02', isDiscarded: false, isConsumed: false }
      ];
      const m = calculateMetrics(items, REF_DATE);
      assert.strictEqual(m.week, 2);
      assert.strictEqual(m.ok, 1);
    }
  },
  {
    name: 'F18-T05: Consumed and discarded items are excluded from active metrics dashboard',
    fn: async () => {
      const items = [
        { name: 'Item Activo', expiryDate: '2026-10-30', isDiscarded: false, isConsumed: false },
        { name: 'Item Consumido', expiryDate: '2026-10-20', isDiscarded: false, isConsumed: true },
        { name: 'Item Merma', expiryDate: '2026-10-22', isDiscarded: true, isConsumed: false }
      ];
      const m = calculateMetrics(items, REF_DATE);
      assert.strictEqual(m.total, 1);
      assert.strictEqual(m.expired, 0);
    }
  }
];

if (require.main === module) {
  runDirectly('F18: Metrics Summary Dashboard', tests);
}

module.exports = {
  id: 'F18',
  name: 'Metrics Summary Dashboard',
  tests
};
