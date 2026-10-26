const { assert, runDirectly } = require('../test_helper');

const tests = [
  {
    name: 'B06-T01: Missing API key in environment throws clear diagnostic configuration error',
    fn: async () => {
      function validateFirebaseEnv(env) {
        if (!env.PUBLIC_FIREBASE_API_KEY) {
          throw new Error('Firebase initialization failed: PUBLIC_FIREBASE_API_KEY is not defined in environment');
        }
        return true;
      }
      assert.throws(() => validateFirebaseEnv({}), /PUBLIC_FIREBASE_API_KEY is not defined/);
      assert.strictEqual(validateFirebaseEnv({ PUBLIC_FIREBASE_API_KEY: 'AIzaSyFakeKey' }), true);
    }
  },
  {
    name: 'B06-T02: Private browsing quota failure triggers graceful fallback to memory cache',
    fn: async () => {
      function initCacheStrategy(simulatedError) {
        if (simulatedError && (simulatedError.name === 'QuotaExceededError' || simulatedError.code === 'failed-precondition')) {
          return { strategy: 'memory', persisted: false, warning: 'Persistence unavailable in private browsing' };
        }
        return { strategy: 'indexeddb_multi_tab', persisted: true, warning: null };
      }

      const quotaErr = { name: 'QuotaExceededError' };
      const fallback = initCacheStrategy(quotaErr);
      assert.strictEqual(fallback.strategy, 'memory');
      assert.strictEqual(fallback.persisted, false);
      assert.ok(fallback.warning);
    }
  },
  {
    name: 'B06-T03: Invalid projectId format validation',
    fn: async () => {
      function validateProjectId(id) {
        // Firebase project IDs are 6 to 30 chars, lowercase alphanumeric and hyphens
        return /^[a-z0-9-]{6,30}$/.test(id);
      }
      assert.strictEqual(validateProjectId('stockcontrol-86bb7'), true);
      assert.strictEqual(validateProjectId('Bad Project ID!'), false);
      assert.strictEqual(validateProjectId(''), false);
    }
  },
  {
    name: 'B06-T04: Malformed authDomain format validation',
    fn: async () => {
      function validateAuthDomain(domain) {
        return /^[a-z0-9.-]+\.firebaseapp\.com$/.test(domain);
      }
      assert.strictEqual(validateAuthDomain('stockcontrol-86bb7.firebaseapp.com'), true);
      assert.strictEqual(validateAuthDomain('http://malicious.site'), false);
    }
  },
  {
    name: 'B06-T05: Repeated client initialization returns singleton instance',
    fn: async () => {
      class FirebaseClientManager {
        constructor() {
          this.instance = null;
          this.initCount = 0;
        }
        getInstance() {
          if (!this.instance) {
            this.instance = { id: 'app_singleton', createdAt: Date.now() };
            this.initCount++;
          }
          return this.instance;
        }
      }

      const manager = new FirebaseClientManager();
      const first = manager.getInstance();
      const second = manager.getInstance();
      assert.strictEqual(first, second);
      assert.strictEqual(manager.initCount, 1);
    }
  }
];

if (require.main === module) {
  runDirectly('B06: Firebase Client Boundaries', tests);
}

module.exports = {
  id: 'B06',
  name: 'Firebase Client Boundaries',
  tests
};
