const { assert, runDirectly } = require('../test_helper');
const {
  InMemoryWorkspaceRepository,
  createConnectivityStore,
  createInventoryStore,
  createProduct,
  consumeStock
} = require('../harness');

const tests = [
  {
    name: 'Scenario 3: Walk-in Freezer Blackout (Offline IndexedDB persistence & Reconnection)',
    fn: async () => {
      const connStore = createConnectivityStore({ isOnline: true, pendingWrites: 0 });
      const repo = new InMemoryWorkspaceRepository();
      const ws = 'cocina-freezer';
      const cook = 'Pedro - Bodega Frío';

      // Seed remote database prior to entering walk-in freezer
      const berryId = await repo.createProduct(ws, {
        name: 'Arándanos Congelados 1kg',
        category: 'Congelados',
        quantity: 8,
        unit: 'paquete(s)',
        expiryDate: '2027-04-10'
      }, 'Supervisor');

      const friesId = await repo.createProduct(ws, {
        name: 'Papas Prefritas 2.5kg',
        category: 'Congelados',
        quantity: 1,
        unit: 'paquete(s)',
        expiryDate: '2027-02-15'
      }, 'Supervisor');

      // 1. Pedro enters subterranean walk-in cold room. Wi-Fi and Cellular signals drop completely.
      connStore.setOnline(false);
      assert.strictEqual(connStore.get().isOnline, false);
      assert.strictEqual(connStore.get().pendingWrites, 0);

      // Local IndexedDB mutation queue
      const offlineQueue = [];

      // Mutation A: Register 3 boxes of Frozen Salmon Fillets
      connStore.incrementPending();
      const localSalmon = createProduct({
        name: 'Salmón Porcionado Congelado',
        category: 'Pescados y mariscos',
        quantity: 3,
        unit: 'caja(s)',
        expiryDate: '2027-06-30',
        location: 'Congelador'
      }, cook);
      offlineQueue.push({ type: 'create', data: localSalmon });

      // Mutation B: Update Arándanos quantity (found 2 more bags behind ice block)
      connStore.incrementPending();
      offlineQueue.push({ type: 'update', id: berryId, updates: { quantity: 10 } });

      // Mutation C: Consume the last bag of Papas Prefritas
      connStore.incrementPending();
      offlineQueue.push({ type: 'consume', id: friesId, amount: 1 });

      // Verify offline state reflects 3 pending operations
      assert.strictEqual(connStore.get().pendingWrites, 3);
      assert.strictEqual(connStore.get().isOnline, false);

      // 2. Pedro finishes freezer inventory and steps out into the kitchen.
      // Wi-Fi reconnects automatically.
      connStore.setOnline(true);
      assert.strictEqual(connStore.get().isOnline, true);

      // 3. Firestore background sync flushes pending mutations in chronological order
      for (const op of offlineQueue) {
        if (op.type === 'create') {
          await repo.createProduct(ws, op.data, cook);
        } else if (op.type === 'update') {
          await repo.updateProduct(ws, op.id, op.updates, cook);
        } else if (op.type === 'consume') {
          await repo.consumeStock(ws, op.id, op.amount, cook, 'Vaciado en freidora');
        }
        connStore.decrementPending();
      }

      // 4. Pending writes indicator clears completely back to 0
      assert.strictEqual(connStore.get().pendingWrites, 0);

      // 5. Verify final synchronized state in Firestore
      const remoteProducts = Array.from(repo._getWorkspaceMap(ws).values());
      assert.strictEqual(remoteProducts.length, 3);

      const berries = remoteProducts.find(p => p.id === berryId);
      assert.strictEqual(berries.quantity, 10);
      assert.strictEqual(berries.updatedBy, cook);

      const fries = remoteProducts.find(p => p.id === friesId);
      assert.strictEqual(fries.quantity, 0);
      assert.strictEqual(fries.isConsumed, true);

      const salmon = remoteProducts.find(p => p.name === 'Salmón Porcionado Congelado');
      assert.ok(salmon);
      assert.strictEqual(salmon.quantity, 3);
      assert.strictEqual(salmon.createdBy, cook);
    }
  }
];

if (require.main === module) {
  runDirectly('Tier 4: Scenario 3 - Walk-in Freezer Blackout', tests);
}

module.exports = {
  id: 'S3',
  name: 'Scenario 3: Walk-in Freezer Blackout',
  tests
};
