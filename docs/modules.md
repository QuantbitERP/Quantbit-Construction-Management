# Modules

Frappe groups DocTypes into **Module Defs**; this app declares 11 in `quantbit_construction_management/modules.txt`. Each module folder mirrors the Frappe convention `<app>/<module_snake_case>/doctype/<doctype_snake_case>/`. Full per-DocType detail is in `docs/doctypes.md`; this page covers module-level purpose, responsibilities, and dependencies.

---

## Quantbit Construction Management (Core)

- **Path**: `quantbit_construction_management/quantbit_construction_management/`
- **Purpose**: Foundational masters and the cost-estimation engine shared by every other module — sites, construction types/measures, equipment/worker/material masters, and the `Costing` cost roll-up that feeds Task-level budgeting.
- **Responsibilities**: Cost estimation (`Costing`, `Costing Task`, `Costing Work Details`, `Material Costing`, `Equipment Costing`, `Worker Costing`), daily progress roll-up (`Daily Progress Tracking`, `DPR Activity Progress`, `Task Summary`), UOM conversion masters (`UOM Conversion Rate`, `UOM Conversion Table`), and site/construction reference masters (`Site`, `Construction Type`, `Construction Measures`, `Equipment`, `Worker Master`, `Worker Type`, `Material Details`, `Work Details`, `Billing Settings`, `BOQ Amendment Log`).
- **Related DocTypes**: 21 (see `docs/doctypes.md#module-quantbit-construction-management-core`). Most controllers are empty `pass` stubs; the two with real logic are `Costing` (`costing.py`, ~406 lines, 4 whitelisted methods — the module's cost-estimation engine, cascading Task hierarchy → construction-type quantities → UOM-converted worker/equipment/material costs) and `Daily Progress Tracking` (`before_save` + recursive `update_parent_progress` that propagates weighted progress up the Task tree, 2 whitelisted methods).
- **Important classes**: `Costing(Document)`, `DailyProgressTracking(Document)`.
- **Important APIs**: `costing.get_costing`, `costing.update_costing_task_table`, `costing.get_costing_work_details_from_costing_task`, `costing.get_child_tasks`, `daily_progress_tracking`'s two whitelisted methods. App-root helpers `api.py` (Task hierarchy operations) and `utils.py` (`convert_uom_or_warn`, imported directly by `costing.py`) are also effectively part of this module's engine even though they live outside a `doctype/` folder.
- **Dependencies**: ERPNext `Task` (via `override_doctype_class` → `CustomTask`) and `Project`; `Item Price`, `UOM Conversion Table` (ERPNext core).

## Tendering

- **Path**: `quantbit_construction_management/tendering/`
- **Purpose**: Pre-contract sales pipeline — qualifying an ERPNext `Opportunity`, running it through a multi-role approval workflow, converting it into a `Tender`, running the tender through bid preparation/submission/award, and finally spinning up an ERPNext `Project` with a full BOQ-linked Task hierarchy.
- **Responsibilities**: Bid checklists (pre-bid/post-bid/bid submission + their detail child tables), qualification scoring (`Technical Qualification Details`, `Financial Qualification Details`), tender document/competitor/corrigendum tracking, cost-code and item-type masters, and the central `Tender` DocType (~140 fields, a superset of ERPNext Opportunity structure with added Bid/BOQ/Documents/Corrigendum/Confidential Documents/Competitor/Checklist/Costing Sheet tabs).
- **Related DocTypes**: 28 custom DocTypes plus overrides of ERPNext `Opportunity` (`custom_crm/opportunity.py`) and `Project` (`custom_project/project.py`).
- **Important classes**: `Tender` controller (`tender.py`) — despite having a `before_submit()` hook, it is **not** flagged `is_submittable` in its JSON; its lifecycle is driven entirely by `workflow_state`.
- **Important APIs**: `tender.py` — `create_customer_from_lead`, `create_project_from_tender` (creates a Project and re-parents the BOQ Task hierarchy across up to 10 levels), `get_boq_details`. `custom_crm/opportunity.py` — `on_update` hook (auto-creates a Tender when `workflow_state` reaches the "Tender created" trigger state) and `create_tender_from_opportunity` (called from `Opportunity.js`). `custom_project/project.py` — `get_columns` (whitelisted, called from `Project.js`, not wired via `doc_events`).
- **Dependencies**: ERPNext `Opportunity`, `Project`, `Customer`, `Lead`; this app's `BOQ` module (Tender links to Bill of Quantities); the `Tender Creation` and `Tender Submission` Frappe Workflows (see `docs/workflows.md`).
- **Known inconsistency**: code checks `workflow_state == "Tender created"` (lowercase) while the whitelisted function that sets it uses `"Tender Created"` — see `docs/known-limitations.md`.

## Quality and Safety Management

- **Path**: `quantbit_construction_management/quality_and_safety_management/`
- **Purpose**: Site QA/QC and HSE record-keeping — inspection test plans, inspection lots/results, non-conformance reports, incident reports and corrective actions, risk register, safety observations, toolbox talks.
- **Responsibilities**: 15 DocTypes covering the standard construction QA/safety domain (ITP, NCR, incident/CA, risk register, toolbox talk/JBT attendee).
- **Related DocTypes**: Incident Report ↔ Safety Observation (bidirectional link), Inspection Lot ↔ NCR (bidirectional link), Inspection Lot → Inspection Test Plan, Quality Plan → Inspection Test Plan (via `Quality Plan ITP` junction child table).
- **Important classes / APIs**: **None** — every controller (`.py`) in this module is a bare `pass` class, and every client script is a commented-out `refresh` stub. All status transitions, corrective-action workflows, and attendee-count reconciliation are manual/UI-driven, not code-enforced.
- **Dependencies**: ERPNext `Project` (most doctypes carry a `project` Link field).

## Site Diary

- **Path**: `quantbit_construction_management/site_diary/`
- **Purpose**: The daily on-site data-capture layer — manpower, equipment usage (with diesel tracking), material receipt/delivery, task progress, and visitor logs — that other modules (costing, RA billing, reports) consume.
- **Responsibilities**: 16 DocTypes plus a `custom_stock/` override of ERPNext `Stock Entry` and 2 Query Reports.
- **Related DocTypes**: `Site Diary` is the central/parent-style document (1341-line controller, by far the largest in this module) that aggregates or links to Manpower Usage, Equipment Usage, Material Received/Delivery, Task Progress, and Project Visitor for a given project/date.
- **Important classes**: `SiteDiary(Document)`.
- **Important APIs** (`site_diary.py`, 10 whitelisted methods): `update_daily_activity_progress_table`, `update_task_progress_from_dpr`, `get_multiple_task_bom_details`, `get_current_weather`, `get_task_bom_details`, `get_site_diary_details`, `get_material_deliveries`, `get_material_received`, `get_latest_task_progress`, `get_task_progress_images`. The latter two `get_material_*` helpers are re-imported by the `Daily Progress Report` Query Report (`docs/reports.md`).
- **Important APIs** (`custom_stock/stock_entry.py`): `update_task_material_cost` — fired on `Stock Entry.on_submit` (`doc_events` in `hooks.py`), sums material-issue amounts per Task/subtask and writes `custom_total_material_cost` back onto the standard `Task` doctype.
- **Dependencies**: ERPNext `Stock Entry`, `Item`, `Employee`, `Project`, `Task` (deep, via up to 10 `task_level{1..10}` fields mirroring the Task hierarchy).

## Subcontractor Management

- **Path**: `quantbit_construction_management/subcontractor_management/`
- **Purpose**: Manages subcontract agreements, work orders, subcontractor bills, and the running-account (RA) billing engine for subcontractors, reconciled against ERPNext's financial documents.
- **Responsibilities**: 14 DocTypes — `Contractor` (master), `Subcontract Agreement`, `SC Work Order`/`WO Item`, `SC Bill`/`SC Bill Item`, `SC Payment Certificate`/`SC Payment Deduction`, `Contractor Billing`/`Contractor Billing Details`, and **`RA Billing`** (the module's largest controller — ~2710 Python lines / ~859 JS lines, 11 whitelisted methods).
- **Important classes**: `RABilling(Document)`, `ContractorBilling(Document)`.
- **Important APIs**: `RA Billing`'s 11 whitelisted methods compute a running-account progress bill against a project's Task hierarchy (stage → task → up to 10 sub-levels), supporting direct-entry, dimensional-formula (`no1×no2×length×width×height`), and steel-reinforcement (bar length × dia²/162 kg/m → Metric Tonnes) measurement modes; line amounts roll up per-stage into an Abstract carrying forward previous-bill cumulative totals into `grand_total`/`final_grand_total`, optionally spawning a Sales Invoice on submit. `contractor_billing.py` exposes the hook handlers `on_payment_entry_submit`, `on_payment_entry_cancel`, `on_purchase_invoice_update`, `on_journal_entry_update`, all routing through `update_payment_status`/`sync_contractor_billing_payment_status`.
- **Dependencies**: ERPNext `Payment Entry`, `Purchase Invoice`, `Journal Entry`, `Sales Invoice`, `Customer`; this app's core `Task`/`Project` hierarchy; `Billing Settings` (core module) toggles for auto-creating JV/Purchase Invoice.
- **Naming collision**: this module's `RA Billing` DocType is a **different** entity from the `ra_billing` **module**'s doctypes (see below) — see `docs/known-limitations.md`.

## RA Billing

- **Path**: `quantbit_construction_management/ra_billing/`
- **Purpose**: Bulk/multi-project running-account billing tooling and level-survey data capture — a companion to (and consumer of) the `subcontractor_management.RA Billing` DocType, **not** a re-implementation of it.
- **Responsibilities**: 9 DocTypes — `Bulk RA Billing` (submittable, ~950-line Excel export/import engine with steel-weight formula `d²/162`) and its detail children, `Task Level Sheet` (submittable, level/RL survey formulas, pushes data onto `Task.custom_level_sheet_details` on submit) and its details, plus `Project Formulas Details`/`Project Data Sheet Column Details` for configurable per-project billing formulas.
- **Important classes**: `BulkRABilling(Document)`, `TaskLevelSheet(Document)`.
- **Important APIs**: `bulk_ra_billing.py` — `get_projects_for_site`, `export_bulk_ra_excel`. `task_level_sheet.py` — 3 whitelisted methods for level-sheet import/formula application.
- **Dependencies**: `subcontractor_management.RA Billing` (`Bulk RA Billing Projects Details.ra_bill` links to it), `Task` hierarchy, `openpyxl` (implied by Excel export/import — not declared as a dependency in `pyproject.toml`; see `docs/known-limitations.md`).

## Progress Measurement & Billing

- **Path**: `quantbit_construction_management/progress_measurement_&_billing/`
- **Purpose**: Progress certification and earned-value record-keeping for client-facing billing.
- **Responsibilities**: 7 DocTypes — `Progress Certificate`, `Progress Claim`/`Progress Claim Item`, `Earned Value Record`, `Cert Deduction`, `Claim Included VO`, `Disputed BOQ Item`.
- **Important classes / APIs**: **None found** — every controller is `pass`-only and every client script is a commented-out stub. Earned-value formulas (SPI/CPI/EAC, etc.), certificate `net_certified`, and claim financial roll-ups are stored fields with **no implementing code** in this module — see `docs/known-limitations.md`.
- **Dependencies**: this app's `BOQ`/`Task` hierarchy (fields reference BOQ items and tasks); no code-level dependency confirmed beyond field-level Links.

## BOQ

- **Path**: `quantbit_construction_management/boq/`
- **Purpose**: Quantity take-off, rate analysis, and BOQ-to-Task-hierarchy conversion — the bridge between Tendering's cost estimation and Site Diary/Subcontractor execution/billing.
- **Responsibilities**: 5 DocTypes — `Bill of Quantities` (submittable, the module's central and largest controller at ~935 lines with **14** whitelisted methods), `BOQ Item`, `BOQ Rate Analysis`, `BOQ Revision`, `BOQ Task Details` — plus 2 Query Reports (`docs/reports.md`).
- **Important classes**: `BillOfQuantities(Document)`.
- **Important APIs** (`bill_of_quantities.py`): XLSX template download/import to build Stage→Task→Subtask hierarchies (`download_boq_task_template`, `import_boq_tasks`), BOM-to-BOQ-item sync (`get_boq_items_from_task`, `get_boq_items_from_subtask`, `update_task_bom_details`), template-based cloning (`create_stage_task`, `create_task`, `create_subtask`, `clone_task_hierarchy`), full BOQ+task-tree duplication (`duplicate_boq`), deletion with dependency cleanup (`delete_boq_tasks`, `delete_task_with_dependencies`), BOQ→Project conversion (`create_project_from_boq`), and post-submit quantity amendment with audit logging (`amend_subtask`, `get_task_qty`).
- **Business rule**: `contract_value` is a pure roll-up of `boq_items.amount`; hierarchy-completeness and the 100%-weight-cap rule are enforced **client-side only** (`Project.js`/`Task.js`), not in the Python controller.
- **Dependencies**: ERPNext `Task`/`Project`, `Item`; this app's `api.py` (`clone_task_hierarchy`, `delete_task_with_dependencies` are shared with `Project.js`'s hierarchy widget).

## Document Control

- **Path**: `quantbit_construction_management/document_control/`
- **Purpose**: Drawing and correspondence management — drawing register/revisions, RFIs, shop drawings, transmittals.
- **Responsibilities**: 6 DocTypes: `Drawing Register`, `Drawing Revision`, `RFI`, `Shop Drawing`, `Transmittal`, `Transmittal Drawing`.
- **Important classes / APIs**: Several DocTypes share a `generate_unique_8_digit_number` pattern (from the app-root `utils.py`) for human-readable reference numbers; otherwise no substantial controller logic was found.
- **Dependencies**: this app's core `Site`/`Project` masters.

## Labour Management

- **Path**: `quantbit_construction_management/labour_management/`
- **Purpose**: Workforce organization and attendance — gangs, skills, bulk attendance capture.
- **Responsibilities**: 8 DocTypes: `Gang`/`Gang Member`, `Labour Category`, `Labour Attendance Bulk Entry`/`Labour Attendance Row`, `Skill Matrix`/`Skill Record`, `Labour Entry Details`.
- **Important classes / APIs**: Mostly master/log data with logic in JSON defaults or client scripts rather than Python controllers.
- **Dependencies**: `Labour Entry Details` references a `Contractor` field (this app's `subcontractor_management.Contractor`).

## Billing

- **Path**: `quantbit_construction_management/billing/`
- **Purpose**: Declared in `modules.txt` and has its own `doctype/` folder, but the folder currently contains **only** `__init__.py` — no DocTypes are implemented under this module. Treat as a reserved/placeholder module. (`Billing Settings`, despite the name, is filed under the core `quantbit_construction_management` module, not here.)
