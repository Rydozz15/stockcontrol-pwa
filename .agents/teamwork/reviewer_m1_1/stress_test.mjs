/**
 * Independent Adversarial Stress Test Suite for Milestone 1 Deliverables
 * Reviewer: reviewer_m1_1
 * Date: 2026-10-25
 * Tests real TypeScript domain modules directly using Node 24 experimental strip types.
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
} from '../../../src/lib/domain/expiry.ts';

import {
  roundQuantity,
  generateAuditId,
  consumeProductStock,
  discardProductStock,
  restoreProductStock,
  formatHaccpAuditEntry,
  summarizeWasteLogs
} from '../../../src/lib/domain/waste.ts';

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
  normalizeQuantity
} from '../../../src/lib/domain/models.ts';

import {
  sanitizeWorkspaceId,
  sanitizeOperatorAlias,
  DEFAULT_WORKSPACE,
  DEFAULT_OPERATOR
} from '../../../src/lib/stores/workspaceStore.ts';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n=== ADVERSARIAL REVIEWER STRESS TESTS ===\n');

// 1. DATE PARSING & VALIDITY
console.log('1. Date Parsing & Strict Calendar Sanity');

test('Rejects non-string and falsy dates', () => {
  assert.strictEqual(parseLocalDate(null), null);
  assert.strictEqual(parseLocalDate(undefined), null);
  assert.strictEqual(parseLocalDate(''), null);
  assert.strictEqual(parseLocalDate('   '), null);
  assert.strictEqual(parseLocalDate(12345), null);
  assert.strictEqual(parseLocalDate({}), null);
});

test('Rejects invalid calendar days (Feb 30, April 31, etc.)', () => {
  assert.strictEqual(parseLocalDate('2026-02-30'), null);
  assert.strictEqual(parseLocalDate('2026-02-31'), null);
  assert.strictEqual(parseLocalDate('2026-04-31'), null);
  assert.strictEqual(parseLocalDate('2026-06-31'), null);
  assert.strictEqual(parseLocalDate('2026-09-31'), null);
  assert.strictEqual(parseLocalDate('2026-11-31'), null);
});

test('Leap year recognition (2024 vs 2026 vs 1900 vs 2000)', () => {
  assert.notStrictEqual(parseLocalDate('2024-02-29'), null, '2024 is leap year');
  assert.strictEqual(parseLocalDate('2026-02-29'), null, '2026 is non-leap');
  assert.strictEqual(parseLocalDate('1900-02-29'), null, '1900 is non-leap (div by 100)');
  assert.notStrictEqual(parseLocalDate('2000-02-29'), null, '2000 is leap (div by 400)');
});

test('formatDateISO preserves local calendar without timezone backwards shift', () => {
  const d = new Date(2026, 9, 25, 0, 0, 0); // Oct 25, 2026 local
  assert.strictEqual(formatDateISO(d), '2026-10-25');
  const endOfDay = new Date(2026, 9, 25, 23, 59, 59);
  assert.strictEqual(formatDateISO(endOfDay), '2026-10-25');
});

// 2. EXPIRY STATUS BOUNDARIES
console.log('\n2. Expiry Status & Boundary Mathematics');

const REF_DATE = new Date('2026-10-25T12:00:00');

test('Past dates categorized as expired', () => {
  const yesterday = calculateExpiryStatus('2026-10-24', REF_DATE);
  assert.strictEqual(yesterday.key, 'expired');
  assert.strictEqual(yesterday.daysRemaining, -1);
  assert.strictEqual(yesterday.cls, 'expired');
  assert.strictEqual(yesterday.label, 'Vencido ayer');

  const fiveDaysAgo = calculateExpiryStatus('2026-10-20', REF_DATE);
  assert.strictEqual(fiveDaysAgo.key, 'expired');
  assert.strictEqual(fiveDaysAgo.daysRemaining, -5);
  assert.strictEqual(fiveDaysAgo.label, 'Vencido hace 5 día(s)');
});

test('Day 0 (today) categorized as soon ("Vence hoy")', () => {
  const today = calculateExpiryStatus('2026-10-25', REF_DATE);
  assert.strictEqual(today.key, 'soon');
  assert.strictEqual(today.daysRemaining, 0);
  assert.strictEqual(today.cls, 'warning');
  assert.strictEqual(today.label, 'Vence hoy');
});

test('Days 1..3 categorized as soon (critical threshold)', () => {
  const d1 = calculateExpiryStatus('2026-10-26', REF_DATE);
  assert.strictEqual(d1.key, 'soon');
  assert.strictEqual(d1.daysRemaining, 1);
  assert.strictEqual(d1.label, 'Vence mañana');

  const d2 = calculateExpiryStatus('2026-10-27', REF_DATE);
  assert.strictEqual(d2.key, 'soon');
  assert.strictEqual(d2.daysRemaining, 2);

  const d3 = calculateExpiryStatus('2026-10-28', REF_DATE);
  assert.strictEqual(d3.key, 'soon');
  assert.strictEqual(d3.daysRemaining, 3);
  assert.strictEqual(d3.cls, 'warning');
});

test('Days 4..7 categorized as week (warning threshold)', () => {
  const d4 = calculateExpiryStatus('2026-10-29', REF_DATE);
  assert.strictEqual(d4.key, 'week');
  assert.strictEqual(d4.daysRemaining, 4);
  assert.strictEqual(d4.cls, 'warning');

  const d7 = calculateExpiryStatus('2026-11-01', REF_DATE);
  assert.strictEqual(d7.key, 'week');
  assert.strictEqual(d7.daysRemaining, 7);
  assert.strictEqual(d7.cls, 'warning');
});

test('Days > 7 categorized as ok ("Vigente")', () => {
  const d8 = calculateExpiryStatus('2026-11-02', REF_DATE);
  assert.strictEqual(d8.key, 'ok');
  assert.strictEqual(d8.daysRemaining, 8);
  assert.strictEqual(d8.cls, 'ok');
  assert.strictEqual(d8.label, 'Vigente');
});

test('Invalid date input returns safe fallback without crashing', () => {
  const invalid = calculateExpiryStatus('gibberish', REF_DATE);
  assert.strictEqual(invalid.key, 'ok');
  assert.strictEqual(invalid.daysRemaining, 99999);
  assert.strictEqual(invalid.label, 'Sin fecha válida');
});

// 3. SAFE DATE ARITHMETIC & PRESETS
console.log('\n3. Safe Date Arithmetic & Quick Presets');

test('addDaysSafe handles month boundary crossing', () => {
  assert.strictEqual(addDaysSafe('2026-10-25', 10), '2026-11-04');
});

test('addWeeksSafe handles week calculations', () => {
  assert.strictEqual(addWeeksSafe('2026-10-25', 2), '2026-11-08');
});

test('addMonthsSafe clamps Jan 31 to Feb 28 in non-leap year 2026', () => {
  assert.strictEqual(addMonthsSafe('2026-01-31', 1), '2026-02-28');
});

test('addMonthsSafe clamps Jan 31 to Feb 29 in leap year 2024', () => {
  assert.strictEqual(addMonthsSafe('2024-01-31', 1), '2024-02-29');
});

test('addMonthsSafe clamps March 31 to April 30', () => {
  assert.strictEqual(addMonthsSafe('2026-03-31', 1), '2026-04-30');
});

test('addMonthsSafe handles year rollover (Dec to Jan)', () => {
  assert.strictEqual(addMonthsSafe('2026-12-15', 2), '2027-02-15');
});

test('Presets match expected offsets', () => {
  assert.strictEqual(presetPlus2Days('2026-10-25'), '2026-10-27');
  assert.strictEqual(presetPlus3Days('2026-10-25'), '2026-10-28');
  assert.strictEqual(presetPlus1Week('2026-10-25'), '2026-11-01');
  assert.strictEqual(presetPlus1Month('2026-10-25'), '2026-11-25');
});

// 4. METRICS DISJOINT INVARIANT
console.log('\n4. Inventory Metrics Disjoint Partitioning');

test('Strict disjoint partition total = expired + soon + week + ok', () => {
  const mockProducts = [
    { id: '1', name: 'P1', quantity: 1, expiryDate: '2026-10-20', isDiscarded: false, isConsumed: false }, // expired
    { id: '2', name: 'P2', quantity: 2, expiryDate: '2026-10-25', isDiscarded: false, isConsumed: false }, // soon (0)
    { id: '3', name: 'P3', quantity: 3, expiryDate: '2026-10-27', isDiscarded: false, isConsumed: false }, // soon (2)
    { id: '4', name: 'P4', quantity: 4, expiryDate: '2026-10-30', isDiscarded: false, isConsumed: false }, // week (5)
    { id: '5', name: 'P5', quantity: 5, expiryDate: '2026-11-15', isDiscarded: false, isConsumed: false }, // ok (21)
    { id: '6', name: 'P6', quantity: 10, expiryDate: '2026-10-20', isDiscarded: true, isConsumed: false }, // discarded
    { id: '7', name: 'P7', quantity: 0, expiryDate: '2026-10-25', isDiscarded: false, isConsumed: true },  // consumed
    { id: '8', name: 'P8', quantity: -1, expiryDate: '2026-10-25', isDiscarded: false, isConsumed: false } // zero/neg qty
  ];

  const m = calculateMetrics(mockProducts, REF_DATE);
  assert.strictEqual(m.total, 5, 'Total active products must be 5');
  assert.strictEqual(m.expired, 1, 'Expired count');
  assert.strictEqual(m.soon, 2, 'Soon count');
  assert.strictEqual(m.week, 1, 'Week count');
  assert.strictEqual(m.ok, 1, 'Ok count');
  assert.strictEqual(m.total, m.expired + m.soon + m.week + m.ok, 'Disjoint sum invariant');
  assert.strictEqual(m.criticalTotal, m.expired + m.soon, 'Critical total');
  assert.strictEqual(m.within7Days, m.soon + m.week, 'Within 7 days');
  assert.strictEqual(m.discardedCount, 1, 'Discarded count');
  assert.strictEqual(m.consumedCount, 2, 'Consumed count (isConsumed or qty <= 0)');
});

// 5. STOCK ARITHMETIC & WASTE/MERMA LOGIC
console.log('\n5. Stock Arithmetic & Waste/Merma Domain Logic');

test('roundQuantity prevents IEEE 754 float drift', () => {
  assert.strictEqual(roundQuantity(1.0 - 0.2), 0.8);
  assert.strictEqual(roundQuantity(0.1 + 0.2), 0.3);
  assert.strictEqual(roundQuantity(0.3 - 0.1), 0.2);
  assert.strictEqual(roundQuantity(5.5555), 5.556);
});

const baseProduct = {
  id: 'prod_100',
  name: 'Crema de Leche',
  category: 'Lácteos',
  quantity: 5,
  unit: 'L',
  receivedDate: '2026-10-20',
  expiryDate: '2026-10-30',
  location: 'Refrigerador',
  isDiscarded: false,
  isConsumed: false,
  createdAt: '2026-10-20T10:00:00Z',
  createdBy: 'Juan - Cocinero',
  updatedAt: '2026-10-20T10:00:00Z',
  updatedBy: 'Juan - Cocinero',
  lastAction: 'CREATE'
};

test('consumeProductStock partial consumption', () => {
  const result = consumeProductStock(baseProduct, {
    amount: 1.5,
    operator: 'Marta - Cocina',
    reason: 'Preparación salsa'
  });

  assert.strictEqual(result.updatedProduct.quantity, 3.5);
  assert.strictEqual(result.isFullyExhausted, false);
  assert.strictEqual(result.actualAmountConsumed, 1.5);
  assert.strictEqual(result.updatedProduct.lastAction, 'CONSUME_PARTIAL');
  assert.strictEqual(result.historyLog.action, 'CONSUME_PARTIAL');
  assert.strictEqual(result.historyLog.quantityBefore, 5);
  assert.strictEqual(result.historyLog.quantityDelta, -1.5);
  assert.strictEqual(result.historyLog.quantityAfter, 3.5);
  assert.strictEqual(result.historyLog.operatorAlias, 'Marta - Cocina');
});

test('consumeProductStock full consumption sets isConsumed and consumedAt', () => {
  const result = consumeProductStock(baseProduct, {
    amount: 5,
    operator: 'Carlos - Ayudante'
  });

  assert.strictEqual(result.updatedProduct.quantity, 0);
  assert.strictEqual(result.isFullyExhausted, true);
  assert.strictEqual(result.updatedProduct.isConsumed, true);
  assert.strictEqual(result.updatedProduct.lastAction, 'CONSUME_FULL');
  assert.strictEqual(result.updatedProduct.consumedBy, 'Carlos - Ayudante');
  assert.ok(result.updatedProduct.consumedAt);
});

test('consumeProductStock rejects discarded product', () => {
  const discardedProd = { ...baseProduct, isDiscarded: true };
  assert.throws(() => {
    consumeProductStock(discardedProd, { operator: 'Test' });
  }, /ha sido descartado/);
});

test('consumeProductStock rejects zero stock when allowNegativeStock is false', () => {
  const zeroProd = { ...baseProduct, quantity: 0 };
  assert.throws(() => {
    consumeProductStock(zeroProd, { operator: 'Test', allowNegativeStock: false });
  }, /no tiene existencias disponibles/);
});

test('discardProductStock logs waste with reason and updates product', () => {
  const result = discardProductStock(baseProduct, {
    amount: 2,
    reason: 'vencimiento',
    operator: 'Admin - Cocina',
    notes: 'Olor agrio'
  });

  assert.strictEqual(result.updatedProduct.quantity, 3);
  assert.strictEqual(result.actualAmountDiscarded, 2);
  assert.strictEqual(result.isFullyDiscarded, false);
  assert.strictEqual(result.updatedProduct.lastAction, 'DISCARD');
  assert.strictEqual(result.updatedProduct.discardReason, 'vencimiento');
  assert.strictEqual(result.historyLog.reason, 'vencimiento');
  assert.strictEqual(result.historyLog.quantityDelta, -2);
});

test('restoreProductStock reverts consumption correctly', () => {
  const consumed = consumeProductStock(baseProduct, { amount: 1, operator: 'Marta' });
  const restored = restoreProductStock(
    consumed.updatedProduct,
    consumed.historyLog,
    'Marta',
    undefined
  );

  assert.strictEqual(restored.updatedProduct.quantity, 5);
  assert.strictEqual(restored.updatedProduct.isConsumed, false);
  assert.strictEqual(restored.updatedProduct.lastAction, 'RESTORE');
  assert.strictEqual(restored.historyLog.quantityDelta, 1);
});

test('summarizeWasteLogs aggregates by waste reason', () => {
  const logs = [
    { action: 'DISCARD', reason: 'vencimiento', quantityDelta: -2 },
    { action: 'DISCARD', reason: 'vencimiento', quantityDelta: -3 },
    { action: 'DISCARD', reason: 'rotura', quantityDelta: -1 },
    { action: 'CONSUME_PARTIAL', reason: 'servicio', quantityDelta: -5 } // should be ignored
  ];

  const summary = summarizeWasteLogs(logs);
  assert.strictEqual(summary.vencimiento.totalQuantity, 5);
  assert.strictEqual(summary.vencimiento.incidentCount, 2);
  assert.strictEqual(summary.rotura.totalQuantity, 1);
  assert.strictEqual(summary.rotura.incidentCount, 1);
  assert.strictEqual(summary.servicio, undefined);
});

// 6. SANITIZERS & STORE NORMALIZERS
console.log('\n6. Sanitizers & Workspace Rules');

test('sanitizeWorkspaceId cleans accents, symbols and whitespace', () => {
  assert.strictEqual(sanitizeWorkspaceId('  Cocina Central #1!  '), 'cocina-central-1');
  assert.strictEqual(sanitizeWorkspaceId('Sucursal-Norte_2026'), 'sucursal-norte_2026');
  assert.strictEqual(sanitizeWorkspaceId('Área Fría'), 'area-fria');
  assert.strictEqual(sanitizeWorkspaceId(''), DEFAULT_WORKSPACE);
  assert.strictEqual(sanitizeWorkspaceId(null), DEFAULT_WORKSPACE);
  assert.strictEqual(sanitizeWorkspaceId('---'), DEFAULT_WORKSPACE);
});

test('sanitizeOperatorAlias trims whitespace and enforces fallback', () => {
  assert.strictEqual(sanitizeOperatorAlias('  Juan - Chef  '), 'Juan - Chef');
  assert.strictEqual(sanitizeOperatorAlias(''), DEFAULT_OPERATOR);
  assert.strictEqual(sanitizeOperatorAlias('   '), DEFAULT_OPERATOR);
  assert.strictEqual(sanitizeOperatorAlias(null), DEFAULT_OPERATOR);
});

test('normalizeCategory, normalizeUnit, normalizeLocation fallbacks', () => {
  assert.strictEqual(normalizeCategory('Carnes'), 'Carnes');
  assert.strictEqual(normalizeCategory('Inexistente'), 'Otros');

  assert.strictEqual(normalizeUnit('kg'), 'kg');
  assert.strictEqual(normalizeUnit('barriles'), 'unidad(es)');

  assert.strictEqual(normalizeLocation('Congelador'), 'Congelador');
  assert.strictEqual(normalizeLocation('Techo'), 'Refrigerador');

  assert.strictEqual(normalizeQuantity('10.5'), 10.5);
  assert.strictEqual(normalizeQuantity(-5), 0);
  assert.strictEqual(normalizeQuantity('invalid'), 0);
});

console.log('\n=========================================');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('=========================================\n');

if (failed > 0) {
  process.exit(1);
}
