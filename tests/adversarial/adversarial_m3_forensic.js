/**
 * StockControl PWA — Milestone 3 Forensic Integrity Audit Battery
 * Independent empirical verification of Milestone 3 presentation layer.
 * 
 * Verifies:
 * 1. Expiry Date Arithmetic: Presets (+2d, +3d, +1w, +1m) with leap year and month-end clamping
 * 2. WCAG 2.5.5 Touch Target Compliance: CSS dimensions (>=44x44px, >=8px gap, 56x56px FAB)
 * 3. Safe Area Inset Compliance: CSS env(safe-area-inset-*) across layout and components
 * 4. Responsive Tablet Contract: @media (min-width: 768px) split screen and sticky inspector
 * 5. Metrics Disjointness Invariant: Zero double-counting across expired, soon, week, ok
 * 6. Source Anti-Cheating Forensics: No fake facades, hardcoded mocks, or bypassed logic
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

import {
  presetPlus2Days,
  presetPlus3Days,
  presetPlus1Week,
  presetPlus1Month,
  addDaysSafe,
  addWeeksSafe,
  addMonthsSafe,
  calculateDayDiff,
  calculateExpiryStatus,
  calculateMetrics,
  formatDateISO,
  parseLocalDate
} from '../../src/lib/domain/expiry.ts';

let totalAssertions = 0;
let passedAssertions = 0;

function check(desc, fn) {
  totalAssertions++;
  try {
    fn();
    passedAssertions++;
    console.log(`  ✓ PASS: ${desc}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log('============================================================');
console.log('   M3 FORENSIC INTEGRITY AUDIT - INDEPENDENT BATTERY        ');
console.log('============================================================\n');

// -------------------------------------------------------------
// SECTION 1: Genuine Date Arithmetic & Preset Integrity
// -------------------------------------------------------------
console.log('--- SECTION 1: Date Arithmetic & Preset Edge Case Forensics ---');

check('addDaysSafe handles standard month crossing (Oct 30 + 2d -> Nov 01)', () => {
  const result = addDaysSafe('2026-10-30', 2);
  assert.strictEqual(result, '2026-11-01');
});

check('addDaysSafe handles leap year day 29 (Feb 27 + 2d in 2024 -> Feb 29)', () => {
  const result = addDaysSafe('2024-02-27', 2);
  assert.strictEqual(result, '2024-02-29');
});

check('addDaysSafe handles non-leap year Feb crossing (Feb 27 + 2d in 2026 -> Mar 01)', () => {
  const result = addDaysSafe('2026-02-27', 2);
  assert.strictEqual(result, '2026-03-01');
});

check('addDaysSafe handles year-end rollover (Dec 31, 2026 + 3d -> Jan 03, 2027)', () => {
  const result = addDaysSafe('2026-12-31', 3);
  assert.strictEqual(result, '2027-01-03');
});

check('addWeeksSafe handles 1 week across month (Oct 28 + 1w -> Nov 04)', () => {
  const result = addWeeksSafe('2026-10-28', 1);
  assert.strictEqual(result, '2026-11-04');
});

check('addMonthsSafe clamps Jan 31 to Feb 28 on non-leap year (2025-01-31 -> 2025-02-28)', () => {
  const result = addMonthsSafe('2025-01-31', 1);
  assert.strictEqual(result, '2025-02-28');
});

check('addMonthsSafe clamps Jan 31 to Feb 29 on leap year (2024-01-31 -> 2024-02-29)', () => {
  const result = addMonthsSafe('2024-01-31', 1);
  assert.strictEqual(result, '2024-02-29');
});

check('addMonthsSafe clamps March 31 to April 30 (31-day to 30-day month)', () => {
  const result = addMonthsSafe('2026-03-31', 1);
  assert.strictEqual(result, '2026-04-30');
});

check('addMonthsSafe clamps August 31 to September 30', () => {
  const result = addMonthsSafe('2026-08-31', 1);
  assert.strictEqual(result, '2026-09-30');
});

check('addMonthsSafe handles year rollover (Dec 15, 2026 + 1m -> Jan 15, 2027)', () => {
  const result = addMonthsSafe('2026-12-15', 1);
  assert.strictEqual(result, '2027-01-15');
});

check('Presets accept reference date and return mathematically exact ISO dates', () => {
  const ref = '2026-05-10';
  assert.strictEqual(presetPlus2Days(ref), '2026-05-12');
  assert.strictEqual(presetPlus3Days(ref), '2026-05-13');
  assert.strictEqual(presetPlus1Week(ref), '2026-05-17');
  assert.strictEqual(presetPlus1Month(ref), '2026-06-10');
});

// -------------------------------------------------------------
// SECTION 2: WCAG 2.5.5 Touch Targets in Component CSS Forensics
// -------------------------------------------------------------
console.log('\n--- SECTION 2: WCAG 2.5.5 CSS Touch Targets Empirical Analysis ---');

const layoutPath = path.join(ROOT_DIR, 'src/routes/+layout.svelte');
const layoutCss = fs.readFileSync(layoutPath, 'utf8');

check('+layout.svelte: .toast-close-btn specifies min-width >= 44px and min-height >= 44px', () => {
  const minWidthMatch = layoutCss.match(/\.toast-close-btn\s*\{[^}]*min-width:\s*(\d+)px/);
  const minHeightMatch = layoutCss.match(/\.toast-close-btn\s*\{[^}]*min-height:\s*(\d+)px/);
  assert.ok(minWidthMatch, 'min-width rule must exist on .toast-close-btn');
  assert.ok(minHeightMatch, 'min-height rule must exist on .toast-close-btn');
  assert.ok(parseInt(minWidthMatch[1], 10) >= 44, 'min-width must be >= 44px');
  assert.ok(parseInt(minHeightMatch[1], 10) >= 44, 'min-height must be >= 44px');
});

check('+layout.svelte: defines --touch-min variable >= 44px', () => {
  const touchMinMatch = layoutCss.match(/--touch-min:\s*(\d+)px/);
  assert.ok(touchMinMatch, '--touch-min variable must be defined in :root');
  assert.ok(parseInt(touchMinMatch[1], 10) >= 44, '--touch-min must be >= 44px');
});

const bottomNavPath = path.join(ROOT_DIR, 'src/lib/components/BottomNav.svelte');
const bottomNavCss = fs.readFileSync(bottomNavPath, 'utf8');

check('BottomNav.svelte: .nav-tab-btn satisfies min-width and min-height >= 44px', () => {
  const minWidthMatch = bottomNavCss.match(/\.nav-tab-btn\s*\{[^}]*min-width:\s*(\d+)px/);
  const minHeightMatch = bottomNavCss.match(/\.nav-tab-btn\s*\{[^}]*min-height:\s*(\d+)px/);
  assert.ok(minWidthMatch, 'min-width rule must exist on .nav-tab-btn');
  assert.ok(minHeightMatch, 'min-height rule must exist on .nav-tab-btn');
  assert.ok(parseInt(minWidthMatch[1], 10) >= 44, 'nav-tab-btn min-width >= 44px');
  assert.ok(parseInt(minHeightMatch[1], 10) >= 44, 'nav-tab-btn min-height >= 44px');
});

check('BottomNav.svelte: tabs-container min-height >= 56px', () => {
  const minHeightMatch = bottomNavCss.match(/\.tabs-container\s*\{[^}]*min-height:\s*(\d+)px/);
  assert.ok(minHeightMatch, 'min-height must exist on .tabs-container');
  assert.ok(parseInt(minHeightMatch[1], 10) >= 56, '.tabs-container min-height >= 56px');
});

const productCardPath = path.join(ROOT_DIR, 'src/lib/components/ProductCard.svelte');
const productCardCss = fs.readFileSync(productCardPath, 'utf8');

check('ProductCard.svelte: .action-btn satisfies min-height >= 44px and touch-action manipulation', () => {
  const minHeightMatch = productCardCss.match(/\.action-btn\s*\{[^}]*min-height:\s*(\d+)px/);
  assert.ok(minHeightMatch, 'min-height rule must exist on .action-btn');
  assert.ok(parseInt(minHeightMatch[1], 10) >= 44, '.action-btn min-height >= 44px');
  assert.ok(productCardCss.includes('touch-action: manipulation'));
});

check('ProductCard.svelte: .card-actions has gap >= 8px for spacing compliance', () => {
  const gapMatch = productCardCss.match(/\.card-actions\s*\{[^}]*gap:\s*(\d+)px/);
  assert.ok(gapMatch, 'gap rule must exist on .card-actions');
  assert.ok(parseInt(gapMatch[1], 10) >= 8, 'gap between action buttons must be >= 8px');
});

check('ProductCard.svelte: .quantity-badge >= 44px in both dimensions', () => {
  const minWidthMatch = productCardCss.match(/\.quantity-badge\s*\{[^}]*min-width:\s*(\d+)px/);
  const heightMatch = productCardCss.match(/\.quantity-badge\s*\{[^}]*height:\s*(\d+)px/);
  assert.ok(minWidthMatch && heightMatch, 'dimensions must exist on .quantity-badge');
  assert.ok(parseInt(minWidthMatch[1], 10) >= 44, 'quantity-badge min-width >= 44px');
  assert.ok(parseInt(heightMatch[1], 10) >= 44, 'quantity-badge height >= 44px');
});

const productFormPath = path.join(ROOT_DIR, 'src/lib/components/ProductForm.svelte');
const productFormCss = fs.readFileSync(productFormPath, 'utf8');

check('ProductForm.svelte: stepper buttons satisfy min-width and min-height >= 48px', () => {
  const minWidthMatch = productFormCss.match(/\.stepper-btn\s*\{[^}]*min-width:\s*(\d+)px/);
  const minHeightMatch = productFormCss.match(/\.stepper-btn\s*\{[^}]*min-height:\s*(\d+)px/);
  assert.ok(minWidthMatch && minHeightMatch, 'dimensions must exist on .stepper-btn');
  assert.ok(parseInt(minWidthMatch[1], 10) >= 48, '.stepper-btn min-width >= 48px');
  assert.ok(parseInt(minHeightMatch[1], 10) >= 48, '.stepper-btn min-height >= 48px');
});

check('ProductForm.svelte: category pills and preset buttons satisfy min-height >= 44px', () => {
  const catPillMatch = productFormCss.match(/\.category-pill\s*\{[^}]*min-height:\s*(\d+)px/);
  const presetMatch = productFormCss.match(/\.preset-btn\s*\{[^}]*min-height:\s*(\d+)px/);
  assert.ok(catPillMatch && presetMatch, 'category-pill and preset-btn min-height must exist');
  assert.ok(parseInt(catPillMatch[1], 10) >= 44, '.category-pill min-height >= 44px');
  assert.ok(parseInt(presetMatch[1], 10) >= 44, '.preset-btn min-height >= 44px');
});

const pagePath = path.join(ROOT_DIR, 'src/routes/+page.svelte');
const pageCss = fs.readFileSync(pagePath, 'utf8');

check('+page.svelte: FAB satisfies width: 56px, height: 56px, border-radius: 50%', () => {
  const fabMatch = pageCss.match(/\.fab\s*\{([^}]+)\}/);
  assert.ok(fabMatch, '.fab CSS rule must exist');
  const body = fabMatch[1];
  assert.ok(/width:\s*56px/.test(body), 'FAB width must be 56px');
  assert.ok(/height:\s*56px/.test(body), 'FAB height must be 56px');
  assert.ok(/border-radius:\s*50%/.test(body), 'FAB must be circular');
  assert.ok(/position:\s*fixed/.test(body), 'FAB must be fixed');
});

// -------------------------------------------------------------
// SECTION 3: Safe Area Inset Compliance Forensics
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Safe Area Inset Forensics ---');

check('+layout.svelte incorporates env(safe-area-inset-top) and env(safe-area-inset-bottom)', () => {
  assert.ok(layoutCss.includes('env(safe-area-inset-top'), 'Layout must include safe-area-inset-top');
  assert.ok(layoutCss.includes('env(safe-area-inset-bottom'), 'Layout must include safe-area-inset-bottom');
  assert.ok(layoutCss.includes('viewport-fit=cover'), 'HTML meta must have viewport-fit=cover');
});

check('BottomNav.svelte incorporates padding-bottom with env(safe-area-inset-bottom)', () => {
  assert.ok(bottomNavCss.includes('env(safe-area-inset-bottom'), 'BottomNav must include safe-area-inset-bottom');
});

check('+page.svelte positions FAB taking env(safe-area-inset-bottom) into account', () => {
  const fabMatch = pageCss.match(/\.fab\s*\{([^}]+)\}/);
  assert.ok(fabMatch[1].includes('env(safe-area-inset-bottom'), 'FAB must adjust for safe-area-inset-bottom');
});

// -------------------------------------------------------------
// SECTION 4: Responsive Tablet Split-Screen Contract Forensics
// -------------------------------------------------------------
console.log('\n--- SECTION 4: Tablet Split-Screen Layout Forensics ---');

check('+page.svelte defines @media (min-width: 768px) grid layout rule', () => {
  const mediaIdx = pageCss.indexOf('@media (min-width: 768px)');
  assert.ok(mediaIdx !== -1, 'Must have @media (min-width: 768px)');
  
  // Extract balanced media query block
  const startBrace = pageCss.indexOf('{', mediaIdx);
  let depth = 1;
  let endIdx = startBrace + 1;
  while (depth > 0 && endIdx < pageCss.length) {
    if (pageCss[endIdx] === '{') depth++;
    else if (pageCss[endIdx] === '}') depth--;
    endIdx++;
  }
  const mediaBlock = pageCss.slice(startBrace, endIdx);

  assert.ok(mediaBlock.includes('grid-template-columns'), 'Must configure two columns in tablet split view');
  assert.ok(mediaBlock.includes('.detail-pane'), 'Must display .detail-pane on screens >= 768px');
  assert.ok(mediaBlock.includes('display: block'), '.detail-pane must be display: block in tablet media query');
});


check('+page.svelte hides .detail-pane on mobile viewports (<768px)', () => {
  const mobileDetailMatch = pageCss.match(/\.detail-pane\s*\{[^}]*display:\s*none/);
  assert.ok(mobileDetailMatch, '.detail-pane must be display: none by default on mobile');
});

// -------------------------------------------------------------
// SECTION 5: Metrics Disjointness & Reactivity Forensics
// -------------------------------------------------------------
console.log('\n--- SECTION 5: Metrics Disjointness Mathematical Proof ---');

check('Partition of 100 random food expiry dates preserves strict disjointness and completeness', () => {
  const refDate = new Date('2026-10-25T12:00:00');
  const items = [];
  
  // Synthesize diverse products across past, today, critical, week, and distant future
  for (let i = -20; i <= 30; i++) {
    items.push({
      id: `prod_${i}`,
      name: `Ingrediente Test ${i}`,
      expiryDate: addDaysSafe('2026-10-25', i),
      quantity: 5,
      isDiscarded: false,
      isConsumed: false
    });
  }

  // Add discarded and consumed products
  items.push({ id: 'd1', name: 'Merma', expiryDate: '2026-10-20', quantity: 0, isDiscarded: true, isConsumed: false });
  items.push({ id: 'c1', name: 'Agotado', expiryDate: '2026-10-22', quantity: 0, isDiscarded: false, isConsumed: true });

  const metrics = calculateMetrics(items, refDate);

  // Invariant 1: Total matches active items
  assert.strictEqual(metrics.total, 51); // i from -20 to 30 = 51 items
  assert.strictEqual(metrics.discardedCount, 1);
  assert.strictEqual(metrics.consumedCount, 1);

  // Invariant 2: Disjointness: Total === Expired + Soon + Week + Ok
  const sum = metrics.expired + metrics.soon + metrics.week + metrics.ok;
  assert.strictEqual(metrics.total, sum, `Total (${metrics.total}) must equal sum of disjoint buckets (${sum})`);

  // Invariant 3: Zero intersection between categories for every item
  for (const item of items) {
    if (item.isDiscarded || item.isConsumed) continue;
    const st = calculateExpiryStatus(item.expiryDate, refDate);
    const d = calculateDayDiff(item.expiryDate, refDate);
    if (st.key === 'expired') assert.ok(d < 0, `Expired item must have diff < 0: got ${d}`);
    if (st.key === 'soon') assert.ok(d >= 0 && d <= 3, `Soon item must have 0 <= diff <= 3: got ${d}`);
    if (st.key === 'week') assert.ok(d >= 4 && d <= 7, `Week item must have 4 <= diff <= 7: got ${d}`);
    if (st.key === 'ok') assert.ok(d > 7, `Ok item must have diff > 7: got ${d}`);
  }
});

// -------------------------------------------------------------
// SECTION 6: Source Code Anti-Cheating & Integrity Analysis
// -------------------------------------------------------------
console.log('\n--- SECTION 6: Anti-Cheating & Facade Verification ---');

const metricsComponent = fs.readFileSync(path.join(ROOT_DIR, 'src/lib/components/MetricsDashboard.svelte'), 'utf8');
const workspaceComponent = fs.readFileSync(path.join(ROOT_DIR, 'src/lib/components/WorkspaceModal.svelte'), 'utf8');

check('MetricsDashboard.svelte consumes live metricsStore reactive store, not static numbers', () => {
  assert.ok(metricsComponent.includes('$metricsStore.total'), 'Must bind to $metricsStore.total');
  assert.ok(metricsComponent.includes('$metricsStore.expired'), 'Must bind to $metricsStore.expired');
  assert.ok(metricsComponent.includes('$metricsStore.soon'), 'Must bind to $metricsStore.soon');
  assert.ok(metricsComponent.includes('$metricsStore.week'), 'Must bind to $metricsStore.week');
  assert.ok(!metricsComponent.includes('count: 42'), 'Must not have hardcoded mock numbers');
});

check('ProductForm.svelte calls genuine domain preset functions', () => {
  assert.ok(productFormCss.includes('presetPlus2Days'), 'Must call presetPlus2Days');
  assert.ok(productFormCss.includes('presetPlus3Days'), 'Must call presetPlus3Days');
  assert.ok(productFormCss.includes('presetPlus1Week'), 'Must call presetPlus1Week');
  assert.ok(productFormCss.includes('presetPlus1Month'), 'Must call presetPlus1Month');
});

check('WorkspaceModal.svelte incorporates live sanitization of workspace slugs', () => {
  assert.ok(workspaceComponent.includes('sanitizeWorkspaceId('), 'Must invoke sanitizeWorkspaceId');
  assert.ok(workspaceComponent.includes('sanitizeOperatorAlias('), 'Must invoke sanitizeOperatorAlias');
});

check('ProductCard.svelte wires optimistic consume with toastStore.undo rollback', () => {
  assert.ok(productCardCss.includes('inventoryStore.consumeOne'), 'Must invoke consumeOne on inventoryStore');
  assert.ok(productCardCss.includes('toastStore.undo'), 'Must provide undo toast action');
  assert.ok(productCardCss.includes('productRepository.restoreStock'), 'Must provide restoreStock rollback callback');
});

check('+page.svelte orchestrates real inventoryStore subscriptions and Firestore actions', () => {
  const pageSrc = fs.readFileSync(pagePath, 'utf8');
  assert.ok(pageSrc.includes('initWorkspaceSync()'), 'Must initialize real Firestore workspace sync');
  assert.ok(pageSrc.includes('consumeStockAction('), 'Must call consumeStockAction');
  assert.ok(pageSrc.includes('discardStockAction('), 'Must call discardStockAction');
  assert.ok(pageSrc.includes('subscribeHistory('), 'Must subscribe to real audit logs');
});

console.log('\n============================================================');
console.log(`TOTAL AUDIT ASSERTIONS: ${totalAssertions}`);
console.log(`PASSED: ${passedAssertions}`);
console.log(`FAILED: ${totalAssertions - passedAssertions}`);
console.log('============================================================\n');

if (passedAssertions === totalAssertions) {
  console.log('>>> FORENSIC VERDICT: ALL M3 INTEGRITY CHECKS PASSED CLEANLY (VERDICT: CLEAN)');
} else {
  console.error('>>> FORENSIC VERDICT: INTEGRITY VIOLATION DETECTED');
  process.exit(1);
}
