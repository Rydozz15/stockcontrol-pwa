# DISPATCH: explorer_m4_2

## Mission
Investigate and design the PWA Offline Stack, Service Worker, and Deployment Config for Milestone 4 (Features 22, 23, 24, 27).

## Scope & Architectural Requirements
1. **Web App Manifest (`static/manifest.json`)**:
   - Manifest specifications per `ORIGINAL_REQUEST.md § R4` and `PROJECT.md` Feature 22:
     - `name`: "StockControl - Control de Cocina y Perecederos"
     - `short_name`: "StockControl"
     - `description`: "PWA colaborativa de inventario y control de perecederos para cocina profesional"
     - `start_url`: "/"
     - `display`: "standalone"
     - `background_color`: "#fbf6ee" (cream)
     - `theme_color`: "#75472f" (culinary warm brown)
     - `icons`: standard 192x192, 512x512, maskable icons in `static/`
   - Link manifest in `src/app.html` (`<link rel="manifest" href="/manifest.json" />`, `<meta name="theme-color" content="#75472f">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`).
2. **SvelteKit Service Worker (`src/service-worker.ts`)**:
   - SvelteKit standard service worker imports: `import { build, files, version } from '$service-worker'`.
   - Precaching: Cache all immutable assets (`build`), static assets (`files`).
   - Strategy: Cache-first for precached static assets, Stale-While-Revalidate or Network-First for HTML navigation fallback.
   - Cache invalidation: delete old cache versions on `activate` event.
   - Offline boot: app must load and initialize offline without network.
3. **Offline Connectivity Indicator (Feature 24)**:
   - Visual pill or banner indicating online/offline status (using `navigator.onLine` and `window.addEventListener('online' | 'offline')`).
   - Non-intrusive, ergonomic placement in header or status bar.
4. **Render Static Deployment (`render.yaml`)**:
   - Configuration for Render Static Site ($0/month):
     ```yaml
     services:
       - type: web
         name: stockcontrol-pwa
         env: static
         buildCommand: npm install && npm run build
         staticPublishPath: build
         pullRequestPreviewsEnabled: false
         routes:
           - type: rewrite
             source: /*
             destination: /index.html
     ```
   - Verify compatibility with `@sveltejs/adapter-static` single-page fallback `index.html`.

Write your complete design, file templates, and integration plan to `.agents/teamwork/explorer_m4_2/handoff.md` and notify with `send_message`.


## 2026-10-26T01:28:30Z
[Message from parent 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c]:
You are explorer_m4_2.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m4_2/
Read your task assignment in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m4_2/DISPATCH.md.
Also read /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md, /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md, and inspect src/app.html, svelte.config.js / vite.config.ts, static/ directory, and tests/e2e/tier1/f22_manifest.test.js, f23_service_worker.test.js, f24_offline_indicator.test.js, f27_render_config.test.js.
Design static/manifest.json, src/service-worker.ts with cache-first static shell strategy, offline connectivity banner/pill, and render.yaml.
Write your complete report to /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m4_2/handoff.md and notify with send_message.
