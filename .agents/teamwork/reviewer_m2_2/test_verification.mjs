// Independent Verification Script for Milestone 2 by reviewer_m2_2
import { createServer } from 'vite';
import assert from 'node:assert';

async function runReviewerTests() {
  console.log('=== Reviewer M2.2 Independent Verification Suite ===\n');

  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  try {
    // 1. Verify productRepository normalizers and sanitizers
    console.log('[Test 1] Testing productRepository exports and sanitizers...');
    const repoMod = await server.ssrLoadModule('./src/lib/repositories/productRepository.ts');
    const {
      normalizeWorkspaceId,
      normalizeOperator,
      safeSubtract,
      sanitizeFirestorePayload
    } = repoMod;

    // normalizeWorkspaceId
    assert.strictEqual(normalizeWorkspaceId('  Cocina Central  '), 'cocina-central');
    assert.strictEqual(normalizeWorkspaceId(''), 'cocina-principal');
    assert.strictEqual(normalizeWorkspaceId(null), 'cocina-principal');
    assert.strictEqual(normalizeWorkspaceId(undefined), 'cocina-principal');
    assert.strictEqual(normalizeWorkspaceId(12345), 'cocina-principal');
    assert.strictEqual(normalizeWorkspaceId('Árbol de Ñandú'), 'arbol-de-nandu');
    assert.strictEqual(normalizeWorkspaceId('../../etc/passwd'), 'etc-passwd');
    assert.strictEqual(normalizeWorkspaceId('workspace---test'), 'workspace-test');
    assert.strictEqual(normalizeWorkspaceId('---leading-trailing---'), 'leading-trailing');
    console.log('  ✓ normalizeWorkspaceId passed all boundary cases');

    // normalizeOperator
    assert.strictEqual(normalizeOperator(''), 'Operador');
    assert.strictEqual(normalizeOperator('   '), 'Operador');
    assert.strictEqual(normalizeOperator(null), 'Operador');
    assert.strictEqual(normalizeOperator(undefined), 'Operador');
    assert.strictEqual(normalizeOperator('  Juan Perez  '), 'Juan Perez');
    assert.strictEqual(normalizeOperator('Chef 👨‍🍳 Marco'), 'Chef 👨‍🍳 Marco');
    console.log('  ✓ normalizeOperator passed all boundary cases');

    // safeSubtract
    assert.strictEqual(safeSubtract(0.3, 0.1), 0.2);
    assert.strictEqual(safeSubtract(1.4, 0.4), 1.0);
    assert.strictEqual(safeSubtract(0.7, 0.1), 0.6);
    assert.strictEqual(safeSubtract(5, 5), 0);
    assert.strictEqual(safeSubtract(2, 5), -3);
    assert.strictEqual(safeSubtract(10.123456, 0.000006), 10.12345);
    console.log('  ✓ safeSubtract precision drift neutralization verified');

    // sanitizeFirestorePayload
    const dirty = {
      name: 'Tomates',
      quantity: 5,
      notes: undefined,
      lot: 'L123',
      extra: undefined,
      isZero: 0,
      isEmpty: '',
      isFalse: false,
      isNull: null
    };
    const clean = sanitizeFirestorePayload(dirty);
    assert.strictEqual('notes' in clean, false);
    assert.strictEqual('extra' in clean, false);
    assert.strictEqual(clean.name, 'Tomates');
    assert.strictEqual(clean.quantity, 5);
    assert.strictEqual(clean.isZero, 0);
    assert.strictEqual(clean.isEmpty, '');
    assert.strictEqual(clean.isFalse, false);
    assert.strictEqual(clean.isNull, null);
    console.log('  ✓ sanitizeFirestorePayload correctly strips undefined while preserving falsy values');

    // 2. Verify firebase.ts SSR safety and config validator
    console.log('\n[Test 2] Testing firebase.ts SSR safety & config validator...');
    const fbMod = await server.ssrLoadModule('./src/lib/repositories/firebase.ts');
    const { isBrowser, validateFirebaseConfig, getFirebaseInstance } = fbMod;

    assert.strictEqual(isBrowser(), false, 'isBrowser must be false in Node SSR environment');
    const fbInstance = getFirebaseInstance();
    assert.strictEqual(fbInstance.isMock, true, 'getFirebaseInstance must return isMock=true in SSR');
    assert.strictEqual(fbInstance.mode, 'ssr-noop');
    assert.strictEqual(fbInstance.db, null);
    assert.strictEqual(fbInstance.app, null);

    // validateFirebaseConfig missing apiKey
    assert.throws(() => {
      validateFirebaseConfig({ PUBLIC_FIREBASE_API_KEY: '' });
    }, /PUBLIC_FIREBASE_API_KEY is not defined/);

    // validateFirebaseConfig invalid projectId
    assert.throws(() => {
      validateFirebaseConfig({
        PUBLIC_FIREBASE_API_KEY: 'valid-key',
        PUBLIC_FIREBASE_PROJECT_ID: 'INVALID PROJECT ID WITH SPACES'
      });
    }, /Invalid projectId format/);

    // validateFirebaseConfig invalid authDomain
    assert.throws(() => {
      validateFirebaseConfig({
        PUBLIC_FIREBASE_API_KEY: 'valid-key',
        PUBLIC_FIREBASE_AUTH_DOMAIN: 'attacker.evil.com'
      });
    }, /Malformed authDomain format/);

    console.log('  ✓ firebase.ts SSR guard and config validator verified');

    // 3. Verify metricsStore domain delegation & reactive calculation
    console.log('\n[Test 3] Testing metricsStore domain integration...');
    const metricsMod = await server.ssrLoadModule('./src/lib/stores/metricsStore.ts');
    const { calculateMetrics } = metricsMod;

    const sampleProducts = [
      { id: '1', name: 'P1', quantity: 5, expiryDate: '2026-10-20', isDiscarded: false, isConsumed: false }, // expired (-5d relative to 2026-10-25)
      { id: '2', name: 'P2', quantity: 2, expiryDate: '2026-10-26', isDiscarded: false, isConsumed: false }, // soon (+1d)
      { id: '3', name: 'P3', quantity: 1, expiryDate: '2026-10-28', isDiscarded: false, isConsumed: false }, // soon (+3d)
      { id: '4', name: 'P4', quantity: 3, expiryDate: '2026-10-31', isDiscarded: false, isConsumed: false }, // week (+6d)
      { id: '5', name: 'P5', quantity: 10, expiryDate: '2026-11-10', isDiscarded: false, isConsumed: false }, // ok (+16d)
      { id: '6', name: 'P6', quantity: 0, expiryDate: '2026-10-25', isDiscarded: true, isConsumed: false }, // discarded
      { id: '7', name: 'P7', quantity: 0, expiryDate: '2026-10-25', isDiscarded: false, isConsumed: true }   // consumed
    ];

    const metrics = calculateMetrics(sampleProducts, new Date('2026-10-25T12:00:00Z'));
    assert.strictEqual(metrics.total, 5, 'Total active products must be 5');
    assert.strictEqual(metrics.expired, 1, 'Expired count must be 1');
    assert.strictEqual(metrics.soon, 2, 'Soon count must be 2');
    assert.strictEqual(metrics.week, 1, 'Week count must be 1');
    assert.strictEqual(metrics.ok, 1, 'Ok count must be 1');
    assert.strictEqual(metrics.critical7, 3, 'critical7 (soon + week) must be 3');
    assert.strictEqual(metrics.within7Days, 3);
    assert.strictEqual(metrics.criticalTotal, 3, 'criticalTotal (expired + soon) must be 3');
    assert.strictEqual(metrics.discarded, 1, 'discarded count must be 1');
    assert.strictEqual(metrics.consumed, 1, 'consumed count must be 1');
    assert.strictEqual(metrics.total, metrics.expired + metrics.soon + metrics.week + metrics.ok);
    console.log('  ✓ metricsStore calculation and disjoint partition verified');

    // 4. Verify inventoryStore and workspaceStore synchronization lifecycle
    console.log('\n[Test 4] Testing inventoryStore lifecycle and repo wiring...');
    const invMod = await server.ssrLoadModule('./src/lib/stores/inventoryStore.ts');
    const { inventoryStore, subscribeToWorkspace, initWorkspaceSync } = invMod;

    // Create a mock IProductRepository to test listener lifecycle
    let activeSubCount = 0;
    let lastSubscribedWs = '';
    let mockOnData = null;

    const mockRepo = {
      subscribeProducts(wsId, onData) {
        activeSubCount++;
        lastSubscribedWs = wsId;
        mockOnData = onData;
        return () => {
          activeSubCount--;
        };
      },
      subscribeHistory() { return () => {}; },
      createProduct: async () => 'test-id',
      updateProduct: async () => {},
      consumeStock: async () => {},
      discardStock: async () => {},
      deleteProduct: async () => {},
      restoreStock: async () => {},
      batchImport: async () => 0
    };

    // Test subscribeToWorkspace
    const unsub1 = subscribeToWorkspace('cocina-a', mockRepo);
    assert.strictEqual(activeSubCount, 1);
    assert.strictEqual(lastSubscribedWs, 'cocina-a');

    // Subscribing to same workspace returns teardown without creating second listener
    const unsub2 = subscribeToWorkspace('cocina-a', mockRepo);
    assert.strictEqual(activeSubCount, 1, 'Duplicate subscribe to same workspace must not leak listener');

    // Subscribing to new workspace tears down previous listener
    const unsub3 = subscribeToWorkspace('cocina-b', mockRepo);
    assert.strictEqual(activeSubCount, 1, 'Switching workspace must teardown previous listener (active count = 1)');
    assert.strictEqual(lastSubscribedWs, 'cocina-b');

    // Emit data with hasPendingWrites = true
    mockOnData([{ id: 'p1', name: 'Test Prod', quantity: 4, expiryDate: '2026-11-01' }], true);
    let invState;
    const unsubInv = inventoryStore.subscribe(s => { invState = s; });
    assert.strictEqual(invState.products.length, 1);
    assert.strictEqual(invState.hasPendingWrites, true);
    assert.strictEqual(invState.activeWorkspaceId, 'cocina-b');

    // Cleanup
    unsub3();
    assert.strictEqual(activeSubCount, 0, 'Unsubscribe must decrement active count to 0');
    unsubInv();
    console.log('  ✓ inventoryStore listener lifecycle and pendingWrites verified (0 leaks)');

    console.log('\nALL INDEPENDENT VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    await server.close();
  }
}

runReviewerTests().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
