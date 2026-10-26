# BRIEFING — 2026-10-25T21:04:00Z

## Mission
Investigate and design store integration (inventoryStore + workspaceStore + metricsStore refactor to import from expiry.ts), and pending writes sync indicators.

## 🔒 My Identity
- Archetype: explorer
- Roles: Store & Sync Integration Explorer
- Working directory: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_3
- Original parent: 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c
- Milestone: Milestone 2 — Store & Repository Integration

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Produce 5-component handoff report in handoff.md
- Scope strictly: store integration (inventoryStore, workspaceStore, metricsStore, connectivityStore / sync indicators)
- Refactor metricsStore to import from domain/expiry.ts
- Address Reviewer Finding 1 & Firestore snapshot metadata / hasPendingWrites

## Current Parent
- Conversation ID: 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c
- Updated: 2026-10-25T20:57:30Z

## Investigation State
- **Explored paths**:
  - `src/lib/domain/models.ts`, `expiry.ts`, `waste.ts`
  - `src/lib/stores/workspaceStore.ts`, `inventoryStore.ts`, `metricsStore.ts`, `connectivityStore.ts`, `toastStore.ts`
  - `src/routes/+layout.svelte`, `src/routes/+page.svelte`
  - `tests/adversarial/adversarial_store_stress.js`, `tests/e2e/runner.js`
  - Reviewer 1 & 2 handoffs (`reviewer_m1_1/handoff.md`, `reviewer_m1_2/handoff.md`)
  - Explorer m2_1 (`proposed_firebase.ts`, `proposed_firestore.rules`) and m2_2 briefings
- **Key findings**:
  1. `metricsStore.ts` refactoring: Directly imports `calculateMetrics`, `calculateDayDiff`, and `parseLocalDate` from `$lib/domain/expiry.ts`. Eliminates 75 lines of duplication, fixes Finding 1, and maintains 100% backwards compatibility with `tests/adversarial/adversarial_store_stress.js` via aliases (`parseDateOnly`, `critical7`, `discarded`, `consumed`).
  2. `workspaceStore` ↔ `inventoryStore` integration: Designed `subscribeToWorkspace(workspaceId, repo)` and `initWorkspaceSync(repo)`. When `workspaceId` changes, cancels previous Firestore `onSnapshot` listener and subscribes to the new workspace, updating loading and error states.
  3. `connectivityStore` & pending writes: Wired `hasPendingWrites` from Firestore snapshot metadata into `connectivityStore.setPendingWrites(...)` and `inventoryStore.setPendingWrites(...)`. Hooks directly into existing amber banner in `+layout.svelte` ("⏳ Sincronizando cambios locales con la cocina...").
  4. Teardown pattern: Single composite cleanup function returned by `initWorkspaceSync()` to be invoked in `onDestroy` or returned from `onMount`, guaranteeing zero memory leaks and clean listener termination.
  5. SSR / Test Safety: Sync functions are not triggered on module load; stores remain fully testable in headless Node and prerender phases without unexpected Firebase network calls.
- **Unexplored areas**: None remaining for M2 store scope.

## Key Decisions Made
- Re-export `parseDateOnly` and `calculateDayDiff` from `metricsStore.ts` to preserve existing test contracts.
- Map domain `InventoryMetrics.within7Days` to `critical7` in `StockMetrics`.
- Keep synchronous store methods (`addProduct`, `updateProduct`, `consumeOne`) alongside async repository action helpers for maximum test and runtime flexibility.
- Expose `subscribeToWorkspace` and `initWorkspaceSync` with optional repository dependency injection (`repo = productRepository`).

## Artifact Index
- DISPATCH.md — Task dispatch
- BRIEFING.md — Situational awareness
- progress.md — Heartbeat
- handoff.md — Final handoff report
