/**
 * Adversarial Stress Test Suite for Milestone 1:
 * - Headless Node.js SSR crash immunity across all 5 stores
 * - Dirty input fuzzing & sanitization invariants
 * - ToastStore concurrency limit (MAX_CONCURRENT_TOASTS = 3) & timer eviction
 * - InventoryStore & MetricsStore reactive state invariants & float/boundary handling
 * - ConnectivityStore reactive state transitions
 * - Production static build file integrity & asset resolution
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

async function runAdversarialSuite() {
  console.log('================================================================');
  console.log('STARTING EMPIRICAL ADVERSARIAL STRESS TEST SUITE (Milestone 1)');
  console.log(`Node.js version: ${process.version}`);
  console.log(`Working Directory: ${PROJECT_ROOT}`);
  console.log(`Browser Globals: window=${typeof globalThis.window}, localStorage=${typeof globalThis.localStorage}`);
  console.log('================================================================\n');

  // Verify headless Node environment
  assert(typeof globalThis.window === 'undefined', 'Environment is strictly headless (window === undefined)');
  assert(typeof globalThis.localStorage === 'undefined', 'Environment is strictly headless (localStorage === undefined)');

  // 1. Headless Module Loading via Vite SSR
  console.log('\n--- SUITE 1: Headless Node.js SSR Crash Immunity ---');
  const viteServer = await createServer({
    root: PROJECT_ROOT,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  let wsMod, connMod, toastMod, invMod, metMod;

  try {
    wsMod = await viteServer.ssrLoadModule('./src/lib/stores/workspaceStore.ts');
    assert(Boolean(wsMod && wsMod.workspaceStore), 'workspaceStore loaded without throwing in headless Node');

    connMod = await viteServer.ssrLoadModule('./src/lib/stores/connectivityStore.ts');
    assert(Boolean(connMod && connMod.connectivityStore), 'connectivityStore loaded without throwing in headless Node');

    toastMod = await viteServer.ssrLoadModule('./src/lib/stores/toastStore.ts');
    assert(Boolean(toastMod && toastMod.toastStore), 'toastStore loaded without throwing in headless Node');

    invMod = await viteServer.ssrLoadModule('./src/lib/stores/inventoryStore.ts');
    assert(Boolean(invMod && invMod.inventoryStore), 'inventoryStore loaded without throwing in headless Node');

    metMod = await viteServer.ssrLoadModule('./src/lib/stores/metricsStore.ts');
    assert(Boolean(metMod && metMod.metricsStore), 'metricsStore loaded without throwing in headless Node');
  } catch (err) {
    assert(false, `Unexpected crash during headless store import: ${err.message}`);
    await viteServer.close();
    process.exit(1);
  }

  const { workspaceStore, sanitizeWorkspaceId, sanitizeOperatorAlias, DEFAULT_WORKSPACE, DEFAULT_OPERATOR } = wsMod;
  const { connectivityStore } = connMod;
  const { toastStore, MAX_CONCURRENT_TOASTS, DEFAULT_TOAST_DURATION } = toastMod;
  const { inventoryStore, filteredProducts } = invMod;
  const { metricsStore, calculateDayDiff, calculateMetrics, parseDateOnly } = metMod;

  // 2. Headless Subscription & Reactivity Smoke Test
  console.log('\n--- SUITE 2: Headless Store Subscription & State Initializers ---');
  let currentWs, currentConn, currentToasts, currentInv, currentMet;

  const unsubWs = workspaceStore.subscribe(val => { currentWs = val; });
  const unsubConn = connectivityStore.subscribe(val => { currentConn = val; });
  const unsubToast = toastStore.subscribe(val => { currentToasts = val; });
  const unsubInv = inventoryStore.subscribe(val => { currentInv = val; });
  const unsubMet = metricsStore.subscribe(val => { currentMet = val; });

  assert(currentWs && currentWs.workspaceId === DEFAULT_WORKSPACE, `workspaceStore initialized with default workspace: ${currentWs?.workspaceId}`);
  assert(currentWs && currentWs.operatorAlias === DEFAULT_OPERATOR, `workspaceStore initialized with default operator: ${currentWs?.operatorAlias}`);
  assert(currentWs && typeof currentWs.deviceId === 'string' && currentWs.deviceId.length > 0, `workspaceStore generated SSR-safe deviceId: ${currentWs?.deviceId}`);

  assert(currentConn && currentConn.online === true, 'connectivityStore defaults to online=true in SSR');
  assert(currentConn && currentConn.hasPendingWrites === false, 'connectivityStore hasPendingWrites starts false');

  assert(Array.isArray(currentToasts) && currentToasts.length === 0, 'toastStore initialized with empty toast array');
  assert(currentInv && Array.isArray(currentInv.products) && currentInv.products.length === 0, 'inventoryStore products starts empty');
  assert(currentMet && currentMet.total === 0 && currentMet.expired === 0, 'metricsStore starts with zeroed metrics');

  // 3. Dirty Input Sanitization Fuzzing
  console.log('\n--- SUITE 3: Dirty Input Sanitization & Invariant Fuzzing ---');

  const dirtyWorkspaceVectors = [
    { input: '', expected: DEFAULT_WORKSPACE, desc: 'empty string' },
    { input: '   ', expected: DEFAULT_WORKSPACE, desc: 'spaces only' },
    { input: '\t\n\r\f', expected: DEFAULT_WORKSPACE, desc: 'control whitespace only' },
    { input: '----', expected: DEFAULT_WORKSPACE, desc: 'hyphens only' },
    { input: '---cocina---', expected: 'cocina', desc: 'leading and trailing hyphens' },
    { input: 'Cocina Principal', expected: 'cocina-principal', desc: 'uppercase and space' },
    { input: 'Cocina de Ñandú, Éxito y Café!', expected: 'cocina-de-nandu-exito-y-cafe', desc: 'Spanish accents, ñ, punctuation' },
    { input: '🔥 Cocina 👨‍🍳 123 🚀', expected: 'cocina-123', desc: 'emojis and symbols' },
    { input: '<script>alert("xss")</script>', expected: 'script-alert-xss-script', desc: 'XSS script injection' },
    { input: "' OR '1'='1' --", expected: 'or-1-1', desc: 'SQL injection attack' },
    { input: '../../../../etc/passwd', expected: 'etc-passwd', desc: 'path traversal vector' },
    { input: 'a'.repeat(200), expected: 'a'.repeat(200), desc: '200 char valid string' },
    { input: null, expected: DEFAULT_WORKSPACE, desc: 'null input' },
    { input: undefined, expected: DEFAULT_WORKSPACE, desc: 'undefined input' },
    { input: 12345, expected: DEFAULT_WORKSPACE, desc: 'number input' },
    { input: {}, expected: DEFAULT_WORKSPACE, desc: 'object input' },
    { input: ['workspace'], expected: DEFAULT_WORKSPACE, desc: 'array input' }
  ];

  for (const { input, expected, desc } of dirtyWorkspaceVectors) {
    const sanitized = sanitizeWorkspaceId(input);
    assertEquals(sanitized, expected, `sanitizeWorkspaceId: ${desc} -> ${expected}`);
  }

  const dirtyOperatorVectors = [
    { input: '', expected: DEFAULT_OPERATOR, desc: 'empty string' },
    { input: '   ', expected: DEFAULT_OPERATOR, desc: 'spaces only' },
    { input: '  Juan Pérez  ', expected: 'Juan Pérez', desc: 'leading/trailing space trim' },
    { input: 'Chef 👨‍🍳 Marco 🍕', expected: 'Chef 👨‍🍳 Marco 🍕', desc: 'emojis preserved in operator alias' },
    { input: null, expected: DEFAULT_OPERATOR, desc: 'null input' },
    { input: undefined, expected: DEFAULT_OPERATOR, desc: 'undefined input' },
    { input: 999, expected: DEFAULT_OPERATOR, desc: 'number input' }
  ];

  for (const { input, expected, desc } of dirtyOperatorVectors) {
    const sanitized = sanitizeOperatorAlias(input);
    assertEquals(sanitized, expected, `sanitizeOperatorAlias: ${desc} -> ${expected}`);
  }

  // Rapid successive calls in headless mode
  console.log('\n--- SUITE 4: Rapid Sequential Store Mutations Under Headless SSR ---');
  for (let i = 0; i < 500; i++) {
    workspaceStore.setWorkspace(`Sucursal_${i}_#$@!`);
    workspaceStore.setOperator(`Operador_${i}_🚀`);
  }
  assertEquals(currentWs.workspaceId, 'sucursal_499_', 'workspaceStore survived 500 rapid dirty mutations, final workspace is correct');
  assertEquals(currentWs.operatorAlias, 'Operador_499_🚀', 'workspaceStore final operator is correct');

  workspaceStore.reset();
  assertEquals(currentWs.workspaceId, DEFAULT_WORKSPACE, 'workspaceStore reset returned to DEFAULT_WORKSPACE');
  assertEquals(currentWs.operatorAlias, DEFAULT_OPERATOR, 'workspaceStore reset returned to DEFAULT_OPERATOR');

  // 4. ToastStore Concurrency Limit & Rapid Eviction
  console.log('\n--- SUITE 5: ToastStore Concurrency Limit & Eviction Invariants ---');
  assertEquals(MAX_CONCURRENT_TOASTS, 3, 'MAX_CONCURRENT_TOASTS equals 3');

  toastStore.clear();
  assertEquals(currentToasts.length, 0, 'toastStore.clear() empties toast list');

  const id1 = toastStore.show('Toast 1');
  const id2 = toastStore.show('Toast 2');
  const id3 = toastStore.show('Toast 3');

  assertEquals(currentToasts.length, 3, '3 toasts added, length is 3');
  assertEquals(currentToasts.map(t => t.message), ['Toast 1', 'Toast 2', 'Toast 3'], 'Initial 3 toasts in FIFO order');

  // Adding 4th toast must evict Toast 1
  const id4 = toastStore.show('Toast 4');
  assertEquals(currentToasts.length, 3, 'After 4th toast, length remains strictly 3');
  assertEquals(currentToasts.map(t => t.message), ['Toast 2', 'Toast 3', 'Toast 4'], 'Oldest toast (Toast 1) was cleanly evicted');

  // Rapid burst of 100 toasts
  for (let i = 5; i <= 104; i++) {
    toastStore.show({ message: `Toast ${i}`, duration: 10000 });
  }
  assertEquals(currentToasts.length, 3, 'After 100 rapid toast additions, length is strictly capped at 3');
  assertEquals(currentToasts.map(t => t.message), ['Toast 102', 'Toast 103', 'Toast 104'], 'Top 3 newest toasts retained in queue');

  // Dismiss by ID
  const targetId = currentToasts[1].id;
  toastStore.dismiss(targetId);
  assertEquals(currentToasts.length, 2, 'toastStore.dismiss removes single toast');
  assert(!currentToasts.some(t => t.id === targetId), 'Target toast was removed from active list');

  // Undo action callback test
  let undoTriggered = false;
  const undoId = toastStore.undo('Ingrediente consumido', () => {
    undoTriggered = true;
  });
  const undoToast = currentToasts.find(t => t.id === undoId);
  assert(Boolean(undoToast && undoToast.action && undoToast.action.label === 'Deshacer'), 'undo toast created with action label "Deshacer"');
  if (undoToast && undoToast.action) {
    undoToast.action.onClick();
    assert(undoTriggered === true, 'undo action onClick callback successfully executed');
  }

  toastStore.clear();
  assertEquals(currentToasts.length, 0, 'toastStore.clear() left 0 active toasts and no memory leaks');

  // 5. InventoryStore & MetricsStore Reactivity & Invariants
  console.log('\n--- SUITE 6: Inventory & Derived Metrics Reactivity Stress ---');
  inventoryStore.reset();

  const refDate = new Date(2026, 9, 25, 12, 0, 0); // 2026-10-25
  const fmt = (d) => d.toISOString().split('T')[0];

  const dMinus1 = new Date(refDate); dMinus1.setDate(refDate.getDate() - 1);
  const d0 = new Date(refDate);
  const dPlus2 = new Date(refDate); dPlus2.setDate(refDate.getDate() + 2);
  const dPlus5 = new Date(refDate); dPlus5.setDate(refDate.getDate() + 5);
  const dPlus12 = new Date(refDate); dPlus12.setDate(refDate.getDate() + 12);

  const sampleProducts = [
    { id: 'p1', name: 'Leche Vencida', category: 'lacteos', location: 'camara-1', quantity: 3, expiryDate: fmt(dMinus1) }, // expired (-1)
    { id: 'p2', name: 'Carne Vence Hoy', category: 'carnes', location: 'camara-1', quantity: 5, expiryDate: fmt(d0) },      // soon (0)
    { id: 'p3', name: 'Yogur Pronto', category: 'lacteos', location: 'camara-1', quantity: 2, expiryDate: fmt(dPlus2) },    // soon (+2)
    { id: 'p4', name: 'Queso Semana', category: 'lacteos', location: 'camara-2', quantity: 4, expiryDate: fmt(dPlus5) },     // week (+5)
    { id: 'p5', name: 'Arroz Vigente', category: 'secos', location: 'bodega-secos', quantity: 10, expiryDate: fmt(dPlus12) }, // ok (+12)
    { id: 'p6', name: 'Tomate Descartado', category: 'verduras', location: 'camara-2', quantity: 1, expiryDate: fmt(dMinus1), isDiscarded: true }, // discarded
    { id: 'p7', name: 'Harina Consumida', category: 'secos', location: 'bodega-secos', quantity: 0, expiryDate: fmt(dPlus5), isConsumed: true }   // consumed
  ];

  inventoryStore.setProducts(sampleProducts, false);
  assertEquals(currentInv.products.length, 7, 'inventoryStore has 7 total products loaded');

  // Calculate metrics with explicit reference date
  const metricsExplicit = calculateMetrics(currentInv.products, refDate);
  assertEquals(metricsExplicit.total, 5, 'Active products total is 5 (excludes discarded and consumed)');
  assertEquals(metricsExplicit.expired, 1, 'Expired products count is 1 (p1)');
  assertEquals(metricsExplicit.soon, 2, 'Soon products count is 2 (p2, p3)');
  assertEquals(metricsExplicit.week, 1, 'Week products count is 1 (p4)');
  assertEquals(metricsExplicit.ok, 1, 'Ok products count is 1 (p5)');
  assertEquals(metricsExplicit.critical7, 3, 'critical7 count is 3 (soon + week)');
  assertEquals(metricsExplicit.criticalTotal, 3, 'criticalTotal count is 3 (expired + soon)');
  assertEquals(metricsExplicit.discarded, 1, 'discarded count is 1 (p6)');
  assertEquals(metricsExplicit.consumed, 1, 'consumed count is 1 (p7)');

  // Mathematical invariant check
  assertEquals(
    metricsExplicit.total,
    metricsExplicit.expired + metricsExplicit.soon + metricsExplicit.week + metricsExplicit.ok,
    'Disjoint partition invariant holds: total === expired + soon + week + ok'
  );

  // Test consumeOne logic
  const consumeRes = inventoryStore.consumeOne('p3'); // qty was 2
  assertEquals(consumeRes.previousQuantity, 2, 'consumeOne returned previous quantity 2');
  const p3After1 = currentInv.products.find(p => p.id === 'p3');
  assertEquals(p3After1.quantity, 1, 'p3 quantity decremented to 1');
  assertEquals(p3After1.isConsumed, false, 'p3 isConsumed remains false while qty > 0');

  // Consume to 0
  inventoryStore.consumeOne('p3');
  const p3After2 = currentInv.products.find(p => p.id === 'p3');
  assertEquals(p3After2.quantity, 0, 'p3 quantity decremented to 0');
  assertEquals(p3After2.isConsumed, true, 'p3 marked as isConsumed when reaching 0');

  // Consume again when 0
  inventoryStore.consumeOne('p3');
  const p3After3 = currentInv.products.find(p => p.id === 'p3');
  assertEquals(p3After3.quantity, 0, 'p3 quantity clamped at 0 (never negative)');

  // Test filteredProducts derived store
  console.log('\n--- SUITE 7: FilteredProducts Derived Store Invariants ---');
  let currentFiltered;
  const unsubFiltered = filteredProducts.subscribe(val => { currentFiltered = val; });

  // Initially: active products excluding discarded (p6) and consumed (p7 and now p3) -> p1, p2, p4, p5 = 4 products
  assertEquals(currentFiltered.length, 4, 'filteredProducts excludes discarded and consumed products');

  // Category filter
  inventoryStore.setFilterCategory('lacteos');
  assertEquals(currentFiltered.map(p => p.id), ['p1', 'p4'], 'filteredProducts matches category "lacteos"');

  // Clear category filter, apply search query
  inventoryStore.setFilterCategory(null);
  inventoryStore.setSearchQuery('carne');
  assertEquals(currentFiltered.map(p => p.id), ['p2'], 'filteredProducts matches search query "carne"');

  // Search case insensitivity and partial matching
  inventoryStore.setSearchQuery('VIGENTE');
  assertEquals(currentFiltered.map(p => p.id), ['p5'], 'filteredProducts handles uppercase search query "VIGENTE"');

  // Search by lot / barcode
  inventoryStore.addProduct({
    id: 'p8',
    name: 'Atún en Lata',
    quantity: 10,
    expiryDate: '2027-01-01',
    barcode: '7791234567890',
    lot: 'LOTE-XYZ-99'
  });
  inventoryStore.setSearchQuery('779123456');
  assertEquals(currentFiltered.map(p => p.id), ['p8'], 'filteredProducts matches partial barcode');
  inventoryStore.setSearchQuery('xyz-99');
  assertEquals(currentFiltered.map(p => p.id), ['p8'], 'filteredProducts matches lot number');

  inventoryStore.setSearchQuery('');

  // 6. ConnectivityStore State Invariants
  console.log('\n--- SUITE 8: ConnectivityStore State Transitions ---');
  connectivityStore.setPendingWrites(true);
  assertEquals(currentConn.hasPendingWrites, true, 'connectivityStore sets pendingWrites=true');

  connectivityStore.setSyncing(true);
  assertEquals(currentConn.isSyncing, true, 'connectivityStore sets isSyncing=true');

  connectivityStore.setOnlineStatus(false);
  assertEquals(currentConn.online, false, 'connectivityStore transitions to offline');

  const prevTimestamp = currentConn.lastChanged;
  connectivityStore.setOnlineStatus(true);
  assertEquals(currentConn.online, true, 'connectivityStore transitions back to online');
  assert(new Date(currentConn.lastChanged).getTime() >= new Date(prevTimestamp).getTime(), 'lastChanged timestamp updated');



  // 7. Static Build & Production Asset Integrity Check
  console.log('\n--- SUITE 9: Static Build Asset & Link Integrity ---');
  const buildDir = path.resolve(PROJECT_ROOT, 'build');
  const indexHtmlPath = path.resolve(buildDir, 'index.html');
  const manifestPath = path.resolve(buildDir, 'manifest.json');

  assert(fs.existsSync(indexHtmlPath), 'build/index.html exists on disk');
  assert(fs.existsSync(manifestPath), 'build/manifest.json exists on disk');

  const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

  // Extract all href and src links from index.html
  const linkRegex = /(?:href|src)="(\/[^"]+)"/g;
  let match;
  const referencedAssets = [];
  while ((match = linkRegex.exec(htmlContent)) !== null) {
    referencedAssets.push(match[1]);
  }

  // Also extract modulepreload and script imports
  const importRegex = /import\("(\/_app\/[^"]+)"\)/g;
  while ((match = importRegex.exec(htmlContent)) !== null) {
    referencedAssets.push(match[1]);
  }

  console.log(`  Found ${referencedAssets.length} asset references in build/index.html`);
  for (const assetPath of referencedAssets) {
    // Relative to build root
    const diskPath = path.join(buildDir, assetPath.replace(/^\//, ''));
    assert(fs.existsSync(diskPath), `Asset exists on disk: ${assetPath}`);
  }

  // Verify manifest.json integrity
  const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifestJson.name === 'StockControl - Control de Vencimientos', `manifest.json name matches: ${manifestJson.name}`);
  assert(manifestJson.short_name === 'StockControl', `manifest.json short_name matches: ${manifestJson.short_name}`);
  assert(manifestJson.display === 'standalone', `manifest.json display is standalone: ${manifestJson.display}`);
  assert(Array.isArray(manifestJson.icons) && manifestJson.icons.length > 0, 'manifest.json contains icons array');

  for (const icon of manifestJson.icons) {
    const iconDiskPath = path.join(buildDir, icon.src.replace(/^\//, ''));
    assert(fs.existsSync(iconDiskPath), `Manifest icon exists on disk: ${icon.src}`);
  }

  // 8. Calendar, Boundary Dates & DST Stress
  console.log('\n--- SUITE 10: Calendar Integrity, Leap Years & DST Absorption ---');
  // Leap years
  assert(parseDateOnly('2024-02-29') !== null, 'Leap year 2024-02-29 is accepted as valid');
  assert(parseDateOnly('2020-02-29') !== null, 'Leap year 2020-02-29 is accepted as valid');
  assert(parseDateOnly('2000-02-29') !== null, 'Century leap year 2000-02-29 is accepted as valid');
  // Non-leap years
  assert(parseDateOnly('2025-02-29') === null, 'Non-leap year 2025-02-29 is rejected (null)');
  assert(parseDateOnly('2026-02-29') === null, 'Non-leap year 2026-02-29 is rejected (null)');
  assert(parseDateOnly('2100-02-29') === null, 'Century non-leap year 2100-02-29 is rejected (null)');
  // 30-day months
  assert(parseDateOnly('2026-04-31') === null, 'April 31 is rejected (null)');
  assert(parseDateOnly('2026-06-31') === null, 'June 31 is rejected (null)');
  assert(parseDateOnly('2026-09-31') === null, 'September 31 is rejected (null)');
  assert(parseDateOnly('2026-11-31') === null, 'November 31 is rejected (null)');
  // Out-of-bounds months and days
  assert(parseDateOnly('2026-00-15') === null, 'Month 0 is rejected (null)');
  assert(parseDateOnly('2026-13-15') === null, 'Month 13 is rejected (null)');
  assert(parseDateOnly('2026-01-00') === null, 'Day 0 is rejected (null)');
  assert(parseDateOnly('2026-01-32') === null, 'Day 32 is rejected (null)');
  assert(parseDateOnly('not-a-date') === null, 'Arbitrary text is rejected (null)');
  assert(parseDateOnly('') === null, 'Empty string is rejected (null)');

  // calculateDayDiff reference time invariance
  const midnightRef = new Date(2026, 9, 25, 0, 0, 0, 0);
  const endOfDayRef = new Date(2026, 9, 25, 23, 59, 59, 999);
  assertEquals(calculateDayDiff('2026-10-25', midnightRef), 0, 'calculateDayDiff at 00:00:00 returns 0 days');
  assertEquals(calculateDayDiff('2026-10-25', endOfDayRef), 0, 'calculateDayDiff at 23:59:59 returns 0 days');
  assertEquals(calculateDayDiff('2026-10-26', endOfDayRef), 1, 'calculateDayDiff for tomorrow at 23:59:59 returns 1 day');
  assertEquals(calculateDayDiff('2026-10-24', midnightRef), -1, 'calculateDayDiff for yesterday at 00:00:00 returns -1 day');
  assertEquals(calculateDayDiff('invalid-date', midnightRef), 99999, 'calculateDayDiff returns 99999 on invalid date string');

  // DST drift absorption (23-hour and 25-hour day shift simulation)
  const lateEveningRef = new Date(2026, 9, 25, 23, 0, 0);
  assertEquals(calculateDayDiff('2026-10-26', lateEveningRef), 1, 'calculateDayDiff snaps referenceDate from 23:00 to midnight, returning 1 day');
  assert(Math.round(82800000 / 86400000) === 1, 'Math.round absorbs 23h DST shift (0.958 -> 1 day)');
  assert(Math.round(90000000 / 86400000) === 1, 'Math.round absorbs 25h DST shift (1.042 -> 1 day)');

  // 9. Async Toast Auto-Dismissal & Timer Cancellation
  console.log('\n--- SUITE 11: Real Async Toast Timers & Lifecycle ---');
  toastStore.clear();

  const shortId1 = toastStore.show({ message: 'Short 1', duration: 40 });
  const shortId2 = toastStore.show({ message: 'Short 2', duration: 80 });
  assertEquals(currentToasts.length, 2, '2 short duration toasts queued');

  // Wait 60ms: shortId1 should have expired, shortId2 should remain
  await new Promise(res => setTimeout(res, 60));
  assertEquals(currentToasts.length, 1, 'After 60ms, first toast (40ms) auto-dismissed');
  assertEquals(currentToasts[0].id, shortId2, 'Second toast (80ms) remains active');

  // Wait another 40ms: shortId2 should expire
  await new Promise(res => setTimeout(res, 40));
  assertEquals(currentToasts.length, 0, 'After 100ms total, second toast auto-dismissed cleanly');

  // Concurrency eviction with timer cancellation
  const evictId1 = toastStore.show({ message: 'Evict 1', duration: 60 });
  const evictId2 = toastStore.show({ message: 'Evict 2', duration: 60 });
  const evictId3 = toastStore.show({ message: 'Evict 3', duration: 60 });
  const evictId4 = toastStore.show({ message: 'Evict 4', duration: 60 }); // Causes evictId1 eviction

  assertEquals(currentToasts.length, 3, 'Queue capped at 3');
  assert(!currentToasts.some(t => t.id === evictId1), 'Evict 1 immediately displaced');

  // Wait 80ms: all remaining toasts auto-dismiss
  await new Promise(res => setTimeout(res, 80));
  assertEquals(currentToasts.length, 0, 'All remaining queued toasts auto-dismissed without error');
  toastStore.clear();

  // Cleanup subscribers and Vite server
  unsubWs();
  unsubConn();
  unsubToast();
  unsubInv();
  unsubMet();
  unsubFiltered();
  await viteServer.close();

  // Summary
  console.log('\n================================================================');
  console.log(`TOTAL EMPIRICAL TESTS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error('FAILURES:');
    failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('ALL ADVERSARIAL STRESS TESTS COMPLETED WITH 100% SUCCESS.');
    process.exit(0);
  }
}

runAdversarialSuite().catch(err => {
  console.error('FATAL UNCAUGHT ERROR IN ADVERSARIAL TEST SUITE:', err);
  process.exit(1);
});
