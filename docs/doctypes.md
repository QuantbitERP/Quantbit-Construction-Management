# DocType Reference

This document catalogs every custom DocType defined in this application (131 total across 11 modules), sourced directly from each DocType's `.json` definition, Python controller (`.py`), and client script (`.js`) where present. Statements not traceable to code are marked "Not found in repository."

For module-level purpose/responsibilities, see `docs/modules.md`. For entity relationships and naming strategy, see `docs/database.md`. For the Opportunity/Tender approval workflow, see `docs/workflows.md`. For the full permission matrix, see `docs/permissions.md`.

## Table of Contents

1. [Quantbit Construction Management (Core)](#module-quantbit-construction-management-core)
2. [Tendering](#module-tendering)
3. [Quality and Safety Management](#module-quality-and-safety-management)
4. [Site Diary](#module-site-diary)
5. [Subcontractor Management](#module-subcontractor-management)
6. [RA Billing](#module-ra-billing)
7. [Progress Measurement & Billing](#module-progress-measurement--billing)
8. [BOQ](#module-boq)
9. [Document Control](#module-document-control)
10. [Labour Management](#module-labour-management)

---

## Module: Quantbit Construction Management (Core)

## Cross-cutting notes

- **hooks.py `doc_events`**: None of the registered `doc_events` hooks target doctypes in this core module directly. The hooks registered are for `Opportunity` (on_update → `tendering.custom_crm.opportunity.on_update`), `Stock Entry` (on_submit → `site_diary.custom_stock.stock_entry.update_task_material_cost`), `Payment Entry` (on_submit/on_cancel → `subcontractor_management...contractor_billing`), `Purchase Invoice` (on_update → `contractor_billing.on_purchase_invoice_update`), and `Journal Entry` (on_update → `contractor_billing.on_journal_entry_update`). None of these five doctypes are in the core module, and their handlers do not write to any core-module doctype directly — however, `update_task_material_cost` (fired on Stock Entry submit with `stock_entry_type == "Material Issue"`) sums `row.amount` per `custom_subtask`/`custom_task` and writes the total into the standard Frappe **Task** doctype's `custom_total_material_cost` field, which is conceptually adjacent to this module's `Costing`/`Material Costing` doctypes but is not itself part of this module.
- **override_doctype_class**: `Task` is overridden by `quantbit_construction_management.overrides.task.CustomTask` (not part of this module, but many core-module doctypes — Costing, Costing Task, Daily Progress Tracking, DPR Activity Progress, Task Summary — link heavily to `Task` and read/write custom fields on it such as `custom_construction_type`, `custom_uom`, `custom_is_stage`, `custom_boq_name`, `task_weight`, `progress`, `custom_total_material_cost`).
- **Scheduler jobs**: `scheduler_events` is commented out in `hooks.py` — no scheduled/background jobs are defined at the app level.
- **frappe.enqueue**: No `frappe.enqueue` calls found anywhere under this module's `doctype/` folder.
- **Realtime events**: `daily_progress_tracking.js` calls `frappe.publish_realtime("project_progress_refresh", {project: frm.doc.project})` in its `after_save` handler to notify other open screens (e.g. a project progress dashboard) to refresh after a DPR is saved. This is client-side pub/sub, not a server background job.
- **api.py** (app root, not in this module) exposes whitelisted helpers used by Task/Project client scripts: `get_template_subtasks`, `clone_task_hierarchy`, `link_boq_tasks_to_project`, `delete_task_with_dependencies` — these operate on `Task`/`Task Depends On` and are invoked from `Project.js`/`Task.js`, not from this module's doctypes, but are relevant because several core-module doctypes (Costing, Daily Progress Tracking) assume the Task hierarchy (`parent_task`/`depends_on`) these helpers manage.
- **utils.py** (app root) defines `generate_unique_8_digit_number` (unused by this module's doctypes as far as found) and `convert_uom_or_warn(from_uom, to_uom, value)` — a whitelisted UOM conversion helper that looks up `UOM Conversion Table` rows (falling back to the reverse pair) and is imported directly by `costing.py` (`from quantbit_construction_management.utils import convert_uom_or_warn`) to convert quantities between construction UOM and worker/equipment/material UOMs during cost roll-up.
- **report_handler.py** (app root) exposes `get_report_html`, a generic whitelisted helper that renders any Frappe query report to styled HTML for embedding in a UI; it is not doctype-specific and not tied to a single core-module doctype.
- **module_onboarding/**, **onboarding_step/**, **workspace/**: These folders under `quantbit_construction_management/quantbit_construction_management/` contain module onboarding (`construction`), an onboarding step (`create_item`), and workspace definitions (`bill_of_quantity`, `cms`, `qc`, `safety`, `tendaring`) — these are Desk UI/navigation configuration (workspace pages, onboarding checklists), not doctypes, and contain no controller logic relevant to business rules.

---

### Billing Settings

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/billing_settings/billing_settings.json` / `.py` / `.js`
- **Description**: Not found in repository
- **Type**: Master (Single doctype — `issingle: 1`)
- **Naming**: Single doctype (no autoname; only one record exists, named "Billing Settings")
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| create_jv | Create JV | Check | No | Default 0. "If check, this will create Journal Entry on submission of Contractor Billing" |
| column_break_tpog | — | Column Break | No | Layout only |
| create_purchase_invoice | Create Purchase Invoice | Check | No | Default 0. "If check, this will create Purchase Invoice on submission of Contractor Billing" |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | No |

- **Validation / Server Logic**: `BillingSettings(Document)` controller class is empty (`pass`) — no validate/before_save/on_update logic.
- **Whitelisted APIs**: None in this file.
- **Client Script**: Commented-out boilerplate only (`refresh(frm) {}`) — no active client logic.
- **Business Rules**: These two checkboxes act as global toggles consumed elsewhere (in `subcontractor_management`'s Contractor Billing flow, per hooks.py doc_events) to decide whether submitting a Contractor Billing auto-creates a Journal Entry and/or Purchase Invoice; the toggle-consuming logic itself lives outside this module.

---

### BOQ Amendment Log

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/boq_amendment_log/boq_amendment_log.json` / `.py` / `.js`
- **Description**: Not found in repository
- **Type**: Master/Log document (not submittable, not a child table)
- **Naming**: Not found in repository (no `autoname` key present; `naming_rule` not set, so defaults to prompt/hash naming)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| reference_doc | Reference Doc | Link | No | Options: DocType |
| reference_doc_link | Reference Doc Name | Dynamic Link | No | Options (target doctype field): reference_doc |
| value_changed | Value Changed | Code | No | Freeform code/diff text |

- **Child Tables**: None
- **Link Fields**: `reference_doc` (Link → DocType); `reference_doc_link` (Dynamic Link, target determined by `reference_doc`)
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | No |

(also has export, print, report, email, share = 1 for System Manager)

- **Validation / Server Logic**: `BOQAmendmentLog(Document)` controller class is empty (`pass`) — no validate/before_save/on_update logic. `track_changes`, `track_seen`, `track_views` are all enabled at the doctype level (audit trail via Frappe's built-in version tracking).
- **Whitelisted APIs**: None in this file.
- **Client Script**: Commented-out boilerplate only — no active client logic.
- **Business Rules**: Appears to be a generic audit log capturing which document (`reference_doc`/`reference_doc_link`, e.g. a BOQ-related doctype) had a value changed and what changed (`value_changed`), likely written to by amendment logic elsewhere in the app (no writer found within this module's files).

---

### Construction Measures

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/construction_measures/construction_measures.json` / `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| uom | UOM | Link | Yes | Options: UOM |

- **Child Tables**: N/A (this is itself a child table, used by `Construction Type.uom`)
- **Link Fields**: `uom` (Link → UOM)
- **Permissions**: None defined (child table inherits parent permissions)
- **Validation / Server Logic**: `ConstructionMeasures(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository (no .js file).
- **Business Rules**: Simple list of measurement UOMs allowed for a given Construction Type; consumed by `Construction Type.js` to filter the `construction_uom` field on `Material Details` rows to only UOMs present in this table.

---

### Construction Type

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/construction_type/construction_type.json` / `.py` / `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `autoname: "field:construction_type"` (named directly from the `construction_type` field value)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| construction_type | Construction Type | Data | Yes | Unique; used as document name |
| uom | UOM | Table | Yes | Child table → Construction Measures |
| material_details | Material Details | Table | No | Child table → Material Details |

- **Child Tables**: `uom` → Construction Measures; `material_details` → Material Details
- **Link Fields**: None (fields are Table type, not Link, at the parent level)
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | No |

- **Validation / Server Logic**: `ConstructionType(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None in this file.
- **Client Script**: In `setup(frm)`, sets a query filter on the `construction_uom` field inside the `material_details` child grid so only UOMs already listed in this document's own `uom` (Construction Measures) child table are selectable.
- **Business Rules**: Represents a type of construction work (e.g. "Brickwork", "Plastering"). Its `material_details` rows (item + qty + item UOM + construction UOM) drive material quantity/cost roll-up in `Costing.get_costing()` — for each unit of this construction type consumed, the listed materials are multiplied out and priced via the "Construction Price" price list.

---

### Costing

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/costing/costing.json` / `.py` / `.js`
- **Description**: Not found in repository
- **Type**: Master/transaction document (not submittable — no `is_submittable`/`istable`/`is_tree` flags set)
- **Naming**: `autoname: "format:CS-{#####}"` (naming_rule: Expression (old style))
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| task_tab | Task | Tab Break | No | Layout |
| section_break_kdny | — | Section Break | No | Layout |
| task | Task | Table | No | Child table → Task Summary |
| section_break_vnst | — | Section Break | No | Layout |
| costing_task | Costing Task | Table | No | Child table → Costing Task |
| costing_tab | Costing | Tab Break | No | Layout |
| section_break_wxqi | — | Section Break | No | Layout |
| get_data | Get Data | Button | No | Triggers client `get_data` handler |
| costing_work_details | Costing Work Details | Table | Yes | Child table → Costing Work Details |
| section_break_awza | — | Section Break | No | Layout |
| get_costing | Get Costing | Button | No | Triggers client `get_costing` handler |
| worker_costing | Worker Costing | Table | No | Child table → Worker Costing |
| worker_total_cost | Worker Total Cost | Float | No | Calculated client-side |
| equipment_costing | Equipment Costing | Table | No | Child table → Equipment Costing |
| equipment_total_cost | Equipment Total Cost | Float | No | Calculated client-side |
| material_costing | Material Costing | Table | No | Child table → Material Costing |
| material_total_cost | Material Total Cost | Float | No | Calculated client-side |
| section_break_famu | — | Section Break | No | Layout |
| total_cost | Total Cost | Float | No | Sum of worker+equipment+material totals |

- **Child Tables**: `task` → Task Summary; `costing_task` → Costing Task; `costing_work_details` → Costing Work Details; `worker_costing` → Worker Costing; `equipment_costing` → Equipment Costing; `material_costing` → Material Costing
- **Link Fields**: None at parent level (all relational data via child tables, whose rows link to Task/Construction Type/UOM/Worker Type/Equipment/Item)
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | No |

- **Validation / Server Logic**: `Costing(Document)` controller class is empty (`pass`) — all business logic lives in whitelisted module-level functions, not lifecycle hooks.
- **Whitelisted APIs**:
  - `update_costing_task_table(doc)` — given a partially-filled Costing doc (JSON), rebuilds `costing_task` by iterating each `task` (Task Summary) row's linked Task, then each of that Task's `depends_on` sub-tasks, appending one `costing_task` row per (parent_task, sub_task) pair with `construction_type`/`uom` fetched from the sub-task's `custom_construction_type`/`custom_uom`. Then rebuilds `costing_work_details` as a de-duplicated (construction_type, uom) list, preserving previously-entered `value`s where the key still exists. Returns the mutated doc.
  - `get_costing_work_details_from_costing_task(doc)` — resets `costing_work_details` to a de-duplicated (construction_type, uom) list derived purely from `costing_task`, with `value` defaulted to 0 (used by the "Get Data" button to reset quantities).
  - `get_costing(doc)` — the core cost roll-up: for each `costing_work_details` row (construction_type + quantity `value`), it (1) computes **worker costing**: for every `Worker Type` whose `work_details` child rows match the construction_type, converts the required qty into the worker's UOM via `convert_uom_or_warn`, computes `total_minutes = converted_qty * minutes_per_unit`, divides by the count of `Worker Master` records of that worker_type to get `actual_minutes`/`hours`, and `total_amount = converted_qty * rate`; aggregates across all construction_type rows per worker_type. (2) computes **equipment costing** identically but keyed by `Equipment` records and their `work_details`, without dividing by an equipment count. (3) computes **material costing**: for each `Construction Type`'s `material_details` rows, converts `material.qty * qty_required` from `construction_uom` to the work row's UOM, looks up the item's price via `Item Price` where `price_list == "Construction Price"` and `uom == material.item_uom`, and computes `total_amount = converted_qty * item_rate`; aggregates by item. Appends resulting rows into `worker_costing`, `equipment_costing`, `material_costing` and returns them (not saved — the client sets these table values on the form).
  - `get_child_tasks(doctype, txt, searchfield, start, page_len, filters)` — whitelisted, sanitized (`@frappe.validate_and_sanitize_search_inputs`) link-query for the `task` field in the `costing_task` grid: returns Tasks whose `parent_task` matches the row's `parent_task` filter and whose `status == 'Template'`.
- **Client Script**:
  - `setup`: restricts the `task` field (in `task` child table) and `parent_task` field (in `costing_task` child table) to Tasks where `is_group=1` and `custom_is_stage=0`.
  - `get_costing` button handler: calls server `get_costing`, then repopulates `worker_costing`/`equipment_costing`/`material_costing` tables and recalculates all totals.
  - `get_data` button handler: clears all three costing tables and totals, then calls `get_costing_work_details_from_costing_task` to rebuild `costing_work_details`.
  - `Costing Task.parent_task` change: clears the row's `task` value (forces re-selection scoped to new parent).
  - `onload`: wires the `task` field in `costing_task` grid to a server-side dynamic query (`get_child_tasks`) filtered by the row's `parent_task`.
  - `Task Summary.task` / `task_remove` triggers: call `load_costing_task()`, which invokes `update_costing_task_table` and resets/clears the three costing tables and totals whenever the task list changes.
  - `Worker Costing`/`Equipment Costing`/`Material Costing` row field-change handlers (`qty`, `rate`, `total_work`/`total_qty`): recompute `total_amount = qty * total_work * rate` (worker/equipment) or `rate * total_qty` (material), recompute `time` (worker/equipment: `total_work / (qty * 60)`), and roll up totals (`calculate_worker_total`, `calculate_equipment_total`, `calculate_material_total`, `calculate_total_cost`).
  - Row-remove handlers on all three costing tables also recalculate totals.
- **Business Rules**: This is the central cost-estimation engine of the module. It cascades Task → Costing Work Details (quantity per construction type/UOM) → per-worker-type / per-equipment / per-material cost via UOM-converted rates sourced from `Worker Type.work_details`, `Equipment.work_details`, and `Construction Type.material_details` + `Item Price` (price list "Construction Price"). `total_cost = worker_total_cost + equipment_total_cost + material_total_cost`, all computed client-side after the `get_costing` roll-up.

---

### Costing Task

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/costing_task/costing_task.json` / `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`, `editable_grid: 1`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| parent_task | Parent Task | Link | Yes | Options: Task |
| task | Task | Link | Yes | Options: Task |
| column_break_zctx | — | Column Break | No | Layout |
| construction_type | Construction Type | Link | Yes | Options: Construction Type |
| uom | UOM | Link | Yes | Options: UOM |

- **Child Tables**: N/A (used as `Costing.costing_task`)
- **Link Fields**: `parent_task` (→ Task), `task` (→ Task), `construction_type` (→ Construction Type), `uom` (→ UOM)
- **Permissions**: None defined (inherits from parent Costing)
- **Validation / Server Logic**: `CostingTask(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository (no dedicated .js; handled by `costing.js` for the `Costing Task` doctype event, see Costing entry above).
- **Business Rules**: Represents one sub-task (with its construction type and UOM) under a parent stage-task; populated automatically from Task dependency hierarchy by `Costing.update_costing_task_table`.

---

### Costing Work Details

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/costing_work_details/costing_work_details.json` / `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`, `editable_grid: 1`, `default_view: List`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| construction_type | Construction Type | Link | Yes | Options: Construction Type |
| uom | UOM | Link | Yes | Options: UOM |
| value | Value | Float | Yes | Quantity required for this construction type/UOM |

- **Child Tables**: N/A (used as `Costing.costing_work_details`)
- **Link Fields**: `construction_type` (→ Construction Type), `uom` (→ UOM)
- **Permissions**: None defined (inherits from parent Costing)
- **Validation / Server Logic**: `CostingWorkDetails(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository as a standalone file (handled within `costing.js`).
- **Business Rules**: The quantity input driving `Costing.get_costing()`'s cost roll-up — one row per unique (construction_type, uom) combination derived from the task hierarchy.

---

### Daily Progress Tracking

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/daily_progress_tracking/daily_progress_tracking.json` / `.py` / `.js`
- **Description**: Not found in repository
- **Type**: Master/transaction document (not submittable)
- **Naming**: `autoname: "format:DPR-{#####}"` (naming_rule: Expression (old style))
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| project | Project | Link | Yes | Options: Project |
| site_diary | Site Diary | Link | No | Options: Site Diary |
| column_break_rqzw | — | Column Break | No | Layout |
| date | Date | Date | No | Default: Today |
| section_break_xats | — | Section Break | No | Layout |
| task_template | Task Template | Table | Yes | Child table → Task Summary |
| section_break_dkdh | — | Section Break | No | Layout |
| dpr_activity_progress | DPR Activity Progress | Table | Yes | Child table → DPR Activity Progress |

- **Child Tables**: `task_template` → Task Summary; `dpr_activity_progress` → DPR Activity Progress
- **Link Fields**: `project` (→ Project), `site_diary` (→ Site Diary)
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | No |

- **Validation / Server Logic** (`DailyProgressTracking(Document)`):
  - `before_save()`: calls `validate_dpr_date()`, then for every `dpr_activity_progress` row that has both `task` and `total_qty`, computes `percent = (total_achieved / total_qty) * 100` and writes it directly to the standard **Task** doctype's `progress` field via `frappe.db.set_value`. Collects the set of updated tasks and calls `update_parent_progress(task)` for each.
  - `validate_dpr_date()`: throws (`frappe.throw`) if another Daily Progress Tracking record already exists for the same `project` + `date` (excluding the current doc) — enforces one DPR per project per day.
  - `update_parent_progress(task)` (module-level helper, also used elsewhere): looks up the task's `parent_task`; if present, fetches all sibling Tasks with that same `parent_task` and computes a weighted progress: `weighted_total = Σ(progress * task_weight) / 100` across children, writes it to the parent Task's `progress`, and recurses upward (`update_parent_progress(parent)`) until no parent remains. This propagates progress bottom-up through the Task hierarchy using `task_weight` as the weighting factor.
- **Whitelisted APIs**:
  - `update_daily_activity_progress_table(doc)` — given a partial doc JSON, iterates `task_template` rows' Task → `depends_on` sub-tasks (de-duplicated by (parent, sub) pair), and for each builds a `dpr_activity_progress` row by looking up the **most recent prior** `DPR Activity Progress` record for that (parent_task, task) pair (via raw SQL ordered by `creation DESC`) to carry forward `total_qty`, `total_achieved`, `percent_completed` as the starting point for a new day's entry; `construction_type`/`uom` are fetched from the sub-task's custom fields. Returns the mutated doc.
  - `update_task_progress_from_dpr(task, achieved_qty, total_qty)` — standalone whitelisted helper: computes `percent = achieved_qty/total_qty*100`, writes it to Task.progress, and calls `update_parent_progress(task)`. (Not observed to be called from this module's own `.js` file — likely called from elsewhere, e.g. a mobile/site-diary UI.)
- **Client Script**:
  - `setup`: filters the `task` field of `task_template` to Tasks where `custom_is_stage=1`, `is_group=1`, and `project == doc.project`.
  - `after_save`: publishes a realtime event `project_progress_refresh` with the project name, to let other open UIs refresh.
  - `Task Summary.task`/`task_remove` triggers `load_dpr_activity_progress()`, which calls whitelisted `update_daily_activity_progress_table` and repopulates `dpr_activity_progress`.
  - `DPR Activity Progress` row handlers:
    - `planned_today` change → `validate_progress_limits(..., "planned_today")`: warns if the entered value exceeds `remaining_qty = total_qty - (total_achieved - previous_today)`.
    - `achieved_today` change → `update_progress()` (recomputes `total_achieved`/`percent_completed`, tracks `_previous_achieved_today` to avoid double counting across edits, and rejects/reverts if new total exceeds `total_qty`) then also runs `validate_progress_limits`.
    - `total_qty` change → `update_progress()`.
- **Business Rules**: Enforces one DPR per project/day. Progress entered per sub-task cascades: DPR row → Task.progress (leaf) → weighted parent Task.progress (recursively, weighted by `task_weight`) all the way up the task tree. Client-side guards prevent `achieved_today`/`planned_today` entries from pushing cumulative achieved quantity past the row's `total_qty`.

---

### DPR Activity Progress

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/dpr_activity_progress/dpr_activity_progress.json` / `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`, `editable_grid: 1`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| parent_task | Stage | Link | No | Options: Task |
| task | Task | Link | No | Options: Task |
| construction_type | Construction Type | Link | No | fetch_from: task.custom_construction_type |
| uom | UOM | Link | No | fetch_from: task.custom_uom |
| column_break_vmax | — | Column Break | No | Layout |
| total_qty | Total Qty | Float | Yes | Target quantity |
| achieved_today | Achieved Today | Float | Yes | Entered by user |
| column_break_qqqz | — | Column Break | No | Layout |
| total_achieved | Total Achieved | Float | No | Read-only, cumulative |
| percent_completed | Percent Completed | Percent | No | Read-only, calculated |
| task_subject | Task Subject | Data | No | fetch_from: task.subject, read-only |
| column_break_fgvd | — | Column Break | No | Layout |
| parent_task_subject | Stage Subject | Data | No | Read-only |
| planned_today | Planned Today | Float | No | — |
| task_level1 | Task Level1 | Link | No | Options: Task |
| task_level2 | Task Level2 | Link | No | Options: Task |
| task2_subject | Task Level2 Subject | Data | No | Read-only |
| task_level3 | Task Level3 | Link | No | Options: Task |
| task_level5 | Task Level5 | Link | No | Options: Task |
| task_level6 | Task Level6 | Link | No | Options: Task |
| task3_suject | Task Level3 Subject | Data | No | Read-only (note field name typo "suject") |
| task_level4 | Task Level4 | Link | No | Options: Task |
| task4_subject | Task Level4 Subject | Data | No | Read-only |
| task5_subject | Task Level5 Subject | Data | No | Read-only |
| task_level7 | Task Level7 | Link | No | Options: Task |
| task7_subject | Task Level7 Subject | Data | No | Read-only |
| task_level8 | Task Level8 | Link | No | Options: Task |
| task8_subject | Task Level8 Subject | Data | No | Read-only |
| task_level9 | Task Level9 | Link | No | Options: Task |
| task9_subject | Task Level9 Subject | Data | No | Read-only |
| task_level10 | Task Level10 | Link | No | Options: Task |
| task10_subject | Task Level10 Subject | Data | No | Read-only |
| task1_subject | Task Level1 Subject | Data | No | Read-only |
| task6_subject | Task Level6 Subject | Data | No | Read-only |
| doc_name | Doc Name | Link | No | Options: DocType |
| reference_row_name | Reference Row Name | Data | No | — |
| id | Id | Dynamic Link | No | Options (target field): doc_name |
| images | Images | HTML | No | Display-only |

- **Child Tables**: N/A (used as `Daily Progress Tracking.dpr_activity_progress`)
- **Link Fields**: `parent_task`, `task`, `construction_type`, `uom`, `task_level1`–`task_level10` (all → Task except `construction_type`→Construction Type, `uom`→UOM), plus `doc_name` (→ DocType) and `id` (Dynamic Link keyed by `doc_name`)
- **Permissions**: None defined (inherits from parent)
- **Validation / Server Logic**: `DPRActivityProgress(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None in this file.
- **Client Script**: Not found as a standalone file — its field-change behavior (`planned_today`, `achieved_today`, `total_qty`) is implemented in `daily_progress_tracking.js` (see Daily Progress Tracking entry above).
- **Business Rules**: Carries a multi-level task-hierarchy breadcrumb (task_level1..10 with subjects) alongside the actual progress-tracking fields (`total_qty`, `achieved_today`, `total_achieved`, `percent_completed`). The `task_level*`/`*_subject` fields appear to support deep hierarchy display but are not populated by any logic found in this module's files (no code sets `task_level2`..`task_level10`).

---

### Equipment

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/equipment/equipment.json` / `.py` / `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `autoname: "field:equipment_name"`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| equipment_name | Equipment Name | Data | Yes | Unique; used as document name |
| column_break_wjjy | — | Column Break | No | Layout |
| section_break_woux | — | Section Break | No | Layout |
| work_details | Work Details | Table | Yes | Child table → Work Details |

- **Child Tables**: `work_details` → Work Details
- **Link Fields**: None at parent level
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | No |

- **Validation / Server Logic**: `Equipment(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Commented-out boilerplate only — no active client logic.
- **Business Rules**: Defines a piece of equipment and, via its `work_details` child rows, the productivity rate (time/rate per construction type + UOM) used by `Costing.get_costing()` to compute equipment costing.

---

### Equipment Costing

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/equipment_costing/equipment_costing.json` / `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`, `editable_grid: 1`, `default_view: List`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| equipment | Equipment | Link | No | Options: Equipment |
| qty | Qty | Int | No | — |
| rate | Rate | Float | No | — |
| column_break_rbri | — | Column Break | No | Layout |
| total_work | Total Work | Float | No | — |
| total_amount | Total Amount | Float | No | Computed client-side |
| time | Time(hrs) | Data | No | Computed client-side |

- **Child Tables**: N/A (used as `Costing.equipment_costing`)
- **Link Fields**: `equipment` (→ Equipment)
- **Permissions**: None defined (inherits from parent)
- **Validation / Server Logic**: `EquipmentCosting(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Handled within `costing.js` (row handlers on `qty`/`rate`/`total_work` recompute `total_amount` and `time`; see Costing entry).
- **Business Rules**: One row per equipment type consumed by the estimate, populated by `Costing.get_costing()`.

---

### Labour Entry Details

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/labour_entry_details/labour_entry_details.json` / `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`, `editable_grid: 1`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| contractor | Contractor | Link | No | Options: Contractor |
| attendance_status | Attendance Status | Select | No | Options: Present / Absent; shown only when contractor_type == "Individuals" (depends_on) |
| total_skilled | Total Skilled Labour Present Count | Int | No | Shown only when contractor_type == "Contract" (depends_on) |
| column_break_jngg | — | Column Break | No | Layout |
| contractor_type | Contractor type | Select | No | Options: Individuals / Contract |
| total_unskilled | Total Unskilled Labour Present Count | Int | No | Shown only when contractor_type == "Contract" (depends_on) |
| total_man_hours | Total Man Hours | Float | No | — |

- **Child Tables**: N/A (not observed to be referenced as a Table field by any doctype in this module — likely used by a doctype outside this module's scope, e.g. Site Diary)
- **Link Fields**: `contractor` (→ Contractor)
- **Permissions**: None defined (child table)
- **Validation / Server Logic**: `LabourEntryDetails(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository (no .js file).
- **Business Rules**: Tracks daily labour attendance either per individual (Present/Absent) or per contract gang (skilled/unskilled headcounts) plus total man-hours; the `depends_on` expressions drive conditional field visibility based on `contractor_type`.

---

### Material Costing

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/material_costing/material_costing.json` / `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`, `editable_grid: 1`, `default_view: List`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| item | Item | Link | No | Options: Item |
| item_name | Item Name | Data | No | fetch_from: item.item_name |
| total_qty | Total Qty | Int | No | — |
| column_break_qjwr | — | Column Break | No | Layout |
| rate | Rate | Float | No | — |
| total_amount | Total Amount | Float | No | Computed client-side |
| item_uom | UOM | Link | No | Options: UOM |

- **Child Tables**: N/A (used as `Costing.material_costing`)
- **Link Fields**: `item` (→ Item), `item_uom` (→ UOM)
- **Permissions**: None defined (inherits from parent)
- **Validation / Server Logic**: `MaterialCosting(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Handled within `costing.js` (row handlers on `rate`/`total_qty` recompute `total_amount`; see Costing entry).
- **Business Rules**: One row per material item consumed by the estimate, populated by `Costing.get_costing()` from `Construction Type.material_details` priced against the "Construction Price" price list.

---

### Material Details

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/material_details/material_details.json` / `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`, `editable_grid: 1`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| item | Item | Link | Yes | Options: Item |
| item_name | Item Name | Data | No | fetch_from: item.item_name |
| item_uom | Item UOM | Link | Yes | fetch_from: item.stock_uom; Options: UOM |
| column_break_xzgq | — | Column Break | No | Layout |
| qty | Qty | Data | Yes | Quantity of item per unit of construction_uom |
| construction_uom | Construction UOM | Link | Yes | Options: UOM |

- **Child Tables**: N/A (used as `Construction Type.material_details`)
- **Link Fields**: `item` (→ Item), `item_uom` (→ UOM), `construction_uom` (→ UOM)
- **Permissions**: None defined (inherits from parent)
- **Validation / Server Logic**: `MaterialDetails(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository (no standalone .js; `construction_uom` query filtering is done from the parent `Construction Type.js`, restricting the field's options to UOMs already declared in that Construction Type's own `uom` table).
- **Business Rules**: Defines the material bill-of-quantity for one unit of a Construction Type (e.g. "X kg of cement per m² of brickwork") — `qty` is per `construction_uom` unit; consumed by `Costing.get_costing()`'s material cost roll-up.

---

### Site

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/site/site.json` / `.py` / `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `autoname: "field:site_name"`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| site_name | Site Name | Data | No (not `reqd`, but `unique`) | Used as document name; `title_field` |
| location | Location | Data | No | — |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | No |

- **Validation / Server Logic**: `Site(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Commented-out boilerplate only — no active client logic.
- **Business Rules**: Simple master list of construction sites/locations. Note: also registered as an **Accounting Dimension** in `hooks.py` fixtures (`{"dt": "Accounting Dimension", "filters": [["name", "in", ["Site"]]]}`), meaning Site is used as a financial reporting dimension across ERPNext transactions, not just a standalone record.

---

### Task Summary

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/task_summary/task_summary.json` / `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`, `editable_grid: 1`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| task | Stage | Link | Yes | Options: Task |
| task_subject | Stage Subject | Data | No | fetch_from: task.subject |

- **Child Tables**: N/A (used as `Costing.task` and `Daily Progress Tracking.task_template`)
- **Link Fields**: `task` (→ Task)
- **Permissions**: None defined (inherits from parent)
- **Validation / Server Logic**: `TaskSummary(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Not found as a standalone file — its `task`/`task_remove` events are handled in both `costing.js` (triggers `load_costing_task`) and `daily_progress_tracking.js` (triggers `load_dpr_activity_progress`), since it's reused as a child table on both parents.
- **Business Rules**: Represents a selected "stage" Task (a group Task with `custom_is_stage=1`/`is_group=1`) used as the entry point for expanding sub-task hierarchies into both the Costing and Daily Progress Tracking workflows.

---

### UOM Conversion Rate

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/uom_conversion_rate/uom_conversion_rate.json` / `.py` / `.js`
- **Description**: Not found in repository
- **Type**: Master (Single doctype — `issingle: 1`)
- **Naming**: Single doctype (no autoname; one record named "UOM Conversion Rate")
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| uom_conversion_table | UOM Conversion Table | Table | No | Child table → UOM Conversion Table |

- **Child Tables**: `uom_conversion_table` → UOM Conversion Table
- **Link Fields**: None at parent level
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | No |

- **Validation / Server Logic**: `UOMConversionRate(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None in this file.
- **Client Script**: Commented-out boilerplate only — no active client logic.
- **Business Rules**: This Single acts as a container for editing UOM Conversion Table rows via the Desk UI, but note that the actual conversion lookups performed by `utils.convert_uom_or_warn()` query the **UOM Conversion Table** doctype directly via SQL (`SELECT ... FROM \`tabUOM Conversion Table\` WHERE uom=%s AND conversion_uom=%s`), not scoped through this Single — so any "UOM Conversion Table" records (whether entered via this Single's child grid or fixture-loaded per `hooks.py`'s `fixtures` list which includes `{"doctype": "UOM Conversion Rate"}`) are usable globally for conversion.

---

### UOM Conversion Table

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/uom_conversion_table/uom_conversion_table.json` / `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`, `editable_grid: 1`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| uom | UOM | Link | Yes | Options: UOM |
| column_break_ochw | — | Column Break | No | Layout |
| conversion_uom | Conversion UOM | Link | Yes | Options: UOM |
| column_break_gayz | — | Column Break | No | Layout |
| conversion_factor | Conversion Factor | Data | Yes | Multiplier from `uom` to `conversion_uom` |

- **Child Tables**: N/A (used as `UOM Conversion Rate.uom_conversion_table`)
- **Link Fields**: `uom` (→ UOM), `conversion_uom` (→ UOM)
- **Permissions**: None defined (inherits from parent)
- **Validation / Server Logic**: `UOMConversionTable(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository (no .js file).
- **Business Rules**: Each row defines `1 uom = conversion_factor * conversion_uom` (or similar directional factor). Read directly via raw SQL by `utils.convert_uom_or_warn(from_uom, to_uom, value)`: looks for an exact (from, to) row and multiplies by `conversion_factor`; if not found, looks for the reverse (to, from) row and divides by its `conversion_factor`; special-cases any UOM named "hrs" (case-insensitive) to pass the value through unconverted; if neither direction is found, shows a `frappe.msgprint` warning and returns `None`. This function is used pervasively by `Costing.get_costing()` to reconcile UOM mismatches between construction-type quantities and worker/equipment/material productivity rates.

---

### Work Details

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/work_details/work_details.json` / `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`, `editable_grid: 1`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| construction_type | Construction Type | Link | Yes | Options: Construction Type |
| time | Time(min) | Data | No | Minutes required per unit |
| opening_reading | Opening Reading | Float | No | Equipment meter reading |
| hours | Hours | Float | No | — |
| column_break_paqg | — | Column Break | No | Layout |
| uom | UOM | Link | Yes | Options: UOM |
| rate | Rate | Float | Yes | Cost rate per unit |
| closing_reading | Closing Reading | Float | No | Equipment meter reading |
| diesel_filledin_ltr | Diesel filled(in LTR) | Float | No | — |

- **Child Tables**: N/A (used as `Worker Type.work_details` and `Equipment.work_details`)
- **Link Fields**: `construction_type` (→ Construction Type), `uom` (→ UOM)
- **Permissions**: None defined (inherits from parent)
- **Validation / Server Logic**: `WorkDetails(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository (no .js file).
- **Business Rules**: Defines productivity (`time` per unit, `rate` per unit) of a Worker Type or Equipment against a specific Construction Type + UOM; this is the rate table read by `Costing.get_costing()` to compute worker/equipment costing. The `opening_reading`/`closing_reading`/`diesel_filledin_ltr` fields (equipment fuel/usage log fields) are present in the schema but not read by any logic found in this module — likely populated/consumed by equipment-usage tracking outside this module's scope.

---

### Worker Costing

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/worker_costing/worker_costing.json` / `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`, `editable_grid: 1`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| worker_type | Worker Type | Link | No | Options: Worker Type |
| qty | Qty | Int | No | Headcount of this worker type |
| rate | Rate | Float | No | — |
| column_break_qjwr | — | Column Break | No | Layout |
| total_work | Total Work | Float | No | — |
| total_amount | Total Amount | Float | No | Computed client-side |
| time | Time(hrs) | Data | No | Computed client-side |

- **Child Tables**: N/A (used as `Costing.worker_costing`)
- **Link Fields**: `worker_type` (→ Worker Type)
- **Permissions**: None defined (inherits from parent)
- **Validation / Server Logic**: `WorkerCosting(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Handled within `costing.js` (row handlers on `qty`/`rate`/`total_work` recompute `total_amount` and `time`; see Costing entry).
- **Business Rules**: One row per worker type consumed by the estimate, populated by `Costing.get_costing()`, keyed by the count of matching `Worker Master` records.

---

### Worker Master

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/worker_master/worker_master.json` / `.py` / `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `autoname: "field:worker_name"`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| worker_name | Worker Name | Data | Yes | Unique; used as document name |
| worker_type | Worker Type | Link | No | Options: Worker Type |

- **Child Tables**: None
- **Link Fields**: `worker_type` (→ Worker Type)
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | No |

- **Validation / Server Logic**: `WorkerMaster(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Commented-out boilerplate only — no active client logic.
- **Business Rules**: Individual worker roster records, one per worker, tagged with a Worker Type. `Costing.get_costing()` counts `Worker Master` records grouped by `worker_type` (`frappe.get_all("Worker Master", fields=["worker_type"])`) to determine the available headcount per worker type when dividing total task-minutes into per-worker hours.

---

### Worker Type

- **Source**: `quantbit_construction_management/quantbit_construction_management/doctype/worker_type/worker_type.json` / `.py` / `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `autoname: "field:worker_type"`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| worker_type | Worker Type | Data | Yes | Unique; options note says "Worker Master" but fieldtype is Data (not a Link); used as document name |
| is_available | Is Available | Check | No | Default 1 |
| column_break_hjtq | — | Column Break | No | Layout |
| section_break_fxak | — | Section Break | No | Layout |
| work_details | Work Details | Table | Yes | Child table → Work Details |

- **Child Tables**: `work_details` → Work Details
- **Link Fields**: None at parent level (note: `worker_type` field has `"options": "Worker Master"` in the JSON but `fieldtype` is `Data`, so this is not an active Link relationship — likely a leftover/unused options value)
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | No |

- **Validation / Server Logic**: `WorkerType(Document)` controller class is empty (`pass`).
- **Whitelisted APIs**: None.
- **Client Script**: Commented-out boilerplate only — no active client logic.
- **Business Rules**: Defines a category of worker (e.g. "Mason", "Helper") and, via its `work_details` child rows, the productivity rate (time/rate per construction type + UOM) used by `Costing.get_costing()` to compute worker costing. `is_available` flag exists in the schema but is not read by any logic found in this module (not filtered on in `get_costing`, which iterates all Worker Types via `frappe.get_all("Worker Type", pluck="name")` regardless of availability).

---

---

## Module: Tendering

### Bid Submission Checklist

- **Source**: `tendering/doctype/bid_submission_checklist/bid_submission_checklist.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master (standalone list of checklist templates)
- **Naming**: `field:bid_submission_checklist_name` (autoname by the `bid_submission_checklist_name` field value)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| bid_submission_checklist_name | Bid Submission Checklist Name | Data | No | `unique: 1` |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | No |

- **Validation / Server Logic**: `BidSubmissionChecklist(Document)` — no overridden methods (`pass` only).
- **Whitelisted APIs**: None
- **Client Script**: `bid_submission_checklist.js` contains only a commented-out `refresh` stub — no active logic.
- **Business Rules**: Acts as a named template referenced by `Bid Submission Checklist Details` rows and by `Tender.bid_submission_checklist_details`.

---

### Bid Submission Checklist Details

- **Source**: `tendering/doctype/bid_submission_checklist_details/bid_submission_checklist_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: Not applicable (child table, uses default `hash` naming)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| bid_submission_checklist_name | Bid Submission Checklist Name | Link → Bid Submission Checklist | No | `in_list_view`, `in_standard_filter` |
| assigned_to | Assigned To | Link → User | No | `in_list_view`, `in_standard_filter` |
| deadline | Deadline | Date | No | `in_list_view`, `in_standard_filter` |
| status | Status | Select | No | Options: (blank)/Planned/Assigned/In Progress/Done/Hold |
| column_break_srfr / column_break_xpwv / column_break_akqj | — | Column Break | No | Layout only |

- **Child Tables**: N/A (this is itself a child table)
- **Link Fields**: `bid_submission_checklist_name` → Bid Submission Checklist; `assigned_to` → User
- **Permissions**: None defined (`"permissions": []` — inherits from parent Tender doctype)
- **Validation / Server Logic**: `BidSubmissionChecklistDetails(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Embedded in `Tender.bid_submission_checklist_details` to track per-checklist-item assignment/deadline/status during the bid submission stage.

---

### Contract Type

- **Source**: `tendering/doctype/contract_type/contract_type.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `field:contract_type_name`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| contract_type_name | Contract Type Name | Data | No | `unique: 1` |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: System Manager — Read/Write/Create/Delete (full CRUD, share, export/print/report/email)
- **Validation / Server Logic**: `ContractType(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Referenced by `Tender.contract_type` (Link) to classify the contract mechanism (e.g., lump sum, item rate).

---

### Cost Code Master

- **Source**: `tendering/doctype/cost_code_master/cost_code_master.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `field:cost_code_no`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| cost_code_no | Cost Code No | Data | Yes | `unique: 1`, `in_list_view` |
| cost_code_name | Cost Code Name | Data | No | — |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: System Manager — full CRUD/share/export/print/report/email
- **Validation / Server Logic**: `CostCodeMaster(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Referenced from `Costing Sheet Details.cost_head` and `Tender Item.cost_code` for cost-classification/budgeting.

---

### Costing Sheet Details

- **Source**: `tendering/doctype/costing_sheet_details/costing_sheet_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| cost_head | Cost Head | Link → Cost Code Master | No | `in_list_view`, `in_standard_filter` |
| description | Description | Data | No | `in_list_view`, `in_standard_filter` |
| estimated_amount | Estimated Amount | Currency | No | `in_list_view`, `in_standard_filter` |
| _on_cv | (%) On CV | Percent | No | `in_list_view`, `in_standard_filter` |
| remarks | Remarks | Data | No | `in_list_view`, `in_standard_filter` |
| column_break_aknz / _tzgm / _tfze / _erzr | — | Column Break | No | Layout |

- **Child Tables**: N/A
- **Link Fields**: `cost_head` → Cost Code Master
- **Permissions**: None defined
- **Validation / Server Logic**: `CostingSheetDetails(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Embedded in `Tender.costing_sheet_details`; feeds the Costing Sheet tab used to compute `Tender.total_ctc`, `contract_value`, `profit_margin`, `net_profit_margin` (computation done client-side in `tender.js`, see Tender section).

---

### Deliverable Details

- **Source**: `tendering/doctype/deliverable_details/deliverable_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| deliverable_name | Deliverable Name | Link → Tender Deliverables | No | `in_list_view`, `in_standard_filter` |

- **Child Tables**: N/A
- **Link Fields**: `deliverable_name` → Tender Deliverables
- **Permissions**: None defined
- **Validation / Server Logic**: `DeliverableDetails(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Embedded in `Tender.list_of_deliverables` (Documents/Deliverables tab).

---

### Financial Qualification Details

- **Source**: `tendering/doctype/financial_qualification_details/financial_qualification_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| description | Description | Text Editor | No | `in_list_view`, `in_standard_filter` |
| comments | Comments | Data | No | `in_list_view`, `in_standard_filter` |
| attachemnts | Attachemnts (sic) | Attach | No | `in_list_view`, `in_standard_filter` |
| team_remarks | Team Remarks | Data | No | `in_list_view`, `in_standard_filter` |
| section_break_dgoa, column_break_hqhx, _mxgd, _mdqg | — | Section/Column Break | No | Layout |

- **Child Tables**: N/A
- **Link Fields**: None
- **Permissions**: None defined
- **Validation / Server Logic**: `FinancialQualificationDetails(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Used exclusively via the Opportunity custom field `custom_financial_qualification_detail` (permlevel 2 — restricted field-level permission), not directly embedded in Tender's own field_order. Captures qualifying criteria evaluated pre-bid.

---

### Invoicing Type

- **Source**: `tendering/doctype/invoicing_type/invoicing_type.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `field:invoicing_type_name`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| invoicing_type_name | Invoicing Type Name | Data | No | `unique: 1` |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: System Manager — full CRUD/share/export/print/report/email
- **Validation / Server Logic**: `InvoicingType(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Referenced by `Tender.invoicing_type` (e.g. milestone-based, running-account billing).

---

### Item Type

- **Source**: `tendering/doctype/item_type/item_type.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `field:item_type_name`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| item_type_name | Item Type Name | Data | No | `unique: 1` |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: System Manager — full CRUD/share/export/print/report/email
- **Validation / Server Logic**: `ItemType(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Referenced by `Task BOQ Details.item_type` (fetched from `item.custom_item_type`) and by `Tender Item.item_type`, classifying BOQ line items (e.g. material/labour/equipment).

---

### Opportunity Parameter

- **Source**: `tendering/doctype/opportunity_parameter/opportunity_parameter.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `field:parameter`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| parameter | Parameter | Data | No | `unique: 1` |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: System Manager — full CRUD/share/export/print/report/email
- **Validation / Server Logic**: `OpportunityParameter(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Referenced by `Sales Recommendation Details.parameter` — defines the scoring criteria (e.g. "Strategic Fit") used in sales-recommendation scoring on the Opportunity.

---

### Post Bid Checklist

- **Source**: `tendering/doctype/post_bid_checklist/post_bid_checklist.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `field:post_bid_checklist_name`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| post_bid_checklist_name | Post Bid Checklist Name | Data | No | `unique: 1` |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: System Manager — full CRUD/share/export/print/report/email
- **Validation / Server Logic**: `PostBidChecklist(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Named template referenced by `Post Bid Checklist Details` / `Tender.post_bid_checklist_details`.

---

### Post Bid Checklist Details

- **Source**: `tendering/doctype/post_bid_checklist_details/post_bid_checklist_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| post_bid_checklist_name | Post Bid Checklist Name | Link → Post Bid Checklist | No | `in_list_view`, `in_standard_filter` |
| assigned_to | Assigned To | Link → User | No | `in_list_view`, `in_standard_filter` |
| deadline | Deadline | Datetime | No | `in_list_view`, `in_standard_filter` |
| status | Status | Select | No | Options: (blank)/Planned/Assigned/In Progress/Done/Hold |
| column_break_fnsi / _zjoj / _bece | — | Column Break | No | Layout |

- **Child Tables**: N/A
- **Link Fields**: `post_bid_checklist_name` → Post Bid Checklist; `assigned_to` → User
- **Permissions**: None defined
- **Validation / Server Logic**: `PostBidChecklistDetails(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Embedded in `Tender.post_bid_checklist_details`, tracks post-bid-stage task assignment/status.

---

### Pre Bid Checklist

- **Source**: `tendering/doctype/pre_bid_checklist/pre_bid_checklist.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `field:pre_bid_checklist_name`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| pre_bid_checklist_name | Pre Bid Checklist Name | Data | No | `unique: 1` |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: System Manager — full CRUD/share/export/print/report/email
- **Validation / Server Logic**: `PreBidChecklist(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Named template referenced by `Pre Bid Checklist Details` / `Tender.pre_bid_checklist_details`.

---

### Pre Bid Checklist Details

- **Source**: `tendering/doctype/pre_bid_checklist_details/pre_bid_checklist_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| pre_bid_checklist_name | Pre Bid Checklist Name | Link → Pre Bid Checklist | No | `in_list_view`, `in_standard_filter` |
| assigned_to | Assigned To | Link → User | No | `in_list_view`, `in_standard_filter` |
| deadline | Deadline | Datetime | No | `in_list_view`, `in_standard_filter` |
| status | Status | Select | No | Options: (blank)/Planned/Assigned/In Progress/Done/Hold |
| column_break_jzne / _zrbs / _drif | — | Column Break | No | Layout |

- **Child Tables**: N/A
- **Link Fields**: `pre_bid_checklist_name` → Pre Bid Checklist; `assigned_to` → User
- **Permissions**: None defined
- **Validation / Server Logic**: `PreBidChecklistDetails(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Embedded in `Tender.pre_bid_checklist_details`, tracks pre-bid-stage task assignment/status (e.g. document collection, site visit).

---

### Project Warehouse Details

- **Source**: `tendering/doctype/project_warehouse_details/project_warehouse_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| warehouse | Warehouse | Link → Warehouse | No | `in_list_view` |

- **Child Tables**: N/A
- **Link Fields**: `warehouse` → Warehouse (ERPNext stock doctype)
- **Permissions**: None defined
- **Validation / Server Logic**: `ProjectWarehouseDetails(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Not embedded in `Tender`'s own `field_order` (no matching table field found in `tender.json`); likely intended for linking warehouses to a Project once created from a Tender, but no referencing parent field was found in the Tendering module JSONs examined.

---

### Sales Recommendation Details

- **Source**: `tendering/doctype/sales_recommendation_details/sales_recommendation_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| parameter | Parameter | Link → Opportunity Parameter | No | `in_list_view`, `in_standard_filter` |
| comments | Comments | Data | No | `in_list_view`, `in_standard_filter` |
| score | Score | Select | No | Options `0`–`10` |
| attachments | Attachments | Attach | No | `in_list_view`, `in_standard_filter` |
| team_remarks | Team Remarks | Data | No | `in_list_view`, `in_standard_filter` |
| column_break_mith / _thmz / _mjod / _fnym | — | Column Break | No | Layout |

- **Child Tables**: N/A
- **Link Fields**: `parameter` → Opportunity Parameter
- **Permissions**: None defined
- **Validation / Server Logic**: `SalesRecommendationDetails(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Used via Opportunity custom field `custom_sales_team_recommendations` (permlevel 3 — restricted), part of the Sales Recommendation tab that scores an opportunity against Opportunity Parameters before deciding to bid.

---

### Task BOM Details

- **Source**: `tendering/doctype/task_bom_details/task_bom_details.py` (no `.json` file present in the directory)
- **Description**: Not found in repository
- **Type**: Unknown / Anomaly — the doctype directory contains only a controller (`task_bom_details.py`) with no `task_bom_details.json`, no `__init__.py`, and no client script. Without the JSON definition the doctype metadata (fields, istable, permissions) cannot be determined from the repository.
- **Naming**: Not found in repository
- **Fields**: Not found in repository (no JSON present)
- **Child Tables**: Not found in repository
- **Link Fields**: Not found in repository
- **Permissions**: Not found in repository
- **Validation / Server Logic**: `TaskBOMDetails(Document)` class exists — no overridden methods (`pass` only).
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Given the name, likely intended as a BOM/material breakdown per Task (parallel to `Task BOQ Details`), but appears incomplete/orphaned in this codebase — flag for follow-up with the engineering team.

---

### Task BOQ Details

- **Source**: `tendering/doctype/task_boq_details/task_boq_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| item_type | Item Type | Data | Yes | `fetch_from: item.custom_item_type`, `in_list_view`, `in_standard_filter` |
| item | Item | Link → Item | Yes | `in_list_view`, `in_standard_filter` |
| item_name | Item Name | Data | No | `fetch_from: item.item_name` |
| qty | Qty | Float | No | `in_list_view`, `in_standard_filter` |
| uom | UOM | Link → UOM | No | `fetch_from: item.stock_uom`, `in_list_view`, `in_standard_filter` |
| rate | Rate | Float | No | `in_list_view`, `in_standard_filter` |
| total_amount | Total Amount | Float | No | `in_list_view`, `in_standard_filter` |
| column_break_pcdg / _aemf / _zaad | — | Column Break | No | Layout |

- **Child Tables**: N/A
- **Link Fields**: `item` → Item; `uom` → UOM (fetched)
- **Permissions**: None defined
- **Validation / Server Logic**: `TaskBOQDetails(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository (no `.js` file in directory)
- **Business Rules**: Not referenced in `Tender.json`'s own `field_order`/fields (no parent Table field pointing to "Task BOQ Details" found in the doctypes examined) — likely used elsewhere (e.g. Task doctype customization) outside this module's scope.

---

### Technical Qualification Details

- **Source**: `tendering/doctype/technical_qualification_details/technical_qualification_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| description | Description | Text Editor | No | `in_list_view`, `in_standard_filter` |
| comments | Comments | Data | No | `in_list_view`, `in_standard_filter` |
| attachments | Attachments | Attach | No | `in_list_view`, `in_standard_filter` |
| team_remarks | Team Remarks | Data | No | `in_list_view`, `in_standard_filter` |
| section_break_mmey, column_break_mwuu, _qrvr | — | Section/Column Break | No | Layout |

- **Child Tables**: N/A
- **Link Fields**: None
- **Permissions**: None defined
- **Validation / Server Logic**: `TechnicalQualificationDetails(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Used via Opportunity custom field `custom_technical_qualification_details` (permlevel 1 — restricted), captures technical eligibility criteria evaluated pre-bid.

---

### Tender

- **Source**: `tendering/doctype/tender/tender.json`, `.py`, `.js`, `test_tender.py`
- **Description**: "Potential Sales Deal" (from JSON `description`)
- **Type**: Standard Document (NOT submittable — no `is_submittable` flag is set in the JSON, and every workflow state uses `doc_status: "0"`; lifecycle is governed entirely by the `workflow_state` field, not by `docstatus`/Submit). This is the central document of the Tendering module.
- **Naming**: `naming_series:` — series options `Tender-.YYYY.-`
- **Fields** (abbreviated to the most structurally significant; full field_order spans ~140 fields across many tabs — CRM/Opportunity-style fields plus a large "Tender Details", "Bid", "BOQ/SOR", "Documents/Deliverables", "Corrigendum", "Confidential Documents", "Competitor", "Pre/Post Bid Checklist", "Costing Sheet" tab set):

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Series | Select | Yes | `Tender-.YYYY.-`, `set_only_once` |
| opportunity_from | Opportunity From | Link → DocType | Yes | filtered client-side to Customer/Lead |
| party_name | Party | Dynamic Link | Yes | options = `opportunity_from` |
| customer_name | Customer Name | Link → Customer | No | shown only when `opportunity_from == "Lead"` |
| status | Status | Select | Yes | Open/Quotation/Converted/Lost/Replied/Closed, default "Open" |
| workflow_state | Workflow State | Link → Workflow State | No | hidden, read_only |
| opportunity_type | Opportunity Type | Link → Opportunity Type | No | |
| opportunity_owner | Opportunity Owner | Link → User | No | |
| sales_stage | Sales Stage | Link → Sales Stage | No | default "Prospecting" |
| probability | Probability (%) | Percent | No | default "100" |
| company | Company | Link → Company | Yes | |
| transaction_date | Opportunity Date | Date | Yes | default "Today" |
| title | Title | Data | No | hidden, `subject_field`/`title_field` |
| lost_reasons | Lost Reasons | Table MultiSelect → Opportunity Lost Reason Detail | No | shown when status == Lost |
| competitors | Competitors | Table MultiSelect → Competitor Detail | No | read_only |
| contact_person | Contact Person | Link → Contact | No | |
| items | Items | Table → Opportunity Item | No | |
| total / base_total | Total | Currency | No | read_only |
| tenderrfp_number | Tender/RFP Number | Data | No | Tender Details tab |
| tender_notification_date | Tender Notification Date | Date | No | |
| tender_submission_date | Tender Submission Date | Date | No | |
| pre_bid_meeting_date | Pre Bid Meeting Date | Date | No | |
| project_allotment_date | Project Allotment Date | Date | No | |
| technical_bid_opening_date | Technical Bid Opening Date | Date | No | |
| tender_reference | Tender Reference | Data | No | |
| expected_start_date / expected_end_date | Expected Start/End Date | Date | No | |
| jvconsortium | JV/Consortium | Select | No | Allowed/Not Allowed |
| contract_type | Contract Type | Link → Contract Type | No | |
| invoicing_type | Invoicing Type | Link → Invoicing Type | No | |
| emd_exempted | EMD Exempted | Select | No | Yes/No |
| earnest_money_deposit | Earnest Money Deposit | Float | No | shown when `emd_exempted == "No"` |
| tender_fees_exempted | Tender Fees Exempted | Select | No | Yes/No |
| tender_fees | Tender Fees | Float | No | shown when `tender_fees_exempted == "No"` |
| project_duration | Project Duration | Float | No | |
| defect_liability_periodmonths | Defect Liability Period(Months) | Int | No | |
| bid_validity_periodmonths | Bid Validity Period(Months) | Int | No | |
| estimated_cost | Estimated Cost | Float | No | |
| performance_bond | Performance Bond(%) | Float | No | |
| location | Location | Link → Location | No | |
| scope_of_work | Scope Of Work | Text Editor | No | Bid tab |
| bid_evaluation_criteriatechnical | Bid Evaluation Criteria(Technical) | Text Editor | No | |
| bid_evaluation_criteriacommerical | Bid Evaluation Criteria(Commercial) | Text Editor | No | |
| boq | BOQ | Link → Bill of Quantities | No | BOQ/SOR tab; drives `get_boq_details` fetch |
| boq_details | BOQ Details | Table → Tender Item | No | |
| list_of_deliverables | List Of Deliverables | Table → Deliverable Details | No | |
| documents | Documents | Table → Tender Documents | No | |
| corriendum_details | Corrigendum Details | Table → Tender Corrigendum | No | |
| confidential_documents_details | Confidential Documents Details | Table → Tender Confidential Documents | No | `permlevel: 4` (restricted field-level permission) |
| competitor_details | Competitor Details | Table → Tender Competitor Details | No | |
| pre_bid_checklist_details | Pre Bid Checklist Details | Table → Pre Bid Checklist Details | No | |
| bid_submission_checklist_details | Bid Submission Checklist Details | Table → Bid Submission Checklist Details | No | |
| post_bid_checklist_details | Post Bid Checklist Details | Table → Post Bid Checklist Details | No | |
| total_ctc | Total CTC | Currency | No | Costing Sheet tab |
| profit_on_ctc | Profit(%) on CTC | Float | No | |
| contract_value | Contract Value | Float | No | read_only, computed client-side |
| profit_margin | Profit Margin | Float | No | read_only, computed client-side |
| net_profit_margin | Net Profit(%) Margin | Float | No | read_only, computed client-side |
| costing_sheet_details | Costing Sheet Details | Table → Costing Sheet Details | No | |
| show_create_customer_button | Show Create Customer Button | Check | No | default 0, server-managed |
| reference_doc | Reference Doc | Link → DocType | No | read_only |
| reference_doc_link | Reference Doc Link | Dynamic Link | No | read_only; back-link target of the Opportunity "Tender" connection |

- **Child Tables**: `items`→Opportunity Item, `lost_reasons`→Opportunity Lost Reason Detail, `competitors`→Competitor Detail, `boq_details`→Tender Item, `list_of_deliverables`→Deliverable Details, `documents`→Tender Documents, `corriendum_details`→Tender Corrigendum, `confidential_documents_details`→Tender Confidential Documents (permlevel 4), `competitor_details`→Tender Competitor Details, `pre_bid_checklist_details`→Pre Bid Checklist Details, `bid_submission_checklist_details`→Bid Submission Checklist Details, `post_bid_checklist_details`→Post Bid Checklist Details, `costing_sheet_details`→Costing Sheet Details, `notes`→CRM Note (hidden)
- **Link Fields**: `party_name` (Dynamic Link, options=`opportunity_from`), `customer_name`→Customer, `opportunity_type`→Opportunity Type, `opportunity_owner`→User, `sales_stage`→Sales Stage, `company`→Company, `campaign`→Campaign, `language`→Language, `industry`→Industry Type, `market_segment`→Market Segment, `country`→Country, `territory`→Territory, `customer_group`→Customer Group, `contact_person`→Contact, `customer_address`→Address, `currency`→Currency, `contract_type`→Contract Type, `invoicing_type`→Invoicing Type, `location`→Location, `boq`→Bill of Quantities, `reference_doc`(Link→DocType)/`reference_doc_link`(Dynamic Link, options=`reference_doc`) — the pair used to back-reference the source Opportunity. Doctype-level `links` array also declares a connection to `Project.custom_reference_doc_name`.
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| Sales User | Yes | Yes | Yes | Yes | No (not submittable) |
| Sales Manager | Yes | Yes | Yes | Yes | No |
| Preliminary Approver | Yes | Yes | Yes | Yes | No |
| Commercial Approver | Yes | Yes | Yes | Yes | No |
| Top Management | Yes | Yes | Yes | Yes | No |
| Business Head | Yes | Yes | Yes | Yes | No |
| System Manager | Yes | Yes | Yes | Yes | No |

(All roles above additionally have `email`, `print`, `report`, `share`; Sales Manager also has `export`/`import`. No `submit` permission bit is present on any row because the doctype is not submittable — its "submit" workflow action, "Submit Tender", is a Workflow transition, not a docstatus submit.)

- **Validation / Server Logic** (`tender.py`, class `Tender(Document)`):
  - `validate()` — calls `check_show_create_customer_button()`.
  - `on_update()` — calls `check_show_create_customer_button()` again (keeps the flag current on every save).
  - `on_update_after_submit()` — also calls `check_show_create_customer_button()` (defensive, though doctype isn't submittable).
  - `before_submit()` — auto-creates a linked `Project` (`project_name = self.name`, `status = "Open"`, `is_active = "Yes"`, `customer` from `customer_name`/`party_name` depending on `opportunity_from`, `custom_reference_doc_name = self.name`) via `ignore_permissions=True`. (Dead code in practice since the doctype has no `is_submittable: 1`, so `before_submit` would never fire through the normal Submit action; it only would run if submit is invoked programmatically.)
  - `check_show_create_customer_button()` — sets `self.show_create_customer_button = True` only if `workflow_state == "Alloted"` AND `opportunity_from == "Lead"` AND `party_name` is set AND `customer_name` is empty AND a `Lead` record named `party_name` exists.
- **Whitelisted APIs** (`@frappe.whitelist()`):
  1. `Tender.create_customer_from_lead(self)` (instance method) — Creates (or reuses) a `Customer` from the linked `Lead`. Looks up existing Customer by `lead_name`; if found, links it and saves; otherwise creates a new `Customer` (`customer_type: Company`, name from `lead_doc.lead_name` or `company_name` or `party_name`), links it to the Tender, and saves (`ignore_permissions=True`). Throws if `opportunity_from != "Lead"` or Lead doesn't exist. Returns `{customer, customer_name, message}`.
  2. `create_project_from_tender(tender_name, project_name)` (module-level) — Creates a `Project` with a user-supplied name from a Tender (throws if `project_name` blank or a Project with that name already exists). Populates `customer`, `expected_start_date/end_date`, `custom_reference_doc_name`, `custom_bill_of_quantities` (= `tender_doc.boq`). Iterates `tender_doc.boq_details` and, for each row, walks all task/subtask/task_level1-10 references, setting `Task.project` and `Task.custom_boq_name` for every distinct task (including each task's parent stage via `parent_task`). Sets `Tender.workflow_state = "Project Created"` directly via `frappe.db.set_value`. Shows a success `msgprint` with a link and returns `{project, message}`.
  3. `get_boq_details(boq)` (module-level) — Given a `Bill of Quantities` name, loads it and maps each `boq_items` row into a Tender-Item-shaped dict (item_code, uom←unit, qty←quantity, rate←unit_rate, amount, task/subtask hierarchy fields task_level1–10 and their subject fields, item_type, cost_code, item_name←item_no). Returns a list of dicts consumed by the client script to populate `boq_details`.
- **Client Script** (`tender.js`):
  - `setup`: registers `frm.add_fetch("task", "subject", "task_subject")`.
  - `refresh`: restricts `opportunity_from` query to `Customer`/`Lead`; shows a "Create Customer" button when `show_create_customer_button == 1` (calls whitelisted `create_customer_from_lead`); shows a "Create Project" button when `workflow_state == "Alloted"` (opens a dialog prompting for a Project Name, then calls `create_project_from_tender`).
  - `total_ctc` / `profit_on_ctc` field triggers call `calculate_contract_values(frm)`, which computes `contract_value = total_ctc * (1 + profit_on_ctc/100)`, `profit_margin = contract_value - total_ctc`, `net_profit_margin = profit_margin / contract_value * 100` (all client-side, not persisted server-side beyond the saved field values).
  - `boq` field trigger: calls server method `get_boq_details`, clears and repopulates the `boq_details` child table, dynamically toggling visibility of `task_level{1..10}` / `level{1..10}_subject` grid columns based on the deepest hierarchy level actually used in the returned data.
  - Child-table event on `Tender Item`: `task` field change auto-fetches `Task.subject` into `task_subject` if not already set.
- **Business Rules**:
  - Tender's `opportunity_from`/`party_name` mirror the ERPNext CRM Opportunity party pattern (Dynamic Link to Customer or Lead).
  - The doctype is functionally a superset/clone of the ERPNext Opportunity doctype (same field set for organization/contact/items) with an added Tendering-specific field set (Tender Details, Bid, BOQ/SOR, Documents/Deliverables, Corrigendum, Confidential Documents, Competitor, Pre/Post Bid Checklist, Costing Sheet tabs) — this is intentional: Tenders are created from Opportunities (see Custom Overrides section) and are largely a "promoted" copy.
  - `Confidential Documents Details` is set to `permlevel: 4`, restricting visibility/edit to roles explicitly granted that permission level (not shown in the base `permissions` array captured above — those are all permlevel 0).
  - Lifecycle/state is driven by the `workflow_state` field and the "Tender Submission" workflow (see Workflow section), not by Frappe's submit/docstatus mechanism.
  - Project creation is double-wired: `before_submit()` (submit-based, effectively unused) vs. the whitelisted `create_project_from_tender` (workflow/UI-button-based, actually used) — the latter is the real path, triggered from the "Alloted" workflow state.

---

### Tender Category

- **Source**: `tendering/doctype/tender_category/tender_category.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `field:tender_category_name`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| tender_category_name | Tender Category Name | Data | No | `unique: 1` |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: System Manager — full CRUD/share/export/print/report/email
- **Validation / Server Logic**: `TenderCategory(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Referenced by Opportunity custom field `custom_tender_category` (see Custom Overrides section); not present directly as a field in `tender.json`'s field list examined (Tender's own category classification appears to live only on the Opportunity side pre-conversion).

---

### Tender Competitor Details

- **Source**: `tendering/doctype/tender_competitor_details/tender_competitor_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| competitor | Competitor | Link → Competitor | No | `in_list_view`, `in_standard_filter` |
| bid_amount | Bid Amount | Currency | No | `in_list_view`, `in_standard_filter` |
| column_break_lsva | — | Column Break | No | Layout |

- **Child Tables**: N/A
- **Link Fields**: `competitor` → Competitor
- **Permissions**: None defined
- **Validation / Server Logic**: `TenderCompetitorDetails(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Embedded in `Tender.competitor_details` (Competitor tab) — records each competitor's bid amount for comparison.

---

### Tender Confidential Documents

- **Source**: `tendering/doctype/tender_confidential_documents/tender_confidential_documents.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| name1 | Name | Data | No | `in_list_view`, `in_standard_filter` |
| document_type | Document Type | Data | No | `in_list_view`, `in_standard_filter` |
| attachment | Attachment | Attach | No | `in_list_view`, `in_standard_filter` |
| column_break_ltay / _ohae | — | Column Break | No | Layout |

- **Child Tables**: N/A
- **Link Fields**: None
- **Permissions**: None defined
- **Validation / Server Logic**: `TenderConfidentialDocuments(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Embedded in `Tender.confidential_documents_details`, which is set to `permlevel: 4` on the parent — restricted-access document storage (e.g. price bids, sensitive commercial terms).

---

### Tender Corrigendum

- **Source**: `tendering/doctype/tender_corrigendum/tender_corrigendum.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| date | Date | Date | No | `in_list_view`, `in_standard_filter` |
| changes_incorporated | Changes Incorporated | Small Text | No | `in_list_view`, `in_standard_filter` |
| details | Details | Text Editor | No | `in_list_view`, `in_standard_filter` |
| updated_by | Updated By | Link → User | No | `in_list_view`, `in_standard_filter` |
| column_break_ftcn, section_break_pnvi, section_break_gufi | — | Column/Section Break | No | Layout |

- **Child Tables**: N/A
- **Link Fields**: `updated_by` → User
- **Permissions**: None defined
- **Validation / Server Logic**: `TenderCorrigendum(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Embedded in `Tender.corriendum_details` (Corrigendum tab) — logs amendments/addenda issued against a published tender.

---

### Tender Deliverables

- **Source**: `tendering/doctype/tender_deliverables/tender_deliverables.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `field:deliverables_name`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| deliverables_name | Deliverables Name | Data | No | `unique: 1` |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: System Manager — full CRUD/share/export/print/report/email
- **Validation / Server Logic**: `TenderDeliverables(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Master list referenced by `Deliverable Details.deliverable_name`, which is embedded in `Tender.list_of_deliverables`.

---

### Tender Documents

- **Source**: `tendering/doctype/tender_documents/tender_documents.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| name1 | Name | Data | No | `in_list_view`, `in_standard_filter` |
| document_type | Document Type | Data | No | `in_list_view`, `in_standard_filter` |
| attachments | Attachments | Attach | No | `in_list_view`, `in_standard_filter` |
| column_break_qrlw / _xjux | — | Column Break | No | Layout |

- **Child Tables**: N/A
- **Link Fields**: None
- **Permissions**: None defined
- **Validation / Server Logic**: `TenderDocuments(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository
- **Business Rules**: Embedded in `Tender.documents` (Documents/Deliverables tab) — general (non-confidential) tender document attachments, complementary to `Tender Confidential Documents`.

---

### Tender Item

- **Source**: `tendering/doctype/tender_item/tender_item.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| item_code | Item Code | Link → Item | No | `in_list_view`, `in_standard_filter` |
| uom | UOM | Link → UOM | Yes | `in_list_view`, `in_standard_filter` |
| qty | Quantity | Float | Yes | `in_list_view`, `in_standard_filter` |
| task | Task | Link → Task | No | `in_list_view`, `in_standard_filter` |
| subtask | Subtask | Link → Task | No | `link_filters: [["Task","custom_is_subtask","=",1]]`, `in_list_view`, `in_standard_filter` |
| subtask_name | Subtask Name | Data | No | `fetch_from: subtask.subject`, read_only, `in_list_view` |
| item_name | Item Name | Data | No | `fetch_from: item_code.item_name`, `in_list_view` |
| item_type | Item Type | Data | No | — |
| cost_code | Cost Code | Link → Cost Code Master | No | — |
| rate | Rate | Currency | Yes | `in_list_view` |
| amount | Amount | Currency | No | `in_list_view`, `in_standard_filter` |
| task_subject | Task Subject | Data | No | `fetch_from: task.subject`, read_only, `in_list_view`, `in_standard_filter` |
| task_level1 … task_level10 | Task | Link → Task | No | 10 hierarchical task-level link fields (levels 2/3 also `in_standard_filter`) |
| level1_subject … level10_subject | Subject | Data | No | `fetch_from: task_level{n}.subject`, read_only (levels 1–4 `in_list_view`; levels 2/3 also `in_standard_filter`) |

- **Child Tables**: N/A
- **Link Fields**: `item_code`→Item, `uom`→UOM, `task`/`subtask`/`task_level1..10`→Task, `cost_code`→Cost Code Master
- **Permissions**: None defined
- **Validation / Server Logic**: `TenderItem(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: No dedicated `.js` file for this doctype, but `tender.js` registers a `frappe.ui.form.on("Tender Item", { task: ... })` handler that auto-fetches `Task.subject` into `task_subject` on task selection.
- **Business Rules**: Embedded in `Tender.boq_details` (BOQ/SOR tab). Represents a BOQ line item mapped to up to a 10-level task/stage hierarchy (populated via the `get_boq_details` whitelisted method when a `Bill of Quantities` is selected on the Tender), and later used by `create_project_from_tender` to re-parent the referenced Tasks/subtasks onto the newly created Project.

---

### Tender Type

- **Source**: `tendering/doctype/tender_type/tender_type.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master
- **Naming**: `field:tender_type_name`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| tender_type_name | Tender Type Name | Data | No | `unique: 1` |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: System Manager — full CRUD/share/export/print/report/email
- **Validation / Server Logic**: `TenderType(Document)` — no overridden methods.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Referenced by Opportunity custom field `custom_tender_type` (see Custom Overrides section); classifies the tendering mechanism (e.g. Open, Limited, Single-source).

---

## Workflow: Tender / Opportunity Lifecycle

Two Frappe Workflow fixtures are defined in `fixtures/workflow.json`, backed by shared state/action master fixtures in `fixtures/workflow_state.json` and `fixtures/workflow_action_master.json`. Both workflows use `workflow_state_field: "workflow_state"` and every state has `doc_status: "0"` — i.e. neither Opportunity nor Tender is driven by Frappe's Submit/docstatus mechanism; the lifecycle is entirely `workflow_state`-driven.

### Workflow "Tender Creation" (`document_type: Opportunity`, `is_active: 1`)

States (state → `allow_edit` role):

| State | Allow Edit Role |
|---|---|
| New | All |
| Approved By Analyzer | Analyzer |
| Approved By Technical Evaluator | Technical Evaluator |
| Approved By Financial Evaluator | Financial Evaluator |
| Approved By Sales | Sales Evaluator |
| Approved By Top Management | Top Management |
| Go For Bid | Business Developer |
| Don't Go For Bid | Business Developer |

Transitions (state → action → next_state, allowed role, `allow_self_approval: 1` on all):

| From State | Action | To State | Allowed Role |
|---|---|---|---|
| New | Pending Approval From Analyzer | Approved By Analyzer | Analyzer |
| Approved By Analyzer | Pending Approval From Technical Evaluator | Approved By Technical Evaluator | Technical Evaluator |
| Approved By Technical Evaluator | Pending approval from Financial Evaluator | Approved By Financial Evaluator | Financial Evaluator |
| Approved By Financial Evaluator | Pending Approval From Sales Evaluator | Approved By Sales | Sales Evaluator |
| Approved By Sales | Pending Approval From Top Management | Approved By Top Management | Top Management |
| Approved By Top Management | Pending Approval From Business Developer | Go For Bid | Business Developer |
| Approved By Top Management | Reject | Don't Go For Bid | Business Developer |

Note: the terminal "Go For Bid" state name corresponds to a workflow action label "Pending Approval From Business Developer" in the transition, but the standalone Workflow Action Master fixture separately registers a "Go For Bid" action name (used elsewhere, e.g. by `custom_crm/opportunity.py`'s exception handler which resets `workflow_state` back to `"Go For Bid"` on Tender-creation failure).

When an Opportunity reaches `workflow_state == "Tender created"` (a state string not present in the `Workflow State` fixture list captured above — likely set by a downstream UI action/report not covered by this dossier's file scope, or a legacy/typo state), `custom_crm/opportunity.py`'s `on_update` hook fires and creates a Tender (see Custom Overrides below); on success it does not itself change `workflow_state` further from that hook, but `create_tender_from_opportunity` (the whitelisted alternative entry point) explicitly sets `Opportunity.workflow_state = "Tender Created"` after creating the Tender.

### Workflow "Tender Submission" (`document_type: Tender`, `is_active: 1`)

States (state → `allow_edit` role):

| State | Allow Edit Role |
|---|---|
| In Progress | All |
| Preliminary Approved | Preliminary Approver |
| Commercially Approved | Commercial Approver |
| Top Management Approved | Top Management |
| Tender Submitted | Top Management |
| Won | Business Head |
| Lost | Business Head |
| Alloted | Business Head |

Transitions (state → action → next_state, allowed role, `allow_self_approval: 1` on all):

| From State | Action | To State | Allowed Role |
|---|---|---|---|
| In Progress | Pending For Preliminary Approval | Preliminary Approved | Preliminary Approver |
| Preliminary Approved | Pending For Commercial Approval | Commercially Approved | Commercial Approver |
| Commercially Approved | Pending For Top Management Approval | Top Management Approved | Top Management |
| Top Management Approved | Submit Tender | Tender Submitted | Top Management |
| Tender Submitted | Mark Won | Won | Business Head |
| Tender Submitted | Mark Lost | Lost | Business Head |
| Won | Allotment Received | Alloted | Business Head |

Once a Tender reaches `workflow_state == "Alloted"`:
- `tender.py`'s `check_show_create_customer_button()` (called from `validate`/`on_update`) sets `show_create_customer_button = True` if the Tender originated from a Lead without a linked Customer yet, surfacing the "Create Customer" button in `tender.js`.
- `tender.js`'s `refresh` handler also shows a "Create Project" button, which opens a dialog and calls the whitelisted `create_project_from_tender`. That function sets `Tender.workflow_state = "Project Created"` directly via `frappe.db.set_value` — a state not present in the `Workflow State`/`Tender Submission` transition fixtures captured above, meaning "Project Created" is a workflow-adjacent status applied outside the formal Frappe Workflow transition graph (a direct DB write, bypassing `apply_workflow`/permission checks on the transition).

Both workflows' `Workflow Action Master` fixture entries (`Go For Bid`, `Don't Go For Bid`, `Mark Lost`, `Mark Won`, `Allotment Received`, `Pending Approval From Analyzer`, `Pending Approval From Technical Evaluator`, `Pending approval from Financial Evaluator`, `Pending Approval From Sales Evaluator`, `Pending Approval From Top Management`, `Pending For Commercial Approval`, `Pending For Top Management Approval`, `Submit Tender`, `Pending For Preliminary Approval`) are all declared once in `fixtures/workflow_action_master.json` and are shared/referenced by name across the two workflow transition tables above.

---

## Custom Overrides (custom_crm, custom_project)

### `tendering/custom_crm/opportunity.py` — hooked via `hooks.py` `doc_events["Opportunity"]["on_update"]`

- **`on_update(doc, method)`**: Runs on every Opportunity save. No-ops unless `doc.workflow_state == "Tender created"`. When that state is hit, it builds and inserts a new `Tender` document (via `frappe.get_doc({...}).insert(ignore_permissions=True)`), copying over: `opportunity`(=doc.name), `customer`, `company`, dates, owner, `opportunity_from`/`party_name`, sales stage/probability, organization fields (employees, revenue, country, currency, amount, industry, market segment, city/state/territory), contact fields, and a large set of `custom_*` Opportunity fields (tender/RFP number, tender reference, tender submission date, project duration, JV/consortium, tender fee/exemption, tender category/type, EMD/exemption, next activity deadline/summary, scope of work, bid evaluation criteria technical/commercial), plus `total`, `reference_doc = "Opportunity"`, `reference_doc_link = doc.name`, and copies each Opportunity `items` row (item_code, item_name, qty, uom, rate, amount, base_rate, base_amount, description) into the new Tender's `items`.
  - On success: sets `doc.custom_tender_created = tender.name` (via `db_set`) and shows a green success `msgprint` linking to the new Tender.
  - On failure: rolls back the DB transaction, force-sets `doc.workflow_state = "Go For Bid"` (reverting the Opportunity out of the failed "Tender created" state), logs the traceback via `frappe.log_error`, and re-throws a user-facing error telling them the workflow was reverted.
- **`create_tender_from_opportunity(opportunity_name, tender_name)`** (`@frappe.whitelist()`): An explicit, user-named alternative to the automatic `on_update` path — lets a user supply a custom `tender_name`/`title` rather than relying on the Tender's own naming series. Throws if `tender_name` is blank or a Tender with that `tender_name` already exists. Builds the same field mapping as `on_update` (largely duplicated logic) but additionally sets `tender.tender_name`/`title = tender_name`. After insert, it directly sets `Opportunity.custom_tender_created_ = tender.name` and `Opportunity.workflow_state = "Tender Created"` via `frappe.db.set_value` + explicit `frappe.db.commit()`, then shows a success message and returns `{tender, message}`.
- Both code paths rely on the large block of Opportunity `custom_*` fields defined in `tendering/custom/opportunity.json` (Custom Field fixtures on the ERPNext `Opportunity` doctype) — these fields are the actual data-carrying layer that lets the Tendering module extend the stock CRM Opportunity without modifying ERPNext core. Notable ones: `custom_tender_details`/`custom_tenderrfp_number`/`custom_tender_notification_date`/`custom_tender_reference`/`custom_tender_submission_date`/`custom_project_duration`/`custom_jvconsortium`/`custom_tender_fee_exempted`/`custom_tender_fee`/`custom_tender_category`(Link→Tender Category)/`custom_tender_type`(Link→Tender Type)/`custom_emd_exempted`/`custom_earnest_money_deposit`/`custom_next_activity_deadline`/`custom_next_activity_summary`/`custom_tender_created_`(Link→Tender)/`custom_bid`(Tab Break)/`custom_scope_of_work_`/`custom_bid_evaluation_criteriacommercial`/`custom_bid_evaluation_criteriatechnical`/`custom_technical_qualification`(Tab)/`custom_technical_qualification_details`(Table→Technical Qualification Details, permlevel 1)/`custom_financial_qualification`(Tab)/`custom_financial_qualification_detail`(Table→Financial Qualification Details, permlevel 2)/`custom_sales_recommendation`(Tab)/`custom_sales_team_recommendations`(Table→Sales Recommendation Details, permlevel 3). A doctype-level `links` entry also wires an Opportunity → Tender connection via `link_fieldname: reference_doc_link`. Property setters override the Opportunity's main `field_order` to slot all these custom fields into a "Tender Details" tab sequence following the stock "Connections" (`dashboard_tab`) tab.

### `tendering/custom_project/project.py` — NOT wired via `hooks.py` `doc_events` (no Project entry found in the `doc_events` dict); exposes a standalone whitelisted API instead

- **`get_columns(project)`** (`@frappe.whitelist()`): Given a Project name, queries all `Task` records with `project = project` and `custom_is_level_task = 1`, ordered by `subject`. Deduplicates by `subject` and returns a list of `{"subject": ..., "level_task": 1}` dicts. Purpose: supplies the distinct set of top-level "stage" task subjects for a Project — likely used to render Kanban-style columns (e.g. a construction-task board) keyed by level-1 task names, tying back to the `task_level1..10` hierarchy modeled in `Tender Item`/BOQ.
- Note: `tender.py`'s `create_project_from_tender` sets `custom_reference_doc_name` (back-link to the originating Tender) and `custom_bill_of_quantities` on the created `Project`, and sets `custom_boq_name` on each re-parented `Task` — these are Project/Task custom fields consumed by, but not defined within, the files read for this dossier (no `project.json`/`task.json` custom-field fixture was in scope of `tendering/custom_project/`; only the `.py` whitelisted method was present there).

### `tendering/custom/` field/property-setter fixtures for other doctypes

- **`customer.json`**: No custom fields; adds a doctype `links` entry to `Party Specific Item.party`, and 3 property setters (`show_title_field_in_link=1`; `naming_series` hidden/not required) — cosmetic/UX only, not Tendering-specific business logic.
- **`employee.json`**: No custom fields; 1 property setter (`show_title_field_in_link=1`) — cosmetic only.
- **`lead.json`**: No custom fields; 3 property setters (`show_title_field_in_link=1`; `title_field=lead_name`; unhide `utm_analytics_section`) — cosmetic only.
- **`opportunity.json`**: The substantive customization file, detailed above.

---

## Module: Quality and Safety Management

### Incident CA

**Source**: `quality_and_safety_management/doctype/incident_ca/incident_ca.json` (+ `.py`, `.js`)

**Description**: Not found in repository (no `description` key in JSON)

**Type**: Child Table (istable: 1)

**Naming**: `autoincrement`

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| section_identity | Details | Section Break | No | |
| action | Corrective Action | Data | Yes | in_list_view |
| responsible | Responsible | Link → Employee | No | in_list_view |
| col_break_ident1 | | Column Break | No | |
| target_date | Target Date | Date | No | in_list_view |

**Child Tables**: N/A (this is itself a child table)

**Link Fields**: `responsible` → Employee

**Permissions**: None defined (`"permissions": []`) — inherits access from parent document (Incident Report)

**Validation / Server Logic**: `IncidentCA(Document)` — controller body is `pass`; no validate/submit logic. `track_changes: 1`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (JS file contains only a commented-out `refresh` stub)

**Business Rules**: Represents a single corrective-action row (action, responsible person, target date) embedded inside Incident Report's `corrective_actions` table.

---

### Incident Report

**Source**: `quality_and_safety_management/doctype/incident_report/incident_report.json` (+ `.py`, `.js`)

**Description**: Not found in repository

**Type**: Submittable Document (`is_submittable: 1`)

**Naming**: `naming_series:` — series `INC-.YYYY.-`

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| status | Status | Select | Yes | Options: Reported / Under Investigation / Closed / Notified; in_list_view |
| section_identity | | Section Break | No | |
| project | Project | Link → Project | Yes | |
| employee_type | Employee Type | Select | No | Direct / Subcontractor / Visitor / Other |
| incident_type | Incident Type | Select | Yes | First Aid Case / Medical Treatment Case Restricted Work Case / Lost Time Injury / Fatality Property Damage Environmental Near Miss (note: options string appears malformed/concatenated) |
| incident_no | Incident No | Data | No | unique; in_list_view |
| location | Location | Data | Yes | |
| col_break_ident1 | | Column Break | No | |
| injured_person | Injured Person | Data | No | |
| severity | Severity | Select | Yes | Low / Medium / High / Critical / Fatality |
| lost_time_days | Lost Time Days | Int | No | |
| immediate_cause | Immediate Cause | Text | Yes | |
| root_cause | Root Cause | Text | No | |
| col_break_ident2 | | Column Break | No | |
| contributing_factors | Contributing Factors | Text | No | |
| regulatory_notification | Regulatory Notification | Check | No | default 0 |
| linked_observation | Linked Observation | Link → Safety Observation | No | |
| date | Date | Date | Yes | in_list_view |
| time | Time | Time | Yes | |
| notification_date | Notification Date | Date | No | in_list_view |
| section_corrective_actions | | Section Break | No | |
| corrective_actions | Corrective Actions | Table → Incident CA | No | |
| photos | Photos | Attach | No | |
| medical_report | Medical Report | Attach | No | |
| section_notes | | Section Break | No | |
| description | Incident Description | Long Text | Yes | |
| amended_from | Amended From | Link → Incident Report | No | read_only, no_copy (standard amendment field) |
| naming_series | Series | Select | No | `INC-.YYYY.-` |
| column_break_efua | | Column Break | No | |

**Child Tables**: `corrective_actions` → Incident CA

**Link Fields**: `project` → Project; `linked_observation` → Safety Observation; `amended_from` → Incident Report

**Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes (amend, cancel also enabled) |
| All | Yes | No | No | No | No |

**Validation / Server Logic**: `IncidentReport(Document)` — controller body is `pass`; no validate/on_submit/on_cancel logic implemented. `track_changes: 1`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (only commented-out `refresh` stub)

**Business Rules**: Captures HSE incident records (injury type, severity, lost-time days, root cause) with an embedded corrective-action table and an optional link back to the Safety Observation that flagged the hazard (`linked_observation`). No code enforces status transitions or notification logic despite the Status options (Reported/Under Investigation/Closed/Notified) and `regulatory_notification`/`notification_date` fields — these appear to be manually managed by users, not automated.

---

### Inspection Lot

**Source**: `quality_and_safety_management/doctype/inspection_lot/inspection_lot.json` (+ `.py`, `.js`)

**Description**: Not found in repository

**Type**: Submittable Document (`is_submittable: 1`)

**Naming**: `naming_series:` — series `LOT-.YYYY.-`

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| section_identity | | Section Break | No | |
| project | Project | Link → Project | Yes | in_list_view |
| lot_no | Lot No | Data | No | unique; in_list_view |
| col_break_ident1 | | Column Break | No | |
| itp | ITP | Link → Inspection Test Plan | Yes | in_list_view |
| work_location | Work Location | Data | Yes | |
| col_break_ident2 | | Column Break | No | |
| inspector | Inspector | Link → User | Yes | |
| client_inspector | Client Inspector | Data | No | |
| overall_result | Overall Result | Select | No | Pass / Pass with Observations / Fail / Hold |
| inspection_date | Inspection Date | Date | Yes | in_list_view |
| section_results | | Section Break | No | |
| results | Results | Table → Inspection Result | No | |
| photos | Photos | Attach | No | |
| section_notes | | Section Break | No | |
| observations | Observations | Text | No | |
| amended_from | Amended From | Link → Inspection Lot | No | read_only, no_copy |
| ncr | NCR | Link → NCR | No | |
| naming_series | Series | Select | No | `LOT-.YYYY.-` |
| column_break_meyx | | Column Break | No | |

**Child Tables**: `results` → Inspection Result

**Link Fields**: `project` → Project; `itp` → Inspection Test Plan; `inspector` → User; `ncr` → NCR; `amended_from` → Inspection Lot

**Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes (amend, cancel also enabled) |
| All | Yes | No | No | No | No |

**Validation / Server Logic**: `InspectionLot(Document)` — controller body is `pass`; no validate/on_submit logic. `track_changes: 1`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (commented-out `refresh` stub only)

**Business Rules**: This is the central ITP execution record — an Inspection Lot is performed against a specific Inspection Test Plan (`itp` link) for a Project, with individual checklist outcomes recorded in the child table `results` (Inspection Result). If the lot fails, it can be linked forward to a raised `ncr` (NCR). No server-side logic auto-creates the NCR or auto-computes `overall_result` from child results — this appears to be manual/UI-driven only.

---

### Inspection Result

**Source**: `quality_and_safety_management/doctype/inspection_result/inspection_result.json` (+ `.py`, `.js`)

**Description**: Not found in repository

**Type**: Child Table (istable: 1)

**Naming**: `autoincrement`

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| section_identity | Details | Section Break | No | |
| inspection | Inspection | Data | Yes | in_list_view (plain Data field, not a Link — likely holds an ITP Item description/reference, not a doctype link) |
| col_break_ident1 | | Column Break | No | |
| result | Result | Select | No | Pass / Fail / Hold / Observation; in_list_view |
| section_notes | Notes & Justification | Section Break | No | |
| remarks | Remarks | Data | No | in_list_view |

**Child Tables**: N/A (itself a child table)

**Link Fields**: None (no Link/Dynamic Link fields)

**Permissions**: None defined (`"permissions": []`)

**Validation / Server Logic**: `InspectionResult(Document)` — controller body is `pass`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (commented-out stub only)

**Business Rules**: Row-level pass/fail/hold/observation outcome for each inspection checkpoint within an Inspection Lot's `results` table.

---

### Inspection Test Plan

**Source**: `quality_and_safety_management/doctype/inspection_test_plan/inspection_test_plan.json` (+ `.py`, `.js`)

**Description**: Not found in repository

**Type**: Standard Document (NOT submittable — no `is_submittable` key, no `amended_from` field)

**Naming**: `naming_series:` — series `ITP-`

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| status | Status | Select | Yes | Template / Project-Specific / Approved / Obsolete; in_list_view |
| section_identity | | Section Break | No | |
| project | Project | Link → Project | No | in_list_view (optional — allows reusable templates not tied to a project) |
| col_break_ident1 | | Column Break | No | |
| itp_no | Itp No | Data | Yes | unique; in_list_view |
| col_break_ident2 | | Column Break | No | |
| title | Title | Data | Yes | |
| activity | Activity | Data | No | |
| reference_spec | Reference Spec | Text | No | |
| section_inspection_items | | Section Break | No | |
| inspection_items | Inspection Items | Table → ITP Item | No | |
| naming_series | Series | Select | No | `ITP-` |

**Child Tables**: `inspection_items` → ITP Item

**Link Fields**: `project` → Project

**Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | No (not submittable) |
| All | Yes | No | No | No | No |

**Validation / Server Logic**: `InspectionTestPlan(Document)` — controller body is `pass`. `track_changes: 1`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (commented-out stub only)

**Business Rules**: Defines a reusable template (`status = Template`) or project-specific checklist (`status = Project-Specific`) of inspection/test items (`inspection_items` → ITP Item). Consumed by both Quality Plan (via Quality Plan ITP child rows) and directly by Inspection Lot (`itp` link) when an inspection is executed.

---

### ITP Item

**Source**: `quality_and_safety_management/doctype/itp_item/itp_item.json` (+ `.py`, `.js`)

**Description**: Not found in repository

**Type**: Child Table (istable: 1)

**Naming**: `autoincrement`

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| section_identity | | Section Break | No | |
| inspection | Inspection | Data | Yes | in_list_view |
| test | Test | Data | No | in_list_view |
| col_break_ident1 | | Column Break | No | |
| frequency | Frequency | Data | No | in_list_view |
| acceptance_criteria | Acceptance Criteria | Data | No | in_list_view |

**Child Tables**: N/A (itself a child table)

**Link Fields**: None

**Permissions**: None defined (`"permissions": []`)

**Validation / Server Logic**: `ITPItem(Document)` — controller body is `pass`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (commented-out stub only)

**Business Rules**: Defines a single checklist line item (inspection point, test, frequency, acceptance criteria) inside an Inspection Test Plan's `inspection_items` table.

---

### JBT Attendee

**Source**: `quality_and_safety_management/doctype/jbt_attendee/jbt_attendee.json` (+ `.py`, `.js`)

**Description**: Not found in repository

**Type**: Child Table (istable: 1)

**Naming**: `autoincrement`

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| section_identity | | Section Break | No | |
| employee | Employee | Link → Employee | No | in_list_view |
| col_break_ident1 | | Column Break | No | |
| signature | Signature | Data | No | in_list_view |

**Child Tables**: N/A (itself a child table)

**Link Fields**: `employee` → Employee

**Permissions**: None defined (`"permissions": []`)

**Validation / Server Logic**: `JBTAttendee(Document)` — controller body is `pass`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (commented-out stub only)

**Business Rules**: "JBT" = Job/Job-site Toolbox (Talk) Attendee — records each employee's attendance (and signature) at a Toolbox Talk, embedded in Toolbox Talk's `attendees` table. Doctype name abbreviation suggests "Job Box Talk" or similar; not explicitly documented in the repo.

---

### MS Activity

**Source**: `quality_and_safety_management/doctype/ms_activity/ms_activity.json` (+ `.py`; no `.js` file present)

**Description**: Not found in repository

**Type**: Child Table (istable: 1)

**Naming**: No `autoname` key present in JSON — Not found in repository (likely relies on default row naming for child tables)

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| activity | Activity | Data | Yes | in_list_view |

**Child Tables**: N/A (itself a child table)

**Link Fields**: None

**Permissions**: None defined (`"permissions": []`)

**Validation / Server Logic**: `MSActivity(Document)` — controller body is `pass`. No `track_changes` key.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (no `.js` file exists for this doctype)

**Business Rules**: Minimal single-field child table storing an "Activity" label ("MS" likely = Method Statement). No other doctype's JSON in this module references "MS Activity" as a Table field target (not wired into ITP/Quality Plan/Inspection Lot field_order lists found) — its parent usage was not located within this module's doctypes.

---

### NCR

**Source**: `quality_and_safety_management/doctype/ncr/ncr.json` (+ `.py`, `.js`)

**Description**: Not found in repository

**Type**: Submittable Document (`is_submittable: 1`)

**Naming**: `naming_series:` — series `NCR-.YYYY.-`

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| status | Status | Select | Yes | Open / Under Review / Corrective Action / Closed / Voided; in_list_view |
| section_identity | | Section Break | No | |
| project | Project | Link → Project | Yes | in_list_view |
| ncr_type | Ncr Type | Select | Yes | default "Workmanship"; options: (blank) / Material / Non-Conformance / Workmanship / Design / Deviation / Process / Deviation Safety / Non-Conformance (note: "Non-Conformance" appears twice in the options string) |
| ncr_no | Ncr No | Data | No | unique |
| raised_by | Raised By | Link → User | Yes | |
| col_break_ident1 | | Column Break | No | |
| location | Location | Data | Yes | |
| boq_item | Related BOQ Item | Data | No | plain Data, not a Link |
| inspection_lot | Related Inspection | Link → Inspection Lot | No | |
| severity | Severity | Select | Yes | Minor / Major / Critical |
| col_break_ident2 | | Column Break | No | |
| root_cause | Root Cause | Text | No | |
| corrective_action | Corrective Action | Text | No | |
| raised_date | Raised Date | Date | Yes | default "Today"; in_list_view |
| target_close_date | Target Close Date | Date | Yes | in_list_view |
| actual_close_date | Actual Close Date | Date | No | |
| photos | Photos | Attach | No | |
| verification | Verification | Attach | No | |
| closed_by | Closed By | Link → User | No | |
| section_notes | Notes & Justification | Section Break | No | |
| description | Description | Text | Yes | |
| amended_from | Amended From | Link → NCR | No | read_only, no_copy |
| naming_series | Series | Select | No | `NCR-.YYYY.-` |
| column_break_yewi | | Column Break | No | |

**Child Tables**: None

**Link Fields**: `project` → Project; `raised_by` → User; `inspection_lot` → Inspection Lot; `closed_by` → User; `amended_from` → NCR

**Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes (amend, cancel also enabled) |
| All | Yes | No | No | No | No |

**Validation / Server Logic**: `NCR(Document)` — controller body is `pass`; no validate/on_submit/status-transition logic implemented despite the multi-stage status workflow (Open → Under Review → Corrective Action → Closed/Voided). `track_changes: 1`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (commented-out stub only)

**Business Rules**: Non-Conformance Report — the corrective/quality-deviation record. Can originate from a failed Inspection Lot (`inspection_lot` link back to Inspection Lot; and Inspection Lot itself has an `ncr` link forward), forming a two-way reference between the two doctypes (though nothing in code enforces this pairing automatically — both links are simple optional Link fields set manually). Tracks root cause, corrective action, target/actual close dates, and closure sign-off (`closed_by`). No automation ties `status` changes to `actual_close_date` or to Incident CA-style corrective action tracking.

---

### Quality Plan

**Source**: `quality_and_safety_management/doctype/quality_plan/quality_plan.json` (+ `.py`, `.js`)

**Description**: Not found in repository

**Type**: Submittable Document (`is_submittable: 1`)

**Naming**: `naming_series:` — series `QP-.YYYY.-`

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| status | Status | Select | Yes | Draft / Submitted / Approved / Obsolete; in_list_view |
| section_identity | | Section Break | No | |
| project | Project | Link → Project | Yes | in_list_view |
| plan_no | Plan No. | Data | No | unique; in_list_view |
| col_break_ident1 | | Column Break | No | |
| revision | Revision | Int | No | |
| prepared_by | Prepared By | Link → User | No | in_list_view |
| col_break_ident2 | | Column Break | No | |
| scope | Scope | Text | No | |
| applicable_standards | Standards | Text | No | |
| section_itp_items | | Section Break | No | |
| itp_items | Itp Items | Table → Quality Plan ITP | No | |
| approved_by | Approved By | Link → User | No | |
| section_attachments | | Section Break | No | |
| document | Document | Attach | No | |
| amended_from | Amended From | Link → Quality Plan | No | read_only, no_copy |
| naming_series | Series | Select | No | `QP-.YYYY.-` |

**Child Tables**: `itp_items` → Quality Plan ITP

**Link Fields**: `project` → Project; `prepared_by` → User; `approved_by` → User; `amended_from` → Quality Plan

**Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes (amend, cancel also enabled) |
| All | Yes | No | No | No | No |

**Validation / Server Logic**: `QualityPlan(Document)` — controller body is `pass`; no validate/approval logic. `track_changes: 1`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (commented-out stub only)

**Business Rules**: Project-level quality plan document that bundles a set of Inspection Test Plans (via `itp_items` → Quality Plan ITP → links to Inspection Test Plan) with prepared-by/approved-by sign-off fields and a revision number. Status (Draft/Submitted/Approved/Obsolete) is not enforced by any validate/workflow code — purely a manual Select field.

---

### Quality Plan ITP

**Source**: `quality_and_safety_management/doctype/quality_plan_itp/quality_plan_itp.json` (+ `.py`; no `.js` file present)

**Description**: Not found in repository (but field `itp` has a field-level description: "Select the Inspection Test Plan (ITP) included in this Quality Plan.")

**Type**: Child Table (istable: 1)

**Naming**: No `autoname` key present — Not found in repository

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| itp | ITP | Link → Inspection Test Plan | Yes | in_list_view; description: "Select the Inspection Test Plan (ITP) included in this Quality Plan." |
| remarks | Remarks | Data | No | |
| column_break_tbkk | | Column Break | No | |

**Child Tables**: N/A (itself a child table)

**Link Fields**: `itp` → Inspection Test Plan

**Permissions**: None defined (`"permissions": []`)

**Validation / Server Logic**: `QualityPlanITP(Document)` — controller body is `pass`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (no `.js` file exists)

**Business Rules**: Junction row linking a Quality Plan to one Inspection Test Plan, with optional remarks — implements the many-to-many association between Quality Plan and Inspection Test Plan.

---

### Risk Item

**Source**: `quality_and_safety_management/doctype/risk_item/risk_item.json` (+ `.py`, `.js`)

**Description**: Not found in repository

**Type**: Child Table (istable: 1)

**Naming**: `autoincrement`

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| section_identity | Details | Section Break | No | |
| risk | Risk | Data | Yes | in_list_view |
| likelihood | Likelihood | Select | No | Low / Medium / High; in_list_view |
| col_break_ident1 | | Column Break | No | |
| impact | Impact | Select | No | Low / Medium / High; in_list_view |
| mitigation | Mitigation | Data | No | in_list_view |

**Child Tables**: N/A (itself a child table)

**Link Fields**: None

**Permissions**: None defined (`"permissions": []`)

**Validation / Server Logic**: `RiskItem(Document)` — controller body is `pass`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (commented-out stub only)

**Business Rules**: A single risk entry (description, likelihood, impact, mitigation) embedded in Risk Register's `risks` table. No numeric risk-score field or auto-calculation (e.g., likelihood × impact) is present in code — likelihood/impact are independent Select fields with no computed severity.

---

### Risk Register

**Source**: `quality_and_safety_management/doctype/risk_register/risk_register.json` (+ `.py`, `.js`)

**Description**: Not found in repository

**Type**: Standard Document (NOT submittable — no `is_submittable` key, no `amended_from` field, no submit/amend/cancel permissions)

**Naming**: `naming_series:` — series `RISK-.YYYY.-`

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| status | Status | Select | Yes | Active / Obsolete; in_list_view |
| section_identity | | Section Break | No | |
| project | Project | Link → Project | Yes | |
| col_break_ident1 | | Column Break | No | |
| register_no | Register No | Data | No | unique; in_list_view |
| col_break_ident2 | | Column Break | No | |
| reviewed_by | Reviewed By | Link → User | No | |
| created_date | Created Date | Date | Yes | in_list_view |
| review_date | Review Date | Date | No | in_list_view |
| section_risks | | Section Break | No | |
| risks | Risks | Table → Risk Item | No | |
| naming_series | Series | Select | No | `RISK-.YYYY.-` |

**Child Tables**: `risks` → Risk Item

**Link Fields**: `project` → Project; `reviewed_by` → User

**Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | No (not submittable) |
| All | Yes | No | No | No | No |

**Validation / Server Logic**: `RiskRegister(Document)` — controller body is `pass`. `track_changes: 1`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (commented-out stub only)

**Business Rules**: Project-level container of risk entries (via `risks` → Risk Item), with a review cadence tracked via `reviewed_by`/`review_date` and a simple Active/Obsolete lifecycle Select — unlike other project QA documents in this module, it is not submittable (no draft/submitted/cancelled state machine).

---

### Safety Observation

**Source**: `quality_and_safety_management/doctype/safety_observation/safety_observation.json` (+ `.py`, `.js`)

**Description**: Not found in repository

**Type**: Submittable Document (`is_submittable: 1`)

**Naming**: `naming_series:` — series `OBS-.YYYY.-`

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| status | Status | Select | Yes | Open / In Progress / Closed / Escalated; in_list_view |
| section_identity | Details | Section Break | No | |
| project | Project | Link → Project | Yes | |
| observation_type | Observation Type | Select | Yes | Unsafe Act / Unsafe Condition / Near Miss Positive Observation Environmental (options string appears concatenated/malformed) |
| obs_no | Obs No | Data | No | unique |
| observed_by | Observed By | Link → Employee | Yes | |
| col_break_ident1 | | Column Break | No | |
| location | Location | Data | Yes | |
| severity | Severity | Select | Yes | Low / Medium / High / Critical |
| immediate_action | Immediate Action | Text | No | |
| assigned_to | Assigned To | Link → Employee | No | |
| col_break_ident2 | | Column Break | No | |
| corrective_action | Corrective Action | Text | No | |
| date | Date | Date | Yes | default "Today"; in_list_view |
| time | Time | Time | No | |
| due_date | Due Date | Date | No | in_list_view |
| close_date | Close Date | Date | No | in_list_view |
| photos | Photos | Attach | No | |
| section_notes | | Section Break | No | |
| description | Description | Text | Yes | |
| amended_from | Amended From | Link → Safety Observation | No | read_only, no_copy |
| linked_incidents | Linked Incidents | Link → Incident Report | No | (singular link despite plural label) |
| naming_series | Series | Select | No | `OBS-.YYYY.-` |
| column_break_lxjs | | Column Break | No | |

**Child Tables**: None

**Link Fields**: `project` → Project; `observed_by` → Employee; `assigned_to` → Employee; `amended_from` → Safety Observation; `linked_incidents` → Incident Report

**Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes (amend, cancel also enabled) |
| All | Yes | No | No | No | No |

**Validation / Server Logic**: `SafetyObservation(Document)` — controller body is `pass`. `track_changes: 1`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (commented-out stub only)

**Business Rules**: Field-level safety observation (unsafe act/condition/near-miss) with immediate action, assigned corrective action, and due/close dates. Cross-links to Incident Report via `linked_incidents` (forward reference), complementing Incident Report's own `linked_observation` field (back-reference) — together the two doctypes form a bidirectional but manually-maintained relationship (no code auto-syncs both sides).

---

### Toolbox Talk

**Source**: `quality_and_safety_management/doctype/toolbox_talk/toolbox_talk.json` (+ `.py`, `.js`)

**Description**: Not found in repository

**Type**: Submittable Document (`is_submittable: 1`)

**Naming**: `naming_series:` — series `TBT-.YYYY.MM.DD.-`

**Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| section_identity | | Section Break | No | |
| project | Project | Link → Project | Yes | in_list_view |
| topic_category | Topic Category | Select | Yes | default "Other"; Working at Heights / Electrical Safety / Fire Safety / Excavation Safety / Hand Tools / PPE Chemical / Handling Housekeeping / Other |
| col_break_ident1 | | Column Break | No | |
| talk_no | Talk No | Data | No | unique; in_list_view |
| conducted_by | Conducted By | Link → Employee | Yes | in_list_view |
| col_break_ident2 | | Column Break | No | |
| topic | Topic | Data | Yes | |
| duration_mins | Duration Mins | Int | No | default 15 |
| language | Language | Select | No | English / Hindi / Arabic / Bengali / Tamil |
| date | Date | Date | Yes | default "Today"; in_list_view |
| total_attendees | Total Attendees | Int | No | default 0 |
| section_attendees | | Section Break | No | |
| attendees | Attendees | Table → JBT Attendee | No | |
| photos | Photos | Attach | No | |
| section_notes | | Section Break | No | |
| content | Talk Content | Long Text | No | |
| amended_from | Amended From | Link → Toolbox Talk | No | read_only, no_copy |
| naming_series | Series | Select | No | `TBT-.YYYY.MM.DD.-` |

**Child Tables**: `attendees` → JBT Attendee

**Link Fields**: `project` → Project; `conducted_by` → Employee; `amended_from` → Toolbox Talk

**Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes (amend, cancel also enabled) |
| All | Yes | No | No | No | No |

**Validation / Server Logic**: `ToolboxTalk(Document)` — controller body is `pass`; no validation that `total_attendees` matches the count of `attendees` rows. `track_changes: 1`.

**Whitelisted APIs**: Not found in repository

**Client Script**: Not found in repository (commented-out stub only)

**Business Rules**: Records a daily/topic-based safety briefing (toolbox talk) with a category, topic, duration, language, and content, plus an embedded attendee list (`attendees` → JBT Attendee, each with employee + signature). `total_attendees` is a plain Int field with no server-side reconciliation against the actual attendee row count.

---

## Module: Site Diary

### Equipment Usage

- **Source**: `site_diary/doctype/equipment_usage/equipment_usage.json`, `.py`, `.js`, `test_equipment_usage.py`
- **Description**: Not found in repository
- **Type**: Submittable Document (transactional header)
- **Naming**: `naming_series:` — series options `\nEU-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Naming Series | Select | No | options `\nEU-`, collapsible section |
| project | Project | Link (Project) | Yes | in_list_view |
| site_engineer | Site Engineer | Link (Employee) | No | |
| site_date | Site Date | Date | Yes | in_list_view |
| site | Site | Link (Site) | Yes | fetch_from `project.custom_site`, in_list_view |
| shift | Shift | Select | No | options `\nDay\nNight\nBoth` |
| equipment_usage_details | Equipment Usage Details | Table (Equipment Usage Details) | No | child table |
| amended_from | Amended From | Link (Equipment Usage) | No | read_only, no_copy |

- **Child Tables**: `equipment_usage_details` → Equipment Usage Details
- **Link Fields**: project→Project, site_engineer→Employee, site→Site (fetch_from project.custom_site), amended_from→Equipment Usage
- **Permissions**: 

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | 1 | 1 | 1 | 1 | 1 |

- **Validation / Server Logic**:
  - `before_submit()` calls `set_total_equipment_cost()`.
  - `set_total_equipment_cost()`: sums `amount` per `subtask` across `equipment_usage_details` rows, then adds each sum to the Task's existing `custom_total_equipment_cost` field via `frappe.db.set_value` (additive/cumulative, not a straight overwrite).
- **Whitelisted APIs**:
  - `get_contractor_items(doctype, txt, searchfield, start, page_len, filters)` — search-box query (decorated with `@frappe.validate_and_sanitize_search_inputs`) returning Item/item_name pairs from `Site Diary Contractor Item Details` where `custom_item_type = 'Equipment'` for a given `contractor` filter; used as the `equipment_item` link query in the child grid.
  - `has_dependencies(task)` — returns whether a Task has any rows in its `depends_on` child table.
  - `get_depends_on_tasks(doctype, txt, searchfield, start, page_len, filters)` — returns `[task, subject]` pairs from a Task's `depends_on` child table, filtered by `task` argument; used to drive the level1..level10 cascading task pickers.
- **Client Script**:
  - `setup`: sets `task` link-query to Tasks in the same project with `custom_is_stage=1, is_group=1`; sets `equipment_item` query to `get_contractor_items` (requires `contractor` selected first, else msgprint); wires cascading `get_query` for `subtask`/`task_level1..10` via `get_depends_on_tasks`, keyed off a `source_map` (`subtask`←`task`, `task_level1`←`subtask`, etc.).
  - `onload`: defaults `site_date` to today for new docs; auto-fills `site_engineer` from the logged-in user's Employee record.
  - Child table (`Equipment Usage Details`) events: `form_render` calls `refresh_task_levels` to show/hide level columns based on deepest filled task and whether it `has_dependencies`; `task` change clears subtask/levels and re-queries; `quantity`/`working_hrs` change recompute `amount = quantity * rate * working_hrs`; `contractor`/`equipment_item` change trigger `validate_equipment` which fetches the Contractor doc and verifies the equipment item exists in its `site_diary_contractor_item_details`, throwing and clearing the row if not, else pulling the `rate`.
- **Business Rules**: Equipment cost is rolled up cumulatively into `Task.custom_total_equipment_cost` on submit (adds to whatever value already exists, so re-submitting/amending can double-count). Equipment items must belong to the selected Contractor's item list or the row is rejected client-side.

---

### Equipment Usage Details

- **Source**: `site_diary/doctype/equipment_usage_details/equipment_usage_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table, auto row naming)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| task | Stage | Link (Task) | Yes | |
| stage_subject | Stage Subject | Data | No | fetch_from `task.subject`, read_only |
| subtask | Task | Link (Task) | No | in_standard_filter |
| task_subject | Task Subject | Data | No | fetch_from `subtask.subject`, read_only |
| task_level1..task_level10 | Task Level1..10 | Link (Task) | No | cascading sub-levels |
| level1_subject..level10_subject | Task LevelN Subject | Data | No | fetch_from corresponding task_levelN.subject |
| contractor | Contractor | Link (Contractor) | Yes | |
| equipment_item | Equipment Item | Link (Item) | Yes | |
| uom | UOM | Link (UOM) | Yes | fetch_from `equipment_item.stock_uom` |
| quantity | Quantity | Float | No | |
| rate | Rate | Currency | No | |
| amount | Amount | Currency | No | |
| working_hrs | Working Hrs | Float | No | |
| billed | Billed | Check | No | default 0 |
| paid | Paid | Check | No | default 0 |

- **Child Tables**: N/A (this is itself a child table, parented by Equipment Usage)
- **Link Fields**: task/subtask/task_level1-10 → Task; contractor → Contractor; equipment_item → Item; uom → UOM
- **Permissions**: None (child table; inherits parent's permissions)
- **Validation / Server Logic**: Controller (`equipment_usage_details.py`) is an empty stub — `class EquipmentUsageDetails(Document): pass`. No server-side validation.
- **Whitelisted APIs**: None in this file (search/query APIs live in the parent `equipment_usage.py`).
- **Client Script**: None (dedicated `.js` file not present; behavior driven by `equipment_usage.js`'s `Equipment Usage Details` event handlers described above).
- **Business Rules**: Up to 10 hierarchical task levels (stage → task → subtasks) support arbitrarily deep WBS structures; amount = quantity × rate × working_hrs (computed client-side).

---

### Equipment Usage Disel Details

- **Source**: `site_diary/doctype/equipment_usage_disel_details/equipment_usage_disel_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| task | Stage | Link (Task) | Yes | |
| stage_subject | Stage Subject | Data | No | fetch_from `task.subject`, read_only |
| subtask | Task | Link (Task) | No | |
| task_subject | Task Subject | Data | No | fetch_from `subtask.subject`, read_only |
| task_level1..task_level10 | Task Level1..10 | Link (Task) | No | |
| level1_subject..level10_subject | Task LevelN Subject | Data | No | fetch_from |
| contractor | Contractor | Link (Contractor) | Yes | |
| equipment_item | Equipment Item | Link (Item) | Yes | |
| uom | UOM | Link (UOM) | Yes | fetch_from `equipment_item.stock_uom` |
| closing_reading | Closing Reading | Float | No | |
| opening_reading | Opening Reading | Float | No | |
| quantity | Quantity | Float | No | |
| rate | Rate | Currency | No | |
| working_hrs | Working Hrs | Float | No | |
| diesel_filledin_ltr | Diesel filled(in LTR) | Float | No | |
| amount | Amount | Currency | No | |
| billed | Billed | Check | No | default 0 |
| paid | Paid | Check | No | default 0 |

- **Child Tables**: N/A (child table; parented by Site Diary via `equipment_usage_disel_details` field)
- **Link Fields**: task/subtask/task_level1-10 → Task; contractor → Contractor; equipment_item → Item; uom → UOM
- **Permissions**: None (child table)
- **Validation / Server Logic**: Controller is an empty stub — `class EquipmentUsageDiselDetails(Document): pass`.
- **Whitelisted APIs**: None in this file.
- **Client Script**: None dedicated (level-visibility toggling handled generically by `update_level_visibility()` in `site_diary.js`).
- **Business Rules**: Tracks diesel meter readings (opening/closing) and litres filled per equipment usage row for fuel reconciliation/billing; feeds the "Equipment Usage Disel Details" Query Report and is fetched into Site Diary via `get_site_diary_details`.

---

### Manpower Log

- **Source**: `site_diary/doctype/manpower_log/manpower_log.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table; parented by Site Diary via `manpower_log` field)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| tradecategory | Trade/Category | Link (Item) | Yes | |
| subcontractor | Subcontractor | Link (Supplier) | No | |
| gang_no | Gang No. | Data | No | |
| skilled | Skilled Count | Int | No | read_only_depends_on `doc.unskilled` |
| unskilled | Unskilled Count | Int | No | read_only_depends_on `doc.skilled` |
| total | Total | Int | No | read_only |
| work_area | Work Area | Data | No | |
| activity | Activity | Data | No | |
| hours_worked | Hours Worked | Float | No | default 8 |
| overtime_hours | Overtime Hours | Float | No | |
| item_type | Item Type | Link (Item Type) | No | |
| daily_wages | Daily Wages | Currency | Yes | fetch_from `tradecategory.custom_daily_wages` |
| total_wage | Total Wage | Currency | No | |
| parent_task | Stage | Link (Task) | Yes | |
| task | Task | Link (Task) | No | |
| task_subject | Task Subject | Data | No | fetch_from `task.subject`, read_only |
| parent_task_subject | Stage Subject | Data | No | read_only |
| contratcor | Contractor | Link (Contractor) | No | (note: field misspelled "contratcor" in schema) |
| task_level1..task_level10 | Task LevelN | Link (Task) | No | |
| task1_subject..task10_subject | Task LevelN Subject | Data | No | fetch_from task_levelN.subject |
| doc_name | Doc Name | Link (DocType) | No | stores source doctype name |
| reference_row_name | Reference Row Name | Data | No | |
| id | Id | Dynamic Link (options: doc_name) | No | points back to source transaction row |

- **Child Tables**: N/A
- **Link Fields**: tradecategory→Item, subcontractor→Supplier, parent_task/task/task_level1-10→Task, contratcor→Contractor, doc_name→DocType, id→Dynamic Link resolved via doc_name
- **Permissions**: None (child table)
- **Validation / Server Logic**: Controller is an empty stub — `class ManpowerLog(Document): pass`.
- **Whitelisted APIs**: None.
- **Client Script**: None dedicated.
- **Business Rules**: This is a read-mostly aggregation table on Site Diary populated by the `get_site_diary_details` server call (pulling from submitted Manpower Usage Details rows); `id`/`doc_name`/`reference_row_name` trace each row back to its originating Manpower Usage or Equipment Usage document for auditability.

---

### Manpower Usage

- **Source**: `site_diary/doctype/manpower_usage/manpower_usage.json`, `.py`, `.js`, `test_manpower_usage.py`
- **Description**: Not found in repository
- **Type**: Submittable Document (transactional header)
- **Naming**: `naming_series:` — series options `\nMU-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Naming Series | Select | No | options `\nMU-` |
| project | Project | Link (Project) | Yes | |
| site_date | Site Date | Date | Yes | |
| site_engineer | Site Engineer | Link (Employee) | No | |
| site | Site | Link (Site) | Yes | fetch_from `project.custom_site`, in_list_view |
| shift | Shift | Select | No | options `\nDay\nNight\nBoth` |
| manpower_usage | Manpower Usage | Table (Manpower Usage Details) | No | child table |
| amended_from | Amended From | Link (Manpower Usage) | No | read_only, no_copy |

- **Child Tables**: `manpower_usage` → Manpower Usage Details
- **Link Fields**: project→Project, site_engineer→Employee, site→Site, amended_from→Manpower Usage
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | 1 | 1 | 1 | 1 | 1 |

- **Validation / Server Logic**:
  - `before_submit()` calls `set_total_labour_cost()`.
  - `set_total_labour_cost()`: sums `amount` per `subtask` across `manpower_usage` rows, then cumulatively adds to Task's `custom_total_labour_cost` (existing + new, same additive pattern as Equipment Usage).
- **Whitelisted APIs**:
  - `get_contractor_manpower_items(doctype, txt, searchfield, start, page_len, filters)` — search query for manpower items (`custom_item_type='Man'`) belonging to a `contractor` filter, from `Site Diary Contractor Item Details`.
  - `has_dependencies(task)` — same pattern as Equipment Usage: whether a Task has `depends_on` rows.
  - `get_depends_on_tasks(doctype, txt, searchfield, start, page_len, filters)` — returns dependent task `[name, subject]` pairs for cascading level pickers.
- **Client Script**:
  - `setup`: `task` query restricted to project's stage tasks (`custom_is_stage=1, is_group=1`); `equipment_item` (manpower item) query via `get_contractor_manpower_items` requiring contractor first; cascading level queries via `source_map` and `get_depends_on_tasks`.
  - `onload`: defaults `site_date` to today for new docs.
  - Child table `Manpower Usage Details` events: `form_render` → `refresh_task_levels`; `task` change clears subtask/levels; `quantity`/`presenty`/`rate`/`time_in`/`time_out` changes trigger `calculate_amount` (computes hours from time_in/time_out via moment.js handling overnight shifts, `total_presenty = quantity * presenty`, `amount = total_presenty * rate`); `contractor`/`equipment_item` changes trigger `validate_equipment` (same contractor-item validation pattern as Equipment Usage).
- **Business Rules**: Labour cost accumulates cumulatively into `Task.custom_total_labour_cost` on each submission. Manpower items must exist in the selected Contractor's item list.

---

### Manpower Usage Details

- **Source**: `site_diary/doctype/manpower_usage_details/manpower_usage_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table; parented by Manpower Usage via `manpower_usage` field)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| task | Stage | Link (Task) | Yes | |
| stage_subject | Stage Subject | Data | No | fetch_from `task.subject`, read_only |
| subtask | Task | Link (Task) | No | |
| task_subject | Subject | Data | No | fetch_from `subtask.subject`, read_only |
| task_level1..task_level10 | Task LevelN | Link (Task) | No | |
| level1_subject..level10_subject | LevelN Subject | Data | No | fetch_from |
| contractor | Contractor | Link (Contractor) | Yes | |
| equipment_item | Manpower Item | Link (Item) | Yes | (labeled "Manpower Item" despite fieldname) |
| skill_type | Skill Type | Select | No | fetch_from `equipment_item.custom_skill_type`, options `Skilled\nUnskilled` |
| uom | UOM | Link (UOM) | Yes | fetch_from `equipment_item.stock_uom` |
| quantity | Quantity | Float | No | |
| time_in | Time In | Time | No | |
| time_out | Time Out | Time | No | |
| hours | Hours | Float | No | computed from time_in/time_out |
| presenty | Presenty | Float | No | attendance/presence factor |
| total_presenty | Total Presenty | Float | No | = quantity × presenty |
| rate | Rate | Currency | No | |
| amount | Amount | Currency | No | = total_presenty × rate |
| billed | Billed | Check | No | default 0 |
| paid | Paid | Check | No | default 0 |

- **Child Tables**: N/A
- **Link Fields**: task/subtask/task_level1-10 → Task, contractor → Contractor, equipment_item → Item, uom → UOM
- **Permissions**: None (child table)
- **Validation / Server Logic**: Controller is an empty stub — `class ManpowerUsageDetails(Document): pass`.
- **Whitelisted APIs**: None in this file.
- **Client Script**: None dedicated (driven by `manpower_usage.js` events).
- **Business Rules**: "Presenty" (worker attendance count/factor) × quantity drives billed labour amount; skill type auto-classifies wage bracket from the linked Item.

---

### Material Received

- **Source**: `site_diary/doctype/material_received/material_received.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table; parented by Site Diary via `material_received` field)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| item_code | Item Code | Link (Item) | No | |
| quantity | Quantity | Int | No | |
| rate | Rate | Float | No | |
| amount | Amount | Currency | No | |
| warehouse | Warehouse | Link (Warehouse) | No | |
| uom | UOM | Link (UOM) | No | |
| transaction | Transaction Type | Link (DocType) | No | |
| transaction_type | Transaction | Dynamic Link (options: `transaction`) | No | |
| reference_row_name | Reference Row Name | Data | No | |

- **Child Tables**: N/A
- **Link Fields**: item_code→Item, warehouse→Warehouse, uom→UOM, transaction→DocType, transaction_type→Dynamic Link resolved via `transaction`
- **Permissions**: None (child table)
- **Validation / Server Logic**: Controller is an empty stub — `class MaterialReceived(Document): pass`.
- **Whitelisted APIs**: None.
- **Client Script**: None dedicated (populated via `site_diary.js`'s `get_site_diary_details` handler calling `get_material_received`).
- **Business Rules**: Aggregates incoming material from both Purchase Receipts and Material Transfer Stock Entries into project warehouses (see `get_material_received` in site_diary.py); `transaction`/`transaction_type` Dynamic Link records whether the source was a Stock Entry or Purchase Receipt.

---

### Project Visitor

- **Source**: `site_diary/doctype/project_visitor/project_visitor.json`, `.py`, `.js`, `test_project_visitor.py`
- **Description**: Not found in repository
- **Type**: Submittable Document
- **Naming**: `field:visitor_name` (autoname by the `visitor_name` field value)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| project | Project | Link (Project) | Yes | in_list_view |
| site_date | Site Date | Date | No | |
| visitor_name | Visitor Name | Data | No | `unique: 1` (used for naming) |
| purpose | Purpose | Select | No | options: Client Visit / Consultant Inspection / Regulatory Inspection / Auditor / Subcontractor / Other |
| time_in | Time In | Time | Yes | in_list_view |
| time_out | Time Out | Time | Yes | in_list_view |
| accompanied_by | Accompanied By | Link (Employee) | No | |
| company | Company | Data | No | |
| safety_inducted | Safety Inducted | Check | No | default 0 |
| notes | Notes | Small Text | No | |
| shift | Shift | Select | No | options `\nDay\nNight\nBoth` |
| site_engineer | Site Engineer | Link (Employee) | No | |
| amended_from | Amended From | Link (Project Visitor) | No | read_only, no_copy |

- **Child Tables**: None
- **Link Fields**: project→Project, accompanied_by→Employee, site_engineer→Employee, amended_from→Project Visitor
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | 1 | 1 | 1 | 1 | 1 |

- **Validation / Server Logic**: Controller is an empty stub — `class ProjectVisitor(Document): pass`. No custom validate/submit hooks.
- **Whitelisted APIs**: None.
- **Client Script**: `project_visitor.js` contains only a commented-out `refresh` stub — effectively "Not found in repository" (no active logic).
- **Business Rules**: Standalone submittable log of a single site visit by an external/internal visitor; consumed by `get_site_diary_details` (visitors_data query) to populate Site Diary's `visitors` child table.

---

### RA Billing Steel Details

- **Source**: `site_diary/doctype/ra_billing_steel_details/ra_billing_steel_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table; not referenced as a table field on Site Diary itself — likely used elsewhere, e.g. RA Billing doctypes outside this module)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| stage | Stage | Link (Task) | Yes | |
| stage_subject | Stage Subject | Data | No | fetch_from `stage.subject`, read_only |
| task | Task | Link (Task) | No | |
| task_subject | Task Subject | Data | No | fetch_from `task.subject`, read_only |
| task_level1..task_level10 | Task LevelN | Link (Task) | No | |
| level1_subject..level10_subject | LevelN Subject | Data | No | fetch_from |
| location_of_the_bar | Location Of The Bar | Data | No | |
| nos | Nos | Float | No | |
| length / width / depth | Length/Width/Depth | Float | No | |
| ftg_depth | Ftg. Depth | Float | No | footing depth |
| dia_of_bar | Dia Of Bar | Float | No | |
| spacing | Spacing | Float | No | |
| bar_nos | Bar Nos | Float | No | |
| bar_length | Bar Length | Float | No | |
| column_height | Column Height | Float | No | |
| top_beam_depth | Top Beam Depth | Float | No | |
| 8_mm_reinforcement, 10_mm, 12_mm, 16_mm, 20_mm, 25_mm, 28_mm, 32_mm_reinforcement | N mm Reinforcement | Float | No | reinforcement bar-diameter-wise steel quantity breakdown |
| remark | Remark | Data | No | |

- **Child Tables**: N/A
- **Link Fields**: stage/task/task_level1-10 → Task
- **Permissions**: None (child table)
- **Validation / Server Logic**: Controller is an empty stub — `class RABillingSteelDetails(Document): pass`.
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository (no `.js` file present).
- **Business Rules**: A steel/reinforcement bar-bending-schedule style child table capturing per-bar-diameter reinforcement quantities against a task hierarchy, presumably for RA (Running Account) steel billing measurement — not wired into Site Diary's own field_order, so it is consumed by another doctype (outside this module's doctype folder) via its `options`.

---

### Site Diary Settings

- **Source**: `site_diary/doctype/site_diary_settings/site_diary_settings.json`, `.py`, `.js`, `test_site_diary_settings.py`
- **Description**: Not found in repository (field-level description: "If checked able to create only one site diary record per project per day")
- **Type**: Single (Master) — `issingle: 1`
- **Naming**: N/A (single doctype)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| site_diary_section | Site Diary | Section Break | No | |
| one_record_per_day_per_project | One Record Per Day Per Project | Check | No | default 0 |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | 1 | 1 | 1 | 1 | N/A (not submittable) |

- **Validation / Server Logic**: Controller is an empty stub — `class SiteDiarySettings(Document): pass`.
- **Whitelisted APIs**: None.
- **Client Script**: `site_diary_settings.js` contains only a commented-out `refresh` stub — no active logic.
- **Business Rules**: Global toggle consulted by `Site Diary.validate_unique_diary()` / `validate_dpr_date()` — when enabled, only one Site Diary can exist per (project, site_date) pair.

---

### Site Equipment Log

- **Source**: `site_diary/doctype/site_equipment_log/site_equipment_log.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table; parented by Site Diary via `equipment_log` field)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| parent_task | Stage | Link (Task) | Yes | |
| parent_task_subject | Stage Subject | Data | No | read_only |
| task | Task | Link (Task) | No | |
| task_subject | Task Subject | Data | No | fetch_from `task.subject`, read_only |
| task_level1..task_level10 | Task LevelN | Link (Task) | No | |
| task1_subject..task10_subject | Task LevelN Subject | Data | No | fetch_from task_levelN.subject |
| contractor | Contractor | Link (Contractor) | No | |
| item_type | Item Type | Link (Item Type) | No | fetch_from `item.custom_item_type` |
| item | Equipment | Link (Item) | Yes | |
| equipment_name | Equipment Name | Data | No | fetch_from `item.item_name` |
| working_hours | Working Hours | Float | Yes | non_negative |
| quantity | Quantity | Int | Yes | default 1 |
| rate | Rate | Currency | Yes | "Per Hour" |
| total_amount | Total Amount | Currency | No | |
| hire_supplier | Hire Supplier | Link (Contractor) | No | |
| owner_type | Owner Type | Select | Yes | default "Hired"; options `\nOwn\nHired\nSubcontractor` |
| work_area | Work Area | Data | No | |
| remarks | Remarks | Small Text | No | |
| id | Id | Dynamic Link (options: doc_name) | No | |
| doc_name | Doc Name | Link (DocType) | No | |
| reference_row_name | Reference Row Name | Data | No | |

- **Child Tables**: N/A
- **Link Fields**: parent_task/task/task_level1-10 → Task, contractor/hire_supplier → Contractor, item → Item, item_type → Item Type, doc_name → DocType, id → Dynamic Link
- **Permissions**: None (child table)
- **Validation / Server Logic**: Controller is an empty stub — `class SiteEquipmentLog(Document): pass`.
- **Whitelisted APIs**: None.
- **Client Script**: None dedicated (populated by `site_diary.js`'s `get_site_diary_details` handler).
- **Business Rules**: Records equipment usage directly on the Site Diary (distinct from the standalone Equipment Usage doctype); `owner_type` distinguishes company-owned vs hired vs subcontractor-supplied equipment; `total_amount` computed as quantity × rate × working_hours (per `site_diary.py`'s `update_task_equipment_cost`, currently commented out of `before_submit`).

---

### Site Material Delivery

- **Source**: `site_diary/doctype/site_material_delivery/site_material_delivery.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table; parented by Site Diary via `material_deliveries` field, labeled "Material Consumed" on the parent)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| item | Material | Link (Item) | Yes | |
| description | Description | Data | No | |
| supplier | Supplier | Link (Supplier) | No | |
| delivery_note | Delivery Note No. | Data | No | |
| quantity | Quantity | Float | Yes | |
| unit | UOM | Link (UOM) | No | |
| inspection_required | Inspection Required | Check | No | default 1 |
| inspection_done | Inspection Done | Check | No | default 0 |
| accepted | Accepted | Check | No | default 0 |
| rejection_reason | Rejection Reason | Data | No | |
| linked_po | Linked PO | Link (Purchase Order) | No | |
| item_type | Item Type | Link (Item Type) | No | |
| parent_task | Stage | Link (Task) | No | |
| parent_task_subject | Stage Subject | Data | No | |
| task | Task | Link (Task) | No | |
| task_subject | Task Subject | Data | No | read_only |
| warehouse | Warehouse | Link (Warehouse) | No | |
| task_level1..task_level10 | Task LevelN | Link (Task) | No | |
| task1_subject..task10_subject | Task LevelN Subject | Data | No | fetch_from |
| doc_name | Doc Name | Link (DocType) | No | |
| reference_row_name | Reference Row Name | Data | No | |
| id | Id | Dynamic Link (options: doc_name) | No | |

- **Child Tables**: N/A
- **Link Fields**: item→Item, supplier→Supplier, unit→UOM, linked_po→Purchase Order, item_type→Item Type, parent_task/task/task_level1-10→Task, warehouse→Warehouse, doc_name→DocType, id→Dynamic Link
- **Permissions**: None (child table)
- **Validation / Server Logic**: Controller is an empty stub — `class SiteMaterialDelivery(Document): pass`.
- **Whitelisted APIs**: None.
- **Client Script**: None dedicated (populated by `site_diary.js`'s `materialDeliveryPromise` block, which calls `get_material_deliveries`).
- **Business Rules**: Despite the name "delivery," this table actually captures material *consumption* at site (labeled "Material Consumed" on the Site Diary parent) — it is populated from submitted Stock Entry (Material Issue) lines. It carries QA/inspection fields (`inspection_required`, `inspection_done`, `accepted`, `rejection_reason`) distinct from `Site Diary.validate_material_deliveries_log()` which only checks item and quantity > 0.

---

### Site Visitor Log

- **Source**: `site_diary/doctype/site_visitor_log/site_visitor_log.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table; parented by Site Diary via `visitors` field)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| visitor_name | Visitor Name | Data | No | in_list_view |
| company | Company | Data | No | |
| purpose | Purpose | Select | No | default "Other", options same as Project Visitor |
| time_in | Time In | Time | No | |
| time_out | Time Out | Time | No | |
| safety_inducted | Safety Inducted | Check | No | default 0 |
| accompanied_by | Accompanied By | Link (Employee) | No | |
| notes | Notes | Small Text | No | |
| id | Id | Dynamic Link (options: doc_name) | No | |
| doc_name | Doc Name | Link (DocType) | No | |

- **Child Tables**: N/A
- **Link Fields**: accompanied_by→Employee, doc_name→DocType, id→Dynamic Link
- **Permissions**: None (child table)
- **Validation / Server Logic**: Controller is an empty stub — `class SiteVisitorLog(Document): pass`. (Server-side visitor validation — name/purpose required — is actually enforced by the parent `Site Diary.validate_visitors_log()`, not here.)
- **Whitelisted APIs**: None.
- **Client Script**: None dedicated (populated by `site_diary.js`'s `get_site_diary_details` handler pulling from submitted `Project Visitor` records).
- **Business Rules**: Denormalized copy of Project Visitor rows embedded in the daily Site Diary for that project/date.

---

### Task Progress

- **Source**: `site_diary/doctype/task_progress/task_progress.json`, `.py`, `.js`, `test_task_progress.py`
- **Description**: Not found in repository
- **Type**: Submittable Document
- **Naming**: `naming_series:` — series options `\nTP -`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Naming Series | Select | No | options `\nTP -` |
| project | Project | Link (Project) | Yes | in_list_view |
| site | Site | Link (Site) | Yes | fetch_from `project.custom_site` |
| site_date | Site Date | Date | Yes | |
| shift | Shift | Select | No | options `\nDay\nNight\nBoth` |
| site_engineer | Site Engineer | Link (Employee) | No | |
| custom_task_progress_html | Custom Task Progress Entry | HTML | No | hidden |
| task_progress_details | Task Progress Details | Table (Task Progress Details) | No | child table |
| amended_from | Amended From | Link (Task Progress) | No | read_only, no_copy |

- **Child Tables**: `task_progress_details` → Task Progress Details
- **Link Fields**: project→Project, site→Site, site_engineer→Employee, amended_from→Task Progress
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | 1 | 1 | 1 | 1 | 1 |

- **Validation / Server Logic**:
  - `before_save()`: for each `task_progress_details` row, resolves the deepest filled task level (`get_deepest_task`) and throws `Row {i}: Task "{subject}" is not a subtask.` if the resolved Task's `custom_is_subtask` flag is falsy — i.e. progress can only be logged against leaf/subtask-level Tasks.
  - `before_submit()`: for each row, writes `progress`, `custom_total_quantity`, `custom_total_achieved`, `custom_percent_completed` onto the resolved Task via `frappe.db.set_value`, then calls `update_parent_progress(row.task)`.
  - `get_deepest_task(row)`: walks `task, task_level1..task_level10` and returns the last non-empty value (deepest task in the WBS chain).
  - `update_parent_progress(task)`: recursive weighted roll-up — if the task has no `parent_task`, it treats it as top-level and recomputes `Project.percent_complete` as the weighted sum of stage tasks (`custom_is_stage=1`) using each task's `progress * task_weight / 100`, capped at 100, and fires a `project_progress_refresh` realtime event; otherwise it recomputes the parent Task's `progress` as the weighted sum of its children and recurses upward.
- **Whitelisted APIs**:
  - `get_previous_task_progress(task, current_doc=None)` — looks up the most recent `Task Progress Details` row (by `creation DESC`, excluding `current_doc`) for a task and returns `previous_total_achieved`, `total_qty`, `percent_completed` to seed a new row.
  - `has_dependencies(task)` — whether the Task has `depends_on` rows.
  - `get_depends_on_tasks(doctype, txt, searchfield, start, page_len, filters)` — dependent-task lookup for cascading pickers (same pattern as Equipment/Manpower Usage).
- **Client Script**:
  - `setup`: `parent_task` query restricted to project stage tasks; `item` query restricted to `custom_item_type=Task`; cascading level `get_query`s via `source_map` and `get_depends_on_tasks`.
  - `onload`: defaults `site_date` to today.
  - Child table `Task Progress Details` events: `form_render` → `refresh_task_levels` + `render_html_images`; `task` change calls `get_previous_task_progress` to seed `total_qty`/`total_achieved`/`percent_completed`; `parent_task` change clears task/levels; `achieved_today`/`total_qty` changes trigger `calculate_progress` (computes incremental diff vs `_last_achieved_today`, updates `total_achieved` and `percent_completed`); `is_lumsum_task` toggle clears item/contractor/uom/rate/amount fields; `item` change validates the item exists in the selected Contractor's item list and pulls rate/uom, else throws.
  - `render_html_images`: builds an inline image gallery (`images_html` HTML field) with add/remove buttons wired to `frappe.ui.FileUploader`, storing up to 10 images per row in `image_1..image_10`.
- **Business Rules**: Progress can only be recorded against genuine subtasks (`custom_is_subtask=1`); progress percentages cascade upward through the Task WBS tree and ultimately into `Project.percent_complete`, weighted by each task's `task_weight`, capped at 100%.

---

### Task Progress Details

- **Source**: `site_diary/doctype/task_progress_details/task_progress_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table; parented by Task Progress)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| parent_task | Stage | Link (Task) | Yes | |
| parent_task_subject | Stage Subject | Data | No | fetch_from `parent_task.subject`, read_only |
| task | Task | Link (Task) | No | |
| task_subject | Task Subject | Data | No | fetch_from `task.subject`, read_only |
| task_level1..task_level10 | Task | Link (Task) | No | |
| level1_subject..level10_subject | Subject | Data | No | fetch_from (note: level8_subject erroneously fetches from `task_level9.subject` in the JSON) |
| total_qty | Total Qty | Float | Yes | non_negative |
| achieved_today | Achieved Today | Float | Yes | non_negative |
| planned_today | Planned Today | Float | No | non_negative |
| total_achieved | Total Achieved | Float | No | read_only |
| percent_completed | Percent Completed | Float | No | read_only |
| is_lumsum_task | Is Lumsum Task | Check | No | default 0 |
| contractor | Contractor | Link (Contractor) | No | depends_on `is_lumsum_task==1` |
| item | Item | Link (Item) | No | depends_on `is_lumsum_task==1` |
| uom | UOM | Link (UOM) | No | depends_on `is_lumsum_task==1`, read_only |
| rate | Rate | Float | No | depends_on `is_lumsum_task==1` |
| amount | Amount | Float | No | depends_on `is_lumsum_task==1` |
| billed | Billed | Check | No | default 0 |
| paid | Paid | Check | No | default 0 |
| images_html | Images | HTML | No | renders gallery from image_1..10 |
| image_1..image_10 | Image N | Attach Image | No | hidden, populated via file uploader |

- **Child Tables**: N/A
- **Link Fields**: parent_task/task/task_level1-10 → Task, contractor → Contractor, item → Item, uom → UOM
- **Permissions**: None (child table)
- **Validation / Server Logic**: Controller is an empty stub — `class TaskProgressDetails(Document): pass`. (All logic lives in the parent `Task Progress` controller and client script.)
- **Whitelisted APIs**: None in this file.
- **Client Script**: None dedicated (driven by `task_progress.js`).
- **Business Rules**: Supports "lumsum" (lump-sum) progress items priced by contractor rate × achieved_today in addition to standard quantity-based progress tracking; up to 10 images can be attached per progress row as site-photo evidence.

---

### Task Progress Image

- **Source**: `site_diary/doctype/task_progress_image/task_progress_image.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table; not referenced in any parent doctype's field_order within this module — likely reserved/unused or wired externally)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| image_1 | Image 1 | Attach Image | No | in_preview, in_standard_filter |
| image_2..image_10 | Image N | Attach Image | No | in_preview, in_standard_filter; each `depends_on` the previous image being filled (progressive reveal) |

- **Child Tables**: N/A
- **Link Fields**: None
- **Permissions**: None (child table)
- **Validation / Server Logic**: Controller is an empty stub — `class TaskProgressImage(Document): pass`.
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository (no `.js` file present).
- **Business Rules**: Simple up-to-10-image attachment table with progressive field reveal (`image_2` depends on `image_1`, etc.) — functionally overlaps with the `image_1..image_10` fields already embedded directly in Task Progress Details.

---

### Site Diary

- **Source**: `site_diary/doctype/site_diary/site_diary.json`, `.py` (~1341 lines), `.js` (~1098 lines), `test_site_diary.py`
- **Description**: Not found in repository
- **Type**: Submittable Document — the central daily-log document of the module, aggregating manpower, equipment, materials, visitors, and task progress for one project/date/shift.
- **Naming**: `naming_series:` — series options `SD-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Naming Series | Select | No | options `SD-`, collapsible section |
| diary_no | Diary No. | Data | No | read_only; auto-generated random 5-digit unique number on insert |
| project | Project | Link (Project) | Yes | in_list_view |
| site | Site | Link (Site) | Yes | fetch_from `project.custom_site` |
| site_date | Site Date | Date | Yes | default "Today", in_list_view |
| day_no_of_contract | Day No. of Contract | Int | No | auto-calculated from project start date |
| shift | Shift | Select | Yes | default "Day", options `\nDay\nNight\nBoth`, in_list_view |
| site_engineer | Site Engineer | Link (Employee) | Yes | in_list_view |
| site_engineer_name | Site Engineer Name | Data | No | fetch_from `site_engineer.employee_name` |
| get_site_diary_details | Get Site Diary Details | Button | No | triggers client-side aggregation |
| weather_am | Weather (AM) | Select | Yes | default "Clear" |
| weather_pm | Weather (PM) | Select | Yes | default "Clear" |
| max_temp / min_temp | Max/Min Temp | Float | No | placeholder °C |
| wind_speed_kmh | Wind Speed (km/h) | Float | No | |
| general_remarks | General Remarks | Text | No | |
| site_photos | Site Photos | Attach | No | |
| status | Status | Select | Yes | default "Draft"; options Draft/Submitted/Approved by PM/Acknowledged by Consultant |
| work_stopped | Work Stopped | Check | No | default 0 |
| stoppage_reason | Stoppage Reason | Text | No | depends_on `work_stopped==1` |
| stoppage_hours | Stoppage Hours | Float | No | depends_on `work_stopped==1` |
| task | Task | Table (Task Summary) | Yes | list of parent tasks touched that day |
| activity_progress | Activity Progress | Table (DPR Activity Progress) | No | |
| material_received | Material Received | Table (Material Received) | No | |
| material_deliveries | Material Consumed | Table (Site Material Delivery) | No | |
| manpower_log | Manpower Log | Table (Manpower Log) | No | |
| equipment_log | Equipment Log | Table (Site Equipment Log) | No | |
| visitors | Visitors | Table (Site Visitor Log) | No | |
| equipment_usage_disel_details | Equipment Usage Disel Details | Table (Equipment Usage Disel Details) | No | |
| amended_from | Amended From | Link (Site Diary) | No | read_only, no_copy |

- **Child Tables**: `task`→Task Summary, `activity_progress`→DPR Activity Progress, `material_received`→Material Received, `material_deliveries`→Site Material Delivery, `manpower_log`→Manpower Log, `equipment_log`→Site Equipment Log, `visitors`→Site Visitor Log, `equipment_usage_disel_details`→Equipment Usage Disel Details. (Note: `Task Summary` and `DPR Activity Progress` doctype folders are not present under this module's `doctype/` directory in the list examined — likely defined elsewhere in the app.)
- **Link Fields**: project→Project, site→Site (fetch_from project.custom_site), site_engineer→Employee, amended_from→Site Diary
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | 1 | 1 | 1 | 1 | 1 |

- **Validation / Server Logic** (class `SiteDiary(Document)`):
  - `before_insert()`: if `diary_no` is empty, calls `generate_unique_diary_number()` — generates a random 5-digit number (10000-99999), retrying until one not already used is found.
  - `validate()` runs, in order: `validate_unique_diary()`, `validate_project_date_range()`, `validate_stoppage_reason()`, `calculate_contract_day_number()`, `validate_temperature_range()`, `validate_manpower_log()`, `validate_equipment_log()`, `validate_material_deliveries_log()`, `validate_visitors_log()`, `validate_dpr_date()`.
  - `validate_unique_diary()` / `validate_dpr_date()`: both check `Site Diary Settings.one_record_per_day_per_project`; if enabled, throws if another Site Diary already exists for the same `project` + `site_date` (functionally duplicated logic — two near-identical methods).
  - `validate_project_date_range()`: throws if `site_date` falls outside the linked Project's `expected_start_date`/`expected_end_date`.
  - `validate_stoppage_reason()`: throws if `work_stopped` is checked but `stoppage_reason` is blank.
  - `calculate_contract_day_number()`: sets `day_no_of_contract` = (site_date − project.expected_start_date).days + 1.
  - `validate_temperature_range()`: throws if `min_temp > max_temp`.
  - `validate_manpower_log()`: for each `manpower_log` row, throws if `skilled + unskilled <= 0`, and throws if `hours_worked + overtime_hours > 16`.
  - `validate_equipment_log()`: for each `equipment_log` row, throws if `working_hours < 0` or `> 24`.
  - `validate_material_deliveries_log()`: for each `material_deliveries` row, throws if `item` missing or `quantity <= 0`.
  - `validate_visitors_log()`: for each `visitors` row, throws if `visitor_name` or `purpose` missing.
  - `before_submit()`: calls `validate_future_date()` only — `validate_future_date()` throws if `site_date` is after today. The cost-rollup methods (`update_task_labour_cost`, `update_task_equipment_cost`, `update_task_progress`) and `create_material_issue_entry()` exist as full implementations but are **commented out** of `before_submit`, i.e. currently dormant/unused at submit time (dead code retained for reference or future re-enable).
  - `create_material_issue_entry()` (dormant, not called): would build and submit a Stock Entry ("Material Issue") from `material_deliveries` rows, validating stock availability against the `Bin` table for a `self.warehouse` field that is not actually defined in this doctype's schema — this method would currently error (`AttributeError`/`frappe.throw("Warehouse is mandatory")`) if invoked, since `warehouse` isn't a Site Diary field.
- **Whitelisted APIs** (module-level functions in `site_diary.py`, all `@frappe.whitelist()` — 10 total):
  1. `update_daily_activity_progress_table(doc)` — given a (client-side, unsaved) Site Diary doc JSON, queries submitted `Manpower Usage Details` and `Equipment Usage Details` for the doc's project/site_date, builds deduplicated (parent_task, task) pairs, looks up each pair's most recent `DPR Activity Progress` totals, and returns a fresh `activity_progress` row list (used to refresh the Activity Progress grid). (An older, near-duplicate commented-out version of this function using `Task.depends_on` remains in the file as dead code.)
  2. `update_task_progress_from_dpr(task, achieved_qty, total_qty)` — sets `Task.progress = achieved_qty/total_qty*100` and calls `update_parent_progress(task)`.
  3. `get_multiple_task_bom_details(tasks)` — calls `get_task_bom_details` for each task in a list, merges/deduplicates the resulting materials/manpower/equipment BOM rows, and enriches manpower rows with `daily_wages` from `Item.custom_daily_wages`.
  4. `get_current_weather(lat, lon)` — calls the public Open-Meteo API (`https://api.open-meteo.com/v1/forecast`) for current temperature/wind/weather code and daily max/min temps; logs and returns `None` on timeout, non-OK response, empty body, or other exceptions (via `frappe.log_error`).
  5. `get_task_bom_details(task)` — recursively walks a Task's `parent_task` children tree and reads each descendant Task's `custom_bom_details` child rows, bucketing them into materials/manpower/equipment lists by `item_type`.
  6. `get_site_diary_details(project, site_date, shift=None, site_engineer=None)` — the main aggregation endpoint: runs three parameterized SQL joins (`Manpower Usage Details`⋈`Manpower Usage`, `Equipment Usage Details`⋈`Equipment Usage`, `Project Visitor`) filtered by project/site_date/docstatus=1 and optionally shift/site_engineer, plus a fourth query for `Equipment Usage Details`⋈`Equipment Usage` diesel-specific columns; returns `{manpower, equipment, visitor, equipment_usage_disel_details}`.
  7. `get_material_deliveries(project, site_date, shift=None, site_engineer=None)` — finds submitted `Stock Entry` (type "Material Issue") for the date/filters, then joins `Stock Entry Detail` for the project, enriching with cached `Item.custom_item_type` and `Task.subject` lookups.
  8. `get_material_received(project, site_date, shift=None, site_engineer=None)` — reads the Project's `custom_warehouses` child table to get relevant warehouses, then unions submitted Purchase Receipt items landing in those warehouses with Stock Entry ("Material Transfer") items transferred *into* those warehouses from outside them (`COALESCE(s_warehouse,'') NOT IN warehouses`), both filtered by shift/site_engineer.
  9. `get_latest_task_progress(project, site_date, shift=None, site_engineer=None)` — finds submitted `Task Progress` docs matching the filters, then pulls their `Task Progress Details` rows (including the 10 image fields) ordered by parent/idx.
  10. `get_task_progress_images(task_progress_name, parent_task, task)` — fetches just the `image_1..image_10` fields for a specific `Task Progress Details` row keyed by parent/parent_task/task.
  - Additionally, module-level (non-whitelisted) helper `update_parent_progress(task)` performs the same weighted upward progress-rollup logic as in `Task Progress`'s controller (duplicated implementation).
- **Client Script** (`site_diary.js`):
  - `refresh(frm)`: on new/unsaved docs only, calls `get_current_weather` (hardcoded lat/lon 16.8524/74.5815) and auto-fills `weather_am`/`weather_pm` (based on time of day), `max_temp`, `min_temp`, `wind_speed_kmh`.
  - `setup(frm)`: restricts the `task` child-table link query to stage-level Tasks (`custom_is_stage=0, is_group=1`) in the current project (note: filters `custom_is_stage=0`, i.e. excludes stages themselves, seemingly to only show group/parent tasks that are not stages — a filter subtlety worth flagging).
  - `after_save(frm)`: publishes a `project_progress_refresh` realtime event for the project.
  - `get_site_diary_details(frm)` (bound to the form button): clears and refetches all aggregation child tables (`manpower_log`, `equipment_log`, `material_deliveries`, `material_received`, `task`, `activity_progress`, `visitors`, `equipment_usage_disel_details`) by calling the server methods `get_site_diary_details`, `get_material_received`, `get_material_deliveries`, and `get_latest_task_progress` in parallel via Promises, populating rows and dynamically resolving Task subjects; once all resolve, it builds a deduplicated `task` summary table and calls `sync_activity_progress`.
  - `Task Summary` child events: selecting/removing a `task` row triggers `sync_all_task_tables` → `sync_activity_progress` + `sync_bom_tables`.
  - `sync_activity_progress(frm)`: merges server-fetched `Task Progress` data with `update_daily_activity_progress_table` (manpower/equipment-derived) results into the `activity_progress` grid, preserving user-edited fields across refreshes via key-based merge.
  - `sync_bom_tables(frm)` / `merge_child_table(...)`: calls `get_multiple_task_bom_details` for the selected parent tasks and merges results into `material_deliveries`, `manpower_log`, `equipment_log`, preserving existing user edits by key.
  - `DPR Activity Progress` child events: `achieved_today` and `total_qty` changes recompute `total_achieved` (= previous_total_achieved + achieved_today) and `percent_completed`; `form_render` renders an inline image gallery (`get_task_progress_images` call) for rows sourced from Task Progress.
  - `update_level_visibility()` (top-level helper): dynamically shows/hides `task_level2..10` and their subject columns in a grid based on which levels actually have data across the fetched rows.
- **Business Rules**:
  - Only one Site Diary per project/date is allowed when the global `Site Diary Settings.one_record_per_day_per_project` flag is on.
  - Diary dates must fall within the Project's expected start/end dates and cannot be in the future (enforced separately at both `validate()` — indirectly, since future-date check is only in `before_submit`).
  - Manpower total per row must be > 0 and total hours (regular + overtime) capped at 16/day; equipment hours capped at 0-24/day.
  - The doctype acts as a read-mostly daily rollup/snapshot: most of its child tables are populated by fetching already-submitted transactional documents (Manpower Usage, Equipment Usage, Project Visitor, Stock Entry, Task Progress) rather than being edited directly, via the "Get Site Diary Details" button.
  - Cost-rollup-to-Task and auto-material-issue-creation logic exists fully coded in the controller but is currently disabled (commented out) in `before_submit`, meaning submitting a Site Diary today does NOT push labour/equipment costs to Task or auto-create a Stock Entry — only the future-date check runs at submit time.

---

## custom_stock/stock_entry.py

- **Source**: `site_diary/custom_stock/stock_entry.py`
- **Wiring**: Registered in `hooks.py` as:
  ```python
  doc_events = {
      ...
      "Stock Entry": {
          "on_submit": "quantbit_construction_management.site_diary.custom_stock.stock_entry.update_task_material_cost"
      },
      ...
  }
  ```
  This means every time **any** Stock Entry (core ERPNext doctype, not part of this module) is submitted anywhere in the system, Frappe automatically invokes `update_task_material_cost(doc, method)`.
- **Function**: `update_task_material_cost(doc, method)`:
  - Guards: returns immediately if `doc.docstatus != 1` (not submitted) or `doc.stock_entry_type != "Material Issue"` (only Material Issue entries affect task cost).
  - For each row in `doc.items`, resolves the target task as `row.custom_subtask or row.custom_task` (custom fields added to Stock Entry Detail, presumably via the `custom/` fixtures or another module's custom fields — not present in this module's `custom/item.json`, which only patches the Item doctype). Skips rows without a resolvable task.
  - Sums `row.amount` per resolved task into `task_wise_amount`.
  - For each task, adds the summed amount to the Task's existing `custom_total_material_cost` (`existing + total_amount`, same additive/cumulative pattern seen in Equipment Usage and Manpower Usage) via `frappe.db.set_value`.
  - Ends with an explicit `frappe.db.commit()` (unusual/explicit since doc_events already run inside the request transaction — this forces an immediate commit rather than waiting for the normal request-end commit).
- **Business Rules**: This is the mechanism by which materials issued to site (tracked as Stock Entries) roll up into each Task's cumulative material cost, mirroring the labour-cost rollup in Manpower Usage (`custom_total_labour_cost`) and equipment-cost rollup in Equipment Usage (`custom_total_equipment_cost`) — together these three cumulative fields presumably feed Task-level cost reporting/dashboards elsewhere in the app.

---

## Reports

### Equipment Usage Disel Details (Query/Script Report)

- **Source**: `site_diary/report/equipment_usage_disel_details/equipment_usage_disel_details.json`, `.py`, `.js`
- **report_type** (from JSON): `"Script Report"` — logic lives in Python `execute()`, not the Query Report builder.
- **ref_doctype**: Equipment Usage
- **Allowed roles**: System Manager
- **Purpose**: Flat listing of diesel/equipment usage entries (contractor, equipment item, UOM, quantity, working hours, diesel filled) across submitted Equipment Usage documents, filterable by date range/project/equipment/contractor.
- **Filters** (`equipment_usage_disel_details.js`): `from_date` (Date, required, defaults to one month before today), `to_date` (Date, required, defaults to today), `project` (Link→Project), `equipment_item` (Link→Item), `contractor` (Link→Contractor).
- **Columns** (`get_columns()` in `.py`): Contractor (Link), Equipment Item (Data, resolved to item_name), UOM (Link), Quantity (Float), Working Hrs (Float), Diesel Filled (in LTR) (Float).
- **Data logic** (`get_data()`): raw SQL joining `tabEquipment Usage Details` (eud) to `tabEquipment Usage` (eu) on `eu.name = eud.parent`, left-joining `tabItem` for item_name, filtered to `eu.docstatus = 1` plus dynamically appended conditions for from_date/to_date/project/equipment_item/contractor, ordered by `eu.site_date DESC, eud.idx`. Pure SQL-based script report (no ORM `get_data`/`frappe.get_all`, all raw `frappe.db.sql`).

### Daily Progress Report (Script Report, tree-structured)

- **Source**: `site_diary/report/daily_progress_report/daily_progress_report.json`, `.py`, `.js`, `.html`
- **report_type** (from JSON): `"Script Report"`.
- **ref_doctype**: Task
- **Allowed roles**: Projects User, HR User, HR Manager
- **Purpose**: A comprehensive single-project/single-date "Daily Progress Report" consolidating Equipment Usage, Visitors, Manpower Usage, Material Consumed, Material Received, and Task Progress into one hierarchical report, with running totals and a grand total.
- **Filters** (`daily_progress_report.js`): `site_date` (Date, required, defaults to today), `project` (Link→Project, required). The JS config also sets `tree: true, initial_depth: 0`, meaning the standard Report View renders it as a collapsible tree (using the `indent`/`is_group` fields produced by the Python).
- **Data logic** (`daily_progress_report.py`, `execute(filters)`):
  - Reuses `get_material_deliveries` and `get_material_received` imported directly from `site_diary.doctype.site_diary.site_diary` (code reuse across the module rather than reimplementing the SQL).
  - Runs five separate raw-SQL/ORM data pulls for Equipment Usage, Visitors (`frappe.get_all`), Manpower Usage, Material Consumed, Material Received, and Task Progress, each scoped to the given `project` + `site_date`, building a flat list of dict "rows" tagged with a `section` name via a shared `row(section, **kwargs)` builder, interleaved with per-section `TOTAL` rows and a final `GRAND TOTAL` row.
  - `build_hierarchy(flat_data, project_name)`: post-processes the flat row list into a nested tree structure per section, grouping rows by their `task_level1..10` → `subtask` → `task` hierarchy chain (a `Node` class with `children`/`leaves`), recursively `flatten()`-ing it back into a report-view-compatible flat list annotated with `indent` and `is_group` for the tree UI, aggregating numeric totals (`total_qty`, `achieved_today`, `total_achieved`, `presenty`, `total_presenty`, `quantity`, `amount`, `working_hours`) up through parent nodes, and computing `percent_completed` at group level from aggregated qty/achieved. Produces a final `GRAND TOTAL` node summing all sections' amounts.
  - Returns `(columns, data)` where `data` is the hierarchical flat list ready for `frappe.query_reports` tree rendering.
- **Columns** (`get_columns()`): Section / Task / Item (Data, 300px), Site Engineer, Total Qty, Achieved Today, Total Achieved, Progress Completed (Percent), Item, Item Type, Contractor, Visitor Name, Purpose, Company, Time In, Time Out, Skill Type, Presenty, Total Presenty, Transaction Type, Transaction ID, Source Warehouse, Target Warehouse, UOM, Rate, Working Hours, Quantity, Amount.
- **HTML component** (`daily_progress_report.html`): A standalone print-style template (used as this report's Jinja/print rendering, separate from the tree Report View) that independently re-derives its section groupings from the raw `data` array (re-filtering by `row.section` against a `SECTION_ORDER` list and `TOTAL_KEYS` map, rather than consuming the pre-built hierarchy from `build_hierarchy`). It renders:
  - A header ("Daily Progress Report") and sub-header showing Project name and formatted Site Date.
  - Six bordered, styled HTML tables in this visual order: **Task Progress** (task hierarchy, task/subtask IDs & subjects, total qty, achieved today, total achieved, % completed), **Equipment Usage** (task hierarchy, site engineer, task/subtask subjects, equipment item, item type, contractor, UOM, rate, quantity, working hrs, amount — with a bold "Equipment Usage Total" row), **Manpower Usage** (task hierarchy, subjects, manpower item, contractor, skill type, UOM, rate, quantity, presenty, total presenty, amount — with total row), **Material Consumed** (task hierarchy, subjects, item, item type, transaction type/ID, warehouse, UOM, rate, qty, amount — with total row), **Material Received** (item, item type, source/target warehouse, transaction type/ID, UOM, rate, qty, amount — with total row), **Visitors** (name, purpose, company, time in/out).
  - A final "Grand Total" block showing the summed `amount` across all sections.
  - Uses helper JS functions embedded in the template (`fmt_num`, `fmt_qty` for Indian-locale number formatting, `task_hierarchy` to join `level1_subject..level10_subject` into a `<br>`-separated string) and shows "No records found" / "No data" placeholder rows when a section is empty.

Report type summary: both reports are **Script Reports** (`report_type: "Script Report"` in their JSON) driven entirely by Python `execute()`/`get_data()` functions using raw `frappe.db.sql` (plus some `frappe.get_all`) — neither uses the no-code Query Report builder. The Daily Progress Report additionally ships a Jinja/`.html` print-style template for a formatted, non-tree presentation of the same underlying data.

---

## Module: Subcontractor Management

### Contractor

- **Source**: `subcontractor_management/doctype/contractor/contractor.json`, `contractor.py`, `contractor.js`
- **Description**: Not found in repository
- **Type**: Master (non-submittable, standalone)
- **Naming**: `autoname: "field:contractor_name"` — named directly from the `contractor_name` field (which is also flagged `unique`).
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| contractor_name | Contractor Name | Data | No (used for naming) | `unique: 1` |
| supplier_name | Supplier Name | Link → Supplier | No | |
| contractor_type | Contractor Type | Select | No | Options: Individual / Contract |
| accounting_section | Accounting | Section Break | — | |
| billing_account | Billing Account | Link → Account | No | |
| section_break_fner | — | Section Break | — | |
| site_diary_contractor_item_details | Site Diary Contractor Item Details | Table → Site Diary Contractor Item Details | No | |

- **Child Tables**: `site_diary_contractor_item_details` → Site Diary Contractor Item Details
- **Link Fields**: `supplier_name` → Supplier; `billing_account` → Account
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | 1 | 1 | 1 | 1 | — (not submittable) |

- **Validation / Server Logic**: `Contractor(Document)` — controller body is `pass`; no custom validate/submit logic.
- **Whitelisted APIs**: None.
- **Client Script**: `contractor.js` contains only a commented-out empty `refresh` stub — no active client logic.
- **Business Rules**: Acts as the master record for a subcontractor/labour contractor, distinct from (but often linked to) a `Supplier`. `billing_account` is fetched into `Contractor Billing.contractor_account`.

---

### Contractor Billing

- **Source**: `subcontractor_management/doctype/contractor_billing/contractor_billing.json`, `contractor_billing.py`, `contractor_billing.js`
- **Description**: Not found in repository
- **Type**: Submittable Document (`is_submittable: 1`)
- **Naming**: `naming_series:` field, series options `\nCB-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Naming Series | Select | No | Options `\nCB-` |
| project | Project | Link → Project | Yes | |
| site | Site | Link → Site | Yes | `fetch_from: project.custom_site` |
| contractor | Contractor | Link → Contractor | Yes | |
| contractor_account | Contractor Account | Link → Account | No | `fetch_from: contractor.billing_account` |
| start_date | Start Date | Date | Yes | |
| type | Type | Select | Yes | Options: (blank)/Manpower/Equipment/Task |
| supplier | Supplier | Link → Supplier | No | `fetch_from: contractor.supplier_name` |
| end_date | End Date | Date | Yes | |
| project_account | Project Account | Link → Account | No | `fetch_from: project.custom_default_contractor_billing_account`; `link_filters` restricts to `account_type = Indirect Expense` |
| company | Company | Link → Company | No | `fetch_from: project.company` |
| get_details | Get Details | Button | — | client-side fetch of usage rows |
| contractor_billing_details | Contractor Billing Details | Table → Contractor Billing Details | No | |
| grand_total | Grand Total | Currency | No | computed client-side from `contractor_billing_details` |
| outstanding_amount | Outstanding Amount | Currency | No | maintained server-side |
| paid_amount | Paid Amount | Currency | No | maintained server-side |
| amended_from | Amended From | Link → Contractor Billing | No | standard amendment field |

- **Child Tables**: `contractor_billing_details` → Contractor Billing Details
- **Link Fields**: `project`→Project, `site`→Site, `contractor`→Contractor, `contractor_account`→Account, `supplier`→Supplier, `project_account`→Account, `company`→Company, `amended_from`→Contractor Billing
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | 1 | 1 | 1 | 1 | 1 |

- **Doctype Links** (shown in "Connections"): Journal Entry, Payment Entry, Purchase Invoice — all matched via each target doctype's `custom_doc_link` field.
- **Validation / Server Logic** (class `ContractorBilling(Document)`):
  - `before_submit`: sets `outstanding_amount = grand_total`.
  - `on_submit`: calls `update_billed_status(1)` (marks the source Manpower/Equipment/Task usage child rows as `billed=1`), then reads Billing Settings singleton flags `create_jv` and `create_purchase_invoice` — if set, auto-creates a Journal Entry and/or Purchase Invoice via `create_journal_entry()` / `create_purchase_invoice()`.
  - `on_cancel`: calls `update_billed_status(0)`, `update_paid_status_in_child(0)`, `cancel_journal_entry()`, `cancel_purchase_invoice()`, `unlink_payment_entries()`.
  - `update_billed_status(status)`: maps `self.type` → child doctype (`Manpower`→"Manpower Usage Details", `Equipment`→"Equipment Usage Details", `Task`→"Task Progress Details"); for each `contractor_billing_details` row with a `reference_row_name`, sets that child record's `billed` field via `frappe.db.set_value`.
  - `update_paid_status_in_child(status)`: same mapping, sets `paid` field on the same referenced child rows.
  - `cancel_journal_entry()` / `cancel_purchase_invoice()`: looks up JE/PI linked via `custom_doc_link_doctype`/`custom_doc_link` == this Contractor Billing, cancels it if submitted (docstatus==1).
  - `create_purchase_invoice()`: builds a new Purchase Invoice for `self.supplier`/`self.project`/`self.company`, tagging it with `custom_doc_link_doctype="Contractor Billing"` / `custom_doc_link=self.name`; appends one PI item per `contractor_billing_details` row (`qty = quantity or working_hrs or 1`, `rate = amount/qty`), inserts with `ignore_permissions=True` and submits it.
  - `create_journal_entry()`: builds a JE dated `today()`, tagged with the same `custom_doc_link*` fields; debits `self.project_account` by `grand_total` and credits `self.contractor_account` (party_type Supplier, party `self.supplier`) by `grand_total`, both lines carry `project=self.project`; inserts (`ignore_permissions=True`) and submits.
  - `unlink_payment_entries()`: on cancel, finds all Payment Entries whose `custom_doc_link_doctype`/`custom_doc_link` point to this record and blanks those fields (does not cancel the PE itself).
- **Whitelisted APIs**:
  - `create_payment_entry(source_name, target_doc=None)` — `get_mapped_doc` mapper from Contractor Billing → Payment Entry. `set_missing_values` sets `payment_type="Pay"`, `party_type="Supplier"`, `party=source.supplier`, `company`, `custom_doc_link_doctype="Contractor Billing"`, `custom_doc_link=source.name`, `posting_date=today()`, `paid_to=source.contractor_account`, `paid_to_account_currency="INR"`, `paid_amount=source.outstanding_amount`, `project=source.project`. Field map: `grand_total`→`paid_amount`. Invoked from the form's "Create Payment Entry" button (only shown when submitted and `outstanding_amount > 0`).
  - (Module-level hook handlers, not user-invoked but whitelisted-equivalent event handlers — see Cross-Doctype Event Integration section below): `on_payment_entry_submit`, `on_payment_entry_cancel`, `on_purchase_invoice_update`, `on_journal_entry_update`, and the shared helpers `update_payment_status(payment_entry)` and `sync_contractor_billing_payment_status(cb_name)`.
- **Client Script** (`contractor_billing.js`):
  - `setup`: restricts `doc_name` link query in `contractor_billing_details` grid to Manpower Usage / Equipment Usage.
  - `refresh`: recalculates `grand_total`; if submitted and outstanding amount > 0, adds a "Create Payment Entry" custom button that opens the mapped-doc dialog against `create_payment_entry`.
  - `get_details` (button handler, async): validates project/start_date/end_date/contractor/type are filled; clears `contractor_billing_details`; depending on `type` queries `Manpower Usage`, `Equipment Usage`, or `Task Progress` parent docs filtered by project and `site_date` between start/end date; for each matching parent, fetches the full doc, filters its usage child rows to this contractor and `!billed`, and appends a mapped row into `contractor_billing_details` (id, doc_name, reference_row_name, site_date, item, uom, quantity, rate, working_hrs, amount, presenty, time_in, hours, time_out, total_presenty, opening_reading, closing_reading, diesel_filledin_ltr); recalculates grand total.
  - `Contractor Billing Details` child events: `amount` change and row removal both trigger `calculate_grand_total`.
  - `calculate_grand_total(frm)`: sums `amount` across `contractor_billing_details` into `grand_total`.
- **Business Rules**:
  - Contractor Billing is a labour/equipment/task cost aggregator that pulls unbilled usage rows from three other modules' doctypes (Manpower Usage, Equipment Usage, Task Progress) and marks them billed on submit / unbilled on cancel.
  - It can optionally auto-generate downstream accounting documents (Journal Entry and/or Purchase Invoice) based on a "Billing Settings" single doctype's `create_jv` / `create_purchase_invoice` flags.
  - Payment status (`paid_amount`, `outstanding_amount`, and the child rows' `paid` flag) is synced from Payment Entry/Purchase Invoice/Journal Entry activity via the module-level hook handlers (see Cross-Doctype Event Integration).

---

### Contractor Billing Details

- **Source**: `subcontractor_management/doctype/contractor_billing_details/contractor_billing_details.json`, `contractor_billing_details.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table, row-based)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| id | Id | Dynamic Link | No | `options: doc_name` — dynamically links to the parent usage record |
| site_date | Site Date | Date | No | |
| item | Item | Link → Item | No | |
| uom | UOM | Link → UOM | No | |
| quantity | Quantity | Int | No | |
| rate | Rate | Float | No | |
| amount | Amount | Currency | No | |
| working_hrs | Working Hrs | Float | No | `depends_on: eval.doc.type == "Equipment"` |
| reference_row_name | Reference Row Name | Data | No | name of the source usage child row (used to set `billed`/`paid`) |
| presenty | Presenty | Float | No | |
| time_in / time_out | Time In / Out | Time | No | |
| hours | Hours | Float | No | |
| total_presenty | Total Presenty | Float | No | |
| opening_reading / closing_reading | — | Float | No | equipment meter readings |
| diesel_filledin_ltr | Diesel filled (in LTR) | Float | No | |
| doc_name | Doc Name | Link → DocType | No | stores which doctype (Manpower/Equipment/Task…) the row came from |

- **Child Tables**: None
- **Link Fields**: `item`→Item, `uom`→UOM, `doc_name`→DocType, `id` (Dynamic Link via `doc_name`)
- **Permissions**: None (child table — inherits parent's)
- **Validation / Server Logic**: `ContractorBillingDetails(Document)` — `pass`, no custom logic.
- **Whitelisted APIs**: None.
- **Client Script**: No dedicated `.js` file for this child (its behavior is wired through `contractor_billing.js`).
- **Business Rules**: Snapshot row of one usage entry (manpower day, equipment usage, or task progress) captured onto a Contractor Billing for payment purposes.

---

### RA Abstarct Details

- **Source**: `subcontractor_management/doctype/ra_abstarct__details/ra_abstarct__details.json`, `ra_abstarct__details.py`
- **Description**: Not found in repository (note: DocType name/label is literally "RA Abstarct  Details" — a typo retained in the doctype label/name).
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| stage | Stage | Link → Task | No | |
| stage_subject | Stage Subject | Data | No | |
| task | Task | Link → Task | No | |
| task_subject | Task Subject | Data | No | `fetch_from: task.subject` |
| description | Description | Small Text | No | |
| uom | UOM | Link → UOM | No | |
| rate | Rate | Float | No | |
| previous_bill_quantity | Previous Bill Quantity | Float | No | |
| billed_quantity | This Bill Quantity | Float | No | |
| total_bill_quantity | Total Bill Quantity | Float | No | previous + this bill |
| previous_bill_amount | Previous Bill Amount | Float | No | |
| amount | This Bill Amount | Currency | No | |
| total_bill_amount | Total Bill Amount | Float | No | previous + this bill |
| remarks | Remarks | Data | No | |

- **Child Tables**: None
- **Link Fields**: `stage`→Task, `task`→Task
- **Permissions**: None
- **Validation / Server Logic**: `RAAbstarctDetails(Document)` — `pass`.
- **Whitelisted APIs**: None (populated server-side by `RABilling.update_abstract_details()` — see RA Billing section).
- **Client Script**: Not found in repository.
- **Business Rules**: One row per "stage" (top-level task grouping) on an RA Billing, summarizing that stage's billed quantity/amount for the current bill plus running totals carried forward from the previous submitted RA Billing for the same project.

---

### RA Billing Details

- **Source**: `subcontractor_management/doctype/ra_billing_details/ra_billing_details.json`, `ra_billing_details.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: N/A (child table)
- **Fields** (measurement-sheet style row with up to 10 hierarchical task levels):

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| stage_subject | Stage Subject | Data | No | `fetch_from: stage.subject` |
| task_subject | Task Subject | Data | No | `fetch_from: task.subject` |
| task_level1..task_level10 | Task Level N | Link → Task | No | hierarchical drill-down (up to 10 levels) |
| level1_subject..level10_subject | Task LevelN Subject | Data | No | `fetch_from: task_levelN.subject`, read-only |
| total_quantity | Total Quantity | Float | No | |
| no1, no2 | No.1 / No.2 | Float | No | measurement multipliers |
| length, width, height | — | Float | No | measurement dimensions |
| quantity | Actual Quantity (By Measurement) | Float | No | computed client-side = no1×no2×length×width×height |
| uom | UOM | Link → UOM | No | |
| billed_quantity | Billed Quantity | Float | No | |
| rate | Customer Rate | Float | No | |
| amount | Amount | Currency | No | quantity × rate |
| description | Description | Small Text | No | |
| task | Task | Link → Task | No | |
| stage | Stage | Link → Task | No | |

- **Child Tables**: None
- **Link Fields**: `task`, `stage`, `task_level1`..`task_level10` → all Task
- **Permissions**: None
- **Validation / Server Logic**: `RABillingDetails(Document)` — `pass`.
- **Whitelisted APIs**: None directly; populated/validated through RA Billing's whitelisted methods (`get_project_tasks`, `validate_task_rates`).
- **Client Script**: behavior lives in `ra_billing.js` (see RA Billing section) — `no1`/`no2`/`length`/`width`/`height` changes recompute `quantity`; `rate`/`quantity` changes recompute `amount` and roll up `grand_total`; `rate` change also calls server-side `validate_task_rates`.
- **Business Rules**: This is the line-item measurement table (Measurement tab) of an RA Billing — one row per measured item/task, optionally nested up to 10 task levels deep, feeding both `grand_total` and (grouped by `stage`) the RA Abstract Details summary.

---

### SC Bill

- **Source**: `subcontractor_management/doctype/sc_bill/sc_bill.json`, `sc_bill.py`, `sc_bill.js`
- **Description**: Not found in repository
- **Type**: Submittable Document (`is_submittable: 1`), `track_changes: 1`
- **Naming**: `naming_series:` with series `SCB-.YYYY.-`; a separate `bill_no` (Data, unique, read-only) is generated in `before_insert` via `generate_unique_8_digit_number("SC Bill", "bill_no")` from `quantbit_construction_management.utils`.
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| project | Project | Link → Project | No | |
| bill_no | Sc Bill No. | Data | No | read-only, unique, system-generated 8-digit number |
| subcontract | Subcontract | Data | Yes | plain text/free reference (not a Link) to a Subcontract Agreement |
| work_order | Work Order | Data | No | plain text reference to an SC Work Order |
| subcontractor | Subcontractor | Link → Supplier | No | |
| advance_recovery | Advance Recovery | Currency | No | default 0 |
| retention | Retention | Currency | No | default 0 |
| bill_date | Bill Date | Date | Yes | default "Today" |
| gross_amount | Gross Amount | Currency | No | default 0 |
| net_amount | Net Amount | Currency | No | default 0 |
| period_from / period_to | Period From/To | Date | Yes | |
| status | Status | Select | Yes | default "Submitted"; options: Submitted/Under Review/Certified/Rejected/Partially Certified |
| supporting_docs | Supporting Docs | Attach | No | |
| bill_items | Bill Items | Table → SC Bill Item | Yes | |
| amended_from | Amended From | Link → SC Bill | No | |

- **Child Tables**: `bill_items` → SC Bill Item
- **Link Fields**: `project`→Project, `subcontractor`→Supplier, `amended_from`→SC Bill
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | 1 | 1 | 1 | 1 | 1 (also amend/cancel) |
| All | 1 | — | — | — | — |

- **Validation / Server Logic**: `SCBill(Document)` — `before_insert`: if `bill_no` not already set, generates a unique 8-digit number via `generate_unique_8_digit_number`.
- **Whitelisted APIs**: None.
- **Client Script**: `sc_bill.js` contains only a commented-out empty `refresh` stub — no active client logic.
- **Business Rules**: Represents a subcontractor's raw bill submission (gross amount, retention, advance recovery deductions netting to `net_amount`) for a period, referencing a Subcontract/Work Order by free-text identifier (no formal Link constraint) rather than a Link field.

---

### SC Bill Item

- **Source**: `subcontractor_management/doctype/sc_bill_item/sc_bill_item.json`, `sc_bill_item.py`, `sc_bill_item.js`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`), `track_changes: 1`
- **Naming**: `naming_series:SBI-.YYYY.-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Series | Select | No | `SBI-.YYYY.-` |
| item | Item | Data | No | free text, not a Link |
| qty | Quantity | Float | No | |
| rate | Rate | Currency | No | |
| amount | Amount | Currency | No | |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: None
- **Validation / Server Logic**: `SCBillItem(Document)` — `pass`.
- **Whitelisted APIs**: None.
- **Client Script**: commented-out empty stub.
- **Business Rules**: Line item (item/qty/rate/amount) of an SC Bill.

---

### SC Payment Certificate

- **Source**: `subcontractor_management/doctype/sc_payment_certificate/sc_payment_certificate.json`, `sc_payment_certificate.py`, `sc_payment_certificate.js`
- **Description**: Not found in repository
- **Type**: Submittable Document (`is_submittable: 1`), `track_changes: 1`
- **Naming**: `naming_series:` (series `SCPC-.YYYY.-`); separate `cert_no` (Data, unique, read-only) generated in `before_insert` via `generate_unique_8_digit_number("SC Payment Certificate", "cert_no")`.
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| project | Project | Link → Project | No | |
| cert_no | Certificate No | Data | No | read-only, unique, auto-generated |
| subcontract | Subcontract | Data | Yes | free text |
| sc_bill | Sc Bill | Data | Yes | free text (not linked to SC Bill doctype) |
| subcontractor | Subcontractor | Link → Supplier | No | |
| certified_by | Certified By | Link → User | No | |
| purchase_invoice | Purchase Invoice | Link → Purchase Invoice | No | |
| cert_date | Certificate Date | Date | Yes | |
| payment_due_date | Payment Due Date | Date | No | |
| certified_amount | Certified Amount | Currency | Yes | default 0, `non_negative: 1` |
| net_payable | Net Payable | Currency | No | default 0 |
| remarks | Remarks | Text | No | |
| deduction | Deduction | Table → SC Payment Deduction | No | |
| status | Status | Select | Yes | default "Draft"; options: Draft/Issued/Paid |
| amended_from | Amended From | Link → SC Payment Certificate | No | |

- **Child Tables**: `deduction` → SC Payment Deduction
- **Link Fields**: `project`→Project, `subcontractor`→Supplier, `certified_by`→User, `purchase_invoice`→Purchase Invoice, `amended_from`→SC Payment Certificate
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | 1 | 1 | 1 | 1 | 1 (also amend/cancel) |
| All | 1 | — | — | — | — |

- **Validation / Server Logic**: `SCPaymentCertificate(Document)` — `before_insert`: generates unique 8-digit `cert_no` if not set.
- **Whitelisted APIs**: None.
- **Client Script**: commented-out empty stub.
- **Business Rules**: Formal certification of a subcontractor's bill for payment, with itemized deductions, tracking certified vs. net payable amount and an optional link to the resulting Purchase Invoice.

---

### SC Payment Deduction

- **Source**: `subcontractor_management/doctype/sc_payment_deduction/sc_payment_deduction.json`, `sc_payment_deduction.py`, `sc_payment_deduction.js`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`), `track_changes: 1`
- **Naming**: `autoincrement` (naming_rule), though a `naming_series` field (`SPD-.YYYY.-`) also exists on the form (unused given autoincrement naming_rule).
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Series | Select | No | `SPD-.YYYY.-` |
| deduction_type | Deduction Type | Data | No | free text |
| amount | Amount | Currency | No | |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: None
- **Validation / Server Logic**: `SCPaymentDeduction(Document)` — `pass`.
- **Whitelisted APIs**: None.
- **Client Script**: commented-out empty stub.
- **Business Rules**: Itemized deduction line (e.g., TDS, retention, advance recovery) attached to an SC Payment Certificate.

---

### SC Work Order

- **Source**: `subcontractor_management/doctype/sc_work_order/sc_work_order.json`, `sc_work_order.py`, `sc_work_order.js`
- **Description**: Not found in repository
- **Type**: Submittable Document (`is_submittable: 1`), `track_changes: 1`
- **Naming**: `naming_series:` (series `WO-.YYYY.-`); separate `wo_no` (Data, unique, read-only) generated in `before_insert` via `generate_unique_8_digit_number("SC Work Order", "wo_no")`.
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| project | Project | Link → Project | No | |
| wo_no | Work Order No. | Data | No | read-only, unique, auto-generated |
| subcontract | Subcontract | Data | Yes | free text |
| subcontractor | Subcontractor | Link → Supplier | Yes | |
| scope | Scope | Text | Yes | |
| method_statement | Method Statement | Data | No | |
| shop_drawing | Shop Drawing | Data | No | |
| issue_date | Issue Date | Date | Yes | default "Today" |
| start_date / end_date | — | Date | Yes | |
| wo_value | Wo Value | Currency | No | default 0 |
| status | Status | Select | Yes | default "Issued"; options: Issued/In Progress/Completed/Cancelled |
| wo_items | WO Items | Table → WO Item | Yes | |
| amended_from | Amended From | Link → SC Work Order | No | |

- **Child Tables**: `wo_items` → WO Item
- **Link Fields**: `project`→Project, `subcontractor`→Supplier, `amended_from`→SC Work Order
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | 1 | 1 | 1 | 1 | 1 (also amend/cancel) |
| All | 1 | — | — | — | — |

- **Validation / Server Logic**: `SCWorkOrder(Document)` — `before_insert`: generates unique 8-digit `wo_no` if not set.
- **Whitelisted APIs**: None.
- **Client Script**: commented-out empty stub.
- **Business Rules**: Formal work order issued to a subcontractor against a subcontract, itemizing scope and value; status lifecycle Issued → In Progress → Completed/Cancelled.

---

### Site Diary Contractor Item Details

- **Source**: `subcontractor_management/doctype/site_diary_contractor_item_details/site_diary_contractor_item_details.json`, `site_diary_contractor_item_details.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`, `editable_grid: 1`)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| item | Item | Link → Item | No | `in_standard_filter` |
| item_type | Item Type | Link → Item Type | No | `fetch_from: item.custom_item_type` |
| uom | UOM | Link → UOM | No | `fetch_from: item.stock_uom` |
| quantity | Quantity | Int | No | default 1 |
| rate | Rate | Float | No | |

- **Child Tables**: None
- **Link Fields**: `item`→Item, `item_type`→Item Type, `uom`→UOM
- **Permissions**: None
- **Validation / Server Logic**: `SiteDiaryContractorItemDetails(Document)` — `pass`.
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository.
- **Business Rules**: Item-level detail row attached to `Contractor.site_diary_contractor_item_details` — a per-contractor catalogue of items/rates usable when recording site diary contractor activity elsewhere in the app.

---

### Subcontract Agreement

- **Source**: `subcontractor_management/doctype/subcontract_agreement/subcontract_agreement.json`, `subcontract_agreement.py`, `subcontract_agreement.js`
- **Description**: Not found in repository
- **Type**: Submittable Document (`is_submittable: 1`), `track_changes: 1`
- **Naming**: `naming_series:` (default `SCA-.YYYY.-`); separate `sca_no` (Data, unique, read-only) generated in `before_insert` via `generate_unique_8_digit_number("Subcontract Agreement", "sca_no")`.
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| project | Project | Link → Project | Yes | |
| currency | Currency | Link → Currency | No | |
| contract_type | Contract Type | Select | No | Lump Sum / Remeasurement / Labour Only / Supply & Install / Labour & Materials |
| sca_no | Subcontract No. | Data | No | read-only, unique, auto-generated |
| title | Title | Data | Yes | |
| main_contract | Main Contract | Data | No | free text |
| subcontractor | Subcontractor | Link → Supplier | Yes | |
| scope_of_work | Scope Of Work | Text | Yes | |
| retention_pct | Retention % | Percent | No | default 5 |
| advance_pct | Advance % | Percent | No | default 0 |
| payment_terms | Payment Terms | Select | No | default "45 Days"; options 30/45/60 Days, On Certification, On Measurement |
| start_date | Start Date | Date | Yes | |
| end_date | End Date | Date | Yes | |
| insurance_expiry | Sc Insurance Expiry | Date | No | |
| sc_value | Subcontract Value | Currency | Yes | |
| boq_items | BOQ Items | Table → BOQ Item | No | |
| signed_copy | Signed Agreement | Attach | No | |
| status | Status | Select | Yes | options: Draft/Active/Suspended/Completed/Terminated |
| amended_from | Amended From | Link → Subcontract Agreement | No | |

- **Child Tables**: `boq_items` → BOQ Item (BOQ Item doctype is defined outside this module scope)
- **Link Fields**: `project`→Project, `currency`→Currency, `subcontractor`→Supplier, `amended_from`→Subcontract Agreement
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | 1 | 1 | 1 | 1 | 1 (also amend/cancel) |
| All | 1 | — | — | — | — |

- **Validation / Server Logic**: `SubcontractAgreement(Document)` — `before_insert`: generates unique 8-digit `sca_no` if not set.
- **Whitelisted APIs**: None.
- **Client Script**: commented-out empty stub.
- **Business Rules**: The master contract record between the company and a subcontractor — defines contract type, value, retention/advance percentages, payment terms, and BOQ items. SC Work Orders and SC Bills reference it by free-text `subcontract` field (not a formal Link), so referential integrity between Subcontract Agreement and downstream Work Orders/Bills is not DB-enforced.

---

### WO Item

- **Source**: `subcontractor_management/doctype/wo_item/wo_item.json`, `wo_item.py`, `wo_item.js`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`), `track_changes: 1`
- **Naming**: `naming_series:WI-.YYYY.-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Series | Select | No | `WI-.YYYY.-` |
| item | Item | Data | No | free text, not a Link |
| uom | UOM | Link → UOM | No | |
| qty | Quantity | Float | No | |
| rate | Rate | Currency | No | |
| amount | Amount | Currency | No | |
| description | Description | Text | No | |

- **Child Tables**: None
- **Link Fields**: `uom`→UOM
- **Permissions**: None
- **Validation / Server Logic**: `WOItem(Document)` — `pass`.
- **Whitelisted APIs**: None.
- **Client Script**: commented-out empty stub.
- **Business Rules**: Line item (item/qty/rate/amount/description) of an SC Work Order.

---

### RA Billing

- **Source**: `subcontractor_management/doctype/ra_billing/ra_billing.json` (~2710-line `ra_billing.py`, ~859-line `ra_billing.js`)
- **Description**: Not found in repository. Functionally this is the **running-account (RA) bill computation and measurement-sheet engine**, primarily used to bill a *Customer* (via Sales Invoice) for measured/certified project quantities — it lives in the Subcontractor Management module but its `customer`/Sales Invoice linkage indicates it is the project's own progress-billing document (RA bill to the client), built from task/stage measurement hierarchies, optional steel/reinforcement take-off, and an optional "Level" survey matrix.
- **Type**: Submittable Document (`is_submittable: 1`), multi-tab form (Measurement / Abstract / Steel / Level / Level Data tabs)
- **Naming**: `naming_series:` field, options `\nRAB-`
- **Fields** (top-level; several tabs, each backed by its own child table):

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Naming Series | Select | No | `\nRAB-` |
| project | Project | Link → Project | Yes | |
| bill_of_quantities | Bill of Quantities | Link → Bill of Quantities | No | `fetch_from: project.custom_bill_of_quantities` |
| site | Site | Link → Site | Yes | `fetch_from: project.custom_site` |
| customer | Customer | Link → Customer | Yes | `fetch_from: project.customer` |
| from_date / to_date | — | Date | Yes | billing period |
| get_details | Get Details | Button | — | fetches project tasks into `ra_billing_details` |
| ra_billing_details | RA Billing Details | Table → RA Billing Details | No | Measurement tab |
| ra_abstract_details | RA Abstract Details | Table → RA Abstarct Details | No | Abstract tab, server-computed |
| grand_total | Total Amount | Currency | read_only | sum of `ra_billing_details.amount` |
| with_tax | With Tax | Check | No | default 0 |
| tax_details | Tax Details | Table → RA Billing Tax Details | No | shown when `with_tax=1` (doctype lives in `ra_billing` module, not this one) |
| final_grand_total | Grand Total | Currency | No | shown when `with_tax=1`; `grand_total` + sum of tax rows |
| get_details_ | Get Details (Steel) | Button | — | fetches project steel subtasks into `ra_steel_details` |
| download_template / import_file / import_data | — | Button / Attach / Button | No | Excel round-trip for steel measurement |
| ra_steel_details | RA Steel Details | Table → RA Billing Steel Details | No | Steel tab (doctype lives in `site_diary` module) |
| get_levels | Get Levels | Button | — | fetches Task Level Sheet rows into `level_details` |
| level_details | Level Details | Table → RA Bill Level Sheet Details | No | Level tab (doctype lives in `ra_billing` module) |
| add_column | Add Column | Button | — | renders dynamic "Level Matrix" HTML grid |
| calculate | Calculate | Button | — | recalculates the Level Matrix via formulas |
| levelsheet_details | Levelsheet Details | HTML | No | dynamically rendered grid (see Level Matrix logic) |
| level_data_json | Level Data Json | Code | hidden | JSON snapshot of the level matrix (columns/rows) so it survives reload |
| amended_from | Amended From | Link → RA Billing | No | |

- **Child Tables**: `ra_billing_details`→RA Billing Details, `ra_abstract_details`→RA Abstarct Details, `ra_steel_details`→RA Billing Steel Details (external module), `tax_details`→RA Billing Tax Details (external module), `level_details`→RA Bill Level Sheet Details (external module)
- **Link Fields**: `project`→Project, `bill_of_quantities`→Bill of Quantities, `site`→Site, `customer`→Customer, `amended_from`→RA Billing
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | 1 | 1 | 1 | 1 | 1 |

- **Doctype Links**: Sales Invoice (matched via `custom_doc_link`)
- **Validation / Server Logic** (class `RABilling(Document)`):
  - `before_save`: runs, in order, `sync_deleted_tasks()`, `sync_steel_quantities_to_billing()`, `update_abstract_details()`.
  - `sync_deleted_tasks()`: compares the previous saved version's `ra_abstract_details` task set to the current one; any task removed from the Abstract causes its corresponding rows to be stripped out of `ra_billing_details` too (keeps Measurement rows consistent when a stage/task is deleted from the Abstract).
  - `sync_steel_quantities_to_billing()`: for every `ra_steel_details` row, sums reinforcement bar length × weight-per-meter (formula `dia²/162` kg/m, for diameters 8/10/12/16/20/25/28/32 mm) into a running Kg total keyed by the row's deepest populated task/level id (`_get_deepest_task_id`); converts to Metric Tonnes and writes it into the matching `ra_billing_details` row's `quantity` (and sets `uom="Metric Tonne"`, recomputes `amount = rate × quantity`) — i.e. steel take-off quantities automatically flow into the billing line for the same task.
  - `update_abstract_details()`: rebuilds `ra_abstract_details` from scratch by grouping `ra_billing_details` rows by `stage`, summing `quantity`→`billed_quantity` and `amount` per stage; merges in the previous submitted RA Billing's cumulative totals per stage (via `get_previous_stage_totals`) to populate `previous_bill_quantity`/`previous_bill_amount` and computes `total_bill_quantity`/`total_bill_amount` = previous + this bill; finally sets `grand_total = sum(ra_billing_details.amount)`.
  - `on_submit`: calls `update_billed_quantity()` — for each `ra_billing_details` row, finds the deepest populated `task_levelN` (or falls back to `task`), and increments that Task's `custom_billed_quantity` field by the row's `quantity` via direct `frappe.db.set_value` (cumulative billed-quantity tracking against the project Task tree).
- **Whitelisted APIs** (module-level functions in `ra_billing.py`):
  1. `validate_task_rates(doc)` — parses the posted doc JSON, walks `ra_billing_details`, and `frappe.throw`s if the same `task` appears in multiple rows with different `rate` values (enforces one rate per task within a bill). Called from JS on every `rate` change.
  2. `get_project_tasks(project)` — returns all Tasks under the project flagged `custom_is_subtask=1`, each enriched with its full ancestor hierarchy (stage → task → task_level1..10, both name and subject), plus `total_quantity`, `total_achieved` (`custom_total_achieved`), `billed_quantity` (`custom_billed_quantity`), `billable_quantity = achieved - billed`, `rate` (`custom_rate`), `uom` (`custom_uom`). Powers the "Get Details" button that populates the Measurement tab.
  3. `get_project_steel_tasks(project)` — same hierarchy-walk but filtered to Tasks flagged `custom_is_steel_subtask=1`; used by the Steel tab's "Get Details" button.
  4. `create_sales_invoice(source_name, target_doc=None, item_code=None)` — `get_mapped_doc` mapper RA Billing → Sales Invoice; looks up the chosen `item_code`'s name and UOM (from `UOM Conversion Detail` or the item's `stock_uom`), appends a single SI line item with `rate`/`amount` = the RA Billing's `grand_total`, tags the SI with `custom_doc_link_doctype="RA Billing"`/`custom_doc_link=source.name`, calls `target.run_method("set_missing_values")`. Invoked from the "Sales Invoice" custom button (submitted docs only), prompting the user to pick a (non-stock) Item.
  5. `export_ra_excel(ra_billing)` — generates a multi-sheet `.xlsx` workbook (Summary, Abstract, Measurement, Steel sheets) with full formatting (headers, borders, merged title rows, per-diameter reinforcement weight roll-ups converted Kg→MT, tax rows if `with_tax`), streamed back as `frappe.response["filecontent"]` for download. Triggered by the "Export RA" button (works even on drafts).
  6. `get_steel_details(project, from_date, to_date)` — raw SQL join across `Stock Entry` / `Stock Entry Detail` / `Item`, returning Material-Issue stock entries for items where `custom_item_type = 'steel'` within the date range for the project (submitted entries only). (Not wired to a visible button in the reviewed JS excerpt — likely used elsewhere/reserved.)
  7. `get_level_sheet_details(project)` — pulls all submitted `Task Level Sheet` docs for the project (ordered by creation), and for each flattens: a header row (deepest task in that sheet's hierarchy), its `level_sheet_details` rows (design/bs/is/fs/hi/rl/remark survey columns), and a trailing "average" row (`sheet.average`). Feeds the Level tab's "Get Levels" button.
  8. `get_level_matrix(project)` — reads the Project's `custom_data_sheet_column` child table for column definitions (Parameter/Abbr), finds Tasks flagged `custom_is_level_task=1`, groups by parent task subject into matrix rows, and returns `{columns, rows}` where each row's `values[task.subject] = task.custom_average_level`. Backs the "Add Column" button which renders an editable HTML grid (`render_level_matrix` in JS).
  9. `calculate_level_matrix(project, matrix)` — given the `{columns, rows}` matrix (with user-edited cell values) plus the Project's `custom_data_sheet_column` (Parameter↔Abbr map) and `custom_data_sheet_formulas` (Parameter→Formula strings using abbreviations), iteratively substitutes resolved abbreviation values into pending formulas and evaluates them with Python `eval` (sandboxed via `{"__builtins__": {}}`) until all formula-driven parameters resolve or no further progress is possible; returns the matrix with computed values filled in. Backs the "Calculate" button.
  10. `download_steel_template(rows)` — builds and streams an `.xlsx` template (one row per posted steel-detail row, full task-hierarchy columns + blank editable measurement columns) for offline bulk-editing of steel reinforcement data.
  11. `import_steel_template(docname, file_url)` — reads an uploaded, filled-in steel template workbook, matches each Excel row back to an existing `ra_steel_details` child row by a composite key (stage/task/task_levelN identity, via `_row_key`), and overwrites the row's editable measurement fields (dims, reinforcement diameters, remark) with the imported values; saves the doc and reports counts of updated vs. unmatched rows. Backs "Import Data" button.
  - Non-whitelisted helpers: `get_previous_stage_totals(project, current_name)` (fetches previous submitted RA Billing's per-stage cumulative totals), `_safe_sheet_name`, `build_summary_sheet`, `_get_row_reinforcement_weight`, `_get_deepest_task_id`, `_row_key`.
- **Client Script** (`ra_billing.js`, key behaviors):
  - `setup`: restricts `stage`/`task` Link queries in `ra_billing_details` to Tasks flagged `custom_is_stage`/`custom_is_task` within the current project.
  - `with_tax` change: toggles `tax_details` required, clears stale `tax_amount`s when unchecked or recalculates all tax rows when re-checked, then recalculates `final_grand_total`.
  - `get_details` / `get_details_` button handlers: call `get_project_tasks` / `get_project_steel_tasks`, clear and repopulate `ra_billing_details` / `ra_steel_details`, dynamically show/hide `task_levelN` grid columns based on the deepest level actually used, and recompute `grand_total`.
  - `download_template`: builds and submits a hidden HTML form POST (with CSRF token) to `download_steel_template` to force a file download.
  - `import_data`: calls `import_steel_template` and reloads the doc, surfacing unmatched-row warnings.
  - `refresh`: adds "Export RA" button (opens `export_ra_excel` in a new tab); if submitted, adds a "Sales Invoice" button that prompts for an Item then opens the mapped-doc dialog for `create_sales_invoice`; if `level_data_json` exists, re-renders the saved Level Matrix HTML grid via `render_level_matrix`.
  - `get_levels` / `add_column` / `calculate` button handlers: call `get_level_sheet_details` / `get_level_matrix` / `calculate_level_matrix` respectively, the last one first gathering the on-screen matrix HTML back into JSON via `gather_level_matrix`.
  - `render_level_matrix` / `gather_level_matrix`: build/read a hand-rolled HTML `<table>` grid (not a standard Frappe grid) with per-cell text inputs, persisting its state into the hidden `level_data_json` Code field so it survives reload.
  - `RA Billing Details` child events: `no1`/`no2`/`length`/`width`/`height` change → `calculate_quantity` (product of all populated dimension fields, else 0) → recomputes `amount` and `grand_total`; `rate` change recomputes `amount`/`grand_total` and calls server-side `validate_task_rates`; `quantity` change recomputes `amount`/`grand_total` directly.
  - `RA Steel Details` child events: `no_of_fdn`/`no_of_bar`/`cutting_length` → `calculate_steel_length` (product) → `calculate_steel_weight` (`total_length × weight_of_bar`); `weight_of_bar`/`total_length` also directly trigger `calculate_steel_weight`.
  - `RA Billing Tax Details` child events: `tax_rate`/`tax_category` change and row add → `calculate_row_tax` (`grand_total × tax_rate / 100`, rounded to field precision) then `calculate_final_grand_total`; row remove → `calculate_final_grand_total`.
  - `calculate_final_grand_total(frm)`: `final_grand_total = grand_total + sum(tax_details.tax_amount)` when `with_tax` is set.
- **Business Rules**:
  - **What the RA billing engine computes**: it is a progress/running-account billing sheet driven by a project's Task hierarchy (stage → task → up to 10 sub-levels). Each Measurement row's `quantity` is either entered directly, computed as `no1 × no2 × length × width × height` (standard civil measurement formula), or — for steel/reinforcement — derived from `ra_steel_details` bar counts and lengths converted to weight (`diameter²/162` kg/m formula) and then to Metric Tonnes. `amount = quantity × rate`, with a single-rate-per-task rule enforced server-side. Line items roll up into a per-stage Abstract (this bill's quantity/amount plus cumulative previous + total, carried from the prior submitted RA Billing for the same project) and into the document's `grand_total`; if `with_tax` is enabled, per-tax-category rows are applied against `grand_total` to produce `final_grand_total`. On submit, billed quantities are pushed back onto the underlying Tasks (`custom_billed_quantity`) to prevent double-billing, and the RA Billing can spawn a Sales Invoice to the project's Customer for the billed amount. It also supports an entirely separate "Level" survey/matrix sub-feature (level sheet extraction + a spreadsheet-like formula-evaluated matrix) and full Excel export/import round-trips for both the steel take-off and the level matrix.
  - The RA Billing doctype spans multiple modules for its child tables: `RA Billing Steel Details` lives in `site_diary`, while `RA Bill Level Sheet Details` and `RA Billing Tax Details` live in the separate `ra_billing` module — this doctype is the cross-module orchestration point.

---

## Cross-Doctype Event Integration

Defined in `hooks.py` (`doc_events`, lines ~284-302), all four handlers live in `subcontractor_management/doctype/contractor_billing/contractor_billing.py`:

```
"Payment Entry": {
    "on_submit": "...contractor_billing.contractor_billing.on_payment_entry_submit",
    "on_cancel": "...contractor_billing.contractor_billing.on_payment_entry_cancel"
},
"Purchase Invoice": {
    "on_update": "...contractor_billing.contractor_billing.on_purchase_invoice_update"
},
"Journal Entry": {
    "on_update": "...contractor_billing.contractor_billing.on_journal_entry_update"
}
```

- **`on_payment_entry_submit(doc, method)`** and **`on_payment_entry_cancel(doc, method)`** — both simply call `update_payment_status(doc)`. Fired whenever any Payment Entry in the system is submitted or cancelled.
- **`update_payment_status(payment_entry)`**: determines which Contractor Billing document(s) the Payment Entry relates to:
  - directly, if the Payment Entry itself carries `custom_doc_link_doctype == "Contractor Billing"` and `custom_doc_link`;
  - indirectly, by scanning the Payment Entry's `references` child table for rows referencing a Purchase Invoice or Journal Entry, then looking up *that* document's own `custom_doc_link_doctype`/`custom_doc_link` to see if it points back to a Contractor Billing.
  For every distinct Contractor Billing name found, calls `sync_contractor_billing_payment_status(cb_name)`.
- **`on_purchase_invoice_update(doc, method)`** — fired on every Purchase Invoice save/update. If the PI's `custom_doc_link_doctype == "Contractor Billing"`, calls `sync_contractor_billing_payment_status(doc.custom_doc_link)`.
- **`on_journal_entry_update(doc, method)`** — fired on every Journal Entry save/update. If the JE's `custom_doc_link_doctype == "Contractor Billing"`, calls `sync_contractor_billing_payment_status(doc.custom_doc_link)`.
- **`sync_contractor_billing_payment_status(cb_name)`** — the shared reconciliation routine, loads the Contractor Billing and recomputes its `paid_amount`/`outstanding_amount`/paid-status:
  - If a Purchase Invoice is linked to this Contractor Billing (`custom_doc_link_doctype`/`custom_doc_link` on the PI): sums `Payment Entry Reference.allocated_amount` for all *submitted* Payment Entries referencing that PI, caps at `grand_total`, computes `outstanding_amount = grand_total - paid_amount`, and marks `is_paid=1` if outstanding ≤ 0.005.
  - Otherwise (no linked PI — direct JE/PE flow): sums (a) directly-linked submitted Payment Entries (`custom_doc_link_doctype/custom_doc_link` == this billing) by `paid_amount`, and (b) Payment Entry References pointing at a linked Journal Entry (by `allocated_amount`), de-duplicated by Payment Entry name into a `payment_map` to avoid double-counting; caps the sum at `grand_total`; computes `outstanding_amount`; marks `is_paid=1` if `paid_amount >= grand_total - 0.005`.
  - Writes `paid_amount` and `outstanding_amount` back onto the Contractor Billing via `db_set` (no full save/validate cycle), then calls `billing.update_paid_status_in_child(is_paid)` to propagate the paid flag onto the originating Manpower/Equipment/Task Progress usage rows referenced by `contractor_billing_details`.

**End-to-end flow this wiring enables**: `Contractor Billing.on_submit()` can auto-create a Journal Entry and/or Purchase Invoice (tagged back to the Contractor Billing via `custom_doc_link_doctype`/`custom_doc_link`), and/or the user can manually create a Payment Entry via the whitelisted `create_payment_entry` mapped-doc method (also tagged the same way). Whenever any of these three downstream documents (Payment Entry, Purchase Invoice, Journal Entry) is submitted, cancelled, or updated, the hook handlers in `contractor_billing.py` walk the `custom_doc_link*` breadcrumb trail back to the originating Contractor Billing and keep its `paid_amount`/`outstanding_amount` fields — and the underlying billed usage records' `paid` flag — synchronized, without requiring the user to reopen and re-save the Contractor Billing itself.

---

## Module: RA Billing

> **Naming collision note**: The "RA Billing" *module* documented here (path `ra_billing/doctype/`) does **not** contain a DocType literally named "RA Billing". That name belongs to a different, separate DocType at `subcontractor_management/doctype/ra_billing/ra_billing.json` (`module: "Subcontractor Management"`, submittable, `autoname: naming_series:`). This module's doctypes (`Bulk RA Billing`, `Bulk RA Billing Projects Details`, etc.) reference and consume that Subcontractor-Management `RA Billing` doctype as a Link target (e.g. `Bulk RA Billing Projects Details.ra_bill` -> options `"RA Billing"`) and read its fields directly in Python (`ra_abstract_details`, `ra_steel_details`, `ra_billing_details`, `level_details`, `level_data_json`, `project`, `grand_total`). So there are two distinct "RA Billing" concepts in this codebase:
> 1. **`RA Billing` (Subcontractor Management module)** — the actual per-project running-account bill document (out of this research's scope, only inspected indirectly via `bulk_ra_billing.py`).
> 2. **"RA Billing" module (this section)** — a separate Frappe *module* containing bulk-export/aggregation tooling (`Bulk RA Billing`) and standalone level/task measurement sheets (`Task Level Sheet`) that operate on top of the Subcontractor Management `RA Billing` documents.

### Bulk RA Billing

- **Source**: `ra_billing/doctype/bulk_ra_billing/bulk_ra_billing.json`, `.py`, `.js`, `test_bulk_ra_billing.py`
- **Description**: Not found in repository (no `description` key in JSON)
- **Type**: Submittable Document (is_submittable: 1)
- **Naming**: `naming_series:` — series options `\nBRB-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series_section | Naming Series | Section Break | | collapsible |
| naming_series | Naming Series | Select | | options `\nBRB-` |
| section_break_kwru | | Section Break | | |
| amended_from | Amended From | Link (Bulk RA Billing) | | no_copy, read_only, print_hide |
| site | Site | Link (Site) | reqd | in_list_view |
| get_projects | Get Projects | Button | | triggers `get_projects_for_site` via JS |
| project_details | Project Details | Table (Bulk RA Billing Projects Details) | | |
| total_amount | Total Amount | Currency | | computed client-side from row amounts |
| with_tax | With Tax | Check | | default 0; toggles tax_details reqd |
| tax_details_column | Tax Details | Column Break | | |
| tax_details | Tax Details | Table (Bulk RA Bill Tax Details) | | depends_on `eval:doc.with_tax==1` |
| section_break_fjgi | | Section Break | | |
| grand_total | Grand Total | Currency | | total_amount + sum(tax_amount) |
| get_ra_bills | Get RA Bills | Button | | triggers Excel export (client-side form POST) |

- **Child Tables**: `project_details` -> Bulk RA Billing Projects Details; `tax_details` -> Bulk RA Bill Tax Details
- **Link Fields**: `amended_from` -> Bulk RA Billing; `site` -> Site
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes |

- **Validation / Server Logic**: No `validate`/`on_submit`/etc. defined in Python — `BulkRABilling(Document): pass`. All calculation and validation logic (total_amount, tax row amounts, grand_total, mandatory tax rows when `with_tax`) lives entirely in `bulk_ra_billing.js` (`validate(frm)` client hook), not enforced server-side.
- **Whitelisted APIs** (2, both `@frappe.whitelist()` in `bulk_ra_billing.py`):
  - `get_projects_for_site(site)` — returns `frappe.get_all("Project", filters={"custom_site": site}, fields=["name","project_name"])`; returns `[]` if no site given. Used by the "Get Projects" button to populate `project_details`.
  - `export_bulk_ra_excel(bulk_ra_billing)` — the core export routine. Loads the `Bulk RA Billing` doc, throws if `project_details` is empty. Builds an `openpyxl` workbook: for each project row with an `ra_bill` set, calls the internal helper `build_ra_sheets_into_workbook(wb, ra_billing_name, sheet_prefix, used_sheet_names)` (not itself whitelisted) which reads the referenced **Subcontractor Management `RA Billing`** document and its child tables (`ra_abstract_details`, `ra_billing_details`, `ra_steel_details`, `level_details`, `level_data_json`) and Task descriptions, and emits per-project **Abstract**, **Measurement**, **Steel**, **Level Details**, and (if `level_data_json` present) **Level Data** sheets into the workbook, plus a workbook-wide **Summary** sheet (with optional tax rows if `with_tax`). Streams the resulting `.xlsx` back via `frappe.response['filecontent']` (binary) named `Bulk_RA_Billing_<name>.xlsx`. Triggered from the client by constructing and submitting an HTML form POST (not `frappe.call`) to `/api/method/...export_bulk_ra_excel` so the browser downloads the file.
- **Business Rules / Calculations** (mostly client-side in `bulk_ra_billing.js`, cross-checked against server helper logic in `bulk_ra_billing.py`):
  - `total_amount` = sum of `project_details[].amount` (each row's amount is fetched from `ra_bill.grand_total`).
  - Per tax row `tax_amount` = `total_amount * tax_rate / 100` (rounded to field precision), recalculated on `tax_rate`/`tax_category` change or row add/remove.
  - `grand_total` = `total_amount` + sum(`tax_details[].tax_amount`) when `with_tax` is checked, else just `total_amount`.
  - Client `validate()` throws if `with_tax` is checked but no tax rows exist, or if any tax row lacks `tax_category` or has non-positive `tax_rate`.
  - Steel weight calc (server, in `build_ra_sheets_into_workbook`): bar weight per meter for standard diameters `[8,10,12,16,20,25,28,32]` mm computed as `math.trunc((d**2)/162.0*1000)/1000` kg/m (standard steel reinforcement formula d²/162), multiplied by reinforcement length per row and summed per stage/task; stage totals also expressed in Metric Tonnes (`/1000`).
  - Abstract sheet totals: `total_qty = previous_bill_quantity + billed_quantity` (if `total_bill_quantity` not already set) and similarly for amounts; grand totals accumulate `this_amt` (current bill) and `total_amt` (cumulative) across all abstract rows.
  - Kg-UOM billing quantities are overridden in the Measurement sheet display by matching computed steel weights (`steel_subtask_weights` keyed by task + deepest hierarchy level) rather than the raw billing quantity, when UOM is "kg"/"kilogram".
- **Client Script**: `bulk_ra_billing.js` —
  - `setup`: filters `ra_bill` link query in `project_details` grid to the row's own `project`.
  - `onload`: recalculates `total_amount`.
  - `with_tax` change: toggles `tax_details` as required and recalculates grand_total.
  - `get_projects` button: calls `get_projects_for_site`, clears and repopulates `project_details` child table.
  - `get_ra_bills` button: validates every project row has an `ra_bill` selected, doc is saved (not dirty), and (if `with_tax`) every tax row is valid; then builds and submits a raw HTML `<form>` POST to the `export_bulk_ra_excel` endpoint (file download, bypassing `frappe.call`).
  - Row-level handlers on `Bulk RA Billing Projects Details` (`project`, `amount`, `ra_bill`, remove) recompute `total_amount`; changing `project` clears the selected `ra_bill`.
  - Row-level handlers on `Bulk RA Bill Tax Details` recompute row `tax_amount` and `grand_total` on tax_rate/tax_category change, row add, or row remove.
  - `validate(frm)`: enforces `with_tax` => at least one tax row, each row with a tax_category and positive tax_rate (throws otherwise).

### Bulk RA Billing Projects Details

- **Source**: `ra_billing/doctype/bulk_ra_billing_projects_details/bulk_ra_billing_projects_details.json`, `.py`, `.js`, `test_bulk_ra_billing_projects_details.py`
- **Description**: Not found in repository
- **Type**: Child Table (istable: 1)
- **Naming**: N/A (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| section_break_svze | | Section Break | | |
| project | Project | Link (Project) | | in_list_view |
| ra_bill | RA Bill | Link (RA Billing — Subcontractor Management doctype) | | in_list_view |
| column_break_egyc | | Column Break | | |
| project_name | Project Name | Data | | in_list_view |
| column_break_yvyj | | Column Break | | |
| column_break_pfus | | Column Break | | |
| amount | Amount | Currency | | `fetch_from: ra_bill.grand_total`; in_list_view |

- **Child Tables**: None (this is itself a child row)
- **Link Fields**: `project` -> Project; `ra_bill` -> RA Billing (Subcontractor Management module)
- **Permissions**: None defined (child table; permissions inherited from parent `Bulk RA Billing`)
- **Validation / Server Logic**: `BulkRABillingProjectsDetails(Document): pass` — no server logic.
- **Whitelisted APIs**: None.
- **Client Script**: `.js` file present but fully commented out (`Not found in repository` for actual behavior). Row-level behavior for this child doctype is instead implemented inside `bulk_ra_billing.js` (see parent doctype above: `project`, `amount`, `ra_bill`, remove handlers).
- **Business Rules**: `amount` auto-fetches from the linked RA Billing document's `grand_total` field via `fetch_from`.

### Level Task Details

- **Source**: `ra_billing/doctype/level_task_details/level_task_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (istable: 1)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| design | Design | Float | | in_list_view |
| bs | B.S. | Float | | in_list_view |
| is | I.S | Float | | in_list_view |
| fs | F.S. | Float | | in_list_view |
| hi | H.I | Float | | in_list_view |
| rl | R.L. | Float | | in_list_view |
| remark | Remark | Data | | in_list_view |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: None defined
- **Validation / Server Logic**: `LevelTaskDetails(Document): pass` — no logic.
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository (no `.js` file exists for this doctype).
- **Business Rules**: Surveying/leveling fields (Design, Back Sight, Instrument Sight, Fore Sight, Height of Instrument, Reduced Level) — same shape as `RA Bill Level Sheet Details` and `Task Level Sheet Details`, presumably a reusable/legacy leveling row structure. No computed logic found in this doctype's own files; the H.I./R.L. calculation logic instead lives in `Task Level Sheet Details`'s parent form script (`task_level_sheet.js`: `hi = design + bs`, `rl = hi - is`).

### Project Data Sheet Column Details

- **Source**: `ra_billing/doctype/project_data_sheet_column_details/project_data_sheet_column_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (istable: 1)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| parameter | Parameter | Data | | in_list_view |
| abbr | Abbr | Data | | in_list_view |
| column_break_bgbd | | Column Break | | |
| level_task | Level Task | Check | | default 0; in_list_view |
| column_break_jqrj | | Column Break | | |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: None defined
- **Validation / Server Logic**: `ProjectDataSheetColumnDetails(Document): pass` — no logic.
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository.
- **Business Rules**: Appears to define configurable column/parameter metadata (with abbreviation and a "is this a level task" flag) for a project data sheet — likely paired with `Project Formulas Details`, though no direct code linkage (parent doctype, controllers, or reports referencing it) was found within this module's files.

### Project Formulas Details

- **Source**: `ra_billing/doctype/project_formulas_details/project_formulas_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (istable: 1)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| parameter | Parameter | Data | | in_list_view |
| formula | Formula | Code | | in_list_view; stores a formula expression as code text |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: None defined
- **Validation / Server Logic**: `ProjectFormulasDetails(Document): pass` — no logic.
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository.
- **Business Rules**: Stores named formula expressions (raw code/text) per parameter — appears to be a configuration table for a dynamic-formula feature (e.g. project data sheet computed columns), but no controller/report in this module evaluates the `formula` field — the actual formula evaluation code was not found within the RA Billing or Progress Measurement & Billing doctype folders in scope.

### RA Bill Level Sheet Details

- **Source**: `ra_billing/doctype/ra_bill_level_sheet_details/ra_bill_level_sheet_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (istable: 1)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| design | Design | Float | | in_list_view |
| bs | B.S. | Float | | in_list_view |
| is | I.S | Float | | in_list_view |
| fs | F.S. | Float | | in_list_view |
| hi | H.I | Float | | in_list_view |
| rl | R.L. | Float | | in_list_view |
| remark | Remark | Data | | in_list_view |
| average_rl | Average R.L. | Float | | in_list_view |
| task | Task | Link (Task) | | in_list_view |
| task_subject | Task Subject | Data | | `fetch_from: task.subject` |

- **Child Tables**: None
- **Link Fields**: `task` -> Task
- **Permissions**: None defined
- **Validation / Server Logic**: `RABillLevelSheetDetails(Document): pass` — no logic.
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository. (Note: `bulk_ra_billing.py`'s `build_ra_sheets_into_workbook` reads a structurally similar `level_details` child table off the Subcontractor Management `RA Billing` doctype to build the "Level Details" export sheet — rows are classified as header/average/data by inspecting `task`/`remark` content — but that consuming child table is a different doctype than this one, which lives in scope here but was not observed to be referenced by any code inspected.)
- **Business Rules**: Same leveling fields as `Level Task Details`/`Task Level Sheet Details` plus a per-task `average_rl` (average Reduced Level) — mirrors the export logic pattern seen in `build_ra_sheets_into_workbook`'s Level Details sheet (rows tagged "header" when `task` is set, "average" when remark contains "average", else plain "data" rows for Design/B.S./I.S./F.S./H.I./R.L. entry).

### RA Billing Tax Details

- **Source**: `ra_billing/doctype/ra_billing_tax_details/ra_billing_tax_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (istable: 1)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| tax_category | Tax Category | Link (Tax Category) | | in_list_view |
| column_break_sgqy | | Column Break | | |
| tax_rate | Tax Rate | Float | | in_list_view |
| column_break_awua | | Column Break | | |
| tax_amount | Tax Amount | Currency | | in_list_view |

- **Child Tables**: None
- **Link Fields**: `tax_category` -> Tax Category
- **Permissions**: None defined
- **Validation / Server Logic**: `RABillingTaxDetails(Document): pass` — no logic.
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository.
- **Business Rules**: Structurally identical to `Bulk RA Bill Tax Details` (tax_category/tax_rate/tax_amount) — appears to be the tax-line child table intended for the Subcontractor Management `RA Billing` doctype itself (parallel to how `Bulk RA Bill Tax Details` serves `Bulk RA Billing`), though no controller in this module's scope references it directly.

### Task Level Sheet

- **Source**: `ra_billing/doctype/task_level_sheet/task_level_sheet.json`, `.py`, `.js`, `test_task_level_sheet.py`
- **Description**: Not found in repository
- **Type**: Submittable Document (is_submittable: 1)
- **Naming**: `naming_series:` — options `\nTLS-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series_section | Naming Series | Section Break | | collapsible |
| naming_series | Naming Series | Select | | options `\nTLS-` |
| section_break_n3ve | | Section Break | | |
| project | Project | Link (Project) | | |
| amended_from | Amended From | Link (Task Level Sheet) | | no_copy, read_only, print_hide |
| column_break_ospr | | Column Break | | |
| site | Site | Link (Site) | | `fetch_from: project.custom_site` |
| column_break_beot | | Column Break | | |
| date | Date | Date | | default "Today" |
| stage | Stage | Link (Task) | | `link_filters`: Task.custom_is_stage = 1 |
| stage_subject | Stage Subject | Data | | `fetch_from: stage.subject` |
| task | Task | Link (Task) | | |
| task_subject | Task Subject | Data | | `fetch_from: task.subject` |
| section_break_yret | | Section Break | | |
| task_level1 .. task_level10 | Task Level1..10 | Link (Task) x10 | | chained hierarchy fields |
| task_level1_subject .. task_level10_subject | Task Level1..10 Subject | Data x10 | | `fetch_from` respective `.subject` (task_level9's fetch field is named `task_level9_subject_copy`) |
| level_sheet_details | Level Sheet Details | Table (Task Level Sheet Details) | | |
| average | Average | Float | | computed average of `rl` values across rows |

- **Child Tables**: `level_sheet_details` -> Task Level Sheet Details
- **Link Fields**: `project` -> Project; `amended_from` -> Task Level Sheet; `site` -> Site; `stage` -> Task (filtered to `custom_is_stage=1`); `task`, `task_level1`..`task_level10` -> Task
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes |

(also has `cancel: 1`, `email`, `export`, `print`, `report`, `share` for System Manager)

- **Validation / Server Logic** (`task_level_sheet.py`, class `TaskLevelSheet`):
  - `before_submit()` calls `update_task_level_sheet()`.
  - `update_task_level_sheet()`: walks the hierarchy from `task_level10` down to `task` (deepest-first) to find the deepest non-empty task reference; throws `"Task not found."` if none of `task_level1..10`/`task` is set. Loads that `Task` document, sets `task_doc.custom_average_level = self.average`, clears and rebuilds `task_doc.custom_level_sheet_details` from this document's `level_sheet_details` rows (copying `design`, `bs`, `is`, `fs`, `hi`, `rl`, `remark`), then saves the Task with `ignore_permissions=True`. Shows an alert msgprint confirming the Task was updated. **Note**: no server-side `validate()` method exists — mandatory-field checks (project/stage/task/at least one detail row) are only enforced in the client script.
- **Whitelisted APIs** (3, matching the task brief's note of 3 whitelisted methods):
  - `get_depends_on_tasks(doctype, txt, searchfield, start, page_len, filters)` — decorated with `@frappe.validate_and_sanitize_search_inputs`; a custom Link-field query source. Requires `filters["task"]`; loads that Task doc and returns `[task, subject]` pairs from its `depends_on` child table, filtered by search text `txt` against the dependency task name (case-insensitive substring). Used to populate hierarchy-level Link queries (`task`, `task_level1`..`task_level10`) so a given level can only pick from tasks the previous level's task depends on.
  - `has_dependencies(task)` — returns `len(doc.depends_on) > 0` for the given Task, i.e. whether the task has any dependency-tasks defined. Used client-side to decide whether to reveal the next hierarchy level field.
  - `get_stage_tasks(doctype, txt, searchfield, start, page_len, filters)` — decorated with `@frappe.validate_and_sanitize_search_inputs`; raw SQL query source (`frappe.db.sql`) selecting `Task` rows where `project = filters.project`, `custom_is_stage = 1`, `is_group = 1`, `docstatus < 2`, and search text matches `searchfield` or `subject` (LIKE), paginated by `start`/`page_len`. Note: this function is defined in `task_level_sheet.py` but is **not currently wired up** to the `stage` field's `set_query` in `task_level_sheet.js` (the JS instead filters `stage` inline via a `filters` dict: `project`, `custom_is_stage: 1`, `is_group: 1`, without calling this whitelisted query method).
- **Client Script**: `task_level_sheet.js` —
  - Defines a fixed `LEVEL_CHAIN` (`stage` -> `task` -> `task_level1`...`task_level10`) with a `SUBJECT_MAP` (each level's fetched-subject field) and `SOURCE_MAP` (each level's "parent" field used to scope dependency queries).
  - `setup`: wires `stage` Link query to filter Tasks by `project`, `custom_is_stage: 1`, `is_group: 1`; wires each hierarchy level's Link query to `get_depends_on_tasks`, scoped by the previous level's task (`SOURCE_MAP`), returning an impossible filter if the parent isn't set yet.
  - `onload`: defaults `date` to today for new docs.
  - `refresh`: calls `refresh_task_levels` and `recalculate_average`.
  - `project` change: clears `site` then re-fetches it from `Project.custom_site`; clears the whole hierarchy chain (`clear_from_level(frm, 0)`).
  - Each hierarchy field's change handler (dynamically bound via `LEVEL_CHAIN.forEach`): clears deeper levels, fetches the new task's `subject` into the mapped subject field, and calls `refresh_task_levels`.
  - `refresh_task_levels` (defined **twice** in the file — the second definition overrides the first, a likely leftover/duplication bug): determines the deepest populated hierarchy level (minimum visible level 3), calls `has_dependencies` on the deepest task, and if it has dependencies, extends visibility one level deeper; otherwise checks (second/active definition) whether the deepest task is flagged `custom_is_level_task` on the Task doctype — if not, shows a warning message, clears that level's value, and hides `level_sheet_details`; if it is a level task, reveals the `level_sheet_details` grid.
  - `validate(frm)`: client-side throws if `project`, `stage`, `task`, or at least one `level_sheet_details` row is missing; recalculates `average`.
  - Row handlers on `Task Level Sheet Details`: `design`/`bs` change recompute `hi = design + bs` then `rl = hi - is`; `is`/`hi` change recompute `rl`; any of `design`, `bs`, `is`, `rl` change (and row add/remove) recompute the `average` (mean of all rows' `rl`, rounded to 3 decimals); on adding a new row, its `hi` is pre-filled from the previous row's `hi` (carries the instrument height forward, matching real leveling-survey conventions).
- **Business Rules**:
  - Leveling formula: `H.I. = Design + B.S.` (Height of Instrument), `R.L. = H.I. − I.S.` (Reduced Level) — classic surveying rise-and-fall/HI method computed per row.
  - `average` = mean of all `level_sheet_details[].rl` values (rounded to 3 decimals).
  - On submit, this Task Level Sheet pushes `average` -> `Task.custom_average_level` and pushes the whole `level_sheet_details` table -> `Task.custom_level_sheet_details` (both custom fields presumably added to the standard `Task` doctype elsewhere in the app, outside this module's scope).
  - Hierarchy depth is dynamic: only 3 levels (`stage`, `task`, `task_level1`) shown by default, extended one level at a time based on whether the current deepest task has further `depends_on` tasks, and gated by a `custom_is_level_task` flag on Task before the `level_sheet_details` grid becomes usable.

### Task Level Sheet Details

- **Source**: `ra_billing/doctype/task_level_sheet_details/task_level_sheet_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (istable: 1)
- **Naming**: N/A
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| design | Design | Float | | in_list_view |
| bs | B.S. | Float | | in_list_view |
| is | I.S | Float | | in_list_view |
| fs | F.S. | Float | | in_list_view |
| hi | H.I | Float | | in_list_view |
| rl | R.L. | Float | | in_list_view |
| remark | Remark | Data | | in_list_view |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: None defined
- **Validation / Server Logic**: `TaskLevelSheetDetails(Document): pass` — no logic.
- **Whitelisted APIs**: None.
- **Client Script**: Row-level logic is defined on the **parent** form's script (`task_level_sheet.js`, `frappe.ui.form.on("Task Level Sheet Details", {...})`) — see `hi`/`rl`/`average` calculation bullets under Task Level Sheet above.
- **Business Rules**: See Task Level Sheet — this is the child row structure holding raw leveling readings (Design, Back Sight, Intermediate Sight, Fore Sight, Height of Instrument, Reduced Level) that feed the parent's average-RL computation and get copied onto `Task.custom_level_sheet_details` on submit.

---

## Module: Progress Measurement & Billing

### Cert Deduction

- **Source**: `progress_measurement_&_billing/doctype/cert_deduction/cert_deduction.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (istable: 1)
- **Naming**: `autoincrement`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| section_identity | Details | Section Break | | |
| deduction_type | Deduction Type | Data | reqd | in_list_view |
| column_break_rauu | | Column Break | | |
| amount | Amount | Currency | reqd | in_list_view |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: None defined (inherits from parent `Progress Certificate`)
- **Track Changes**: 1
- **Validation / Server Logic**: `CertDeduction(Document): pass` — no logic.
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository.
- **Business Rules**: Free-text deduction type + amount, used as the `deductions` child table on `Progress Certificate` ("Additional Deductions" section) to record certifier-applied deductions beyond the standard claim deductions.

### Claim Included VO

- **Source**: `progress_measurement_&_billing/doctype/claim_included_vo/claim_included_vo.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (istable: 1)
- **Naming**: `autoincrement`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| section_identity | | Section Break | | |
| vo_reference | Vo Reference | Data | reqd | in_list_view; **unique** |
| amount | Amount | Currency | | in_list_view |
| column_break_yejx | | Column Break | | |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: None defined
- **Track Changes**: 1
- **Validation / Server Logic**: `ClaimIncludedVO(Document): pass` — no logic.
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository.
- **Business Rules**: References a Variation Order (VO, by free-text reference string, not a Link) and its amount — used as `included_vos` on `Progress Claim` to itemize which variation orders' values are folded into that claim's `vo_amount`.

### Disputed BOQ Item

- **Source**: `progress_measurement_&_billing/doctype/disputed_boq_item/disputed_boq_item.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (istable: 1)
- **Naming**: `autoincrement`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| section_identity | Details | Section Break | | |
| item | Item | Data | reqd | in_list_view |
| col_break_ident1 | | Column Break | | |
| reason | Reason | Text | | in_list_view; max_height 150px |
| amount | Amount | Currency | reqd | in_list_view |

- **Child Tables**: None
- **Link Fields**: None
- **Permissions**: None defined
- **Track Changes**: 1
- **Validation / Server Logic**: `DisputedBOQItem(Document): pass` — no logic.
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository.
- **Business Rules**: Records BOQ (Bill of Quantities) line items disputed during certification (item, disputed amount, and a free-text reason) — used as `disputed_items` on `Progress Certificate`.

### Earned Value Record

- **Source**: `progress_measurement_&_billing/doctype/earned_value_record/earned_value_record.json`, `.py`, `.js`, `test_earned_value_record.py`
- **Description**: Not found in repository
- **Type**: Standalone Document (not submittable — no `is_submittable` key; not a child table)
- **Naming**: `naming_series:` — options `EVR-.YYYY.MM.-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| section_identity | Details | Section Break | | |
| project | Project | Link (Project) | reqd | in_list_view |
| evr_no | Evr No | Data | | in_list_view; **unique** |
| bac | Budget At Completion | Currency | | default 0; in_list_view |
| pv | Planned Value | Currency | | default 0 |
| ev | Earned Value | Currency | | default 0 |
| col_break_ident1 | | Column Break | | |
| ac | Actual Cost | Currency | | default 0 |
| sv | Schedule Variance | Currency | | default 0 |
| cv | Cost Variance | Currency | | default 0 |
| spi | SPI | Float | | default 0 (Schedule Performance Index) |
| cpi | CPI | Float | | default 0 (Cost Performance Index) |
| col_break_ident2 | | Column Break | | |
| eac | Estimate at Completion / EAC | Currency | | default 0 |
| etc | Estimate to Complete / ETC | Currency | | default 0 |
| percent_complete | Percent Complete | Percent | | default 0 |
| tcpi | TCPI | Float | | default 0 (To-Complete Performance Index) |
| snapshot_date | Snapshot Date | Date | reqd | default "Today"; in_list_view |
| naming_series | Series | Select | | options `EVR-.YYYY.MM.-` |
| column_break_jcni | | Column Break | | |

- **Child Tables**: None
- **Link Fields**: `project` -> Project
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | N/A (not submittable) |
| All | Yes | No | No | No | N/A |

(System Manager additionally has `email`, `export`, `print`, `report`, `share`; "All" role has `email`, `export`, `print`, `read`, `report`, `share` only.)

- **Track Changes**: 1
- **Validation / Server Logic**: `EarnedValueRecord(Document): pass` — **no server-side computation exists**. All of `bac`, `pv`, `ev`, `ac`, `sv`, `cv`, `spi`, `cpi`, `eac`, `etc`, `percent_complete`, `tcpi` are plain stored fields with `default: 0` and no formula/fetch/read_only enforcement found anywhere in this doctype's `.py` or `.js`. The `.js` file is fully commented out (empty stub).
- **Whitelisted APIs**: None found in `earned_value_record.py`.
- **Client Script**: Not found in repository (stub file only, no active logic).
- **Business Rules**: This doctype is a **manually-entered snapshot** of standard Earned Value Management (EVM) metrics per project per date (`snapshot_date`) — Budget at Completion, Planned Value, Earned Value, Actual Cost, Schedule/Cost Variance, SPI/CPI, EAC/ETC, percent complete, and TCPI. Despite the field labels implying the classic EVM formulas (SV = EV−PV, CV = EV−AC, SPI = EV/PV, CPI = EV/AC, EAC = BAC/CPI, ETC = EAC−AC, TCPI = (BAC−EV)/(BAC−AC)), **no code in this doctype computes these values** — they must be entered directly or computed/populated by code elsewhere in the app (not found within the RA Billing or Progress Measurement & Billing doctype folders in scope). Document this as data structure only, not an implemented formula engine.

### Progress Certificate

- **Source**: `progress_measurement_&_billing/doctype/progress_certificate/progress_certificate.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Submittable Document (is_submittable: 1)
- **Naming**: `naming_series:` — options `PCERT-.YYYY.-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| status | Status | Select | reqd | options `Draft\nIssued\nPaid`; in_list_view |
| section_identity | | Section Break | | |
| project | Project | Link (Project) | | |
| cert_no | Cert No | Data | | **unique** |
| col_break_ident1 | | Column Break | | |
| progress_claim | Progress Claim | Link (Progress Claim) | reqd | in_list_view |
| certified_by | Certified By | Data | reqd | |
| col_break_ident2 | | Column Break | | |
| cert_date | Cert Date | Date | reqd | default "Today"; in_list_view |
| payment_due_date | Payment Due Date | Date | | in_list_view |
| submitted_amount | Submitted Amount | Currency | | default 0 |
| certified_amount | Certified Amount | Currency | reqd | default 0 |
| net_certified | Net Certified | Currency | | default 0 |
| section_disputed_items | | Section Break | | |
| disputed_items | Disputed Items | Table (Disputed BOQ Item) | | |
| section_deductions | | Section Break | | |
| deductions | Additional Deductions | Table (Cert Deduction) | | |
| section_attachments | | Section Break | | |
| document | Certificate PDF | Attach | | |
| amended_from | Amended From | Link (Progress Certificate) | | no_copy, read_only, print_hide |
| naming_series | Series | Select | | options `PCERT-.YYYY.-` |

- **Child Tables**: `disputed_items` -> Disputed BOQ Item; `deductions` -> Cert Deduction
- **Link Fields**: `project` -> Project; `progress_claim` -> Progress Claim (reqd); `amended_from` -> Progress Certificate
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes (also amend, cancel) |
| All | Yes | No | No | No | No |

- **Track Changes**: 1
- **Validation / Server Logic**: `ProgressCertificate(Document): pass` — **no server-side logic at all**. No validate/on_submit/on_cancel hooks; `net_certified` is a plain stored field with no computed formula found in code.
- **Whitelisted APIs**: None found in `progress_certificate.py`.
- **Client Script**: Not found in repository — `progress_certificate.js` is a fully commented-out stub; no refresh/onload/custom buttons/fetch_from logic implemented.
- **Business Rules**: Represents the certifier's sign-off on a `Progress Claim` — captures `submitted_amount` (what the contractor claimed) vs `certified_amount` (what the certifier approved), plus itemized `disputed_items` (Disputed BOQ Item rows, each with its own disputed amount + reason) and `deductions` (Cert Deduction rows). `net_certified` is presumably meant to equal `certified_amount` minus the sum of `deductions[].amount` (and/or minus disputed amounts), but **no formula implementing this was found** in either the Python controller or the client script — this must be either manually entered or computed by code outside this module's scope (e.g. a server script, report, or hook registered elsewhere in the app).

### Progress Claim

- **Source**: `progress_measurement_&_billing/doctype/progress_claim/progress_claim.json`, `.py`, `.js`, `test_progress_claim.py`
- **Description**: Not found in repository
- **Type**: Submittable Document (is_submittable: 1)
- **Naming**: `naming_series:` — options `PC-.YYYY.-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| status | Status | Select | reqd | options `Draft\nSubmitted\nUnder Review\nCertified\nDisputed\nFinal`; in_list_view |
| section_identity | | Section Break | | |
| project | Project | Link (Project) | reqd | in_list_view |
| claim_no | Claim No | Data | | **unique** |
| ra_bill_no | Ra Bill No | Int | | default 0 |
| col_break_ident1 | | Column Break | | |
| contract | Contract | Data | | (plain text, not a Link) |
| advance_recovery | Advance Recovery | Currency | | default 0 |
| retention | Retention Deduction | Currency | | default 0 |
| col_break_ident2 | | Column Break | | |
| other_deduction | Other Deduction | Currency | | default 0 |
| sales_invoice | Sales Invoice | Link (Sales Invoice) | | |
| claim_date | Claim Date | Date | reqd | default "Today"; in_list_view |
| submission_date | Submission Date | Date | | in_list_view |
| certification_date | Certification Date | Date | | |
| section_financial | | Section Break | | |
| gross_amount | Gross Amount | Currency | | default 0 |
| vo_amount | Vo Amount | Currency | | default 0 |
| col_break_fin1 | | Column Break | | |
| total_gross | Total Gross | Currency | | default 0 |
| net_claim | Net Claim | Currency | | default 0 |
| col_break_fin2 | | Column Break | | |
| tax_amount | Tax / GST | Currency | | default 0 |
| invoice_amount | Invoice Amount | Currency | | default 0 |
| section_included_vos | | Section Break | | |
| included_vos | Included Vos | Table (Claim Included VO) | | |
| section_periods | | Section Break | | |
| period_from | Period From | Date | reqd | |
| period_to | Period To | Date | reqd | |
| amended_from | Amended From | Link (Progress Claim) | | no_copy, read_only, print_hide |
| progress_claim_item | Claim Item | Table (Progress Claim Item) | | |
| naming_series | Series | Select | | options `PC-.YYYY.-` |
| column_break_uipe / column_break_xpob | | Column Break | | |

- **Child Tables**: `included_vos` -> Claim Included VO; `progress_claim_item` -> Progress Claim Item
- **Link Fields**: `project` -> Project (reqd); `sales_invoice` -> Sales Invoice; `amended_from` -> Progress Claim
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes (also amend, cancel) |
| All | Yes | No | No | No | No |

- **Track Changes**: 1
- **Validation / Server Logic**: `ProgressClaim(Document): pass` — **no server-side logic**. No validate/on_submit/on_cancel hooks; none of the financial roll-up fields (`gross_amount`, `total_gross`, `net_claim`, `tax_amount`, `invoice_amount`) have a computed formula in the controller.
- **Whitelisted APIs**: None found in `progress_claim.py`.
- **Client Script**: Not found in repository — `progress_claim.js` is a fully commented-out stub; no client-side calculation, fetch_from, or button logic implemented.
- **Business Rules**: Models a contractor's periodic progress/RA claim: itemized `progress_claim_item` rows (quantity x rate) roll up conceptually into `gross_amount`; `vo_amount` (from `included_vos`) adds to give `total_gross`; deductions (`advance_recovery`, `retention`, `other_deduction`) are subtracted to give `net_claim`; `tax_amount` and `invoice_amount` finalize the billable figure; `ra_bill_no` and `status` (Draft -> Submitted -> Under Review -> Certified/Disputed -> Final) track the claim's lifecycle culminating in a `Progress Certificate` (linked back via `Progress Certificate.progress_claim`) and optionally a `Sales Invoice`. **No formula for any of gross_amount/total_gross/net_claim/tax_amount/invoice_amount was found implemented anywhere in this doctype's controller or client script** — these appear to be either manually entered, computed by a report/print format, or computed by code registered elsewhere in the app outside the doctype folders in scope. `period_from`/`period_to` define the billing period the claim covers.

### Progress Claim Item

- **Source**: `progress_measurement_&_billing/doctype/progress_claim_item/progress_claim_item.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Child Table (istable: 1)
- **Naming**: `autoincrement`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| section_identity | | Section Break | | |
| item | Item | Data | reqd | in_list_view (plain text, not a Link to Item master) |
| uom | UOM | Link (UOM) | reqd | in_list_view |
| col_break_ident1 | | Column Break | | |
| quantity | Quantity | Float | reqd | in_list_view |
| rate | Rate | Currency | reqd | in_list_view |
| amount | Amount | Currency | | in_list_view; no formula/read_only enforced in code |
| section_notes | | Section Break | | |
| description | Description | Text | | |

- **Child Tables**: None
- **Link Fields**: `uom` -> UOM
- **Permissions**: None defined (inherits from parent `Progress Claim`)
- **Track Changes**: 1
- **Validation / Server Logic**: `ProgressClaimItem(Document): pass` — no logic.
- **Whitelisted APIs**: None.
- **Client Script**: Not found in repository — `.js` stub is fully commented out; no client-side `amount = quantity * rate` calculation was found (despite that being the obvious intent of the three fields).
- **Business Rules**: Line-item structure for a `Progress Claim` (item description as free text, quantity, rate, computed amount). The expected `amount = quantity * rate` relationship is **not enforced anywhere in code found in scope** — no controller hook, no client script row handler. This should be flagged as either an incomplete implementation or a calculation performed elsewhere (e.g. a report, print format, or an as-yet-unfound custom script).

---

# Quantbit Construction Management — BOQ, Document Control, Labour Management Dossier

## Module: BOQ

### Bill of Quantities

- **Source**: `boq/doctype/bill_of_quantities/bill_of_quantities.json`, `.py`, `.js`
- **Description**: Not found in repository (no `description` key in JSON)
- **Type**: Submittable Document (central/parent doctype of the BOQ module; `allow_import: 1`, `allow_rename: 1`)
- **Naming**: `naming_series:` — series `BOQ-.YYYY.-.####`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| title | Title | Data | Yes | title_field |
| version | Version | Int | No | |
| project | Project | Link (Project) | No | read_only, in_list_view |
| currency | Currency | Link (Currency) | No | |
| contract_type | Contract Type | Link (Contract Type) | No | |
| contract_value | Contract Value | Currency | No | auto-calculated in `validate()` |
| document_type | Document Type | Link (DocType) | Yes | set_only_once, in_list_view; drives data-import |
| import_type | Import Type | Select (Insert New Records / Update Existing Records) | Yes | set_only_once |
| import_file | Import File | Attach | No | read_only once status is Success/Partial Success |
| submit_after_import | Submit After Import | Check | No | set_only_once |
| naming_series | Naming Series | Select (BOQ-.YYYY.-.####) | No | collapsible section |
| task_hierarchy | Task Hierarchy | HTML | No | rendered client-side hierarchy tree |
| tasks_details | Tasks Details | Table (BOQ Task Details) | No | |
| boq_items | BOQ Items | Table (BOQ Item) | No | |
| approved_by | Approved By | Link (User) | No | |
| approved_date | Approved Date | Date | No | in_list_view |
| notes | Notes | Text | No | |
| amended_from | Amended From | Link (Bill of Quantities) | No | read_only, standard amendment field |
| amendment_reason | Amendment Reason | Text | No | |
| combined_boq_details | Combined BOQ Details | HTML | No | rendered grouped summary by item_type |
| download_template | Download Template | Button | No | depends_on `!doc.__islocal` |

- **Child Tables**: `boq_items` → **BOQ Item**; `tasks_details` → **BOQ Task Details**
- **Link Fields**: project→Project, currency→Currency, contract_type→Contract Type, document_type→DocType, approved_by→User, amended_from→Bill of Quantities
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes (amend/cancel too) |
| All | Yes | No | No | No | No |

- **Validation / Server Logic**:
  - `validate()` calls `calculate_contract_value()`, which sums `amount` across all `boq_items` rows into `contract_value`. (Two other validation methods are commented out: `validate_contract_value`, `validate_item_values`.)
  - No `on_submit`/`on_cancel` hooks defined in Python; submission-time hierarchy validation (stages must terminate in subtasks; every leaf subtask must have at least one BOQ item) is enforced entirely client-side in `before_submit`.
- **Whitelisted APIs** (exhaustive — 14 methods in `bill_of_quantities.py`):
  1. `update_task_bom_details(task_name, bom_details)` — overwrites a Task's `custom_bom_details` child table with the given rows (item, qty, uom, rate, item_type, computed total_amount) and saves the Task.
  2. `get_boq_items_from_task(task_name)` — walks all descendant Tasks of `task_name`, for each leaf task (no children) pulls `custom_bom_details` rows and builds BOQ Item-shaped dicts (hierarchy fields + qty/rate/amount duplicated into internal_/actual_ variants).
  3. `get_boq_items_from_subtask(subtask_name)` — same shape-building logic but for a single subtask's `custom_bom_details`.
  4. `download_boq_task_template()` — streams an XLSX template (Stage/Task/Task Level1-10/Task Weight columns) via `build_xlsx_response`.
  5. `import_boq_tasks(file_url, boq_name)` — reads an uploaded XLSX (via `read_xlsx_file_from_attached_file`), parses Stage/Task Level1-10/Task Weight columns, and creates a Stage→Task→...→leaf Task hierarchy of `Task` docs tagged with `custom_boq_name`.
  6. `create_stage_task(boq_name, selected_stages, values, include_tasks, include_children)` — clones one or more existing template Stage tasks (and optionally their Tasks/Subtasks) into the BOQ via `clone_task_hierarchy`.
  7. `create_task(boq_name, selected_tasks, parent_stage, include_children)` — clones selected Task docs (optionally with their subtasks + BOM) under a given parent stage.
  8. `create_subtask(boq_name, selected_stages, values, task)` — clones selected Subtask docs under a given parent task.
  9. `delete_boq_tasks(boq_name)` — force-deletes every Task whose `custom_boq_name` equals the given BOQ (used when an import file is cleared).
  10. `delete_task_with_dependencies(task_name)` — deletes `Task Depends On` rows referencing the task, then force-deletes the Task.
  11. `create_project_from_boq(boq_name, project_name, site_name)` — validates at least one Task exists for the BOQ, creates a new `Project` (carrying `contract_value` into `custom_contractalu_v`), bulk-updates all BOQ Tasks' `project` field via raw SQL, and back-links `project` on the BOQ.
  12. `duplicate_boq(boq_name)` — deep-clones the BOQ doc as a new Draft (via `frappe.copy_doc`, clearing `project`) plus a full clone of the BOQ's Task hierarchy (new names, `task_weight` preserved, BOM copied), rewiring `parent_task` in a second pass.
  13. `amend_subtask(task_name, boq, new_qty)` — updates a Task's `custom_total_quantity`, saves, and logs the before/after change into a new **BOQ Amendment Log** document.
  14. `get_task_qty(task_name)` — returns a Task's `custom_total_quantity`.
  - Plus non-whitelisted helpers: `build_task_hierarchy`, `get_flat_hierarchy_for_boq`, `fill_hierarchy_fields`, `get_all_descendants`, `get_all_dependencies`, `get_all_children`, `clone_task_hierarchy` (recursive stage/task/subtask/dependency cloning engine used by #6-8).
- **Client Script** (`bill_of_quantities.js`, ~3100 lines):
  - `before_submit`: builds the full Task tree for the BOQ (via `frappe.db.get_list`), validates that every leaf node is a subtask (`custom_is_subtask`) and that every leaf subtask has at least one matching row in `boq_items` (matched by `subtask` or `task_level1..10`); throws a formatted HTML error dialog listing "Invalid Hierarchy" / "BOQ Item Missing" violations if any are found.
  - `refresh`: defaults `document_type` to "Task" and `import_type` to "Insert New Records" when unset; renders the Combined BOQ HTML (`render_combined_boq`); shows/hides `task_level1..10` grid columns based on data presence; adds an "Import Tasks" button (calls `import_boq_tasks`) when a file is attached but not yet imported; locks the `import_file` attachment UI after import; sets a `task` grid query on `tasks_details` restricted to Tasks belonging to this BOQ with `custom_is_task=1`; custom formatters render Task IDs as human subjects in the `boq_items` grid; calls `sync_tasks_details(frm)` to auto-populate `tasks_details` from BOQ-linked Tasks and pull their BOM items.
  - `import_file` handler: unlocks the attach field on upload; on clear, confirms and calls `delete_boq_tasks`, clearing `tasks_details`/`boq_items` and reloading the hierarchy.
  - `download_template` button handler: opens `download_boq_task_template` endpoint.
  - **BOQ Task Details** child-table `task` event: prevents duplicate task rows, removes old BOQ item rows for a changed/removed task, and calls `get_boq_items_from_task` to refetch items (`fetch_items_for_task`).
  - **BOQ Item** child-table events: auto-computes `internal_amount`/`actual_amount` from qty×rate on change.
  - A large "Task Hierarchy" tab UI (`load_hierarchy`, `render_row`, `attach_events`, etc.) renders an interactive tree of Stage/Task/Subtask nodes with expand/collapse, weight badges/progress bars, and buttons: Add Stage/Task/Child Task/Subtask (with template reuse via `MultiSelectPills` + weight-limit validation capping cumulative `task_weight` at 100% per level), Edit (prompts + weight revalidation via `frappe.client.set_value`), "Show Details" (opens the Task form), Assign (uses `frappe.desk.form.assign_to.add`), Delete (blocks if children exist; also strips matching `boq_items`/`tasks_details` rows and calls `delete_task_with_dependencies`), "BOQ Item" / Show BOM dialog (edits `custom_bom_details` on the Task and calls `update_task_bom_details`, then `update_boq_items_for_subtask`), and (post-submit) "Amend" dialog calling `amend_subtask`.
  - On `docstatus === 1`, adds "Project" (calls `create_project_from_boq`), "Site" (creates a `Site` doc), and "Duplicate BOQ" (calls `duplicate_boq`) custom buttons under a "Create" group.
  - Listens to `frappe.realtime` event `project_progress_refresh` to re-render the hierarchy live.
- **Business Rules**:
  - BOQ items are largely generated, not hand-entered: the BOM/BOQ-item pipeline sources data from `Task.custom_bom_details` (a Task-side child table outside this module) via `get_boq_items_from_task`/`get_boq_items_from_subtask`, propagating qty/rate/amount into three parallel value sets on each BOQ Item row: BOQ (planned), Internal, and Actual.
  - `contract_value` is a pure roll-up of `boq_items.amount`.
  - Submission is gated by a strict hierarchy completeness rule enforced client-side (stage→task→subtask, every leaf subtask needs a BOQ item).
  - Task hierarchy weights (`task_weight`) are capped at 100% per sibling group (stage-level, task-level, subtask-level) enforced entirely in the client via `validate_total_weight`/`validate_task_weight`/`validate_subtask_weight`.
  - BOQ→Project conversion and BOQ duplication are first-class workflows (both implemented as whitelisted server calls invoked from custom buttons), letting a submitted BOQ spawn an ERPNext Project or a fresh editable copy with its whole task tree.
  - Post-submit "Amend" writes to a separate **BOQ Amendment Log** doctype (not in this module's scope) capturing quantity change history.

### BOQ Item

- **Source**: `boq/doctype/boq_item/boq_item.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: Autoincrement
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| item_code | Item Code | Link (Item) | No | in_list_view |
| item_no | Item Name | Data | No | fetch_from `item_code.item_name` |
| item_type | Item Type | Data | No | fetch_from `item_code.custom_item_type` |
| unit | Unit | Link (UOM) | Yes | in_list_view |
| quantity | BOQ Quantity | Float | Yes | in_list_view |
| cost_code | Cost Code | Data | No | |
| executed_qty | Executed QTY | Float | No | |
| is_ps | Provisional Sum | Check | No | default 0 |
| ps_replaced | Ps Replaced | Check | No | default 0 |
| unit_rate | Unit Rate | Currency | Yes | in_list_view |
| amount | Amount | Currency | No | in_list_view, in_standard_filter |
| executed_amount | Executed Amount | Currency | No | |
| balance_qty | Balance QTY | Float | No | in_list_view |
| description | Description | Text | No | |
| remarks | Remarks | Small Text | No | |
| task | Stage | Data | No | |
| subtask | Task | Data | No | |
| internal_rate / internal_amount / internal_qty | Internal Rate/Amount/Qty | Currency/Currency/Float | No | parallel "internal" cost tracking |
| actual_rate / actual_amount / actual_qty | Actual Rate/Amount/Qty | Currency/Currency/Float | No | parallel "actual" cost tracking |
| subtask_name | Task Subject | Data | No | in_list_view/in_standard_filter |
| task_subject | Stage Subject | Data | No | in_list_view/in_standard_filter |
| task_level1..task_level10 | Task | Link (Task) | No | hierarchy chain (up to 10 levels) |
| level1_subject..level10_subject | Subject | Data | No | fetch_from `task_levelN.subject`, read_only |

- **Child Tables**: none (this is itself a child table)
- **Link Fields**: item_code→Item, unit→UOM, task_level1..10→Task
- **Permissions**: none defined (child table — inherits parent's)
- **Validation / Server Logic**: Controller is an empty `pass` — no server-side validation.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only — no active logic in `boq_item.js` itself (BOQ Item behaviors like amount auto-calc live in `bill_of_quantities.js`, see above).
- **Business Rules**: Represents a single priced line item within a BOQ, tagged to a hierarchy path (task/subtask/level1-10) and carrying three parallel valuation sets (BOQ/planned, Internal, Actual) plus provisional-sum (PS) flags.

### BOQ Rate Analysis

- **Source**: `boq/doctype/boq_rate_analysis/boq_rate_analysis.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`)
- **Naming**: Autoincrement
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| boq_item | BOQ Item | Data | No | in_list_view |
| component | Component | Select (Mandatory / default Material) | No | in_list_view |
| quantity | Quantity | Float | Yes | in_list_view |
| unit | Unit | Link (UOM) | Yes | in_list_view |
| percentage | Percentage | Percent | No | in_list_view |
| source | Rate Source | Select (default Estimated) | No | in_list_view |
| rate | Rate | Currency | Yes | in_list_view |
| amount | Amount | Currency | No | in_list_view |
| description | Description | Data | Yes | in_list_view |

- **Child Tables**: none
- **Link Fields**: unit→UOM
- **Permissions**: none defined (child table)
- **Validation / Server Logic**: Controller is an empty `pass`.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Intended to hold the cost-breakdown (rate analysis / rate build-up) of a BOQ item into components (material/labour/equipment) with quantity, rate, percentage contribution, and source of the rate. Not currently attached as a child table on any parent doctype found in this scope (no `options: "BOQ Rate Analysis"` table field seen in Bill of Quantities, BOQ Item, or BOQ Task Details) — appears to be a standalone/detached child doctype at this stage of development, likely intended for future BOQ costing breakdown UI.

### BOQ Revision

- **Source**: `boq/doctype/boq_revision/boq_revision.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master/standalone document (not `istable`, no `is_submittable`)
- **Naming**: `field:revision_no` (uses the `revision_no` field value as the document name; `revision_no` is also `unique: 1`)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| project | Project | Link (Project) | Yes | in_list_view |
| revision_no | Revision No | Data | No | unique, used as autoname source |
| original_boq | Original BOQ | Link (Bill of Quantities) | Yes | in_list_view |
| revised_by | Revised By | Link (User) | Yes | in_list_view |
| reason | Reason For Revision | Text | Yes | |
| linked_vo | Linked Variation Order | Data | No | free-text VO reference |
| revision_date | Revision Date | Date | Yes | in_list_view |
| previous_value | Previous Contract Value | Currency | No | |
| revised_value | Revised Contract Value | Currency | No | |
| delta_amount | Delta Amount | Currency | No | |

- **Child Tables**: none
- **Link Fields**: project→Project, original_boq→Bill of Quantities, revised_by→User
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | N/A (not submittable) |
| All | Yes | No | No | No | N/A |

- **Validation / Server Logic**: Controller is an empty `pass` — no validate/before_save logic despite `previous_value`/`revised_value`/`delta_amount` fields (delta is not auto-computed server-side).
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Standalone audit/log record capturing a discrete revision event against a Bill of Quantities — before/after contract value, reason, and an optional linked Variation Order reference. Not a child table of Bill of Quantities (no reverse Table field found); relationship is via the `original_boq` Link field only, so it functions as an external revision ledger rather than an embedded version history.

### BOQ Task Details

- **Source**: `boq/doctype/boq_task_details/boq_task_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`), child of Bill of Quantities (`tasks_details` field)
- **Naming**: default (child table, no autoname)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| task | Stage ID | Link (Task) | No | in_standard_filter |
| task_subject | Stage Subject | Data | No | fetch_from `task.subject`, read_only, in_list_view/in_standard_filter |

- **Child Tables**: none
- **Link Fields**: task→Task
- **Permissions**: none defined (child table)
- **Validation / Server Logic**: Controller is an empty `pass`.
- **Whitelisted APIs**: None
- **Client Script**: No dedicated `.js` file exists for this doctype; its grid behavior (task-change handling, duplicate prevention, BOQ item auto-fetch) is implemented in `bill_of_quantities.js` via `frappe.ui.form.on("BOQ Task Details", {...})`.
- **Business Rules**: A lightweight join row linking a BOQ to a specific Task ("Stage"/Task in the hierarchy sense — labeled "Stage ID"/"Stage Subject" in the UI though it stores a `Task` link) used to drive `sync_tasks_details`/`fetch_items_for_task` auto-population of `boq_items` from that Task's BOM.

## Reports

### Task Wise BOQ Analysis

- **Source**: `boq/report/task_wise_boq_analysis/task_wise_boq_analysis.json`, `.py`, `.js`
- **Type**: Script Report, `ref_doctype`: Bill of Quantities, roles: System Manager, All
- **Purpose**: Produces a printable/exportable breakdown of a single BOQ's items grouped by Task, then by item type (Man/Material/Equipment in that fixed order), with per-item-type and per-task subtotals and a grand total per task.
- **Filters**: `bill_of_quantities` — Link (Bill of Quantities), mandatory (`reqd: 1`).
- **Columns**: Sl. No. (Data), Specification (Data, 200px), Unit (Data), Qty (Float), Rate (Currency), Amount (Currency). `add_total_row: 1`.
- **Logic** (`execute`/`get_data`): Loads the target BOQ doc, groups `boq_items` into a dict keyed by `task` then `item_type`. For each task: emits a bold "TASK: <name>" header row, a "Subject" row (Task.subject), a stripped-HTML "Description" row, then for each of `["Man", "Material", "Equipment"]` (skipping empty groups) an item-type header row, one data row per BOQ item (sr_no, item_code as specification, unit, quantity, unit_rate, amount), an item-type Total row (bold, includes qty and amount subtotal), and finally a bold "<task> Grand Total" row plus spacer rows. Uses `frappe.utils.strip_html`/`cstr`.

### BOQ Analysis Report

- **Source**: `boq/report/boq_analysis_report/boq_analysis_report.json`, `.py`, `.js`
- **Type**: Script Report, `ref_doctype`: Bill of Quantities, roles: System Manager, All
- **Purpose**: Same structure as Task Wise BOQ Analysis but grouped by **Subtask** instead of Task (falls back to "Others" bucket if `subtask`/`item_type` is blank, unlike the task-wise report which uses `None` as the group key).
- **Filters**: `bill_of_quantities` — Link (Bill of Quantities), mandatory.
- **Columns**: Sr. No. (Data, 80px), Specification (Data, 100px), Unit (Data), Qty (Float), Rate (Currency), Amount (Currency). `add_total_row: 1`.
- **Logic** (`execute`/`get_data`): Loads the target BOQ doc, groups `boq_items` into a dict keyed by `subtask` (default `"Others"`) then `item_type` (default `"Others"`). For each subtask group: bold "SUBTASK: <name>" header, "Subject" row (fetched via `frappe.get_doc("Task", subtask)`), stripped-HTML "Description" row, spacer, then for each of `["Man", "Material", "Equipment"]` present, an item-type header, item rows, item-type Total row, spacer; ends with a bold "<subtask> Grand Total" row and double spacer.

## Module: Document Control

### Drawing Register

- **Source**: `document_control/doctype/drawing_register/drawing_register.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master document (not submittable, `allow_rename: 1`)
- **Naming**: `naming_series:naming_series` — series default `DRG-.YYYY.-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| status | Status | Select | Yes | default "Under Review"; options include Issued for Construction, Under Review, Approved, Approved with Comments, Rejected, Superseded, Revised; in_list_view |
| project | Project | Link (Project) | Yes | in_list_view |
| drawing_type | Drawing Type | Select | Yes | default "Construction" |
| drawing_no | Drawing Number | Data | No | read_only, unique — set in `before_insert` via `generate_unique_8_digit_number` |
| title | Drawing Title | Data | Yes | title_field |
| discipline | Discipline | Select | Yes | default "Civil" |
| current_rev | Current Revision | Data | No | default "A"; auto-updated from `revisions` table |
| drawn_by | Drawn By | Link (User) | No | |
| checked_by | Checked By | Link (User) | No | |
| issue_date | Issue Date | Date | No | in_list_view |
| file | Drawing File | Attach | No | |
| qr_code | Qr Code | Attach Image | No | |
| notes | Notes | Text | No | |
| revisions | Revision History | Table (Drawing Revision) | No | |
| naming_series | Series | Select (DRG-.YYYY.-) | No | default DRG-.YYYY.- |

- **Child Tables**: `revisions` → **Drawing Revision**
- **Link Fields**: project→Project, drawn_by→User, checked_by→User
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | N/A (not submittable) |
| All | Yes | No | No | No | N/A |

- **Validation / Server Logic** (`drawing_register.py`, class `DrawingRegister`):
  - `before_insert`: auto-generates `drawing_no` as a unique 8-digit number if not already set.
  - `validate()` runs, in order: `validate_unique_drawing_no()` — throws if another Drawing Register in the same `project` already has the same `drawing_no`; `validate_ifc_file_required()` — throws if `status == "Issued for Construction"` and no `file` attached; `prevent_edit_if_superseded()` — throws on edit (not new) if `status == "Superseded"`, forcing users to create a new revision instead; `validate_revision_table()` — throws on duplicate `revision` values within the `revisions` child table, and throws if a later row's `revision_date` predates an earlier one (rows checked in table order, not sorted); `update_current_revision()` — sets `current_rev` to the `revision` value of the row with the latest `revision_date` in `revisions`.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only — no active logic in `drawing_register.js`.
- **Business Rules**: Central drawing register per project; drawing numbers are unique per project (not globally); IFC (Issued for Construction) status is gated on having an attached file; superseded drawings become immutable; `current_rev` is always derived from the latest dated row in the embedded revision history rather than manually set.

### Drawing Revision

- **Source**: `document_control/doctype/drawing_revision/drawing_revision.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`), child of Drawing Register (`revisions` field)
- **Naming**: default (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| revision | Revision | Data | No | in_list_view |
| revision_date | Revision Date | Date | No | in_list_view |
| description | Change Description | Text | No | in_list_view |
| issued_by | Issued By | Link (User) | No | in_list_view |
| file | Revision File | Attach | No | in_list_view |
| status | Status | Select | No | options string malformed in JSON: `"Issued for Construction Approved\nApproved with Comments Superseded\nRejected"` (appears to be missing newlines between some option values) |
| transmittal_no | Transmittal No. | Link (Transmittal) | No | in_list_view |

- **Child Tables**: none
- **Link Fields**: issued_by→User, transmittal_no→Transmittal
- **Permissions**: none defined (child table)
- **Validation / Server Logic**: Controller is an empty `pass`. All revision integrity checks (duplicate revision, date ordering) are enforced by the parent Drawing Register's `validate_revision_table()`, not here.
- **Whitelisted APIs**: None
- **Client Script**: Not found in repository (no `.js` file in this doctype folder).
- **Business Rules**: Represents one dated revision entry of a drawing, optionally linked to the Transmittal that issued it.

### RFI (Request for Information)

- **Source**: `document_control/doctype/rfi/rfi.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Submittable Document (`is_submittable: 1`, `allow_rename: 1`)
- **Naming**: `naming_series:R-.YYYY.-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Series | Select (R-.YYYY.-) | No | |
| status | Status | Select | Yes | default "Open"; options Open/Responded/Closed/Disputed/Withdrawn; in_list_view |
| project | Project | Link (Project) | Yes | in_list_view |
| priority | Priority | Select | No | default "Normal" |
| subject | Subject | Data | Yes | |
| raised_by | Raised By | Link (User) | Yes | in_list_view |
| discipline | Discipline | Select | No | default "Architectural" |
| related_drawing | Related Drawing | Link (Drawing Register) | No | |
| directed_to | Directed To | Select | No | default "Architect" |
| response_by | Response By | Link (User) | No | |
| impact_on_cost | Cost Impact | Check | No | default 0 |
| linked_vo | Linked Variation Order | Data | No | |
| impact_on_time | Time Impact | Check | No | default 0 |
| raised_date | Date Raised | Date | Yes | default "Today", in_list_view |
| required_by | Response Required By | Date | No | |
| response_date | Response Date | Date | No | |
| attachments | Attachments | Attach | No | |
| query | Query | Long Text | Yes | |
| response | Response | Long Text | No | |
| amended_from | Amended From | Link (RFI) | No | read_only, standard amendment field |
| rfi_number | RFI Number | Data | No | read_only, unique — set in `before_insert` |

- **Child Tables**: none
- **Link Fields**: project→Project, raised_by→User, related_drawing→Drawing Register, response_by→User, amended_from→RFI
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes (amend/cancel too) |
| All | Yes | No | No | No | No |

- **Validation / Server Logic** (`rfi.py`, class `RFI`):
  - `before_insert`: auto-generates `rfi_number` as a unique 8-digit number.
  - `validate()`: `validate_required_by_date()` — throws if `required_by` is earlier than `raised_date`; `validate_close_without_response()` — throws if `status == "Closed"` and no `response` text is present.
  - `on_submit()`: if `priority` is "High" or "Urgent", shows a `frappe.msgprint` notifying that a high-priority RFI was submitted (informational only, no state change).
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only — no active logic in `rfi.js`.
- **Business Rules**: RFI workflow enforces a minimal but real business rule set: required-by date sanity, and no closing an RFI without a documented response. Optional cost/time impact flags and a free-text linked Variation Order field connect RFIs to commercial/contract change tracking outside this module.

### Shop Drawing

- **Source**: `document_control/doctype/shop_drawing/shop_drawing.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Submittable Document (`is_submittable: 1`, `allow_rename: 1`)
- **Naming**: `naming_series:naming_series` — series `SD-.YYYY.-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| status | Status | Select | Yes | default "Submitted"; options Submitted/Under Review/Approved/Approved with Comments/Rejected/Revise & Resubmit; in_list_view |
| project | Project | Link (Project) | Yes | in_list_view |
| title | Title | Data | Yes | unique, title_field |
| discipline | Discipline | Select (Structural/Mechanical/Electrical/Architectural/Civil) | Yes | |
| related_drawing | Related Drawing | Link (Drawing Register) | No | |
| review_action | Review Action | Select | No | Approved/Approved with Comments/Revise and Resubmit/Rejected/For Reference Only |
| reviewed_by | Reviewed By | Link (User) | No | |
| resubmission_no | Resubmission No | Int | No | |
| previous_sd | Previous Submission | Link (Shop Drawing) | No | self-referential chain for resubmissions |
| submission_date | Submission Date | Date | Yes | in_list_view |
| review_date | Review Date | Date | No | |
| submitted_by | Submitted By | Link (Supplier) | Yes | in_list_view |
| file | File | Attach | Yes | |
| comments | Comments | Text | No | max_height 150px |
| amended_from | Amended From | Link (Shop Drawing) | No | read_only, standard amendment field |
| sd_no | Shop Drawing No. | Data | No | read_only — set in `before_insert` |
| naming_series | Series | Select (SD-.YYYY.-) | No | |

- **Child Tables**: none
- **Link Fields**: project→Project, related_drawing→Drawing Register, reviewed_by→User, previous_sd→Shop Drawing (self), submitted_by→Supplier, amended_from→Shop Drawing
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes (amend/cancel too) |
| All | Yes | No | No | No | No |

- **Validation / Server Logic** (`shop_drawing.py`, class `ShopDrawing`):
  - `before_insert`: auto-generates `sd_no` as a unique 8-digit number.
  - `validate()`: `validate_rejection_comments()` — throws if `review_action == "Rejected"` and `comments` is empty, requiring justification for any rejection.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Submitted by a Supplier (subcontractor), reviewed against a related Drawing Register entry, and supports a resubmission chain via `previous_sd`/`resubmission_no` for "Revise & Resubmit" cycles; every rejection must carry review comments.

### Transmittal

- **Source**: `document_control/doctype/transmittal/transmittal.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Submittable Document (`is_submittable: 1`, `allow_rename: 1`)
- **Naming**: `naming_series:T-.YYYY.-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Series | Select (T-.YYYY.-) | No | |
| status | Status | Select (Draft/Sent/Acknowledged/Replied/Overdue) | Yes | in_list_view, in_standard_filter |
| project | Project | Link (Project) | Yes | in_list_view, in_standard_filter |
| from_company | From | Link (Company) | Yes | in_list_view |
| to_party | To | Data | Yes | |
| to_email | To Email | Data | No | |
| purpose | Purpose | Select | Yes | default "For Approval"; options For Approval/For Comment/For Information/For Construction/As Built |
| response_required | Response Required | Check | No | default 0 |
| date | Transmittal Date | Date | Yes | in_list_view, in_standard_filter |
| response_due | Response Due By | Date | No | |
| acknowledgement | Acknowledgement | Attach | No | |
| amended_from | Amended From | Link (Transmittal) | No | read_only |
| transmittal_no | Transmittal No. | Data | No | read_only, unique — set in `before_insert` |
| drawings | Drawings Included | Table (Transmittal Drawing) | No | |

- **Child Tables**: `drawings` → **Transmittal Drawing**
- **Link Fields**: project→Project, from_company→Company, amended_from→Transmittal
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes (amend/cancel too) |
| All | Yes | No | No | No | No |

- **Validation / Server Logic** (`transmittal.py`, class `Transmittal`):
  - `before_insert`: auto-generates `transmittal_no` as a unique 8-digit number.
  - `before_save()`: calls `validate_response_due_date()` — throws if `response_due` is on/before the `date` (transmittal date).
  - `before_submit()`: calls `validate_drawings_exist()` — throws if the `drawings` child table is empty (must include at least one drawing/document); then force-sets `status = "Sent"` on submit.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: A Transmittal formally packages one or more Drawing Register entries (via `Transmittal Drawing` rows) for dispatch to an external party; submission automatically flips status to "Sent" and is blocked unless drawings are attached and a sane response-due date is set.

### Transmittal Drawing

- **Source**: `document_control/doctype/transmittal_drawing/transmittal_drawing.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`), child of Transmittal (`drawings` field)
- **Naming**: Autoincrement
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| drawing | Drawing | Link (Drawing Register) | Yes | in_list_view |
| revision | Revision | Data | No | fetch_from `drawing.current_rev`, in_list_view |
| remarks | Remarks | Small Text | No | in_list_view |

- **Child Tables**: none
- **Link Fields**: drawing→Drawing Register
- **Permissions**: none defined (child table)
- **Validation / Server Logic**: Controller is an empty `pass`.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Snapshot-links a Drawing Register entry (and its current revision letter, auto-fetched) into a Transmittal's package list.

## Module: Labour Management

### Gang

- **Source**: `labour_management/doctype/gang/gang.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master document (not submittable, `allow_rename: 1`)
- **Naming**: `field:gang_code` (uses `gang_code` value as document name)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| status | Status | Select (Active/Demobilised/Standby) | Yes | default "Active", in_list_view |
| project | Project | Link (Project) | Yes | in_list_view |
| gang_code | Gang Code | Data | Yes | unique, in_list_view, autoname source |
| gang_name | Gang Name | Data | Yes | |
| gang_leader | Gang Leader | Link (Employee) | No | in_list_view |
| subcontractor | Subcontractor | Link (Supplier) | No | |
| trade | Primary Trade | Select | No | default "General"; options Masonry/Carpentry/Steel Fixing/Concrete/Excavation/General/Other |
| size | Gang Size | Int | No | |
| members | Gang Members | Table (Gang Member) | No | |

- **Child Tables**: `members` → **Gang Member**
- **Link Fields**: project→Project, gang_leader→Employee, subcontractor→Supplier
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | N/A (not submittable) |
| All | Yes | No | No | No | N/A |

- **Validation / Server Logic**: Controller is an empty `pass` — no validate/business logic (e.g., `size` is not cross-checked against the actual count of `members` rows).
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Represents a labour crew/gang assigned to a project, optionally under a Subcontractor, led by an Employee gang leader, with a roster of individual members and a declared trade specialization. Referenced by `Labour Attendance Bulk Entry.gang`.

### Gang Member

- **Source**: `labour_management/doctype/gang_member/gang_member.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`), child of Gang (`members` field)
- **Naming**: Autoincrement
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| employee | Employee | Link (Employee) | Yes | in_list_view |
| labour_category | Labour Category | Link (Labour Category) | No | in_list_view |
| remarks | Remarks | Small Text | No | in_list_view |

- **Child Tables**: none
- **Link Fields**: employee→Employee, labour_category→Labour Category
- **Permissions**: none defined (child table)
- **Validation / Server Logic**: Controller is an empty `pass`.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Associates an Employee with a skill/trade Labour Category as a roster line within a Gang.

### Labour Attendance Bulk Entry

- **Source**: `labour_management/doctype/labour_attendance_bulk_entry/labour_attendance_bulk_entry.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Submittable Document (`is_submittable: 1`, `allow_rename: 1`)
- **Naming**: `naming_series:` — series `LABE-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Naming Series | Select (LABE-) | No | collapsible section |
| project | Project | Link (Project) | Yes | in_list_view |
| gang | Gang | Link (Gang) | Yes | in_list_view |
| shift | Shift | Select (Day/Night) | Yes | default "Day" |
| site_engineer | Verified By | Link (User) | Yes | in_list_view; defaults to session user |
| date | Date | Date | Yes | default "Today", in_list_view |
| labour_entry_details | Labour Entry Details | Table (Labour Entry Details) | No | |
| remarks | Remarks | Text | No | |
| amended_from | Amended From | Link (Labour Attendance Bulk Entry) | No | read_only |

- **Child Tables**: `labour_entry_details` → **Labour Entry Details**
- **Link Fields**: project→Project, gang→Gang, site_engineer→User, amended_from→Labour Attendance Bulk Entry
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | Yes (amend/cancel too) |
| All | Yes | No | No | No | No |

- **Validation / Server Logic** (`labour_attendance_bulk_entry.py`, class `LabourAttendanceBulkEntry`):
  - `validate()`: if `site_engineer` is not set, defaults it to `frappe.session.user`.
- **Whitelisted APIs**: None
- **Client Script** (`labour_attendance_bulk_entry.js`):
  - `refresh`: mirrors the server default — sets `site_engineer` to the current session user if unset.
  - Child-table event handler on **Labour Entry Details** rows: on `contractor` change, fetches the linked `Contractor.contractor_type` and maps it to the row's `contractor_type` field ("Individual" → "Individuals" + auto-sets `total_skilled = 1`; "Contract" → "Contract"); clearing `contractor` clears `contractor_type`. A separate `contractor_type` handler also force-sets `total_skilled = 1` when the type is "Individuals".
  - Note: these `contractor`/`Contractor` references are NOT present in the `labour_entry_details.json` field list read from this module (`contractor` field exists but there is no `Contractor` doctype file in this scope) — `Contractor` is an external doctype outside the documented modules.
- **Business Rules**: One bulk entry per Gang/date/shift capturing attendance for the whole crew via the child table; auto-attributes verification to whichever user is creating/editing the record.

### Labour Attendance Row

- **Source**: `labour_management/doctype/labour_attendance_row/labour_attendance_row.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`) — declared standalone; no parent Table field referencing "Labour Attendance Row" was found in any doctype JSON read in this scope (the bulk-entry parent instead embeds **Labour Entry Details**, not this doctype)
- **Naming**: Autoincrement
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| status | Attendance Status | Select (Present/Absent/Half Day) | Yes | in_list_view |
| employee | Employee | Link (Employee) | Yes | in_list_view |
| hours | Working Hours | Float | No | |
| remarks | Remarks | Small Text | No | |

- **Child Tables**: none
- **Link Fields**: employee→Employee
- **Permissions**: none defined (child table)
- **Validation / Server Logic**: Controller is an empty `pass`.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: A per-employee attendance/status/hours row (Present/Absent/Half Day) — appears to be an earlier or alternate design for per-employee attendance capture, superseded in the current Bulk Entry flow by the contractor-count-based **Labour Entry Details** table.

### Labour Category

- **Source**: `labour_management/doctype/labour_category/labour_category.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master document (not submittable, `allow_rename: 1`)
- **Naming**: `field:category_code`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| is_active | Is Active | Check | No | default 1 |
| skill_level | Skill Level | Select | No | default "Skilled"; options Skilled/Semi-Skilled/Unskilled/Supervisor/Foreman/Gang/Leader |
| category_code | Category Code | Data | Yes | unique, in_list_view, autoname source |
| category_name | Category Name | Data | Yes | |
| trade | Trade | Select | No | default "General Labour"; wide option list (Masonry, Carpentry, Steel Fixing, Concrete, Excavation, Painting, Plumbing, Electrical, Welding, Roofing, General Labour, Supervisory, Other) |
| cost_code | Cost Code | Data | No | |
| standard_rate | Standard Daily Rate | Currency | No | default 0, in_list_view |
| overtime_rate | Overtime Rate | Currency | No | default 0, in_list_view |

- **Child Tables**: none
- **Link Fields**: none
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | N/A (not submittable) |
| All | Yes | No | No | No | N/A |

- **Validation / Server Logic**: Controller is an empty `pass`.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: Master rate card for labour categories (skill level × trade), providing standard/overtime daily rates and a cost code for costing integration; referenced by Gang Member.

### Labour Entry Details

- **Source**: `labour_management/doctype/labour_entry_details/labour_entry_details.json`, `.py`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`), child of Labour Attendance Bulk Entry (`labour_entry_details` field)
- **Naming**: default (child table)
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| contractor | Contractor | Link (Contractor) | No | in_list_view, in_preview, in_standard_filter — target doctype "Contractor" not found in this scope |
| attendance_status | Attendance Status | Select (Present/Absent) | No | shown only when `contractor_type == "Individuals"` |
| total_skilled | Total Skilled Labour Present Count | Int | No | shown only when `contractor_type == "Contract"` |
| contractor_type | Contractor type | Select (Individuals/Contract) | No | in_list_view |
| total_unskilled | Total Unskilled Labour Present Count | Int | No | shown only when `contractor_type == "Contract"` |
| total_man_hours | Total Man Hours | Float | No | in_list_view |

- **Child Tables**: none
- **Link Fields**: contractor→Contractor (external doctype, not in scope)
- **Permissions**: none defined (child table)
- **Validation / Server Logic**: Controller is an empty `pass`. All conditional behavior (contractor-type-driven field visibility and default `total_skilled=1` for individuals) lives entirely in the parent's client script (see Labour Attendance Bulk Entry above).
- **Whitelisted APIs**: None
- **Client Script**: No dedicated `.js` file in this doctype's own folder; grid row logic is defined in `labour_attendance_bulk_entry.js`.
- **Business Rules**: Captures attendance counts per Contractor line within a bulk entry: either a simple Present/Absent flag for an "Individuals" contractor type (with `total_skilled` forced to 1), or aggregate skilled/unskilled headcounts plus total man-hours for a "Contract" type — i.e., attendance is recorded at the contractor-batch level, not always per named employee.

### Skill Matrix

- **Source**: `labour_management/doctype/skill_matrix/skill_matrix.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Master document (not submittable, `allow_rename: 1`)
- **Naming**: `naming_series:SM-.YYYY.-`
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| naming_series | Series | Select (SM-.YYYY.-) | No | |
| project | Project | Link (Project) | No | in_list_view |
| employee | Employee | Link (Employee) | Yes | in_list_view |
| overall_level | Overall Competency | Select | No | default "Competent"; options Novice/Competent/Proficient/Expert |
| updated_by | Updated By | Link (User) | No | in_list_view |
| last_updated | Last Updated | Date | No | in_list_view |
| skill_record | Skill Record | Table (Skill Record) | Yes | |

- **Child Tables**: `skill_record` → **Skill Record**
- **Link Fields**: project→Project, employee→Employee, updated_by→User
- **Permissions**:

| Role | Read | Write | Create | Delete | Submit |
|---|---|---|---|---|---|
| System Manager | Yes | Yes | Yes | Yes | N/A (not submittable) |
| All | Yes | No | No | No | N/A |

- **Validation / Server Logic**: Controller is an empty `pass` — `last_updated`/`updated_by` are not auto-stamped server-side despite their naming.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: One record per Employee (optionally scoped to a Project) capturing an overall competency rating plus a detailed table of individual certified skills (`skill_record`), used for workforce qualification tracking.

### Skill Record

- **Source**: `labour_management/doctype/skill_record/skill_record.json`, `.py`, `.js`
- **Description**: Not found in repository
- **Type**: Child Table (`istable: 1`), child of Skill Matrix (`skill_record` field)
- **Naming**: Autoincrement
- **Fields**:

| Fieldname | Label | Type | Mandatory | Notes |
|---|---|---|---|---|
| skill_name | Skill Name | Data | Yes | unique, in_list_view |
| certificate_no | Certificate No | Data | No | in_list_view |
| valid_till | Valid Till | Date | No | in_list_view |
| remarks | Remarks | Small Text | No | in_list_view |

- **Child Tables**: none
- **Link Fields**: none
- **Permissions**: none defined (child table)
- **Validation / Server Logic**: Controller is an empty `pass` — no expiry (`valid_till`) checking logic present anywhere in scope.
- **Whitelisted APIs**: None
- **Client Script**: Commented-out stub only.
- **Business Rules**: A single certified skill/qualification line (skill name, certificate number, expiry date) within an Employee's Skill Matrix.
