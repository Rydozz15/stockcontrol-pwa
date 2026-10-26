# Integration Plan: CameraScanner & Barcode Lookup in `src/routes/+page.svelte`

## 1. Imports Addition
```typescript
import CameraScanner from '$lib/components/CameraScanner.svelte';
import { lookupBarcode } from '$lib/domain/barcode';
```

## 2. State Variables
```typescript
// Camera Scanner & Instant Barcode Matching
let isScannerModalOpen: boolean = false;
let scannerPrefillBarcode: string = '';
let matchedScannedProduct: ProductItem | null = null;
let isQuickMatchModalOpen: boolean = false;
```

## 3. Barcode Detection & Routing Logic
```typescript
function handleScanDetected(event: CustomEvent<{ code: string; format: string }>) {
  const { code } = event.detail;
  const lookup = lookupBarcode(code, $inventoryStore.products);

  if (lookup.found && lookup.product) {
    // 1. Existing Product Found: Open instant action card
    matchedScannedProduct = lookup.product as ProductItem;
    isQuickMatchModalOpen = true;
    isScannerModalOpen = false;
    toastStore.success(`Encontrado: ${lookup.product.name}`);
  } else {
    // 2. Unknown Barcode: Prefill registration form and open ProductForm
    scannerPrefillBarcode = code;
    isScannerModalOpen = false;
    productToEdit = null;
    isFormOpen = true;
    toastStore.info(`Código detectado (${code}). Ingresa los datos del producto.`);
  }
}
```

## 4. Replacement of Static Scanner Tab Placeholder (Lines 458-463)
**Before:**
```svelte
      {:else if activeTab === 'scanner'}
        <div class="tab-placeholder" role="tabpanel" id="tabpanel-scanner" aria-labelledby="nav-tab-scanner">
          <span class="placeholder-icon">📷</span>
          <h2>Escáner de Código de Barras y QR</h2>
          <p>Módulo de lectura dual nativa BarcodeDetector y cámara web fallback html5-qrcode (Milestone 4).</p>
        </div>
```

**After:**
```svelte
      {:else if activeTab === 'scanner'}
        <div class="scanner-tab-view" role="tabpanel" id="tabpanel-scanner" aria-labelledby="nav-tab-scanner">
          <CameraScanner
            mode="inline"
            isOpen={activeTab === 'scanner'}
            on:scan={handleScanDetected}
          />
        </div>
```

## 5. Wiring into `ProductForm` (Lines 792-800)
**Before:**
```svelte
  <ProductForm
    bind:isOpen={isFormOpen}
    {productToEdit}
    on:save={handleSaveProduct}
    on:close={() => {
      isFormOpen = false;
      productToEdit = null;
    }}
  />
```

**After:**
```svelte
  <ProductForm
    bind:isOpen={isFormOpen}
    {productToEdit}
    initialBarcode={scannerPrefillBarcode}
    onScanRequested={() => {
      isScannerModalOpen = true;
    }}
    on:scanRequested={() => {
      isScannerModalOpen = true;
    }}
    on:save={handleSaveProduct}
    on:close={() => {
      isFormOpen = false;
      productToEdit = null;
      scannerPrefillBarcode = '';
    }}
  />

  {#if isScannerModalOpen}
    <CameraScanner
      mode="modal"
      isOpen={isScannerModalOpen}
      on:scan={(e) => {
        scannerPrefillBarcode = e.detail.code;
        isScannerModalOpen = false;
      }}
      on:close={() => {
        isScannerModalOpen = false;
      }}
    />
  {/if}
```

## 6. Instant Matched Product Modal
```svelte
  {#if isQuickMatchModalOpen && matchedScannedProduct}
    {@const status = calculateExpiryStatus(matchedScannedProduct.expiryDate)}
    <div
      class="modal-backdrop"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="quick-match-title"
      on:click={(e) => { if (e.target === e.currentTarget) isQuickMatchModalOpen = false; }}
      on:keydown={(e) => e.key === 'Escape' && (isQuickMatchModalOpen = false)}
    >
      <div class="modal-sheet" role="document">
        <div class="matched-header">
          <span class="category-badge">{matchedScannedProduct.category}</span>
          <h3 id="quick-match-title">{matchedScannedProduct.name}</h3>
          <span class="status-pill {status.cls}">{status.label}</span>
        </div>

        <div class="matched-body">
          <div class="stock-display">
            <span class="stock-label">Stock disponible</span>
            <span class="stock-value">{matchedScannedProduct.quantity} <small>{matchedScannedProduct.unit || 'uds'}</small></span>
          </div>
          {#if matchedScannedProduct.barcode}
            <div class="matched-barcode font-mono">🏷️ {matchedScannedProduct.barcode}</div>
          {/if}
        </div>

        <div class="matched-actions">
          <button
            type="button"
            class="stepper-btn consume"
            on:click={() => {
              if (matchedScannedProduct) handleConsume(matchedScannedProduct.id, matchedScannedProduct.name);
              isQuickMatchModalOpen = false;
            }}
          >
            -1 Consumir
          </button>
          <button
            type="button"
            class="stepper-btn replenish"
            on:click={() => {
              selectedProduct = matchedScannedProduct;
              if (!isTablet) isMobileDetailOpen = true;
              activeTab = 'inventario';
              isQuickMatchModalOpen = false;
            }}
          >
            Ver Ficha
          </button>
          <button
            type="button"
            class="btn-cancel"
            on:click={() => (isQuickMatchModalOpen = false)}
          >
            Seguir Escaneando
          </button>
        </div>
      </div>
    </div>
  {/if}
```
