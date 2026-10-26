/**
 * Mock Firebase Firestore Module for Milestone 2 Adversarial Stress Testing
 * Path: tests/adversarial/mock_firestore.js
 */

export const mockFirestoreState = {
  /** @type {Map<string, Record<string, any>>} path -> docData */
  docs: new Map(),
  /** @type {Array<Array<{ op: 'set' | 'update' | 'delete', ref: any, data?: any }>>} */
  committedBatches: [],
  /** Total commit calls */
  commitCount: 0,
  /** Active onSnapshot listeners */
  listeners: new Map(),

  reset() {
    this.docs.clear();
    this.committedBatches = [];
    this.commitCount = 0;
    this.listeners.clear();
  },

  seedDoc(path, data) {
    this.docs.set(path, JSON.parse(JSON.stringify(data)));
  },

  getDocData(path) {
    const d = this.docs.get(path);
    return d ? JSON.parse(JSON.stringify(d)) : undefined;
  }
};

let autoIdCounter = 1000;

export function collection(parent, ...segments) {
  const basePath = parent && parent.path ? parent.path : '';
  const relPath = segments.filter(Boolean).join('/');
  const fullPath = basePath ? `${basePath}/${relPath}` : relPath;
  return {
    type: 'collection',
    path: fullPath
  };
}

export function doc(parent, ...segments) {
  const basePath = parent && parent.path ? parent.path : '';
  let id;
  let fullPath;

  if (segments.length === 0) {
    // Auto-generated ID (doc(collectionRef))
    id = `auto_doc_${++autoIdCounter}`;
    fullPath = basePath ? `${basePath}/${id}` : id;
  } else {
    // Explicit doc path: doc(db, 'workspaces', ws, 'products', id)
    id = segments[segments.length - 1];
    const relPath = segments.join('/');
    fullPath = basePath ? `${basePath}/${relPath}` : relPath;
  }

  return {
    type: 'document',
    id,
    path: fullPath
  };
}

export async function getDoc(docRef) {
  const data = mockFirestoreState.docs.get(docRef.path);
  return {
    id: docRef.id,
    ref: docRef,
    exists: () => data !== undefined,
    data: () => (data !== undefined ? JSON.parse(JSON.stringify(data)) : undefined)
  };
}

export function writeBatch(db) {
  const ops = [];
  return {
    set(ref, data) {
      ops.push({ op: 'set', ref, data: JSON.parse(JSON.stringify(data)) });
    },
    update(ref, data) {
      ops.push({ op: 'update', ref, data: JSON.parse(JSON.stringify(data)) });
    },
    delete(ref) {
      ops.push({ op: 'delete', ref });
    },
    async commit() {
      mockFirestoreState.commitCount++;
      const currentOps = [...ops];
      mockFirestoreState.committedBatches.push(currentOps);

      for (const op of currentOps) {
        if (op.op === 'set') {
          mockFirestoreState.docs.set(op.ref.path, op.data);
        } else if (op.op === 'update') {
          const current = mockFirestoreState.docs.get(op.ref.path) || {};
          const merged = { ...current };
          for (const [k, v] of Object.entries(op.data)) {
            if (v && typeof v === 'object' && v._methodName === 'FieldValue.increment') {
              merged[k] = (merged[k] ?? 0) + v.operand;
            } else {
              merged[k] = v;
            }
          }
          mockFirestoreState.docs.set(op.ref.path, merged);
        } else if (op.op === 'delete') {
          mockFirestoreState.docs.delete(op.ref.path);
        }
      }
      ops.length = 0;
    }
  };
}

export function increment(operand) {
  return {
    _methodName: 'FieldValue.increment',
    operand
  };
}

export function query(col, ...constraints) {
  return {
    type: 'query',
    col,
    constraints
  };
}

export function orderBy(field, direction = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(n) {
  return { type: 'limit', n };
}

export function onSnapshot(target, optionsOrCb, cb, errCb) {
  const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb;
  const listenerId = `listener_${++autoIdCounter}`;
  mockFirestoreState.listeners.set(listenerId, { target, callback });

  return () => {
    mockFirestoreState.listeners.delete(listenerId);
  };
}
