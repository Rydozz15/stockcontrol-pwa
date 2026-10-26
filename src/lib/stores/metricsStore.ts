/**
 * StockControl PWA — Reactive Metrics Store
 * Clean Architecture Reactive Store Layer
 * Path: src/lib/stores/metricsStore.ts
 *
 * Derives reactive dashboard counters from inventoryStore by delegating to
 * the pure domain calculation engine in src/lib/domain/expiry.ts.
 * Resolves Reviewer Finding 1 (DRY / Single Source of Truth).
 */

import { derived } from 'svelte/store';
import { inventoryStore, type ProductItem } from './inventoryStore';
import {
  calculateMetrics as domainCalculateMetrics,
  calculateDayDiff as domainCalculateDayDiff,
  parseLocalDate
} from '$lib/domain/expiry';
import type { Product } from '$lib/domain/models';

export type { ProductItem };

export interface StockMetrics {
  total: number;       // All active products (not discarded, quantity > 0)
  expired: number;     // dayDiff < 0
  soon: number;        // 0 <= dayDiff <= 3 (vence hoy / 3 días)
  week: number;        // 4 <= dayDiff <= 7 (vence en la semana)
  critical7: number;   // 0 <= dayDiff <= 7 (total crítico a 7 días, soon + week)
  within7Days: number; // alias for critical7
  criticalTotal: number; // expired + soon
  ok: number;          // dayDiff > 7 (vigente)
  discarded: number;   // discarded food items
  consumed: number;    // exhausted/consumed items
}

/**
 * Parses YYYY-MM-DD date string into local midnight Date.
 * Re-exports domain parseLocalDate for backward compatibility with existing tests and callers.
 */
export const parseDateOnly = parseLocalDate;

/**
 * Calculates calendar day difference between expiry date and reference date.
 * Re-exports domain calculateDayDiff for backward compatibility with existing tests and callers.
 */
export const calculateDayDiff = domainCalculateDayDiff;

/**
 * Calculates stock metrics by delegating directly to pure domain calculateMetrics.
 * Enriches the domain InventoryMetrics with backwards-compatible aliases (critical7, discarded, consumed).
 */
export function calculateMetrics(
  products: ProductItem[],
  referenceDate?: Date | string
): StockMetrics {
  const base = domainCalculateMetrics((products || []) as Product[], referenceDate);
  return {
    ...base,
    critical7: base.within7Days,
    discarded: base.discardedCount,
    consumed: base.consumedCount
  };
}

/**
 * Derived reactive metrics store automatically updated whenever inventoryStore changes.
 */
export const metricsStore = derived(inventoryStore, ($inv) => {
  return calculateMetrics($inv.products);
});
