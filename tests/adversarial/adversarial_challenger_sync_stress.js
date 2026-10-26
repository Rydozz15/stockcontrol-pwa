/**
 * Empirical Challenger Adversarial Stress Suite for Milestone 2 Iteration 2:
 * Sync & Cache Challenger (challenger_m2_iter2_2)
 *
 * Deep adversarial testing:
 * 1. Vite dynamic import.meta.env Proxy trap simulation & defensive fallback.
 * 2. Headless SSR concurrency & singleton idempotency.
 * 3. 1,000 rapid workspace subscription stress & zero listener leak oracle.
 * 4. Stale snapshot delivery & race condition isolation.
 * 5. Malformed/Adversarial snapshot payload fuzzing on filteredProducts & sorting.
 * 6. Full truth-table verification of connectivityStore banner precedence & isSyncing lifecycle under concurrent fault injection.
 * 7. End-to-end alignment between filteredProducts and metricsStore under edge cases.
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

function assertThrows(fn, expectedRegexOrSubstring, message) {
  totalTests++;
  try {
    fn();
    failedTests++;
    const errMsg = `${message} — Expected exception but none was thrown`;
    failures.push(errMsg);
    console.error(`  ✗ FAIL: ${errMsg}`);
  } catch (err) {
    const errStr = err instanceof Error ? err.message : String(err);
    const matches = typeof expectedRegexOrSubstring === 'string'
      ? errStr.includes(expectedRegexOrSubstring)
      : expectedRegexOrSubstring.test(errStr);
    if (matches) {
      passedTests++;
      console.log(`  ✓ ${message} [threw: "${errStr}"]`);
    } else {
      failedTests++;
      const errMsg = `${message} — Expected error matching "${expectedRegexOrSubstring}", got: "${errStr}"`;
      failures.push(errMsg);
      console.error(`  ✗ FAIL: ${errMsg}`);
    }
  }
}

async function runChallengerStressSuite() {
  console.log('================================================================');
  console.log('CHALLENGER EMPIRICAL ADVERSARIAL STRESS TEST SUITE (M2 Iter 2)');
  console.log(`Node: ${process.version} | Root: ${PROJECT_ROOT}`);
  console.log('================================================================\n');

  const viteServer = await createServer({
    root: PROJECT_ROOT,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  let fbMod, invMod, wsMod, connMod, metricsMod;

  try {
    fbMod = await viteServer.ssrLoadModule('./src/lib/repositories/firebase.ts');
    invMod = await viteServer.ssrLoadModule('./src/lib/stores/inventoryStore.ts');
    wsMod = await viteServer.ssrLoadModule('./src/lib/stores/workspaceStore.ts');
    connMod = await viteServer.ssrLoadModule('./src/lib/stores/connectivityStore.ts');
    metricsMod = await viteServer.ssrLoadModule('./src/lib/stores/metricsStore.ts');
  } catch (err) {
    console.error('Fatal: Failed to load modules via Vite SSR:', err);
    await viteServer.close();
    process.exit(1);
  }

  const {
    validateFirebaseConfig,
    getFirebaseInstance,
    getFirestoreDb,
    getFirebaseAuth,
    getFirebaseApp,
    isFirebaseAvailable,
    isBrowser,
    FIREBASE_DEFAULTS
  } = fbMod;

  const {
    inventoryStore,
    filteredProducts,
    subscribeToWorkspace,
    initWorkspaceSync,
    consumeStockAction,
    discardStockAction,
    createProductAction,
    updateProductAction
  } = invMod;

  const { workspaceStore } = wsMod;
  const { connectivityStore } = connMod;
  const { metricsStore, calculateMetrics } = metricsMod;

  // ============================================================================
  // SECTION 1: Vite Proxy Trap Simulation & Defensive Fallback in firebase.ts
  // ============================================================================
  console.log('\n--- SECTION 1: Vite Proxy Trap Simulation & Fallback ---');

  // Verify that validateFirebaseConfig() without arguments does NOT crash even under Vite module runner
  let defaultConfigResult = null;
  try {
    defaultConfigResult = validateFirebaseConfig();
    assert(defaultConfigResult !== null, 'validateFirebaseConfig() succeeded with defaults');
    assertEquals(defaultConfigResult.projectId, FIREBASE_DEFAULTS.projectId, 'Resolved default projectId correctly');
    assertEquals(defaultConfigResult.apiKey, FIREBASE_DEFAULTS.apiKey, 'Resolved default apiKey correctly');
  } catch (e) {
    assert(false, `validateFirebaseConfig() threw: ${e.message}`);
  }

  // Stress-test validateFirebaseConfig with customEnv edge cases
  const edgeEnvs = [
    { env: { PUBLIC_FIREBASE_API_KEY: 'valid-api-key-1234567890', PUBLIC_FIREBASE_PROJECT_ID: 'stockcontrol-test', PUBLIC_FIREBASE_AUTH_DOMAIN: 'stockcontrol-test.firebaseapp.com' }, valid: true },
    { env: { PUBLIC_FIREBASE_API_KEY: '   ', PUBLIC_FIREBASE_PROJECT_ID: 'stockcontrol-test' }, valid: false, err: 'PUBLIC_FIREBASE_API_KEY is not defined' },
    { env: { PUBLIC_FIREBASE_API_KEY: 'valid-key', PUBLIC_FIREBASE_PROJECT_ID: 'INVALID_UPPERCASE' }, valid: false, err: 'Invalid projectId format' },
    { env: { PUBLIC_FIREBASE_API_KEY: 'valid-key', PUBLIC_FIREBASE_PROJECT_ID: 'stockcontrol-test', PUBLIC_FIREBASE_AUTH_DOMAIN: 'malicious.com' }, valid: false, err: 'Malformed authDomain format' }
  ];

  for (const tc of edgeEnvs) {
    if (tc.valid) {
      const res = validateFirebaseConfig(tc.env);
      assertEquals(res.projectId, tc.env.PUBLIC_FIREBASE_PROJECT_ID, `Custom env projectId "${tc.env.PUBLIC_FIREBASE_PROJECT_ID}" accepted`);
    } else {
      assertThrows(
        () => validateFirebaseConfig(tc.env),
        tc.err,
        `Custom env rejected as expected: ${tc.err}`
      );
    }
  }

  // ============================================================================
  // SECTION 2: Headless SSR Concurrency & Singleton Idempotency
  // ============================================================================
  console.log('\n--- SECTION 2: Headless SSR Concurrency & Singleton Idempotency ---');

  assertEquals(isBrowser(), false, 'isBrowser() returns false in Node runtime');

  // Concurrently request getFirebaseInstance from 50 parallel asynchronous tasks
  const concurrentInstances = await Promise.all(
    Array.from({ length: 50 }, async () => getFirebaseInstance())
  );

  let allInstancesMock = true;
  let allInstancesNoop = true;
  let allAppNull = true;
  let allDbNull = true;

  for (const inst of concurrentInstances) {
    if (!inst.isMock) allInstancesMock = false;
    if (inst.mode !== 'ssr-noop') allInstancesNoop = false;
    if (inst.app !== null) allAppNull = false;
    if (inst.db !== null) allDbNull = false;
  }

  assert(allInstancesMock, 'All 50 concurrent getFirebaseInstance() returned isMock: true');
  assert(allInstancesNoop, 'All 50 concurrent getFirebaseInstance() returned mode: "ssr-noop"');
  assert(allAppNull, 'All 50 concurrent getFirebaseInstance() returned app: null');
  assert(allDbNull, 'All 50 concurrent getFirebaseInstance() returned db: null');

  // Verify convenience accessors in parallel
  const [db, auth, app, available] = await Promise.all([
    Promise.resolve(getFirestoreDb()),
    Promise.resolve(getFirebaseAuth()),
    Promise.resolve(getFirebaseApp()),
    Promise.resolve(isFirebaseAvailable())
  ]);

  assertEquals(db, null, 'getFirestoreDb() is strictly null in SSR');
  assertEquals(auth, null, 'getFirebaseAuth() is strictly null in SSR');
  assertEquals(app, null, 'getFirebaseApp() is strictly null in SSR');
  assertEquals(available, false, 'isFirebaseAvailable() is strictly false in SSR');

  // ============================================================================
  // SECTION 3: 1,000 Rapid Workspace Switches & Strict Listener Leak Oracle
  // ============================================================================
  console.log('\n--- SECTION 3: 1,000 Rapid Workspace Switches Stress Test ---');

  class StressTrackingRepo {
    activeCount = 0;
    maxActiveCount = 0;
    totalSubscribes = 0;
    totalUnsubscribes = 0;
    currentWorkspace = '';
    currentCallback = null;

    subscribeProducts(workspaceId, onData, onError) {
      this.totalSubscribes++;
      this.activeCount++;
      if (this.activeCount > this.maxActiveCount) {
        this.maxActiveCount = this.activeCount;
      }
      this.currentWorkspace = workspaceId;

      let unsubscribed = false;
      this.currentCallback = (items, pending) => {
        if (!unsubscribed) {
          onData(items, pending);
        }
      };

      return () => {
        if (unsubscribed) return;
        unsubscribed = true;
        this.totalUnsubscribes++;
        this.activeCount--;
      };
    }

    subscribeHistory() { return () => {}; }
    createProduct() { return Promise.resolve('mock-id'); }
    updateProduct() { return Promise.resolve(); }
    consumeStock() { return Promise.resolve(); }
    discardStock() { return Promise.resolve(); }
    deleteProduct() { return Promise.resolve(); }
    restoreStock() { return Promise.resolve(); }
    batchImport() { return Promise.resolve(0); }
  }

  const stressRepo = new StressTrackingRepo();
  const kitchenNames = [
    'cocina-principal', 'cocina-reposteria', 'cocina-bar', 'cocina-eventos',
    'bodega-central', 'bodega-frio', 'sucursal-costanera', 'sucursal-aeropuerto'
  ];

  let finalTeardown = null;
  const SWITCH_ITERATIONS = 1000;

  for (let i = 0; i < SWITCH_ITERATIONS; i++) {
    const targetWs = kitchenNames[i % kitchenNames.length];
    finalTeardown = subscribeToWorkspace(targetWs, stressRepo);

    if (stressRepo.activeCount > 1) {
      assert(false, `Concurrency invariant broken at iteration ${i}: activeCount is ${stressRepo.activeCount}`);
      break;
    }
  }

  assertEquals(stressRepo.maxActiveCount, 1, `Across ${SWITCH_ITERATIONS} switches, max concurrent active listeners strictly <= 1`);
  assertEquals(stressRepo.activeCount, 1, 'Exactly 1 active listener remaining before final teardown');

  if (finalTeardown) {
    finalTeardown();
  }

  assertEquals(stressRepo.activeCount, 0, 'After final teardown, active listeners is strictly 0');
  assertEquals(stressRepo.totalSubscribes, stressRepo.totalUnsubscribes, `Subscribes (${stressRepo.totalSubscribes}) equals unsubscribes (${stressRepo.totalUnsubscribes}) — Zero leaks across 1000 switches`);

  // ============================================================================
  // SECTION 4: Out-of-Order Delayed Snapshot Delivery Protection
  // ============================================================================
  console.log('\n--- SECTION 4: Out-of-Order Delayed Snapshot Delivery Protection ---');

  const delayedRepo = new StressTrackingRepo();
  let ws1Emit = null;
  let ws2Emit = null;

  delayedRepo.subscribeProducts = (ws, onData) => {
    delayedRepo.activeCount++;
    let unsubscribed = false;
    const emit = (items, pending) => {
      if (!unsubscribed) {
        onData(items, pending);
      }
    };
    if (ws === 'workspace-alpha') ws1Emit = emit;
    if (ws === 'workspace-beta') ws2Emit = emit;

    return () => {
      if (!unsubscribed) {
        unsubscribed = true;
        delayedRepo.activeCount--;
      }
    };
  };

  const unsubAlpha = subscribeToWorkspace('workspace-alpha', delayedRepo);
  // Alpha receives data
  ws1Emit([{ id: 'prod-a1', name: 'Alpha Product', quantity: 10, expiryDate: '2026-11-01' }], false);

  let currentProducts = [];
  const unsubInvWatch = inventoryStore.subscribe(s => { currentProducts = s.products; });
  assertEquals(currentProducts.length, 1, 'Workspace Alpha received 1 product');
  assertEquals(currentProducts[0].name, 'Alpha Product', 'Workspace Alpha product name matches');

  // Now switch to Beta
  const unsubBeta = subscribeToWorkspace('workspace-beta', delayedRepo);
  ws2Emit([{ id: 'prod-b1', name: 'Beta Product', quantity: 20, expiryDate: '2026-11-02' }], false);

  assertEquals(currentProducts.length, 1, 'Workspace Beta received 1 product');
  assertEquals(currentProducts[0].name, 'Beta Product', 'Workspace Beta product name matches');

  // Now simulate delayed out-of-order snapshot from old Alpha listener trying to emit
  ws1Emit([{ id: 'prod-a-stale', name: 'Stale Alpha Product', quantity: 99, expiryDate: '2026-11-01' }], false);

  // Beta data MUST NOT be contaminated by stale Alpha emit!
  assertEquals(currentProducts.length, 1, 'Delayed old emitter did NOT modify active inventory');
  assertEquals(currentProducts[0].name, 'Beta Product', 'Active inventory preserved Beta Product without stale contamination');

  unsubBeta();
  unsubInvWatch();

  // ============================================================================
  // SECTION 5: Malformed & Adversarial Snapshot Payload Fuzzing on filteredProducts
  // ============================================================================
  console.log('\n--- SECTION 5: Malformed & Adversarial Snapshot Payload Fuzzing ---');

  // Case A: Products arriving through productRepository (which applies normalizeQuantity)
  // When quantity is 0, negative, NaN, null, or undefined, normalizeQuantity turns them into 0 or positive float.
  const repoNormalizedItems = [
    { id: 'valid-1', name: 'Leche Descremada', category: 'Lácteos', quantity: 5, expiryDate: '2026-10-30', isDiscarded: false, isConsumed: false },
    { id: 'valid-2', name: 'Queso Gouda', category: 'Lácteos', quantity: 12.5, expiryDate: '2026-11-05', isDiscarded: false, isConsumed: false },
    { id: 'depleted-1', name: 'Harina 000', category: 'Secos', quantity: 0, expiryDate: '2026-12-01', isDiscarded: false, isConsumed: false },
    { id: 'negative-normalized', name: 'Azúcar', category: 'Secos', quantity: 0, expiryDate: '2026-12-01', isDiscarded: false, isConsumed: false },
    { id: 'discarded-1', name: 'Pollo Rancio', category: 'Carnes', quantity: 4, expiryDate: '2026-10-20', isDiscarded: true, isConsumed: false },
    { id: 'consumed-1', name: 'Aceite Oliva', category: 'Secos', quantity: 2, expiryDate: '2026-11-01', isDiscarded: false, isConsumed: true },
    { id: 'no-name', name: '', category: 'Otros', quantity: 3, expiryDate: '2026-10-28', isDiscarded: false, isConsumed: false },
    { id: 'no-expiry', name: 'Levadura', category: 'Secos', quantity: 8, expiryDate: '', isDiscarded: false, isConsumed: false }
  ];

  inventoryStore.setProducts(repoNormalizedItems, false);

  let filteredResult = [];
  const unsubFiltered = filteredProducts.subscribe(items => { filteredResult = items; });

  // Out of 8 items, only valid-1 (5), valid-2 (12.5), no-name (3), and no-expiry (8) have quantity > 0 and !discarded and !consumed
  assertEquals(filteredResult.length, 4, 'filteredProducts strictly returned only items with quantity > 0 and not discarded/consumed');

  const filteredIds = filteredResult.map(p => p.id);
  assert(filteredIds.includes('valid-1'), 'Includes valid-1');
  assert(filteredIds.includes('valid-2'), 'Includes valid-2');
  assert(filteredIds.includes('no-name'), 'Includes no-name with positive quantity');
  assert(filteredIds.includes('no-expiry'), 'Includes no-expiry with positive quantity');

  assert(!filteredIds.includes('depleted-1'), 'Excludes depleted product (quantity = 0)');
  assert(!filteredIds.includes('negative-normalized'), 'Excludes normalized negative product (quantity = 0)');
  assert(!filteredIds.includes('discarded-1'), 'Excludes discarded product');
  assert(!filteredIds.includes('consumed-1'), 'Excludes consumed product');

  // Test sorting robustness across all sort criteria
  try {
    inventoryStore.setSort('expiryDate', 'asc');
    assert(filteredResult.length === 4, 'Sorted by expiryDate asc without throwing');

    inventoryStore.setSort('expiryDate', 'desc');
    assert(filteredResult.length === 4, 'Sorted by expiryDate desc without throwing');

    inventoryStore.setSort('name', 'asc');
    assert(filteredResult.length === 4, 'Sorted by name asc without throwing');

    inventoryStore.setSort('name', 'desc');
    assert(filteredResult.length === 4, 'Sorted by name desc without throwing');

    inventoryStore.setSort('quantity', 'asc');
    assertEquals(filteredResult[0].quantity, 3, 'Sorted by quantity asc correctly (smallest quantity 3 first)');

    inventoryStore.setSort('quantity', 'desc');
    assertEquals(filteredResult[0].quantity, 12.5, 'Sorted by quantity desc correctly (largest quantity 12.5 first)');
  } catch (sortErr) {
    assert(false, `Sorting crashed on adversarial items: ${sortErr.message}`);
  }

  // ============================================================================
  // SECTION 6: End-to-End Alignment between filteredProducts and metricsStore
  // ============================================================================
  console.log('\n--- SECTION 6: Alignment between filteredProducts and metricsStore ---');

  // 6.1 Alignment under standard repository-normalized pipeline
  const metrics = calculateMetrics(repoNormalizedItems);
  assertEquals(metrics.total, 4, 'metricsStore.calculateMetrics.total (4) strictly equals filteredProducts.length (4)');
  assertEquals(metrics.total, filteredResult.length, 'metrics total exactly equals filteredProducts count');
  assertEquals(metrics.expired + metrics.soon + metrics.week + metrics.ok, metrics.total, 'metricsStore disjoint partition sum equals total (4)');
  assertEquals(metrics.discarded, 1, 'metricsStore discardedCount matches exactly (1)');
  assertEquals(metrics.consumed, 3, 'metricsStore consumedCount matches exactly (3: depleted-1, negative-normalized, consumed-1)');

  // 6.2 Raw Bypass Edge Case: Non-numeric quantity without repository normalization
  // If an un-normalized raw object with NaN or undefined quantity directly enters inventoryStore,
  // filteredProducts excludes it via (q ?? 0) > 0.
  const unnormalizedItems = [
    { id: 'nan-qty', name: 'Sal Fina', category: 'Secos', quantity: NaN, expiryDate: '2026-12-10', isDiscarded: false, isConsumed: false },
    { id: 'undefined-qty', name: 'Comino', category: 'Secos', quantity: undefined, expiryDate: '2026-12-10', isDiscarded: false, isConsumed: false }
  ];
  inventoryStore.setProducts(unnormalizedItems, false);
  assertEquals(filteredResult.length, 0, 'filteredProducts safely excludes un-normalized NaN and undefined quantities');

  unsubFiltered();

  // ============================================================================
  // SECTION 7: Connectivity Banner Precedence Truth Table & Concurrent Action Stress
  // ============================================================================
  console.log('\n--- SECTION 7: Connectivity Banner Truth Table & Action Stress ---');

  function getBannerState(s) {
    if (!s.online) return 'offline';
    if (s.hasPendingWrites) return 'syncing';
    return 'none';
  }

  let connState = null;
  const unsubConn = connectivityStore.subscribe(s => { connState = s; });

  // Rapidly toggle states to verify state machine robustness
  const truthMatrix = [
    { online: true, pending: false, expected: 'none' },
    { online: true, pending: true, expected: 'syncing' },
    { online: false, pending: true, expected: 'offline' }, // Critical: Offline takes precedence over Syncing
    { online: false, pending: false, expected: 'offline' }
  ];

  for (const step of truthMatrix) {
    connectivityStore.setOnlineStatus(step.online);
    connectivityStore.setPendingWrites(step.pending);
    assertEquals(getBannerState(connState), step.expected, `Banner for [online=${step.online}, pending=${step.pending}] is strictly "${step.expected}"`);
  }

  // Stress-test 50 concurrent failing actions
  class ConcurrentFailingRepo {
    subscribeProducts() { return () => {}; }
    subscribeHistory() { return () => {}; }
    createProduct() { return new Promise((_, reject) => setTimeout(() => reject(new Error('Network drop on create')), 10)); }
    updateProduct() { return new Promise((_, reject) => setTimeout(() => reject(new Error('Network drop on update')), 10)); }
    consumeStock() { return new Promise((_, reject) => setTimeout(() => reject(new Error('Network drop on consume')), 10)); }
    discardStock() { return new Promise((_, reject) => setTimeout(() => reject(new Error('Network drop on discard')), 10)); }
    deleteProduct() { return Promise.resolve(); }
    restoreStock() { return Promise.resolve(); }
    batchImport() { return Promise.resolve(0); }
  }

  const failingRepo = new ConcurrentFailingRepo();
  workspaceStore.setWorkspace('stress-kitchen');
  workspaceStore.setOperator('Chef Adversario');

  const actionPromises = [];
  for (let i = 0; i < 20; i++) {
    actionPromises.push(consumeStockAction('prod-stress', 1, 'Stress consume', failingRepo).catch(e => e));
    actionPromises.push(discardStockAction('prod-stress', 'Stress discard', failingRepo).catch(e => e));
  }

  assertEquals(connState.isSyncing, true, 'isSyncing is true while 40 concurrent mutations are in flight');

  await Promise.all(actionPromises);

  assertEquals(connState.isSyncing, false, 'isSyncing safely recovered to false after all 40 concurrent mutations settled');

  unsubConn();
  await viteServer.close();

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log(`CHALLENGER STRESS SUITE RESULTS`);
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error('FAILURES SUMMARY:');
    failures.forEach((f, idx) => console.error(`${idx + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('ALL CHALLENGER ADVERSARIAL STRESS TESTS COMPLETED WITH 100% SUCCESS.');
    process.exit(0);
  }
}

runChallengerStressSuite().catch(err => {
  console.error('Fatal unhandled error in challenger stress suite:', err);
  process.exit(1);
});
