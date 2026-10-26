const { assert, runDirectly } = require('../test_helper');
const { consumeStock, createProduct, safeSubtract } = require('../harness');

const tests = [
  {
    name: 'B09-T01: Zero consumption amount is rejected as a no-op / invalid argument',
    fn: async () => {
      const prod = createProduct({ name: 'Carne', category: 'Carnes', quantity: 5, unit: 'kg', expiryDate: '2026-11-01' });
      assert.throws(() => {
        consumeStock(prod, 0, 'Cocinero');
      }, /Invalid consumption amount/);
    }
  },
  {
    name: 'B09-T02: Negative consumption amount (attempting cheat stock increase) is strictly rejected',
    fn: async () => {
      const prod = createProduct({ name: 'Carne', category: 'Carnes', quantity: 5, unit: 'kg', expiryDate: '2026-11-01' });
      assert.throws(() => {
        consumeStock(prod, -2, 'Hacker');
      }, /Invalid consumption amount/);
    }
  },
  {
    name: 'B09-T03: IEEE 754 floating point subtraction precision (0.3 - 0.1 strictly equals 0.2)',
    fn: async () => {
      const result = safeSubtract(0.3, 0.1);
      assert.strictEqual(result, 0.2, 'Must not be 0.19999999999999998');

      const prod = createProduct({ name: 'Azafrán', category: 'Abarrotes y secos', quantity: 0.3, unit: 'kg', expiryDate: '2027-01-01' });
      const { product: updated } = consumeStock(prod, 0.1, 'Cocinero');
      assert.strictEqual(updated.quantity, 0.2);
    }
  },
  {
    name: 'B09-T04: Second consecutive consumption when stock is depleted is rejected',
    fn: async () => {
      const prod = createProduct({ name: 'Leche', category: 'Lácteos', quantity: 1, unit: 'L', expiryDate: '2026-11-01' });
      const { product: updated1 } = consumeStock(prod, 1, 'Op1');
      assert.strictEqual(updated1.quantity, 0);
      assert.strictEqual(updated1.isConsumed, true);

      assert.throws(() => {
        consumeStock(updated1, 1, 'Op2');
      }, /0 available quantity/);
    }
  },
  {
    name: 'B09-T05: Consuming 0.00001 more than stock is rejected',
    fn: async () => {
      const prod = createProduct({ name: 'Queso', category: 'Lácteos', quantity: 2.0, unit: 'kg', expiryDate: '2026-11-01' });
      assert.throws(() => {
        consumeStock(prod, 2.0001, 'Op');
      }, /Insufficient stock/);
    }
  }
];

if (require.main === module) {
  runDirectly('B09: Atomic Consumption Boundaries', tests);
}

module.exports = {
  id: 'B09',
  name: 'Atomic Consumption Boundaries',
  tests
};
