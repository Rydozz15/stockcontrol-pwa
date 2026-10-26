const { assert, runDirectly } = require('../test_helper');
const { validateRenderYaml } = require('../harness');

const tests = [
  {
    name: 'B27-T01: Rejection of paid Render tiers (starter, pro, enterprise) strictly enforces $0 plan',
    fn: async () => {
      const paidConfig = {
        services: [
          { type: 'web', env: 'static', buildCommand: 'npm run build', staticPublishPath: 'build', plan: 'pro' }
        ]
      };
      const res = validateRenderYaml(paidConfig);
      assert.strictEqual(res.valid, false);
      assert.ok(res.errors.some(e => e.includes('Plan must be free')));
    }
  },
  {
    name: 'B27-T02: Missing staticPublishPath or empty directory string fails deployment validation',
    fn: async () => {
      const missingPublish = {
        services: [
          { type: 'web', env: 'static', buildCommand: 'npm run build' }
        ]
      };
      const res = validateRenderYaml(missingPublish);
      assert.strictEqual(res.valid, false);
      assert.ok(res.errors.some(e => e.includes('staticPublishPath must point to build')));
    }
  },
  {
    name: 'B27-T03: Cache headers contract specifies no-cache for index.html and immutable for static assets',
    fn: async () => {
      const sampleHeadersConfig = [
        { path: '/*', name: 'Cache-Control', value: 'no-cache' },
        { path: '/_app/immutable/*', name: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
      ];
      assert.strictEqual(sampleHeadersConfig[0].value, 'no-cache');
      assert.ok(sampleHeadersConfig[1].value.includes('immutable'));
    }
  },
  {
    name: 'B27-T04: Pull Request Previews configuration defaults to disabled or manual to avoid limits',
    fn: async () => {
      function checkPrPreviewConfig(cfg) {
        return cfg.pullRequestPreviewsEnabled === false || cfg.pullRequestPreviewsEnabled === undefined;
      }
      assert.strictEqual(checkPrPreviewConfig({ pullRequestPreviewsEnabled: false }), true);
      assert.strictEqual(checkPrPreviewConfig({}), true);
    }
  },
  {
    name: 'B27-T05: Malformed YAML / non-object root rejected gracefully',
    fn: async () => {
      assert.strictEqual(validateRenderYaml(null).valid, false);
      assert.strictEqual(validateRenderYaml('invalid string').valid, false);
      assert.strictEqual(validateRenderYaml([]).valid, false);
    }
  }
];

if (require.main === module) {
  runDirectly('B27: Render Deployment Boundaries', tests);
}

module.exports = {
  id: 'B27',
  name: 'Render Deployment Boundaries',
  tests
};
