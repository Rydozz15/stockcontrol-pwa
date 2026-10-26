# BRIEFING — 2026-10-25T22:03:00Z

## Mission
Design mobile navigation (BottomNav.svelte), product card ergonomics (ProductCard.svelte with 1-tap quick actions and expiry pill), and audit +layout.svelte for mobile touch targets (>= 44x44px).

## 🔒 My Identity
- Archetype: explorer
- Roles: Mobile Navigation & Card Ergonomics Explorer
- Working directory: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/
- Original parent: 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c
- Milestone: Milestone 3 - Mobile Touch Ergonomics & Kitchen Fast Workflows

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in src/ (handoff proposals only)
- Svelte 5 / SvelteKit 3 conventions (runes `$props`, `$state`, `$derived`, etc. if project uses Svelte 5; let's check project Svelte version)
- Touch targets >= 44x44px
- Safe-area bottom inset padding for BottomNav
- Produce complete component templates and CSS diff in handoff.md

## Current Parent
- Conversation ID: 1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c
- Updated: 2026-10-25T22:03:00Z

## Investigation State
- **Explored paths**:
  - `src/routes/+layout.svelte` (audited `.toast-close-btn` violation at 36x36px)
  - `src/routes/+page.svelte` (reviewed current inline bottom-nav and card structure)
  - `src/lib/stores/inventoryStore.ts` (verified `consumeOne`, `consumeStockAction`, `discardStockAction`)
  - `src/lib/stores/toastStore.ts` (verified `toastStore.undo`, `toastStore.warning`)
  - `src/lib/domain/expiry.ts` (verified `calculateExpiryStatus` keys: expired, soon, week, ok)
  - `src/lib/domain/models.ts` & `waste.ts` (verified `WASTE_REASONS`, `WASTE_REASON_LABELS`)
  - `tests/e2e/tier1_features/` (`f11_bottom_nav`, `f12_touch_targets`, `f15_1tap_consumption`, `f17_safe_area`)
  - `tests/e2e/tier2_boundaries/` (`b11_nav_boundaries`, `b12_touch_boundaries`, `b15_1tap_boundaries`)
- **Key findings**:
  - `.toast-close-btn` is 36x36px, non-compliant with WCAG 2.5.5 / Feature 12 (needs 44x44px inline-flex).
  - Bottom navigation requires 4 fixed thumb-reachable tabs with safe-area bottom inset padding and idempotent click behavior.
  - ProductCard requires prominent quantity unit badge, expiry color pill mapped to domain expiry status, 1-tap "Consumir 1" with undo toast, and 1-tap "Merma" with confirmation dialog and HACCP reason selection.
- **Unexplored areas**: None within explorer_m3_1 scope.

## Key Decisions Made
- Designed `BottomNav.svelte` with configurable tabs, alias normalization (handling both Spanish tab names and English E2E test IDs), ARIA landmark role, and safe-area inset bottom padding.
- Designed `ProductCard.svelte` with WCAG >=44x44px touch targets, 10px spacing, integrated optimistic local store updates, background Firestore actions, and embedded micro-confirmation sheet for discards.
- Formulated exact CSS diff patch for `+layout.svelte` to fix `.toast-close-btn` hit target.

## Artifact Index
- `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/proposed_BottomNav.svelte` — Proposed BottomNav component
- `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/proposed_ProductCard.svelte` — Proposed ProductCard component
- `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/layout_touch_targets.patch` — Unified diff patch for +layout.svelte
- `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m3_1/handoff.md` — 5-Component Hard Handoff Report
