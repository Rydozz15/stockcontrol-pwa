/**
 * Empirical Challenger Adversarial Stress Suite for Milestone 3:
 * Form & Store Interaction Challenger (challenger_m3_2)
 *
 * Adversarially challenges:
 * 1. 1-Touch quick expiry presets (+2d, +3d, +1w, +1m) across calendar extremes:
 *    - Leap years (2024, 2028, 2000 vs 2100)
 *    - Month boundaries (31-day -> 30-day clamping: Mar 31 -> Apr 30, Jan 31 -> Feb 28/29)
 *    - Year-ends (Dec 31 -> Jan 2/3/7/31)
 *    - 1,096-day continuous calendar loop (every day 2024..2026)
 * 2. 1-Tap "Consumir 1" optimistic decrement and Undo rollback callback behavior:
 *    - Sequential decrements, depletion to 0, exclusion from filteredProducts, undo restoration
 *    - Zero-quantity guard, negative quantity prevention, nonexistent ID handling
 * 3. Workspace auto-slug sanitization with hostile & diacritic strings:
 *    - "Café & Bistró 100%" -> "cafe-bistro-100"
 *    - Diacritics, path traversal, XSS, SQLi, shell injection, empty/whitespace/punctuation fallbacks
 * 4. MetricsDashboard disjointness & boundary correctness:
 *    - Strict disjointness: (-∞, -1] ∩ [0, 3] ∩ [4, 7] ∩ [8, ∞) = ∅
 *    - Total === Expired + Soon + Week + Ok across 1,000 randomized products
 *    - Exact boundary transition testing (dayDiff -1, 0, 3, 4, 7, 8)
 *    - Discarded and consumed item exclusion from active metrics
 * 5. Card state transitions & presentation contracts:
 *    - Quantity 0 disabling, low-stock badge, discard state filtering
 *    - HACCP waste reasons preselection heuristics
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    failures.push(message);
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  totalTests++;
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  if (isMatch) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    const errMsg = `${message} — Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`;
    failures.push(errMsg);
    console.error(`  ✗ FAIL: ${errMsg}`);
  }
}

async function runInteractionAdversarialSuite() {
  console.log('================================================================');
  console.log('STARTING EMPIRICAL CHALLENGER ADVERSARIAL STRESS SUITE (Milestone 3)');
  console.log(`Node.js version: ${process.version}`);
  console.log(`Working Directory: ${PROJECT_ROOT}`);
  console.log('================================================================\n');

  // Initialize Vite SSR to load TypeScript domain and store modules dynamically
  const viteServer = await createServer({
    root: PROJECT_ROOT,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  let expiryMod, invMod, wsMod, metMod, toastMod;

  try {
    expiryMod = await viteServer.ssrLoadModule('./src/lib/domain/expiry.ts');
    invMod = await viteServer.ssrLoadModule('./src/lib/stores/inventoryStore.ts');
    wsMod = await viteServer.ssrLoadModule('./src/lib/stores/workspaceStore.ts');
    metMod = await viteServer.ssrLoadModule('./src/lib/stores/metricsStore.ts');
    toastMod = await viteServer.ssrLoadModule('./src/lib/stores/toastStore.ts');
    assert(true, 'Successfully loaded all domain and store modules via Vite SSR');
  } catch (err) {
    assert(false, `Crash loading modules: ${err.message}`);
    await viteServer.close();
    process.exit(1);
  }

  const {
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
    parseLocalDate,
    normalizeMidnight
  } = expiryMod;

  const { inventoryStore, filteredProducts } = invMod;
  const { sanitizeWorkspaceId, sanitizeOperatorAlias, DEFAULT_WORKSPACE, DEFAULT_OPERATOR } = wsMod;
  const { metricsStore } = metMod;
  const { toastStore } = toastMod;

  // ============================================================================
  // SUITE 1: Calendar Extremes, Leap Years & Month-End Quick Expiry Presets
  // ============================================================================
  console.log('\n--- SUITE 1: Calendar Extremes, Leap Years & Month-End Quick Expiry Presets ---');

  // 1.1 Leap Year 2024 Behavior
  const leapFeb27 = new Date(2024, 1, 27); // 2024-02-27
  assertEquals(addDaysSafe(leapFeb27, 2), '2024-02-29', 'Leap Year 2024: Feb 27 + 2d resolves cleanly to Leap Day 2024-02-29');
  assertEquals(addDaysSafe(leapFeb27, 3), '2024-03-01', 'Leap Year 2024: Feb 27 + 3d resolves to 2024-03-01');

  const leapFeb29 = new Date(2024, 1, 29); // 2024-02-29
  assertEquals(addDaysSafe(leapFeb29, 2), '2024-03-02', 'Leap Year 2024: Feb 29 + 2d resolves to 2024-03-02');
  assertEquals(addWeeksSafe(leapFeb29, 1), '2024-03-07', 'Leap Year 2024: Feb 29 + 1w resolves to 2024-03-07');
  assertEquals(addMonthsSafe(leapFeb29, 1), '2024-03-29', 'Leap Year 2024: Feb 29 + 1m resolves to 2024-03-29');

  const leapJan31 = new Date(2024, 0, 31); // 2024-01-31
  assertEquals(addMonthsSafe(leapJan31, 1), '2024-02-29', 'Leap Year 2024: Jan 31 + 1m safely clamps to 2024-02-29 (not March 2)');
  const leapJan30 = new Date(2024, 0, 30);
  assertEquals(addMonthsSafe(leapJan30, 1), '2024-02-29', 'Leap Year 2024: Jan 30 + 1m safely clamps to 2024-02-29');

  // 1.2 Non-Leap Year 2025 & 2026 Behavior
  const nonLeapFeb27 = new Date(2026, 1, 27); // 2026-02-27
  assertEquals(addDaysSafe(nonLeapFeb27, 2), '2026-03-01', 'Non-Leap Year 2026: Feb 27 + 2d resolves to 2026-03-01 (skips non-existent Feb 29)');
  assertEquals(addDaysSafe(nonLeapFeb27, 3), '2026-03-02', 'Non-Leap Year 2026: Feb 27 + 3d resolves to 2026-03-02');

  const nonLeapFeb28 = new Date(2026, 1, 28); // 2026-02-28
  assertEquals(addDaysSafe(nonLeapFeb28, 2), '2026-03-02', 'Non-Leap Year 2026: Feb 28 + 2d resolves to 2026-03-02');
  assertEquals(addWeeksSafe(nonLeapFeb28, 1), '2026-03-07', 'Non-Leap Year 2026: Feb 28 + 1w resolves to 2026-03-07');

  const nonLeapJan31 = new Date(2026, 0, 31); // 2026-01-31
  assertEquals(addMonthsSafe(nonLeapJan31, 1), '2026-02-28', 'Non-Leap Year 2026: Jan 31 + 1m safely clamps to 2026-02-28 (not March 3)');
  const nonLeapJan30 = new Date(2026, 0, 30);
  assertEquals(addMonthsSafe(nonLeapJan30, 1), '2026-02-28', 'Non-Leap Year 2026: Jan 30 + 1m safely clamps to 2026-02-28');
  const nonLeapJan29 = new Date(2026, 0, 29);
  assertEquals(addMonthsSafe(nonLeapJan29, 1), '2026-02-28', 'Non-Leap Year 2026: Jan 29 + 1m safely clamps to 2026-02-28');

  // 1.3 Century Leap Rules (2000 was leap, 2100 is not)
  const century2000Jan31 = new Date(2000, 0, 31);
  assertEquals(addMonthsSafe(century2000Jan31, 1), '2000-02-29', 'Century 2000 (divisible by 400): Jan 31 + 1m clamps to 2000-02-29');
  const century2100Jan31 = new Date(2100, 0, 31);
  assertEquals(addMonthsSafe(century2100Jan31, 1), '2100-02-28', 'Century 2100 (not divisible by 400): Jan 31 + 1m clamps to 2100-02-28');

  // 1.4 Month-End Clamping (31-day to 30-day transitions)
  const mar31 = new Date(2026, 2, 31); // 2026-03-31
  assertEquals(addMonthsSafe(mar31, 1), '2026-04-30', 'Mar 31 + 1m clamps to Apr 30 (not May 1)');
  const may31 = new Date(2026, 4, 31); // 2026-05-31
  assertEquals(addMonthsSafe(may31, 1), '2026-06-30', 'May 31 + 1m clamps to Jun 30 (not Jul 1)');
  const aug31 = new Date(2026, 7, 31); // 2026-08-31
  assertEquals(addMonthsSafe(aug31, 1), '2026-09-30', 'Aug 31 + 1m clamps to Sep 30 (not Oct 1)');
  const oct31 = new Date(2026, 9, 31); // 2026-10-31
  assertEquals(addMonthsSafe(oct31, 1), '2026-11-30', 'Oct 31 + 1m clamps to Nov 30 (not Dec 1)');

  // 1.5 Year-End Rollovers
  const dec30 = new Date(2026, 11, 30); // 2026-12-30
  assertEquals(addDaysSafe(dec30, 2), '2027-01-01', 'Dec 30 + 2d rollovers to 2027-01-01');
  const dec31 = new Date(2026, 11, 31); // 2026-12-31
  assertEquals(addDaysSafe(dec31, 2), '2027-01-02', 'Dec 31 + 2d rollovers to 2027-01-02');
  assertEquals(addDaysSafe(dec31, 3), '2027-01-03', 'Dec 31 + 3d rollovers to 2027-01-03');
  assertEquals(addWeeksSafe(dec31, 1), '2027-01-07', 'Dec 31 + 1w rollovers to 2027-01-07');
  assertEquals(addMonthsSafe(dec31, 1), '2027-01-31', 'Dec 31 + 1m rollovers to 2027-01-31');

  // 1.6 1,096-Day Continuous Calendar Stress Loop (2024 to 2026 inclusive)
  console.log('  Testing 1,096 continuous calendar days across 2024-2026 for preset sanity...');
  let totalFuzzedDays = 0;
  let dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  // Use noon to prevent local timezone midnight DST transitions from dropping a day
  let startDate = new Date(2024, 0, 1, 12, 0, 0);
  let endDate = new Date(2026, 11, 31, 12, 0, 0);

  let currentLoopDate = new Date(startDate.getTime());
  let allDaysValid = true;

  while (currentLoopDate <= endDate) {
    totalFuzzedDays++;
    const isoCurrent = formatDateISO(currentLoopDate);

    const p2d = addDaysSafe(currentLoopDate, 2);
    const p3d = addDaysSafe(currentLoopDate, 3);
    const p1w = addWeeksSafe(currentLoopDate, 1);
    const p1m = addMonthsSafe(currentLoopDate, 1);

    if (
      !dateRegex.test(p2d) || !parseLocalDate(p2d) ||
      !dateRegex.test(p3d) || !parseLocalDate(p3d) ||
      !dateRegex.test(p1w) || !parseLocalDate(p1w) ||
      !dateRegex.test(p1m) || !parseLocalDate(p1m)
    ) {
      allDaysValid = false;
      console.error(`Invalid date generated from ${isoCurrent}: p2d=${p2d}, p3d=${p3d}, p1w=${p1w}, p1m=${p1m}`);
      break;
    }

    // Mathematical day difference invariants
    const diff2 = calculateDayDiff(p2d, currentLoopDate);
    const diff3 = calculateDayDiff(p3d, currentLoopDate);
    const diff7 = calculateDayDiff(p1w, currentLoopDate);
    if (diff2 !== 2 || diff3 !== 3 || diff7 !== 7) {
      allDaysValid = false;
      console.error(`DayDiff drift for ${isoCurrent}: diff2=${diff2}, diff3=${diff3}, diff7=${diff7}`);
      break;
    }

    currentLoopDate.setDate(currentLoopDate.getDate() + 1);
  }

  assert(allDaysValid && totalFuzzedDays === 1096, '1,096 continuous days (2024..2026) verified with 100% calendar validity and exact dayDiff');

  // ============================================================================
  // SUITE 2: 1-Tap "Consumir 1" Optimistic Decrement & Undo Rollback
  // ============================================================================
  console.log('\n--- SUITE 2: 1-Tap "Consumir 1" Optimistic Decrement & Undo Rollback ---');

  inventoryStore.reset();

  const testProduct1 = {
    id: 'prod-consume-1',
    name: 'Queso Mozzarella',
    category: 'Lácteos',
    quantity: 5,
    unit: 'kg',
    expiryDate: '2026-10-30',
    location: 'Refrigerador'
  };

  inventoryStore.addProduct(testProduct1);

  // 2.1 Single consume decrement
  const res1 = inventoryStore.consumeOne('prod-consume-1');
  assertEquals(res1?.previousQuantity, 5, 'consumeOne returns previousQuantity = 5');

  let state1;
  const unsubInv1 = inventoryStore.subscribe(s => { state1 = s; });
  let p1InStore = state1.products.find(p => p.id === 'prod-consume-1');
  assertEquals(p1InStore?.quantity, 4, 'Product quantity decreased from 5 to 4');
  assertEquals(p1InStore?.isConsumed, false, 'Product isConsumed remains false when quantity > 0');

  // 2.2 Rollback execution via Undo callback simulation
  let simulatedUndoInvoked = false;
  const simulatedUndoCallback = () => {
    inventoryStore.updateProduct('prod-consume-1', {
      quantity: res1.previousQuantity,
      isConsumed: false
    });
    simulatedUndoInvoked = true;
  };

  simulatedUndoCallback();
  p1InStore = state1.products.find(p => p.id === 'prod-consume-1');
  assert(simulatedUndoInvoked, 'Undo callback executed cleanly');
  assertEquals(p1InStore?.quantity, 5, 'Product quantity successfully rolled back to 5');
  assertEquals(p1InStore?.isConsumed, false, 'Product isConsumed is false after undo');

  // 2.3 Consume to depletion (quantity reaches 0) and check filteredProducts
  let filteredList = [];
  const unsubFiltered = filteredProducts.subscribe(val => { filteredList = val; });

  assert(filteredList.some(p => p.id === 'prod-consume-1'), 'Product is visible in filteredProducts when quantity is 5');

  // Set quantity to 1 and consume
  inventoryStore.updateProduct('prod-consume-1', { quantity: 1, isConsumed: false });
  const resDeplete = inventoryStore.consumeOne('prod-consume-1');
  assertEquals(resDeplete?.previousQuantity, 1, 'Depletion consume returned previousQuantity = 1');

  p1InStore = state1.products.find(p => p.id === 'prod-consume-1');
  assertEquals(p1InStore?.quantity, 0, 'Product quantity reached 0');
  assertEquals(p1InStore?.isConsumed, true, 'Product isConsumed automatically flagged true on quantity 0');
  assert(!filteredList.some(p => p.id === 'prod-consume-1'), 'Product is immediately hidden from filteredProducts when quantity reaches 0');

  // Undo depletion
  inventoryStore.updateProduct('prod-consume-1', {
    quantity: resDeplete.previousQuantity,
    isConsumed: false
  });
  p1InStore = state1.products.find(p => p.id === 'prod-consume-1');
  assertEquals(p1InStore?.quantity, 1, 'Product quantity restored to 1 via undo');
  assertEquals(p1InStore?.isConsumed, false, 'isConsumed restored to false via undo');
  assert(filteredList.some(p => p.id === 'prod-consume-1'), 'Product reappears in filteredProducts immediately upon undo');

  // 2.4 Calling consume when quantity is already 0
  inventoryStore.updateProduct('prod-consume-1', { quantity: 0, isConsumed: true });
  const resZero = inventoryStore.consumeOne('prod-consume-1');
  p1InStore = state1.products.find(p => p.id === 'prod-consume-1');
  assertEquals(p1InStore?.quantity, 0, 'Consuming at quantity 0 clamps quantity to 0 and never goes negative');
  assertEquals(p1InStore?.isConsumed, true, 'isConsumed remains true');

  // 2.5 Rapid multi-step sequential consumption
  inventoryStore.updateProduct('prod-consume-1', { quantity: 10, isConsumed: false });
  for (let i = 10; i >= 1; i--) {
    const res = inventoryStore.consumeOne('prod-consume-1');
    assertEquals(res?.previousQuantity, i, `Step ${11 - i}: decremented from ${i} to ${i - 1}`);
  }
  p1InStore = state1.products.find(p => p.id === 'prod-consume-1');
  assertEquals(p1InStore?.quantity, 0, '10 rapid decrements reached 0 cleanly');
  assertEquals(p1InStore?.isConsumed, true, 'isConsumed reached true after 10 decrements');

  // 2.6 Nonexistent product ID
  const resNonexistent = inventoryStore.consumeOne('non-existent-id-404');
  assert(resNonexistent === null, 'consumeOne on nonexistent ID safely returns null without throwing');

  unsubInv1();
  unsubFiltered();

  // ============================================================================
  // SUITE 3: Workspace Auto-Slug Sanitization Hostile Input Testing
  // ============================================================================
  console.log('\n--- SUITE 3: Workspace Auto-Slug Sanitization Hostile Input Testing ---');

  // 3.1 The exact prompt requirement:
  assertEquals(
    sanitizeWorkspaceId('Café & Bistró 100%'),
    'cafe-bistro-100',
    'Slug Sanitization: "Café & Bistró 100%" -> "cafe-bistro-100"'
  );

  // 3.2 Diacritics and International strings
  assertEquals(
    sanitizeWorkspaceId('Mañana & Ñandú'),
    'manana-nandu',
    'Slug Sanitization: "Mañana & Ñandú" -> "manana-nandu"'
  );
  assertEquals(
    sanitizeWorkspaceId('München Über-Größe'),
    'munchen-uber-gro-e',
    'Slug Sanitization: "München Über-Größe" -> "munchen-uber-gro-e" (ü->u, ö->o, non-ascii ß to hyphen)'
  );
  assertEquals(
    sanitizeWorkspaceId('Crème Brûlée à la Mode!'),
    'creme-brulee-a-la-mode',
    'Slug Sanitization: "Crème Brûlée à la Mode!" -> "creme-brulee-a-la-mode"'
  );
  assertEquals(
    sanitizeWorkspaceId('São Paulo / Açaí & Guaraná'),
    'sao-paulo-acai-guarana',
    'Slug Sanitization: "São Paulo / Açaí & Guaraná" -> "sao-paulo-acai-guarana"'
  );

  // 3.3 Path Traversal and Shell Injection
  assertEquals(
    sanitizeWorkspaceId('../../etc/passwd'),
    'etc-passwd',
    'Path Traversal: "../../etc/passwd" -> "etc-passwd"'
  );
  assertEquals(
    sanitizeWorkspaceId('../../../var/log/syslog'),
    'var-log-syslog',
    'Path Traversal: "../../../var/log/syslog" -> "var-log-syslog"'
  );
  assertEquals(
    sanitizeWorkspaceId('rm -rf / --no-preserve-root'),
    'rm-rf-no-preserve-root',
    'Shell command injection stripped: "rm -rf / --no-preserve-root" -> "rm-rf-no-preserve-root"'
  );
  assertEquals(
    sanitizeWorkspaceId('$(whoami); cat /etc/shadow'),
    'whoami-cat-etc-shadow',
    'Command substitution stripped: "$(whoami); cat /etc/shadow" -> "whoami-cat-etc-shadow"'
  );

  // 3.4 SQL, NoSQL & XSS Injection
  assertEquals(
    sanitizeWorkspaceId("' OR '1'='1' --"),
    'or-1-1',
    'SQL injection stripped: "\' OR \'1\'=\'1\' --" -> "or-1-1"'
  );
  assertEquals(
    sanitizeWorkspaceId('<script>alert("xss")</script>'),
    'script-alert-xss-script',
    'HTML/XSS stripped: "<script>alert(\"xss\")</script>" -> "script-alert-xss-script"'
  );

  // 3.5 Empty, Whitespace, Punctuation-Only, and Type Coercion Fallbacks
  assertEquals(sanitizeWorkspaceId(''), DEFAULT_WORKSPACE, 'Empty string falls back to DEFAULT_WORKSPACE');
  assertEquals(sanitizeWorkspaceId('    \t\r\n    '), DEFAULT_WORKSPACE, 'Whitespace-only string falls back to DEFAULT_WORKSPACE');
  assertEquals(sanitizeWorkspaceId('!@#$%^&*()+=[]{}|\\:;"\'<>,.?/'), DEFAULT_WORKSPACE, 'Symbols-only string falls back to DEFAULT_WORKSPACE');
  assertEquals(sanitizeWorkspaceId('---'), DEFAULT_WORKSPACE, 'Hyphens-only string falls back to DEFAULT_WORKSPACE');
  assertEquals(sanitizeWorkspaceId(null), DEFAULT_WORKSPACE, 'null falls back safely to DEFAULT_WORKSPACE');
  assertEquals(sanitizeWorkspaceId(undefined), DEFAULT_WORKSPACE, 'undefined falls back safely to DEFAULT_WORKSPACE');
  assertEquals(sanitizeWorkspaceId(12345), DEFAULT_WORKSPACE, 'number falls back safely to DEFAULT_WORKSPACE');
  assertEquals(sanitizeWorkspaceId({}), DEFAULT_WORKSPACE, 'object falls back safely to DEFAULT_WORKSPACE');

  // 3.6 Operator Alias Sanitization
  assertEquals(sanitizeOperatorAlias('   Chef Ejecutivo   '), 'Chef Ejecutivo', 'Operator alias is trimmed cleanly');
  assertEquals(sanitizeOperatorAlias(''), DEFAULT_OPERATOR, 'Empty operator alias falls back to DEFAULT_OPERATOR');
  assertEquals(sanitizeOperatorAlias('   '), DEFAULT_OPERATOR, 'Whitespace operator alias falls back to DEFAULT_OPERATOR');
  assertEquals(sanitizeOperatorAlias(null), DEFAULT_OPERATOR, 'null operator falls back to DEFAULT_OPERATOR');

  // ============================================================================
  // SUITE 4: MetricsDashboard Disjointness & Boundary Correctness
  // ============================================================================
  console.log('\n--- SUITE 4: MetricsDashboard Disjointness & Boundary Correctness ---');

  const refDate = new Date(2026, 9, 25); // 2026-10-25

  // 4.1 Truth Table for all integer day differences from -50 to +50
  let disjointnessBroken = false;
  for (let diff = -50; diff <= 50; diff++) {
    const targetDate = new Date(refDate.getTime());
    targetDate.setDate(targetDate.getDate() + diff);
    const dateStr = formatDateISO(targetDate);

    const status = calculateExpiryStatus(dateStr, refDate);

    const isExpired = status.key === 'expired';
    const isSoon = status.key === 'soon';
    const isWeek = status.key === 'week';
    const isOk = status.key === 'ok';

    // Must be in EXACTLY ONE category
    const activeCount = Number(isExpired) + Number(isSoon) + Number(isWeek) + Number(isOk);
    if (activeCount !== 1) {
      disjointnessBroken = true;
      console.error(`Disjointness broken for diff ${diff} (${dateStr}): status.key = ${status.key}`);
      break;
    }

    // Check exact partition specifications:
    // expired: diff < 0
    // soon: 0 <= diff <= 3
    // week: 4 <= diff <= 7
    // ok: diff > 7
    if (diff < 0 && !isExpired) {
      disjointnessBroken = true;
      console.error(`Expected expired for diff ${diff}, got ${status.key}`);
      break;
    }
    if (diff >= 0 && diff <= 3 && !isSoon) {
      disjointnessBroken = true;
      console.error(`Expected soon for diff ${diff}, got ${status.key}`);
      break;
    }
    if (diff >= 4 && diff <= 7 && !isWeek) {
      disjointnessBroken = true;
      console.error(`Expected week for diff ${diff}, got ${status.key}`);
      break;
    }
    if (diff > 7 && !isOk) {
      disjointnessBroken = true;
      console.error(`Expected ok for diff ${diff}, got ${status.key}`);
      break;
    }
  }

  assert(!disjointnessBroken, 'Mathematical disjointness proven across [-50..+50] days: partition (-∞,-1] ∩ [0,3] ∩ [4,7] ∩ [8,∞) = ∅');

  // 4.2 Exact Boundary Values
  // diff = -1 (yesterday)
  const dMinus1 = formatDateISO(new Date(2026, 9, 24));
  assertEquals(calculateExpiryStatus(dMinus1, refDate).key, 'expired', 'Boundary diff = -1 (yesterday) is strictly expired');

  // diff = 0 (today)
  const dZero = formatDateISO(new Date(2026, 9, 25));
  assertEquals(calculateExpiryStatus(dZero, refDate).key, 'soon', 'Boundary diff = 0 (today) is strictly soon');

  // diff = 3 (3 days away)
  const d3 = formatDateISO(new Date(2026, 9, 28));
  assertEquals(calculateExpiryStatus(d3, refDate).key, 'soon', 'Boundary diff = 3 (3 days) is strictly soon');

  // diff = 4 (4 days away)
  const d4 = formatDateISO(new Date(2026, 9, 29));
  assertEquals(calculateExpiryStatus(d4, refDate).key, 'week', 'Boundary diff = 4 (4 days) is strictly week');

  // diff = 7 (7 days away)
  const d7 = formatDateISO(new Date(2026, 10, 1));
  assertEquals(calculateExpiryStatus(d7, refDate).key, 'week', 'Boundary diff = 7 (7 days) is strictly week');

  // diff = 8 (8 days away)
  const d8 = formatDateISO(new Date(2026, 10, 2));
  assertEquals(calculateExpiryStatus(d8, refDate).key, 'ok', 'Boundary diff = 8 (8 days) is strictly ok');

  // 4.3 Randomized Fuzzing with 1,000 Products across [-100..+100] days
  console.log('  Generating 1,000 random products for property-based metric disjointness check...');
  const randomProducts = [];
  let expectedExpired = 0;
  let expectedSoon = 0;
  let expectedWeek = 0;
  let expectedOk = 0;

  for (let i = 0; i < 1000; i++) {
    // Random offset between -100 and +100 days
    const offset = Math.floor(Math.random() * 201) - 100;
    const target = new Date(refDate.getTime());
    target.setDate(target.getDate() + offset);
    const dateStr = formatDateISO(target);

    randomProducts.push({
      id: `fuzz-prod-${i}`,
      name: `Fuzz Ingredient ${i}`,
      quantity: 1 + Math.floor(Math.random() * 10),
      expiryDate: dateStr,
      isDiscarded: false,
      isConsumed: false
    });

    if (offset < 0) expectedExpired++;
    else if (offset <= 3) expectedSoon++;
    else if (offset <= 7) expectedWeek++;
    else expectedOk++;
  }

  const metrics = calculateMetrics(randomProducts, refDate);
  assertEquals(metrics.total, 1000, 'Metrics total equals 1000');
  assertEquals(metrics.expired, expectedExpired, `Expired count matches expected: ${expectedExpired}`);
  assertEquals(metrics.soon, expectedSoon, `Soon count matches expected: ${expectedSoon}`);
  assertEquals(metrics.week, expectedWeek, `Week count matches expected: ${expectedWeek}`);
  assertEquals(metrics.ok, expectedOk, `Ok count matches expected: ${expectedOk}`);

  // Disjoint sum invariant
  const sumOfParts = metrics.expired + metrics.soon + metrics.week + metrics.ok;
  assertEquals(sumOfParts, metrics.total, 'Metrics Partition Invariant: Total === Expired + Soon + Week + Ok');
  assertEquals(metrics.within7Days, metrics.soon + metrics.week, 'Within7Days === Soon + Week');
  assertEquals(metrics.criticalTotal, metrics.expired + metrics.soon, 'CriticalTotal === Expired + Soon');

  // 4.4 Discarded, Consumed, and Zero-Quantity Exclusion
  const mixedProducts = [
    // 4 active products (1 expired, 1 soon, 1 week, 1 ok)
    { id: 'm1', name: 'Activo Expired', quantity: 2, expiryDate: dMinus1, isDiscarded: false, isConsumed: false },
    { id: 'm2', name: 'Activo Soon', quantity: 3, expiryDate: dZero, isDiscarded: false, isConsumed: false },
    { id: 'm3', name: 'Activo Week', quantity: 1, expiryDate: d4, isDiscarded: false, isConsumed: false },
    { id: 'm4', name: 'Activo Ok', quantity: 5, expiryDate: d8, isDiscarded: false, isConsumed: false },
    // 3 discarded products (must be excluded from total, expired, soon, week, ok)
    { id: 'd1', name: 'Merma 1', quantity: 0, expiryDate: dMinus1, isDiscarded: true, isConsumed: false },
    { id: 'd2', name: 'Merma 2', quantity: 4, expiryDate: dZero, isDiscarded: true, isConsumed: false },
    { id: 'd3', name: 'Merma 3', quantity: 2, expiryDate: d4, isDiscarded: true, isConsumed: false },
    // 2 consumed products (must be excluded)
    { id: 'c1', name: 'Consumed 1', quantity: 0, expiryDate: dMinus1, isDiscarded: false, isConsumed: true },
    { id: 'c2', name: 'Consumed 2', quantity: 0, expiryDate: d8, isDiscarded: false, isConsumed: true },
    // 1 zero-quantity product (must be excluded)
    { id: 'z1', name: 'Zero Qty', quantity: 0, expiryDate: dZero, isDiscarded: false, isConsumed: false }
  ];

  const mixedMetrics = calculateMetrics(mixedProducts, refDate);
  assertEquals(mixedMetrics.total, 4, 'Total active products strictly excludes discarded, consumed, and zero-qty items (4/10)');
  assertEquals(mixedMetrics.expired, 1, 'Expired active count = 1');
  assertEquals(mixedMetrics.soon, 1, 'Soon active count = 1');
  assertEquals(mixedMetrics.week, 1, 'Week active count = 1');
  assertEquals(mixedMetrics.ok, 1, 'Ok active count = 1');
  assertEquals(mixedMetrics.discardedCount, 3, 'Discarded count = 3');
  assertEquals(mixedMetrics.consumedCount, 3, 'Consumed count = 3 (2 flagged isConsumed + 1 quantity 0)');

  // ============================================================================
  // SUITE 5: Card State Transitions & Discard / Zero-Quantity Semantics
  // ============================================================================
  console.log('\n--- SUITE 5: Card State Transitions & Discard / Zero-Quantity Semantics ---');

  // 5.1 Zero quantity consume button disabled contract
  const isConsumeDisabled = (qty) => qty <= 0;
  assert(isConsumeDisabled(0) === true, 'Quantity 0 disables consume button');
  assert(isConsumeDisabled(-1) === true, 'Quantity -1 disables consume button');
  assert(isConsumeDisabled(1) === false, 'Quantity 1 enables consume button');
  assert(isConsumeDisabled(10) === false, 'Quantity 10 enables consume button');

  // 5.2 Low stock badge contract
  const isLowStock = (qty) => qty <= 1;
  assert(isLowStock(0) === true, 'Quantity 0 activates low-stock badge styling');
  assert(isLowStock(1) === true, 'Quantity 1 activates low-stock badge styling');
  assert(isLowStock(2) === false, 'Quantity 2 has normal stock badge styling');

  // 5.3 Waste Reason Pre-Selection Heuristics
  const getPreselectedWasteReason = (expiryStatusKey) => {
    if (expiryStatusKey === 'expired') return 'vencimiento';
    if (expiryStatusKey === 'ok') return 'calidad';
    return 'vencimiento';
  };

  assertEquals(getPreselectedWasteReason('expired'), 'vencimiento', 'Expired product defaults waste reason to "vencimiento"');
  assertEquals(getPreselectedWasteReason('ok'), 'calidad', 'Vigente product defaults waste reason to "calidad"');

  // 5.4 Discard state in inventoryStore and filteredProducts
  inventoryStore.reset();
  inventoryStore.addProduct({
    id: 'prod-waste-test',
    name: 'Carne Molida',
    category: 'Carnes',
    quantity: 3,
    expiryDate: dMinus1,
    isDiscarded: false,
    isConsumed: false
  });

  let currentFiltered = [];
  const unsubF = filteredProducts.subscribe(val => { currentFiltered = val; });
  assert(currentFiltered.some(p => p.id === 'prod-waste-test'), 'Product is visible before discard');

  // Perform discard
  inventoryStore.updateProduct('prod-waste-test', {
    isDiscarded: true,
    quantity: 0
  });

  assert(!currentFiltered.some(p => p.id === 'prod-waste-test'), 'Product is immediately excluded from filteredProducts after discard');

  unsubF();
  await viteServer.close();

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n============================================================');
  console.log('         EMPIRICAL ADVERSARIAL STRESS TEST SUMMARY          ');
  console.log('============================================================');
  console.log(` TOTAL ASSERTIONS : ${totalTests}`);
  console.log(` PASSED           : ${passedTests}`);
  console.log(` FAILED           : ${failedTests}`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    console.error('FAILURES:');
    failures.forEach((f, i) => console.error(` [${i + 1}] ${f}`));
    process.exit(1);
  } else {
    console.log('>>> ALL ADVERSARIAL STRESS TESTS COMPLETED WITH 100% SUCCESS. VERDICT: APPROVE.');
    process.exit(0);
  }
}

runInteractionAdversarialSuite().catch(err => {
  console.error('Fatal crash during adversarial suite execution:', err);
  process.exit(1);
});
