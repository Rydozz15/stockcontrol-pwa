/**
 * Pure Domain Expiry Calculation Reference Oracle
 * Authoritative source: ORIGINAL_REQUEST.md § R2, PROJECT.md § Interface Contracts
 */

/**
 * Normalizes a date string (YYYY-MM-DD) or Date object to local midnight Date.
 * @param {string | Date} d
 * @returns {Date}
 */
function toMidnight(d) {
  if (!d) return null;
  if (typeof d === 'string') {
    const parts = d.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
      return new Date(year, month, day, 0, 0, 0, 0);
    }
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }
  const copy = new Date(d.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Calculates day difference between target date and reference date (today).
 * Difference is in whole calendar days.
 * @param {string} expiryStr - 'YYYY-MM-DD'
 * @param {Date | string} [todayRef]
 * @returns {number}
 */
function dayDiff(expiryStr, todayRef = new Date()) {
  const expiry = toMidnight(expiryStr);
  if (!expiry) return 99999;
  const today = toMidnight(todayRef);
  if (!today) return 99999;

  // Use UTC timestamps to avoid daylight saving time 23h/25h rounding issues
  const utcExpiry = Date.UTC(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const MS_PER_DAY = 86400000;
  return Math.round((utcExpiry - utcToday) / MS_PER_DAY);
}

/**
 * Calculates domain expiry status categorization according to specification.
 * - expired: daysRemaining < 0
 * - soon: daysRemaining === 0 ("Vence hoy") or 1..3 days ("Vence en N día(s)")
 * - week: 4..7 days ("Vence en N días")
 * - ok: daysRemaining > 7 ("Vigente")
 *
 * @param {string} expiryDate - 'YYYY-MM-DD'
 * @param {Date | string} [todayRef]
 * @returns {{ key: 'expired' | 'soon' | 'week' | 'ok'; label: string; daysRemaining: number; cls: string; }}
 */
function calculateExpiryStatus(expiryDate, todayRef = new Date()) {
  const n = dayDiff(expiryDate, todayRef);
  if (n === 99999) {
    return { key: 'ok', label: 'Sin fecha', daysRemaining: 99999, cls: 'unknown' };
  }
  if (n < 0) {
    return {
      key: 'expired',
      label: `Vencido hace ${Math.abs(n)} día(s)`,
      daysRemaining: n,
      cls: 'expired'
    };
  }
  if (n === 0) {
    return {
      key: 'soon',
      label: 'Vence hoy',
      daysRemaining: 0,
      cls: 'warning'
    };
  }
  if (n <= 3) {
    return {
      key: 'soon',
      label: `Vence en ${n} día(s)`,
      daysRemaining: n,
      cls: 'warning'
    };
  }
  if (n <= 7) {
    return {
      key: 'week',
      label: `Vence en ${n} días`,
      daysRemaining: n,
      cls: 'warning'
    };
  }
  return {
    key: 'ok',
    label: 'Vigente',
    daysRemaining: n,
    cls: 'ok'
  };
}

/**
 * Calculates quick expiry preset with month-overflow clamping and leap-year safety.
 * Presets: '+2d', '+3d', '+1w', '+1m'.
 * @param {string | Date} baseDate - Reference date
 * @param {'+2d' | '+3d' | '+1w' | '+1m'} preset
 * @returns {string} 'YYYY-MM-DD'
 */
function calculatePresetDate(baseDate, preset) {
  const d = toMidnight(baseDate) || toMidnight(new Date());
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let targetDate;
  if (preset === '+2d') {
    targetDate = new Date(year, month, day + 2);
  } else if (preset === '+3d') {
    targetDate = new Date(year, month, day + 3);
  } else if (preset === '+1w') {
    targetDate = new Date(year, month, day + 7);
  } else if (preset === '+1m') {
    const targetMonth = month + 1;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = targetMonth % 12;

    // Check maximum days in target month (handles Feb 28/29, Apr 30, etc.)
    const maxDaysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
    const clampedDay = Math.min(day, maxDaysInTargetMonth);
    targetDate = new Date(targetYear, normalizedMonth, clampedDay);
  } else {
    throw new Error(`Unknown preset: ${preset}`);
  }

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dayStr = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}

/**
 * Calculates aggregate inventory metrics from active product list.
 * Consumed and discarded products are excluded.
 * @param {Array<object>} products
 * @param {Date | string} [todayRef]
 * @returns {{ total: number; expired: number; soon: number; week: number; ok: number; }}
 */
function calculateMetrics(products, todayRef = new Date()) {
  if (!Array.isArray(products) || products.length === 0) {
    return { total: 0, expired: 0, soon: 0, week: 0, ok: 0 };
  }

  const active = products.filter(p => !p.isDiscarded && !p.isConsumed);
  let expired = 0;
  let soon = 0;
  let week = 0;
  let ok = 0;

  for (const p of active) {
    const status = calculateExpiryStatus(p.expiryDate || p.expiry, todayRef);
    if (status.key === 'expired') {
      expired++;
    } else if (status.key === 'soon') {
      soon++;
    } else if (status.key === 'week') {
      week++;
    } else if (status.key === 'ok') {
      ok++;
    }
  }

  return {
    total: active.length,
    expired,
    soon,
    week,
    ok
  };
}

module.exports = {
  toMidnight,
  dayDiff,
  calculateExpiryStatus,
  calculatePresetDate,
  calculateMetrics
};
