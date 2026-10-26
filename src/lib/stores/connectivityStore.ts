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
