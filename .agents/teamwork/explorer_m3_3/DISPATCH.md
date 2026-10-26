# Dispatch: explorer_m3_3

**Assigned Agent**: `explorer_m3_3`
**Role**: Metrics Dashboard & Tablet Split-View Explorer
**Working Directory**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_3/`

## Objective
Design the Metrics Dashboard, Tablet Split-View layout, and `+page.svelte` composition for Milestone 3:
1. `src/lib/components/MetricsDashboard.svelte`:
   - 4 disjoint counter cards displaying real-time metrics from `metricsStore`:
     - **Total**: Total active products in kitchen.
     - **Vencidos**: Products where expiryDate < today (red highlight, exclamation badge).
     - **Vence hoy / 3d**: Products expiring today or in 1-3 days (amber highlight, clock badge).
     - **Vence semana**: Products expiring in 4-7 days (blue/purple highlight).
   - Tapping any counter filters the product list by that expiry status (or resets filter).
2. Tablet Split-Screen Layout (`@media (min-width: 768px)`):
   - On tablets and desktop screens (>=768px):
     - Left pane (40–45% width): Scrollable product list with search bar, category chips, and sort controls.
     - Right pane (55–60% width): Sticky inspection & action detail panel showing selected product card, full history audit logs, quick consumption steppers (+1, -1, Merma), and quick edit.
   - On mobile screens (<768px):
     - Single-column stacked master list; tapping a card opens detail modal or bottom sheet.
3. `src/routes/+page.svelte` Composition:
   - Wire all components (`BottomNav`, `MetricsDashboard`, `ProductCard`, `ProductForm`, `WorkspaceModal`).
   - Wire floating action button (FAB) for "+ Producto" reachable in bottom right above BottomNav.
   - Wire filter chips, search input, and sorting controls.

## Inputs to Review
1. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md` (Sections 2.1 Mobile & Tablet Ergonomics, 2.2 Kitchen Fast Workflows)
2. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`
3. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/routes/+page.svelte`
4. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/stores/metricsStore.ts`
5. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/stores/inventoryStore.ts`

## Requirements for Handoff
Write a complete, structured report in `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_3/handoff.md` with:
- Full Svelte 5 / SvelteKit 3 component template for `MetricsDashboard.svelte`.
- Responsive CSS architecture and component layout for Tablet Split-Screen (`>= 768px`).
- Complete proposed refactor for `src/routes/+page.svelte` integrating all components cleanly.
- Verification plan and commands.
Notify caller via `send_message`.


## 2026-10-25T21:55:29Z
You are explorer_m3_3.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_3/
Read /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_3/DISPATCH.md, ORIGINAL_REQUEST.md, and PROJECT.md.
Design MetricsDashboard.svelte (4 disjoint counter cards: Total, Vencidos, Vence hoy/3d, Vence semana), Tablet Split-Screen layout (@media (min-width: 768px): left master list, right inspection/action panel), and complete +page.svelte composition.
Report complete component templates and layout architecture in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_3/handoff.md and notify with send_message.
