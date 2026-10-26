<script lang="ts">
  import { onMount } from 'svelte';
  import { dev } from '$app/env';
  import { toastStore } from '$lib/stores/toastStore';
  import ConnectivityBanner from '$lib/components/ConnectivityBanner.svelte';

  onMount(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !dev) {
      navigator.serviceWorker.register('/service-worker.js').catch((err) => {
        console.warn('[SW] Service worker registration deferred:', err);
      });
    }
  });
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>StockControl PWA — Control Colaborativo de Alimentos</title>
</svelte:head>

<div class="app-shell">
  <!-- Offline / Syncing Connectivity Banner -->
  <ConnectivityBanner />

  <!-- Main View Content -->
  <main class="shell-main">
    <slot />
  </main>

  <!-- Global Toast Notification Layer -->
  <aside class="toast-viewport" role="region" aria-label="Notificaciones" aria-live="polite">
    {#each $toastStore as toast (toast.id)}
      <div class="toast-pill toast-{toast.type}" role="alert">
        <span class="toast-message">{toast.message}</span>
        {#if toast.action}
          <button
            type="button"
            class="toast-action-btn"
            on:click={() => {
              if (toast.action) toast.action.onClick();
              toastStore.dismiss(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        {/if}
        <button
          type="button"
          class="toast-close-btn"
          aria-label="Cerrar notificación"
          on:click={() => toastStore.dismiss(toast.id)}
        >
          ✕
        </button>
      </div>
    {/each}
  </aside>
</div>

<style>
  :global(:root) {
    --color-brown: #75472f;
    --color-brown-dark: #69412d;
    --color-brown-light: #9a623e;
    --color-cream: #fff8ef;
    --color-ink: #302821;
    --color-muted: #7c7168;
    --color-line: #eadfd2;
    --color-green: #4c7860;
    --color-red: #b84035;
    --color-amber: #a56b15;
    --color-bg: #f7f2eb;
    --color-surface: #ffffff;
    --font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    --touch-min: 44px;
    --header-height: 60px;
    --nav-height: 60px;
  }

  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    background-color: var(--color-bg);
    color: var(--color-ink);
    font-family: var(--font-family);
    -webkit-font-smoothing: antialiased;
    overscroll-behavior-y: none;
  }

  .app-shell {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
  }

  .network-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 0.85rem;
    font-weight: 600;
    text-align: center;
  }

  .network-banner.offline {
    background-color: var(--color-red);
    color: #ffffff;
  }

  .network-banner.syncing {
    background-color: var(--color-amber);
    color: #ffffff;
  }

  .shell-main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .toast-viewport {
    position: fixed;
    bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 16px);
    left: 50%;
    transform: translateX(-50%);
    width: min(92%, 480px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 9999;
    pointer-events: none;
  }

  .toast-pill {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    background-color: #26211c;
    color: #ffffff;
    padding: 10px 16px;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    font-size: 0.9rem;
  }

  .toast-message {
    flex: 1;
    line-height: 1.3;
  }

  .toast-action-btn {
    min-width: var(--touch-min);
    min-height: var(--touch-min);
    background-color: var(--color-brown-light);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  .toast-close-btn {
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #b0a599;
    font-size: 1.1rem;
    cursor: pointer;
    touch-action: manipulation;
    padding: 0;
    border-radius: 8px;
  }
</style>
