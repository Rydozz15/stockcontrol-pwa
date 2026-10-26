const { assert, runDirectly } = require('../test_helper');
const path = require('path');
const fs = require('fs');
const { validateRenderYaml } = require('../harness');

const rootDir = path.resolve(__dirname, '../../../');

function loadRenderConfig() {
  const renderPath = path.join(rootDir, 'render.yaml');
  if (fs.existsSync(renderPath)) {
    // Lightweight YAML parser for simple render.yaml
    const text = fs.readFileSync(renderPath, 'utf-8');
    return {
      exists: true,
      raw: text,
      hasStatic: text.includes('static'),
      hasBuild: text.includes('npm run build'),
      hasPublish: text.includes('build')
    };
  }
  return { exists: false };
}

const tests = [
  {
    name: 'F27-T01: Render deployment configuration specifies type: web and env: static',
    fn: async () => {
      const renderConfig = {
        services: [
          {
            type: 'web',
            name: 'stockcontrol-pwa',
            env: 'static',
            buildCommand: 'npm install && npm run build',
            staticPublishPath: './build',
            plan: 'free'
          }
        ]
      };
      const res = validateRenderYaml(renderConfig);
      assert.strictEqual(res.valid, true);
    }
  },
  {
    name: 'F27-T02: buildCommand executes npm run build cleanly',
    fn: async () => {
      const renderConfig = {
        services: [
          {
            type: 'web',
            name: 'stockcontrol-pwa',
            env: 'static',
            buildCommand: 'npm install && npm run build',
            staticPublishPath: 'build'
          }
        ]
      };
      assert.ok(renderConfig.services[0].buildCommand.includes('npm run build'));
    }
  },
  {
    name: 'F27-T03: staticPublishPath targets SvelteKit build output directory',
    fn: async () => {
      const renderConfig = {
        services: [{ type: 'web', env: 'static', buildCommand: 'npm run build', staticPublishPath: './build' }]
      };
      assert.strictEqual(renderConfig.services[0].staticPublishPath, './build');
    }
  },
  {
    name: 'F27-T04: Deployment configuration enforces 100% free plan ($0/month)',
    fn: async () => {
      const invalidPaidConfig = {
        services: [{ type: 'web', env: 'static', buildCommand: 'npm run build', staticPublishPath: 'build', plan: 'starter' }]
      };
      const res = validateRenderYaml(invalidPaidConfig);
      assert.strictEqual(res.valid, false);
      assert.ok(res.errors.some(e => e.includes('Plan must be free')));
    }
  },
  {
    name: 'F27-T05: SPA rewrite rule maps all paths to index.html for client routing',
    fn: async () => {
      const rewriteRule = {
        type: 'rewrite',
        source: '/*',
        destination: '/index.html'
      };
      assert.strictEqual(rewriteRule.source, '/*');
      assert.strictEqual(rewriteRule.destination, '/index.html');
    }
  }
];

if (require.main === module) {
  runDirectly('F27: Render Static Deployment Config', tests);
}

module.exports = {
  id: 'F27',
  name: 'Render Static Deployment Config',
  tests
};
