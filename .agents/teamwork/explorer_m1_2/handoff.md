# Domain Layer Architectural Specification & Design Report: StockControl PWA

**Agent**: `explorer_m1_2` (Domain Logic Explorer)  
**Target Path**: `src/lib/domain/` (`models.ts`, `expiry.ts`, `waste.ts`)  
**Working Directory**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_2/`  
**Date**: 2026-10-25T20:30:00Z  
**Parent**: `1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c`

---

## 1. Observation

Direct observations from the project codebase, legacy prototype, and architectural specifications:

### 1.1 Requirements & Specifications
- **File**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md`:
  - Lines 34–35: `R2. Arquitectura Limpia y Modularización`: "Capa de Dominio (`src/lib/domain/`): Lógica pura de cálculo de caducidades, categorización reactiva de estados (vencido, vence hoy / 3 días, vence semana, vigente), reglas de mermas y alertas sin acoplamiento a la interfaz."
  - Lines 28–30: `R1. Módulo Colaborativo`: Shared kitchen workspace identifier (`cocina-principal`), operator identity/alias (`"Juan - Cocinero"`, `"Marta - Bodega"`), and mutation audit trail (createdBy, updatedBy, consumedBy, discardedBy).
  - Lines 43–44: `R3. Ergonomía de Cocina`: Quick expiry buttons (`+2 días`, `+3 días`, `+1 semana`, `+1 mes`) and 1-tap consumption/waste buttons on cards.
- **File**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`:
  - Lines 98–124: Interface contract for `Product`, `calculateExpiryStatus`, and `calculateMetrics`.
  - Lines 35–39: Layer definition for `src/lib/domain/` containing `models.ts`, `expiry.ts`, and `waste.ts`.
- **File**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/TEST_INFRA.md`:
  - Lines 10–15: Features 2 & 3: Pure domain expiry categorization and domain waste & audit models across Tiers 1-4.
  - Lines 17: Tier 2 Boundary checks including leap year expiry, month overflow clamping (Jan 31 + 1m), and zero/negative quantity handling.

### 1.2 Legacy Prototype Analysis
- **File**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/index.html`:
  - Lines 47–56: Product attributes and option lists:
    - Categories: `Lácteos`, `Carnes`, `Pescados y mariscos`, `Frutas y verduras`, `Congelados`, `Abarrotes y secos`, `Panadería y pastelería`, `Salsas y aderezos`, `Bebidas`, `Otros`.
    - Units: `unidad(es)`, `kg`, `g`, `L`, `ml`, `porción(es)`, `caja(s)`, `paquete(s)`, `botella(s)`.
    - Locations: `Refrigerador`, `Congelador`, `Bodega seca`, `Vitrina`, `Otro`.
  - Line 80: Date math: `const dayDiff=date=>{if(!date)return 99999;const d=new Date(date+'T00:00:00');return Math.round((d-today())/86400000)};`
  - Line 81: Expiry categorization:
    - `dayDiff < 0`: `'expired'` ("Vencido hace X día(s)")
    - `dayDiff === 0`: `'soon'` ("Vence hoy")
    - `dayDiff <= 3`: `'soon'` ("Vence en X día(s)")
    - `dayDiff <= 7`: `'week'` ("Vence en X días")
    - `dayDiff > 7`: `'ok'` ("Vigente")
  - Lines 87–90: Metrics counters (`countAll`, `countExpired`, `countSoon`, `countWeek`).
  - Lines 102: Form fields `name`, `category`, `quantity`, `unit`, `received`, `expiry`, `location`, `lot`, `supplier`, `notes`.

### 1.3 Executable Verification
- Executed: `node .agents/teamwork/explorer_m1_2/verify_domain.js`
- Result: 7 test suites executed, 0 failures, exit code 0:
  - Calendar validation & leap day handling verified.
  - Expiry status thresholds (-1, 0, 1..3, 4..7, >7) verified.
  - Month overflow clamping (Jan 31 + 1m -> Feb 28/29) verified.
  - Disjoint partition invariant `total === expired + soon + week + ok` verified.
  - Floating point decimal stock depletion (`1.0 - 0.2 = 0.8`) verified.
  - Full vs partial consumption and discard HACCP audit entries verified.

---

## 2. Logic Chain

From the observations above, the domain layer architecture is derived systematically:

### Step 1: Clean Architecture Isolation (from Obs 1.1)
- The domain layer must be 100% pure TypeScript: no DOM APIs (`window`, `document`), no UI framework dependencies (`svelte`), and no database drivers (`firebase`, `IndexedDB`).
- Pure domain models and functions allow instantaneous execution in any environment (Vite, SvelteKit SSR prerender, Node.js E2E test runners, web workers).

### Step 2: Timezone Skew Immunity in Date Math (from Obs 1.2)
- In JavaScript, `new Date("2026-10-25")` parses as UTC midnight (`2026-10-25T00:00:00.000Z`). In UTC-3 (Chile/Argentina) or UTC-5 (Colombia/Peru), querying `.getHours()` or `.getDate()` yields 21:00 or 19:00 of the previous day (`2026-10-24`), causing false premature expirations.
- *Solution*: A custom parser `parseLocalDate(dateStr: string): Date | null` extracts year, month, and day as integers via regex (`/^(\d{4})-(\d{2})-(\d{2})$/`) and instantiates `new Date(year, month - 1, day, 0, 0, 0, 0)`.
- Conversely, `formatDateISO(date: Date): string` formats local date components rather than `.toISOString().slice(0, 10)`, guaranteeing timezone immunity.

### Step 3: Month Overflow Clamping for Kitchen Presets (from Obs 1.1 & 1.3)
- Chefs require rapid 1-touch expiry buttons (`+2d`, `+3d`, `+1w`, `+1m`).
- A standard naive JavaScript `date.setMonth(date.getMonth() + 1)` on January 31 rolls into March (e.g., March 3 in a non-leap year), jumping past February entirely.
- In commercial kitchen prep, `+1 mes` from Jan 31 must land on the final day of February (Feb 28 in non-leap years, Feb 29 in leap years).
- *Solution*: `addMonthsSafe(baseDate, monthsToAdd)` calculates the maximum valid day of the target month via `new Date(targetYear, targetMonth + 1, 0).getDate()` and clamps the day with `Math.min(originalDay, daysInTargetMonth)`.

### Step 4: Disjoint Mathematical Metrics Partitioning (from Obs 1.1 & 1.2)
- In the prototype, `countWeek` counted items expiring within 0 to 7 days, overlapping with `countSoon` (0 to 3 days). This created confusing dashboard numbers where the sum of categories exceeded the total stock.
- *Solution*: The status taxonomy is strictly disjoint:
  - `expired`: `daysRemaining < 0`
  - `soon`: `0 <= daysRemaining <= 3`
  - `week`: `4 <= daysRemaining <= 7`
  - `ok`: `daysRemaining > 7`
- *Invariant*: `total === expired + soon + week + ok` holds strictly for all active products. Cumulative metrics (`within7Days = soon + week`, `criticalTotal = expired + soon`) are provided as explicit derived fields.

### Step 5: IEEE-754 Decimal Float Drift Prevention (from Obs 1.1 & 1.3)
- Restaurant stocks use fractional measurements (e.g., `0.250 kg`, `1.500 L`).
- JavaScript standard math yields `1.0 - 0.2 = 0.8000000000000002`. Repeated operations cause accumulative rounding errors in database documents.
- *Solution*: All stock arithmetic routes through `roundQuantity(val) = Math.round((val + Number.EPSILON) * 1000) / 1000`, enforcing clean 3-decimal precision.

### Step 6: HACCP Audit Traceability & 1-Tap Undo (from Obs 1.1)
- Food safety regulations (HACCP) require recording every stock movement: who, when, what product, how much, and why.
- Direct consumption decrements stock; when stock reaches 0, `isConsumed: true` and `lastAction: 'CONSUME_FULL'` are automatically applied.
- Waste/discarding requires a reason (`vencimiento`, `rotura`, `contaminacion`, `calidad`, `otro`).
- Accidental taps in fast-paced service can be reverted via `restoreProductStock()`, which reverses the delta and generates an explicit `'RESTORE'` audit entry.

---

## 3. Detailed Specification & Code Artifacts

The complete domain implementation has been generated in the working directory:
1. `proposed_models.ts`
2. `proposed_expiry.ts`
3. `proposed_waste.ts`

### 3.1 `src/lib/domain/models.ts`
Key interfaces and constants:
```typescript
export const PRODUCT_CATEGORIES = [
  'Lácteos', 'Carnes', 'Pescados y mariscos', 'Frutas y verduras',
  'Congelados', 'Abarrotes y secos', 'Panadería y pastelería',
  'Salsas y aderezos', 'Bebidas', 'Otros'
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_UNITS = [
  'unidad(es)', 'kg', 'g', 'L', 'ml',
  'porción(es)', 'caja(s)', 'paquete(s)', 'botella(s)'
] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const STORAGE_LOCATIONS = [
  'Refrigerador', 'Congelador', 'Bodega seca', 'Vitrina', 'Otro'
] as const;
export type StorageLocation = (typeof STORAGE_LOCATIONS)[number];

export const WASTE_REASONS = [
  'vencimiento', 'rotura', 'contaminacion', 'calidad', 'otro'
] as const;
export type WasteReason = (typeof WASTE_REASONS)[number];

export const AUDIT_ACTIONS = [
  'CREATE', 'UPDATE', 'CONSUME_PARTIAL', 'CONSUME_FULL',
  'DISCARD', 'DELETE', 'RESTORE'
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  quantity: number;
  unit: ProductUnit;
  receivedDate: string; // YYYY-MM-DD
  expiryDate: string;   // YYYY-MM-DD
  location: StorageLocation;
  lot?: string;
  supplier?: string;
  barcode?: string;
  notes?: string;
  isDiscarded: boolean;
  isConsumed: boolean;
  createdAt: string;    // ISO 8601
  createdBy: string;    // Operator alias
  createdByUid?: string;
  updatedAt: string;    // ISO 8601
  updatedBy: string;    // Operator alias
  updatedByUid?: string;
  lastAction: AuditAction | string;
  consumedAt?: string | null;
  consumedBy?: string | null;
  discardedAt?: string | null;
  discardedBy?: string | null;
  discardReason?: WasteReason | string | null;
}

export interface HistoryLog {
  id: string;
  productId: string;
  productName: string;
  category: ProductCategory | string;
  action: AuditAction;
  quantityBefore: number;
  quantityDelta: number;
  quantityAfter: number;
  unit: ProductUnit | string;
  operatorAlias: string;
  operatorUid?: string;
  timestamp: string; // ISO 8601
  reason?: WasteReason | string;
  notes?: string;
}

export interface InventoryMetrics {
  total: number;
  expired: number;
  soon: number;
  week: number;
  ok: number;
  within7Days: number;
  criticalTotal: number;
  discardedCount: number;
  consumedCount: number;
}
```

### 3.2 `src/lib/domain/expiry.ts`
Key functions:
- `parseLocalDate(dateStr: string): Date | null` — Validates regex and strict calendar validity (rejects Feb 30, April 31).
- `formatDateISO(date: Date): string` — Converts Date to local `YYYY-MM-DD`.
- `calculateDayDiff(expiryDateStr: string, referenceDate?: Date | string): number` — Day difference rounded over 86,400,000 ms.
- `calculateExpiryStatus(expiryDate: string, referenceDate?: Date | string, options?: ExpiryStatusOptions): ExpiryStatus`:
  - `daysRemaining < 0`: `{ key: 'expired', label: 'Vencido hace X día(s)' | 'Vencido ayer', cls: 'expired' }`
  - `daysRemaining === 0`: `{ key: 'soon', label: 'Vence hoy', cls: 'warning' }`
  - `1 <= daysRemaining <= 3`: `{ key: 'soon', label: 'Vence mañana' | 'Vence en X día(s)', cls: 'warning' }`
  - `4 <= daysRemaining <= 7`: `{ key: 'week', label: 'Vence en X días', cls: 'warning' }`
  - `daysRemaining > 7`: `{ key: 'ok', label: 'Vigente', cls: 'ok' }`
- `calculateMetrics(products: Product[], referenceDate?: Date | string): InventoryMetrics`:
  - Disjoint partition of active products.
- `addDaysSafe(baseDate, days: number): string`
- `addWeeksSafe(baseDate, weeks: number): string`
- `addMonthsSafe(baseDate, monthsToAdd: number): string` — Clamps month overflow to month-end.
- Presets: `presetPlus2Days`, `presetPlus3Days`, `presetPlus1Week`, `presetPlus1Month`.

### 3.3 `src/lib/domain/waste.ts`
Key functions:
- `roundQuantity(val: number): number` — 3 decimal places with `Number.EPSILON`.
- `consumeProductStock(product: Product, options: ConsumeOptions): ConsumeResult`:
  - Decrements quantity.
  - Automatically transitions `isConsumed: true` and `lastAction: 'CONSUME_FULL'` if quantity reaches 0.
  - Emits immutable `HistoryLog` entry.
- `discardProductStock(product: Product, options: DiscardOptions): DiscardResult`:
  - Records food waste/merma with validated reasons (`vencimiento`, `rotura`, `contaminacion`, `calidad`, `otro`).
  - Sets `isDiscarded: true` when stock is fully discarded.
  - Emits HACCP audit entry.
- `restoreProductStock(currentProduct: Product, logToRevert: HistoryLog, operator: string): RestoreResult`:
  - Reverses stock delta for undo toasts and logs `'RESTORE'` audit entry.
- `formatHaccpAuditEntry(log: HistoryLog): string`:
  - Standardized health inspection log line.
- `summarizeWasteLogs(logs: HistoryLog[]): Record<string, WasteSummaryItem>`:
  - Aggregates food waste totals and counts by cause.

---

## 4. Caveats

1. **Storage Layer Decoupling**:
   - The domain layer only produces updated in-memory `Product` and `HistoryLog` objects. Persisting them atomically to Firestore via `writeBatch()` or IndexedDB belongs strictly to `src/lib/repositories/ProductRepository.ts` in Milestone 2.
2. **Negative Stock Policy**:
   - By default, `allowNegativeStock` is `false`, clamping consumption to available stock. If a restaurant workspace enables `allowNegativeStock: true`, `consumeProductStock` permits negative values without throwing.
3. **Leap Second Handling**:
   - Date differences are computed using day intervals (86,400,000 ms) and rounded with `Math.round()`. Daylight saving time 23-hour or 25-hour days are correctly absorbed without day count errors.

---

## 5. Conclusion

1. **Architecture Complete**: The proposed domain layer completely satisfies requirements R1 (operator audit and workspace models), R2 (pure TypeScript domain logic independent of UI/DB), and R3 (quick expiry math presets and 1-tap stock/waste operations).
2. **Edge Cases Fully Resolved**:
   - Timezone drift eliminated.
   - Month overflow on Jan 31 clamped to Feb 28 (or Feb 29 on leap years).
   - Floating point precision secured to 3 decimal places.
   - Metrics partitioning verified as disjoint (`total = expired + soon + week + ok`).
3. **Production Files Ready**: The implementer agent can copy the 3 proposed files directly to `src/lib/domain/` during Milestone 1 implementation:
   - `proposed_models.ts` -> `src/lib/domain/models.ts`
   - `proposed_expiry.ts` -> `src/lib/domain/expiry.ts`
   - `proposed_waste.ts` -> `src/lib/domain/waste.ts`

---

## 6. Verification Method

To independently verify this domain logic:

1. **Run the Automated Verification Test**:
   ```bash
   node .agents/teamwork/explorer_m1_2/verify_domain.js
   ```
   *Expected Output*:
   ```text
   --- STARTING DOMAIN LOGIC VERIFICATION TESTS ---
   ✓ Test 1: parseLocalDate calendar validation passed
   ✓ Test 2: calculateDayDiff passed
   ✓ Test 3: calculateExpiryStatus status boundaries passed
   ✓ Test 4: Quick expiry presets and month overflow clamping passed
   ✓ Test 5: calculateMetrics disjoint partitioning passed
   ✓ Test 6: Stock consumption and float precision passed
   ✓ Test 7: Discard stock / merma passed
   --- ALL 7 DOMAIN LOGIC VERIFICATION TESTS PASSED SUCCESSFULLY! ---
   ```
   *Exit code*: `0`.

2. **Inspect Artifacts**:
   - Check `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_2/proposed_models.ts`
   - Check `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_2/proposed_expiry.ts`
   - Check `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_2/proposed_waste.ts`
