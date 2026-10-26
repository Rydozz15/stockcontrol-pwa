<!--
  StockControl PWA — Main Application Page
  Milestone 3 — Mobile/Tablet Ergonomic UI/UX Composition
  Target Path: src/routes/+page.svelte
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { workspaceStore } from '$lib/stores/workspaceStore';
  import { connectivityStore } from '$lib/stores/connectivityStore';
  import { toastStore } from '$lib/stores/toastStore';
  import { metricsStore } from '$lib/stores/metricsStore';
  import {
    inventoryStore,
    filteredProducts,
    initWorkspaceSync,
    consumeStockAction,
    discardStockAction,
    createProductAction,
    updateProductAction,
    type ProductItem
  } from '$lib/stores/inventoryStore';
  import { productRepository } from '$lib/repositories/productRepository';
  import { calculateExpiryStatus } from '$lib/domain/expiry';
  import {
    PRODUCT_CATEGORIES,
    WASTE_REASONS,
    WASTE_REASON_LABELS,
    type WasteReason,
    type Product,
    type HistoryLog
  } from '$lib/domain/models';

  // Component Imports
  import MetricsDashboard from '$lib/components/MetricsDashboard.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import ProductCard from '$lib/components/ProductCard.svelte';
  import ProductForm from '$lib/components/ProductForm.svelte';
  import WorkspaceModal from '$lib/components/WorkspaceModal.svelte';
  import CameraScanner from '$lib/components/CameraScanner.svelte';
  import ExportImportModal from '$lib/components/ExportImportModal.svelte';
  import { lookupBarcode } from '$lib/domain/barcode';

  // Navigation & View State
  type NavTab = 'inventario' | 'scanner' | 'alertas' | 'historial';
  let activeTab: NavTab = 'inventario';
  let activeExpiryFilter: 'all' | 'expired' | 'soon' | 'week' = 'all';

  // Camera Scanner & Contingency Modals State
  let isScannerModalOpen: boolean = false;
  let scannerPrefillBarcode: string = '';
  let matchedScannedProduct: ProductItem | null = null;
  let isQuickMatchModalOpen: boolean = false;
  let isExportImportModalOpen: boolean = false;

  function handleScanDetected(event: CustomEvent<{ code: string; format: string }>) {
    const { code } = event.detail;
    const lookup = lookupBarcode(code, $inventoryStore.products);

    if (lookup.found && lookup.product) {
      matchedScannedProduct = lookup.product as ProductItem;
      isQuickMatchModalOpen = true;
      isScannerModalOpen = false;
      toastStore.success(`Encontrado: ${lookup.product.name}`);
    } else {
      scannerPrefillBarcode = code;
      isScannerModalOpen = false;
      productToEdit = null;
      isFormOpen = true;
      toastStore.info(`Código detectado (${code}). Ingresa los datos del producto.`);
    }
  }

  // Selection & Responsive State
  let selectedProduct: ProductItem | null = null;
  let isTablet: boolean = false;
  let isMobileDetailOpen: boolean = false;

  // Modals State
  let isFormOpen: boolean = false;
  let productToEdit: ProductItem | null = null;
  let isWorkspaceModalOpen: boolean = false;
  let isDiscardModalOpen: boolean = false;
  let productToDiscard: ProductItem | null = null;
  let selectedWasteReason: WasteReason = 'vencimiento';

  // Real-time History Logs for Tablet/Mobile Inspection
  let recentHistoryLogs: HistoryLog[] = [];
  let cleanupSync: (() => void) | null = null;
  let cleanupHistory: (() => void) | null = null;

  // Responsive Viewport Observer
  function updateViewport() {
    if (typeof window !== 'undefined') {
      const wasTablet = isTablet;
      isTablet = window.innerWidth >= 768;
      // If expanding to tablet while mobile modal is open, transition to side pane smoothly
      if (isTablet && !wasTablet && isMobileDetailOpen) {
        isMobileDetailOpen = false;
      }
    }
  }

  onMount(() => {
    updateViewport();
    window.addEventListener('resize', updateViewport);
    cleanupSync = initWorkspaceSync();

    // Subscribe to audit history for the active workspace
    cleanupHistory = productRepository.subscribeHistory(
      $workspaceStore.workspaceId,
      50,
      (logs) => {
        recentHistoryLogs = logs;
      }
    );
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', updateViewport);
    }
    if (cleanupSync) {
      cleanupSync();
      cleanupSync = null;
    }
    if (cleanupHistory) {
      cleanupHistory();
      cleanupHistory = null;
    }
  });

  // Re-subscribe history when workspace changes
  $: if ($workspaceStore.workspaceId && cleanupHistory) {
    cleanupHistory();
    cleanupHistory = productRepository.subscribeHistory(
      $workspaceStore.workspaceId,
      50,
      (logs) => {
        recentHistoryLogs = logs;
      }
    );
  }

  // Reactive Derived Product List with Expiry and Tab Filtering
  $: displayedProducts = $filteredProducts.filter((p) => {
    // Alertas Tab: strictly filters to expired and soon (critical <= 3d)
    if (activeTab === 'alertas') {
      const status = calculateExpiryStatus(p.expiryDate);
      return status.key === 'expired' || status.key === 'soon';
    }

    // Disjoint Expiry Counter Filtering from MetricsDashboard
    if (activeExpiryFilter === 'all') return true;
    const status = calculateExpiryStatus(p.expiryDate);
    return status.key === activeExpiryFilter;
  });

  // Keep selectedProduct reference synchronized with updated store data
  $: if (selectedProduct) {
    const updated = $inventoryStore.products.find((p) => p.id === selectedProduct?.id);
    if (updated) {
      selectedProduct = updated;
    } else if (updated === undefined) {
      // Product was removed or consumed
      selectedProduct = null;
      isMobileDetailOpen = false;
    }
  }

  // Product Selection Handler (Tablet Split Pane vs Mobile Modal)
  function handleSelectProduct(prod: ProductItem) {
    selectedProduct = prod;
    if (!isTablet) {
      isMobileDetailOpen = true;
    }
  }

  function handleCloseDetail(event?: MouseEvent) {
    if (event && event.target !== event.currentTarget) return;
    isMobileDetailOpen = false;
    if (!isTablet) {
      selectedProduct = null;
    }
  }

  // 1-Tap Consumption with Undo Toast
  async function handleConsume(id: string, name: string) {
    const result = inventoryStore.consumeOne(id);
    if (result) {
      toastStore.undo(`Consumiste 1 unidad de ${name}`, async () => {
        // Rollback optimistic update
        inventoryStore.updateProduct(id, {
          quantity: result.previousQuantity,
          isConsumed: false
        });
        toastStore.info(`Restaurada 1 unidad de ${name}`);
        // Restore in Firestore repository
        try {
          await productRepository.restoreStock($workspaceStore.workspaceId, id, 1, $workspaceStore.operatorAlias);
        } catch (err) {
          console.warn('[+page.svelte] Failed to restore stock in Firestore:', err);
        }
      });

      // Commit consumption to Firestore
      try {
        await consumeStockAction(id, 1, 'Consumo rápido 1-tap');
      } catch (err: any) {
        console.warn('[+page.svelte] Background consumeStockAction warning:', err?.message || err);
      }
    }
  }

  // 1-Tap Replenish (+1)
  async function handleReplenish(prod: ProductItem) {
    const newQty = (prod.quantity ?? 0) + 1;
    inventoryStore.updateProduct(prod.id, { quantity: newQty, isConsumed: false });
    toastStore.success(`+1 reincorporado a ${prod.name}`);
    try {
      await updateProductAction(prod.id, { quantity: newQty, isConsumed: false });
    } catch (err: any) {
      toastStore.error('Error al actualizar stock: ' + err.message);
    }
  }

  // Discard / Merma Modal Handlers
  function openDiscardModal(prod: ProductItem) {
    productToDiscard = prod;
    selectedWasteReason = 'vencimiento';
    isDiscardModalOpen = true;
  }

  async function confirmDiscard() {
    if (!productToDiscard) return;
    const target = productToDiscard;
    isDiscardModalOpen = false;

    inventoryStore.updateProduct(target.id, {
      quantity: 0,
      isDiscarded: true
    });

    const label = WASTE_REASON_LABELS[selectedWasteReason] || selectedWasteReason;
    toastStore.warning(`Descartado: ${target.name} (${label})`);

    try {
      await discardStockAction(target.id, selectedWasteReason);
    } catch (err: any) {
      toastStore.error('Error al registrar merma: ' + err.message);
    } finally {
      productToDiscard = null;
    }
  }

  // Product Form (Create / Edit) Handlers
  function openNewProductForm() {
    productToEdit = null;
    isFormOpen = true;
  }

  function openEditProductForm(prod: ProductItem) {
    productToEdit = prod;
    isFormOpen = true;
  }

  async function handleSaveProduct(event: CustomEvent<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>) {
    const data = event.detail;
    isFormOpen = false;

    if (productToEdit && productToEdit.id) {
      // Edit existing
      try {
        await updateProductAction(productToEdit.id, data);
        toastStore.success(`Actualizado: ${data.name || 'Producto'}`);
      } catch (err: any) {
        toastStore.error('Error al guardar: ' + err.message);
      }
    } else {
      // Create new
      try {
        await createProductAction(data);
        toastStore.success(`Registrado: ${data.name}`);
      } catch (err: any) {
        toastStore.error('Error al crear: ' + err.message);
      }
    }
    productToEdit = null;
  }

  // Tab Switching
  function handleTabChange(event: CustomEvent<{ tab: string }>) {
    const tab = event.detail.tab;
    if (tab === 'inventario' || tab === 'inventory') {
      activeTab = 'inventario';
    } else if (tab === 'scanner' || tab === 'scan') {
      activeTab = 'scanner';
    } else if (tab === 'alertas' || tab === 'alerts' || tab === 'mermas') {
      activeTab = 'alertas';
      activeExpiryFilter = 'all'; // Let Alertas tab rule the list
    } else if (tab === 'historial' || tab === 'history' || tab === 'ajustes') {
      activeTab = 'historial';
    }
  }

  // Filter & Sort Helpers
  function setCategoryFilter(category: string | null) {
    inventoryStore.setFilterCategory(category);
  }

  function handleSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const [sortBy, order] = target.value.split('-') as [('expiryDate' | 'name' | 'quantity'), ('asc' | 'desc')];
    inventoryStore.setSort(sortBy, order);
  }

  // Filter history logs for the active selected product
  $: selectedProductHistory = selectedProduct
    ? recentHistoryLogs.filter((log) => log.productId === selectedProduct?.id)
    : [];
</script>

<div class="page-container">
  <!-- Application Header -->
  <header class="app-header">
    <div class="header-content">
      <div class="brand">
        <h1 class="logo-title">StockControl</h1>
        <span class="version-badge">PWA</span>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="backup-btn"
          on:click={() => (isExportImportModalOpen = true)}
          aria-label="Copia de seguridad y contingencia"
          title="Exportar o importar datos"
        >
          <span class="backup-icon" aria-hidden="true">💾</span>
          <span class="backup-label">Respaldo</span>
        </button>

        <button
          type="button"
          class="workspace-badge-btn"
          on:click={() => (isWorkspaceModalOpen = true)}
          aria-label="Configurar cocina y operador"
        >
          <span class="ws-dot" class:online={$connectivityStore.online}></span>
          <span class="ws-text">{$workspaceStore.workspaceId}</span>
          <span class="op-alias">({$workspaceStore.operatorAlias})</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Split-Screen Master-Detail Layout (>=768px activates two columns) -->
  <div class="split-container">
    <!-- Master Pane (Left column on Tablet >= 768px, 100% on Mobile) -->
    <section class="master-pane" aria-label="Panel principal de inventario">
      <!-- 4 Disjoint Counter Cards Metrics Dashboard -->
      <MetricsDashboard
        bind:activeFilter={activeExpiryFilter}
        on:filterChange={(e) => (activeExpiryFilter = e.detail.filter)}
      />

      <!-- Search & Sorting Controls -->
      <div class="controls-toolbar">
        <div class="search-input-wrapper">
          <span class="search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            placeholder="Buscar producto, código de barras o lote..."
            class="search-input"
            bind:value={$inventoryStore.searchQuery}
            aria-label="Buscar inventario"
          />
          {#if $inventoryStore.searchQuery}
            <button
              type="button"
              class="clear-search-btn"
              on:click={() => inventoryStore.setSearchQuery('')}
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          {/if}
        </div>

        <div class="sort-wrapper">
          <label for="sort-select" class="sr-only">Ordenar por</label>
          <select
            id="sort-select"
            class="sort-select"
            on:change={handleSortChange}
            aria-label="Criterio de ordenación"
          >
            <option value="expiryDate-asc">📅 Vencimiento (Próximo primero)</option>
            <option value="expiryDate-desc">📅 Vencimiento (Lejano primero)</option>
            <option value="name-asc">🔤 Nombre (A - Z)</option>
            <option value="name-desc">🔤 Nombre (Z - A)</option>
            <option value="quantity-asc">🔢 Cantidad (Menor stock)</option>
            <option value="quantity-desc">🔢 Cantidad (Mayor stock)</option>
          </select>
        </div>
      </div>

      <!-- Category Filter Chips -->
      <div class="category-chips-bar" role="toolbar" aria-label="Filtro por categorías">
        <button
          type="button"
          class="chip-btn"
          class:active={$inventoryStore.filterCategory === null}
          on:click={() => setCategoryFilter(null)}
        >
          Todos
        </button>
        {#each PRODUCT_CATEGORIES as cat}
          <button
            type="button"
            class="chip-btn"
            class:active={$inventoryStore.filterCategory === cat}
            on:click={() => setCategoryFilter(cat)}
          >
            {cat}
          </button>
        {/each}
      </div>

      <!-- Active Filter Pill if filter is active -->
      {#if activeExpiryFilter !== 'all' || activeTab === 'alertas' || $inventoryStore.filterCategory}
        <div class="active-filter-indicator">
          <span class="filter-text">
            Filtrando por:
            <strong>
              {activeTab === 'alertas'
                ? 'Alertas Críticas'
                : activeExpiryFilter === 'expired'
                ? 'Vencidos'
                : activeExpiryFilter === 'soon'
                ? 'Vence hoy / 3d'
                : activeExpiryFilter === 'week'
                ? 'Vence semana'
                : ''}
              {$inventoryStore.filterCategory ? ` • ${$inventoryStore.filterCategory}` : ''}
            </strong>
            ({displayedProducts.length} productos)
          </span>
          <button
            type="button"
            class="clear-filter-btn"
            on:click={() => {
              activeExpiryFilter = 'all';
              if (activeTab === 'alertas') activeTab = 'inventario';
              setCategoryFilter(null);
            }}
          >
            Limpiar filtros
          </button>
        </div>
      {/if}

      <!-- Tab Views -->
      {#if activeTab === 'inventario' || activeTab === 'alertas'}
        <div class="inventory-list" role="tabpanel" id="tabpanel-inventario" aria-labelledby="nav-tab-inventario">
          {#if displayedProducts.length === 0}
            <div class="empty-state">
              <span class="empty-icon">📦</span>
              <h3>No se encontraron productos</h3>
              {#if activeExpiryFilter !== 'all' || $inventoryStore.searchQuery}
                <p>No hay coincidencias con los filtros actuales.</p>
                <button
                  type="button"
                  class="btn-reset-filters"
                  on:click={() => {
                    activeExpiryFilter = 'all';
                    inventoryStore.setSearchQuery('');
                    setCategoryFilter(null);
                  }}
                >
                  Restablecer filtros
                </button>
              {:else}
                <p>Presiona el botón (+) en la esquina inferior para registrar el primer ingrediente.</p>
              {/if}
            </div>
          {:else}
            {#each displayedProducts as prod (prod.id)}
              <div class="product-card-wrapper" class:is-selected={selectedProduct?.id === prod.id}>
                <ProductCard
                  product={prod}
                  isSelected={selectedProduct?.id === prod.id}
                  on:select={() => handleSelectProduct(prod)}
                />
              </div>
            {/each}
          {/if}
        </div>
      {:else if activeTab === 'scanner'}
        <div class="scanner-tab-view" role="tabpanel" id="tabpanel-scanner" aria-labelledby="nav-tab-scanner">
          <CameraScanner
            mode="inline"
            isOpen={activeTab === 'scanner'}
            on:scan={handleScanDetected}
          />
        </div>
      {:else if activeTab === 'historial'}
        <div class="tab-placeholder" role="tabpanel" id="tabpanel-historial" aria-labelledby="nav-tab-historial">
          <span class="placeholder-icon">📋</span>
          <h2>Historial de Auditoría y Mermas</h2>
          <p>Registro cronológico de movimientos en la cocina: altas, consumos y mermas por operador.</p>
          <div class="history-list-preview">
            {#each recentHistoryLogs.slice(0, 10) as log (log.id)}
              <div class="history-log-row">
                <span class="hist-action hist-{log.action}">{log.action}</span>
                <span class="hist-name">{log.productName}</span>
                <span class="hist-delta">{log.quantityDelta > 0 ? `+${log.quantityDelta}` : log.quantityDelta}</span>
                <span class="hist-op">👤 {log.operatorAlias}</span>
                <span class="hist-time">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <!-- Detail Pane (Right column on Tablet >= 768px, persistent sticky inspection) -->
    <aside class="detail-pane" aria-label="Detalle e inspección de producto">
      {#if selectedProduct}
        {@const status = calculateExpiryStatus(selectedProduct.expiryDate)}
        <div class="inspection-card">
          <div class="inspection-header">
            <div>
              <span class="category-badge">{selectedProduct.category}</span>
              <h2 class="inspection-title">{selectedProduct.name}</h2>
            </div>
            <button
              type="button"
              class="close-detail-btn"
              on:click={handleCloseDetail}
              aria-label="Cerrar detalle"
            >
              ✕
            </button>
          </div>

          <!-- Expiry Status Banner -->
          <div class="expiry-status-banner status-{status.cls}">
            <div class="expiry-icon">
              {#if status.key === 'expired'}⚠️{:else if status.key === 'soon'}⏱️{:else}✅{/if}
            </div>
            <div class="expiry-text">
              <span class="expiry-label">{status.label}</span>
              <span class="expiry-date">Fecha de caducidad: <strong>{selectedProduct.expiryDate}</strong></span>
            </div>
          </div>

          <!-- Current Stock & 1-Tap Steppers -->
          <div class="stock-action-section">
            <div class="stock-display">
              <span class="stock-label">Stock disponible</span>
              <span class="stock-value">{selectedProduct.quantity} <small>{selectedProduct.unit || 'uds'}</small></span>
            </div>

            <div class="action-steppers">
              <button
                type="button"
                class="stepper-btn consume"
                on:click={() => selectedProduct && handleConsume(selectedProduct.id, selectedProduct.name)}
                disabled={(selectedProduct.quantity ?? 0) <= 0}
                aria-label="Consumir 1 unidad"
              >
                -1 Consumir
              </button>
              <button
                type="button"
                class="stepper-btn replenish"
                on:click={() => selectedProduct && handleReplenish(selectedProduct)}
                aria-label="Reponer 1 unidad"
              >
                +1 Reponer
              </button>
              <button
                type="button"
                class="stepper-btn waste"
                on:click={() => selectedProduct && openDiscardModal(selectedProduct)}
                aria-label="Descartar por merma"
              >
                🗑️ Merma
              </button>
            </div>
          </div>

          <!-- Technical & Storage Details -->
          <div class="metadata-grid">
            <div class="meta-item">
              <span class="meta-label">Ubicación</span>
              <span class="meta-val">📍 {selectedProduct.location || 'Refrigerador'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Recepción</span>
              <span class="meta-val">📥 {selectedProduct.receivedDate || 'No especificada'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Lote / Batch</span>
              <span class="meta-val">{selectedProduct.lot || 'Sin lote'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Proveedor</span>
              <span class="meta-val">{selectedProduct.supplier || 'Sin proveedor'}</span>
            </div>
            {#if selectedProduct.barcode}
              <div class="meta-item full-width">
                <span class="meta-label">Código de barras</span>
                <span class="meta-val font-mono">🏷️ {selectedProduct.barcode}</span>
              </div>
            {/if}
            {#if selectedProduct.notes}
              <div class="meta-item full-width">
                <span class="meta-label">Observaciones HACCP</span>
                <span class="meta-val">{selectedProduct.notes}</span>
              </div>
            {/if}
          </div>

          <!-- Operator Audit Stamp -->
          <div class="audit-stamp">
            <span>Registrado por: <strong>{selectedProduct.createdBy || 'Operador'}</strong></span>
            {#if selectedProduct.updatedBy && selectedProduct.updatedBy !== selectedProduct.createdBy}
              <span> • Editado por: <strong>{selectedProduct.updatedBy}</strong></span>
            {/if}
          </div>

          <!-- Edit Button -->
          <button
            type="button"
            class="btn-edit-product"
            on:click={() => selectedProduct && openEditProductForm(selectedProduct)}
          >
            ✏️ Modificar Ficha de Producto
          </button>

          <!-- History Audit Log for this Product -->
          <div class="product-history-box">
            <h4>Trazabilidad del Producto</h4>
            {#if selectedProductHistory.length === 0}
              <p class="no-history-text">Sin movimientos recientes registrados.</p>
            {:else}
              <div class="mini-history-list">
                {#each selectedProductHistory.slice(0, 5) as log (log.id)}
                  <div class="mini-history-item">
                    <span class="badge-action">{log.action}</span>
                    <span class="history-detail">{log.quantityDelta > 0 ? `+${log.quantityDelta}` : log.quantityDelta} {log.unit} ({log.reason || 'Movimiento'})</span>
                    <span class="history-meta">{log.operatorAlias} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <!-- Tablet Empty State (Guidance) -->
        <div class="detail-placeholder">
          <span class="detail-placeholder-icon">📋</span>
          <h3>Ficha de Inspección y Trazabilidad</h3>
          <p>Selecciona un ingrediente de la lista para ver su trazabilidad HACCP, historial de consumo y registrar mermas.</p>
          <div class="tablet-tip">
            💡 <strong>Modo Tablet Activo:</strong> Puedes mantener esta ficha a la vista mientras revisas el stock de la cocina.
          </div>
        </div>
      {/if}
    </aside>
  </div>

  <!-- Floating Action Button (FAB) for Rapid Product Entry -->
  <button
    type="button"
    class="fab"
    on:click={openNewProductForm}
    aria-label="Agregar producto"
  >
    +
  </button>

  <!-- Mobile Detail Modal Drawer (Only triggered on < 768px screens) -->
  {#if !isTablet && isMobileDetailOpen && selectedProduct}
    {@const status = calculateExpiryStatus(selectedProduct.expiryDate)}
    <div
      class="mobile-modal-backdrop"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="mobile-detail-title"
      on:click={handleCloseDetail}
      on:keydown={(e) => e.key === 'Escape' && handleCloseDetail()}
    >
      <div
        class="mobile-sheet"
        role="document"
      >
        <div class="mobile-sheet-header">
          <div>
            <span class="category-badge">{selectedProduct.category}</span>
            <h2 id="mobile-detail-title" class="inspection-title">{selectedProduct.name}</h2>
          </div>
          <button type="button" class="close-sheet-btn" on:click={handleCloseDetail} aria-label="Cerrar ficha">
            ✕
          </button>
        </div>

        <div class="expiry-status-banner status-{status.cls}">
          <div class="expiry-icon">
            {#if status.key === 'expired'}⚠️{:else if status.key === 'soon'}⏱️{:else}✅{/if}
          </div>
          <div class="expiry-text">
            <span class="expiry-label">{status.label}</span>
            <span class="expiry-date">Vence: <strong>{selectedProduct.expiryDate}</strong></span>
          </div>
        </div>

        <div class="stock-action-section">
          <div class="stock-display">
            <span class="stock-label">Cantidad actual</span>
            <span class="stock-value">{selectedProduct.quantity} <small>{selectedProduct.unit || 'uds'}</small></span>
          </div>
          <div class="action-steppers">
            <button
              type="button"
              class="stepper-btn consume"
              on:click={() => selectedProduct && handleConsume(selectedProduct.id, selectedProduct.name)}
              disabled={(selectedProduct.quantity ?? 0) <= 0}
            >
              -1 Consumir
            </button>
            <button
              type="button"
              class="stepper-btn replenish"
              on:click={() => selectedProduct && handleReplenish(selectedProduct)}
            >
              +1
            </button>
            <button
              type="button"
              class="stepper-btn waste"
              on:click={() => selectedProduct && openDiscardModal(selectedProduct)}
            >
              Merma
            </button>
          </div>
        </div>

        <div class="metadata-grid">
          <div class="meta-item">
            <span class="meta-label">Ubicación</span>
            <span class="meta-val">📍 {selectedProduct.location}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Recepción</span>
            <span class="meta-val">📥 {selectedProduct.receivedDate}</span>
          </div>
          {#if selectedProduct.lot}
            <div class="meta-item">
              <span class="meta-label">Lote</span>
              <span class="meta-val">{selectedProduct.lot}</span>
            </div>
          {/if}
        </div>

        <div class="sheet-actions">
          <button
            type="button"
            class="btn-edit-product"
            on:click={() => {
              isMobileDetailOpen = false;
              if (selectedProduct) openEditProductForm(selectedProduct);
            }}
          >
            ✏️ Editar Producto
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Waste / Discard Confirmation Modal -->
  {#if isDiscardModalOpen && productToDiscard}
    <div
      class="modal-backdrop"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="discard-title"
      on:click={(e) => { if (e.target === e.currentTarget) isDiscardModalOpen = false; }}
      on:keydown={(e) => e.key === 'Escape' && (isDiscardModalOpen = false)}
    >
      <div
        class="modal-sheet"
        role="document"
      >
        <h3 id="discard-title">Descartar por Merma (HACCP)</h3>
        <p class="modal-subtitle">
          Vas a registrar la baja de <strong>{productToDiscard.name}</strong> ({productToDiscard.quantity} {productToDiscard.unit}).
        </p>

        <fieldset class="waste-reasons-fieldset">
          <legend class="waste-reasons-legend">Motivo del Descarte</legend>
          <div class="reasons-list">
            {#each WASTE_REASONS as reason}
              <label class="reason-option" class:selected={selectedWasteReason === reason}>
                <input
                  type="radio"
                  name="wasteReason"
                  value={reason}
                  bind:group={selectedWasteReason}
                />
                <span>{WASTE_REASON_LABELS[reason]}</span>
              </label>
            {/each}
          </div>
        </fieldset>

        <div class="modal-buttons">
          <button type="button" class="btn-cancel" on:click={() => (isDiscardModalOpen = false)}>
            Cancelar
          </button>
          <button type="button" class="btn-confirm-discard" on:click={confirmDiscard}>
            Confirmar Merma
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Product Entry / Edit Form (M3 Component) -->
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

  <!-- Scanner Modal Overlay (triggered from ProductForm scan button) -->
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

  <!-- Quick Match Modal when scanned barcode matches active inventory -->
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
      <div class="modal-card quick-match-card" role="document">
        <header class="modal-header">
          <div class="header-titles">
            <span class="category-badge">{matchedScannedProduct.category}</span>
            <h3 id="quick-match-title" class="modal-title">{matchedScannedProduct.name}</h3>
          </div>
          <button
            type="button"
            class="btn-close"
            on:click={() => (isQuickMatchModalOpen = false)}
            aria-label="Cerrar ventana"
          >
            ✕
          </button>
        </header>

        <div class="modal-body quick-match-body">
          <div class="quick-match-status">
            <span class="status-pill {status.cls}">{status.label}</span>
          </div>

          <div class="quick-stock-display">
            <span class="stock-label">Stock disponible:</span>
            <span class="stock-value">{matchedScannedProduct.quantity} <small>{matchedScannedProduct.unit || 'uds'}</small></span>
          </div>

          {#if matchedScannedProduct.barcode}
            <div class="matched-barcode font-mono">🏷️ {matchedScannedProduct.barcode}</div>
          {/if}
        </div>

        <footer class="modal-footer quick-match-actions">
          <button
            type="button"
            class="quick-action-btn consume"
            on:click={() => {
              if (matchedScannedProduct) handleConsume(matchedScannedProduct.id, matchedScannedProduct.name);
              isQuickMatchModalOpen = false;
            }}
          >
            -1 Consumir
          </button>
          <button
            type="button"
            class="quick-action-btn view-detail"
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
            class="quick-action-btn cancel"
            on:click={() => (isQuickMatchModalOpen = false)}
          >
            Seguir Escaneando
          </button>
        </footer>
      </div>
    </div>
  {/if}

  <!-- Contingency Export/Import Modal (M4 Component) -->
  <ExportImportModal
    bind:isOpen={isExportImportModalOpen}
    {recentHistoryLogs}
    on:close={() => (isExportImportModalOpen = false)}
  />

  <!-- Workspace & Operator Modal (M3 Component) -->
  <WorkspaceModal
    bind:isOpen={isWorkspaceModalOpen}
    on:close={() => (isWorkspaceModalOpen = false)}
  />

  <!-- Fixed Bottom Navigation Bar (4 tabs, >= 44x44px, safe area compliant) -->
  <BottomNav
    bind:activeTab
    badges={{ alertas: $metricsStore.expired, alerts: $metricsStore.expired }}
    on:tabChange={handleTabChange}
  />
</div>

<style>
  .page-container {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding-bottom: calc(var(--nav-height, 60px) + env(safe-area-inset-bottom, 0px) + 24px);
  }

  .app-header {
    background: linear-gradient(135deg, var(--color-brown-dark, #69412d), var(--color-brown-light, #9a623e));
    color: #ffffff;
    padding: 12px 16px;
    padding-top: calc(12px + env(safe-area-inset-top, 0px));
    border-radius: 0 0 20px 20px;
    box-shadow: 0 4px 12px rgba(105, 65, 45, 0.2);
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1280px;
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
    min-height: var(--touch-min, 44px);
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: #ffffff;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.8rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  .ws-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--color-red, #b84035);
  }

  .ws-dot.online {
    background-color: #55d688;
  }

  .op-alias {
    opacity: 0.85;
  }

  /* Responsive Split-Screen Architecture (F16 Contract) */
  .split-container {
    display: flex;
    flex-direction: column;
    max-width: 1280px;
    width: 100%;
    margin: 0 auto;
    padding: 16px;
    gap: 16px;
    flex: 1;
  }

  .detail-pane {
    display: none; /* Hidden on mobile */
  }

  @media (min-width: 768px) {
    .split-container {
      display: grid;
      grid-template-columns: minmax(360px, 42%) 1fr;
      gap: 20px;
      align-items: start;
    }

    .master-pane {
      width: 100%;
    }

    .detail-pane {
      display: block;
      position: sticky;
      top: 16px;
      background: var(--color-surface, #ffffff);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid var(--color-line, #eadfd2);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
      max-height: calc(100vh - 100px);
      overflow-y: auto;
    }
  }

  /* Controls & Search Toolbar */
  .controls-toolbar {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 12px;
  }

  @media (min-width: 480px) {
    .controls-toolbar {
      flex-direction: row;
      align-items: center;
    }
    .search-input-wrapper {
      flex: 1;
    }
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    font-size: 0.9rem;
    pointer-events: none;
    opacity: 0.6;
  }

  .search-input {
    width: 100%;
    min-height: var(--touch-min, 44px);
    padding: 10px 48px 10px 36px;
    border: 1px solid var(--color-line, #eadfd2);
    border-radius: 10px;
    font-size: 0.95rem;
    background: var(--color-surface, #ffffff);
  }

  .clear-search-btn {
    position: absolute;
    right: 4px;
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    font-size: 0.95rem;
    color: var(--color-muted, #7c7168);
    cursor: pointer;
    touch-action: manipulation;
  }

  .sort-select {
    min-height: var(--touch-min, 44px);
    padding: 8px 12px;
    border: 1px solid var(--color-line, #eadfd2);
    border-radius: 10px;
    background: var(--color-surface, #ffffff);
    font-size: 0.85rem;
    color: var(--color-ink, #302821);
    font-weight: 600;
  }

  /* Category Filter Chips Bar */
  .category-chips-bar {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 8px;
    margin-bottom: 12px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }

  .chip-btn {
    min-height: 44px;
    padding: 8px 16px;
    border-radius: 22px;
    border: 1px solid var(--color-line, #eadfd2);
    background: var(--color-surface, #ffffff);
    color: var(--color-muted, #7c7168);
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    touch-action: manipulation;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .chip-btn.active {
    background: var(--color-brown, #75472f);
    color: #ffffff;
    border-color: var(--color-brown, #75472f);
  }

  /* Active Filter Indicator */
  .active-filter-indicator {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--color-cream, #fff8ef);
    border: 1px solid var(--color-line, #eadfd2);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 0.82rem;
    margin-bottom: 12px;
  }

  .clear-filter-btn {
    min-height: 44px;
    min-width: 44px;
    background: transparent;
    border: 1px solid var(--color-brown, #75472f);
    color: var(--color-brown, #75472f);
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
  }

  /* Inventory List */
  .inventory-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .product-card-wrapper {
    border-radius: 14px;
    transition: transform 0.15s ease;
  }

  .product-card-wrapper.is-selected {
    box-shadow: 0 0 0 2px var(--color-brown, #75472f);
  }

  .empty-state {
    text-align: center;
    padding: 36px 16px;
    color: var(--color-muted, #7c7168);
    background: var(--color-surface, #ffffff);
    border-radius: 16px;
    border: 1px dashed var(--color-line, #eadfd2);
  }

  .empty-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 12px;
  }

  .btn-reset-filters {
    min-height: var(--touch-min, 44px);
    margin-top: 12px;
    background: var(--color-brown, #75472f);
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: 700;
    cursor: pointer;
  }

  /* Detail Inspection Card (Right Pane) */
  .inspection-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .category-badge {
    font-size: 0.72rem;
    font-weight: 700;
    background: var(--color-cream, #fff8ef);
    color: var(--color-brown, #75472f);
    padding: 2px 8px;
    border-radius: 6px;
    text-transform: uppercase;
  }

  .inspection-title {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--color-ink, #302821);
    margin-top: 4px;
    line-height: 1.2;
  }

  .close-detail-btn {
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 8px;
    font-size: 1.3rem;
    color: var(--color-muted, #7c7168);
    cursor: pointer;
    touch-action: manipulation;
  }

  .expiry-status-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 12px;
    margin-bottom: 16px;
  }

  .expiry-status-banner.status-expired {
    background: #fde8e7;
    border-left: 5px solid var(--color-red, #b84035);
    color: var(--color-red, #b84035);
  }

  .expiry-status-banner.status-warning,
  .expiry-status-banner.status-soon {
    background: #fef5e7;
    border-left: 5px solid var(--color-amber, #a56b15);
    color: var(--color-amber, #a56b15);
  }

  .expiry-status-banner.status-ok {
    background: #eef8f2;
    border-left: 5px solid var(--color-green, #4c7860);
    color: var(--color-green, #4c7860);
  }

  .expiry-icon {
    font-size: 1.5rem;
  }

  .expiry-text {
    display: flex;
    flex-direction: column;
  }

  .expiry-label {
    font-size: 0.95rem;
    font-weight: 800;
  }

  .expiry-date {
    font-size: 0.8rem;
    opacity: 0.85;
  }

  .stock-action-section {
    background: #fbf8f4;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .stock-display {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .stock-label {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-muted, #7c7168);
  }

  .stock-value {
    font-size: 1.8rem;
    font-weight: 900;
    color: var(--color-ink, #302821);
  }

  .action-steppers {
    display: flex;
    gap: 8px;
  }

  .stepper-btn {
    flex: 1;
    min-height: var(--touch-min, 44px);
    border: none;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
    touch-action: manipulation;
    transition: opacity 0.15s ease;
  }

  .stepper-btn.consume {
    background: var(--color-brown, #75472f);
    color: #ffffff;
  }

  .stepper-btn.replenish {
    background: var(--color-cream, #fff8ef);
    color: var(--color-brown, #75472f);
    border: 1px solid var(--color-line, #eadfd2);
  }

  .stepper-btn.waste {
    background: #fde8e7;
    color: var(--color-red, #b84035);
    border: 1px solid rgba(184, 64, 53, 0.2);
  }

  .stepper-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 16px;
    font-size: 0.85rem;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    background: #fbf8f4;
    padding: 10px;
    border-radius: 8px;
  }

  .meta-item.full-width {
    grid-column: span 2;
  }

  .meta-label {
    font-size: 0.72rem;
    color: var(--color-muted, #7c7168);
    font-weight: 600;
    text-transform: uppercase;
  }

  .meta-val {
    font-weight: 600;
    margin-top: 2px;
  }

  .audit-stamp {
    font-size: 0.78rem;
    color: var(--color-muted, #7c7168);
    margin-bottom: 16px;
    padding: 8px;
    border-top: 1px solid var(--color-line, #eadfd2);
  }

  .btn-edit-product {
    width: 100%;
    min-height: var(--touch-min, 44px);
    background: none;
    border: 1px solid var(--color-line, #eadfd2);
    border-radius: 10px;
    font-weight: 700;
    color: var(--color-brown, #75472f);
    cursor: pointer;
    margin-bottom: 16px;
  }

  .product-history-box {
    border-top: 1px solid var(--color-line, #eadfd2);
    padding-top: 16px;
  }

  .product-history-box h4 {
    font-size: 0.9rem;
    margin-bottom: 8px;
  }

  .mini-history-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .mini-history-item {
    font-size: 0.78rem;
    background: #fbf8f4;
    padding: 6px 10px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .badge-action {
    font-size: 0.65rem;
    font-weight: 800;
    background: var(--color-line, #eadfd2);
    padding: 1px 5px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .detail-placeholder {
    text-align: center;
    padding: 48px 16px;
    color: var(--color-muted, #7c7168);
  }

  .detail-placeholder-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 12px;
  }

  .tablet-tip {
    margin-top: 24px;
    background: var(--color-cream, #fff8ef);
    border: 1px dashed var(--color-brown-light, #9a623e);
    border-radius: 10px;
    padding: 12px;
    font-size: 0.85rem;
    color: var(--color-brown, #75472f);
    text-align: left;
  }

  /* Floating Action Button (FAB) */
  .fab {
    position: fixed;
    bottom: calc(var(--nav-height, 60px) + env(safe-area-inset-bottom, 0px) + 16px);
    right: 16px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--color-brown, #75472f);
    color: #ffffff;
    font-size: 2rem;
    line-height: 1;
    font-weight: 300;
    border: none;
    box-shadow: 0 4px 16px rgba(117, 71, 47, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 40;
    touch-action: manipulation;
  }

  /* Mobile Detail Modal Backdrop & Sheet */
  .mobile-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-end;
    z-index: 9999;
  }

  .mobile-sheet {
    background: var(--color-surface, #ffffff);
    border-radius: 20px 20px 0 0;
    padding: 20px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2);
  }

  .mobile-sheet-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .close-sheet-btn {
    min-width: 44px;
    min-height: 44px;
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
  }

  /* Modal Backdrop General */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 16px;
  }

  .modal-sheet {
    background: var(--color-surface, #ffffff);
    border-radius: 16px;
    padding: 24px;
    width: 100%;
    max-width: 440px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .waste-reasons-fieldset {
    border: 1px solid var(--color-line, #eadfd2);
    border-radius: 10px;
    padding: 12px;
  }

  .waste-reasons-legend {
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0 6px;
    color: var(--color-ink, #302821);
  }

  .reasons-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .reason-option {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: var(--touch-min, 44px);
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 0.88rem;
  }

  .reason-option.selected {
    background: var(--color-cream, #fff8ef);
    border-color: var(--color-brown, #75472f);
    font-weight: 700;
  }

  .modal-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .btn-cancel {
    min-height: var(--touch-min, 44px);
    min-width: var(--touch-min, 44px);
    background: none;
    border: 1px solid var(--color-line, #eadfd2);
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
  }

  .btn-confirm-discard {
    min-height: var(--touch-min, 44px);
    min-width: var(--touch-min, 44px);
    background: var(--color-red, #b84035);
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: 700;
    cursor: pointer;
  }

  /* Placeholders */
  .tab-placeholder {
    padding: 32px 16px;
    text-align: center;
    background: var(--color-surface, #ffffff);
    border-radius: 14px;
    border: 1px dashed var(--color-line, #eadfd2);
  }

  .placeholder-icon {
    font-size: 2.5rem;
    display: block;
    margin-bottom: 8px;
  }

  .history-list-preview {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
  }

  .history-log-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #fbf8f4;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.82rem;
  }

  .hist-action {
    font-weight: 700;
    font-size: 0.72rem;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--color-line, #eadfd2);
  }

  .hist-delta {
    font-weight: 800;
  }

  /* Milestone 4 — Ergonomic Header & Scanner & QuickMatch Styles */
  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .backup-btn {
    min-height: var(--touch-min, 44px);
    min-width: var(--touch-min, 44px);
    padding: 0 12px;
    background: rgba(255, 255, 255, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 12px;
    color: #ffffff;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: background-color 0.15s;
  }

  .backup-btn:active {
    background: rgba(255, 255, 255, 0.3);
  }

  .scanner-tab-view {
    width: 100%;
    border-radius: 16px;
    overflow: hidden;
    background: #12100e;
    min-height: 400px;
    display: flex;
    flex-direction: column;
  }

  .quick-match-card {
    max-width: 440px;
  }

  .quick-match-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
    padding: 16px 20px;
  }

  .quick-match-status {
    display: flex;
    justify-content: center;
  }

  .quick-stock-display {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .stock-label {
    font-size: 0.88rem;
    color: var(--color-muted, #7c7168);
  }

  .matched-barcode {
    font-size: 0.85rem;
    color: var(--color-brown, #75472f);
    background: #fdf8f3;
    border: 1px solid #eadfd2;
    padding: 4px 10px;
    border-radius: 8px;
  }

  .quick-match-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }

  .quick-action-btn {
    min-height: var(--touch-min, 44px);
    min-width: var(--touch-min, 44px);
    padding: 0 16px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  .quick-action-btn.consume {
    background: var(--color-brown, #75472f);
    color: #ffffff;
    border: none;
  }

  .quick-action-btn.view-detail {
    background: #faf5ee;
    color: var(--color-brown-dark, #69412d);
    border: 1.5px solid #eadfd2;
  }

  .quick-action-btn.cancel {
    background: transparent;
    border: 1px solid #eadfd2;
    color: var(--color-muted, #7c7168);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
</style>
