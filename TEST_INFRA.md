# E2E Test Infra: StockControl PWA

## Test Philosophy
- Opaque-box, requirement-driven. Derived from `ORIGINAL_REQUEST.md` and user-facing specifications, independent of internal implementation code.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial + Real-World Workload Testing.
- Progressive testability: Tier 1 tests must give pass/fail signals with only earliest milestones.
- Robustness: Negative tests verifying graceful rejection of invalid inputs (errors, not crashes).

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | SvelteKit Static Setup & Build | ORIGINAL_REQUEST § R4 | 5 | 5 | ✓ |
| 2 | Pure Domain Expiry Categorization | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| 3 | Domain Waste & Audit Models | ORIGINAL_REQUEST § R1, R2 | 5 | 5 | ✓ |
| 4 | Reactive Core Stores | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| 5 | Static Brand Assets & PWA Icons | ORIGINAL_REQUEST § R4 | 5 | 5 | ✓ |
| 6 | Modular Firebase Client & Offline Cache | ORIGINAL_REQUEST § R2, R3 | 5 | 5 | ✓ |
| 7 | Multi-Tenant Workspace Sync | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| 8 | Operator Audit Stamp | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| 9 | Atomic Stock Consumption | ORIGINAL_REQUEST § R1, R3 | 5 | 5 | ✓ |
| 10 | Security Rules & Isolation | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| 11 | Bottom Navigation Bar | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 12 | Touch Target Compliance (>=44x44px) | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 13 | Floating Action Button (FAB) | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 14 | Quick Expiry Presets (+2d, +3d, +1w, +1m) | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 15 | 1-Tap Consumption & Merma | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 16 | Tablet Split-Screen Layout (>=768px) | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 17 | Safe Area Inset Support | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 18 | Metrics Summary Dashboard | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| 19 | Dual-Engine Camera Scanner | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 20 | Instant Barcode Lookup & Preload | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 21 | Camera Lifecycle Management | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 22 | Web App Manifest (standalone, theme) | ORIGINAL_REQUEST § R4 | 5 | 5 | ✓ |
| 23 | SvelteKit Service Worker Offline Caching | ORIGINAL_REQUEST § R4 | 5 | 5 | ✓ |
| 24 | Offline Connectivity Pill/Banner | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| 25 | UTF-8 BOM CSV Export/Import | ORIGINAL_REQUEST § R4 | 5 | 5 | ✓ |
| 26 | JSON v2 Backup & v1 Normalizer | ORIGINAL_REQUEST § R4 | 5 | 5 | ✓ |
| 27 | Render Static Deployment Config | ORIGINAL_REQUEST § R4 | 5 | 5 | ✓ |

## Test Architecture
- Test Runner: Node.js automated test runner (`tests/e2e/runner.js` or `npm test`).
- Test Case Structure:
  - `tests/e2e/tier1_features/`: Feature-by-feature verification in isolation.
  - `tests/e2e/tier2_boundaries/`: Boundary conditions, leap years, negative quantities, month overflows, corrupted formats.
  - `tests/e2e/tier3_combinations/`: Pairwise feature interactions (e.g. offline add -> online sync -> scanner lookup -> 1-tap consume -> audit check).
  - `tests/e2e/tier4_realworld/`: End-to-end commercial kitchen shift scenarios (Prep shift, Delivery reception, Health inspection audit, Freezer WiFi blackout).
- Pass/Fail Semantics: Process exits with code 0 on all tests passing, non-zero on any failure, with detailed error summary.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Morning Delivery Reception | Barcode Scanner, Quick Expiry, Workspace Sync, Audit Stamp, CSV Backup | High |
| 2 | Lunch Prep Shift Consumption | 1-Tap Consume, Undo Toast, Atomic Stock Decrement, Metrics Dashboard | Medium |
| 3 | Walk-in Freezer Blackout (Offline) | Offline Detection Pill, IndexedDB Cache, Local Mutations, Reconnection Sync | High |
| 4 | Evening Food Waste & HACCP Audit | 1-Tap Merma, Reason Categorization, Audit Trail, CSV Export with BOM | High |
| 5 | Multi-Device Kitchen Coordination | Two devices, same workspace code, real-time snapshot synchronization | High |

## Coverage Thresholds
- Minimum 27 features identified.
- Tier 1: >= 5 tests per feature (>= 135 tests).
- Tier 2: >= 5 tests per feature for boundary/edge conditions (>= 135 tests).
- Tier 3: >= 27 cross-feature pairwise interaction tests.
- Tier 4: >= 5 real-world kitchen workload scenarios.
- Target Total: >= 300 automated test assertions.
