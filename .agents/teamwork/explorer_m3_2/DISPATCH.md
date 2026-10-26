# Dispatch: explorer_m3_2

**Assigned Agent**: `explorer_m3_2`
**Role**: Product Form & Workspace Modal Explorer
**Working Directory**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_2/`

## Objective
Design the ergonomic product entry form and workspace selector for Milestone 3:
1. `src/lib/components/ProductForm.svelte`:
   - Fast kitchen entry modal or bottom-sheet drawer.
   - Touch-friendly fields: Name (text), Category (visual icon pills), Quantity (large +/- stepper + direct input), Unit (select/buttons: kg, g, l, ml, unidad), Location (Cámara 1, Cámara Congelados, Secos, Línea), Expiry Date.
   - **Quick Expiry Presets**: Row of 1-touch buttons calculating future dates via `$lib/domain/expiry.ts:quickExpiryDate`:
     - `+2d` (+2 days, e.g. opened milk / fresh fish)
     - `+3d` (+3 days, standard cooked prep HACCP)
     - `+1w` (+7 days, vacuum sealed / cured)
     - `+1m` (+1 month, frozen / dry stock)
     - Tapping any preset instantly populates the `expiryDate` input with clamped local date.
   - Validation feedback and touch targets >= 44x44px.
2. `src/lib/components/WorkspaceModal.svelte`:
   - Kitchen workspace switcher & operator alias modal.
   - Quick kitchen code switch (e.g. `cocina-principal`, `cuarto-frio`, `pasteleria`).
   - Operator alias picker (e.g. `Chef Juan`, `Turno Noche`, `Pastelero`).
   - Auto-slug sanitization and persistence to `localStorage` and `workspaceStore`.

## Inputs to Review
1. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md` (Sections 2.2 Kitchen Fast Workflows & 2.4 Multi-tenant)
2. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`
3. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/domain/expiry.ts` (`quickExpiryDate`)
4. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/domain/models.ts`
5. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/stores/workspaceStore.ts`
6. `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/stores/inventoryStore.ts`

## Requirements for Handoff
Write a complete, structured report in `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_2/handoff.md` with:
- Full Svelte 5 / SvelteKit 3 component template for `ProductForm.svelte` with quick expiry presets.
- Full component template for `WorkspaceModal.svelte`.
- Validation and touch ergonomics verification plan.
Notify caller via `send_message`.


## 2026-10-25T21:55:29Z
You are explorer_m3_2.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_2/
Read /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_2/DISPATCH.md, ORIGINAL_REQUEST.md, and PROJECT.md.
Design ProductForm.svelte (touch-friendly entry drawer/modal with 1-touch quick expiry presets +2d, +3d, +1w, +1m) and WorkspaceModal.svelte (kitchen code & operator alias picker).
Report complete component templates in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_2/handoff.md and notify with send_message.
