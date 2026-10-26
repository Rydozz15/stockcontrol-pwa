# Project Plan: StockControl PWA

## Overview
Transform StockControl prototype into a collaborative PWA using SvelteKit, Firebase Firestore (real-time sync + offline persistence), mobile-first bottom navigation & FAB, tablet split-view, camera barcode scanner, CSV/JSON export/import, Render static site deployment, and git push.

## Phases
1. **Phase 0: Survey & Codebase Analysis**
   - Explorer 1: Inspect existing project files, dependencies, package.json, current prototype implementation, git status.
   - Explorer 2: Analyze Firebase setup, Firestore offline persistence API requirements, data models, multi-tenant workspace/kitchen codes, operator audit trail.
   - Spec Miner / Explorer 3: Extract exhaustive UX, PWA, Render build configuration, scanner requirements, acceptance criteria mapping.

2. **Phase 1: Project Architecture & Decomposition**
   - Synthesize survey findings into `PROJECT.md` (architecture, feature inventory, code layout, interface contracts, milestones).
   - Initialize E2E Testing Track (`TEST_INFRA.md`).

3. **Phase 2: Milestone Execution & E2E Testing Track**
   - Milestone M1: SvelteKit Project Setup, Domain Models, Stores & Static Adapter Configuration.
   - Milestone M2: Firestore Repository Layer (Offline Persistence, Workspace Realtime Sync, Audit Logging).
   - Milestone M3: Ergonomic UX/UI (Bottom Nav, FAB, Quick Expiry, 1-Tap Waste/Consumption, Tablet Split-View, Camera Scanner).
   - Milestone M4: PWA Configuration (manifest, service worker, offline cache) & Contingency CSV/JSON Export/Import.
   - E2E Testing Track: Opaque-box test suite (Tiers 1-4) publishing `TEST_READY.md`.

4. **Phase 3: Integration, E2E Verification & Adversarial Hardening**
   - Implementation Track Final Milestone: Pass 100% of E2E tests (Tiers 1-4).
   - Phase 2 Coverage Hardening (Tier 5 adversarial stress testing).

5. **Phase 4: Build, Git Push & Sentinel Delivery**
   - Worker verifies clean build (`npm run build`).
   - Push to `main` branch of https://github.com/Rydozz15/stockcontrol-pwa.git.
   - Report project completion to Sentinel.
