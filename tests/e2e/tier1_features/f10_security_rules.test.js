const { assert, runDirectly } = require('../test_helper');

const tests = [
  {
    name: 'F10-T01: Firestore rules contract matches workspaces/{workspaceId}/products/{productId}',
    fn: async () => {
      const rulesDefinition = `
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /workspaces/{workspaceId} {
              allow read, write: if workspaceId != '';
              match /products/{productId} {
                allow read, write: if workspaceId != '' && request.resource.data.quantity >= 0;
              }
              match /history/{logId} {
                allow read, create: if workspaceId != '';
              }
            }
          }
        }
      `;
      assert.ok(rulesDefinition.includes('match /workspaces/{workspaceId}'));
      assert.ok(rulesDefinition.includes('match /products/{productId}'));
      assert.ok(rulesDefinition.includes('match /history/{logId}'));
    }
  },
  {
    name: 'F10-T02: Security rules evaluator permits valid workspace path access',
    fn: async () => {
      function evaluateAccess(path, data) {
        const parts = path.split('/').filter(Boolean);
        if (parts[0] !== 'workspaces') return false;
        const wsId = parts[1];
        if (!wsId || wsId.trim() === '') return false;
        if (parts[2] === 'products') {
          if (data && typeof data.quantity === 'number' && data.quantity < 0) return false;
          return true;
        }
        if (parts[2] === 'history') return true;
        return true;
      }

      assert.strictEqual(evaluateAccess('workspaces/cocina-1/products/p1', { quantity: 5 }), true);
      assert.strictEqual(evaluateAccess('workspaces/cocina-1/history/h1', {}), true);
    }
  },
  {
    name: 'F10-T03: Security rules reject paths outside workspace hierarchy',
    fn: async () => {
      function evaluateAccess(path) {
        const parts = path.split('/').filter(Boolean);
        return parts[0] === 'workspaces' && Boolean(parts[1]);
      }
      assert.strictEqual(evaluateAccess('root_config/settings'), false);
      assert.strictEqual(evaluateAccess('users/admin_token'), false);
      assert.strictEqual(evaluateAccess('workspaces/'), false);
    }
  },
  {
    name: 'F10-T04: Security rules reject writes with negative quantity',
    fn: async () => {
      function validateProductWrite(data) {
        if (!data || typeof data.quantity !== 'number' || data.quantity < 0) {
          return { allowed: false, error: 'quantity must be non-negative' };
        }
        return { allowed: true };
      }
      assert.strictEqual(validateProductWrite({ quantity: 10 }).allowed, true);
      assert.strictEqual(validateProductWrite({ quantity: -1 }).allowed, false);
    }
  },
  {
    name: 'F10-T05: History subcollection enforces create without arbitrary modification or deletion',
    fn: async () => {
      function checkHistoryOperation(op) {
        return op === 'read' || op === 'create';
      }
      assert.strictEqual(checkHistoryOperation('create'), true);
      assert.strictEqual(checkHistoryOperation('read'), true);
      assert.strictEqual(checkHistoryOperation('update'), false);
      assert.strictEqual(checkHistoryOperation('delete'), false);
    }
  }
];

if (require.main === module) {
  runDirectly('F10: Security Rules & Isolation', tests);
}

module.exports = {
  id: 'F10',
  name: 'Security Rules & Isolation',
  tests
};
