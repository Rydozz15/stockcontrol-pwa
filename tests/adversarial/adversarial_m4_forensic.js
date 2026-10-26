/**
 * StockControl PWA — Milestone 4 Forensic Integrity Audit Battery
 * Independent empirical verification of Milestone 4:
 * - Barcode domain checksums, format detection & debouncing
 * - Contingency service (RFC 4180 CSV tokenizer, JSON v2 schema, legacy normalizer, conflict resolution)
 * - PWA Manifest & Service Worker offline architecture
 * - Reactive Connectivity store
 * - Render static configuration & anti-cheating verification
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

async function runM4ForensicAudit() {
  console.log('============================================================');
  console.log('   M4 FORENSIC INTEGRITY AUDIT - INDEPENDENT BATTERY        ');
  console.log('============================================================\n');

  const viteServer = await createServer({
    root: ROOT_DIR,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  let barcodeMod, contingencyMod, connectivityMod;

  try {
    barcodeMod = await viteServer.ssrLoadModule('./src/lib/domain/barcode.ts');
    contingencyMod = await viteServer.ssrLoadModule('./src/lib/repositories/contingencyService.ts');
    connectivityMod = await viteServer.ssrLoadModule('./src/lib/stores/connectivityStore.ts');
    console.log('  ✓ Loaded domain, repository, and store modules via Vite SSR');
  } catch (err) {
    console.error('Failed to load modules via Vite SSR:', err);
    await viteServer.close();
    process.exit(1);
  }

  const {
    isValidEan13,
    isValidEan8,
    inspectBarcode,
    lookupBarcode,
    findAllMatchingBarcode,
    BarcodeDebouncer,
    resolveScannerEngine
  } = barcodeMod;

  const {
    escapeCsvCell,
    exportProductsToCsv,
    exportWasteToCsv,
    parseCsv,
    validateImportItems,
    exportJsonV2,
    importJson,
    resolveImportConflicts
  } = contingencyMod;

  const { connectivityStore } = connectivityMod;

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  }

  // =========================================================================
  // SECTION 1: Barcode Domain GS1 Algorithms & Edge Cases
  // =========================================================================
  console.log('\n--- SECTION 1: Barcode GS1 Mathematical & Algorithmic Forensics ---');

  test('isValidEan13 correctly validates standard GS1 EAN-13 codes', () => {
    // 5901234123457 (Polish GTIN)
    assert.equal(isValidEan13('5901234123457'), true);
    // 7801234567894 (Chilean GTIN: 7*1 + 8*3 + 0*1 + 1*3 + 2*1 + 3*3 + 4*1 + 5*3 + 6*1 + 7*3 + 8*1 + 9*3 = 126 => check = 4)
    assert.equal(isValidEan13('7801234567894'), true);
    // Corrupted check digit
    assert.equal(isValidEan13('7801234567897'), false);
    assert.equal(isValidEan13('5901234123458'), false);
  });

  test('isValidEan13 preserves string identity and handles leading zeros', () => {
    // 0123456789012:
    // 0*1 + 1*3 + 2*1 + 3*3 + 4*1 + 5*3 + 6*1 + 7*3 + 8*1 + 9*3 + 0*1 + 1*3 = 3+2+9+4+15+6+21+8+27+0+3 = 98 => (10 - 8) = 2.
    assert.equal(isValidEan13('0123456789012'), true);
    assert.equal(isValidEan13('0123456789013'), false);
  });

  test('isValidEan13 rejects invalid formats (non-digits, lengths != 13, null, empty)', () => {
    assert.equal(isValidEan13(''), false);
    assert.equal(isValidEan13(null), false);
    assert.equal(isValidEan13(undefined), false);
    assert.equal(isValidEan13('123456789012'), false); // 12 digits
    assert.equal(isValidEan13('12345678901234'), false); // 14 digits
    assert.equal(isValidEan13('590123412345A'), false); // alpha
  });

  test('isValidEan8 correctly validates standard GS1 EAN-8 codes', () => {
    // EAN-8: odd * 3 + even * 1 (0-indexed: 0,2,4,6 are odd positions)
    // 96385074: 9*3 + 6*1 + 3*3 + 8*1 + 5*3 + 0*1 + 7*3 = 27 + 6 + 9 + 8 + 15 + 0 + 21 = 86 => check = (10-6) = 4!
    assert.equal(isValidEan8('96385074'), true);
    assert.equal(isValidEan8('96385075'), false); // wrong check
    assert.equal(isValidEan8('1234567'), false);  // too short
    assert.equal(isValidEan8('123456789'), false); // too long
  });

  test('inspectBarcode accurately categorizes ean_13, ean_8, code_128, and qr_code', () => {
    assert.deepEqual(inspectBarcode('5901234123457'), { valid: true, format: 'ean_13' });
    assert.deepEqual(inspectBarcode('96385074'), { valid: true, format: 'ean_8' });
    assert.deepEqual(inspectBarcode('LOT-2026-CHILE/01'), { valid: true, format: 'code_128' });
    assert.deepEqual(inspectBarcode('https://stockcontrol.kitchen/item/88?tag=salmon'), { valid: true, format: 'qr_code' });
    assert.deepEqual(inspectBarcode(''), { valid: false, format: null });
    assert.deepEqual(inspectBarcode('   '), { valid: false, format: null });
    assert.deepEqual(inspectBarcode(null), { valid: false, format: null });
  });

  test('lookupBarcode performs case-insensitive match on barcode or lot and ignores inactive products', () => {
    const products = [
      { id: '1', name: 'Leche Entera', barcode: '7801234567894', lot: 'L-101', isConsumed: false, isDiscarded: false },
      { id: '2', name: 'Crema de Leche', barcode: '7809999999999', lot: 'L-202', isConsumed: true, isDiscarded: false },
      { id: '3', name: 'Queso Azul', barcode: '7808888888888', lot: 'L-303', isConsumed: false, isDiscarded: true },
      { id: '4', name: 'Mantequilla', barcode: '7807777777777', lot: 'LOT-SPECIAL', isConsumed: false, isDiscarded: false }
    ];

    // Barcode match
    const r1 = lookupBarcode('7801234567894', products);
    assert.equal(r1.found, true);
    assert.equal(r1.product.name, 'Leche Entera');

    // Lot match (case-insensitive and trimmed)
    const r2 = lookupBarcode('  lot-special  ', products);
    assert.equal(r2.found, true);
    assert.equal(r2.product.name, 'Mantequilla');

    // Consumed product ignored
    const r3 = lookupBarcode('7809999999999', products);
    assert.equal(r3.found, false);

    // Discarded product ignored
    const r4 = lookupBarcode('7808888888888', products);
    assert.equal(r4.found, false);

    // Nonexistent
    assert.equal(lookupBarcode('000000', products).found, false);
  });

  test('BarcodeDebouncer enforces cooldown window and resets cleanly', () => {
    const debouncer = new BarcodeDebouncer(500);
    const t0 = 1000;
    assert.equal(debouncer.canProcess('EAN123', t0), true);
    assert.equal(debouncer.canProcess('EAN123', t0 + 200), false); // Within cooldown
    assert.equal(debouncer.canProcess('EAN456', t0 + 250), true);  // Different code passes
    assert.equal(debouncer.canProcess('EAN456', t0 + 300), false); // EAN456 cooldown
    assert.equal(debouncer.canProcess('EAN456', t0 + 760), true);  // Past cooldown
    debouncer.reset();
    assert.equal(debouncer.canProcess('EAN456', t0 + 765), true);  // Reset allows immediately
  });

  test('resolveScannerEngine chooses native when available and software fallback otherwise', () => {
    assert.deepEqual(resolveScannerEngine(true), { engine: 'native_barcode_detector', hardwareAccelerated: true });
    assert.deepEqual(resolveScannerEngine(false), { engine: 'software_fallback', hardwareAccelerated: false });
  });

  // =========================================================================
  // SECTION 2: Contingency RFC 4180 CSV & JSON v2 Data Service Forensics
  // =========================================================================
  console.log('\n--- SECTION 2: Contingency Data Service & RFC 4180 Forensics ---');

  test('escapeCsvCell correctly escapes RFC 4180 quotes, commas, and nulls', () => {
    assert.equal(escapeCsvCell('Hello'), '"Hello"');
    assert.equal(escapeCsvCell('Salmón "Premium"'), '"Salmón ""Premium"""');
    assert.equal(escapeCsvCell('Línea 1\nLínea 2'), '"Línea 1\nLínea 2"');
    assert.equal(escapeCsvCell(null), '""');
    assert.equal(escapeCsvCell(undefined), '""');
  });

  test('exportProductsToCsv prepends UTF-8 BOM, uses semicolon delimiter and quotes headers', () => {
    const items = [
      { name: 'Harina 000', category: 'Secos y abarrotes', quantity: 25, unit: 'kg', receivedDate: '2026-10-01', expiryDate: '2026-12-01', location: 'Bodega seca', lot: 'H-90', supplier: 'Molinos', notes: 'Saco sellado' }
    ];
    const csv = exportProductsToCsv(items);
    assert.equal(csv.charCodeAt(0), 0xfeff, 'Must start with UTF-8 BOM');
    const lines = csv.slice(1).split(/\r?\n/);
    assert.equal(lines.length, 2);
    assert.ok(lines[0].includes(';'), 'Delimiter must be semicolon');
    assert.ok(lines[0].includes('"Producto"'));
    assert.ok(lines[0].includes('"Vencimiento"'));
    assert.ok(lines[1].includes('"Harina 000"'));
    assert.ok(lines[1].includes('"25"'));
  });

  test('parseCsv handles RFC 4180 complex quoting, CRLF, embedded semicolons and accents', () => {
    const sampleCsv = '\uFEFF"Producto";"Categoría";"Cantidad";"Unidad";"Recepción";"Vencimiento";"Almacenamiento";"Lote";"Proveedor";"Observaciones"\r\n' +
      '"Queso ""Gouda"" Holandés";"Lácteos";10;"kg";"2026-10-10";"2026-11-20";"Refrigerador";"L-55";"Proveedor A";"Mantener a 4°C; no congelar"\r\n' +
      '"Aceite de Oliva Extra Virgen";"Secos y abarrotes";5;"L";"2026-10-05";"2027-10-05";"Bodega seca";"L-66";"Aceites del Valle";"Botellas oscuras"';

    const parsed = parseCsv(sampleCsv);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].name, 'Queso "Gouda" Holandés');
    assert.equal(parsed[0].quantity, 10);
    assert.equal(parsed[0].notes, 'Mantener a 4°C; no congelar');
    assert.equal(parsed[1].name, 'Aceite de Oliva Extra Virgen');
    assert.equal(parsed[1].quantity, 5);
  });

  test('validateImportItems properly separates valid rows from invalid rows with actionable errors', () => {
    const candidates = [
      { id: '1', name: 'Carne Molida', quantity: 5, expiryDate: '2026-10-28', receivedDate: '2026-10-25', category: 'Carnes rojas', unit: 'kg', location: 'Refrigerador' },
      { id: '2', name: '', quantity: 2, expiryDate: '2026-10-30', receivedDate: '2026-10-25' }, // missing name
      { id: '3', name: 'Pollo Entero', quantity: -3, expiryDate: '2026-10-29', receivedDate: '2026-10-25' }, // negative qty
      { id: '4', name: 'Leche', quantity: 1, expiryDate: 'not-a-date', receivedDate: '2026-10-25' } // invalid expiry
    ];

    const result = validateImportItems(candidates);
    assert.equal(result.valid.length, 1);
    assert.equal(result.invalid.length, 3);
    assert.equal(result.summary.validCount, 1);
    assert.equal(result.summary.invalidCount, 3);
    assert.ok(result.invalid[0].errors.some(e => e.includes('nombre')));
    assert.ok(result.invalid[1].errors.some(e => e.includes('mayor o igual a cero')));
    assert.ok(result.invalid[2].errors.some(e => e.includes('YYYY-MM-DD')));
  });

  test('exportJsonV2 produces canonical v2 schema with app, version, timestamp, workspaceId', () => {
    const sampleProducts = [{ id: 'p1', name: 'Arroz', quantity: 10, unit: 'kg', expiryDate: '2027-01-01' }];
    const jsonStr = exportJsonV2(sampleProducts, 'cocina-central');
    const obj = JSON.parse(jsonStr);
    assert.equal(obj.app, 'StockControl PWA');
    assert.equal(obj.version, 2);
    assert.equal(obj.workspaceId, 'cocina-central');
    assert.equal(Array.isArray(obj.products), true);
    assert.equal(obj.products.length, 1);
    assert.ok(obj.exportedAt);
  });

  test('importJson successfully normalizes both v2 and legacy v1 JSON backups', () => {
    // Legacy v1 backup schema
    const legacyV1 = JSON.stringify({
      app: 'StockControl Vencimientos',
      version: 1,
      products: [
        { id: 'v1_1', name: 'Crema Pastelera', quantity: '4.5', received: '2026-09-01', expiry: '2026-09-15', location: 'Nevera' }
      ]
    });

    const parsedV1 = importJson(legacyV1, 'cocina-test');
    assert.equal(parsedV1.version, 1);
    assert.equal(parsedV1.products.length, 1);
    assert.equal(parsedV1.products[0].name, 'Crema Pastelera');
    assert.equal(parsedV1.products[0].quantity, 4.5);
    assert.equal(parsedV1.products[0].receivedDate, '2026-09-01');
    assert.equal(parsedV1.products[0].expiryDate, '2026-09-15');
    assert.equal(parsedV1.products[0].createdBy, 'Legacy Import');

    // Modern v2 backup schema
    const modernV2 = JSON.stringify({
      app: 'StockControl PWA',
      version: 2,
      workspaceId: 'sucursal-costanera',
      products: [
        { id: 'v2_1', name: 'Atún en Lata', quantity: 20, unit: 'unidad(es)', receivedDate: '2026-10-01', expiryDate: '2028-10-01' }
      ]
    });

    const parsedV2 = importJson(modernV2);
    assert.equal(parsedV2.version, 2);
    assert.equal(parsedV2.workspaceId, 'sucursal-costanera');
    assert.equal(parsedV2.products[0].name, 'Atún en Lata');
  });

  test('resolveImportConflicts correctly applies merge, replace, skip, and append strategies', () => {
    const existing = [
      { id: 'ext1', name: 'Sal Fina', barcode: '780001', quantity: 10, unit: 'kg', expiryDate: '2027-01-01' },
      { id: 'ext2', name: 'Pimienta Negra', barcode: '780002', quantity: 2, unit: 'kg', expiryDate: '2027-01-01' }
    ];

    const incoming = [
      { id: 'inc1', name: 'Sal Fina', barcode: '780001', quantity: 5, unit: 'kg', expiryDate: '2027-06-01' },
      { id: 'inc2', name: 'Pimienta Negra', barcode: '780002', quantity: 3, unit: 'kg', expiryDate: '2027-08-01' },
      { id: 'inc3', name: 'Orégano', barcode: '780003', quantity: 1, unit: 'kg', expiryDate: '2027-09-01' }
    ];

    // 1. Merge: sums quantity on duplicates
    const resMerge = resolveImportConflicts(incoming, existing, 'merge');
    assert.equal(resMerge.toInsert.length, 1); // Orégano
    assert.equal(resMerge.toUpdate.length, 2); // Sal (10+5=15) & Pimienta (2+3=5)
    assert.equal(resMerge.toUpdate.find(u => u.id === 'ext1').updates.quantity, 15);
    assert.equal(resMerge.toUpdate.find(u => u.id === 'ext2').updates.quantity, 5);

    // 2. Replace: updates incoming attributes
    const resReplace = resolveImportConflicts(incoming, existing, 'replace');
    assert.equal(resReplace.toInsert.length, 1);
    assert.equal(resReplace.toUpdate.length, 2);
    assert.equal(resReplace.toUpdate.find(u => u.id === 'ext1').updates.quantity, 5);
    assert.equal(resReplace.toUpdate.find(u => u.id === 'ext1').updates.expiryDate, '2027-06-01');

    // 3. Skip: ignores duplicates
    const resSkip = resolveImportConflicts(incoming, existing, 'skip');
    assert.equal(resSkip.toInsert.length, 1);
    assert.equal(resSkip.toUpdate.length, 0);
    assert.equal(resSkip.skippedCount, 2);

    // 4. Append: inserts everything regardless of duplicates
    const resAppend = resolveImportConflicts(incoming, existing, 'append');
    assert.equal(resAppend.toInsert.length, 3);
    assert.equal(resAppend.toUpdate.length, 0);
    assert.equal(resAppend.skippedCount, 0);
  });

  // =========================================================================
  // SECTION 3: Connectivity Store Reactive Behavior
  // =========================================================================
  console.log('\n--- SECTION 3: Reactive Connectivity Store Forensics ---');

  test('connectivityStore manages online status and pending operations counter', () => {
    connectivityStore.reset();
    let state = connectivityStore.get();
    assert.equal(state.pendingWrites, 0);
    assert.equal(state.hasPendingWrites, false);

    connectivityStore.incrementPending();
    state = connectivityStore.get();
    assert.equal(state.pendingWrites, 1);
    assert.equal(state.hasPendingWrites, true);

    connectivityStore.incrementPending();
    state = connectivityStore.get();
    assert.equal(state.pendingWrites, 2);

    connectivityStore.decrementPending();
    state = connectivityStore.get();
    assert.equal(state.pendingWrites, 1);
    assert.equal(state.hasPendingWrites, true);

    connectivityStore.decrementPending();
    state = connectivityStore.get();
    assert.equal(state.pendingWrites, 0);
    assert.equal(state.hasPendingWrites, false);

    // Clamp at zero
    connectivityStore.decrementPending();
    state = connectivityStore.get();
    assert.equal(state.pendingWrites, 0);

    // Online switching
    connectivityStore.setOnline(false);
    state = connectivityStore.get();
    assert.equal(state.isOnline, false);
    assert.equal(state.online, false);

    connectivityStore.setOnline(true);
    state = connectivityStore.get();
    assert.equal(state.isOnline, true);
    assert.equal(state.online, true);
  });

  // =========================================================================
  // SECTION 4: Static File & Hardware Lifecycle Source Forensics
  // =========================================================================
  console.log('\n--- SECTION 4: Hardware Lifecycle, PWA & Static Architecture Forensics ---');

  test('CameraScanner.svelte enforces hardware track teardown and touch target dimensions', () => {
    const scannerPath = path.join(ROOT_DIR, 'src/lib/components/CameraScanner.svelte');
    assert.ok(fs.existsSync(scannerPath), 'CameraScanner.svelte exists');
    const content = fs.readFileSync(scannerPath, 'utf8');

    // Hardware track teardown verification
    assert.ok(content.includes('track.stop()'), 'MediaStreamTrack.stop() called during teardown');
    assert.ok(content.includes('onDestroy'), 'onDestroy lifecycle hook cleans up camera');
    assert.ok(content.includes('stopCurrentTracks'), 'stopCurrentTracks function detaches camera hardware');
    assert.ok(content.includes('cancelAnimationFrame'), 'Cancels active animation detection loop');
    assert.ok(content.includes('visibilitychange'), 'Handles document visibility changes');

    // Dual-Engine verification
    assert.ok(content.includes('BarcodeDetector'), 'Probes and initializes native BarcodeDetector API');
    assert.ok(content.includes('html5-qrcode'), 'Dynamic import fallback to html5-qrcode');

    // Touch targets >= 44x44px
    assert.ok(content.includes('min-width: 44px') || content.includes('min-height: 44px'), 'Touch targets enforce >= 44px minimum');
    assert.ok(content.includes('touch-action: manipulation'), 'Enforces touch-action manipulation for instant mobile response');
  });

  test('src/service-worker.ts correctly implements offline cache, navigation fallback, and API bypass', () => {
    const swPath = path.join(ROOT_DIR, 'src/service-worker.ts');
    assert.ok(fs.existsSync(swPath), 'src/service-worker.ts exists');
    const content = fs.readFileSync(swPath, 'utf8');

    assert.ok(content.includes('caches.open'), 'Opens versioned cache');
    assert.ok(content.includes('skipWaiting'), 'Calls skipWaiting on install');
    assert.ok(content.includes('clients.claim'), 'Calls clients.claim on activate');
    assert.ok(content.includes("event.request.method !== 'GET'"), 'Bypasses non-GET HTTP mutations');
    assert.ok(content.includes("event.request.mode === 'navigate'"), 'Handles SPA navigation');
    assert.ok(content.includes('/index.html'), 'Falls back to /index.html for offline navigation');
    assert.ok(content.includes('url.origin !== sw.location.origin'), 'Strictly bypasses cross-origin Firestore & Google APIs');
  });

  test('PWA manifest files exist, are valid JSON, and configure standalone mode with culinary branding', () => {
    const staticManifestPath = path.join(ROOT_DIR, 'static/manifest.json');
    const rootManifestPath = path.join(ROOT_DIR, 'manifest.json');

    assert.ok(fs.existsSync(staticManifestPath), 'static/manifest.json exists');
    assert.ok(fs.existsSync(rootManifestPath), 'root manifest.json exists');

    const staticManifest = JSON.parse(fs.readFileSync(staticManifestPath, 'utf8'));
    assert.equal(staticManifest.display, 'standalone');
    assert.equal(staticManifest.theme_color, '#75472f');
    assert.equal(staticManifest.background_color, '#fbf6ee');
    assert.ok(staticManifest.icons.some(i => i.sizes === '192x192'));
    assert.ok(staticManifest.icons.some(i => i.sizes === '512x512'));

    // Check that icons exist on disk
    for (const icon of staticManifest.icons) {
      const iconPath = path.join(ROOT_DIR, 'static', icon.src.replace(/^\//, ''));
      assert.ok(fs.existsSync(iconPath), `Manifest icon exists on disk: ${icon.src}`);
    }
  });

  test('render.yaml is authentic static site configuration for $0 deployment', () => {
    const renderPath = path.join(ROOT_DIR, 'render.yaml');
    assert.ok(fs.existsSync(renderPath), 'render.yaml exists');
    const content = fs.readFileSync(renderPath, 'utf8');

    assert.ok(content.includes('env: static'), 'Environment is static');
    assert.ok(content.includes('plan: free'), 'Plan is free');
    assert.ok(content.includes('buildCommand: npm install && npm run build'), 'Correct buildCommand');
    assert.ok(content.includes('staticPublishPath: ./build'), 'Publish directory is ./build');
    assert.ok(content.includes('destination: /index.html'), 'Rewrite rule routes to /index.html for SPA');
  });

  test('ExportImportModal.svelte touch targets and accessibility conform to standards', () => {
    const modalPath = path.join(ROOT_DIR, 'src/lib/components/ExportImportModal.svelte');
    assert.ok(fs.existsSync(modalPath), 'ExportImportModal.svelte exists');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(content.includes('btn-close'), 'Has close button');
    assert.ok(content.includes('min-height: 48px') || content.includes('min-height: 44px'), 'Buttons have min-height >= 44px');
    assert.ok(content.includes('touch-action: manipulation'), 'Enforces touch-action manipulation');
    assert.ok(content.includes('role="dialog"'), 'Has accessible dialog role');
    assert.ok(content.includes('aria-modal="true"'), 'Has aria-modal');
  });

  await viteServer.close();

  console.log('\n============================================================');
  console.log(`TOTAL FORENSIC AUDIT CHECKS : ${passed + failed}`);
  console.log(`PASSED                     : ${passed}`);
  console.log(`FAILED                     : ${failed}`);
  console.log('============================================================');

  if (failed > 0) {
    console.error(`\n>>> FORENSIC VERDICT: INTEGRITY VIOLATION (${failed} failed checks)`);
    process.exit(1);
  } else {
    console.log('\n>>> FORENSIC VERDICT: ALL M4 INTEGRITY CHECKS PASSED CLEANLY (VERDICT: CLEAN)');
    process.exit(0);
  }
}

runM4ForensicAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
