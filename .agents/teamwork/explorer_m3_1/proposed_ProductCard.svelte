<!--
  StockControl PWA — ProductCard.svelte
  Clean Architecture Presentation Component
  Path: src/lib/components/ProductCard.svelte
  Ergonomics: WCAG 2.5.5 Touch Targets (>=44x44px, >=8px spacing, 1-tap consume with undo, 1-tap merma confirmation)
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Product, WasteReason } from '$lib/domain/models';
  import { WASTE_REASONS, WASTE_REASON_LABELS } from '$lib/domain/models';
  import { calculateExpiryStatus } from '$lib/domain/expiry';
  import {
    inventoryStore,
    consumeStockAction,
    discardStockAction,
    type ProductItem
  } from '$lib/stores/inventoryStore';
  import { toastStore } from '$lib/stores/toastStore';

  export let product: ProductItem | Product;
  export let selected: boolean = false;
  export let compact: boolean = false;

  const dispatch = createEventDispatcher<{
    consume: { product: ProductItem | Product; previousQuantity: number };
    waste: { product: ProductItem | Product; reason: WasteReason };
    select: { product: ProductItem | Product };
    edit: { product: ProductItem | Product };
  }>();

  let showWasteModal = false;
  let selectedWasteReason: WasteReason = 'vencimiento';
  let isDiscarding = false;

  $: expiryStatus = calculateExpiryStatus(product.expiryDate || '');

  // Pre-select most plausible reason based on expiry status
  $: if (expiryStatus.key === 'expired') {
    selectedWasteReason = 'vencimiento';
  } else if (selectedWasteReason === 'vencimiento' && expiryStatus.key === 'ok') {
    selectedWasteReason = 'calidad';
  }

  function handleCardClick(event: MouseEvent | KeyboardEvent) {
    // Only trigger if click wasn't on an interactive child button/modal
    dispatch('select', { product });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dispatch('select', { product });
    }
  }

  async function handleQuickConsume(event: MouseEvent) {
    event.stopPropagation();
    if (product.quantity <= 0) {
      toastStore.warning(`El producto ${product.name} ya está agotado`);
      return;
    }

    const previousQty = product.quantity;
    const result = inventoryStore.consumeOne(product.id);

    if (result) {
      // 1-Tap Undo Toast (Feature 15)
      toastStore.undo(`Consumiste 1 unidad de ${product.name}`, () => {
        inventoryStore.updateProduct(product.id, {
          quantity: result.previousQuantity,
          isConsumed: false
        });
        toastStore.info(`Restaurada 1 unidad de ${product.name}`);
      });

      // Background Firestore persistence
      consumeStockAction(product.id, 1, 'Consumo rápido 1-tap móvil').catch((err) => {
        console.warn('[ProductCard] Background consume error:', err);
      });

      dispatch('consume', { product, previousQuantity: previousQty });
    }
  }

  function openWasteModal(event: MouseEvent) {
    event.stopPropagation();
    showWasteModal = true;
  }

  function closeWasteModal(event?: MouseEvent) {
    if (event) event.stopPropagation();
    showWasteModal = false;
  }

  async function confirmWaste(event: MouseEvent) {
    event.stopPropagation();
    if (isDiscarding) return;

    isDiscarding = true;
    try {
      // Optimistic local update
      inventoryStore.updateProduct(product.id, {
        isDiscarded: true,
        quantity: 0
      });

      const label = WASTE_REASON_LABELS[selectedWasteReason] || selectedWasteReason;
      toastStore.warning(`Producto ${product.name} descartado por merma (${label})`);

      // Background Firestore persistence
      await discardStockAction(product.id, selectedWasteReason);

      dispatch('waste', { product, reason: selectedWasteReason });
      showWasteModal = false;
    } catch (err: any) {
      console.error('[ProductCard] Error registering waste:', err);
      toastStore.error('No se pudo registrar la merma en el servidor');
    } finally {
      isDiscarding = false;
    }
  }
</script>

<article
  class="product-card"
  class:selected
  class:compact
  class:status-expired={expiryStatus.key === 'expired'}
  class:status-soon={expiryStatus.key === 'soon'}
  class:status-week={expiryStatus.key === 'week'}
  class:status-ok={expiryStatus.key === 'ok'}
  role="button"
  tabindex="0"
  aria-label={`Producto: ${product.name}, ${product.quantity} ${product.unit || 'uds'}, vence: ${expiryStatus.label}`}
  on:click={handleCardClick}
  on:keydown={handleKeydown}
>
  <!-- Card Header: Title + Quantity Badge -->
  <header class="card-header">
    <div class="title-container">
      <h3 class="product-name">{product.name}</h3>
      <div class="metadata-row">
        {#if product.category}
          <span class="chip-category">{product.category}</span>
        {/if}
        {#if product.location}
          <span class="chip-location">
            <span class="location-pin" aria-hidden="true">📍</span>
            {product.location}
          </span>
        {/if}
        {#if product.lot}
          <span class="chip-lot" title="Número de lote">Lote: {product.lot}</span>
        {/if}
      </div>
    </div>

    <!-- Prominent Quantity Badge -->
    <div class="quantity-badge" class:low-stock={product.quantity <= 1}>
      <span class="qty-num">{product.quantity}</span>
      <span class="qty-unit">{product.unit || 'uds'}</span>
    </div>
  </header>

  <!-- Expiry Status Pill -->
  <div class="expiry-section">
    <div class="expiry-pill pill-{expiryStatus.key}" role="status">
      {#if expiryStatus.key === 'expired'}
        <span class="pill-dot red" aria-hidden="true"></span>
        <span class="pill-text font-bold">🚫 {expiryStatus.label}</span>
      {:else if expiryStatus.key === 'soon'}
        <span class="pill-dot amber" aria-hidden="true"></span>
        <span class="pill-text font-bold">⚠️ {expiryStatus.label}</span>
      {:else if expiryStatus.key === 'week'}
        <span class="pill-dot blue" aria-hidden="true"></span>
        <span class="pill-text">⏳ {expiryStatus.label}</span>
      {:else}
        <span class="pill-dot green" aria-hidden="true"></span>
        <span class="pill-text">✓ {expiryStatus.label}</span>
      {/if}
      <span class="expiry-date-iso">({product.expiryDate})</span>
    </div>
  </div>

  <!-- Touch-Friendly 1-Tap Quick Action Row (>=44x44px touch targets, >=8px spacing) -->
  <footer class="card-actions" role="toolbar" aria-label="Acciones rápidas del producto">
    <!-- Primary 1-Tap Consume Button -->
    <button
      type="button"
      class="action-btn btn-consume"
      aria-label={`Consumir 1 unidad de ${product.name}`}
      disabled={product.quantity <= 0}
      on:click={handleQuickConsume}
    >
      <span class="btn-icon" aria-hidden="true">🍽️</span>
      <span class="btn-text">-1 Consumir</span>
    </button>

    <!-- Secondary 1-Tap Merma Button -->
    <button
      type="button"
      class="action-btn btn-waste"
      aria-label={`Registrar merma o descarte de ${product.name}`}
      on:click={openWasteModal}
    >
      <span class="btn-icon" aria-hidden="true">🗑️</span>
      <span class="btn-text">Merma</span>
    </button>
  </footer>
</article>

<!-- Quick Discard / Merma Modal Sheet -->
{#if showWasteModal}
  <div
    class="waste-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="waste-modal-title"
    on:click={closeWasteModal}
  >
    <div class="waste-modal-card" on:click|stopPropagation>
      <header class="modal-header">
        <h4 id="waste-modal-title" class="modal-title">Registrar Merma / Descarte</h4>
        <button
          type="button"
          class="modal-close-btn"
          aria-label="Cerrar ventana"
          on:click={closeWasteModal}
        >
          ✕
        </button>
      </header>

      <p class="modal-desc">
        ¿Dar de baja <strong>{product.name}</strong> ({product.quantity} {product.unit || 'uds'})?
      </p>

      <div class="waste-reasons-group" role="radiogroup" aria-label="Motivo de la merma">
        {#each WASTE_REASONS as reason}
          <label class="reason-option" class:active={selectedWasteReason === reason}>
            <input
              type="radio"
              name="wasteReason"
              value={reason}
              bind:group={selectedWasteReason}
              class="sr-only"
            />
            <span class="radio-indicator"></span>
            <span class="reason-label">{WASTE_REASON_LABELS[reason]}</span>
          </label>
        {/each}
      </div>

      <footer class="modal-footer">
        <button
          type="button"
          class="btn-dialog-cancel"
          on:click={closeWasteModal}
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-dialog-confirm"
          disabled={isDiscarding}
          on:click={confirmWaste}
        >
          {isDiscarding ? 'Guardando...' : 'Confirmar Baja'}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .product-card {
    background-color: var(--color-surface, #ffffff);
    border: 1px solid var(--color-line, #eadfd2);
    border-radius: 14px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 2px 6px rgba(48, 40, 33, 0.04);
    cursor: pointer;
    position: relative;
    transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .product-card:active {
    transform: scale(0.99);
  }

  .product-card:focus-visible {
    outline: 2px solid var(--color-brown, #75472f);
    outline-offset: 2px;
  }

  .product-card.selected {
    border-color: var(--color-brown, #75472f);
    box-shadow: 0 0 0 2px var(--color-brown, #75472f), 0 4px 12px rgba(117, 71, 47, 0.15);
  }

  /* Status accent border on left edge */
  .product-card.status-expired {
    border-left: 5px solid var(--color-red, #b84035);
  }

  .product-card.status-soon {
    border-left: 5px solid var(--color-amber, #a56b15);
  }

  .product-card.status-week {
    border-left: 5px solid #2c5282;
  }

  .product-card.status-ok {
    border-left: 5px solid var(--color-green, #4c7860);
  }

  /* Card Header */
  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .title-container {
    flex: 1;
    min-width: 0;
  }

  .product-name {
    font-size: 1.1rem;
    font-weight: 800;
    line-height: 1.25;
    color: var(--color-ink, #302821);
    word-break: break-word;
    letter-spacing: -0.3px;
  }

  .metadata-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }

  .chip-category,
  .chip-location,
  .chip-lot {
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 6px;
    font-weight: 600;
  }

  .chip-category {
    background-color: var(--color-cream, #fff8ef);
    color: var(--color-brown, #75472f);
    border: 1px solid var(--color-line, #eadfd2);
  }

  .chip-location {
    background-color: #f0f2f5;
    color: #4a5568;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .location-pin {
    font-size: 0.7rem;
  }

  .chip-lot {
    background-color: #edf2f7;
    color: #718096;
    font-family: monospace;
    font-size: 0.7rem;
  }

  /* Quantity Badge */
  .quantity-badge {
    min-width: 54px;
    height: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #26211c;
    color: #ffffff;
    border-radius: 10px;
    padding: 4px 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
    flex-shrink: 0;
  }

  .quantity-badge.low-stock {
    background-color: var(--color-red, #b84035);
  }

  .qty-num {
    font-size: 1.15rem;
    font-weight: 900;
    line-height: 1;
  }

  .qty-unit {
    font-size: 0.65rem;
    opacity: 0.85;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-top: 2px;
  }

  /* Expiry Section */
  .expiry-section {
    display: flex;
    align-items: center;
  }

  .expiry-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 20px;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .expiry-date-iso {
    font-size: 0.75rem;
    opacity: 0.75;
  }

  .font-bold {
    font-weight: 800;
  }

  /* Pill color variations matching HACCP food safety standards */
  .pill-expired {
    background-color: #fde8e7;
    color: #b84035;
    border: 1px solid #f6b5b0;
  }

  .pill-soon {
    background-color: #fef3d6;
    color: #a56b15;
    border: 1px solid #f9df94;
  }

  .pill-week {
    background-color: #e8edf8;
    color: #2c5282;
    border: 1px solid #b7ccf3;
  }

  .pill-ok {
    background-color: #eaf5ee;
    color: #2d6a4f;
    border: 1px solid #aedbbe;
  }

  .pill-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .pill-dot.red { background-color: #b84035; }
  .pill-dot.amber { background-color: #a56b15; }
  .pill-dot.blue { background-color: #2c5282; }
  .pill-dot.green { background-color: #2d6a4f; }

  /* 1-Tap Quick Action Toolbar (>=44x44px touch targets, >=8px spacing) */
  .card-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px dashed var(--color-line, #eadfd2);
  }

  .action-btn {
    min-height: 44px;
    min-width: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: background-color 0.12s ease, transform 0.08s ease;
  }

  .action-btn:active {
    transform: scale(0.96);
  }

  .btn-consume {
    flex: 1.6;
    min-width: 88px;
    background-color: var(--color-cream, #fff8ef);
    border: 1.5px solid var(--color-brown, #75472f);
    color: var(--color-brown, #75472f);
    padding: 8px 14px;
  }

  .btn-consume:hover {
    background-color: #faebd9;
  }

  .btn-consume:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-waste {
    flex: 1;
    min-width: 70px;
    background-color: #fff1f0;
    border: 1.5px solid #f9cac6;
    color: var(--color-red, #b84035);
    padding: 8px 12px;
  }

  .btn-waste:hover {
    background-color: #ffe6e5;
  }

  .btn-icon {
    font-size: 1rem;
  }

  .btn-text {
    line-height: 1;
  }

  /* Waste Modal Backdrop & Sheet */
  .waste-modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(30, 24, 20, 0.6);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 16px;
  }

  .waste-modal-card {
    background-color: var(--color-surface, #ffffff);
    border-radius: 16px;
    width: 100%;
    max-width: 420px;
    padding: 20px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-title {
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--color-ink, #302821);
  }

  .modal-close-btn {
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    font-size: 1.1rem;
    color: var(--color-muted, #7c7168);
    cursor: pointer;
    touch-action: manipulation;
    border-radius: 8px;
  }

  .modal-desc {
    font-size: 0.9rem;
    color: var(--color-ink, #302821);
    line-height: 1.35;
  }

  .waste-reasons-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .reason-option {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 8px 12px;
    background-color: #faf7f2;
    border: 1px solid var(--color-line, #eadfd2);
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.88rem;
    touch-action: manipulation;
  }

  .reason-option.active {
    background-color: #fdf2f1;
    border-color: var(--color-red, #b84035);
    font-weight: 700;
    color: var(--color-red, #b84035);
  }

  .radio-indicator {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid #b0a599;
    position: relative;
    flex-shrink: 0;
  }

  .reason-option.active .radio-indicator {
    border-color: var(--color-red, #b84035);
    background-color: var(--color-red, #b84035);
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

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
  }

  .btn-dialog-cancel {
    min-height: 44px;
    min-width: 80px;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--color-line, #eadfd2);
    border-radius: 8px;
    font-weight: 600;
    color: var(--color-muted, #7c7168);
    cursor: pointer;
    touch-action: manipulation;
  }

  .btn-dialog-confirm {
    min-height: 44px;
    min-width: 120px;
    padding: 8px 18px;
    background-color: var(--color-red, #b84035);
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
  }
</style>
