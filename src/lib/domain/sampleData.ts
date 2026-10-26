/**
 * StockControl PWA — Sample Kitchen Data Domain
 * Clean Architecture Pure TypeScript Domain Layer
 * Path: src/lib/domain/sampleData.ts
 */

import { addDaysSafe, formatDateISO } from './expiry';
import type { Product } from './models';

/**
 * Returns 8 realistic commercial kitchen ingredients with relative dates
 * calculated dynamically from baseDate, covering all expiry statuses
 * (expired, soon, week, ok) and common product categories with valid EAN-13 barcodes.
 */
export function getSampleKitchenProducts(baseDate: Date = new Date()): Omit<Product, 'id'>[] {
  const todayStr = formatDateISO(baseDate);

  return [
    // 1. Vencido (-1 día) -> Disparador de Alerta Crítica Roja (expired)
    {
      name: 'Leche entera pasteurizada',
      category: 'Lácteos',
      quantity: 4,
      unit: 'L',
      receivedDate: addDaysSafe(baseDate, -4),
      expiryDate: addDaysSafe(baseDate, -1),
      location: 'Refrigerador',
      lot: 'LOT-LAC-8801',
      supplier: 'Soprole Profesional',
      barcode: '7801234567890',
      notes: 'Cadena de frío 2°C a 4°C. Descartar por vencimiento si supera 72h.',
      isDiscarded: false,
      isConsumed: false,
      createdAt: todayStr,
      createdBy: 'Operador',
      updatedAt: todayStr,
      updatedBy: 'Operador',
      lastAction: 'create'
    },
    // 2. Vence Hoy (0 días) -> Disparador de Alerta Crítica Ámbar (soon)
    {
      name: 'Filete de salmón fresco',
      category: 'Pescados y mariscos',
      quantity: 3.5,
      unit: 'kg',
      receivedDate: addDaysSafe(baseDate, -1),
      expiryDate: addDaysSafe(baseDate, 0),
      location: 'Refrigerador',
      lot: 'PES-2026-X1',
      supplier: 'Pescadería Los Vilos',
      barcode: '7802345678901',
      notes: 'HACCP: Conservar sobre cama de hielo picado (0°C a 2°C). Consumo prioritario hoy.',
      isDiscarded: false,
      isConsumed: false,
      createdAt: todayStr,
      createdBy: 'Operador',
      updatedAt: todayStr,
      updatedBy: 'Operador',
      lastAction: 'create'
    },
    // 3. Vence en 2 días (+2 días) -> Prioridad FIFO (soon)
    {
      name: 'Pechuga de pollo deshuesada',
      category: 'Carnes',
      quantity: 8,
      unit: 'kg',
      receivedDate: todayStr,
      expiryDate: addDaysSafe(baseDate, 2),
      location: 'Refrigerador',
      lot: 'AV-1092',
      supplier: 'Agrosuper Gastronomía',
      barcode: '7803456789012',
      notes: 'Mise en place servicio almuerzo. Separar en bandejas rotuladas.',
      isDiscarded: false,
      isConsumed: false,
      createdAt: todayStr,
      createdBy: 'Operador',
      updatedAt: todayStr,
      updatedBy: 'Operador',
      lastAction: 'create'
    },
    // 4. Vence en 5 días (+5 días) -> Advertencia Semanal (week)
    {
      name: 'Queso Gouda laminado',
      category: 'Lácteos',
      quantity: 2.5,
      unit: 'kg',
      receivedDate: addDaysSafe(baseDate, -5),
      expiryDate: addDaysSafe(baseDate, 5),
      location: 'Refrigerador',
      lot: 'Q-552',
      supplier: 'Colun Horeca',
      barcode: '7804567890123',
      notes: 'Empaque sellado al vacío. Conservar en cuarto frío.',
      isDiscarded: false,
      isConsumed: false,
      createdAt: todayStr,
      createdBy: 'Operador',
      updatedAt: todayStr,
      updatedBy: 'Operador',
      lastAction: 'create'
    },
    // 5. Vence en 6 días (+6 días) -> Advertencia Semanal (week)
    {
      name: 'Tomate larga vida granel',
      category: 'Frutas y verduras',
      quantity: 12,
      unit: 'kg',
      receivedDate: addDaysSafe(baseDate, -2),
      expiryDate: addDaysSafe(baseDate, 6),
      location: 'Refrigerador',
      lot: 'VEG-303',
      supplier: 'Distribuidora La Vega',
      barcode: '7805678901234',
      notes: 'Lavado y desinfectado con hipoclorito de sodio al 50 ppm.',
      isDiscarded: false,
      isConsumed: false,
      createdAt: todayStr,
      createdBy: 'Operador',
      updatedAt: todayStr,
      updatedBy: 'Operador',
      lastAction: 'create'
    },
    // 6. Vigente (+60 días) -> Stock Seco (ok)
    {
      name: 'Arroz grano largo grado 1',
      category: 'Abarrotes y secos',
      quantity: 25,
      unit: 'kg',
      receivedDate: addDaysSafe(baseDate, -10),
      expiryDate: addDaysSafe(baseDate, 60),
      location: 'Bodega seca',
      lot: 'SEC-991',
      supplier: 'Tucapel Profesional',
      barcode: '7806789012345',
      notes: 'Almacenado sobre pallet plástico a 15 cm del suelo en bodega seca.',
      isDiscarded: false,
      isConsumed: false,
      createdAt: todayStr,
      createdBy: 'Operador',
      updatedAt: todayStr,
      updatedBy: 'Operador',
      lastAction: 'create'
    },
    // 7. Vigente (+90 días) -> Abarrote Líquido (ok)
    {
      name: 'Aceite de oliva extra virgen',
      category: 'Abarrotes y secos',
      quantity: 6,
      unit: 'L',
      receivedDate: addDaysSafe(baseDate, -15),
      expiryDate: addDaysSafe(baseDate, 90),
      location: 'Bodega seca',
      lot: 'OLV-771',
      supplier: 'Almazara Andina',
      barcode: '7807890123456',
      notes: 'Conservar en bidón oscuro protegido de radiación solar directa.',
      isDiscarded: false,
      isConsumed: false,
      createdAt: todayStr,
      createdBy: 'Operador',
      updatedAt: todayStr,
      updatedBy: 'Operador',
      lastAction: 'create'
    },
    // 8. Vigente (+45 días) -> Congelados (ok)
    {
      name: 'Masa de hojaldre en láminas',
      category: 'Congelados',
      quantity: 15,
      unit: 'paquete(s)',
      receivedDate: addDaysSafe(baseDate, -3),
      expiryDate: addDaysSafe(baseDate, 45),
      location: 'Congelador',
      lot: 'HOJ-44',
      supplier: 'Panificadora San Camilo',
      barcode: '7808901234567',
      notes: 'Cámara a -18°C. No recongelar tras descongelar.',
      isDiscarded: false,
      isConsumed: false,
      createdAt: todayStr,
      createdBy: 'Operador',
      updatedAt: todayStr,
      updatedBy: 'Operador',
      lastAction: 'create'
    }
  ];
}
