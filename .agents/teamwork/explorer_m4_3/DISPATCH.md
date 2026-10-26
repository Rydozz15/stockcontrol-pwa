# DISPATCH: explorer_m4_3

## Mission
Investigate and design the Contingency Data Export & Import module (CSV and JSON v2) for Milestone 4 (Features 25, 26).

## Scope & Architectural Requirements
1. **Contingency Data Logic (`src/lib/domain/contingency.ts` or `src/lib/services/contingencyService.ts`)**:
   - **CSV Export (Feature 25)**:
     - Excel-ready: Prepend UTF-8 BOM (`\uFEFF`).
     - Delimiter: Semicolon (`;`) for international / Spanish Excel compatibility.
     - RFC 4180 escaping: fields containing semicolons, quotes, or newlines must be double-quoted with internal quotes escaped as `""`.
     - Fields: `ID;Nombre;Categoría;Cantidad;Unidad;Fecha Recepción;Fecha Caducidad;Ubicación;Lote;Proveedor;Código Barras;Estado`.
   - **CSV Import**:
     - Parse RFC 4180 CSV, detect BOM, extract header row, validate required fields (`Nombre`, `Categoría`, `Cantidad`, `Unidad`, `Fecha Caducidad`, `Ubicación`).
     - Conflict resolution: option to replace, skip existing, or merge.
   - **JSON Backup v2 (Feature 26)**:
     - Schema:
       ```json
       {
         "version": 2,
         "exportedAt": "2026-10-26T...",
         "workspace": "cocina-central",
         "products": [...],
         "auditLog": [...]
       }
       ```
     - Backward compatibility: Normalizer for legacy JSON v1 format (which may have flat product arrays or older field names).
     - Full round-trip validation: verify that exporting then importing restores 100% of product state without data loss.
2. **Export / Import UI (`src/lib/components/ExportImportModal.svelte`)**:
   - Touch-friendly modal triggerable from top bar or drawer.
   - Download buttons for CSV and JSON with automatic filename timestamping (e.g., `stockcontrol-inventario-2026-10-26.csv`).
   - Drag-and-drop / file input for CSV and JSON import with validation error preview before committing.
   - All interactive buttons >= 44x44px.
3. **E2E Test Alignment**:
   - Verify alignment with `tests/e2e/tier1/f25_csv_export.test.js` and `f26_json_backup.test.js`.

Write your complete design, data structures, and component templates to `.agents/teamwork/explorer_m4_3/handoff.md` and notify with `send_message`.


## 2026-10-26T01:28:30Z
You are explorer_m4_3.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m4_3/
Read your task assignment in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m4_3/DISPATCH.md.
Also read /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md, /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md, and inspect src/lib/stores/inventoryStore.ts, src/lib/domain/models.ts, and tests/e2e/tier1/f25_csv_export.test.js, f26_json_backup.test.js.
Design contingency export/import logic (UTF-8 BOM RFC 4180 CSV with ; delimiter, JSON v2 schema with v1 normalizer), and ExportImportModal.svelte.
Write your complete report to /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m4_3/handoff.md and notify with send_message.
