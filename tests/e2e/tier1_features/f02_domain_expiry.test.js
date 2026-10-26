const { assert, runDirectly } = require('../test_helper');
const { calculateExpiryStatus, dayDiff } = require('../harness');

const REF_DATE = new Date('2026-10-25T00:00:00');

const tests = [
  {
    name: 'F02-T01: Product expiring yesterday is categorized as "expired"',
    fn: async () => {
      const status = calculateExpiryStatus('2026-10-24', REF_DATE);
      assert.strictEqual(status.key, 'expired');
      assert.strictEqual(status.daysRemaining, -1);
      assert.strictEqual(status.cls, 'expired');
      assert.strictEqual(status.label, 'Vencido hace 1 día(s)');
    }
  },
  {
    name: 'F02-T02: Product expiring today is categorized as "soon" with label "Vence hoy"',
    fn: async () => {
      const status = calculateExpiryStatus('2026-10-25', REF_DATE);
      assert.strictEqual(status.key, 'soon');
      assert.strictEqual(status.daysRemaining, 0);
      assert.strictEqual(status.cls, 'warning');
      assert.strictEqual(status.label, 'Vence hoy');
    }
  },
  {
    name: 'F02-T03: Product expiring in 2 days is categorized as "soon" (<=3 days)',
    fn: async () => {
      const status = calculateExpiryStatus('2026-10-27', REF_DATE);
      assert.strictEqual(status.key, 'soon');
      assert.strictEqual(status.daysRemaining, 2);
      assert.strictEqual(status.cls, 'warning');
      assert.strictEqual(status.label, 'Vence en 2 día(s)');
    }
  },
  {
    name: 'F02-T04: Product expiring in 6 days is categorized as "week" (4..7 days)',
    fn: async () => {
      const status = calculateExpiryStatus('2026-10-31', REF_DATE);
      assert.strictEqual(status.key, 'week');
      assert.strictEqual(status.daysRemaining, 6);
      assert.strictEqual(status.cls, 'warning');
      assert.strictEqual(status.label, 'Vence en 6 días');
    }
  },
  {
    name: 'F02-T05: Product expiring in 20 days is categorized as "ok" (>7 days)',
    fn: async () => {
      const status = calculateExpiryStatus('2026-11-14', REF_DATE);
      assert.strictEqual(status.key, 'ok');
      assert.strictEqual(status.daysRemaining, 20);
      assert.strictEqual(status.cls, 'ok');
      assert.strictEqual(status.label, 'Vigente');
    }
  }
];

if (require.main === module) {
  runDirectly('F02: Pure Domain Expiry Rules', tests);
}

module.exports = {
  id: 'F02',
  name: 'Pure Domain Expiry Rules',
  tests
};
