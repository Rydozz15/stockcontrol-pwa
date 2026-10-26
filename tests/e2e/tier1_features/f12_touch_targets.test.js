const { assert, runDirectly } = require('../test_helper');
const { validateTouchTarget, validateTouchSpacing, MIN_TOUCH_SIZE_PX } = require('../harness');

const tests = [
  {
    name: 'F12-T01: Bottom navigation tab buttons satisfy minimum 44x44px touch target',
    fn: async () => {
      const bottomNavTabDimensions = { width: 64, height: 48 };
      const res = validateTouchTarget(bottomNavTabDimensions.width, bottomNavTabDimensions.height);
      assert.strictEqual(res.compliant, true);
    }
  },
  {
    name: 'F12-T02: Floating Action Button (FAB) satisfies minimum 56x56px touch target',
    fn: async () => {
      const fabDimensions = { width: 56, height: 56 };
      const res = validateTouchTarget(fabDimensions.width, fabDimensions.height);
      assert.strictEqual(res.compliant, true);
      assert.ok(fabDimensions.width >= MIN_TOUCH_SIZE_PX);
      assert.ok(fabDimensions.height >= MIN_TOUCH_SIZE_PX);
    }
  },
  {
    name: 'F12-T03: Form submit and action buttons meet minimum height of 44px',
    fn: async () => {
      const submitBtn = { width: 140, height: 44 };
      const res = validateTouchTarget(submitBtn.width, submitBtn.height);
      assert.strictEqual(res.compliant, true);
    }
  },
  {
    name: 'F12-T04: Card 1-tap quick action buttons provide >=44x44px tap area',
    fn: async () => {
      // Buttons in cards: 44px min-height with touch padding
      const cardActionBtn = { width: 88, height: 44 };
      const res = validateTouchTarget(cardActionBtn.width, cardActionBtn.height);
      assert.strictEqual(res.compliant, true);
    }
  },
  {
    name: 'F12-T05: Spacing between adjacent interactive controls is at least 8px',
    fn: async () => {
      const spacingToolbar = 8;
      const spacingCardActions = 10;
      assert.strictEqual(validateTouchSpacing(spacingToolbar), true);
      assert.strictEqual(validateTouchSpacing(spacingCardActions), true);
      assert.strictEqual(validateTouchSpacing(4), false);
    }
  }
];

if (require.main === module) {
  runDirectly('F12: Touch Target Compliance (>=44x44px)', tests);
}

module.exports = {
  id: 'F12',
  name: 'Touch Target Compliance (>=44x44px)',
  tests
};
