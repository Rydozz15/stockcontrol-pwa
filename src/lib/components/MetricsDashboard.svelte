<!--
  StockControl PWA — Metrics Dashboard Component
  Milestone 3 — Mobile/Tablet Ergonomic UI/UX
  Target Path: src/lib/components/MetricsDashboard.svelte
  Ergonomics: WCAG 2.5.5 Touch Targets (min-height >= 72px, spacing >= 10px, disjoint counter cards)
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { metricsStore } from '$lib/stores/metricsStore';

  /**
   * Currently active expiry filter key.
   * 'all' | 'expired' | 'soon' | 'week'
   */
  export let activeFilter: 'all' | 'expired' | 'soon' | 'week' = 'all';

  const dispatch = createEventDispatcher<{
    filterChange: { filter: 'all' | 'expired' | 'soon' | 'week' };
  }>();

  /**
   * 4 Disjoint Counter Cards:
   * 1. Total: Total active items ($metricsStore.total)
   * 2. Vencidos: Products where expiryDate < today ($metricsStore.expired)
   * 3. Vence hoy / 3d: Products expiring today or in 1-3 days ($metricsStore.soon)
   * 4. Vence semana: Products expiring in 4-7 days ($metricsStore.week)
   *
   * Disjointness Proof:
   * Expired (<0) ∩ Soon (0..3) ∩ Week (4..7) = ∅.
   * Total = Expired + Soon + Week + Ok.
   * Using $metricsStore.week prevents double counting with soon (0..3d).
   */
  $: cards = [
    {
      key: 'all' as const,
      label: 'Total',
      subtitle: 'Activos en cocina',
      count: $metricsStore.total,
      icon: '📦',
      cardClass: 'card-total'
    },
    {
      key: 'expired' as const,
      label: 'Vencidos',
      subtitle: 'Acción inmediata',
      count: $metricsStore.expired,
      icon: '⚠️',
      cardClass: 'card-expired'
    },
    {
      key: 'soon' as const,
      label: 'Vence hoy / 3d',
      subtitle: 'Prioridad FIFO',
      count: $metricsStore.soon,
      icon: '⏱️',
      cardClass: 'card-soon'
    },
    {
      key: 'week' as const,
      label: 'Vence semana',
      subtitle: 'En 4 a 7 días',
      count: $metricsStore.week,
      icon: '📅',
      cardClass: 'card-week'
    }
  ];

  function handleSelect(filterKey: 'all' | 'expired' | 'soon' | 'week') {
    // Tapping the active card resets filter to 'all' (unless already 'all')
    const nextFilter = activeFilter === filterKey && filterKey !== 'all' ? 'all' : filterKey;
    activeFilter = nextFilter;
    dispatch('filterChange', { filter: nextFilter });
  }
</script>

<section class="metrics-dashboard" aria-label="Resumen de Vencimientos y Métricas">
  <div class="metrics-grid">
    {#each cards as card (card.key)}
      <button
        type="button"
        class="metric-card {card.cardClass}"
        class:is-active={activeFilter === card.key}
        on:click={() => handleSelect(card.key)}
        aria-pressed={activeFilter === card.key}
        aria-label="{card.label}: {card.count}. {activeFilter === card.key ? 'Filtro activo. Toca para mostrar todos.' : 'Toca para filtrar por este estado.'}"
      >
        <div class="card-header">
          <span class="card-icon" aria-hidden="true">{card.icon}</span>
          <span class="card-label">{card.label}</span>
          {#if activeFilter === card.key && card.key !== 'all'}
            <span class="active-dot" aria-hidden="true">●</span>
          {/if}
        </div>
        <div class="card-body">
          <span class="card-count">{card.count}</span>
          <span class="card-subtitle">{card.subtitle}</span>
        </div>
      </button>
    {/each}
  </div>
</section>

<style>
  .metrics-dashboard {
    width: 100%;
    margin-bottom: 16px;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  @media (min-width: 480px) {
    .metrics-grid {
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
  }

  .metric-card {
    appearance: none;
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-line, #eadfd2);
    border-radius: 14px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    text-align: left;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
    position: relative;
    overflow: hidden;
    touch-action: manipulation;
    min-height: 72px; /* Complies with >= 44px ergonomics */
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .metric-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .metric-card:active {
    transform: scale(0.98);
  }

  .metric-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 5px;
    background-color: var(--color-line, #eadfd2);
  }

  /* Disjoint Color Accents */
  .card-total::before { background-color: var(--color-brown, #75472f); }
  .card-expired::before { background-color: var(--color-red, #b84035); }
  .card-soon::before { background-color: var(--color-amber, #a56b15); }
  .card-week::before { background-color: #2b78b8; }

  /* Active Filter Highlight States */
  .metric-card.is-active {
    border-color: currentColor;
    box-shadow: 0 0 0 2px currentColor, 0 4px 14px rgba(0, 0, 0, 0.1);
    background: var(--color-cream, #fff8ef);
  }

  .card-total.is-active { color: var(--color-brown, #75472f); }
  .card-expired.is-active { color: var(--color-red, #b84035); }
  .card-soon.is-active { color: var(--color-amber, #a56b15); }
  .card-week.is-active { color: #2b78b8; }

  .card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    padding-left: 4px;
  }

  .card-icon {
    font-size: 1.05rem;
    line-height: 1;
  }

  .card-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--color-muted, #7c7168);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .card-total .card-label { color: var(--color-brown-dark, #69412d); }
  .card-expired .card-label { color: var(--color-red, #b84035); }
  .card-soon .card-label { color: var(--color-amber, #a56b15); }
  .card-week .card-label { color: #2b78b8; }

  .active-dot {
    margin-left: auto;
    font-size: 0.75rem;
    color: currentColor;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  .card-body {
    display: flex;
    flex-direction: column;
    padding-left: 4px;
  }

  .card-count {
    font-size: 1.65rem;
    font-weight: 800;
    line-height: 1.1;
    color: var(--color-ink, #302821);
    font-variant-numeric: tabular-nums;
  }

  .card-expired .card-count {
    color: var(--color-red, #b84035);
  }

  .card-subtitle {
    font-size: 0.7rem;
    color: var(--color-muted, #7c7168);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
