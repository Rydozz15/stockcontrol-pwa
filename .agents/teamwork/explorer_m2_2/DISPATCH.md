# Task: Milestone 2 Exploration — Product Repository & Realtime Listeners

You are `explorer_m2_2` (role: Firestore Repository Explorer).
Your working directory is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_2/`.
The project root is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono`.
Authoritative request: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md`.
Master Project Specification: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`.
Survey Report 2: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_survey_2/handoff.md`.

## Scope: Milestone 2 — Firestore Product Repository Implementation
Investigate and design `src/lib/repositories/productRepository.ts`:
1. Interface `IProductRepository` adhering to `PROJECT.md` contracts.
2. `subscribeProducts(workspaceId, onData, onError)`: Realtime `onSnapshot` listener on `workspaces/{workspaceId}/products` with `{ includeMetadataChanges: true }`, sorting client-side by `expiryDate` ascending, reporting `hasPendingWrites`.
3. `subscribeHistory(workspaceId, limit, onData)`: Realtime `onSnapshot` listener on `workspaces/{workspaceId}/history` ordered by `timestamp` desc.
4. `createProduct`, `updateProduct`: Full audit stamping (`createdBy`, `updatedBy`).
5. `consumeStock(workspaceId, productId, amount, operator, reason)`: Atomic stock decrement using `increment(-amount)` and batch write to `history`.
6. `discardStock(workspaceId, productId, reason, operator)`: Marking `isDiscarded: true`, setting quantity to 0, logging HACCP audit reason (`vencimiento`, `rotura`, `contaminacion`, `calidad`, `otro`).
7. Write your handoff report with exact recommended code to:
   `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_2/handoff.md`.

## 2026-10-25T20:57:16Z
[Message from 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c]:
You are explorer_m2_2.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_2/
Read /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_2/DISPATCH.md, ORIGINAL_REQUEST.md, and PROJECT.md.
Investigate and design FirestoreProductRepository with realtime onSnapshot listeners, increment(-amount) atomic decrements, and HACCP audit history.
Report findings in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_2/handoff.md.
