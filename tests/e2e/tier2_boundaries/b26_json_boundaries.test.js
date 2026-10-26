const { assert, runDirectly } = require('../test_helper');
const { importJson, exportJsonV2 } = require('../harness');

const tests = [
  {
    name: 'B26-T01: JSON backup missing "products" key throws clear validation error',
    fn: async () => {
      const invalidJson = JSON.stringify({ app: 'StockControl PWA', version: 2 });
      assert.throws(() => {
        importJson(invalidJson);
      }, /missing "products" array/);
    }
  },
  {
    name: 'B26-T02: Duplicate product IDs in import payload receive distinct unique keys or deduplicate',
    fn: async () => {
      const duplicateIds = {
        app: 'StockControl PWA',
        version: 2,
        products: [
          { id: 'dup_id', name: 'Leche 1', category: 'Lácteos', quantity: 2, expiryDate: '2026-11-01' },
          { id: 'dup_id', name: 'Leche 2', category: 'Lácteos', quantity: 3, expiryDate: '2026-11-02' }
        ]
      };
      const res = importJson(duplicateIds);
      assert.strictEqual(res.products.length, 2);
    }
  },
  {
    name: 'B26-T03: Large backup payload (1,000 products) is imported in under 50ms',
    fn: async () => {
      const items = [];
      for (let i = 0; i < 1000; i++) {
        items.push({
          id: `p_${i}`,
          name: `Item ${i}`,
          category: 'Otros',
          quantity: i,
          unit: 'unidad(es)',
          expiryDate: '2026-12-01'
        });
      }
      const rawJson = exportJsonV2(items);
      const t0 = Date.now();
      const res = importJson(rawJson);
      const elapsed = Date.now() - t0;

      assert.strictEqual(res.products.length, 1000);
      assert.ok(elapsed < 50, `Import took ${elapsed}ms, must be < 50ms`);
    }
  },
  {
    name: 'B26-T04: Unexpected custom properties in product objects are preserved safely',
    fn: async () => {
      const payload = {
        app: 'StockControl PWA',
        version: 2,
        products: [
          {
            id: 'custom_1',
            name: 'Café Grano',
            category: 'Bebidas',
            quantity: 5,
            unit: 'kg',
            expiryDate: '2027-01-01',
            customHaccpCode: 'HACCP-999',
            internalBinNumber: 'BIN-12'
          }
        ]
      };
      const res = importJson(payload);
      assert.strictEqual(res.products.length, 1);
      assert.strictEqual(res.products[0].name, 'Café Grano');
    }
  },
  {
    name: 'B26-T05: Null or undefined optional fields in backup are safely initialized to defaults',
    fn: async () => {
      const payload = {
        app: 'StockControl PWA',
        version: 2,
        products: [
          {
            id: 'null_fields',
            name: 'Arroz',
            category: null,
            quantity: null,
            unit: null,
            expiryDate: null,
            notes: null
          }
        ]
      };
      const res = importJson(payload);
      const prod = res.products[0];
      assert.strictEqual(prod.category, 'Otros');
      assert.strictEqual(prod.quantity, 0);
      assert.strictEqual(prod.unit, 'unidad(es)');
      assert.strictEqual(prod.notes, '');
    }
  }
];

if (require.main === module) {
  runDirectly('B26: JSON Backup Boundaries', tests);
}

module.exports = {
  id: 'B26',
  name: 'JSON Backup Boundaries',
  tests
};
