#!/usr/bin/env node
/**
 * StockControl PWA — Firestore Seeding Script
 * Populates workspaces/{workspaceId}/products and workspaces/{workspaceId}/history
 * with realistic restaurant inventory for testing and demonstration.
 *
 * Usage:
 *   node --env-file=.env scripts/seed-firestore.js [workspaceId]
 *   npm run seed
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  collection,
  writeBatch,
  getDocs
} from 'firebase/firestore';

// 1. Fallback .env loader if --env-file was omitted
function loadEnvFallback() {
  if (process.env.PUBLIC_FIREBASE_API_KEY && process.env.PUBLIC_FIREBASE_PROJECT_ID) {
    return;
  }
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvFallback();

const apiKey = process.env.PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.PUBLIC_FIREBASE_APP_ID;

if (!apiKey || !projectId) {
  console.error('\x1b[31m[ERROR]\x1b[0m Missing Firebase credentials in environment. Ensure .env exists with PUBLIC_FIREBASE_API_KEY and PUBLIC_FIREBASE_PROJECT_ID.');
  process.exit(1);
}

// 2. Parse target workspace
const rawWorkspace = process.argv[2] || process.env.TARGET_WORKSPACE || 'cocina-principal';
const workspaceId = rawWorkspace.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');

console.log('\x1b[36m=====================================================\x1b[0m');
console.log('\x1b[32m  StockControl PWA — Firestore Seeder\x1b[0m');
console.log(`  Project ID:   \x1b[33m${projectId}\x1b[0m`);
console.log(`  Workspace ID: \x1b[33m${workspaceId}\x1b[0m`);
console.log('\x1b[36m=====================================================\x1b[0m');

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper for dynamic ISO date calculation
function addDays(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const nowIso = new Date().toISOString();
const todayIsoDate = addDays(0);

// 3. Define Seed Items
const SEED_PRODUCTS = [
  // CARNES
  {
    name: 'Lomo Liso Vacuno Angus',
    category: 'Carnes',
    quantity: 14.5,
    unit: 'kg',
    receivedDate: addDays(-3),
    expiryDate: addDays(2), // Soon (2 days)
    location: 'Refrigerador',
    lot: 'VAC-2026-088',
    supplier: 'Carnes Ñuble',
    barcode: '7801234560011',
    notes: 'Corte premium para porcionar en bifes de 250g. Mantener a 0-2°C.',
    createdBy: 'Carlos - Chef Ejecutivo'
  },
  {
    name: 'Pechuga de Pollo Deshuesada',
    category: 'Carnes',
    quantity: 25.0,
    unit: 'kg',
    receivedDate: addDays(-4),
    expiryDate: addDays(0), // Soon (Expires today!)
    location: 'Refrigerador',
    lot: 'POL-9921',
    supplier: 'Agrosuper',
    barcode: '7801234560028',
    notes: 'Prioridad máxima de uso en menú del día o congelar inmediatamente.',
    createdBy: 'Marta - Bodega'
  },
  {
    name: 'Costillar de Cerdo Ahumado',
    category: 'Carnes',
    quantity: 10.0,
    unit: 'kg',
    receivedDate: addDays(-10),
    expiryDate: addDays(45), // Ok
    location: 'Congelador',
    lot: 'CER-401',
    supplier: 'Cecinas Llanquihue',
    barcode: '7801234560035',
    notes: 'Sellado al vacío, mantener a -18°C.',
    createdBy: 'Carlos - Chef Ejecutivo'
  },
  {
    name: 'Carne Molida Especial 4%',
    category: 'Carnes',
    quantity: 6.0,
    unit: 'kg',
    receivedDate: addDays(-5),
    expiryDate: addDays(-1), // Expired (-1 day)
    location: 'Refrigerador',
    lot: 'MOL-102',
    supplier: 'Frigorífico Temuco',
    barcode: '7801234560042',
    notes: 'Fecha vencida ayer. Revisar merma o descarte con chef.',
    createdBy: 'Juan - Cocinero'
  },

  // LÁCTEOS
  {
    name: 'Leche Entera Larga Vida 1L',
    category: 'Lácteos',
    quantity: 36.0,
    unit: 'L',
    receivedDate: addDays(-7),
    expiryDate: addDays(60), // Ok
    location: 'Bodega seca',
    lot: 'LEC-554',
    supplier: 'Colun',
    barcode: '7801234560059',
    notes: '3 cajas de 12 unidades. Almacenar en lugar fresco y seco.',
    createdBy: 'Marta - Bodega'
  },
  {
    name: 'Queso Mozzarella Barra',
    category: 'Lácteos',
    quantity: 8.5,
    unit: 'kg',
    receivedDate: addDays(-12),
    expiryDate: addDays(3), // Soon (3 days)
    location: 'Refrigerador',
    lot: 'MOZ-8812',
    supplier: 'Soprole Food Service',
    barcode: '7801234560066',
    notes: 'Ideal para pizzas y gratinados. Rayar por turnos.',
    createdBy: 'Sofía - Sous Chef'
  },
  {
    name: 'Crema de Leche Gastronómica 35%',
    category: 'Lácteos',
    quantity: 12.0,
    unit: 'L',
    receivedDate: addDays(-2),
    expiryDate: addDays(5), // Week (5 days)
    location: 'Refrigerador',
    lot: 'CRM-331',
    supplier: 'Nestlé Professional',
    barcode: '7801234560073',
    notes: 'Envases tetra de 1L.',
    createdBy: 'Carlos - Chef Ejecutivo'
  },
  {
    name: 'Yogurt Natural Balde 5L',
    category: 'Lácteos',
    quantity: 1.0,
    unit: 'unidad(es)',
    receivedDate: addDays(-15),
    expiryDate: addDays(-3), // Expired (-3 days)
    location: 'Refrigerador',
    lot: 'YOG-772',
    supplier: 'Quillayes',
    barcode: '7801234560080',
    notes: 'Retirar de cámara fría para registro de descarte.',
    createdBy: 'Marta - Bodega'
  },

  // PESCADOS Y MARISCOS
  {
    name: 'Filete de Salmón Atlántico Fresco',
    category: 'Pescados y mariscos',
    quantity: 5.8,
    unit: 'kg',
    receivedDate: addDays(-1),
    expiryDate: addDays(1), // Soon (Tomorrow)
    location: 'Refrigerador',
    lot: 'SAL-2026-X',
    supplier: 'AquaChile',
    barcode: '7801234560097',
    notes: 'Limpio sin espinas. Mantener sobre cama de hielo.',
    createdBy: 'Carlos - Chef Ejecutivo'
  },
  {
    name: 'Camarón Ecuatoriano 36/40 Pelado',
    category: 'Pescados y mariscos',
    quantity: 12.0,
    unit: 'kg',
    receivedDate: addDays(-20),
    expiryDate: addDays(90), // Ok
    location: 'Congelador',
    lot: 'CAM-552',
    supplier: 'Mar Austral',
    barcode: '7801234560103',
    notes: 'Bolsas de 1kg IQF. Descongelar en frío 24h antes.',
    createdBy: 'Marta - Bodega'
  },
  {
    name: 'Reineta Fresca Entera Eviscerada',
    category: 'Pescados y mariscos',
    quantity: 8.0,
    unit: 'kg',
    receivedDate: addDays(-2),
    expiryDate: addDays(0), // Soon (Expires today!)
    location: 'Refrigerador',
    lot: 'REI-109',
    supplier: 'Caleta Portales',
    barcode: '7801234560110',
    notes: 'Porcionar para almuerzo.',
    createdBy: 'Juan - Cocinero'
  },

  // FRUTAS Y VERDURAS
  {
    name: 'Tomate Larga Vida Primera',
    category: 'Frutas y verduras',
    quantity: 18.0,
    unit: 'kg',
    receivedDate: addDays(-3),
    expiryDate: addDays(4), // Week (4 days)
    location: 'Refrigerador',
    lot: 'TOM-441',
    supplier: 'Vega Central',
    barcode: '7801234560127',
    notes: 'Maduros firmes para ensaladas.',
    createdBy: 'Juan - Cocinero'
  },
  {
    name: 'Palta Hass Calibre Primera',
    category: 'Frutas y verduras',
    quantity: 15.0,
    unit: 'kg',
    receivedDate: addDays(-2),
    expiryDate: addDays(2), // Soon (2 days)
    location: 'Bodega seca',
    lot: 'PAL-332',
    supplier: 'Agrícola La Cruz',
    barcode: '7801234560134',
    notes: 'Punto óptimo de maduración.',
    createdBy: 'Sofía - Sous Chef'
  },
  {
    name: 'Cebolla Morada Granel',
    category: 'Frutas y verduras',
    quantity: 25.0,
    unit: 'kg',
    receivedDate: addDays(-5),
    expiryDate: addDays(25), // Ok
    location: 'Bodega seca',
    lot: 'CEB-101',
    supplier: 'Vega Poniente',
    barcode: '7801234560141',
    notes: 'Malla ventilada.',
    createdBy: 'Marta - Bodega'
  },
  {
    name: 'Mix Hojas Verdes Hidropónicas',
    category: 'Frutas y verduras',
    quantity: 8.0,
    unit: 'paquete(s)',
    receivedDate: addDays(-4),
    expiryDate: addDays(-1), // Expired (-1 day)
    location: 'Refrigerador',
    lot: 'MIX-009',
    supplier: 'Hortalizas del Valle',
    barcode: '7801234560158',
    notes: 'Hojas amarillentas, descartar.',
    createdBy: 'Juan - Cocinero'
  },

  // CONGELADOS
  {
    name: 'Papas Prefritas Corte Tradicional',
    category: 'Congelados',
    quantity: 40.0,
    unit: 'kg',
    receivedDate: addDays(-15),
    expiryDate: addDays(120), // Ok
    location: 'Congelador',
    lot: 'PAP-774',
    supplier: 'McCain',
    barcode: '7801234560165',
    notes: '8 bolsas de 2.5kg.',
    createdBy: 'Marta - Bodega'
  },
  {
    name: 'Pulpa de Maracuyá 100% Pura',
    category: 'Congelados',
    quantity: 10.0,
    unit: 'kg',
    receivedDate: addDays(-10),
    expiryDate: addDays(75), // Ok
    location: 'Congelador',
    lot: 'MAR-221',
    supplier: 'Minuto Verde',
    barcode: '7801234560172',
    notes: 'Para coctelería y postres.',
    createdBy: 'Sofía - Sous Chef'
  },

  // ABARROTES Y SECOS
  {
    name: 'Arroz Grano Largo Grado 1',
    category: 'Abarrotes y secos',
    quantity: 50.0,
    unit: 'kg',
    receivedDate: addDays(-30),
    expiryDate: addDays(180), // Ok
    location: 'Bodega seca',
    lot: 'ARR-901',
    supplier: 'Tucapel',
    barcode: '7801234560196',
    notes: 'Saco sellado sobre pallet.',
    createdBy: 'Marta - Bodega'
  },
  {
    name: 'Aceite de Maravilla Bidón 5L',
    category: 'Abarrotes y secos',
    quantity: 20.0,
    unit: 'L',
    receivedDate: addDays(-14),
    expiryDate: addDays(100), // Ok
    location: 'Bodega seca',
    lot: 'ACE-312',
    supplier: 'Chef Miraflores',
    barcode: '7801234560202',
    notes: '4 bidones de 5L.',
    createdBy: 'Carlos - Chef Ejecutivo'
  },

  // SALSAS Y ADEREZOS
  {
    name: 'Mayonesa Pasteurizada Base',
    category: 'Salsas y aderezos',
    quantity: 4.0,
    unit: 'L',
    receivedDate: addDays(-3),
    expiryDate: addDays(3), // Soon (3 days)
    location: 'Refrigerador',
    lot: 'MAY-110',
    supplier: 'Producción Cocina',
    barcode: '7801234560226',
    notes: 'Fraccionado en frascos etiquetados.',
    createdBy: 'Juan - Cocinero'
  },

  // PANADERÍA Y PASTELERÍA
  {
    name: 'Pan Brioche para Hamburguesa',
    category: 'Panadería y pastelería',
    quantity: 36.0,
    unit: 'unidad(es)',
    receivedDate: addDays(-1),
    expiryDate: addDays(2), // Soon (2 days)
    location: 'Bodega seca',
    lot: 'BRI-501',
    supplier: 'Panadería Central',
    barcode: '7801234560240',
    notes: '3 bolsas de 12 unidades.',
    createdBy: 'Carlos - Chef Ejecutivo'
  },

  // BEBIDAS
  {
    name: 'Agua Mineral sin Gas 500cc',
    category: 'Bebidas',
    quantity: 48.0,
    unit: 'botella(s)',
    receivedDate: addDays(-10),
    expiryDate: addDays(365), // Ok
    location: 'Bodega seca',
    lot: 'AGU-101',
    supplier: 'CCU',
    barcode: '7801234560264',
    notes: '2 packs de 24 botellas.',
    createdBy: 'Marta - Bodega'
  }
];

async function seed() {
  try {
    console.log('\n\x1b[34m[1/4] Writing Workspace Root Configuration...\x1b[0m');
    const wsRef = doc(db, 'workspaces', workspaceId);
    const wsData = {
      id: workspaceId,
      name: 'Cocina Principal',
      createdAt: nowIso,
      createdBy: 'Carlos - Chef Ejecutivo',
      settings: {
        criticalDaysThreshold: 3,
        warningDaysThreshold: 7,
        allowNegativeStock: false
      }
    };

    const batch = writeBatch(db);
    batch.set(wsRef, wsData, { merge: true });

    console.log('\x1b[34m[2/4] Preparing Products and Audit Ledger...\x1b[0m');
    let expiredCount = 0;
    let soonCount = 0;
    let weekCount = 0;
    let okCount = 0;

    for (let i = 0; i < SEED_PRODUCTS.length; i++) {
      const item = SEED_PRODUCTS[i];
      const prodRef = doc(collection(db, 'workspaces', workspaceId, 'products'));
      const histRef = doc(collection(db, 'workspaces', workspaceId, 'history'));
      const prodId = prodRef.id;

      // Status counters
      const diff = Math.round((new Date(item.expiryDate).getTime() - new Date(todayIsoDate).getTime()) / 86400000);
      if (diff < 0) expiredCount++;
      else if (diff <= 3) soonCount++;
      else if (diff <= 7) weekCount++;
      else okCount++;

      const productPayload = {
        id: prodId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        receivedDate: item.receivedDate,
        expiryDate: item.expiryDate,
        location: item.location,
        lot: item.lot,
        supplier: item.supplier,
        barcode: item.barcode,
        notes: item.notes,
        isDiscarded: false,
        isConsumed: false,
        createdAt: nowIso,
        createdBy: item.createdBy,
        updatedAt: nowIso,
        updatedBy: item.createdBy,
        lastAction: 'CREATE'
      };

      const historyPayload = {
        id: histRef.id,
        productId: prodId,
        productName: item.name,
        category: item.category,
        action: 'CREATE',
        quantityBefore: 0,
        quantityDelta: item.quantity,
        quantityAfter: item.quantity,
        unit: item.unit,
        operatorAlias: item.createdBy,
        operator: item.createdBy,
        timestamp: nowIso,
        amount: item.quantity,
        reason: 'Alta inicial de inventario (Seed)'
      };

      batch.set(prodRef, productPayload);
      batch.set(histRef, historyPayload);
    }

    // Append 1 sample consumed item and 1 discarded item for waste history demonstration
    const discardedHistRef = doc(collection(db, 'workspaces', workspaceId, 'history'));
    batch.set(discardedHistRef, {
      id: discardedHistRef.id,
      productId: 'hist-sample-discarded',
      productName: 'Yogurt Balde 5L Vencido',
      category: 'Lácteos',
      action: 'DISCARD',
      quantityBefore: 1.0,
      quantityDelta: -1.0,
      quantityAfter: 0,
      unit: 'unidad(es)',
      operatorAlias: 'Marta - Bodega',
      operator: 'Marta - Bodega',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      amount: 1.0,
      reason: 'vencimiento',
      notes: 'Descarte automático por fecha de caducidad superada'
    });

    const consumedHistRef = doc(collection(db, 'workspaces', workspaceId, 'history'));
    batch.set(consumedHistRef, {
      id: consumedHistRef.id,
      productId: 'hist-sample-consumed',
      productName: 'Filete de Salmón Atlántico',
      category: 'Pescados y mariscos',
      action: 'CONSUME_PARTIAL',
      quantityBefore: 9.8,
      quantityDelta: -4.0,
      quantityAfter: 5.8,
      unit: 'kg',
      operatorAlias: 'Juan - Cocinero',
      operator: 'Juan - Cocinero',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      amount: 4.0,
      reason: 'Consumo operacional turno almuerzo'
    });

    console.log('\x1b[34m[3/4] Committing WriteBatch to Firestore...\x1b[0m');
    await batch.commit();

    console.log('\x1b[34m[4/4] Verifying Seeded Documents in Cloud Firestore...\x1b[0m');
    const verifyProducts = await getDocs(collection(db, 'workspaces', workspaceId, 'products'));
    const verifyHistory = await getDocs(collection(db, 'workspaces', workspaceId, 'history'));

    console.log('\n\x1b[32m✔ SEED COMPLETED SUCCESSFULLY!\x1b[0m');
    console.log('-----------------------------------------------------');
    console.log(`  Total Products in Firestore: \x1b[1m${verifyProducts.size}\x1b[0m`);
    console.log(`  Total History Audit Records: \x1b[1m${verifyHistory.size}\x1b[0m`);
    console.log('-----------------------------------------------------');
    console.log('  \x1b[35mExpiry Breakdown:\x1b[0m');
    console.log(`    - Vencidos (Expired):       \x1b[31m${expiredCount}\x1b[0m`);
    console.log(`    - Vence hoy / 3 días (Soon):\x1b[33m${soonCount}\x1b[0m`);
    console.log(`    - Vence 4-7 días (Week):    \x1b[33m${weekCount}\x1b[0m`);
    console.log(`    - Vigentes (Ok):            \x1b[32m${okCount}\x1b[0m`);
    console.log('-----------------------------------------------------');
    console.log('Open StockControl PWA to see live real-time sync in action.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n\x1b[31m[FATAL SEED ERROR]\x1b[0m', error);
    process.exit(1);
  }
}

seed();
