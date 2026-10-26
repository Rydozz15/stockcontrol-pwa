const { assert, runDirectly } = require('../test_helper');
const { calculateExpiryStatus, dayDiff } = require('../harness');

const tests = [
  {
    name: 'B02-T01: Leap year Feb 29 calculation accuracy',
    fn: async () => {
      // 2028 is a leap year. Feb 28 to Feb 29 is 1 day. Feb 28 to Mar 1 is 2 days.
      const leapFeb28 = new Date('2028-02-28T00:00:00');
      const diff1 = dayDiff('2028-02-29', leapFeb28);
      assert.strictEqual(diff1, 1, 'Feb 28 to Feb 29 in leap year must be 1 day');

      const diff2 = dayDiff('2028-03-01', leapFeb28);
      assert.strictEqual(diff2, 2, 'Feb 28 to Mar 1 in leap year must be 2 days');
    }
  },
  {
    name: 'B02-T02: Daylight saving time clock shift does not disrupt whole calendar day difference',
    fn: async () => {
      // DST transition dates (e.g. clock moves forward or backward by 1h, resulting in 23h or 25h days)
      const dstDay = new Date('2026-09-05T00:00:00');
      const nextDayDiff = dayDiff('2026-09-06', dstDay);
      assert.strictEqual(nextDayDiff, 1, 'Calendar day difference must strictly be 1 despite 23h/25h shifts');
    }
  },
  {
    name: 'B02-T03: Far-future expiry (>10 years, canned honey / Himalayan salt) categorizes as ok',
    fn: async () => {
      const today = new Date('2026-10-25T00:00:00');
      const status = calculateExpiryStatus('2038-12-31', today);
      assert.strictEqual(status.key, 'ok');
      assert.strictEqual(status.label, 'Vigente');
      assert.ok(status.daysRemaining > 4000);
    }
  },
  {
    name: 'B02-T04: Historical / extreme past expiry (>5 years) categorizes as expired without overflow',
    fn: async () => {
      const today = new Date('2026-10-25T00:00:00');
      const status = calculateExpiryStatus('2019-01-01', today);
      assert.strictEqual(status.key, 'expired');
      assert.ok(status.daysRemaining < -2500);
      assert.ok(status.label.includes('Vencido hace'));
    }
  },
  {
    name: 'B02-T05: Malformed date string inputs do not throw and return safe fallback',
    fn: async () => {
      const today = new Date('2026-10-25T00:00:00');
      const invalidFormats = ['', null, undefined, 'not-a-date', '2026-99-99'];
      for (const inv of invalidFormats) {
        const status = calculateExpiryStatus(inv, today);
        assert.ok(status && typeof status.key === 'string');
      }
    }
  }
];

if (require.main === module) {
  runDirectly('B02: Domain Expiry Boundaries', tests);
}

module.exports = {
  id: 'B02',
  name: 'Domain Expiry Boundaries',
  tests
};
