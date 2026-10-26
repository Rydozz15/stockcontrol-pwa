# Handoff Report: Milestone 2 Adversarial Stress Testing (Challenger 2)

**Agent**: `challenger_m2_2`  
**Role**: Adversarial Sync & Cache Challenger (critic, specialist)  
**Working Directory**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/challenger_m2_2/`  
**Date**: 2026-10-25T21:24:00Z  
**Parent Agent**: `1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c`  
**Handoff Type**: Hard (Adversarial Stress Testing Complete)  
**Verdict**: **`REQUEST_CHANGES`**

---

## 1. Observation

### 1.1 Empirical Verification Test Suite Created
Created standalone test suite at `tests/adversarial/adversarial_sync_stress.js` (689 lines) covering 141 empirical assertions across 4 core domains:
1. **Suite 1: Firebase Client Configuration Validation (`validateFirebaseConfig`)** — 54 tests
2. **Suite 2: Headless SSR Safety & Resilience** — 13 tests
3. **Suite 3: Store Synchronization Lifecycle & Zero Listener Leaks** — 54 tests
4. **Suite 4: `connectivityStore.hasPendingWrites` Propagation & UI Banner Reactivity** — 20 tests

### 1.2 Test Execution Output (Verbatim)
Command executed: `node tests/adversarial/adversarial_sync_stress.js`
Exit Code: `1`

```text
================================================================
STARTING EMPIRICAL ADVERSARIAL STRESS TEST SUITE (Milestone 2)
Node.js version: v24.11.1
Working Directory: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono
Runtime Globals: window=undefined, document=undefined
================================================================

  ✓ Environment is strictly headless (window === undefined)
  ✓ Environment is strictly headless (document === undefined)
[vite] (ssr) connected.

--- SUITE 1: Firebase Client Configuration Validation ---
  ✓ Rejects empty string API key with exact error message [threw: "Firebase initialization failed: PUBLIC_FIREBASE_API_KEY is not defined in environment"]
  ✓ Rejects whitespace-only API key [threw: "Firebase initialization failed: PUBLIC_FIREBASE_API_KEY is not defined in environment"]
  ✓ Rejects empty environment object missing API key [threw: "Firebase initialization failed: PUBLIC_FIREBASE_API_KEY is not defined in environment"]
  ✓ Rejects undefined API key [threw: "Firebase initialization failed: PUBLIC_FIREBASE_API_KEY is not defined in environment"]
  ✓ Rejects malformed projectId (Uppercase characters): "StockControl" [threw: "Firebase initialization failed: Invalid projectId format "StockControl""]
  ✓ Rejects malformed projectId (Underscore): "stock_control" [threw: "Firebase initialization failed: Invalid projectId format "stock_control""]
  ✓ Rejects malformed projectId (Dot): "stock.control" [threw: "Firebase initialization failed: Invalid projectId format "stock.control""]
  ✓ Rejects malformed projectId (At-symbol): "stock@control" [threw: "Firebase initialization failed: Invalid projectId format "stock@control""]
  ✓ Rejects malformed projectId (Exclamation mark): "stock!123" [threw: "Firebase initialization failed: Invalid projectId format "stock!123""]
  ✓ Rejects malformed projectId (Dollar sign): "stock$control" [threw: "Firebase initialization failed: Invalid projectId format "stock$control""]
  ✓ Rejects malformed projectId (Space character): "stock control" [threw: "Firebase initialization failed: Invalid projectId format "stock control""]
  ✓ Rejects malformed projectId (Leading space): " stockcontrol" [threw: "Firebase initialization failed: Invalid projectId format " stockcontrol""]
  ✓ Rejects malformed projectId (Trailing space): "stockcontrol " [threw: "Firebase initialization failed: Invalid projectId format "stockcontrol ""]
  ✓ Rejects malformed projectId (Length 3 (< 6 min)): "abc" [threw: "Firebase initialization failed: Invalid projectId format "abc""]
  ✓ Rejects malformed projectId (Length 5 (< 6 min)): "12345" [threw: "Firebase initialization failed: Invalid projectId format "12345""]
  ✓ Rejects malformed projectId (Length 31 (> 30 max)): "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" [threw: "Firebase initialization failed: Invalid projectId format "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa""]
  ✓ Rejects malformed projectId (Length 60 (> 30 max)): "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" [threw: "Firebase initialization failed: Invalid projectId format "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa""]
  ✓ Rejects malformed projectId (Path traversal attack): "../../etc/passwd" [threw: "Firebase initialization failed: Invalid projectId format "../../etc/passwd""]
  ✓ Rejects malformed projectId (XSS script injection): "<script>alert(1)</script>" [threw: "Firebase initialization failed: Invalid projectId format "<script>alert(1)</script>""]
  ✓ Rejects malformed projectId (Non-ASCII character (ñ)): "cocina-español" [threw: "Firebase initialization failed: Invalid projectId format "cocina-español""]
  ✓ Rejects malformed projectId (Non-ASCII character (é)): "café-stock" [threw: "Firebase initialization failed: Invalid projectId format "café-stock""]
  ✓ Accepts valid boundary projectId: "abcdef"
  ✓ Accepts valid boundary projectId: "123456"
  ✓ Accepts valid boundary projectId: "a-b-c-d"
  ✓ Accepts valid boundary projectId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  ✓ Accepts valid boundary projectId: "stockcontrol-86bb7"
  ✓ Rejects malformed authDomain (Non-firebase domain): "example.com" [threw: "Firebase initialization failed: Malformed authDomain format "example.com""]
  ✓ Rejects malformed authDomain (Non-firebase extension): "stockcontrol.org" [threw: "Firebase initialization failed: Malformed authDomain format "stockcontrol.org""]
  ✓ Rejects malformed authDomain (Subdomain hijack attack): "stockcontrol.firebaseapp.com.attacker.com" [threw: "Firebase initialization failed: Malformed authDomain format "stockcontrol.firebaseapp.com.attacker.com""]
  ✓ Rejects malformed authDomain (Contains protocol https://): "https://stockcontrol.firebaseapp.com" [threw: "Firebase initialization failed: Malformed authDomain format "https://stockcontrol.firebaseapp.com""]
  ✓ Rejects malformed authDomain (Contains protocol http://): "http://stockcontrol.firebaseapp.com" [threw: "Firebase initialization failed: Malformed authDomain format "http://stockcontrol.firebaseapp.com""]
  ✓ Rejects malformed authDomain (Contains port suffix): "stockcontrol.firebaseapp.com:443" [threw: "Firebase initialization failed: Malformed authDomain format "stockcontrol.firebaseapp.com:443""]
  ✓ Rejects malformed authDomain (Contains path suffix): "stockcontrol.firebaseapp.com/auth" [threw: "Firebase initialization failed: Malformed authDomain format "stockcontrol.firebaseapp.com/auth""]
  ✓ Rejects malformed authDomain (Uppercase characters): "StockControl.firebaseapp.com" [threw: "Firebase initialization failed: Malformed authDomain format "StockControl.firebaseapp.com""]
  ✓ Rejects malformed authDomain (Underscore in domain): "stock_control.firebaseapp.com" [threw: "Firebase initialization failed: Malformed authDomain format "stock_control.firebaseapp.com""]
  ✓ Rejects malformed authDomain (Space in domain): "stock control.firebaseapp.com" [threw: "Firebase initialization failed: Malformed authDomain format "stock control.firebaseapp.com""]
  ✓ Rejects malformed authDomain (Missing subdomain name): ".firebaseapp.com" [threw: "Firebase initialization failed: Malformed authDomain format ".firebaseapp.com""]
  ✓ Rejects malformed authDomain (Root domain only): "firebaseapp.com" [threw: "Firebase initialization failed: Malformed authDomain format "firebaseapp.com""]
  ✓ Rejects malformed authDomain (At-symbol in domain): "stock@control.firebaseapp.com" [threw: "Firebase initialization failed: Malformed authDomain format "stock@control.firebaseapp.com""]
  ✓ Accepts valid authDomain: "stockcontrol-86bb7.firebaseapp.com"
  ✓ Accepts valid authDomain: "my-kitchen-1.firebaseapp.com"
  ✓ Accepts valid authDomain: "app.staging.firebaseapp.com"
  ✗ FAIL: validateFirebaseConfig() without arguments crashed: [module runner] Dynamic access of "import.meta.env" is not supported. Please, use "import.meta.env.PUBLIC_FIREBASE_API_KEY" instead.

--- SUITE 2: Headless SSR Safety & Resilience ---
  ✓ isBrowser() returns false in headless Node runtime
  ✓ getFirebaseInstance().initialized is false in SSR
  ✓ getFirebaseInstance().isMock is true in SSR
  ✓ getFirebaseInstance().mode is strictly "ssr-noop" in SSR
  ✓ getFirebaseInstance().cacheType is strictly "none" in SSR
  ✓ getFirebaseInstance().app is null in SSR
  ✓ getFirebaseInstance().db is null in SSR
  ✓ getFirebaseInstance().auth is null in SSR
  ✓ getFirestoreDb() returns null without throwing in SSR
  ✓ getFirebaseAuth() returns null without throwing in SSR
  ✓ getFirebaseApp() returns null without throwing in SSR
  ✓ isFirebaseAvailable() returns false in SSR
  ✓ isBrowser() returns false when document is undefined even if window is defined
  ✓ isBrowser() returns false when window is undefined even if document is defined

--- SUITE 3: Store Synchronization Lifecycle & Zero Listener Leaks ---
  ✓ Switch 1/10 to "cocina-sucursal-1": active listeners is strictly 1
  ✓ Active workspace set contains "cocina-sucursal-1"
  ✓ inventoryStore reflects active workspace "cocina-sucursal-1"
  ✓ Switch 2/10 to "cocina-sucursal-2": active listeners is strictly 1
  ✓ Active workspace set contains "cocina-sucursal-2"
  ✓ inventoryStore reflects active workspace "cocina-sucursal-2"
  ✓ Switch 3/10 to "cocina-sucursal-3": active listeners is strictly 1
  ✓ Active workspace set contains "cocina-sucursal-3"
  ✓ inventoryStore reflects active workspace "cocina-sucursal-3"
  ✓ Switch 4/10 to "cocina-sucursal-4": active listeners is strictly 1
  ✓ Active workspace set contains "cocina-sucursal-4"
  ✓ inventoryStore reflects active workspace "cocina-sucursal-4"
  ✓ Switch 5/10 to "cocina-sucursal-5": active listeners is strictly 1
  ✓ Active workspace set contains "cocina-sucursal-5"
  ✓ inventoryStore reflects active workspace "cocina-sucursal-5"
  ✓ Switch 6/10 to "cocina-sucursal-6": active listeners is strictly 1
  ✓ Active workspace set contains "cocina-sucursal-6"
  ✓ inventoryStore reflects active workspace "cocina-sucursal-6"
  ✓ Switch 7/10 to "cocina-sucursal-7": active listeners is strictly 1
  ✓ Active workspace set contains "cocina-sucursal-7"
  ✓ inventoryStore reflects active workspace "cocina-sucursal-7"
  ✓ Switch 8/10 to "cocina-sucursal-8": active listeners is strictly 1
  ✓ Active workspace set contains "cocina-sucursal-8"
  ✓ inventoryStore reflects active workspace "cocina-sucursal-8"
  ✓ Switch 9/10 to "cocina-sucursal-9": active listeners is strictly 1
  ✓ Active workspace set contains "cocina-sucursal-9"
  ✓ inventoryStore reflects active workspace "cocina-sucursal-9"
  ✓ Switch 10/10 to "cocina-sucursal-10": active listeners is strictly 1
  ✓ Active workspace set contains "cocina-sucursal-10"
  ✓ inventoryStore reflects active workspace "cocina-sucursal-10"
  ✓ Total subscribe calls equals 10
  ✓ Total unsubscribe calls before final teardown equals 9
  ✓ Peak concurrent active listeners NEVER exceeded 1
  ✓ After final teardown, active listeners is strictly 0
  ✓ Total unsubscribe calls equals 10 (Zero listener leaks)
  ✓ Fuzzing: Peak concurrent listeners strictly 1 across 100 switches
  ✓ Fuzzing: Exactly 1 active listener remains before teardown
  ✓ Fuzzing: Teardown cleanly leaves 0 active listeners
  ✓ Fuzzing: Subscribes equals unsubscribes (100% leak-free)
  ✓ First subscription to cocina-repetida created 1 listener
  ✓ Second subscription to same workspace did NOT duplicate listener
  ✓ Teardown closed the active listener
  ✓ Calling previous teardown is safe and does not double-decrement
  ✓ Subscribing to empty string "" creates 0 listeners
  ✓ Empty workspace sets activeWorkspaceId to empty
  ✓ Subscribing to whitespace "   " creates 0 listeners
  ✓ Listener active before teardown
  ✓ First teardown closed listener
  ✓ Repeated teardowns are idempotent (active count remains 0)
  ✓ Repository unsubscription called only once
  ✓ Only cocina-nueva is currently active
  ✓ Current workspace is cocina-nueva
  ✓ Outdated teardown did NOT close active cocina-nueva listener
  ✓ Current teardown cleanly closed cocina-nueva
  ✓ initWorkspaceSync automatically subscribed to current workspace
  ✓ Active workspace is sucursal-alfa
  ✓ Changing workspaceStore switched listener (active count = 1)
  ✓ Active workspace is now sucursal-beta
  ✓ Changing workspaceStore switched listener again (active count = 1)
  ✓ Active workspace is now sucursal-gamma
  ✓ cleanupSync closed all listeners (active count = 0)
  ✓ Post-cleanup workspace changes do not leak listeners

--- SUITE 4: connectivityStore.hasPendingWrites Propagation & UI Banner Reactivity ---
  ✓ inventoryStore.hasPendingWrites received true
  ✓ connectivityStore.hasPendingWrites received true
  ✓ inventoryStore.hasPendingWrites received false
  ✓ connectivityStore.hasPendingWrites received false
  ✓ Pending writes set to true before error
  ✓ Firestore error cleared connectivityStore hasPendingWrites to false
  ✓ Firestore error populated inventoryStore.error
  ✓ Banner State A (Online, No Pending): Hidden
  ✓ Banner State B (Online, Has Pending): Shows "syncing" banner
  ✓ Banner State C (Offline, Has Pending): Offline banner takes precedence over syncing banner
  ✓ Banner State D (Offline, No Pending): Shows "offline" banner
  ✓ isSyncing is false before consume action
  ✓ Caught expected consume rejection
  ✓ isSyncing safely reset to false in finally block after consume failure
  ✓ Caught expected discard rejection
  ✓ isSyncing safely reset to false in finally block after discard failure
  ✓ Caught expected create rejection
  ✓ isSyncing safely reset to false in finally block after create failure
  ✓ Caught expected update rejection
  ✓ isSyncing safely reset to false in finally block after update failure

================================================================
TOTAL EMPIRICAL TESTS: 141
PASSED: 140
FAILED: 1
================================================================

FAILURES SUMMARY:
1. validateFirebaseConfig() without arguments crashed: [module runner] Dynamic access of "import.meta.env" is not supported. Please, use "import.meta.env.PUBLIC_FIREBASE_API_KEY" instead.
```

### 1.3 Verbatim Error Trace of Confirmed Bug
When `validateFirebaseConfig()` is called without arguments (as invoked by `getFirebaseInstance()` on line 158 of `src/lib/repositories/firebase.ts`):

```text
Error: [module runner] Dynamic access of "import.meta.env" is not supported. Please, use "import.meta.env.PUBLIC_FIREBASE_API_KEY" instead.
    at Object.get (/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/node_modules/vite/dist/node/module-runner.js:786:8)
    at readEnvValue (/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/repositories/firebase.ts:66:39)
    at getVal (/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/repositories/firebase.ts:83:20)
    at validateFirebaseConfig (/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/repositories/firebase.ts:87:18)
    at Module.getFirebaseInstance (/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/src/lib/repositories/firebase.ts:158:20)
```

And when running `getFirebaseInstance()` in any environment where `isBrowser()` is true or polyfilled (browser/test runner):
```text
[Firebase] Client initialization failed: Error: [module runner] Dynamic access of "import.meta.env" is not supported. Please, use "import.meta.env.PUBLIC_FIREBASE_API_KEY" instead.
Result mode: ssr-noop
```

---

## 2. Logic Chain

1. **Vite Dynamic `import.meta.env` Proxy Disallowance (Obs 1.2, 1.3)**:
   - In `src/lib/repositories/firebase.ts`, lines 64–76:
     ```typescript
     function readEnvValue(key: string): string | undefined {
       const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
       if (meta && meta.env && typeof meta.env[key] === 'string') {
         return meta.env[key];
       }
       ...
     ```
   - In Vite 6/8's Module Runner, `import.meta.env` is wrapped in a Proxy whose `get` trap explicitly throws an unhandled error whenever dynamic bracket indexing (`meta.env[key]`) is performed.
   - Because `readEnvValue` does not wrap `meta.env[key]` in a `try...catch` block, this unhandled exception crashes immediately.
   - It also completely bypasses lines 69–74 (`process.env[key]`) and lines 84 (`fallback: FIREBASE_DEFAULTS`).

2. **Cascade into `getFirebaseInstance()` (Obs 1.3)**:
   - Line 158 of `src/lib/repositories/firebase.ts` calls `validateFirebaseConfig()` without arguments:
     ```typescript
     export function getFirebaseInstance(): FirebaseServices {
       ...
       try {
         const config = validateFirebaseConfig();
     ```
   - Whenever `isBrowser()` is true (e.g., during Vite dev server operation, client tests, or happy-dom/jsdom execution), `validateFirebaseConfig()` throws the unhandled dynamic access error.
   - `getFirebaseInstance()` catches this, logs `[Firebase] Client initialization failed`, and drops into `mode: 'ssr-noop'`, preventing Firebase Firestore from ever initializing.

3. **Validation of Robust Components (Obs 1.2)**:
   - **Headless SSR Safety**: When `typeof window === 'undefined'`, `getFirebaseInstance()` immediately returns `mode: 'ssr-noop'`, `isMock: true`, `cacheType: 'none'` without attempting to initialize Firebase or touch IndexedDB. All accessors (`getFirestoreDb`, `getFirebaseAuth`, `getFirebaseApp`, `isFirebaseAvailable`) execute safely without throwing.
   - **Store Synchronization Lifecycle**: `subscribeToWorkspace` and `initWorkspaceSync` cleanly manage listener lifecycles. Peak concurrent active listeners strictly stayed at 1 across rapid 10-workspace switching and 100-switch fuzzing. Subscribes strictly matched unsubscribes with 0 memory leaks. Teardowns were verified to be idempotent and immune to outdated listener invalidation.
   - **Connectivity & UI Banner Reactivity**: `hasPendingWrites` propagates bidirectionally to both `inventoryStore` and `connectivityStore`. The UI banner priority truth table in `src/routes/+layout.svelte` strictly favors the offline banner (`network-banner offline`) over the syncing banner (`network-banner syncing`) when `online: false`. All action helpers (`consumeStockAction`, `discardStockAction`, `createProductAction`, `updateProductAction`) recover cleanly from repository rejections via their `finally` blocks, safely restoring `connectivityStore.isSyncing = false`.

---

## 3. Caveats

1. **Production Static Prerender Pass**:
   - `npm run build` succeeds because during prerendering `isBrowser()` is `false`, which bypasses `validateFirebaseConfig()`. The bug manifests when `validateFirebaseConfig()` is called directly without arguments or when `getFirebaseInstance()` runs under Vite ModuleRunner with browser globals active.
2. **IndexedDB Browser Scope**:
   - Multi-tab IndexedDB persistence (`persistentLocalCache({ tabManager: persistentMultipleTabManager() })`) requires a full Web browser runtime (Chromium/WebKit); this was verified via contract and fallback logic.

---

## 4. Conclusion

**Verdict: `REQUEST_CHANGES`**

While the store synchronization lifecycle, headless SSR safety, and `hasPendingWrites` UI reactivity passed 140/141 empirical stress tests with 0 listener leaks, a **blocking runtime bug** was discovered in `src/lib/repositories/firebase.ts`:

- **File**: `src/lib/repositories/firebase.ts:64-76` (`readEnvValue`)
- **Defect**: Dynamic bracket indexing `meta.env[key]` on Vite's `import.meta.env` Proxy throws `[module runner] Dynamic access of "import.meta.env" is not supported. Please, use "import.meta.env.PUBLIC_FIREBASE_API_KEY" instead.`.
- **Impact**: Any invocation of `validateFirebaseConfig()` without arguments (including inside `getFirebaseInstance()` on line 158) crashes, aborts Firebase client initialization, and forces fallback into `ssr-noop`.

### Required Fix for Worker:
In `src/lib/repositories/firebase.ts`, replace `readEnvValue` with static property mapping or wrapped try-catch:
```typescript
function readEnvValue(key: string): string | undefined {
  try {
    if (key === 'PUBLIC_FIREBASE_API_KEY') return import.meta.env.PUBLIC_FIREBASE_API_KEY;
    if (key === 'PUBLIC_FIREBASE_AUTH_DOMAIN') return import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN;
    if (key === 'PUBLIC_FIREBASE_PROJECT_ID') return import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    if (key === 'PUBLIC_FIREBASE_STORAGE_BUCKET') return import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (key === 'PUBLIC_FIREBASE_MESSAGING_SENDER_ID') return import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
    if (key === 'PUBLIC_FIREBASE_APP_ID') return import.meta.env.PUBLIC_FIREBASE_APP_ID;
    if (key === 'PUBLIC_FIREBASE_MEASUREMENT_ID') return import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID;
  } catch {
    // Dynamic access / Vite proxy guard
  }

  const proc = typeof globalThis !== 'undefined'
    ? (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
    : undefined;
  if (proc && proc.env && typeof proc.env[key] === 'string') {
    return proc.env[key];
  }
  return undefined;
}
```

---

## 5. Verification Method

To independently reproduce the bug and verify all 141 adversarial stress assertions:

```bash
# 1. Reproduce dynamic import.meta.env error in Vite SSR:
node -e "
const { createServer } = require('vite');
(async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const mod = await server.ssrLoadModule('./src/lib/repositories/firebase.ts');
    console.log('Testing validateFirebaseConfig()...');
    mod.validateFirebaseConfig();
    console.log('Success');
  } catch (e) {
    console.error('VERIFIED CRASH:', e.message);
  } finally {
    await server.close();
  }
})();
"

# 2. Run the complete 141-test adversarial sync & lifecycle suite:
node tests/adversarial/adversarial_sync_stress.js

# 3. Invalidation condition:
# Upon applying the required fix, 'node tests/adversarial/adversarial_sync_stress.js'
# must exit with code 0 and report:
# TOTAL EMPIRICAL TESTS: 141 | PASSED: 141 | FAILED: 0
```
