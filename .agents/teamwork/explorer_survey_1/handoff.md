# Handoff Report — Codebase & Architecture Survey

## 1. Observation

### 1.1 Project Structure & File Inventory
A direct inspection of the workspace `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono` reveals the following files and directory layout (verified via `list_dir` and `find . -maxdepth 3 -not -path '*/.*'`):

```text
/home/rydozz/Documents/Proyectos/StockControl_App_Telefono
├── assets/
│   ├── icon-192.png              (30,175 bytes, 192x192 RGBA PNG)
│   ├── icon-512.png              (142,922 bytes, 512x512 RGBA PNG)
│   └── logo-stockcontrol.png     (840,904 bytes, 1521x1521 RGBA PNG)
├── .env                          (401 bytes, Firebase config)
├── .env.example                  (349 bytes, template)
├── .gitignore                    (76 bytes)
├── index.html                    (15,184 bytes, 112 lines, vanilla prototype)
├── LEEME.txt                     (940 bytes, 19 lines)
├── manifest.json                 (594 bytes, 25 lines)
├── README.md                     (4,763 bytes, 92 lines)
├── sw.js                         (734 bytes, 15 lines)
└── .agents/                      (teamwork metadata directory)
```

No `package.json`, `node_modules`, or compiler configuration (`svelte.config.js`, `vite.config.ts`, `tsconfig.json`) currently exist in the repository root.

### 1.2 Git Repository Status & Remotes
Command: `git status && git remote -v && git branch -a`
Result:
```text
On branch main
No commits yet
Untracked files:
  .agents/
  .env.example
  .gitignore
  LEEME.txt
  README.md
  assets/
  index.html
  manifest.json
  sw.js
nothing added to commit but untracked files present
origin  https://github.com/Rydozz15/stockcontrol-pwa.git (fetch)
origin  https://github.com/Rydozz15/stockcontrol-pwa.git (push)
```
Git configuration check (`git config -l`):
`user.name=Rydozz15`
`user.email=juan.fuentes@uc.cl`
Remote check (`git ls-remote origin`): returned exit code 0, verifying network connectivity and access to the GitHub repository.

### 1.3 System Environment & Node Tools
Command: `node -v && npm -v`
Result:
- Node.js: `v24.11.1`
- npm: `11.6.2`

### 1.4 Analysis of Existing Prototype (`index.html`)
The existing prototype in `index.html` is a Single-File Web App containing all HTML markup, CSS styling, and client-side JavaScript in 112 lines:

- **Storage & State** (Lines 76-77, 83):
  ```js
  const KEY='stockcontrol_expiry_v1';
  let products=JSON.parse(localStorage.getItem(KEY)||'[]');
  function save(){localStorage.setItem(KEY,JSON.stringify(products));render()}
  ```
  Data is stored strictly in `localStorage`. There is no remote backend, cloud synchronization, or multi-user sharing.

- **Data Model Fields** (Lines 46-57, 102):
  - `id`: unique string (`Date.now() + '-' + Math.random().toString(16).slice(2)`)
  - `name`: string (required)
  - `category`: string enum (Lácteos, Carnes, Pescados y mariscos, Frutas y verduras, Congelados, Abarrotes y secos, Panadería y pastelería, Salsas y aderezos, Bebidas, Otros)
  - `quantity`: number (`min="0" step="0.001"`)
  - `unit`: string enum (`unidad(es)`, `kg`, `g`, `L`, `ml`, `porción(es)`, `caja(s)`, `paquete(s)`, `botella(s)`)
  - `received`: string date (`YYYY-MM-DD`, optional)
  - `expiry`: string date (`YYYY-MM-DD`, required)
  - `location`: string enum (`Refrigerador`, `Congelador`, `Bodega seca`, `Vitrina`, `Otro`)
  - `lot`: string (optional)
  - `supplier`: string (optional)
  - `notes`: string (optional)

- **Date Difference & Status Categorization** (Lines 79-81):
  ```js
  const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
  const dayDiff=date=>{if(!date)return 99999;const d=new Date(date+'T00:00:00');return Math.round((d-today())/86400000)};
  const statusOf=p=>{
    const n=dayDiff(p.expiry);
    if(n<0)return {key:'expired',label:`Vencido hace ${Math.abs(n)} día(s)`,cls:'expired'};
    if(n===0)return {key:'soon',label:'Vence hoy',cls:'warning'};
    if(n<=3)return {key:'soon',label:`Vence en ${n} día(s)`,cls:'warning'};
    if(n<=7)return {key:'week',label:`Vence en ${n} días`,cls:'warning'};
    return {key:'ok',label:'Vigente',cls:'ok'}
  };
  ```

- **Dashboard Counters** (Lines 86-90):
  - Total items: `products.length`
  - Vencidos: `status.key === 'expired'` (n < 0)
  - Vencen en 3 días: `status.key === 'soon'` (0 <= n <= 3)
  - Vencen en 7 días: `0 <= n <= 7`

- **Portability & Export** (Lines 104-108):
  - CSV Export: UTF-8 with BOM (`\ufeff`), delimiter `;`, quote-escaped.
  - JSON Backup: JSON file with `{ app: 'StockControl Vencimientos', version: 1, exportedAt, products }`.
  - JSON Restore: parses file and replaces `localStorage` array.

- **Color Palette & Design Tokens** (Lines 15-20):
  - `--brown: #75472f`
  - `--brown2: #9a623e`
  - `--cream: #fff8ef`
  - `--ink: #302821`
  - `--muted: #7c7168`
  - `--line: #eadfd2`
  - `--green: #4c7860`
  - `--blue: #dfe9f7`
  - `--red: #b84035`
  - `--amber: #a56b15`
  - Page Background: `#f7f2eb`
  - Header: `linear-gradient(135deg,#69412d,#9a623e)` with curved corners `border-radius: 0 0 24px 24px`.

### 1.5 Environment Configuration (`.env`)
The file `.env` contains:
```ini
PUBLIC_FIREBASE_API_KEY=AIzaSyBPp8SQcFoVsS0uczaMQNANZ2iFlUf8-bc
PUBLIC_FIREBASE_AUTH_DOMAIN=stockcontrol-86bb7.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=stockcontrol-86bb7
PUBLIC_FIREBASE_STORAGE_BUCKET=stockcontrol-86bb7.firebasestorage.app
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=196470947864
PUBLIC_FIREBASE_APP_ID=1:196470947864:web:cb6d7cf6684bcb9ac3436d
PUBLIC_FIREBASE_MEASUREMENT_ID=G-MNEZ8T6841
```
Note: The variables already follow the SvelteKit client-side convention (`PUBLIC_` prefix for `$env/static/public`). `.gitignore` already ignores `.env` and `.env.*` while retaining `!.env.example`.

### 1.6 Existing PWA Manifest & Service Worker
- `manifest.json`: references `./index.html`, display `standalone`, orientation `portrait`, theme `#75472f`, background `#f7f2eb`, icons `./assets/icon-192.png` and `./assets/icon-512.png`.
- `sw.js`: basic Cache-First service worker with hardcoded cache name `stockcontrol-vencimientos-v1` and file list `['./', './index.html', './manifest.json', './assets/logo-stockcontrol.png', './assets/icon-192.png', './assets/icon-512.png']`.

---

## 2. Logic Chain

1. **Premise 1**: The user requests a production-grade, collaborative PWA built with Svelte/SvelteKit, offline persistence via Firebase Firestore ($0 cost), and continuous deployment to Render Static Site ($0 cost).
2. **From Observation 1.1 & 1.4**: The current project is a prototype consisting of a standalone `index.html` file using `localStorage`. It lacks multi-user collaboration, operator traceability, camera scanning, split-screen tablet layout, and a modern build pipeline.
3. **From Observation 1.2 & 1.3**: Node.js `v24.11.1` and npm `11.6.2` are installed and ready. Git is initialized on `main` branch with remote `https://github.com/Rydozz15/stockcontrol-pwa.git`, which is accessible.
4. **From Observation 1.5**: The `.env` file already contains pre-configured public Firebase credentials targeting project `stockcontrol-86bb7`.
5. **Architectural Deduction**: To satisfy Requirements R1-R4 without breaking existing prototype behavior:
   - The project must be structured as a SvelteKit application using `@sveltejs/adapter-static` with client-side fallback `fallback: 'index.html'` and `ssr = false`, allowing it to compile into pure static files in `build/` for Render ($0 free tier).
   - Domain logic (expiry classification, metrics calculation, day differences, date formatting) must be extracted into pure TypeScript functions under `src/lib/domain/`, preserving exact calculations from lines 79-81 of `index.html` while expanding with waste and audit models.
   - The data layer must implement a `ProductRepository` under `src/lib/repositories/` backed by Firebase Firestore with offline cache persistence (`initializeFirestore` with `persistentLocalCache` and `persistentMultipleTabManager`), supporting seamless realtime multi-device sync across kitchen workspaces.
   - Ergonomics (bottom navigation bar, FAB, >=44px touch targets, quick expiry chips `+2d, +3d, +1w, +1m`, 1-tap consumption/waste buttons, tablet split-screen >=768px, camera scanner) must be composed as modular Svelte components under `src/lib/components/`.
   - Existing brand assets (`assets/logo-stockcontrol.png`, `assets/icon-192.png`, `assets/icon-512.png`) and updated `manifest.json` must be located in `static/` to be served statically and cached by the PWA service worker.

---

## 3. Caveats

1. **Remote Firestore Security Rules**: Live security rules on the Firebase Firestore console for `stockcontrol-86bb7` cannot be inspected via local files. The implementation must assume standard open development rules or provide recommended security rules for `workspaces/{workspaceId}/**`.
2. **Camera Hardware Availability**: In desktop browser environments or environments without video input devices, `navigator.mediaDevices.getUserMedia` may reject; a fallback manual code entry or photo upload mechanism is required alongside the Barcode Detection API / html5-qrcode.
3. **Git History**: There are currently 0 commits on the `main` branch. The initial commit should properly capture the new SvelteKit codebase and static assets while preserving documentation.

---

## 4. Conclusion

The existing project has a solid visual and functional conceptual base in `index.html`, with defined culinary categories, storage locations, status thresholds, and color palettes. However, it is an isolated single-device prototype with no build tools.

### Recommended Target Architecture:

```text
StockControl_App_Telefono/
├── .env                                # Firebase credentials (existing)
├── .env.example                        # Template (existing)
├── .gitignore                          # Configured for SvelteKit & build artifacts
├── render.yaml                         # Render Static Site Infrastructure-as-Code
├── package.json                        # Dependencies & build scripts
├── svelte.config.js                    # Adapter-static config (fallback: 'index.html')
├── vite.config.ts                      # Vite build configuration
├── tsconfig.json                       # TypeScript compiler options
├── README.md                           # Updated architectural & user documentation
├── static/
│   ├── assets/
│   │   ├── logo-stockcontrol.png       # 1521x1521 logo
│   │   ├── icon-192.png                # 192x192 PWA icon
│   │   └── icon-512.png                # 512x512 PWA icon
│   ├── favicon.png                     # Browser favicon
│   └── manifest.json                   # Web App Manifest (PWA standalone)
└── src/
    ├── app.html                        # Base HTML template with viewport-fit=cover
    ├── service-worker.ts               # SvelteKit PWA cache-first service worker
    ├── routes/
    │   ├── +layout.ts                  # prerender = true, ssr = false (SPA mode)
    │   ├── +layout.svelte              # Shell (Header, Split-Screen Grid, BottomNav, Toasts)
    │   └── +page.svelte                # Reactive view orchestrator (Inventory, Scanner, Alerts, History)
    └── lib/
        ├── domain/                     # Pure domain logic (Clean Architecture)
        │   ├── models.ts               # Product, Workspace, Operator, WasteLog, ExpiryStatus
        │   ├── expiry.ts               # Expiry calculations, dayDiff, reactive status categorization
        │   └── waste.ts                # Consumption & waste tracking rules
        ├── repositories/               # Data access layer
        │   ├── firebase.ts             # Firebase app & Firestore with offline persistent cache
        │   └── productRepository.ts    # Firestore CRUD, realtime listeners, audit stamping
        ├── stores/                     # Reactive stores
        │   ├── workspaceStore.ts       # Workspace code & operator alias (persisted in localStorage)
        │   ├── inventoryStore.ts       # Realtime Firestore synced inventory store
        │   ├── metricsStore.ts         # Derived counters (total, expired, soon 3d, week 7d)
        │   ├── connectivityStore.ts    # Online/offline network status detection
        │   └── toastStore.ts           # Feedback messages
        └── components/                 # Ergonomic UI components
            ├── Header.svelte           # Top header with logo, workspace code, online/offline pill
            ├── MetricsDashboard.svelte # 4 reactive counter cards
            ├── ProductCard.svelte      # Kitchen-friendly card, >=44px buttons, 1-tap consume/waste
            ├── ProductForm.svelte      # Fast entry modal/drawer with quick date shortcuts (+2d, +3d, +1w, +1m)
            ├── CameraScanner.svelte    # Barcode/QR camera reader (BarcodeDetector / html5-qrcode)
            ├── BottomNav.svelte        # Fixed bottom navigation bar for mobile thumb reach
            ├── WorkspaceModal.svelte   # Zero-friction workspace code and operator alias setup
            ├── WasteHistory.svelte     # Audit trail and waste log list
            └── ExportImportModal.svelte# UTF-8 BOM CSV & JSON backup/restore
```

### Recommended Dependencies:
- **Core Framework**: `svelte` (^5.x), `@sveltejs/kit` (^2.x or ^3.x), `@sveltejs/adapter-static` (^3.x), `vite` (^5.x / ^6.x), `typescript` (^5.x)
- **Data & Cloud**: `firebase` (^11.x)
- **Scanner**: `html5-qrcode` (^2.3.8)
- **Icons**: `lucide-svelte` (^1.0.0 or inline SVGs for zero latency)

---

## 5. Verification Method

To independently verify the observations and validate the proposed migration:

1. **Verify Existing Repository State**:
   ```bash
   cd /home/rydozz/Documents/Proyectos/StockControl_App_Telefono
   git status
   git remote -v
   git ls-remote origin
   ```
   *Expected outcome*: Main branch with no commits, untracked files including `index.html`, remote pointing to `https://github.com/Rydozz15/stockcontrol-pwa.git` responding successfully.

2. **Verify Node & Package Environment**:
   ```bash
   node -v
   npm -v
   ```
   *Expected outcome*: Node >= 20 (observed `v24.11.1`), npm >= 10 (observed `11.6.2`).

3. **Verify Prototype Logic Equivalence**:
   Inspect lines 76-111 of `index.html` to confirm that domain logic in `src/lib/domain/expiry.ts` matches the prototype calculation:
   - Expired: `dayDiff < 0`
   - Vence hoy: `dayDiff === 0`
   - Vence en <= 3 días: `0 < dayDiff <= 3`
   - Vence en <= 7 días: `3 < dayDiff <= 7`
   - Vigente: `dayDiff > 7`

4. **Verify SvelteKit Build Target**:
   After scaffold/implementation, run:
   ```bash
   npm run build
   ```
   *Expected outcome*: Generates static directory `build/` containing `index.html`, `manifest.json`, `assets/`, and bundled assets with exit code 0.
