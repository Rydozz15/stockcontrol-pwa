const { assert, runDirectly } = require('../test_helper');
const { normalizeWorkspaceId } = require('../harness');

const tests = [
  {
    name: 'B07-T01: Path traversal attempts (../) in workspace code are strictly neutralized',
    fn: async () => {
      const malicious = '../../root/etc/passwd';
      const clean = normalizeWorkspaceId(malicious);
      assert.strictEqual(clean.includes('..'), false, 'Must not contain directory traversal sequences');
      assert.strictEqual(clean.includes('/'), false, 'Must not contain path separators');
    }
  },
  {
    name: 'B07-T02: Empty or whitespace-only workspace codes fall back to default cocina-principal',
    fn: async () => {
      assert.strictEqual(normalizeWorkspaceId(''), 'cocina-principal');
      assert.strictEqual(normalizeWorkspaceId('   '), 'cocina-principal');
      assert.strictEqual(normalizeWorkspaceId(null), 'cocina-principal');
    }
  },
  {
    name: 'B07-T03: Very long workspace code is handled safely without throwing',
    fn: async () => {
      const longCode = 'cocina-' + 'a'.repeat(200);
      const clean = normalizeWorkspaceId(longCode);
      assert.ok(clean.startsWith('cocina-'));
      assert.ok(clean.length > 50);
    }
  },
  {
    name: 'B07-T04: Accented and diacritic characters in kitchen names are normalized (Café -> cafe)',
    fn: async () => {
      assert.strictEqual(normalizeWorkspaceId('Café París & Bistró'), 'cafe-paris-bistro');
      assert.strictEqual(normalizeWorkspaceId('Ñuñoa Sede Central'), 'nunoa-sede-central');
    }
  },
  {
    name: 'B07-T05: Consecutive hyphens, underscores and symbols collapse into single hyphens',
    fn: async () => {
      assert.strictEqual(normalizeWorkspaceId('cocina----principal'), 'cocina-principal');
      assert.strictEqual(normalizeWorkspaceId('---test---'), 'test');
    }
  }
];

if (require.main === module) {
  runDirectly('B07: Workspace Sync Boundaries', tests);
}

module.exports = {
  id: 'B07',
  name: 'Workspace Sync Boundaries',
  tests
};
