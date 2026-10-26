const { assert, runDirectly } = require('../test_helper');
const { exportProductsToCsv, parseCsv, CSV_HEADER } = require('../harness');

const sampleProducts = [
  {
    name: 'Queso Mantecoso',
    category: 'Lácteos',
    quantity: 3,
    unit: 'kg',
    receivedDate: '2026-10-20',
    expiryDate: '2026-11-20',
    location: 'Refrigerador',
    lot: 'LOTE-99',
    supplier: 'Lácteos del Sur',
    notes: 'Envase sellado'
  },
  {
    name: 'Salmón "Premium" Ahumado',
    category: 'Pescados y mariscos',
    quantity: 1.5,
    unit: 'kg',
    receivedDate: '2026-10-22',
    expiryDate: '2026-10-29',
    location: 'Congelador',
    lot: 'LOTE-77',
    supplier: 'Pesquera Austral',
    notes: 'Revisar temperatura; mantener a -18°C'
  }
];

const tests = [
  {
    name: 'F25-T01: CSV export begins with UTF-8 Byte Order Mark (\\uFEFF) for Excel',
    fn: async () => {
      const csv = exportProductsToCsv(sampleProducts);
      assert.strictEqual(csv.charCodeAt(0), 0xfeff, 'First char must be BOM');
    }
  },
  {
    name: 'F25-T02: CSV export uses semicolon (;) delimiter',
    fn: async () => {
      const csv = exportProductsToCsv(sampleProducts);
      const firstLine = csv.slice(1).split(/\r?\n/)[0];
      assert.ok(firstLine.includes(';'), 'Header must contain semicolons');
      assert.ok(firstLine.includes('"Producto"'));
    }
  },
  {
    name: 'F25-T03: CSV export includes all 10 required Spanish header columns',
    fn: async () => {
      const csv = exportProductsToCsv(sampleProducts);
      for (const col of CSV_HEADER) {
        assert.ok(csv.includes(`"${col}"`), `CSV must include column header "${col}"`);
      }
    }
  },
  {
    name: 'F25-T04: Double quotes and semicolons in values are properly escaped (RFC 4180)',
    fn: async () => {
      const csv = exportProductsToCsv(sampleProducts);
      assert.ok(csv.includes('""Premium""'), 'Internal quotes must be escaped as ""');
      assert.ok(csv.includes('"Revisar temperatura; mantener a -18°C"'));
    }
  },
  {
    name: 'F25-T05: CSV import parser roundtrips exported products faithfully',
    fn: async () => {
      const csv = exportProductsToCsv(sampleProducts);
      const parsed = parseCsv(csv);
      assert.strictEqual(parsed.length, 2);
      assert.strictEqual(parsed[0].name, 'Queso Mantecoso');
      assert.strictEqual(parsed[0].quantity, 3);
      assert.strictEqual(parsed[1].name, 'Salmón "Premium" Ahumado');
      assert.strictEqual(parsed[1].quantity, 1.5);
    }
  }
];

if (require.main === module) {
  runDirectly('F25: UTF-8 BOM CSV Export/Import', tests);
}

module.exports = {
  id: 'F25',
  name: 'UTF-8 BOM CSV Export/Import',
  tests
};
