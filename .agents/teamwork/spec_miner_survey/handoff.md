# Specification Mining Report: UX/UI Ergonomics, Camera Scanner, PWA & Render Deployment

**Agent**: `spec_miner_survey` (UX & PWA Specification Miner)  
**Target Project**: StockControl PWA (`/home/rydozz/Documents/Proyectos/StockControl_App_Telefono`)  
**Date**: 2026-10-25T20:22:00Z  
**Parent**: `1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c`

---

## 1. Observation

Direct observations from the project workspace, authoritative request, and web platform standards:

1. **Authoritative Request (`ORIGINAL_REQUEST.md`)**:
   - `R3. Experiencia de Usuario (UX) Móvil, Tablet y Ergonomía de Cocina`:
     - Fixed bottom navigation bar with one-handed touch icons: `[Inventario / Vencimientos]`, `[Escáner de Cámara]`, `[Alertas Críticas]`, `[Historial / Ajustes]`.
     - Floating Action Button (FAB) for rapid product creation.
     - Quick expiry date shortcut buttons: `+2 días`, `+3 días`, `+1 semana`, `+1 mes`.
     - 1-tap consumption and waste/merma flow directly on item cards.
     - Integrated camera barcode & QR scanner (Barcode Detection API / web scanning fallback) for instant lookup/preload.
     - Split-screen adaptive layout on screens `>= 768px` (tablets/desktops).
     - Safe-area insets (`viewport-fit=cover`, `env(safe-area-inset-*)`) for iOS notch and Android navigation bars.
   - `R4. Configuración PWA Nativa y Despliegue $0 en Render`:
     - Static build with `@sveltejs/adapter-static` for Render Static Site ($0 cost, automatic HTTPS, zero sleep/cold start).
     - Web App Manifest (`manifest.json`) in `standalone` mode with gastronomic theme colors (`#75472f`, `#f7f2eb`).
     - Service worker caching static assets and offline shell.
     - Contingency data export/import: CSV (UTF-8 with BOM and `;` delimiter) and JSON backup.
     - Continuous deployment via commit & push to branch `main` of `https://github.com/Rydozz15/stockcontrol-pwa.git`.
   - `Acceptance Criteria (lines 57-75)`:
     - Multi-device real-time sync with operator audit trail.
     - Airplane mode offline persistence with auto-sync upon reconnection.
     - Camera scanner detecting EAN-13 and QR codes with instant lookup/preload.
     - Thumb-accessible bottom navigation with touch targets `>= 44x44px`.
     - Tablet split-screen layout at `>= 768px`.
     - Static build verification (`npm run build`) and Render configuration.

2. **Existing Prototype Inspection (`index.html`, `manifest.json`, `sw.js`, `assets/`)**:
   - `manifest.json`: Single-file prototype has `name: "StockControl - Control de Vencimientos"`, `short_name: "StockControl"`, `start_url: "./index.html"`, `display: "standalone"`, `orientation: "portrait"`, `theme_color: "#75472f"`, `background_color: "#f7f2eb"`, and icons `assets/icon-192.png` and `assets/icon-512.png`.
   - `assets/`: Valid high-resolution PNGs exist: `icon-192.png` (192x192), `icon-512.png` (512x512), and `logo-stockcontrol.png` (1521x1521).
   - `index.html`: Desktop/mobile single-column layout lacking bottom navigation bar, FAB, camera scanning, and tablet split-screen. Products are stored in `localStorage` under `stockcontrol_expiry_v1`.
   - No `package.json` exists in project root yet; needs migration to SvelteKit with `@sveltejs/adapter-static`.
   - Git remote is configured to `https://github.com/Rydozz15/stockcontrol-pwa.git` on branch `main`.

3. **Hardware & API Capabilities**:
   - `BarcodeDetector` API: Part of the W3C Shape Detection API. Natively supported in Chromium (Android Chrome, Edge, Opera), but **not enabled by default in iOS Safari**. Therefore, a dual-engine architecture (Native `BarcodeDetector` when available + lightweight JS fallback like `html5-qrcode` or `@zxing/library`) is strictly required.
   - `navigator.mediaDevices.getUserMedia`: Requires HTTPS or `localhost`, handles permissions (`NotAllowedError`, `NotFoundError`), and exposes torch capabilities via `MediaStreamTrack.applyConstraints`.

---

## 2. Logic Chain

From the observations, the technical architecture and ergonomic requirements are deduced as follows:

1. **Kitchen Ergonomic Reality**:
   - Kitchen staff work in fast-paced, high-pressure environments, frequently wearing disposable or heat gloves, with wet or floured fingers, and one hand occupied holding containers.
   - Placing critical actions at the top of a 6.7-inch mobile screen causes hand strain and accidental drops.
   - **Deduction**: The Thumb Zone (lower 40% of screen) must host all daily navigation (`[Inventario]`, `[Escáner]`, `[Alertas]`, `[Historial]`) and primary creation action (FAB). Interactive elements must enforce a minimum 44x44 CSS px touch target with 8px margin spacing to prevent fat-finger miss-taps.

2. **Speed in Expiry Dating**:
   - Typing or opening a datepicker calendar requires 4 to 6 taps and precise aiming. In a restaurant prep shift, entering 30 prepped containers would take prohibitive time.
   - **Deduction**: 4 quick-expiry preset buttons (`+2d`, `+3d`, `+1w`, `+1m`) reduce date entry from 6 taps to 1 tap. Leap years and variable month lengths must be computed cleanly via standard JavaScript `Date` offsets without timezone skew.

3. **1-Tap Inventory Depletion & Waste Accounting**:
   - Standard inventory systems force users into "Edit item -> Change number -> Save". This causes cooks to skip logging, destroying stock accuracy.
   - **Deduction**: Item cards in the list must feature direct 1-tap "Consumir 1" (which decrements quantity and triggers an Undo toast) and "Merma" (which opens a quick bottom-sheet to register discarded quantity and cause: expired, spoiled, spilled).

4. **Split-Screen Tablet Adaptability**:
   - Kitchens often mount iPad or Android tablets above the prep line or receiving counter (`width >= 768px`).
   - Single-column phone layouts waste 60% of horizontal space on tablets.
   - **Deduction**: A CSS media query breakpoint `@media (min-width: 768px)` will switch the interface to a two-pane master-detail view: the left pane (380-420px) displays the scrollable, filterable product list and metric summary, while the right pane displays the active product's full card, batch history, operator audit log, and instant actions.

5. **Camera Scanner Dual-Engine Architecture**:
   - Chefs receive boxes with EAN-13 barcodes and prepped batch containers labeled with QR codes.
   - Relying solely on `BarcodeDetector` breaks on iOS Safari. Relying solely on heavy external libraries degrades Android performance.
   - **Deduction**: The camera component must probe `window.BarcodeDetector`. If available and supporting `ean_13` and `qr_code`, it uses native hardware acceleration. Otherwise, it delegates to an embedded fallback (`html5-qrcode` / `@zxing/browser`). All camera streams must be stopped upon modal exit or Svelte component unmount to free the camera hardware and indicator light.

6. **PWA Offline Shell & Static Deployment**:
   - Cold storage rooms (walk-in freezers/refrigerators) often act as Faraday cages with 0% WiFi signal.
   - Firebase Firestore supports client-side IndexedDB caching (`persistentLocalCache`), but the web application shell (HTML, CSS, JS, icons) will fail to load if not cached by a Service Worker.
   - **Deduction**: SvelteKit's native `src/service-worker.js` with `$service-worker` precaches all immutable build chunks and static assets. The Service Worker intercepts static requests with Cache-First, while allowing Firestore network traffic to pass through untouched.
   - Render Static Site hosting provides $0 monthly cost, global CDN edge caching, and zero idle spin-down. Using `@sveltejs/adapter-static` with `fallback: 'index.html'` ensures deep link client-side routing works reliably.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | UX/UI Navigation | Bottom Navigation Bar | Fixed thumb-friendly navigation bar anchored to viewport bottom with 4 primary views: Inventario, Escáner, Alertas Críticas, Historial/Ajustes. | User touch / click on navigation tab items. | Active view state change, visual highlight with badge counts. | Fallback to default `inventario` if route is unknown. | ORIGINAL_REQUEST.md § R3 |
| 2 | UX/UI Ergonomics | Touch Target Standard (>=44x44px) | All interactive controls (buttons, inputs, filters, tabs) have a minimum bounding box of 44x44 CSS px with >=8px margin separation. | User touch / tap events. | Immediate visual feedback (active/pressed state). | Prevents mis-taps on small screens with wet/greasy fingers. | ORIGINAL_REQUEST.md § AC & WCAG 2.5.5 |
| 3 | UX/UI Ergonomics | Floating Action Button (FAB) | Persistent high-visibility circular action button (>=56x56px) positioned bottom-right above the bottom navigation bar for instant product entry. | Tap on FAB. | Opens product registration modal / sheet with auto-focused name. | Disables when modal is already active. | ORIGINAL_REQUEST.md § R3 |
| 4 | UX/UI Ergonomics | Quick Expiry Presets (+2d, +3d, +1w, +1m) | 1-touch date preset buttons in the product form to set expiry date without opening native datepickers. | Tap on preset button (`+2d`, `+3d`, `+1w`, `+1m`). | Populates `expiry` input in `YYYY-MM-DD` format relative to today. | Date bounds validation (cannot set past dates). | ORIGINAL_REQUEST.md § R3 |
| 5 | UX/UI Ergonomics | 1-Tap Quick Consumption | Direct action button on product cards to decrement available quantity by 1 with optimistic UI update and undo snackbar. | Tap on "Consumir 1". | `quantity` decremented by 1; audit log entry recorded; undo toast displayed (4s). | If `quantity <= 1`, asks confirmation to archive as exhausted. | ORIGINAL_REQUEST.md § R3 |
| 6 | UX/UI Ergonomics | 1-Tap Waste/Merma Logging | Direct action button on product cards to log discarded food items, cause of waste, operator, and quantity. | Tap on "Merma"; select reason (Vencido, Dañado, Contaminado) and amount. | Product quantity decremented/archived; event saved to `history` collection. | Validation: waste quantity cannot exceed remaining stock. | ORIGINAL_REQUEST.md § R3 & R1 |
| 7 | UX/UI Ergonomics | Tablet Split-Screen Layout (>=768px) | Responsive two-pane master-detail interface on tablet and desktop screens (`@media (min-width: 768px)`). | Screen resize or viewport width >= 768px. | Master product list on left (40% width); active item details/editor on right (60% width). | On screens < 768px, gracefully degrades to single-column stacked view. | ORIGINAL_REQUEST.md § R3 & AC |
| 8 | UX/UI Ergonomics | Safe-Area Inset Handling | CSS environment rules (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) protecting UI from notches and system gesture bars. | Device safe-area environment variables. | Clean layout spacing on iPhone (notch, home pill) and Android edge-to-edge. | Falls back to default padding (12px-16px) if unsupported. | ORIGINAL_REQUEST.md § R3 |
| 9 | Hardware / Camera | Barcode Detection API Scanner | Native hardware-accelerated barcode detection using browser `BarcodeDetector` for EAN-13, QR Code, Code 128. | Live `<video>` camera stream. | Detected code string and barcode format object. | If API is absent or formats unsupported, falls back to library scanner. | ORIGINAL_REQUEST.md § R3 & W3C Spec |
| 10 | Hardware / Camera | Scanner Library Fallback (iOS/Legacy) | JavaScript/WASM scanning fallback (e.g. `html5-qrcode` or `@zxing/library`) ensuring universal iOS Safari and older Android compatibility. | Video frame canvas data. | Decoded barcode string. | Emits "No barcode detected" per frame until valid scan. | ORIGINAL_REQUEST.md § R3 & Browser Matrix |
| 11 | Hardware / Camera | Instant Lookup & Product Preload | Automatic matching of scanned barcode against workspace inventory; opens existing card or pre-fills new item form. | Scanned barcode string. | Matched product card OR new product form prefilled with scanned barcode. | Shows "Código no encontrado; registrar nuevo" prompt. | ORIGINAL_REQUEST.md § R3 & AC |
| 12 | Hardware / Camera | Camera Lifecycle & Stream Teardown | Explicit stopping of camera video tracks (`track.stop()`) on modal close, tab change, or component destruction. | Modal close event, page navigation, component `onDestroy`. | Camera sensor deactivated, green privacy LED turned off. | Prevents camera lockup and heavy battery drain in background. | WebRTC MediaStream Spec |
| 13 | Hardware / Camera | Camera Permission & Error Recovery | User guidance for camera permission grant, device-not-found, or hardware-in-use errors with manual code input fallback. | Browser `getUserMedia` exception. | Informative error dialog + instant manual barcode text input. | Handles `NotAllowedError`, `NotFoundError`, `NotReadableError`. | W3C MediaDevices Spec |
| 14 | Hardware / Camera | Flashlight / Torch Toggle | On-screen button to activate device LED flash for scanning in dark walk-in refrigerators or dry store rooms. | Tap on torch icon. | Video track constraint applied `{ advanced: [{ torch: true/false }] }`. | Button hidden if camera hardware lacks torch capability. | W3C MediaStreamTrack Spec |
| 15 | PWA & Offline | Web App Manifest (`manifest.json`) | W3C Web App Manifest specifying standalone mode, culinary branding (`#75472f`, `#f7f2eb`), icons (192px/512px), and orientation. | Browser install prompt / Add to Home Screen. | Fullscreen app shell without browser address bar. | Browser falls back to standard tabbed web app if rejected. | ORIGINAL_REQUEST.md § R4 |
| 16 | PWA & Offline | SvelteKit Native Service Worker | Precaching of app shell bundles (`$service-worker` build/files), cache-first routing for assets, offline fallback. | Network fetch events. | Cached responses served with 0ms latency when offline. | Non-GET and Firestore network requests bypass cache. | SvelteKit `$service-worker` Spec |
| 17 | PWA & Offline | Offline Network Indicator Banner | Persistent status pill/banner indicating whether the device is online or offline in walk-in cold rooms. | `window.ononline` / `window.onoffline` events. | Visual indicator: "Modo Offline — Datos guardados localmente". | Auto-hides when connection is restored and synced. | ORIGINAL_REQUEST.md § R2 |
| 18 | Data Contingency | UTF-8 BOM CSV Export | Generates RFC 4180 compliant CSV with `\uFEFF` Byte Order Mark and `;` separator for direct Excel opening in Spanish locale. | Click "Exportar CSV". | Triggered file download `stockcontrol-inventario-YYYY-MM-DD.csv`. | Handles multiline notes, quotes, commas, and accents cleanly. | ORIGINAL_REQUEST.md § R4 |
| 19 | Data Contingency | JSON Backup & Restoration | Full structured JSON import/export containing products, workspace metadata, and audit logs. | File upload `.json` or click "Guardar Respaldo". | Restores or downloads complete workspace data snapshot. | Validates schema integrity; alerts user before replacing data. | ORIGINAL_REQUEST.md § R4 |
| 20 | Deployment | SvelteKit Static Adapter Build | Configures `@sveltejs/adapter-static` with SPA fallback (`fallback: 'index.html'`) for zero-cost static hosting. | `npm run build` execution. | Static HTML/JS/CSS assets emitted to `build/` directory. | Build fails with strict check if dynamic routes lack prerendering. | SvelteKit Adapter Static Spec |
| 21 | Deployment | Render Static Site Configuration | Infrastructure-as-code configuration (`render.yaml`) specifying $0 monthly cost, continuous deploy from GitHub main. | Git push to `main` branch. | Automatic Render CDN deployment with SSL and zero sleep down-time. | Build log reporting build errors on failed compilation. | ORIGINAL_REQUEST.md § R4 |

---

## 4. Edge Cases

| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---------|-------------------|------------------------------|
| 1 | Quick Expiry (`+1m`) | Current date is January 31st | Date calculation must clamp or overflow correctly to the last day of February (e.g. Feb 28/29) rather than skipping to March 3. JavaScript `setMonth(m + 1)` requires sanitization. |
| 2 | Quick Expiry (`+1w` or `+2d`) | Leap year date (e.g. Feb 28 on leap year) | Uses native JS `Date(d.getTime() + N*86400000)` to ensure leap days (Feb 29) are handled without date corruption. |
| 3 | Touch Targets | Multi-touch or rapid double-taps on "Consumir 1" | Must debounce action or disable button for 350ms to prevent duplicate rapid decrements when fingers are greasy. |
| 4 | Safe Area Insets | Landscape rotation on iPhone with dynamic island / notch | Header and navigation must include horizontal safe area paddings (`padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right)`) to prevent notch clipping. |
| 5 | Camera Scanner | User denies camera permission (`NotAllowedError`) | Display friendly UI: "Permiso de cámara denegado. Puedes ingresar el código manualmente o habilitar la cámara en los ajustes del navegador", showing instant manual input. |
| 6 | Camera Scanner | No camera hardware detected (`NotFoundError`) | Scanner modal automatically switches to barcode search input without crashing or infinite loading spinner. |
| 7 | Camera Scanner | Camera locked by another application (`NotReadableError`) | Display message: "La cámara está siendo usada por otra aplicación. Por favor ciérrala y vuelve a intentar." |
| 8 | Camera Scanner | Rapid scanning of same barcode 30 times a second | After first successful detection, scanner must immediately pause detection loop and play haptic feedback to prevent 30 duplicate queries. |
| 9 | Camera Scanner | iOS Safari without native `BarcodeDetector` | Component detects absence of `BarcodeDetector` in `window` and activates `html5-qrcode` / ZXing canvas decoding pipeline seamlessly. |
| 10 | Camera Scanner | Low light environment in walk-in cold room | Scanner UI provides a Flash/Torch toggle button using `track.applyConstraints({ advanced: [{ torch: true }] })` (hidden if unsupported). |
| 11 | Tablet Split-Screen | User resizes browser window across 768px threshold | Responsive layout transitions fluidly between single-column and split-view without losing selected product state or form input values. |
| 12 | PWA Offline Mode | User loads app in airplane mode in a walk-in freezer | Service Worker serves cached `index.html` and assets from Cache Storage; app boots immediately and displays "Modo Offline" banner. |
| 13 | Service Worker & Firebase | Firestore real-time listener active when offline | Service Worker must NOT attempt to cache `firestore.googleapis.com` or Google auth endpoints; Firebase SDK's own IndexedDB persistent cache manages offline writes. |
| 14 | CSV Export | Product name contains semicolons (`;`), quotes (`"`), or line breaks | RFC 4180 escaping: wrap string in double quotes and replace `"` with `""`. File begins with UTF-8 BOM (`\uFEFF`) so Excel opens special characters (ñ, á, é) cleanly. |
| 15 | Render Static Hosting | User accesses deep link or refreshes `/scanner` or `/ajustes` | Static server must rewrite `/*` to `/index.html` (or serve `fallback: 'index.html'`) so SvelteKit client-side router handles navigation without HTTP 404. |

---

## 5. Caveats

1. **Camera Permissions over Insecure Contexts**: The `navigator.mediaDevices.getUserMedia` and `BarcodeDetector` APIs are strictly restricted by browser security policies to Secure Contexts (`HTTPS` or `localhost`). Local testing on a physical mobile device over local Wi-Fi (e.g. `http://192.168.1.X:5173`) will reject camera access unless served over HTTPS or accessed via Chrome's `unsafely-treat-insecure-origin-as-secure` flag, or via an HTTPS tunnel (e.g. ngrok or Render staging).
2. **iOS Safari Fullscreen PWA Behavior**: When a PWA is installed to the iOS Home Screen (standalone mode), navigation away from the domain opens Safari unless internal links use client-side routing. SvelteKit's single-page app architecture avoids full page reloads and remains within the standalone container.
3. **Hardware Torch Availability**: Torch control (`advanced: [{ torch: true }]`) is only supported on Chromium-based Android browsers and select iOS Safari versions. The UI button must be conditionally rendered based on `capabilities.torch`.

---

## 6. Conclusion

The specification survey confirms that transforming StockControl into a collaborative, professional-grade mobile/tablet PWA requires a cohesive UX and infrastructure architecture:

1. **Ergonomic Design**: Anchoring navigation to a thumb-accessible Bottom Nav Bar, implementing a prominent FAB, enforcing 44x44px minimum touch targets, providing 1-tap quick expiry presets (`+2d`, `+3d`, `+1w`, `+1m`), and enabling 1-tap consumption and waste logging directly on cards fulfills the high-tempo requirements of commercial kitchens.
2. **Adaptive Master-Detail**: Supporting split-screen master-detail layout at `>= 768px` maximizes productivity on kitchen counter tablets.
3. **Resilient Hardware Scanner**: Implementing a dual-engine camera scanner (Native `BarcodeDetector` + `html5-qrcode` / ZXing fallback) guarantees universal compatibility across Android and iOS devices with instant lookup and preload.
4. **PWA Offline Resilience**: Pairing SvelteKit's native Service Worker (`$service-worker`) with Firestore's IndexedDB persistence ensures the app loads and functions completely offline in walk-in cold rooms.
5. **Zero-Cost Production Deployment**: Utilizing `@sveltejs/adapter-static` with an SPA fallback (`index.html`) on Render Static Site delivers a 100% free ($0/month), high-performance CDN deployment that never sleeps, with continuous deployment tied to the GitHub `main` branch.

---

## 7. Verification Method

To independently verify the implementation against this specification:

### A. Mobile Ergonomics & Layout Verification
1. **Touch Target Inspection**:
   - In Chrome DevTools / Lighthouse, run an Accessibility audit.
   - Verify that all buttons, inputs, tabs, and FAB meet or exceed `44x44px` with at least `8px` spacing.
2. **Safe Area Insets**:
   - Inspect elements in responsive device mode (iPhone 14 / iPhone 15 Pro) with notch simulation.
   - Verify `env(safe-area-inset-bottom)` prevents the bottom navigation and FAB from colliding with the home indicator.
3. **Split-Screen Breakpoint**:
   - Toggle viewport width below and above `768px`.
   - Verify `>= 768px` renders side-by-side list and detail panels, while `< 768px` renders stacked view.
4. **Quick Expiry Buttons**:
   - Click `+2d`, `+3d`, `+1w`, `+1m`. Verify the calculated date matches `today + offset` in `YYYY-MM-DD` format.
5. **1-Tap Actions**:
   - Click "Consumir 1" on an item; verify quantity decrements by 1 and an Undo toast appears for 4 seconds.
   - Click "Merma"; verify the discard modal captures reason and updates stock and waste history.

### B. Camera Barcode & QR Scanner Verification
1. **Native / Fallback Detection**:
   - In desktop Chrome or Android, verify `BarcodeDetector` is queried.
   - In Safari or with `window.BarcodeDetector = undefined`, verify fallback scanner activates cleanly.
2. **Supported Formats**:
   - Test with standard EAN-13 food barcode (e.g. `7801234567890`) and QR code URL/text.
   - Verify successful scan triggers haptic vibration and sound feedback.
3. **Lookup / Preload**:
   - Scan an existing item barcode -> verify product detail card opens.
   - Scan an uncataloged barcode -> verify product creation form opens with `lot`/`code` pre-populated.
4. **Stream Teardown**:
   - Close scanner modal; verify the browser camera indicator light turns off immediately.

### C. PWA Offline & Service Worker Verification
1. **Manifest Validation**:
   - In DevTools -> Application -> Manifest, verify name, short_name, theme_color (`#75472f`), background_color (`#f7f2eb`), `display: standalone`, and icons (192px and 512px) pass validation without errors.
2. **Service Worker Offline Test**:
   - In DevTools -> Application -> Service Workers, verify worker is registered and active.
   - Check "Offline" in Network tab, reload page (`Ctrl+R` / `Cmd+R`).
   - Verify application loads completely from cache and displays "Modo Offline" banner.

### D. Static Build & Render Deployment Verification
1. **Static Build Execution**:
   - Run `npm run build` in terminal.
   - Verify build succeeds with exit code 0.
   - Verify `build/index.html` and `build/_app/` are generated.
2. **SPA Deep Link Verification**:
   - Serve `build/` using `npx serve -s build` or `python3 -m http.server`.
   - Navigate to `/` and reload; navigate to deep link; verify no 404 occurs.
3. **Git & Render Sync**:
   - Verify `git remote -v` points to `https://github.com/Rydozz15/stockcontrol-pwa.git`.
   - Verify `render.yaml` or Render Static Site dashboard specifies build command `npm install && npm run build` and publish directory `build`.
