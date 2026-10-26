# Task: Milestone 2 Exploration — Firebase Client & Offline Cache

You are `explorer_m2_1` (role: Firebase Infrastructure Explorer).
Your working directory is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_1/`.
The project root is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono`.
Authoritative request: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md`.
Master Project Specification: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`.
Survey Report 2: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_survey_2/handoff.md`.

## Scope: Milestone 2 — Firebase Client Initialization & Firestore Rules
Investigate and design:
1. `src/lib/repositories/firebase.ts`:
   - Firebase app initialization using `import.meta.env.PUBLIC_FIREBASE_*` credentials.
   - Modular SDK v11 `initializeFirestore` with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` and fallback to `memoryLocalCache()`.
   - Complete SSR guard using `typeof window !== 'undefined'`.
   - Non-blocking `signInAnonymously(auth)` attempt with resilient catch fallback for open kitchen mode.
2. `firestore.rules`:
   - Production-ready and development security rules for `workspaces/{workspaceId}/**`.
3. Write your handoff report with exact recommended code to:
   `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_1/handoff.md`.

## 2026-10-25T20:57:16Z
[Message from 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c]:
You are explorer_m2_1.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_1/
Read /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_1/DISPATCH.md, ORIGINAL_REQUEST.md, and PROJECT.md.
Investigate and design Firebase modular client with persistentLocalCache and persistentMultipleTabManager, SSR guards, and firestore.rules.
Report findings in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m2_1/handoff.md.
