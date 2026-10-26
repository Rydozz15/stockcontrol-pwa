# Task: Milestone 2 Exploration — Store & Repository Integration

You are `explorer_m2_3` (role: Store & Sync Integration Explorer).
Your working directory is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_3/`.
The project root is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono`.
Authoritative request: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md`.
Master Project Specification: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`.
Reviewer 1 & 2 Handoffs:
- `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/reviewer_m1_1/handoff.md`
- `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/reviewer_m1_2/handoff.md`

## Scope: Milestone 2 — Connecting Stores to Firestore & Handling Sync
Investigate and design:
1. Integration between `workspaceStore` and `inventoryStore`: When `workspaceId` changes, unsubscribe from old workspace listener and subscribe to new workspace in Firestore.
2. Unifying `metricsStore`: Refactor `metricsStore.ts` to import `calculateMetrics` directly from `src/lib/domain/expiry.ts` (resolving Reviewer Finding 1).
3. Updating `connectivityStore`: Wire `hasPendingWrites` to snapshot metadata from Firestore listener.
4. Clean teardown and unsubscribe pattern on component destruction.
5. Write your handoff report with exact recommended code to:
   `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_3/handoff.md`.


## 2026-10-25T20:57:16Z
Sender: 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c
Investigate and design store integration (inventoryStore + workspaceStore + metricsStore refactor to import from expiry.ts), and pending writes sync indicators.
Report findings in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_3/handoff.md.
