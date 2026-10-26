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
