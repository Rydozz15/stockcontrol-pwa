const { assert, runDirectly } = require('../test_helper');
const { createProduct, validateProduct, validateHistoryLog } = require('../harness');

const tests = [
  {
    name: 'B03-T01: High precision decimal quantities (e.g. 0.001 kg saffron) are accepted',
    fn: async () => {
      const prod = createProduct({
        name: 'Azafrán Español',
        category: 'Abarrotes y secos',
        quantity: 0.005,
        unit: 'kg',
        expiryDate: '2027-10-25'
      });
      assert.strictEqual(prod.quantity, 0.005);
      const res = validateProduct(prod);
      assert.strictEqual(res.valid, true);
    }
  },
  {
    name: 'B03-T02: Extreme string lengths (500 char name, 2000 char notes) do not throw errors',
    fn: async () => {
      const longName = 'A'.repeat(500);
      const longNotes = 'Detalles de almacenamiento: '.repeat(100);
      const prod = createProduct({
        name: longName,
        category: 'Otros',
        quantity: 1,
        unit: 'unidad(es)',
        expiryDate: '2026-12-31',
        notes: longNotes
      });
      assert.strictEqual(prod.name.length, 500);
      assert.ok(prod.notes.length >= 2000);
    }
  },
  {
    name: 'B03-T03: Full Unicode and emoji support in names, lots, and notes',
    fn: async () => {
      const prod = createProduct({
        name: 'Tomates Cherry 🍅 (100% Orgánico)',
        category: 'Frutas y verduras',
        quantity: 3,
        unit: 'kg',
        expiryDate: '2026-10-30',
        notes: 'Proveedor: Don José · ¡Cuidado con la refrigeración! ❄️'
      });
      assert.ok(prod.name.includes('🍅'));
      assert.ok(prod.notes.includes('❄️'));
    }
  },
  {
    name: 'B03-T04: NaN, null and Infinity quantities are rejected',
    fn: async () => {
      assert.strictEqual(validateProduct({ id: 'p1', name: 'Leche', category: 'Lácteos', quantity: NaN, unit: 'L', expiryDate: '2026-11-01' }).valid, false);
      assert.strictEqual(validateProduct({ id: 'p2', name: 'Leche', category: 'Lácteos', quantity: Infinity, unit: 'L', expiryDate: '2026-11-01' }).valid, false);
    }
  },
  {
    name: 'B03-T05: Unknown waste reason is rejected by HistoryLog validator',
    fn: async () => {
      const invalidLog = {
        id: 'log_99',
        timestamp: new Date().toISOString(),
        operator: 'Carlos',
        action: 'discard',
        productId: 'prod_1',
        reason: 'se_lo_comio_el_gato' // Not in HACCP enum
      };
      const res = validateHistoryLog(invalidLog);
      assert.strictEqual(res.valid, false);
    }
  }
];

if (require.main === module) {
  runDirectly('B03: Domain Models Boundaries', tests);
}

module.exports = {
  id: 'B03',
  name: 'Domain Models Boundaries',
  tests
};
