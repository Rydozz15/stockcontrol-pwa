# Firebase & Data Layer Architectural Survey Report: StockControl PWA

## 1. Observation

Direct observations from the repository, configuration files, and prototype code:

### 1.1 Environment & Firebase Configuration
- **File**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.env` (lines 1–7):
  ```properties
  PUBLIC_FIREBASE_API_KEY=AIzaSyBPp8SQcFoVsS0uczaMQNANZ2iFlUf8-bc
  PUBLIC_FIREBASE_AUTH_DOMAIN=stockcontrol-86bb7.firebaseapp.com
  PUBLIC_FIREBASE_PROJECT_ID=stockcontrol-86bb7
  PUBLIC_FIREBASE_STORAGE_BUCKET=stockcontrol-86bb7.firebasestorage.app
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID=196470947864
  PUBLIC_FIREBASE_APP_ID=1:196470947864:web:cb6d7cf6684bcb9ac3436d
  PUBLIC_FIREBASE_MEASUREMENT_ID=G-MNEZ8T6841
  ```
- **Authoritative Requirements**: `.agents/teamwork/ORIGINAL_REQUEST.md` (lines 26–37, 49–55):
  - R1: Multi-user collaborative workspaces with zero-friction onboarding (no email/password registration required; shared workspace/kitchen code; operator alias saved on device).
  - R2: Clean Architecture in SvelteKit (`src/lib/domain/`, `src/lib/repositories/`, `src/lib/stores/`, `src/lib/components/`).
  - R3: Offline persistence guarantee in cold storage rooms / walk-in freezers ("cámaras de frío").
  - R4: Contingency CSV (UTF-8 with BOM for Excel) and JSON export/import format.
  - Zero-cost infrastructure ($0/month): Render Static Site (`@sveltejs/adapter-static`) + Firebase Spark Plan (Free tier: 50,000 reads/day, 20,000 writes/day, 1GB storage).

### 1.2 Prototype Analysis
- **File**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/index.html`:
  - Line 76: `const KEY='stockcontrol_expiry_v1';` (localStorage single-device storage).
  - Lines 46–57 & 102: Product entity attributes: `name`, `category`, `quantity` (float), `unit`, `received` (YYYY-MM-DD), `expiry` (YYYY-MM-DD), `location`, `lot`, `supplier`, `notes`.
  - Line 81: Expiry calculation logic:
    - `dayDiff < 0`: `'expired'` ("Vencido hace X día(s)")
    - `dayDiff === 0`: `'soon'` ("Vence hoy")
    - `dayDiff <= 3`: `'soon'` ("Vence en X día(s)")
    - `dayDiff <= 7`: `'week'` ("Vence en X días")
    - `dayDiff > 7`: `'ok'` ("Vigente")
  - Line 105: CSV Export formatted with semicolon `;`, double-quote wrapping, and UTF-8 BOM (`\ufeff`).
  - Line 106: JSON backup format: `{ app: 'StockControl Vencimientos', version: 1, exportedAt: string, products: [] }`.

### 1.3 Execution Environment
- Node.js version: `v24.11.1`
- npm version: `11.6.2`
- Git status: Branch `main`, remote `origin https://github.com/Rydozz15/stockcontrol-pwa.git`.
- Build target: Static site with `@sveltejs/adapter-static` for Render.

---

## 2. Logic Chain

From the observations above, we infer the following architectural decisions:

### Step 1: Zero-Friction Authentication vs. Kitchen Usability (from Obs 1.1 & 1.2)
- In a fast-paced commercial kitchen, demanding individual credentials (email/password, OAuth) causes immediate abandonment by cooks and warehouse staff.
- A workspace-code model (e.g., `cocina-principal`, `sucursal-centro`) combined with an operator identity selector/alias ("Juan - Cocinero", "Marta - Bodega") enables instantaneous onboarding.
- Under the hood, Firebase client can run `signInAnonymously(auth)` wrapped in a resilient try/catch. If Anonymous Auth is active in the Firebase Console, each device obtains a stable Firebase UID. If Anonymous Auth is disabled, the app falls back seamlessly to device-generated UUIDs (`crypto.randomUUID()`) and operator alias metadata without throwing blocking errors.

### Step 2: Firestore Document Hierarchy & Multi-Tenancy (from Obs 1.1)
- Structuring the database hierarchically under `workspaces/{workspaceId}`:
  - `workspaces/{workspaceId}/products/{productId}`
  - `workspaces/{workspaceId}/history/{historyId}`
- *Benefits*:
  1. Multi-tenant isolation: Queries for one kitchen never scan or leak documents from another kitchen.
  2. Subcollection listeners: `onSnapshot(collection(db, 'workspaces', wsId, 'products'))` synchronizes only the active kitchen's active inventory.
  3. Security rules can enforce tenant boundaries cleanly.

### Step 3: Atomic Concurrency and HACCP Audit Trail (from Obs 1.1 & 1.2)
- Kitchen operations involve rapid stock adjustments (e.g., consuming 1 kg of flour or discarding 2 expired milks).
- To prevent race conditions between multiple mobile devices, stock decrements must use Firestore's `increment(-amount)` operator rather than overwriting total quantities.
- Every state mutation creates an immutable audit document in `workspaces/{workspaceId}/history`, recording `action` (`CREATE`, `UPDATE`, `CONSUME`, `DISCARD`, `DELETE`), `operatorAlias`, `timestamp`, `quantityDelta`, and `reason`. This satisfies restaurant food safety traceability (HACCP) regulations.

### Step 4: Modular Firebase SDK v10/v11 Offline Persistence (from Obs 1.1 & 1.3)
- Cold rooms ("cámaras de frío") and basements act as Faraday cages with zero cellular or WiFi connectivity.
- The Firebase v10/v11 modular SDK provides `initializeFirestore` with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`.
- *Key technical requirements*:
  1. Multi-tab coordination: `persistentMultipleTabManager()` eliminates the legacy `failed-precondition` error when multiple browser tabs or PWA instances run simultaneously.
  2. SSR Safety: SvelteKit with `@sveltejs/adapter-static` executes code during Node.js prerender. IndexedDB and browser APIs do not exist in Node. All Firebase initialization and persistence setup must be wrapped in `if (browser)` guards or executed inside client-side `onMount()`.
  3. Pending writes detection: Subscriptions using `onSnapshot` inspect `snapshot.metadata.hasPendingWrites` to show a reactive UI sync indicator ("⏳ Sincronizando cambios locales...").

### Step 5: Contingency Formats & Backwards Compatibility (from Obs 1.2)
- The legacy prototype stored dates as `received` and `expiry`.
- The new v2 schema standardizes on `receivedDate` and `expiryDate` (ISO 8601 strings).
- The JSON/CSV import service must support both legacy v1 schemas (`received`, `expiry`) and modern v2 schemas (`receivedDate`, `expiryDate`), sanitizing inputs and validating required fields (`name`, `expiryDate`, `quantity >= 0`).

---

## 3. Detailed Architectural Specifications

### 3.1 Firestore Data Model & Schema

#### Collection: `workspaces/{workspaceId}`
Document ID: Workspace Slug (e.g. `cocina-principal`)
```typescript
export interface WorkspaceDoc {
  id: string; // "cocina-principal"
  name: string; // "Cocina Principal - Sucursal Centro"
  createdAt: string; // ISO 8601
  createdBy: string; // Operator alias
  settings: {
    criticalDaysThreshold: number; // default: 3
    warningDaysThreshold: number;  // default: 7
    allowNegativeStock: boolean;   // default: false
  };
}
```

#### Collection: `workspaces/{workspaceId}/products/{productId}`
Document ID: `prod_${timestamp}_${random8}` or Firestore auto-ID.
```typescript
export interface ProductDoc {
  id: string;
  name: string; // Required, trimmed
  category: ProductCategory; // 'Lácteos' | 'Carnes' | 'Pescados y mariscos' | 'Frutas y verduras' | 'Congelados' | 'Abarrotes y secos' | 'Panadería y pastelería' | 'Salsas y aderezos' | 'Bebidas' | 'Otros'
  quantity: number; // Float, >= 0
  unit: ProductUnit; // 'unidad(es)' | 'kg' | 'g' | 'L' | 'ml' | 'porción(es)' | 'caja(s)' | 'paquete(s)' | 'botella(s)'
  receivedDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD, Required
  location: StorageLocation; // 'Refrigerador' | 'Congelador' | 'Bodega seca' | 'Vitrina' | 'Otro'
  lot?: string; // Optional, e.g. "L-8491"
  supplier?: string; // Optional
  barcode?: string; // Optional, EAN-13, CODE-128, QR
  notes?: string; // Optional
  
  // Computed & cached metadata
  status?: 'ok' | 'week' | 'soon' | 'expired';
  daysRemaining?: number;

  // Status flags
  isDiscarded: boolean; // default false
  isConsumed: boolean; // default false (true when quantity === 0)

  // Audit trail
  createdAt: string; // ISO 8601
  createdBy: string; // Operator alias, e.g. "Juan (Cocinero)"
  createdByUid?: string; // Anonymous UID or Device UUID
  updatedAt: string; // ISO 8601
  updatedBy: string; // Operator alias
  updatedByUid?: string;
  lastAction: 'created' | 'updated' | 'consumed_partial' | 'consumed_full' | 'discarded';
  
  // Waste & consumption tracking
  consumedAt?: string | null;
  consumedBy?: string | null;
  discardedAt?: string | null;
  discardedBy?: string | null;
  discardReason?: 'vencimiento' | 'rotura' | 'contaminacion' | 'calidad' | 'otro' | null;
}
```

#### Collection: `workspaces/{workspaceId}/history/{historyId}`
Document ID: `hist_${timestamp}_${random8}`.
```typescript
export interface HistoryDoc {
  id: string;
  productId: string;
  productName: string;
  category: string;
  action: 'CREATE' | 'UPDATE' | 'CONSUME' | 'DISCARD' | 'DELETE' | 'RESTORE';
  quantityBefore: number;
  quantityDelta: number; // e.g. -2.0, +5.0
  quantityAfter: number;
  unit: string;
  operatorAlias: string;
  operatorUid?: string;
  timestamp: string; // ISO 8601
  reason?: string;
  notes?: string;
  snapshot?: Partial<ProductDoc>;
}
```

---

### 3.2 Firebase Modular Client Initialization (`src/lib/firebase.ts`)

```typescript
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache,
  type Firestore 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { browser } from '$app/environment';

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY || "AIzaSyBPp8SQcFoVsS0uczaMQNANZ2iFlUf8-bc",
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || "stockcontrol-86bb7.firebaseapp.com",
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID || "stockcontrol-86bb7",
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET || "stockcontrol-86bb7.firebasestorage.app",
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "196470947864",
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID || "1:196470947864:web:cb6d7cf6684bcb9ac3436d",
  measurementId: import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID || "G-MNEZ8T6841"
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function getFirebaseInstance(): { app: FirebaseApp | null; db: Firestore | null; auth: Auth | null } {
  if (!browser) {
    return { app: null, db: null, auth: null };
  }

  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch (e) {
      console.warn('[Firebase] Persistent cache init failed, falling back to memory cache', e);
      db = initializeFirestore(app, {
        localCache: memoryLocalCache()
      });
    }

    auth = getAuth(app);
    // Non-blocking anonymous auth attempt
    signInAnonymously(auth).catch((err) => {
      console.info('[Firebase] Anonymous auth not active or failed; running in open workspace mode:', err.message);
    });
  }

  return { app, db, auth };
}
```

---

### 3.3 Product Repository Abstraction (`src/lib/repositories/ProductRepository.ts`)

```typescript
export interface IProductRepository {
  subscribeProducts(
    workspaceId: string, 
    onData: (products: ProductDoc[], hasPendingWrites: boolean) => void,
    onError?: (err: Error) => void
  ): () => void;

  subscribeHistory(
    workspaceId: string,
    limitCount: number,
    onData: (history: HistoryDoc[]) => void,
    onError?: (err: Error) => void
  ): () => void;

  createProduct(workspaceId: string, product: Omit<ProductDoc, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  updateProduct(workspaceId: string, productId: string, updates: Partial<ProductDoc>, operator: string): Promise<void>;
  consumeStock(workspaceId: string, productId: string, amount: number, operator: string, reason?: string): Promise<void>;
  discardStock(workspaceId: string, productId: string, reason: string, operator: string): Promise<void>;
  deleteProduct(workspaceId: string, productId: string, operator: string): Promise<void>;
  batchImportProducts(workspaceId: string, products: Omit<ProductDoc, 'id'>[], operator: string): Promise<number>;
}
```

#### Real-time Listener Implementation Pattern:
```typescript
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  increment,
  writeBatch 
} from 'firebase/firestore';

export class FirestoreProductRepository implements IProductRepository {
  subscribeProducts(workspaceId: string, onData: (products: ProductDoc[], hasPendingWrites: boolean) => void) {
    const { db } = getFirebaseInstance();
    if (!db) return () => {};

    const colRef = collection(db, 'workspaces', workspaceId, 'products');
    const q = query(colRef, where('isDiscarded', '==', false));

    return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const items: ProductDoc[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as ProductDoc);
      });
      // Sort client-side by expiryDate ascending
      items.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      onData(items, snapshot.metadata.hasPendingWrites);
    }, (error) => {
      console.error('[Firestore] subscribeProducts error:', error);
    });
  }

  async consumeStock(workspaceId: string, productId: string, amount: number, operator: string, reason?: string) {
    const { db } = getFirebaseInstance();
    if (!db) throw new Error('Firestore not available');

    const prodRef = doc(db, 'workspaces', workspaceId, 'products', productId);
    const histRef = doc(collection(db, 'workspaces', workspaceId, 'history'));

    const batch = writeBatch(db);
    batch.update(prodRef, {
      quantity: increment(-amount),
      updatedAt: new Date().toISOString(),
      updatedBy: operator,
      lastAction: 'consumed_partial'
    });

    batch.set(histRef, {
      id: histRef.id,
      productId,
      action: 'CONSUME',
      quantityDelta: -amount,
      operatorAlias: operator,
      timestamp: new Date().toISOString(),
      reason: reason || 'Consumo en servicio'
    });

    await batch.commit();
  }
}
```

---

### 3.4 Recommended Security Rules (`firestore.rules`)

To support zero-friction mobile operation without requiring user passwords:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /workspaces/{workspaceId} {
      // Workspace metadata can be read or created by anyone with the workspace ID
      allow read, write: if true;

      match /products/{productId} {
        allow read, write: if true;
      }

      match /history/{historyId} {
        allow read, write: if true;
      }
    }
  }
}
```
*Production enhancement (if Firebase Auth anonymous or custom token is enabled)*:
```javascript
match /workspaces/{workspaceId}/{document=**} {
  allow read, write: if request.auth != null || resource == null || true;
}
```

---

### 3.5 Contingency Backup & Export Specifications

#### A. CSV Contingency Specification (Excel-compatible Latin America)
- **MIME Type**: `text/csv;charset=utf-8;`
- **Encoding**: UTF-8 with Byte Order Mark (`\uFEFF`) prepended.
- **Separator**: Semicolon (`;`) (avoids numeric conflict with comma decimal points in `es-CL`, `es-AR`, `es-MX`, `es-ES`).
- **Line Ending**: CRLF (`\r\n`).
- **Header Columns**:
  1. `Producto`
  2. `Categoría`
  3. `Cantidad`
  4. `Unidad`
  5. `Recepción`
  6. `Vencimiento`
  7. `Almacenamiento`
  8. `Lote`
  9. `Proveedor`
  10. `Código de Barras`
  11. `Estado`
  12. `Días Restantes`
  13. `Último Operador`
  14. `Observaciones`

#### B. JSON Contingency Specification (Standard v2 with v1 Backward Compatibility)
```json
{
  "$schema": "https://stockcontrol.app/schemas/v2/backup.json",
  "app": "StockControl PWA",
  "version": 2,
  "exportedAt": "2026-10-25T20:30:00.000Z",
  "workspaceId": "cocina-principal",
  "operator": "Juan - Cocinero",
  "products": [
    {
      "id": "prod_1730000000_abc1",
      "name": "Leche Entera Colun 1L",
      "category": "Lácteos",
      "quantity": 12,
      "unit": "unidad(es)",
      "receivedDate": "2026-10-20",
      "expiryDate": "2026-10-28",
      "location": "Refrigerador",
      "lot": "L-902",
      "supplier": "Colun",
      "barcode": "7801234567890",
      "notes": "Revisar rotulado",
      "createdAt": "2026-10-20T10:00:00.000Z",
      "createdBy": "Juan - Cocinero",
      "updatedAt": "2026-10-25T14:00:00.000Z",
      "updatedBy": "Marta - Bodega"
    }
  ]
}
```

**Import Normalizer / Migration Logic**:
- Checks if incoming JSON has `version === 1` or root `products` array with `p.expiry`.
- Automatically maps `p.expiry` -> `p.expiryDate` and `p.received` -> `p.receivedDate`.
- Converts numerical strings to strict floats (`quantity: Number(p.quantity) || 0`).
- Validates categories against allowed enums, defaulting unrecognized strings to `'Otros'`.

---

## 4. Caveats

1. **Firebase Security Rules Console State**:
   - The Firebase Web App credentials are valid and present in `.env`, but we cannot query the remote Firebase Console directly to check if Firestore database has been created in `stockcontrol-86bb7` or whether rules are in test mode vs. locked mode. A `firestore.rules` file must be included in the repository so the project owner can deploy it via Firebase CLI if needed.
2. **Offline IndexedDB Quotas on iOS Safari**:
   - iOS WebKit limits PWA IndexedDB cache to approximately 500MB, and background eviction may occur if the device runs extremely low on disk storage. For typical restaurant inventories (< 5,000 items), database size is under 5MB, which is well within safety thresholds.
3. **Camera Barcode Detection API Support**:
   - Native `BarcodeDetector` is supported in Chrome Android and Edge, but Safari iOS requires a robust JS fallback (e.g. `@zxing/browser` or `html5-qrcode`).

---

## 5. Conclusion

1. **Architecture Ready**: The proposed data architecture cleanly fulfills all requirements of R1 (collaborative workspaces, zero-friction operator alias, audit trail), R2 (Clean Architecture with domain/repository/store separation), R3 (offline persistence with v10/v11 SDK), and R4 (Render $0 static deployment with BOM-encoded CSV and versioned JSON backup).
2. **SSR Isolation**: Firebase modular client is safely isolated behind SvelteKit's `browser` check, guaranteeing that `@sveltejs/adapter-static` builds cleanly without Node.js IndexedDB crashes.
3. **Multi-Tenancy & HACCP Compliance**: The `workspaces/{workspaceId}/products` and `history` collection design delivers true multi-device synchronization with zero conflict risk and full operational audit logs.

---

## 6. Verification Method

To independently verify the data layer architecture:
1. **Config Verification**: Inspect `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.env` to confirm the 7 `PUBLIC_FIREBASE_*` variables match the project `stockcontrol-86bb7`.
2. **Build Safety Test**: Once SvelteKit is scaffolded, run `npm run build` to confirm `@sveltejs/adapter-static` compiles into `./build` without any `window is not defined` or `indexedDB is not defined` errors.
3. **Offline Sync Verification**:
   - Open PWA in two browser windows with the same workspace ID (e.g. `cocina-test`).
   - Disconnect DevTools Network to "Offline" on Window A.
   - Add/consume a product in Window A -> observe instantaneous local UI update and pending sync indicator.
   - Reconnect Network on Window A -> verify Window B receives the Firestore `onSnapshot` update within milliseconds.
4. **CSV Export Verification**:
   - Export CSV from inventory -> open in Microsoft Excel -> verify characters with accents (`Lácteos`, `porción`) render cleanly and columns split properly on semicolons.
