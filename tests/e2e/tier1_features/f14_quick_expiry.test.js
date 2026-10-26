const { assert, runDirectly } = require('../test_helper');
const { calculatePresetDate } = require('../harness');

const BASE_DATE = '2026-10-25';

const tests = [
  {
    name: 'F14-T01: Quick preset +2d adds 2 days correctly',
    fn: async () => {
      const result = calculatePresetDate(BASE_DATE, '+2d');
      assert.strictEqual(result, '2026-10-27');
    }
  },
  {
    name: 'F14-T02: Quick preset +3d adds 3 days correctly',
    fn: async () => {
      const result = calculatePresetDate(BASE_DATE, '+3d');
      assert.strictEqual(result, '2026-10-28');
    }
  },
  {
    name: 'F14-T03: Quick preset +1w adds 7 days correctly',
    fn: async () => {
      const result = calculatePresetDate(BASE_DATE, '+1w');
      assert.strictEqual(result, '2026-11-01');
    }
  },
  {
    name: 'F14-T04: Quick preset +1m adds 1 month with day preservation',
    fn: async () => {
      const result = calculatePresetDate(BASE_DATE, '+1m');
      assert.strictEqual(result, '2026-11-25');
    }
  },
  {
    name: 'F14-T05: Quick presets return formatted YYYY-MM-DD string',
    fn: async () => {
      const presets = ['+2d', '+3d', '+1w', '+1m'];
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      for (const p of presets) {
        const out = calculatePresetDate(BASE_DATE, p);
        assert.ok(dateRegex.test(out), `Preset ${p} must match YYYY-MM-DD: got ${out}`);
      }
    }
  }
];

if (require.main === module) {
  runDirectly('F14: Quick Expiry Presets', tests);
}

module.exports = {
  id: 'F14',
  name: 'Quick Expiry Presets',
  tests
};
