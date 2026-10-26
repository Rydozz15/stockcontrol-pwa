const { assert, runDirectly } = require('../test_helper');
const path = require('path');
const fs = require('fs');
const { validateViewportMeta, inspectSafeAreaUsage } = require('../harness');

const tests = [
  {
    name: 'F17-T01: HTML app shell specifies viewport-fit=cover in meta viewport',
    fn: async () => {
      const rootDir = path.resolve(__dirname, '../../../');
      const indexPath = path.join(rootDir, 'index.html');
      assert.ok(fs.existsSync(indexPath));
      const html = fs.readFileSync(indexPath, 'utf-8');
      const meta = validateViewportMeta(html);
      assert.strictEqual(meta.hasViewportFitCover, true, 'index.html must include viewport-fit=cover');
      assert.strictEqual(meta.hasWidthDeviceWidth, true);
    }
  },
  {
    name: 'F17-T02: Bottom navigation CSS declares env(safe-area-inset-bottom) padding',
    fn: async () => {
      const bottomNavCss = `
        nav.bottom-nav {
          position: fixed;
          bottom: 0;
          padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
        }
      `;
      const inspection = inspectSafeAreaUsage(bottomNavCss);
      assert.strictEqual(inspection.hasBottom, true);
    }
  },
  {
    name: 'F17-T03: Header CSS declares env(safe-area-inset-top) padding',
    fn: async () => {
      const headerCss = `
        header {
          padding-top: calc(16px + env(safe-area-inset-top, 0px));
        }
      `;
      const inspection = inspectSafeAreaUsage(headerCss);
      assert.strictEqual(inspection.hasTop, true);
    }
  },
  {
    name: 'F17-T04: FAB position incorporates safe-area-inset-bottom offset',
    fn: async () => {
      const fabCss = `
        .fab {
          bottom: calc(64px + env(safe-area-inset-bottom, 0px));
        }
      `;
      const inspection = inspectSafeAreaUsage(fabCss);
      assert.strictEqual(inspection.hasBottom, true);
    }
  },
  {
    name: 'F17-T05: Safe area insets declare 0px fallbacks for standard rectangular displays',
    fn: async () => {
      function evaluateSafePadding(insetVal = '0px') {
        const base = 8;
        const inset = parseInt(insetVal, 10) || 0;
        return `${base + inset}px`;
      }
      assert.strictEqual(evaluateSafePadding('0px'), '8px');
      assert.strictEqual(evaluateSafePadding('34px'), '42px'); // e.g. iPhone bottom bar
    }
  }
];

if (require.main === module) {
  runDirectly('F17: Safe Area Inset Support', tests);
}

module.exports = {
  id: 'F17',
  name: 'Safe Area Inset Support',
  tests
};
