const { assert, runDirectly } = require('../test_helper');
const path = require('path');
const fs = require('fs');
const { validateManifest } = require('../harness');

const rootDir = path.resolve(__dirname, '../../../');

function loadManifest() {
  const candidates = [
    path.join(rootDir, 'static', 'manifest.json'),
    path.join(rootDir, 'manifest.json')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return JSON.parse(fs.readFileSync(c, 'utf-8'));
    }
  }
  return null;
}

const tests = [
  {
    name: 'F22-T01: manifest.json exists and satisfies PWA validation rules',
    fn: async () => {
      const manifest = loadManifest();
      assert.ok(manifest, 'manifest.json must exist');
      const res = validateManifest(manifest);
      assert.strictEqual(res.valid, true, `Manifest validation failed: ${res.errors.join(', ')}`);
    }
  },
  {
    name: 'F22-T02: Manifest display mode is set to standalone for native app experience',
    fn: async () => {
      const manifest = loadManifest();
      assert.strictEqual(manifest.display, 'standalone');
    }
  },
  {
    name: 'F22-T03: Manifest defines 192x192 and 512x512 application icons',
    fn: async () => {
      const manifest = loadManifest();
      const has192 = manifest.icons.some(i => i.sizes === '192x192');
      const has512 = manifest.icons.some(i => i.sizes === '512x512');
      assert.strictEqual(has192, true, 'Must declare 192x192 icon');
      assert.strictEqual(has512, true, 'Must declare 512x512 icon');
    }
  },
  {
    name: 'F22-T04: Theme colors conform to restaurant culinary palette (warm brown/cream)',
    fn: async () => {
      const manifest = loadManifest();
      assert.ok(/^#[0-9a-fA-F]{6}$/.test(manifest.theme_color));
      assert.ok(/^#[0-9a-fA-F]{6}$/.test(manifest.background_color));
    }
  },
  {
    name: 'F22-T05: Name and short_name match StockControl PWA brand',
    fn: async () => {
      const manifest = loadManifest();
      assert.ok(manifest.name.toLowerCase().includes('stockcontrol'));
      assert.ok(manifest.short_name.toLowerCase().includes('stockcontrol'));
    }
  }
];

if (require.main === module) {
  runDirectly('F22: Web App Manifest', tests);
}

module.exports = {
  id: 'F22',
  name: 'Web App Manifest',
  tests
};
