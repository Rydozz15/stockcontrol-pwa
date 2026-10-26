const { assert, runDirectly } = require('../test_helper');
const path = require('path');
const fs = require('fs');
const { inspectPngBuffer } = require('../harness');

const rootDir = path.resolve(__dirname, '../../../');

function findAssetPath(filename) {
  const candidates = [
    path.join(rootDir, 'static', 'assets', filename),
    path.join(rootDir, 'static', filename),
    path.join(rootDir, 'assets', filename)
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

const tests = [
  {
    name: 'F05-T01: icon-192.png asset exists and is non-empty',
    fn: async () => {
      const p = findAssetPath('icon-192.png');
      assert.ok(p, 'icon-192.png must exist in static assets or assets/');
      const stats = fs.statSync(p);
      assert.ok(stats.size > 0, 'icon-192.png must not be empty');
    }
  },
  {
    name: 'F05-T02: icon-512.png asset exists and is non-empty',
    fn: async () => {
      const p = findAssetPath('icon-512.png');
      assert.ok(p, 'icon-512.png must exist in static assets or assets/');
      const stats = fs.statSync(p);
      assert.ok(stats.size > 0, 'icon-512.png must not be empty');
    }
  },
  {
    name: 'F05-T03: logo-stockcontrol.png brand asset exists and is non-empty',
    fn: async () => {
      const p = findAssetPath('logo-stockcontrol.png');
      assert.ok(p, 'logo-stockcontrol.png must exist in static assets or assets/');
      const stats = fs.statSync(p);
      assert.ok(stats.size > 0, 'logo-stockcontrol.png must not be empty');
    }
  },
  {
    name: 'F05-T04: icon-192.png binary has valid PNG magic bytes header',
    fn: async () => {
      const p = findAssetPath('icon-192.png');
      assert.ok(p);
      const buf = fs.readFileSync(p);
      const res = inspectPngBuffer(buf);
      assert.strictEqual(res.valid, true, 'icon-192.png must have valid PNG signature');
    }
  },
  {
    name: 'F05-T05: icon-512.png binary has valid PNG magic bytes header',
    fn: async () => {
      const p = findAssetPath('icon-512.png');
      assert.ok(p);
      const buf = fs.readFileSync(p);
      const res = inspectPngBuffer(buf);
      assert.strictEqual(res.valid, true, 'icon-512.png must have valid PNG signature');
    }
  }
];

if (require.main === module) {
  runDirectly('F05: Static Brand Assets & PWA Icons', tests);
}

module.exports = {
  id: 'F05',
  name: 'Static Brand Assets & PWA Icons',
  tests
};
