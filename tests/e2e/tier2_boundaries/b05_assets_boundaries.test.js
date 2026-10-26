const { assert, runDirectly } = require('../test_helper');
const path = require('path');
const fs = require('fs');
const { inspectPngBuffer } = require('../harness');

const rootDir = path.resolve(__dirname, '../../../');

function findAsset(name) {
  const candidates = [
    path.join(rootDir, 'static', 'assets', name),
    path.join(rootDir, 'static', name),
    path.join(rootDir, 'assets', name)
  ];
  return candidates.find(p => fs.existsSync(p));
}

const tests = [
  {
    name: 'B05-T01: icon-192.png has exact 192x192 pixel dimensions in IHDR chunk',
    fn: async () => {
      const p = findAsset('icon-192.png');
      assert.ok(p);
      const buf = fs.readFileSync(p);
      const info = inspectPngBuffer(buf);
      assert.strictEqual(info.valid, true);
      assert.strictEqual(info.width, 192, `Width must be 192, got ${info.width}`);
      assert.strictEqual(info.height, 192, `Height must be 192, got ${info.height}`);
    }
  },
  {
    name: 'B05-T02: icon-512.png has exact 512x512 pixel dimensions in IHDR chunk',
    fn: async () => {
      const p = findAsset('icon-512.png');
      assert.ok(p);
      const buf = fs.readFileSync(p);
      const info = inspectPngBuffer(buf);
      assert.strictEqual(info.valid, true);
      assert.strictEqual(info.width, 512, `Width must be 512, got ${info.width}`);
      assert.strictEqual(info.height, 512, `Height must be 512, got ${info.height}`);
    }
  },
  {
    name: 'B05-T03: PWA icons enforce strict 1:1 aspect ratio',
    fn: async () => {
      for (const name of ['icon-192.png', 'icon-512.png']) {
        const p = findAsset(name);
        assert.ok(p);
        const buf = fs.readFileSync(p);
        const info = inspectPngBuffer(buf);
        assert.strictEqual(info.width / info.height, 1.0, `${name} must be perfectly square`);
      }
    }
  },
  {
    name: 'B05-T04: PNG bit depth satisfies standard web rendering (>= 8 bits per channel)',
    fn: async () => {
      const p = findAsset('icon-192.png');
      assert.ok(p);
      const buf = fs.readFileSync(p);
      const info = inspectPngBuffer(buf);
      assert.ok(info.bitDepth >= 8, `Bit depth should be at least 8, got ${info.bitDepth}`);
    }
  },
  {
    name: 'B05-T05: Truncated or corrupted image buffer fails validation gracefully',
    fn: async () => {
      const corruptedBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]); // truncated
      const res = inspectPngBuffer(corruptedBuf);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(inspectPngBuffer(Buffer.alloc(0)).valid, false);
    }
  }
];

if (require.main === module) {
  runDirectly('B05: Brand Assets Boundaries', tests);
}

module.exports = {
  id: 'B05',
  name: 'Brand Assets Boundaries',
  tests
};
