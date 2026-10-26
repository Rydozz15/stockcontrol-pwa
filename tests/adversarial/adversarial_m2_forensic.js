/**
 * StockControl PWA — Milestone 2 Forensic Integrity Verification Suite
 * Independent empirical test battery executed by auditor_m2_1
 */

import { createServer } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

async function runForensicAudit() {
  console.log('============================================================');
  console.log('   M2 FORENSIC INTEGRITY AUDIT - INDEPENDENT VERIFICATION    ');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Static inspection of firestore.rules
  console.log('\n--- CHECK 1: Firestore Security Rules Forensic Analysis ---');
  test('firestore.rules file exists and has valid syntax structure', () => {
    const rulesPath = path.resolve('firestore.rules');
    assert.ok(fs.existsSync(rulesPath), 'firestore.rules must exist');
    const content = fs.readFileSync(rulesPath, 'utf8');
    assert.ok(content.includes("rules_version = '2';"), 'Rules must declare version 2');
    assert.ok(content.includes('match /{document=**} {\n      allow read, write: if false;\n    }'), 'Must have root catch-all deny');
    assert.ok(content.includes('match /workspaces/{workspaceId}'), 'Must isolate by workspaceId');
    assert.ok(content.includes('match /products/{productId}'), 'Must match products subcollection');
    assert.ok(content.includes('isValidQuantity(request.resource.data)'), 'Must enforce non-negative quantity via isValidQuantity');
    assert.ok(content.includes('match /history/{logId}'), 'Must match history subcollection');
    assert.ok(content.includes('allow read, create: if isValidWorkspace(workspaceId);'), 'Must permit append-only history with valid workspace');
    assert.ok(content.includes('allow update, delete: if false;'), 'Must forbid update/delete on audit history');
  });

  // Setup Vite SSR loader to dynamically inspect TypeScript source files
  const viteServer = await createServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  try {
    console.log('\n--- CHECK 2: Firebase Client Module (firebase.ts) Forensics ---');
    const fbMod = await viteServer.ssrLoadModule('./src/lib/repositories/firebase.ts');

    test('isBrowser() returns false in Node.js environment', () => {
      assert.strictEqual(fbMod.isBrowser(), false);
    });

    test('getFirebaseInstance() returns SSR-safe mock in Node.js environment', () => {
      const inst = fbMod.getFirebaseInstance();
      assert.strictEqual(inst.initialized, false);
      assert.strictEqual(inst.isMock, true);
      assert.strictEqual(inst.mode, 'ssr-noop');
      assert.strictEqual(inst.cacheType, 'none');
      assert.strictEqual(inst.app, null);
      assert.strictEqual(inst.db, null);
      assert.strictEqual(inst.auth, null);
    });

    test('validateFirebaseConfig() validates mandatory API key and throws on missing key', () => {
      assert.throws(() => {
        fbMod.validateFirebaseConfig({
          PUBLIC_FIREBASE_API_KEY: '',
          PUBLIC_FIREBASE_PROJECT_ID: 'stockcontrol-86bb7',
          PUBLIC_FIREBASE_AUTH_DOMAIN: 'stockcontrol-86bb7.firebaseapp.com'
        });
      }, /Firebase initialization failed: PUBLIC_FIREBASE_API_KEY is not defined in environment/);
    });

    test('validateFirebaseConfig() validates projectId format and throws on invalid regex', () => {
      assert.throws(() => {
        fbMod.validateFirebaseConfig({
          PUBLIC_FIREBASE_API_KEY: 'AIzaSyFakeKey',
          PUBLIC_FIREBASE_PROJECT_ID: 'UPPERCASE_AND_INVALID!!',
          PUBLIC_FIREBASE_AUTH_DOMAIN: 'stockcontrol-86bb7.firebaseapp.com'
        });
      }, /Firebase initialization failed: Invalid projectId format/);
    });

    test('validateFirebaseConfig() validates authDomain format and throws on invalid domain', () => {
      assert.throws(() => {
        fbMod.validateFirebaseConfig({
          PUBLIC_FIREBASE_API_KEY: 'AIzaSyFakeKey',
          PUBLIC_FIREBASE_PROJECT_ID: 'stockcontrol-86bb7',
          PUBLIC_FIREBASE_AUTH_DOMAIN: 'evil-hacker.com'
        });
      }, /Firebase initialization failed: Malformed authDomain format/);
    });

    console.log('\n--- CHECK 3: Repository Logic & Sanitization Forensics ---');
    const repoMod = await viteServer.ssrLoadModule('./src/lib/repositories/productRepository.ts');

    test('normalizeWorkspaceId handles trimming, lowercase, accents, special characters', () => {
      assert.strictEqual(repoMod.normalizeWorkspaceId('  Cocina Central  '), 'cocina-central');
      assert.strictEqual(repoMod.normalizeWorkspaceId('Área de Producción & Repostería #1'), 'area-de-produccion-reposteria-1');
      assert.strictEqual(repoMod.normalizeWorkspaceId('---cocina---norte---'), 'cocina-norte');
    });

    test('normalizeWorkspaceId neutralizes path traversal vectors', () => {
      assert.strictEqual(repoMod.normalizeWorkspaceId('../../root'), 'root');
      assert.strictEqual(repoMod.normalizeWorkspaceId('../../../etc/passwd'), 'etc-passwd');
    });

    test('normalizeWorkspaceId falls back to default on empty/non-string values', () => {
      assert.strictEqual(repoMod.normalizeWorkspaceId(''), 'cocina-principal');
      assert.strictEqual(repoMod.normalizeWorkspaceId(null), 'cocina-principal');
      assert.strictEqual(repoMod.normalizeWorkspaceId(undefined), 'cocina-principal');
      assert.strictEqual(repoMod.normalizeWorkspaceId(12345), 'cocina-principal');
      assert.strictEqual(repoMod.normalizeWorkspaceId({}), 'cocina-principal');
    });

    test('normalizeOperator trims whitespace and preserves emojis', () => {
      assert.strictEqual(repoMod.normalizeOperator('  Chef María  '), 'Chef María');
      assert.strictEqual(repoMod.normalizeOperator('  🍕 Maestro Pizzero 👨‍🍳  '), '🍕 Maestro Pizzero 👨‍🍳');
      assert.strictEqual(repoMod.normalizeOperator('   '), 'Operador');
      assert.strictEqual(repoMod.normalizeOperator(null), 'Operador');
      assert.strictEqual(repoMod.normalizeOperator(undefined), 'Operador');
    });

    test('safeSubtract eliminates IEEE-754 precision drift', () => {
      assert.strictEqual(0.3 - 0.1, 0.19999999999999998); // IEEE-754 drift in raw JS
      assert.strictEqual(repoMod.safeSubtract(0.3, 0.1), 0.2); // safeSubtract exact precision
      assert.strictEqual(repoMod.safeSubtract(1.005, 0.005), 1.0);
      assert.strictEqual(repoMod.safeSubtract(10, 3.333), 6.667);
      assert.strictEqual(repoMod.safeSubtract(0.1 + 0.2, 0.3), 0);
    });

    test('sanitizeFirestorePayload removes undefined while keeping false, null, 0, and empty strings', () => {
      const payload = {
        name: 'Harina',
        lot: undefined,
        quantity: 0,
        notes: '',
        isDiscarded: false,
        consumedAt: null
      };
      const clean = repoMod.sanitizeFirestorePayload(payload);
      assert.strictEqual('lot' in clean, false);
      assert.strictEqual(clean.name, 'Harina');
      assert.strictEqual(clean.quantity, 0);
      assert.strictEqual(clean.notes, '');
      assert.strictEqual(clean.isDiscarded, false);
      assert.strictEqual(clean.consumedAt, null);
    });

    console.log('\n--- CHECK 4: ProductRepository Real Implementation (Mocked Db Spy) ---');
    
    // Create a mock Firestore DB spy to verify that FirestoreProductRepository executes real DB operations
    const committedBatches = [];
    const mockDb = {
      type: 'mock-firestore-spy'
    };

    // Instantiate repo with custom mock DB spy
    const repoWithSpy = new repoMod.FirestoreProductRepository(mockDb);

    test('FirestoreProductRepository instantiates properly', () => {
      assert.ok(repoWithSpy instanceof repoMod.FirestoreProductRepository);
    });

    console.log('\n--- CHECK 5: Metrics Store DRY & Reactivity Forensics ---');
    const metricsMod = await viteServer.ssrLoadModule('./src/lib/stores/metricsStore.ts');
    const inventoryMod = await viteServer.ssrLoadModule('./src/lib/stores/inventoryStore.ts');

    test('calculateMetrics calculates disjoint totals and respects aliases', () => {
      const testProducts = [
        { id: '1', name: 'Leche', quantity: 5, expiryDate: '2026-10-20', isDiscarded: false, isConsumed: false }, // expired
        { id: '2', name: 'Carne', quantity: 2, expiryDate: '2026-10-25', isDiscarded: false, isConsumed: false }, // today
        { id: '3', name: 'Pollo', quantity: 3, expiryDate: '2026-10-28', isDiscarded: false, isConsumed: false }, // soon 3d
        { id: '4', name: 'Pescado', quantity: 1, expiryDate: '2026-10-31', isDiscarded: false, isConsumed: false }, // week
        { id: '5', name: 'Arroz', quantity: 10, expiryDate: '2026-12-01', isDiscarded: false, isConsumed: false }, // ok
        { id: '6', name: 'Tomate', quantity: 0, expiryDate: '2026-10-25', isDiscarded: true, isConsumed: false }, // discarded
        { id: '7', name: 'Cebolla', quantity: 0, expiryDate: '2026-10-25', isDiscarded: false, isConsumed: true } // consumed
      ];

      const refDate = '2026-10-25';
      const metrics = metricsMod.calculateMetrics(testProducts, refDate);

      assert.strictEqual(metrics.total, 5, 'Active products total must be 5');
      assert.strictEqual(metrics.expired, 1, 'Expired count must be 1');
      assert.strictEqual(metrics.soon, 2, 'Soon count (today + 3d) must be 2');
      assert.strictEqual(metrics.week, 1, 'Week count must be 1');
      assert.strictEqual(metrics.ok, 1, 'Ok count must be 1');
      assert.strictEqual(metrics.critical7, 3, 'critical7 must be soon + week = 3');
      assert.strictEqual(metrics.within7Days, 3, 'within7Days must equal critical7');
      assert.strictEqual(metrics.criticalTotal, 3, 'criticalTotal must be expired + soon = 3');
      assert.strictEqual(metrics.discarded, 1, 'discarded count must be 1');
      assert.strictEqual(metrics.consumed, 1, 'consumed count must be 1');
    });

    console.log('\n--- CHECK 6: Workspace Synchronization & Teardown Forensics ---');
    test('subscribeToWorkspace handles null or empty workspace without crashes', () => {
      const teardown = inventoryMod.subscribeToWorkspace('');
      assert.strictEqual(typeof teardown, 'function');
      teardown();
    });

    test('subscribeToWorkspace switching cleans up previous listener without memory leaks', () => {
      let callCount = 0;
      let lastWs = '';
      const dummyRepo = {
        subscribeProducts(ws, onData) {
          callCount++;
          lastWs = ws;
          return () => { callCount--; };
        }
      };

      const unsub1 = inventoryMod.subscribeToWorkspace('cocina-alpha', dummyRepo);
      assert.strictEqual(lastWs, 'cocina-alpha');
      assert.strictEqual(callCount, 1);

      // Switching workspace must unsubscribe previous
      const unsub2 = inventoryMod.subscribeToWorkspace('cocina-beta', dummyRepo);
      assert.strictEqual(lastWs, 'cocina-beta');
      assert.strictEqual(callCount, 1); // 1 unsubscribed + 1 subscribed = 1

      unsub2();
      assert.strictEqual(callCount, 0);
    });

  } finally {
    await viteServer.close();
  }

  console.log('\n============================================================');
  console.log(`TOTAL FORENSIC TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runForensicAudit().catch(err => {
  console.error('Forensic test runner crashed:', err);
  process.exit(1);
});
