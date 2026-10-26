# Task: Milestone 1 Implementation — Scaffold, Domain Layer, Stores & Shell

You are `worker_m1` (role: Milestone 1 Implementation Worker).
Your working directory is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m1/`.
The project root is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono`.
Authoritative request: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md`.
Master Project Specification: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Exclusive File Ownership
You own:
- `package.json`, `vite.config.ts`, `tsconfig.json`, `render.yaml`
- `static/manifest.json`, `static/favicon.png`, `static/assets/**`
- `src/app.html`, `src/env.ts`
- `src/routes/+layout.ts`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`
- `src/lib/domain/models.ts`, `src/lib/domain/expiry.ts`, `src/lib/domain/waste.ts`
- `src/lib/stores/workspaceStore.ts`, `src/lib/stores/connectivityStore.ts`, `src/lib/stores/toastStore.ts`, `src/lib/stores/metricsStore.ts`, `src/lib/stores/inventoryStore.ts`
Do NOT touch `tests/e2e/**` (owned by e2e test writer).

## Source Explorer Findings to Use:
1. Tooling & Scaffold: Read `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_1/handoff.md`
   - Use the exact `package.json` with pinned `firebase@^11.4.0` (to avoid Node 24.12 engine error), `@lucide/svelte`, and `html5-qrcode`.
   - In SvelteKit 3, configure adapter-static inside `vite.config.ts` (DO NOT create `svelte.config.js`).
   - Create `render.yaml`, `src/app.html`, `src/env.ts`, `static/manifest.json`.
   - Copy `assets/logo-stockcontrol.png`, `assets/icon-192.png`, `assets/icon-512.png` into `static/assets/`, and copy `assets/icon-192.png` to `static/favicon.png`.
2. Pure Domain Layer: Read `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_2/handoff.md`
   - Copy proposed files:
     - `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_2/proposed_models.ts` -> `src/lib/domain/models.ts`
     - `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_2/proposed_expiry.ts` -> `src/lib/domain/expiry.ts`
     - `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_2/proposed_waste.ts` -> `src/lib/domain/waste.ts`
3. Reactive Stores & Shell: Read `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_3/handoff.md`
   - Implement `workspaceStore.ts`, `connectivityStore.ts`, `toastStore.ts`, `metricsStore.ts`, `inventoryStore.ts` in `src/lib/stores/`.
   - Implement `src/routes/+layout.ts` (`export const prerender = true; export const ssr = false;`).
   - Implement `src/routes/+layout.svelte` and initial `src/routes/+page.svelte`.

## Verification Steps:
1. Run `npm install` and verify exit code 0.
2. Run `npm run check` and verify 0 type errors.
3. Run `npm run build` and verify that `@sveltejs/adapter-static` builds cleanly into `build/` with `build/index.html` generated.
4. Document all commands and results in your handoff report at:
   `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m1/handoff.md`.


## 2026-10-25T20:35:50Z
Received dispatch message:
You are worker_m1.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m1/
Read /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m1/DISPATCH.md, ORIGINAL_REQUEST.md, PROJECT.md, and the three explorer handoff reports in explorer_m1_1/handoff.md, explorer_m1_2/handoff.md, and explorer_m1_3/handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement Milestone 1: SvelteKit project setup, Vite/static adapter configuration, static brand assets, pure TypeScript domain models and expiry/waste logic, reactive stores, and app shell layout.
Run npm install, npm run check, and npm run build.
Report complete results and evidence in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m1/handoff.md.
