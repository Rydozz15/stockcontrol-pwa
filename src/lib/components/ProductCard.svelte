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
  import { workspaceStore } from '$lib/stores/workspaceStore';
  import { productRepository } from '$lib/repositories/productRepository';
  import { toastStore } from '$lib/stores/toastStore';

  export let product: ProductItem | Product;
  export let selected: boolean = false;
  export let isSelected: boolean = false;
  export let compact: boolean = false;

  $: activeSelected = selected || isSelected;

  const dispatch = createEventDispatcher<{
    consume: { product: ProductItem | Product; previousQuantity: number };
    waste: { product: ProductItem | Product; reason: WasteReason };
    discard: { product: ProductItem | Product; reason: WasteReason };
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

  function handleCardClick() {
    dispatch('select', { product });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dispatch('select', { product });
    }
  }

  function handleModalKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && showWasteModal) {
      showWasteModal = false;
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
      toastStore.undo(`Consumiste 1 unidad de ${product.name}`, async () => {
        inventoryStore.updateProduct(product.id, {
          quantity: result.previousQuantity,
          isConsumed: false
        });
        toastStore.info(`Restaurada 1 unidad de ${product.name}`);
        try {
          await productRepository.restoreStock(
            $workspaceStore.workspaceId,
            product.id,
            1,
            $workspaceStore.operatorAlias
          );
        } catch (err) {
          console.warn('[ProductCard] Failed to restore stock in Firestore:', err);
        }
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
    if (event && event.target !== event.currentTarget) return;
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
      dispatch('discard', { product, reason: selectedWasteReason });
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
  class:selected={activeSelected}
  class:compact
  class:status-expired={expiryStatus.key === 'expired'}
  class:status-soon={expiryStatus.key === 'soon'}
  class:status-week={expiryStatus.key === 'week'}
  class:status-ok={expiryStatus.key === 'ok'}
  aria-label={`Producto: ${product.name}, ${product.quantity} ${product.unit || 'uds'}, vence: ${expiryStatus.label}`}
>
  <!-- Card Header Button (tap to inspect) -->
  <button
    type="button"
    class="card-main-action"
    on:click={handleCardClick}
    on:keydown={handleKeydown}
    aria-label={`Ver detalles de ${product.name}`}
  >
    <div class="card-header">
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
    </div>

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
  </button>

  <!-- Touch-Friendly 1-Tap Quick Action Row (>=44x44px touch targets, >=8px spacing) -->
  <div class="card-actions" role="toolbar" aria-label="Acciones rápidas del producto">
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
  </div>
</article>

<!-- Quick Discard / Merma Modal Sheet -->
{#if showWasteModal}
  <div
    class="waste-modal-backdrop"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="waste-modal-title"
    on:click={closeWasteModal}
    on:keydown={handleModalKeydown}
  >
    <div
      class="waste-modal-card"
      role="document"
    >
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
    gap: 8px;
    box-shadow: 0 2px 6px rgba(48, 40, 33, 0.04);
    position: relative;
    transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .card-main-action {
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    font-family: inherit;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 12px;
    cursor: pointer;
    width: 100%;
    color: inherit;
  }

  .product-card:focus-within {
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
    width: 100%;
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
    background-color: #f7fafc;
    color: #718096;
    border: 1px dashed #cbd5e0;
  }

  /* Quantity Badge */
  .quantity-badge {
    min-width: 54px;
    height: 48px;
    background-color: #26211c;
    color: #ffffff;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2px 8px;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }

  .quantity-badge.low-stock {
    background-color: var(--color-red, #b84035);
  }

  .qty-num {
    font-size: 1.25rem;
    font-weight: 900;
    line-height: 1;
  }

  .qty-unit {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    opacity: 0.85;
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
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .pill-expired {
    background-color: #fee2e2;
    color: #991b1b;
  }

  .pill-soon {
    background-color: #fef3c7;
    color: #92400e;
  }

  .pill-week {
    background-color: #dbeafe;
    color: #1e40af;
  }

  .pill-ok {
    background-color: #d1fae5;
    color: #065f46;
  }

  .pill-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .pill-dot.red { background-color: var(--color-red, #b84035); }
  .pill-dot.amber { background-color: var(--color-amber, #a56b15); }
  .pill-dot.blue { background-color: #2c5282; }
  .pill-dot.green { background-color: var(--color-green, #4c7860); }

  .font-bold {
    font-weight: 800;
  }

  .expiry-date-iso {
    font-size: 0.75rem;
    opacity: 0.8;
    margin-left: 2px;
  }

  /* Card Actions Toolbar */
  .card-actions {
    display: flex;
    align-items: center;
    gap: 10px; /* Exceeds >= 8px touch spacing requirement */
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid #f4ede4;
  }

  .action-btn {
    min-height: 44px; /* WCAG 2.5.5 >= 44x44px */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.1s ease, background-color 0.15s ease, opacity 0.15s ease;
  }

  .action-btn:active:not(:disabled) {
    transform: scale(0.96);
  }

  .action-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-consume {
    flex: 1;
    min-width: 88px;
    background-color: var(--color-brown, #75472f);
    color: #ffffff;
    border: none;
    box-shadow: 0 2px 6px rgba(117, 71, 47, 0.2);
  }

  .btn-consume:hover:not(:disabled) {
    background-color: var(--color-brown-dark, #69412d);
  }

  .btn-waste {
    min-width: 70px;
    background-color: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  .btn-waste:hover {
    background-color: #fee2e2;
  }

  .btn-icon {
    font-size: 1rem;
    line-height: 1;
  }

  /* Waste Modal Sheet */
  .waste-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(38, 33, 28, 0.65);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fadeIn 0.15s ease-out;
  }

  @media (min-width: 768px) {
    .waste-modal-backdrop {
      align-items: center;
      padding: 20px;
    }
  }

  .waste-modal-card {
    background: #ffffff;
    width: 100%;
    max-width: 480px;
    border-radius: 20px 20px 0 0;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.25);
    animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @media (min-width: 768px) {
    .waste-modal-card {
      border-radius: 20px;
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--color-ink, #302821);
  }

  .modal-close-btn {
    min-width: 44px;
    min-height: 44px;
    background: transparent;
    border: none;
    font-size: 1.2rem;
    color: var(--color-muted, #7c7168);
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-desc {
    font-size: 0.95rem;
    color: var(--color-ink, #302821);
    line-height: 1.4;
  }

  .waste-reasons-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .reason-option {
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    border-radius: 10px;
    background-color: #faf5ee;
    border: 1.5px solid var(--color-line, #eadfd2);
    cursor: pointer;
    touch-action: manipulation;
    transition: background-color 0.12s, border-color 0.12s;
  }

  .reason-option.active {
    background-color: #fef2f2;
    border-color: var(--color-red, #b84035);
  }

  .radio-indicator {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid #cbd5e0;
    position: relative;
    flex-shrink: 0;
  }

  .reason-option.active .radio-indicator {
    border-color: var(--color-red, #b84035);
  }

  .reason-option.active .radio-indicator::after {
    content: '';
    position: absolute;
    top: 4px;
    left: 4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--color-red, #b84035);
  }

  .reason-label {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-ink, #302821);
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
    min-width: 90px;
    padding: 0 16px;
    background: transparent;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 10px;
    font-weight: 700;
    color: var(--color-muted, #7c7168);
    cursor: pointer;
  }

  .btn-dialog-confirm {
    min-height: 44px;
    min-width: 140px;
    padding: 0 20px;
    background-color: var(--color-red, #b84035);
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(184, 64, 53, 0.3);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
