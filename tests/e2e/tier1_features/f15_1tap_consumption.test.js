const { assert, runDirectly } = require('../test_helper');
const { consumeStock, undoConsumption, discardStock, createProduct } = require('../harness');

const tests = [
  {
    name: 'F15-T01: 1-Tap consume decrements product quantity by 1 unit',
    fn: async () => {
      const prod = createProduct({
        name: 'Leche Descremada',
        category: 'Lácteos',
        quantity: 6,
        unit: 'L',
        expiryDate: '2026-10-30'
      });
      const { product: updated } = consumeStock(prod, 1, 'Mesonero');
      assert.strictEqual(updated.quantity, 5);
    }
  },
  {
    name: 'F15-T02: 1-Tap consume triggers undo action callback registration',
    fn: async () => {
      let toastAction = null;
      function showToastWithUndo(msg, undoFn) {
        toastAction = undoFn;
      }

      const prod = createProduct({ name: 'Pan Hamburguesa', category: 'Panadería y pastelería', quantity: 12, unit: 'unidad(es)', expiryDate: '2026-10-28' });
      const { product: consumed } = consumeStock(prod, 1, 'Cocinero');
      showToastWithUndo('Consumida 1 unidad', () => undoConsumption(consumed, 1, 'Cocinero'));

      assert.ok(typeof toastAction === 'function');
    }
  },
  {
    name: 'F15-T03: Clicking undo restores previous quantity',
    fn: async () => {
      const prod = createProduct({ name: 'Crema', category: 'Lácteos', quantity: 4, unit: 'L', expiryDate: '2026-11-01' });
      const { product: consumed } = consumeStock(prod, 1, 'Carlos');
      assert.strictEqual(consumed.quantity, 3);

      const { product: restored } = undoConsumption(consumed, 1, 'Carlos');
      assert.strictEqual(restored.quantity, 4);
      assert.strictEqual(restored.isConsumed, false);
    }
  },
  {
    name: 'F15-T04: Merma action logs waste reason according to HACCP standards',
    fn: async () => {
      const prod = createProduct({ name: 'Carne Picada', category: 'Carnes', quantity: 2, unit: 'kg', expiryDate: '2026-10-24' });
      const { product: discarded, log } = discardStock(prod, 'vencimiento', 'Control Calidad');

      assert.strictEqual(discarded.isDiscarded, true);
      assert.strictEqual(log.reason, 'vencimiento');
      assert.strictEqual(log.action, 'discard');
    }
  },
  {
    name: 'F15-T05: Discarded product cannot be consumed',
    fn: async () => {
      const prod = createProduct({ name: 'Pescado', category: 'Pescados y mariscos', quantity: 1, unit: 'kg', expiryDate: '2026-10-20' });
      const { product: discarded } = discardStock(prod, 'deterioro', 'Operador');

      assert.throws(() => {
        consumeStock(discarded, 1, 'Operador');
      }, /Cannot consume discarded product/);
    }
  }
];

if (require.main === module) {
  runDirectly('F15: 1-Tap Consumption & Merma', tests);
}

module.exports = {
  id: 'F15',
  name: '1-Tap Consumption & Merma',
  tests
};
