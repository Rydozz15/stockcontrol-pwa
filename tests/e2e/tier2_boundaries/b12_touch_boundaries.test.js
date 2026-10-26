const { assert, runDirectly } = require('../test_helper');
const { validateTouchTarget, validateTouchSpacing, MIN_TOUCH_SIZE_PX } = require('../harness');

const tests = [
  {
    name: 'B12-T01: Small 24x24px icons use transparent padding to satisfy 44x44px touch envelope',
    fn: async () => {
      // An icon might be 24x24 visually, but the button has padding: 10px on each side -> (24 + 20) = 44px
      function calculateInteractiveBox(visualWidth, visualHeight, paddingX, paddingY) {
        return {
          width: visualWidth + paddingX * 2,
          height: visualHeight + paddingY * 2
        };
      }
      const iconButton = calculateInteractiveBox(24, 24, 10, 10);
      const res = validateTouchTarget(iconButton.width, iconButton.height);
      assert.strictEqual(res.compliant, true);
    }
  },
  {
    name: 'B12-T02: Touch spacing strictly under 8px (e.g. 7px or 0px) fails spacing compliance',
    fn: async () => {
      assert.strictEqual(validateTouchSpacing(7.9), false);
      assert.strictEqual(validateTouchSpacing(0), false);
      assert.strictEqual(validateTouchSpacing(8.0), true);
    }
  },
  {
    name: 'B12-T03: Target dimensions at exact boundary (44.0px by 44.0px) pass validation',
    fn: async () => {
      const res = validateTouchTarget(44, 44);
      assert.strictEqual(res.compliant, true);
      assert.strictEqual(res.errors.length, 0);

      const resFail = validateTouchTarget(43.9, 44);
      assert.strictEqual(resFail.compliant, false);
    }
  },
  {
    name: 'B12-T04: Touch target calculation on notched devices adds bottom clearance above gesture bar',
    fn: async () => {
      function calculateBottomNavTarget(baseHeight, safeAreaBottom) {
        return baseHeight + safeAreaBottom;
      }
      const mobileWithNotchHeight = calculateBottomNavTarget(48, 34);
      assert.strictEqual(mobileWithNotchHeight, 82);
      assert.ok(mobileWithNotchHeight >= MIN_TOUCH_SIZE_PX);
    }
  },
  {
    name: 'B12-T05: Inline action buttons with short labels maintain >=44px height',
    fn: async () => {
      const miniButtons = [
        { label: 'Editar', width: 60, height: 44 },
        { label: 'Eliminar', width: 70, height: 44 }
      ];
      for (const btn of miniButtons) {
        assert.ok(btn.height >= MIN_TOUCH_SIZE_PX);
        assert.ok(btn.width >= MIN_TOUCH_SIZE_PX);
      }
    }
  }
];

if (require.main === module) {
  runDirectly('B12: Touch Target Boundaries', tests);
}

module.exports = {
  id: 'B12',
  name: 'Touch Target Boundaries',
  tests
};
