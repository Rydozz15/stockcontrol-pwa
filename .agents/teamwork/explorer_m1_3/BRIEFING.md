# BRIEFING — 2026-10-25T20:25:00Z

## Mission
Investigate and design reactive stores (workspace, connectivity, toast, metrics) and app shell routes for Milestone 1.

## 🔒 My Identity
- Archetype: explorer
- Roles: Stores & UI Shell Explorer, Synthesizer
- Working directory: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_3/
- Original parent: 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c
- Milestone: Milestone 1

## 🔒 Key Constraints
- Read-only investigation — do NOT implement in production source code (`src/`), only produce analysis, designs, tests specs, and proposed snippets in working directory.
- All investigation outputs strictly within `.agents/teamwork/explorer_m1_3/`.
- SvelteKit SPA layout (`export const prerender = true; export const ssr = false;`).
- Mobile-first ergonomic requirements (min 48px touch targets, safe area insets).
- Ephemeral undoable toasts (4s auto-dismiss).
- Workspace persistence in localStorage with default 'cocina-principal'.
- Real-time online/offline connectivity tracking with window listeners.
- Pure derived metrics store calculation based on expiry categories.

## Current Parent
- Conversation ID: 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md`: R1 (workspaces, operator alias, audit), R2 (clean architecture, stores), R3 (ergonomics, safe-area, 1-tap undo, bottom nav), R4 (PWA, static adapter)
  - `PROJECT.md`: Feature inventory #4, #11, #12, #17, #18; interface contracts for models, expiry, metrics, stores
  - `spec_miner_survey/handoff.md`: UX requirements, touch targets >=44px, safe-area insets, 4s undo toasts
  - `explorer_survey_1/handoff.md` & `explorer_survey_2/handoff.md`: Prototype baseline in `index.html`, Firebase offline cache, CSV/JSON contingencies
  - `explorer_m1_1` & `explorer_m1_2` briefings/dispatches: Division of roles across scaffolding, domain logic, and stores/shell
  - `e2e_test_writer_1/DISPATCH.md` & `TEST_INFRA.md`: Tier 1-4 test requirements, runner semantics
- **Key findings**:
  - Stores must be SSR-safe (`typeof window !== 'undefined'` guards) to ensure `@sveltejs/adapter-static` builds cleanly in Node.js.
  - `workspaceStore` persists workspace ID (default `'cocina-principal'`), operator alias (default `'Cocinero'`), and device UUID in `localStorage`, listening to cross-tab `storage` events.
  - `connectivityStore` binds to `window.ononline` and `window.onoffline`, exposing `online`, `lastChanged`, and `hasPendingWrites` for Firestore sync status.
  - `toastStore` manages ephemeral notifications with auto-dismiss (4000ms) and 1-tap undo callbacks (`onUndo`), preventing screen clutter by limiting to 3 active toasts.
  - `metricsStore` derives pure metrics (`total`, `expired`, `soon`, `week`, `ok`) from `inventoryStore`, accepting an optional reference date for deterministic testing.
  - `src/routes/+layout.ts` enforces `export const prerender = true; export const ssr = false;` for pure static SPA routing on Render.
  - `src/routes/+layout.svelte` establishes CSS tokens, safe-area inset padding (`env(safe-area-inset-*)`), global offline pill banner, and toast overlay container.
  - `src/routes/+page.svelte` implements the mobile app shell with header, metrics dashboard, search/filter bar, 4-tab thumb-friendly bottom nav bar (>=44x44px), FAB, and tablet split-screen breakpoint (`@media (min-width: 768px)`).
- **Unexplored areas**: None for M1 stores & shell scope. All dependencies and interface contracts mapped.

## Key Decisions Made
- Use standard Svelte `writable` and `derived` stores with custom wrapper objects for clean encapsulation and easy mockability in tests.
- Provide pure calculation helper `calculateMetrics(products, referenceDate)` in addition to the reactive derived store, enabling standalone unit testing in Node without DOM.
- Use `crypto.randomUUID()` with timestamp fallback for generating stable `deviceId` in `workspaceStore`.
- Design layout shell with CSS variables matching the prototype's culinary warm palette (`#75472f`, `#fff8ef`, etc.) and safe-area padding for notch/home pill compatibility.
- Format handoff report with exact copy-pasteable TypeScript code snippets for all 5 stores and 3 routes to empower the M1 implementation builder.

## Artifact Index
- /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_3/DISPATCH.md — Task assignment and incoming messages
- /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_3/BRIEFING.md — Persistent context & memory
- /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_3/progress.md — Liveness & progress tracking
- /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_3/handoff.md — Final 5-component handoff report
