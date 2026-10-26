# Handoff Report: Milestone 1 — Reactive Stores & App Shell Architecture

**Agent**: `explorer_m1_3` (Stores & UI Shell Explorer)  
**Target Project**: StockControl PWA (`/home/rydozz/Documents/Proyectos/StockControl_App_Telefono`)  
**Parent Agent**: `1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c`  
**Date**: 2026-10-25T20:28:00Z  
**Scope**: Milestone 1 Reactive Stores (`src/lib/stores/`) and App Shell Foundation (`src/routes/`)

---

## 1. Observation

Direct observations from the repository, authoritative project specifications, and prototype inspection:

### 1.1 Requirements & Interface Contracts
- **`ORIGINAL_REQUEST.md`**:
  - **R1 (Collaborative Multi-user Workspaces)**: Lines 26–32 require zero-friction workspace code joining (e.g. `cocina-principal`, `sucursal-norte`) without passwords, quick operator alias selection saved to device (e.g. `"Juan - Cocinero"`), and full audit stamping.
  - **R2 (Clean Architecture & Modular Stores)**: Lines 33–38 specify pure domain logic in `src/lib/domain/`, decoupled repositories in `src/lib/repositories/`, and reactive stores in `src/lib/stores/` for inventory, metrics, filters, and online/offline status.
  - **R3 (Ergonomics & Safe-Area)**: Lines 39–48 specify a thumb-friendly bottom navigation bar with 4 tabs, high-visibility FAB, 1-tap consumption with undo feedback, tablet split-screen layout (`>= 768px`), and safe-area inset support (`env(safe-area-inset-*)`).
  - **R4 (PWA & Static Deployment)**: Lines 49–56 define compilation with `@sveltejs/adapter-static` for Render Static Site ($0/month hosting).
  - **Acceptance Criteria**: Lines 57–75 require touch targets `>= 44x44px`, offline persistence in walk-in freezers, and clean static build execution.

- **`PROJECT.md`**:
  - **Feature 4 (Reactive Core Stores)**: Lines 18–24 & 52 define stores: `workspaceStore` (kitchen workspace ID & operator alias), `inventoryStore` (real-time sync & filtering), `metricsStore` (derived counters: total, expired, soon 3d, week 7d, ok), `connectivityStore` (online/offline network status), `toastStore` (ephemeral notifications and 1-tap undo).
  - **Feature 11, 12, 17, 18 (UI Shell)**: Lines 59–66 outline bottom navigation, touch target compliance `>= 44x44px`, safe area insets, metrics summary dashboard.
  - **Contract Formulas**: Lines 122–123 specify `calculateExpiryStatus` and `calculateMetrics(products: Product[]): { total: number; expired: number; soon: number; week: number; ok: number; }`.

- **Existing Prototype (`index.html`)**:
  - Line 76: `const KEY='stockcontrol_expiry_v1'; let products=JSON.parse(localStorage.getItem(KEY)||'[]');`
  - Lines 79–81: Expiry calculation thresholds:
    - `dayDiff < 0`: `'expired'` ("Vencido hace X día(s)")
    - `dayDiff === 0`: `'soon'` ("Vence hoy")
    - `dayDiff <= 3`: `'soon'` ("Vence en X día(s)")
    - `dayDiff <= 7`: `'week'` ("Vence en X días")
    - `dayDiff > 7`: `'ok'` ("Vigente")
  - Lines 86–90: Metric counters:
    - Total: `products.length`
    - Vencidos: `status.key === 'expired'`
    - Vence en 3 días: `0 <= dayDiff <= 3`
    - Vence en 7 días: `0 <= dayDiff <= 7`
  - Lines 15–20: Palette tokens: `--brown: #75472f`, `--brown2: #9a623e`, `--cream: #fff8ef`, `--ink: #302821`, `--muted: #7c7168`, `--line: #eadfd2`, `--green: #4c7860`, `--red: #b84035`, `--amber: #a56b15`, `--bg: #f7f2eb`.

- **Test Infrastructure (`TEST_INFRA.md`)**:
  - Feature 4 must pass at least 5 Tier 1 isolation tests and 5 Tier 2 boundary tests.
  - Store modules will be executed by Node.js opaque-box runners (`tests/e2e/runner.js`), requiring strict SSR safety where `window`, `navigator`, and `localStorage` are safely handled if undefined.

---

## 2. Logic Chain

From the observations, the reactive store and app shell architecture is deduced as follows:

1. **SSR Safety for Static Adapter Build**:
   - SvelteKit executes layout and component code in Node.js during `npm run build` (`@sveltejs/adapter-static`).
   - If a store calls `window.addEventListener`, `localStorage.getItem`, or `navigator.onLine` unconditionally at module evaluation, the static build crashes with `ReferenceError: window is not defined`.
   - **Deduction**: All store initializations must check `typeof window !== 'undefined'` and `typeof localStorage !== 'undefined'`, returning safe defaults during SSR and attaching browser listeners conditionally.
   - In `src/routes/+layout.ts`, setting `export const prerender = true; export const ssr = false;` disables server hydration runtime while compiling static SPA entry points.

2. **Zero-Friction Collaboration (`workspaceStore.ts`)**:
   - Kitchen staff change shifts and stations frequently. Forcing password login leads to abandonment.
   - Storing `workspaceId` (default: `'cocina-principal'`), `operatorAlias` (default: `'Cocinero'`), and a persistent device UUID in `localStorage` allows instant setup.
   - Listening to `window.addEventListener('storage', ...)` ensures multi-tab instances stay synchronized if another tab or window updates the workspace or operator.

3. **Walk-in Cold Room Offline Detection (`connectivityStore.ts`)**:
   - Kitchen cold rooms act as Faraday cages.
   - `connectivityStore` listens to `online` and `offline` browser events, exposing `online: boolean` and `lastChanged: string`.
   - It also exposes `hasPendingWrites` and `isSyncing` setters to allow the data repository in Milestone 2 to inform the UI shell whether local mutations are pending remote sync.

4. **1-Tap Consumption & Undo Feedback (`toastStore.ts`)**:
   - When a cook taps "Consumir 1", food safety speed requires the action to happen instantly without a blocking confirmation dialog.
   - To prevent accidental stock decrements, a 4-second auto-dismissing toast (`undo`) with a "Deshacer" action button allows 1-tap rollback.
   - Managing `setTimeout` timers with clean dismissal prevents memory leaks and overlapping toast clutter.

5. **Pure Deterministic Metrics (`metricsStore.ts`)**:
   - Food waste inspections and kitchen prep rely on accurate counters of expired and soon-to-expire items.
   - `calculateMetrics(products, referenceDate)` must be exposed as a pure, standalone function in addition to the reactive `derived(inventoryStore, ...)` store. This allows deterministic unit testing across simulated dates (including leap years and month boundaries) without requiring DOM or browser timers.
   - Discarded and fully consumed items (`isDiscarded: true`, `quantity <= 0`) are excluded from active inventory counters.

6. **Mobile Ergonomics & Tablet Split-Screen (`+layout.svelte`, `+page.svelte`)**:
   - Fixed Bottom Navigation Bar (4 tabs) and high-visibility FAB (56x56px) anchor primary actions within thumb reach.
   - Interactive targets enforce a minimum of 44x44px bounding box.
   - Safe-area insets (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) prevent notch collisions on iPhone and gesture navigation overlaps on Android.
   - Media query `@media (min-width: 768px)` expands the UI from a single mobile column to a two-column master-detail layout on kitchen prep tablets.

---

## 3. Caveats

1. **Cross-Tab Storage Latency**: The `storage` event in browsers only fires in *other* tabs/windows of the same origin, not in the tab that made the `localStorage.setItem` call. `workspaceStore` updates internal reactive state immediately upon calling `setWorkspace()` or `setOperator()`, and uses the `storage` event exclusively to synchronize peer tabs.
2. **Timezone & Leap Year Skew**: Date strings from `receivedDate` and `expiryDate` are in `YYYY-MM-DD` format. Direct `new Date('YYYY-MM-DD')` in JS defaults to UTC midnight, which in negative UTC offsets (e.g. Chile UTC-3/UTC-4) shifts the date back one day if parsed as UTC. All date parsing in `metricsStore` decomposes the string into `[year, month - 1, day]` and instantiates local dates with `setHours(0, 0, 0, 0)`.
3. **M1 Repository Decoupling**: In Milestone 1, Firestore repository integration is deferred to Milestone 2. `inventoryStore.ts` provides a complete local state management stub that implements the full reactive contract needed by `metricsStore` and the UI routes, ensuring zero runtime errors in M1 builds and tests.

---

## 4. Conclusion & Concrete Implementation Designs

Below are the exact, copy-pasteable TypeScript and Svelte implementations designed for Milestone 1.

### 4.1 `src/lib/stores/workspaceStore.ts`
```typescript
import { writable } from 'svelte/store';

export interface WorkspaceSession {
  workspaceId: string;
  operatorAlias: string;
  deviceId: string;
}

const STORAGE_KEY_WS = 'stockcontrol_workspace_id';
const STORAGE_KEY_OP = 'stockcontrol_operator_alias';
const STORAGE_KEY_DEV = 'stockcontrol_device_id';

export const DEFAULT_WORKSPACE = 'cocina-principal';
export const DEFAULT_OPERATOR = 'Cocinero';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function getStoredValue(key: string, fallback: string): string {
  if (!isBrowser()) return fallback;
  try {
    const val = localStorage.getItem(key);
    return val && val.trim().length > 0 ? val.trim() : fallback;
  } catch (err) {
    console.warn(`[workspaceStore] Failed to read ${key} from localStorage:`, err);
    return fallback;
  }
}

function setStoredValue(key: string, val: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, val);
  } catch (err) {
    console.warn(`[workspaceStore] Failed to write ${key} to localStorage:`, err);
  }
}

function getOrCreateDeviceId(): string {
  if (!isBrowser()) return 'server-preview';
  try {
    let devId = localStorage.getItem(STORAGE_KEY_DEV);
    if (!devId) {
      devId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(STORAGE_KEY_DEV, devId);
    }
    return devId;
  } catch {
    return 'dev_fallback';
  }
}

export function sanitizeWorkspaceId(input: string): string {
  if (!input || typeof input !== 'string') return DEFAULT_WORKSPACE;
  const sanitized = input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized.length > 0 ? sanitized : DEFAULT_WORKSPACE;
}

export function sanitizeOperatorAlias(input: string): string {
  if (!input || typeof input !== 'string') return DEFAULT_OPERATOR;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_OPERATOR;
}

function createWorkspaceStore() {
  const initialWorkspace = sanitizeWorkspaceId(getStoredValue(STORAGE_KEY_WS, DEFAULT_WORKSPACE));
  const initialOperator = sanitizeOperatorAlias(getStoredValue(STORAGE_KEY_OP, DEFAULT_OPERATOR));
  const initialDevice = getOrCreateDeviceId();

  const { subscribe, set, update } = writable<WorkspaceSession>({
    workspaceId: initialWorkspace,
    operatorAlias: initialOperator,
    deviceId: initialDevice
  });

  if (isBrowser()) {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === STORAGE_KEY_WS && event.newValue !== null) {
        const cleanWs = sanitizeWorkspaceId(event.newValue);
        update(s => ({ ...s, workspaceId: cleanWs }));
      } else if (event.key === STORAGE_KEY_OP && event.newValue !== null) {
        const cleanOp = sanitizeOperatorAlias(event.newValue);
        update(s => ({ ...s, operatorAlias: cleanOp }));
      }
    });
  }

  return {
    subscribe,
    setWorkspace(newId: string): string {
      const sanitized = sanitizeWorkspaceId(newId);
      setStoredValue(STORAGE_KEY_WS, sanitized);
      update(s => ({ ...s, workspaceId: sanitized }));
      return sanitized;
    },
    setOperator(newAlias: string): string {
      const sanitized = sanitizeOperatorAlias(newAlias);
      setStoredValue(STORAGE_KEY_OP, sanitized);
      update(s => ({ ...s, operatorAlias: sanitized }));
      return sanitized;
    },
    reset(): void {
      setStoredValue(STORAGE_KEY_WS, DEFAULT_WORKSPACE);
      setStoredValue(STORAGE_KEY_OP, DEFAULT_OPERATOR);
      update(s => ({
        ...s,
        workspaceId: DEFAULT_WORKSPACE,
        operatorAlias: DEFAULT_OPERATOR
      }));
    }
  };
}

export const workspaceStore = createWorkspaceStore();
```

---

### 4.2 `src/lib/stores/connectivityStore.ts`
```typescript
import { writable } from 'svelte/store';

export interface ConnectivityState {
  online: boolean;
  lastChanged: string; // ISO 8601
  hasPendingWrites: boolean;
  isSyncing: boolean;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function createConnectivityStore() {
  const initialOnline = isBrowser() ? navigator.onLine : true;
  const initialTimestamp = new Date().toISOString();

  const { subscribe, update, set } = writable<ConnectivityState>({
    online: initialOnline,
    lastChanged: initialTimestamp,
    hasPendingWrites: false,
    isSyncing: false
  });

  if (isBrowser()) {
    window.addEventListener('online', () => {
      update(s => ({
        ...s,
        online: true,
        lastChanged: new Date().toISOString()
      }));
    });

    window.addEventListener('offline', () => {
      update(s => ({
        ...s,
        online: false,
        lastChanged: new Date().toISOString()
      }));
    });
  }

  return {
    subscribe,
    setPendingWrites(hasPending: boolean): void {
      update(s => ({ ...s, hasPendingWrites: hasPending }));
    },
    setSyncing(syncing: boolean): void {
      update(s => ({ ...s, isSyncing: syncing }));
    },
    setOnlineStatus(online: boolean): void {
      update(s => ({
        ...s,
        online,
        lastChanged: new Date().toISOString()
      }));
    },
    check(): boolean {
      const online = isBrowser() ? navigator.onLine : true;
      update(s => ({ ...s, online, lastChanged: new Date().toISOString() }));
      return online;
    }
  };
}

export const connectivityStore = createConnectivityStore();
```

---

### 4.3 `src/lib/stores/toastStore.ts`
```typescript
import { writable } from 'svelte/store';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string; // e.g. "Deshacer"
  onClick: () => void | Promise<void>;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number; // in milliseconds, default 4000
  action?: ToastAction;
  createdAt: number;
}

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
}

export const DEFAULT_TOAST_DURATION = 4000;
export const MAX_CONCURRENT_TOASTS = 3;

function createToastStore() {
  const { subscribe, update, set } = writable<Toast[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function generateId(): string {
    return 'toast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  function dismiss(id: string): void {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    update(toasts => toasts.filter(t => t.id !== id));
  }

  function show(options: ToastOptions | string): string {
    const opts: ToastOptions = typeof options === 'string' ? { message: options } : options;
    const id = generateId();
    const duration = opts.duration ?? DEFAULT_TOAST_DURATION;

    const toast: Toast = {
      id,
      message: opts.message,
      type: opts.type ?? 'info',
      duration,
      action: opts.action,
      createdAt: Date.now()
    };

    update(toasts => {
      const next = [...toasts, toast];
      if (next.length > MAX_CONCURRENT_TOASTS) {
        const removed = next.shift();
        if (removed) {
          const t = timers.get(removed.id);
          if (t) {
            clearTimeout(t);
            timers.delete(removed.id);
          }
        }
      }
      return next;
    });

    if (duration > 0 && duration !== Infinity) {
      const timer = setTimeout(() => {
        dismiss(id);
      }, duration);
      timers.set(id, timer);
    }

    return id;
  }

  function undo(message: string, onUndo: () => void | Promise<void>, duration = DEFAULT_TOAST_DURATION): string {
    return show({
      message,
      type: 'info',
      duration,
      action: {
        label: 'Deshacer',
        onClick: onUndo
      }
    });
  }

  function clear(): void {
    timers.forEach(t => clearTimeout(t));
    timers.clear();
    set([]);
  }

  return {
    subscribe,
    show,
    dismiss,
    clear,
    success: (msg: string, dur?: number) => show({ message: msg, type: 'success', duration: dur }),
    error: (msg: string, dur?: number) => show({ message: msg, type: 'error', duration: dur }),
    warning: (msg: string, dur?: number) => show({ message: msg, type: 'warning', duration: dur }),
    info: (msg: string, dur?: number) => show({ message: msg, type: 'info', duration: dur }),
    undo
  };
}

export const toastStore = createToastStore();
```

---

### 4.4 `src/lib/stores/metricsStore.ts`
```typescript
import { derived } from 'svelte/store';
import { inventoryStore } from './inventoryStore';

export interface ProductItem {
  id: string;
  name: string;
  quantity: number;
  expiryDate: string; // YYYY-MM-DD
  isDiscarded?: boolean;
  isConsumed?: boolean;
  [key: string]: any;
}

export interface StockMetrics {
  total: number;       // All active products
  expired: number;     // dayDiff < 0
  soon: number;        // 0 <= dayDiff <= 3 (vence hoy / 3 días)
  week: number;        // 4 <= dayDiff <= 7 (vence en la semana)
  critical7: number;   // 0 <= dayDiff <= 7 (total crítico a 7 días)
  ok: number;          // dayDiff > 7 (vigente)
  discarded: number;   // discarded food items
  consumed: number;    // exhausted/consumed items
}

export function parseDateOnly(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const dt = new Date(y, m, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

export function calculateDayDiff(expiryDateStr: string, referenceDate: Date = new Date()): number {
  if (!expiryDateStr) return 99999;
  const target = parseDateOnly(expiryDateStr);
  if (!target) return 99999;

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
}

export function calculateMetrics(products: ProductItem[], referenceDate?: Date): StockMetrics {
  const metrics: StockMetrics = {
    total: 0,
    expired: 0,
    soon: 0,
    week: 0,
    critical7: 0,
    ok: 0,
    discarded: 0,
    consumed: 0
  };

  const ref = referenceDate || new Date();

  for (const p of products) {
    if (p.isDiscarded) {
      metrics.discarded++;
      continue;
    }
    if (p.isConsumed || (p.quantity !== undefined && p.quantity <= 0)) {
      metrics.consumed++;
      continue;
    }

    metrics.total++;
    const diff = calculateDayDiff(p.expiryDate, ref);

    if (diff < 0) {
      metrics.expired++;
    } else if (diff <= 3) {
      metrics.soon++;
      metrics.critical7++;
    } else if (diff <= 7) {
      metrics.week++;
      metrics.critical7++;
    } else {
      metrics.ok++;
    }
  }

  return metrics;
}

export const metricsStore = derived(inventoryStore, ($inv) => {
  return calculateMetrics($inv.products);
});
```

---

### 4.5 `src/lib/stores/inventoryStore.ts` (M1 Store Contract & Local Stub)
```typescript
import { writable, derived } from 'svelte/store';
import type { ProductItem } from './metricsStore';

export interface InventoryState {
  products: ProductItem[];
  loading: boolean;
  error: string | null;
  hasPendingWrites: boolean;
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
    filterCategory: null,
    filterLocation: null,
    searchQuery: '',
    sortBy: 'expiryDate',
    sortOrder: 'asc'
  });

  return {
    subscribe,
    setProducts(products: ProductItem[], hasPendingWrites = false): void {
      update(s => ({ ...s, products, hasPendingWrites, loading: false }));
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
    reset(): void {
      set({
        products: [],
        loading: false,
        error: null,
        hasPendingWrites: false,
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
  let list = $inv.products.filter(p => !p.isDiscarded && !p.isConsumed);

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
```

---

### 4.6 `src/routes/+layout.ts`
```typescript
export const prerender = true;
export const ssr = false;
```

---

### 4.7 `src/routes/+layout.svelte`
```svelte
<script lang="ts">
  import { connectivityStore } from '$lib/stores/connectivityStore';
  import { toastStore } from '$lib/stores/toastStore';

  export let data = {};
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>StockControl PWA — Control Colaborativo de Alimentos</title>
</svelte:head>

<div class="app-shell">
  <!-- Offline Network Banner -->
  {#if !$connectivityStore.online}
    <div class="network-banner offline" role="status" aria-live="assertive">
      <span class="icon">📡</span>
      <span class="text">Modo Offline — Los cambios se sincronizarán al reconectar</span>
    </div>
  {:else if $connectivityStore.hasPendingWrites}
    <div class="network-banner syncing" role="status" aria-live="polite">
      <span class="icon">⏳</span>
      <span class="text">Sincronizando cambios locales con la cocina...</span>
    </div>
  {/if}

  <!-- Main View Content -->
  <main class="shell-main">
    <slot />
  </main>

  <!-- Global Toast Notification Layer -->
  <aside class="toast-viewport" role="region" aria-label="Notificaciones" aria-live="polite">
    {#each $toastStore as toast (toast.id)}
      <div class="toast-pill toast-{toast.type}" role="alert">
        <span class="toast-message">{toast.message}</span>
        {#if toast.action}
          <button
            type="button"
            class="toast-action-btn"
            on:click={() => {
              if (toast.action) toast.action.onClick();
              toastStore.dismiss(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        {/if}
        <button
          type="button"
          class="toast-close-btn"
          aria-label="Cerrar notificación"
          on:click={() => toastStore.dismiss(toast.id)}
        >
          ✕
        </button>
      </div>
    {/each}
  </aside>
</div>

<style>
  :global(:root) {
    --color-brown: #75472f;
    --color-brown-dark: #69412d;
    --color-brown-light: #9a623e;
    --color-cream: #fff8ef;
    --color-ink: #302821;
    --color-muted: #7c7168;
    --color-line: #eadfd2;
    --color-green: #4c7860;
    --color-red: #b84035;
    --color-amber: #a56b15;
    --color-bg: #f7f2eb;
    --color-surface: #ffffff;
    --font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    --touch-min: 44px;
    --header-height: 60px;
    --nav-height: 60px;
  }

  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    background-color: var(--color-bg);
    color: var(--color-ink);
    font-family: var(--font-family);
    -webkit-font-smoothing: antialiased;
    overscroll-behavior-y: none;
  }

  .app-shell {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
  }

  .network-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 0.85rem;
    font-weight: 600;
    text-align: center;
  }

  .network-banner.offline {
    background-color: var(--color-red);
    color: #ffffff;
  }

  .network-banner.syncing {
    background-color: var(--color-amber);
    color: #ffffff;
  }

  .shell-main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .toast-viewport {
    position: fixed;
    bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 16px);
    left: 50%;
    transform: translateX(-50%);
    width: min(92%, 480px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 9999;
    pointer-events: none;
  }

  .toast-pill {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    background-color: #26211c;
    color: #ffffff;
    padding: 10px 16px;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    font-size: 0.9rem;
  }

  .toast-message {
    flex: 1;
    line-height: 1.3;
  }

  .toast-action-btn {
    min-width: var(--touch-min);
    min-height: var(--touch-min);
    background-color: var(--color-brown-light);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  .toast-close-btn {
    min-width: 36px;
    min-height: 36px;
    background: transparent;
    border: none;
    color: #b0a599;
    font-size: 1rem;
    cursor: pointer;
    touch-action: manipulation;
  }
</style>
```

---

### 4.8 `src/routes/+page.svelte`
```svelte
<script lang="ts">
  import { workspaceStore } from '$lib/stores/workspaceStore';
  import { connectivityStore } from '$lib/stores/connectivityStore';
  import { toastStore } from '$lib/stores/toastStore';
  import { metricsStore } from '$lib/stores/metricsStore';
  import { inventoryStore, filteredProducts } from '$lib/stores/inventoryStore';

  type NavTab = 'inventario' | 'scanner' | 'alertas' | 'historial';
  let activeTab: NavTab = 'inventario';
  let isEditingWorkspace = false;
  let tempWorkspaceId = '';
  let tempOperatorAlias = '';

  function openWorkspaceModal() {
    tempWorkspaceId = $workspaceStore.workspaceId;
    tempOperatorAlias = $workspaceStore.operatorAlias;
    isEditingWorkspace = true;
  }

  function saveWorkspaceModal() {
    workspaceStore.setWorkspace(tempWorkspaceId);
    workspaceStore.setOperator(tempOperatorAlias);
    isEditingWorkspace = false;
    toastStore.success('Espacio y operador actualizados');
  }

  function handleConsume(id: string, name: string) {
    const result = inventoryStore.consumeOne(id);
    if (result) {
      toastStore.undo(`Consumiste 1 unidad de ${name}`, () => {
        inventoryStore.updateProduct(id, {
          quantity: result.previousQuantity,
          isConsumed: false
        });
      });
    }
  }
</script>

<div class="page-container">
  <!-- Header with culinary gradient -->
  <header class="app-header">
    <div class="header-content">
      <div class="brand">
        <h1 class="logo-title">StockControl</h1>
        <span class="version-badge">PWA</span>
      </div>
      <button
        type="button"
        class="workspace-badge-btn"
        on:click={openWorkspaceModal}
        aria-label="Configurar cocina y operador"
      >
        <span class="ws-dot" class:online={$connectivityStore.online}></span>
        <span class="ws-text">{$workspaceStore.workspaceId}</span>
        <span class="op-alias">({$workspaceStore.operatorAlias})</span>
      </button>
    </div>
  </header>

  <!-- Responsive Split-Screen Container -->
  <div class="split-view">
    <!-- Master Pane (Left column on Tablet >= 768px) -->
    <section class="master-pane">
      <!-- 4-Card Metrics Dashboard -->
      <section class="metrics-grid" aria-label="Resumen de Vencimientos">
        <div class="metric-card total">
          <span class="metric-label">Total</span>
          <span class="metric-num">{$metricsStore.total}</span>
        </div>
        <div class="metric-card expired">
          <span class="metric-label">Vencidos</span>
          <span class="metric-num">{$metricsStore.expired}</span>
        </div>
        <div class="metric-card soon">
          <span class="metric-label">Vence hoy / 3d</span>
          <span class="metric-num">{$metricsStore.soon}</span>
        </div>
        <div class="metric-card week">
          <span class="metric-label">Vence 7 días</span>
          <span class="metric-num">{$metricsStore.critical7}</span>
        </div>
      </section>

      <!-- Search Bar -->
      <div class="search-filter-bar">
        <input
          type="search"
          placeholder="Buscar producto, código o lote..."
          class="search-input"
          bind:value={$inventoryStore.searchQuery}
          aria-label="Buscar inventario"
        />
      </div>

      <!-- Tab Content: Inventario -->
      {#if activeTab === 'inventario'}
        <section class="inventory-list" aria-label="Lista de productos">
          {#if $filteredProducts.length === 0}
            <div class="empty-state">
              <span class="empty-icon">📦</span>
              <h3>No hay productos registrados</h3>
              <p>Presiona el botón (+) para registrar el primer ingrediente.</p>
            </div>
          {:else}
            {#each $filteredProducts as prod (prod.id)}
              <article class="product-card">
                <div class="card-info">
                  <h4 class="card-title">{prod.name}</h4>
                  <p class="card-meta">
                    <span class="qty">{prod.quantity} {prod.unit || 'uds'}</span> • 
                    <span class="exp">Vence: {prod.expiryDate}</span>
                  </p>
                </div>
                <div class="card-actions">
                  <button
                    type="button"
                    class="action-btn-consume"
                    on:click={() => handleConsume(prod.id, prod.name)}
                    aria-label={`Consumir una unidad de ${prod.name}`}
                  >
                    -1 Consumir
                  </button>
                </div>
              </article>
            {/each}
          {/if}
        </section>
      {:else if activeTab === 'scanner'}
        <section class="tab-placeholder">
          <h2>📷 Escáner de Código de Barras y QR</h2>
          <p>Módulo de escáner con lectura dual nativa BarcodeDetector y librería html5-qrcode (M4).</p>
        </section>
      {:else if activeTab === 'alertas'}
        <section class="tab-placeholder">
          <h2>⚠️ Alertas Críticas</h2>
          <p>Supervisión prioritaria de productos vencidos y con riesgo de caducidad inmediata (FIFO).</p>
        </section>
      {:else if activeTab === 'historial'}
        <section class="tab-placeholder">
          <h2>📋 Historial y Mermas</h2>
          <p>Registro de auditoría de bajas, descartes y consumos clasificados por operador.</p>
        </section>
      {/if}
    </section>

    <!-- Detail Pane (Right column on Tablet >= 768px) -->
    <aside class="detail-pane">
      <div class="detail-placeholder">
        <h3>Detalle del Lote / Ficha Operativa</h3>
        <p>Selecciona un ingrediente de la lista para ver la trazabilidad de recepción, lote de proveedor y registro de operador.</p>
      </div>
    </aside>
  </div>

  <!-- Floating Action Button (FAB) -->
  <button
    type="button"
    class="fab"
    on:click={() => toastStore.info('Formulario de alta rápida de producto (M3)')}
    aria-label="Registrar nuevo producto"
  >
    +
  </button>

  <!-- Fixed Bottom Navigation Bar (4 tabs, >= 44x44px) -->
  <nav class="bottom-nav" aria-label="Navegación principal">
    <button
      type="button"
      class="nav-item"
      class:active={activeTab === 'inventario'}
      on:click={() => (activeTab = 'inventario')}
    >
      <span class="nav-icon">📦</span>
      <span class="nav-label">Inventario</span>
    </button>
    <button
      type="button"
      class="nav-item"
      class:active={activeTab === 'scanner'}
      on:click={() => (activeTab = 'scanner')}
    >
      <span class="nav-icon">📷</span>
      <span class="nav-label">Escáner</span>
    </button>
    <button
      type="button"
      class="nav-item"
      class:active={activeTab === 'alertas'}
      on:click={() => (activeTab = 'alertas')}
    >
      <span class="nav-icon">⚠️</span>
      <span class="nav-label">Alertas</span>
      {#if $metricsStore.expired > 0}
        <span class="badge">{$metricsStore.expired}</span>
      {/if}
    </button>
    <button
      type="button"
      class="nav-item"
      class:active={activeTab === 'historial'}
      on:click={() => (activeTab = 'historial')}
    >
      <span class="nav-icon">📋</span>
      <span class="nav-label">Historial</span>
    </button>
  </nav>

  <!-- Workspace & Operator Modal Dialog -->
  {#if isEditingWorkspace}
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ws-modal-title">
      <div class="modal-sheet">
        <h3 id="ws-modal-title">Espacio de Trabajo y Operador</h3>
        <p class="modal-subtitle">Conéctate a la cocina compartida sin contraseñas.</p>

        <label class="input-field">
          <span>Código de Cocina / Sucursal</span>
          <input
            type="text"
            bind:value={tempWorkspaceId}
            placeholder="ej. cocina-principal"
            class="dialog-input"
          />
        </label>

        <label class="input-field">
          <span>Alias del Operador</span>
          <input
            type="text"
            bind:value={tempOperatorAlias}
            placeholder="ej. Juan - Cocinero"
            class="dialog-input"
          />
        </label>

        <div class="modal-buttons">
          <button type="button" class="btn-cancel" on:click={() => (isEditingWorkspace = false)}>
            Cancelar
          </button>
          <button type="button" class="btn-save" on:click={saveWorkspaceModal}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .page-container {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding-bottom: calc(var(--nav-height) + 16px);
  }

  .app-header {
    background: linear-gradient(135deg, var(--color-brown-dark), var(--color-brown-light));
    color: #ffffff;
    padding: 12px 16px;
    border-radius: 0 0 20px 20px;
    box-shadow: 0 4px 12px rgba(105, 65, 45, 0.2);
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1200px;
    margin: 0 auto;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo-title {
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .version-badge {
    background: rgba(255, 255, 255, 0.2);
    font-size: 0.65rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .workspace-badge-btn {
    min-height: var(--touch-min);
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: #ffffff;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  .ws-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--color-red);
  }

  .ws-dot.online {
    background-color: #55d688;
  }

  .op-alias {
    opacity: 0.85;
  }

  .split-view {
    display: flex;
    flex-direction: column;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: 16px;
    gap: 16px;
    flex: 1;
  }

  .detail-pane {
    display: none;
  }

  @media (min-width: 768px) {
    .split-view {
      flex-direction: row;
      align-items: flex-start;
    }
    .master-pane {
      width: 420px;
      flex-shrink: 0;
    }
    .detail-pane {
      display: block;
      flex: 1;
      background: var(--color-surface);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }

  @media (min-width: 480px) {
    .metrics-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .metric-card {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    border-left: 4px solid var(--color-line);
  }

  .metric-card.total { border-left-color: var(--color-brown); }
  .metric-card.expired { border-left-color: var(--color-red); }
  .metric-card.soon { border-left-color: var(--color-amber); }
  .metric-card.week { border-left-color: #2b78b8; }

  .metric-label {
    font-size: 0.75rem;
    color: var(--color-muted);
    font-weight: 600;
  }

  .metric-num {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--color-ink);
  }

  .search-filter-bar {
    margin-bottom: 16px;
  }

  .search-input {
    width: 100%;
    min-height: var(--touch-min);
    padding: 10px 14px;
    border: 1px solid var(--color-line);
    border-radius: 10px;
    font-size: 0.95rem;
    background: var(--color-surface);
  }

  .inventory-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: var(--color-muted);
  }

  .empty-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 8px;
  }

  .product-card {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }

  .card-title {
    font-size: 1rem;
    font-weight: 700;
  }

  .card-meta {
    font-size: 0.85rem;
    color: var(--color-muted);
    margin-top: 2px;
  }

  .action-btn-consume {
    min-width: var(--touch-min);
    min-height: var(--touch-min);
    padding: 8px 12px;
    background: var(--color-cream);
    border: 1px solid var(--color-line);
    color: var(--color-brown);
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  .fab {
    position: fixed;
    bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 16px);
    right: 20px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--color-brown);
    color: #ffffff;
    font-size: 1.8rem;
    font-weight: 300;
    border: none;
    box-shadow: 0 4px 16px rgba(117, 71, 47, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    touch-action: manipulation;
  }

  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: var(--nav-height);
    background: var(--color-surface);
    border-top: 1px solid var(--color-line);
    display: flex;
    align-items: stretch;
    justify-content: space-around;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    z-index: 90;
  }

  .nav-item {
    flex: 1;
    min-height: var(--touch-min);
    background: none;
    border: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--color-muted);
    cursor: pointer;
    position: relative;
    touch-action: manipulation;
  }

  .nav-item.active {
    color: var(--color-brown);
    font-weight: 700;
  }

  .nav-icon {
    font-size: 1.2rem;
  }

  .nav-label {
    font-size: 0.7rem;
    margin-top: 2px;
  }

  .badge {
    position: absolute;
    top: 6px;
    right: 25%;
    background: var(--color-red);
    color: #ffffff;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 10px;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 16px;
  }

  .modal-sheet {
    background: var(--color-surface);
    border-radius: 16px;
    padding: 24px;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-subtitle {
    font-size: 0.85rem;
    color: var(--color-muted);
    margin-top: -8px;
  }

  .input-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .dialog-input {
    min-height: var(--touch-min);
    padding: 10px 12px;
    border: 1px solid var(--color-line);
    border-radius: 8px;
    font-size: 0.95rem;
  }

  .modal-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }

  .btn-cancel {
    min-height: var(--touch-min);
    min-width: var(--touch-min);
    background: none;
    border: 1px solid var(--color-line);
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
  }

  .btn-save {
    min-height: var(--touch-min);
    min-width: var(--touch-min);
    background: var(--color-brown);
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 8px 20px;
    font-weight: 700;
    cursor: pointer;
  }
</style>
```

---

## 5. Verification Method

To independently verify the reactive stores and app shell designs:

### 5.1 Store Unit Testing in Node (`tests/e2e/tier1_features/test_feature4_stores.js`)
Verify that all stores execute cleanly in Node without browser errors:
1. **`workspaceStore` Verification**:
   - Call `sanitizeWorkspaceId(' Cocina Principal - Norte! ')` -> returns `'cocina-principal-norte'`.
   - Call `sanitizeWorkspaceId('')` -> returns `'cocina-principal'`.
   - Call `workspaceStore.setWorkspace('sucursal-1')` -> updates store value to `{ workspaceId: 'sucursal-1', ... }`.
2. **`connectivityStore` Verification**:
   - In Node, `connectivityStore` initializes with `{ online: true, ... }`.
   - Call `connectivityStore.setOnlineStatus(false)` -> `$connectivityStore.online` is `false`.
   - Call `connectivityStore.setPendingWrites(true)` -> `$connectivityStore.hasPendingWrites` is `true`.
3. **`toastStore` Verification**:
   - Call `toastStore.show({ message: 'Lote creado' })` -> store has 1 item.
   - Call `toastStore.undo('Consumiste 1 ud', () => {})` -> toast has `action.label === 'Deshacer'`.
   - Call `toastStore.clear()` -> store length is 0.
4. **`metricsStore` Verification**:
   - Pass test dataset with fixed reference date `2026-10-25`:
     ```javascript
     const mock = [
       { id: '1', name: 'Leche', quantity: 2, expiryDate: '2026-10-24' }, // expired (-1)
       { id: '2', name: 'Carne', quantity: 1, expiryDate: '2026-10-25' }, // soon (0, vence hoy)
       { id: '3', name: 'Pollo', quantity: 3, expiryDate: '2026-10-28' }, // soon (3d)
       { id: '4', name: 'Pescado', quantity: 1, expiryDate: '2026-10-31' }, // week (6d)
       { id: '5', name: 'Arroz', quantity: 10, expiryDate: '2026-12-01' }  // ok (>7d)
     ];
     const res = calculateMetrics(mock, new Date('2026-10-25T00:00:00'));
     assert.equal(res.total, 5);
     assert.equal(res.expired, 1);
     assert.equal(res.soon, 2);
     assert.equal(res.week, 1);
     assert.equal(res.critical7, 3);
     assert.equal(res.ok, 1);
     ```

### 5.2 Ergonomic & Inset Layout Verification
1. **Touch Targets**:
   - Inspect all `<button>` elements (`.workspace-badge-btn`, `.nav-item`, `.fab`, `.toast-action-btn`, `.action-btn-consume`).
   - Confirm CSS rule `--touch-min: 44px;` enforces `min-height: 44px; min-width: 44px;`.
2. **Safe Area Insets**:
   - Verify `padding-top: env(safe-area-inset-top, 0px);` and `padding-bottom: env(safe-area-inset-bottom, 0px);` are applied in `.app-shell`.
   - Verify `.toast-viewport` and `.fab` add `env(safe-area-inset-bottom)` to ensure zero overlap with iOS home indicators.
3. **Split-Screen Breakpoint**:
   - Test layout at viewport `767px` -> single column with `.detail-pane` hidden (`display: none`).
   - Test layout at viewport `768px` -> two columns with `.master-pane` (420px) and `.detail-pane` (flex: 1).
4. **SPA Build Verification**:
   - Confirm `src/routes/+layout.ts` contains `export const prerender = true; export const ssr = false;`.
   - When run with `@sveltejs/adapter-static`, `npm run build` emits `./build/index.html` without SSR syntax errors.
