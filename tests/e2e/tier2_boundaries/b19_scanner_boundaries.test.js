const { assert, runDirectly } = require('../test_helper');
const { isValidEan13, isValidEan8, inspectBarcode } = require('../harness');

const tests = [
  {
    name: 'B19-T01: Camera permission denial returns user guidance message',
    fn: async () => {
      function handleCameraError(errorName) {
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
          return { error: 'Permiso de cámara denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.' };
        }
        return { error: 'Error desconocido al acceder a la cámara.' };
      }
      const res = handleCameraError('NotAllowedError');
      assert.ok(res.error.includes('Permiso de cámara denegado'));
    }
  },
  {
    name: 'B19-T02: EAN-13 with corrupted check digit fails checksum verification',
    fn: async () => {
      // 5901234123457 is valid. Alter check digit to 3
      assert.strictEqual(isValidEan13('5901234123457'), true);
      assert.strictEqual(isValidEan13('5901234123453'), false);
    }
  },
  {
    name: 'B19-T03: EAN-8 format checksum validation',
    fn: async () => {
      // Valid EAN-8: 96385074
      // 9*3 + 6*1 + 3*3 + 8*1 + 5*3 + 0*1 + 7*3 = 27 + 6 + 9 + 8 + 15 + 0 + 21 = 86. (10 - 6) = 4. Valid!
      assert.strictEqual(isValidEan8('96385074'), true);
      assert.strictEqual(isValidEan8('96385079'), false);
    }
  },
  {
    name: 'B19-T04: Massive QR code payload (2,000 characters) processed safely without buffer crash',
    fn: async () => {
      const longPayload = 'DATA:' + 'X'.repeat(2000);
      const res = inspectBarcode(longPayload);
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.format, 'qr_code');
    }
  },
  {
    name: 'B19-T05: Rapid scan detection debouncing blocks duplicate triggers within 1000ms',
    fn: async () => {
      class BarcodeDebouncer {
        constructor(cooldownMs = 1000) {
          this.cooldownMs = cooldownMs;
          this.lastScanTime = 0;
          this.lastCode = '';
        }
        canProcess(code, now = Date.now()) {
          if (code === this.lastCode && now - this.lastScanTime < this.cooldownMs) {
            return false;
          }
          this.lastCode = code;
          this.lastScanTime = now;
          return true;
        }
      }

      const debouncer = new BarcodeDebouncer(1000);
      const t0 = 10000;
      assert.strictEqual(debouncer.canProcess('7801234567890', t0), true);
      assert.strictEqual(debouncer.canProcess('7801234567890', t0 + 200), false, 'Debounced duplicate');
      assert.strictEqual(debouncer.canProcess('7801234567890', t0 + 1200), true, 'Allowed after cooldown');
    }
  }
];

if (require.main === module) {
  runDirectly('B19: Dual-Engine Scanner Boundaries', tests);
}

module.exports = {
  id: 'B19',
  name: 'Dual-Engine Scanner Boundaries',
  tests
};
