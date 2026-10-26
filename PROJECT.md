# Project: StockControl PWA

## Architecture
StockControl PWA is a collaborative, real-time Progressive Web App for restaurant kitchens and food inventory control. It is built with SvelteKit in SPA mode using `@sveltejs/adapter-static` for $0/month deployment on Render Static Site, backed by Firebase Firestore with offline IndexedDB multi-tab persistence for zero-interruption work in walk-in cold rooms.

### Architectural Layers (Clean Architecture)
```text
┌─────────────────────────────────────────────────────────────┐
│                 Presentation Layer (SvelteKit)              │
│  - Routes: / (SPA with hash/tab view state switching)       │
│  - Components: BottomNav, FAB, ProductCard, ProductForm,    │
│    MetricsDashboard, CameraScanner, SplitScreenLayout       │
│  - Ergonomics: >=44x44px touch targets, safe-area-insets,   │
│    quick expiry buttons (+2d, +3d, +1w, +1m)                │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Reactive Stores Layer                    │
│  - inventoryStore: Real-time Firestore sync & local filter  │
│  - workspaceStore: Kitchen workspace ID & operator alias    │
│  - metricsStore: Derived counters (expired, soon 3d, 7d)    │
│  - connectivityStore: Online / Offline network status       │
│  - toastStore: User feedback and 1-tap undo notifications   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│             Repository & Data Portability Layer             │
│  - firebase.ts: Modular SDK v11 persistentLocalCache        │
│  - productRepository.ts: Realtime onSnapshot listener,      │
│    atomic decrement (increment(-amount)), operator audit    │
│  - contingencyService.ts: RFC 4180 UTF-8 BOM CSV & JSON v2  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                     Domain Layer (Pure TS)                  │
│  - models.ts: Product, Workspace, Operator, HistoryLog      │
│  - expiry.ts: Expiry calculations, dayDiff, statusOf        │
│  - waste.ts: HACCP consumption and discard rules            │
└─────────────────────────────────────────────────────────────┘
```

---

## Feature Inventory
Every feature identified during Survey is assigned to a specific Milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | SvelteKit Static Setup | SPA setup with `@sveltejs/adapter-static`, TypeScript, Vite | M1 | Survey |
| 2 | Pure Domain Expiry Rules | `dayDiff`, status categorization (expired, soon 3d, week 7d, ok) | M1 | Survey / Proto |
| 3 | Domain Waste & Audit Models | Types for ProductDoc, WorkspaceDoc, HistoryDoc, WasteReason | M1 | Survey |
| 4 | Reactive Core Stores | Svelte stores for workspace, operator, connectivity, metrics | M1 | Survey |
| 5 | Static Brand Assets | Placement of logo-stockcontrol.png, icon-192, icon-512 in static/ | M1 | Survey |
| 6 | Modular Firebase Client | SSR-safe `browser` check, `initializeFirestore` with multi-tab persistentLocalCache | M2 | Survey / Env |
| 7 | Multi-Tenant Workspace Sync | Subcollection `workspaces/{workspaceId}/products` onSnapshot listener | M2 | Survey / R1 |
| 8 | Operator Audit Stamp | CreatedBy, UpdatedBy, ConsumedBy, DiscardedBy tracked per mutation | M2 | Survey / R1 |
| 9 | Atomic Stock Consumption | Decrementing via Firestore `increment(-amount)` and batch history write | M2 | Survey / R1 |
| 10 | Security Rules | Development and production `firestore.rules` definition | M2 | Survey / R1 |
| 11 | Bottom Navigation Bar | Fixed thumb-friendly navigation bar with 4 tabs | M3 | Survey / R3 |
| 12 | Touch Target Compliance | All interactive elements >=44x44 CSS px with >=8px spacing | M3 | Survey / R3 |
| 13 | Floating Action Button (FAB) | High-visibility FAB for rapid product entry | M3 | Survey / R3 |
| 14 | Quick Expiry Presets | 1-touch buttons for `+2d`, `+3d`, `+1w`, `+1m` with leap year safety | M3 | Survey / R3 |
| 15 | 1-Tap Consumption & Merma | Card buttons for 1-tap consume (with undo toast) and waste logging | M3 | Survey / R3 |
| 16 | Tablet Split-Screen Layout | Responsive two-pane master-detail view for screens >= 768px | M3 | Survey / R3 |
| 17 | Safe Area Inset Support | Viewport fit cover & CSS env(safe-area-inset-*) padding | M3 | Survey / R3 |
| 18 | Metrics Summary Dashboard | 4 reactive counter cards (Total, Vencidos, Vence hoy/3d, Vence 7d) | M3 | Survey / R3 |
| 19 | Dual-Engine Camera Scanner | BarcodeDetector API with html5-qrcode fallback for EAN-13 & QR | M4 | Survey / R3 |
| 20 | Instant Barcode Lookup | Auto-matching scanned code to stock or prefilling new product form | M4 | Survey / R3 |
| 21 | Camera Lifecycle Management | Stopping video tracks on unmount/close, torch/flash toggle | M4 | Survey / R3 |
| 22 | Web App Manifest | PWA manifest.json with standalone display and culinary theme | M4 | Survey / R4 |
| 23 | SvelteKit Service Worker | Precaching app shell assets via `$service-worker` for offline boots | M4 | Survey / R4 |
| 24 | Offline Connectivity Pill | Visual banner/pill reflecting offline state and pending writes | M4 | Survey / R2 |
| 25 | UTF-8 BOM CSV Export | RFC 4180 Excel-ready export with BOM and semicolon separator | M4 | Survey / R4 |
| 26 | JSON v2 Backup & Restore | Versioned JSON export and import with backward compatibility normalizer | M4 | Survey / R4 |
| 27 | Render Static Deployment | render.yaml configuration ($0/month static site) | M4 | Survey / R4 |
| 28 | Comprehensive E2E Test Suite | Automated opaque-box test runner covering Tiers 1-4 | E2E Track | Dual Track |
| 29 | Adversarial Coverage Hardening | White-box stress testing and boundary penetration (Tier 5) | M5 | Final M |
| 30 | Git Repository Push | Push verified production build to GitHub `main` branch | M5 | Final M |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Project Setup, Domain Layer & Stores | SvelteKit scaffold, TypeScript, static adapter, domain models/logic, core stores, static assets | none | DONE |
| E2E | E2E Testing Track | Independent opaque-box test suite (Tiers 1-4), test runner, TEST_READY.md | none | DONE |
| M2 | Firebase Firestore Data Layer & Sync | Offline persistence, workspace listeners, atomic stock updates, audit history | M1 | DONE |
| M3 | Mobile/Tablet Ergonomic UI/UX | BottomNav, FAB, >=44px touch targets, quick expiry, 1-tap consume/waste, tablet split-view | M1, M2 | DONE |
| M4 | Scanner, PWA & Data Contingency | Dual-engine camera scanner, manifest, service worker, CSV/JSON export/import, render.yaml | M2, M3 | DONE |
| M5 | Final Milestone: E2E Pass, Hardening & Deploy | 100% E2E test pass (Phase 1), Adversarial hardening (Phase 2), Git push to main (Phase 3) | M1-M4, TEST_READY | DONE |

---

## Interface Contracts

### Domain Layer ↔ Stores / UI
- `Product`:
  ```typescript
  export interface Product {
    id: string;
    name: string;
    category: ProductCategory;
    quantity: number;
    unit: ProductUnit;
    receivedDate: string; // YYYY-MM-DD
    expiryDate: string;   // YYYY-MM-DD
    location: StorageLocation;
    lot?: string;
    supplier?: string;
    barcode?: string;
    notes?: string;
    isDiscarded: boolean;
    isConsumed: boolean;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    lastAction: string;
  }
  ```
- `calculateExpiryStatus(expiryDate: string, today?: Date): { key: 'expired' | 'soon' | 'week' | 'ok'; label: string; daysRemaining: number; cls: string; }`
- `calculateMetrics(products: Product[]): { total: number; expired: number; soon: number; week: number; ok: number; }`

### Repository ↔ Stores
- `IProductRepository`:
  - `subscribeProducts(workspaceId: string, onData: (products: Product[], hasPendingWrites: boolean) => void): () => void`
  - `subscribeHistory(workspaceId: string, limit: number, onData: (history: HistoryLog[]) => void): () => void`
  - `createProduct(workspaceId: string, product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>`
  - `updateProduct(workspaceId: string, id: string, updates: Partial<Product>, operator: string): Promise<void>`
  - `consumeStock(workspaceId: string, id: string, amount: number, operator: string, reason?: string): Promise<void>`
  - `discardStock(workspaceId: string, id: string, reason: string, operator: string): Promise<void>`
  - `batchImport(workspaceId: string, products: Omit<Product, 'id'>[], operator: string): Promise<number>`

### Contingency Data Formats
- CSV: `text/csv;charset=utf-8;` with BOM `\uFEFF`, delimited by `;`, RFC 4180 quoted.
- JSON: `{ app: 'StockControl PWA', version: 2, exportedAt: string, workspaceId: string, products: Product[] }`.

---

## Code Layout

```text
/home/rydozz/Documents/Proyectos/StockControl_App_Telefono
├── .env                              # Firebase credentials (PUBLIC_FIREBASE_*)
├── .env.example
├── .gitignore
├── render.yaml                       # Render static site deployment config
├── firestore.rules                   # Firestore security rules
├── package.json
├── svelte.config.js                  # adapter-static SPA config
├── vite.config.ts
├── tsconfig.json
├── static/
│   ├── assets/
│   │   ├── logo-stockcontrol.png
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── favicon.png
│   └── manifest.json
├── src/
│   ├── app.html                      # Shell with viewport-fit=cover
│   ├── service-worker.ts             # PWA offline cache
│   ├── routes/
│   │   ├── +layout.ts                # prerender = true, ssr = false
│   │   ├── +layout.svelte            # Global layout shell
│   │   └── +page.svelte              # Main application view
│   └── lib/
│       ├── domain/
│       │   ├── models.ts
│       │   ├── expiry.ts
│       │   └── waste.ts
│       ├── repositories/
│       │   ├── firebase.ts
│       │   ├── productRepository.ts
│       │   └── contingencyService.ts
│       ├── stores/
│       │   ├── workspaceStore.ts
│       │   ├── inventoryStore.ts
│       │   ├── metricsStore.ts
│       │   ├── connectivityStore.ts
│       │   └── toastStore.ts
│       └── components/
│           ├── Header.svelte
│           ├── MetricsDashboard.svelte
│           ├── ProductCard.svelte
│           ├── ProductForm.svelte
│           ├── CameraScanner.svelte
│           ├── BottomNav.svelte
│           ├── WorkspaceModal.svelte
│           ├── WasteHistory.svelte
│           └── ExportImportModal.svelte
└── tests/
    └── e2e/                          # Independent E2E test suite (Tiers 1-4)
```
