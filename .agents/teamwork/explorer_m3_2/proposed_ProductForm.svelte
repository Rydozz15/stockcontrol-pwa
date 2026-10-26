<script lang="ts">
  /**
   * StockControl PWA — ProductForm.svelte
   * Ergonomic touch-friendly product entry drawer/modal for restaurant kitchens.
   * Features:
   * - 1-Touch Quick Expiry Presets (+2d, +3d, +1w, +1m) with live date preview
   * - Category visual icon pills with high-contrast active state
   * - Large +/- stepper buttons (>= 48x48px) and direct decimal input
   * - Common culinary unit selector chips (kg, g, L, ml, unidad, etc.)
   * - Storage location selector chips (Refrigerador, Congelador, Bodega seca, etc.)
   * - Expandable traceability accordion (lot, supplier, barcode, notes)
   * - Real-time validation and culinary theme integration
   *
   * Path: src/lib/components/ProductForm.svelte
   */

  import {
    PRODUCT_CATEGORIES,
    PRODUCT_UNITS,
    STORAGE_LOCATIONS,
    type Product,
    type ProductCategory,
    type ProductUnit,
    type StorageLocation
  } from '$lib/domain/models';

  import {
    formatDateISO,
    calculateDayDiff,
    presetPlus2Days,
    presetPlus3Days,
    presetPlus1Week,
    presetPlus1Month
  } from '$lib/domain/expiry';

  // Component Props (Svelte 5 runes)
  interface Props {
    open?: boolean;
    product?: Product | null;
    initialBarcode?: string;
    onSave?: (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void> | void;
    onClose?: () => void;
    onScanRequested?: () => void;
  }

  let {
    open = false,
    product = null,
    initialBarcode = '',
    onSave,
    onClose,
    onScanRequested
  }: Props = $props();

  // Internal Form State
  let name = $state('');
  let category = $state<ProductCategory>('Otros');
  let quantity = $state<number>(1);
  let unit = $state<ProductUnit>('unidad(es)');
  let location = $state<StorageLocation>('Refrigerador');
  let receivedDate = $state(formatDateISO(new Date()));
  let expiryDate = $state(presetPlus3Days());
  let lot = $state('');
  let supplier = $state('');
  let barcode = $state('');
  let notes = $state('');

  let showAdvanced = $state(false);
  let submitting = $state(false);
  let validationError = $state<string | null>(null);

  // Category Icon Mapping
  const CATEGORY_ICONS: Record<ProductCategory, string> = {
    'Lácteos': '🥛',
    'Carnes': '🥩',
    'Pescados y mariscos': '🐟',
    'Frutas y verduras': '🥬',
    'Congelados': '❄️',
    'Abarrotes y secos': '🌾',
    'Panadería y pastelería': '🥖',
    'Salsas y aderezos': '🥫',
    'Bebidas': '🥤',
    'Otros': '📦'
  };

  // Storage Location Badges
  const LOCATION_BADGES: Record<StorageLocation, { icon: string; temp: string }> = {
    'Refrigerador': { icon: '❄️', temp: '0°C a 4°C' },
    'Congelador': { icon: '🧊', temp: '-18°C' },
    'Bodega seca': { icon: '📦', temp: 'Ambiente' },
    'Vitrina': { icon: '🍱', temp: 'Exhibición' },
    'Otro': { icon: '📍', temp: 'General' }
  };

  // Quick Expiry Presets Definition
  interface PresetItem {
    id: '+2d' | '+3d' | '+1w' | '+1m';
    label: string;
    description: string;
    calc: () => string;
  }

  const PRESETS: PresetItem[] = [
    { id: '+2d', label: '+2d', description: 'Leche/Pescado', calc: () => presetPlus2Days() },
    { id: '+3d', label: '+3d', description: 'Cocinado HACCP', calc: () => presetPlus3Days() },
    { id: '+1w', label: '+1w', description: 'Vacío/Curados', calc: () => presetPlus1Week() },
    { id: '+1m', label: '+1m', description: 'Congelados/Secos', calc: () => presetPlus1Month() }
  ];

  // Derived Values
  const isEditing = $derived(Boolean(product && product.id));
  const modalTitle = $derived(isEditing ? 'Editar Ingrediente' : 'Nuevo Ingrediente');

  // Days remaining calculation for real-time status feedback
  const daysDiff = $derived(calculateDayDiff(expiryDate));
  const expiryStatusBadge = $derived.by(() => {
    if (!expiryDate || daysDiff === 99999) {
      return { text: 'Selecciona una fecha', cls: 'badge-muted' };
    }
    if (daysDiff < 0) {
      const abs = Math.abs(daysDiff);
      return { text: `⚠️ Vencido hace ${abs} día(s)`, cls: 'badge-expired' };
    }
    if (daysDiff === 0) {
      return { text: '⚡ Vence hoy', cls: 'badge-warning' };
    }
    if (daysDiff <= 3) {
      return { text: `⚡ Vencimiento crítico (${daysDiff} días)`, cls: 'badge-warning' };
    }
    if (daysDiff <= 7) {
      return { text: `🔔 Vence esta semana (${daysDiff} días)`, cls: 'badge-info' };
    }
    return { text: `✓ Vigente (${daysDiff} días)`, cls: 'badge-ok' };
  });

  // Validation Check
  const isValid = $derived(
    name.trim().length > 0 &&
    quantity > 0 &&
    expiryDate.trim().length === 10
  );

  // Sync Form when `product` or `initialBarcode` changes
  $effect(() => {
    if (product) {
      name = product.name || '';
      category = product.category || 'Otros';
      quantity = product.quantity ?? 1;
      unit = product.unit || 'unidad(es)';
      location = product.location || 'Refrigerador';
      receivedDate = product.receivedDate || formatDateISO(new Date());
      expiryDate = product.expiryDate || presetPlus3Days();
      lot = product.lot || '';
      supplier = product.supplier || '';
      barcode = product.barcode || '';
      notes = product.notes || '';
      showAdvanced = Boolean(product.lot || product.supplier || product.barcode || product.notes);
    } else {
      resetForm();
      if (initialBarcode) {
        barcode = initialBarcode;
        showAdvanced = true;
      }
    }
  });

  function resetForm() {
    name = '';
    category = 'Otros';
    quantity = 1;
    unit = 'unidad(es)';
    location = 'Refrigerador';
    receivedDate = formatDateISO(new Date());
    expiryDate = presetPlus3Days();
    lot = '';
    supplier = '';
    barcode = '';
    notes = '';
    showAdvanced = false;
    validationError = null;
  }

  // Stepper handlers
  function getStepSize(): number {
    if (unit === 'kg' || unit === 'L') return 0.5;
    if (unit === 'g' || unit === 'ml') return 50;
    return 1;
  }

  function handleIncrement() {
    const step = getStepSize();
    quantity = Math.round((Number(quantity || 0) + step) * 100) / 100;
  }

  function handleDecrement() {
    const step = getStepSize();
    const nextVal = Math.max(0, Math.round((Number(quantity || 0) - step) * 100) / 100);
    quantity = nextVal;
  }

  // Quick Preset Click Handler
  function applyPreset(preset: PresetItem) {
    expiryDate = preset.calc();
  }

  // Submit Handler
  async function handleSubmit() {
    if (!name.trim()) {
      validationError = 'Ingresa el nombre del producto';
      return;
    }
    if (quantity <= 0) {
      validationError = 'La cantidad debe ser mayor a 0';
      return;
    }
    if (!expiryDate || expiryDate.trim().length !== 10) {
      validationError = 'Selecciona una fecha de vencimiento válida';
      return;
    }

    validationError = null;
    submitting = true;

    try {
      const payload: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        category,
        quantity: Number(quantity),
        unit,
        receivedDate: receivedDate || formatDateISO(new Date()),
        expiryDate,
        location,
        lot: lot.trim() || undefined,
        supplier: supplier.trim() || undefined,
        barcode: barcode.trim() || undefined,
        notes: notes.trim() || undefined,
        isDiscarded: false,
        isConsumed: false,
        createdBy: '',
        updatedBy: '',
        lastAction: isEditing ? 'UPDATE' : 'CREATE'
      };

      if (onSave) {
        await onSave(payload);
      }

      resetForm();
      if (onClose) onClose();
    } catch (err: any) {
      validationError = err?.message || 'Error al guardar el producto en inventario';
    } finally {
      submitting = false;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open && onClose) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="drawer-backdrop"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-labelledby="product-form-title"
  >
    <div class="drawer-container">
      <!-- Drawer Handle Indicator (Mobile Affordance) -->
      <div class="drawer-handle" aria-hidden="true"></div>

      <!-- Header -->
      <header class="drawer-header">
        <div class="header-titles">
          <h2 id="product-form-title" class="drawer-title">{modalTitle}</h2>
          <span class="drawer-subtitle">Registro rápido para cocina profesional</span>
        </div>
        <button
          type="button"
          class="btn-close"
          onclick={onClose}
          aria-label="Cerrar formulario"
        >
          ✕
        </button>
      </header>

      <!-- Scrollable Form Body -->
      <form class="drawer-body" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <!-- Product Name Input -->
        <div class="form-group">
          <label for="prod-name" class="field-label">
            <span>Nombre del Ingrediente</span>
            <span class="req">*</span>
          </label>
          <div class="input-clear-wrap">
            <input
              id="prod-name"
              type="text"
              class="text-input"
              placeholder="ej. Salmón fresco, Leche 1L, Tomates..."
              bind:value={name}
              required
              autocomplete="off"
            />
            {#if name.length > 0}
              <button
                type="button"
                class="btn-input-clear"
                onclick={() => (name = '')}
                aria-label="Limpiar nombre"
              >
                ✕
              </button>
            {/if}
          </div>
        </div>

        <!-- Category Visual Pills -->
        <div class="form-group">
          <span class="field-label">
            <span>Categoría</span>
            <span class="req">*</span>
          </span>
          <div class="pills-grid" role="radiogroup" aria-label="Categoría del ingrediente">
            {#each PRODUCT_CATEGORIES as cat}
              <button
                type="button"
                class="category-pill"
                class:selected={category === cat}
                onclick={() => (category = cat)}
                role="radio"
                aria-checked={category === cat}
              >
                <span class="pill-icon">{CATEGORY_ICONS[cat] || '📦'}</span>
                <span class="pill-label">{cat}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Quantity Stepper & Unit Selector -->
        <div class="form-row">
          <!-- Stepper -->
          <div class="form-group stepper-group">
            <label for="prod-qty" class="field-label">
              <span>Cantidad</span>
              <span class="req">*</span>
            </label>
            <div class="stepper-wrap">
              <button
                type="button"
                class="stepper-btn btn-minus"
                onclick={handleDecrement}
                aria-label="Disminuir cantidad"
              >
                −
              </button>
              <input
                id="prod-qty"
                type="number"
                step="any"
                min="0"
                class="stepper-input"
                bind:value={quantity}
                required
              />
              <button
                type="button"
                class="stepper-btn btn-plus"
                onclick={handleIncrement}
                aria-label="Aumentar cantidad"
              >
                +
              </button>
            </div>
          </div>

          <!-- Unit Selector -->
          <div class="form-group unit-group">
            <label for="prod-unit" class="field-label">
              <span>Unidad</span>
              <span class="req">*</span>
            </label>
            <select id="prod-unit" class="select-input" bind:value={unit}>
              {#each PRODUCT_UNITS as u}
                <option value={u}>{u}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Storage Location Selector -->
        <div class="form-group">
          <span class="field-label">
            <span>Ubicación de Almacenamiento</span>
            <span class="req">*</span>
          </span>
          <div class="locations-wrap" role="radiogroup" aria-label="Ubicación de almacenamiento">
            {#each STORAGE_LOCATIONS as loc}
              <button
                type="button"
                class="location-chip"
                class:selected={location === loc}
                onclick={() => (location = loc)}
                role="radio"
                aria-checked={location === loc}
              >
                <span class="loc-icon">{LOCATION_BADGES[loc].icon}</span>
                <div class="loc-text">
                  <span class="loc-title">{loc}</span>
                  <span class="loc-sub">{LOCATION_BADGES[loc].temp}</span>
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Expiry Date & Quick 1-Touch Presets (Feature 14) -->
        <div class="form-group expiry-section">
          <div class="expiry-header">
            <label for="prod-expiry" class="field-label">
              <span>Fecha de Vencimiento</span>
              <span class="req">*</span>
            </label>
            <span class="status-pill {expiryStatusBadge.cls}">
              {expiryStatusBadge.text}
            </span>
          </div>

          <!-- Quick Presets Row -->
          <div class="presets-row" role="group" aria-label="Atajos de caducidad rápida">
            {#each PRESETS as preset}
              {@const presetDate = preset.calc()}
              {@const isSelected = expiryDate === presetDate}
              <button
                type="button"
                class="preset-btn"
                class:active={isSelected}
                onclick={() => applyPreset(preset)}
                aria-pressed={isSelected}
              >
                <span class="preset-tag">{preset.label}</span>
                <span class="preset-date">{presetDate.slice(5)}</span>
                <span class="preset-desc">{preset.description}</span>
              </button>
            {/each}
          </div>

          <!-- Direct Date Input -->
          <div class="date-picker-wrap">
            <input
              id="prod-expiry"
              type="date"
              class="date-input"
              bind:value={expiryDate}
              required
            />
          </div>
        </div>

        <!-- Advanced Traceability Accordion (Lot, Supplier, Barcode, Notes) -->
        <div class="advanced-section">
          <button
            type="button"
            class="advanced-toggle-btn"
            onclick={() => (showAdvanced = !showAdvanced)}
            aria-expanded={showAdvanced}
          >
            <span class="toggle-icon">{showAdvanced ? '▼' : '▶'}</span>
            <span class="toggle-text">Trazabilidad Avanzada (Lote, Proveedor, Código QR/Barras)</span>
          </button>

          {#if showAdvanced}
            <div class="advanced-fields">
              <!-- Barcode / QR Code with Camera Scan Trigger -->
              <div class="form-group">
                <label for="prod-barcode" class="field-label">Código de Barras / QR</label>
                <div class="barcode-input-wrap">
                  <input
                    id="prod-barcode"
                    type="text"
                    class="text-input"
                    placeholder="EAN-13, UPC o QR..."
                    bind:value={barcode}
                  />
                  {#if onScanRequested}
                    <button
                      type="button"
                      class="btn-scan-trigger"
                      onclick={onScanRequested}
                      aria-label="Abrir cámara para escanear código"
                    >
                      📷 Escanear
                    </button>
                  {/if}
                </div>
              </div>

              <div class="form-row">
                <!-- Lot -->
                <div class="form-group">
                  <label for="prod-lot" class="field-label">Número de Lote</label>
                  <input
                    id="prod-lot"
                    type="text"
                    class="text-input"
                    placeholder="ej. LOT-2026-X8"
                    bind:value={lot}
                  />
                </div>

                <!-- Supplier -->
                <div class="form-group">
                  <label for="prod-supplier" class="field-label">Proveedor</label>
                  <input
                    id="prod-supplier"
                    type="text"
                    class="text-input"
                    placeholder="ej. Distribuidora del Sur"
                    bind:value={supplier}
                  />
                </div>
              </div>

              <!-- Received Date -->
              <div class="form-group">
                <label for="prod-received" class="field-label">Fecha de Recepción / Elaboración</label>
                <input
                  id="prod-received"
                  type="date"
                  class="date-input"
                  bind:value={receivedDate}
                />
              </div>

              <!-- Notes -->
              <div class="form-group">
                <label for="prod-notes" class="field-label">Observaciones / Alérgenos</label>
                <textarea
                  id="prod-notes"
                  class="textarea-input"
                  rows="2"
                  placeholder="ej. Pasteurizado, mantener en envase hermético..."
                  bind:value={notes}
                ></textarea>
              </div>
            </div>
          {/if}
        </div>

        <!-- Validation Error Message -->
        {#if validationError}
          <div class="error-banner" role="alert">
            <span class="err-icon">⚠️</span>
            <span class="err-text">{validationError}</span>
          </div>
        {/if}

        <!-- Footer Actions -->
        <div class="drawer-footer">
          <button
            type="button"
            class="btn-cancel"
            onclick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="btn-submit"
            disabled={!isValid || submitting}
          >
            {#if submitting}
              <span class="spinner"></span>
              <span>Guardando...</span>
            {:else}
              <span>{isEditing ? 'Guardar Cambios' : 'Registrar Producto'}</span>
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  /* Modal / Bottom Drawer Overlay */
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(38, 33, 28, 0.65);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .drawer-container {
    width: 100%;
    max-width: 640px;
    max-height: 92vh;
    max-height: 92dvh;
    background-color: var(--color-surface, #ffffff);
    border-radius: 24px 24px 0 0;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.28);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @media (min-width: 768px) {
    .drawer-backdrop {
      align-items: center;
      padding: 24px;
    }
    .drawer-container {
      border-radius: 24px;
      max-height: 88vh;
    }
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  /* Handle Indicator */
  .drawer-handle {
    width: 44px;
    height: 5px;
    background-color: #d8cec4;
    border-radius: 3px;
    margin: 10px auto 4px auto;
    flex-shrink: 0;
  }

  /* Header */
  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px 16px 20px;
    border-bottom: 1px solid var(--color-line, #eadfd2);
    flex-shrink: 0;
  }

  .header-titles {
    display: flex;
    flex-direction: column;
  }

  .drawer-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--color-ink, #302821);
    letter-spacing: -0.01em;
  }

  .drawer-subtitle {
    font-size: 0.8rem;
    color: var(--color-muted, #7c7168);
  }

  .btn-close {
    min-width: var(--touch-min, 44px);
    min-height: var(--touch-min, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--color-muted, #7c7168);
    font-size: 1.2rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  .btn-close:active {
    background-color: #f0e7dc;
  }

  /* Body */
  .drawer-body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 16px 20px calc(24px + env(safe-area-inset-bottom, 0px)) 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-row {
    display: flex;
    gap: 12px;
  }

  .field-label {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--color-ink, #302821);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .req {
    color: var(--color-red, #b84035);
  }

  /* Text & Select Inputs */
  .text-input,
  .select-input,
  .date-input,
  .textarea-input {
    width: 100%;
    min-height: 48px;
    padding: 10px 14px;
    font-size: 1rem;
    font-family: inherit;
    color: var(--color-ink, #302821);
    background-color: #fbf8f4;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 12px;
    transition: border-color 0.15s, box-shadow 0.15s;
    touch-action: manipulation;
  }

  .text-input:focus,
  .select-input:focus,
  .date-input:focus,
  .textarea-input:focus {
    outline: none;
    border-color: var(--color-brown, #75472f);
    box-shadow: 0 0 0 3px rgba(117, 71, 47, 0.15);
    background-color: #ffffff;
  }

  .input-clear-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-clear-wrap .text-input {
    padding-right: 44px;
  }

  .btn-input-clear {
    position: absolute;
    right: 4px;
    min-width: 40px;
    min-height: 40px;
    background: transparent;
    border: none;
    color: var(--color-muted, #7c7168);
    font-size: 1rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  /* Category Visual Pills Grid */
  .pills-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
  }

  .category-pill {
    min-height: var(--touch-min, 44px);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background-color: #f7f2eb;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-ink, #302821);
    cursor: pointer;
    transition: all 0.15s ease;
    touch-action: manipulation;
    text-align: left;
  }

  .category-pill:hover {
    background-color: #f0e6da;
  }

  .category-pill.selected {
    background-color: var(--color-brown, #75472f);
    border-color: var(--color-brown-dark, #69412d);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(117, 71, 47, 0.25);
  }

  .pill-icon {
    font-size: 1.15rem;
    flex-shrink: 0;
  }

  .pill-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Stepper */
  .stepper-group {
    flex: 1.2;
  }

  .unit-group {
    flex: 1;
  }

  .stepper-wrap {
    display: flex;
    align-items: center;
    background-color: #fbf8f4;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 12px;
    overflow: hidden;
  }

  .stepper-btn {
    min-width: 48px;
    min-height: 48px;
    background: transparent;
    border: none;
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--color-brown, #75472f);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    touch-action: manipulation;
    user-select: none;
  }

  .stepper-btn:active {
    background-color: #ebe0d4;
  }

  .stepper-input {
    flex: 1;
    min-height: 48px;
    border: none;
    background: transparent;
    text-align: center;
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--color-ink, #302821);
    font-family: inherit;
    -moz-appearance: textfield;
  }

  .stepper-input::-webkit-outer-spin-button,
  .stepper-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .stepper-input:focus {
    outline: none;
  }

  /* Location Chips */
  .locations-wrap {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
  }

  .location-chip {
    min-height: var(--touch-min, 44px);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background-color: #f7f2eb;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    touch-action: manipulation;
    text-align: left;
  }

  .location-chip.selected {
    background-color: #3b2c23;
    border-color: #271c16;
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(39, 28, 22, 0.3);
  }

  .loc-icon {
    font-size: 1.15rem;
    flex-shrink: 0;
  }

  .loc-text {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .loc-title {
    font-size: 0.82rem;
    font-weight: 700;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  .loc-sub {
    font-size: 0.7rem;
    color: var(--color-muted, #7c7168);
  }

  .location-chip.selected .loc-sub {
    color: #d8cec4;
  }

  /* Expiry Section & Presets */
  .expiry-section {
    background-color: #fcf9f5;
    padding: 14px;
    border-radius: 16px;
    border: 1.5px solid var(--color-line, #eadfd2);
  }

  .expiry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }

  .status-pill {
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .badge-expired {
    background-color: #fde8e7;
    color: var(--color-red, #b84035);
  }

  .badge-warning {
    background-color: #fef3df;
    color: var(--color-amber, #a56b15);
  }

  .badge-info {
    background-color: #e8f3ee;
    color: var(--color-green, #4c7860);
  }

  .badge-ok {
    background-color: #e8f3ee;
    color: var(--color-green, #4c7860);
  }

  .badge-muted {
    background-color: #f0e8de;
    color: var(--color-muted, #7c7168);
  }

  .presets-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .preset-btn {
    min-height: 52px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 6px 4px;
    background-color: #ffffff;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    touch-action: manipulation;
  }

  .preset-btn:active {
    transform: scale(0.97);
  }

  .preset-btn.active {
    background-color: var(--color-brown, #75472f);
    border-color: var(--color-brown-dark, #69412d);
    color: #ffffff;
    box-shadow: 0 3px 8px rgba(117, 71, 47, 0.3);
  }

  .preset-tag {
    font-size: 0.95rem;
    font-weight: 800;
    line-height: 1.1;
  }

  .preset-date {
    font-size: 0.72rem;
    font-weight: 600;
    opacity: 0.9;
  }

  .preset-desc {
    font-size: 0.65rem;
    opacity: 0.75;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* Advanced Collapsible */
  .advanced-section {
    border-top: 1px dashed var(--color-line, #eadfd2);
    padding-top: 10px;
  }

  .advanced-toggle-btn {
    min-height: var(--touch-min, 44px);
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    color: var(--color-brown, #75472f);
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
    padding: 4px 0;
  }

  .advanced-fields {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: fadeIn 0.15s ease-out;
  }

  .barcode-input-wrap {
    display: flex;
    gap: 8px;
  }

  .btn-scan-trigger {
    min-width: 90px;
    min-height: 48px;
    background-color: #f0e6da;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--color-brown-dark, #69412d);
    cursor: pointer;
    touch-action: manipulation;
    white-space: nowrap;
  }

  .btn-scan-trigger:active {
    background-color: #dfd0c0;
  }

  /* Error Banner */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background-color: #fde8e7;
    border-left: 4px solid var(--color-red, #b84035);
    border-radius: 8px;
    font-size: 0.85rem;
    color: var(--color-red, #b84035);
    font-weight: 600;
  }

  /* Footer Actions */
  .drawer-footer {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .btn-cancel {
    flex: 1;
    min-height: 50px;
    background-color: #f5eeea;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 14px;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-muted, #7c7168);
    cursor: pointer;
    touch-action: manipulation;
  }

  .btn-cancel:active {
    background-color: #e8ded8;
  }

  .btn-submit {
    flex: 2;
    min-height: 50px;
    background-color: var(--color-brown, #75472f);
    color: #ffffff;
    border: none;
    border-radius: 14px;
    font-size: 1rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(117, 71, 47, 0.28);
    transition: transform 0.1s ease, background-color 0.15s;
    touch-action: manipulation;
  }

  .btn-submit:active {
    transform: scale(0.98);
    background-color: var(--color-brown-dark, #69412d);
  }

  .btn-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
