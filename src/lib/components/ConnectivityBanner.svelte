<!--
  StockControl PWA — ConnectivityBanner.svelte
  Offline Pill & Connectivity Status Banner — Milestone 4 (Feature 24)
  Path: src/lib/components/ConnectivityBanner.svelte
-->
<script lang="ts">
  import { connectivityStore } from '$lib/stores/connectivityStore';

  function formatPillText(isOnline: boolean, pending: number): string | null {
    if (isOnline) return null;
    if (pending > 0) return `Sin conexión (${pending} pendientes)`;
    return 'Modo sin conexión';
  }

  $: pillText = formatPillText($connectivityStore.isOnline, $connectivityStore.pendingWrites);
</script>

{#if !$connectivityStore.isOnline}
  <div
    class="connectivity-pill-banner"
    role="status"
    aria-live="assertive"
    aria-label="Estado de conectividad"
  >
    <span class="pill-dot" aria-hidden="true"></span>
    <span class="pill-text">{pillText}</span>
    {#if $connectivityStore.pendingWrites > 0}
      <span class="pill-badge" aria-label="Operaciones locales almacenadas">
        {$connectivityStore.pendingWrites}
      </span>
    {/if}
  </div>
{:else if $connectivityStore.hasPendingWrites || $connectivityStore.isSyncing}
  <div
    class="connectivity-pill-banner syncing"
    role="status"
    aria-live="polite"
    aria-label="Sincronización en curso"
  >
    <span class="pill-spinner" aria-hidden="true">⏳</span>
    <span class="pill-text">Sincronizando cambios con la cocina...</span>
  </div>
{/if}

<style>
  .connectivity-pill-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
    background-color: #fff0cf;
    color: #88580c;
    border-bottom: 1px solid #ffd182;
    font-size: 0.85rem;
    font-weight: 600;
    text-align: center;
    box-shadow: 0 1px 3px rgba(136, 88, 12, 0.08);
    z-index: 100;
    transition: background-color 0.2s ease;
  }

  .connectivity-pill-banner.syncing {
    background-color: #e6f4ea;
    color: #137333;
    border-bottom: 1px solid #ceead6;
  }

  .pill-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #d97706;
    display: inline-block;
    animation: pulse-dot 1.8s infinite ease-in-out;
  }

  .pill-badge {
    background-color: #88580c;
    color: #ffffff;
    font-size: 0.72rem;
    padding: 2px 7px;
    border-radius: 9999px;
    font-weight: 700;
    line-height: 1;
  }

  @keyframes pulse-dot {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.3);
      opacity: 0.6;
    }
  }
</style>
