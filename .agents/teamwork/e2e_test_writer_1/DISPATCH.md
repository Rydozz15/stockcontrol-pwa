# Task: E2E Test Suite Creation (Tiers 1-4)

You are `e2e_test_writer_1` (role: E2E Test Suite Creator).
Your working directory is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/e2e_test_writer_1/`.
The project root is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono`.
Authoritative request: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md`.
Test Infrastructure Specification: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/TEST_INFRA.md`.
Master Project Specification: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`.

## Exclusive Write Ownership
You own: `tests/e2e/**` and `TEST_READY.md`.
Do NOT write or modify files in `src/`, `static/`, or other project directories.

## Objective
Implement an automated, opaque-box E2E test suite in `tests/e2e/` verifying all user requirements and acceptance criteria across 4 tiers:
- **Tier 1: Feature Coverage (>=5 tests per feature)**: Verify each of the 27 identified features in isolation.
- **Tier 2: Boundary & Corner Cases (>=5 per feature)**: Leap year expiry, month overflow (Jan 31 + 1m), zero and negative quantity handling, safe-area inset fallbacks, camera permission rejection, malformed CSV/JSON, etc.
- **Tier 3: Cross-Feature Combinations**: Pairwise interactions (offline mutation -> online reconnection sync, scanned barcode -> instant lookup -> 1-tap consumption -> HACCP audit stamp, CSV export -> JSON import verification).
- **Tier 4: Real-World Commercial Kitchen Scenarios**:
  1. Morning Delivery Reception
  2. Lunch Prep Shift 1-Tap Consumption
  3. Walk-in Freezer Blackout (Offline IndexedDB persistence)
  4. Evening Food Waste & HACCP Audit
  5. Multi-Device Real-Time Kitchen Sync
- Create an executable test runner (e.g. `node tests/e2e/runner.js`) that outputs structured pass/fail results and exits with code 0 on success.
- When the test suite is fully created and verified, generate `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/TEST_READY.md` summarizing the runner command, tier breakdown, and feature coverage checklist.
- Write your completion report to `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/e2e_test_writer_1/handoff.md`.

## 2026-10-25T20:24:37Z
You are e2e_test_writer_1.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/e2e_test_writer_1/
Read /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/e2e_test_writer_1/DISPATCH.md, ORIGINAL_REQUEST.md, TEST_INFRA.md, and PROJECT.md.
Implement the comprehensive automated opaque-box E2E test suite in tests/e2e/ across Tiers 1-4, implement runner.js, run the tests to verify the test suite execution, and publish TEST_READY.md when complete.
Write your handoff to /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/e2e_test_writer_1/handoff.md.
