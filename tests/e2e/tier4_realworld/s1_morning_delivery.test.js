const { assert, runDirectly } = require('../test_helper');
const {
  InMemoryWorkspaceRepository,
  calculatePresetDate,
  calculateMetrics,
  exportProductsToCsv,
  parseCsv
} = require('../harness');

const tests = [
  {
    name: 'Scenario 1: Morning Delivery Reception (7:00 AM Shift Workload)',
    fn: async () => {
      const TODAY = '2026-10-25';
      const refDate = new Date(`${TODAY}T00:00:00`);
      const repo = new InMemoryWorkspaceRepository();
      const workspaceId = 'cocina-central';
      const operator = 'Marta - Bodega';

      // 1. Delivery arrives with 5 diverse crates
      const deliveryItems = [
        { name: 'Leche Entera 1L', category: 'Lácteos', quantity: 24, unit: 'L', lot: 'LOT-LE-01', supplier: 'Lácteos del Sur', barcode: '7801234567890', preset: '+3d' },
        { name: 'Pechuga de Pollo Fresca', category: 'Carnes', quantity: 15, unit: 'kg', lot: 'LOT-CH-99', supplier: 'Avícola Central', barcode: '7802345678901', preset: '+2d' },
        { name: 'Filete de Merluza', category: 'Pescados y mariscos', quantity: 8, unit: 'kg', lot: 'LOT-FISH-12', supplier: 'Pesquera Austral', barcode: '7803456789012', preset: '+2d' },
        { name: 'Tomates Larga Vida', category: 'Frutas y verduras', quantity: 20, unit: 'kg', lot: 'LOT-TOM-44', supplier: 'La Vega', barcode: '7804567890123', preset: '+1w' },
        { name: 'Atún en Aceite (Caja 24u)', category: 'Abarrotes y secos', quantity: 2, unit: 'caja(s)', lot: 'LOT-TUNA-88', supplier: 'Distribuidora Mayorista', barcode: '7805678901234', preset: '+1m' }
      ];

      // 2. Head chef registers incoming crates using barcode and quick presets
      const createdIds = [];
      for (const item of deliveryItems) {
        const expiryDate = calculatePresetDate(refDate, item.preset);
        const id = await repo.createProduct(workspaceId, {
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          receivedDate: TODAY,
          expiryDate,
          location: item.category === 'Carnes' || item.category === 'Pescados y mariscos' ? 'Refrigerador' : 'Bodega seca',
          lot: item.lot,
          supplier: item.supplier,
          barcode: item.barcode,
          notes: 'Recepción turno mañana verificado conforme'
        }, operator);
        createdIds.push(id);
      }

      assert.strictEqual(createdIds.length, 5);

      // 3. Inspect audit trail: all items must be stamped with Marta - Bodega
      const history = repo.getHistory(workspaceId, 10);
      assert.strictEqual(history.length, 5);
      for (const log of history) {
        assert.strictEqual(log.operator, 'Marta - Bodega');
        assert.strictEqual(log.action, 'create');
      }

      // 4. Verify metrics dashboard
      const registeredProducts = Array.from(repo._getWorkspaceMap(workspaceId).values());
      const metrics = calculateMetrics(registeredProducts, refDate);
      assert.strictEqual(metrics.total, 5);
      assert.strictEqual(metrics.expired, 0);
      // chicken (+2d), fish (+2d), milk (+3d) -> soon (3 items)
      // tomatoes (+1w, +7d) -> week (1 item)
      // tuna (+1m) -> ok (1 item)
      assert.strictEqual(metrics.soon, 3);
      assert.strictEqual(metrics.week, 1);
      assert.strictEqual(metrics.ok, 1);

      // 5. Generate CSV export with UTF-8 BOM for accounting office
      const csvExport = exportProductsToCsv(registeredProducts);
      assert.strictEqual(csvExport.charCodeAt(0), 0xfeff, 'Must begin with BOM');
      assert.ok(csvExport.includes('LOT-LE-01'));
      assert.ok(csvExport.includes('Lácteos del Sur'));
      assert.strictEqual(registeredProducts[0].createdBy, 'Marta - Bodega');

      // 6. Verify accounting office can parse the CSV cleanly
      const parsedCsv = parseCsv(csvExport);
      assert.strictEqual(parsedCsv.length, 5);
      assert.strictEqual(parsedCsv[0].name, 'Leche Entera 1L');
      assert.strictEqual(parsedCsv[0].quantity, 24);
    }
  }
];

if (require.main === module) {
  runDirectly('Tier 4: Scenario 1 - Morning Delivery Reception', tests);
}

module.exports = {
  id: 'S1',
  name: 'Scenario 1: Morning Delivery Reception',
  tests
};
