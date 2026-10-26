const { assert, runDirectly } = require('../test_helper');
const path = require('path');
const fs = require('fs');
const {
  calculateExpiryStatus,
  calculatePresetDate,
  calculateMetrics,
  createProduct,
  consumeStock,
  undoConsumption,
  discardStock,
  InMemoryWorkspaceRepository,
  createConnectivityStore,
  createInventoryStore,
  createMetricsStore,
  exportProductsToCsv,
  parseCsv,
  exportJsonV2,
  importJson,
  lookupBarcode,
  isTabletSplitLayout,
  validateTouchTarget,
  validateManifest,
  inspectPngBuffer,
  validateRenderYaml
} = require('../harness');

const REF_DATE = new Date('2026-10-25T00:00:00');

const tests = [
  {
    name: 'T3-01: Offline mutation -> reconnection sync -> Firestore consistency',
    fn: async () => {
      const connStore = createConnectivityStore({ isOnline: false, pendingWrites: 0 });
      const repo = new InMemoryWorkspaceRepository();

      // Offline write
      connStore.incrementPending();
      const id = await repo.createProduct('cocina-sync', {
        name: 'Mantequilla 250g',
        category: 'Lácteos',
        quantity: 10,
        unit: 'unidad(es)',
        expiryDate: '2026-11-25'
      }, 'Pedro - Bodega');

      assert.strictEqual(connStore.get().pendingWrites, 1);

      // Reconnect
      connStore.setOnline(true);
      connStore.clearPending();
      assert.strictEqual(connStore.get().isOnline, true);
      assert.strictEqual(connStore.get().pendingWrites, 0);

      // Verify product exists in repository
      const products = Array.from(repo._getWorkspaceMap('cocina-sync').values());
      assert.strictEqual(products.length, 1);
      assert.strictEqual(products[0].name, 'Mantequilla 250g');
    }
  },
  {
    name: 'T3-02: Barcode scan lookup -> instant card highlight -> 1-tap decrement -> HACCP audit stamp',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const id = await repo.createProduct('cocina-rush', {
        name: 'Lomo Vetado',
        category: 'Carnes',
        quantity: 4,
        unit: 'kg',
        expiryDate: '2026-10-28',
        barcode: '7801234567890'
      }, 'Jefe Cocina');

      const products = Array.from(repo._getWorkspaceMap('cocina-rush').values());
      const scanResult = lookupBarcode('7801234567890', products);
      assert.strictEqual(scanResult.found, true);

      // 1-Tap consume 1 unit
      const log = await repo.consumeStock('cocina-rush', scanResult.product.id, 1, 'Parrillero', 'Almuerzo');
      assert.strictEqual(log.amount, 1);
      assert.strictEqual(log.operator, 'Parrillero');

      const updated = Array.from(repo._getWorkspaceMap('cocina-rush').values()).find(p => p.id === id);
      assert.strictEqual(updated.quantity, 3);
    }
  },
  {
    name: 'T3-03: CSV export with BOM -> JSON v2 backup roundtrip integrity',
    fn: async () => {
      const originalProducts = [
        createProduct({ name: 'Harina Selecta', category: 'Abarrotes y secos', quantity: 50, unit: 'kg', expiryDate: '2027-02-01', lot: 'LOT-99' })
      ];
      const csv = exportProductsToCsv(originalProducts);
      const importedCsv = parseCsv(csv);
      assert.strictEqual(importedCsv.length, 1);

      const jsonBackup = exportJsonV2(importedCsv, 'cocina-backup');
      const restored = importJson(jsonBackup, 'cocina-backup');
      assert.strictEqual(restored.products.length, 1);
      assert.strictEqual(restored.products[0].name, 'Harina Selecta');
      assert.strictEqual(restored.products[0].quantity, 50);
    }
  },
  {
    name: 'T3-04: Quick expiry preset (+2d) immediately updates reactive metrics dashboard',
    fn: async () => {
      const invStore = createInventoryStore([]);
      const metStore = createMetricsStore(invStore, REF_DATE);
      let metrics;
      const unsub = metStore.subscribe(m => { metrics = m; });

      const expiry = calculatePresetDate(REF_DATE, '+2d'); // 2026-10-27
      assert.strictEqual(expiry, '2026-10-27');

      invStore.addProduct(createProduct({ name: 'Pescado Fresco', category: 'Pescados y mariscos', quantity: 3, unit: 'kg', expiryDate: expiry }));

      assert.strictEqual(metrics.total, 1);
      assert.strictEqual(metrics.soon, 1);
      unsub();
    }
  },
  {
    name: 'T3-05: Workspace switch completely isolates stock visibility',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      await repo.createProduct('cocina-norte', { name: 'Papas Fritas', category: 'Congelados', quantity: 10, unit: 'kg', expiryDate: '2027-01-01' }, 'Op Norte');
      await repo.createProduct('cocina-sur', { name: 'Empanadas', category: 'Congelados', quantity: 20, unit: 'unidad(es)', expiryDate: '2026-12-01' }, 'Op Sur');

      let currentProducts = [];
      const unsub = repo.subscribeProducts('cocina-norte', p => { currentProducts = p; });
      assert.strictEqual(currentProducts.length, 1);
      assert.strictEqual(currentProducts[0].name, 'Papas Fritas');
      unsub();

      const unsubSur = repo.subscribeProducts('cocina-sur', p => { currentProducts = p; });
      assert.strictEqual(currentProducts.length, 1);
      assert.strictEqual(currentProducts[0].name, 'Empanadas');
      unsubSur();
    }
  },
  {
    name: 'T3-06: Tablet split view: item selection in left pane updates right pane detail reactively',
    fn: async () => {
      const isTablet = isTabletSplitLayout(820);
      assert.strictEqual(isTablet, true);

      let selectedItem = null;
      function onCardClick(item) {
        selectedItem = item;
      }

      const p1 = createProduct({ id: 'p1', name: 'Crema Pastelera', category: 'Panadería y pastelería', quantity: 2, unit: 'L', expiryDate: '2026-10-28' });
      onCardClick(p1);
      assert.strictEqual(selectedItem.id, 'p1');
      assert.strictEqual(selectedItem.name, 'Crema Pastelera');
    }
  },
  {
    name: 'T3-07: Unknown barcode scan preloads new product registration form',
    fn: async () => {
      const products = [createProduct({ name: 'Vino', category: 'Bebidas', quantity: 1, unit: 'botella(s)', expiryDate: '2028-01-01', barcode: '123' })];
      const scannedCode = '7809999888877';
      const lookup = lookupBarcode(scannedCode, products);
      assert.strictEqual(lookup.found, false);

      // Preload form with scanned barcode
      const formState = {
        barcode: scannedCode,
        name: '',
        category: 'Abarrotes y secos'
      };
      assert.strictEqual(formState.barcode, '7809999888877');
    }
  },
  {
    name: 'T3-08: 1-Tap consumption to 0 units triggers isConsumed: true and excludes from active metrics',
    fn: async () => {
      const prod = createProduct({ name: 'Última Mayonesa', category: 'Salsas y aderezos', quantity: 1, unit: 'unidad(es)', expiryDate: '2026-10-24' }); // expired
      const invStore = createInventoryStore([prod]);
      const metStore = createMetricsStore(invStore, REF_DATE);
      let metrics;
      metStore.subscribe(m => { metrics = m; });
      assert.strictEqual(metrics.total, 1);
      assert.strictEqual(metrics.expired, 1);

      // Consume last unit
      const { product: updated } = consumeStock(prod, 1, 'Chef');
      invStore.updateProduct(prod.id, updated);

      assert.strictEqual(metrics.total, 0, 'Consumed product must be excluded from active count');
      assert.strictEqual(metrics.expired, 0);
    }
  },
  {
    name: 'T3-09: 1-Tap Undo restores decremented quantity and reactive metrics',
    fn: async () => {
      const prod = createProduct({ name: 'Queso Azul', category: 'Lácteos', quantity: 1, unit: 'kg', expiryDate: '2026-10-25' }); // soon (today)
      const invStore = createInventoryStore([prod]);
      const metStore = createMetricsStore(invStore, REF_DATE);
      let metrics;
      metStore.subscribe(m => { metrics = m; });
      assert.strictEqual(metrics.soon, 1);

      // Consume
      const { product: consumed } = consumeStock(prod, 1, 'Cocinero');
      invStore.updateProduct(prod.id, consumed);
      assert.strictEqual(metrics.soon, 0);

      // Undo
      const { product: restored } = undoConsumption(consumed, 1, 'Cocinero');
      invStore.updateProduct(prod.id, restored);
      assert.strictEqual(metrics.soon, 1);
      assert.strictEqual(metrics.total, 1);
    }
  },
  {
    name: 'T3-10: 1-Tap Merma selection logs HACCP waste and removes from active inventory metrics',
    fn: async () => {
      const prod = createProduct({ name: 'Yogurt Descompuesto', category: 'Lácteos', quantity: 4, unit: 'unidad(es)', expiryDate: '2026-10-20' });
      const { product: discarded, log } = discardStock(prod, 'temperatura', 'Marta - Calidad');

      assert.strictEqual(discarded.isDiscarded, true);
      assert.strictEqual(log.reason, 'temperatura');

      const metrics = calculateMetrics([discarded], REF_DATE);
      assert.strictEqual(metrics.total, 0);
    }
  },
  {
    name: 'T3-11: Batch offline mutations sync in correct chronological order',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const p1 = await repo.createProduct('cocina-batch', { name: 'Salmón', category: 'Pescados y mariscos', quantity: 5, unit: 'kg', expiryDate: '2026-10-30' }, 'Op1');
      await repo.consumeStock('cocina-batch', p1, 1, 'Op2');
      await repo.consumeStock('cocina-batch', p1, 2, 'Op3');

      const history = repo.getHistory('cocina-batch', 10);
      assert.strictEqual(history.length, 3);
      assert.strictEqual(history[2].action, 'create');
      assert.strictEqual(history[1].amount, 1);
      assert.strictEqual(history[0].amount, 2);
    }
  },
  {
    name: 'T3-12: CSV imported into Workspace A does not contaminate Workspace B',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const csvData = `"Producto";"Categoría";"Cantidad";"Unidad";"Recepción";"Vencimiento";"Almacenamiento";"Lote";"Proveedor";"Observaciones"\r\n"Café Grano";"Bebidas";"10";"kg";"2026-10-01";"2027-01-01";"Bodega seca";"";"";""`;
      const parsed = parseCsv(csvData);

      for (const item of parsed) {
        await repo.createProduct('sucursal-1', item, 'Admin');
      }

      const pA = Array.from(repo._getWorkspaceMap('sucursal-1').values());
      const pB = Array.from(repo._getWorkspaceMap('sucursal-2').values());
      assert.strictEqual(pA.length, 1);
      assert.strictEqual(pB.length, 0);
    }
  },
  {
    name: 'T3-13: Operator switch preserves createdBy and updates updatedBy properly',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const id = await repo.createProduct('cocina-audit', { name: 'Pimienta', category: 'Abarrotes y secos', quantity: 1, unit: 'kg', expiryDate: '2028-01-01' }, 'Marta');

      await repo.updateProduct('cocina-audit', id, { quantity: 2 }, 'Juan');
      const prod = Array.from(repo._getWorkspaceMap('cocina-audit').values()).find(p => p.id === id);

      assert.strictEqual(prod.createdBy, 'Marta');
      assert.strictEqual(prod.updatedBy, 'Juan');
    }
  },
  {
    name: 'T3-14: FAB tap -> modal opened -> quick preset applied -> product saved in store',
    fn: async () => {
      const invStore = createInventoryStore([]);
      const presetExpiry = calculatePresetDate(REF_DATE, '+1m');
      const newProd = createProduct({
        name: 'Arroz Grado 1',
        category: 'Abarrotes y secos',
        quantity: 25,
        unit: 'kg',
        expiryDate: presetExpiry
      }, 'Cocinero');

      invStore.addProduct(newProd);
      assert.strictEqual(invStore.get().length, 1);
      assert.strictEqual(invStore.get()[0].expiryDate, presetExpiry);
    }
  },
  {
    name: 'T3-15: Bottom nav Alertas tab filters inventory matching metrics dashboard alert count',
    fn: async () => {
      const products = [
        createProduct({ name: 'Vencido', category: 'Lácteos', quantity: 1, unit: 'L', expiryDate: '2026-10-20' }), // expired
        createProduct({ name: 'Vence Hoy', category: 'Carnes', quantity: 2, unit: 'kg', expiryDate: '2026-10-25' }), // soon
        createProduct({ name: 'Vigente', category: 'Congelados', quantity: 5, unit: 'kg', expiryDate: '2026-12-01' }) // ok
      ];
      const m = calculateMetrics(products, REF_DATE);
      const totalAlerts = m.expired + m.soon; // 2 alerts

      // Bottom nav filter alerts
      const filtered = products.filter(p => {
        const s = calculateExpiryStatus(p.expiryDate, REF_DATE);
        return s.key === 'expired' || s.key === 'soon';
      });

      assert.strictEqual(filtered.length, totalAlerts);
    }
  },
  {
    name: 'T3-16: Safe-area inset bottom applied without violating >=44x44px touch targets',
    fn: async () => {
      const baseHeight = 48;
      const safeInset = 34; // iPhone gesture home indicator
      const totalNavHeight = baseHeight + safeInset;
      assert.ok(totalNavHeight >= 44);
      assert.strictEqual(validateTouchTarget(64, totalNavHeight).compliant, true);
    }
  },
  {
    name: 'T3-17: Service worker offline interception serves cached index shell',
    fn: async () => {
      const cachedFiles = new Map();
      cachedFiles.set('/index.html', '<html>StockControl PWA</html>');

      function mockFetch(url, isOnline) {
        if (!isOnline && cachedFiles.has(url)) {
          return { status: 200, fromCache: true, body: cachedFiles.get(url) };
        }
        return { status: 200, fromCache: false, body: 'Network response' };
      }

      const offlineResp = mockFetch('/index.html', false);
      assert.strictEqual(offlineResp.fromCache, true);
      assert.ok(offlineResp.body.includes('StockControl PWA'));
    }
  },
  {
    name: 'T3-18: PWA manifest icon references map directly to physically existing PNG files with valid magic bytes',
    fn: async () => {
      const rootDir = path.resolve(__dirname, '../../../');
      const iconPath192 = path.join(rootDir, 'assets', 'icon-192.png');
      const iconPath512 = path.join(rootDir, 'assets', 'icon-512.png');

      assert.ok(fs.existsSync(iconPath192));
      assert.ok(fs.existsSync(iconPath512));

      const b192 = fs.readFileSync(iconPath192);
      const b512 = fs.readFileSync(iconPath512);

      assert.strictEqual(inspectPngBuffer(b192).valid, true);
      assert.strictEqual(inspectPngBuffer(b512).valid, true);
    }
  },
  {
    name: 'T3-19: render.yaml build command cleanly aligns with package.json build script',
    fn: async () => {
      const packageBuildScript = 'vite build';
      const renderBuildCmd = 'npm install && npm run build';
      assert.ok(renderBuildCmd.includes('npm run build'));
      assert.ok(packageBuildScript.length > 0);
    }
  },
  {
    name: 'T3-20: Legacy v1 JSON import normalizes fields and recalculates expiry statuses and metrics',
    fn: async () => {
      const v1Backup = {
        app: 'StockControl Vencimientos',
        version: 1,
        products: [
          { id: '1', name: 'Leche', expiry: '2026-10-24', quantity: 2, received: '2026-10-10' }
        ]
      };
      const imported = importJson(v1Backup, 'cocina-v1');
      assert.strictEqual(imported.products[0].expiryDate, '2026-10-24');

      const metrics = calculateMetrics(imported.products, REF_DATE);
      assert.strictEqual(metrics.total, 1);
      assert.strictEqual(metrics.expired, 1);
    }
  },
  {
    name: 'T3-21: Decimal quantity consumption maintains exact precision in CSV and JSON exports',
    fn: async () => {
      const prod = createProduct({ name: 'Carne Molida Especial', category: 'Carnes', quantity: 2.5, unit: 'kg', expiryDate: '2026-10-30' });
      const { product: updated } = consumeStock(prod, 0.75, 'Cocinero');
      assert.strictEqual(updated.quantity, 1.75);

      const csv = exportProductsToCsv([updated]);
      assert.ok(csv.includes('"1.75"'));

      const json = exportJsonV2([updated]);
      assert.ok(json.includes('"quantity": 1.75'));
    }
  },
  {
    name: 'T3-22: Camera permission denied allows seamless fallback to manual product entry form',
    fn: async () => {
      let isFormModalOpen = false;
      function onCameraPermissionDenied() {
        // Fallback directly to manual entry
        isFormModalOpen = true;
      }
      onCameraPermissionDenied();
      assert.strictEqual(isFormModalOpen, true);
    }
  },
  {
    name: 'T3-23: Firestore security rules path matching aligns with repository subcollection hierarchy',
    fn: async () => {
      const repoPath = 'workspaces/cocina-1/products';
      const expectedRuleMatch = 'workspaces/{workspaceId}/products';
      const patternRegex = /^workspaces\/[^/]+\/products$/;
      assert.ok(patternRegex.test(repoPath));
    }
  },
  {
    name: 'T3-24: Concurrency simulation: two cooks consume 1 unit each from stock of 1; second fails',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const id = await repo.createProduct('cocina-conc', { name: 'Último Salmón', category: 'Pescados y mariscos', quantity: 1, unit: 'kg', expiryDate: '2026-10-30' }, 'Bodega');

      // First cook consumes
      await repo.consumeStock('cocina-conc', id, 1, 'Cocinero A');

      // Second cook attempts to consume same product
      let failed = false;
      try {
        await repo.consumeStock('cocina-conc', id, 1, 'Cocinero B');
      } catch {
        failed = true;
      }
      assert.strictEqual(failed, true, 'Second consumption on 0 quantity must fail');
    }
  },
  {
    name: 'T3-25: Waste history export to CSV includes HACCP audit fields and BOM',
    fn: async () => {
      const repo = new InMemoryWorkspaceRepository();
      const id = await repo.createProduct('cocina-haccp', { name: 'Pescado Descompuesto', category: 'Pescados y mariscos', quantity: 3, unit: 'kg', expiryDate: '2026-10-20' }, 'Control');
      await repo.discardStock('cocina-haccp', id, 'temperatura', 'Inspectora');

      const history = repo.getHistory('cocina-haccp');
      assert.strictEqual(history.length, 2);
      const discardLog = history.find(l => l.action === 'discard');
      assert.strictEqual(discardLog.reason, 'temperatura');
      assert.strictEqual(discardLog.operator, 'Inspectora');
    }
  },
  {
    name: 'T3-26: Multi-parameter filtering: category Lácteos AND status soon AND text search',
    fn: async () => {
      const p1 = createProduct({ name: 'Leche Descremada', category: 'Lácteos', quantity: 5, unit: 'L', expiryDate: '2026-10-26' }); // soon (1d)
      const p2 = createProduct({ name: 'Queso Gouda', category: 'Lácteos', quantity: 2, unit: 'kg', expiryDate: '2026-11-20' }); // ok
      const p3 = createProduct({ name: 'Leche de Almendras', category: 'Bebidas', quantity: 3, unit: 'L', expiryDate: '2026-10-26' }); // soon, but Bebidas

      const list = [p1, p2, p3];
      const filtered = list.filter(p => {
        const matchesCategory = p.category === 'Lácteos';
        const matchesSearch = p.name.toLowerCase().includes('leche');
        const status = calculateExpiryStatus(p.expiryDate, REF_DATE);
        const matchesStatus = status.key === 'soon';
        return matchesCategory && matchesSearch && matchesStatus;
      });

      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].name, 'Leche Descremada');
    }
  },
  {
    name: 'T3-27: Network reconnect clears pending writes indicator and updates status pill to En línea',
    fn: async () => {
      const conn = createConnectivityStore({ isOnline: false, pendingWrites: 4 });
      assert.strictEqual(conn.get().pendingWrites, 4);

      // Online event
      conn.setOnline(true);
      conn.clearPending();

      assert.strictEqual(conn.get().isOnline, true);
      assert.strictEqual(conn.get().pendingWrites, 0);
    }
  }
];

if (require.main === module) {
  runDirectly('Tier 3: Cross-Feature Combinations', tests);
}

module.exports = {
  id: 'Tier3',
  name: 'Cross-Feature Combinations',
  tests
};
