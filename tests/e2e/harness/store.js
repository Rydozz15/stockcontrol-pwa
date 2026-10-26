/**
 * Svelte Reactive Store Simulator & Contract Verifier
 * Authoritative source: ORIGINAL_REQUEST.md § R2, PROJECT.md § Feature 4
 */

const { calculateMetrics } = require('./expiry');

/**
 * Creates a writable store adhering to the Svelte Store contract.
 * @param {any} initialValue
 * @returns {object}
 */
function writable(initialValue) {
  let value = initialValue;
  const subscribers = new Set();

  function subscribe(run) {
    subscribers.add(run);
    run(value);
    return function unsubscribe() {
      subscribers.delete(run);
    };
  }

  function set(newValue) {
    if (value !== newValue) {
      value = newValue;
      for (const run of [...subscribers]) {
        run(value);
      }
    }
  }

  function update(updater) {
    set(updater(value));
  }

  function get() {
    return value;
  }

  return { subscribe, set, update, get, subscriberCount: () => subscribers.size };
}

/**
 * Creates a derived store from one or more stores.
 * @param {object | object[]} stores
 * @param {Function} fn
 * @returns {object}
 */
function derived(stores, fn) {
  const isArray = Array.isArray(stores);
  const storeList = isArray ? stores : [stores];

  return {
    subscribe(run) {
      const values = new Array(storeList.length);
      const unsubs = storeList.map((store, i) =>
        store.subscribe(val => {
          values[i] = val;
          const result = isArray ? fn(values) : fn(val);
          run(result);
        })
      );
      return () => unsubs.forEach(u => u());
    }
  };
}

/**
 * Factory for workspaceStore.
 * @param {{ workspaceId: string; operator: string }} [initial]
 */
function createWorkspaceStore(initial = { workspaceId: 'cocina-principal', operator: 'Operador 1' }) {
  const store = writable(initial);
  return {
    ...store,
    setWorkspace(workspaceId) {
      store.update(s => ({ ...s, workspaceId: String(workspaceId).trim().toLowerCase() }));
    },
    setOperator(operator) {
      store.update(s => ({ ...s, operator: String(operator).trim() }));
    }
  };
}

/**
 * Factory for connectivityStore.
 * @param {{ isOnline: boolean; pendingWrites: number }} [initial]
 */
function createConnectivityStore(initial = { isOnline: true, pendingWrites: 0 }) {
  const store = writable(initial);
  return {
    ...store,
    setOnline(isOnline) {
      store.update(s => ({ ...s, isOnline: Boolean(isOnline) }));
    },
    incrementPending() {
      store.update(s => ({ ...s, pendingWrites: s.pendingWrites + 1 }));
    },
    decrementPending() {
      store.update(s => ({ ...s, pendingWrites: Math.max(0, s.pendingWrites - 1) }));
    },
    clearPending() {
      store.update(s => ({ ...s, pendingWrites: 0 }));
    }
  };
}

/**
 * Factory for toastStore.
 */
function createToastStore() {
  const store = writable(null);
  let timeoutId = null;

  return {
    ...store,
    show(message, type = 'info', duration = 3000, action = null) {
      if (timeoutId) clearTimeout(timeoutId);
      store.set({ message, type, duration, action, id: Date.now() });
      if (duration > 0) {
        timeoutId = setTimeout(() => {
          store.set(null);
          timeoutId = null;
        }, duration);
      }
    },
    dismiss() {
      if (timeoutId) clearTimeout(timeoutId);
      store.set(null);
      timeoutId = null;
    }
  };
}

/**
 * Factory for inventoryStore.
 * @param {Array<object>} [initialProducts]
 */
function createInventoryStore(initialProducts = []) {
  const rawStore = writable(initialProducts);
  const filterStore = writable({ search: '', category: '', status: '' });

  return {
    ...rawStore,
    filters: filterStore,
    setFilter(key, val) {
      filterStore.update(f => ({ ...f, [key]: val }));
    },
    resetFilters() {
      filterStore.set({ search: '', category: '', status: '' });
    },
    addProduct(product) {
      rawStore.update(list => [...list, product]);
    },
    updateProduct(id, updates) {
      rawStore.update(list => list.map(p => (p.id === id ? { ...p, ...updates } : p)));
    },
    removeProduct(id) {
      rawStore.update(list => list.filter(p => p.id !== id));
    }
  };
}

/**
 * Factory for metricsStore derived from an inventoryStore.
 * @param {object} inventoryStore
 * @param {Date | string} [todayRef]
 */
function createMetricsStore(inventoryStore, todayRef = new Date()) {
  return derived(inventoryStore, products => calculateMetrics(products, todayRef));
}

module.exports = {
  writable,
  derived,
  createWorkspaceStore,
  createConnectivityStore,
  createToastStore,
  createInventoryStore,
  createMetricsStore
};
