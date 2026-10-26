# HANDOFF REPORT: Contingency Data Export & Import (CSV & JSON v2) & ExportImportModal

**Agent**: explorer_m4_3  
**Role**: Investigation & Synthesis  
**Milestone**: Milestone 4 (Features 25, 26)  
**Date**: 2026-10-26T01:28:30Z  
**Target Path**: `.agents/teamwork/explorer_m4_3/handoff.md`  

---

## 1. Observation

### 1.1 Direct Repository & Test Inspection
We investigated the following files across the repository:
1. `PROJECT.md` (lines 31, 73-74, 135-138, 176, 192):
   - Defined `contingencyService.ts: RFC 4180 UTF-8 BOM CSV & JSON v2` in the Repository & Data Portability layer (`src/lib/repositories/contingencyService.ts`).
   - Defined `ExportImportModal.svelte` in `src/lib/components/ExportImportModal.svelte`.
   - Feature 25: UTF-8 BOM CSV Export (RFC 4180 Excel-ready export with BOM and semicolon separator `;`).
   - Feature 26: JSON v2 Backup & Restore (Versioned JSON export and import with backward compatibility normalizer).
   - Format specifications:
     - CSV: `text/csv;charset=utf-8;` with BOM `\uFEFF`, delimited by `;`, RFC 4180 quoted.
     - JSON: `{ app: 'StockControl PWA', version: 2, exportedAt: string, workspaceId: string, products: Product[] }`.

2. `tests/e2e/harness/contingency.js` (lines 6-62, 68-143, 151-207):
   - Reference implementation for CSV and JSON contingency:
     - Header columns:
       ```javascript
       const CSV_HEADER = [
         'Producto',
         'Categoría',
         'Cantidad',
         'Unidad',
         'Recepción',
         'Vencimiento',
         'Almacenamiento',
         'Lote',
         'Proveedor',
         'Observaciones'
       ];
       ```
     - Keys: `['name', 'category', 'quantity', 'unit', 'receivedDate', 'expiryDate', 'location', 'lot', 'supplier', 'notes']`.
     - `exportProductsToCsv(products)`: Prepends `\uFEFF` (BOM), quotes cells with double quotes `""` escaping, joins rows with `\r\n`.
     - `parseCsv(csvText)`: Strips BOM if `charCodeAt(0) === 0xfeff`, detects `;` or `,` delimiter, robust RFC 4180 quote tokenizer handling multi-line strings with CRLF, returns empty array if `< 2` rows.
     - `exportJsonV2(products, workspaceId)`: Returns JSON string with `app: 'StockControl PWA'`, `version: 2`, `exportedAt`, `workspaceId`, `products`.
     - `importJson(raw, currentWorkspaceId)`: Detects v1 if `version === 1` or `app === 'StockControl Vencimientos'`, normalizes legacy `received` -> `receivedDate`, `expiry` -> `expiryDate`, defaults `createdBy` to `'Legacy Import'`, sets `isDiscarded: false`, `isConsumed: false`.

3. `tests/e2e/tier1_features/f25_csv_bom.test.js`:
   - `F25-T01`: Asserts `csv.charCodeAt(0) === 0xfeff` (BOM prefix).
   - `F25-T02`: Asserts header row contains `;` and `"Producto"`.
   - `F25-T03`: Asserts CSV includes all 10 required Spanish header columns.
   - `F25-T04`: Asserts quotes and semicolons in values are escaped (e.g. `""Premium""`, `"Revisar temperatura; mantener a -18°C"`).
   - `F25-T05`: Asserts `parseCsv` roundtrips products faithfully.

4. `tests/e2e/tier1_features/f26_json_backup.test.js`:
   - `F26-T01`: Validates JSON v2 schema properties: `app`, `version: 2`, `workspaceId`, `exportedAt`, `products`.
   - `F26-T02`: Asserts `importJson` restores valid v2 backup.
   - `F26-T03`: Asserts detection and normalization of legacy v1 JSON (`app: 'StockControl Vencimientos'`, `version: 1`).
   - `F26-T04`: Asserts legacy `received`/`expiry` keys map to `receivedDate`/`expiryDate`.
   - `F26-T05`: Asserts invalid JSON or missing `products` array throws descriptive error matching `/missing "products" array/`.

5. `tests/e2e/tier2_boundaries/b25_csv_boundaries.test.js`:
   - `B25-T01`: Multi-line notes with embedded CRLF newlines parse without splitting rows.
   - `B25-T02`: Embedded semicolons, double quotes, and commas parse cleanly.
   - `B25-T03`: BOM-less CSV files (from macOS/Linux tools) import successfully.
   - `B25-T04`: Comma-delimited CSV files auto-detected and parsed cleanly.
   - `B25-T05`: Header-only empty CSV returns empty array `[]` without throwing.

6. `tests/e2e/tier2_boundaries/b26_json_boundaries.test.js`:
   - `B26-T01`: Missing `products` key throws `/missing "products" array/`.
   - `B26-T02`: Duplicate IDs in import payload receive distinct unique keys or deduplicate without crashing.
   - `B26-T03`: High-performance import: 1,000 products imported in under 50ms (measured ~6ms).
   - `B26-T04`: Preserves unexpected custom properties (e.g. `customHaccpCode`, `internalBinNumber`).
   - `B26-T05`: Null/undefined optional fields safely default (`category: 'Otros'`, `quantity: 0`, `unit: 'unidad(es)'`, `notes: ''`).

7. `tests/e2e/tier4_realworld/s4_evening_waste_audit.test.js`:
   - Scenario 4 verifies evening closing HACCP audit generating official Excel-ready CSV report with BOM `\uFEFF`.

8. Repository capabilities in `src/lib/repositories/productRepository.ts` (lines 651-726):
   - `batchImport(workspaceId, products, operator)` already exists and handles batched Firestore writes in chunks of 200 items (400 writes: product + history), respecting the 500-op Firestore limit.

9. Current Test Execution Baseline:
   - Tool command: `node tests/e2e/runner.js`
   - Result: **302/302 tests passing** across Tiers 1-4 with zero failures (exit code 0).

---

## 2. Logic Chain

1. **Excel & Regional Compatibility (Feature 25)**:
   - Observation: Spanish Excel and European/Latin-American versions use `;` as list separator because `,` is the decimal separator. Opening a comma-separated CSV in Spanish Excel puts entire rows into column A.
   - Excel also requires UTF-8 Byte Order Mark (`\uFEFF`) at byte 0; without it, Excel opens UTF-8 text as Windows-1252/ANSI, corrupting Spanish accents (`ñ`, `á`, `é`).
   - Therefore, `exportProductsToCsv` must prepend `\uFEFF` and separate cells with `;`.

2. **Cross-Platform CSV Importer Flexibility**:
   - Observation: In real kitchen environments, users may import CSV files exported by Google Sheets, US Excel, or third-party POS systems that use commas (`,`) or lack the UTF-8 BOM.
   - Therefore, `parseCsv` must detect delimiter by inspecting the first line, strip the BOM if present, and maintain a robust state-machine tokenizer that supports embedded newlines, commas, semicolons, and escaped quotes.

3. **Header Alignment & Flexible Column Mapping**:
   - Observation: The E2E test harness checks standard Spanish headers `['Producto', 'Categoría', 'Cantidad', 'Unidad', 'Recepción', 'Vencimiento', 'Almacenamiento', 'Lote', 'Proveedor', 'Observaciones']`, while DISPATCH mentions `['ID', 'Nombre', 'Categoría', 'Cantidad', 'Unidad', 'Fecha Recepción', 'Fecha Caducidad', 'Ubicación', 'Lote', 'Proveedor', 'Código Barras', 'Estado']`.
   - Therefore, our parser must provide a two-tier strategy:
     1. Column name resolution: normalizes header titles to lowercase alphanumeric, matching aliases (`Nombre` -> `Producto`, `Fecha Caducidad` -> `Vencimiento`, `Ubicación` -> `Almacenamiento`, `Código Barras` -> `barcode`).
     2. Positional fallback: if headers match the canonical 10-column layout, map columns by position 0..9. This guarantees 100% test compatibility with `f25` and `b25`, while supporting rich imports with barcodes and custom fields.

4. **JSON v2 Schema & Legacy Normalizer (Feature 26)**:
   - Observation: Test `F26-T01` checks `obj.workspaceId`, while DISPATCH specifies `obj.workspace`.
   - Therefore, `exportJsonV2` must include both `workspaceId` and `workspace` pointing to the active kitchen ID.
   - For `importJson`, legacy v1 payloads (e.g. from the original vanilla prototype) lack audit timestamps and have legacy field names (`received`, `expiry`). The normalizer must map these to `receivedDate` and `expiryDate`, default `createdBy` to `'Legacy Import'`, set active flags (`isDiscarded: false`, `isConsumed: false`), handle duplicate IDs, and preserve custom properties as required by `B26-T04`.

5. **Conflict Resolution Strategy**:
   - When importing products into an existing kitchen workspace, duplicate entries can corrupt stock counts.
   - We design four selectable strategies:
     - `merge`: increases stock quantity of existing matching product (`existing.quantity + incoming.quantity`).
     - `replace`: overwrites fields of existing matching product with imported data.
     - `skip`: ignores incoming products that match existing names/barcodes.
     - `append`: creates new product entries regardless of duplicates.

6. **Ergonomic Modal Architecture (`ExportImportModal.svelte`)**:
   - Observation: Chefs and kitchen operators work with wet fingers or gloves in fast-paced environments.
   - Therefore, all interactive touch targets must satisfy WCAG 2.5.5 (min 44x44 CSS px, with 48px standard for buttons).
   - The modal must provide two distinct tabs (Exportar vs Importar), automatic client-side timestamped downloads (`stockcontrol-inventario-YYYY-MM-DD.csv`, `stockcontrol-backup-YYYY-MM-DD.json`), drag-and-drop file upload, file format auto-detection, a pre-commit validation preview table with error count badges, and seamless batch import execution.

---

## 3. Caveats

1. **Large Dataset Memory Constraints**:
   - While client-side CSV and JSON parsing is tested up to 1,000 items in < 50ms, processing files with > 10,000 rows on lower-end mobile phones could cause brief UI stutter. For enterprise inventories exceeding 5,000 items, streaming via Web Workers should be considered in Milestone 5.
2. **Browser File Download Limitations**:
   - Client-side blob URL generation (`URL.createObjectURL(blob)`) works across all modern browsers (iOS Safari, Android Chrome, desktop). In PWA standalone mode on iOS, downloads open in a new preview tab where the user saves or shares via native share sheet.
3. **Firestore Write Batch Quotas**:
   - Firestore limits each write batch to 500 operations. Our design uses `productRepository.batchImport`, which batches in chunks of 200 items (400 operations: 200 products + 200 audit logs), cleanly respecting Firestore limits.

---

## 4. Conclusion & Complete Implementation Blueprints

We present the production-ready code designs for:
1. `src/lib/repositories/contingencyService.ts`
2. `src/lib/components/ExportImportModal.svelte`
3. Route integration in `src/routes/+page.svelte`

### 4.1 Module: `src/lib/repositories/contingencyService.ts`

```typescript
/**
 * StockControl PWA — Contingency Data Service
 * RFC 4180 Excel-ready CSV (UTF-8 BOM, semicolon delimiter) & JSON v2 Backup / v1 Normalizer
 * Clean Architecture Repository & Portability Layer
 * Path: src/lib/repositories/contingencyService.ts
 */

import type { Product, HistoryLog } from '$lib/domain/models';
import {
  normalizeCategory,
  normalizeUnit,
  normalizeLocation,
  normalizeQuantity
} from '$lib/domain/models';
import type { ProductItem } from '$lib/stores/inventoryStore';

export const CSV_HEADER = [
  'Producto',
  'Categoría',
  'Cantidad',
  'Unidad',
  'Recepción',
  'Vencimiento',
  'Almacenamiento',
  'Lote',
  'Proveedor',
  'Observaciones'
] as const;

export const CSV_KEYS = [
  'name',
  'category',
  'quantity',
  'unit',
  'receivedDate',
  'expiryDate',
  'location',
  'lot',
  'supplier',
  'notes'
] as const;

export type ConflictStrategy = 'merge' | 'replace' | 'skip' | 'append';

export interface ParsedProduct {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  receivedDate: string;
  expiryDate: string;
  location: string;
  lot: string;
  supplier: string;
  barcode?: string;
  notes: string;
  isDiscarded: boolean;
  isConsumed: boolean;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  lastAction?: string;
  [key: string]: any;
}

export interface ValidationResult {
  valid: ParsedProduct[];
  invalid: { row: number; item: Partial<ParsedProduct>; errors: string[] }[];
  summary: {
    total: number;
    validCount: number;
    invalidCount: number;
  };
}

export interface JsonBackupV2 {
  app: 'StockControl PWA';
  version: 2;
  exportedAt: string;
  workspaceId: string;
  workspace: string;
  products: (Product | ProductItem)[];
  auditLog?: HistoryLog[];
}

export interface JsonImportResult {
  version: number;
  workspaceId: string;
  products: Product[];
  auditLog?: HistoryLog[];
}

/**
 * Escapes an RFC 4180 CSV cell value and wraps in quotes.
 */
export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Exports products array to RFC 4180 CSV with UTF-8 BOM and semicolon delimiter.
 */
export function exportProductsToCsv(products: (Partial<Product> | ProductItem)[]): string {
  const BOM = '\uFEFF';
  const headerRow = CSV_HEADER.map(escapeCsvCell).join(';');
  const rows = (products || []).map(p => {
    return CSV_KEYS.map(k => {
      let v: any = (p as any)[k];
      if (k === 'receivedDate' && !v) v = (p as any).received || '';
      if (k === 'expiryDate' && !v) v = (p as any).expiry || '';
      return escapeCsvCell(v ?? '');
    }).join(';');
  });
  return BOM + [headerRow, ...rows].join('\r\n');
}

/**
 * Exports waste history to RFC 4180 CSV with UTF-8 BOM for HACCP inspection.
 */
export function exportWasteToCsv(historyLogs: HistoryLog[]): string {
  const BOM = '\uFEFF';
  const headers = [
    'Fecha / Hora',
    'Producto',
    'Categoría',
    'Cantidad Descartada',
    'Unidad',
    'Motivo Descarte',
    'Operador Responsable',
    'Notas'
  ];
  const headerRow = headers.map(escapeCsvCell).join(';');
  const discardLogs = (historyLogs || []).filter(l => l.action === 'discard');
  const rows = discardLogs.map(l => {
    return [
      escapeCsvCell(l.timestamp || ''),
      escapeCsvCell(l.productName || ''),
      escapeCsvCell(l.category || ''),
      escapeCsvCell(Math.abs(l.quantityDelta || 0)),
      escapeCsvCell(l.unit || ''),
      escapeCsvCell(l.reason || 'Sin especificar'),
      escapeCsvCell(l.operatorAlias || ''),
      escapeCsvCell(l.notes || '')
    ].join(';');
  });
  return BOM + [headerRow, ...rows].join('\r\n');
}

/**
 * Parses an RFC 4180 CSV string (with or without BOM, semicolon or comma).
 */
export function parseCsv(csvText: string): ParsedProduct[] {
  if (!csvText || typeof csvText !== 'string') return [];

  let cleanText = csvText;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const firstLine = cleanText.split(/\r?\n/)[0] || '';
  const delimiter = firstLine.includes(';') ? ';' : ',';

  // RFC 4180 Tokenizer
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip CRLF
      }
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 0 && currentRow.some(c => c.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(c => c.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  // Flexible Header Resolution
  const headerTokens = rows[0].map(h =>
    h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  );

  const getColIdx = (aliases: string[], fallbackIdx: number): number => {
    const idx = headerTokens.findIndex(h => aliases.includes(h));
    return idx >= 0 ? idx : fallbackIdx;
  };

  const nameIdx = getColIdx(['producto', 'nombre', 'name', 'item', 'descripcion'], 0);
  const catIdx = getColIdx(['categoria', 'category'], 1);
  const qtyIdx = getColIdx(['cantidad', 'quantity', 'qty', 'stock'], 2);
  const unitIdx = getColIdx(['unidad', 'unit', 'uom'], 3);
  const recIdx = getColIdx(['recepcion', 'fecharecepcion', 'fecha_recepcion', 'receiveddate', 'received'], 4);
  const expIdx = getColIdx(['vencimiento', 'fechacaducidad', 'fechavencimiento', 'caducidad', 'expirydate', 'expiry'], 5);
  const locIdx = getColIdx(['almacenamiento', 'ubicacion', 'location'], 6);
  const lotIdx = getColIdx(['lote', 'lot', 'batch'], 7);
  const supIdx = getColIdx(['proveedor', 'supplier', 'vendor'], 8);
  const notesIdx = getColIdx(['observaciones', 'notas', 'notes', 'comentarios'], 9);
  const barIdx = getColIdx(['codigobarras', 'codigo_barras', 'barcode', 'codigo'], -1);

  const dataRows = rows.slice(1);
  const now = new Date().toISOString();

  return dataRows.map((cols, idx) => {
    const rawQty = cols[qtyIdx];
    const parsedQty = Number(rawQty);
    const validQty = !isNaN(parsedQty) && parsedQty >= 0 ? parsedQty : 0;

    return {
      id: `csv_imp_${Date.now()}_${idx}`,
      name: (cols[nameIdx] || '').trim(),
      category: normalizeCategory((cols[catIdx] || 'Otros').trim()),
      quantity: validQty,
      unit: normalizeUnit((cols[unitIdx] || 'unidad(es)').trim()),
      receivedDate: (cols[recIdx] || '').trim() || now.slice(0, 10),
      expiryDate: (cols[expIdx] || '').trim() || now.slice(0, 10),
      location: normalizeLocation((cols[locIdx] || 'Refrigerador').trim()),
      lot: (cols[lotIdx] || '').trim(),
      supplier: (cols[supIdx] || '').trim(),
      barcode: barIdx >= 0 ? (cols[barIdx] || '').trim() : '',
      notes: (cols[notesIdx] || '').trim(),
      isDiscarded: false,
      isConsumed: false,
      createdAt: now,
      createdBy: 'Importador CSV',
      updatedAt: now,
      updatedBy: 'Importador CSV',
      lastAction: 'import'
    };
  });
}

/**
 * Validates parsed products before committing to store/Firestore.
 */
export function validateImportItems(items: ParsedProduct[]): ValidationResult {
  const valid: ParsedProduct[] = [];
  const invalid: { row: number; item: Partial<ParsedProduct>; errors: string[] }[] = [];

  items.forEach((item, idx) => {
    const errors: string[] = [];
    if (!item.name || item.name.trim().length === 0) {
      errors.push('El nombre del producto es obligatorio.');
    }
    if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity < 0) {
      errors.push('La cantidad debe ser un número mayor o igual a cero.');
    }
    if (!item.expiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(item.expiryDate)) {
      errors.push('La fecha de vencimiento debe tener formato YYYY-MM-DD.');
    }

    if (errors.length > 0) {
      invalid.push({ row: idx + 2, item, errors });
    } else {
      valid.push(item);
    }
  });

  return {
    valid,
    invalid,
    summary: {
      total: items.length,
      validCount: valid.length,
      invalidCount: invalid.length
    }
  };
}

/**
 * Generates JSON v2 backup string.
 */
export function exportJsonV2(
  products: (Product | ProductItem)[],
  workspaceId: string = 'cocina-principal',
  auditLog?: HistoryLog[]
): string {
  const payload: JsonBackupV2 = {
    app: 'StockControl PWA',
    version: 2,
    exportedAt: new Date().toISOString(),
    workspaceId,
    workspace: workspaceId,
    products: products || [],
    ...(auditLog && auditLog.length > 0 ? { auditLog } : {})
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Imports and normalizes JSON backup (supports v1 and v2 formats).
 */
export function importJson(
  raw: string | object,
  currentWorkspaceId: string = 'cocina-principal'
): JsonImportResult {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON backup: root must be an object');
  }
  if (!Array.isArray(data.products)) {
    throw new Error('Invalid JSON backup: missing "products" array');
  }

  const isV1 = data.version === 1 || data.app === 'StockControl Vencimientos';
  const now = new Date().toISOString();
  const seenIds = new Set<string>();

  const normalized: Product[] = data.products.map((p: any, idx: number) => {
    let rawId = p.id ? String(p.id).trim() : '';
    if (!rawId || seenIds.has(rawId)) {
      rawId = `imp_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
    }
    seenIds.add(rawId);

    const receivedDate = p.receivedDate || p.received || now.slice(0, 10);
    const expiryDate = p.expiryDate || p.expiry || now.slice(0, 10);
    const quantity = typeof p.quantity === 'number' && p.quantity >= 0 && !isNaN(p.quantity)
      ? p.quantity
      : (typeof p.quantity === 'string' && !isNaN(parseFloat(p.quantity)) ? Math.max(0, parseFloat(p.quantity)) : 0);

    // Preserve custom properties
    const item: any = {
      ...p,
      id: rawId,
      name: (p.name || 'Sin nombre').trim(),
      category: p.category ? normalizeCategory(p.category) : 'Otros',
      quantity,
      unit: p.unit ? normalizeUnit(p.unit) : 'unidad(es)',
      receivedDate,
      expiryDate,
      location: p.location ? normalizeLocation(p.location) : 'Refrigerador',
      lot: p.lot || '',
      supplier: p.supplier || '',
      barcode: p.barcode || '',
      notes: p.notes || '',
      isDiscarded: Boolean(p.isDiscarded),
      isConsumed: Boolean(p.isConsumed),
      createdAt: p.createdAt || now,
      createdBy: p.createdBy || (isV1 ? 'Legacy Import' : 'Importador'),
      updatedAt: p.updatedAt || now,
      updatedBy: p.updatedBy || 'Importador',
      lastAction: p.lastAction || 'import'
    };

    return item as Product;
  });

  return {
    version: isV1 ? 1 : (data.version || 2),
    workspaceId: data.workspaceId || data.workspace || currentWorkspaceId,
    products: normalized,
    auditLog: Array.isArray(data.auditLog) ? data.auditLog : undefined
  };
}

/**
 * Resolves conflicts between incoming products and active stock.
 */
export function resolveImportConflicts(
  incoming: ParsedProduct[],
  existing: ProductItem[],
  strategy: ConflictStrategy
): {
  toInsert: Omit<Product, 'id'>[];
  toUpdate: { id: string; updates: Partial<Product> }[];
  skippedCount: number;
} {
  const existingMapByName = new Map<string, ProductItem>();
  const existingMapByBarcode = new Map<string, ProductItem>();

  existing.forEach(p => {
    if (p.name) existingMapByName.set(p.name.trim().toLowerCase(), p);
    if (p.barcode) existingMapByBarcode.set(p.barcode.trim(), p);
  });

  const toInsert: Omit<Product, 'id'>[] = [];
  const toUpdate: { id: string; updates: Partial<Product> }[] = [];
  let skippedCount = 0;

  for (const item of incoming) {
    const match =
      (item.barcode && existingMapByBarcode.get(item.barcode.trim())) ||
      existingMapByName.get(item.name.trim().toLowerCase());

    if (!match) {
      toInsert.push(item);
      continue;
    }

    if (strategy === 'append') {
      toInsert.push(item);
    } else if (strategy === 'skip') {
      skippedCount++;
    } else if (strategy === 'replace') {
      toUpdate.push({
        id: match.id,
        updates: {
          category: item.category as any,
          quantity: item.quantity,
          unit: item.unit as any,
          receivedDate: item.receivedDate,
          expiryDate: item.expiryDate,
          location: item.location as any,
          lot: item.lot,
          supplier: item.supplier,
          notes: item.notes,
          lastAction: 'import_replace'
        }
      });
    } else if (strategy === 'merge') {
      const mergedQty = normalizeQuantity((match.quantity ?? 0) + item.quantity);
      toUpdate.push({
        id: match.id,
        updates: {
          quantity: mergedQty,
          lastAction: 'import_merge'
        }
      });
    }
  }

  return { toInsert, toUpdate, skippedCount };
}

/**
 * Triggers a browser file download for text/blob content.
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

---

### 4.2 Component: `src/lib/components/ExportImportModal.svelte`

```svelte
<!--
  StockControl PWA — ExportImportModal.svelte
  Contingency Data Export & Import Modal (CSV & JSON v2)
  Path: src/lib/components/ExportImportModal.svelte
  Ergonomics: WCAG 2.5.5 Touch Targets (>=44x44px, min-height 48px)
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { workspaceStore } from '$lib/stores/workspaceStore';
  import { inventoryStore } from '$lib/stores/inventoryStore';
  import { toastStore } from '$lib/stores/toastStore';
  import { productRepository } from '$lib/repositories/productRepository';
  import {
    exportProductsToCsv,
    exportWasteToCsv,
    exportJsonV2,
    parseCsv,
    importJson,
    validateImportItems,
    resolveImportConflicts,
    triggerFileDownload,
    type ConflictStrategy,
    type ParsedProduct,
    type ValidationResult
  } from '$lib/repositories/contingencyService';
  import type { HistoryLog } from '$lib/domain/models';

  export let isOpen: boolean = false;
  export let recentHistoryLogs: HistoryLog[] = [];

  const dispatch = createEventDispatcher<{
    close: void;
    imported: { count: number };
  }>();

  // Tab State
  type ActiveTab = 'export' | 'import';
  let activeTab: ActiveTab = 'export';

  // Conflict Resolution Selection
  let conflictStrategy: ConflictStrategy = 'merge';

  // Import Upload & Validation State
  let isDragging: boolean = false;
  let isParsing: boolean = false;
  let isCommitting: boolean = false;
  let uploadedFileName: string = '';
  let parsedProducts: ParsedProduct[] = [];
  let validationResult: ValidationResult | null = null;
  let fileError: string | null = null;

  // Real-time Date Stamp for Download Filenames
  const today = new Date().toISOString().slice(0, 10);

  function handleClose() {
    isOpen = false;
    resetImportState();
    dispatch('close');
  }

  function resetImportState() {
    uploadedFileName = '';
    parsedProducts = [];
    validationResult = null;
    fileError = null;
    isParsing = false;
    isCommitting = false;
  }

  // Export Triggers
  function handleExportCsv() {
    try {
      const csvContent = exportProductsToCsv($inventoryStore.products);
      const filename = `stockcontrol-inventario-${$workspaceStore.workspaceId}-${today}.csv`;
      triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;');
      toastStore.success(`CSV descargado: ${$inventoryStore.products.length} productos`);
    } catch (err: any) {
      toastStore.error('Error al generar CSV: ' + (err.message || 'Error desconocido'));
    }
  }

  function handleExportWasteCsv() {
    try {
      const csvContent = exportWasteToCsv(recentHistoryLogs);
      const filename = `stockcontrol-mermas-haccp-${$workspaceStore.workspaceId}-${today}.csv`;
      triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;');
      toastStore.success('Historial de mermas descargado en CSV');
    } catch (err: any) {
      toastStore.error('Error al exportar mermas: ' + (err.message || 'Error desconocido'));
    }
  }

  function handleExportJson() {
    try {
      const jsonContent = exportJsonV2(
        $inventoryStore.products,
        $workspaceStore.workspaceId,
        recentHistoryLogs
      );
      const filename = `stockcontrol-backup-${$workspaceStore.workspaceId}-${today}.json`;
      triggerFileDownload(jsonContent, filename, 'application/json;charset=utf-8;');
      toastStore.success(`Respaldo JSON v2 descargado`);
    } catch (err: any) {
      toastStore.error('Error al generar JSON: ' + (err.message || 'Error desconocido'));
    }
  }

  // File Processing
  async function processFile(file: File) {
    resetImportState();
    uploadedFileName = file.name;
    isParsing = true;

    try {
      const text = await file.text();
      const isJson = file.name.endsWith('.json') || file.type.includes('json');

      if (isJson) {
        const result = importJson(text, $workspaceStore.workspaceId);
        parsedProducts = result.products as unknown as ParsedProduct[];
      } else {
        parsedProducts = parseCsv(text);
      }

      if (parsedProducts.length === 0) {
        fileError = 'El archivo no contiene productos válidos o está vacío.';
      } else {
        validationResult = validateImportItems(parsedProducts);
      }
    } catch (err: any) {
      fileError = 'Error al procesar archivo: ' + (err.message || 'Formato no soportado');
    } finally {
      isParsing = false;
    }
  }

  function handleFileInput(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      processFile(target.files[0]);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }

  // Commit Import
  async function handleCommitImport() {
    if (!validationResult || validationResult.valid.length === 0) return;
    isCommitting = true;

    try {
      const { toInsert, toUpdate, skippedCount } = resolveImportConflicts(
        validationResult.valid,
        $inventoryStore.products,
        conflictStrategy
      );

      let insertCount = 0;
      if (toInsert.length > 0) {
        insertCount = await productRepository.batchImport(
          $workspaceStore.workspaceId,
          toInsert,
          $workspaceStore.operatorAlias
        );
      }

      for (const update of toUpdate) {
        await productRepository.updateProduct(
          $workspaceStore.workspaceId,
          update.id,
          update.updates,
          $workspaceStore.operatorAlias
        );
      }

      const totalHandled = insertCount + toUpdate.length;
      toastStore.success(
        `Importación completada: ${insertCount} agregados, ${toUpdate.length} actualizados${
          skippedCount > 0 ? `, ${skippedCount} omitidos` : ''
        }.`
      );

      dispatch('imported', { count: totalHandled });
      handleClose();
    } catch (err: any) {
      toastStore.error('Error al guardar datos importados: ' + (err.message || 'Error de red'));
    } finally {
      isCommitting = false;
    }
  }
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && isOpen && handleClose()} />

{#if isOpen}
  <div
    class="modal-backdrop"
    on:click={(e) => e.target === e.currentTarget && handleClose()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="export-import-title"
    tabindex="-1"
  >
    <div class="modal-card">
      <!-- Header -->
      <header class="modal-header">
        <div class="header-titles">
          <h2 id="export-import-title" class="modal-title">Copia de Seguridad y Contingencia</h2>
          <span class="modal-subtitle">Exportación e importación offline de stock y mermas</span>
        </div>
        <button
          type="button"
          class="btn-close"
          on:click={handleClose}
          aria-label="Cerrar modal"
        >
          ✕
        </button>
      </header>

      <!-- Subnavigation Tabs -->
      <div class="modal-tabs" role="tablist">
        <button
          type="button"
          class="tab-btn"
          class:active={activeTab === 'export'}
          role="tab"
          aria-selected={activeTab === 'export'}
          on:click={() => (activeTab = 'export')}
        >
          📤 Exportar Datos
        </button>
        <button
          type="button"
          class="tab-btn"
          class:active={activeTab === 'import'}
          role="tab"
          aria-selected={activeTab === 'import'}
          on:click={() => (activeTab = 'import')}
        >
          📥 Importar Datos
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        {#if activeTab === 'export'}
          <!-- Export Section -->
          <div class="export-pane">
            <div class="info-banner">
              <span class="info-icon">ℹ️</span>
              <p>
                Genera copias portátiles para contingencia en cocina sin conexión o para auditorías sanitarias HACCP.
              </p>
            </div>

            <!-- CSV Card -->
            <div class="action-card">
              <div class="card-icon">📊</div>
              <div class="card-details">
                <h3>Planilla Excel / CSV</h3>
                <p>Formato estándar RFC 4180 con BOM UTF-8 y separador (;) para Microsoft Excel.</p>
                <span class="card-badge">{$inventoryStore.products.length} productos listos</span>
              </div>
              <button
                type="button"
                class="btn-action primary"
                on:click={handleExportCsv}
                disabled={$inventoryStore.products.length === 0}
              >
                Descargar CSV
              </button>
            </div>

            <!-- JSON v2 Card -->
            <div class="action-card">
              <div class="card-icon">💾</div>
              <div class="card-details">
                <h3>Respaldo Total JSON v2</h3>
                <p>Copia completa de la base de datos con estructura versionada e historial.</p>
                <span class="card-badge">Compatible con restauración 1:1</span>
              </div>
              <button
                type="button"
                class="btn-action primary"
                on:click={handleExportJson}
                disabled={$inventoryStore.products.length === 0}
              >
                Descargar JSON
              </button>
            </div>

            <!-- Waste History Card -->
            <div class="action-card secondary">
              <div class="card-icon">📋</div>
              <div class="card-details">
                <h3>Libro de Mermas HACCP (CSV)</h3>
                <p>Exporta el registro de bajas, motivos de deterioro y firmas de operador.</p>
              </div>
              <button
                type="button"
                class="btn-action outline"
                on:click={handleExportWasteCsv}
              >
                Exportar Mermas
              </button>
            </div>
          </div>
        {:else}
          <!-- Import Section -->
          <div class="import-pane">
            <!-- Dropzone -->
            <div
              class="dropzone"
              class:dragging={isDragging}
              on:dragover|preventDefault={() => (isDragging = true)}
              on:dragleave={() => (isDragging = false)}
              on:drop={handleDrop}
              role="region"
              aria-label="Zona de carga de archivo"
            >
              <span class="drop-icon">📁</span>
              <p class="drop-text">Arrastra un archivo CSV o JSON aquí</p>
              <label class="file-picker-btn">
                <span>Seleccionar del dispositivo</span>
                <input
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  on:change={handleFileInput}
                  style="display: none;"
                />
              </label>
              <small class="drop-hint">Formatos soportados: CSV con encabezados estándar o JSON v1/v2</small>
            </div>

            <!-- Error Banner -->
            {#if fileError}
              <div class="error-banner" role="alert">
                <span>⚠️ {fileError}</span>
              </div>
            {/if}

            <!-- Validation Preview -->
            {#if validationResult}
              <div class="preview-section">
                <div class="preview-header">
                  <h4>Archivo: <strong>{uploadedFileName}</strong></h4>
                  <div class="pill-group">
                    <span class="pill-success">✓ {validationResult.summary.validCount} válidos</span>
                    {#if validationResult.summary.invalidCount > 0}
                      <span class="pill-error">✕ {validationResult.summary.invalidCount} errores</span>
                    {/if}
                  </div>
                </div>

                <!-- Conflict Resolution Strategy -->
                <div class="strategy-selector">
                  <label for="conflict-strategy">Acción ante duplicados:</label>
                  <select id="conflict-strategy" bind:value={conflictStrategy} class="select-input">
                    <option value="merge">Fusionar (sumar cantidades al stock actual)</option>
                    <option value="replace">Reemplazar (sobrescribir datos existentes)</option>
                    <option value="skip">Omitir duplicados</option>
                    <option value="append">Agregar siempre como nuevos productos</option>
                  </select>
                </div>

                <!-- Preview Table (first 5 rows) -->
                <div class="table-scroll">
                  <table class="preview-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Stock</th>
                        <th>Vencimiento</th>
                        <th>Ubicación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each validationResult.valid.slice(0, 5) as p}
                        <tr>
                          <td><strong>{p.name}</strong></td>
                          <td>{p.category}</td>
                          <td>{p.quantity} {p.unit}</td>
                          <td>{p.expiryDate}</td>
                          <td>{p.location}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                  {#if validationResult.valid.length > 5}
                    <div class="more-rows-hint">
                      ...y {validationResult.valid.length - 5} productos más listos para importar.
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <footer class="modal-footer">
        <button type="button" class="btn-cancel" on:click={handleClose}>
          Cerrar
        </button>

        {#if activeTab === 'import' && validationResult && validationResult.valid.length > 0}
          <button
            type="button"
            class="btn-commit"
            on:click={handleCommitImport}
            disabled={isCommitting}
          >
            {isCommitting ? 'Importando...' : `Confirmar e Importar (${validationResult.valid.length})`}
          </button>
        {/if}
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1050;
    padding: 16px;
  }

  .modal-card {
    background: #ffffff;
    border-radius: 20px;
    width: 100%;
    max-width: 580px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 18px 20px 14px;
    border-bottom: 1px solid #eadfd2;
    background: #faf5ee;
  }

  .modal-title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 800;
    color: #4a2818;
  }

  .modal-subtitle {
    font-size: 0.8rem;
    color: #7c7168;
  }

  .btn-close {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    border: none;
    background: transparent;
    font-size: 1.2rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .btn-close:active {
    background-color: #ede2d5;
  }

  .modal-tabs {
    display: flex;
    border-bottom: 2px solid #eadfd2;
    background-color: #faf5ee;
  }

  .tab-btn {
    flex: 1;
    min-height: 48px;
    border: none;
    background: transparent;
    font-weight: 700;
    font-size: 0.9rem;
    color: #7c7168;
    cursor: pointer;
    touch-action: manipulation;
    border-bottom: 3px solid transparent;
  }

  .tab-btn.active {
    color: #75472f;
    border-bottom-color: #75472f;
    background: #ffffff;
  }

  .modal-body {
    padding: 18px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .info-banner {
    display: flex;
    gap: 10px;
    background: #fdf8f3;
    border: 1px solid #eadfd2;
    padding: 10px 14px;
    border-radius: 12px;
    margin-bottom: 16px;
    font-size: 0.85rem;
    color: #69412d;
  }

  .action-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border: 1.5px solid #eadfd2;
    border-radius: 14px;
    margin-bottom: 12px;
    background: #faf5ee;
  }

  .action-card.secondary {
    background: #ffffff;
  }

  .card-icon {
    font-size: 1.8rem;
  }

  .card-details {
    flex: 1;
  }

  .card-details h3 {
    margin: 0 0 2px;
    font-size: 0.95rem;
    color: #4a2818;
  }

  .card-details p {
    margin: 0 0 4px;
    font-size: 0.78rem;
    color: #7c7168;
  }

  .card-badge {
    display: inline-block;
    font-size: 0.7rem;
    background: #ede2d5;
    padding: 2px 8px;
    border-radius: 6px;
    font-weight: 600;
    color: #69412d;
  }

  .btn-action {
    min-height: 48px;
    min-width: 130px;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
    padding: 0 14px;
  }

  .btn-action.primary {
    background: #75472f;
    color: #ffffff;
    border: none;
  }

  .btn-action.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-action.outline {
    background: transparent;
    border: 1.5px solid #75472f;
    color: #75472f;
  }

  /* Dropzone */
  .dropzone {
    border: 2px dashed #bba998;
    background: #fdfaf6;
    border-radius: 16px;
    padding: 24px 16px;
    text-align: center;
    transition: background 0.2s;
  }

  .dropzone.dragging {
    background: #faede0;
    border-color: #75472f;
  }

  .drop-icon {
    font-size: 2.2rem;
    display: block;
    margin-bottom: 6px;
  }

  .drop-text {
    margin: 0 0 12px;
    font-weight: 600;
    color: #4a2818;
  }

  .file-picker-btn {
    display: inline-block;
    min-height: 48px;
    line-height: 48px;
    padding: 0 20px;
    background: #75472f;
    color: #ffffff;
    font-weight: 700;
    font-size: 0.9rem;
    border-radius: 12px;
    cursor: pointer;
    touch-action: manipulation;
  }

  .drop-hint {
    display: block;
    margin-top: 10px;
    color: #8c8075;
    font-size: 0.75rem;
  }

  .error-banner {
    margin-top: 14px;
    padding: 12px;
    background: #fde8e7;
    border: 1px solid #f8c2be;
    color: #b84035;
    border-radius: 10px;
    font-size: 0.85rem;
  }

  .preview-section {
    margin-top: 18px;
    border-top: 1px solid #eadfd2;
    padding-top: 14px;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .preview-header h4 {
    margin: 0;
    font-size: 0.9rem;
  }

  .pill-group {
    display: flex;
    gap: 6px;
  }

  .pill-success {
    background: #e2f0d9;
    color: #385623;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .pill-error {
    background: #fde8e7;
    color: #b84035;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .strategy-selector {
    margin-bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .strategy-selector label {
    font-size: 0.82rem;
    font-weight: 700;
    color: #4a2818;
  }

  .select-input {
    min-height: 48px;
    border-radius: 10px;
    border: 1.5px solid #eadfd2;
    padding: 0 12px;
    font-size: 0.88rem;
    background: #ffffff;
    color: #4a2818;
  }

  .table-scroll {
    overflow-x: auto;
    border: 1px solid #eadfd2;
    border-radius: 10px;
  }

  .preview-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    text-align: left;
  }

  .preview-table th,
  .preview-table td {
    padding: 8px 10px;
    border-bottom: 1px solid #f0e6da;
  }

  .preview-table th {
    background: #faf5ee;
    color: #7c7168;
    font-weight: 700;
  }

  .more-rows-hint {
    padding: 8px 10px;
    text-align: center;
    font-size: 0.75rem;
    color: #7c7168;
    background: #faf5ee;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid #eadfd2;
    background: #faf5ee;
  }

  .btn-cancel {
    min-height: 48px;
    min-width: 90px;
    background: #f5ede4;
    border: 1.5px solid #eadfd2;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 700;
    color: #7c7168;
    cursor: pointer;
    touch-action: manipulation;
  }

  .btn-commit {
    min-height: 48px;
    padding: 0 20px;
    background: #75472f;
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-size: 0.92rem;
    font-weight: 800;
    cursor: pointer;
    touch-action: manipulation;
    box-shadow: 0 4px 12px rgba(117, 71, 47, 0.25);
  }

  .btn-commit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

---

### 4.3 Integration in `src/routes/+page.svelte`

1. **Import and Local State** in `<script>`:
```typescript
import ExportImportModal from '$lib/components/ExportImportModal.svelte';

let isExportImportModalOpen: boolean = false;
```

2. **Top Bar Button** in `<header class="app-header">`:
```svelte
<div class="header-content">
  <div class="brand">
    <h1 class="logo-title">StockControl</h1>
    <span class="version-badge">PWA</span>
  </div>

  <div class="header-actions">
    <!-- Contingency Data Export/Import Trigger Button -->
    <button
      type="button"
      class="backup-btn"
      on:click={() => (isExportImportModalOpen = true)}
      aria-label="Copia de seguridad y contingencia"
      title="Exportar o importar datos"
    >
      <span class="backup-icon" aria-hidden="true">💾</span>
      <span class="backup-label">Respaldo</span>
    </button>

    <button
      type="button"
      class="workspace-badge-btn"
      on:click={() => (isWorkspaceModalOpen = true)}
      aria-label="Configurar cocina y operador"
    >
      <span class="ws-dot" class:online={$connectivityStore.online}></span>
      <span class="ws-text">{$workspaceStore.workspaceId}</span>
      <span class="op-alias">({$workspaceStore.operatorAlias})</span>
    </button>
  </div>
</div>
```

3. **Mounting the Modal** near `<WorkspaceModal>`:
```svelte
<ExportImportModal
  bind:isOpen={isExportImportModalOpen}
  recentHistoryLogs={recentHistoryLogs}
  on:close={() => (isExportImportModalOpen = false)}
/>
```

---

## 5. Verification Method

### 5.1 Independent E2E Test Execution
Run the automated test runner:
```bash
node tests/e2e/runner.js
```
Expected output:
- **302/302 tests passing** (Tier 1 Feature Coverage, Tier 2 Boundaries, Tier 3 Combinations, Tier 4 Real-world Scenarios).
- Exit code 0.

### 5.2 Specific Test Target Verification
Execute individual test files to confirm compliance:
```bash
node tests/e2e/tier1_features/f25_csv_bom.test.js
node tests/e2e/tier1_features/f26_json_backup.test.js
node tests/e2e/tier2_boundaries/b25_csv_boundaries.test.js
node tests/e2e/tier2_boundaries/b26_json_boundaries.test.js
node tests/e2e/tier3_combinations/cross_feature_combinations.test.js
node tests/e2e/tier4_realworld/s4_evening_waste_audit.test.js
```

### 5.3 Static Type & Build Checks
When ready for implementation:
```bash
npm run check
npm run build
```
Expected output:
- 0 TypeScript / svelte-check errors.
- Successful static SPA build in `build/`.

### 5.4 Invalidation Conditions
This design is invalidated if:
1. Semicolon delimiter or UTF-8 BOM is omitted from exported CSV, breaking Spanish Excel compatibility.
2. JSON v2 schema changes the `version` field from 2 or removes `products` array root property.
3. Interactive buttons in `ExportImportModal.svelte` have touch targets smaller than 44x44px.
4. Legacy JSON v1 products fail to map `received`/`expiry` keys to `receivedDate`/`expiryDate`.
