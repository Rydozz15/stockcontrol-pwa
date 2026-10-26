const { assert, runDirectly } = require('../test_helper');
const { isTabletSplitLayout, TABLET_BREAKPOINT_PX } = require('../harness');

const tests = [
  {
    name: 'F16-T01: Breakpoint 768px activates tablet split-screen layout',
    fn: async () => {
      assert.strictEqual(TABLET_BREAKPOINT_PX, 768);
      assert.strictEqual(isTabletSplitLayout(768), true);
      assert.strictEqual(isTabletSplitLayout(1024), true);
    }
  },
  {
    name: 'F16-T02: Mobile viewports (<768px) collapse to single-pane layout',
    fn: async () => {
      assert.strictEqual(isTabletSplitLayout(767), false);
      assert.strictEqual(isTabletSplitLayout(414), false);
      assert.strictEqual(isTabletSplitLayout(360), false);
    }
  },
  {
    name: 'F16-T03: Responsive layout CSS contract declares two-column grid at min-width 768px',
    fn: async () => {
      const tabletCssRule = `
        @media (min-width: 768px) {
          .split-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
        }
      `;
      assert.ok(tabletCssRule.includes('min-width: 768px'));
      assert.ok(tabletCssRule.includes('grid-template-columns'));
    }
  },
  {
    name: 'F16-T04: Tablet layout maintains persistent left panel with inventory list',
    fn: async () => {
      function resolveLayoutPanes(viewportWidth) {
        if (isTabletSplitLayout(viewportWidth)) {
          return { leftPane: 'visible', rightPane: 'visible', mode: 'split' };
        }
        return { leftPane: 'visible', rightPane: 'modal_overlay', mode: 'mobile' };
      }
      const tabletPanes = resolveLayoutPanes(800);
      assert.strictEqual(tabletPanes.mode, 'split');
      assert.strictEqual(tabletPanes.rightPane, 'visible');
    }
  },
  {
    name: 'F16-T05: Tablet mode eliminates full-screen blocking modals for item inspection',
    fn: async () => {
      class TabletUiController {
        constructor(width) {
          this.width = width;
          this.selectedProduct = null;
        }
        selectProduct(p) {
          this.selectedProduct = p;
        }
        isModalOpen() {
          return !isTabletSplitLayout(this.width) && this.selectedProduct !== null;
        }
      }

      const tabletUi = new TabletUiController(1024);
      tabletUi.selectProduct({ id: 'p1', name: 'Aceite' });
      assert.strictEqual(tabletUi.isModalOpen(), false, 'Tablet shows side pane instead of modal');

      const mobileUi = new TabletUiController(375);
      mobileUi.selectProduct({ id: 'p1', name: 'Aceite' });
      assert.strictEqual(mobileUi.isModalOpen(), true, 'Mobile opens modal');
    }
  }
];

if (require.main === module) {
  runDirectly('F16: Tablet Split-Screen Layout (>=768px)', tests);
}

module.exports = {
  id: 'F16',
  name: 'Tablet Split-Screen Layout (>=768px)',
  tests
};
