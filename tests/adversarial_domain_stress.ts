/**
 * StockControl PWA — Adversarial Domain Stress Test Harness
 * Author: challenger_m1_1 (Empirical Challenger)
 * Execution: node --experimental-strip-types tests/adversarial_domain_stress.ts
 */

import assert from 'node:assert';
import {
  parseLocalDate,
  formatDateISO,
  normalizeMidnight,
  calculateDayDiff,
  calculateExpiryStatus,
  calculateMetrics,
  addDaysSafe,
  addWeeksSafe,
  addMonthsSafe,
  presetPlus2Days,
  presetPlus3Days,
  presetPlus1Week,
  presetPlus1Month
} from '../src/lib/domain/expiry.ts';

import {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  STORAGE_LOCATIONS,
  WASTE_REASONS,
  isValidCategory,
  isValidUnit,
  isValidLocation,
  isValidWasteReason,
  normalizeCategory,
  normalizeUnit,
  normalizeLocation,
  normalizeQuantity,
  type Product
} from '../src/lib/domain/models.ts';

import {
  roundQuantity,
  generateAuditId,
  consumeProductStock,
  discardProductStock,
  restoreProductStock,
  formatHaccpAuditEntry,
  summarizeWasteLogs
} from '../src/lib/domain/waste.ts';

console.log('================================================================');
console.log('⚔️  STARTING EMPIRICAL ADVERSARIAL STRESS TEST SUITE (M1 DOMAIN) ⚔️');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    throw err;
  }
}

// ============================================================================
// SUITE 1: LEAP YEARS & CENTURY BOUNDARIES
// ============================================================================
console.log('--- SUITE 1: Leap Years & Centennial Boundaries ---');

runTest('Valid leap year Feb 29 dates must parse correctly (2024, 2028, 2000, 2400)', () => {
  const d2024 = parseLocalDate('2024-02-29');
  assert.ok(d2024 !== null);
  assert.strictEqual(d2024.getFullYear(), 2024);
  assert.strictEqual(d2024.getMonth(), 1); // 0-indexed Feb
  assert.strictEqual(d2024.getDate(), 29);

  const d2028 = parseLocalDate('2028-02-29');
  assert.ok(d2028 !== null);
  assert.strictEqual(d2028.getDate(), 29);

  // 400-year centennial leap year
  const d2000 = parseLocalDate('2000-02-29');
  assert.ok(d2000 !== null);
  assert.strictEqual(d2000.getDate(), 29);

  const d2400 = parseLocalDate('2400-02-29');
  assert.ok(d2400 !== null);
  assert.strictEqual(d2400.getDate(), 29);
});

runTest('Non-leap year Feb 29 dates must be rejected (2025, 2026, 2027, 2100, 1900)', () => {
  assert.strictEqual(parseLocalDate('2025-02-29'), null);
  assert.strictEqual(parseLocalDate('2026-02-29'), null);
  assert.strictEqual(parseLocalDate('2027-02-29'), null);

  // 2100 is divisible by 4 and 100, but NOT 400 => non-leap year
  assert.strictEqual(parseLocalDate('2100-02-29'), null);
  assert.strictEqual(parseLocalDate('1900-02-29'), null);
  assert.strictEqual(parseLocalDate('1800-02-29'), null);
});

runTest('addDaysSafe across Feb 28 / Feb 29 in leap vs non-leap years', () => {
  // 2024 is leap: Feb 28 + 1 day -> Feb 29
  assert.strictEqual(addDaysSafe('2024-02-28', 1), '2024-02-29');
  assert.strictEqual(addDaysSafe('2024-02-29', 1), '2024-03-01');

  // 2026 is non-leap: Feb 28 + 1 day -> Mar 01
  assert.strictEqual(addDaysSafe('2026-02-28', 1), '2026-03-01');
  assert.strictEqual(addDaysSafe('2026-02-27', 2), '2026-03-01');
});

runTest('addMonthsSafe from leap day (Feb 29)', () => {
  // Feb 29, 2024 + 1 month -> Mar 29, 2024
  assert.strictEqual(addMonthsSafe('2024-02-29', 1), '2024-03-29');

  // Feb 29, 2024 + 12 months -> Feb 28, 2025 (clamped because 2025 has no Feb 29)
  assert.strictEqual(addMonthsSafe('2024-02-29', 12), '2025-02-28');

  // Feb 29, 2024 + 48 months -> Feb 29, 2028 (preserved because 2028 is leap year)
  assert.strictEqual(addMonthsSafe('2024-02-29', 48), '2028-02-29');
});

// ============================================================================
// SUITE 2: MONTH OVERFLOW CLAMPING ON 31-DAY MONTHS
// ============================================================================
console.log('\n--- SUITE 2: Month Overflow Clamping on 31-Day Months ---');

runTest('+1m from Jan 31 clamps to Feb 28 in non-leap year (2026, 2100)', () => {
  assert.strictEqual(addMonthsSafe('2026-01-31', 1), '2026-02-28');
  assert.strictEqual(addMonthsSafe('2100-01-31', 1), '2100-02-28');
});

runTest('+1m from Jan 31 clamps to Feb 29 in leap year (2024, 2000)', () => {
  assert.strictEqual(addMonthsSafe('2024-01-31', 1), '2024-02-29');
  assert.strictEqual(addMonthsSafe('2000-01-31', 1), '2000-02-29');
});

runTest('+1m from 31-day months followed by 30-day months (Mar, May, Aug, Oct)', () => {
  // March 31 + 1m -> April 30
  assert.strictEqual(addMonthsSafe('2026-03-31', 1), '2026-04-30');

  // May 31 + 1m -> June 30
  assert.strictEqual(addMonthsSafe('2026-05-31', 1), '2026-06-30');

  // August 31 + 1m -> September 30
  assert.strictEqual(addMonthsSafe('2026-08-31', 1), '2026-09-30');

  // October 31 + 1m -> November 30
  assert.strictEqual(addMonthsSafe('2026-10-31', 1), '2026-11-30');

  // December 31 + 1m -> January 31 (next year)
  assert.strictEqual(addMonthsSafe('2026-12-31', 1), '2027-01-31');
});

runTest('+1m from Jan 30 & Jan 29 in non-leap year clamps to Feb 28', () => {
  assert.strictEqual(addMonthsSafe('2026-01-30', 1), '2026-02-28');
  assert.strictEqual(addMonthsSafe('2026-01-29', 1), '2026-02-28');

  // in leap year 2024:
  assert.strictEqual(addMonthsSafe('2024-01-30', 1), '2024-02-29');
  assert.strictEqual(addMonthsSafe('2024-01-29', 1), '2024-02-29');
});

runTest('Negative month shift clamping (-1m)', () => {
  // Mar 31 - 1m -> Feb 28 (2026)
  assert.strictEqual(addMonthsSafe('2026-03-31', -1), '2026-02-28');
  // Mar 31 - 1m -> Feb 29 (2024)
  assert.strictEqual(addMonthsSafe('2024-03-31', -1), '2024-02-29');
  // May 31 - 1m -> Apr 30
  assert.strictEqual(addMonthsSafe('2026-05-31', -1), '2026-04-30');
  // Jan 31 - 1m -> Dec 31 previous year
  assert.strictEqual(addMonthsSafe('2026-01-31', -1), '2025-12-31');
});

runTest('Preset shortcuts (+2d, +3d, +1w, +1m)', () => {
  const ref = '2026-01-31';
  assert.strictEqual(presetPlus2Days(ref), '2026-02-02');
  assert.strictEqual(presetPlus3Days(ref), '2026-02-03');
  assert.strictEqual(presetPlus1Week(ref), '2026-02-07');
  assert.strictEqual(presetPlus1Month(ref), '2026-02-28');
});

// ============================================================================
// SUITE 3: NEGATIVE DAY DIFFS & BOUNDARY STATUS CLASSIFICATIONS
// ============================================================================
console.log('\n--- SUITE 3: Negative Day Diffs & Status Categorization ---');

const testToday = '2026-10-25';

runTest('Calculate day diff for expired items (yesterday, 10 days, 10 years)', () => {
  assert.strictEqual(calculateDayDiff('2026-10-24', testToday), -1);
  assert.strictEqual(calculateDayDiff('2026-10-15', testToday), -10);

  // 10 years ago (2016-10-25 to 2026-10-25 has 3652 days with leap years 2020 & 2024)
  const tenYearsAgo = calculateDayDiff('2016-10-25', testToday);
  assert.strictEqual(tenYearsAgo, -3652);
});

runTest('ExpiryStatus keys and Spanish human labels across critical boundaries', () => {
  // Expired 10 years ago
  const s10y = calculateExpiryStatus('2016-10-25', testToday);
  assert.strictEqual(s10y.key, 'expired');
  assert.strictEqual(s10y.cls, 'expired');
  assert.strictEqual(s10y.label, 'Vencido hace 3652 día(s)');

  // Expired yesterday
  const sYest = calculateExpiryStatus('2026-10-24', testToday);
  assert.strictEqual(sYest.key, 'expired');
  assert.strictEqual(sYest.cls, 'expired');
  assert.strictEqual(sYest.label, 'Vencido ayer');

  // Expired 2 days ago
  const s2d = calculateExpiryStatus('2026-10-23', testToday);
  assert.strictEqual(s2d.key, 'expired');
  assert.strictEqual(s2d.label, 'Vencido hace 2 día(s)');

  // Expires today (0 days) -> 'soon', 'Vence hoy'
  const sToday = calculateExpiryStatus('2026-10-25', testToday);
  assert.strictEqual(sToday.key, 'soon');
  assert.strictEqual(sToday.cls, 'warning');
  assert.strictEqual(sToday.label, 'Vence hoy');
  assert.strictEqual(sToday.daysRemaining, 0);

  // Expires tomorrow (1 day) -> 'soon', 'Vence mañana'
  const sTom = calculateExpiryStatus('2026-10-26', testToday);
  assert.strictEqual(sTom.key, 'soon');
  assert.strictEqual(sTom.label, 'Vence mañana');
  assert.strictEqual(sTom.daysRemaining, 1);

  // Expires in 2 days -> 'soon', 'Vence en 2 día(s)'
  const sIn2 = calculateExpiryStatus('2026-10-27', testToday);
  assert.strictEqual(sIn2.key, 'soon');
  assert.strictEqual(sIn2.label, 'Vence en 2 día(s)');

  // Expires in 3 days -> 'soon', 'Vence en 3 día(s)' (inclusive boundary)
  const sIn3 = calculateExpiryStatus('2026-10-28', testToday);
  assert.strictEqual(sIn3.key, 'soon');
  assert.strictEqual(sIn3.label, 'Vence en 3 día(s)');

  // Expires in 4 days -> 'week', 'Vence en 4 días'
  const sIn4 = calculateExpiryStatus('2026-10-29', testToday);
  assert.strictEqual(sIn4.key, 'week');
  assert.strictEqual(sIn4.cls, 'warning');
  assert.strictEqual(sIn4.label, 'Vence en 4 días');

  // Expires in 7 days -> 'week', 'Vence en 7 días' (inclusive boundary)
  const sIn7 = calculateExpiryStatus('2026-11-01', testToday);
  assert.strictEqual(sIn7.key, 'week');
  assert.strictEqual(sIn7.label, 'Vence en 7 días');

  // Expires in 8 days -> 'ok', 'Vigente'
  const sIn8 = calculateExpiryStatus('2026-11-02', testToday);
  assert.strictEqual(sIn8.key, 'ok');
  assert.strictEqual(sIn8.cls, 'ok');
  assert.strictEqual(sIn8.label, 'Vigente');

  // Expires in 100 days -> 'ok'
  const sIn100 = calculateExpiryStatus('2027-02-02', testToday);
  assert.strictEqual(sIn100.key, 'ok');
  assert.strictEqual(sIn100.label, 'Vigente');
});

runTest('Custom workspace threshold settings for ExpiryStatus', () => {
  // Custom: criticalDays = 5, warningDays = 10
  const opts = { criticalDays: 5, warningDays: 10 };

  // Day 4 was 'week' under default (3), now 'soon' under critical=5
  const s4 = calculateExpiryStatus('2026-10-29', testToday, opts);
  assert.strictEqual(s4.key, 'soon');

  // Day 5 is 'soon'
  const s5 = calculateExpiryStatus('2026-10-30', testToday, opts);
  assert.strictEqual(s5.key, 'soon');

  // Day 6 is 'week'
  const s6 = calculateExpiryStatus('2026-10-31', testToday, opts);
  assert.strictEqual(s6.key, 'week');

  // Day 10 is 'week'
  const s10 = calculateExpiryStatus('2026-11-04', testToday, opts);
  assert.strictEqual(s10.key, 'week');

  // Day 11 is 'ok'
  const s11 = calculateExpiryStatus('2026-11-05', testToday, opts);
  assert.strictEqual(s11.key, 'ok');
});

// ============================================================================
// SUITE 4: CORRUPTED, ILL-FORMED & ADVERSARIAL DATE INPUTS
// ============================================================================
console.log('\n--- SUITE 4: Corrupted, Ill-Formed & Adversarial Date Inputs ---');

runTest('parseLocalDate strictly rejects calendar-impossible and corrupt dates', () => {
  const corruptDates = [
    '2026-02-30', // Feb 30 does not exist
    '2026-04-31', // April has 30 days
    '2026-06-31', // June has 30 days
    '2026-09-31', // September has 30 days
    '2026-11-31', // November has 30 days
    '2026-00-15', // Month 0 does not exist
    '2026-13-01', // Month 13 does not exist
    '2026-01-00', // Day 0 does not exist
    '2026-01-32', // Day 32 does not exist
    '2026/10/25', // Wrong delimiter
    '25-10-2026', // DD-MM-YYYY format
    '2026-1-5',   // Missing leading zeros
    '2026-10-25T12:00:00Z', // ISO datetime instead of date
    'invalid-date',
    '',
    '    ',
    null as unknown as string,
    undefined as unknown as string,
    123456 as unknown as string,
    {} as unknown as string
  ];

  for (const cd of corruptDates) {
    const res = parseLocalDate(cd);
    assert.strictEqual(res, null, `Expected null for corrupt date: "${cd}"`);
  }
});

runTest('calculateDayDiff and calculateExpiryStatus handle corrupt dates gracefully without throwing', () => {
  const badInputs = ['2026-02-30', '', 'invalid', null as unknown as string];
  for (const bad of badInputs) {
    const diff = calculateDayDiff(bad, testToday);
    assert.strictEqual(diff, 99999);

    const status = calculateExpiryStatus(bad, testToday);
    assert.strictEqual(status.key, 'ok');
    assert.strictEqual(status.label, 'Sin fecha válida');
    assert.strictEqual(status.daysRemaining, 99999);
    assert.strictEqual(status.cls, 'ok');
  }
});

runTest('normalizeMidnight fallback on invalid reference date', () => {
  const d = normalizeMidnight('not-a-date');
  assert.ok(d instanceof Date);
  assert.ok(!isNaN(d.getTime()));
  assert.strictEqual(d.getHours(), 0);
  assert.strictEqual(d.getMinutes(), 0);
  assert.strictEqual(d.getSeconds(), 0);
  assert.strictEqual(d.getMilliseconds(), 0);
});

// ============================================================================
// SUITE 5: FRACTIONAL STOCK DECREMENTS & FLOAT PRECISION
// ============================================================================
console.log('\n--- SUITE 5: Fractional Stock Decrements & Float Precision ---');

runTest('roundQuantity eliminates IEEE 754 precision drift', () => {
  // 0.7 + 0.1 in raw JS = 0.7999999999999999
  assert.notStrictEqual(0.7 + 0.1, 0.8);
  assert.strictEqual(roundQuantity(0.7 + 0.1), 0.8);

  // 1.0 - 0.9 in raw JS = 0.09999999999999998
  assert.notStrictEqual(1.0 - 0.9, 0.1);
  assert.strictEqual(roundQuantity(1.0 - 0.9), 0.1);

  // 0.1 + 0.2 in raw JS = 0.30000000000000004
  assert.notStrictEqual(0.1 + 0.2, 0.3);
  assert.strictEqual(roundQuantity(0.1 + 0.2), 0.3);

  // 1.0 - 0.2 is 0.8, roundQuantity preserves 0.8
  assert.strictEqual(roundQuantity(1.0 - 0.2), 0.8);

  // 3-decimal precision preservation
  assert.strictEqual(roundQuantity(0.001), 0.001);
  assert.strictEqual(roundQuantity(0.333), 0.333);
  assert.strictEqual(roundQuantity(1.005), 1.005);
});

runTest('Repeated decrements in loop: 10.0 decremented by 0.1 reaches exactly 0.0', () => {
  let stock = 10.0;
  for (let i = 0; i < 100; i++) {
    stock = roundQuantity(stock - 0.1);
  }
  assert.strictEqual(stock, 0.0, 'Stock must reach exactly 0.0 without residual float noise');
});

runTest('normalizeQuantity input sanitization and boundary clamping', () => {
  assert.strictEqual(normalizeQuantity(5), 5);
  assert.strictEqual(normalizeQuantity('3.5'), 3.5);
  assert.strictEqual(normalizeQuantity('0.333333'), 0.333);
  assert.strictEqual(normalizeQuantity(-10), 0, 'Negative numbers must clamp to 0');
  assert.strictEqual(normalizeQuantity('-2.5'), 0);
  assert.strictEqual(normalizeQuantity('invalid'), 0);
  assert.strictEqual(normalizeQuantity(NaN), 0);
  assert.strictEqual(normalizeQuantity(Infinity), 0);
  assert.strictEqual(normalizeQuantity(-Infinity), 0);
  assert.strictEqual(normalizeQuantity(null), 0);
  assert.strictEqual(normalizeQuantity(undefined), 0);
});

// ============================================================================
// SUITE 6: STATE TRANSITIONS, HACCP AUDITING & RESTORE LOGIC
// ============================================================================
console.log('\n--- SUITE 6: State Transitions, HACCP Auditing & Restore Logic ---');

const baseMockProduct: Product = {
  id: 'prod-test-1',
  name: 'Carne Molida Especial',
  category: 'Carnes',
  quantity: 5.0,
  unit: 'kg',
  receivedDate: '2026-10-20',
  expiryDate: '2026-10-28',
  location: 'Refrigerador',
  isDiscarded: false,
  isConsumed: false,
  createdAt: '2026-10-20T10:00:00.000Z',
  createdBy: 'Juan - Cocinero',
  updatedAt: '2026-10-20T10:00:00.000Z',
  updatedBy: 'Juan - Cocinero',
  lastAction: 'CREATE'
};

runTest('consumeProductStock: Partial consumption (5.0 -> 3.75)', () => {
  const res = consumeProductStock(baseMockProduct, {
    amount: 1.25,
    operator: 'Marta - Cocina',
    reason: 'Preparación de hamburguesas'
  });

  assert.strictEqual(res.actualAmountConsumed, 1.25);
  assert.strictEqual(res.updatedProduct.quantity, 3.75);
  assert.strictEqual(res.isFullyExhausted, false);
  assert.strictEqual(res.updatedProduct.isConsumed, false);
  assert.strictEqual(res.updatedProduct.lastAction, 'CONSUME_PARTIAL');
  assert.strictEqual(res.historyLog.quantityDelta, -1.25);
  assert.strictEqual(res.historyLog.quantityBefore, 5.0);
  assert.strictEqual(res.historyLog.quantityAfter, 3.75);
  assert.strictEqual(res.historyLog.action, 'CONSUME_PARTIAL');
});

runTest('consumeProductStock: Full exhaustion (3.75 -> 0.0)', () => {
  const prod375 = { ...baseMockProduct, quantity: 3.75 };
  const res = consumeProductStock(prod375, {
    amount: 3.75,
    operator: 'Pedro - Parrilla'
  });

  assert.strictEqual(res.actualAmountConsumed, 3.75);
  assert.strictEqual(res.updatedProduct.quantity, 0);
  assert.strictEqual(res.isFullyExhausted, true);
  assert.strictEqual(res.updatedProduct.isConsumed, true);
  assert.strictEqual(res.updatedProduct.lastAction, 'CONSUME_FULL');
  assert.strictEqual(res.historyLog.quantityDelta, -3.75);
  assert.ok(res.updatedProduct.consumedAt !== undefined);
  assert.strictEqual(res.updatedProduct.consumedBy, 'Pedro - Parrilla');
});

runTest('consumeProductStock: Overconsumption clamped to remaining stock', () => {
  const prod = { ...baseMockProduct, quantity: 2.0 };
  const res = consumeProductStock(prod, {
    amount: 10.0,
    operator: 'Pedro - Parrilla'
  });

  assert.strictEqual(res.actualAmountConsumed, 2.0, 'Consumed amount must clamp to available stock');
  assert.strictEqual(res.updatedProduct.quantity, 0);
  assert.strictEqual(res.isFullyExhausted, true);
  assert.strictEqual(res.historyLog.quantityDelta, -2.0);
});

runTest('consumeProductStock: Rejects consumption of 0-stock and discarded items', () => {
  const zeroProd = { ...baseMockProduct, quantity: 0 };
  assert.throws(() => {
    consumeProductStock(zeroProd, { amount: 1, operator: 'Op' });
  }, /no tiene existencias disponibles/);

  const discardedProd = { ...baseMockProduct, isDiscarded: true };
  assert.throws(() => {
    consumeProductStock(discardedProd, { amount: 1, operator: 'Op' });
  }, /ha sido descartado/);
});

runTest('consumeProductStock: allowNegativeStock permits negative inventory', () => {
  const zeroProd = { ...baseMockProduct, quantity: 0 };
  const res = consumeProductStock(zeroProd, {
    amount: 2.5,
    operator: 'Supervisor',
    allowNegativeStock: true
  });

  assert.strictEqual(res.updatedProduct.quantity, -2.5);
  assert.strictEqual(res.historyLog.quantityDelta, -2.5);
  assert.strictEqual(res.isFullyExhausted, true);
});

runTest('discardProductStock: Full and partial discard for HACCP waste', () => {
  // Partial discard
  const partialRes = discardProductStock(baseMockProduct, {
    amount: 2.0,
    reason: 'calidad',
    operator: 'Inspector HACCP',
    notes: 'Olor extraño en una porción'
  });

  assert.strictEqual(partialRes.updatedProduct.quantity, 3.0);
  assert.strictEqual(partialRes.isFullyDiscarded, false);
  assert.strictEqual(partialRes.updatedProduct.isDiscarded, false);
  assert.strictEqual(partialRes.historyLog.quantityDelta, -2.0);
  assert.strictEqual(partialRes.historyLog.action, 'DISCARD');

  // Full discard (default amount = all)
  const fullRes = discardProductStock(baseMockProduct, {
    reason: 'vencimiento',
    operator: 'Inspector HACCP'
  });

  assert.strictEqual(fullRes.updatedProduct.quantity, 0);
  assert.strictEqual(fullRes.isFullyDiscarded, true);
  assert.strictEqual(fullRes.updatedProduct.isDiscarded, true);
  assert.strictEqual(fullRes.updatedProduct.discardReason, 'vencimiento');
  assert.strictEqual(fullRes.historyLog.quantityDelta, -5.0);
});

runTest('restoreProductStock: Reverting consumption and discard (1-tap toast undo)', () => {
  // Scenario 1: Restore after full consumption
  const consumedProd: Product = {
    ...baseMockProduct,
    quantity: 0,
    isConsumed: true
  };
  const consumeLog = {
    id: 'log-1',
    productId: baseMockProduct.id,
    productName: baseMockProduct.name,
    category: baseMockProduct.category,
    action: 'CONSUME_FULL' as const,
    quantityBefore: 5.0,
    quantityDelta: -5.0,
    quantityAfter: 0,
    unit: baseMockProduct.unit,
    operatorAlias: 'Juan',
    timestamp: new Date().toISOString()
  };

  const undoConsume = restoreProductStock(consumedProd, consumeLog, 'Juan');
  assert.strictEqual(undoConsume.updatedProduct.quantity, 5.0);
  assert.strictEqual(undoConsume.updatedProduct.isConsumed, false);
  assert.strictEqual(undoConsume.historyLog.action, 'RESTORE');
  assert.strictEqual(undoConsume.historyLog.quantityDelta, 5.0);

  // Scenario 2: Restore after discard
  const discardedProd: Product = {
    ...baseMockProduct,
    quantity: 0,
    isDiscarded: true
  };
  const discardLog = {
    id: 'log-2',
    productId: baseMockProduct.id,
    productName: baseMockProduct.name,
    category: baseMockProduct.category,
    action: 'DISCARD' as const,
    quantityBefore: 5.0,
    quantityDelta: -5.0,
    quantityAfter: 0,
    unit: baseMockProduct.unit,
    operatorAlias: 'Juan',
    timestamp: new Date().toISOString()
  };

  const undoDiscard = restoreProductStock(discardedProd, discardLog, 'Juan');
  assert.strictEqual(undoDiscard.updatedProduct.quantity, 5.0);
  assert.strictEqual(undoDiscard.updatedProduct.isDiscarded, false);
  assert.strictEqual(undoDiscard.historyLog.action, 'RESTORE');
});

runTest('HACCP Audit entry string formatting and waste summarization', () => {
  const log = {
    id: 'hist_123',
    productId: 'p1',
    productName: 'Leche Descremada',
    category: 'Lácteos' as const,
    action: 'DISCARD' as const,
    quantityBefore: 3,
    quantityDelta: -3,
    quantityAfter: 0,
    unit: 'L',
    operatorAlias: 'Laura - Bodega',
    timestamp: '2026-10-25T14:30:00.000Z',
    reason: 'vencimiento'
  };

  const textEntry = formatHaccpAuditEntry(log);
  assert.ok(textEntry.includes('[DISCARD]'));
  assert.ok(textEntry.includes('Leche Descremada'));
  assert.ok(textEntry.includes('Cambio: -3 L'));
  assert.ok(textEntry.includes('Operador: Laura - Bodega'));
  assert.ok(textEntry.includes('Fecha de vencimiento superada'));

  // Test summarizeWasteLogs
  const wasteLogs = [
    { ...log, id: 'l1', reason: 'vencimiento', quantityDelta: -2.5 },
    { ...log, id: 'l2', reason: 'vencimiento', quantityDelta: -1.5 },
    { ...log, id: 'l3', reason: 'rotura', quantityDelta: -0.7 },
    { ...log, id: 'l4', reason: 'rotura', quantityDelta: -0.3 },
    { ...log, id: 'l5', action: 'CONSUME_FULL' as const, quantityDelta: -10 } // must be ignored
  ];

  const summary = summarizeWasteLogs(wasteLogs);
  assert.strictEqual(summary['vencimiento'].totalQuantity, 4.0);
  assert.strictEqual(summary['vencimiento'].incidentCount, 2);
  assert.strictEqual(summary['rotura'].totalQuantity, 1.0);
  assert.strictEqual(summary['rotura'].incidentCount, 2);
  assert.strictEqual(summary['vencimiento'].reason, 'Fecha de vencimiento superada');
});

// ============================================================================
// SUITE 7: TYPE GUARDS & NORMALIZERS (MODELS)
// ============================================================================
console.log('\n--- SUITE 7: Models Type Guards & Normalizers ---');

runTest('Category, Unit, Location, and WasteReason guards & fallbacks', () => {
  // Categories
  assert.strictEqual(isValidCategory('Carnes'), true);
  assert.strictEqual(isValidCategory('Inexistente'), false);
  assert.strictEqual(normalizeCategory('Inexistente'), 'Otros');
  assert.strictEqual(normalizeCategory('Lácteos'), 'Lácteos');

  // Units
  assert.strictEqual(isValidUnit('kg'), true);
  assert.strictEqual(isValidUnit('toneladas'), false);
  assert.strictEqual(normalizeUnit('toneladas'), 'unidad(es)');
  assert.strictEqual(normalizeUnit('L'), 'L');

  // Locations
  assert.strictEqual(isValidLocation('Refrigerador'), true);
  assert.strictEqual(isValidLocation('Sótano'), false);
  assert.strictEqual(normalizeLocation('Sótano'), 'Refrigerador');
  assert.strictEqual(normalizeLocation('Congelador'), 'Congelador');

  // Waste reasons
  assert.strictEqual(isValidWasteReason('vencimiento'), true);
  assert.strictEqual(isValidWasteReason('contaminacion'), true);
  assert.strictEqual(isValidWasteReason('robo'), false);
});

// ============================================================================
// SUITE 8: 10,000 PRODUCTS LARGE INVENTORY BENCHMARK
// ============================================================================
console.log('\n--- SUITE 8: 10,000 Products Scalability & Partitioning Benchmark ---');

runTest('Large inventory benchmark: 10,000 products disjoint partitioning & performance', () => {
  const N = 10000;
  const products: Product[] = [];

  // Distribution:
  // 2,000 expired (expiry date 2026-10-15, diff -10)
  // 2,000 soon (expiry date 2026-10-27, diff +2)
  // 2,000 week (expiry date 2026-10-31, diff +6)
  // 2,000 ok (expiry date 2026-11-20, diff +26)
  // 1,000 discarded (isDiscarded = true)
  // 1,000 consumed (quantity = 0, isConsumed = true)

  for (let i = 0; i < 2000; i++) {
    products.push({
      ...baseMockProduct,
      id: `exp-${i}`,
      expiryDate: '2026-10-15',
      quantity: 5,
      isDiscarded: false,
      isConsumed: false
    });
  }

  for (let i = 0; i < 2000; i++) {
    products.push({
      ...baseMockProduct,
      id: `soon-${i}`,
      expiryDate: '2026-10-27',
      quantity: 3,
      isDiscarded: false,
      isConsumed: false
    });
  }

  for (let i = 0; i < 2000; i++) {
    products.push({
      ...baseMockProduct,
      id: `week-${i}`,
      expiryDate: '2026-10-31',
      quantity: 4,
      isDiscarded: false,
      isConsumed: false
    });
  }

  for (let i = 0; i < 2000; i++) {
    products.push({
      ...baseMockProduct,
      id: `ok-${i}`,
      expiryDate: '2026-11-20',
      quantity: 10,
      isDiscarded: false,
      isConsumed: false
    });
  }

  for (let i = 0; i < 1000; i++) {
    products.push({
      ...baseMockProduct,
      id: `disc-${i}`,
      expiryDate: '2026-10-15',
      quantity: 0,
      isDiscarded: true,
      isConsumed: false
    });
  }

  for (let i = 0; i < 1000; i++) {
    products.push({
      ...baseMockProduct,
      id: `cons-${i}`,
      expiryDate: '2026-10-15',
      quantity: 0,
      isDiscarded: false,
      isConsumed: true
    });
  }

  assert.strictEqual(products.length, 10000);

  const start = performance.now();
  const metrics = calculateMetrics(products, testToday);
  const durationMs = performance.now() - start;

  console.log(`    ⚡ Benchmark Result: 10,000 products aggregated in ${durationMs.toFixed(2)} ms`);

  // Assert exact counts
  assert.strictEqual(metrics.total, 8000, 'Total active products must be 8,000');
  assert.strictEqual(metrics.expired, 2000, 'Expired count must be 2,000');
  assert.strictEqual(metrics.soon, 2000, 'Soon count must be 2,000');
  assert.strictEqual(metrics.week, 2000, 'Week count must be 2,000');
  assert.strictEqual(metrics.ok, 2000, 'Ok count must be 2,000');
  assert.strictEqual(metrics.within7Days, 4000, 'within7Days must be soon + week (4,000)');
  assert.strictEqual(metrics.criticalTotal, 4000, 'criticalTotal must be expired + soon (4,000)');
  assert.strictEqual(metrics.discardedCount, 1000, 'Discarded count must be 1,000');
  assert.strictEqual(metrics.consumedCount, 1000, 'Consumed count must be 1,000');

  // Disjoint partitioning invariant
  assert.strictEqual(
    metrics.total,
    metrics.expired + metrics.soon + metrics.week + metrics.ok,
    'Invariant total === expired + soon + week + ok must strictly hold'
  );

  // Performance threshold: under 250ms for 10,000 items on CPU
  assert.ok(durationMs < 250, `Expected duration < 250ms, got ${durationMs.toFixed(2)}ms`);
});

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n================================================================');
console.log(`🏁 EMPIRICAL TEST SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('================================================================\n');
