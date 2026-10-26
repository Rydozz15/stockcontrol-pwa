/**
 * Multi-Tenant Workspace & Audit Trail Simulator
 * Authoritative source: ORIGINAL_REQUEST.md § R1, PROJECT.md § Feature 7, 8
 */

const { createProduct } = require('./models');
const { consumeStock, discardStock } = require('./waste');

/**
 * Normalizes a workspace code: trims, lowercases, replaces spaces/special chars with hyphens.
 * @param {string} raw
 * @returns {string}
 */
function normalizeWorkspaceId(raw) {
  if (!raw || typeof raw !== 'string') return 'cocina-principal';
  const clean = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || 'cocina-principal';
}

/**
 * Simulates multi-tenant Firestore repository in-memory.
 */
class InMemoryWorkspaceRepository {
  constructor() {
    /** @type {Map<string, Map<string, object>>} workspaceId -> (productId -> product) */
    this.storage = new Map();
    /** @type {Map<string, Array<object>>} workspaceId -> HistoryLog[] */
    this.history = new Map();
    /** @type {Map<string, Set<Function>>} workspaceId -> Set<callback> */
    this.listeners = new Map();
  }

  _getWorkspaceMap(workspaceId) {
    const ws = normalizeWorkspaceId(workspaceId);
    if (!this.storage.has(ws)) {
      this.storage.set(ws, new Map());
      this.history.set(ws, []);
      this.listeners.set(ws, new Set());
    }
    return this.storage.get(ws);
  }

  _notify(workspaceId, hasPendingWrites = false) {
    const ws = normalizeWorkspaceId(workspaceId);
    const map = this._getWorkspaceMap(ws);
    const products = Array.from(map.values());
    const listeners = this.listeners.get(ws) || new Set();
    for (const cb of listeners) {
      cb([...products], hasPendingWrites);
    }
  }

  /**
   * Subscribes to real-time product updates for a workspace.
   * @param {string} workspaceId
   * @param {Function} onData - (products: Product[], hasPendingWrites: boolean) => void
   * @returns {Function} unsubscribe
   */
  subscribeProducts(workspaceId, onData) {
    const ws = normalizeWorkspaceId(workspaceId);
    this._getWorkspaceMap(ws);
    const set = this.listeners.get(ws);
    set.add(onData);
    // Initial emit
    onData(Array.from(this.storage.get(ws).values()), false);
    return () => {
      set.delete(onData);
    };
  }

  /**
   * Adds or registers a product in a workspace.
   * @param {string} workspaceId
   * @param {object} productData
   * @param {string} operator
   * @returns {Promise<string>} productId
   */
  async createProduct(workspaceId, productData, operator) {
    const ws = normalizeWorkspaceId(workspaceId);
    const map = this._getWorkspaceMap(ws);
    const product = createProduct(productData, operator);
    map.set(product.id, product);

    const cleanOp = (operator || '').trim() || 'Operador';
    const log = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      operator: cleanOp,
      action: 'create',
      productId: product.id,
      productName: product.name,
      amount: product.quantity,
      unit: product.unit,
      reason: 'Alta de producto'
    };
    this.history.get(ws).push(log);
    this._notify(ws);
    return product.id;
  }

  /**
   * Updates an existing product.
   * @param {string} workspaceId
   * @param {string} id
   * @param {object} updates
   * @param {string} operator
   */
  async updateProduct(workspaceId, id, updates, operator) {
    const ws = normalizeWorkspaceId(workspaceId);
    const map = this._getWorkspaceMap(ws);
    const existing = map.get(id);
    if (!existing) throw new Error(`Product ${id} not found in workspace ${ws}`);

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: operator || 'Operador',
      lastAction: 'update'
    };
    map.set(id, updated);
    this._notify(ws);
  }

  /**
   * Consumes stock atomically.
   */
  async consumeStock(workspaceId, id, amount, operator, reason = '') {
    const ws = normalizeWorkspaceId(workspaceId);
    const map = this._getWorkspaceMap(ws);
    const existing = map.get(id);
    if (!existing) throw new Error(`Product ${id} not found in workspace ${ws}`);

    const { product: updated, log } = consumeStock(existing, amount, operator, reason);
    map.set(id, updated);
    this.history.get(ws).push(log);
    this._notify(ws);
    return log;
  }

  /**
   * Discards stock with waste reason.
   */
  async discardStock(workspaceId, id, reason, operator) {
    const ws = normalizeWorkspaceId(workspaceId);
    const map = this._getWorkspaceMap(ws);
    const existing = map.get(id);
    if (!existing) throw new Error(`Product ${id} not found in workspace ${ws}`);

    const { product: updated, log } = discardStock(existing, reason, operator);
    map.set(id, updated);
    this.history.get(ws).push(log);
    this._notify(ws);
    return log;
  }

  /**
   * Gets history logs for workspace.
   * @param {string} workspaceId
   * @param {number} [limit]
   * @returns {Array<object>}
   */
  getHistory(workspaceId, limit = 50) {
    const ws = normalizeWorkspaceId(workspaceId);
    const logs = this.history.get(ws) || [];
    return [...logs].reverse().slice(0, limit);
  }
}

module.exports = {
  normalizeWorkspaceId,
  InMemoryWorkspaceRepository
};
