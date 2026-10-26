/**
 * StockControl PWA — Empirical Adversarial Stress Test Suite (Milestone 2)
 * Target: src/lib/repositories/productRepository.ts
 *
 * Attack Vectors:
 * 1. Path traversal injection (../../root, ../../../etc/passwd, workspace//../admin, etc.)
 * 2. Dirty operator aliases (extreme whitespace, emojis, script tags, SQLi, special chars)
 * 3. Float precision traps & safe subtraction (0.3 - 0.1, 50 consecutive decrements)
 * 4. Payload sanitization (stripping undefined, preserving falsy values)
 * 5. Overconsumption clamping & rejection (amount > stock, 0 stock)
 * 6. Non-positive stock consumption rejection (0, negative, NaN, non-numeric)
 * 7. Discarding already-discarded products & HACCP waste logging
 * 8. High-frequency sequential stock decrements (50 consecutive calls on live repository)
 * 9. Bulk import chunk limits (>500 items, verifying Firestore 500-operation limit safety)
 * 10. Update immutability protection & 1-tap undo restoration
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
  const match = JSON.stringify(actual) === JSON.stringify(expected);
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

async function runAdversarialRepositorySuite() {
  console.log('================================================================');
  console.log('⚔️  STARTING EMPIRICAL ADVERSARIAL STRESS TEST SUITE (M2 REPO) ⚔️');
  console.log(`Target: src/lib/repositories/productRepository.ts`);
  console.log(`Node.js version: ${process.version}`);
  console.log(`Working Directory: ${PROJECT_ROOT}`);
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

  let repoMod, mockMod;
  try {
    repoMod = await server.ssrLoadModule('./src/lib/repositories/productRepository.ts');
    mockMod = await server.ssrLoadModule('./tests/adversarial/mock_firestore.js');
  } catch (err) {
    console.error('Fatal crash loading repository module:', err);
    await server.close();
    process.exit(1);
  }

  const {
    normalizeWorkspaceId,
    normalizeOperator,
    safeSubtract,
    sanitizeFirestorePayload,
    FirestoreProductRepository,
    productRepository
  } = repoMod;

  const { mockFirestoreState } = mockMod;
  const mockDb = { type: 'mockDb' };

  // ============================================================================
  // SUITE 1: Path Traversal Injection & Dirty Workspace Normalization
  // ============================================================================
  console.log('\n--- SUITE 1: Path Traversal Injection & Dirty Workspace Normalization ---');

  const traversalVectors = [
    { input: '../../root', expected: 'root', desc: 'relative directory traversal ../../root' },
    { input: '../../../etc/passwd', expected: 'etc-passwd', desc: 'deep unix traversal ../../../etc/passwd' },
    { input: 'workspace//../admin', expected: 'workspace-admin', desc: 'double slash and parent step workspace//../admin' },
    { input: '../../../../', expected: 'cocina-principal', desc: 'pure traversal slashes fallback to default' },
    { input: '..', expected: 'cocina-principal', desc: 'double dot only fallback' },
    { input: '.', expected: 'cocina-principal', desc: 'single dot only fallback' },
    { input: '', expected: 'cocina-principal', desc: 'empty string fallback' },
    { input: '   ', expected: 'cocina-principal', desc: 'spaces fallback' },
    { input: '\t\r\n   ', expected: 'cocina-principal', desc: 'control whitespace fallback' },
    { input: null, expected: 'cocina-principal', desc: 'null value fallback' },
    { input: undefined, expected: 'cocina-principal', desc: 'undefined value fallback' },
    { input: 12345, expected: 'cocina-principal', desc: 'numeric type fallback' },
    { input: {}, expected: 'cocina-principal', desc: 'object type fallback' },
    { input: ['admin'], expected: 'cocina-principal', desc: 'array type fallback' },
    { input: 'workspace/../../etc/passwd', expected: 'workspace-etc-passwd', desc: 'mixed path with traversal' },
    { input: '..%2F..%2Froot', expected: '2f-2froot', desc: 'URL encoded slashes neutralized' },
    { input: '..\\..\\windows\\system32', expected: 'windows-system32', desc: 'Windows backslash traversal neutralized' },
    { input: '---///...---', expected: 'cocina-principal', desc: 'hyphen, slash, dot sequence fallback' },
    { input: 'Cocina Central #1 (Sede Norte)!', expected: 'cocina-central-1-sede-norte', desc: 'spaces, punctuation, accents stripped' },
    { input: 'Cocina del Ñandú, Éxito y Café', expected: 'cocina-del-nandu-exito-y-cafe', desc: 'Spanish accents & ñ normalized' },
    { input: 'admin_kitchen_1', expected: 'admin_kitchen_1', desc: 'valid alphanumeric with underscores and hyphens preserved' }
  ];

  for (const { input, expected, desc } of traversalVectors) {
    const res = normalizeWorkspaceId(input);
    assertEquals(res, expected, `normalizeWorkspaceId: ${desc}`);
    assert(!res.includes('/'), `normalizeWorkspaceId must never contain slashes: "${res}"`);
    assert(!res.includes('\\'), `normalizeWorkspaceId must never contain backslashes: "${res}"`);
    assert(!res.includes('.'), `normalizeWorkspaceId must never contain dots: "${res}"`);
    assert(!res.includes('--'), `normalizeWorkspaceId must never contain consecutive hyphens: "${res}"`);
    assert(/^[a-z0-9_-]+$/.test(res), `normalizeWorkspaceId must strictly match safe slug regex: "${res}"`);
  }

  // ============================================================================
  // SUITE 2: Dirty Operator Aliases & Fallbacks
  // ============================================================================
  console.log('\n--- SUITE 2: Dirty Operator Aliases & Fallbacks ---');

  const operatorVectors = [
    { input: '', expected: 'Operador', desc: 'empty string fallback' },
    { input: '   ', expected: 'Operador', desc: 'spaces fallback' },
    { input: '   \t\r\n   ', expected: 'Operador', desc: 'control whitespace fallback' },
    { input: '  Chef Mario  ', expected: 'Chef Mario', desc: 'trims leading and trailing whitespace' },
    { input: '👩‍🍳 Chef María 👨‍🍳🔥', expected: '👩‍🍳 Chef María 👨‍🍳🔥', desc: 'preserves culinary emojis' },
    { input: '李师傅 - 厨房', expected: '李师傅 - 厨房', desc: 'preserves international scripts' },
    { input: '<script>alert("xss")</script>', expected: '<script>alert("xss")</script>', desc: 'preserves raw string safely (escaped by Svelte UI)' },
    { input: "'; DROP TABLE products; --", expected: "'; DROP TABLE products; --", desc: 'preserves SQL-style characters without crashing' },
    { input: "O'Connor & Sons", expected: "O'Connor & Sons", desc: 'preserves apostrophes and ampersands' },
    { input: null, expected: 'Operador', desc: 'null fallback' },
    { input: undefined, expected: 'Operador', desc: 'undefined fallback' },
    { input: 0, expected: 'Operador', desc: 'number 0 fallback' },
    { input: false, expected: 'Operador', desc: 'boolean false fallback' },
    { input: {}, expected: 'Operador', desc: 'object fallback' },
    { input: [], expected: 'Operador', desc: 'array fallback' }
  ];

  for (const { input, expected, desc } of operatorVectors) {
    const res = normalizeOperator(input);
    assertEquals(res, expected, `normalizeOperator: ${desc}`);
    assert(typeof res === 'string' && res.length > 0, `normalizeOperator must always return non-empty string`);
  }

  // ============================================================================
  // SUITE 3: IEEE 754 Float Precision & Safe Subtraction
  // ============================================================================
  console.log('\n--- SUITE 3: IEEE 754 Float Precision & Safe Subtraction ---');

  // Verify classic JavaScript float precision failures eliminated by safeSubtract
  assertEquals(0.3 - 0.1, 0.19999999999999998, 'Raw JS 0.3 - 0.1 exhibits IEEE 754 precision drift');
  assertEquals(safeSubtract(0.3, 0.1), 0.2, 'safeSubtract(0.3, 0.1) equals strictly 0.2');
  assertEquals(safeSubtract(1.0, 0.9), 0.1, 'safeSubtract(1.0, 0.9) equals strictly 0.1');
  assertEquals(safeSubtract(0.7, 0.1), 0.6, 'safeSubtract(0.7, 0.1) equals strictly 0.6');
  assertEquals(safeSubtract(0.15, 0.05), 0.1, 'safeSubtract(0.15, 0.05) equals strictly 0.1');
  assertEquals(safeSubtract(1.25, 0.025), 1.225, 'safeSubtract(1.25, 0.025) equals strictly 1.225');

  // 50 consecutive decrements of 0.1 starting from 5.0
  let qty50 = 5.0;
  for (let i = 0; i < 50; i++) {
    qty50 = safeSubtract(qty50, 0.1);
  }
  assertEquals(qty50, 0, '50 consecutive safeSubtract(0.1) from 5.0 reaches exactly 0 (no float drift)');

  // 100 consecutive decrements of 0.07 starting from 7.0
  let qty100 = 7.0;
  for (let i = 0; i < 100; i++) {
    qty100 = safeSubtract(qty100, 0.07);
  }
  assertEquals(qty100, 0, '100 consecutive safeSubtract(0.07) from 7.0 reaches exactly 0 (no float drift)');

  // 50 consecutive decrements of 0.025 starting from 1.25
  let qtyHalf = 1.25;
  for (let i = 0; i < 50; i++) {
    qtyHalf = safeSubtract(qtyHalf, 0.025);
  }
  assertEquals(qtyHalf, 0, '50 consecutive safeSubtract(0.025) from 1.25 reaches exactly 0 (no float drift)');

  // ============================================================================
  // SUITE 4: Payload Sanitization & Firestore Field Protection
  // ============================================================================
  console.log('\n--- SUITE 4: Payload Sanitization & Firestore Field Protection ---');

  const dirtyPayload = {
    validStr: 'test',
    validNum: 0,
    validBool: false,
    validNull: null,
    validArr: [1, 2, 3],
    validObj: { nested: true },
    badUndefined1: undefined,
    badUndefined2: undefined
  };

  const cleanPayload = sanitizeFirestorePayload(dirtyPayload);
  assert(!('badUndefined1' in cleanPayload), 'sanitizeFirestorePayload strips undefined key badUndefined1');
  assert(!('badUndefined2' in cleanPayload), 'sanitizeFirestorePayload strips undefined key badUndefined2');
  assert(cleanPayload.validNum === 0, 'sanitizeFirestorePayload preserves numeric 0');
  assert(cleanPayload.validBool === false, 'sanitizeFirestorePayload preserves boolean false');
  assert(cleanPayload.validNull === null, 'sanitizeFirestorePayload preserves null value');
  assert(cleanPayload.validStr === 'test', 'sanitizeFirestorePayload preserves string value');
  assert('badUndefined1' in dirtyPayload, 'sanitizeFirestorePayload does not mutate input object');

  // ============================================================================
  // SUITE 5: Overconsumption Clamping & Protection
  // ============================================================================
  console.log('\n--- SUITE 5: Overconsumption Clamping & Protection ---');

  const repo = new FirestoreProductRepository(mockDb);

  // Setup: seed product with 5 units
  mockFirestoreState.reset();
  const testWs = 'cocina-principal';
  const prod1Id = 'prod_consume_1';
  const prod1Path = `workspaces/${testWs}/products/${prod1Id}`;

  mockFirestoreState.seedDoc(prod1Path, {
    id: prod1Id,
    name: 'Carne Molida Especial',
    category: 'Carnes y pescados',
    quantity: 5,
    unit: 'kg',
    isDiscarded: false,
    isConsumed: false
  });

  // Test 5.1: Consuming more than available stock throws Insufficient stock
  await assertThrowsAsync(
    () => repo.consumeStock(testWs, prod1Id, 6, 'Cocinero', 'Overconsumption test'),
    'Insufficient stock: requested 6, available 5',
    'consumeStock rejects overconsumption (6 requested > 5 available)'
  );

  // Test 5.2: Product quantity unchanged after rejected overconsumption
  const unchangeSnap = mockFirestoreState.getDocData(prod1Path);
  assertEquals(unchangeSnap.quantity, 5, 'Product quantity remained exactly 5 after rejected overconsumption');
  assertEquals(mockFirestoreState.commitCount, 0, 'Zero batches committed after rejected overconsumption');

  // Test 5.3: Valid partial consumption
  await repo.consumeStock(testWs, prod1Id, 2, 'Cocinero', 'Consumo normal');
  assertEquals(mockFirestoreState.commitCount, 1, 'Valid consumption committed 1 batch');
  const afterPartial = mockFirestoreState.getDocData(prod1Path);
  assertEquals(afterPartial.quantity, 3, 'Stock decremented from 5 to 3');
  assertEquals(afterPartial.isConsumed, false, 'isConsumed remains false after partial consumption');
  assertEquals(afterPartial.lastAction, 'consume', 'lastAction stamped as "consume"');

  // Test 5.4: Consume remaining 3 units -> transitions to isConsumed: true
  await repo.consumeStock(testWs, prod1Id, 3, 'Cocinero', 'Consumo final');
  assertEquals(mockFirestoreState.commitCount, 2, 'Final consumption committed batch');
  const afterExhaust = mockFirestoreState.getDocData(prod1Path);
  assertEquals(afterExhaust.quantity, 0, 'Stock decremented to 0');
  assertEquals(afterExhaust.isConsumed, true, 'isConsumed transitions to true at 0 quantity');
  assert(Boolean(afterExhaust.consumedAt), 'consumedAt timestamp stamped on full exhaustion');
  assertEquals(afterExhaust.consumedBy, 'Cocinero', 'consumedBy operator stamped on full exhaustion');

  // Test 5.5: Consuming from exhausted product throws Cannot consume
  await assertThrowsAsync(
    () => repo.consumeStock(testWs, prod1Id, 1, 'Cocinero'),
    'Cannot consume: product has 0 available quantity',
    'consumeStock rejects consuming from product with 0 available quantity'
  );

  // Test 5.6: Consuming from non-existent product throws not found
  await assertThrowsAsync(
    () => repo.consumeStock(testWs, 'non_existent_id', 1, 'Cocinero'),
    'not found in workspace',
    'consumeStock rejects non-existent product'
  );

  // ============================================================================
  // SUITE 6: Consuming Zero, Negative, or Non-Numeric Stock
  // ============================================================================
  console.log('\n--- SUITE 6: Consuming Zero, Negative, or Non-Numeric Stock ---');

  const prod2Id = 'prod_consume_2';
  const prod2Path = `workspaces/${testWs}/products/${prod2Id}`;
  mockFirestoreState.seedDoc(prod2Path, {
    id: prod2Id,
    name: 'Leche Entera',
    category: 'Lácteos',
    quantity: 10,
    unit: 'L',
    isDiscarded: false,
    isConsumed: false
  });

  await assertThrowsAsync(
    () => repo.consumeStock(testWs, prod2Id, 0, 'Cocinero'),
    'Invalid consumption amount: 0. Must be > 0.',
    'consumeStock strictly rejects amount = 0'
  );

  await assertThrowsAsync(
    () => repo.consumeStock(testWs, prod2Id, -1, 'Cocinero'),
    'Invalid consumption amount: -1. Must be > 0.',
    'consumeStock strictly rejects negative amount = -1'
  );

  await assertThrowsAsync(
    () => repo.consumeStock(testWs, prod2Id, -0.001, 'Cocinero'),
    'Invalid consumption amount: -0.001. Must be > 0.',
    'consumeStock strictly rejects fractional negative amount = -0.001'
  );

  await assertThrowsAsync(
    () => repo.consumeStock(testWs, prod2Id, NaN, 'Cocinero'),
    'Invalid consumption amount: NaN. Must be > 0.',
    'consumeStock strictly rejects NaN'
  );

  await assertThrowsAsync(
    () => repo.consumeStock(testWs, prod2Id, '1', 'Cocinero'),
    'Invalid consumption amount: 1. Must be > 0.',
    'consumeStock strictly rejects string "1"'
  );

  await assertThrowsAsync(
    () => repo.consumeStock(testWs, prod2Id, null, 'Cocinero'),
    'Invalid consumption amount: null. Must be > 0.',
    'consumeStock strictly rejects null'
  );

  // ============================================================================
  // SUITE 7: Discarding Already-Discarded Products & HACCP Waste
  // ============================================================================
  console.log('\n--- SUITE 7: Discarding Already-Discarded Products & HACCP Waste ---');

  const prod3Id = 'prod_discard_3';
  const prod3Path = `workspaces/${testWs}/products/${prod3Id}`;
  mockFirestoreState.seedDoc(prod3Path, {
    id: prod3Id,
    name: 'Pescado Fresco',
    category: 'Carnes y pescados',
    quantity: 4.5,
    unit: 'kg',
    isDiscarded: false,
    isConsumed: false
  });

  // Discard valid product
  await repo.discardStock(testWs, prod3Id, 'Caducado / Vencido', 'Chef Supervisor');
  const discardedSnap = mockFirestoreState.getDocData(prod3Path);
  assertEquals(discardedSnap.quantity, 0, 'discardStock sets quantity to 0');
  assertEquals(discardedSnap.isDiscarded, true, 'discardStock marks isDiscarded: true');
  assertEquals(discardedSnap.isConsumed, false, 'discardStock ensures isConsumed is false');
  assertEquals(discardedSnap.discardReason, 'Caducado / Vencido', 'discardReason stamped');
  assertEquals(discardedSnap.discardedBy, 'Chef Supervisor', 'discardedBy operator stamped');
  assert(Boolean(discardedSnap.discardedAt), 'discardedAt timestamp stamped');

  // Attempting to discard already-discarded product throws error
  await assertThrowsAsync(
    () => repo.discardStock(testWs, prod3Id, 'Mal estado / Deterioro', 'Chef Supervisor'),
    'Product is already discarded',
    'discardStock rejects discarding an already-discarded product'
  );

  // Attempting to consume an already-discarded product throws error
  await assertThrowsAsync(
    () => repo.consumeStock(testWs, prod3Id, 1, 'Cocinero'),
    'Cannot consume discarded product',
    'consumeStock rejects consuming an already-discarded product'
  );

  // ============================================================================
  // SUITE 8: High-Frequency Sequential Stock Decrements (50 consecutive calls)
  // ============================================================================
  console.log('\n--- SUITE 8: High-Frequency Sequential Stock Decrements (50 consecutive calls) ---');

  const seqProdId = 'prod_seq_50';
  const seqProdPath = `workspaces/${testWs}/products/${seqProdId}`;
  mockFirestoreState.seedDoc(seqProdPath, {
    id: seqProdId,
    name: 'Salsa de Tomate Concentrada',
    category: 'Abarrotes y secos',
    quantity: 5.0,
    unit: 'L',
    isDiscarded: false,
    isConsumed: false
  });

  const initialCommitCount = mockFirestoreState.commitCount;

  // Execute 50 consecutive decrements of 0.1
  for (let i = 1; i <= 50; i++) {
    await repo.consumeStock(testWs, seqProdId, 0.1, `Cocinero_${i % 3}`);
    const snap = mockFirestoreState.getDocData(seqProdPath);
    const expectedRemaining = safeSubtract(5.0, i * 0.1);
    assertEquals(snap.quantity, expectedRemaining, `Step ${i}/50: stock decremented to ${expectedRemaining}`);
    if (i < 50) {
      assert(snap.isConsumed === false, `Step ${i}/50: isConsumed remains false`);
    } else {
      assert(snap.isConsumed === true, `Step 50/50: isConsumed becomes true on final 0.0 decrement`);
      assertEquals(snap.quantity, 0, `Step 50/50: final stock is strictly 0.0`);
    }
  }

  assertEquals(
    mockFirestoreState.commitCount,
    initialCommitCount + 50,
    'All 50 high-frequency decrements committed atomically'
  );

  // Attempt 51st decrement on exhausted stock -> must throw
  await assertThrowsAsync(
    () => repo.consumeStock(testWs, seqProdId, 0.1, 'Cocinero'),
    'Cannot consume: product has 0 available quantity',
    'Attempted 51st decrement on exhausted stock is rejected'
  );

  // ============================================================================
  // SUITE 9: Bulk Import Chunking & 500-Operation Limit Verification
  // ============================================================================
  console.log('\n--- SUITE 9: Bulk Import Chunking & 500-Operation Limit Verification ---');

  // Test 9.1: Import exactly 501 items.
  // 501 items * 2 writes per item = 1,002 operations.
  // Firestore hard limit is 500 operations per WriteBatch.
  // Repository must chunk at CHUNK_SIZE = 200 (400 ops max per batch).
  // Expected batches: Chunk 1 (200), Chunk 2 (200), Chunk 3 (101) = 3 batches.
  mockFirestoreState.reset();
  const bulkWs = 'cocina-import-stress';

  const items501 = Array.from({ length: 501 }, (_, idx) => ({
    name: `Bulk Product ${idx + 1}`,
    category: 'Abarrotes y secos',
    quantity: 10 + (idx % 5),
    unit: 'unidad(es)',
    receivedDate: '2026-10-25',
    expiryDate: '2027-01-01',
    location: 'Despensa'
  }));

  const importedCount = await repo.batchImport(bulkWs, items501, 'Import Manager');
  assertEquals(importedCount, 501, 'batchImport returned exactly 501 imported items');
  assertEquals(mockFirestoreState.committedBatches.length, 3, 'batchImport executed exactly 3 batch commits for 501 items');

  const batch1Ops = mockFirestoreState.committedBatches[0].length;
  const batch2Ops = mockFirestoreState.committedBatches[1].length;
  const batch3Ops = mockFirestoreState.committedBatches[2].length;

  assertEquals(batch1Ops, 400, 'Batch 1 contains exactly 400 operations (200 products + 200 history logs)');
  assertEquals(batch2Ops, 400, 'Batch 2 contains exactly 400 operations (200 products + 200 history logs)');
  assertEquals(batch3Ops, 202, 'Batch 3 contains exactly 202 operations (101 products + 101 history logs)');

  for (let b = 0; b < mockFirestoreState.committedBatches.length; b++) {
    const ops = mockFirestoreState.committedBatches[b].length;
    assert(
      ops <= 500,
      `Batch ${b + 1} operations (${ops}) strictly respects Firestore 500-write limit`
    );
  }

  // Test 9.2: Import 1,000 items -> 5 batches of 400 operations
  mockFirestoreState.reset();
  const items1000 = Array.from({ length: 1000 }, (_, idx) => ({
    name: `Mega Bulk ${idx + 1}`,
    category: 'Lácteos',
    quantity: 1,
    unit: 'unidad(es)',
    location: 'Cámara 1'
  }));

  const count1000 = await repo.batchImport(bulkWs, items1000, 'Admin');
  assertEquals(count1000, 1000, 'batchImport imported 1,000 items');
  assertEquals(mockFirestoreState.committedBatches.length, 5, 'batchImport executed exactly 5 batches for 1,000 items');
  for (let b = 0; b < 5; b++) {
    assertEquals(mockFirestoreState.committedBatches[b].length, 400, `Batch ${b + 1} has exactly 400 operations <= 500`);
  }

  // Test 9.3: Import 0 items
  mockFirestoreState.reset();
  const count0 = await repo.batchImport(bulkWs, [], 'Admin');
  assertEquals(count0, 0, 'batchImport with empty array returns 0');
  assertEquals(mockFirestoreState.committedBatches.length, 0, 'batchImport with empty array commits 0 batches');

  // ============================================================================
  // SUITE 10: Immutability, Restore, & Audit Trail Contracts
  // ============================================================================
  console.log('\n--- SUITE 10: Immutability, Restore, & Audit Trail Contracts ---');

  mockFirestoreState.reset();
  const auditWs = 'cocina-audit';
  const immutableProdId = 'prod_immutable_1';
  const immutableProdPath = `workspaces/${auditWs}/products/${immutableProdId}`;

  mockFirestoreState.seedDoc(immutableProdPath, {
    id: immutableProdId,
    name: 'Vino Blanco Cocina',
    category: 'Bebidas',
    quantity: 8,
    unit: 'L',
    createdAt: '2026-10-01T12:00:00.000Z',
    createdBy: 'Original Creator',
    createdByUid: 'orig_uid_123',
    updatedAt: '2026-10-01T12:00:00.000Z',
    updatedBy: 'Original Creator',
    isDiscarded: false,
    isConsumed: false
  });

  // Attempt to overwrite immutable identity fields
  await repo.updateProduct(
    auditWs,
    immutableProdId,
    {
      id: 'MALICIOUS_OVERWRITE_ID',
      createdAt: '1970-01-01T00:00:00.000Z',
      createdBy: 'Malicious Attacker',
      createdByUid: 'evil_uid',
      name: 'Vino Blanco Modificado',
      quantity: 12
    },
    'Chef Editor'
  );

  const updatedSnap = mockFirestoreState.getDocData(immutableProdPath);
  assertEquals(updatedSnap.id, immutableProdId, 'Immutable field "id" preserved against overwrite');
  assertEquals(updatedSnap.createdAt, '2026-10-01T12:00:00.000Z', 'Immutable field "createdAt" preserved');
  assertEquals(updatedSnap.createdBy, 'Original Creator', 'Immutable field "createdBy" preserved');
  assertEquals(updatedSnap.createdByUid, 'orig_uid_123', 'Immutable field "createdByUid" preserved');
  assertEquals(updatedSnap.name, 'Vino Blanco Modificado', 'Mutable field "name" updated');
  assertEquals(updatedSnap.quantity, 12, 'Mutable field "quantity" updated');
  assertEquals(updatedSnap.updatedBy, 'Chef Editor', 'updatedBy correctly stamped with current operator');

  // Test 10.2: restoreStock (1-Tap Undo)
  await repo.restoreStock(auditWs, immutableProdId, 3, 'Chef Undo');
  const restoredSnap = mockFirestoreState.getDocData(immutableProdPath);
  assertEquals(restoredSnap.quantity, 15, 'restoreStock restored 3 units (12 + 3 = 15)');
  assertEquals(restoredSnap.isConsumed, false, 'restoreStock sets isConsumed to false');
  assertEquals(restoredSnap.lastAction, 'undo_consume', 'lastAction set to "undo_consume"');

  // Restore non-positive amount throws error
  await assertThrowsAsync(
    () => repo.restoreStock(auditWs, immutableProdId, 0, 'Chef Undo'),
    'Invalid restore amount: 0',
    'restoreStock strictly rejects amount = 0'
  );
  await assertThrowsAsync(
    () => repo.restoreStock(auditWs, immutableProdId, -5, 'Chef Undo'),
    'Invalid restore amount: -5',
    'restoreStock strictly rejects negative amount = -5'
  );

  // Test 10.3: deleteProduct
  await repo.deleteProduct(auditWs, immutableProdId, 'Admin Deleter');
  const deletedSnap = mockFirestoreState.getDocData(immutableProdPath);
  assert(deletedSnap === undefined, 'deleteProduct successfully deleted product document');

  // ============================================================================
  // SUITE 11: Headless SSR Noop Mode Smoke Test
  // ============================================================================
  console.log('\n--- SUITE 11: Headless SSR Noop Mode Smoke Test ---');

  // When default productRepository is evaluated without customDb in SSR,
  // subscribeProducts returns empty array without throwing, and unsubscribe is a noop.
  let ssrProductsReceived = null;
  let ssrPendingWrites = null;
  const unsubSSR = productRepository.subscribeProducts('test-workspace', (items, pending) => {
    ssrProductsReceived = items;
    ssrPendingWrites = pending;
  });

  assertEquals(ssrProductsReceived, [], 'subscribeProducts returns empty array in headless SSR mode');
  assertEquals(ssrPendingWrites, false, 'subscribeProducts reports pendingWrites=false in headless SSR mode');
  assert(typeof unsubSSR === 'function', 'subscribeProducts returns valid unsubscribe function');
  unsubSSR(); // should not throw

  await server.close();

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log('🏁 EMPIRICAL TEST SUITE SUMMARY: M2 PRODUCT REPOSITORY');
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
    console.log('\n>>> ALL ADVERSARIAL STRESS TESTS COMPLETED WITH 100% SUCCESS.');
    console.log('>>> VERDICT: APPROVE');
    process.exit(0);
  }
}

runAdversarialRepositorySuite().catch((err) => {
  console.error('Unhandled fatal error in test suite:', err);
  process.exit(1);
});
