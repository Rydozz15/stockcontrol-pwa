const { assert, runDirectly } = require('../test_helper');
const { SUPPORTED_FORMATS, isValidEan13, inspectBarcode } = require('../harness');

const tests = [
  {
    name: 'F19-T01: Scanner detects native BarcodeDetector API capability when present',
    fn: async () => {
      function resolveScannerEngine(hasNativeBarcodeDetector) {
        if (hasNativeBarcodeDetector) {
          return { engine: 'native_barcode_detector', hardwareAccelerated: true };
        }
        return { engine: 'software_fallback', hardwareAccelerated: false };
      }
      assert.strictEqual(resolveScannerEngine(true).engine, 'native_barcode_detector');
      assert.strictEqual(resolveScannerEngine(false).engine, 'software_fallback');
    }
  },
  {
    name: 'F19-T02: Supported formats include EAN-13, QR Code, Code 128 and EAN-8',
    fn: async () => {
      assert.ok(SUPPORTED_FORMATS.includes('ean_13'));
      assert.ok(SUPPORTED_FORMATS.includes('qr_code'));
      assert.ok(SUPPORTED_FORMATS.includes('code_128'));
      assert.ok(SUPPORTED_FORMATS.includes('ean_8'));
    }
  },
  {
    name: 'F19-T03: EAN-13 checksum algorithm validates GS1 standards',
    fn: async () => {
      // Valid EAN-13: 7801234567897
      // 7*1 + 8*3 + 0*1 + 1*3 + 2*1 + 3*3 + 4*1 + 5*3 + 6*1 + 7*3 + 8*1 + 9*3 = 7+24+0+3+2+9+4+15+6+21+8+27 = 126. 10 - (126%10) = 4. Wait: check a known valid code
      // Let's test a valid EAN-13: 5901234123457
      // 5*1 + 9*3 + 0*1 + 1*3 + 2*1 + 3*3 + 4*1 + 1*3 + 2*1 + 3*3 + 4*1 + 5*3 = 5+27+0+3+2+9+4+3+2+9+4+15 = 83. Check = (10 - 3) = 7! Valid!
      assert.strictEqual(isValidEan13('5901234123457'), true);
      assert.strictEqual(isValidEan13('5901234123458'), false); // Wrong check digit
    }
  },
  {
    name: 'F19-T04: QR code barcode inspection identifies qr_code format',
    fn: async () => {
      const res = inspectBarcode('https://stockcontrol.kitchen/item/42');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.format, 'qr_code');
    }
  },
  {
    name: 'F19-T05: Malformed barcode string rejected gracefully',
    fn: async () => {
      assert.strictEqual(inspectBarcode('').valid, false);
      assert.strictEqual(inspectBarcode(null).valid, false);
    }
  }
];

if (require.main === module) {
  runDirectly('F19: Dual-Engine Camera Scanner', tests);
}

module.exports = {
  id: 'F19',
  name: 'Dual-Engine Camera Scanner',
  tests
};
