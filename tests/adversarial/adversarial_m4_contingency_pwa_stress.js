/**
 * Empirical Challenger Adversarial Stress Suite for Milestone 4:
 * Data Contingency (RFC 4180 CSV / JSON v2), PWA Invariants, and Offline Synchronization.
 *
 * Author: challenger_m4_2 (Empirical Challenger)
 * Working Directory: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono
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

async function runMilestone4AdversarialSuite() {
  console.log('================================================================');
  console.log('STARTING EMPIRICAL CHALLENGER ADVERSARIAL STRESS SUITE (M4)');
  console.log(`Node.js version: ${process.version}`);
  console.log(`Working Directory: ${PROJECT_ROOT}`);
  console.log('================================================================\n');

  // Load Vite SSR environment
  const viteServer = await createServer({
    root: PROJECT_ROOT,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  let contingencyMod;
  let connectivityMod;

  try {
    contingencyMod = await viteServer.ssrLoadModule('./src/lib/repositories/contingencyService.ts');
    assert(Boolean(contingencyMod), 'contingencyService.ts loaded cleanly via Vite SSR');

    connectivityMod = await viteServer.ssrLoadModule('./src/lib/stores/connectivityStore.ts');
    assert(Boolean(connectivityMod), 'connectivityStore.ts loaded cleanly via Vite SSR');
  } catch (err) {
    console.error('Fatal SSR load failure:', err);
    await viteServer.close();
    process.exit(1);
  }

  const {
    exportProductsToCsv,
    exportWasteToCsv,
    parseCsv,
    validateImportItems,
    exportJsonV2,
    importJson,
    resolveImportConflicts,
    escapeCsvCell,
    CSV_HEADER,
    CSV_KEYS
  } = contingencyMod;

  const { connectivityStore } = connectivityMod;

  // ============================================================================
  // SUITE 1: CSV RFC 4180 Invariants, Escaping, and Hostile Input Fuzzing
  // ============================================================================
  console.log('\n--- SUITE 1: CSV RFC 4180 Invariants & Hostile Input Fuzzing ---');

  // 1.1 BOM & Semicolon Delimiter Check
  const sampleProducts = [
    {
      name: 'Queso Mantecoso',
      category: 'Lácteos',
      quantity: 3,
      unit: 'kg',
      receivedDate: '2026-10-20',
      expiryDate: '2026-11-20',
      location: 'Refrigerador',
      lot: 'L-101',
      supplier: 'Colun',
      notes: 'Sellado al vacío'
    },
    {
      name: 'Salmón "Premium" Fresco',
      category: 'Pescados y mariscos',
      quantity: 2.5,
      unit: 'kg',
      receivedDate: '2026-10-22',
      expiryDate: '2026-10-29',
      location: 'Congelador',
      lot: 'LOT-99;A',
      supplier: 'Pesquera del Sur',
      notes: 'Mantener a -18°C; no recongelar.\nInstrucción adicional.'
    }
  ];

  const generatedCsv = exportProductsToCsv(sampleProducts);
  assert(generatedCsv.charCodeAt(0) === 0xfeff, 'CSV starts with UTF-8 Byte Order Mark (\\uFEFF)');
  assert(generatedCsv.startsWith('\uFEFF"Producto";"Categoría"'), 'CSV header is semicolon-delimited with UTF-8 BOM');
  
  // 1.2 Excel / Formula Injection Fuzzing
  const hostileFormulaProducts = [
    { name: '=cmd|\' /C calc\'!A0', category: 'Otros', quantity: 1, unit: 'unidad(es)', receivedDate: '2026-10-26', expiryDate: '2026-10-30', location: 'Despensa' },
    { name: '+1234567890', category: 'Otros', quantity: 1, unit: 'unidad(es)', receivedDate: '2026-10-26', expiryDate: '2026-10-30', location: 'Despensa' },
    { name: '-SUM(A1:A10)', category: 'Otros', quantity: 1, unit: 'unidad(es)', receivedDate: '2026-10-26', expiryDate: '2026-10-30', location: 'Despensa' },
    { name: '@HYPERLINK("http://evil.com")', category: 'Otros', quantity: 1, unit: 'unidad(es)', receivedDate: '2026-10-26', expiryDate: '2026-10-30', location: 'Despensa' }
  ];
  const hostileFormulaCsv = exportProductsToCsv(hostileFormulaProducts);
  assert(hostileFormulaCsv.includes('"=cmd|\' /C calc\'!A0"'), 'Excel command injection wrapped in quotes');
  assert(hostileFormulaCsv.includes('"+1234567890"'), 'Leading plus sign wrapped in quotes');
  assert(hostileFormulaCsv.includes('"-SUM(A1:A10)"'), 'Formula leading minus wrapped in quotes');
  assert(hostileFormulaCsv.includes('"@HYPERLINK(""http://evil.com"")"'), 'At-formula wrapped in quotes with internal quotes escaped');

  // 1.3 Extreme Multiline (CRLF, LF, CR) and Internal Semicolons
  const multilineCsv = exportProductsToCsv([
    {
      name: 'Hierbas Aromáticas',
      category: 'Verduras',
      quantity: 5,
      unit: 'unidad(es)',
      receivedDate: '2026-10-26',
      expiryDate: '2026-11-05',
      location: 'Refrigerador',
      lot: 'H-01',
      supplier: 'Huerto Orgánico',
      notes: 'Línea 1\r\nLínea 2 con ; punto y coma\r\nLínea 3 con ""comillas""\nLínea 4 final'
    }
  ]);
  const parsedMultiline = parseCsv(multilineCsv);
  assert(parsedMultiline.length === 1, 'Multiline notes with embedded CRLF/LF/semicolons parses into exactly 1 product');
  assert(parsedMultiline[0].name === 'Hierbas Aromáticas', 'Product name preserved across multiline parsing');
  assert(parsedMultiline[0].notes.includes('Línea 1'), 'Notes line 1 preserved');
  assert(parsedMultiline[0].notes.includes('Línea 2 con ; punto y coma'), 'Embedded semicolon inside quoted note preserved');
  assert(parsedMultiline[0].notes.includes('Línea 3 con ""comillas""'), 'Doubled quotes roundtrip without field truncation');

  // 1.4 Spanish Characters and Emoji Unicode Portability
  const unicodeProducts = [
    {
      name: 'Jamón Ibérico & Piña Colada 🍍',
      category: 'Carnes',
      quantity: 1.25,
      unit: 'kg',
      receivedDate: '2026-10-26',
      expiryDate: '2026-11-15',
      location: 'Refrigerador',
      lot: 'ÑANDÚ-2026',
      supplier: 'Viña & Charcutería España',
      notes: '¡Atención! ¿Verificar sello de denominación de origen? €45'
    }
  ];
  const unicodeCsv = exportProductsToCsv(unicodeProducts);
  const parsedUnicode = parseCsv(unicodeCsv);
  assert(parsedUnicode.length === 1, 'Unicode CSV parsed cleanly');
  assert(parsedUnicode[0].name === 'Jamón Ibérico & Piña Colada 🍍', 'Spanish accents (ó, ñ) and emoji preserved verbatim');
  assert(parsedUnicode[0].lot === 'ÑANDÚ-2026', 'Uppercase Ñ preserved verbatim');
  assert(parsedUnicode[0].notes.includes('€45') && parsedUnicode[0].notes.includes('¡Atención!'), 'Punctuation (¡, ¿, €) preserved');

  // 1.5 Auto-detection of BOM-less and Comma-delimited CSVs
  const commaCsv = 'name,category,quantity,unit,receivedDate,expiryDate,location,lot,supplier,notes\n' +
                   '"Leche Entera","Lácteos","6","L","2026-10-26","2026-11-02","Refrigerador","L-01","Soprole","Pack x 6"';
  const parsedComma = parseCsv(commaCsv);
  assert(parsedComma.length === 1, 'BOM-less comma-delimited CSV auto-detected and parsed cleanly');
  assert(parsedComma[0].name === 'Leche Entera', 'Comma CSV product name parsed');
  assert(parsedComma[0].quantity === 6, 'Comma CSV quantity parsed as number');

  // 1.6 Malformed & Boundary CSV inputs
  assert(parseCsv('').length === 0, 'Empty string returns empty array');
  assert(parseCsv(null).length === 0, 'null CSV returns empty array');
  assert(parseCsv(undefined).length === 0, 'undefined CSV returns empty array');
  assert(parseCsv('   \n\r\n   ').length === 0, 'Whitespace/blank lines CSV returns empty array');
  assert(parseCsv('Producto;Categoría;Cantidad\n').length === 0, 'Header-only CSV returns empty array');

  // Unclosed quotes in CSV does not crash tokenizer
  const unclosedCsv = 'Producto;Categoría;Cantidad;Unidad;Recepción;Vencimiento;Almacenamiento;Lote;Proveedor;Observaciones\n' +
                      '"Manzanas Rotas";"Frutas";"10";"kg";"2026-10-26";"2026-11-01";"Despensa";"L-1";"Agro";"Esta nota no cierra comillas';
  const parsedUnclosed = parseCsv(unclosedCsv);
  assert(parsedUnclosed.length === 1, 'Unclosed quote terminates cleanly without infinite loop');
  assert(parsedUnclosed[0].name === 'Manzanas Rotas', 'Product name before unclosed quote preserved');

  // 1.7 Waste History CSV Export
  const sampleWasteLogs = [
    {
      id: 'log-1',
      action: 'DISCARD',
      productName: 'Tomates Perita',
      category: 'Verduras',
      quantityDelta: -2.5,
      unit: 'kg',
      reason: 'vencimiento',
      operatorAlias: 'Carlos - Chef',
      timestamp: '2026-10-26T01:00:00.000Z',
      notes: 'Hongos visibles en el cajón'
    },
    {
      id: 'log-2',
      action: 'CONSUME', // Should be excluded from waste export
      productName: 'Arroz Grano Largo',
      category: 'Otros',
      quantityDelta: -5,
      unit: 'kg',
      reason: 'consumo',
      operatorAlias: 'Marta - Ayudante',
      timestamp: '2026-10-26T01:10:00.000Z',
      notes: 'Preparación de menú'
    },
    {
      id: 'log-3',
      action: 'discard', // lowercase check
      productName: 'Crema de Leche',
      category: 'Lácteos',
      quantityDelta: -1,
      unit: 'L',
      reason: 'calidad',
      operatorAlias: 'Carlos - Chef',
      timestamp: '2026-10-26T01:20:00.000Z',
      notes: 'Envase inflado'
    }
  ];
  const wasteCsv = exportWasteToCsv(sampleWasteLogs);
  assert(wasteCsv.charCodeAt(0) === 0xfeff, 'Waste CSV starts with UTF-8 BOM');
  assert(wasteCsv.includes('"Tomates Perita"') && wasteCsv.includes('"Crema de Leche"'), 'Both DISCARD and lowercase discard logs included');
  assert(!wasteCsv.includes('"Arroz Grano Largo"'), 'CONSUME action strictly excluded from waste report');
  assert(wasteCsv.includes('"2.5"') && !wasteCsv.includes('"-2.5"'), 'Negative quantityDelta converted to positive discarded amount');

  // ============================================================================
  // SUITE 2: JSON v2 Backup, Legacy v1 Normalization & Validation Pipeline
  // ============================================================================
  console.log('\n--- SUITE 2: JSON v2 Backup & Legacy v1 Normalization ---');

  // 2.1 JSON v2 Export Invariants
  const jsonExportStr = exportJsonV2(sampleProducts, 'cocina-central', sampleWasteLogs);
  const jsonExportObj = JSON.parse(jsonExportStr);
  assert(jsonExportObj.app === 'StockControl PWA', 'JSON backup app matches "StockControl PWA"');
  assert(jsonExportObj.version === 2, 'JSON backup version is 2');
  assert(jsonExportObj.workspaceId === 'cocina-central', 'JSON backup preserves workspaceId');
  assert(Array.isArray(jsonExportObj.products) && jsonExportObj.products.length === 2, 'JSON backup products array preserved');
  assert(Array.isArray(jsonExportObj.auditLog) && jsonExportObj.auditLog.length === 3, 'JSON backup auditLog preserved');
  assert(!isNaN(Date.parse(jsonExportObj.exportedAt)), 'JSON backup exportedAt is valid ISO 8601 timestamp');

  // 2.2 Hostile Non-JSON / Corrupted Payloads
  let threwMalformed = false;
  try {
    importJson('NOT_VALID_JSON{:::');
  } catch {
    threwMalformed = true;
  }
  assert(threwMalformed, 'Corrupted JSON string throws descriptive error');

  let threwPrimitive = false;
  try {
    importJson('12345');
  } catch {
    threwPrimitive = true;
  }
  assert(threwPrimitive, 'Numeric JSON primitive throws error');

  let threwMissingProducts = false;
  try {
    importJson({ app: 'StockControl PWA', version: 2 });
  } catch {
    threwMissingProducts = true;
  }
  assert(threwMissingProducts, 'JSON missing "products" array throws error');

  // 2.3 Legacy v1 Normalization
  const legacyV1Payload = {
    app: 'StockControl Vencimientos',
    version: 1,
    workspace: 'cocina-vieja',
    products: [
      {
        id: 'legacy-1',
        name: 'Mantequilla con Sal',
        category: 'Lácteos',
        quantity: '4', // string quantity
        unit: 'unidad(es)',
        received: '2026-09-15', // legacy received key
        expiry: '2026-10-15',   // legacy expiry key
        location: 'Refrigerador',
        customField: 'preserved-value'
      },
      {
        id: 'legacy-1', // DUPLICATE ID attack!
        name: 'Mantequilla sin Sal',
        category: 'Lácteos',
        quantity: -2, // negative quantity attack
        unit: 'unidad(es)',
        received: '2026-09-16',
        expiry: '2026-10-16',
        location: 'Refrigerador'
      }
    ]
  };

  const v1ImportResult = importJson(legacyV1Payload, 'cocina-central');
  assert(v1ImportResult.version === 1, 'Legacy v1 detected');
  assert(v1ImportResult.products.length === 2, 'Both legacy products imported');
  
  const [norm1, norm2] = v1ImportResult.products;
  assert(norm1.receivedDate === '2026-09-15', 'Legacy "received" mapped to "receivedDate"');
  assert(norm1.expiryDate === '2026-10-15', 'Legacy "expiry" mapped to "expiryDate"');
  assert(norm1.quantity === 4 && typeof norm1.quantity === 'number', 'String quantity normalized to number 4');
  assert(norm1.createdBy === 'Legacy Import', 'Legacy createdBy defaulted to "Legacy Import"');
  assert(norm1.customField === 'preserved-value', 'Custom field preserved on normalized product');
  assert(norm2.id !== norm1.id, 'Duplicate IDs in import automatically receive distinct unique keys');
  assert(norm2.quantity === 0, 'Negative quantity normalized to 0');

  // 2.4 validateImportItems Pipeline
  const candidateItems = [
    { name: 'Válido 1', quantity: 10, expiryDate: '2026-11-01' },
    { name: '', quantity: 5, expiryDate: '2026-11-01' }, // Missing name
    { name: 'Negativo', quantity: -1, expiryDate: '2026-11-01' }, // Negative qty
    { name: 'Fecha Mala', quantity: 2, expiryDate: '01-11-2026' } // Non-ISO date
  ];
  const valResult = validateImportItems(candidateItems);
  assert(valResult.summary.total === 4, 'Validation summary total is 4');
  assert(valResult.summary.validCount === 1, 'Validation summary validCount is 1');
  assert(valResult.summary.invalidCount === 3, 'Validation summary invalidCount is 3');
  assert(valResult.invalid.some(inv => inv.errors.some(e => e.includes('nombre'))), 'Identifies missing name error');
  assert(valResult.invalid.some(inv => inv.errors.some(e => e.includes('cantidad'))), 'Identifies negative quantity error');
  assert(valResult.invalid.some(inv => inv.errors.some(e => e.includes('YYYY-MM-DD'))), 'Identifies date format error');

  // ============================================================================
  // SUITE 3: Conflict Resolution Multi-Strategy Matrix
  // ============================================================================
  console.log('\n--- SUITE 3: Conflict Resolution Multi-Strategy Matrix ---');

  const existingStock = [
    {
      id: 'p-1',
      name: 'Harina de Trigo',
      category: 'Otros',
      quantity: 10,
      unit: 'kg',
      receivedDate: '2026-10-01',
      expiryDate: '2026-12-01',
      location: 'Despensa',
      barcode: '7801234567890'
    },
    {
      id: 'p-2',
      name: 'Aceite de Oliva',
      category: 'Otros',
      quantity: 5,
      unit: 'L',
      receivedDate: '2026-10-05',
      expiryDate: '2027-01-01',
      location: 'Despensa',
      barcode: '7809876543210'
    }
  ];

  const incomingBatch = [
    {
      name: 'Harina de Trigo', // Match by name
      category: 'Otros',
      quantity: 5,
      unit: 'kg',
      receivedDate: '2026-10-26',
      expiryDate: '2026-12-15',
      location: 'Despensa'
    },
    {
      name: 'Aceite Extra Virgen', // Match by barcode
      barcode: '7809876543210',
      category: 'Otros',
      quantity: 3,
      unit: 'L',
      receivedDate: '2026-10-26',
      expiryDate: '2027-02-01',
      location: 'Despensa'
    },
    {
      name: 'Pimienta Negra', // Novel product
      category: 'Otros',
      quantity: 1,
      unit: 'kg',
      receivedDate: '2026-10-26',
      expiryDate: '2027-05-01',
      location: 'Despensa'
    }
  ];

  // 3.1 Strategy: 'merge'
  const mergeResult = resolveImportConflicts(incomingBatch, existingStock, 'merge');
  assert(mergeResult.toInsert.length === 1 && mergeResult.toInsert[0].name === 'Pimienta Negra', 'Merge: novel product sent to toInsert');
  assert(mergeResult.toUpdate.length === 2, 'Merge: 2 matching products sent to toUpdate');
  const flourUpdate = mergeResult.toUpdate.find(u => u.id === 'p-1');
  const oilUpdate = mergeResult.toUpdate.find(u => u.id === 'p-2');
  assert(flourUpdate && flourUpdate.updates.quantity === 15, 'Merge: Harina stock summed from 10 + 5 = 15');
  assert(oilUpdate && oilUpdate.updates.quantity === 8, 'Merge: Aceite stock summed from 5 + 3 = 8');
  assert(mergeResult.skippedCount === 0, 'Merge: skippedCount is 0');

  // 3.2 Strategy: 'replace'
  const replaceResult = resolveImportConflicts(incomingBatch, existingStock, 'replace');
  assert(replaceResult.toInsert.length === 1 && replaceResult.toInsert[0].name === 'Pimienta Negra', 'Replace: novel product sent to toInsert');
  assert(replaceResult.toUpdate.length === 2, 'Replace: 2 products updated');
  const flourReplace = replaceResult.toUpdate.find(u => u.id === 'p-1');
  assert(flourReplace && flourReplace.updates.quantity === 5, 'Replace: quantity overwritten with incoming 5');
  assert(flourReplace && flourReplace.updates.expiryDate === '2026-12-15', 'Replace: expiryDate overwritten with incoming 2026-12-15');

  // 3.3 Strategy: 'skip'
  const skipResult = resolveImportConflicts(incomingBatch, existingStock, 'skip');
  assert(skipResult.toInsert.length === 1 && skipResult.toInsert[0].name === 'Pimienta Negra', 'Skip: only novel product inserted');
  assert(skipResult.toUpdate.length === 0, 'Skip: toUpdate is empty');
  assert(skipResult.skippedCount === 2, 'Skip: 2 duplicates skipped');

  // 3.4 Strategy: 'append'
  const appendResult = resolveImportConflicts(incomingBatch, existingStock, 'append');
  assert(appendResult.toInsert.length === 3, 'Append: all 3 items inserted as new records');
  assert(appendResult.toUpdate.length === 0, 'Append: toUpdate is empty');
  assert(appendResult.skippedCount === 0, 'Append: skippedCount is 0');

  // ============================================================================
  // SUITE 4: Render Static Deployment ($0/month) & PWA Manifest Parity
  // ============================================================================
  console.log('\n--- SUITE 4: Render Static Deployment & PWA Manifest Invariants ---');

  // 4.1 Render YAML File Validation
  const renderYamlPath = path.join(PROJECT_ROOT, 'render.yaml');
  assert(fs.existsSync(renderYamlPath), 'render.yaml exists on disk');
  const renderYamlContent = fs.readFileSync(renderYamlPath, 'utf8');

  // Check specs:
  assert(renderYamlContent.includes('type: web'), 'render.yaml specifies service type: web');
  assert(renderYamlContent.includes('env: static'), 'render.yaml specifies env: static');
  assert(renderYamlContent.includes('plan: free'), 'render.yaml specifies plan: free ($0/month)');
  assert(renderYamlContent.includes('staticPublishPath: ./build'), 'render.yaml targets ./build directory');
  assert(renderYamlContent.includes('buildCommand: npm install && npm run build'), 'render.yaml uses correct build command');
  assert(renderYamlContent.includes('destination: /index.html'), 'render.yaml configures SPA rewrite to /index.html');
  assert(!renderYamlContent.includes('plan: starter') && !renderYamlContent.includes('plan: standard') && !renderYamlContent.includes('plan: pro'), 'render.yaml strictly forbids paid plans');
  assert(!renderYamlContent.includes('databases:'), 'render.yaml contains no paid database services ($0 constraint)');

  // 4.2 Manifest Parity & Integrity
  const staticManifestPath = path.join(PROJECT_ROOT, 'static/manifest.json');
  const rootManifestPath = path.join(PROJECT_ROOT, 'manifest.json');
  assert(fs.existsSync(staticManifestPath), 'static/manifest.json exists');
  assert(fs.existsSync(rootManifestPath), 'root manifest.json exists');

  const staticManifest = JSON.parse(fs.readFileSync(staticManifestPath, 'utf8'));
  const rootManifest = JSON.parse(fs.readFileSync(rootManifestPath, 'utf8'));

  assertEquals(staticManifest.name, 'StockControl - Control de Vencimientos', 'Manifest name is canonical');
  assertEquals(staticManifest.short_name, 'StockControl', 'Manifest short_name is canonical');
  assertEquals(staticManifest.display, 'standalone', 'Manifest display mode is standalone');
  assertEquals(staticManifest.start_url, '/', 'Manifest start_url is /');
  assertEquals(staticManifest.theme_color, '#75472f', 'Manifest culinary theme color is #75472f');
  assertEquals(staticManifest.background_color, '#fbf6ee', 'Manifest background color is #fbf6ee');
  assertEquals(staticManifest, rootManifest, 'static/manifest.json and root manifest.json are in 100% parity');

  // Check icons existence and valid PNG header
  const icon192Path = path.join(PROJECT_ROOT, 'static/assets/icon-192.png');
  const icon512Path = path.join(PROJECT_ROOT, 'static/assets/icon-512.png');
  assert(fs.existsSync(icon192Path), 'icon-192.png exists in static/assets/');
  assert(fs.existsSync(icon512Path), 'icon-512.png exists in static/assets/');

  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const icon192Buf = fs.readFileSync(icon192Path);
  const icon512Buf = fs.readFileSync(icon512Path);
  assert(icon192Buf.subarray(0, 8).equals(pngHeader), 'icon-192.png is a valid PNG image binary');
  assert(icon512Buf.subarray(0, 8).equals(pngHeader), 'icon-512.png is a valid PNG image binary');

  // ============================================================================
  // SUITE 5: Service Worker Precaching & Interception Invariants
  // ============================================================================
  console.log('\n--- SUITE 5: Service Worker Precaching & Interception Invariants ---');

  const swPath = path.join(PROJECT_ROOT, 'src/service-worker.ts');
  assert(fs.existsSync(swPath), 'src/service-worker.ts exists on disk');
  const swCode = fs.readFileSync(swPath, 'utf8');

  assert(swCode.includes("const CACHE_NAME = `stockcontrol-pwa-${version}`"), 'Service worker defines versioned CACHE_NAME');
  assert(swCode.includes("PRECACHE_ASSETS: string[] = ["), 'Service worker defines PRECACHE_ASSETS array');
  assert(swCode.includes("event.request.method !== 'GET'"), 'Service worker bypasses non-GET requests');
  assert(swCode.includes("url.origin !== sw.location.origin"), 'Service worker bypasses cross-origin requests (e.g. Firebase)');
  assert(swCode.includes("event.request.mode === 'navigate'"), 'Service worker handles SPA navigation requests with network-first');
  assert(swCode.includes("caches.match('/index.html')"), 'Service worker falls back to /index.html when navigation is offline');
  assert(swCode.includes("caches.delete(key)"), 'Service worker purges obsolete cache versions on activate');

  // Verify built service worker
  const builtSwPath = path.join(PROJECT_ROOT, 'build/service-worker.js');
  assert(fs.existsSync(builtSwPath), 'Production build generates build/service-worker.js');
  const builtSwCode = fs.readFileSync(builtSwPath, 'utf8');
  assert(builtSwCode.length > 500, 'Compiled service-worker.js is non-trivial binary');

  // ============================================================================
  // SUITE 6: Connectivity Store & Offline Pill Formatting Invariants
  // ============================================================================
  console.log('\n--- SUITE 6: Connectivity Store & Offline Pill Formatting ---');

  // Check initial state
  connectivityStore.reset();
  const initialConn = connectivityStore.get();
  assert(initialConn.online === true, 'Store starts online=true');
  assert(initialConn.pendingWrites === 0, 'Store starts with 0 pending writes');
  assert(initialConn.hasPendingWrites === false, 'Store starts with hasPendingWrites=false');

  // Helper from ConnectivityBanner.svelte
  function formatPillText(isOnline, pending) {
    if (isOnline) return null;
    if (pending > 0) return `Sin conexión (${pending} pendientes)`;
    return 'Modo sin conexión';
  }

  // 6.1 Online Pill Visibility
  assertEquals(formatPillText(true, 0), null, 'Online with 0 pending: pill hidden (null)');
  assertEquals(formatPillText(true, 5), null, 'Online with 5 pending: pill hidden (null)');

  // 6.2 Offline Pill Formatting
  connectivityStore.setOnline(false);
  assertEquals(formatPillText(connectivityStore.get().isOnline, connectivityStore.get().pendingWrites), 'Modo sin conexión', 'Offline with 0 pending: formats "Modo sin conexión"');

  connectivityStore.incrementPending();
  assertEquals(formatPillText(connectivityStore.get().isOnline, connectivityStore.get().pendingWrites), 'Sin conexión (1 pendientes)', 'Offline with 1 pending: formats "Sin conexión (1 pendientes)"');

  connectivityStore.incrementPending();
  connectivityStore.incrementPending();
  assertEquals(formatPillText(connectivityStore.get().isOnline, connectivityStore.get().pendingWrites), 'Sin conexión (3 pendientes)', 'Offline with 3 pending: formats "Sin conexión (3 pendientes)"');

  // 6.3 Pending Arithmetic & Clamping
  connectivityStore.decrementPending();
  assert(connectivityStore.get().pendingWrites === 2, 'decrementPending decrements to 2');

  connectivityStore.decrementPending();
  connectivityStore.decrementPending();
  connectivityStore.decrementPending(); // Underflow protection
  assert(connectivityStore.get().pendingWrites === 0, 'decrementPending clamps at 0 (never negative)');
  assert(connectivityStore.get().hasPendingWrites === false, 'hasPendingWrites false when count reaches 0');

  // 6.4 setPendingWrites Overload Stress
  connectivityStore.setPendingWrites(50);
  assert(connectivityStore.get().pendingWrites === 50 && connectivityStore.get().hasPendingWrites === true, 'setPendingWrites(50) sets count to 50');

  connectivityStore.setPendingWrites(true);
  assert(connectivityStore.get().pendingWrites === 50, 'setPendingWrites(true) preserves active count > 0');

  connectivityStore.clearPending();
  assert(connectivityStore.get().pendingWrites === 0 && connectivityStore.get().hasPendingWrites === false, 'clearPending() resets to 0');

  connectivityStore.setPendingWrites(true);
  assert(connectivityStore.get().pendingWrites >= 1, 'setPendingWrites(true) from 0 sets count to >= 1');

  connectivityStore.setPendingWrites(false);
  assert(connectivityStore.get().pendingWrites === 0, 'setPendingWrites(false) sets count to 0');

  // Reset to clean state
  connectivityStore.reset();

  await viteServer.close();

  // ============================================================================
  // SUMMARY REPORT
  // ============================================================================
  console.log('\n============================================================');
  console.log('       EMPIRICAL CHALLENGER ADVERSARIAL STRESS SUMMARY      ');
  console.log('============================================================');
  console.log(` TOTAL ASSERTIONS : ${totalTests}`);
  console.log(` PASSED           : ${passedTests}`);
  console.log(` FAILED           : ${failedTests}`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    console.error(`>>> ADVERSARIAL STRESS TEST FAILED WITH ${failedTests} FAILURES. VERDICT: REQUEST_CHANGES.`);
    process.exit(1);
  } else {
    console.log('>>> ALL ADVERSARIAL STRESS TESTS COMPLETED WITH 100% SUCCESS. VERDICT: APPROVE.\n');
    process.exit(0);
  }
}

runMilestone4AdversarialSuite().catch(err => {
  console.error('Fatal Test Exception:', err);
  process.exit(1);
});
