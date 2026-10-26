/**
 * Contingency Data Service Reference Oracle (CSV & JSON)
 * Authoritative source: ORIGINAL_REQUEST.md § R4, PROJECT.md § Interface Contracts
 */

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

const CSV_KEYS = [
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
];

/**
 * Escapes an RFC 4180 CSV cell value and wraps in quotes if needed.
 * @param {any} val
 * @returns {string}
 */
function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Exports products array to RFC 4180 CSV string with UTF-8 BOM prefix and semicolon delimiter.
 * @param {Array<object>} products
 * @returns {string}
 */
function exportProductsToCsv(products) {
  const BOM = '\uFEFF';
  const headerRow = CSV_HEADER.map(escapeCsvCell).join(';');
  const rows = (products || []).map(p => {
    return CSV_KEYS.map(k => {
      let v = p[k];
      if (k === 'receivedDate' && !v) v = p.received || '';
      if (k === 'expiryDate' && !v) v = p.expiry || '';
      return escapeCsvCell(v ?? '');
    }).join(';');
  });
  return BOM + [headerRow, ...rows].join('\r\n');
}

/**
 * Parses an RFC 4180 CSV string (with or without BOM) delimited by semicolon or comma.
 * @param {string} csvText
 * @returns {Array<object>} array of product-like records
 */
function parseCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];

  // Strip BOM if present
  let cleanText = csvText;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  // Detect delimiter: check first line for ; vs ,
  const firstLine = cleanText.split(/\r?\n/)[0] || '';
  const delimiter = firstLine.includes(';') ? ';' : ',';

  // Robust RFC 4180 tokenizer
  const rows = [];
  let currentRow = [];
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
        i++; // skip \n in CRLF
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

  if (rows.length < 2) return []; // Only header or empty

  const dataRows = rows.slice(1);
  return dataRows.map((cols, idx) => {
    return {
      id: `csv_imp_${Date.now()}_${idx}`,
      name: (cols[0] || '').trim(),
      category: (cols[1] || 'Otros').trim(),
      quantity: Number(cols[2]) >= 0 ? Number(cols[2]) : 0,
      unit: (cols[3] || 'unidad(es)').trim(),
      receivedDate: (cols[4] || '').trim(),
      expiryDate: (cols[5] || '').trim(),
      location: (cols[6] || 'Refrigerador').trim(),
      lot: (cols[7] || '').trim(),
      supplier: (cols[8] || '').trim(),
      notes: (cols[9] || '').trim(),
      isDiscarded: false,
      isConsumed: false
    };
  });
}

/**
 * Creates JSON v2 backup string.
 * @param {Array<object>} products
 * @param {string} workspaceId
 * @returns {string}
 */
function exportJsonV2(products, workspaceId = 'cocina-principal') {
  const payload = {
    app: 'StockControl PWA',
    version: 2,
    exportedAt: new Date().toISOString(),
    workspaceId,
    products: products || []
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Imports and normalizes JSON backup (supports both v1 and v2 formats).
 * @param {string | object} raw
 * @param {string} currentWorkspaceId
 * @returns {{ version: number; products: Array<object> }}
 */
function importJson(raw, currentWorkspaceId = 'cocina-principal') {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON backup: root must be an object');
  }
  if (!Array.isArray(data.products)) {
    throw new Error('Invalid JSON backup: missing "products" array');
  }

  const isV1 = data.version === 1 || data.app === 'StockControl Vencimientos';
  const now = new Date().toISOString();

  const normalized = data.products.map((p, idx) => {
    return {
      id: p.id || `imp_${Date.now()}_${idx}`,
      name: (p.name || 'Sin nombre').trim(),
      category: p.category || 'Otros',
      quantity: typeof p.quantity === 'number' && p.quantity >= 0 ? p.quantity : 0,
      unit: p.unit || 'unidad(es)',
      receivedDate: p.receivedDate || p.received || now.slice(0, 10),
      expiryDate: p.expiryDate || p.expiry || now.slice(0, 10),
      location: p.location || 'Refrigerador',
      lot: p.lot || '',
      supplier: p.supplier || '',
      notes: p.notes || '',
      isDiscarded: Boolean(p.isDiscarded),
      isConsumed: Boolean(p.isConsumed),
      createdAt: p.createdAt || now,
      createdBy: p.createdBy || (isV1 ? 'Legacy Import' : 'Importador'),
      updatedAt: p.updatedAt || now,
      updatedBy: p.updatedBy || 'Importador',
      lastAction: p.lastAction || 'import'
    };
  });

  return {
    version: isV1 ? 1 : (data.version || 2),
    products: normalized
  };
}

module.exports = {
  CSV_HEADER,
  CSV_KEYS,
  escapeCsvCell,
  exportProductsToCsv,
  parseCsv,
  exportJsonV2,
  importJson
};
