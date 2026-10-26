# Handoff Report: explorer_m3_3

**Agent**: `explorer_m3_3`  
**Role**: Metrics Dashboard & Tablet Split-View Explorer  
**Milestone**: Milestone 3 — Mobile/Tablet Ergonomic UI/UX  
**Timestamp**: 2026-10-25T22:02:00Z  

---

## 1. Observation

### 1.1 Codebase Structure and Existing Implementation
1. **Existing Routes & Layout**:
   - `src/routes/+page.svelte` (650 lines): Currently contains an inline prototype with prototype cards, search bar, hardcoded counter elements in `.metrics-grid` (lines 87–104), and basic tab switching.
   - `src/routes/+layout.svelte` (188 lines): Declares global CSS variables `--color-brown: #75472f`, `--color-red: #b84035`, `--color-amber: #a56b15`, `--touch-min: 44px`, `--nav-height: 60px`, and wraps content with safe-area insets (`env(safe-area-inset-*)`).
2. **Reactive Stores**:
   - `src/lib/stores/metricsStore.ts` (lines 22–33, 67–69):
     ```typescript
     export interface StockMetrics {
       total: number;       // All active products (not discarded, quantity > 0)
       expired: number;     // dayDiff < 0
       soon: number;        // 0 <= dayDiff <= 3 (vence hoy / 3 días)
       week: number;        // 4 <= dayDiff <= 7 (vence en la semana)
       critical7: number;   // 0 <= dayDiff <= 7 (soon + week)
       within7Days: number;
       criticalTotal: number;
       ok: number;          // dayDiff > 7
     }
     export const metricsStore = derived(inventoryStore, ($inv) => calculateMetrics($inv.products));
     ```
   - `src/lib/stores/inventoryStore.ts` (lines 138–170, 270–329):
     Provides reactive `filteredProducts`, actions `consumeStockAction`, `discardStockAction`, `createProductAction`, `updateProductAction`, and optimistic methods `consumeOne(id)`, `updateProduct(id, updates)`.
3. **Domain Layer**:
   - `src/lib/domain/expiry.ts` (lines 85–156):
     Provides `calculateExpiryStatus(expiryDate, refDate)` returning `{ key: 'expired' | 'soon' | 'week' | 'ok', label, daysRemaining, cls }`.
   - `src/lib/domain/models.ts`: Defines `PRODUCT_CATEGORIES`, `WASTE_REASONS`, `WASTE_REASON_LABELS`, and `HistoryLog`.
4. **Automated Test Oracle Requirements**:
   - `tests/e2e/tier1_features/f16_tablet_split.test.js`:
     - Line 8: `TABLET_BREAKPOINT_PX = 768`.
     - Lines 23–35: Requires `@media (min-width: 768px)` declaring grid columns with `.split-container` (or equivalent) and two-pane master-detail view.
     - Lines 52–75: Requires tablet mode (>=768px) to eliminate full-screen blocking modals for item inspection, while mobile (<768px) opens modal.
   - `tests/e2e/tier1_features/f18_metrics_dashboard.test.js`:
     - Lines 8–67: Requires accurate computation for Total, Expired, Soon (<=3d), and Week (4..7d), strictly excluding consumed and discarded items.
   - `tests/e2e/tier1_features/f13_fab_button.test.js`:
     - Lines 7–16: `position: fixed`, `right: 16px`, `bottom >= 64px`, `ariaLabel: 'Agregar producto'`, `borderRadius: '50%'`, 56x56px, `zIndex: 40`.
   - `tests/e2e/tier1_features/f11_bottom_nav.test.js`:
     - Line 60–69: Tab "Alertas" navigates to filter for expired and soon items.

---

## 2. Logic Chain

1. **Disjointness of the 4 Counter Cards (Observation 1.2 & 1.4)**:
   - In kitchen food safety (HACCP), operators must not be misled by overlapping counts.
   - `metricsStore` returns:
     - `total`: sum of all active items.
     - `expired`: `dayDiff < 0`.
     - `soon`: `0 <= dayDiff <= 3` (expiring today, tomorrow, or within 3 days).
     - `week`: `4 <= dayDiff <= 7` (expiring in 4 to 7 days).
     - `ok`: `dayDiff > 7` (shelf-stable / ample shelf-life).
   - Because `(-∞, -1]`, `[0, 3]`, and `[4, 7]` are mutually disjoint subsets of calendar integers, `expired ∩ soon ∩ week = ∅`.
   - Using `$metricsStore.week` for the 4th card (instead of `critical7` or `within7Days` which would repeat `soon`) ensures strict disjointness: `Total = Expired + Soon + Week + Ok`.
2. **MetricsDashboard Filter Toggling (Observation 1.2)**:
   - When a user taps a counter card (`'all' | 'expired' | 'soon' | 'week'`), if that filter is already active, clicking it again resets `activeFilter` to `'all'`.
   - If a different card is clicked, `activeFilter` becomes that status key.
   - An event `filterChange` is dispatched with payload `{ filter: nextFilter }` so the parent `+page.svelte` can reactively restrict `displayedProducts` using `calculateExpiryStatus(p.expiryDate).key === activeFilter`.
3. **Tablet Split-Screen Responsive Architecture (Observation 1.4, F16)**:
   - At `< 768px` (mobile phones):
     - Single-column master list takes 100% width.
     - The inspection pane (`.detail-pane`) is hidden (`display: none`).
     - Tapping a product card opens a bottom-sheet modal overlay (`isMobileDetailOpen = true`), giving mobile users full inspection and action capability without breaking layout.
   - At `>= 768px` (tablets and desktops):
     - Container `.split-container` activates CSS grid: `grid-template-columns: minmax(360px, 42%) 1fr; gap: 20px; align-items: start;`.
     - Left Master Pane (`.master-pane`, 40–42% width) contains `MetricsDashboard`, search bar, category chips, sort selector, and scrollable product cards (`max-height: calc(100vh - 160px); overflow-y: auto;`).
     - Right Detail Pane (`.detail-pane`, 58–60% width) is displayed persistently as a sticky panel (`position: sticky; top: 16px;`).
     - Tapping a product card immediately updates `selectedProduct` in the right pane without opening any blocking modal overlay, directly satisfying test F16-T05.
4. **Touch Target Compliance and Ergonomics (Observation 1.2 & 1.4, F12 & F13)**:
   - Counter cards in `MetricsDashboard` have a minimum height of 72px and width >= 100px with a 10px/12px grid gap.
   - Quick consumption steppers (`-1 Consumir`, `+1 Reponer`, `Merma`, `Editar`) are formatted with `min-height: var(--touch-min)` (44px) and >= 8px spacing.
   - Floating Action Button (FAB) is styled as 56x56px, circular (`border-radius: 50%`), `z-index: 40`, positioned at `bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 16px); right: 16px;`, with `aria-label="Agregar producto"`.
5. **Clean Architecture Separation**:
   - `MetricsDashboard.svelte` only consumes reactive metrics and dispatches filter events; it contains no repository calls or side effects.
   - `+page.svelte` orchestrates the UI, handles optimistic updates with undo toasts, delegates persistence to `inventoryStore` and `productRepository`, and coordinates responsive presentation across viewports.

---

## 3. Caveats

1. **Subagent Division**:
   - `BottomNav.svelte` and `ProductCard.svelte` are being detailed by `explorer_m3_1`.
   - `ProductForm.svelte` and `WorkspaceModal.svelte` are being detailed by `explorer_m3_2`.
   - Our proposed `+page.svelte` composition provides exact standard prop and event signatures for these 4 components (`BottomNav`: `{ activeTab, on:tabChange }`; `ProductCard`: `{ product, isSelected, on:select, on:consume, on:discard }`; `ProductForm`: `{ isOpen, productToEdit, on:save, on:close }`; `WorkspaceModal`: `{ isOpen, on:close }`), ensuring immediate plug-and-play integration.
2. **Camera Scanner & Backup Modals**:
   - Camera scanner hardware integration (`CameraScanner.svelte`) and CSV/JSON backup (`ExportImportModal.svelte`) are scheduled for Milestone 4. Clean, accessible placeholders are included in `+page.svelte` tabs for smooth Milestone 4 continuation.
3. **No Direct Source Modification**:
   - As an explorer, all components are proposed as artifacts in `.agents/teamwork/explorer_m3_3/` (`proposed_MetricsDashboard.svelte` and `proposed_page.svelte`) and documented below for worker implementation.

---

## 4. Conclusion & Complete Component Templates

### 4.1 Component Template: `src/lib/components/MetricsDashboard.svelte`

```svelte
<!--
  StockControl PWA — Metrics Dashboard Component
  Milestone 3 — Mobile/Tablet Ergonomic UI/UX
  Target Path: src/lib/components/MetricsDashboard.svelte
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
```

---

### 4.2 Architecture & CSS Specification: Tablet Split-Screen Layout (`>= 768px`)

```css
/* Responsive Split-Screen Layout (F16 Architectural Contract) */
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

/* On Mobile screens (< 768px), inspection pane is collapsed */
.detail-pane {
  display: none;
}

/* On Tablet & Desktop screens (>= 768px), split two-pane grid activates */
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
```

---

### 4.3 Proposed Composition: `src/routes/+page.svelte`

The proposed full file is placed in `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_3/proposed_page.svelte`.
Key features incorporated:
- **Clean Svelte 5 / SvelteKit 3 store reactivity**: Uses `$inventoryStore`, `$filteredProducts`, `$metricsStore`, `$workspaceStore`, `$connectivityStore`, `$toastStore`.
- **4-Tab Navigation**: `inventario`, `scanner`, `alertas`, `historial`.
- **Alertas Tab Filter Integration**: Automatically filters down to `expired` and `soon` items when the tab is active.
- **Disjoint Expiry Filtering**: Interactive filtering bound to `activeExpiryFilter`.
- **1-Tap Consumption Steppers with Undo**: Uses `toastStore.undo` with rollback on cancellation.
- **HACCP Waste Modal**: Dedicated modal for recording food waste reasons (`vencimiento`, `rotura`, `contaminacion`, `calidad`, `otro`).
- **FAB Compliance**: 56x56px, `border-radius: 50%`, `z-index: 40`, `position: fixed`, `bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 16px)`, `right: 16px`.
- **Mobile vs Tablet Inspection**:
  - Tablet displays side pane without blocking modal.
  - Mobile (<768px) opens bottom-sheet inspection dialog.

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Automated E2E Test Suite**:
   ```bash
   npm test
   ```
   Verifies all 302 opaque-box tests pass across Tiers 1–4, specifically:
   - `tests/e2e/tier1_features/f11_bottom_nav.test.js`
   - `tests/e2e/tier1_features/f12_touch_targets.test.js`
   - `tests/e2e/tier1_features/f13_fab_button.test.js`
   - `tests/e2e/tier1_features/f14_quick_expiry.test.js`
   - `tests/e2e/tier1_features/f15_1tap_consumption.test.js`
   - `tests/e2e/tier1_features/f16_tablet_split.test.js`
   - `tests/e2e/tier1_features/f17_safe_area.test.js`
   - `tests/e2e/tier1_features/f18_metrics_dashboard.test.js`
2. **Static Production Build**:
   ```bash
   npm run build
   ```
   Verifies TypeScript checks, Vite compilation, SvelteKit prerendering, and adapter-static bundling with zero syntax errors.

### 5.2 Files to Inspect
- `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_3/proposed_MetricsDashboard.svelte`
- `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_3/proposed_page.svelte`
- `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_3/BRIEFING.md`
- `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_3/progress.md`

### 5.3 Invalidation Conditions
- Any overlapping counters between "Vencidos", "Vence hoy / 3d", and "Vence semana".
- Breaking modal appearing on screens >= 768px when clicking a product card instead of using the side detail pane.
- Any touch target in the dashboard or toolbar smaller than 44x44px or spacing under 8px.
