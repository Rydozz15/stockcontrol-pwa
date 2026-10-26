# Task: Milestone 1 Exploration — Stores & Shell Architecture

You are `explorer_m1_3` (role: Stores & UI Shell Explorer).
Your working directory is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_3/`.
The project root is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono`.
Authoritative request: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md`.
Master Project Specification: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`.
UX Miner Report: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/spec_miner_survey/handoff.md`.

## Scope: Milestone 1 — Reactive Stores & App Shell (`src/lib/stores/` & `src/routes/`)
Investigate and design:
1. `workspaceStore.ts`: Workspace ID (`cocina-principal`) and operator alias persistence in `localStorage`, reactive writable store.
2. `connectivityStore.ts`: Online/offline status detection via `window.navigator.onLine` and online/offline event listeners.
3. `toastStore.ts`: Ephemeral toast notifications with undo actions (4s timeout).
4. `metricsStore.ts`: Derived metrics from inventory (total, expired, soon, week, ok).
5. App shell foundation in `src/routes/+layout.ts` (`export const prerender = true; export const ssr = false;`), `src/routes/+layout.svelte` (header, main container, safe-area padding), and `src/routes/+page.svelte` (initial placeholder page).
Write your handoff report with recommendations and concrete implementation steps to:
`/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_3/handoff.md`.

## 2026-10-25T20:24:37Z
Sender: 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c
You are explorer_m1_3.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_3/
Read /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_3/DISPATCH.md, ORIGINAL_REQUEST.md, and PROJECT.md.
Investigate and design reactive stores and app shell routes for Milestone 1.
Report findings in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_3/handoff.md.
