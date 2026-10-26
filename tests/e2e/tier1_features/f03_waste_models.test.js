const { assert, runDirectly } = require('../test_helper');
const {
  validateProduct,
  createProduct,
  validateHistoryLog,
  VALID_CATEGORIES,
  VALID_WASTE_REASONS
} = require('../harness');

const tests = [
  {
    name: 'F03-T01: Valid Product document satisfies domain schema specification',
    fn: async () => {
      const prod = createProduct({
        name: 'Queso Gouda',
        category: 'Lácteos',
        quantity: 5,
        unit: 'kg',
        expiryDate: '2026-11-10'
      }, 'Carlos - Cocinero');
      const res = validateProduct(prod);
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.errors.length, 0);
      assert.strictEqual(prod.isDiscarded, false);
      assert.strictEqual(prod.isConsumed, false);
    }
  },
  {
    name: 'F03-T02: Product schema enforces non-empty product name',
    fn: async () => {
      const invalid = {
        id: 'p1',
        name: '',
        category: 'Lácteos',
        quantity: 2,
        unit: 'kg',
        expiryDate: '2026-11-01'
      };
      const res = validateProduct(invalid);
      assert.strictEqual(res.valid, false);
      assert.ok(res.errors.some(e => e.includes('name is required')));
    }
  },
  {
    name: 'F03-T03: Product schema enforces non-negative quantity',
    fn: async () => {
      const invalid = {
        id: 'p2',
        name: 'Carne Molida',
        category: 'Carnes',
        quantity: -3,
        unit: 'kg',
        expiryDate: '2026-10-30'
      };
      const res = validateProduct(invalid);
      assert.strictEqual(res.valid, false);
      assert.ok(res.errors.some(e => e.includes('quantity must be a non-negative number')));
    }
  },
  {
    name: 'F03-T04: Waste reason matches HACCP standard enum values',
    fn: async () => {
      const expectedReasons = ['vencimiento', 'deterioro', 'rotura', 'temperatura', 'otro'];
      for (const reason of expectedReasons) {
        assert.ok(VALID_WASTE_REASONS.includes(reason), `Must support waste reason: ${reason}`);
      }
    }
  },
  {
    name: 'F03-T05: HistoryLog document schema requires valid action, timestamp and operator',
    fn: async () => {
      const validLog = {
        id: 'log_123',
        timestamp: new Date().toISOString(),
        operator: 'Marta - Bodega',
        action: 'discard',
        productId: 'prod_456',
        productName: 'Tomates',
        amount: 2,
        unit: 'kg',
        reason: 'deterioro'
      };
      const res = validateHistoryLog(validLog);
      assert.strictEqual(res.valid, true);

      const invalidLog = { ...validLog, operator: '' };
      assert.strictEqual(validateHistoryLog(invalidLog).valid, false);
    }
  }
];

if (require.main === module) {
  runDirectly('F03: Domain Waste & Audit Models', tests);
}

module.exports = {
  id: 'F03',
  name: 'Domain Waste & Audit Models',
  tests
};
