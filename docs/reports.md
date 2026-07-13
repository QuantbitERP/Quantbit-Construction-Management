# Reports

This app defines **4 Query Reports** (Frappe `Report` DocType records with `report_type: "Script Report"`), each backed by an `execute(filters)` Python function. No SQL-only reports, Report Builder reports, or "Prepared Report"-flagged reports were found. There is also a generic **ad-hoc report renderer** (`report_handler.get_report_html`) used from the `Project` form to embed any Query Report's output as HTML inside a form field — documented at the end of this page.

## BOQ Analysis Report

- **Source**: `quantbit_construction_management/boq/report/boq_analysis_report/boq_analysis_report.py` (+ `.json`, `.js`)
- **Module / Reference DocType**: BOQ / `Bill of Quantities`
- **Roles**: `System Manager`, `All`
- **Purpose**: Renders the BOQ's line items (`Bill of Quantities.boq_items`, a `BOQ Item` child table) grouped by **Subtask → Item Type** (fixed order: Man, Material, Equipment), with a Subtask header (name/subject/description pulled from the linked `Task`), per-item-type subtotals, and a subtask grand total.
- **Filters**: `bill_of_quantities` (required — the report fetches `frappe.get_doc("Bill of Quantities", boq)` and errors if not provided/invalid). No date range or company filter is applied — filters array in the `.json` is empty; filtering happens entirely inside `get_data()`.
- **Data source / Logic**: Python script logic (`get_data()`), not raw SQL — it iterates the already-loaded `boq_items` child table in memory and groups it with plain dict logic (`subtask_group[subtask][item_type]`).
- **Columns**: Sr. No. (Data), Specification (Data), Unit (Data), Qty (Float), Rate (Currency), Amount (Currency).

## Task Wise BOQ Analysis

- **Source**: `quantbit_construction_management/boq/report/task_wise_boq_analysis/task_wise_boq_analysis.py` (+ `.json`, `.js`)
- **Module / Reference DocType**: BOQ / `Bill of Quantities`
- **Roles**: `System Manager`, `All`
- **Purpose**: Same structure and column set as BOQ Analysis Report, but groups `boq_items` by **Task** (`row.task`) instead of Subtask — i.e., a coarser roll-up one level up the Task hierarchy.
- **Filters**: `bill_of_quantities` (required, same pattern as above).
- **Data source / Logic**: Script logic; iterates `boq_doc.boq_items` in memory, no raw SQL.
- **Columns**: identical to BOQ Analysis Report (Sl. No., Specification, Unit, Qty, Rate, Amount).

## Equipment Usage Disel Details

- **Source**: `quantbit_construction_management/site_diary/report/equipment_usage_disel_details/equipment_usage_disel_details.py` (+ `.json`, `.js`)
- **Module / Reference DocType**: Site Diary / `Equipment Usage`
- **Roles**: `System Manager` only
- **Purpose**: Lists diesel-fill and working-hours detail rows from submitted `Equipment Usage` documents.
- **Filters**: `from_date`, `to_date` (against `Equipment Usage.site_date`), `project`, `equipment_item`, `contractor` — all optional, combined with `AND`.
- **Data source / Logic**: Raw SQL (`frappe.db.sql`) joining `tabEquipment Usage Details` (child) → `tabEquipment Usage` (parent, filtered to `docstatus = 1`, i.e. submitted only) → `tabItem` (for the equipment's item name), ordered by `site_date DESC, idx`.
- **Columns**: Contractor (Link → Contractor), Equipment Item (Data), UOM (Link → UOM), Quantity (Float), Working Hrs (Float), Diesel Filled (in LTR) (Float).

## Daily Progress Report

- **Source**: `quantbit_construction_management/site_diary/report/daily_progress_report/daily_progress_report.py` (+ `.json`, `.js`, `.html`)
- **Module / Reference DocType**: Site Diary / `Task`
- **Roles**: `Projects User`, `HR User`, `HR Manager`
- **Purpose**: A consolidated **daily site diary digest** for one `project` + `site_date`, combining five sections into one hierarchical report:
  1. **Equipment Usage** — from `Equipment Usage Details` / `Equipment Usage` (raw SQL join, includes `Employee` for the site engineer's name).
  2. **Visitors** — from `Project Visitor` (`frappe.get_all`).
  3. **Manpower Usage** — from `Manpower Usage Details` / `Manpower Usage` (raw SQL join).
  4. **Material Consumed** — via `get_material_deliveries(project, site_date)`, a helper imported from `site_diary.doctype.site_diary.site_diary`.
  5. **Material Received** — via `get_material_received(project, site_date)`, also imported from the `site_diary` controller module (branches on `reference_type` being `Purchase Receipt` vs. other stock documents).
  A running **grand total amount** is accumulated across all sections, and each section's total is emitted as a `"<Section> TOTAL"` row.
- **Filters**: `project` (used to resolve `project_name` via `frappe.db.get_value`), `site_date`.
- **Data source / Logic**: Script Report — a mix of raw SQL (`tabEquipment Usage Details`/`tabEquipment Usage`, `tabManpower Usage Details`/`tabManpower Usage`, `tabTask Progress Details`/`tabTask Progress`) and Frappe ORM (`frappe.get_all`) calls, then a substantial in-memory **hierarchy builder** (`build_hierarchy()`) that:
  - Groups flat rows into sections, then into a tree keyed by up to 10 nested `task_level{1..10}` fields plus `subtask`/`task`, mirroring the app's deep Task-hierarchy model (see `docs/database.md`).
  - Recursively sums `total_qty`, `achieved_today`, `total_achieved`, `presenty`, `total_presenty`, `quantity`, `amount`, `working_hours` up each branch (`flatten()`), and computes `percent_completed = total_achieved / total_qty * 100` per group.
  - Emits a final `GRAND TOTAL` row.
- **Companion HTML template**: `daily_progress_report.html` exists alongside the script — used for a print/HTML rendering of the same report (content itself is a Jinja/print-style template, not separately documented here beyond confirming its presence).
- **Columns**: Section / Task / Item, Site Engineer, Total Qty, Achieved Today, Total Achieved, Progress Completed (Percent), Item, Item Type, Contractor, Visitor Name, Purpose, Company, Time In, Time Out, Skill Type, Presenty, Total Presenty, Transaction Type, Transaction ID, Source Warehouse, Target Warehouse, UOM, Rate, Working Hours, Quantity, Amount.

## Generic Ad-Hoc Report Renderer (`report_handler.get_report_html`)

- **Source**: `quantbit_construction_management/report_handler.py`
- **Not a Report DocType itself** — a whitelisted helper (`@frappe.whitelist()`) that runs **any** named Query Report via `frappe.desk.query_report.run(report_name, filters, ignore_prepared_report=True)` and renders the result as a styled HTML `<table>` string.
- **Consumer**: `public/js/Project.js`'s `render_report_view(frm)` — lets a `Project` form embed a chosen report (`Project.custom_report_name_`) inline via a read-only HTML field (`custom_html_view`), auto-injecting `project`, `company`, `from_date`/`to_date` filters from the Project document.
- **Defaults applied when filters are missing**: `company` ← user default or Global Defaults; `from_date` ← one month before today; `to_date` ← today.
- **Error handling**: catches exceptions from `run()` and returns an inline warning/error `<div>` instead of raising, with special-cased messaging for `NoneType`/`+` errors (interpreted as a missing mandatory filter).
- Because it calls the standard Query Report runner, it can render **any** Query Report installed on the site (not limited to the 4 listed above) — this makes it a general-purpose reporting widget rather than a report of its own.
