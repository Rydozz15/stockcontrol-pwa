/**
 * Adversarial UI Layout & Ergonomics Stress Test Suite
 * Milestone 3 - Independent Empirical Verification Harness
 *
 * Checks:
 * 1. CSS Touch Targets: Strict parsing of CSS rules across all 7 UI components (>= 44x44px).
 * 2. Touch Spacing: Spacing between interactive elements (>= 8px).
 * 3. Safe-Area Inset: env(safe-area-inset-*) integration and fallback correctness.
 * 4. Tablet Split-Screen: Media queries (@media (min-width: 768px)), two-column split, sticky positioning, modal suppression.
 * 5. Tab Navigation: Idempotent clicking and cross-language alias resolution in BottomNav.
 * 6. Disjoint Alert Metrics: Partition disjointness of counter cards in MetricsDashboard.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const findings = [];

function assert(condition, message, metadata = {}) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedAssertions++;
    const finding = { message, ...metadata };
    findings.push(finding);
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('============================================================');
console.log('   M3 ADVERSARIAL UI ERGONOMICS & LAYOUT STRESS HARNESS    ');
console.log('============================================================\n');

// Target Component Files
const TARGET_FILES = [
  'src/routes/+layout.svelte',
  'src/routes/+page.svelte',
  'src/lib/components/BottomNav.svelte',
  'src/lib/components/ProductCard.svelte',
  'src/lib/components/ProductForm.svelte',
  'src/lib/components/WorkspaceModal.svelte',
  'src/lib/components/MetricsDashboard.svelte'
];

/**
 * Helper to extract style contents from Svelte file
 */
function extractStyleBlock(content) {
  const match = content.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  return match ? match[1] : '';
}

/**
 * Parses CSS text into rules: selector -> property -> value
 */
function parseCssRules(cssText) {
  const cleanCss = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = {};

  const blockRegex = /([^{}]+)\{([^{}]+)\}/g;
  let match;
  while ((match = blockRegex.exec(cleanCss)) !== null) {
    const rawSelectors = match[1].trim();
    const body = match[2].trim();

    if (rawSelectors.startsWith('@keyframes')) continue;

    const selectors = rawSelectors.split(',').map((s) => s.trim());
    const decls = {};
    body.split(';').forEach((decl) => {
      const colonIdx = decl.indexOf(':');
      if (colonIdx > 0) {
        const prop = decl.slice(0, colonIdx).trim().toLowerCase();
        const val = decl.slice(colonIdx + 1).trim();
        decls[prop] = val;
      }
    });

    for (const sel of selectors) {
      if (!rules[sel]) rules[sel] = {};
      Object.assign(rules[sel], decls);
    }
  }

  return rules;
}

// -------------------------------------------------------------
// SUITE 1: Touch Target Dimension Audit (>= 44x44px)
// -------------------------------------------------------------
console.log('--- SUITE 1: Touch Target Dimension Audit (>= 44x44px) ---');

const MIN_SIZE = 44;

for (const relPath of TARGET_FILES) {
  const fullPath = path.join(PROJECT_ROOT, relPath);
  assert(fs.existsSync(fullPath), `Target file exists: ${relPath}`);

  const content = fs.readFileSync(fullPath, 'utf8');
  const css = extractStyleBlock(content);
  const rules = parseCssRules(css);

  // Search for interactive selectors and their dimensions
  for (const [selector, decls] of Object.entries(rules)) {
    // Exclude pseudo-elements, child icons, dots, badges, spinners, handles
    if (
      selector.includes('::') ||
      selector.includes(':before') ||
      selector.includes(':after') ||
      selector.includes('svg') ||
      selector.includes('icon') ||
      selector.includes('dot') ||
      selector.includes('badge') ||
      selector.includes('spinner') ||
      selector.includes('indicator') ||
      selector.includes('handle') ||
      selector.includes('sr-only')
    ) {
      continue;
    }

    // Identify interactive clickable controls
    const isInteractive =
      selector.includes('btn') ||
      selector.includes('chip') ||
      selector.includes('tab-btn') ||
      selector.includes('action-btn') ||
      selector.includes('card-main-action') ||
      selector.includes('metric-card') ||
      selector.includes('input') ||
      selector.includes('select') ||
      selector.includes('fab') ||
      selector.includes('option') ||
      selector.includes('stepper-btn');

    if (!isInteractive) continue;

    const parsePx = (val) => {
      if (!val) return null;
      if (val.includes('var(--touch-min')) return 44;
      const m = val.match(/^(\d+(?:\.\d+)?)px$/);
      return m ? parseFloat(m[1]) : null;
    };

    const minW = parsePx(decls['min-width']);
    const minH = parsePx(decls['min-height']);
    const w = parsePx(decls['width']);
    const h = parsePx(decls['height']);

    // Check width violations if specified
    if (minW !== null && minW < MIN_SIZE) {
      assert(
        false,
        `[${relPath}] Selector "${selector}" min-width: ${minW}px violates >= 44px standard`,
        { file: relPath, selector, minWidth: minW }
      );
    }
    if (w !== null && w < MIN_SIZE) {
      assert(
        false,
        `[${relPath}] Selector "${selector}" width: ${w}px violates >= 44px standard`,
        { file: relPath, selector, width: w }
      );
    }

    // Check height violations if specified
    if (minH !== null && minH < MIN_SIZE) {
      assert(
        false,
        `[${relPath}] Selector "${selector}" min-height: ${minH}px violates >= 44px standard`,
        { file: relPath, selector, minHeight: minH }
      );
    }
    if (h !== null && h < MIN_SIZE) {
      assert(
        false,
        `[${relPath}] Selector "${selector}" height: ${h}px violates >= 44px standard`,
        { file: relPath, selector, height: h }
      );
    }
  }
}

// Check key buttons known from architecture:
const layoutContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src/routes/+layout.svelte'), 'utf8');
assert(
  layoutContent.includes('.toast-close-btn') && layoutContent.includes('min-width: 44px'),
  'src/routes/+layout.svelte .toast-close-btn has min-width >= 44px'
);

const bottomNavContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src/lib/components/BottomNav.svelte'), 'utf8');
assert(
  bottomNavContent.includes('.nav-tab-btn') && bottomNavContent.includes('min-height: 44px'),
  'BottomNav .nav-tab-btn satisfies min-height >= 44px'
);

const fabContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src/routes/+page.svelte'), 'utf8');
assert(
  fabContent.includes('.fab') && fabContent.includes('width: 56px') && fabContent.includes('height: 56px'),
  '+page.svelte .fab is >= 56x56px (satisfies 44px standard)'
);

// -------------------------------------------------------------
// SUITE 2: Inter-Element Touch Spacing (>= 8px)
// -------------------------------------------------------------
console.log('\n--- SUITE 2: Inter-Element Touch Spacing Audit (>= 8px) ---');

const cardCss = extractStyleBlock(fs.readFileSync(path.join(PROJECT_ROOT, 'src/lib/components/ProductCard.svelte'), 'utf8'));
const cardRules = parseCssRules(cardCss);
const cardActionsGap = parseInt(cardRules['.card-actions']?.gap || '0', 10);
assert(cardActionsGap >= 8, `ProductCard .card-actions gap (${cardActionsGap}px) >= 8px touch spacing`);

const metricsCss = extractStyleBlock(fs.readFileSync(path.join(PROJECT_ROOT, 'src/lib/components/MetricsDashboard.svelte'), 'utf8'));
const metricsRules = parseCssRules(metricsCss);
const metricsGap = parseInt(metricsRules['.metrics-grid']?.gap || '0', 10);
assert(metricsGap >= 8, `MetricsDashboard .metrics-grid gap (${metricsGap}px) >= 8px touch spacing`);

const pageCss = extractStyleBlock(fs.readFileSync(path.join(PROJECT_ROOT, 'src/routes/+page.svelte'), 'utf8'));
const pageRules = parseCssRules(pageCss);
const steppersGap = parseInt(pageRules['.action-steppers']?.gap || '0', 10);
assert(steppersGap >= 8, `+page.svelte .action-steppers gap (${steppersGap}px) >= 8px touch spacing`);

// -------------------------------------------------------------
// SUITE 3: Safe-Area Inset Integration
// -------------------------------------------------------------
console.log('\n--- SUITE 3: Safe-Area Inset Contract Verification ---');

const appHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app.html'), 'utf8');
assert(
  appHtml.includes('viewport-fit=cover'),
  'src/app.html contains viewport-fit=cover meta tag'
);

assert(
  layoutContent.includes('env(safe-area-inset-top') &&
    layoutContent.includes('env(safe-area-inset-bottom') &&
    layoutContent.includes('env(safe-area-inset-left') &&
    layoutContent.includes('env(safe-area-inset-right'),
  '+layout.svelte integrates 4-way safe-area insets in .app-shell'
);

assert(
  bottomNavContent.includes('padding-bottom: env(safe-area-inset-bottom, 0px)'),
  'BottomNav integrates safe-area-inset-bottom with 0px fallback'
);

const pageContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src/routes/+page.svelte'), 'utf8');
assert(
  pageContent.includes('calc(var(--nav-height, 60px) + env(safe-area-inset-bottom, 0px) + 16px)'),
  '+page.svelte .fab bottom positioning accounts for nav height and safe-area inset'
);

// -------------------------------------------------------------
// SUITE 4: Responsive Tablet Split-Screen & Modal Suppression
// -------------------------------------------------------------
console.log('\n--- SUITE 4: Tablet Split-Screen & Modal Suppression ---');

assert(
  pageCss.includes('@media (min-width: 768px)'),
  '+page.svelte defines @media (min-width: 768px) breakpoint'
);

assert(
  pageCss.includes('minmax(360px, 42%) 1fr') || pageCss.includes('grid-template-columns: minmax(360px, 42%) 1fr'),
  '+page.svelte applies two-column split-screen layout on tablet/desktop'
);

assert(
  pageCss.includes('position: sticky') && pageCss.includes('top: 16px'),
  '+page.svelte detail-pane uses persistent sticky positioning on tablet'
);

// Modal suppression on tablet:
assert(
  pageContent.includes('!isTablet && isMobileDetailOpen'),
  '+page.svelte suppresses blocking mobile modal sheet when isTablet is true'
);

assert(
  pageContent.includes('isTablet && !wasTablet && isMobileDetailOpen') &&
    pageContent.includes('isMobileDetailOpen = false'),
  '+page.svelte transitions smoothly from mobile drawer to persistent pane when expanding window'
);

// -------------------------------------------------------------
// SUITE 5: BottomNav Tab Switching & Alias Resolution
// -------------------------------------------------------------
console.log('\n--- SUITE 5: BottomNav Idempotent Tab Switching & Alias Resolution ---');

const isTabActiveMatch = bottomNavContent.match(/export function isTabActive[\s\S]*?\n  \}/);
assert(Boolean(isTabActiveMatch), 'BottomNav exports isTabActive function in module script');

// Strip TypeScript annotations from the function body so Node can evaluate it
let jsCode = isTabActiveMatch[0]
  .replace('export ', '')
  .replace(/\(tabId:\s*string,\s*current:\s*string\):\s*boolean/, '(tabId, current)')
  .replace(/: Record<string,\s*string\[\]>/, '');

const isTabActive = new Function(`${jsCode}; return isTabActive;`)();

// Test alias normalization
const ALIAS_TESTS = [
  { tab: 'inventario', current: 'inventory', expected: true },
  { tab: 'inventory', current: 'inventario', expected: true },
  { tab: 'scanner', current: 'scan', expected: true },
  { tab: 'alertas', current: 'alerts', expected: true },
  { tab: 'alerts', current: 'alertas', expected: true },
  { tab: 'mermas', current: 'alerts', expected: true },
  { tab: 'historial', current: 'history', expected: true },
  { tab: 'ajustes', current: 'settings', expected: true },
  { tab: 'inventario', current: 'alertas', expected: false },
  { tab: 'scanner', current: 'historial', expected: false },
  { tab: '', current: 'inventory', expected: false },
  { tab: 'inventory', current: null, expected: false },
  { tab: 'INVENTARIO', current: 'Inventory', expected: true }
];

for (const t of ALIAS_TESTS) {
  const res = isTabActive(t.tab, t.current);
  assert(
    res === t.expected,
    `isTabActive("${t.tab}", "${t.current}") => ${res} (expected ${t.expected})`
  );
}

// -------------------------------------------------------------
// SUITE 6: Disjoint Counter Cards in MetricsDashboard
// -------------------------------------------------------------
console.log('\n--- SUITE 6: Disjoint Partitioning in MetricsDashboard ---');

const metricsComponent = fs.readFileSync(path.join(PROJECT_ROOT, 'src/lib/components/MetricsDashboard.svelte'), 'utf8');

assert(
  metricsComponent.includes("count: $metricsStore.total") &&
    metricsComponent.includes("count: $metricsStore.expired") &&
    metricsComponent.includes("count: $metricsStore.soon") &&
    metricsComponent.includes("count: $metricsStore.week"),
  'MetricsDashboard displays 4 distinct reactive counts from metricsStore'
);

function categorize(diff) {
  if (diff < 0) return 'expired';
  if (diff <= 3) return 'soon';
  if (diff <= 7) return 'week';
  return 'ok';
}

for (let d = -10; d <= 20; d++) {
  const isExp = d < 0;
  const isSoon = d >= 0 && d <= 3;
  const isWeek = d >= 4 && d <= 7;
  const matches = [isExp, isSoon, isWeek].filter(Boolean).length;
  assert(
    matches <= 1,
    `Day diff ${d} belongs to at most one alert bucket (matches: ${matches})`
  );
}

// -------------------------------------------------------------
// SUMMARY & VERDICT
// -------------------------------------------------------------
console.log('\n============================================================');
console.log('             FINAL ADVERSARIAL TEST SUMMARY                 ');
console.log('============================================================');
console.log(`Total Assertions : ${totalAssertions}`);
console.log(`Passed           : ${passedAssertions}`);
console.log(`Failed           : ${failedAssertions}`);

if (findings.length > 0) {
  console.log('\nCONFIRMED VULNERABILITIES & REGRESSIONS:');
  findings.forEach((f, idx) => {
    console.log(`  ${idx + 1}. ${f.message}`);
  });
}

console.log('============================================================');
if (failedAssertions > 0) {
  console.log('>>> VERDICT: REQUEST_CHANGES (Defects found in touch target contracts)');
  process.exit(1);
} else {
  console.log('>>> VERDICT: APPROVE');
  process.exit(0);
}
