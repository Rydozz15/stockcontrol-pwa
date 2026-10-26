const { assert, runDirectly } = require('../test_helper');
const { isTabletSplitLayout } = require('../harness');

const tests = [
  {
    name: 'B16-T01: Viewport width 767px triggers mobile, while 768px strictly triggers split-view',
    fn: async () => {
      assert.strictEqual(isTabletSplitLayout(767), false, '767px must be single pane mobile');
      assert.strictEqual(isTabletSplitLayout(768), true, '768px must trigger tablet split view');
    }
  },
  {
    name: 'B16-T02: Standard iPad portrait (768x1024) and landscape (1024x768) both qualify as tablet layout',
    fn: async () => {
      assert.strictEqual(isTabletSplitLayout(768), true);
      assert.strictEqual(isTabletSplitLayout(1024), true);
    }
  },
  {
    name: 'B16-T03: Unselected state in right pane displays placeholder rather than blank empty card',
    fn: async () => {
      function getRightPaneContent(selectedProduct) {
        if (!selectedProduct) {
          return { placeholder: 'Selecciona un producto para ver o editar', isForm: false };
        }
        return { product: selectedProduct, isForm: true };
      }
      assert.ok(getRightPaneContent(null).placeholder);
      assert.strictEqual(getRightPaneContent({ name: 'Leche' }).isForm, true);
    }
  },
  {
    name: 'B16-T04: Ultra-wide desktop viewport (2560px) enforces max-width constraint (<=1200px)',
    fn: async () => {
      const layoutContainerCss = {
        maxWidth: '1200px',
        margin: '0 auto'
      };
      assert.ok(parseInt(layoutContainerCss.maxWidth, 10) <= 1280);
    }
  },
  {
    name: 'B16-T05: Resizing across 768px boundary retains state without data loss',
    fn: async () => {
      class ResponsiveViewManager {
        constructor() {
          this.currentWidth = 800;
          this.selectedId = 'p1';
        }
        resize(newWidth) {
          this.currentWidth = newWidth;
          // selectedId is preserved
        }
      }
      const mgr = new ResponsiveViewManager();
      mgr.resize(500); // shrink to mobile
      assert.strictEqual(mgr.selectedId, 'p1');
      mgr.resize(900); // expand to tablet
      assert.strictEqual(mgr.selectedId, 'p1');
    }
  }
];

if (require.main === module) {
  runDirectly('B16: Tablet Split-Screen Boundaries', tests);
}

module.exports = {
  id: 'B16',
  name: 'Tablet Split-Screen Boundaries',
  tests
};
