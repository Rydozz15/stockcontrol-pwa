<!--
  StockControl PWA — ProductForm.svelte
  Ergonomic touch-friendly product entry drawer/modal for restaurant kitchens.
  Path: src/lib/components/ProductForm.svelte
  Ergonomics: WCAG 2.5.5 Touch Targets (>=44x44px, >=8px spacing, quick presets +2d/+3d/+1w/+1m, stepper >=48px)
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    PRODUCT_CATEGORIES,
    PRODUCT_UNITS,
    STORAGE_LOCATIONS,
    type Product,
    type ProductCategory,
    type ProductUnit,
    type StorageLocation
  } from '$lib/domain/models';
  import type { ProductItem } from '$lib/stores/inventoryStore';

  import {
    formatDateISO,
    calculateDayDiff,
    presetPlus2Days,
    presetPlus3Days,
    presetPlus1Week,
    presetPlus1Month
  } from '$lib/domain/expiry';

  export let open: boolean = false;
  export let isOpen: boolean = false;
  export let product: Product | ProductItem | null = null;
  export let productToEdit: Product | ProductItem | null = null;
  export let initialBarcode: string = '';

  export let onSave: ((productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void> | void) | undefined = undefined;
  export let onClose: (() => void) | undefined = undefined;
  export let onScanRequested: (() => void) | undefined = undefined;

  $: isFormVisible = open || isOpen;
  $: activeProduct = product || productToEdit;

  const dispatch = createEventDispatcher<{
    save: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
    close: void;
    scanRequested: void;
  }>();

  // Internal Form State
  let name: string = '';
  let category: ProductCategory = 'Otros';
  let quantity: number = 1;
  let unit: ProductUnit = 'unidad(es)';
  let location: StorageLocation = 'Refrigerador';
  let receivedDate: string = formatDateISO(new Date());
  let expiryDate: string = presetPlus3Days();
  let lot: string = '';
  let supplier: string = '';
  let barcode: string = '';
  let notes: string = '';

  let showAdvanced: boolean = false;
  let submitting: boolean = false;
  let validationError: string | null = null;

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

  $: isEditing = Boolean(activeProduct && activeProduct.id);
  $: modalTitle = isEditing ? 'Editar Ingrediente' : 'Nuevo Ingrediente';

  // Days remaining calculation for real-time status feedback
  $: daysDiff = calculateDayDiff(expiryDate);
  $: expiryStatusBadge = getExpiryStatusBadge(expiryDate, daysDiff);

  function getExpiryStatusBadge(date: string, diff: number) {
    if (!date || diff === 99999) {
      return { text: 'Selecciona una fecha', cls: 'badge-muted' };
    }
    if (diff < 0) {
      const abs = Math.abs(diff);
      return { text: `⚠️ Vencido hace ${abs} día(s)`, cls: 'badge-expired' };
    }
    if (diff === 0) {
      return { text: '⚡ Vence hoy', cls: 'badge-warning' };
    }
    if (diff <= 3) {
      return { text: `⚡ Vencimiento crítico (${diff} días)`, cls: 'badge-warning' };
    }
    if (diff <= 7) {
      return { text: `🔔 Vence esta semana (${diff} días)`, cls: 'badge-info' };
    }
    return { text: `✓ Vigente (${diff} días)`, cls: 'badge-ok' };
  }

  $: isValid = name.trim().length > 0 && Number(quantity) > 0 && expiryDate.trim().length === 10;

  // React to changes in activeProduct or initialBarcode
  let prevProductRef: any = null;
  $: if (activeProduct !== prevProductRef) {
    prevProductRef = activeProduct;
    if (activeProduct) {
      name = activeProduct.name || '';
      category = activeProduct.category || 'Otros';
      quantity = activeProduct.quantity ?? 1;
      unit = activeProduct.unit || 'unidad(es)';
      location = activeProduct.location || 'Refrigerador';
      receivedDate = activeProduct.receivedDate || formatDateISO(new Date());
      expiryDate = activeProduct.expiryDate || presetPlus3Days();
      lot = activeProduct.lot || '';
      supplier = activeProduct.supplier || '';
      barcode = activeProduct.barcode || '';
      notes = activeProduct.notes || '';
      showAdvanced = Boolean(activeProduct.lot || activeProduct.supplier || activeProduct.barcode || activeProduct.notes);
    } else {
      resetForm();
      if (initialBarcode) {
        barcode = initialBarcode;
        showAdvanced = true;
      }
    }
  }

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

  function applyPreset(preset: PresetItem) {
    expiryDate = preset.calc();
  }

  function handleCloseModal() {
    open = false;
    isOpen = false;
    if (onClose) onClose();
    dispatch('close');
  }

  async function handleSubmit() {
    if (!name.trim()) {
      validationError = 'Ingresa el nombre del producto';
      return;
    }
    if (Number(quantity) <= 0) {
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
      dispatch('save', payload);

      resetForm();
      handleCloseModal();
    } catch (err: any) {
      validationError = err?.message || 'Error al guardar el producto en inventario';
    } finally {
      submitting = false;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isFormVisible) {
      handleCloseModal();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isFormVisible}
  <div
    class="drawer-backdrop"
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="product-form-title"
  >
    <div
      class="drawer-container"
      role="document"
    >
      <div class="drawer-handle" aria-hidden="true"></div>

      <header class="drawer-header">
        <div class="header-titles">
          <h2 id="product-form-title" class="drawer-title">{modalTitle}</h2>
          <span class="drawer-subtitle">Registro rápido para cocina profesional</span>
        </div>
        <button
          type="button"
          class="btn-close"
          on:click={handleCloseModal}
          aria-label="Cerrar formulario"
        >
          ✕
        </button>
      </header>

      <form class="drawer-body" on:submit|preventDefault={handleSubmit}>
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
                on:click={() => (name = '')}
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
                on:click={() => (category = cat)}
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
          <div class="form-group stepper-group">
            <label for="prod-qty" class="field-label">
              <span>Cantidad</span>
              <span class="req">*</span>
            </label>
            <div class="stepper-wrap">
              <button
                type="button"
                class="stepper-btn btn-minus"
                on:click={handleDecrement}
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
                on:click={handleIncrement}
                aria-label="Aumentar cantidad"
              >
                +
              </button>
            </div>
          </div>

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
                on:click={() => (location = loc)}
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

        <!-- Expiry Date & Quick 1-Touch Presets -->
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

          <div class="presets-row" role="group" aria-label="Atajos de caducidad rápida">
            {#each PRESETS as preset}
              {@const presetDate = preset.calc()}
              {@const isSelected = expiryDate === presetDate}
              <button
                type="button"
                class="preset-btn"
                class:active={isSelected}
                on:click={() => applyPreset(preset)}
                aria-pressed={isSelected}
              >
                <span class="preset-tag">{preset.label}</span>
                <span class="preset-date">{presetDate.slice(5)}</span>
                <span class="preset-desc">{preset.description}</span>
              </button>
            {/each}
          </div>

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

        <!-- Advanced Traceability Accordion -->
        <div class="advanced-section">
          <button
            type="button"
            class="advanced-toggle-btn"
            on:click={() => (showAdvanced = !showAdvanced)}
            aria-expanded={showAdvanced}
          >
            <span class="toggle-icon">{showAdvanced ? '▼' : '▶'}</span>
            <span class="toggle-text">Trazabilidad Avanzada (Lote, Proveedor, Código QR/Barras)</span>
          </button>

          {#if showAdvanced}
            <div class="advanced-fields">
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
                      on:click={() => {
                        if (onScanRequested) onScanRequested();
                        dispatch('scanRequested');
                      }}
                      aria-label="Abrir cámara para escanear código"
                    >
                      📷 Escanear
                    </button>
                  {/if}
                </div>
              </div>

              <div class="form-row">
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

              <div class="form-group">
                <label for="prod-received" class="field-label">Fecha de Recepción / Elaboración</label>
                <input
                  id="prod-received"
                  type="date"
                  class="date-input"
                  bind:value={receivedDate}
                />
              </div>

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

        {#if validationError}
          <div class="error-banner" role="alert">
            <span class="err-icon">⚠️</span>
            <span class="err-text">{validationError}</span>
          </div>
        {/if}

        <div class="drawer-footer">
          <button
            type="button"
            class="btn-cancel"
            on:click={handleCloseModal}
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

  .drawer-handle {
    width: 44px;
    height: 5px;
    background-color: #d8cec4;
    border-radius: 3px;
    margin: 10px auto 4px auto;
    flex-shrink: 0;
  }

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

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
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

  .input-clear-wrap,
  .barcode-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .text-input,
  .date-input,
  .select-input,
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
  .date-input:focus,
  .select-input:focus,
  .textarea-input:focus {
    outline: none;
    border-color: var(--color-brown, #75472f);
    box-shadow: 0 0 0 3px rgba(117, 71, 47, 0.15);
    background-color: #ffffff;
  }

  .input-clear-wrap .text-input {
    padding-right: 48px;
  }

  .barcode-input-wrap .text-input {
    padding-right: 120px;
  }

  .btn-input-clear {
    position: absolute;
    right: 4px;
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--color-muted, #7c7168);
    font-size: 0.95rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  /* Category Visual Pills Grid */
  .pills-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  @media (min-width: 480px) {
    .pills-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .category-pill {
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background-color: #fbf8f4;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 12px;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-ink, #302821);
    cursor: pointer;
    transition: all 0.12s ease;
    touch-action: manipulation;
    text-align: left;
  }

  .category-pill:active {
    transform: scale(0.97);
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Stepper */
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
    background-color: #f0e7dc;
    border: none;
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--color-brown, #75472f);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
    transition: background-color 0.1s;
  }

  .stepper-btn:active {
    background-color: #e5d8c8;
  }

  .stepper-input {
    flex: 1;
    min-height: 48px;
    border: none;
    background: transparent;
    text-align: center;
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--color-ink, #302821);
  }

  .stepper-input:focus {
    outline: none;
  }

  /* Location Chips */
  .locations-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .location-chip {
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background-color: #fbf8f4;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.12s;
    touch-action: manipulation;
  }

  .location-chip.selected {
    background-color: #2b78b8;
    border-color: #1e5c8e;
    color: #ffffff;
  }

  .loc-text {
    display: flex;
    flex-direction: column;
    text-align: left;
  }

  .loc-title {
    font-size: 0.82rem;
    font-weight: 700;
  }

  .loc-sub {
    font-size: 0.68rem;
    opacity: 0.85;
  }

  /* Expiry Section & Quick Presets */
  .expiry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .status-pill {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 8px;
  }

  .badge-ok { background: #d1fae5; color: #065f46; }
  .badge-info { background: #dbeafe; color: #1e40af; }
  .badge-warning { background: #fef3c7; color: #92400e; }
  .badge-expired { background: #fee2e2; color: #991b1b; }
  .badge-muted { background: #f3f4f6; color: #6b7280; }

  .presets-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-top: 4px;
    margin-bottom: 6px;
  }

  .preset-btn {
    min-height: 52px;
    padding: 6px 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #fbf8f4;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 10px;
    cursor: pointer;
    touch-action: manipulation;
    transition: all 0.12s ease;
  }

  .preset-btn:active {
    transform: scale(0.96);
  }

  .preset-btn.active {
    background-color: var(--color-brown, #75472f);
    border-color: var(--color-brown-dark, #69412d);
    color: #ffffff;
    box-shadow: 0 2px 6px rgba(117, 71, 47, 0.25);
  }

  .preset-tag {
    font-size: 0.88rem;
    font-weight: 800;
  }

  .preset-date {
    font-size: 0.7rem;
    font-family: monospace;
    opacity: 0.9;
  }

  .preset-desc {
    font-size: 0.62rem;
    opacity: 0.8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* Advanced Traceability Accordion */
  .advanced-section {
    border-top: 1px solid var(--color-line, #eadfd2);
    padding-top: 10px;
  }

  .advanced-toggle-btn {
    min-height: 44px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    color: var(--color-brown, #75472f);
    font-size: 0.86rem;
    font-weight: 700;
    cursor: pointer;
    padding: 6px 0;
    text-align: left;
    touch-action: manipulation;
  }

  .advanced-fields {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 10px;
    padding: 12px;
    background-color: #faf5ee;
    border-radius: 14px;
  }

  .btn-scan-trigger {
    position: absolute;
    right: 4px;
    min-height: 44px;
    min-width: 44px;
    padding: 0 12px;
    background-color: var(--color-brown, #75472f);
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    touch-action: manipulation;
  }

  /* Error Banner */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background-color: #fef2f2;
    border: 1.5px solid #fecaca;
    border-radius: 10px;
    color: #991b1b;
    font-size: 0.85rem;
    font-weight: 700;
  }

  /* Footer */
  .drawer-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--color-line, #eadfd2);
  }

  .btn-cancel {
    min-height: 48px;
    min-width: 100px;
    background: transparent;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 12px;
    color: var(--color-muted, #7c7168);
    font-size: 0.92rem;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-submit {
    flex: 1;
    min-height: 50px;
    background-color: var(--color-brown, #75472f);
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 3px 10px rgba(117, 71, 47, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background-color 0.15s;
  }

  .btn-submit:hover:not(:disabled) {
    background-color: var(--color-brown-dark, #69412d);
  }

  .btn-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #ffffff;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
