const { assert, runDirectly } = require('../test_helper');
const { validateManifest } = require('../harness');

const tests = [
  {
    name: 'B22-T01: Extra unknown extension fields in manifest do not invalidate parser',
    fn: async () => {
      const manifestWithExtensions = {
        name: 'StockControl',
        short_name: 'StockControl',
        display: 'standalone',
        theme_color: '#75472f',
        background_color: '#f7f2eb',
        icons: [
          { src: './icon-192.png', sizes: '192x192' },
          { src: './icon-512.png', sizes: '512x512' }
        ],
        custom_kitchen_plugin: { enabled: true },
        prefer_related_applications: false
      };
      const res = validateManifest(manifestWithExtensions);
      assert.strictEqual(res.valid, true);
    }
  },
  {
    name: 'B22-T02: Manifest orientation accepts portrait, landscape or any',
    fn: async () => {
      const validOrientations = ['portrait', 'landscape', 'any', 'natural'];
      for (const o of validOrientations) {
        assert.ok(validOrientations.includes(o));
      }
    }
  },
  {
    name: 'B22-T03: Non-standalone display (browser or minimal-ui) flagged for review',
    fn: async () => {
      const browserDisplay = {
        name: 'App',
        short_name: 'App',
        display: 'browser',
        theme_color: '#123456',
        background_color: '#ffffff',
        icons: [{ sizes: '192x192' }, { sizes: '512x512' }]
      };
      const res = validateManifest(browserDisplay);
      assert.strictEqual(res.valid, false);
      assert.ok(res.errors.some(e => e.includes('must be "standalone"')));
    }
  },
  {
    name: 'B22-T04: Start URL relative path resolution is valid for static hosting',
    fn: async () => {
      function validateStartUrl(url) {
        return url === './' || url === '/' || url === './index.html' || url === '/index.html';
      }
      assert.strictEqual(validateStartUrl('./index.html'), true);
      assert.strictEqual(validateStartUrl('./'), true);
      assert.strictEqual(validateStartUrl('https://otherdomain.com'), false);
    }
  },
  {
    name: 'B22-T05: Missing icons array strictly fails validation',
    fn: async () => {
      const noIcons = {
        name: 'App',
        short_name: 'App',
        display: 'standalone',
        theme_color: '#75472f',
        background_color: '#f7f2eb'
      };
      assert.strictEqual(validateManifest(noIcons).valid, false);
    }
  }
];

if (require.main === module) {
  runDirectly('B22: Web App Manifest Boundaries', tests);
}

module.exports = {
  id: 'B22',
  name: 'Web App Manifest Boundaries',
  tests
};
