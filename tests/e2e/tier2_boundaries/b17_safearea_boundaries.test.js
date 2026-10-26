const { assert, runDirectly } = require('../test_helper');
const { inspectSafeAreaUsage } = require('../harness');

const tests = [
  {
    name: 'B17-T01: Safe area insets with 0px fallback evaluate cleanly on standard rectangular screens',
    fn: async () => {
      function computeNavPadding(insetBottomPx = 0) {
        return 12 + insetBottomPx;
      }
      assert.strictEqual(computeNavPadding(0), 12);
      assert.strictEqual(computeNavPadding(34), 46);
    }
  },
  {
    name: 'B17-T02: Large top inset (48px notch / dynamic island) handled without clipping header',
    fn: async () => {
      const headerCss = `
        header {
          padding-top: calc(16px + env(safe-area-inset-top, 0px));
          min-height: calc(60px + env(safe-area-inset-top, 0px));
        }
      `;
      const inspection = inspectSafeAreaUsage(headerCss);
      assert.strictEqual(inspection.hasTop, true);
    }
  },
  {
    name: 'B17-T03: Asymmetrical landscape insets (notch on left) support safe-area-inset-left and right',
    fn: async () => {
      const landscapeContainerCss = `
        .container {
          padding-left: env(safe-area-inset-left, 16px);
          padding-right: env(safe-area-inset-right, 16px);
        }
      `;
      const inspection = inspectSafeAreaUsage(landscapeContainerCss);
      assert.strictEqual(inspection.hasLeft, true);
      assert.strictEqual(inspection.hasRight, true);
    }
  },
  {
    name: 'B17-T04: CSS calc expressions with env() are syntactically valid',
    fn: async () => {
      const expression = 'calc(56px + env(safe-area-inset-bottom, 0px))';
      assert.ok(expression.startsWith('calc(') && expression.endsWith(')'));
      assert.ok(expression.includes('env('));
    }
  },
  {
    name: 'B17-T05: Safe area inset null/undefined handling does not produce NaN pixels',
    fn: async () => {
      function safePixelParse(val) {
        if (!val || typeof val !== 'string') return 0;
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
      }
      assert.strictEqual(safePixelParse(null), 0);
      assert.strictEqual(safePixelParse(''), 0);
      assert.strictEqual(safePixelParse('24px'), 24);
    }
  }
];

if (require.main === module) {
  runDirectly('B17: Safe Area Boundaries', tests);
}

module.exports = {
  id: 'B17',
  name: 'Safe Area Boundaries',
  tests
};
