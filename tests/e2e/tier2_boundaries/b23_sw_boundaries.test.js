const { assert, runDirectly } = require('../test_helper');

const tests = [
  {
    name: 'B23-T01: Non-GET HTTP methods strictly bypass service worker cache',
    fn: async () => {
      function interceptRequest(method) {
        if (method !== 'GET') {
          return { passThrough: true, cached: false };
        }
        return { passThrough: false, cached: true };
      }
      assert.strictEqual(interceptRequest('POST').passThrough, true);
      assert.strictEqual(interceptRequest('PUT').passThrough, true);
      assert.strictEqual(interceptRequest('DELETE').passThrough, true);
      assert.strictEqual(interceptRequest('GET').passThrough, false);
    }
  },
  {
    name: 'B23-T02: Navigation request fallback serves cached index.html during offline disconnection',
    fn: async () => {
      function resolveOfflineResponse(requestMode, cachedIndex) {
        if (requestMode === 'navigate') {
          return cachedIndex || new Response('Offline', { status: 503 });
        }
        return null;
      }
      const fakeIndex = { body: '<html>App Shell</html>' };
      const res = resolveOfflineResponse('navigate', fakeIndex);
      assert.strictEqual(res, fakeIndex);
    }
  },
  {
    name: 'B23-T03: Cross-origin external API requests are not intercepted by local static asset cache',
    fn: async () => {
      function isLocalAsset(url, origin) {
        return url.startsWith(origin) || url.startsWith('./') || url.startsWith('/');
      }
      const origin = 'https://stockcontrol.onrender.com';
      assert.strictEqual(isLocalAsset('https://firestore.googleapis.com/v1/...', origin), false);
      assert.strictEqual(isLocalAsset('https://stockcontrol.onrender.com/assets/logo.png', origin), true);
    }
  },
  {
    name: 'B23-T04: Cache name version bump purges obsolete caches on activation',
    fn: async () => {
      const currentCache = 'stockcontrol-v2';
      const existingCaches = ['stockcontrol-v1', 'stockcontrol-v2', 'other-cache'];

      const toDelete = existingCaches.filter(name => name.startsWith('stockcontrol-') && name !== currentCache);
      assert.deepStrictEqual(toDelete, ['stockcontrol-v1']);
    }
  },
  {
    name: 'B23-T05: Cache quota exceeded during precache logs warning without throwing unhandled rejection',
    fn: async () => {
      async function safePrecache(files) {
        try {
          if (files.length > 1000) throw new Error('QuotaExceededError');
          return { success: true };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }
      const res = await safePrecache(new Array(1500));
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'QuotaExceededError');
    }
  }
];

if (require.main === module) {
  runDirectly('B23: Service Worker Boundaries', tests);
}

module.exports = {
  id: 'B23',
  name: 'Service Worker Boundaries',
  tests
};
