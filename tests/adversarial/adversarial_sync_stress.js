/**
 * Adversarial Stress Test Suite for Milestone 2:
 * 1. Firebase client configuration validation (`validateFirebaseConfig`) against missing, malformed, and injection inputs.
 * 2. Headless SSR safety & resilience: `getFirebaseInstance()`, `isBrowser()`, and accessors under Node.js runtime.
 * 3. Store synchronization lifecycle: rapid successive calls to `subscribeToWorkspace` switching between 10+ workspaces, verifying zero listener leaks and strict concurrency invariants.
 * 4. `connectivityStore.hasPendingWrites` propagation, UI banner precedence truth table, and `isSyncing` error recovery.
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

async function runAdversarialSyncSuite() {
  console.log('================================================================');
  console.log('STARTING EMPIRICAL ADVERSARIAL STRESS TEST SUITE (Milestone 2)');
  console.log(`Node.js version: ${process.version}`);
  console.log(`Working Directory: ${PROJECT_ROOT}`);
  console.log(`Runtime Globals: window=${typeof globalThis.window}, document=${typeof globalThis.document}`);
  console.log('================================================================\n');

  // Verify pure headless environment
  assert(typeof globalThis.window === 'undefined', 'Environment is strictly headless (window === undefined)');
  assert(typeof globalThis.document === 'undefined', 'Environment is strictly headless (document === undefined)');

  const viteServer = await createServer({
    root: PROJECT_ROOT,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  let fbMod, invMod, wsMod, connMod, prodRepoMod;

  try {
    fbMod = await viteServer.ssrLoadModule('./src/lib/repositories/firebase.ts');
    invMod = await viteServer.ssrLoadModule('./src/lib/stores/inventoryStore.ts');
    wsMod = await viteServer.ssrLoadModule('./src/lib/stores/workspaceStore.ts');
    connMod = await viteServer.ssrLoadModule('./src/lib/stores/connectivityStore.ts');
    prodRepoMod = await viteServer.ssrLoadModule('./src/lib/repositories/productRepository.ts');
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
    subscribeToWorkspace,
    initWorkspaceSync,
    consumeStockAction,
    discardStockAction,
    createProductAction,
    updateProductAction
  } = invMod;

  const { workspaceStore, sanitizeWorkspaceId } = wsMod;
  const { connectivityStore } = connMod;
  const { productRepository } = prodRepoMod;

  // ============================================================================
  // SUITE 1: Firebase Client Configuration Validation (validateFirebaseConfig)
  // ============================================================================
  console.log('\n--- SUITE 1: Firebase Client Configuration Validation ---');

  // 1.1 Missing API Key validation
  assertThrows(
    () => validateFirebaseConfig({ PUBLIC_FIREBASE_API_KEY: '' }),
    'Firebase initialization failed: PUBLIC_FIREBASE_API_KEY is not defined in environment',
    'Rejects empty string API key with exact error message'
  );

  assertThrows(
    () => validateFirebaseConfig({ PUBLIC_FIREBASE_API_KEY: '   ' }),
    'Firebase initialization failed: PUBLIC_FIREBASE_API_KEY is not defined in environment',
    'Rejects whitespace-only API key'
  );

  assertThrows(
    () => validateFirebaseConfig({}),
    'Firebase initialization failed: PUBLIC_FIREBASE_API_KEY is not defined in environment',
    'Rejects empty environment object missing API key'
  );

  assertThrows(
    () => validateFirebaseConfig({ PUBLIC_FIREBASE_API_KEY: undefined }),
    'Firebase initialization failed: PUBLIC_FIREBASE_API_KEY is not defined in environment',
    'Rejects undefined API key'
  );

  const validKey = 'AIzaSyBPp8SQcFoVsS0uczaMQNANZ2iFlUf8-bc';
  const validDomain = 'stockcontrol-86bb7.firebaseapp.com';

  // 1.2 Malformed projectId validation (Regex: /^[a-z0-9-]{6,30}$/)
  const malformedProjectIds = [
    { val: 'StockControl', reason: 'Uppercase characters' },
    { val: 'stock_control', reason: 'Underscore' },
    { val: 'stock.control', reason: 'Dot' },
    { val: 'stock@control', reason: 'At-symbol' },
    { val: 'stock!123', reason: 'Exclamation mark' },
    { val: 'stock$control', reason: 'Dollar sign' },
    { val: 'stock control', reason: 'Space character' },
    { val: ' stockcontrol', reason: 'Leading space' },
    { val: 'stockcontrol ', reason: 'Trailing space' },
    { val: 'abc', reason: 'Length 3 (< 6 min)' },
    { val: '12345', reason: 'Length 5 (< 6 min)' },
    { val: 'a'.repeat(31), reason: 'Length 31 (> 30 max)' },
    { val: 'a'.repeat(60), reason: 'Length 60 (> 30 max)' },
    { val: '../../etc/passwd', reason: 'Path traversal attack' },
    { val: '<script>alert(1)</script>', reason: 'XSS script injection' },
    { val: 'cocina-español', reason: 'Non-ASCII character (ñ)' },
    { val: 'café-stock', reason: 'Non-ASCII character (é)' }
  ];

  for (const item of malformedProjectIds) {
    assertThrows(
      () => validateFirebaseConfig({
        PUBLIC_FIREBASE_API_KEY: validKey,
        PUBLIC_FIREBASE_PROJECT_ID: item.val,
        PUBLIC_FIREBASE_AUTH_DOMAIN: validDomain
      }),
      `Firebase initialization failed: Invalid projectId format "${item.val}"`,
      `Rejects malformed projectId (${item.reason}): "${item.val}"`
    );
  }

  // Valid projectId boundary tests
  const validProjectIds = [
    'abcdef', // exact min length 6
    '123456', // numbers only
    'a-b-c-d', // hyphens
    'a'.repeat(30), // exact max length 30
    'stockcontrol-86bb7' // real project id
  ];

  for (const pid of validProjectIds) {
    const cfg = validateFirebaseConfig({
      PUBLIC_FIREBASE_API_KEY: validKey,
      PUBLIC_FIREBASE_PROJECT_ID: pid,
      PUBLIC_FIREBASE_AUTH_DOMAIN: validDomain
    });
    assertEquals(cfg.projectId, pid, `Accepts valid boundary projectId: "${pid}"`);
  }

  // 1.3 Malformed authDomain validation (Regex: /^[a-z0-9.-]+\.firebaseapp\.com$/)
  const malformedAuthDomains = [
    { val: 'example.com', reason: 'Non-firebase domain' },
    { val: 'stockcontrol.org', reason: 'Non-firebase extension' },
    { val: 'stockcontrol.firebaseapp.com.attacker.com', reason: 'Subdomain hijack attack' },
    { val: 'https://stockcontrol.firebaseapp.com', reason: 'Contains protocol https://' },
    { val: 'http://stockcontrol.firebaseapp.com', reason: 'Contains protocol http://' },
    { val: 'stockcontrol.firebaseapp.com:443', reason: 'Contains port suffix' },
    { val: 'stockcontrol.firebaseapp.com/auth', reason: 'Contains path suffix' },
    { val: 'StockControl.firebaseapp.com', reason: 'Uppercase characters' },
    { val: 'stock_control.firebaseapp.com', reason: 'Underscore in domain' },
    { val: 'stock control.firebaseapp.com', reason: 'Space in domain' },
    { val: '.firebaseapp.com', reason: 'Missing subdomain name' },
    { val: 'firebaseapp.com', reason: 'Root domain only' },
    { val: 'stock@control.firebaseapp.com', reason: 'At-symbol in domain' }
  ];

  for (const item of malformedAuthDomains) {
    assertThrows(
      () => validateFirebaseConfig({
        PUBLIC_FIREBASE_API_KEY: validKey,
        PUBLIC_FIREBASE_PROJECT_ID: 'stockcontrol-86bb7',
        PUBLIC_FIREBASE_AUTH_DOMAIN: item.val
      }),
      `Firebase initialization failed: Malformed authDomain format "${item.val}"`,
      `Rejects malformed authDomain (${item.reason}): "${item.val}"`
    );
  }

  // Valid authDomains
  const validAuthDomains = [
    'stockcontrol-86bb7.firebaseapp.com',
    'my-kitchen-1.firebaseapp.com',
    'app.staging.firebaseapp.com'
  ];

  for (const dom of validAuthDomains) {
    const cfg = validateFirebaseConfig({
      PUBLIC_FIREBASE_API_KEY: validKey,
      PUBLIC_FIREBASE_PROJECT_ID: 'stockcontrol-86bb7',
      PUBLIC_FIREBASE_AUTH_DOMAIN: dom
    });
    assertEquals(cfg.authDomain, dom, `Accepts valid authDomain: "${dom}"`);
  }

  // 1.4 Default configuration fallback (unsupplied arguments)
  try {
    const defaultCfg = validateFirebaseConfig();
    assertEquals(defaultCfg.projectId, FIREBASE_DEFAULTS.projectId, 'Default config resolves projectId from FIREBASE_DEFAULTS');
    assertEquals(defaultCfg.apiKey, FIREBASE_DEFAULTS.apiKey, 'Default config resolves apiKey from FIREBASE_DEFAULTS');
    assertEquals(defaultCfg.authDomain, FIREBASE_DEFAULTS.authDomain, 'Default config resolves authDomain from FIREBASE_DEFAULTS');
  } catch (err) {
    totalTests++;
    failedTests++;
    const errMsg = `validateFirebaseConfig() without arguments crashed: ${err.message}`;
    failures.push(errMsg);
    console.error(`  ✗ FAIL: ${errMsg}`);
  }

  // ============================================================================
  // SUITE 2: Headless SSR Safety & Resilience
  // ============================================================================
  console.log('\n--- SUITE 2: Headless SSR Safety & Resilience ---');

  assertEquals(isBrowser(), false, 'isBrowser() returns false in headless Node runtime');

  const instance = getFirebaseInstance();
  assertEquals(instance.initialized, false, 'getFirebaseInstance().initialized is false in SSR');
  assertEquals(instance.isMock, true, 'getFirebaseInstance().isMock is true in SSR');
  assertEquals(instance.mode, 'ssr-noop', 'getFirebaseInstance().mode is strictly "ssr-noop" in SSR');
  assertEquals(instance.cacheType, 'none', 'getFirebaseInstance().cacheType is strictly "none" in SSR');
  assertEquals(instance.app, null, 'getFirebaseInstance().app is null in SSR');
  assertEquals(instance.db, null, 'getFirebaseInstance().db is null in SSR');
  assertEquals(instance.auth, null, 'getFirebaseInstance().auth is null in SSR');

  assertEquals(getFirestoreDb(), null, 'getFirestoreDb() returns null without throwing in SSR');
  assertEquals(getFirebaseAuth(), null, 'getFirebaseAuth() returns null without throwing in SSR');
  assertEquals(getFirebaseApp(), null, 'getFirebaseApp() returns null without throwing in SSR');
  assertEquals(isFirebaseAvailable(), false, 'isFirebaseAvailable() returns false in SSR');

  // Test partial browser mock robustness
  const origWindow = globalThis.window;
  const origDocument = globalThis.document;

  try {
    // Only window defined, document undefined
    globalThis.window = {};
    globalThis.document = undefined;
    assertEquals(isBrowser(), false, 'isBrowser() returns false when document is undefined even if window is defined');

    // Only document defined, window undefined
    globalThis.window = undefined;
    globalThis.document = {};
    assertEquals(isBrowser(), false, 'isBrowser() returns false when window is undefined even if document is defined');
  } finally {
    globalThis.window = origWindow;
    globalThis.document = origDocument;
  }

  // ============================================================================
  // SUITE 3: Store Synchronization Lifecycle & Zero Listener Leaks
  // ============================================================================
  console.log('\n--- SUITE 3: Store Synchronization Lifecycle & Zero Listener Leaks ---');

  /**
   * Mock repository simulating Firestore listeners and tracking concurrency
   */
  class MockLifecycleRepository {
    activeListenersCount = 0;
    peakActiveListeners = 0;
    totalSubscribes = 0;
    totalUnsubscribes = 0;
    activeWorkspaces = new Set();
    history = [];
    currentEmit = null;

    subscribeProducts(workspaceId, onData, onError) {
      this.totalSubscribes++;
      this.activeListenersCount++;
      if (this.activeListenersCount > this.peakActiveListeners) {
        this.peakActiveListeners = this.activeListenersCount;
      }
      this.activeWorkspaces.add(workspaceId);
      const subId = `${workspaceId}_#${this.totalSubscribes}`;
      this.history.push({ action: 'subscribe', subId, workspaceId });

      let isUnsubscribed = false;
      this.currentEmit = (items, pending) => {
        if (!isUnsubscribed) onData(items, pending);
      };

      return () => {
        if (isUnsubscribed) return; // Idempotent
        isUnsubscribed = true;
        this.totalUnsubscribes++;
        this.activeListenersCount--;
        this.activeWorkspaces.delete(workspaceId);
        this.history.push({ action: 'unsubscribe', subId, workspaceId });
      };
    }

    subscribeHistory(workspaceId, limit, onData) {
      return () => {};
    }
    createProduct() { return Promise.resolve('mock-id'); }
    updateProduct() { return Promise.resolve(); }
    consumeStock() { return Promise.resolve(); }
    discardStock() { return Promise.resolve(); }
    deleteProduct() { return Promise.resolve(); }
    restoreStock() { return Promise.resolve(); }
    batchImport() { return Promise.resolve(0); }
  }

  // 3.1 Rapid Sequential Switching across 10 Workspaces
  const mockRepo1 = new MockLifecycleRepository();
  const workspaces = Array.from({ length: 10 }, (_, i) => `cocina-sucursal-${i + 1}`);

  let lastTeardown = null;

  for (let i = 0; i < workspaces.length; i++) {
    const ws = workspaces[i];
    lastTeardown = subscribeToWorkspace(ws, mockRepo1);

    // Verify invariant after each switch: exactly 1 active listener
    assertEquals(
      mockRepo1.activeListenersCount,
      1,
      `Switch ${i + 1}/10 to "${ws}": active listeners is strictly 1`
    );
    assert(
      mockRepo1.activeWorkspaces.has(ws),
      `Active workspace set contains "${ws}"`
    );
    assertEquals(
      inventoryStoreActiveWorkspace(),
      ws,
      `inventoryStore reflects active workspace "${ws}"`
    );
  }

  assertEquals(mockRepo1.totalSubscribes, 10, 'Total subscribe calls equals 10');
  assertEquals(mockRepo1.totalUnsubscribes, 9, 'Total unsubscribe calls before final teardown equals 9');
  assertEquals(mockRepo1.peakActiveListeners, 1, 'Peak concurrent active listeners NEVER exceeded 1');

  // Tear down final subscription
  if (lastTeardown) {
    lastTeardown();
  }

  assertEquals(mockRepo1.activeListenersCount, 0, 'After final teardown, active listeners is strictly 0');
  assertEquals(mockRepo1.totalUnsubscribes, 10, 'Total unsubscribe calls equals 10 (Zero listener leaks)');

  // 3.2 Fuzzing: 100 rapid switches across randomized workspaces
  const mockRepoFuzz = new MockLifecycleRepository();
  const fuzzPool = ['norte', 'sur', 'este', 'oeste', 'centro', 'barra', 'bodega', 'panaderia', 'reposteria', 'camara-1'];

  let currentFuzzTeardown = null;
  for (let i = 0; i < 100; i++) {
    const randomWs = fuzzPool[i % fuzzPool.length];
    currentFuzzTeardown = subscribeToWorkspace(randomWs, mockRepoFuzz);
    if (mockRepoFuzz.activeListenersCount !== 1) {
      assert(false, `Fuzz iteration ${i}: activeListenersCount was ${mockRepoFuzz.activeListenersCount}, expected 1`);
      break;
    }
  }

  assertEquals(mockRepoFuzz.peakActiveListeners, 1, 'Fuzzing: Peak concurrent listeners strictly 1 across 100 switches');
  assertEquals(mockRepoFuzz.activeListenersCount, 1, 'Fuzzing: Exactly 1 active listener remains before teardown');

  if (currentFuzzTeardown) {
    currentFuzzTeardown();
  }
  assertEquals(mockRepoFuzz.activeListenersCount, 0, 'Fuzzing: Teardown cleanly leaves 0 active listeners');
  assertEquals(mockRepoFuzz.totalSubscribes, mockRepoFuzz.totalUnsubscribes, 'Fuzzing: Subscribes equals unsubscribes (100% leak-free)');

  // 3.3 Redundant Subscription to Same Workspace
  const mockRepoRedundant = new MockLifecycleRepository();
  const unsubA = subscribeToWorkspace('cocina-repetida', mockRepoRedundant);
  assertEquals(mockRepoRedundant.activeListenersCount, 1, 'First subscription to cocina-repetida created 1 listener');

  const unsubB = subscribeToWorkspace('cocina-repetida', mockRepoRedundant);
  assertEquals(mockRepoRedundant.activeListenersCount, 1, 'Second subscription to same workspace did NOT duplicate listener');

  unsubB();
  assertEquals(mockRepoRedundant.activeListenersCount, 0, 'Teardown closed the active listener');

  unsubA();
  assertEquals(mockRepoRedundant.activeListenersCount, 0, 'Calling previous teardown is safe and does not double-decrement');

  // 3.4 Empty and Whitespace Workspace Subscriptions
  const mockRepoEmpty = new MockLifecycleRepository();
  const unsubEmpty1 = subscribeToWorkspace('', mockRepoEmpty);
  assertEquals(mockRepoEmpty.activeListenersCount, 0, 'Subscribing to empty string "" creates 0 listeners');
  assertEquals(inventoryStoreActiveWorkspace(), '', 'Empty workspace sets activeWorkspaceId to empty');

  const unsubEmpty2 = subscribeToWorkspace('   ', mockRepoEmpty);
  assertEquals(mockRepoEmpty.activeListenersCount, 0, 'Subscribing to whitespace "   " creates 0 listeners');

  unsubEmpty1();
  unsubEmpty2();

  // 3.5 Teardown Idempotency
  const mockRepoIdempotent = new MockLifecycleRepository();
  const unsubIdem = subscribeToWorkspace('cocina-idempotente', mockRepoIdempotent);
  assertEquals(mockRepoIdempotent.activeListenersCount, 1, 'Listener active before teardown');

  unsubIdem();
  assertEquals(mockRepoIdempotent.activeListenersCount, 0, 'First teardown closed listener');
  unsubIdem();
  unsubIdem();
  unsubIdem();
  assertEquals(mockRepoIdempotent.activeListenersCount, 0, 'Repeated teardowns are idempotent (active count remains 0)');
  assertEquals(mockRepoIdempotent.totalUnsubscribes, 1, 'Repository unsubscription called only once');

  // 3.6 Outdated Teardown Invalidation Protection
  const mockRepoOutdated = new MockLifecycleRepository();
  const oldTeardown = subscribeToWorkspace('cocina-antigua', mockRepoOutdated);
  const newTeardown = subscribeToWorkspace('cocina-nueva', mockRepoOutdated);

  assertEquals(mockRepoOutdated.activeListenersCount, 1, 'Only cocina-nueva is currently active');
  assertEquals(inventoryStoreActiveWorkspace(), 'cocina-nueva', 'Current workspace is cocina-nueva');

  // Calling outdated oldTeardown must NOT close cocina-nueva
  oldTeardown();
  assertEquals(mockRepoOutdated.activeListenersCount, 1, 'Outdated teardown did NOT close active cocina-nueva listener');

  // Calling newTeardown closes cocina-nueva
  newTeardown();
  assertEquals(mockRepoOutdated.activeListenersCount, 0, 'Current teardown cleanly closed cocina-nueva');

  // 3.7 initWorkspaceSync integration with workspaceStore
  const mockRepoSync = new MockLifecycleRepository();
  workspaceStore.setWorkspace('sucursal-alfa');

  const cleanupSync = initWorkspaceSync(mockRepoSync);
  assertEquals(mockRepoSync.activeListenersCount, 1, 'initWorkspaceSync automatically subscribed to current workspace');
  assert(mockRepoSync.activeWorkspaces.has('sucursal-alfa'), 'Active workspace is sucursal-alfa');

  workspaceStore.setWorkspace('sucursal-beta');
  assertEquals(mockRepoSync.activeListenersCount, 1, 'Changing workspaceStore switched listener (active count = 1)');
  assert(mockRepoSync.activeWorkspaces.has('sucursal-beta'), 'Active workspace is now sucursal-beta');

  workspaceStore.setWorkspace('sucursal-gamma');
  assertEquals(mockRepoSync.activeListenersCount, 1, 'Changing workspaceStore switched listener again (active count = 1)');
  assert(mockRepoSync.activeWorkspaces.has('sucursal-gamma'), 'Active workspace is now sucursal-gamma');

  cleanupSync();
  assertEquals(mockRepoSync.activeListenersCount, 0, 'cleanupSync closed all listeners (active count = 0)');

  // After cleanup, modifying workspaceStore must NOT trigger any new repo subscriptions
  workspaceStore.setWorkspace('sucursal-delta');
  assertEquals(mockRepoSync.activeListenersCount, 0, 'Post-cleanup workspace changes do not leak listeners');

  // ============================================================================
  // SUITE 4: connectivityStore.hasPendingWrites Propagation & UI Banner Reactivity
  // ============================================================================
  console.log('\n--- SUITE 4: connectivityStore.hasPendingWrites Propagation & UI Banner Reactivity ---');

  const mockRepoProp = new MockLifecycleRepository();
  let emitListener = null;

  mockRepoProp.subscribeProducts = (ws, onData, onError) => {
    emitListener = { onData, onError };
    return () => { emitListener = null; };
  };

  const unsubProp = subscribeToWorkspace('cocina-pending-test', mockRepoProp);

  // 4.1 hasPendingWrites = true propagation
  emitListener.onData([{ id: 'prod-1', name: 'Carne', quantity: 5, expiryDate: '2026-10-30' }], true);

  assertEquals(getInventoryState().hasPendingWrites, true, 'inventoryStore.hasPendingWrites received true');
  assertEquals(getConnectivityState().hasPendingWrites, true, 'connectivityStore.hasPendingWrites received true');

  // 4.2 hasPendingWrites = false propagation (synced)
  emitListener.onData([{ id: 'prod-1', name: 'Carne', quantity: 5, expiryDate: '2026-10-30' }], false);

  assertEquals(getInventoryState().hasPendingWrites, false, 'inventoryStore.hasPendingWrites received false');
  assertEquals(getConnectivityState().hasPendingWrites, false, 'connectivityStore.hasPendingWrites received false');

  // 4.3 Error handling clears hasPendingWrites and sets inventory error
  emitListener.onData([], true);
  assertEquals(getConnectivityState().hasPendingWrites, true, 'Pending writes set to true before error');

  emitListener.onError(new Error('Firestore quota exceeded'));
  assertEquals(getConnectivityState().hasPendingWrites, false, 'Firestore error cleared connectivityStore hasPendingWrites to false');
  assertEquals(getInventoryState().error, 'Firestore quota exceeded', 'Firestore error populated inventoryStore.error');

  unsubProp();

  // 4.4 UI Banner Reactivity Truth Table (Precedence Invariant)
  // Matching Svelte logic in src/routes/+layout.svelte:
  // {#if !$connectivityStore.online}
  //   [network-banner offline]
  // {:else if $connectivityStore.hasPendingWrites}
  //   [network-banner syncing]
  // {/if}
  function evaluateBanner(state) {
    if (!state.online) return 'offline';
    if (state.hasPendingWrites) return 'syncing';
    return 'none';
  }

  // Case A: Online + No pending writes
  connectivityStore.setOnlineStatus(true);
  connectivityStore.setPendingWrites(false);
  assertEquals(evaluateBanner(getConnectivityState()), 'none', 'Banner State A (Online, No Pending): Hidden');

  // Case B: Online + Pending writes
  connectivityStore.setOnlineStatus(true);
  connectivityStore.setPendingWrites(true);
  assertEquals(evaluateBanner(getConnectivityState()), 'syncing', 'Banner State B (Online, Has Pending): Shows "syncing" banner');

  // Case C: Offline + Pending writes (Precedence check: Offline banner MUST take priority)
  connectivityStore.setOnlineStatus(false);
  connectivityStore.setPendingWrites(true);
  assertEquals(evaluateBanner(getConnectivityState()), 'offline', 'Banner State C (Offline, Has Pending): Offline banner takes precedence over syncing banner');

  // Case D: Offline + No pending writes
  connectivityStore.setOnlineStatus(false);
  connectivityStore.setPendingWrites(false);
  assertEquals(evaluateBanner(getConnectivityState()), 'offline', 'Banner State D (Offline, No Pending): Shows "offline" banner');

  connectivityStore.reset();

  // 4.5 Action Helpers Syncing Lifecycle & Error Resilience (isSyncing)
  class MockFailingRepo {
    subscribeProducts() { return () => {}; }
    subscribeHistory() { return () => {}; }
    createProduct() { return Promise.reject(new Error('Simulated network abort on create')); }
    updateProduct() { return Promise.reject(new Error('Simulated network abort on update')); }
    consumeStock() { return Promise.reject(new Error('Simulated network abort on consume')); }
    discardStock() { return Promise.reject(new Error('Simulated network abort on discard')); }
    deleteProduct() { return Promise.reject(new Error('Simulated network abort on delete')); }
    restoreStock() { return Promise.reject(new Error('Simulated network abort on restore')); }
    batchImport() { return Promise.reject(new Error('Simulated network abort on batchImport')); }
  }

  const failingRepo = new MockFailingRepo();

  // Test consumeStockAction rejection resilience
  assertEquals(getConnectivityState().isSyncing, false, 'isSyncing is false before consume action');
  try {
    await consumeStockAction('p-1', 1, 'Test', failingRepo);
    assert(false, 'Expected consumeStockAction to throw');
  } catch (err) {
    assert(err.message.includes('Simulated network abort on consume'), 'Caught expected consume rejection');
  }
  assertEquals(getConnectivityState().isSyncing, false, 'isSyncing safely reset to false in finally block after consume failure');

  // Test discardStockAction rejection resilience
  try {
    await discardStockAction('p-1', 'Test reason', failingRepo);
    assert(false, 'Expected discardStockAction to throw');
  } catch (err) {
    assert(err.message.includes('Simulated network abort on discard'), 'Caught expected discard rejection');
  }
  assertEquals(getConnectivityState().isSyncing, false, 'isSyncing safely reset to false in finally block after discard failure');

  // Test createProductAction rejection resilience
  try {
    await createProductAction({
      name: 'Test',
      category: 'lacteos',
      quantity: 1,
      unit: 'unidad',
      receivedDate: '2026-10-25',
      expiryDate: '2026-10-30',
      location: 'camara-1',
      isDiscarded: false,
      isConsumed: false,
      lastAction: 'create'
    }, failingRepo);
    assert(false, 'Expected createProductAction to throw');
  } catch (err) {
    assert(err.message.includes('Simulated network abort on create'), 'Caught expected create rejection');
  }
  assertEquals(getConnectivityState().isSyncing, false, 'isSyncing safely reset to false in finally block after create failure');

  // Test updateProductAction rejection resilience
  try {
    await updateProductAction('p-1', { name: 'Updated' }, failingRepo);
    assert(false, 'Expected updateProductAction to throw');
  } catch (err) {
    assert(err.message.includes('Simulated network abort on update'), 'Caught expected update rejection');
  }
  assertEquals(getConnectivityState().isSyncing, false, 'isSyncing safely reset to false in finally block after update failure');

  // Helper readers
  function inventoryStoreActiveWorkspace() {
    let val = '';
    const unsub = inventoryStore.subscribe(s => { val = s.activeWorkspaceId; });
    unsub();
    return val;
  }

  function getInventoryState() {
    let val = null;
    const unsub = inventoryStore.subscribe(s => { val = s; });
    unsub();
    return val;
  }

  function getConnectivityState() {
    let val = null;
    const unsub = connectivityStore.subscribe(s => { val = s; });
    unsub();
    return val;
  }

  await viteServer.close();

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log(`TOTAL EMPIRICAL TESTS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error('FAILURES SUMMARY:');
    failures.forEach((f, idx) => console.error(`${idx + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('ALL ADVERSARIAL STRESS TESTS COMPLETED WITH 100% SUCCESS.');
    process.exit(0);
  }
}

runAdversarialSyncSuite().catch((err) => {
  console.error('Fatal unhandled error in test suite:', err);
  process.exit(1);
});
