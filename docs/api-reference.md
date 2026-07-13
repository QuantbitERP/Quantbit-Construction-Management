# API Reference

This app exposes **RPC-style endpoints** via Frappe's `@frappe.whitelist()` mechanism — there is no separate REST API layer, OpenAPI spec, or router of its own. Every whitelisted Python function automatically becomes callable at:

```
POST /api/method/<dotted.path.to.function>
```

**Authentication**: standard Frappe session/API-key authentication applies to every endpoint below — none declare `allow_guest=True` (confirmed by repository-wide search: no occurrence of `allow_guest` in this app). All calls require a logged-in Frappe session (cookie-based from Desk, or `Authorization: token <api_key>:<api_secret>` for external calls) and are subject to standard DocType permissions unless a function explicitly passes `ignore_permissions=True` (flagged per-endpoint below where found).

**Method**: all calls are `POST` (Frappe's default for whitelisted methods that are not explicitly marked `methods=["GET"]` — none in this app are).

Every endpoint listed below was located via `grep -rn "@frappe.whitelist()"` across the repository (65 occurrences); two are commented out and excluded. Endpoints that use `@frappe.validate_and_sanitize_search_inputs` are Link-field "query" endpoints (used as a Link field's `get_query`), which return `[[value, label], ...]` pairs rather than typical dict/list payloads.

## App-Root Utilities (`api.py`, `utils.py`, `report_handler.py`)

### `quantbit_construction_management.api.get_template_subtasks`
- **Source**: `quantbit_construction_management/api.py:2-28`
- **Signature**: `get_template_subtasks(doctype, txt, searchfield, start, page_len, filters)`
- **Purpose**: Link-field query for a Task's dependency search box — returns `(name, subject)` tuples for Tasks that the given `parent_task` depends on (via `Task.depends_on`), filtered by search text.
- **Returns**: `list[tuple[str, str]]`
- **Example request**:
  ```
  POST /api/method/quantbit_construction_management.api.get_template_subtasks
  { "doctype": "Task", "txt": "", "searchfield": "name", "start": 0, "page_len": 20,
    "filters": {"parent_task": "TASK-0001"} }
  ```

### `quantbit_construction_management.api.clone_task_hierarchy`
- **Source**: `quantbit_construction_management/api.py:30-57`
- **Signature**: `clone_task_hierarchy(source_task, target_project, parent_task=None, include_dependencies=False, include_children=False, task_weight=None, custom_boq_name=None)`
- **Purpose**: Deep-clones a template Task (and optionally its children, recursively) into a target Project, resetting execution-state fields (`status`, `progress`, `completed_by`, `act_start_date`/`act_end_date`) on the clone. Used by `Project.js`'s hierarchy widget ("Add Stage/Task/Subtask from template").
- **Returns**: `str` — the new Task's `name`.
- **Called from**: `public/js/Project.js` (`add-stage`, `add-task`, `add-child-task`, `add-subtask` dialogs).

### `quantbit_construction_management.api.link_boq_tasks_to_project`
- **Source**: `quantbit_construction_management/api.py:60-71`
- **Signature**: `link_boq_tasks_to_project(boq_name, project_name)`
- **Purpose**: Bulk-updates every `Task` whose `custom_boq_name` matches the given BOQ, setting their `project` field — via raw SQL `UPDATE` + `frappe.db.commit()` (bypasses Document validation/hooks).
- **Returns**: `bool`
- **Called from**: `public/js/Project.js` (`custom_get_details` field handler / `link_and_load_hierarchy`).
- ⚠️ **Note**: commits mid-request and uses raw SQL instead of `frappe.get_doc(...).save()`, so no `Task.validate()`/`on_update` hooks fire for the affected rows — see `docs/known-limitations.md`.

### `quantbit_construction_management.api.delete_task_with_dependencies`
- **Source**: `quantbit_construction_management/api.py:73-79`
- **Signature**: `delete_task_with_dependencies(task_name)`
- **Purpose**: Deletes a Task's `Task Depends On` child rows, then the Task itself, both with `ignore_permissions=True, force=1`.
- **Returns**: `bool`
- **Called from**: `public/js/Project.js` (`delete-item` button).
- ⚠️ **Permission bypass**: `ignore_permissions=True` means any authenticated user who can trigger this endpoint can delete a Task regardless of their own Delete permission on Task — see `docs/permissions.md`.

### `quantbit_construction_management.utils.convert_uom_or_warn`
- **Source**: `quantbit_construction_management/utils.py:20-60`
- **Signature**: `convert_uom_or_warn(from_uom, to_uom, value)`
- **Purpose**: Converts `value` between two UOMs using `UOM Conversion Table` rows (tries the direct pair, then the reverse pair with `1/factor`); special-cases `"hrs"` (returned unconverted); calls `frappe.msgprint` and returns `None` on missing/unresolvable conversion rather than raising.
- **Returns**: `float | None`

### `quantbit_construction_management.report_handler.get_report_html`
- **Source**: `quantbit_construction_management/report_handler.py:5-136`
- **Signature**: `get_report_html(report_name, filters=None)`
- **Purpose**: Runs any Query Report via `frappe.desk.query_report.run(..., ignore_prepared_report=True)` and renders the result as a styled HTML `<table>` string for embedding in a form (see `docs/reports.md`).
- **Returns**: `str` (HTML) — or a dict `{"status": "preparing", "html": ...}` in the (rare, actively bypassed) prepared-report case.
- **Called from**: `public/js/Project.js` (`render_report_view`).

## Tendering

| Endpoint | Source | Signature | Purpose |
|---|---|---|---|
| `tendering.doctype.tender.tender.create_customer_from_lead` | `tender.py:50-51` (instance method, class `Tender`) | `self.create_customer_from_lead()` | Creates an ERPNext `Customer` from the Tender's linked `Lead`. |
| `tendering.doctype.tender.tender.create_project_from_tender` | `tender.py:95-96` | `create_project_from_tender(tender_name, project_name)` | Creates an ERPNext `Project` and re-parents the Tender's BOQ-linked Task hierarchy (up to 10 levels) onto it. |
| `tendering.doctype.tender.tender.get_boq_details` | `tender.py:164-165` | `get_boq_details(boq)` | Fetches summary details of a linked Bill of Quantities for display on the Tender form. |
| `tendering.custom_project.project.get_columns` | `custom_project/project.py:3-4` | `get_columns(project)` | Returns Task-derived column definitions for a Project's custom data-sheet table; called from `Project.js`'s `custom_get_columns` handler. **Not** wired via `hooks.py doc_events`. |
| `tendering.custom_crm.opportunity.create_tender_from_opportunity` | `custom_crm/opportunity.py:103-104` | `create_tender_from_opportunity(opportunity_name, tender_name)` | Creates a `Tender` from a qualified Opportunity; called from `Opportunity.js`'s "Create Tender" dialog. |

## BOQ (`bill_of_quantities.py`) — 14 endpoints

| Endpoint (suffix after `boq.doctype.bill_of_quantities.bill_of_quantities.`) | Line | Signature | Purpose |
|---|---|---|---|
| `update_task_bom_details` | 24 | `update_task_bom_details(task_name, bom_details)` | Writes BOM detail rows back onto a Task. |
| `get_boq_items_from_task` | 166 | `get_boq_items_from_task(task_name)` | Fetches BOQ line items scoped to a Task. |
| `get_boq_items_from_subtask` | 230 | `get_boq_items_from_subtask(subtask_name)` | Fetches BOQ line items scoped to a Subtask. |
| `download_boq_task_template` | 267 | `download_boq_task_template()` | Generates an XLSX template for bulk Stage/Task/Subtask import. |
| `import_boq_tasks` | 274 | `import_boq_tasks(file_url, boq_name)` | Imports Stage→Task→Subtask rows from an uploaded XLSX file. |
| `create_stage_task` | 632 | `create_stage_task(boq_name=None, selected_stages=None, values=None, include_tasks=0, include_children=0)` | Template-based Stage creation (optionally including child Tasks). |
| `create_task` | 660 | `create_task(boq_name=None, selected_tasks=None, parent_stage=None, include_children=0)` | Template-based Task creation under a Stage. |
| `create_subtask` | 721 | `create_subtask(boq_name=None, selected_stages=None, values=None, task=None)` | Template-based Subtask creation. |
| `delete_boq_tasks` | 748 | `delete_boq_tasks(boq_name)` | Bulk-deletes every Task linked to a BOQ. |
| `delete_task_with_dependencies` | 766 | `delete_task_with_dependencies(task_name)` | BOQ-module's own copy of the dependency-aware Task delete (parallel to `api.py`'s version — see `docs/known-limitations.md`). |
| `create_project_from_boq` | 776 | `create_project_from_boq(boq_name, project_name, site_name)` | Creates a Project from a BOQ and links its Task hierarchy. |
| `duplicate_boq` | 814 | `duplicate_boq(boq_name)` | Deep-duplicates a BOQ document and its entire Task tree. |
| `amend_subtask` | 896 | `amend_subtask(task_name, boq, new_qty)` | Post-submit quantity amendment with audit logging (writes a `BOQ Amendment Log` entry). |
| `get_task_qty` | 928 | `get_task_qty(task_name)` | Returns a Task's current billed/planned quantity. |

## Site Diary (`site_diary.py`) — 10 endpoints

| Endpoint (suffix after `site_diary.doctype.site_diary.site_diary.`) | Line | Signature | Purpose |
|---|---|---|---|
| `update_daily_activity_progress_table` | 451 | `update_daily_activity_progress_table(doc)` | Rebuilds the DPR activity-progress child table for a Site Diary. (Note: an **identical but commented-out** copy exists at line 382-383 — dead code, see `docs/known-limitations.md`.) |
| `update_task_progress_from_dpr` | 575 | `update_task_progress_from_dpr(task, achieved_qty, total_qty)` | Pushes achieved/total quantity from a DPR row onto the linked Task. |
| `get_multiple_task_bom_details` | 587 | `get_multiple_task_bom_details(tasks)` | Batch BOM lookup for several Tasks at once. |
| `get_current_weather` | 720 | `get_current_weather(lat, lon)` | Fetches current weather for the site's coordinates (only weather/geolocation-adjacent call in the app — see `docs/integrations.md`). |
| `get_task_bom_details` | 765 | `get_task_bom_details(task)` | BOM detail lookup for a single Task. |
| `get_site_diary_details` | 829 | `get_site_diary_details(project, site_date, shift=None, site_engineer=None)` | Aggregates a project/date's Site Diary summary. |
| `get_material_deliveries` | 1037 | `get_material_deliveries(project, site_date, shift=None, site_engineer=None)` | Material-issue rows for the Daily Progress Report (also imported directly by `docs/reports.md`'s report). |
| `get_material_received` | 1137 | `get_material_received(project, site_date, shift=None, site_engineer=None)` | Material-receipt rows (Purchase Receipt / Stock Entry), also imported by the Daily Progress Report. |
| `get_latest_task_progress` | 1245 | `get_latest_task_progress(project, site_date, shift=None, site_engineer=None)` | Latest recorded progress per task for a project/date. |
| `get_task_progress_images` | 1323 | `get_task_progress_images(task_progress_name, parent_task, task)` | Fetches attached progress photos for a Task Progress record. |

## Site Diary — Link-Field Query Endpoints (search boxes)

These all share the `@frappe.validate_and_sanitize_search_inputs` pattern and return `[[value, label], ...]`:

| Endpoint | Source |
|---|---|
| `get_previous_task_progress` | `site_diary/doctype/task_progress/task_progress.py:159-160` |
| `has_dependencies` (Task Progress) | `site_diary/doctype/task_progress/task_progress.py:197-198` |
| `get_depends_on_tasks` (Task Progress) | `site_diary/doctype/task_progress/task_progress.py:204-206` |
| `get_contractor_items` | `site_diary/doctype/equipment_usage/equipment_usage.py:52-54` |
| `has_dependencies` (Equipment Usage) | `site_diary/doctype/equipment_usage/equipment_usage.py:73-74` |
| `get_depends_on_tasks` (Equipment Usage) | `site_diary/doctype/equipment_usage/equipment_usage.py:80-82` |
| `get_contractor_manpower_items` | `site_diary/doctype/manpower_usage/manpower_usage.py:45-47` |
| `has_dependencies` (Manpower Usage) | `site_diary/doctype/manpower_usage/manpower_usage.py:66-67` |
| `get_depends_on_tasks` (Manpower Usage) | `site_diary/doctype/manpower_usage/manpower_usage.py:73-75` |
| `has_dependencies` (Stock Entry) | `public/pythonn/stock_entry.py:4-9` |
| `get_depends_on_tasks` (Stock Entry) | `public/pythonn/stock_entry.py:11-37` |
| `get_depends_on_tasks` (RA Billing / Task Level Sheet) | `ra_billing/doctype/task_level_sheet/task_level_sheet.py:67-95` |
| `get_stage_tasks` | `ra_billing/doctype/task_level_sheet/task_level_sheet.py:103-...` |
| `get_child_tasks` (Costing) | `quantbit_construction_management/doctype/costing/costing.py:381-...` |

`public/pythonn/stock_entry.py`'s two functions are dotted-path-importable (`quantbit_construction_management.public.pythonn.stock_entry.*`) and are called directly from `Stock_Entry.js`'s dynamic child-table field queries — despite `public/` conventionally holding static assets, this is a live, whitelisted Python module. See `docs/known-limitations.md`.

## Core Module (`costing.py`, `daily_progress_tracking.py`)

| Endpoint | Source | Signature | Purpose |
|---|---|---|---|
| `costing.update_costing_task_table` | `costing.py:13-14` | `update_costing_task_table(doc)` | Rebuilds a Costing's task-level child table from the linked Task hierarchy. |
| `costing.get_costing_work_details_from_costing_task` | `costing.py:75-76` | `get_costing_work_details_from_costing_task(doc)` | Expands a Costing Task row into its Work Details breakdown. |
| `costing.get_costing` | `costing.py:105-106` | `get_costing(doc)` | The main cost roll-up entry point — cascades Task hierarchy → construction-type quantities → UOM-converted worker/equipment/material costs (uses `utils.convert_uom_or_warn`). |
| `costing.get_child_tasks` | `costing.py:381-...` | `get_child_tasks(doctype, txt, searchfield, start, page_len, filters)` | Link-query for child Tasks under a given parent. |
| `daily_progress_tracking.update_daily_activity_progress_table` | `daily_progress_tracking.py:48-49` | `update_daily_activity_progress_table(doc)` | Same pattern as Site Diary's method, scoped to DPR. |
| `daily_progress_tracking.update_task_progress_from_dpr` | `daily_progress_tracking.py:120-121` | `update_task_progress_from_dpr(task, achieved_qty, total_qty)` | Pushes DPR-derived progress onto a Task. |

## Subcontractor Management (`ra_billing.py`) — 11 endpoints, `contractor_billing.py` — 1 endpoint

| Endpoint (suffix after `subcontractor_management.doctype.ra_billing.ra_billing.`) | Line | Signature | Purpose |
|---|---|---|---|
| `validate_task_rates` | 276 | `validate_task_rates(doc)` | Enforces one rate per task across the bill's line items. |
| `get_project_tasks` | 293 | `get_project_tasks(project)` | Task-hierarchy lookup for populating the RA bill's line items. |
| `get_project_steel_tasks` | 386 | `get_project_steel_tasks(project)` | Task lookup scoped to steel-reinforcement measurement mode. |
| `create_sales_invoice` | 459 | `create_sales_invoice(source_name, target_doc=None, item_code=None)` | `frappe.model.mapper`-style transform of an RA Billing into a Sales Invoice against the project's customer. |
| `export_ra_excel` | 511 | `export_ra_excel(ra_billing)` | Exports the RA bill (Abstract + line items) to XLSX. |
| `get_steel_details` | 2034 | `get_steel_details(project, from_date, to_date)` | Steel take-off detail lookup for a date range. |
| `get_level_sheet_details` | 2066 | `get_level_sheet_details(project)` | Fetches level/RL survey sheet data for a project. |
| `get_level_matrix` | 2145 | `get_level_matrix(project)` | Builds the level-survey formula matrix. |
| `calculate_level_matrix` | 2201 | `calculate_level_matrix(project, matrix)` | Applies the level-survey formulas to compute results. |
| `download_steel_template` | 2296 | `download_steel_template(rows)` | XLSX template generator for steel take-off import. |
| `import_steel_template` | 2468 | `import_steel_template(docname, file_url)` | Imports steel take-off rows from an uploaded XLSX file. |
| `contractor_billing.create_payment_entry` | `contractor_billing.py:160-161` | `create_payment_entry(source_name, target_doc=None)` | `frappe.model.mapper`-style transform of a Contractor Billing into a Payment Entry. |

## RA Billing Module (`bulk_ra_billing.py`, `task_level_sheet.py`)

| Endpoint | Source | Signature | Purpose |
|---|---|---|---|
| `bulk_ra_billing.get_projects_for_site` | `bulk_ra_billing.py:18-19` | `get_projects_for_site(site)` | Lists projects under a given Site for bulk RA billing selection. |
| `bulk_ra_billing.export_bulk_ra_excel` | `bulk_ra_billing.py:800-801` | `export_bulk_ra_excel(bulk_ra_billing)` | ~950-line multi-sheet openpyxl exporter covering multiple projects at once, including the steel-weight formula `d²/162`. |
| `task_level_sheet.get_depends_on_tasks` | `task_level_sheet.py:67-95` | `get_depends_on_tasks(doctype, txt, searchfield, start, page_len, filters)` | Link-query, same pattern as elsewhere. |
| `task_level_sheet.has_dependencies` | `task_level_sheet.py:96-97` | `has_dependencies(task)` | Returns whether a Task has dependency rows. |
| `task_level_sheet.get_stage_tasks` | `task_level_sheet.py:103-...` | `get_stage_tasks(doctype, txt, searchfield, start, page_len, filters)` | Link-query scoped to a project's Stage-level tasks. |

## Response Format

All endpoints follow Frappe's standard whitelisted-method convention: the Python return value is serialized into the JSON response envelope's `message` key, e.g.:

```json
{ "message": <return value> }
```

Errors raised via `frappe.throw(...)` return an HTTP error status with `{"exc_type": "...", "_server_messages": "..."}`; a few endpoints (notably `report_handler.get_report_html`) intentionally catch exceptions internally and return an HTML error string instead of raising, so the caller always receives HTTP 200 — see `docs/reports.md`.

## Example Request/Response

```
POST /api/method/quantbit_construction_management.api.link_boq_tasks_to_project
Content-Type: application/json
X-Frappe-CSRF-Token: <token>
Cookie: sid=<session-id>

{ "boq_name": "BOQ-2026-0001", "project_name": "PROJ-2026-0004" }
```

```json
{ "message": true }
```
