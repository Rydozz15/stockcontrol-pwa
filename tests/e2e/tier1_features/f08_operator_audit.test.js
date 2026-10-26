const { assert, runDirectly } = require('../test_helper');
const { InMemoryWorkspaceRepository } = require('../harness');

const tests = [
  {
    name: 'F08-T01: Product creation automatically attaches createdBy and createdAt timestamp',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const id = await repo.createProduct('cocina-1', {
        name: 'Aceite de Oliva',
        category: 'Abarrotes y secos',
        quantity: 5,
        unit: 'L',
        expiryDate: '2027-06-01'
      }, 'Marta - Bodega');

      const logs = repo.getHistory('cocina-1');
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].operator, 'Marta - Bodega');
      assert.strictEqual(logs[0].action, 'create');
      assert.ok(logs[0].timestamp);
    }
  },
  {
    name: 'F08-T02: Product modification stamps updatedBy and new updatedAt timestamp',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const id = await repo.createProduct('cocina-1', {
        name: 'Huevos',
        category: 'Otros',
        quantity: 30,
        unit: 'unidad(es)',
        expiryDate: '2026-11-15'
      }, 'Juan - Cocinero');

      await repo.updateProduct('cocina-1', id, { quantity: 24 }, 'Elena - Supervisora');
      const products = Array.from(repo._getWorkspaceMap('cocina-1').values());
      const prod = products.find(p => p.id === id);

      assert.strictEqual(prod.createdBy, 'Juan - Cocinero');
      assert.strictEqual(prod.updatedBy, 'Elena - Supervisora');
      assert.strictEqual(prod.lastAction, 'update');
    }
  },
  {
    name: 'F08-T03: Stock consumption creates audit log entry with operator and amount consumed',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const id = await repo.createProduct('cocina-1', {
        name: 'Carne Vacuno',
        category: 'Carnes',
        quantity: 10,
        unit: 'kg',
        expiryDate: '2026-10-28'
      }, 'Operador');

      const log = await repo.consumeStock('cocina-1', id, 2.5, 'Carlos - Parrilla', 'Cena servicio');
      assert.strictEqual(log.action, 'consume');
      assert.strictEqual(log.operator, 'Carlos - Parrilla');
      assert.strictEqual(log.amount, 2.5);
    }
  },
  {
    name: 'F08-T04: Stock discard creates audit log entry with operator and HACCP waste reason',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const id = await repo.createProduct('cocina-1', {
        name: 'Crema de Leche',
        category: 'Lácteos',
        quantity: 2,
        unit: 'L',
        expiryDate: '2026-10-20'
      }, 'Operador');

      const log = await repo.discardStock('cocina-1', id, 'vencimiento', 'Marta - Control Calidad');
      assert.strictEqual(log.action, 'discard');
      assert.strictEqual(log.operator, 'Marta - Control Calidad');
      assert.strictEqual(log.reason, 'vencimiento');
    }
  },
  {
    name: 'F08-T05: Operator alias handles whitespace trimming and default fallback',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const id1 = await repo.createProduct('cocina-1', {
        name: 'Sal',
        category: 'Abarrotes y secos',
        quantity: 1,
        unit: 'kg',
        expiryDate: '2028-01-01'
      }, '  Juan Perez  ');

      const prod1 = Array.from(repo._getWorkspaceMap('cocina-1').values()).find(p => p.id === id1);
      assert.strictEqual(prod1.createdBy, 'Juan Perez');

      const id2 = await repo.createProduct('cocina-1', {
        name: 'Pimienta',
        category: 'Abarrotes y secos',
        quantity: 1,
        unit: 'kg',
        expiryDate: '2028-01-01'
      }, '');
      const prod2 = Array.from(repo._getWorkspaceMap('cocina-1').values()).find(p => p.id === id2);
      assert.strictEqual(prod2.createdBy, 'Operador');
    }
  }
];

if (require.main === module) {
  runDirectly('F08: Operator Audit Stamp', tests);
}

module.exports = {
  id: 'F08',
  name: 'Operator Audit Stamp',
  tests
};
