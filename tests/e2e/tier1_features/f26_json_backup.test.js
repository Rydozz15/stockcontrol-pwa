const { assert, runDirectly } = require('../test_helper');
const { exportJsonV2, importJson } = require('../harness');

const sampleProducts = [
  {
    id: 'p1',
    name: 'Carne Molida',
    category: 'Carnes',
    quantity: 4,
    unit: 'kg',
    expiryDate: '2026-10-31'
  }
];

const tests = [
  {
    name: 'F26-T01: exportJsonV2 generates compliant JSON v2 schema payload',
    fn: async () => {
      const jsonStr = exportJsonV2(sampleProducts, 'cocina-central');
      const obj = JSON.parse(jsonStr);
      assert.strictEqual(obj.app, 'StockControl PWA');
      assert.strictEqual(obj.version, 2);
      assert.strictEqual(obj.workspaceId, 'cocina-central');
      assert.ok(obj.exportedAt);
      assert.strictEqual(obj.products.length, 1);
    }
  },
  {
    name: 'F26-T02: importJson restores valid v2 backup',
    fn: async () => {
      const jsonStr = exportJsonV2(sampleProducts, 'cocina-central');
      const result = importJson(jsonStr, 'cocina-central');
      assert.strictEqual(result.version, 2);
      assert.strictEqual(result.products.length, 1);
      assert.strictEqual(result.products[0].name, 'Carne Molida');
    }
  },
  {
    name: 'F26-T03: importJson detects legacy v1 JSON backup and runs normalizer',
    fn: async () => {
      const legacyV1 = {
        app: 'StockControl Vencimientos',
        version: 1,
        exportedAt: '2026-05-10T12:00:00.000Z',
        products: [
          {
            id: 'legacy_1',
            name: 'Leche',
            category: 'Lácteos',
            quantity: 5,
            unit: 'unidad(es)',
            received: '2026-05-01',
            expiry: '2026-05-15',
            location: 'Refrigerador'
          }
        ]
      };
      const result = importJson(legacyV1, 'cocina-central');
      assert.strictEqual(result.version, 1);
      assert.strictEqual(result.products.length, 1);
      const prod = result.products[0];
      assert.strictEqual(prod.name, 'Leche');
      assert.strictEqual(prod.expiryDate, '2026-05-15');
      assert.strictEqual(prod.isDiscarded, false);
      assert.strictEqual(prod.isConsumed, false);
      assert.strictEqual(prod.createdBy, 'Legacy Import');
    }
  },
  {
    name: 'F26-T04: Normalized v1 products map legacy received/expiry keys to receivedDate/expiryDate',
    fn: async () => {
      const legacy = {
        products: [{ name: 'Arroz', expiry: '2027-01-01', received: '2026-01-01', quantity: 10 }]
      };
      const res = importJson(legacy);
      assert.strictEqual(res.products[0].expiryDate, '2027-01-01');
      assert.strictEqual(res.products[0].receivedDate, '2026-01-01');
    }
  },
  {
    name: 'F26-T05: Corrupted JSON backup throws descriptive validation error',
    fn: async () => {
      assert.throws(() => {
        importJson('{ invalid json');
      });
      assert.throws(() => {
        importJson({ noProducts: true });
      }, /missing "products" array/);
    }
  }
];

if (require.main === module) {
  runDirectly('F26: JSON v2 Backup & v1 Normalizer', tests);
}

module.exports = {
  id: 'F26',
  name: 'JSON v2 Backup & v1 Normalizer',
  tests
};
