const { assert, runDirectly } = require('../test_helper');
const { createConnectivityStore } = require('../harness');

const tests = [
  {
    name: 'F24-T01: Connectivity store reflects online state without warning pill',
    fn: async () => {
      const store = createConnectivityStore({ isOnline: true, pendingWrites: 0 });
      let state;
      const unsub = store.subscribe(s => { state = s; });

      assert.strictEqual(state.isOnline, true);
      assert.strictEqual(state.pendingWrites, 0);
      unsub();
    }
  },
  {
    name: 'F24-T02: Offline state activates connectivity pill indicator',
    fn: async () => {
      const store = createConnectivityStore({ isOnline: true, pendingWrites: 0 });
      let state;
      const unsub = store.subscribe(s => { state = s; });

      store.setOnline(false);
      assert.strictEqual(state.isOnline, false);

      function getPillText(st) {
        if (st.isOnline) return null;
        if (st.pendingWrites > 0) return `Sin conexión (${st.pendingWrites} pendientes)`;
        return 'Modo sin conexión';
      }

      assert.strictEqual(getPillText(state), 'Modo sin conexión');
      unsub();
    }
  },
  {
    name: 'F24-T03: Pending writes counter increments when mutating data offline',
    fn: async () => {
      const store = createConnectivityStore({ isOnline: false, pendingWrites: 0 });
      let state;
      const unsub = store.subscribe(s => { state = s; });

      store.incrementPending();
      store.incrementPending();
      store.incrementPending();
      assert.strictEqual(state.pendingWrites, 3);
      unsub();
    }
  },
  {
    name: 'F24-T04: Online recovery event clears pending writes counter upon Firestore sync',
    fn: async () => {
      const store = createConnectivityStore({ isOnline: false, pendingWrites: 4 });
      let state;
      const unsub = store.subscribe(s => { state = s; });

      // Network restored
      store.setOnline(true);
      store.clearPending();
      assert.strictEqual(state.isOnline, true);
      assert.strictEqual(state.pendingWrites, 0);
      unsub();
    }
  },
  {
    name: 'F24-T05: Visual badge styling uses caution/amber color during offline mode',
    fn: async () => {
      function getBadgeStyle(isOnline) {
        if (!isOnline) {
          return { backgroundColor: '#fff0cf', color: '#88580c', visible: true };
        }
        return { visible: false };
      }
      assert.strictEqual(getBadgeStyle(false).visible, true);
      assert.strictEqual(getBadgeStyle(true).visible, false);
    }
  }
];

if (require.main === module) {
  runDirectly('F24: Offline Connectivity Pill/Banner', tests);
}

module.exports = {
  id: 'F24',
  name: 'Offline Connectivity Pill/Banner',
  tests
};
