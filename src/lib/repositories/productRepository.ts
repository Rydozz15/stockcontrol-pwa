/**
 * StockControl PWA — Firestore Product Repository
 * Clean Architecture Data Layer
 * Path: src/lib/repositories/productRepository.ts
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
  increment,
  type Firestore,
  type Unsubscribe
} from 'firebase/firestore';
import { getFirebaseInstance } from './firebase';
import type {
  Product,
  HistoryLog,
  WasteReason,
  AuditAction,
  ProductCategory,
  ProductUnit,
  StorageLocation
} from '$lib/domain/models';
import {
  normalizeCategory,
  normalizeUnit,
  normalizeLocation,
  normalizeQuantity,
  isValidWasteReason
} from '$lib/domain/models';

/**
 * Normalizes a workspace identifier: trims, lowercases, removes accents,
 * replaces non-alphanumeric chars with hyphens, and neutralizes directory traversal.
 */
export function normalizeWorkspaceId(raw: unknown): string {
  if (!raw || typeof raw !== 'string') return 'cocina-principal';
  const clean = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || 'cocina-principal';
}

/**
 * Normalizes operator alias: trims whitespace and defaults to 'Operador'.
 */
export function normalizeOperator(raw: unknown): string {
  if (typeof raw !== 'string') return 'Operador';
  const clean = raw.trim();
  return clean.length > 0 ? clean : 'Operador';
}

/**
 * Safe floating point subtraction avoiding IEEE 754 precision drift.
 * E.g., 0.3 - 0.1 strictly equals 0.2 instead of 0.19999999999999998.
 */
export function safeSubtract(a: number, b: number): number {
  const factor = 100000;
  return Math.round((a - b) * factor) / factor;
}

/**
 * Strips undefined properties to prevent Firestore serialization exceptions.
 */
export function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean as Partial<T>;
}

/**
 * Interface contract matching PROJECT.md Specification
 */
export interface IProductRepository {
  subscribeProducts(
    workspaceId: string,
    onData: (products: Product[], hasPendingWrites: boolean) => void,
    onError?: (err: Error) => void
  ): () => void;

  subscribeHistory(
    workspaceId: string,
    limitCount: number,
    onData: (history: HistoryLog[]) => void,
    onError?: (err: Error) => void
  ): () => void;

  createProduct(
    workspaceId: string,
    product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
    operator?: string
  ): Promise<string>;

  updateProduct(
    workspaceId: string,
    id: string,
    updates: Partial<Product>,
    operator: string
  ): Promise<void>;

  consumeStock(
    workspaceId: string,
    id: string,
    amount: number,
    operator: string,
    reason?: string
  ): Promise<void>;

  discardStock(
    workspaceId: string,
    id: string,
    reason: WasteReason | string,
    operator: string
  ): Promise<void>;

  deleteProduct(
    workspaceId: string,
    id: string,
    operator: string
  ): Promise<void>;

  restoreStock(
    workspaceId: string,
    id: string,
    amount: number,
    operator: string
  ): Promise<void>;

  batchImport(
    workspaceId: string,
    products: Omit<Product, 'id'>[],
    operator: string
  ): Promise<number>;
}

export class FirestoreProductRepository implements IProductRepository {
  private customDb: Firestore | null;

  constructor(customDb?: Firestore | null) {
    this.customDb = customDb || null;
  }

  private getDb(): Firestore | null {
    if (this.customDb) return this.customDb;
    const { db } = getFirebaseInstance();
    return db;
  }

  /**
   * Realtime listener on workspaces/{workspaceId}/products with { includeMetadataChanges: true }.
   * Results are sorted client-side by expiryDate ascending to eliminate composite index requirements.
   */
  subscribeProducts(
    workspaceId: string,
    onData: (products: Product[], hasPendingWrites: boolean) => void,
    onError?: (err: Error) => void
  ): () => void {
    const cleanWs = normalizeWorkspaceId(workspaceId);
    const db = this.getDb();

    if (!db) {
      onData([], false);
      return () => {};
    }

    const colRef = collection(db, 'workspaces', cleanWs, 'products');

    const unsubscribe = onSnapshot(
      colRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        const items: Product[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          items.push({
            id: docSnap.id,
            name: d.name || '',
            category: normalizeCategory(d.category),
            quantity: normalizeQuantity(d.quantity),
            unit: normalizeUnit(d.unit),
            receivedDate: d.receivedDate || d.received || '',
            expiryDate: d.expiryDate || d.expiry || '',
            location: normalizeLocation(d.location),
            lot: d.lot || '',
            supplier: d.supplier || '',
            barcode: d.barcode || '',
            notes: d.notes || '',
            isDiscarded: Boolean(d.isDiscarded),
            isConsumed: Boolean(d.isConsumed),
            createdAt: d.createdAt || '',
            createdBy: d.createdBy || 'Operador',
            createdByUid: d.createdByUid,
            updatedAt: d.updatedAt || '',
            updatedBy: d.updatedBy || 'Operador',
            updatedByUid: d.updatedByUid,
            lastAction: d.lastAction || 'create',
            consumedAt: d.consumedAt || null,
            consumedBy: d.consumedBy || null,
            discardedAt: d.discardedAt || null,
            discardedBy: d.discardedBy || null,
            discardReason: d.discardReason || null
          });
        });

        // Client-side sort: earliest expiryDate first; tie-break alphabetically by name
        items.sort((a, b) => {
          const dateDiff = (a.expiryDate || '').localeCompare(b.expiryDate || '');
          if (dateDiff !== 0) return dateDiff;
          return a.name.localeCompare(b.name);
        });

        onData(items, snapshot.metadata.hasPendingWrites);
      },
      (error) => {
        console.error(`[FirestoreProductRepository] subscribeProducts error in ${cleanWs}:`, error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  }

  /**
   * Realtime listener on workspaces/{workspaceId}/history ordered by timestamp desc.
   */
  subscribeHistory(
    workspaceId: string,
    limitCount: number = 50,
    onData: (history: HistoryLog[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const cleanWs = normalizeWorkspaceId(workspaceId);
    const db = this.getDb();

    if (!db) {
      onData([]);
      return () => {};
    }

    const histCol = collection(db, 'workspaces', cleanWs, 'history');
    const q = query(histCol, orderBy('timestamp', 'desc'), limit(Math.max(1, limitCount)));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const logs: HistoryLog[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          logs.push({
            id: docSnap.id,
            productId: d.productId || '',
            productName: d.productName || '',
            category: d.category || 'Otros',
            action: (d.action || 'create') as AuditAction,
            quantityBefore: typeof d.quantityBefore === 'number' ? d.quantityBefore : 0,
            quantityDelta: typeof d.quantityDelta === 'number' ? d.quantityDelta : 0,
            quantityAfter: typeof d.quantityAfter === 'number' ? d.quantityAfter : 0,
            unit: d.unit || 'unidad(es)',
            operatorAlias: d.operatorAlias || d.operator || 'Operador',
            operatorUid: d.operatorUid,
            timestamp: d.timestamp || new Date().toISOString(),
            reason: d.reason,
            notes: d.notes
          });
        });
        onData(logs);
      },
      (error) => {
        console.error(`[FirestoreProductRepository] subscribeHistory error in ${cleanWs}:`, error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  }

  /**
   * Creates a product with full audit stamping and initial history log.
   */
  async createProduct(
    workspaceId: string,
    product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
    operator?: string
  ): Promise<string> {
    const cleanWs = normalizeWorkspaceId(workspaceId);
    const cleanOp = normalizeOperator(operator || product.createdBy);
    const db = this.getDb();
    if (!db) throw new Error('Firestore is not available');

    const now = new Date().toISOString();
    const prodRef = doc(collection(db, 'workspaces', cleanWs, 'products'));
    const histRef = doc(collection(db, 'workspaces', cleanWs, 'history'));
    const prodId = prodRef.id;

    const validatedQty = normalizeQuantity(product.quantity);

    const newProduct: Product = {
      id: prodId,
      name: (product.name || '').trim(),
      category: normalizeCategory(product.category),
      quantity: validatedQty,
      unit: normalizeUnit(product.unit),
      receivedDate: product.receivedDate || now.slice(0, 10),
      expiryDate: product.expiryDate || now.slice(0, 10),
      location: normalizeLocation(product.location),
      lot: product.lot ? String(product.lot).trim() : '',
      supplier: product.supplier ? String(product.supplier).trim() : '',
      barcode: product.barcode ? String(product.barcode).trim() : '',
      notes: product.notes ? String(product.notes).trim() : '',
      isDiscarded: Boolean(product.isDiscarded),
      isConsumed: Boolean(product.isConsumed) || validatedQty <= 0,
      createdAt: now,
      createdBy: cleanOp,
      createdByUid: product.createdByUid,
      updatedAt: now,
      updatedBy: cleanOp,
      updatedByUid: product.createdByUid,
      lastAction: 'create'
    };

    const historyEntry = {
      id: histRef.id,
      productId: prodId,
      productName: newProduct.name,
      category: newProduct.category,
      action: 'create',
      quantityBefore: 0,
      quantityDelta: newProduct.quantity,
      quantityAfter: newProduct.quantity,
      unit: newProduct.unit,
      operatorAlias: cleanOp,
      operator: cleanOp, // dual mapping for test compatibility
      operatorUid: product.createdByUid,
      timestamp: now,
      amount: newProduct.quantity,
      reason: 'Alta de producto'
    };

    const batch = writeBatch(db);
    batch.set(prodRef, sanitizeFirestorePayload(newProduct));
    batch.set(histRef, sanitizeFirestorePayload(historyEntry));
    await batch.commit();

    return prodId;
  }

  /**
   * Updates an existing product document while strictly protecting immutable audit fields.
   */
  async updateProduct(
    workspaceId: string,
    id: string,
    updates: Partial<Product>,
    operator: string
  ): Promise<void> {
    const cleanWs = normalizeWorkspaceId(workspaceId);
    const cleanOp = normalizeOperator(operator);
    const db = this.getDb();
    if (!db) throw new Error('Firestore is not available');

    const now = new Date().toISOString();
    const prodRef = doc(db, 'workspaces', cleanWs, 'products', id);

    const normalizedQty = updates.quantity !== undefined ? normalizeQuantity(updates.quantity) : undefined;
    const safeUpdates: Record<string, any> = {
      ...updates,
      ...(normalizedQty !== undefined ? { quantity: normalizedQty } : {}),
      updatedAt: now,
      updatedBy: cleanOp,
      lastAction: updates.lastAction || 'update'
    };

    // Protect immutable identity and audit fields
    delete safeUpdates.id;
    delete safeUpdates.createdAt;
    delete safeUpdates.createdBy;
    delete safeUpdates.createdByUid;

    const batch = writeBatch(db);
    batch.update(prodRef, sanitizeFirestorePayload(safeUpdates));

    if (typeof updates.quantity === 'number') {
      const histRef = doc(collection(db, 'workspaces', cleanWs, 'history'));
      batch.set(histRef, {
        id: histRef.id,
        productId: id,
        productName: updates.name || 'Producto',
        category: updates.category || 'Otros',
        action: 'update',
        quantityDelta: 0,
        quantityAfter: normalizedQty !== undefined ? normalizedQty : updates.quantity,
        unit: updates.unit || 'unidad(es)',
        operatorAlias: cleanOp,
        operator: cleanOp,
        timestamp: now,
        reason: 'Actualización de producto'
      });
    }

    await batch.commit();
  }

  /**
   * Atomically decrements stock using increment(-amount) and writes an audit log.
   */
  async consumeStock(
    workspaceId: string,
    id: string,
    amount: number,
    operator: string,
    reason?: string
  ): Promise<void> {
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new Error(`Invalid consumption amount: ${amount}. Must be > 0.`);
    }

    const cleanWs = normalizeWorkspaceId(workspaceId);
    const cleanOp = normalizeOperator(operator);
    const db = this.getDb();
    if (!db) throw new Error('Firestore is not available');

    const prodRef = doc(db, 'workspaces', cleanWs, 'products', id);
    const prodSnap = await getDoc(prodRef);

    if (!prodSnap.exists()) {
      throw new Error(`Product ${id} not found in workspace ${cleanWs}`);
    }

    const current = prodSnap.data() as Product;
    if (current.isDiscarded) {
      throw new Error('Cannot consume discarded product');
    }
    if (current.isConsumed || (current.quantity ?? 0) <= 0) {
      throw new Error('Cannot consume: product has 0 available quantity');
    }
    if (amount > (current.quantity ?? 0)) {
      throw new Error(`Insufficient stock: requested ${amount}, available ${current.quantity}`);
    }

    const remainingQty = safeSubtract(current.quantity, amount);
    const isExhausted = remainingQty <= 0;
    const now = new Date().toISOString();

    const batch = writeBatch(db);

    batch.update(prodRef, {
      quantity: isExhausted ? 0 : remainingQty,
      isConsumed: isExhausted,
      updatedAt: now,
      updatedBy: cleanOp,
      lastAction: 'consume',
      ...(isExhausted ? { consumedAt: now, consumedBy: cleanOp } : {})
    });

    const histRef = doc(collection(db, 'workspaces', cleanWs, 'history'));
    batch.set(histRef, {
      id: histRef.id,
      productId: id,
      productName: current.name,
      category: current.category,
      action: 'consume',
      quantityBefore: current.quantity,
      quantityDelta: -amount,
      quantityAfter: remainingQty,
      unit: current.unit,
      operatorAlias: cleanOp,
      operator: cleanOp,
      amount: amount,
      timestamp: now,
      reason: reason || 'Consumo operacional'
    });

    await batch.commit();
  }

  /**
   * Discards remaining stock and marks product as discarded with HACCP reason.
   */
  async discardStock(
    workspaceId: string,
    id: string,
    reason: WasteReason | string,
    operator: string
  ): Promise<void> {
    const cleanWs = normalizeWorkspaceId(workspaceId);
    const cleanOp = normalizeOperator(operator);
    const db = this.getDb();
    if (!db) throw new Error('Firestore is not available');

    const prodRef = doc(db, 'workspaces', cleanWs, 'products', id);
    const prodSnap = await getDoc(prodRef);

    if (!prodSnap.exists()) {
      throw new Error(`Product ${id} not found in workspace ${cleanWs}`);
    }

    const current = prodSnap.data() as Product;
    if (current.isDiscarded) {
      throw new Error('Product is already discarded');
    }

    const now = new Date().toISOString();
    const batch = writeBatch(db);

    batch.update(prodRef, {
      quantity: 0,
      isDiscarded: true,
      isConsumed: false,
      discardedAt: now,
      discardedBy: cleanOp,
      discardReason: reason,
      updatedAt: now,
      updatedBy: cleanOp,
      lastAction: 'discard'
    });

    const histRef = doc(collection(db, 'workspaces', cleanWs, 'history'));
    batch.set(histRef, {
      id: histRef.id,
      productId: id,
      productName: current.name,
      category: current.category,
      action: 'discard',
      quantityBefore: current.quantity,
      quantityDelta: -current.quantity,
      quantityAfter: 0,
      unit: current.unit,
      operatorAlias: cleanOp,
      operator: cleanOp,
      amount: current.quantity,
      timestamp: now,
      reason: reason,
      notes: `Descarte por ${reason}`
    });

    await batch.commit();
  }

  /**
   * Deletes a product document and writes a deletion audit log.
   */
  async deleteProduct(workspaceId: string, id: string, operator: string): Promise<void> {
    const cleanWs = normalizeWorkspaceId(workspaceId);
    const cleanOp = normalizeOperator(operator);
    const db = this.getDb();
    if (!db) throw new Error('Firestore is not available');

    const prodRef = doc(db, 'workspaces', cleanWs, 'products', id);
    const prodSnap = await getDoc(prodRef);
    const current = prodSnap.exists() ? (prodSnap.data() as Product) : null;

    const now = new Date().toISOString();
    const batch = writeBatch(db);
    batch.delete(prodRef);

    const histRef = doc(collection(db, 'workspaces', cleanWs, 'history'));
    batch.set(histRef, {
      id: histRef.id,
      productId: id,
      productName: current?.name || 'Producto eliminado',
      category: current?.category || 'Otros',
      action: 'delete',
      quantityBefore: current?.quantity ?? 0,
      quantityDelta: -(current?.quantity ?? 0),
      quantityAfter: 0,
      unit: current?.unit || 'unidad(es)',
      operatorAlias: cleanOp,
      operator: cleanOp,
      timestamp: now,
      reason: 'Eliminación manual'
    });

    await batch.commit();
  }

  /**
   * Restores decremented stock (1-Tap Undo support).
   */
  async restoreStock(
    workspaceId: string,
    id: string,
    amount: number,
    operator: string
  ): Promise<void> {
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new Error(`Invalid restore amount: ${amount}`);
    }

    const cleanWs = normalizeWorkspaceId(workspaceId);
    const cleanOp = normalizeOperator(operator);
    const db = this.getDb();
    if (!db) throw new Error('Firestore is not available');

    const prodRef = doc(db, 'workspaces', cleanWs, 'products', id);
    const prodSnap = await getDoc(prodRef);
    const current = prodSnap.exists() ? (prodSnap.data() as Product) : null;

    const now = new Date().toISOString();
    const batch = writeBatch(db);

    const restoredQty = current && typeof current.quantity === 'number'
      ? safeSubtract(current.quantity, -amount)
      : increment(amount);

    batch.update(prodRef, {
      quantity: restoredQty,
      isConsumed: false,
      updatedAt: now,
      updatedBy: cleanOp,
      lastAction: 'undo_consume'
    });

    const histRef = doc(collection(db, 'workspaces', cleanWs, 'history'));
    batch.set(histRef, {
      id: histRef.id,
      productId: id,
      productName: current?.name || '',
      category: current?.category || 'Otros',
      action: 'update',
      quantityDelta: amount,
      unit: current?.unit || 'unidad(es)',
      operatorAlias: cleanOp,
      operator: cleanOp,
      amount,
      timestamp: now,
      reason: 'Deshacer consumo (Undo)'
    });

    await batch.commit();
  }

  /**
   * Bulk imports products in chunks of 200 items (400 operations)
   * to respect Firestore's 500-operation WriteBatch limit.
   */
  async batchImport(
    workspaceId: string,
    products: Omit<Product, 'id'>[],
    operator: string
  ): Promise<number> {
    const cleanWs = normalizeWorkspaceId(workspaceId);
    const cleanOp = normalizeOperator(operator);
    const db = this.getDb();
    if (!db) throw new Error('Firestore is not available');

    const now = new Date().toISOString();
    const CHUNK_SIZE = 200; // 2 writes per item = 400 operations max per batch
    let totalImported = 0;

    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
      const chunk = products.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const item of chunk) {
        const prodRef = doc(collection(db, 'workspaces', cleanWs, 'products'));
        const histRef = doc(collection(db, 'workspaces', cleanWs, 'history'));
        const id = prodRef.id;

        const validatedQty = normalizeQuantity(item.quantity);

        const newProd: Product = {
          id,
          name: (item.name || '').trim(),
          category: normalizeCategory(item.category),
          quantity: validatedQty,
          unit: normalizeUnit(item.unit),
          receivedDate: item.receivedDate || now.slice(0, 10),
          expiryDate: item.expiryDate || now.slice(0, 10),
          location: normalizeLocation(item.location),
          lot: item.lot ? String(item.lot).trim() : '',
          supplier: item.supplier ? String(item.supplier).trim() : '',
          barcode: item.barcode ? String(item.barcode).trim() : '',
          notes: item.notes ? String(item.notes).trim() : '',
          isDiscarded: Boolean(item.isDiscarded),
          isConsumed: Boolean(item.isConsumed) || validatedQty <= 0,
          createdAt: item.createdAt || now,
          createdBy: item.createdBy || cleanOp,
          createdByUid: item.createdByUid,
          updatedAt: item.updatedAt || now,
          updatedBy: cleanOp,
          updatedByUid: item.updatedByUid,
          lastAction: 'create'
        };

        const histEntry = {
          id: histRef.id,
          productId: id,
          productName: newProd.name,
          category: newProd.category,
          action: 'create',
          quantityBefore: 0,
          quantityDelta: newProd.quantity,
          quantityAfter: newProd.quantity,
          unit: newProd.unit,
          operatorAlias: cleanOp,
          operator: cleanOp,
          amount: newProd.quantity,
          timestamp: now,
          reason: 'Importación por lote'
        };

        batch.set(prodRef, sanitizeFirestorePayload(newProd));
        batch.set(histRef, sanitizeFirestorePayload(histEntry));
        totalImported++;
      }

      await batch.commit();
    }

    return totalImported;
  }
}

export const productRepository = new FirestoreProductRepository();
