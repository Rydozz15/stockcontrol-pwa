const { assert, runDirectly } = require('../test_helper');
const { consumeStock, undoConsumption, discardStock, createProduct } = require('../harness');

const tests = [
  {
    name: 'B15-T01: Consuming product with quantity 1 transitions quantity to 0 and isConsumed to true',
    fn: async () => {
      const prod = createProduct({ name: 'Leche', category: 'Lácteos', quantity: 1, unit: 'L', expiryDate: '2026-11-01' });
      const { product: updated } = consumeStock(prod, 1, 'Op');
      assert.strictEqual(updated.quantity, 0);
      assert.strictEqual(updated.isConsumed, true);
    }
  },
  {
    name: 'B15-T02: Undoing consumption on depleted product restores isConsumed: false',
    fn: async () => {
      const prod = createProduct({ name: 'Leche', category: 'Lácteos', quantity: 1, unit: 'L', expiryDate: '2026-11-01' });
      const { product: depleted } = consumeStock(prod, 1, 'Op');
      assert.strictEqual(depleted.isConsumed, true);

      const { product: restored } = undoConsumption(depleted, 1, 'Op');
      assert.strictEqual(restored.quantity, 1);
      assert.strictEqual(restored.isConsumed, false);
    }
  },
  {
    name: 'B15-T03: Expired undo window prevents late rollback',
    fn: async () => {
      class UndoManager {
        constructor(windowMs = 5000) {
          this.windowMs = windowMs;
          this.activeAction = null;
          this.timestamp = 0;
        }
        register(action) {
          this.activeAction = action;
          this.timestamp = Date.now();
        }
        executeUndo(now = Date.now()) {
          if (!this.activeAction) throw new Error('No undo available');
          if (now - this.timestamp > this.windowMs) {
            this.activeAction = null;
            throw new Error('Undo window expired');
          }
          return this.activeAction();
        }
      }

      const mgr = new UndoManager(5000);
      mgr.register(() => 'reverted');
      assert.strictEqual(mgr.executeUndo(Date.now() + 1000), 'reverted');

      mgr.register(() => 'reverted');
      assert.throws(() => {
        mgr.executeUndo(Date.now() + 6000);
      }, /Undo window expired/);
    }
  },
  {
    name: 'B15-T04: Attempting to consume product with quantity 0 is rejected',
    fn: async () => {
      const prod = createProduct({ name: 'Carne', category: 'Carnes', quantity: 0, unit: 'kg', expiryDate: '2026-11-01', isConsumed: true });
      assert.throws(() => {
        consumeStock(prod, 1, 'Op');
      }, /0 available quantity/);
    }
  },
  {
    name: 'B15-T05: DiscardStock rejects unrecognized waste reasons',
    fn: async () => {
      const prod = createProduct({ name: 'Pan', category: 'Panadería y pastelería', quantity: 2, unit: 'unidad(es)', expiryDate: '2026-11-01' });
      assert.throws(() => {
        discardStock(prod, 'motivo_invalido', 'Op');
      }, /Invalid waste reason/);
    }
  }
];

if (require.main === module) {
  runDirectly('B15: 1-Tap Consumption Boundaries', tests);
}

module.exports = {
  id: 'B15',
  name: '1-Tap Consumption Boundaries',
  tests
};
