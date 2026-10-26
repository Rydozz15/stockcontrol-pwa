# Independent Review & Adversarial Critic Report: Milestone 2

**Agent**: `reviewer_m2_2`  
**Role**: Security & Real-Time Sync Reviewer / Adversarial Critic  
**Working Directory**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/reviewer_m2_2/`  
**Date**: 2026-10-25T21:23:00Z  
**Parent Agent**: `1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c`  
**Verdict**: **`REQUEST_CHANGES`**

---

## Review Summary

While the TypeScript source implementations (`firebase.ts`, `productRepository.ts`, `inventoryStore.ts`, `metricsStore.ts`) demonstrate high craftsmanship, clean architecture separation, excellent offline caching fallback, and robust arithmetic safety, an objective adversarial security analysis reveals a **Critical Functional Defect** in `firestore.rules` (Line 28).

In `firestore.rules`, combining `read, write` with a predicate evaluating `request.resource.data.quantity >= 0` causes Cloud Firestore's rules engine to throw a runtime exception on all `get` and `list` queries because `request.resource` is `null` during read operations. This causes all client queries to fail closed (`permission-denied`), completely breaking the PWA's real-time inventory synchronization on live Firestore instances.

Furthermore, two helper functions (`isValidWorkspace` and `isValidQuantity`) were defined in `firestore.rules` but left completely unused, and an edge case inconsistency exists between `inventoryStore.ts` and `domain/expiry.ts` regarding items with `quantity === 0`.

---

## 1. Observation

### 1.1 Verbatim Verification Commands and Outputs

1. **Typecheck (`npm run check`)**:
   ```text
   > stockcontrol-pwa@1.0.0 check
   > svelte-kit sync && svelte-check --tsconfig ./tsconfig.json

   Loading svelte-check in workspace: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono
   Getting Svelte diagnostics...

   svelte-check found 0 errors and 0 warnings
   ```

2. **Production Static Build (`npm run build`)**:
   ```text
   > stockcontrol-pwa@1.0.0 build
   > vite build

   vite v8.3.5 building ssr environment for production...
   ✓ 150 modules transformed.
   ✓ built in 337ms
   Analysing routes
   Building app
   vite v8.3.5 building client environment for production...
   ✓ 202 modules transformed.
   ✓ built in 504ms
   Prerendering
   crawling /
   > Using @sveltejs/adapter-static
   Wrote site to "build"
   ✔ done
   ```

3. **Automated E2E Test Suite (`npm test`)**:
   ```text
   ============================================================
          StockControl PWA - Automated E2E Test Suite          
      Opaque-Box Verification across Tiers 1-4 (>=300 Tests)   
   ============================================================

   ▶ Running Tier 1: Feature Coverage (27 test files)
     Summary: 135 passed, 0 failed (24ms)
   ▶ Running Tier 2: Boundary & Corner Cases (27 test files)
     Summary: 135 passed, 0 failed (118ms)
   ▶ Running Tier 3: Cross-Feature Combinations (1 test files)
     Summary: 27 passed, 0 failed (7ms)
   ▶ Running Tier 4: Real-World Kitchen Scenarios (5 test files)
     Summary: 5 passed, 0 failed (5ms)

   TOTAL ALL TIERS: 302 passed, 0 failed (157ms)
   >>> RESULT: SUCCESS - All 302 tests passed cleanly! (Exit Code 0)
   ```

4. **Adversarial Store Stress Suite (`node tests/adversarial/adversarial_store_stress.js`)**:
   ```text
   TOTAL EMPIRICAL TESTS: 138
   PASSED: 138
   FAILED: 0
   ALL ADVERSARIAL STRESS TESTS COMPLETED WITH 100% SUCCESS.
   ```

5. **Reviewer Independent Verification Suite (`node .agents/teamwork/reviewer_m2_2/test_verification.mjs`)**:
   ```text
   === Reviewer M2.2 Independent Verification Suite ===
   [Test 1] Testing productRepository exports and sanitizers...
     ✓ normalizeWorkspaceId passed all boundary cases
     ✓ normalizeOperator passed all boundary cases
     ✓ safeSubtract precision drift neutralization verified
     ✓ sanitizeFirestorePayload correctly strips undefined while preserving falsy values
   [Test 2] Testing firebase.ts SSR safety & config validator...
     ✓ firebase.ts SSR guard and config validator verified
   [Test 3] Testing metricsStore domain integration...
     ✓ metricsStore calculation and disjoint partition verified
   [Test 4] Testing inventoryStore lifecycle and repo wiring...
     ✓ inventoryStore listener lifecycle and pendingWrites verified (0 leaks)
   ALL INDEPENDENT VERIFICATION TESTS PASSED SUCCESSFULLY!
   ```

### 1.2 Inspection of `firestore.rules` (Lines 1–43)

```rules
1: rules_version = '2';
2: 
3: service cloud.firestore {
4:   match /databases/{database}/documents {
5: 
6:     // Helper functions for validating workspace and product data
7:     function isValidWorkspace(wsId) {
8:       return wsId != null && wsId != '' && wsId.size() <= 64;
9:     }
10: 
11:     function isValidQuantity(data) {
12:       return !('quantity' in data) || (data.quantity is number && data.quantity >= 0);
13:     }
14: 
15:     // Default deny for all root collections outside the workspace hierarchy
16:     match /{document=**} {
17:       allow read, write: if false;
18:     }
19: 
20:     // Workspaces hierarchy: multi-tenant kitchen isolation
21:     match /workspaces/{workspaceId} {
22:       // Workspace root configuration doc (e.g. settings, name)
23:       allow read, write: if workspaceId != '';
24: 
25:       // Products subcollection: active inventory & archived items
26:       match /products/{productId} {
27:         // Reads permitted for valid kitchen workspace; writes require non-negative quantity
28:         allow read, write: if workspaceId != '' && request.resource.data.quantity >= 0;
29:         allow delete: if workspaceId != '';
30:       }
31: 
32:       // History subcollection: immutable HACCP food safety audit ledger
33:       match /history/{logId} {
34:         // Kitchen operators can read and append immutable audit records
35:         allow read, create: if workspaceId != '';
36: 
37:         // IMMUTABILITY CONTRACT: Audit logs can never be modified or deleted
38:         allow update, delete: if false;
39:       }
40:     }
41:   }
42: }
```

### 1.3 Inspection of `inventoryStore.ts` (Line 139) vs `domain/expiry.ts` (Lines 174–182)

- In `src/lib/stores/inventoryStore.ts:139`:
  ```typescript
  export const filteredProducts = derived(inventoryStore, ($inv) => {
    let list = $inv.products.filter(p => !p.isDiscarded && !p.isConsumed);
  ```
- In `src/lib/domain/expiry.ts:179-182`:
  ```typescript
  if (p.isConsumed || p.quantity <= 0) {
    consumedCount++;
    continue;
  }
  ```

---

## 2. Logic Chain

1. **Firestore Security Rules Specification & Execution Lifecycle (Obs 1.2)**:
   - In Cloud Firestore Security Rules, the `read` permission covers both `get` (retrieving a single document) and `list` (querying/streaming collections via `onSnapshot`).
   - The security context variable `request.resource` represents the pending document as it would exist *after* a write operation (`create` or `update`).
   - During any `read` request (`get` or `list`), no document is being written; therefore, `request.resource` is strictly `null`.
   - In `firestore.rules:28`:
     `allow read, write: if workspaceId != '' && request.resource.data.quantity >= 0;`
   - When a client executes `subscribeProducts` (which attaches an `onSnapshot` listener to `/workspaces/{workspaceId}/products`), Firestore evaluates line 28 for a `list` read operation.
   - The expression accesses property `data` on `request.resource` (`null.data`). In Firestore Security Rules, this throws a runtime evaluation error.
   - Under Firestore's security engine, any unhandled runtime error within an `allow` predicate immediately evaluates to `false` (fail-closed security principle).
   - Therefore, **every read request to `/workspaces/{workspaceId}/products` will be denied with `permission-denied` (Error: Missing or insufficient permissions)**.
   - This defect breaks the central requirement of Milestone 2: multi-device real-time sync.

2. **Dangling Helper Functions & Test Blindspot (Obs 1.1.3, Obs 1.2)**:
   - Helper functions `isValidWorkspace(wsId)` (lines 7–9) and `isValidQuantity(data)` (lines 11–13) were declared in `firestore.rules`.
   - `isValidQuantity` specifically handles optional/absent fields: `!('quantity' in data) || (data.quantity is number && data.quantity >= 0)`.
   - However, neither helper function was called anywhere in `firestore.rules`.
   - Furthermore, `tests/e2e/tier1_features/f10_security_rules.test.js` only asserted string inclusion on an internal hardcoded string template rather than loading `firestore.rules` from disk or executing a rules simulator. Consequently, tests reported 302/302 passes despite this critical rule defect.

3. **Store Filter Inconsistency on Zero Quantity (Obs 1.3)**:
   - When a product's quantity reaches 0 (either via concurrent atomic decrements or partial stock consumption), `calculateMetrics` in `domain/expiry.ts` treats items with `p.quantity <= 0` as consumed, decrementing `total` to 0.
   - However, `filteredProducts` in `inventoryStore.ts` only filters out `p.isConsumed`.
   - If a product document has `quantity: 0` but `isConsumed: false` (a state possible under concurrent offline decrements), the metrics dashboard shows 0 active products, but the inventory card remains visible in the list with `0 uds` and an active `-1 Consumir` action button.

---

## 3. Findings

### [Critical] Finding 1: Fatal Runtime Evaluation Error in `firestore.rules` Blocks All Collection Reads
- **What**: Combining `allow read, write` with a check on `request.resource.data.quantity >= 0`.
- **Where**: `firestore.rules:28`
- **Why**: `request.resource` is `null` on `read` (both `get` and `list`). Accessing `.data` throws a runtime error in Firestore's security engine, causing all inventory read queries to be denied with `permission-denied`.
- **Suggestion**: Separate `read` from `create, update`, and leverage the existing helper functions:
  ```rules
  match /products/{productId} {
    allow read: if isValidWorkspace(workspaceId);
    allow create, update: if isValidWorkspace(workspaceId) && isValidQuantity(request.resource.data);
    allow delete: if isValidWorkspace(workspaceId);
  }
  ```

### [Major] Finding 2: Unused Helper Functions in `firestore.rules`
- **What**: Helper functions `isValidWorkspace(wsId)` and `isValidQuantity(data)` are declared but never invoked.
- **Where**: `firestore.rules:7-13`
- **Why**: Dead code leads to maintenance confusion and misses workspace length validation (`wsId.size() <= 64`).
- **Suggestion**: Wire `isValidWorkspace(workspaceId)` into lines 23, 28, 29, and 35.

### [Major] Finding 3: Inconsistent Zero-Quantity Handling Between `filteredProducts` and `calculateMetrics`
- **What**: `filteredProducts` displays items with `quantity <= 0` if `isConsumed` is `false`, whereas `calculateMetrics` excludes them.
- **Where**: `src/lib/stores/inventoryStore.ts:139`
- **Why**: In concurrent service scenarios where stock reaches 0, the dashboard total shows 0 items while the list still renders a card with `0 uds` and an active `-1 Consumir` button.
- **Suggestion**: Update line 139 of `inventoryStore.ts`:
  ```typescript
  let list = $inv.products.filter(p => !p.isDiscarded && !p.isConsumed && (p.quantity ?? 0) > 0);
  ```

### [Minor] Finding 4: Unbounded Product Query in Realtime Listener
- **What**: `FirestoreProductRepository.subscribeProducts` listens to the entire `/products` subcollection without pagination or filtering.
- **Where**: `src/lib/repositories/productRepository.ts:183`
- **Why**: For restaurants operating over many months, historical consumed or discarded documents will accumulate, increasing client memory usage.
- **Suggestion**: In Milestone 3/4, consider adding an optional filter or limit for active inventory items.

---

## 4. Verified Claims

| Claim from `worker_m2/handoff.md` | Verification Method | Result |
|---|---|---|
| `npm run check` passes with 0 errors | Independent CLI run | **PASS** (0 errors, 0 warnings) |
| `npm run build` static compilation succeeds | Independent CLI run | **PASS** (Static build in `build/` in 504ms) |
| `npm test` runs 302 tests with 0 failures | Independent CLI run | **PASS** (302/302 tests pass in 157ms) |
| `adversarial_store_stress.js` 138 tests pass | Independent CLI run | **PASS** (138/138 tests pass) |
| `firebase.ts` SSR safety with `isBrowser()` guard | `test_verification.mjs` SSR load | **PASS** (Returns `isMock: true, mode: 'ssr-noop'` in Node) |
| `productRepository` normalizers neutralize path traversal | `test_verification.mjs` Unit test | **PASS** (`../../etc/passwd` -> `etc-passwd`) |
| `safeSubtract` eliminates IEEE 754 precision drift | `test_verification.mjs` Unit test | **PASS** (`0.3 - 0.1 === 0.2`) |
| `sanitizeFirestorePayload` strips `undefined` | `test_verification.mjs` Unit test | **PASS** (Preserves `null`, `0`, `""`, `false`) |
| `inventoryStore` listener teardown prevents leaks | `test_verification.mjs` Lifecycle test | **PASS** (0 duplicate listeners, clean teardown) |
| `firestore.rules` permits multi-tenant reads | Static Rule Analysis | **FAIL** (Rule 28 throws null pointer on `read`) |

---

## 5. Coverage Gaps

- **Firestore Emulator Automated Test Runner**: The current test runner relies on mock harnesses (`InMemoryWorkspaceRepository`) and inline rule strings rather than spinning up `@firebase/rules-unit-testing` against the Firebase Emulator Suite.
  - Risk Level: **High** (allowed Finding 1 to slip past test suites).
  - Recommendation: Worker must correct `firestore.rules` and verify rule semantics.

---

## 6. Caveats

- Live Firebase cloud deployment was not executed against Google servers; analysis of `firestore.rules` is based on Cloud Firestore Security Rules Engine v2 specification. The null dereference behavior on `request.resource` during `get`/`list` operations is deterministic and authoritative.
- No other caveats.

---

## 7. Conclusion

Milestone 2 implementation exhibits solid TypeScript architecture, excellent SSR resilience, and clean repository abstractions. However, because **Finding 1 directly breaks live Firestore database read operations and prevents inventory synchronization**, the work cannot be approved in its current state.

**Verdict: `REQUEST_CHANGES`**

### Required Action Items for Worker:
1. Fix `firestore.rules` lines 26–30 by separating `read` from `create, update` and utilizing `isValidWorkspace` and `isValidQuantity`.
2. Clean up dead helper functions in `firestore.rules`.
3. Align `inventoryStore.ts:139` filter with `domain/expiry.ts:179` to ensure products with `quantity <= 0` are excluded from `filteredProducts`.

---

## 8. Verification Method

To independently verify these findings:

```bash
# 1. Verify static check & builds remain green
npm run check
npm run build
npm test

# 2. Inspect the fatal rule in firestore.rules
grep -n "allow read, write" firestore.rules
# Notice line 28 combines read and write with request.resource.data

# 3. Run reviewer's independent test suite
node .agents/teamwork/reviewer_m2_2/test_verification.mjs
```
