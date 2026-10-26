# BRIEFING — 2026-10-25T21:33:00Z

## Mission
Formulate exact remediation strategy for firestore.rules (read vs write separation, null request.resource crash fix, dead helper wiring) and inventoryStore.ts (zero-quantity filtering consistency) based on reviewer_m2_2 gate findings.

## 🔒 My Identity
- Archetype: explorer
- Roles: Rules & Store Filtering Fix Strategy Explorer
- Working directory: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_iter2_1/
- Original parent: 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c
- Milestone: Milestone 2 Remediation (M2 Iteration 2)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Produce exact code replacement blocks for worker_m2
- Verify compatibility with existing test runners and build scripts

## Current Parent
- Conversation ID: 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c
- Updated: 2026-10-25T21:33:00Z

## Investigation State
- **Explored paths**:
  - `firestore.rules` (analyzed null request.resource dereference on reads and deletes)
  - `src/lib/stores/inventoryStore.ts` (examined filteredProducts line 139)
  - `src/lib/domain/expiry.ts` (examined calculateMetrics lines 174-182)
  - `src/lib/repositories/productRepository.ts` (examined consumeStock, updateProduct, subscribeProducts)
  - `tests/adversarial/adversarial_m2_forensic.js` (uncovered brittle string assertions on rules)
  - `tests/adversarial/adversarial_store_stress.js` (verified filteredProducts invariant suite)
  - `tests/e2e/tier1_features/f10_security_rules.test.js` (verified opaque-box rule mockup)
- **Key findings**:
  - `firestore.rules:28` crashes on all client reads (`get`/`list`) because `request.resource` is null during read operations.
  - Helper functions `isValidWorkspace` and `isValidQuantity` are defined but never called in `firestore.rules`.
  - `inventoryStore.ts:139` displays items with `quantity <= 0` if `isConsumed === false`, conflicting with `calculateMetrics` which excludes them.
  - `tests/adversarial/adversarial_m2_forensic.js` lines 51 and 53 contain hardcoded string matches matching the old defective rule syntax and must be updated or accommodated.
- **Unexplored areas**: None, full scope covered.

## Key Decisions Made
- Formulate complete replacement for `firestore.rules` separating `read` from `create, update` and `delete`, wiring `isValidWorkspace` and `isValidQuantity`.
- Formulate single-line replacement for `src/lib/stores/inventoryStore.ts:139` adding `(p.quantity ?? 0) > 0`.
- Provide companion guidance for `tests/adversarial/adversarial_m2_forensic.js` lines 51 and 53.

## Artifact Index
- `.agents/teamwork/explorer_m2_iter2_1/handoff.md` — Complete handoff report with exact before/after snippets and impact assessment
- `.agents/teamwork/explorer_m2_iter2_1/progress.md` — Liveness and execution heartbeat
