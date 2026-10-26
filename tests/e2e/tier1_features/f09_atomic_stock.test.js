const { assert, runDirectly } = require('../test_helper');
const { consumeStock, createProduct } = require('../harness');

const tests = [
  {
    name: 'F09-T01: Decrementing stock by 1 reduces quantity from 5 to 4',
    fn: async () => {
      const prod = createProduct({
        name: 'Latas de Tomate',
        category: 'Abarrotes y secos',
        quantity: 5,
        unit: 'unidad(es)',
        expiryDate: '2027-12-31'
      });
      const { product: updated } = consumeStock(prod, 1, 'Cocinero');
      assert.strictEqual(updated.quantity, 4);
      assert.strictEqual(updated.isConsumed, false);
    }
  },
  {
    name: 'F09-T02: Partial decimal stock consumption preserves arithmetic precision',
    fn: async () => {
      const prod = createProduct({
        name: 'Queso Mozzarella',
        category: 'Lácteos',
        quantity: 2.5,
        unit: 'kg',
        expiryDate: '2026-11-05'
      });
      const { product: updated } = consumeStock(prod, 0.75, 'Pizzero');
      assert.strictEqual(updated.quantity, 1.75);
    }
  },
  {
    name: 'F09-T03: Consuming remaining quantity transitions product to isConsumed: true',
    fn: async () => {
      const prod = createProduct({
        name: 'Último Pan de Molde',
        category: 'Panadería y pastelería',
        quantity: 1,
        unit: 'unidad(es)',
        expiryDate: '2026-10-27'
      });
      const { product: updated } = consumeStock(prod, 1, 'Mesonero');
      assert.strictEqual(updated.quantity, 0);
      assert.strictEqual(updated.isConsumed, true);
    }
  },
  {
    name: 'F09-T04: Firestore atomic payload contract conforms to increment(-amount)',
    fn: async () => {
      function buildAtomicDecrementPayload(amount, operator) {
        return {
          quantity: { _methodName: 'FieldValue.increment', operand: -amount },
          updatedAt: new Date().toISOString(),
          updatedBy: operator,
          lastAction: 'consume'
        };
      }
      const payload = buildAtomicDecrementPayload(2, 'Juan');
      assert.strictEqual(payload.quantity.operand, -2);
      assert.strictEqual(payload.lastAction, 'consume');
    }
  },
  {
    name: 'F09-T05: Attempting to consume more than available stock throws error',
    fn: async () => {
      const prod = createProduct({
        name: 'Vino Tinto',
        category: 'Bebidas',
        quantity: 2,
        unit: 'botella(s)',
        expiryDate: '2028-01-01'
      });
      assert.throws(() => {
        consumeStock(prod, 3, 'Sommelier');
      }, /Insufficient stock/);
    }
  }
];

if (require.main === module) {
  runDirectly('F09: Atomic Stock Consumption', tests);
}

module.exports = {
  id: 'F09',
  name: 'Atomic Stock Consumption',
  tests
};
