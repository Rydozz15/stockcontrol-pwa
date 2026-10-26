# Dispatch: worker_m2_iter2

**Assigned Agent**: `worker_m2_iter2`
**Role**: Milestone 2 Remediation Worker
**Working Directory**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m2_iter2/`

## Context & Objectives
You are dispatched to implement the verified remediation changes for Milestone 2 Iteration 2 to resolve the gate failures reported by `reviewer_m2_2`, `challenger_m2_1`, and `challenger_m2_2`.

## Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Input Documents to Read
1. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md`
2. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`
3. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_iter2_1/handoff.md` (Rules & Store Filter)
4. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_iter2_2/handoff.md` (Firebase Vite Environment)
5. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_iter2_3/handoff.md` (Product Repository Float Clamping & Normalization)

## Exclusive Write Ownership
You own and may edit ONLY the following files:
1. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/firestore.rules`
2. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/stores/inventoryStore.ts`
3. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/repositories/firebase.ts`
4. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/repositories/productRepository.ts`
5. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/tests/adversarial/adversarial_m2_forensic.js`

## Required Implementations
1. **`firestore.rules`**:
   - Separate `read`, `create, update`, and `delete` on `/products/{productId}` so `request.resource` is never accessed during reads.
   - Wire `isValidWorkspace(workspaceId)` into workspace root doc, products, and history subcollection.
   - Wire `isValidQuantity(request.resource.data)` into `create, update` on products.
2. **`src/lib/stores/inventoryStore.ts`**:
   - Line 139: Update `filteredProducts` filter to include `&& (p.quantity ?? 0) > 0`.
3. **`src/lib/repositories/firebase.ts`**:
   - Replace `readEnvValue` (lines 64–76) with explicit static dot property accesses (`import.meta.env.PUBLIC_FIREBASE_*`) wrapped in try-catch to guard against Vite's proxy get trap, with fallback to `process.env`.
4. **`src/lib/repositories/productRepository.ts`**:
   - `consumeStock`: Snap `quantity: isExhausted ? 0 : remainingQty` to eliminate residual float dust on exhaustion and intermediate float drift.
   - `subscribeProducts`: Normalize quantity via `quantity: normalizeQuantity(d.quantity)` on line 194.
   - `restoreStock` and `updateProduct`: Preserve float precision and normalize quantity.
5. **`tests/adversarial/adversarial_m2_forensic.js`**:
   - Update string assertions on lines 51 and 53 to match the new robust rule definitions.

## Verification Requirements
Run and verify all verification commands:
```bash
npm run check
npm run build
npm test
node tests/adversarial/adversarial_store_stress.js
node tests/adversarial/adversarial_sync_stress.js
node tests/adversarial/adversarial_repository_stress.js
node tests/adversarial/adversarial_m2_forensic.js
node .agents/teamwork/reviewer_m2_2/test_verification.mjs
```
All commands must exit with code 0 and report 100% passing assertions.

## Handoff Report
Document all changes, file paths, diff snippets, verbatim verification outputs, and exit codes in:
`/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m2_iter2/handoff.md`
Notify caller via `send_message`.


## 2026-10-25T21:38:48Z
You are worker_m2_iter2.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m2_iter2/
Read /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m2_iter2/DISPATCH.md, ORIGINAL_REQUEST.md, PROJECT.md, and the three explorer reports in explorer_m2_iter2_1/handoff.md, explorer_m2_iter2_2/handoff.md, and explorer_m2_iter2_3/handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement the verified remediation changes:
1. firestore.rules: Separate read from create/update/delete, wire isValidWorkspace and isValidQuantity.
2. src/lib/stores/inventoryStore.ts: Update filteredProducts filter to exclude quantity <= 0.
3. src/lib/repositories/firebase.ts: Replace readEnvValue with static property accesses and try-catch proxy guard.
4. src/lib/repositories/productRepository.ts: Snap quantity in consumeStock, normalize quantity in subscribeProducts with normalizeQuantity, safeguard restoreStock and updateProduct.
5. tests/adversarial/adversarial_m2_forensic.js: Update lines 51 and 53 to match the new rule structure.

Run all verifications:
npm run check
npm run build
npm test
node tests/adversarial/adversarial_store_stress.js
node tests/adversarial/adversarial_sync_stress.js
node tests/adversarial/adversarial_repository_stress.js
node tests/adversarial/adversarial_m2_forensic.js
node .agents/teamwork/reviewer_m2_2/test_verification.mjs

Report complete results, diffs, and verification logs in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m2_iter2/handoff.md and notify with send_message.
