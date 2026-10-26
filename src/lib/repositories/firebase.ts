/**
 * StockControl PWA — Firebase Modular Client & Offline Persistence
 * Path: src/lib/repositories/firebase.ts
 *
 * Implements Firebase Modular SDK v11 with:
 * 1. Persistent IndexedDB local cache with multi-tab coordination (persistentMultipleTabManager).
 * 2. Graceful fallback to memoryLocalCache on private browsing or quota limits.
 * 3. Complete SSR / Static Prerender safety via isBrowser() guard.
 * 4. Non-blocking anonymous authentication with fallback for open kitchen mode.
 * 5. Singleton lifecycle management.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  type Firestore
} from 'firebase/firestore';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface FirebaseServices {
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  initialized: boolean;
  isMock: boolean;
  mode: 'client-firestore' | 'ssr-noop';
  cacheType: 'persistentLocalCache' | 'memoryLocalCache' | 'none';
}

export const FIREBASE_DEFAULTS: FirebaseConfig = {
  apiKey: '',
  authDomain: 'stockcontrol-86bb7.firebaseapp.com',
  projectId: 'stockcontrol-86bb7',
  storageBucket: 'stockcontrol-86bb7.firebasestorage.app',
  messagingSenderId: '196470947864',
  appId: '1:196470947864:web:cb6d7cf6684bcb9ac3436d',
  measurementId: 'G-MNEZ8T6841'
};

/**
 * SSR safety check: ensures browser DOM and storage APIs are available
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Diagnostic environment reader and configuration validator
 */
function readEnvValue(key: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (key === 'PUBLIC_FIREBASE_API_KEY') return import.meta.env.PUBLIC_FIREBASE_API_KEY;
      if (key === 'PUBLIC_FIREBASE_AUTH_DOMAIN') return import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN;
      if (key === 'PUBLIC_FIREBASE_PROJECT_ID') return import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
      if (key === 'PUBLIC_FIREBASE_STORAGE_BUCKET') return import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (key === 'PUBLIC_FIREBASE_MESSAGING_SENDER_ID') return import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
      if (key === 'PUBLIC_FIREBASE_APP_ID') return import.meta.env.PUBLIC_FIREBASE_APP_ID;
      if (key === 'PUBLIC_FIREBASE_MEASUREMENT_ID') return import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID;
    }
  } catch {
    // Dynamic access / Vite proxy guard: catch and ignore any proxy get trap exceptions
  }

  try {
    const proc = typeof globalThis !== 'undefined'
      ? (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
      : undefined;
    if (proc && proc.env && typeof proc.env[key] === 'string') {
      return proc.env[key];
    }
  } catch {
    // Guard against environments where process is restricted or inaccessible
  }

  return undefined;
}

export function validateFirebaseConfig(customEnv?: Record<string, string | undefined>): FirebaseConfig {
  const getVal = (key: string, fallback: string): string => {
    if (customEnv) {
      return customEnv[key] ?? '';
    }
    const envVal = readEnvValue(key);
    return envVal && envVal.trim().length > 0 ? envVal.trim() : fallback;
  };

  const apiKey = getVal('PUBLIC_FIREBASE_API_KEY', FIREBASE_DEFAULTS.apiKey);
  const authDomain = getVal('PUBLIC_FIREBASE_AUTH_DOMAIN', FIREBASE_DEFAULTS.authDomain);
  const projectId = getVal('PUBLIC_FIREBASE_PROJECT_ID', FIREBASE_DEFAULTS.projectId);
  const storageBucket = getVal('PUBLIC_FIREBASE_STORAGE_BUCKET', FIREBASE_DEFAULTS.storageBucket);
  const messagingSenderId = getVal('PUBLIC_FIREBASE_MESSAGING_SENDER_ID', FIREBASE_DEFAULTS.messagingSenderId);
  const appId = getVal('PUBLIC_FIREBASE_APP_ID', FIREBASE_DEFAULTS.appId);
  const measurementId = getVal('PUBLIC_FIREBASE_MEASUREMENT_ID', FIREBASE_DEFAULTS.measurementId || '');

  // Missing API key in environment throws clear diagnostic configuration error (B06-T01)
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('Firebase initialization failed: PUBLIC_FIREBASE_API_KEY is not defined in environment');
  }

  // Invalid projectId format validation (B06-T03)
  if (projectId && !/^[a-z0-9-]{6,30}$/.test(projectId)) {
    throw new Error(`Firebase initialization failed: Invalid projectId format "${projectId}"`);
  }

  // Malformed authDomain format validation (B06-T04)
  if (authDomain && !/^[a-z0-9.-]+\.firebaseapp\.com$/.test(authDomain)) {
    throw new Error(`Firebase initialization failed: Malformed authDomain format "${authDomain}"`);
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId
  };
}

// Singleton state
let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let cachedCacheType: 'persistentLocalCache' | 'memoryLocalCache' | 'none' = 'none';

/**
 * Returns the singleton Firebase services bundle.
 * On server-side prerender, returns an SSR-safe mock/noop structure without touching IndexedDB.
 */
export function getFirebaseInstance(): FirebaseServices {
  if (!isBrowser()) {
    return {
      app: null,
      db: null,
      auth: null,
      initialized: false,
      isMock: true,
      mode: 'ssr-noop',
      cacheType: 'none'
    };
  }

  // Singleton instance reuse
  if (cachedApp && cachedDb && cachedAuth) {
    return {
      app: cachedApp,
      db: cachedDb,
      auth: cachedAuth,
      initialized: true,
      isMock: false,
      mode: 'client-firestore',
      cacheType: cachedCacheType
    };
  }

  try {
    const config = validateFirebaseConfig();
    const existingApps = getApps();
    cachedApp = existingApps.length > 0 ? getApp() : initializeApp(config);

    // Initialize Firestore with multi-tab persistent cache & fallback
    try {
      cachedDb = initializeFirestore(cachedApp, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
      cachedCacheType = 'persistentLocalCache';
    } catch (persistErr: unknown) {
      const err = persistErr as { name?: string; code?: string; message?: string };
      if (err?.message && err.message.includes('has already been started')) {
        cachedDb = getFirestore(cachedApp);
        cachedCacheType = 'persistentLocalCache';
      } else {
        console.warn(
          '[Firebase] Persistent IndexedDB cache failed, falling back to memoryLocalCache:',
          err?.message || err
        );
        try {
          cachedDb = initializeFirestore(cachedApp, {
            localCache: memoryLocalCache()
          });
          cachedCacheType = 'memoryLocalCache';
        } catch {
          cachedDb = getFirestore(cachedApp);
          cachedCacheType = 'memoryLocalCache';
        }
      }
    }

    // Initialize Auth & non-blocking anonymous sign-in
    cachedAuth = getAuth(cachedApp);
    signInAnonymously(cachedAuth).catch((authErr: unknown) => {
      const msg = authErr instanceof Error ? authErr.message : String(authErr);
      console.info('[Firebase] Anonymous authentication deferred/unavailable; running in open kitchen mode:', msg);
    });

    return {
      app: cachedApp,
      db: cachedDb,
      auth: cachedAuth,
      initialized: true,
      isMock: false,
      mode: 'client-firestore',
      cacheType: cachedCacheType
    };
  } catch (initError) {
    console.error('[Firebase] Client initialization failed:', initError);
    return {
      app: null,
      db: null,
      auth: null,
      initialized: false,
      isMock: true,
      mode: 'ssr-noop',
      cacheType: 'none'
    };
  }
}

/**
 * Convenience accessor for Firestore database instance
 */
export function getFirestoreDb(): Firestore | null {
  return getFirebaseInstance().db;
}

/**
 * Convenience accessor for Firebase Auth instance
 */
export function getFirebaseAuth(): Auth | null {
  return getFirebaseInstance().auth;
}

/**
 * Convenience accessor for Firebase App instance
 */
export function getFirebaseApp(): FirebaseApp | null {
  return getFirebaseInstance().app;
}

/**
 * Helper to test whether Firebase client is operational in current environment
 */
export function isFirebaseAvailable(): boolean {
  return isBrowser() && getFirestoreDb() !== null;
}
