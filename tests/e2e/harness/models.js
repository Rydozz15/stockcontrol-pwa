/**
 * Pure Domain Models & Schema Validator Reference Oracle
 * Authoritative source: ORIGINAL_REQUEST.md § R1, R2, PROJECT.md § Interface Contracts
 */

const VALID_CATEGORIES = [
  'Lácteos',
  'Carnes',
  'Pescados y mariscos',
  'Frutas y verduras',
  'Congelados',
  'Abarrotes y secos',
  'Panadería y pastelería',
  'Salsas y aderezos',
  'Bebidas',
  'Otros'
];

const VALID_UNITS = [
  'unidad(es)',
  'kg',
  'g',
  'L',
  'ml',
  'porción(es)',
  'caja(s)',
  'paquete(s)',
  'botella(s)'
];

const VALID_LOCATIONS = [
  'Refrigerador',
  'Congelador',
  'Bodega seca',
  'Vitrina',
  'Otro'
];

const VALID_WASTE_REASONS = [
  'vencimiento',
  'deterioro',
  'rotura',
  'temperatura',
  'otro'
];

const VALID_ACTIONS = ['create', 'update', 'consume', 'discard', 'import'];

/**
 * Validates a Product document. Throws or returns validation report.
 * @param {object} p
 * @returns {{ valid: boolean; errors: string[] }}
 */
function validateProduct(p) {
  const errors = [];
  if (!p || typeof p !== 'object') {
    return { valid: false, errors: ['Product must be an object'] };
  }

  if (!p.id || typeof p.id !== 'string' || p.id.trim() === '') {
    errors.push('id is required and must be non-empty string');
  }
  if (!p.name || typeof p.name !== 'string' || p.name.trim() === '') {
    errors.push('name is required and must be non-empty string');
  }
  if (!VALID_CATEGORIES.includes(p.category)) {
    errors.push(`Invalid category: "${p.category}". Allowed: ${VALID_CATEGORIES.join(', ')}`);
  }
  if (typeof p.quantity !== 'number' || !Number.isFinite(p.quantity) || p.quantity < 0) {
    errors.push('quantity must be a non-negative number');
  }
  if (!VALID_UNITS.includes(p.unit)) {
    errors.push(`Invalid unit: "${p.unit}". Allowed: ${VALID_UNITS.join(', ')}`);
  }
  const expiry = p.expiryDate || p.expiry;
  if (!expiry || typeof expiry !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    errors.push('expiryDate must be in YYYY-MM-DD format');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Factory for creating a compliant Product object with defaults and audit metadata.
 * @param {object} data
 * @param {string} operator
 * @returns {object}
 */
function createProduct(data, operator = 'Operador') {
  const now = new Date().toISOString();
  const id = data.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const cleanOperator = (operator || 'Operador').trim() || 'Operador';

  const product = {
    id,
    name: (data.name || '').trim(),
    category: data.category || 'Otros',
    quantity: Number(data.quantity) >= 0 ? Number(data.quantity) : 0,
    unit: data.unit || 'unidad(es)',
    receivedDate: data.receivedDate || data.received || now.slice(0, 10),
    expiryDate: data.expiryDate || data.expiry || now.slice(0, 10),
    location: data.location || 'Refrigerador',
    lot: data.lot ? String(data.lot).trim() : '',
    supplier: data.supplier ? String(data.supplier).trim() : '',
    barcode: data.barcode ? String(data.barcode).trim() : '',
    notes: data.notes ? String(data.notes).trim() : '',
    isDiscarded: Boolean(data.isDiscarded),
    isConsumed: Boolean(data.isConsumed),
    createdAt: data.createdAt || now,
    createdBy: data.createdBy || cleanOperator,
    updatedAt: data.updatedAt || now,
    updatedBy: cleanOperator,
    lastAction: data.lastAction || 'create'
  };

  const validation = validateProduct(product);
  if (!validation.valid) {
    throw new Error(`Product validation failed: ${validation.errors.join('; ')}`);
  }
  return product;
}

/**
 * Validates a HistoryLog document.
 * @param {object} log
 * @returns {{ valid: boolean; errors: string[] }}
 */
function validateHistoryLog(log) {
  const errors = [];
  if (!log || typeof log !== 'object') {
    return { valid: false, errors: ['HistoryLog must be an object'] };
  }
  if (!log.id || typeof log.id !== 'string') {
    errors.push('id is required');
  }
  if (!log.timestamp || typeof log.timestamp !== 'string') {
    errors.push('timestamp is required');
  }
  if (!log.operator || typeof log.operator !== 'string' || log.operator.trim() === '') {
    errors.push('operator is required');
  }
  if (!VALID_ACTIONS.includes(log.action)) {
    errors.push(`Invalid action: "${log.action}". Allowed: ${VALID_ACTIONS.join(', ')}`);
  }
  if (!log.productId || typeof log.productId !== 'string') {
    errors.push('productId is required');
  }
  if (log.action === 'discard') {
    if (!log.reason || !VALID_WASTE_REASONS.includes(log.reason)) {
      errors.push(`Valid reason is required for discard action. Allowed: ${VALID_WASTE_REASONS.join(', ')}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  VALID_CATEGORIES,
  VALID_UNITS,
  VALID_LOCATIONS,
  VALID_WASTE_REASONS,
  VALID_ACTIONS,
  validateProduct,
  createProduct,
  validateHistoryLog
};
