# Handoff Report: Milestone 2 Adversarial Stress Testing (Challenger 1)

**Agent**: `challenger_m2_1` (Role: Adversarial Data & Repository Challenger)  
**Working Directory**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/challenger_m2_1/`  
**Date**: 2026-10-25T21:28:00Z  
**Parent Agent**: `1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c`  
**Handoff Type**: Hard (Adversarial Verification Complete)  
**Explicit Verdict**: `REQUEST_CHANGES`

---

## 1. Observation

### 1.1 Direct Source Code Inspection of `src/lib/repositories/productRepository.ts`
1. **Path Traversal & Operator Normalization (`src/lib/repositories/productRepository.ts`, Lines 42–63)**:
   ```typescript
   export function normalizeWorkspaceId(raw: unknown): string {
     if (!raw || typeof raw !== 'string') return 'cocina-principal';
     const clean = raw
       .trim()
       .toLowerCase()
       .normalize('NFD')
       .replace(/[\u0300-\u036f]/g, '') // remove accents
       .replace(/[^a-z0-9_-]/g, '-')
       .replace(/-+/g, '-')
       .replace(/^-|-$/g, '');
     return clean || 'cocina-principal';
   }

   export function normalizeOperator(raw: unknown): string {
     if (typeof raw !== 'string') return 'Operador';
     const clean = raw.trim();
     return clean.length > 0 ? clean : 'Operador';
   }
   ```

2. **Float Subtraction Utility (`src/lib/repositories/productRepository.ts`, Lines 68–71)**:
   ```typescript
   export function safeSubtract(a: number, b: number): number {
     const factor = 100000;
     return Math.round((a - b) * factor) / factor;
   }
   ```

3. **Stock Consumption Logic (`src/lib/repositories/productRepository.ts`, Lines 453–487)**:
   ```typescript
   const remainingQty = safeSubtract(current.quantity, amount);
   const isExhausted = remainingQty <= 0;
   const now = new Date().toISOString();

   const batch = writeBatch(db);

   batch.update(prodRef, {
     quantity: increment(-amount),
     isConsumed: isExhausted,
     updatedAt: now,
     updatedBy: cleanOp,
     lastAction: 'consume',
     ...(isExhausted ? { consumedAt: now, consumedBy: cleanOp } : {})
   });

   const histRef = doc(collection(db, 'workspaces', cleanWs, 'history'));
   batch.set(histRef, {
     id: histRef.id,
     productId: id,
     productName: current.name,
     category: current.category,
     action: 'consume',
     quantityBefore: current.quantity,
     quantityDelta: -amount,
     quantityAfter: remainingQty,
     unit: current.unit,
     operatorAlias: cleanOp,
     operator: cleanOp,
     amount: amount,
     timestamp: now,
     reason: reason || 'Consumo operacional'
   });
   ```

4. **Product Listener Snapshot Mapping (`src/lib/repositories/productRepository.ts`, Lines 193–195)**:
   ```typescript
   category: normalizeCategory(d.category),
   quantity: typeof d.quantity === 'number' ? d.quantity : 0,
   unit: normalizeUnit(d.unit),
   ```
   Note: While `category`, `unit`, and `location` are passed through their respective domain normalizers (`normalizeCategory`, `normalizeUnit`, `normalizeLocation`), `quantity` is **NOT** passed through `normalizeQuantity(d.quantity)`.

5. **Bulk Import Chunking (`src/lib/repositories/productRepository.ts`, Lines 656–662)**:
   ```typescript
   const CHUNK_SIZE = 200; // 2 writes per item = 400 operations max per batch
   let totalImported = 0;

   for (let i = 0; i < products.length; i += CHUNK_SIZE) {
     const chunk = products.slice(i, i + CHUNK_SIZE);
     const batch = writeBatch(db);
   ```

---

### 1.2 Adversarial Stress Test Suite Execution
An empirical adversarial test suite was authored in:
- `tests/adversarial/adversarial_repository_stress.js`
- `tests/adversarial/mock_firestore.js`

Command executed:
```bash
node tests/adversarial/adversarial_repository_stress.js
```

Verbatim test execution output:
```text
================================================================
⚔️  STARTING EMPIRICAL ADVERSARIAL STRESS TEST SUITE (M2 REPO) ⚔️
Target: src/lib/repositories/productRepository.ts
Node.js version: v24.11.1
Working Directory: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono
================================================================

--- SUITE 1: Path Traversal Injection & Dirty Workspace Normalization ---
  ✓ PASS: normalizeWorkspaceId: relative directory traversal ../../root
  ✓ PASS: normalizeWorkspaceId must never contain slashes: "root"
  ✓ PASS: normalizeWorkspaceId must never contain backslashes: "root"
  ✓ PASS: normalizeWorkspaceId must never contain dots: "root"
  ✓ PASS: normalizeWorkspaceId must never contain consecutive hyphens: "root"
  ✓ PASS: normalizeWorkspaceId must strictly match safe slug regex: "root"
  ✓ PASS: normalizeWorkspaceId: deep unix traversal ../../../etc/passwd
  ✓ PASS: normalizeWorkspaceId must never contain slashes: "etc-passwd"
  ✓ PASS: normalizeWorkspaceId must never contain backslashes: "etc-passwd"
  ✓ PASS: normalizeWorkspaceId must never contain dots: "etc-passwd"
  ✓ PASS: normalizeWorkspaceId must never contain consecutive hyphens: "etc-passwd"
  ✓ PASS: normalizeWorkspaceId must strictly match safe slug regex: "etc-passwd"
  ✓ PASS: normalizeWorkspaceId: double slash and parent step workspace//../admin
  ✓ PASS: normalizeWorkspaceId must never contain slashes: "workspace-admin"
  ✓ PASS: normalizeWorkspaceId must never contain backslashes: "workspace-admin"
  ✓ PASS: normalizeWorkspaceId must never contain dots: "workspace-admin"
  ✓ PASS: normalizeWorkspaceId must never contain consecutive hyphens: "workspace-admin"
  ✓ PASS: normalizeWorkspaceId must strictly match safe slug regex: "workspace-admin"
  ✓ PASS: normalizeWorkspaceId: pure traversal slashes fallback to default
  ✓ PASS: normalizeWorkspaceId: double dot only fallback
  ✓ PASS: normalizeWorkspaceId: single dot only fallback
  ✓ PASS: normalizeWorkspaceId: empty string fallback
  ✓ PASS: normalizeWorkspaceId: spaces fallback
  ✓ PASS: normalizeWorkspaceId: control whitespace fallback
  ✓ PASS: normalizeWorkspaceId: null value fallback
  ✓ PASS: normalizeWorkspaceId: undefined value fallback
  ✓ PASS: normalizeWorkspaceId: numeric type fallback
  ✓ PASS: normalizeWorkspaceId: object type fallback
  ✓ PASS: normalizeWorkspaceId: array type fallback
  ✓ PASS: normalizeWorkspaceId: mixed path with traversal
  ✓ PASS: normalizeWorkspaceId: URL encoded slashes neutralized
  ✓ PASS: normalizeWorkspaceId: Windows backslash traversal neutralized
  ✓ PASS: normalizeWorkspaceId: hyphen, slash, dot sequence fallback
  ✓ PASS: normalizeWorkspaceId: spaces, punctuation, accents stripped
  ✓ PASS: normalizeWorkspaceId: Spanish accents & ñ normalized
  ✓ PASS: normalizeWorkspaceId: valid alphanumeric with underscores and hyphens preserved

--- SUITE 2: Dirty Operator Aliases & Fallbacks ---
  ✓ PASS: normalizeOperator: empty string fallback
  ✓ PASS: normalizeOperator must always return non-empty string
  ✓ PASS: normalizeOperator: spaces fallback
  ✓ PASS: normalizeOperator: control whitespace fallback
  ✓ PASS: normalizeOperator: trims leading and trailing whitespace
  ✓ PASS: normalizeOperator: preserves culinary emojis
  ✓ PASS: normalizeOperator: preserves international scripts
  ✓ PASS: normalizeOperator: preserves raw string safely (escaped by Svelte UI)
  ✓ PASS: normalizeOperator: preserves SQL-style characters without crashing
  ✓ PASS: normalizeOperator: preserves apostrophes and ampersands
  ✓ PASS: normalizeOperator: null fallback
  ✓ PASS: normalizeOperator: undefined fallback
  ✓ PASS: normalizeOperator: number 0 fallback
  ✓ PASS: normalizeOperator: boolean false fallback
  ✓ PASS: normalizeOperator: object fallback
  ✓ PASS: normalizeOperator: array fallback

--- SUITE 3: IEEE 754 Float Precision & Safe Subtraction ---
  ✓ PASS: Raw JS 0.3 - 0.1 exhibits IEEE 754 precision drift
  ✓ PASS: safeSubtract(0.3, 0.1) equals strictly 0.2
  ✓ PASS: safeSubtract(1.0, 0.9) equals strictly 0.1
  ✓ PASS: safeSubtract(0.7, 0.1) equals strictly 0.6
  ✓ PASS: safeSubtract(0.15, 0.05) equals strictly 0.1
  ✓ PASS: safeSubtract(1.25, 0.025) equals strictly 1.225
  ✓ PASS: 50 consecutive safeSubtract(0.1) from 5.0 reaches exactly 0 (no float drift)
  ✓ PASS: 100 consecutive safeSubtract(0.07) from 7.0 reaches exactly 0 (no float drift)
  ✓ PASS: 50 consecutive safeSubtract(0.025) from 1.25 reaches exactly 0 (no float drift)

--- SUITE 4: Payload Sanitization & Firestore Field Protection ---
  ✓ PASS: sanitizeFirestorePayload strips undefined key badUndefined1
  ✓ PASS: sanitizeFirestorePayload strips undefined key badUndefined2
  ✓ PASS: sanitizeFirestorePayload preserves numeric 0
  ✓ PASS: sanitizeFirestorePayload preserves boolean false
  ✓ PASS: sanitizeFirestorePayload preserves null value
  ✓ PASS: sanitizeFirestorePayload preserves string value
  ✓ PASS: sanitizeFirestorePayload does not mutate input object

--- SUITE 5: Overconsumption Clamping & Protection ---
  ✓ PASS: consumeStock rejects overconsumption (6 requested > 5 available) (Threw: "Insufficient stock: requested 6, available 5")
  ✓ PASS: Product quantity remained exactly 5 after rejected overconsumption
  ✓ PASS: Zero batches committed after rejected overconsumption
  ✓ PASS: Valid consumption committed 1 batch
  ✓ PASS: Stock decremented from 5 to 3
  ✓ PASS: isConsumed remains false after partial consumption
  ✓ PASS: lastAction stamped as "consume"
  ✓ PASS: Final consumption committed batch
  ✓ PASS: Stock decremented to 0
  ✓ PASS: isConsumed transitions to true at 0 quantity
  ✓ PASS: consumedAt timestamp stamped on full exhaustion
  ✓ PASS: consumedBy operator stamped on full exhaustion
  ✓ PASS: consumeStock rejects consuming from product with 0 available quantity (Threw: "Cannot consume: product has 0 available quantity")
  ✓ PASS: consumeStock rejects non-existent product (Threw: "Product non_existent_id not found in workspace cocina-principal")

--- SUITE 6: Consuming Zero, Negative, or Non-Numeric Stock ---
  ✓ PASS: consumeStock strictly rejects amount = 0 (Threw: "Invalid consumption amount: 0. Must be > 0.")
  ✓ PASS: consumeStock strictly rejects negative amount = -1 (Threw: "Invalid consumption amount: -1. Must be > 0.")
  ✓ PASS: consumeStock strictly rejects fractional negative amount = -0.001 (Threw: "Invalid consumption amount: -0.001. Must be > 0.")
  ✓ PASS: consumeStock strictly rejects NaN (Threw: "Invalid consumption amount: NaN. Must be > 0.")
  ✓ PASS: consumeStock strictly rejects string "1" (Threw: "Invalid consumption amount: 1. Must be > 0.")
  ✓ PASS: consumeStock strictly rejects null (Threw: "Invalid consumption amount: null. Must be > 0.")

--- SUITE 7: Discarding Already-Discarded Products & HACCP Waste ---
  ✓ PASS: discardStock sets quantity to 0
  ✓ PASS: discardStock marks isDiscarded: true
  ✓ PASS: discardStock ensures isConsumed is false
  ✓ PASS: discardReason stamped
  ✓ PASS: discardedBy operator stamped
  ✓ PASS: discardedAt timestamp stamped
  ✓ PASS: discardStock rejects discarding an already-discarded product (Threw: "Product is already discarded")
  ✓ PASS: consumeStock rejects consuming an already-discarded product (Threw: "Cannot consume discarded product")

--- SUITE 8: High-Frequency Sequential Stock Decrements (50 consecutive calls) ---
  ✓ PASS: Step 1/50: stock decremented to 4.9
  ✓ PASS: Step 1/50: isConsumed remains false
  ✗ FAIL: Step 2/50: stock decremented to 4.8 — Expected: 4.8, Got: 4.800000000000001
  ...
  ✗ FAIL: Step 50/50: stock decremented to 0 — Expected: 0, Got: 1.0269562977782698e-15
  ✓ PASS: Step 50/50: isConsumed becomes true on final 0.0 decrement
  ✗ FAIL: Step 50/50: final stock is strictly 0.0 — Expected: 0, Got: 1.0269562977782698e-15
  ✓ PASS: All 50 high-frequency decrements committed atomically
  ✓ PASS: Attempted 51st decrement on exhausted stock is rejected (Threw: "Cannot consume: product has 0 available quantity")

--- SUITE 9: Bulk Import Chunking & 500-Operation Limit Verification ---
  ✓ PASS: batchImport returned exactly 501 imported items
  ✓ PASS: batchImport executed exactly 3 batch commits for 501 items
  ✓ PASS: Batch 1 contains exactly 400 operations (200 products + 200 history logs)
  ✓ PASS: Batch 2 contains exactly 400 operations (200 products + 200 history logs)
  ✓ PASS: Batch 3 contains exactly 202 operations (101 products + 101 history logs)
  ✓ PASS: Batch 1 operations (400) strictly respects Firestore 500-write limit
  ✓ PASS: Batch 2 operations (400) strictly respects Firestore 500-write limit
  ✓ PASS: Batch 3 operations (202) strictly respects Firestore 500-write limit
  ✓ PASS: batchImport imported 1,000 items
  ✓ PASS: batchImport executed exactly 5 batches for 1,000 items
  ✓ PASS: Batch 1 has exactly 400 operations <= 500
  ✓ PASS: Batch 2 has exactly 400 operations <= 500
  ✓ PASS: Batch 3 has exactly 400 operations <= 500
  ✓ PASS: Batch 4 has exactly 400 operations <= 500
  ✓ PASS: Batch 5 has exactly 400 operations <= 500
  ✓ PASS: batchImport with empty array returns 0
  ✓ PASS: batchImport with empty array commits 0 batches

--- SUITE 10: Immutability, Restore, & Audit Trail Contracts ---
  ✓ PASS: Immutable field "id" preserved against overwrite
  ✓ PASS: Immutable field "createdAt" preserved
  ✓ PASS: Immutable field "createdBy" preserved
  ✓ PASS: Immutable field "createdByUid" preserved
  ✓ PASS: Mutable field "name" updated
  ✓ PASS: Mutable field "quantity" updated
  ✓ PASS: updatedBy correctly stamped with current operator
  ✓ PASS: restoreStock restored 3 units (12 + 3 = 15)
  ✓ PASS: restoreStock sets isConsumed to false
  ✓ PASS: lastAction set to "undo_consume"
  ✓ PASS: restoreStock strictly rejects amount = 0 (Threw: "Invalid restore amount: 0")
  ✓ PASS: restoreStock strictly rejects negative amount = -5 (Threw: "Invalid restore amount: -5")
  ✓ PASS: deleteProduct successfully deleted product document

--- SUITE 11: Headless SSR Noop Mode Smoke Test ---
  ✓ PASS: subscribeProducts returns empty array in headless SSR mode
  ✓ PASS: subscribeProducts reports pendingWrites=false in headless SSR mode
  ✓ PASS: subscribeProducts returns valid unsubscribe function

================================================================
🏁 EMPIRICAL TEST SUITE SUMMARY: M2 PRODUCT REPOSITORY
================================================================
TOTAL ASSERTIONS: 336
PASSED: 286
FAILED: 50
```

---

## 2. Logic Chain

1. **Robust Security & Boundary Protections Verified (Obs 1.2, Suites 1, 2, 4, 5, 6, 7, 9, 10)**:
   - **Path Traversal Protection**: `normalizeWorkspaceId` passed all 21 dirty vectors (`../../root` -> `'root'`, `../../../etc/passwd` -> `'etc-passwd'`, `workspace//../admin` -> `'workspace-admin'`). Slashes, backslashes, and dots are completely stripped; outputs strictly match `/^[a-z0-9_-]+$/`.
   - **Operator Alias Sanitization**: `normalizeOperator` gracefully normalizes dirty aliases, trims whitespace, preserves emojis (`👩‍🍳 Chef María 👨‍🍳🔥`) and scripts, while safely falling back to `'Operador'` on empty strings or non-string inputs.
   - **Overconsumption & Non-Positive Inputs**: `consumeStock` strictly throws when requested amount > stock (`Insufficient stock: requested 6, available 5`) and rejects zero, negative, NaN, and non-numeric consumption requests.
   - **Discard Immutability**: Discarding an already-discarded item is strictly rejected (`Product is already discarded`).
   - **Bulk Import Chunk Limits**: `batchImport` with 501 items chunks into 3 batches of (400, 400, 202 operations), never exceeding Firestore's 500-operation `WriteBatch` ceiling.
   - **Immutability of Audit Fields**: `updateProduct` strips and protects `id`, `createdAt`, `createdBy`, and `createdByUid`.

2. **Root Cause Analysis of Bug 1: Missing Clamping to 0 on Exhaustion (Obs 1.1.3, Obs 1.2 Suite 8)**:
   - In `consumeStock`, line 453 accurately calculates `const remainingQty = safeSubtract(current.quantity, amount)`.
   - When 50 consecutive decrements of `0.1` are applied to an initial stock of `5.0`:
     - At step 50, `safeSubtract(current.quantity, amount)` calculates `remainingQty = 0`.
     - `isExhausted` is evaluated as `true`.
   - However, in line 460:
     ```typescript
     batch.update(prodRef, {
       quantity: increment(-amount), // passes increment(-0.1) instead of 0
       isConsumed: isExhausted,
       ...
     ```
   - Because `batch.update` passes `increment(-amount)` to Firestore rather than snapping `quantity` to `0` when `isExhausted === true`, Firestore's database engine computes `-0.1` using native 64-bit IEEE 754 floating point arithmetic.
   - Cumulative precision drift causes the stored document quantity to settle at `1.0269562977782698e-15` instead of `0`.

3. **Root Cause Analysis of Bug 2: Data Divergence Between Ledger and Document State (Obs 1.1.3, Obs 1.2 Suite 8)**:
   - In `consumeStock` line 477, the HACCP audit entry records:
     `quantityAfter: remainingQty` (which is `0` via `safeSubtract`).
   - Meanwhile, the product document in Firestore is updated with:
     `quantity: increment(-amount)` (which is `1.0269562977782698e-15`).
   - The audit log states that the product has `0` remaining, but the product document retains a non-zero float residue, creating state divergence between the inventory record and the immutable audit trail.

4. **Root Cause Analysis of Bug 3: Leakage of Unrounded Float Drift to UI and Stores (Obs 1.1.4)**:
   - In `subscribeProducts` (line 194):
     `quantity: typeof d.quantity === 'number' ? d.quantity : 0`
   - Unlike `category`, `unit`, and `location` which are normalized via domain normalizers, `d.quantity` is passed raw.
   - Because `normalizeQuantity(d.quantity)` is omitted, floating-point artifacts like `4.800000000000001` or `1.0269562977782698e-15` flow directly into `inventoryStore`, `metricsStore`, and CSV/JSON exports.

5. **Operational Risk of Firestore Security Rule Rejection (Obs 1.1.3, firestore.rules)**:
   - `firestore.rules` specifies:
     `allow read, write: if workspaceId != '' && request.resource.data.quantity >= 0;`
   - If accumulated IEEE 754 drift on decimal quantities ever produces a negative value (e.g. `-1.0e-16`), Firestore security rules will abort the write with `permission-denied`, preventing kitchen staff from consuming remaining ingredients.

---

## 3. Caveats

1. The path traversal protection, operator alias fallbacks, overconsumption protection, discard protection, and bulk import chunk limits are thoroughly tested, robust, and conform to the project specification.
2. Integer decrements (e.g. decrementing by 1 unit from 5) do not exhibit IEEE 754 float drift in Firestore. The precision drift manifests specifically during fractional/decimal consumption (e.g. 0.1 kg, 0.05 L).
3. No other caveats.

---

## 4. Conclusion & Actionable Recommendations

### Explicit Verdict: `REQUEST_CHANGES`

The repository implementation in `src/lib/repositories/productRepository.ts` must be updated by `worker_m2` to fix the sequential decrement float precision bug and audit divergence before Milestone 2 can be approved.

### Required Actions for `worker_m2`:

1. **Fix `consumeStock` in `src/lib/repositories/productRepository.ts`**:
   When `isExhausted` is true, snap `quantity` strictly to `0` rather than passing `increment(-amount)`:
   ```typescript
   batch.update(prodRef, {
     quantity: isExhausted ? 0 : increment(-amount),
     isConsumed: isExhausted,
     updatedAt: now,
     updatedBy: cleanOp,
     lastAction: 'consume',
     ...(isExhausted ? { consumedAt: now, consumedBy: cleanOp } : {})
   });
   ```

2. **Sanitize `quantity` in `subscribeProducts` (`src/lib/repositories/productRepository.ts`, Line 194)**:
   Pass `d.quantity` through `normalizeQuantity` (already imported from `$lib/domain/models`):
   ```typescript
   quantity: normalizeQuantity(d.quantity),
   ```
   This ensures that any intermediate float drift from `increment(-amount)` (such as `4.800000000000001`) is rounded to 3 decimal places (`4.8`) before reaching stores, UI components, metrics counters, and CSV/JSON exports.

3. **Check `restoreStock` (`src/lib/repositories/productRepository.ts`, Line 615)**:
   Ensure restored quantities do not accumulate float drift when undoing consumption of fractional units.

---

## 5. Verification Method

To independently verify the adversarial findings and reproduction:

```bash
# 1. Run the empirical adversarial repository stress test suite
node tests/adversarial/adversarial_repository_stress.js

# 2. Run existing E2E opaque-box test suite (Tiers 1-4)
npm test

# 3. Run type checker
npm run check
```

### Invalidation Conditions:
The `REQUEST_CHANGES` verdict is invalidated and becomes `APPROVE` once:
- `node tests/adversarial/adversarial_repository_stress.js` exits with code `0` and 100% assertions passing.
- 50 consecutive decrements of `0.1` reach strictly `0.0`.
- Stored quantity on exhausted products is `0`.
- `npm test` and `npm run check` continue to pass with 0 errors.
