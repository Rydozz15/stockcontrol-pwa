const { assert, runDirectly } = require('../test_helper');
const { calculatePresetDate } = require('../harness');

const tests = [
  {
    name: 'B14-T01: January 31 + 1 month clamps to February 28 in common year (2027), never rolling to March',
    fn: async () => {
      const res = calculatePresetDate('2027-01-31', '+1m');
      assert.strictEqual(res, '2027-02-28', 'Must clamp to Feb 28, not roll over to March 2 or 3');
    }
  },
  {
    name: 'B14-T02: January 31 + 1 month clamps to February 29 in leap year (2028)',
    fn: async () => {
      const res = calculatePresetDate('2028-01-31', '+1m');
      assert.strictEqual(res, '2028-02-29', 'Must clamp to Feb 29 in leap year');
    }
  },
  {
    name: 'B14-T03: Year rollover: December 31 + 1 month yields January 31 of following year',
    fn: async () => {
      const res = calculatePresetDate('2026-12-31', '+1m');
      assert.strictEqual(res, '2027-01-31');
    }
  },
  {
    name: 'B14-T04: 31-day month to 30-day month: August 31 + 1 month clamps to September 30',
    fn: async () => {
      const res = calculatePresetDate('2026-08-31', '+1m');
      assert.strictEqual(res, '2026-09-30', 'Must clamp to Sept 30, not roll into October');
    }
  },
  {
    name: 'B14-T05: February 28 + 2 days in leap year 2028 lands on March 1, 2028 (accounting for Feb 29)',
    fn: async () => {
      const res = calculatePresetDate('2028-02-28', '+2d');
      assert.strictEqual(res, '2028-03-01');
    }
  }
];

if (require.main === module) {
  runDirectly('B14: Quick Expiry Presets Boundaries', tests);
}

module.exports = {
  id: 'B14',
  name: 'Quick Expiry Presets Boundaries',
  tests
};
