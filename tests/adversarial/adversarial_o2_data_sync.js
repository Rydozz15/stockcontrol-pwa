/**
 * StockControl PWA — Milestone O2 Adversarial Data & Firestore Sync Stress Harness
 * Author: challenger_o2_2 (Firestore & Data Sync Challenger)
 * Scope:
 *  1. Live Cloud Firestore stockcontrol-86bb7 Verification (22 products, 24 history logs, schemas)
 *  2. Sample Data Domain Logic across Leap Years, Boundary Days, and 4 Expiry Categories
 *  3. BatchImport Commit, Chunking Limits (200 items / 400 ops), and Reactive Store Sync
 *
 * Execution: node --env-file=.env tests/adversarial/adversarial_o2_data_sync.js
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    failureDetails.push(message);
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  totalTests++;
  const match = Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected);
  if (match) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    const errMsg = `${message} — Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`;
    failureDetails.push(errMsg);
    console.error(`  ✗ FAIL: ${errMsg}`);
  }
}

async function runAdversarialO2Suite() {
  console.log('================================================================');
  console.log('⚔️  MILESTONE O2 ADVERSARIAL DATA & FIRESTORE SYNC TEST SUITE  ⚔️');
  console.log('Agent: challenger_o2_2');
  console.log('Working Directory:', PROJECT_ROOT);
  console.log('================================================================\n');

  // Launch Vite SSR server for perfect TS resolution
  const vite = await createServer({
    root: PROJECT_ROOT,
    server: { middlewareMode: true },
    appType: 'custom',
    resolve: {
      alias: {
        'firebase/firestore': path.resolve(PROJECT_ROOT, 'tests/adversarial/mock_firestore.js')
      }
    }
  });

  const sampleDataModule = await vite.ssrLoadModule('/src/lib/domain/sampleData.ts');
  const expiryModule = await vite.ssrLoadModule('/src/lib/domain/expiry.ts');
  const modelsModule = await vite.ssrLoadModule('/src/lib/domain/models.ts');
  const repoModule = await vite.ssrLoadModule('/src/lib/repositories/productRepository.ts');
  const inventoryStoreModule = await vite.ssrLoadModule('/src/lib/stores/inventoryStore.ts');
  const mockFirestore = await vite.ssrLoadModule('/tests/adversarial/mock_firestore.js');

  console.log('  ✓ Loaded domain, repository, store, and mock modules via Vite SSR\n');

  // ==========================================================================
  // SECTION 1: LIVE CLOUD FIRESTORE AUDIT (stockcontrol-86bb7)
  // ==========================================================================
  console.log('--- SECTION 1: Live Cloud Firestore Audit (stockcontrol-86bb7) ---');

  const apiKey = process.env.PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;

  assert(Boolean(apiKey && projectId), 'Firebase credentials exist in environment (.env)');

  if (apiKey && projectId) {
    try {
      const firebaseConfig = {
        apiKey,
        authDomain: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId,
        storageBucket: process.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.PUBLIC_FIREBASE_APP_ID
      };

      const app = initializeApp(firebaseConfig, 'live-challenger-app');
      const db = getFirestore(app);

      // 1.1 Workspace document check
      const wsDocRef = doc(db, 'workspaces', 'cocina-principal');
      const wsSnap = await getDoc(wsDocRef);
      assert(wsSnap.exists(), 'Cloud Firestore workspace "cocina-principal" exists');
      if (wsSnap.exists()) {
        const wsData = wsSnap.data();
        assertEquals(wsData.id, 'cocina-principal', 'Workspace ID is "cocina-principal"');
        assertEquals(wsData.name, 'Cocina Principal', 'Workspace name is "Cocina Principal"');
        assert(wsData.settings?.criticalDaysThreshold === 3, 'Critical threshold is 3 days');
        assert(wsData.settings?.warningDaysThreshold === 7, 'Warning threshold is 7 days');
      }

      // 1.2 Products collection check
      const prodsSnap = await getDocs(collection(db, 'workspaces', 'cocina-principal', 'products'));
      assertEquals(prodsSnap.size, 22, 'Cloud Firestore products collection contains EXACTLY 22 products');

      let validProdSchemas = 0;
      let activeQuantitySum = 0;
      prodsSnap.forEach(d => {
        const p = d.data();
        if (
          p.id &&
          typeof p.name === 'string' &&
          p.name.length > 0 &&
          typeof p.quantity === 'number' &&
          p.quantity > 0 &&
          typeof p.expiryDate === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(p.expiryDate) &&
          typeof p.category === 'string' &&
          typeof p.location === 'string' &&
          p.isDiscarded === false &&
          p.isConsumed === false
        ) {
          validProdSchemas++;
          activeQuantitySum += p.quantity;
        }
      });
      assertEquals(validProdSchemas, 22, 'All 22 products have complete valid schemas, dates and quantities');
      assert(activeQuantitySum > 0, `Total active stock in cloud is ${activeQuantitySum}`);

      // 1.3 History collection check
      const histSnap = await getDocs(collection(db, 'workspaces', 'cocina-principal', 'history'));
      assertEquals(histSnap.size, 24, 'Cloud Firestore history collection contains EXACTLY 24 audit logs');

      let createCount = 0;
      let consumeCount = 0;
      let discardCount = 0;
      histSnap.forEach(d => {
        const h = d.data();
        if (h.action === 'CREATE') createCount++;
        else if (h.action === 'CONSUME_PARTIAL' || h.action === 'CONSUME_FULL') consumeCount++;
        else if (h.action === 'DISCARD') discardCount++;
      });

      assertEquals(createCount, 22, 'History contains 22 CREATE actions matching 22 products');
      assertEquals(consumeCount, 1, 'History contains 1 CONSUME audit action');
      assertEquals(discardCount, 1, 'History contains 1 DISCARD audit action');
    } catch (err) {
      assert(false, `Live Cloud Firestore query failed with error: ${err.message}`);
    }
  }

  // ==========================================================================
  // SECTION 2: SAMPLE DATA DOMAIN & DATE MATH ACROSS LEAP YEARS & BOUNDARIES
  // ==========================================================================
  console.log('\n--- SECTION 2: Sample Data Logic & Date Math Stress ---');

  const { getSampleKitchenProducts } = sampleDataModule;
  const { calculateExpiryStatus, calculateMetrics, addDaysSafe, parseLocalDate } = expiryModule;

  // 2.1 Basic Structure and Count
  const defaultSample = getSampleKitchenProducts();
  assertEquals(defaultSample.length, 8, 'getSampleKitchenProducts returns exactly 8 realistic kitchen ingredients');

  // Verify all 8 barcodes are 13-digit EAN
  let validBarcodes = 0;
  for (const item of defaultSample) {
    if (item.barcode && /^\d{13}$/.test(item.barcode)) {
      validBarcodes++;
    }
  }
  assertEquals(validBarcodes, 8, 'All 8 sample products provide valid 13-digit EAN barcodes');

  // 2.2 Leap Year & Boundary Days Invariant Verification
  // We test getSampleKitchenProducts across critical test days:
  const criticalTestDates = [
    new Date(2024, 1, 28), // 2024-02-28 (day before leap day)
    new Date(2024, 1, 29), // 2024-02-29 (leap day itself)
    new Date(2024, 2, 1),  // 2024-03-01 (day after leap day)
    new Date(2025, 1, 28), // 2025-02-28 (non-leap year Feb end)
    new Date(2026, 1, 28), // 2026-02-28 (current non-leap year Feb end)
    new Date(2026, 11, 31), // 2026-12-31 (New Year eve)
    new Date(2027, 0, 1),   // 2027-01-01 (New Year day)
    new Date(2028, 1, 29),  // 2028-02-29 (next leap day)
    new Date(2000, 1, 29),  // 2000-02-29 (400-year centennial leap day)
    new Date(2100, 1, 28)   // 2100-02-28 (100-year non-leap day)
  ];

  for (const testDate of criticalTestDates) {
    const dateStr = testDate.toISOString().slice(0, 10);
    const samples = getSampleKitchenProducts(testDate);

    // Verify each item's date format
    let validDates = true;
    for (const item of samples) {
      if (!parseLocalDate(item.receivedDate) || !parseLocalDate(item.expiryDate)) {
        validDates = false;
      }
    }
    assert(validDates, `All 8 sample products have strictly valid calendar dates on ${dateStr}`);

    // Verify 4-category mapping
    const metrics = calculateMetrics(samples, testDate);
    assertEquals(metrics.total, 8, `Metrics total is 8 on ${dateStr}`);
    assertEquals(metrics.expired, 1, `Metrics expired is 1 on ${dateStr}`);
    assertEquals(metrics.soon, 2, `Metrics soon is 2 on ${dateStr}`);
    assertEquals(metrics.week, 2, `Metrics week is 2 on ${dateStr}`);
    assertEquals(metrics.ok, 3, `Metrics ok is 3 on ${dateStr}`);
    assertEquals(metrics.within7Days, 4, `Metrics within7Days is 4 (soon+week) on ${dateStr}`);
    assertEquals(metrics.criticalTotal, 3, `Metrics criticalTotal is 3 (expired+soon) on ${dateStr}`);
    assertEquals(metrics.discardedCount, 0, `Metrics discardedCount is 0 on ${dateStr}`);
    assertEquals(metrics.consumedCount, 0, `Metrics consumedCount is 0 on ${dateStr}`);

    // Individual item statuses
    const s0 = calculateExpiryStatus(samples[0].expiryDate, testDate);
    const s1 = calculateExpiryStatus(samples[1].expiryDate, testDate);
    const s2 = calculateExpiryStatus(samples[2].expiryDate, testDate);
    const s3 = calculateExpiryStatus(samples[3].expiryDate, testDate);
    const s4 = calculateExpiryStatus(samples[4].expiryDate, testDate);
    const s5 = calculateExpiryStatus(samples[5].expiryDate, testDate);
    const s6 = calculateExpiryStatus(samples[6].expiryDate, testDate);
    const s7 = calculateExpiryStatus(samples[7].expiryDate, testDate);

    assert(s0.key === 'expired' && s0.daysRemaining === -1, `Item 0 (Leche) is expired (-1d) on ${dateStr}`);
    assert(s1.key === 'soon' && s1.daysRemaining === 0, `Item 1 (Salmón) is soon (0d) on ${dateStr}`);
    assert(s2.key === 'soon' && s2.daysRemaining === 2, `Item 2 (Pollo) is soon (+2d) on ${dateStr}`);
    assert(s3.key === 'week' && s3.daysRemaining === 5, `Item 3 (Queso) is week (+5d) on ${dateStr}`);
    assert(s4.key === 'week' && s4.daysRemaining === 6, `Item 4 (Tomate) is week (+6d) on ${dateStr}`);
    assert(s5.key === 'ok' && s5.daysRemaining === 60, `Item 5 (Arroz) is ok (+60d) on ${dateStr}`);
    assert(s6.key === 'ok' && s6.daysRemaining === 90, `Item 6 (Aceite) is ok (+90d) on ${dateStr}`);
    assert(s7.key === 'ok' && s7.daysRemaining === 45, `Item 7 (Hojaldre) is ok (+45d) on ${dateStr}`);
  }

  // 2.3 Full 366-day leap year 2024 simulation
  let allDaysPassed = true;
  for (let day = 1; day <= 366; day++) {
    const d = new Date(2024, 0, day);
    const samples = getSampleKitchenProducts(d);
    const m = calculateMetrics(samples, d);
    if (m.total !== 8 || m.expired !== 1 || m.soon !== 2 || m.week !== 2 || m.ok !== 3) {
      allDaysPassed = false;
      break;
    }
  }
  assert(allDaysPassed, 'Full 366-day continuous simulation of 2024 maintains 100% invariant consistency');

  // ==========================================================================
  // SECTION 3: BATCHIMPORT COMMIT, CHUNKING LIMITS & REACTIVITY
  // ==========================================================================
  console.log('\n--- SECTION 3: BatchImport Execution & Local Reactivity Stress ---');

  const { FirestoreProductRepository, sanitizeFirestorePayload } = repoModule;
  const { inventoryStore, filteredProducts } = inventoryStoreModule;
  const { mockFirestoreState, collection: mockCollection, doc: mockDoc, writeBatch: mockWriteBatch } = mockFirestore;

  mockFirestoreState.reset();

  // 3.1 Sanitize payload edge cases
  const dirtyPayload = {
    name: 'Harina',
    lot: undefined,
    supplier: 'Molino',
    notes: undefined,
    barcode: ''
  };
  const cleaned = sanitizeFirestorePayload(dirtyPayload);
  assert(!('lot' in cleaned) && !('notes' in cleaned), 'sanitizeFirestorePayload strips undefined keys');
  assert('name' in cleaned && 'supplier' in cleaned && 'barcode' in cleaned, 'sanitizeFirestorePayload preserves valid values');

  // 3.2 Mock DB for FirestoreProductRepository
  const mockDbInstance = {
    type: 'mock-firestore'
  };

  // Instantiate repo with custom mock DB
  const testRepo = new FirestoreProductRepository(mockDbInstance);

  // 3.3 BatchImport with 0 items
  const zeroImport = await testRepo.batchImport('cocina-principal', [], 'Operador');
  assertEquals(zeroImport, 0, 'batchImport with empty array returns 0 cleanly');
  assertEquals(mockFirestoreState.commitCount, 0, 'No commit called for empty array');

  // 3.4 BatchImport with 8 sample products
  mockFirestoreState.reset();
  const sample8 = getSampleKitchenProducts();
  const importedCount = await testRepo.batchImport('cocina-principal', sample8, 'Carlos - Chef');
  assertEquals(importedCount, 8, 'batchImport with 8 sample items returns 8');
  assertEquals(mockFirestoreState.commitCount, 1, '8 items committed in exactly 1 batch');

  // Verify docs written into mockFirestoreState
  let createdProducts = 0;
  let createdHistories = 0;
  for (const [docPath, data] of mockFirestoreState.docs.entries()) {
    if (docPath.includes('workspaces/cocina-principal/products/')) {
      createdProducts++;
      assert(data.updatedBy === 'Carlos - Chef', 'Product updatedBy set to operator alias');
    }
    if (docPath.includes('workspaces/cocina-principal/history/')) {
      createdHistories++;
      assert(data.action === 'create', 'History entry action set to "create"');
      assert(data.operator === 'Carlos - Chef', 'History operator set to operator alias');
    }
  }
  assertEquals(createdProducts, 8, 'Mock Firestore contains exactly 8 created products');
  assertEquals(createdHistories, 8, 'Mock Firestore contains exactly 8 created history audit logs');

  // 3.5 Massive BatchImport (450 items) testing CHUNK_SIZE = 200 limit (max 500 ops)
  mockFirestoreState.reset();
  const massiveProducts = [];
  for (let i = 0; i < 450; i++) {
    massiveProducts.push({
      ...sample8[i % 8],
      name: `Massive Item ${i}`
    });
  }

  const massiveImported = await testRepo.batchImport('cocina-principal', massiveProducts, 'Operador');
  assertEquals(massiveImported, 450, 'batchImport cleanly handled 450 items');
  // 450 items / 200 chunk size = 3 batches (200, 200, 50)
  assertEquals(mockFirestoreState.commitCount, 3, '450 items committed across 3 batches respecting 500-op Firestore limit');

  for (let b = 0; b < mockFirestoreState.committedBatches.length; b++) {
    const batchOps = mockFirestoreState.committedBatches[b].length;
    assert(batchOps <= 400, `Batch #${b + 1} operations count (${batchOps}) is strictly <= 400 (under 500 limit)`);
  }

  // 3.6 Local Reactivity & Derived Store Verification
  console.log('\n--- SECTION 4: Store Reactivity & Filtering Verification ---');
  inventoryStore.reset();

  let observedProducts = [];
  const unsubStore = inventoryStore.subscribe(state => {
    observedProducts = state.products;
  });

  assertEquals(observedProducts.length, 0, 'Initial store product count is 0');

  // Simulate snapshot arrival after sample import
  const sampleProductsWithIds = sample8.map((p, idx) => ({
    ...p,
    id: `prod-sample-${idx}`
  }));

  inventoryStore.setProducts(sampleProductsWithIds, false);
  assertEquals(observedProducts.length, 8, 'inventoryStore reactively updated to 8 products upon snapshot dispatch');

  // Check derived filteredProducts
  let currentFiltered = [];
  const unsubFiltered = filteredProducts.subscribe(list => {
    currentFiltered = list;
  });

  assertEquals(currentFiltered.length, 8, 'filteredProducts initially exposes all 8 active products');

  // Test category filtering
  inventoryStore.setFilterCategory('Lácteos');
  assertEquals(currentFiltered.length, 2, 'Filtering by "Lácteos" reactively isolates 2 dairy products');

  // Test location filtering
  inventoryStore.setFilterCategory(null);
  inventoryStore.setFilterLocation('Bodega seca');
  assertEquals(currentFiltered.length, 2, 'Filtering by "Bodega seca" reactively isolates 2 dry storage items');

  // Test search query
  inventoryStore.setFilterLocation(null);
  inventoryStore.setSearchQuery('salmón');
  assertEquals(currentFiltered.length, 1, 'Search query "salmón" reactively yields 1 result');
  assertEquals(currentFiltered[0].name, 'Filete de salmón fresco', 'Found product name matches query');

  // Test consuming one product
  const consumeRes = inventoryStore.consumeOne('prod-sample-1');
  assert(consumeRes !== null && consumeRes.previousQuantity === 3.5, 'consumeOne successfully decrements quantity reactively');

  unsubStore();
  unsubFiltered();
  await vite.close();

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`🏁 ADVERSARIAL O2 SUITE SUMMARY: ${passedTests}/${totalTests} ASSERTIONS PASSED`);
  if (failedTests > 0) {
    console.error(`❌ FAILED ASSERTIONS: ${failedTests}`);
    for (const f of failureDetails) {
      console.error(`   - ${f}`);
    }
  } else {
    console.log('🎉 100% ASSERTIONS CLEANLY PASSED WITH ZERO FAILURES!');
  }
  console.log('================================================================\n');

  process.exit(failedTests === 0 ? 0 : 1);
}

runAdversarialO2Suite().catch(err => {
  console.error('FATAL SUITE CRASH:', err);
  process.exit(1);
});
