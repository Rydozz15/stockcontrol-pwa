/**
 * StockControl PWA — Domain Models
 * Clean Architecture Pure TypeScript Domain Layer
 * Path: src/lib/domain/models.ts
 */

export const PRODUCT_CATEGORIES = [
  'Lácteos',
  'Carnes',
  'Pescados y mariscos',
  'Frutas y verduras',
  'Congelados',
  'Abarrotes y secos',
  'Panadería y pastelería',
  'Salsas y aderezos',
  'Bebidas',
  'Otros'
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_UNITS = [
  'unidad(es)',
  'kg',
  'g',
  'L',
  'ml',
  'porción(es)',
  'caja(s)',
  'paquete(s)',
  'botella(s)'
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const STORAGE_LOCATIONS = [
  'Refrigerador',
  'Congelador',
  'Bodega seca',
  'Vitrina',
  'Otro'
] as const;

export type StorageLocation = (typeof STORAGE_LOCATIONS)[number];

export const WASTE_REASONS = [
  'vencimiento',
  'rotura',
  'contaminacion',
  'calidad',
  'otro'
] as const;

export type WasteReason = (typeof WASTE_REASONS)[number];

export const WASTE_REASON_LABELS: Record<WasteReason, string> = {
  vencimiento: 'Fecha de vencimiento superada',
  rotura: 'Envase dañado / Rotura física',
  contaminacion: 'Contaminación cruzada / Exposición',
  calidad: 'Merma de calidad sensorial (olor/aspecto)',
  otro: 'Otro motivo'
};

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'CONSUME_PARTIAL',
  'CONSUME_FULL',
  'DISCARD',
  'DELETE',
  'RESTORE'
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const EXPIRY_STATUS_KEYS = ['expired', 'soon', 'week', 'ok'] as const;
export type ExpiryStatusKey = (typeof EXPIRY_STATUS_KEYS)[number];

export interface ExpiryStatus {
  key: ExpiryStatusKey;
  label: string;
  daysRemaining: number;
  cls: 'expired' | 'warning' | 'ok';
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  quantity: number; // Decimal/Float, >= 0
  unit: ProductUnit;
  receivedDate: string; // YYYY-MM-DD
  expiryDate: string;   // YYYY-MM-DD
  location: StorageLocation;
  lot?: string;
  supplier?: string;
  barcode?: string;
  notes?: string;

  // Lifecycle status flags
  isDiscarded: boolean;
  isConsumed: boolean;

  // Audit metadata (HACCP)
  createdAt: string;    // ISO 8601
  createdBy: string;    // Operator alias
  createdByUid?: string;
  updatedAt: string;    // ISO 8601
  updatedBy: string;    // Operator alias
  updatedByUid?: string;
  lastAction: AuditAction | string;

  // Waste & consumption tracking
  consumedAt?: string | null;
  consumedBy?: string | null;
  discardedAt?: string | null;
  discardedBy?: string | null;
  discardReason?: WasteReason | string | null;
}

export interface WorkspaceSettings {
  criticalDaysThreshold: number; // default: 3
  warningDaysThreshold: number;  // default: 7
  allowNegativeStock: boolean;   // default: false
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  criticalDaysThreshold: 3,
  warningDaysThreshold: 7,
  allowNegativeStock: false
};

export interface Workspace {
  id: string; // Workspace slug (e.g., 'cocina-principal')
  name: string;
  createdAt: string; // ISO 8601
  createdBy: string; // Operator alias
  settings: WorkspaceSettings;
}

export interface Operator {
  alias: string; // e.g. "Juan - Cocinero"
  uid?: string;  // Anonymous UID or device UUID
}

export interface HistoryLog {
  id: string;
  productId: string;
  productName: string;
  category: ProductCategory | string;
  action: AuditAction;
  quantityBefore: number;
  quantityDelta: number; // Negative for consumption/discard, positive for additions
  quantityAfter: number;
  unit: ProductUnit | string;
  operatorAlias: string;
  operatorUid?: string;
  timestamp: string; // ISO 8601
  reason?: WasteReason | string;
  notes?: string;
}

export interface InventoryMetrics {
  total: number;       // Active items (not discarded, quantity > 0)
  expired: number;     // daysRemaining < 0
  soon: number;        // 0 <= daysRemaining <= 3
  week: number;        // 4 <= daysRemaining <= 7
  ok: number;          // daysRemaining > 7
  within7Days: number; // 0 <= daysRemaining <= 7 (soon + week)
  criticalTotal: number; // expired + soon
  discardedCount: number;
  consumedCount: number;
}

// Validation & Type Guards
export function isValidCategory(val: unknown): val is ProductCategory {
  return typeof val === 'string' && (PRODUCT_CATEGORIES as readonly string[]).includes(val);
}

export function isValidUnit(val: unknown): val is ProductUnit {
  return typeof val === 'string' && (PRODUCT_UNITS as readonly string[]).includes(val);
}

export function isValidLocation(val: unknown): val is StorageLocation {
  return typeof val === 'string' && (STORAGE_LOCATIONS as readonly string[]).includes(val);
}

export function isValidWasteReason(val: unknown): val is WasteReason {
  return typeof val === 'string' && (WASTE_REASONS as readonly string[]).includes(val);
}

export function normalizeCategory(val: unknown): ProductCategory {
  return isValidCategory(val) ? val : 'Otros';
}

export function normalizeUnit(val: unknown): ProductUnit {
  return isValidUnit(val) ? val : 'unidad(es)';
}

export function normalizeLocation(val: unknown): StorageLocation {
  return isValidLocation(val) ? val : 'Refrigerador';
}

export function normalizeQuantity(val: unknown): number {
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num) || !isFinite(num) || num < 0) return 0;
  return Math.round((num + Number.EPSILON) * 1000) / 1000;
}
