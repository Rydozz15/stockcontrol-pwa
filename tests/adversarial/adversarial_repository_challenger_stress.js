/**
 * StockControl PWA — Empirical Challenger Stress Harness (M2 Iteration 2)
 * Path: tests/adversarial/adversarial_repository_challenger_stress.js
 *
 * EMPIRICAL ADVERSARIAL VALIDATION:
 * 1. 50 Consecutive Fractional Decrements (0.1 from 5.0):
 *    - Absolute snapping to 0 on 50th decrement
 *    - Zero IEEE-754 floating-point drift across all 50 intermediate steps
 *    - Zero audit divergence: for every step i, prod.quantity === history.quantityAfter
 *    - Strict ledger chain: history[i].quantityBefore === history[i-1].quantityAfter
 *    - Object.is(quantity, 0) strictly true (no -0)
 * 2. 100 Consecutive Micro-decrements (0.01 from 1.00):
 *    - Exhaustion snapping to 0 with zero float dust
 *    - Complete audit conservation law: Initial + sum(deltas) === 0
 * 3. Irregular Fractional Decrements (3.14159 exhaust):
 *    - [0.14159, 0.5, 0.25, 0.75, 0.5, 0.99, 0.01]
 *    - Snapping to 0.00000 with zero drift
 * 4. Interleaved Consume & Restore Cycle (20 rounds of 0.5):
 *    - Conservation law check: Stock returns to initial without drift
 * 5. Boundary & Special Float Precision Attacks:
 *    - 0.00001 micro-stock consumption & rejection of 0.00002
 *    - NaN, -Infinity, Infinity, -0, negative numbers, non-numeric strings
 *    - Overconsumption rejection on exhausted stock
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedAssertions++;
    failureDetails.push(message);
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  totalAssertions++;
  const match = Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected);
  if (match) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedAssertions++;
    const errMsg = `${message} — Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`;
    failureDetails.push(errMsg);
    console.error(`  ✗ FAIL: ${errMsg}`);
  }
}

async function assertThrowsAsync(fn, expectedSubstr, message) {
  totalAssertions++;
  try {
    await fn();
    failedAssertions++;
    const errMsg = `${message} — Expected to throw containing "${expectedSubstr}", but no error was thrown.`;
    failureDetails.push(errMsg);
    console.error(`  ✗ FAIL: ${errMsg}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (!expectedSubstr || errorMsg.includes(expectedSubstr)) {
      passedAssertions++;
      console.log(`  ✓ PASS: ${message} (Threw: "${errorMsg}")`);
    } else {
      failedAssertions++;
      const errMsg = `${message} — Threw "${errorMsg}", but expected to contain "${expectedSubstr}"`;
      failureDetails.push(errMsg);
      console.error(`  ✗ FAIL: ${errMsg}`);
    }
  }
}

async function runChallengerSuite() {
  console.log('================================================================');
  console.log('🔬 EMPIRICAL CHALLENGER ADVERSARIAL STRESS SUITE (M2 ITER 2) 🔬');
  console.log(`Target: src/lib/repositories/productRepository.ts`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('================================================================\n');

  const server = await createServer({
    root: PROJECT_ROOT,
    server: { middlewareMode: true },
    appType: 'custom',
    resolve: {
      alias: {
        'firebase/firestore': path.resolve(PROJECT_ROOT, 'tests/adversarial/mock_firestore.js')
      }
    }
  });

  const repoMod = await server.ssrLoadModule('./src/lib/repositories/productRepository.ts');
  const mockMod = await server.ssrLoadModule('./tests/adversarial/mock_firestore.js');

  const { FirestoreProductRepository, safeSubtract } = repoMod;
  const { mockFirestoreState } = mockMod;
  const mockDb = { type: 'mockDb' };
  const repo = new FirestoreProductRepository(mockDb);

  // Helper to get all history entries for a workspace sorted by insertion order
  function getWorkspaceHistory(workspaceId) {
    const prefix = `workspaces/${workspaceId}/history/`;
    const entries = [];
    for (const [docPath, data] of mockFirestoreState.docs.entries()) {
      if (docPath.startsWith(prefix)) {
        entries.push(data);
      }
    }
    return entries;
  }

  // ============================================================================
  // VECTOR 1: 50 Consecutive Fractional Decrements (0.1 from 5.0) Audit Ledger Lockstep
  // ============================================================================
  console.log('\n--- VECTOR 1: 50 Fractional Decrements Audit Lockstep & Zero Drift ---');
  mockFirestoreState.reset();
  const ws1 = 'cocina-audit-lockstep';
  const prodId1 = 'prod_50_fractional';
  const prodPath1 = `workspaces/${ws1}/products/${prodId1}`;

  mockFirestoreState.seedDoc(prodPath1, {
    id: prodId1,
    name: 'Crema de Leche Pastelera',
    category: 'Lácteos',
    quantity: 5.0,
    unit: 'L',
    isDiscarded: false,
    isConsumed: false,
    createdAt: new Date().toISOString(),
    createdBy: 'Chef Pastelero'
  });

  let previousQty = 5.0;

  for (let step = 1; step <= 50; step++) {
    const operator = `Cocinero_${step % 5}`;
    await repo.consumeStock(ws1, prodId1, 0.1, operator, `Paso ${step}`);

    // 1. Inspect live product document
    const prodSnap = mockFirestoreState.getDocData(prodPath1);
    const expectedQty = safeSubtract(5.0, step * 0.1);

    assertEquals(prodSnap.quantity, expectedQty, `Step ${step}/50: Product quantity strictly ${expectedQty}`);
    assert(typeof prodSnap.quantity === 'number', `Step ${step}/50: quantity is numeric`);
    assert(!String(prodSnap.quantity).includes('0000000000'), `Step ${step}/50: No float expansion trailing zeros`);
    assert(!String(prodSnap.quantity).includes('9999999999'), `Step ${step}/50: No float expansion trailing nines`);

    // 2. Inspect latest history log for this step
    const allHistory = getWorkspaceHistory(ws1);
    assertEquals(allHistory.length, step, `Step ${step}/50: Exactly ${step} history log entries recorded`);

    const latestHist = allHistory[allHistory.length - 1];
    assertEquals(latestHist.action, 'consume', `Step ${step}/50: History action is 'consume'`);
    assertEquals(latestHist.quantityBefore, previousQty, `Step ${step}/50: History quantityBefore strictly ${previousQty}`);
    assertEquals(latestHist.quantityDelta, -0.1, `Step ${step}/50: History quantityDelta is -0.1`);
    assertEquals(latestHist.quantityAfter, prodSnap.quantity, `Step ${step}/50: ZERO AUDIT DIVERGENCE (prod=${prodSnap.quantity}, hist=${latestHist.quantityAfter})`);
    assertEquals(latestHist.amount, 0.1, `Step ${step}/50: History amount is 0.1`);
    assertEquals(latestHist.operatorAlias, operator, `Step ${step}/50: Operator correctly attributed`);

    // Internal consistency of the history log itself
    const calculatedAfter = safeSubtract(latestHist.quantityBefore, latestHist.amount);
    assertEquals(latestHist.quantityAfter, calculatedAfter, `Step ${step}/50: History internal consistency (before - amount === after)`);

    if (step < 50) {
      assertEquals(prodSnap.isConsumed, false, `Step ${step}/50: isConsumed is false`);
    } else {
      assertEquals(prodSnap.isConsumed, true, `Step 50/50: isConsumed snapped to true on exhaustion`);
      assertEquals(prodSnap.quantity, 0, `Step 50/50: Final quantity snapped to strictly 0`);
      assert(Object.is(prodSnap.quantity, 0), `Step 50/50: Product quantity is positive zero (+0), not -0`);
      assertEquals(latestHist.quantityAfter, 0, `Step 50/50: Final history quantityAfter snapped to strictly 0`);
      assert(Object.is(latestHist.quantityAfter, 0), `Step 50/50: History quantityAfter is positive zero (+0), not -0`);
    }

    previousQty = prodSnap.quantity;
  }

  // Verify Audit Conservation Law across the entire 50 steps
  const finalHistory1 = getWorkspaceHistory(ws1);
  const totalDeltas1 = finalHistory1.reduce((sum, h) => safeSubtract(sum, -h.quantityDelta), 0);
  assertEquals(totalDeltas1, -5.0, 'Audit Conservation Law: Sum of 50 deltas strictly equals -5.0');

  // Attempt 51st decrement on exhausted stock
  await assertThrowsAsync(
    () => repo.consumeStock(ws1, prodId1, 0.1, 'Cocinero_Late'),
    'Cannot consume: product has 0 available quantity',
    'Attempted 51st decrement on exhausted stock is safely rejected'
  );

  // ============================================================================
  // VECTOR 2: 100 Consecutive Micro-Decrements (0.01 from 1.00)
  // ============================================================================
  console.log('\n--- VECTOR 2: 100 Consecutive Micro-Decrements (0.01 from 1.00) ---');
  mockFirestoreState.reset();
  const ws2 = 'cocina-micro-decrements';
  const prodId2 = 'prod_100_micro';
  const prodPath2 = `workspaces/${ws2}/products/${prodId2}`;

  mockFirestoreState.seedDoc(prodPath2, {
    id: prodId2,
    name: 'Azafrán en Hebras',
    category: 'Abarrotes y secos',
    quantity: 1.00,
    unit: 'g',
    isDiscarded: false,
    isConsumed: false
  });

  for (let step = 1; step <= 100; step++) {
    await repo.consumeStock(ws2, prodId2, 0.01, 'Cocinero_Azafran');
    const prodSnap = mockFirestoreState.getDocData(prodPath2);
    const expected = safeSubtract(1.00, step * 0.01);
    assertEquals(prodSnap.quantity, expected, `Micro-step ${step}/100: stock is ${expected}`);
  }

  const finalSnap2 = mockFirestoreState.getDocData(prodPath2);
  assertEquals(finalSnap2.quantity, 0, 'Micro-decrements: final stock strictly 0');
  assertEquals(finalSnap2.isConsumed, true, 'Micro-decrements: final isConsumed strictly true');

  const history2 = getWorkspaceHistory(ws2);
  assertEquals(history2.length, 100, 'Micro-decrements: exactly 100 history logs written');
  const sumDeltas2 = history2.reduce((acc, h) => safeSubtract(acc, -h.quantityDelta), 0);
  assertEquals(sumDeltas2, -1.0, 'Micro-decrements: total delta equals -1.00');

  // ============================================================================
  // VECTOR 3: Irregular Fractional Decrements (3.14159 exhaust)
  // ============================================================================
  console.log('\n--- VECTOR 3: Irregular Fractional Decrements (3.14159 exhaust) ---');
  mockFirestoreState.reset();
  const ws3 = 'cocina-irregular-fractions';
  const prodId3 = 'prod_pi';
  const prodPath3 = `workspaces/${ws3}/products/${prodId3}`;

  mockFirestoreState.seedDoc(prodPath3, {
    id: prodId3,
    name: 'Extracto Especial',
    category: 'Salsas y aderezos',
    quantity: 3.14159,
    unit: 'L',
    isDiscarded: false,
    isConsumed: false
  });

  const irregularFractions = [0.14159, 0.5, 0.25, 0.75, 0.5, 0.99, 0.01];
  let curPi = 3.14159;

  for (let idx = 0; idx < irregularFractions.length; idx++) {
    const fraction = irregularFractions[idx];
    await repo.consumeStock(ws3, prodId3, fraction, 'Cocinero_Pi');
    curPi = safeSubtract(curPi, fraction);
    const prodSnap = mockFirestoreState.getDocData(prodPath3);
    assertEquals(prodSnap.quantity, curPi, `Irregular fraction step ${idx + 1}: expected ${curPi}`);

    const history = getWorkspaceHistory(ws3);
    const latest = history[history.length - 1];
    assertEquals(latest.quantityAfter, prodSnap.quantity, `Irregular fraction step ${idx + 1}: Zero audit divergence`);
  }

  const finalPiSnap = mockFirestoreState.getDocData(prodPath3);
  assertEquals(finalPiSnap.quantity, 0, 'Irregular fractions: exactly snapped to 0');
  assertEquals(finalPiSnap.isConsumed, true, 'Irregular fractions: isConsumed is true');

  // ============================================================================
  // VECTOR 4: Interleaved Consume & Restore (20 rounds of 0.5)
  // ============================================================================
  console.log('\n--- VECTOR 4: Interleaved Consume & Restore (20 rounds of 0.5) ---');
  mockFirestoreState.reset();
  const ws4 = 'cocina-interleaved';
  const prodId4 = 'prod_interleaved';
  const prodPath4 = `workspaces/${ws4}/products/${prodId4}`;

  mockFirestoreState.seedDoc(prodPath4, {
    id: prodId4,
    name: 'Aceite de Oliva Extra Virgen',
    category: 'Abarrotes y secos',
    quantity: 10.0,
    unit: 'L',
    isDiscarded: false,
    isConsumed: false
  });

  for (let round = 1; round <= 20; round++) {
    // Consume 0.5
    await repo.consumeStock(ws4, prodId4, 0.5, 'Cocinero_Interleaved');
    let snap = mockFirestoreState.getDocData(prodPath4);
    assertEquals(snap.quantity, 9.5, `Round ${round}/20: consume 0.5 -> 9.5`);

    // Restore 0.5 (1-tap undo)
    await repo.restoreStock(ws4, prodId4, 0.5, 'Cocinero_Interleaved');
    snap = mockFirestoreState.getDocData(prodPath4);
    assertEquals(snap.quantity, 10.0, `Round ${round}/20: restore 0.5 -> 10.0 (no float drift)`);
    assertEquals(snap.isConsumed, false, `Round ${round}/20: isConsumed remains false`);
  }

  const history4 = getWorkspaceHistory(ws4);
  assertEquals(history4.length, 40, 'Interleaved: 40 operations logged in audit ledger');

  // ============================================================================
  // VECTOR 5: Boundary Precision & Float Attack Rejections
  // ============================================================================
  console.log('\n--- VECTOR 5: Boundary Precision & Float Attack Rejections ---');
  mockFirestoreState.reset();
  const ws5 = 'cocina-boundary';
  const prodId5 = 'prod_boundary';
  const prodPath5 = `workspaces/${ws5}/products/${prodId5}`;

  mockFirestoreState.seedDoc(prodPath5, {
    id: prodId5,
    name: 'Micro Stock Test',
    category: 'Otros',
    quantity: 0.00001,
    unit: 'g',
    isDiscarded: false,
    isConsumed: false
  });

  // Rejection of overconsumption by small epsilon
  await assertThrowsAsync(
    () => repo.consumeStock(ws5, prodId5, 0.00002, 'Attacker'),
    'Insufficient stock',
    'consumeStock rejects overconsumption by 0.00002 > 0.00001'
  );

  // Exact consumption of 0.00001 succeeds
  await repo.consumeStock(ws5, prodId5, 0.00001, 'Valid User');
  const boundSnap = mockFirestoreState.getDocData(prodPath5);
  assertEquals(boundSnap.quantity, 0, 'Micro stock 0.00001 exactly snapped to 0');
  assertEquals(boundSnap.isConsumed, true, 'Micro stock marked as isConsumed');

  // Invalid amounts rejection on active product (quantity = 10)
  const prodId6 = 'prod_active_invalid';
  const prodPath6 = `workspaces/${ws5}/products/${prodId6}`;
  mockFirestoreState.seedDoc(prodPath6, {
    id: prodId6,
    name: 'Active Product for Invalid Amount Tests',
    category: 'Otros',
    quantity: 10,
    unit: 'unidad(es)',
    isDiscarded: false,
    isConsumed: false
  });

  const invalidAmounts = [
    { val: 0, label: 'zero 0', expectedError: 'Invalid consumption amount' },
    { val: -0.1, label: 'negative -0.1', expectedError: 'Invalid consumption amount' },
    { val: -100, label: 'large negative -100', expectedError: 'Invalid consumption amount' },
    { val: NaN, label: 'NaN', expectedError: 'Invalid consumption amount' },
    { val: -Infinity, label: '-Infinity', expectedError: 'Invalid consumption amount' },
    { val: '0.1', label: 'string "0.1"', expectedError: 'Invalid consumption amount' },
    { val: null, label: 'null', expectedError: 'Invalid consumption amount' },
    { val: undefined, label: 'undefined', expectedError: 'Invalid consumption amount' },
    { val: {}, label: 'object {}', expectedError: 'Invalid consumption amount' },
    { val: Infinity, label: 'Infinity', expectedError: 'Insufficient stock' } // Exceeds available stock 10
  ];

  for (const { val, label, expectedError } of invalidAmounts) {
    await assertThrowsAsync(
      () => repo.consumeStock(ws5, prodId6, val, 'Attacker'),
      expectedError,
      `consumeStock on active stock safely rejects ${label} with "${expectedError}"`
    );
  }

  // Also verify rejections on exhausted product
  await assertThrowsAsync(
    () => repo.consumeStock(ws5, prodId5, 1, 'Attacker'),
    'Cannot consume: product has 0 available quantity',
    'consumeStock on exhausted product throws 0 available quantity'
  );

  // Restore stock invalid amounts rejection
  const invalidRestoreAmounts = [0, -1, NaN, -Infinity];
  for (const val of invalidRestoreAmounts) {
    await assertThrowsAsync(
      () => repo.restoreStock(ws5, prodId6, val, 'Attacker'),
      'Invalid restore amount',
      `restoreStock strictly rejects invalid amount: ${val}`
    );
  }

  await server.close();

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log('🏁 CHALLENGER SUITE SUMMARY: M2 PRODUCT REPOSITORY');
  console.log('================================================================');
  console.log(`TOTAL ASSERTIONS: ${totalAssertions}`);
  console.log(`PASSED: ${passedAssertions}`);
  console.log(`FAILED: ${failedAssertions}`);

  if (failedAssertions > 0) {
    console.error('\nFAILURES RECORDED:');
    failureDetails.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
    console.error('\nVERDICT: REQUEST_CHANGES');
    process.exit(1);
  } else {
    console.log('\n>>> ALL EMPIRICAL CHALLENGER TESTS PASSED (100%).');
    console.log('>>> VERDICT: APPROVE');
    process.exit(0);
  }
}

runChallengerSuite().catch((err) => {
  console.error('Unhandled fatal error in challenger suite:', err);
  process.exit(1);
});
