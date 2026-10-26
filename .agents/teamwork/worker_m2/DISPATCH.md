# Task: Milestone 2 Implementation — Firebase Firestore Data Layer & Sync

You are `worker_m2` (role: Milestone 2 Implementation Worker).
Your working directory is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m2/`.
The project root is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono`.
Authoritative request: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md`.
Master Project Specification: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Exclusive File Ownership
You own:
- `src/lib/repositories/firebase.ts`
- `src/lib/repositories/productRepository.ts`
- `firestore.rules`
- `src/lib/stores/metricsStore.ts`
- `src/lib/stores/inventoryStore.ts`
- `src/lib/stores/workspaceStore.ts`
- `src/lib/stores/connectivityStore.ts`
Do NOT touch `tests/e2e/**` (owned by test writer).

## Source Explorer Deliverables to Implement:
1. Firebase Modular Client v11:
   - Read `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_1/handoff.md`.
   - Copy `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_1/proposed_firebase.ts` to `src/lib/repositories/firebase.ts`.
   - Copy `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_1/proposed_firestore.rules` to `firestore.rules`.
2. Firestore Product Repository:
   - Read `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_2/handoff.md`.
   - Implement `src/lib/repositories/productRepository.ts` with `normalizeWorkspaceId`, `normalizeOperator`, `safeSubtract`, `sanitizeFirestorePayload`, `IProductRepository`, and `FirestoreProductRepository`.
3. Store & Sync Integration:
   - Read `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_3/handoff.md`.
   - Refactor `src/lib/stores/metricsStore.ts` to delegate to `$lib/domain/expiry.ts`.
   - Wire `inventoryStore.ts` and `workspaceStore.ts` to attach/detach Firestore listeners when `workspaceId` changes, and propagate `hasPendingWrites` to `connectivityStore.ts`.

## Verification Steps:
1. Run `npm run check` and verify 0 type errors.
2. Run `npm run build` and verify static compilation to `build/`.
3. Run `npm test` and verify that all 302 automated tests pass with exit code 0.
4. Run `node tests/adversarial/adversarial_store_stress.js` and verify that all 138 tests pass.
5. Document all results and evidence in:
   `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m2/handoff.md`.


## 2026-10-25T21:07:30Z
You are worker_m2.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m2/
Read /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m2/DISPATCH.md, ORIGINAL_REQUEST.md, PROJECT.md, and the three explorer reports in explorer_m2_1/handoff.md, explorer_m2_2/handoff.md, and explorer_m2_3/handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement Milestone 2:
1. src/lib/repositories/firebase.ts and firestore.rules
2. src/lib/repositories/productRepository.ts
3. Refactor src/lib/stores/metricsStore.ts, inventoryStore.ts, and workspaceStore.ts
Run npm run check, npm run build, npm test, and node tests/adversarial/adversarial_store_stress.js.
Report complete results and evidence in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m2/handoff.md.
