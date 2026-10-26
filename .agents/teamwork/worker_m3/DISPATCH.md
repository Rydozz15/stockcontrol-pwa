# Dispatch: worker_m3

**Assigned Agent**: `worker_m3`
**Role**: Milestone 3 UI/UX Worker
**Working Directory**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m3/`

## Objective
Implement Milestone 3 (Mobile & Tablet Ergonomic UI/UX) for StockControl PWA:
1. Create `src/lib/components/BottomNav.svelte` (4 fixed tabs: Inventario, Mermas, Métricas, Ajustes; height >= 56px, safe-area-inset padding, idempotent tab switching).
2. Create `src/lib/components/ProductCard.svelte` (touch targets >= 44x44px, >= 8px spacing; 1-tap "Consumir 1" with Undo toast callback; 1-tap "Merma" with confirmation dialog and waste reason selection; HACCP status pill mapped to calculateExpiryStatus).
3. Create `src/lib/components/ProductForm.svelte` (touch-friendly entry drawer/modal with 1-touch quick expiry presets: `+2d`, `+3d`, `+1w`, `+1m` using `$lib/domain/expiry.ts`; visual category pills; +/- quantity stepper >= 48px; location chips; expandable traceability; validation).
4. Create `src/lib/components/WorkspaceModal.svelte` (kitchen code switcher, 6 preset workstation cards, 8 brigade operator suggestions, real-time auto-slug preview and sanitization, persistence to localStorage and workspaceStore).
5. Create `src/lib/components/MetricsDashboard.svelte` (4 disjoint counter cards: Total, Vencidos, Vence hoy/3d, Vence semana, mapped to inventoryMetrics store).
6. Update `src/routes/+page.svelte` (responsive tablet split view `@media (min-width: 768px)` with master list on left and permanent inspection panel on right; 56x56px circular FAB; integration with BottomNav, ProductCard, ProductForm, WorkspaceModal, and MetricsDashboard).
7. Update `src/routes/+layout.svelte` (upgrade `.toast-close-btn` hit target from 36x36px to min 44x44px for WCAG 2.5.5 compliance).

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership Boundaries
You have exclusive write access to:
- `src/lib/components/BottomNav.svelte`
- `src/lib/components/ProductCard.svelte`
- `src/lib/components/ProductForm.svelte`
- `src/lib/components/WorkspaceModal.svelte`
- `src/lib/components/MetricsDashboard.svelte`
- `src/routes/+page.svelte`
- `src/routes/+layout.svelte`

Do NOT modify any test files or core repository files unless instructed.

## Authoritative Inputs & Reference Templates
Read these files carefully before implementing:
1. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md`
2. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`
3. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/handoff.md` and proposed files:
   - `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/proposed_BottomNav.svelte`
   - `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/proposed_ProductCard.svelte`
   - `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/layout_touch_targets.patch`
4. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_2/handoff.md` and proposed files:
   - `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_2/proposed_ProductForm.svelte`
   - `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_2/proposed_WorkspaceModal.svelte`
5. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_3/handoff.md` and proposed files:
   - `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_3/proposed_MetricsDashboard.svelte`
   - `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_3/proposed_page.svelte`

## Verification Requirements
Run the following verification commands and include their exact output in your handoff report:
1. `npm run check` (Must pass with 0 errors)
2. `npm run build` (Must build cleanly with adapter-static)
3. `npm test` (Must pass 302/302 tests with exit code 0)
4. Stress test suites:
   - `node tests/adversarial/adversarial_store_stress.js`
   - `node tests/adversarial/adversarial_sync_stress.js`
   - `node tests/adversarial/adversarial_repository_stress.js`
   - `node tests/adversarial/adversarial_m2_forensic.js`

## Handoff Requirements
Write your completion report in `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m3/handoff.md` with:
- Summary of implemented components and changes
- Evidence of touch targets and tablet split view contracts
- Verification command outputs
Notify caller via `send_message`.

## 2026-10-25T22:05:39Z
You are worker_m3.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m3/
Implement Milestone 3:
1. Create src/lib/components/BottomNav.svelte
2. Create src/lib/components/ProductCard.svelte
3. Create src/lib/components/ProductForm.svelte
4. Create src/lib/components/WorkspaceModal.svelte
5. Create src/lib/components/MetricsDashboard.svelte
6. Update src/routes/+page.svelte (responsive tablet split-view >=768px, 56x56px circular FAB, 1-tap consumption with undo toast, integration with BottomNav, ProductCard, ProductForm, WorkspaceModal, MetricsDashboard)
7. Update src/routes/+layout.svelte (.toast-close-btn >= 44x44px for WCAG 2.5.5)

Run all verifications:
npm run check
npm run build
npm test
node tests/adversarial/adversarial_store_stress.js
node tests/adversarial/adversarial_sync_stress.js
node tests/adversarial/adversarial_repository_stress.js
node tests/adversarial/adversarial_m2_forensic.js
