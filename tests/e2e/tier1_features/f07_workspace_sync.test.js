const { assert, runDirectly } = require('../test_helper');
const { normalizeWorkspaceId, InMemoryWorkspaceRepository } = require('../harness');

const tests = [
  {
    name: 'F07-T01: normalizeWorkspaceId cleans whitespace, accents and special characters',
    fn: async () => {
      assert.strictEqual(normalizeWorkspaceId('  Cocina Central  '), 'cocina-central');
      assert.strictEqual(normalizeWorkspaceId('Sucursal #2 (Norte)'), 'sucursal-2-norte');
      assert.strictEqual(normalizeWorkspaceId(''), 'cocina-principal');
    }
  },
  {
    name: 'F07-T02: Workspace subcollection path derivation conforms to Firestore hierarchy',
    fn: async () => {
      function getWorkspaceCollectionPath(wsId) {
        return `workspaces/${normalizeWorkspaceId(wsId)}/products`;
      }
      assert.strictEqual(getWorkspaceCollectionPath('cocina-1'), 'workspaces/cocina-1/products');
      assert.strictEqual(getWorkspaceCollectionPath('Bodega Principal'), 'workspaces/bodega-principal/products');
    }
  },
  {
    name: 'F07-T03: subscribeProducts listener receives updated inventory on product creation',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      let receivedProducts = null;

      const unsub = repo.subscribeProducts('cocina-sur', (products) => {
        receivedProducts = products;
      });

      assert.strictEqual(receivedProducts.length, 0);

      await repo.createProduct('cocina-sur', {
        name: 'Mantequilla',
        category: 'Lácteos',
        quantity: 10,
        unit: 'unidad(es)',
        expiryDate: '2026-11-20'
      }, 'Juan - Cocinero');

      assert.strictEqual(receivedProducts.length, 1);
      assert.strictEqual(receivedProducts[0].name, 'Mantequilla');
      unsub();
    }
  },
  {
    name: 'F07-T04: Multi-tenant workspace data isolation guarantees zero cross-talk',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      let productsA = [];
      let productsB = [];

      const unsubA = repo.subscribeProducts('workspace-alpha', p => { productsA = p; });
      const unsubB = repo.subscribeProducts('workspace-beta', p => { productsB = p; });

      await repo.createProduct('workspace-alpha', {
        name: 'Salmón Premium',
        category: 'Pescados y mariscos',
        quantity: 5,
        unit: 'kg',
        expiryDate: '2026-10-30'
      }, 'Chef Alpha');

      assert.strictEqual(productsA.length, 1);
      assert.strictEqual(productsB.length, 0, 'Workspace Beta must not receive Alpha products');

      unsubA();
      unsubB();
    }
  },
  {
    name: 'F07-T05: Multiple concurrent subscribers to same workspace receive synchronized snapshots',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      let device1Count = 0;
      let device2Count = 0;

      const unsub1 = repo.subscribeProducts('cocina-central', p => { device1Count = p.length; });
      const unsub2 = repo.subscribeProducts('cocina-central', p => { device2Count = p.length; });

      await repo.createProduct('cocina-central', {
        name: 'Harina 000',
        category: 'Abarrotes y secos',
        quantity: 25,
        unit: 'kg',
        expiryDate: '2027-01-15'
      }, 'Operador');

      assert.strictEqual(device1Count, 1);
      assert.strictEqual(device2Count, 1);

      unsub1();
      unsub2();
    }
  }
];

if (require.main === module) {
  runDirectly('F07: Multi-Tenant Workspace Sync', tests);
}

module.exports = {
  id: 'F07',
  name: 'Multi-Tenant Workspace Sync',
  tests
};
