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
  category: any;
  quantity: number;
  unit: any;
  receivedDate: string;
  expiryDate: string;
  location: any;
  lot: string;
  supplier: string;
  barcode?: string;
  notes: string;
  isDiscarded: boolean;
  isConsumed: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  lastAction: string;
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
  const discardLogs = (historyLogs || []).filter(
    l => l.action === 'DISCARD' || (l.action as string).toLowerCase() === 'discard'
  );
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
      toInsert.push(item as unknown as Omit<Product, 'id'>);
      continue;
    }

    if (strategy === 'append') {
      toInsert.push(item as unknown as Omit<Product, 'id'>);
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
