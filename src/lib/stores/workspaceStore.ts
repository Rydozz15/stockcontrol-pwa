import { writable } from 'svelte/store';

export interface WorkspaceSession {
  workspaceId: string;
  operatorAlias: string;
  deviceId: string;
}

const STORAGE_KEY_WS = 'stockcontrol_workspace_id';
const STORAGE_KEY_OP = 'stockcontrol_operator_alias';
const STORAGE_KEY_DEV = 'stockcontrol_device_id';

export const DEFAULT_WORKSPACE = 'cocina-principal';
export const DEFAULT_OPERATOR = 'Cocinero';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function getStoredValue(key: string, fallback: string): string {
  if (!isBrowser()) return fallback;
  try {
    const val = localStorage.getItem(key);
    return val && val.trim().length > 0 ? val.trim() : fallback;
  } catch (err) {
    console.warn(`[workspaceStore] Failed to read ${key} from localStorage:`, err);
    return fallback;
  }
}

function setStoredValue(key: string, val: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, val);
  } catch (err) {
    console.warn(`[workspaceStore] Failed to write ${key} to localStorage:`, err);
  }
}

function getOrCreateDeviceId(): string {
  if (!isBrowser()) return 'server-preview';
  try {
    let devId = localStorage.getItem(STORAGE_KEY_DEV);
    if (!devId) {
      devId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(STORAGE_KEY_DEV, devId);
    }
    return devId;
  } catch {
    return 'dev_fallback';
  }
}

export function sanitizeWorkspaceId(input: string): string {
  if (!input || typeof input !== 'string') return DEFAULT_WORKSPACE;
  const sanitized = input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized.length > 0 ? sanitized : DEFAULT_WORKSPACE;
}

export function sanitizeOperatorAlias(input: string): string {
  if (!input || typeof input !== 'string') return DEFAULT_OPERATOR;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_OPERATOR;
}

export const normalizeWorkspaceId = sanitizeWorkspaceId;
export const normalizeOperator = sanitizeOperatorAlias;

function createWorkspaceStore() {
  const initialWorkspace = sanitizeWorkspaceId(getStoredValue(STORAGE_KEY_WS, DEFAULT_WORKSPACE));
  const initialOperator = sanitizeOperatorAlias(getStoredValue(STORAGE_KEY_OP, DEFAULT_OPERATOR));
  const initialDevice = getOrCreateDeviceId();

  const { subscribe, set, update } = writable<WorkspaceSession>({
    workspaceId: initialWorkspace,
    operatorAlias: initialOperator,
    deviceId: initialDevice
  });

  if (isBrowser()) {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === STORAGE_KEY_WS && event.newValue !== null) {
        const cleanWs = sanitizeWorkspaceId(event.newValue);
        update(s => ({ ...s, workspaceId: cleanWs }));
      } else if (event.key === STORAGE_KEY_OP && event.newValue !== null) {
        const cleanOp = sanitizeOperatorAlias(event.newValue);
        update(s => ({ ...s, operatorAlias: cleanOp }));
      }
    });
  }

  return {
    subscribe,
    setWorkspace(newId: string): string {
      const sanitized = sanitizeWorkspaceId(newId);
      setStoredValue(STORAGE_KEY_WS, sanitized);
      update(s => ({ ...s, workspaceId: sanitized }));
      return sanitized;
    },
    setOperator(newAlias: string): string {
      const sanitized = sanitizeOperatorAlias(newAlias);
      setStoredValue(STORAGE_KEY_OP, sanitized);
      update(s => ({ ...s, operatorAlias: sanitized }));
      return sanitized;
    },
    reset(): void {
      setStoredValue(STORAGE_KEY_WS, DEFAULT_WORKSPACE);
      setStoredValue(STORAGE_KEY_OP, DEFAULT_OPERATOR);
      update(s => ({
        ...s,
        workspaceId: DEFAULT_WORKSPACE,
        operatorAlias: DEFAULT_OPERATOR
      }));
    }
  };
}

export const workspaceStore = createWorkspaceStore();
