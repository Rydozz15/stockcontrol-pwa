# DISPATCH: explorer_m4_1

## Mission
Investigate and design the Dual-Engine Camera Scanner and Barcode Integration for Milestone 4 (Features 19, 20, 21).

## Scope & Architectural Requirements
1. **Camera Scanner Component (`src/lib/components/CameraScanner.svelte`)**:
   - Modern mobile camera viewport with target scan reticle / guide overlay.
   - Dual-engine detection strategy:
     - Primary: Native browser `BarcodeDetector` API (`'BarcodeDetector' in window`) supporting formats: `ean_13`, `ean_8`, `qr_code`, `code_128`, `upc_a`, `upc_e`.
     - Secondary: Fallback to `html5-qrcode` library (check if installed in `package.json` or available in project dependencies; if not, design robust fallback or evaluate packaging).
   - Camera Lifecycle:
     - Request `video: { facingMode: 'environment' }`.
     - Explicit stop & track cleanup on component unmount or modal close (`stream.getTracks().forEach(track => track.stop())`) to ensure green camera indicator light in OS turns off immediately.
     - Flashlight/torch toggle support when `track.getCapabilities()?.torch` is available.
     - Error handling: camera permission denied, camera not found, insecure context (HTTP vs HTTPS).
2. **Barcode Lookup & Form Integration (Feature 20)**:
   - On barcode scan:
     - Search existing products in `$inventoryStore.products` by `barcode` (or lot/id).
     - If product found: open quick consume/action modal or highlight in inventory with a toast.
     - If product not found: open `ProductForm` with `barcode` pre-filled so the user can quickly register the new product.
   - Design wiring into `BottomNav.svelte` (the "Scanner" tab) and `ProductForm.svelte` (the `.btn-scan-trigger` camera button).
3. **Ergonomics & Touch Targets**:
   - Close button, torch toggle, and camera flip buttons must all be >= 44x44px per WCAG 2.5.5 Level AAA.

Write your complete architectural plan, component templates, and implementation steps to `.agents/teamwork/explorer_m4_1/handoff.md` and notify with `send_message`.

## 2026-10-26T01:28:30Z
Acknowledged mission: Investigate and design CameraScanner.svelte, the dual-engine detection architecture, lifecycle cleanup, torch controls, and barcode-to-product lookup integration for Milestone 4 (Features 19, 20, 21).
