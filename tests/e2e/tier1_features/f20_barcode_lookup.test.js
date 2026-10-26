const { assert, runDirectly } = require('../test_helper');
const { lookupBarcode, createProduct } = require('../harness');

const sampleProducts = [
  createProduct({
    id: 'prod_milk',
    name: 'Leche Colun Entera 1L',
    category: 'Lácteos',
    quantity: 12,
    unit: 'L',
    expiryDate: '2026-11-01',
    barcode: '7801234567890',
    lot: 'L-2026-A'
  }),
  createProduct({
    id: 'prod_meat',
    name: 'Lomo Liso Vacuno',
    category: 'Carnes',
    quantity: 5,
    unit: 'kg',
    expiryDate: '2026-10-29',
    barcode: '7809876543210'
  })
];

const tests = [
  {
    name: 'F20-T01: Scanning existing barcode finds the product in inventory',
    fn: async () => {
      const res = lookupBarcode('7801234567890', sampleProducts);
      assert.strictEqual(res.found, true);
      assert.strictEqual(res.product.name, 'Leche Colun Entera 1L');
    }
  },
  {
    name: 'F20-T02: Scanning existing lot number finds the product',
    fn: async () => {
      const res = lookupBarcode('L-2026-A', sampleProducts);
      assert.strictEqual(res.found, true);
      assert.strictEqual(res.product.id, 'prod_milk');
    }
  },
  {
    name: 'F20-T03: Scanning unknown barcode returns not found to allow prefill',
    fn: async () => {
      const res = lookupBarcode('9999999999999', sampleProducts);
      assert.strictEqual(res.found, false);
      assert.strictEqual(res.product, null);
    }
  },
  {
    name: 'F20-T04: Barcode lookup ignores discarded and consumed products',
    fn: async () => {
      const consumedProd = createProduct({
        id: 'prod_old',
        name: 'Yogurt Antiguo',
        category: 'Lácteos',
        quantity: 0,
        unit: 'unidad(es)',
        expiryDate: '2026-10-01',
        barcode: '1112223334445',
        isConsumed: true
      });
      const list = [...sampleProducts, consumedProd];
      const res = lookupBarcode('1112223334445', list);
      assert.strictEqual(res.found, false);
    }
  },
  {
    name: 'F20-T05: Lookup handles spaces and case-insensitivity',
    fn: async () => {
      const res = lookupBarcode('  l-2026-a  ', sampleProducts);
      assert.strictEqual(res.found, true);
      assert.strictEqual(res.product.id, 'prod_milk');
    }
  }
];

if (require.main === module) {
  runDirectly('F20: Instant Barcode Lookup & Preload', tests);
}

module.exports = {
  id: 'F20',
  name: 'Instant Barcode Lookup & Preload',
  tests
};
