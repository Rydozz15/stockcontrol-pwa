const { assert, runDirectly } = require('../test_helper');
const { lookupBarcode, createProduct } = require('../harness');

const tests = [
  {
    name: 'B20-T01: Barcode with leading zero (e.g. 0123456789012) preserves leading zero string identity',
    fn: async () => {
      const prod = createProduct({
        name: 'Salsa Inglesa',
        category: 'Salsas y aderezos',
        quantity: 2,
        unit: 'botella(s)',
        expiryDate: '2027-05-01',
        barcode: '0123456789012'
      });
      const res = lookupBarcode('0123456789012', [prod]);
      assert.strictEqual(res.found, true);
      assert.strictEqual(res.product.barcode, '0123456789012');
    }
  },
  {
    name: 'B20-T02: Multi-batch lookup finds all products matching barcode across lots',
    fn: async () => {
      function findAllMatchingBarcode(barcode, products) {
        return products.filter(p => !p.isDiscarded && !p.isConsumed && p.barcode === barcode);
      }
      const batch1 = createProduct({ id: 'b1', name: 'Leche Lote A', category: 'Lácteos', quantity: 6, unit: 'L', expiryDate: '2026-11-01', barcode: '7801111111111', lot: 'LOTE-A' });
      const batch2 = createProduct({ id: 'b2', name: 'Leche Lote B', category: 'Lácteos', quantity: 12, unit: 'L', expiryDate: '2026-11-15', barcode: '7801111111111', lot: 'LOTE-B' });

      const matches = findAllMatchingBarcode('7801111111111', [batch1, batch2]);
      assert.strictEqual(matches.length, 2);
    }
  },
  {
    name: 'B20-T03: Barcode lookup in empty inventory returns not found immediately without error',
    fn: async () => {
      const res = lookupBarcode('7801234567890', []);
      assert.strictEqual(res.found, false);
      assert.strictEqual(res.product, null);
    }
  },
  {
    name: 'B20-T04: Barcode with spaces, tabs or newlines is sanitized prior to lookup',
    fn: async () => {
      const prod = createProduct({ name: 'Pan', category: 'Panadería y pastelería', quantity: 1, unit: 'unidad(es)', expiryDate: '2026-10-30', barcode: '7809999999999' });
      const res = lookupBarcode('\t 7809999999999 \n', [prod]);
      assert.strictEqual(res.found, true);
    }
  },
  {
    name: 'B20-T05: Lookup with null or undefined barcode returns false gracefully',
    fn: async () => {
      assert.strictEqual(lookupBarcode(null, []).found, false);
      assert.strictEqual(lookupBarcode(undefined, []).found, false);
    }
  }
];

if (require.main === module) {
  runDirectly('B20: Barcode Lookup Boundaries', tests);
}

module.exports = {
  id: 'B20',
  name: 'Barcode Lookup Boundaries',
  tests
};
