/**
 * StockControl PWA — Domain Barcode Engine & Validation
 * Clean Architecture Pure TypeScript Domain Layer
 * Path: src/lib/domain/barcode.ts
 *
 * Implements GS1 EAN-13/EAN-8 checksum verification, format detection,
 * debounce rate-limiting, and inventory barcode/lot matching.
 */

import type { Product } from './models';
import type { ProductItem } from '$lib/stores/inventoryStore';

export const SUPPORTED_BARCODE_FORMATS = [
  'ean_13',
  'qr_code',
  'code_128',
  'ean_8',
  'upc_a',
  'upc_e'
] as const;

export type SupportedBarcodeFormat = (typeof SUPPORTED_BARCODE_FORMATS)[number];
export type ScannerEngineType = 'native_barcode_detector' | 'software_fallback';

export interface ScannerEngineResolution {
  engine: ScannerEngineType;
  hardwareAccelerated: boolean;
}

export interface BarcodeInspectionResult {
  valid: boolean;
  format: string | null;
}

export interface BarcodeLookupResult {
  found: boolean;
  product: Product | ProductItem | null;
}

/**
 * Resolves whether to use hardware-accelerated BarcodeDetector API or
 * software fallback (html5-qrcode).
 */
export function resolveScannerEngine(hasNativeBarcodeDetector: boolean): ScannerEngineResolution {
  if (hasNativeBarcodeDetector) {
    return { engine: 'native_barcode_detector', hardwareAccelerated: true };
  }
  return { engine: 'software_fallback', hardwareAccelerated: false };
}

/**
 * Validates EAN-13 checksum according to GS1 standard.
 * Sum of odd positions (0-indexed: 0, 2, 4...) * 1 + sum of even positions * 3, modulo 10.
 * Preserves string identity including leading zeros.
 */
export function isValidEan13(barcode: string): boolean {
  if (!barcode || typeof barcode !== 'string' || !/^\d{13}$/.test(barcode.trim())) {
    return false;
  }
  const digits = barcode.trim().split('').map(Number);
  const checkDigit = digits[12];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += i % 2 === 0 ? digits[i] : digits[i] * 3;
  }
  const calculatedCheck = (10 - (sum % 10)) % 10;
  return checkDigit === calculatedCheck;
}

/**
 * Validates EAN-8 checksum according to GS1 standard.
 * Sum of odd positions * 3 + sum of even positions * 1, modulo 10.
 */
export function isValidEan8(barcode: string): boolean {
  if (!barcode || typeof barcode !== 'string' || !/^\d{8}$/.test(barcode.trim())) {
    return false;
  }
  const digits = barcode.trim().split('').map(Number);
  const checkDigit = digits[7];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += i % 2 === 0 ? digits[i] * 3 : digits[i];
  }
  const calculatedCheck = (10 - (sum % 10)) % 10;
  return checkDigit === calculatedCheck;
}

/**
 * Detects format and validates barcode syntax.
 * Handles large payloads safely without buffer overrun.
 */
export function inspectBarcode(code: string | null | undefined): BarcodeInspectionResult {
  if (!code || typeof code !== 'string') {
    return { valid: false, format: null };
  }
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return { valid: false, format: null };
  }
  if (isValidEan13(trimmed)) {
    return { valid: true, format: 'ean_13' };
  }
  if (isValidEan8(trimmed)) {
    return { valid: true, format: 'ean_8' };
  }
  if (/^[A-Za-z0-9\-._/]{1,128}$/.test(trimmed)) {
    return { valid: true, format: 'code_128' };
  }
  // Any non-empty string not matching 1D barcodes is considered a QR code payload
  return { valid: true, format: 'qr_code' };
}

/**
 * Instant barcode lookup in active products list.
 * Matches either barcode or lot number (case-insensitive, whitespace-trimmed).
 * Preserves leading zero string identity and ignores discarded or consumed items.
 */
export function lookupBarcode(
  barcode: string | null | undefined,
  products: (Product | ProductItem)[] | null | undefined
): BarcodeLookupResult {
  if (!barcode || typeof barcode !== 'string' || !Array.isArray(products) || products.length === 0) {
    return { found: false, product: null };
  }

  const clean = barcode.trim().toLowerCase();
  if (!clean) {
    return { found: false, product: null };
  }

  const match = products.find(p => {
    if (!p || p.isDiscarded || p.isConsumed) return false;
    const prodBarcode = (p.barcode || '').trim().toLowerCase();
    const prodLot = (p.lot || '').trim().toLowerCase();
    return prodBarcode === clean || prodLot === clean;
  });

  return { found: Boolean(match), product: match || null };
}

/**
 * Multi-batch lookup finding all active products matching a barcode across different lots.
 */
export function findAllMatchingBarcode(
  barcode: string | null | undefined,
  products: (Product | ProductItem)[] | null | undefined
): (Product | ProductItem)[] {
  if (!barcode || typeof barcode !== 'string' || !Array.isArray(products) || products.length === 0) {
    return [];
  }
  const clean = barcode.trim().toLowerCase();
  if (!clean) return [];

  return products.filter(p => {
    if (!p || p.isDiscarded || p.isConsumed) return false;
    const prodBarcode = (p.barcode || '').trim().toLowerCase();
    return prodBarcode === clean;
  });
}

/**
 * Debouncer to prevent rapid duplicate scan events within a cooldown window.
 */
export class BarcodeDebouncer {
  private cooldownMs: number;
  private lastScanTime: number = 0;
  private lastCode: string = '';

  constructor(cooldownMs = 1000) {
    this.cooldownMs = cooldownMs;
  }

  canProcess(code: string, now = Date.now()): boolean {
    if (code === this.lastCode && now - this.lastScanTime < this.cooldownMs) {
      return false;
    }
    this.lastCode = code;
    this.lastScanTime = now;
    return true;
  }

  reset(): void {
    this.lastScanTime = 0;
    this.lastCode = '';
  }
}
