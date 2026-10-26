/**
 * Domain Waste & Atomic Stock Decrement Reference Oracle
 * Authoritative source: ORIGINAL_REQUEST.md § R1, R3, PROJECT.md § Interface Contracts
 */

const { VALID_WASTE_REASONS } = require('./models');

/**
 * Safely subtracts floating point quantities avoiding JS IEEE 754 precision issues.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function safeSubtract(a, b) {
  const factor = 100000;
  return Math.round((a - b) * factor) / factor;
}

/**
 * Safely adds floating point quantities.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function safeAdd(a, b) {
  const factor = 100000;
  return Math.round((a + b) * factor) / factor;
}

/**
 * Atomically consumes stock for a product.
 * - Rejects if amount <= 0 or amount > product.quantity.
 * - Decrements quantity.
 * - If remaining quantity === 0, sets isConsumed: true.
 * - Returns updated product copy and HistoryLog.
 *
 * @param {object} product
 * @param {number} amount
 * @param {string} operator
 * @param {string} [reason]
 * @returns {{ product: object; log: object }}
 */
function consumeStock(product, amount, operator, reason = '') {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    throw new Error(`Invalid consumption amount: ${amount}. Must be > 0.`);
  }
  if (product.isDiscarded) {
    throw new Error('Cannot consume discarded product');
  }
  if (product.isConsumed || product.quantity <= 0) {
    throw new Error('Cannot consume: product has 0 available quantity');
  }
  if (amount > product.quantity) {
    throw new Error(`Insufficient stock: requested ${amount}, available ${product.quantity}`);
  }

  const remainingQty = safeSubtract(product.quantity, amount);
  const now = new Date().toISOString();
  const cleanOperator = (operator || 'Operador').trim() || 'Operador';

  const updatedProduct = {
    ...product,
    quantity: remainingQty,
    isConsumed: remainingQty === 0,
    updatedAt: now,
    updatedBy: cleanOperator,
    lastAction: 'consume'
  };

  const log = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: now,
    operator: cleanOperator,
    action: 'consume',
    productId: product.id,
    productName: product.name,
    amount,
    unit: product.unit,
    reason: reason || 'Consumo operacional'
  };

  return { product: updatedProduct, log };
}

/**
 * Discards stock due to waste (merma).
 * - Validates reason against HACCP allowed reasons.
 * - Marks isDiscarded: true.
 * - Returns updated product copy and HistoryLog.
 *
 * @param {object} product
 * @param {string} reason - 'vencimiento' | 'deterioro' | 'rotura' | 'temperatura' | 'otro'
 * @param {string} operator
 * @returns {{ product: object; log: object }}
 */
function discardStock(product, reason, operator) {
  if (!VALID_WASTE_REASONS.includes(reason)) {
    throw new Error(`Invalid waste reason: "${reason}". Allowed: ${VALID_WASTE_REASONS.join(', ')}`);
  }
  if (product.isDiscarded) {
    throw new Error('Product is already discarded');
  }

  const now = new Date().toISOString();
  const cleanOperator = (operator || 'Operador').trim() || 'Operador';

  const updatedProduct = {
    ...product,
    isDiscarded: true,
    updatedAt: now,
    updatedBy: cleanOperator,
    lastAction: 'discard'
  };

  const log = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: now,
    operator: cleanOperator,
    action: 'discard',
    productId: product.id,
    productName: product.name,
    amount: product.quantity,
    unit: product.unit,
    reason
  };

  return { product: updatedProduct, log };
}

/**
 * Undoes a 1-tap consumption action within the undo window.
 * - Restores product quantity by adding back the consumed amount.
 * - Resets isConsumed to false if quantity > 0.
 *
 * @param {object} product
 * @param {number} amount
 * @param {string} operator
 * @returns {{ product: object; log: object }}
 */
function undoConsumption(product, amount, operator) {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    throw new Error(`Invalid undo amount: ${amount}`);
  }

  const restoredQty = safeAdd(product.quantity, amount);
  const now = new Date().toISOString();
  const cleanOperator = (operator || 'Operador').trim() || 'Operador';

  const updatedProduct = {
    ...product,
    quantity: restoredQty,
    isConsumed: false,
    updatedAt: now,
    updatedBy: cleanOperator,
    lastAction: 'undo_consume'
  };

  const log = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: now,
    operator: cleanOperator,
    action: 'update',
    productId: product.id,
    productName: product.name,
    amount,
    unit: product.unit,
    reason: 'Deshacer consumo (Undo)'
  };

  return { product: updatedProduct, log };
}

module.exports = {
  safeSubtract,
  safeAdd,
  consumeStock,
  discardStock,
  undoConsumption
};
