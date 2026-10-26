# Milestone 4 Architecture & Design Report: PWA Offline Stack, Service Worker & Render Deploy

**Agent**: `explorer_m4_2`  
**Working Directory**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m4_2/`  
**Scope**: Milestone 4 — Features 22 (Web App Manifest), 23 (Service Worker), 24 (Offline Connectivity Pill/Banner), 27 (Render Static Deployment)

---

## 1. Observation

### 1.1 Test Suite & Harness Assertions
- **Feature 22 (`tests/e2e/tier1_features/f22_pwa_manifest.test.js`)**:
  - `loadManifest()` checks `static/manifest.json` and `manifest.json` in root (lines 8–19).
  - Asserts `validateManifest(manifest).valid === true` (line 28).
  - Asserts `manifest.display === 'standalone'` (line 35).
  - Asserts icons declare `192x192` and `512x512` (lines 39–46).
  - Asserts hex colors match `/^#[0-9a-fA-F]{6}$/` for `theme_color` and `background_color` (lines 49–54).
  - Asserts `manifest.name` and `manifest.short_name` both include `"stockcontrol"` case-insensitively (lines 57–63).
- **Boundary 22 (`tests/e2e/tier2_boundaries/b22_manifest_boundaries.test.js`)**:
  - Unknown extension fields do not invalidate parser (B22-T01).
  - Valid orientations include `'portrait'`, `'landscape'`, `'any'`, `'natural'` (B22-T02).
  - Display modes other than `'standalone'` are strictly rejected (B22-T03).
  - Start URL allows `'/'`, `'./'`, `'./index.html'`, `'/index.html'` (B22-T04).
  - Missing `icons` fails validation (B22-T05).
- **Feature 23 (`tests/e2e/tier1_features/f23_service_worker.test.js`)**:
  - `loadServiceWorkerCode()` checks candidate paths in order: `src/service-worker.ts`, `src/service-worker.js`, `sw.js` (lines 8–20).
  - `inspectServiceWorker(code)` asserts (lines 28–32):
    - `hasInstall`: `code.includes('install') && (code.includes('caches.open') || code.includes('CACHE_NAME'))`
    - `hasActivate`: `code.includes('activate') && (code.includes('caches.keys') || code.includes('clients.claim'))`
    - `hasFetch`: `code.includes('fetch') && code.includes('respondWith')`
  - Asserts `code.includes('cache') && (code.includes('addAll') || code.includes('open'))` (line 38).
  - Asserts `code.includes('keys') || code.includes('clients.claim')` (line 45).
  - Asserts `code.includes('respondWith')` and `code.includes('caches.match')` (lines 52–53).
  - Asserts non-GET HTTP methods (POST, PUT, DELETE) are bypassed (lines 57–66).
- **Boundary 23 (`tests/e2e/tier2_boundaries/b23_sw_boundaries.test.js`)**:
  - Non-GET bypass (B23-T01).
  - Navigation request fallback serves cached `index.html` during offline disconnection (B23-T02).
  - Cross-origin external API requests (e.g. Firestore `https://firestore.googleapis.com/...`) are not intercepted (B23-T03).
  - Obsolete caches starting with `'stockcontrol-'` are pruned on version bump (B23-T04).
  - Precache errors/quota limits handled gracefully without unhandled promise rejection (B23-T05).
- **Feature 24 & Boundary 24 (`tests/e2e/tier1_features/f24_connectivity_pill.test.js`, `b24_connectivity_boundaries.test.js`)**:
  - Store reflects online/offline status with `setOnline(boolean)`.
  - Offline pill formatting:
    - Online: `null` or `''` (no pill).
    - Offline, 0 pending: `'Modo sin conexión'`.
    - Offline, >0 pending: `'Sin conexión (${st.pendingWrites} pendientes)'` or `'Modo sin conexión · ${pendingWrites} pendiente(s)'`.
  - Offline badge color palette: `backgroundColor: '#fff0cf'`, `color: '#88580c'` (F24-T05).
  - Supports `incrementPending()`, `decrementPending()`, `clearPending()`.
- **Feature 27 & Boundary 27 (`tests/e2e/tier1_features/f27_render_deploy.test.js`, `b27_render_boundaries.test.js`)**:
  - `validateRenderYaml(yamlConfig)` in `tests/e2e/harness/pwa.js` (lines 99–125) checks:
    - `yamlConfig.services.find(s => s.type === 'web' && s.env === 'static')` (line 108).
    - `buildCommand` must contain `'npm run build'` (line 112).
    - `staticPublishPath` must contain `'build'` (line 117).
    - `plan` must be `'free'` if present (line 120).
  - SPA rewrite rule maps `/*` to `/index.html` (lines 84–92).
  - Cache headers specify `no-cache` for `index.html` and `immutable` for static assets (B27-T03).
- **Integration Test T3-18 (`tests/e2e/tier3_combinations/cross_feature_combinations.test.js:340-356`)**:
  - Asserts physical existence of `assets/icon-192.png` and `assets/icon-512.png` with valid PNG magic bytes (`[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]`).

### 1.2 Existing Project Files
- `src/app.html`:
  - Contains `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />` (line 7).
  - Contains `<meta name="theme-color" content="#75472f" />` (line 8).
  - Contains `<meta name="apple-mobile-web-app-capable" content="yes" />` (line 10).
  - Contains `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />` (line 11).
  - Contains `<link rel="manifest" href="/manifest.json" />` (line 13).
- `static/assets/`:
  - `icon-192.png` (30,175 bytes, 192x192 PNG, RGBA).
  - `icon-512.png` (142,922 bytes, 512x512 PNG, RGBA).
  - `logo-stockcontrol.png` (840,904 bytes).
- `render.yaml`:
  - Currently specifies `runtime: static` on line 4 instead of `env: static`.
- `src/service-worker.ts`:
  - Currently does not exist. Only legacy `sw.js` in root exists.
- `src/lib/stores/connectivityStore.ts`:
  - Exposes `online`, `hasPendingWrites`, `isSyncing`, `setPendingWrites(boolean)`, `setOnlineStatus(boolean)`.
  - Needs dual property mapping (`isOnline` + `online`, `pendingWrites: number` + `hasPendingWrites: boolean`) and methods (`incrementPending`, `decrementPending`, `clearPending`, `get()`) to satisfy both the UI components and test contracts.

---

## 2. Logic Chain

1. **Web App Manifest Alignment**:
   - `static/manifest.json` is automatically copied to `build/manifest.json` by `@sveltejs/adapter-static`.
   - Per `ORIGINAL_REQUEST.md § R4` and `PROJECT.md` Feature 22, the culinary theme requires `#75472f` (theme_color) and `#fbf6ee` (background_color cream).
   - Icons in `static/assets/icon-192.png` and `static/assets/icon-512.png` are already valid PNGs and pass binary header inspection.
   - Root `manifest.json` should mirror `static/manifest.json` for backward compatibility with root test runner invocations.

2. **SvelteKit Service Worker Architecture**:
   - SvelteKit natively detects `src/service-worker.ts` and compiles it into `build/service-worker.js`.
   - Using `$service-worker` virtual module gives compile-time access to `build` (hashed Vite JS/CSS bundles), `files` (static assets), and `version`.
   - **Cache-First Strategy** for immutable bundles (`build`) and static assets (`files`) guarantees instantaneous offline boots in walk-in cold rooms.
   - **Network-First / Fallback Strategy** for navigation (`request.mode === 'navigate'`) ensures fresh index.html when connected, falling back to cached `/index.html` when offline.
   - Strict bypass for `request.method !== 'GET'` and external cross-origin requests (`url.origin !== sw.location.origin`) ensures Firestore modular SDK's HTTP/gRPC channels and multi-tab IndexedDB cache are untouched by the service worker.
   - `activate` event prunes previous `stockcontrol-pwa-*` cache stores via `caches.keys()` and immediately calls `self.clients.claim()`.

3. **Offline Connectivity Indicator (Feature 24)**:
   - In commercial kitchens, network cuts happen continuously when operators walk into walk-in refrigerators and freezers (Scenario 3 in Tier 4).
   - The indicator must be visually unambiguous yet non-disruptive: culinary caution amber `#fff0cf` background with `#88580c` text.
   - When offline with 0 pending writes: text must be `"Modo sin conexión"`.
   - When offline with pending writes: text must reflect `"Sin conexión (${pendingWrites} pendientes)"`.
   - The store must reconcile Firestore listener metadata (`snapshot.metadata.hasPendingWrites`) with numeric pending write counters.

4. **Render Static Deployment (`render.yaml`)**:
   - In `tests/e2e/harness/pwa.js:108`, `validateRenderYaml` specifically searches for `s.type === 'web' && s.env === 'static'`.
   - Current `render.yaml` has `runtime: static`. Changing this to `env: static` (and keeping `plan: free` explicit) satisfies `validateRenderYaml`, Render static site specification, and 100% $0/month cost enforcement.
   - SPA rewrite rule `/* -> /index.html` ensures SvelteKit client-side routing works on full page refreshes.
   - Cache-Control headers ensure `index.html` has `no-cache` (so updates deploy immediately) while `/_app/immutable/*` and `/assets/*` have `max-age=31536000, immutable`.

---

## 3. Caveats

- **Dual Manifest Locations**: Both `static/manifest.json` (used by SvelteKit build) and root `manifest.json` (used by some root scripts) exist. Both must be maintained with identical values.
- **Service Worker Registration**: In SvelteKit SPA, the service worker script is compiled to `/service-worker.js`. Registration must occur in the browser (e.g. `onMount` in `src/routes/+layout.svelte`) guarded by `'serviceWorker' in navigator && !dev`.
- **Firebase Persistence Non-Interference**: Firebase Modular SDK v11 already manages its own IndexedDB multi-tab offline queue (`persistentLocalCache` + `persistentMultipleTabManager`). The service worker must NOT intercept Firestore webchannel or Google APIs (`url.origin !== self.location.origin`).

---

## 4. Conclusion & Actionable File Designs

### 4.1 `static/manifest.json` (and `manifest.json`)
```json
{
  "name": "StockControl - Control de Cocina y Perecederos",
  "short_name": "StockControl",
  "description": "PWA colaborativa de inventario y control de perecederos para cocina profesional",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#fbf6ee",
  "theme_color": "#75472f",
  "icons": [
    {
      "src": "/assets/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/assets/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 4.2 `src/service-worker.ts`
```typescript
/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Versioned Cache Name for StockControl PWA
const CACHE_NAME = `stockcontrol-pwa-${version}`;

// App shell and static assets to precache during install
const PRECACHE_ASSETS = [
	'/',
	'/index.html',
	'/manifest.json',
	...build,
	...files
];

const UNIQUE_PRECACHE = Array.from(new Set(PRECACHE_ASSETS));

// 1. Install Event: Precache static app shell and skip waiting
sw.addEventListener('install', (event: ExtendableEvent) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then(async (cache) => {
				try {
					await cache.addAll(UNIQUE_PRECACHE);
				} catch (err) {
					console.warn('[SW] Batch precache warning, falling back to itemized caching:', err);
					for (const url of UNIQUE_PRECACHE) {
						try {
							await cache.add(url);
						} catch {
							// Ignore individual non-critical cache miss
						}
					}
				}
			})
			.then(() => sw.skipWaiting())
	);
});

// 2. Activate Event: Clean up outdated previous caches and claim clients
sw.addEventListener('activate', (event: ExtendableEvent) => {
	event.waitUntil(
		caches
			.keys()
			.then(async (keys) => {
				const deletions = keys
					.filter((key) => key.startsWith('stockcontrol-') && key !== CACHE_NAME)
					.map((key) => caches.delete(key));
				await Promise.all(deletions);
			})
			.then(() => sw.clients.claim())
	);
});

// 3. Fetch Event: Cache-First for static assets, Network-First for SPA navigation
sw.addEventListener('fetch', (event: FetchEvent) => {
	// Strictly bypass non-GET HTTP requests (e.g. POST, PUT, DELETE)
	if (event.request.method !== 'GET') {
		return;
	}

	const url = new URL(event.request.url);

	// Strictly bypass non-HTTP(S) and cross-origin APIs (Firestore, Firebase Auth, Google APIs)
	if (!url.protocol.startsWith('http') || url.origin !== sw.location.origin) {
		return;
	}

	// Strategy A: SPA Navigation requests (HTML documents)
	if (event.request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					// Network first: try to fetch freshest version
					const networkResponse = await fetch(event.request);
					if (networkResponse.ok) {
						const cache = await caches.open(CACHE_NAME);
						cache.put(event.request, networkResponse.clone());
					}
					return networkResponse;
				} catch {
					// Offline fallback: serve cached document or index.html
					const cachedResponse =
						(await caches.match(event.request)) ||
						(await caches.match('/index.html')) ||
						(await caches.match('/'));
					if (cachedResponse) {
						return cachedResponse;
					}
					return new Response('Offline: App shell unavailable', {
						status: 503,
						statusText: 'Service Unavailable',
						headers: { 'Content-Type': 'text/plain; charset=utf-8' }
					});
				}
			})()
		);
		return;
	}

	// Strategy B: Precached assets and static files (Cache-First)
	event.respondWith(
		(async () => {
			const cached = await caches.match(event.request);
			if (cached) {
				return cached;
			}

			try {
				const networkResponse = await fetch(event.request);
				if (networkResponse.ok && networkResponse.status === 200) {
					const cache = await caches.open(CACHE_NAME);
					cache.put(event.request, networkResponse.clone());
				}
				return networkResponse;
			} catch (fetchErr) {
				return new Response('', { status: 408, statusText: 'Request Timed Out' });
			}
		})()
	);
});
```

### 4.3 Service Worker Client Registration (`src/routes/+layout.svelte`)
In `<script lang="ts">`:
```typescript
import { onMount } from 'svelte';
import { dev } from '$app/environment';

onMount(() => {
	if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !dev) {
		navigator.serviceWorker.register('/service-worker.js').catch((err) => {
			console.warn('[SW] Service worker registration deferred:', err);
		});
	}
});
```

### 4.4 `src/lib/stores/connectivityStore.ts`
```typescript
/**
 * StockControl PWA — Reactive Connectivity & Offline Sync State Store
 * Clean Architecture Reactive Store Layer
 * Path: src/lib/stores/connectivityStore.ts
 */

import { writable } from 'svelte/store';

export interface ConnectivityState {
	// Canonical contract fields
	isOnline: boolean;
	online: boolean; // Backwards-compatible alias
	pendingWrites: number;
	hasPendingWrites: boolean; // Backwards-compatible alias (pendingWrites > 0)
	isSyncing: boolean;
	lastChanged: string; // ISO 8601
}

function isBrowser(): boolean {
	return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function createConnectivityStore() {
	const initialOnline = isBrowser() ? navigator.onLine : true;
	const initialTimestamp = new Date().toISOString();

	let currentValue: ConnectivityState = {
		isOnline: initialOnline,
		online: initialOnline,
		pendingWrites: 0,
		hasPendingWrites: false,
		isSyncing: false,
		lastChanged: initialTimestamp
	};

	const store = writable<ConnectivityState>(currentValue);

	// Keep internal copy updated
	store.subscribe((val) => {
		currentValue = val;
	});

	if (isBrowser()) {
		window.addEventListener('online', () => {
			store.update((s) => ({
				...s,
				isOnline: true,
				online: true,
				lastChanged: new Date().toISOString()
			}));
		});

		window.addEventListener('offline', () => {
			store.update((s) => ({
				...s,
				isOnline: false,
				online: false,
				lastChanged: new Date().toISOString()
			}));
		});
	}

	return {
		subscribe: store.subscribe,
		get(): ConnectivityState {
			return currentValue;
		},
		setOnline(isOnline: boolean): void {
			const b = Boolean(isOnline);
			store.update((s) => ({
				...s,
				isOnline: b,
				online: b,
				lastChanged: new Date().toISOString()
			}));
		},
		setOnlineStatus(online: boolean): void {
			this.setOnline(online);
		},
		incrementPending(): void {
			store.update((s) => {
				const next = s.pendingWrites + 1;
				return {
					...s,
					pendingWrites: next,
					hasPendingWrites: next > 0
				};
			});
		},
		decrementPending(): void {
			store.update((s) => {
				const next = Math.max(0, s.pendingWrites - 1);
				return {
					...s,
					pendingWrites: next,
					hasPendingWrites: next > 0
				};
			});
		},
		clearPending(): void {
			store.update((s) => ({
				...s,
				pendingWrites: 0,
				hasPendingWrites: false
			}));
		},
		setPendingWrites(hasPending: boolean | number): void {
			store.update((s) => {
				const count = typeof hasPending === 'number' ? Math.max(0, hasPending) : hasPending ? Math.max(1, s.pendingWrites) : 0;
				return {
					...s,
					pendingWrites: count,
					hasPendingWrites: count > 0
				};
			});
		},
		setSyncing(syncing: boolean): void {
			store.update((s) => ({ ...s, isSyncing: Boolean(syncing) }));
		},
		check(): boolean {
			const online = isBrowser() ? navigator.onLine : true;
			this.setOnline(online);
			return online;
		},
		reset(): void {
			const online = isBrowser() ? navigator.onLine : true;
			store.set({
				isOnline: online,
				online,
				pendingWrites: 0,
				hasPendingWrites: false,
				isSyncing: false,
				lastChanged: new Date().toISOString()
			});
		}
	};
}

export const connectivityStore = createConnectivityStore();
```

### 4.5 Offline Connectivity Pill / Banner Component (`src/lib/components/ConnectivityBanner.svelte`)
```svelte
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
```

### 4.6 `render.yaml`
```yaml
services:
  - type: web
    name: stockcontrol-pwa
    env: static
    plan: free
    buildCommand: npm install && npm run build
    staticPublishPath: ./build
    pullRequestPreviewsEnabled: false
    headers:
      - path: /*
        name: X-Frame-Options
        value: SAMEORIGIN
      - path: /*
        name: X-Content-Type-Options
        value: nosniff
      - path: /*
        name: Cache-Control
        value: no-cache
      - path: /_app/immutable/*
        name: Cache-Control
        value: public, max-age=31536000, immutable
      - path: /assets/*
        name: Cache-Control
        value: public, max-age=31536000, immutable
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

---

## 5. Verification Method

1. **E2E Test Runner**:
   ```bash
   npm test
   ```
   **Expected**: 302/302 tests pass across Tiers 1-4 with 0 failures.

2. **Focused Feature Coverage Tests**:
   ```bash
   node tests/e2e/tier1_features/f22_pwa_manifest.test.js
   node tests/e2e/tier1_features/f23_service_worker.test.js
   node tests/e2e/tier1_features/f24_connectivity_pill.test.js
   node tests/e2e/tier1_features/f27_render_deploy.test.js
   ```
   **Expected**: All tests return `Passed: 5, Failed: 0` for each feature.

3. **Boundary Verification**:
   ```bash
   node tests/e2e/tier2_boundaries/b22_manifest_boundaries.test.js
   node tests/e2e/tier2_boundaries/b23_sw_boundaries.test.js
   node tests/e2e/tier2_boundaries/b24_connectivity_boundaries.test.js
   node tests/e2e/tier2_boundaries/b27_render_boundaries.test.js
   ```
   **Expected**: All boundary condition tests return 0 failures.

4. **Integration & Scenario Verification**:
   ```bash
   node tests/e2e/tier3_combinations/cross_feature_combinations.test.js
   node tests/e2e/tier4_realworld/s3_freezer_blackout.test.js
   ```
   **Expected**: Validates service worker offline interception, icon PNG magic bytes, render build alignment, and walk-in freezer offline persistence.

5. **Type Check & Static Build**:
   ```bash
   npm run check
   npm run build
   ```
   **Expected**: 0 errors, 0 warnings from `svelte-check`, and `build/` directory generated cleanly with `build/service-worker.js` and `build/manifest.json`.

6. **Invalidation Conditions**:
   - `render.yaml` using `runtime: static` instead of `env: static` (fails `validateRenderYaml`).
   - `src/service-worker.ts` omitting `caches.match` or `respondWith` (fails `inspectServiceWorker`).
   - `manifest.json` missing `192x192` or `512x512` icons or using non-hex colors (fails `validateManifest`).
   - Connectivity badge using non-caution color palette (fails F24-T05).
