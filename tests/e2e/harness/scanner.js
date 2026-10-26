/**
 * Camera Scanner & Barcode Validation Reference Oracle
 * Authoritative source: ORIGINAL_REQUEST.md § R3, PROJECT.md § Feature 19, 20, 21
 */

const SUPPORTED_FORMATS = ['ean_13', 'qr_code', 'code_128', 'ean_8'];

/**
 * Validates EAN-13 checksum according to GS1 standard.
 * Sum of odd positions * 1 + sum of even positions * 3, modulo 10.
 * @param {string} barcode
 * @returns {boolean}
 */
function isValidEan13(barcode) {
  if (!barcode || typeof barcode !== 'string' || !/^\d{13}$/.test(barcode)) {
    return false;
  }
  const digits = barcode.split('').map(Number);
  const checkDigit = digits[12];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += i % 2 === 0 ? digits[i] : digits[i] * 3;
  }
  const calculatedCheck = (10 - (sum % 10)) % 10;
  return checkDigit === calculatedCheck;
}

/**
 * Validates EAN-8 checksum.
 * @param {string} barcode
 * @returns {boolean}
 */
function isValidEan8(barcode) {
  if (!barcode || typeof barcode !== 'string' || !/^\d{8}$/.test(barcode)) {
    return false;
  }
  const digits = barcode.split('').map(Number);
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
 * @param {string} code
 * @returns {{ valid: boolean; format: string | null }}
 */
function inspectBarcode(code) {
  if (!code || typeof code !== 'string') return { valid: false, format: null };
  const trimmed = code.trim();
  if (isValidEan13(trimmed)) return { valid: true, format: 'ean_13' };
  if (isValidEan8(trimmed)) return { valid: true, format: 'ean_8' };
  if (/^[A-Za-z0-9\-._/]{1,128}$/.test(trimmed)) return { valid: true, format: 'code_128' };
  if (trimmed.length > 0) return { valid: true, format: 'qr_code' };
  return { valid: false, format: null };
}

/**
 * Instant barcode lookup in active products list.
 * @param {string} barcode
 * @param {Array<object>} products
 * @returns {{ found: boolean; product: object | null }}
 */
function lookupBarcode(barcode, products) {
  if (!barcode || !Array.isArray(products)) {
    return { found: false, product: null };
  }
  const clean = barcode.trim().toLowerCase();
  const match = products.find(p => {
    if (p.isDiscarded || p.isConsumed) return false;
    const prodBarcode = (p.barcode || '').trim().toLowerCase();
    const prodLot = (p.lot || '').trim().toLowerCase();
    return prodBarcode === clean || prodLot === clean;
  });
  return { found: Boolean(match), product: match || null };
}

/**
 * Mock Camera Track for testing lifecycle management.
 */
class MockMediaStreamTrack {
  constructor(kind = 'video') {
    this.kind = kind;
    this.readyState = 'live';
    this.enabled = true;
    this.capabilities = { torch: true, facingMode: ['environment', 'user'] };
    this.settings = { facingMode: 'environment', torch: false };
  }

  stop() {
    this.readyState = 'ended';
  }

  async applyConstraints(constraints) {
    if (this.readyState === 'ended') throw new Error('Track ended');
    if (constraints && constraints.advanced) {
      for (const adv of constraints.advanced) {
        if ('torch' in adv) this.settings.torch = Boolean(adv.torch);
      }
    }
  }
}

/**
 * Mock MediaStream containing video tracks.
 */
class MockMediaStream {
  constructor() {
    this.tracks = [new MockMediaStreamTrack('video')];
  }

  getVideoTracks() {
    return this.tracks.filter(t => t.kind === 'video');
  }

  getTracks() {
    return [...this.tracks];
  }
}

module.exports = {
  SUPPORTED_FORMATS,
  isValidEan13,
  isValidEan8,
  inspectBarcode,
  lookupBarcode,
  MockMediaStreamTrack,
  MockMediaStream
};
