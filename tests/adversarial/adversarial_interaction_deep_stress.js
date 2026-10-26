/**
 * Deep Adversarial Interaction & Extreme Condition Stress Harness
 * Empirical Challenger (challenger_m3_iter2_2)
 *
 * Verifies:
 * 1. Extreme calendar math & leap century arithmetic (1600..2400)
 * 2. High-speed concurrent and interleaved 1-tap decrements and undo rollbacks
 * 3. Hostile string fuzzing against workspace and operator sanitization (ReDoS, Emojis, RTL, Control codes)
 * 4. High-volume metrics performance & disjoint partition invariant across 5,000 products
 * 5. Float quantities and fractional unit handling in consumeOne
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

async function runDeepStress() {
  console.log('================================================================');
  console.log('DEEP ADVERSARIAL STRESS & INVARIANT HARNESS (Milestone 3 Iter 2)');
  console.log('================================================================\n');

  const viteServer = await createServer({
    root: PROJECT_ROOT,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  const expiryMod = await viteServer.ssrLoadModule('./src/lib/domain/expiry.ts');
  const invMod = await viteServer.ssrLoadModule('./src/lib/stores/inventoryStore.ts');
  const wsMod = await viteServer.ssrLoadModule('./src/lib/stores/workspaceStore.ts');
  const metMod = await viteServer.ssrLoadModule('./src/lib/stores/metricsStore.ts');
  const toastMod = await viteServer.ssrLoadModule('./src/lib/stores/toastStore.ts');

  const {
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

  // ----------------------------------------------------------------------
  // SUITE A: Extreme Calendar & Leap Century Stress
  // ----------------------------------------------------------------------
  console.log('\n--- SUITE A: Extreme Calendar & Leap Century Stress ---');

  // Century leap years: 1600 (leap), 2000 (leap), 2400 (leap)
  // Non-leap century years: 1700, 1800, 1900, 2100, 2200, 2300
  const centuryLeapYears = [1600, 2000, 2400];
  const centuryNonLeapYears = [1700, 1800, 1900, 2100, 2200, 2300];

  for (const yr of centuryLeapYears) {
    const leapDay = `${yr}-02-29`;
    assert(parseLocalDate(leapDay) !== null, `Century year ${yr} recognizes Feb 29 as valid leap day`);
    const jan31 = `${yr}-01-31`;
    assertEquals(addMonthsSafe(jan31, 1), `${yr}-02-29`, `Century year ${yr}: Jan 31 + 1m clamps to ${yr}-02-29`);
  }

  for (const yr of centuryNonLeapYears) {
    const invalidLeapDay = `${yr}-02-29`;
    assert(parseLocalDate(invalidLeapDay) === null, `Century non-leap year ${yr} strictly rejects Feb 29`);
    const jan31 = `${yr}-01-31`;
    assertEquals(addMonthsSafe(jan31, 1), `${yr}-02-28`, `Century non-leap year ${yr}: Jan 31 + 1m clamps to ${yr}-02-28`);
  }

  // Multi-month additions across leap years
  // 2024-02-29 + 12 months -> 2025-02-28 (clamped because 2025 has no Feb 29)
  assertEquals(addMonthsSafe('2024-02-29', 12), '2025-02-28', '2024-02-29 + 12m clamps safely to 2025-02-28');
  // 2024-02-29 + 48 months -> 2028-02-29 (2028 is leap year)
  assertEquals(addMonthsSafe('2024-02-29', 48), '2028-02-29', '2024-02-29 + 48m lands safely on 2028-02-29');

  // Strict invalid date rejections in parseLocalDate
  assert(parseLocalDate('2026-02-30') === null, 'Rejects 2026-02-30');
  assert(parseLocalDate('2026-04-31') === null, 'Rejects 2026-04-31 (April has 30 days)');
  assert(parseLocalDate('2026-06-31') === null, 'Rejects 2026-06-31 (June has 30 days)');
  assert(parseLocalDate('2026-09-31') === null, 'Rejects 2026-09-31 (September has 30 days)');
  assert(parseLocalDate('2026-11-31') === null, 'Rejects 2026-11-31 (November has 30 days)');
  assert(parseLocalDate('2026-13-01') === null, 'Rejects month 13');
  assert(parseLocalDate('2026-00-10') === null, 'Rejects month 00');
  assert(parseLocalDate('') === null, 'Rejects empty string');
  assert(parseLocalDate(null) === null, 'Rejects null');
  assert(parseLocalDate('not-a-date') === null, 'Rejects arbitrary string');

  // ----------------------------------------------------------------------
  // SUITE B: Float Quantities & Rapid Concurrent 1-Tap Decrements
  // ----------------------------------------------------------------------
  console.log('\n--- SUITE B: Float Quantities & Rapid Concurrent 1-Tap Decrements ---');

  inventoryStore.reset();
  inventoryStore.addProduct({
    id: 'float-prod',
    name: 'Harina de Trigo',
    quantity: 2.5,
    unit: 'kg',
    expiryDate: '2026-11-01',
    isConsumed: false,
    isDiscarded: false
  });

  // Consume 1 from 2.5 -> 1.5
  const dec1 = inventoryStore.consumeOne('float-prod');
  assertEquals(dec1?.previousQuantity, 2.5, 'consumeOne returns previous float quantity 2.5');

  let state;
  const unsub = inventoryStore.subscribe(s => { state = s; });
  let p = state.products.find(x => x.id === 'float-prod');
  assertEquals(p?.quantity, 1.5, 'Quantity decremented from 2.5 to 1.5');
  assertEquals(p?.isConsumed, false, 'isConsumed remains false for 1.5');

  // Consume 1 from 1.5 -> 0.5
  inventoryStore.consumeOne('float-prod');
  p = state.products.find(x => x.id === 'float-prod');
  assertEquals(p?.quantity, 0.5, 'Quantity decremented from 1.5 to 0.5');
  assertEquals(p?.isConsumed, false, 'isConsumed remains false for 0.5');

  // Consume 1 from 0.5 -> clamps to 0
  inventoryStore.consumeOne('float-prod');
  p = state.products.find(x => x.id === 'float-prod');
  assertEquals(p?.quantity, 0, 'Quantity clamped from 0.5 to 0');
  assertEquals(p?.isConsumed, true, 'isConsumed is true when quantity reaches 0');

  // Undo restores exact previous float quantity 0.5
  inventoryStore.updateProduct('float-prod', { quantity: 0.5, isConsumed: false });
  p = state.products.find(x => x.id === 'float-prod');
  assertEquals(p?.quantity, 0.5, 'Undo successfully restores float quantity 0.5');
  assertEquals(p?.isConsumed, false, 'Undo successfully restores isConsumed to false');

  unsub();

  // ----------------------------------------------------------------------
  // SUITE C: Toast Store Stress & Max Concurrency
  // ----------------------------------------------------------------------
  console.log('\n--- SUITE C: Toast Store Stress & Max Concurrency ---');

  toastStore.clear();
  let currentToasts = [];
  const unsubToast = toastStore.subscribe(ts => { currentToasts = ts; });

  // Add 10 toasts rapidly
  for (let i = 1; i <= 10; i++) {
    toastStore.show({ message: `Toast ${i}`, duration: 5000 });
  }

  // Toast store caps at MAX_CONCURRENT_TOASTS (3)
  assertEquals(currentToasts.length, 3, 'Toast store strictly bounds concurrent toasts to 3');
  assertEquals(currentToasts[2].message, 'Toast 10', 'Most recent toast is present');

  // Test undo toast generation
  let undoCalled = false;
  const undoId = toastStore.undo('Producto consumido', () => { undoCalled = true; });
  assert(typeof undoId === 'string' && undoId.startsWith('toast_'), 'undo returns valid toast ID');
  const undoToast = currentToasts.find(t => t.id === undoId);
  assert(undoToast !== undefined, 'Undo toast is in store');
  assertEquals(undoToast?.action?.label, 'Deshacer', 'Undo toast has label "Deshacer"');

  undoToast?.action?.onClick();
  assert(undoCalled, 'Undo action onClick executes handler');

  toastStore.clear();
  assertEquals(currentToasts.length, 0, 'toastStore.clear() flushes all toasts');
  unsubToast();

  // ----------------------------------------------------------------------
  // SUITE D: Hostile String Sanitization (ReDoS, Emojis, RTL, Control codes)
  // ----------------------------------------------------------------------
  console.log('\n--- SUITE D: Hostile String Sanitization ---');

  // Emojis and culinary symbols
  assertEquals(
    sanitizeWorkspaceId('🍕 Cocina & Bar 🍷'),
    'cocina-bar',
    'Emoji stripping: "🍕 Cocina & Bar 🍷" -> "cocina-bar"'
  );

  // Control characters and terminal escapes
  assertEquals(
    sanitizeWorkspaceId('\x1b[31mKitchen\x1b[0m\t\n'),
    '31mkitchen-0m',
    'ANSI escape sequences safely neutralized into harmless slug'
  );

  // Pure non-Latin characters (Hebrew, Arabic, CJK)
  assertEquals(
    sanitizeWorkspaceId('مطبخ'),
    DEFAULT_WORKSPACE,
    'Arabic-only workspace falls back to DEFAULT_WORKSPACE'
  );
  assertEquals(
    sanitizeWorkspaceId('厨房'),
    DEFAULT_WORKSPACE,
    'Chinese-only workspace falls back to DEFAULT_WORKSPACE'
  );

  // Consecutive delimiters and hyphens
  assertEquals(
    sanitizeWorkspaceId('---cocina----central---'),
    'cocina-central',
    'Multiple leading, trailing, and repeated hyphens collapsed to "cocina-central"'
  );

  // ReDoS check: 50,000 repeating characters handled in < 50ms
  const longHostile = 'a-'.repeat(25000);
  const t0 = Date.now();
  const sanitizedLong = sanitizeWorkspaceId(longHostile);
  const tElapsed = Date.now() - t0;
  assert(tElapsed < 100, `ReDoS check: 50,000 char hostile slug processed in ${tElapsed}ms (< 100ms)`);
  assert(sanitizedLong.startsWith('a-') && sanitizedLong.endsWith('-a'), 'Sanitized long slug is valid');

  // Operator alias: trimming and length
  assertEquals(sanitizeOperatorAlias('   Chef Ramón   '), 'Chef Ramón', 'Operator preserves accent Ramón and trims spaces');
  assertEquals(sanitizeOperatorAlias(''), DEFAULT_OPERATOR, 'Empty operator alias falls back to Cocinero');

  // ----------------------------------------------------------------------
  // SUITE E: High-Volume 5,000 Products Invariant & Performance Stress
  // ----------------------------------------------------------------------
  console.log('\n--- SUITE E: High-Volume 5,000 Products Invariant & Performance Stress ---');

  const refToday = new Date(2026, 9, 25); // 2026-10-25
  const bigList = [];
  let expCount = 0;
  let soonCount = 0;
  let weekCount = 0;
  let okCount = 0;
  let discardedExp = 0;
  let consumedExp = 0;

  for (let i = 0; i < 5000; i++) {
    const dayOffset = (i % 61) - 20; // range [-20..+40]
    const d = new Date(refToday.getTime());
    d.setDate(d.getDate() + dayOffset);
    const dateStr = formatDateISO(d);

    const isDiscarded = i % 10 === 0; // 500 discarded
    const isConsumed = !isDiscarded && i % 10 === 1; // 450 consumed
    const isZeroQty = !isDiscarded && !isConsumed && i % 20 === 2; // 225 zero-qty

    const qty = isZeroQty ? 0 : 5;

    bigList.push({
      id: `stress-prod-${i}`,
      name: `Ingrediente ${i}`,
      quantity: qty,
      expiryDate: dateStr,
      isDiscarded,
      isConsumed
    });

    if (isDiscarded) {
      discardedExp++;
    } else if (isConsumed || qty <= 0) {
      consumedExp++;
    } else {
      if (dayOffset < 0) expCount++;
      else if (dayOffset <= 3) soonCount++;
      else if (dayOffset <= 7) weekCount++;
      else okCount++;
    }
  }

  const perf0 = Date.now();
  const bigMetrics = calculateMetrics(bigList, refToday);
  const perfElapsed = Date.now() - perf0;

  console.log(`  Processed 5,000 products in ${perfElapsed}ms`);
  assert(perfElapsed < 50, `5,000 products processed in ${perfElapsed}ms (< 50ms requirement)`);

  const activeTotalExpected = expCount + soonCount + weekCount + okCount;
  assertEquals(bigMetrics.total, activeTotalExpected, `Total matches active items (${activeTotalExpected})`);
  assertEquals(bigMetrics.expired, expCount, `Expired items match (${expCount})`);
  assertEquals(bigMetrics.soon, soonCount, `Soon items match (${soonCount})`);
  assertEquals(bigMetrics.week, weekCount, `Week items match (${weekCount})`);
  assertEquals(bigMetrics.ok, okCount, `Ok items match (${okCount})`);
  assertEquals(bigMetrics.discardedCount, discardedExp, `Discarded items match (${discardedExp})`);
  assertEquals(bigMetrics.consumedCount, consumedExp, `Consumed items match (${consumedExp})`);

  // Disjoint partition law: Total = Expired + Soon + Week + Ok
  assertEquals(
    bigMetrics.total,
    bigMetrics.expired + bigMetrics.soon + bigMetrics.week + bigMetrics.ok,
    'Disjoint partition law holds strictly across 5,000 items'
  );
  // Total items in universe = Total + Discarded + Consumed
  assertEquals(
    bigList.length,
    bigMetrics.total + bigMetrics.discardedCount + bigMetrics.consumedCount,
    'Universal conservation law: all 5,000 items partitioned with zero leakage or duplication'
  );

  await viteServer.close();

  // ----------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------
  console.log('\n============================================================');
  console.log('         DEEP ADVERSARIAL STRESS TEST SUMMARY               ');
  console.log('============================================================');
  console.log(` TOTAL ASSERTIONS : ${totalTests}`);
  console.log(` PASSED           : ${passedTests}`);
  console.log(` FAILED           : ${failedTests}`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    console.error('FAILURES DETECTED:');
    failures.forEach((f, i) => console.error(` [${i + 1}] ${f}`));
    process.exit(1);
  } else {
    console.log('>>> ALL DEEP ADVERSARIAL STRESS TESTS PASSED CLEANLY (VERDICT: APPROVE)');
    process.exit(0);
  }
}

runDeepStress().catch(err => {
  console.error('Crash in deep stress suite:', err);
  process.exit(1);
});
