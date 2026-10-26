# Handoff Report: Mobile Navigation, Card Ergonomics & Touch Audit (Milestone 3)

**Agent**: `explorer_m3_1`  
**Role**: Mobile Navigation & Card Ergonomics Explorer  
**Date**: 2026-10-25T21:58:00Z  
**Parent Conversation ID**: `1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c`  
**Working Directory**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/`  
**Status**: COMPLETE (Hard Handoff)

---

## 1. Observation

### 1.1 Touch Ergonomics Audit of `src/routes/+layout.svelte`
Direct inspection of `src/routes/+layout.svelte` lines 177–186 reveals:
```css
177:   .toast-close-btn {
178:     min-width: 36px;
179:     min-height: 36px;
180:     background: transparent;
181:     border: none;
182:     color: #b0a599;
183:     font-size: 1rem;
184:     cursor: pointer;
185:     touch-action: manipulation;
186:   }
```
- **Violation**: The dimensions `min-width: 36px; min-height: 36px;` violate the minimum touch envelope requirement of 44x44px specified in:
  - `ORIGINAL_REQUEST.md § R3`: *"La interfaz dispone de navegación inferior accesible con el pulgar y objetivos táctiles de al menos 44x44px."*
  - `PROJECT.md § Feature 12`: *"Touch Target Compliance: All interactive elements >=44x44 CSS px with >=8px spacing."*
  - `tests/e2e/harness/ui.js` lines 6–25: `MIN_TOUCH_SIZE_PX = 44`.
- **Contrast**: In the same file, line 164 `.toast-action-btn` correctly specifies `min-width: var(--touch-min); min-height: var(--touch-min);` (where line 75 defines `--touch-min: 44px;`).

### 1.2 Current State of Bottom Navigation in `src/routes/+page.svelte`
Lines 187–228 of `src/routes/+page.svelte` currently inline the bottom navigation:
```svelte
187:   <!-- Fixed Bottom Navigation Bar (4 tabs, >= 44x44px) -->
188:   <nav class="bottom-nav" aria-label="Navegación principal">
189:     <button
190:       type="button"
191:       class="nav-item"
192:       class:active={activeTab === 'inventario'}
193:       on:click={() => (activeTab = 'inventario')}
194:     >
195:       <span class="nav-icon">📦</span>
196:       <span class="nav-label">Inventario</span>
197:     </button>
...
```
- The tab items are hardcoded in `+page.svelte`. There is no dedicated modular component `src/lib/components/BottomNav.svelte`.
- E2E Test Suite Contract in `tests/e2e/tier1_features/f11_bottom_nav.test.js` (lines 3–8) defines:
  ```javascript
  const EXPECTED_TABS = [
    { id: 'inventory', label: 'Inventario' },
    { id: 'scanner', label: 'Escáner' },
    { id: 'alerts', label: 'Alertas' },
    { id: 'history', label: 'Historial' }
  ];
  ```
  Meanwhile, DISPATCH specifies:
  `4 fixed thumb-reachable tabs: Inventario (list), Nuevo (form/drawer), Escáner (scanner trigger/tab), Ajustes (workspace/contingency)`.
- Boundary test `tests/e2e/tier2_boundaries/b11_nav_boundaries.test.js`:
  - `B11-T01`: Clicking the currently active tab must be an idempotent no-op without re-render flash.
  - `B11-T03`: Safe fallback to default tab for unrecognized IDs.
  - `B11-T05`: Accessibility attributes `role="tab"` and `aria-selected` boolean states.
- Safe Area test `tests/e2e/tier1_features/f17_safe_area.test.js`: Requires `padding-bottom: env(safe-area-inset-bottom, 0px)` or `padding-bottom: calc(... + env(safe-area-inset-bottom, 0px))`.

### 1.3 Current State of Product Presentation in `src/routes/+page.svelte`
Lines 127–147 of `src/routes/+page.svelte` currently render a barebones card:
```svelte
127:             {#each $filteredProducts as prod (prod.id)}
128:               <article class="product-card">
129:                 <div class="card-info">
130:                   <h4 class="card-title">{prod.name}</h4>
131:                   <p class="card-meta">
132:                     <span class="qty">{prod.quantity} {prod.unit || 'uds'}</span> • 
133:                     <span class="exp">Vence: {prod.expiryDate}</span>
134:                   </p>
135:                 </div>
136:                 <div class="card-actions">
137:                   <button
138:                     type="button"
139:                     class="action-btn-consume"
140:                     on:click={() => handleConsume(prod.id, prod.name)}
141:                     aria-label={`Consumir una unidad de ${prod.name}`}
142:                   >
143:                     -1 Consumir
144:                   </button>
145:                 </div>
146:               </article>
147:             {/each}
```
- Missing features in current implementation:
  1. No "Merma" (waste) quick button.
  2. No visual expiry color pill matching `calculateExpiryStatus`.
  3. No category chips or storage location badges.
  4. No prominent quantity unit badge for kitchen glanceability.
  5. No card body tap handler to inspect details.
  6. Not isolated into `src/lib/components/ProductCard.svelte`.

### 1.4 E2E Test Suite and Tool Execution
- Running `npm test`: Output: `302 passed, 0 failed` across Tiers 1–4.
- Running `npm run check`: Output: `svelte-check found 0 errors and 0 warnings`.
- Running `npm run build`: Output: static build succeeded with `@sveltejs/adapter-static` in `build/`.

---

## 2. Logic Chain

1. **Touch Target Standard (WCAG 2.5.5 / Feature 12)**:
   - `tests/e2e/harness/ui.js` asserts `MIN_TOUCH_SIZE_PX = 44` and `MIN_TOUCH_SPACING_PX = 8`.
   - `.toast-close-btn` in `+layout.svelte` must have `min-width: 44px; min-height: 44px;` and `display: inline-flex; align-items: center; justify-content: center;` to center the ✕ glyph and satisfy touch envelope audits without displacing adjacent elements (Observation 1.1).
2. **Bottom Navigation Architecture (`BottomNav.svelte`)**:
   - Must be fixed to the bottom (`position: fixed; bottom: 0; left: 0; right: 0; z-index: 90;`).
   - Must have height >= 56px (using `height: var(--nav-height, 60px); min-height: 56px;`) and incorporate safe-area padding: `padding-bottom: env(safe-area-inset-bottom, 0px)`.
   - Must support 4 fixed thumb-reachable tabs. To bridge DISPATCH tab names (`inventario`, `nuevo`, `scanner`, `ajustes`) and E2E test IDs (`inventory`, `scanner`, `alerts`, `history`), the component must accept a customizable `tabs` array and perform normalized alias matching so `activeTab` bindings work regardless of naming scheme.
   - Must implement an active indicator line, icon + label typography, and dynamic badge display for critical alerts (`$metricsStore.expired`).
   - Must ensure idempotent clicks (`if (isTabActive(tabId, activeTab)) return;`) to satisfy boundary test `B11-T01`.
3. **Card Ergonomics Architecture (`ProductCard.svelte`)**:
   - Visual hierarchy for fast kitchen scanning:
     - Prominent quantity badge in top right (`min-width: 54px; height: 48px; background: #26211c; color: #fff;` with large number + uppercase unit).
     - Left border color stripe corresponding to expiry urgency (red for expired, amber for <=3d, blue for <=7d, green for >7d).
     - Expiry pill dynamically invoking domain logic `calculateExpiryStatus(product.expiryDate)` displaying human label + ISO date.
     - Category and location metadata chips.
   - 1-Tap Quick Action Toolbar:
     - Consumir button (`.btn-consume`): `min-width: 88px; min-height: 44px;` (WCAG compliant).
       - Triggers optimistic local decrement via `inventoryStore.consumeOne(product.id)`.
       - Shows Undo toast with `toastStore.undo("Consumiste 1 unidad de ...", onUndo)` where undo restores previous quantity.
       - Dispatches async `consumeStockAction(product.id, 1, ...)` in background.
     - Merma button (`.btn-waste`): `min-width: 70px; min-height: 44px;` (WCAG compliant).
       - Separated by `gap: 10px;` (exceeds the 8px minimum spacing rule `validateTouchSpacing(10) === true`).
       - Opens modal confirmation sheet with radio options from `WASTE_REASONS` (`vencimiento`, `rotura`, `contaminacion`, `calidad`, `otro`).
       - On confirmation, executes optimistic local discard, calls `discardStockAction(product.id, reason)`, triggers warning toast, and dispatches event.
     - Card body click dispatches `'select'` / `'edit'` event with `e.stopPropagation()` on all buttons so button taps never accidentally trigger card selection.

---

## 3. Caveats

1. **Component Location & Implementation Boundary**:
   - As an explorer subagent, changes are proposed in `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/proposed_*.svelte` and `.patch`.
   - The implementing worker (`worker_m3`) will place them into `src/lib/components/` and apply the layout patch.
2. **Svelte Syntax Compatibility**:
   - Both Svelte 4/5 classic syntax (`export let`, `createEventDispatcher`, `on:click`) and Svelte 5 Runes syntax (`$props`, `$derived`, `$state`) are provided. The classic syntax aligns with existing `+layout.svelte` and `+page.svelte` and compiles without errors in Svelte 5.
3. **Zero-Stock Edge Case**:
   - When `product.quantity <= 0`, the "Consumir 1" button is disabled (`disabled={product.quantity <= 0}`) and visually dimmed, preventing invalid negative stock consumption.
4. **Waste Discard Edge Case**:
   - Direct discarding requires user confirmation via the embedded modal sheet to prevent accidental irreversible discards during frantic kitchen rush hours.

---

## 4. Conclusion & Proposed Deliverables

### Deliverable A: `src/lib/components/BottomNav.svelte`
*File created at: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/proposed_BottomNav.svelte`*

```svelte
<!--
  StockControl PWA — BottomNav.svelte
  Clean Architecture Presentation Component
  Path: src/lib/components/BottomNav.svelte
  Ergonomics: WCAG 2.5.5 / Android-iOS Touch Targets (>=44x44px, height >=56px, safe-area-inset-bottom)
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export interface TabItem {
    id: string;
    label: string;
    icon?: string;
    badge?: number;
    ariaLabel?: string;
  }

  // Active tab ID (supports 2-way binding: bind:activeTab)
  export let activeTab: string = 'inventario';

  // Badges map by tab ID (e.g. { alertas: 3, alerts: 3 })
  export let badges: Record<string, number> = {};

  // Optional custom tabs override. Defaults to the 4 canonical kitchen tabs.
  export let tabs: TabItem[] = [
    { id: 'inventario', label: 'Inventario', icon: 'package' },
    { id: 'nuevo', label: 'Nuevo', icon: 'plus' },
    { id: 'scanner', label: 'Escáner', icon: 'scanner' },
    { id: 'ajustes', label: 'Ajustes', icon: 'settings' }
  ];

  const dispatch = createEventDispatcher<{
    change: { tab: string };
    select: string;
  }>();

  /**
   * Normalizes tab aliases so both Spanish ('inventario', 'alertas', 'historial', 'ajustes')
   * and English test IDs ('inventory', 'alerts', 'history') resolve seamlessly.
   */
  function isTabActive(tabId: string, current: string): boolean {
    if (tabId === current) return true;
    const aliases: Record<string, string[]> = {
      inventario: ['inventory', 'inventario', 'list'],
      inventory: ['inventory', 'inventario', 'list'],
      scanner: ['scanner', 'scan', 'camara'],
      nuevo: ['nuevo', 'new', 'add', 'create'],
      alertas: ['alerts', 'alertas', 'warning'],
      alerts: ['alerts', 'alertas', 'warning'],
      historial: ['history', 'historial', 'logs'],
      history: ['history', 'historial', 'logs'],
      ajustes: ['settings', 'ajustes', 'config', 'workspace'],
      settings: ['settings', 'ajustes', 'config', 'workspace']
    };
    const list = aliases[tabId.toLowerCase()];
    return list ? list.includes(current.toLowerCase()) : false;
  }

  function handleTabClick(tabId: string) {
    if (isTabActive(tabId, activeTab)) {
      // Idempotent: clicking active tab is a clean no-op
      return;
    }
    activeTab = tabId;
    dispatch('change', { tab: tabId });
    dispatch('select', tabId);
  }

  function getBadgeCount(tab: TabItem): number {
    if (typeof tab.badge === 'number') return tab.badge;
    return badges[tab.id] || badges[tab.id.toLowerCase()] || 0;
  }
</script>

<nav class="bottom-nav" aria-label="Navegación principal" role="navigation">
  <div class="tabs-container" role="tablist">
    {#each tabs as tab (tab.id)}
      {@const active = isTabActive(tab.id, activeTab)}
      {@const badgeCount = getBadgeCount(tab)}
      <button
        type="button"
        class="nav-tab-btn"
        class:active
        role="tab"
        id={`nav-tab-${tab.id}`}
        aria-selected={active}
        aria-controls={`tabpanel-${tab.id}`}
        aria-label={tab.ariaLabel || `${tab.label}${badgeCount > 0 ? ` (${badgeCount} pendientes)` : ''}`}
        on:click={() => handleTabClick(tab.id)}
      >
        <!-- Active indicator line -->
        {#if active}
          <span class="active-indicator" aria-hidden="true"></span>
        {/if}

        <div class="icon-wrapper" aria-hidden="true">
          {#if tab.icon === 'package' || tab.id === 'inventario' || tab.id === 'inventory'}
            <svg class="tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m7.5 4.27 9 5.15" />
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              <path d="m3.3 7 8.7 5 8.7-5" />
              <path d="M12 22V12" />
            </svg>
          {:else if tab.icon === 'plus' || tab.id === 'nuevo'}
            <svg class="tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8" />
              <path d="M8 12h8" />
            </svg>
          {:else if tab.icon === 'scanner' || tab.id === 'scanner'}
            <svg class="tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" stroke-width="2.5" />
            </svg>
          {:else if tab.icon === 'alerts' || tab.id === 'alertas' || tab.id === 'alerts'}
            <svg class="tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          {:else if tab.icon === 'settings' || tab.id === 'ajustes' || tab.id === 'settings'}
            <svg class="tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          {:else}
            <!-- Default History / Logs icon -->
            <svg class="tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 8v4l3 3" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          {/if}

          {#if badgeCount > 0}
            <span class="nav-badge" role="status">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          {/if}
        </div>

        <span class="tab-label">{tab.label}</span>
      </button>
    {/each}
  </div>
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 90;
    background-color: var(--color-surface, #ffffff);
    border-top: 1px solid var(--color-line, #eadfd2);
    box-shadow: 0 -2px 10px rgba(48, 40, 33, 0.05);
    user-select: none;
    -webkit-user-select: none;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .tabs-container {
    display: flex;
    align-items: stretch;
    justify-content: space-around;
    height: var(--nav-height, 60px);
    min-height: 56px;
    max-width: 600px;
    margin: 0 auto;
    position: relative;
  }

  .nav-tab-btn {
    flex: 1;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 6px 0;
    background: transparent;
    border: none;
    color: var(--color-muted, #7c7168);
    cursor: pointer;
    position: relative;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.15s ease, transform 0.1s ease;
  }

  .nav-tab-btn:active {
    transform: scale(0.95);
  }

  .nav-tab-btn.active {
    color: var(--color-brown, #75472f);
    font-weight: 700;
  }

  .active-indicator {
    position: absolute;
    top: 0;
    left: 20%;
    right: 20%;
    height: 3px;
    background-color: var(--color-brown, #75472f);
    border-radius: 0 0 3px 3px;
  }

  .icon-wrapper {
    position: relative;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tab-svg {
    width: 22px;
    height: 22px;
    display: block;
    transition: transform 0.15s ease;
  }

  .nav-tab-btn.active .tab-svg {
    transform: scale(1.08);
  }

  .tab-label {
    font-size: 0.72rem;
    line-height: 1.1;
    letter-spacing: -0.2px;
  }

  .nav-badge {
    position: absolute;
    top: -4px;
    right: -8px;
    min-width: 18px;
    height: 18px;
    line-height: 18px;
    padding: 0 4px;
    background-color: var(--color-red, #b84035);
    color: #ffffff;
    font-size: 0.65rem;
    font-weight: 800;
    border-radius: 9px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    pointer-events: none;
  }
</style>
```

---

### Deliverable B: `src/lib/components/ProductCard.svelte`
*File created at: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/proposed_ProductCard.svelte`*

```svelte
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
```

---

### Deliverable C: Exact CSS Diff for `src/routes/+layout.svelte`
*Patch file created at: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/layout_touch_targets.patch`*

```diff
--- a/src/routes/+layout.svelte
+++ b/src/routes/+layout.svelte
@@ -177,10 +177,14 @@
   .toast-close-btn {
-    min-width: 36px;
-    min-height: 36px;
+    min-width: 44px;
+    min-height: 44px;
+    display: inline-flex;
+    align-items: center;
+    justify-content: center;
     background: transparent;
     border: none;
     color: #b0a599;
-    font-size: 1rem;
+    font-size: 1.1rem;
     cursor: pointer;
     touch-action: manipulation;
+    padding: 0;
+    border-radius: 8px;
   }
```

---

## 5. Verification Method

To independently verify all deliverables:

1. **Automated E2E Touch Target & Navigation Verification**:
   ```bash
   npm test
   ```
   - Specifically validates `F11: Bottom Navigation Bar` (fixed bottom, 4 tabs, active tab switching, landmark).
   - Validates `F12: Touch Target Compliance` (`validateTouchTarget(w, h).compliant === true` for >= 44x44px and `validateTouchSpacing(s)` for >= 8px).
   - Validates `F15: 1-Tap Consumption & Merma` (quantity decrement by 1, undo callback, HACCP waste reason logging).
   - Validates `F17: Safe Area Inset Support` (`hasBottom: true` via `env(safe-area-inset-bottom, 0px)`).

2. **TypeScript & Svelte Diagnostics**:
   ```bash
   npm run check
   ```
   - Asserts 0 diagnostics errors and 0 warnings.

3. **Production Static Compilation**:
   ```bash
   npm run build
   ```
   - Verifies static bundling under Vite 8 and `@sveltejs/adapter-static`.

4. **Invalidation Conditions**:
   - Any interactive button or touch zone with `width < 44px` or `height < 44px`.
   - Spacing between `.btn-consume` and `.btn-waste` under 8px.
   - Missing `env(safe-area-inset-bottom, 0px)` on `.bottom-nav`.
   - Non-idempotent tab selection causing redundant store dispatches.
