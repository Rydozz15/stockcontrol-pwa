/**
 * StockControl PWA — Waste & Stock Consumption Domain Logic
 * Clean Architecture Pure TypeScript Domain Layer
 * Path: src/lib/domain/waste.ts
 */

import type {
  AuditAction,
  HistoryLog,
  Product,
  WasteReason
} from './models';
import { WASTE_REASON_LABELS } from './models';

/**
 * Rounds numeric stock quantities to 3 decimal places to avoid IEEE 754 float drift.
 * E.g., 1.0 - 0.2 = 0.8 instead of 0.8000000000000002.
 */
export function roundQuantity(val: number): number {
  return Math.round((val + Number.EPSILON) * 1000) / 1000;
}

/**
 * Generates an audit ID with millisecond precision and random suffix.
 */
export function generateAuditId(prefix = 'hist'): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

export interface ConsumeOptions {
  amount?: number;               // Quantity to consume, default: 1
  operator: string;             // Operator alias (e.g. "Juan - Cocinero")
  operatorUid?: string;
  reason?: string;              // default: "Consumo en servicio"
  notes?: string;
  allowNegativeStock?: boolean; // default: false
  timestamp?: string;           // default: current ISO 8601
}

export interface ConsumeResult {
  updatedProduct: Product;
  historyLog: HistoryLog;
  isFullyExhausted: boolean;
  actualAmountConsumed: number;
}

/**
 * Pure business logic for consuming stock (Feature 15).
 * Decrements quantity, handles full exhaustion flag, records HACCP audit entry.
 */
export function consumeProductStock(
  product: Product,
  options: ConsumeOptions
): ConsumeResult {
  const now = options.timestamp || new Date().toISOString();
  const desiredAmount = Math.max(0, options.amount ?? 1);
  const allowNegative = options.allowNegativeStock ?? false;

  if (product.isDiscarded) {
    throw new Error(`No se puede consumir el producto "${product.name}" porque ha sido descartado.`);
  }

  if (product.quantity <= 0 && !allowNegative) {
    throw new Error(`El producto "${product.name}" no tiene existencias disponibles.`);
  }

  // Calculate actual decrement
  const actualAmountConsumed = allowNegative
    ? desiredAmount
    : Math.min(product.quantity, desiredAmount);

  const newQuantity = roundQuantity(product.quantity - actualAmountConsumed);
  const isFullyExhausted = newQuantity <= 0;
  const action: AuditAction = isFullyExhausted ? 'CONSUME_FULL' : 'CONSUME_PARTIAL';

  const updatedProduct: Product = {
    ...product,
    quantity: allowNegative ? newQuantity : Math.max(0, newQuantity),
    isConsumed: isFullyExhausted,
    lastAction: action,
    updatedAt: now,
    updatedBy: options.operator,
    updatedByUid: options.operatorUid,
    ...(isFullyExhausted
      ? {
          consumedAt: now,
          consumedBy: options.operator
        }
      : {})
  };

  const historyLog: HistoryLog = {
    id: generateAuditId('hist'),
    productId: product.id,
    productName: product.name,
    category: product.category,
    action,
    quantityBefore: product.quantity,
    quantityDelta: roundQuantity(-actualAmountConsumed),
    quantityAfter: updatedProduct.quantity,
    unit: product.unit,
    operatorAlias: options.operator,
    operatorUid: options.operatorUid,
    timestamp: now,
    reason: options.reason || 'Consumo en servicio',
    notes: options.notes
  };

  return {
    updatedProduct,
    historyLog,
    isFullyExhausted,
    actualAmountConsumed
  };
}

export interface DiscardOptions {
  amount?: number;              // default: all remaining stock
  reason: WasteReason | string; // 'vencimiento' | 'rotura' | 'contaminacion' | 'calidad' | 'otro'
  operator: string;             // Operator alias
  operatorUid?: string;
  notes?: string;
  timestamp?: string;           // default: current ISO 8601
}

export interface DiscardResult {
  updatedProduct: Product;
  historyLog: HistoryLog;
  isFullyDiscarded: boolean;
  actualAmountDiscarded: number;
}

/**
 * Pure business logic for discarding food / logging waste (Merma) (Feature 15).
 * Updates product flags and creates HACCP food waste audit log.
 */
export function discardProductStock(
  product: Product,
  options: DiscardOptions
): DiscardResult {
  const now = options.timestamp || new Date().toISOString();
  const discardAmount = options.amount !== undefined ? Math.max(0, options.amount) : product.quantity;
  const actualAmountDiscarded = Math.min(product.quantity, discardAmount);
  const newQuantity = roundQuantity(product.quantity - actualAmountDiscarded);
  const isFullyDiscarded = newQuantity <= 0;

  const updatedProduct: Product = {
    ...product,
    quantity: Math.max(0, newQuantity),
    isDiscarded: isFullyDiscarded ? true : product.isDiscarded,
    lastAction: 'DISCARD',
    updatedAt: now,
    updatedBy: options.operator,
    updatedByUid: options.operatorUid,
    discardedAt: now,
    discardedBy: options.operator,
    discardReason: options.reason
  };

  const historyLog: HistoryLog = {
    id: generateAuditId('hist'),
    productId: product.id,
    productName: product.name,
    category: product.category,
    action: 'DISCARD',
    quantityBefore: product.quantity,
    quantityDelta: roundQuantity(-actualAmountDiscarded),
    quantityAfter: updatedProduct.quantity,
    unit: product.unit,
    operatorAlias: options.operator,
    operatorUid: options.operatorUid,
    timestamp: now,
    reason: options.reason,
    notes: options.notes
  };

  return {
    updatedProduct,
    historyLog,
    isFullyDiscarded,
    actualAmountDiscarded
  };
}

export interface RestoreResult {
  updatedProduct: Product;
  historyLog: HistoryLog;
}

/**
 * Pure business logic to undo / restore a stock mutation (e.g. from 4s Toast Undo action).
 */
export function restoreProductStock(
  currentProduct: Product,
  logToRevert: HistoryLog,
  operator: string,
  operatorUid?: string,
  timestamp?: string
): RestoreResult {
  const now = timestamp || new Date().toISOString();
  // Reverse the delta (if consumed -1, delta is -1, so restored is +1)
  const restoredQuantity = roundQuantity(currentProduct.quantity - logToRevert.quantityDelta);

  const updatedProduct: Product = {
    ...currentProduct,
    quantity: Math.max(0, restoredQuantity),
    isConsumed: restoredQuantity <= 0 ? currentProduct.isConsumed : false,
    isDiscarded: logToRevert.action === 'DISCARD' ? false : currentProduct.isDiscarded,
    lastAction: 'RESTORE',
    updatedAt: now,
    updatedBy: operator,
    updatedByUid: operatorUid
  };

  const historyLog: HistoryLog = {
    id: generateAuditId('hist'),
    productId: currentProduct.id,
    productName: currentProduct.name,
    category: currentProduct.category,
    action: 'RESTORE',
    quantityBefore: currentProduct.quantity,
    quantityDelta: roundQuantity(-logToRevert.quantityDelta),
    quantityAfter: updatedProduct.quantity,
    unit: currentProduct.unit,
    operatorAlias: operator,
    operatorUid,
    timestamp: now,
    reason: `Deshacer acción ${logToRevert.action} (${logToRevert.id})`,
    notes: logToRevert.notes
  };

  return {
    updatedProduct,
    historyLog
  };
}

/**
 * Formats a HistoryLog entry into a standardized HACCP inspector text audit line.
 */
export function formatHaccpAuditEntry(log: HistoryLog): string {
  const reasonText = (log.reason && log.reason in WASTE_REASON_LABELS)
    ? WASTE_REASON_LABELS[log.reason as WasteReason]
    : (log.reason || 'Sin motivo especificado');

  const sign = log.quantityDelta > 0 ? '+' : '';
  const dateFormatted = log.timestamp.replace('T', ' ').slice(0, 19);

  return `[${dateFormatted}] [${log.action}] ${log.productName} (${log.category}) | Cambio: ${sign}${log.quantityDelta} ${log.unit} (Stock: ${log.quantityAfter}) | Operador: ${log.operatorAlias} | Motivo: ${reasonText}`;
}

export interface WasteSummaryItem {
  reason: string;
  totalQuantity: number;
  incidentCount: number;
}

/**
 * Aggregates waste and discard logs into a HACCP summary by reason.
 */
export function summarizeWasteLogs(logs: HistoryLog[]): Record<string, WasteSummaryItem> {
  const summary: Record<string, WasteSummaryItem> = {};

  for (const log of logs) {
    if (log.action !== 'DISCARD') continue;
    const rawReason = String(log.reason || 'otro');
    const label = (rawReason in WASTE_REASON_LABELS)
      ? WASTE_REASON_LABELS[rawReason as WasteReason]
      : rawReason;

    if (!summary[rawReason]) {
      summary[rawReason] = {
        reason: label,
        totalQuantity: 0,
        incidentCount: 0
      };
    }

    summary[rawReason].totalQuantity = roundQuantity(
      summary[rawReason].totalQuantity + Math.abs(log.quantityDelta)
    );
    summary[rawReason].incidentCount += 1;
  }

  return summary;
}
