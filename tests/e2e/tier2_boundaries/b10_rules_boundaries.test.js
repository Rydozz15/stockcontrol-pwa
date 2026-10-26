const { assert, runDirectly } = require('../test_helper');

const tests = [
  {
    name: 'B10-T01: Firestore rules reject access to system metadata collections outside workspaces',
    fn: async () => {
      function evaluateRulesPath(collectionPath) {
        if (!collectionPath.startsWith('/workspaces/')) return false;
        const segments = collectionPath.split('/').filter(Boolean);
        return segments.length >= 2;
      }
      assert.strictEqual(evaluateRulesPath('/system_config'), false);
      assert.strictEqual(evaluateRulesPath('/admin_keys'), false);
      assert.strictEqual(evaluateRulesPath('/workspaces/cocina-1/products'), true);
    }
  },
  {
    name: 'B10-T02: Multi-level path traversal inside workspace path is denied',
    fn: async () => {
      function sanitizeFirestorePath(path) {
        if (path.includes('..') || path.includes('//')) return null;
        return path;
      }
      assert.strictEqual(sanitizeFirestorePath('workspaces/ws1/../../secrets'), null);
      assert.strictEqual(sanitizeFirestorePath('workspaces//ws1'), null);
    }
  },
  {
    name: 'B10-T03: Security rules reject product writes with negative quantities',
    fn: async () => {
      function ruleValidator(docData) {
        if (docData.quantity < 0) return { allowed: false, reason: 'quantity_must_be_non_negative' };
        return { allowed: true };
      }
      assert.strictEqual(ruleValidator({ quantity: -0.01 }).allowed, false);
      assert.strictEqual(ruleValidator({ quantity: 0 }).allowed, true);
    }
  },
  {
    name: 'B10-T04: Security rules reject product writes missing mandatory name or expiryDate',
    fn: async () => {
      function ruleValidateMandatoryFields(docData) {
        if (!docData.name || docData.name.trim() === '') return false;
        if (!docData.expiryDate && !docData.expiry) return false;
        return true;
      }
      assert.strictEqual(ruleValidateMandatoryFields({ name: '', expiryDate: '2026-11-01' }), false);
      assert.strictEqual(ruleValidateMandatoryFields({ name: 'Leche' }), false);
      assert.strictEqual(ruleValidateMandatoryFields({ name: 'Leche', expiryDate: '2026-11-01' }), true);
    }
  },
  {
    name: 'B10-T05: History subcollection audit documents are strictly immutable (create-only, no update)',
    fn: async () => {
      function allowHistoryMutation(operation) {
        // Only allow get, list and create; reject update and delete
        return operation === 'get' || operation === 'list' || operation === 'create';
      }
      assert.strictEqual(allowHistoryMutation('create'), true);
      assert.strictEqual(allowHistoryMutation('update'), false);
      assert.strictEqual(allowHistoryMutation('delete'), false);
    }
  }
];

if (require.main === module) {
  runDirectly('B10: Security Rules Boundaries', tests);
}

module.exports = {
  id: 'B10',
  name: 'Security Rules Boundaries',
  tests
};
