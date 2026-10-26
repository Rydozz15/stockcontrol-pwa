// Verification test suite for proposed domain logic
// Run with: node .agents/teamwork/explorer_m1_2/verify_domain.js

import assert from 'node:assert';

// 1. Math and date logic implementations under test
function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10) - 1;
  const d = parseInt(match[3], 10);
  const date = new Date(y, m, d, 0, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) {
    return null;
  }
  return date;
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeMidnight(date = new Date()) {
  if (typeof date === 'string') {
    const parsed = parseLocalDate(date);
    if (parsed) return parsed;
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

function calculateDayDiff(expiryDateStr, referenceDate = new Date()) {
  const target = parseLocalDate(expiryDateStr);
  if (!target) return 99999;
  const ref = normalizeMidnight(referenceDate);
  const MS_PER_DAY = 86400000;
  const diffMs = target.getTime() - ref.getTime();
  return Math.round(diffMs / MS_PER_DAY);
}

function calculateExpiryStatus(expiryDate, referenceDate = new Date(), options = {}) {
  const criticalDays = options.criticalDays ?? 3;
  const warningDays = options.warningDays ?? 7;
  const daysRemaining = calculateDayDiff(expiryDate, referenceDate);

  if (daysRemaining === 99999) {
    return { key: 'ok', label: 'Sin fecha válida', daysRemaining: 99999, cls: 'ok' };
  }
  if (daysRemaining < 0) {
    const absDays = Math.abs(daysRemaining);
    const label = absDays === 1 ? 'Vencido ayer' : `Vencido hace ${absDays} día(s)`;
    return { key: 'expired', label, daysRemaining, cls: 'expired' };
  }
  if (daysRemaining === 0) {
    return { key: 'soon', label: 'Vence hoy', daysRemaining: 0, cls: 'warning' };
  }
  if (daysRemaining <= criticalDays) {
    const label = daysRemaining === 1 ? 'Vence mañana' : `Vence en ${daysRemaining} día(s)`;
    return { key: 'soon', label, daysRemaining, cls: 'warning' };
  }
  if (daysRemaining <= warningDays) {
    return { key: 'week', label: `Vence en ${daysRemaining} días`, daysRemaining, cls: 'warning' };
  }
  return { key: 'ok', label: 'Vigente', daysRemaining, cls: 'ok' };
}

function addDaysSafe(baseDate = new Date(), days) {
  const ref = normalizeMidnight(baseDate);
  const target = new Date(ref.getTime());
  target.setDate(target.getDate() + days);
  return formatDateISO(target);
}

function addWeeksSafe(baseDate = new Date(), weeks) {
  return addDaysSafe(baseDate, weeks * 7);
}

function addMonthsSafe(baseDate = new Date(), monthsToAdd) {
  const ref = normalizeMidnight(baseDate);
  const originalDay = ref.getDate();
  const currentYear = ref.getFullYear();
  const currentMonth = ref.getMonth();

  const totalMonths = currentYear * 12 + currentMonth + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(originalDay, daysInTargetMonth);

  const result = new Date(targetYear, targetMonth, clampedDay, 0, 0, 0, 0);
  return formatDateISO(result);
}

function roundQuantity(val) {
  return Math.round((val + Number.EPSILON) * 1000) / 1000;
}

function calculateMetrics(products, referenceDate = new Date()) {
  let total = 0, expired = 0, soon = 0, week = 0, ok = 0;
  let discardedCount = 0, consumedCount = 0;

  for (const p of products) {
    if (p.isDiscarded) {
      discardedCount++;
      continue;
    }
    if (p.isConsumed || p.quantity <= 0) {
      consumedCount++;
      continue;
    }
    total++;
    const status = calculateExpiryStatus(p.expiryDate, referenceDate);
    switch (status.key) {
      case 'expired': expired++; break;
      case 'soon': soon++; break;
      case 'week': week++; break;
      case 'ok': ok++; break;
    }
  }

  return {
    total,
    expired,
    soon,
    week,
    ok,
    within7Days: soon + week,
    criticalTotal: expired + soon,
    discardedCount,
    consumedCount
  };
}

function consumeProductStock(product, options) {
  const now = options.timestamp || new Date().toISOString();
  const desiredAmount = Math.max(0, options.amount ?? 1);
  const allowNegative = options.allowNegativeStock ?? false;

  if (product.isDiscarded) {
    throw new Error(`No se puede consumir el producto "${product.name}" porque ha sido descartado.`);
  }
  if (product.quantity <= 0 && !allowNegative) {
    throw new Error(`El producto "${product.name}" no tiene existencias disponibles.`);
  }

  const actualAmountConsumed = allowNegative
    ? desiredAmount
    : Math.min(product.quantity, desiredAmount);

  const newQuantity = roundQuantity(product.quantity - actualAmountConsumed);
  const isFullyExhausted = newQuantity <= 0;
  const action = isFullyExhausted ? 'CONSUME_FULL' : 'CONSUME_PARTIAL';

  const updatedProduct = {
    ...product,
    quantity: allowNegative ? newQuantity : Math.max(0, newQuantity),
    isConsumed: isFullyExhausted,
    lastAction: action,
    updatedAt: now,
    updatedBy: options.operator,
    updatedByUid: options.operatorUid,
    ...(isFullyExhausted ? { consumedAt: now, consumedBy: options.operator } : {})
  };

  const historyLog = {
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    productId: product.id,
    productName: product.name,
    category: product.category,
    action,
    quantityBefore: product.quantity,
    quantityDelta: roundQuantity(-actualAmountConsumed),
    quantityAfter: updatedProduct.quantity,
    unit: product.unit,
    operatorAlias: options.operator,
    operatorUid: options.operatorUid,
    timestamp: now,
    reason: options.reason || 'Consumo en servicio',
    notes: options.notes
  };

  return { updatedProduct, historyLog, isFullyExhausted, actualAmountConsumed };
}

function discardProductStock(product, options) {
  const now = options.timestamp || new Date().toISOString();
  const discardAmount = options.amount !== undefined ? Math.max(0, options.amount) : product.quantity;
  const actualAmountDiscarded = Math.min(product.quantity, discardAmount);
  const newQuantity = roundQuantity(product.quantity - actualAmountDiscarded);
  const isFullyDiscarded = newQuantity <= 0;

  const updatedProduct = {
    ...product,
    quantity: Math.max(0, newQuantity),
    isDiscarded: isFullyDiscarded ? true : product.isDiscarded,
    lastAction: 'DISCARD',
    updatedAt: now,
    updatedBy: options.operator,
    updatedByUid: options.operatorUid,
    discardedAt: now,
    discardedBy: options.operator,
    discardReason: options.reason
  };

  const historyLog = {
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    productId: product.id,
    productName: product.name,
    category: product.category,
    action: 'DISCARD',
    quantityBefore: product.quantity,
    quantityDelta: roundQuantity(-actualAmountDiscarded),
    quantityAfter: updatedProduct.quantity,
    unit: product.unit,
    operatorAlias: options.operator,
    operatorUid: options.operatorUid,
    timestamp: now,
    reason: options.reason,
    notes: options.notes
  };

  return { updatedProduct, historyLog, isFullyDiscarded, actualAmountDiscarded };
}

// ----------------- TEST SUITE EXECUTION -----------------
console.log('--- STARTING DOMAIN LOGIC VERIFICATION TESTS ---');

// Test 1: parseLocalDate & calendar validity
assert.strictEqual(parseLocalDate('2026-10-25')?.toISOString().slice(0, 4), '2026');
assert.strictEqual(parseLocalDate('2024-02-29') !== null, true, 'Leap day 2024-02-29 should be valid');
assert.strictEqual(parseLocalDate('2026-02-29'), null, 'Non-leap Feb 29 must return null');
assert.strictEqual(parseLocalDate('2026-04-31'), null, 'April 31 must return null');
assert.strictEqual(parseLocalDate('invalid'), null);
console.log('✓ Test 1: parseLocalDate calendar validation passed');

// Test 2: calculateDayDiff
const refDate = '2026-10-25';
assert.strictEqual(calculateDayDiff('2026-10-25', refDate), 0);
assert.strictEqual(calculateDayDiff('2026-10-26', refDate), 1);
assert.strictEqual(calculateDayDiff('2026-10-24', refDate), -1);
assert.strictEqual(calculateDayDiff('2026-10-28', refDate), 3);
assert.strictEqual(calculateDayDiff('2026-11-01', refDate), 7);
assert.strictEqual(calculateDayDiff('2026-11-02', refDate), 8);
console.log('✓ Test 2: calculateDayDiff passed');

// Test 3: calculateExpiryStatus
assert.strictEqual(calculateExpiryStatus('2026-10-20', refDate).key, 'expired');
assert.strictEqual(calculateExpiryStatus('2026-10-24', refDate).label, 'Vencido ayer');
assert.strictEqual(calculateExpiryStatus('2026-10-25', refDate).key, 'soon');
assert.strictEqual(calculateExpiryStatus('2026-10-25', refDate).label, 'Vence hoy');
assert.strictEqual(calculateExpiryStatus('2026-10-26', refDate).label, 'Vence mañana');
assert.strictEqual(calculateExpiryStatus('2026-10-28', refDate).key, 'soon');
assert.strictEqual(calculateExpiryStatus('2026-10-29', refDate).key, 'week');
assert.strictEqual(calculateExpiryStatus('2026-11-01', refDate).key, 'week');
assert.strictEqual(calculateExpiryStatus('2026-11-02', refDate).key, 'ok');
console.log('✓ Test 3: calculateExpiryStatus status boundaries passed');

// Test 4: Quick Expiry Presets & Leap Year / Month Clamping
assert.strictEqual(addDaysSafe('2026-10-25', 2), '2026-10-27');
assert.strictEqual(addDaysSafe('2026-10-25', 3), '2026-10-28');
assert.strictEqual(addWeeksSafe('2026-10-25', 1), '2026-11-01');

// Month overflow clamping (Edge Case 1 & 2):
// Jan 31 in normal year 2026 + 1 month -> Feb 28, 2026
assert.strictEqual(addMonthsSafe('2026-01-31', 1), '2026-02-28', 'Jan 31 + 1m must clamp to Feb 28 in non-leap year');
// Jan 31 in leap year 2024 + 1 month -> Feb 29, 2024
assert.strictEqual(addMonthsSafe('2024-01-31', 1), '2024-02-29', 'Jan 31 + 1m must clamp to Feb 29 in leap year');
// Aug 31 + 1 month -> Sep 30
assert.strictEqual(addMonthsSafe('2026-08-31', 1), '2026-09-30', 'Aug 31 + 1m must clamp to Sep 30');
// Dec 31, 2026 + 2 months -> Feb 28, 2027
assert.strictEqual(addMonthsSafe('2026-12-31', 2), '2027-02-28', 'Dec 31 + 2m must wrap year and clamp to Feb 28');
console.log('✓ Test 4: Quick expiry presets and month overflow clamping passed');

// Test 5: Metrics Calculation & Disjoint Partitioning
const mockProducts = [
  { id: '1', name: 'Leche', quantity: 5, expiryDate: '2026-10-20', isDiscarded: false, isConsumed: false }, // expired
  { id: '2', name: 'Yogur', quantity: 2, expiryDate: '2026-10-25', isDiscarded: false, isConsumed: false }, // soon (today)
  { id: '3', name: 'Queso', quantity: 1, expiryDate: '2026-10-28', isDiscarded: false, isConsumed: false }, // soon (3d)
  { id: '4', name: 'Pollo', quantity: 4, expiryDate: '2026-10-31', isDiscarded: false, isConsumed: false }, // week (6d)
  { id: '5', name: 'Arroz', quantity: 10, expiryDate: '2026-12-01', isDiscarded: false, isConsumed: false }, // ok (>7d)
  { id: '6', name: 'Merma', quantity: 0, expiryDate: '2026-10-20', isDiscarded: true, isConsumed: false },  // discarded
  { id: '7', name: 'Vacio', quantity: 0, expiryDate: '2026-10-20', isDiscarded: false, isConsumed: true }   // consumed
];
const metrics = calculateMetrics(mockProducts, refDate);
assert.strictEqual(metrics.total, 5, 'Total active products must be 5');
assert.strictEqual(metrics.expired, 1);
assert.strictEqual(metrics.soon, 2);
assert.strictEqual(metrics.week, 1);
assert.strictEqual(metrics.ok, 1);
assert.strictEqual(metrics.total, metrics.expired + metrics.soon + metrics.week + metrics.ok, 'Disjoint partition invariant must hold');
assert.strictEqual(metrics.within7Days, 3);
assert.strictEqual(metrics.criticalTotal, 3);
assert.strictEqual(metrics.discardedCount, 1);
assert.strictEqual(metrics.consumedCount, 1);
console.log('✓ Test 5: calculateMetrics disjoint partitioning passed');

// Test 6: Stock Consumption & Precision Float Math
const prod1 = {
  id: 'p1',
  name: 'Harina 000',
  category: 'Abarrotes y secos',
  quantity: 1.0,
  unit: 'kg',
  isDiscarded: false,
  isConsumed: false
};
// 1.0 - 0.2 must yield exact 0.8 without floating point noise
const consume1 = consumeProductStock(prod1, { amount: 0.2, operator: 'Marta - Bodega' });
assert.strictEqual(consume1.updatedProduct.quantity, 0.8);
assert.strictEqual(consume1.isFullyExhausted, false);
assert.strictEqual(consume1.updatedProduct.lastAction, 'CONSUME_PARTIAL');
assert.strictEqual(consume1.historyLog.quantityDelta, -0.2);

// Consuming remaining 0.8 -> full exhaustion
const consume2 = consumeProductStock(consume1.updatedProduct, { amount: 0.8, operator: 'Juan - Cocinero' });
assert.strictEqual(consume2.updatedProduct.quantity, 0);
assert.strictEqual(consume2.isFullyExhausted, true);
assert.strictEqual(consume2.updatedProduct.isConsumed, true);
assert.strictEqual(consume2.updatedProduct.lastAction, 'CONSUME_FULL');
assert.strictEqual(consume2.historyLog.quantityDelta, -0.8);
console.log('✓ Test 6: Stock consumption and float precision passed');

// Test 7: Discard Stock / Merma & HACCP Audit
const prod2 = {
  id: 'p2',
  name: 'Camarones',
  category: 'Pescados y mariscos',
  quantity: 3.5,
  unit: 'kg',
  isDiscarded: false,
  isConsumed: false
};
const discardRes = discardProductStock(prod2, {
  amount: 3.5,
  reason: 'contaminacion',
  operator: 'Carlos - Chef',
  notes: 'Pérdida de cadena de frío'
});
assert.strictEqual(discardRes.isFullyDiscarded, true);
assert.strictEqual(discardRes.updatedProduct.isDiscarded, true);
assert.strictEqual(discardRes.updatedProduct.quantity, 0);
assert.strictEqual(discardRes.historyLog.action, 'DISCARD');
assert.strictEqual(discardRes.historyLog.reason, 'contaminacion');
assert.strictEqual(discardRes.historyLog.quantityDelta, -3.5);
console.log('✓ Test 7: Discard stock / merma passed');

console.log('--- ALL 7 DOMAIN LOGIC VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
