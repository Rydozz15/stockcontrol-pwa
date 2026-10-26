/**
 * StockControl PWA — Tier 5 White-Box Adversarial Stress Test Suite
 * Author: challenger_m5_2 (Empirical Challenger)
 * Scope: Data Contingency, Domain Math, UI Ergonomics (>=44x44px, >=8px spacing) & Tablet Split-View
 * Execution: node tests/adversarial/adversarial_tier5_challenger2_stress.js
 */

import path from 'node:path';
import fs from 'node:fs';
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

function assertThrows(fn, message) {
  totalTests++;
  try {
    fn();
    failedTests++;
    const errMsg = `${message} — Expected exception but none was thrown`;
    failures.push(errMsg);
    console.error(`  ✗ FAIL: ${errMsg}`);
  } catch (err) {
    passedTests++;
    console.log(`  ✓ ${message} (Threw: ${err.message || err})`);
  }
}

async function runAdversarialHardening() {
  console.log('================================================================');
  console.log('⚔️  TIER 5 WHITE-BOX ADVERSARIAL COVERAGE HARDENING HARNESS  ⚔️');
  console.log('Agent: challenger_m5_2');
  console.log('Node.js version:', process.version);
  console.log('Working Directory:', PROJECT_ROOT);
  console.log('================================================================\n');

  // Launch Vite SSR server for perfect TypeScript & Svelte path alias resolution
  const vite = await createServer({
    root: PROJECT_ROOT,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  const contingency = await vite.ssrLoadModule('/src/lib/repositories/contingencyService.ts');
  const expiry = await vite.ssrLoadModule('/src/lib/domain/expiry.ts');
  const models = await vite.ssrLoadModule('/src/lib/domain/models.ts');
  const waste = await vite.ssrLoadModule('/src/lib/domain/waste.ts');
  const inventoryStoreModule = await vite.ssrLoadModule('/src/lib/stores/inventoryStore.ts');
  const metricsStoreModule = await vite.ssrLoadModule('/src/lib/stores/metricsStore.ts');
  const bottomNavModule = await vite.ssrLoadModule('/src/lib/components/BottomNav.svelte');

  console.log('  ✓ Loaded all domain, repository, store, and component modules via Vite SSR\n');

  // ==========================================================================
  // SECTION 1: DATA CONTINGENCY SERVICES (RFC 4180 CSV, BOM, SEMICOLON, JSON v2/v1)
  // ==========================================================================
  console.log('--- SECTION 1: Data Contingency Services Adversarial Fuzzing ---');

  // 1.1 UTF-8 BOM and RFC 4180 Invariants
  const sampleProducts = [
    {
      id: 'p1',
      name: 'Queso Gouda',
      category: 'Lácteos',
      quantity: 5,
      unit: 'kg',
      receivedDate: '2026-10-20',
      expiryDate: '2026-10-29',
      location: 'Refrigerador',
      lot: 'LOT-9988',
      supplier: 'Distribuidora Láctea S.A.',
      notes: 'Mantener a 4°C; sin abrir'
    },
    {
      id: 'p2',
      name: 'Salmón del Pacífico "Fresco"',
      category: 'Pescados y mariscos',
      quantity: 3.5,
      unit: 'kg',
      receivedDate: '2026-10-24',
      expiryDate: '2026-10-26',
      location: 'Refrigerador',
      lot: 'LOT-SAL-01',
      supplier: 'Mar Austral',
      notes: 'Llegó en hielo picado\nLote verificado\r\nTemperatura: 1.2°C'
    }
  ];

  const exportedCsv = contingency.exportProductsToCsv(sampleProducts);
  assert(exportedCsv.startsWith('\uFEFF'), 'CSV export starts with UTF-8 BOM (\\uFEFF)');
  assert(exportedCsv.charCodeAt(0) === 0xFEFF, 'First character code is exactly 0xFEFF');
  assert(exportedCsv.includes(';'), 'CSV export uses semicolon (;) as field delimiter for Excel locale safety');
  assert(exportedCsv.includes('"Salmón del Pacífico ""Fresco"""'), 'Embedded quotes are properly escaped with double quotes ("")');
  assert(exportedCsv.includes('Llegó en hielo picado\nLote verificado\r\nTemperatura: 1.2°C'), 'Multiline notes with CRLF are preserved intact inside quotes');

  // 1.2 Roundtrip parsing of complex CSV
  const parsedProducts = contingency.parseCsv(exportedCsv);
  assertEquals(parsedProducts.length, 2, 'CSV roundtrip parses exactly 2 products');
  assertEquals(parsedProducts[0].name, 'Queso Gouda', 'First product name matches');
  assertEquals(parsedProducts[0].quantity, 5, 'First product quantity parsed as number 5');
  assertEquals(parsedProducts[1].name, 'Salmón del Pacífico "Fresco"', 'Second product unescapes double quotes cleanly');
  assert(parsedProducts[1].notes.includes('Temperatura: 1.2°C'), 'Multiline note content preserved across roundtrip');

  // 1.3 Formula and Hostile Injection in CSV Cell Escaping
  const hostileCellTests = [
    '=1+1',
    '@SUM(A1:A10)',
    '+cmd|"/C calc"!A0',
    '-2+5',
    '<script>alert("xss")</script>',
    'Text with "quotes" and ; semicolons\r\nand newlines',
    null,
    undefined
  ];
  for (const hostile of hostileCellTests) {
    const escaped = contingency.escapeCsvCell(hostile);
    assert(escaped.startsWith('"') && escaped.endsWith('"'), `Cell escaped and quote-wrapped: "${String(hostile).slice(0, 15)}"`);
    if (typeof hostile === 'string' && hostile.includes('"')) {
      assert(escaped.includes('""'), 'Internal quotes are doubled');
    }
  }

  // 1.4 Delimiter Auto-detection: Comma vs Semicolon
  const commaCsv = 'Producto,Categoría,Cantidad,Unidad,Vencimiento\n"Tomate Roma","Frutas y verduras",10,"kg","2026-11-01"';
  const parsedComma = contingency.parseCsv(commaCsv);
  assertEquals(parsedComma.length, 1, 'Auto-detects comma delimiter when semicolon is absent');
  assertEquals(parsedComma[0].name, 'Tomate Roma', 'Comma CSV product name matches');
  assertEquals(parsedComma[0].quantity, 10, 'Comma CSV quantity matches');

  // 1.5 Corrupt, Truncated & Adversarial CSV Inputs
  const corruptedCsvCases = [
    { name: 'Unterminated quote', csv: '"Producto";"Cantidad"\n"Queso sin cerrar;10', expectCount: 1 },
    { name: 'Empty string', csv: '', expectCount: 0 },
    { name: 'Whitespace only', csv: '   \r\n  \t  \n', expectCount: 0 },
    { name: 'Headers only without data rows', csv: 'Producto;Categoría;Cantidad;Unidad\r\n', expectCount: 0 },
    { name: 'Malformed quantity', csv: 'Producto;Categoría;Cantidad;Unidad;Vencimiento\nArroz;Abarrotes y secos;NO_ES_NUMERO;kg;2026-11-01', expectCount: 1, expectedQty: 0 },
    { name: 'Negative quantity in CSV', csv: 'Producto;Categoría;Cantidad;Unidad;Vencimiento\nCarne;Carnes;-15.5;kg;2026-11-01', expectCount: 1, expectedQty: 0 }
  ];

  for (const c of corruptedCsvCases) {
    const res = contingency.parseCsv(c.csv);
    assertEquals(res.length, c.expectCount, `Corrupted CSV test [${c.name}] returned ${c.expectCount} items`);
    if (c.expectedQty !== undefined && res.length > 0) {
      assertEquals(res[0].quantity, c.expectedQty, `Corrupted CSV test [${c.name}] sanitized quantity to ${c.expectedQty}`);
    }
  }

  // 1.6 Waste CSV Export Invariants (HACCP)
  const mockHistoryLogs = [
    {
      id: 'h1',
      productId: 'p1',
      productName: 'Leche Entera',
      category: 'Lácteos',
      action: 'DISCARD',
      quantityBefore: 4,
      quantityDelta: -4,
      quantityAfter: 0,
      unit: 'L',
      operatorAlias: 'Carlos - Bodega',
      timestamp: '2026-10-25T15:30:00Z',
      reason: 'vencimiento',
      notes: 'Superó fecha límite'
    },
    {
      id: 'h2',
      productId: 'p2',
      productName: 'Pechuga de Pollo',
      category: 'Carnes',
      action: 'CONSUME_PARTIAL',
      quantityBefore: 10,
      quantityDelta: -2,
      quantityAfter: 8,
      unit: 'kg',
      operatorAlias: 'Marta - Cocina',
      timestamp: '2026-10-25T16:00:00Z',
      reason: 'Cocina del mediodía'
    },
    {
      id: 'h3',
      productId: 'p3',
      productName: 'Yogurt Griego',
      category: 'Lácteos',
      action: 'discard', // lowercase variation
      quantityBefore: 2,
      quantityDelta: -2,
      quantityAfter: 0,
      unit: 'kg',
      operatorAlias: 'Pedro - Ayudante',
      timestamp: '2026-10-25T17:00:00Z',
      reason: 'rotura',
      notes: 'Envase perforado'
    }
  ];

  const wasteCsv = contingency.exportWasteToCsv(mockHistoryLogs);
  assert(wasteCsv.startsWith('\uFEFF'), 'Waste CSV starts with UTF-8 BOM');
  assert(wasteCsv.includes('Leche Entera'), 'Waste CSV includes DISCARD log');
  assert(wasteCsv.includes('Yogurt Griego'), 'Waste CSV includes lowercase "discard" action');
  assert(!wasteCsv.includes('Pechuga de Pollo'), 'Waste CSV strictly excludes CONSUME actions');
  assert(wasteCsv.includes('"4"'), 'Negative quantityDelta (-4) is converted to positive discarded amount (4)');

  // 1.7 JSON v2 Export & Validation
  const jsonV2String = contingency.exportJsonV2(sampleProducts, 'cocina-central', mockHistoryLogs);
  assert(typeof jsonV2String === 'string', 'exportJsonV2 returns string');
  const parsedJsonV2 = JSON.parse(jsonV2String);
  assertEquals(parsedJsonV2.app, 'StockControl PWA', 'JSON v2 app header is canonical');
  assertEquals(parsedJsonV2.version, 2, 'JSON version is 2');
  assertEquals(parsedJsonV2.workspaceId, 'cocina-central', 'workspaceId matches export argument');
  assertEquals(parsedJsonV2.products.length, 2, 'JSON products array contains 2 items');
  assertEquals(parsedJsonV2.auditLog.length, 3, 'JSON auditLog array preserved');
  assert(!isNaN(new Date(parsedJsonV2.exportedAt).getTime()), 'exportedAt is valid ISO timestamp');

  // 1.8 Legacy JSON v1 Import Normalization
  const legacyV1Payload = {
    app: 'StockControl Vencimientos',
    version: 1,
    workspace: 'cocina-antigua',
    products: [
      {
        id: 'legacy-1',
        name: 'Harina 000',
        category: 'Abarrotes y secos',
        quantity: '12.5', // string quantity
        unit: 'kg',
        received: '2026-09-01', // legacy date key
        expiry: '2026-12-01',   // legacy date key
        location: 'Bodega seca',
        notes: 'Saco sellado'
      },
      {
        name: 'Aceite de Oliva', // missing id
        category: 'Abarrotes y secos',
        quantity: -5, // negative quantity
        unit: 'L',
        received: '2026-09-10',
        expiry: '2027-01-10'
      }
    ]
  };

  const normalizedImport = contingency.importJson(legacyV1Payload);
  assertEquals(normalizedImport.version, 1, 'Detects legacy version 1');
  assertEquals(normalizedImport.workspaceId, 'cocina-antigua', 'Preserves legacy workspace key');
  assertEquals(normalizedImport.products.length, 2, 'Imports both legacy products');
  assertEquals(normalizedImport.products[0].receivedDate, '2026-09-01', 'Maps legacy received -> receivedDate');
  assertEquals(normalizedImport.products[0].expiryDate, '2026-12-01', 'Maps legacy expiry -> expiryDate');
  assertEquals(normalizedImport.products[0].quantity, 12.5, 'Normalizes string quantity to float');
  assertEquals(normalizedImport.products[0].createdBy, 'Legacy Import', 'Assigns legacy createdBy stamp');
  assert(Boolean(normalizedImport.products[1].id), 'Generates unique ID for product with missing id');
  assertEquals(normalizedImport.products[1].quantity, 0, 'Normalizes negative quantity to 0');

  // 1.9 Malformed JSON Rejections
  assertThrows(() => contingency.importJson('not-json'), 'Rejects non-JSON string');
  assertThrows(() => contingency.importJson(null), 'Rejects null JSON');
  assertThrows(() => contingency.importJson(42), 'Rejects numeric JSON primitive');
  assertThrows(() => contingency.importJson({ foo: 'bar' }), 'Rejects object missing "products" array');

  // 1.10 Validation: validateImportItems
  const itemsToValidate = [
    { id: '1', name: 'Valid Product', quantity: 10, expiryDate: '2026-11-01' },
    { id: '2', name: '', quantity: 5, expiryDate: '2026-11-01' }, // missing name
    { id: '3', name: 'Negative Qty', quantity: -2, expiryDate: '2026-11-01' }, // invalid qty
    { id: '4', name: 'Bad Date', quantity: 1, expiryDate: '01-11-2026' } // bad date format
  ];
  const valResult = contingency.validateImportItems(itemsToValidate);
  assertEquals(valResult.summary.total, 4, 'Validation summary total is 4');
  assertEquals(valResult.summary.validCount, 1, 'Valid count is 1');
  assertEquals(valResult.summary.invalidCount, 3, 'Invalid count is 3');
  assertEquals(valResult.invalid[0].row, 3, 'Invalid row number is 3 (1-indexed + header)');

  // 1.11 Conflict Resolution Strategies Matrix
  const existingStock = [
    { id: 'ex-1', name: 'Tomate', quantity: 8, expiryDate: '2026-10-28', barcode: '7791234567890' },
    { id: 'ex-2', name: 'Cebolla', quantity: 5, expiryDate: '2026-10-30' }
  ];
  const incomingItems = [
    { id: 'inc-1', name: 'Tomate', quantity: 4, expiryDate: '2026-11-05', barcode: '7791234567890' }, // match by barcode & name
    { id: 'inc-2', name: '  cebolla  ', quantity: 3, expiryDate: '2026-11-02' }, // match by trimmed lowercase name
    { id: 'inc-3', name: 'Zanahoria', quantity: 6, expiryDate: '2026-11-10' } // new product
  ];

  // Strategy A: 'merge'
  const mergeResult = contingency.resolveImportConflicts(incomingItems, existingStock, 'merge');
  assertEquals(mergeResult.toInsert.length, 1, 'Merge inserts 1 new item');
  assertEquals(mergeResult.toUpdate.length, 2, 'Merge updates 2 existing items');
  assertEquals(mergeResult.toUpdate[0].updates.quantity, 12, 'Merge sums Tomate quantity 8 + 4 = 12');
  assertEquals(mergeResult.toUpdate[1].updates.quantity, 8, 'Merge sums Cebolla quantity 5 + 3 = 8');
  assertEquals(mergeResult.skippedCount, 0, 'Merge skipped count is 0');

  // Strategy B: 'replace'
  const replaceResult = contingency.resolveImportConflicts(incomingItems, existingStock, 'replace');
  assertEquals(replaceResult.toInsert.length, 1, 'Replace inserts 1 new item');
  assertEquals(replaceResult.toUpdate.length, 2, 'Replace updates 2 existing items');
  assertEquals(replaceResult.toUpdate[0].updates.quantity, 4, 'Replace overwrites quantity with incoming 4');
  assertEquals(replaceResult.toUpdate[0].updates.expiryDate, '2026-11-05', 'Replace overwrites expiryDate');

  // Strategy C: 'skip'
  const skipResult = contingency.resolveImportConflicts(incomingItems, existingStock, 'skip');
  assertEquals(skipResult.toInsert.length, 1, 'Skip inserts 1 new item');
  assertEquals(skipResult.toUpdate.length, 0, 'Skip does not update any items');
  assertEquals(skipResult.skippedCount, 2, 'Skip marks 2 duplicates as skipped');

  // Strategy D: 'append'
  const appendResult = contingency.resolveImportConflicts(incomingItems, existingStock, 'append');
  assertEquals(appendResult.toInsert.length, 3, 'Append inserts all 3 items as separate records');
  assertEquals(appendResult.toUpdate.length, 0, 'Append updates 0 items');
  assertEquals(appendResult.skippedCount, 0, 'Append skips 0 items');

  console.log('\n--- SECTION 2: Domain Math, Expiry Rules & Partitioning Invariants ---');

  // 2.1 Strict Calendar Validation in parseLocalDate
  const strictDateTests = [
    { input: '2024-02-29', valid: true, desc: 'Leap year Feb 29 (2024)' },
    { input: '2020-02-29', valid: true, desc: 'Leap year Feb 29 (2020)' },
    { input: '2000-02-29', valid: true, desc: 'Centennial leap year Feb 29 (2000 divisible by 400)' },
    { input: '2025-02-29', valid: false, desc: 'Non-leap year Feb 29 (2025)' },
    { input: '2026-02-29', valid: false, desc: 'Non-leap year Feb 29 (2026)' },
    { input: '2100-02-29', valid: false, desc: 'Centennial non-leap year Feb 29 (2100 not divisible by 400)' },
    { input: '2026-04-31', valid: false, desc: 'April 31 does not exist (30 days)' },
    { input: '2026-06-31', valid: false, desc: 'June 31 does not exist' },
    { input: '2026-09-31', valid: false, desc: 'September 31 does not exist' },
    { input: '2026-11-31', valid: false, desc: 'November 31 does not exist' },
    { input: '2026-02-30', valid: false, desc: 'Feb 30 does not exist' },
    { input: '2026-13-01', valid: false, desc: 'Month 13 does not exist' },
    { input: '2026-00-10', valid: false, desc: 'Month 0 does not exist' },
    { input: '2026-01-00', valid: false, desc: 'Day 0 does not exist' },
    { input: '2026-01-32', valid: false, desc: 'Day 32 does not exist' }
  ];

  for (const s of strictDateTests) {
    const res = expiry.parseLocalDate(s.input);
    if (s.valid) {
      assert(res !== null && res.getFullYear() > 0, `parseLocalDate accepts ${s.desc}`);
    } else {
      assert(res === null, `parseLocalDate strictly rejects ${s.desc}`);
    }
  }

  // 2.2 Date Difference & Daylight Saving Time (DST) Invariant
  // Reference date: 2026-10-25
  const refDate = '2026-10-25';
  assertEquals(expiry.calculateDayDiff('2026-10-24', refDate), -1, 'calculateDayDiff: yesterday = -1');
  assertEquals(expiry.calculateDayDiff('2026-10-25', refDate), 0, 'calculateDayDiff: today = 0');
  assertEquals(expiry.calculateDayDiff('2026-10-26', refDate), 1, 'calculateDayDiff: tomorrow = 1');
  assertEquals(expiry.calculateDayDiff('2026-10-28', refDate), 3, 'calculateDayDiff: 3 days = 3');
  assertEquals(expiry.calculateDayDiff('2026-10-29', refDate), 4, 'calculateDayDiff: 4 days = 4');
  assertEquals(expiry.calculateDayDiff('2026-11-01', refDate), 7, 'calculateDayDiff: 7 days = 7');
  assertEquals(expiry.calculateDayDiff('2026-11-02', refDate), 8, 'calculateDayDiff: 8 days = 8');
  assertEquals(expiry.calculateDayDiff('invalid-date', refDate), 99999, 'calculateDayDiff: invalid date returns 99999');

  // 2.3 Expiry Status Boundary Invariants
  const sNeg = expiry.calculateExpiryStatus('2026-10-24', refDate);
  assertEquals(sNeg.key, 'expired', 'Diff -1 -> key: expired');
  assertEquals(sNeg.cls, 'expired', 'Diff -1 -> cls: expired');

  const s0 = expiry.calculateExpiryStatus('2026-10-25', refDate);
  assertEquals(s0.key, 'soon', 'Diff 0 -> key: soon (Vence hoy)');
  assertEquals(s0.label, 'Vence hoy', 'Diff 0 -> label: Vence hoy');

  const s3 = expiry.calculateExpiryStatus('2026-10-28', refDate);
  assertEquals(s3.key, 'soon', 'Diff 3 -> key: soon');

  const s4 = expiry.calculateExpiryStatus('2026-10-29', refDate);
  assertEquals(s4.key, 'week', 'Diff 4 -> key: week');

  const s7 = expiry.calculateExpiryStatus('2026-11-01', refDate);
  assertEquals(s7.key, 'week', 'Diff 7 -> key: week');

  const s8 = expiry.calculateExpiryStatus('2026-11-02', refDate);
  assertEquals(s8.key, 'ok', 'Diff 8 -> key: ok (Vigente)');
  assertEquals(s8.cls, 'ok', 'Diff 8 -> cls: ok');

  // 2.4 Quick Expiry Presets Clamping (Month-end & Leap day)
  assertEquals(expiry.presetPlus2Days('2024-02-27'), '2024-02-29', '2024-02-27 +2d lands on leap day');
  assertEquals(expiry.presetPlus2Days('2026-02-27'), '2026-03-01', '2026-02-27 +2d rolls to March 1 (non-leap)');
  assertEquals(expiry.addMonthsSafe('2026-01-31', 1), '2026-02-28', 'Jan 31 +1m in non-leap year clamps to Feb 28');
  assertEquals(expiry.addMonthsSafe('2024-01-31', 1), '2024-02-29', 'Jan 31 +1m in leap year clamps to Feb 29');
  assertEquals(expiry.addMonthsSafe('2026-03-31', 1), '2026-04-30', 'Mar 31 +1m clamps to Apr 30');
  assertEquals(expiry.addMonthsSafe('2026-05-31', 1), '2026-06-30', 'May 31 +1m clamps to Jun 30');
  assertEquals(expiry.addMonthsSafe('2026-08-31', 1), '2026-09-30', 'Aug 31 +1m clamps to Sep 30');
  assertEquals(expiry.addMonthsSafe('2026-10-31', 1), '2026-11-30', 'Oct 31 +1m clamps to Nov 30');
  assertEquals(expiry.addMonthsSafe('2026-12-31', 1), '2027-01-31', 'Dec 31 +1m rolls to next year Jan 31');

  // 2.5 Metrics Disjoint Partitioning Proof on 5,000 Generated Products
  console.log('  Generating 5,000 varied inventory items to prove disjoint partition invariant...');
  const partitionProducts = [];
  for (let i = 0; i < 5000; i++) {
    // Generate dates from -10 days to +30 days relative to 2026-10-25
    const offset = (i % 41) - 10;
    const targetDate = expiry.addDaysSafe(refDate, offset);
    const isDiscarded = i % 10 === 0; // 500 discarded
    const isConsumed = i % 10 === 1;  // 500 consumed
    const quantity = isConsumed ? 0 : (i % 10) + 0.5;

    partitionProducts.push({
      id: `part-${i}`,
      name: `Producto ${i}`,
      category: 'Carnes',
      quantity,
      unit: 'kg',
      receivedDate: '2026-10-20',
      expiryDate: targetDate,
      location: 'Refrigerador',
      isDiscarded,
      isConsumed
    });
  }

  const computedMetrics = expiry.calculateMetrics(partitionProducts, refDate);
  assertEquals(
    computedMetrics.total,
    computedMetrics.expired + computedMetrics.soon + computedMetrics.week + computedMetrics.ok,
    'Disjoint Invariant: Total === Expired + Soon + Week + Ok strictly holds across 5,000 items'
  );
  assertEquals(
    computedMetrics.within7Days,
    computedMetrics.soon + computedMetrics.week,
    'within7Days === Soon + Week holds'
  );
  assertEquals(
    computedMetrics.criticalTotal,
    computedMetrics.expired + computedMetrics.soon,
    'criticalTotal === Expired + Soon holds'
  );
  assertEquals(computedMetrics.discardedCount, 500, 'discardedCount strictly tracked');
  assertEquals(computedMetrics.consumedCount, 500, 'consumedCount strictly tracked');

  // 2.6 Float Precision & IEEE 754 Sanitization
  assertEquals(models.normalizeQuantity(0.1 + 0.2), 0.3, 'normalizeQuantity eliminates 0.30000000000000004 drift');
  assertEquals(models.normalizeQuantity(-10), 0, 'normalizeQuantity clamps negative values to 0');
  assertEquals(models.normalizeQuantity(NaN), 0, 'normalizeQuantity converts NaN to 0');
  assertEquals(models.normalizeQuantity(Infinity), 0, 'normalizeQuantity converts Infinity to 0');
  assertEquals(models.normalizeQuantity('4.5678'), 4.568, 'normalizeQuantity preserves 3 decimals');

  console.log('\n--- SECTION 3: WCAG 2.5.5 Touch Targets (>= 44x44px) & Spacing (>= 8px) Audit ---');

  // 3.1 CSS Verification across all UI Components
  const componentPaths = [
    'src/routes/+layout.svelte',
    'src/routes/+page.svelte',
    'src/lib/components/BottomNav.svelte',
    'src/lib/components/ProductCard.svelte',
    'src/lib/components/ProductForm.svelte',
    'src/lib/components/MetricsDashboard.svelte',
    'src/lib/components/WorkspaceModal.svelte',
    'src/lib/components/ExportImportModal.svelte',
    'src/lib/components/CameraScanner.svelte'
  ];

  for (const relPath of componentPaths) {
    const fullPath = path.resolve(PROJECT_ROOT, relPath);
    assert(fs.existsSync(fullPath), `Component file exists: ${relPath}`);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Check touch target variables or explicit min dimensions
    const hasTouchMin = content.includes('44px') || content.includes('--touch-min') || content.includes('48px') || content.includes('56px');
    assert(hasTouchMin, `${relPath} enforces touch target minimum dimension (>=44px)`);
  }

  // 3.2 Specific Ergonomic Assertions
  const pageCss = fs.readFileSync(path.resolve(PROJECT_ROOT, 'src/routes/+page.svelte'), 'utf-8');
  assert(pageCss.includes('.fab {') && pageCss.includes('width: 56px') && pageCss.includes('height: 56px'), '+page.svelte FAB is 56x56px (satisfies >= 44x44px)');
  assert(pageCss.includes('gap: 8px') || pageCss.includes('gap: 10px') || pageCss.includes('gap: 12px'), '+page.svelte enforces >= 8px inter-element touch spacing');

  const bottomNavCss = fs.readFileSync(path.resolve(PROJECT_ROOT, 'src/lib/components/BottomNav.svelte'), 'utf-8');
  assert(bottomNavCss.includes('min-width: 44px') && bottomNavCss.includes('min-height: 44px'), 'BottomNav .nav-tab-btn satisfies >= 44x44px');
  assert(bottomNavCss.includes('safe-area-inset-bottom'), 'BottomNav integrates safe-area-inset-bottom');

  const cardCss = fs.readFileSync(path.resolve(PROJECT_ROOT, 'src/lib/components/ProductCard.svelte'), 'utf-8');
  assert(cardCss.includes('min-height: 44px'), 'ProductCard action buttons satisfy min-height: 44px');
  assert(cardCss.includes('gap: 10px'), 'ProductCard .card-actions uses 10px gap (>= 8px spacing)');

  const formCss = fs.readFileSync(path.resolve(PROJECT_ROOT, 'src/lib/components/ProductForm.svelte'), 'utf-8');
  assert(formCss.includes('min-height: 48px') || formCss.includes('min-height: 52px'), 'ProductForm inputs and preset buttons satisfy >= 48px/52px height');
  assert(formCss.includes('.stepper-btn {') && formCss.includes('min-width: 48px') && formCss.includes('min-height: 48px'), 'ProductForm stepper buttons satisfy 48x48px');

  const exportModalCss = fs.readFileSync(path.resolve(PROJECT_ROOT, 'src/lib/components/ExportImportModal.svelte'), 'utf-8');
  assert(exportModalCss.includes('min-height: 48px'), 'ExportImportModal buttons satisfy min-height: 48px');
  assert(exportModalCss.includes('min-width: 44px') || exportModalCss.includes('min-width: 130px'), 'ExportImportModal touch targets satisfy min-width');

  console.log('\n--- SECTION 4: Tablet Split-View Layout & Responsive Contracts ---');

  // 4.1 Breakpoint 768px Verification
  assert(pageCss.includes('@media (min-width: 768px)'), '+page.svelte specifies @media (min-width: 768px) breakpoint');
  assert(pageCss.includes('grid-template-columns: minmax(360px, 42%) 1fr'), '+page.svelte configures two-column split master-detail layout');
  assert(pageCss.includes('.detail-pane {') && pageCss.includes('display: none;'), 'Detail pane is hidden on mobile screens');
  assert(pageCss.includes('position: sticky') && pageCss.includes('top: 16px'), 'Detail pane uses persistent sticky positioning on tablet');

  // 4.2 Modal Suppression on Tablet
  assert(pageCss.includes('if (!isTablet) {') && pageCss.includes('isMobileDetailOpen = true;'), 'Selecting product opens mobile modal sheet ONLY when NOT on tablet');
  assert(pageCss.includes('if (isTablet && !wasTablet && isMobileDetailOpen)'), 'Resizing window from mobile to tablet smoothly suppresses mobile modal drawer');

  // 4.3 Safe Area Viewport Contract
  const appHtml = fs.readFileSync(path.resolve(PROJECT_ROOT, 'src/app.html'), 'utf-8');
  assert(appHtml.includes('viewport-fit=cover'), 'src/app.html contains viewport-fit=cover in viewport meta tag');

  console.log('\n================================================================');
  console.log('              ADVERSARIAL STRESS TEST RESULTS                   ');
  console.log('================================================================');
  console.log(`Total Assertions Run : ${totalTests}`);
  console.log(`Passed Assertions    : ${passedTests}`);
  console.log(`Failed Assertions    : ${failedTests}`);

  if (failedTests > 0) {
    console.error('\nFailures Summary:');
    failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
    process.exit(1);
  }
  console.log('\n>>> VERDICT: APPROVE — 100% OF ADVERSARIAL STRESS CHECKS PASSED CLEANLY.');
  await vite.close();
}

runAdversarialHardening().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
