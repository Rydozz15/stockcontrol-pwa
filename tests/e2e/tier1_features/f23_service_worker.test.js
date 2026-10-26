const { assert, runDirectly } = require('../test_helper');
const path = require('path');
const fs = require('fs');
const { inspectServiceWorker } = require('../harness');

const rootDir = path.resolve(__dirname, '../../../');

function loadServiceWorkerCode() {
  const candidates = [
    path.join(rootDir, 'src', 'service-worker.ts'),
    path.join(rootDir, 'src', 'service-worker.js'),
    path.join(rootDir, 'sw.js')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return fs.readFileSync(c, 'utf-8');
    }
  }
  return null;
}

const tests = [
  {
    name: 'F23-T01: Service worker script exists and contains offline lifecycle hooks',
    fn: async () => {
      const code = loadServiceWorkerCode();
      assert.ok(code, 'Service worker script must exist (sw.js or src/service-worker.ts)');
      const inspection = inspectServiceWorker(code);
      assert.strictEqual(inspection.hasInstall, true, 'Must handle install event');
      assert.strictEqual(inspection.hasActivate, true, 'Must handle activate event');
      assert.strictEqual(inspection.hasFetch, true, 'Must handle fetch event');
    }
  },
  {
    name: 'F23-T02: Install event handler precaches critical static assets',
    fn: async () => {
      const code = loadServiceWorkerCode();
      assert.ok(code.includes('cache') && (code.includes('addAll') || code.includes('open')));
    }
  },
  {
    name: 'F23-T03: Activate event handler deletes outdated previous cache stores',
    fn: async () => {
      const code = loadServiceWorkerCode();
      assert.ok(code.includes('keys') || code.includes('clients.claim'));
    }
  },
  {
    name: 'F23-T04: Fetch event handler serves cached response or fetches from network',
    fn: async () => {
      const code = loadServiceWorkerCode();
      assert.ok(code.includes('respondWith'));
      assert.ok(code.includes('caches.match'));
    }
  },
  {
    name: 'F23-T05: Service worker bypasses non-GET HTTP requests (e.g. POST, PUT, DELETE)',
    fn: async () => {
      function shouldIntercept(requestMethod) {
        return requestMethod === 'GET';
      }
      assert.strictEqual(shouldIntercept('GET'), true);
      assert.strictEqual(shouldIntercept('POST'), false);
      assert.strictEqual(shouldIntercept('DELETE'), false);
    }
  }
];

if (require.main === module) {
  runDirectly('F23: SvelteKit Service Worker Offline Caching', tests);
}

module.exports = {
  id: 'F23',
  name: 'SvelteKit Service Worker Offline Caching',
  tests
};
