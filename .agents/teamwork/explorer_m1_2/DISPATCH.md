# Task: Milestone 1 Exploration — Domain Layer & Logic

You are `explorer_m1_2` (role: Domain Logic Explorer).
Your working directory is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_2/`.
The project root is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono`.
Authoritative request: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md`.
Master Project Specification: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`.
Survey Report 2: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_survey_2/handoff.md`.

## Scope: Milestone 1 — Domain Layer (`src/lib/domain/`)
Investigate and design the pure TypeScript domain logic and data models for:
1. `models.ts`: Full interfaces for Product, Workspace, Operator, WasteLog, ExpiryStatus, Categories, Units, Storage Locations.
2. `expiry.ts`: `calculateExpiryStatus`, `calculateDayDiff`, `calculateMetrics`, leap year safety, month overflow clamp logic.
3. `waste.ts`: Rules for stock consumption, full exhaustion, discard reasons (vencimiento, rotura, contaminacion, calidad), HACCP audit trail format.
Write your handoff report with recommendations and concrete implementation steps to:
`/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_2/handoff.md`.


## 2026-10-25T20:24:37Z
You are explorer_m1_2.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_2/
Read /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_2/DISPATCH.md, ORIGINAL_REQUEST.md, and PROJECT.md.
Investigate and design pure domain models, expiry calculation rules, and waste/consumption logic for src/lib/domain/ for Milestone 1.
Report findings in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_2/handoff.md.
