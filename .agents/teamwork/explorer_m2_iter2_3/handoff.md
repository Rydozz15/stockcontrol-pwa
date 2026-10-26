# Handoff Report: Product Repository Float Clamping & Normalization Strategy

**Agent**: `explorer_m2_iter2_3`  
**Role**: Product Repository Float Clamping & Normalization Strategy Explorer  
**Working Directory**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_iter2_3/`  
**Date**: 2026-10-25T21:38:00Z  
**Parent Agent**: `1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c`  
**Handoff Type**: Hard (Investigation & Strategy Formulation Complete)  

---

## 1. Observation

### 1.1 Direct Source Code Inspection of `src/lib/repositories/productRepository.ts`

1. **`consumeStock` Implementation (`src/lib/repositories/productRepository.ts`, Lines 449–487)**:
   ```typescript
   if (amount > (current.quantity ?? 0)) {
     throw new Error(`Insufficient stock: requested ${amount}, available ${current.quantity}`);
   }

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

   await batch.commit();
   ```
   **Observation**:
   - Line 453 accurately calculates `remainingQty = safeSubtract(current.quantity, amount)` and `isExhausted = remainingQty <= 0`.
   - Line 460 passes `quantity: increment(-amount)` to Firestore `batch.update()`. Even when `isExhausted === true`, it applies `increment(-amount)` rather than snapping `quantity` to `0`.
   - Line 477 records `quantityAfter: remainingQty` in the history subcollection ledger.

2. **`subscribeProducts` Implementation (`src/lib/repositories/productRepository.ts`, Lines 188–218)**:
   ```typescript
   snapshot.forEach((docSnap) => {
     const d = docSnap.data();
     items.push({
       id: docSnap.id,
       name: d.name || '',
       category: normalizeCategory(d.category),
       quantity: typeof d.quantity === 'number' ? d.quantity : 0,
       unit: normalizeUnit(d.unit),
       ...
     });
   });
   ```
   **Observation**:
   - While `category`, `unit`, and `location` are sanitized using their respective domain normalizers (`normalizeCategory`, `normalizeUnit`, `normalizeLocation`), `quantity` (Line 194) is passed raw as `typeof d.quantity === 'number' ? d.quantity : 0`.
   - `normalizeQuantity` is already imported on Line 34 from `$lib/domain/models`, but was not applied to `d.quantity` in `subscribeProducts`.

3. **`restoreStock` Implementation (`src/lib/repositories/productRepository.ts`, Lines 607–621)**:
   ```typescript
   const prodRef = doc(db, 'workspaces', cleanWs, 'products', id);
   const prodSnap = await getDoc(prodRef);
   const current = prodSnap.exists() ? (prodSnap.data() as Product) : null;

   const now = new Date().toISOString();
   const batch = writeBatch(db);

   batch.update(prodRef, {
     quantity: increment(amount),
     isConsumed: false,
     updatedAt: now,
     updatedBy: cleanOp,
     lastAction: 'undo_consume'
   });
   ```
   **Observation**:
   - `restoreStock` uses `quantity: increment(amount)`. If `amount` is fractional (e.g., 0.1 kg), native float addition in Firestore can introduce float drift (e.g., 0.1 + 0.2 = 0.30000000000000004).

---

### 1.2 Inspection of `src/lib/domain/models.ts`

Lines 204–208 of `src/lib/domain/models.ts`:
```typescript
export function normalizeQuantity(val: unknown): number {
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num) || !isFinite(num) || num < 0) return 0;
  return Math.round((num + Number.EPSILON) * 1000) / 1000;
}
```
**Observation**:
- `normalizeQuantity` safely parses numbers or numeric strings, converts NaN, infinity, and negative values to `0`, and rounds numbers to 3 decimal places using `Math.round((num + Number.EPSILON) * 1000) / 1000`.

---

### 1.3 Baseline Adversarial Test Execution

Command executed:
```bash
node tests/adversarial/adversarial_repository_stress.js
```
Output:
```text
================================================================
🏁 EMPIRICAL TEST SUITE SUMMARY: M2 PRODUCT REPOSITORY
================================================================
TOTAL ASSERTIONS: 336
PASSED: 286
FAILED: 50

FAILURES RECORDED:
  1. Step 2/50: stock decremented to 4.8 — Expected: 4.8, Got: 4.800000000000001
  2. Step 3/50: stock decremented to 4.7 — Expected: 4.7, Got: 4.700000000000001
  ...
  48. Step 49/50: stock decremented to 0.1 — Expected: 0.1, Got: 0.10000000000000103
  49. Step 50/50: stock decremented to 0 — Expected: 0, Got: 1.0269562977782698e-15
  50. Step 50/50: final stock is strictly 0.0 — Expected: 0, Got: 1.0269562977782698e-15

VERDICT: REQUEST_CHANGES
```

---

### 1.4 Crucial Finding: Suite 8 Verification Mechanics in `tests/adversarial/adversarial_repository_stress.js`

Lines 426–438 of `tests/adversarial/adversarial_repository_stress.js`:
```javascript
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
```
**Observation**:
- Line 429 reads `mockFirestoreState.getDocData(seqProdPath)` directly (the raw stored Firestore document).
- Line 431 asserts `assertEquals(snap.quantity, expectedRemaining)` at **every single step from `i = 1` to `50`**.
- When `consumeStock` applies `quantity: isExhausted ? 0 : increment(-amount)`:
  - Step 50 snaps to `0` (Passing 2 assertions: `stock decremented to 0` and `final stock strictly 0.0`).
  - **However, Steps 2 through 49 still fail 48 assertions**, because `increment(-0.1)` on `4.9` in 64-bit IEEE 754 produces `4.800000000000001`.
  - When tested empirically with `quantity: isExhausted ? 0 : increment(-amount)`, the test result was:
    `TOTAL ASSERTIONS: 336 | PASSED: 288 | FAILED: 48`.
- Conversely, when `consumeStock` applies `quantity: isExhausted ? 0 : remainingQty`:
  - **All 50 steps pass without any float drift**.
  - Test result:
    `TOTAL ASSERTIONS: 336 | PASSED: 336 | FAILED: 0 | >>> VERDICT: APPROVE`.

---

## 2. Logic Chain

1. **Root Cause of Final Residual Dust (`1.0269562977782698e-15`)**:
   - In `consumeStock`, Line 453 evaluates `safeSubtract(current.quantity, amount) <= 0`.
   - On the 50th decrement of `0.1` from `5.0`, `remainingQty` reaches exactly `0`.
   - Because Line 460 executes `quantity: increment(-amount)` rather than snapping to `0`, Firestore performs cumulative floating-point subtraction (`5.0 - 50 * 0.1`), leaving residual float dust `1.0269562977782698e-15` in the document.
   - This causes audit ledger divergence: the history record at Line 477 logs `quantityAfter: 0`, but the product document retains a non-zero float.

2. **Root Cause of Intermediate Float Drift Leakage**:
   - In `subscribeProducts`, Line 194 does not pass `d.quantity` through `normalizeQuantity(d.quantity)`.
   - Any raw float drift accumulated in Firestore documents (`4.800000000000001`, `1.0269562977782698e-15`) flows unrounded into `inventoryStore`, `metricsStore`, UI cards, and JSON/CSV backups.

3. **Analysis of Remediation Options for `consumeStock`**:
   - In `consumeStock`, Lines 436–450 perform an asynchronous `getDoc(prodRef)` before performing the batch write, verifying existence, discarded state, and verifying `amount <= current.quantity`.
   - Because `current.quantity` is **already retrieved and verified in memory**, `remainingQty` (`safeSubtract(current.quantity, amount)`) is deterministically known prior to building the batch.
   - If `quantity` is written as `isExhausted ? 0 : remainingQty`:
     - Every intermediate step in Firestore stores the exact rounded decimal (`4.9`, `4.8`, `4.7`, ..., `0.0`).
     - Product document state matches the audit log (`quantityAfter: remainingQty`) with zero divergence.
     - `tests/adversarial/adversarial_repository_stress.js` exits with code 0 and passes all 336 assertions (100%) immediately, with zero modifications to the test runner.
   - If `quantity` is written as `isExhausted ? 0 : increment(-amount)`:
     - The decrement uses Firestore's native `FieldValue.increment` operator.
     - However, native IEEE 754 float drift occurs on decimal quantities in the document (`4.800000000000001`), which causes `adversarial_repository_stress.js` line 431 to fail steps 2–49 unless Suite 8 normalizes `snap.quantity` with `normalizeQuantity` before asserting equality.

4. **Analysis of `restoreStock`**:
   - `restoreStock` is called for 1-tap undo operations (e.g., restoring 1 unit or 0.25 kg).
   - Line 608 already performs `await getDoc(prodRef)`.
   - Storing `restoredQty = current && typeof current.quantity === 'number' ? safeSubtract(current.quantity, -amount) : increment(amount)` eliminates float drift at the source, while `subscribeProducts`'s `normalizeQuantity` ensures any subscribers see clean decimal values.

---

## 3. Caveats

1. **Atomic Concurrency vs Pre-read**:
   `increment(-amount)` provides conflict-free counter decrements when multiple clients write concurrently without reading. However, `consumeStock` already enforces pre-read validation (`await getDoc(prodRef)`) to verify non-exhaustion, discard status, and HACCP history logging. Therefore, writing `remainingQty` or snapping to `0` on exhaustion is fully aligned with the application's transactional integrity.
2. **Adversarial Test Alignment**:
   `adversarial_repository_stress.js` directly asserts on raw doc snapshots (`mockFirestoreState.getDocData`). Writing `remainingQty` allows the repository to satisfy this strict contract without modifying the challenger's test suite.

---

## 4. Conclusion & Actionable Recommendations

### Prescribed Strategy for `worker_m2`

To achieve 100% test pass (336/336 assertions) and total elimination of float drift, implement the following exact changes in `src/lib/repositories/productRepository.ts`:

---

### Proposed Code Edit 1: `consumeStock` Clamping & Precision Fix

**Target File**: `src/lib/repositories/productRepository.ts`  
**Lines**: 453–467  

#### Before:
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
```

#### After (Option 1 — Recommended for 100% test pass):
```typescript
    const remainingQty = safeSubtract(current.quantity, amount);
    const isExhausted = remainingQty <= 0;
    const now = new Date().toISOString();

    const batch = writeBatch(db);

    batch.update(prodRef, {
      quantity: isExhausted ? 0 : remainingQty,
      isConsumed: isExhausted,
      updatedAt: now,
      updatedBy: cleanOp,
      lastAction: 'consume',
      ...(isExhausted ? { consumedAt: now, consumedBy: cleanOp } : {})
    });
```

*Note on Option 2 (Strict `increment`)*:  
If `quantity: isExhausted ? 0 : increment(-amount)` is used instead, step 50 snaps cleanly to 0, but steps 2–49 will require `tests/adversarial/adversarial_repository_stress.js` line 431 to apply `normalizeQuantity(snap.quantity)` to pass the test suite. Option 1 avoids any test suite modification.

---

### Proposed Code Edit 2: `subscribeProducts` Normalization

**Target File**: `src/lib/repositories/productRepository.ts`  
**Line**: 194  

#### Before:
```typescript
            quantity: typeof d.quantity === 'number' ? d.quantity : 0,
```

#### After:
```typescript
            quantity: normalizeQuantity(d.quantity),
```

**Rationale**:  
Ensures that any product document read from Firestore is rounded to 3 decimal places (`Math.round((n + EPSILON) * 1000) / 1000`) and negative/NaN values are clamped to `0` before propagating to `inventoryStore`, `metricsStore`, UI cards, and export routines.

---

### Proposed Code Edit 3: `restoreStock` Precision Protection

**Target File**: `src/lib/repositories/productRepository.ts`  
**Lines**: 607–621  

#### Before:
```typescript
    const prodRef = doc(db, 'workspaces', cleanWs, 'products', id);
    const prodSnap = await getDoc(prodRef);
    const current = prodSnap.exists() ? (prodSnap.data() as Product) : null;

    const now = new Date().toISOString();
    const batch = writeBatch(db);

    batch.update(prodRef, {
      quantity: increment(amount),
      isConsumed: false,
      updatedAt: now,
      updatedBy: cleanOp,
      lastAction: 'undo_consume'
    });
```

#### After:
```typescript
    const prodRef = doc(db, 'workspaces', cleanWs, 'products', id);
    const prodSnap = await getDoc(prodRef);
    const current = prodSnap.exists() ? (prodSnap.data() as Product) : null;

    const now = new Date().toISOString();
    const batch = writeBatch(db);

    const restoredQty = current && typeof current.quantity === 'number'
      ? safeSubtract(current.quantity, -amount)
      : increment(amount);

    batch.update(prodRef, {
      quantity: restoredQty,
      isConsumed: false,
      updatedAt: now,
      updatedBy: cleanOp,
      lastAction: 'undo_consume'
    });
```

---

### Proposed Code Edit 4: `updateProduct` Quantity Normalization

**Target File**: `src/lib/repositories/productRepository.ts`  
**Lines**: 379–385  

Ensure manual quantity edits via `updateProduct` are also normalized:
```typescript
    const safeUpdates: Record<string, any> = {
      ...updates,
      ...(updates.quantity !== undefined ? { quantity: normalizeQuantity(updates.quantity) } : {}),
      updatedAt: now,
      updatedBy: cleanOp,
      lastAction: updates.lastAction || 'update'
    };
```

---

## 5. Verification Method

To verify the strategy independently:

```bash
# 1. Run the empirical adversarial repository stress test suite (Target: 336/336 assertions passing)
node tests/adversarial/adversarial_repository_stress.js

# 2. Run independent forensic integrity audit (Target: 16/16 tests passing)
node tests/adversarial/adversarial_m2_forensic.js

# 3. Run full opaque-box E2E test suite (Target: 302/302 tests passing)
npm test

# 4. Run SvelteKit static check & type checker (Target: 0 errors, 0 warnings)
npm run check
```

### Expected Pass Output for `node tests/adversarial/adversarial_repository_stress.js`:
```text
================================================================
🏁 EMPIRICAL TEST SUITE SUMMARY: M2 PRODUCT REPOSITORY
================================================================
TOTAL ASSERTIONS: 336
PASSED: 336
FAILED: 0

>>> ALL ADVERSARIAL STRESS TESTS COMPLETED WITH 100% SUCCESS.
>>> VERDICT: APPROVE
```

### Invalidation Conditions:
This strategy is invalidated if:
1. `node tests/adversarial/adversarial_repository_stress.js` produces any assertion failure (< 336 assertions).
2. 50 consecutive decrements leave residual float dust > 0 on exhaustion.
3. `npm test` or `npm run check` reports regressions.
