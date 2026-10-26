const { assert, runDirectly } = require('../test_helper');
const {
  InMemoryWorkspaceRepository,
  calculateExpiryStatus,
  calculateMetrics,
  exportProductsToCsv,
  parseCsv
} = require('../harness');

const tests = [
  {
    name: 'Scenario 4: Evening Food Waste & HACCP Health Inspection Audit',
    fn: async () => {
      const REF_DATE = new Date('2026-10-25T23:00:00');
      const repo = new InMemoryWorkspaceRepository();
      const ws = 'cocina-principal';
      const manager = 'Elena - Gerente de Cocina';

      // Seed day inventory
      const saladId = await repo.createProduct(ws, {
        name: 'Mix de Hojas Verdes',
        category: 'Frutas y verduras',
        quantity: 2,
        unit: 'kg',
        expiryDate: '2026-10-24' // expired yesterday
      }, 'Turno Mañana');

      const fishId = await repo.createProduct(ws, {
        name: 'Reineta Fresca',
        category: 'Pescados y mariscos',
        quantity: 3.5,
        unit: 'kg',
        expiryDate: '2026-10-25' // expires today, broken cold chain observed
      }, 'Turno Mañana');

      const riceId = await repo.createProduct(ws, {
        name: 'Arroz Grano Largo',
        category: 'Abarrotes y secos',
        quantity: 15,
        unit: 'kg',
        expiryDate: '2027-08-01'
      }, 'Turno Mañana');

      // 1. Elena navigates to BottomNav Alertas tab
      const allProducts = Array.from(repo._getWorkspaceMap(ws).values());
      const alerts = allProducts.filter(p => {
        const s = calculateExpiryStatus(p.expiryDate, REF_DATE);
        return s.key === 'expired' || s.key === 'soon';
      });
      assert.strictEqual(alerts.length, 2, 'Must flag 2 alert items for closing audit');

      // 2. Elena performs HACCP Discards with standardized reasons
      // A: Discard spoiled salad due to 'deterioro'
      const log1 = await repo.discardStock(ws, saladId, 'deterioro', manager);
      assert.strictEqual(log1.reason, 'deterioro');
      assert.strictEqual(log1.amount, 2);

      // B: Discard thawed fish due to temperature breach ('temperatura')
      const log2 = await repo.discardStock(ws, fishId, 'temperatura', manager);
      assert.strictEqual(log2.reason, 'temperatura');
      assert.strictEqual(log2.amount, 3.5);

      // 3. Elena inspects closing Audit Trail
      const fullHistory = repo.getHistory(ws, 10);
      const discardLogs = fullHistory.filter(l => l.action === 'discard');
      assert.strictEqual(discardLogs.length, 2);
      for (const d of discardLogs) {
        assert.strictEqual(d.operator, manager);
        assert.ok(d.timestamp);
      }

      // 4. Elena generates official HACCP closing report in Excel-ready CSV with UTF-8 BOM
      const closingProducts = Array.from(repo._getWorkspaceMap(ws).values());
      const csvReport = exportProductsToCsv(closingProducts);

      assert.strictEqual(csvReport.charCodeAt(0), 0xfeff, 'Official audit report must include Excel BOM');
      assert.ok(csvReport.includes('Mix de Hojas Verdes'));
      assert.ok(csvReport.includes('Reineta Fresca'));

      // 5. Verify metrics dashboard shows zero unaddressed alerts
      const finalMetrics = calculateMetrics(closingProducts, REF_DATE);
      assert.strictEqual(finalMetrics.expired, 0, 'No active expired products remain');
      assert.strictEqual(finalMetrics.total, 1, 'Only viable dry goods remain active in storage');
    }
  }
];

if (require.main === module) {
  runDirectly('Tier 4: Scenario 4 - Evening Food Waste & HACCP Audit', tests);
}

module.exports = {
  id: 'S4',
  name: 'Scenario 4: Evening Food Waste & HACCP Audit',
  tests
};
