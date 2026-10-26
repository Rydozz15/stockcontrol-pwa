const { assert, runDirectly } = require('../test_helper');
const { parseCsv, exportProductsToCsv } = require('../harness');

const tests = [
  {
    name: 'B25-T01: Multi-line notes with embedded CRLF newlines parse without splitting rows',
    fn: async () => {
      const multilineProduct = [
        {
          name: 'Pechuga de Pollo',
          category: 'Carnes',
          quantity: 10,
          unit: 'kg',
          receivedDate: '2026-10-25',
          expiryDate: '2026-10-30',
          notes: 'Línea 1: Descongelar en frío.\r\nLínea 2: No recongelar jamás.'
        }
      ];
      const exported = exportProductsToCsv(multilineProduct);
      const parsed = parseCsv(exported);
      assert.strictEqual(parsed.length, 1);
      assert.strictEqual(parsed[0].name, 'Pechuga de Pollo');
      assert.ok(parsed[0].notes.includes('Línea 1') && parsed[0].notes.includes('Línea 2'));
    }
  },
  {
    name: 'B25-T02: Embedded semicolons, double quotes, and commas inside fields parse cleanly',
    fn: async () => {
      const complexProduct = [
        {
          name: 'Queso "Chanco"; Especial, Ahumado',
          category: 'Lácteos',
          quantity: 2,
          unit: 'kg',
          expiryDate: '2026-11-15'
        }
      ];
      const exported = exportProductsToCsv(complexProduct);
      const parsed = parseCsv(exported);
      assert.strictEqual(parsed.length, 1);
      assert.strictEqual(parsed[0].name, 'Queso "Chanco"; Especial, Ahumado');
    }
  },
  {
    name: 'B25-T03: CSV files without UTF-8 BOM (e.g. from Linux/macOS tools) import successfully',
    fn: async () => {
      const rawNoBom = `"Producto";"Categoría";"Cantidad";"Unidad";"Recepción";"Vencimiento";"Almacenamiento";"Lote";"Proveedor";"Observaciones"\r\n"Leche";"Lácteos";"5";"L";"2026-10-20";"2026-11-01";"Refrigerador";"";"";""`;
      const parsed = parseCsv(rawNoBom);
      assert.strictEqual(parsed.length, 1);
      assert.strictEqual(parsed[0].name, 'Leche');
    }
  },
  {
    name: 'B25-T04: Comma-delimited CSV (standard US Excel export) is auto-detected and parsed',
    fn: async () => {
      const commaCsv = `"Producto","Categoría","Cantidad","Unidad","Recepción","Vencimiento","Almacenamiento","Lote","Proveedor","Observaciones"\r\n"Harina","Abarrotes y secos","10","kg","2026-10-01","2027-01-01","Bodega seca","","",""`;
      const parsed = parseCsv(commaCsv);
      assert.strictEqual(parsed.length, 1);
      assert.strictEqual(parsed[0].name, 'Harina');
      assert.strictEqual(parsed[0].quantity, 10);
    }
  },
  {
    name: 'B25-T05: Header-only empty CSV returns empty array without throwing',
    fn: async () => {
      const headerOnly = `"Producto";"Categoría";"Cantidad";"Unidad";"Recepción";"Vencimiento";"Almacenamiento";"Lote";"Proveedor";"Observaciones"`;
      const parsed = parseCsv(headerOnly);
      assert.strictEqual(parsed.length, 0);
    }
  }
];

if (require.main === module) {
  runDirectly('B25: CSV BOM Boundaries', tests);
}

module.exports = {
  id: 'B25',
  name: 'CSV BOM Boundaries',
  tests
};
