# DISPATCH: worker_m4

## Mission
Implement Milestone 4: Dual-Engine Camera Scanner, PWA Offline Stack & Service Worker, and Data Contingency (CSV & JSON v2).
Satisfy Features 19, 20, 21, 22, 23, 24, 25, 26, and 27 in `PROJECT.md`.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership
You have exclusive write access to:
- `src/lib/domain/barcode.ts`
- `src/lib/components/CameraScanner.svelte`
- `static/manifest.json`
- `manifest.json`
- `src/service-worker.ts`
- `src/lib/stores/connectivityStore.ts`
- `src/lib/components/ConnectivityBanner.svelte`
- `render.yaml`
- `src/lib/repositories/contingencyService.ts`
- `src/lib/components/ExportImportModal.svelte`
- `src/routes/+page.svelte`
- `src/routes/+layout.svelte`

Do NOT touch test suite files.

## Input Reports & Blueprints to Read
1. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md`
2. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`
3. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m4_1/handoff.md` and artifacts (`proposed_barcode.ts`, `proposed_CameraScanner.svelte`, `page_integration_plan.md`)
4. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m4_2/handoff.md` (Manifest, Service Worker, Connectivity Store/Banner, render.yaml)
5. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m4_3/handoff.md` (Contingency Service, ExportImportModal, Page integration)

## Required Implementation Steps
1. **Barcode Domain & Scanner Component**:
   - Create `src/lib/domain/barcode.ts` from `explorer_m4_1/proposed_barcode.ts`.
   - Create `src/lib/components/CameraScanner.svelte` from `explorer_m4_1/proposed_CameraScanner.svelte`. Ensure track cleanup on destroy, torch toggle, and touch targets >= 44x44px.
2. **PWA Offline Stack & Deployment**:
   - Create `static/manifest.json` and sync root `manifest.json`.
   - Create `src/service-worker.ts` with native `$service-worker` precaching and navigation fallback.
   - Update `src/lib/stores/connectivityStore.ts` to support both property sets (`isOnline`/`online`, `pendingWrites`/`hasPendingWrites`).
   - Create `src/lib/components/ConnectivityBanner.svelte`.
   - Update `render.yaml` to specify `type: web`, `env: static`, `plan: free`, build command, publish dir `./build`, and SPA rewrite.
3. **Data Contingency (CSV & JSON v2)**:
   - Create `src/lib/repositories/contingencyService.ts` (RFC 4180 UTF-8 BOM CSV with `;` delimiter, JSON v2 schema with legacy v1 normalizer, conflict strategies).
   - Create `src/lib/components/ExportImportModal.svelte` with export/import tabs and batch import integration.
4. **App Integration**:
   - In `src/routes/+page.svelte`: Wire `CameraScanner` into the "scanner" tab, wire scanner modal trigger from `ProductForm.svelte`, wire `ExportImportModal` trigger button, and display `ConnectivityBanner`. Ensure all buttons are >= 44x44px.
   - In `src/routes/+layout.svelte`: Register service worker in browser when `!dev`.
5. **Run Verifications**:
   - `npm run check` (0 errors, 0 warnings)
   - `npm run build` (clean static bundle into `build/`)
   - `npm test` (302/302 tests pass across Tiers 1-4)
   - `node tests/adversarial/adversarial_ui_ergonomics_stress.js`
   - `node tests/adversarial/adversarial_ui_interaction_stress.js`
   - `node tests/adversarial/adversarial_m3_forensic.js`

Write your handoff report to `.agents/teamwork/worker_m4/handoff.md` and notify with `send_message`.

## 2026-10-26T01:37:43Z
From: 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c (parent)
Content:
You are worker_m4.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m4/
Read your task assignment in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m4/DISPATCH.md.
Also read:
- /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md
- /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md
- /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m4_1/handoff.md and artifacts
- /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m4_2/handoff.md
- /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m4_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement Milestone 4:
1. Barcode Domain: Create src/lib/domain/barcode.ts from explorer_m4_1/proposed_barcode.ts.
2. Camera Scanner: Create src/lib/components/CameraScanner.svelte from explorer_m4_1/proposed_CameraScanner.svelte.
3. PWA Manifest: Create static/manifest.json and manifest.json from explorer_m4_2/handoff.md.
4. Service Worker: Create src/service-worker.ts from explorer_m4_2/handoff.md.
5. Connectivity Store & Banner: Update src/lib/stores/connectivityStore.ts and create src/lib/components/ConnectivityBanner.svelte from explorer_m4_2/handoff.md.
6. Render Config: Update render.yaml from explorer_m4_2/handoff.md.
7. Contingency Service: Create src/lib/repositories/contingencyService.ts from explorer_m4_3/handoff.md.
8. Contingency Modal: Create src/lib/components/ExportImportModal.svelte from explorer_m4_3/handoff.md.
9. Page & Layout Integration: Wire CameraScanner into scanner tab, wire ProductForm scan trigger, wire ExportImportModal trigger in toolbar, add ConnectivityBanner, and register service worker in +layout.svelte. Maintain >= 44x44px touch targets on all new interactive buttons.

Run all verifications:
npm run check
npm run build
npm test
node tests/adversarial/adversarial_ui_ergonomics_stress.js
node tests/adversarial/adversarial_ui_interaction_stress.js
node tests/adversarial/adversarial_m3_forensic.js

Report complete results, diffs, and verification logs in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m4/handoff.md and notify with send_message.
