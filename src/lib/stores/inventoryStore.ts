/**
 * StockControl PWA — Reactive Inventory Store & Workspace Synchronization
 * Clean Architecture Reactive Store Layer
 * Path: src/lib/stores/inventoryStore.ts
 *
 * Manages active inventory items, local search/filter state, and reactive
 * Firestore snapshot listener synchronization across multi-tenant workspaces.
 */

import { writable, derived, get } from 'svelte/store';
import type { Product } from '$lib/domain/models';
import { workspaceStore } from './workspaceStore';
import { connectivityStore } from './connectivityStore';
import type { IProductRepository } from '$lib/repositories/productRepository';
import { productRepository } from '$lib/repositories/productRepository';

export type ProductItem = Partial<Product> & {
  id: string;
  name: string;
  quantity: number;
  expiryDate: string;
  isDiscarded?: boolean;
  isConsumed?: boolean;
};

export interface InventoryState {
  products: ProductItem[];
  loading: boolean;
  error: string | null;
  hasPendingWrites: boolean;
  activeWorkspaceId: string;
  filterCategory: string | null;
  filterLocation: string | null;
  searchQuery: string;
  sortBy: 'expiryDate' | 'name' | 'quantity';
  sortOrder: 'asc' | 'desc';
}

function createInventoryStore() {
  const { subscribe, set, update } = writable<InventoryState>({
    products: [],
    loading: false,
    error: null,
    hasPendingWrites: false,
    activeWorkspaceId: '',
    filterCategory: null,
    filterLocation: null,
    searchQuery: '',
    sortBy: 'expiryDate',
    sortOrder: 'asc'
  });

  return {
    subscribe,
    setProducts(products: ProductItem[], hasPendingWrites = false): void {
      update(s => ({ ...s, products, hasPendingWrites, loading: false, error: null }));
    },
    setLoading(loading: boolean): void {
      update(s => ({ ...s, loading }));
    },
    setError(error: string | null): void {
      update(s => ({ ...s, error, loading: false }));
    },
    setActiveWorkspaceId(activeWorkspaceId: string): void {
      update(s => ({ ...s, activeWorkspaceId }));
    },
    addProduct(product: ProductItem): void {
      update(s => ({
        ...s,
        products: [product, ...s.products.filter(p => p.id !== product.id)]
      }));
    },
    updateProduct(id: string, updates: Partial<ProductItem>): void {
      update(s => ({
        ...s,
        products: s.products.map(p => (p.id === id ? { ...p, ...updates } : p))
      }));
    },
    consumeOne(id: string): { previousQuantity: number } | null {
      let result: { previousQuantity: number } | null = null;
      update(s => ({
        ...s,
        products: s.products.map(p => {
          if (p.id === id) {
            result = { previousQuantity: p.quantity };
            const nextQty = Math.max(0, p.quantity - 1);
            return {
              ...p,
              quantity: nextQty,
              isConsumed: nextQty === 0
            };
          }
          return p;
        })
      }));
      return result;
    },
    removeProduct(id: string): void {
      update(s => ({
        ...s,
        products: s.products.filter(p => p.id !== id)
      }));
    },
    setFilterCategory(category: string | null): void {
      update(s => ({ ...s, filterCategory: category }));
    },
    setFilterLocation(location: string | null): void {
      update(s => ({ ...s, filterLocation: location }));
    },
    setSearchQuery(searchQuery: string): void {
      update(s => ({ ...s, searchQuery }));
    },
    setPendingWrites(hasPendingWrites: boolean): void {
      update(s => ({ ...s, hasPendingWrites }));
    },
    setSort(sortBy: 'expiryDate' | 'name' | 'quantity', sortOrder: 'asc' | 'desc' = 'asc'): void {
      update(s => ({ ...s, sortBy, sortOrder }));
    },
    reset(): void {
      set({
        products: [],
        loading: false,
        error: null,
        hasPendingWrites: false,
        activeWorkspaceId: '',
        filterCategory: null,
        filterLocation: null,
        searchQuery: '',
        sortBy: 'expiryDate',
        sortOrder: 'asc'
      });
    }
  };
}

export const inventoryStore = createInventoryStore();

export const filteredProducts = derived(inventoryStore, ($inv) => {
  let list = $inv.products.filter(p => !p.isDiscarded && !p.isConsumed && (p.quantity ?? 0) > 0);

  if ($inv.filterCategory) {
    list = list.filter(p => p.category === $inv.filterCategory);
  }
  if ($inv.filterLocation) {
    list = list.filter(p => p.location === $inv.filterLocation);
  }
  if ($inv.searchQuery.trim().length > 0) {
    const q = $inv.searchQuery.trim().toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.lot && p.lot.toLowerCase().includes(q))
    );
  }

  return list.sort((a, b) => {
    if ($inv.sortBy === 'expiryDate') {
      const cmp = (a.expiryDate || '').localeCompare(b.expiryDate || '');
      return $inv.sortOrder === 'asc' ? cmp : -cmp;
    }
    if ($inv.sortBy === 'name') {
      const cmp = a.name.localeCompare(b.name);
      return $inv.sortOrder === 'asc' ? cmp : -cmp;
    }
    if ($inv.sortBy === 'quantity') {
      return $inv.sortOrder === 'asc' ? a.quantity - b.quantity : b.quantity - a.quantity;
    }
    return 0;
  });
});

/**
 * Internal reference to active Firestore listener unsubscribe function
 */
let currentFirestoreUnsubscribe: (() => void) | null = null;
let currentSubscribedWorkspace: string = '';

/**
 * Subscribes to products collection for a specific workspace in Firestore.
 * Automatically unsubscribes any prior workspace listener.
 * Returns an unsubscribe teardown function.
 */
export function subscribeToWorkspace(
  workspaceId: string,
  repo: IProductRepository = productRepository
): () => void {
  // If already listening to this workspace, return current teardown
  if (currentFirestoreUnsubscribe && currentSubscribedWorkspace === workspaceId) {
    return () => {
      if (currentFirestoreUnsubscribe) {
        currentFirestoreUnsubscribe();
        currentFirestoreUnsubscribe = null;
        currentSubscribedWorkspace = '';
      }
    };
  }

  // Teardown previous listener
  if (currentFirestoreUnsubscribe) {
    currentFirestoreUnsubscribe();
    currentFirestoreUnsubscribe = null;
    currentSubscribedWorkspace = '';
  }

  if (!workspaceId || workspaceId.trim().length === 0) {
    inventoryStore.setProducts([], false);
    inventoryStore.setActiveWorkspaceId('');
    return () => {};
  }

  currentSubscribedWorkspace = workspaceId.trim();
  inventoryStore.setActiveWorkspaceId(currentSubscribedWorkspace);
  inventoryStore.setLoading(true);

  const unsubscribe = repo.subscribeProducts(
    currentSubscribedWorkspace,
    (products, hasPendingWrites) => {
      inventoryStore.setProducts(products, hasPendingWrites);
      connectivityStore.setPendingWrites(hasPendingWrites);
    },
    (err) => {
      console.error(`[inventoryStore] Firestore listener error for ${currentSubscribedWorkspace}:`, err);
      inventoryStore.setError(err.message || 'Error de sincronización con Firestore');
      connectivityStore.setPendingWrites(false);
    }
  );

  currentFirestoreUnsubscribe = unsubscribe;

  return () => {
    if (currentFirestoreUnsubscribe === unsubscribe) {
      unsubscribe();
      currentFirestoreUnsubscribe = null;
      currentSubscribedWorkspace = '';
    }
  };
}

/**
 * Initiates reactive workspace synchronization.
 * Observes workspaceStore and switches Firestore listeners whenever workspaceId changes.
 * Returns a composite teardown function to be called on component unmount.
 */
export function initWorkspaceSync(
  repo: IProductRepository = productRepository
): () => void {
  let activeWsId = '';

  const unsubWorkspace = workspaceStore.subscribe((session) => {
    const nextWsId = session.workspaceId;
    if (nextWsId !== activeWsId) {
      activeWsId = nextWsId;
      subscribeToWorkspace(nextWsId, repo);
    }
  });

  return () => {
    unsubWorkspace();
    if (currentFirestoreUnsubscribe) {
      currentFirestoreUnsubscribe();
      currentFirestoreUnsubscribe = null;
      currentSubscribedWorkspace = '';
    }
  };
}

/**
 * Asynchronous action helpers that automatically pull current workspace and operator alias
 */
export async function consumeStockAction(
  productId: string,
  amount = 1,
  reason = 'Consumo en servicio',
  repo: IProductRepository = productRepository
): Promise<void> {
  const ws = get(workspaceStore);
  connectivityStore.setSyncing(true);
  try {
    await repo.consumeStock(ws.workspaceId, productId, amount, ws.operatorAlias, reason);
  } finally {
    connectivityStore.setSyncing(false);
  }
}

export async function discardStockAction(
  productId: string,
  reason: string,
  repo: IProductRepository = productRepository
): Promise<void> {
  const ws = get(workspaceStore);
  connectivityStore.setSyncing(true);
  try {
    await repo.discardStock(ws.workspaceId, productId, reason, ws.operatorAlias);
  } finally {
    connectivityStore.setSyncing(false);
  }
}

export async function createProductAction(
  product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  repo: IProductRepository = productRepository
): Promise<string> {
  const ws = get(workspaceStore);
  connectivityStore.setSyncing(true);
  try {
    const id = await repo.createProduct(ws.workspaceId, {
      ...product,
      createdBy: ws.operatorAlias,
      updatedBy: ws.operatorAlias
    });
    return id;
  } finally {
    connectivityStore.setSyncing(false);
  }
}

export async function updateProductAction(
  productId: string,
  updates: Partial<Product>,
  repo: IProductRepository = productRepository
): Promise<void> {
  const ws = get(workspaceStore);
  connectivityStore.setSyncing(true);
  try {
    await repo.updateProduct(ws.workspaceId, productId, updates, ws.operatorAlias);
  } finally {
    connectivityStore.setSyncing(false);
  }
}
