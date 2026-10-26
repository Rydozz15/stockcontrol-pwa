const { assert, runDirectly } = require('../test_helper');
const { InMemoryWorkspaceRepository } = require('../harness');

const tests = [
  {
    name: "B08-T01: Operator alias containing apostrophes and symbols (O'Connor & Sons) is preserved",
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const id = await repo.createProduct('cocina-audit', {
        name: 'Vino Blanco',
        category: 'Bebidas',
        quantity: 6,
        unit: 'botella(s)',
        expiryDate: '2027-12-01'
      }, "Chef O'Connor & Sons");

      const logs = repo.getHistory('cocina-audit');
      assert.strictEqual(logs[0].operator, "Chef O'Connor & Sons");
    }
  },
  {
    name: 'B08-T02: Empty operator alias defaults safely to Operador',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const id = await repo.createProduct('cocina-audit', {
        name: 'Azúcar',
        category: 'Abarrotes y secos',
        quantity: 10,
        unit: 'kg',
        expiryDate: '2028-01-01'
      }, '   ');

      const logs = repo.getHistory('cocina-audit');
      assert.strictEqual(logs[0].operator, 'Operador');
    }
  },
  {
    name: 'B08-T03: createdAt timestamp remains immutable across multiple updates',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const id = await repo.createProduct('cocina-audit', {
        name: 'Aceite',
        category: 'Abarrotes y secos',
        quantity: 2,
        unit: 'L',
        expiryDate: '2027-01-01'
      }, 'Operador 1');

      const initialProd = Array.from(repo._getWorkspaceMap('cocina-audit').values()).find(p => p.id === id);
      const originalCreatedAt = initialProd.createdAt;

      await new Promise(r => setTimeout(r, 10));
      await repo.updateProduct('cocina-audit', id, { quantity: 1 }, 'Operador 2');

      const updatedProd = Array.from(repo._getWorkspaceMap('cocina-audit').values()).find(p => p.id === id);
      assert.strictEqual(updatedProd.createdAt, originalCreatedAt, 'createdAt must not be mutated');
      assert.notStrictEqual(updatedProd.updatedAt, originalCreatedAt);
    }
  },
  {
    name: 'B08-T04: Consecutive audit logs maintain non-decreasing chronological order',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const id = await repo.createProduct('cocina-audit', {
        name: 'Harina',
        category: 'Abarrotes y secos',
        quantity: 20,
        unit: 'kg',
        expiryDate: '2027-01-01'
      }, 'Op1');

      await repo.consumeStock('cocina-audit', id, 2, 'Op2');
      await repo.consumeStock('cocina-audit', id, 3, 'Op3');

      const history = repo.getHistory('cocina-audit', 10);
      assert.strictEqual(history.length, 3);
      // History is returned newest first
      const tNewest = new Date(history[0].timestamp).getTime();
      const tMiddle = new Date(history[1].timestamp).getTime();
      const tOldest = new Date(history[2].timestamp).getTime();
      assert.ok(tNewest >= tMiddle);
      assert.ok(tMiddle >= tOldest);
    }
  },
  {
    name: 'B08-T05: Very long operator name (150 chars) is accepted without truncating crash',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const longOp = 'Chef Ejecutivo Juan Carlos Martinez de la Vega y Cordoba - Estacion Central';
      const id = await repo.createProduct('cocina-audit', {
        name: 'Pimienta Negra',
        category: 'Abarrotes y secos',
        quantity: 1,
        unit: 'kg',
        expiryDate: '2028-01-01'
      }, longOp);

      const logs = repo.getHistory('cocina-audit');
      assert.strictEqual(logs[0].operator, longOp);
    }
  }
];

if (require.main === module) {
  runDirectly('B08: Operator Audit Boundaries', tests);
}

module.exports = {
  id: 'B08',
  name: 'Operator Audit Boundaries',
  tests
};
