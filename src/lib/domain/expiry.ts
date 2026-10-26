/**
 * StockControl PWA — Expiry Domain Logic
 * Clean Architecture Pure TypeScript Domain Layer
 * Path: src/lib/domain/expiry.ts
 */

import type { ExpiryStatus, ExpiryStatusKey, InventoryMetrics, Product } from './models';

/**
 * Parses a YYYY-MM-DD date string into a local midnight Date.
 * Avoids UTC timezone shift bugs common with new Date("YYYY-MM-DD").
 */
export function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10) - 1;
  const d = parseInt(match[3], 10);
  const date = new Date(y, m, d, 0, 0, 0, 0);
  // Verify strict calendar validity (e.g., rejects Feb 30)
  if (date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) {
    return null;
  }
  return date;
}

/**
 * Formats a Date object into a YYYY-MM-DD string using local calendar components.
 * Avoids .toISOString() which converts to UTC and can shift the date backwards in UTC-N zones.
 */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalizes a Date or string to local midnight (00:00:00.000).
 */
export function normalizeMidnight(date: Date | string = new Date()): Date {
  if (typeof date === 'string') {
    const parsed = parseLocalDate(date);
    if (parsed) return parsed;
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculates calendar day difference between expiry date and reference date.
 * Positive = future, 0 = today, negative = past.
 * Returns 99999 for invalid/missing dates.
 */
export function calculateDayDiff(
  expiryDateStr: string,
  referenceDate: Date | string = new Date()
): number {
  const target = parseLocalDate(expiryDateStr);
  if (!target) return 99999;

  const ref = normalizeMidnight(referenceDate);
  const MS_PER_DAY = 86400000;
  const diffMs = target.getTime() - ref.getTime();
  // Math.round handles daylight saving time 23h and 25h days safely
  return Math.round(diffMs / MS_PER_DAY);
}

export interface ExpiryStatusOptions {
  criticalDays?: number; // default: 3
  warningDays?: number;  // default: 7
}

/**
 * Categorizes product expiry into status key, human label, and badge CSS class.
 * Categories:
 * - 'expired': dayDiff < 0
 * - 'soon': 0 <= dayDiff <= criticalDays (default 3)
 * - 'week': criticalDays < dayDiff <= warningDays (default 4..7)
 * - 'ok': dayDiff > warningDays (default > 7)
 */
export function calculateExpiryStatus(
  expiryDate: string,
  referenceDate: Date | string = new Date(),
  options: ExpiryStatusOptions = {}
): ExpiryStatus {
  const criticalDays = options.criticalDays ?? 3;
  const warningDays = options.warningDays ?? 7;

  const daysRemaining = calculateDayDiff(expiryDate, referenceDate);

  if (daysRemaining === 99999) {
    return {
      key: 'ok',
      label: 'Sin fecha válida',
      daysRemaining: 99999,
      cls: 'ok'
    };
  }

  if (daysRemaining < 0) {
    const absDays = Math.abs(daysRemaining);
    const label = absDays === 1 ? 'Vencido ayer' : `Vencido hace ${absDays} día(s)`;
    return {
      key: 'expired',
      label,
      daysRemaining,
      cls: 'expired'
    };
  }

  if (daysRemaining === 0) {
    return {
      key: 'soon',
      label: 'Vence hoy',
      daysRemaining: 0,
      cls: 'warning'
    };
  }

  if (daysRemaining <= criticalDays) {
    const label = daysRemaining === 1 ? 'Vence mañana' : `Vence en ${daysRemaining} día(s)`;
    return {
      key: 'soon',
      label,
      daysRemaining,
      cls: 'warning'
    };
  }

  if (daysRemaining <= warningDays) {
    return {
      key: 'week',
      label: `Vence en ${daysRemaining} días`,
      daysRemaining,
      cls: 'warning'
    };
  }

  return {
    key: 'ok',
    label: 'Vigente',
    daysRemaining,
    cls: 'ok'
  };
}

/**
 * Calculates reactive dashboard inventory counters.
 * Excludes discarded products and exhausted/consumed items.
 */
export function calculateMetrics(
  products: Product[],
  referenceDate: Date | string = new Date()
): InventoryMetrics {
  let total = 0;
  let expired = 0;
  let soon = 0;
  let week = 0;
  let ok = 0;
  let discardedCount = 0;
  let consumedCount = 0;

  for (const p of products) {
    if (p.isDiscarded) {
      discardedCount++;
      continue;
    }
    if (p.isConsumed || p.quantity <= 0) {
      consumedCount++;
      continue;
    }

    total++;
    const status = calculateExpiryStatus(p.expiryDate, referenceDate);
    switch (status.key) {
      case 'expired':
        expired++;
        break;
      case 'soon':
        soon++;
        break;
      case 'week':
        week++;
        break;
      case 'ok':
        ok++;
        break;
    }
  }

  return {
    total,
    expired,
    soon,
    week,
    ok,
    within7Days: soon + week,
    criticalTotal: expired + soon,
    discardedCount,
    consumedCount
  };
}

/**
 * Safe date arithmetic adding N days, handling month transitions and leap days.
 */
export function addDaysSafe(baseDate: Date | string = new Date(), days: number): string {
  const ref = normalizeMidnight(baseDate);
  const target = new Date(ref.getTime());
  target.setDate(target.getDate() + days);
  return formatDateISO(target);
}

/**
 * Safe date arithmetic adding N weeks.
 */
export function addWeeksSafe(baseDate: Date | string = new Date(), weeks: number): string {
  return addDaysSafe(baseDate, weeks * 7);
}

/**
 * Safe date arithmetic adding N months with month-end overflow clamping.
 * Example: Jan 31 + 1 month in non-leap year clamps to Feb 28 (not March 3).
 * In leap year clamps to Feb 29.
 */
export function addMonthsSafe(baseDate: Date | string = new Date(), monthsToAdd: number): string {
  const ref = normalizeMidnight(baseDate);
  const originalDay = ref.getDate();
  const currentYear = ref.getFullYear();
  const currentMonth = ref.getMonth();

  const totalMonths = currentYear * 12 + currentMonth + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  // Maximum days in target month: passing (targetMonth + 1, 0) gives last day of target month
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(originalDay, daysInTargetMonth);

  const result = new Date(targetYear, targetMonth, clampedDay, 0, 0, 0, 0);
  return formatDateISO(result);
}

/**
 * 1-Touch Quick Expiry Presets for Kitchen Ergonomics (Feature 14)
 */
export const presetPlus2Days = (ref?: Date | string): string => addDaysSafe(ref, 2);
export const presetPlus3Days = (ref?: Date | string): string => addDaysSafe(ref, 3);
export const presetPlus1Week = (ref?: Date | string): string => addWeeksSafe(ref, 1);
export const presetPlus1Month = (ref?: Date | string): string => addMonthsSafe(ref, 1);
