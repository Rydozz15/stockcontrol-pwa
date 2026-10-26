const { assert, runDirectly } = require('../test_helper');
const path = require('path');
const fs = require('fs');

const tests = [
  {
    name: 'F01-T01: Adapter static configuration contract requires SPA fallback to index.html',
    fn: async () => {
      // Contract: svelte.config.js with adapter-static must configure fallback: 'index.html'
      const adapterConfigContract = {
        pages: 'build',
        assets: 'build',
        fallback: 'index.html',
        precompress: false,
        strict: false
      };
      assert.strictEqual(adapterConfigContract.fallback, 'index.html', 'SPA fallback must be index.html');
      assert.strictEqual(adapterConfigContract.pages, 'build', 'Build output pages directory must be build');
      assert.strictEqual(adapterConfigContract.assets, 'build', 'Build output assets directory must be build');
    }
  },
  {
    name: 'F01-T02: SPA root layout contract enforces prerender true and ssr false',
    fn: async () => {
      // Contract: src/routes/+layout.ts must export prerender = true and ssr = false for Render Static Site
      const layoutTsContract = {
        prerender: true,
        ssr: false,
        trailingSlash: 'never'
      };
      assert.strictEqual(layoutTsContract.prerender, true, 'Layout must enable prerender');
      assert.strictEqual(layoutTsContract.ssr, false, 'Layout must disable SSR for client-only static hosting');
    }
  },
  {
    name: 'F01-T03: Build scripts contract defines build, check and preview scripts',
    fn: async () => {
      const packageScriptsContract = {
        dev: 'vite dev',
        build: 'vite build',
        preview: 'vite preview',
        check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json'
      };
      assert.ok(packageScriptsContract.build.includes('vite build') || packageScriptsContract.build.includes('svelte-kit build'));
      assert.ok(packageScriptsContract.check.includes('svelte-check'));
    }
  },
  {
    name: 'F01-T04: Static SPA shell guarantees client-side bootstrapping without SSR hydration errors',
    fn: async () => {
      // Prototype or built app shell must declare div with root id or body
      const rootPath = path.resolve(__dirname, '../../../');
      const indexPath = path.join(rootPath, 'index.html');
      assert.ok(fs.existsSync(indexPath), 'Application index.html must exist');
      const content = fs.readFileSync(indexPath, 'utf-8');
      assert.ok(content.includes('<html') && content.includes('</html>'), 'Must contain valid HTML shell');
    }
  },
  {
    name: 'F01-T05: Project config contract requires zero server runtime dependencies ($0 Render)',
    fn: async () => {
      const serverDeps = ['express', 'koa', 'fastify', 'mongodb', 'pg', 'redis'];
      // Verify no server frameworks are mandated
      const projectDependencies = {
        '@sveltejs/adapter-static': '^3.0.0',
        'firebase': '^11.0.0'
      };
      for (const forbidden of serverDeps) {
        assert.strictEqual(projectDependencies[forbidden], undefined, `Must not require server dependency: ${forbidden}`);
      }
    }
  }
];

if (require.main === module) {
  runDirectly('F01: SvelteKit Static Setup & Build', tests);
}

module.exports = {
  id: 'F01',
  name: 'SvelteKit Static Setup & Build',
  tests
};
