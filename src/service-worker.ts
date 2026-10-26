/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Versioned Cache Name for StockControl PWA
const CACHE_NAME = `stockcontrol-pwa-${version}`;

function toPath(item: string | { path: string }): string {
	return typeof item === 'string' ? item : item.path;
}

// App shell and static assets to precache during install
const PRECACHE_ASSETS: string[] = [
	'/',
	'/index.html',
	'/manifest.json',
	...immutable.map(toPath),
	...assets.map(toPath),
	...prerendered.map(toPath)
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
			} catch {
				return new Response('', { status: 408, statusText: 'Request Timed Out' });
			}
		})()
	);
});
