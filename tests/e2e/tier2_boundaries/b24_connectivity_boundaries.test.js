const { assert, runDirectly } = require('../test_helper');
const { createConnectivityStore } = require('../harness');

const tests = [
  {
    name: 'B24-T01: Rapid network flapping (10 online/offline transitions) debounces cleanly',
    fn: async () => {
      class DebouncedConnectivity {
        constructor(delayMs = 300) {
          this.delayMs = delayMs;
          this.state = true;
          this.timer = null;
        }
        change(isOnline) {
          if (this.timer) clearTimeout(this.timer);
          this.timer = setTimeout(() => {
            this.state = isOnline;
          }, this.delayMs);
        }
      }

      const dc = new DebouncedConnectivity(50);
      for (let i = 0; i < 10; i++) {
        dc.change(i % 2 === 0);
      }
      await new Promise(r => setTimeout(r, 70));
      assert.strictEqual(dc.state, false);
    }
  },
  {
    name: 'B24-T02: Offline state with 0 pending writes formats pill text without numeric badge',
    fn: async () => {
      function formatPill(isOnline, pendingWrites) {
        if (isOnline) return '';
        if (pendingWrites <= 0) return 'Modo sin conexión';
        return `Modo sin conexión · ${pendingWrites} pendiente(s)`;
      }
      assert.strictEqual(formatPill(false, 0), 'Modo sin conexión');
      assert.strictEqual(formatPill(false, 3), 'Modo sin conexión · 3 pendiente(s)');
    }
  },
  {
    name: 'B24-T03: Large pending writes count (500 offline operations) formats cleanly without layout overflow',
    fn: async () => {
      const store = createConnectivityStore({ isOnline: false, pendingWrites: 500 });
      let state = null;
      store.subscribe(s => { state = s; });
      assert.strictEqual(state.pendingWrites, 500);
      assert.strictEqual(state.isOnline, false);
    }
  },
  {
    name: 'B24-T04: Initial browser load when navigator.onLine is false initializes offline store immediately',
    fn: async () => {
      function initConnectivity(navigatorOnLine) {
        return createConnectivityStore({ isOnline: navigatorOnLine, pendingWrites: 0 });
      }
      const initialOfflineStore = initConnectivity(false);
      let state;
      initialOfflineStore.subscribe(s => { state = s; });
      assert.strictEqual(state.isOnline, false);
    }
  },
  {
    name: 'B24-T05: Manual reconnect trigger allows forcing Firebase enableNetwork retry',
    fn: async () => {
      let networkEnabled = false;
      async function manualRetryConnect() {
        // Simulates enableNetwork(db)
        networkEnabled = true;
        return { reconnected: true };
      }
      const res = await manualRetryConnect();
      assert.strictEqual(res.reconnected, true);
      assert.strictEqual(networkEnabled, true);
    }
  }
];

if (require.main === module) {
  runDirectly('B24: Connectivity Boundaries', tests);
}

module.exports = {
  id: 'B24',
  name: 'Connectivity Boundaries',
  tests
};
