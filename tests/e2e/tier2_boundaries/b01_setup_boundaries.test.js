const { assert, runDirectly } = require('../test_helper');

const tests = [
  {
    name: 'B01-T01: Static adapter config validator rejects missing or empty fallback',
    fn: async () => {
      function validateAdapterConfig(cfg) {
        if (!cfg || !cfg.fallback || typeof cfg.fallback !== 'string' || cfg.fallback.trim() === '') {
          throw new Error('SPA static adapter requires a non-empty fallback filename (e.g. index.html)');
        }
        return true;
      }
      assert.throws(() => validateAdapterConfig({ pages: 'build' }), /requires a non-empty fallback/);
      assert.strictEqual(validateAdapterConfig({ fallback: 'index.html' }), true);
    }
  },
  {
    name: 'B01-T02: Build target path handling with non-ASCII characters or spaces',
    fn: async () => {
      function sanitizeBuildPath(p) {
        return p.replace(/[\0\r\n]/g, '').trim();
      }
      const safe = sanitizeBuildPath('/build/cocina de pruebas/');
      assert.strictEqual(safe, '/build/cocina de pruebas/');
    }
  },
  {
    name: 'B01-T03: SSR safety guard prevents window access during server execution',
    fn: async () => {
      function safeWindowAccess(globalScope) {
        if (typeof globalScope.window === 'undefined') {
          return { isBrowser: false, viewport: { width: 0, height: 0 } };
        }
        return { isBrowser: true, viewport: { width: globalScope.window.innerWidth, height: globalScope.window.innerHeight } };
      }
      const nodeScope = {};
      const res = safeWindowAccess(nodeScope);
      assert.strictEqual(res.isBrowser, false);
      assert.strictEqual(res.viewport.width, 0);
    }
  },
  {
    name: 'B01-T04: Zero-byte package.json / malformed json detection',
    fn: async () => {
      function safeParsePackage(raw) {
        if (!raw || raw.trim() === '') throw new Error('package.json is empty');
        try {
          return JSON.parse(raw);
        } catch {
          throw new Error('package.json contains malformed JSON');
        }
      }
      assert.throws(() => safeParsePackage(''), /package.json is empty/);
      assert.throws(() => safeParsePackage('{ invalid: json'), /malformed JSON/);
      assert.ok(safeParsePackage('{"name":"stockcontrol"}').name === 'stockcontrol');
    }
  },
  {
    name: 'B01-T05: Prerender route strictness flags dynamic route entries correctly',
    fn: async () => {
      function checkPrerenderConfig(config) {
        // Strict prerendering must not fail on dynamic SPA routes if fallback is configured
        if (config.strict && !config.fallback) {
          throw new Error('Prerender error: dynamic routes require fallback when strict: true');
        }
        return { ok: true };
      }
      assert.throws(() => checkPrerenderConfig({ strict: true, fallback: null }));
      assert.strictEqual(checkPrerenderConfig({ strict: false, fallback: 'index.html' }).ok, true);
    }
  }
];

if (require.main === module) {
  runDirectly('B01: Setup & Build Boundaries', tests);
}

module.exports = {
  id: 'B01',
  name: 'Setup & Build Boundaries',
  tests
};
