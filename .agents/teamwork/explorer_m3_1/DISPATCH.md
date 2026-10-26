# Dispatch: explorer_m3_1

**Assigned Agent**: `explorer_m3_1`
**Role**: Mobile Navigation & Card Ergonomics Explorer
**Working Directory**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/`

## Objective
Design the mobile navigation and card touch ergonomics for Milestone 3:
1. `src/lib/components/BottomNav.svelte`:
   - 4 fixed thumb-reachable tabs: Inventario (list), Nuevo (form/drawer), Escáner (scanner trigger/tab), Ajustes (workspace/contingency).
   - Ergonomics: Height >= 56px, touch targets >= 44x44px, padding with `env(safe-area-inset-bottom, 0px)`.
   - Active tab indicator, clear icons + labels.
2. `src/lib/components/ProductCard.svelte`:
   - Mobile card design: Large product name, quantity badge with unit, category chip, location indicator.
   - Expiry pill with color coding matching `calculateExpiryStatus` (red for expired, amber for <=3d, blue/purple for <=7d, green for >7d).
   - 1-tap quick actions:
     - "Consumir 1" (primary quick button >= 44x44px touch target) triggering `consumeStockAction` and showing an Undo toast with "Deshacer".
     - "Merma" (waste button >= 44x44px touch target) opening quick discard confirmation modal.
     - Tap on card opens full detail / edit view.
3. Touch ergonomics audit of `src/routes/+layout.svelte`:
   - Update `.toast-close-btn` hit target to at least 44x44px (`min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center;`).

## Inputs to Review
1. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md` (Sections 2.1 Mobile Ergonomics & 2.2 Kitchen Fast Workflows)
2. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md` (Milestone 3 specs)
3. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/routes/+layout.svelte`
4. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/routes/+page.svelte`
5. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/stores/inventoryStore.ts`
6. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/stores/toastStore.ts`

## Requirements for Handoff
Write a complete, structured report in `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/handoff.md` with:
- Full Svelte 5 / SvelteKit 3 component template for `BottomNav.svelte`.
- Full component template for `ProductCard.svelte` with event dispatchers and store action wiring.
- Exact CSS diff for `+layout.svelte` to ensure all touch targets >= 44x44px.
- Verification plan and commands.
Notify caller via `send_message`.
