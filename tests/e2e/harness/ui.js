/**
 * UI Ergonomics & Responsive Layout Contract Reference Oracle
 * Authoritative source: ORIGINAL_REQUEST.md § R3, PROJECT.md § Feature 11, 12, 13, 16, 17
 */

const MIN_TOUCH_SIZE_PX = 44;
const MIN_TOUCH_SPACING_PX = 8;
const TABLET_BREAKPOINT_PX = 768;

/**
 * Validates touch target dimensions according to WCAG 2.5.5 / 2.5.8 and kitchen ergonomics.
 * @param {number} widthPx
 * @param {number} heightPx
 * @returns {{ compliant: boolean; errors: string[] }}
 */
function validateTouchTarget(widthPx, heightPx) {
  const errors = [];
  if (widthPx < MIN_TOUCH_SIZE_PX) {
    errors.push(`Width ${widthPx}px is below minimum required ${MIN_TOUCH_SIZE_PX}px`);
  }
  if (heightPx < MIN_TOUCH_SIZE_PX) {
    errors.push(`Height ${heightPx}px is below minimum required ${MIN_TOUCH_SIZE_PX}px`);
  }
  return { compliant: errors.length === 0, errors };
}

/**
 * Validates spacing between adjacent touch targets.
 * @param {number} spacingPx
 * @returns {boolean}
 */
function validateTouchSpacing(spacingPx) {
  return spacingPx >= MIN_TOUCH_SPACING_PX;
}

/**
 * Determines whether a given viewport width triggers the tablet split-screen layout.
 * @param {number} viewportWidthPx
 * @returns {boolean}
 */
function isTabletSplitLayout(viewportWidthPx) {
  return viewportWidthPx >= TABLET_BREAKPOINT_PX;
}

/**
 * Verifies that a CSS string or style declaration properly incorporates safe area insets.
 * @param {string} css
 * @returns {{ hasTop: boolean; hasBottom: boolean; hasLeft: boolean; hasRight: boolean }}
 */
function inspectSafeAreaUsage(css) {
  if (!css || typeof css !== 'string') {
    return { hasTop: false, hasBottom: false, hasLeft: false, hasRight: false };
  }
  return {
    hasTop: /env\(\s*safe-area-inset-top/i.test(css),
    hasBottom: /env\(\s*safe-area-inset-bottom/i.test(css),
    hasLeft: /env\(\s*safe-area-inset-left/i.test(css),
    hasRight: /env\(\s*safe-area-inset-right/i.test(css)
  };
}

/**
 * Validates viewport meta tag attributes.
 * @param {string} content
 * @returns {{ hasViewportFitCover: boolean; hasWidthDeviceWidth: boolean; hasInitialScale: boolean }}
 */
function validateViewportMeta(content) {
  const c = content || '';
  return {
    hasViewportFitCover: c.includes('viewport-fit=cover'),
    hasWidthDeviceWidth: c.includes('width=device-width'),
    hasInitialScale: c.includes('initial-scale=1')
  };
}

module.exports = {
  MIN_TOUCH_SIZE_PX,
  MIN_TOUCH_SPACING_PX,
  TABLET_BREAKPOINT_PX,
  validateTouchTarget,
  validateTouchSpacing,
  isTabletSplitLayout,
  inspectSafeAreaUsage,
  validateViewportMeta
};
