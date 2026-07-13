# Developer Guide

This guide describes how to extend this app following the conventions already established in the codebase (see `docs/coding-guidelines.md` for style rules, and `docs/architecture.md`/`docs/modules.md` for where things belong).

## How to Add a DocType

1. **Pick the right module.** Check `quantbit_construction_management/modules.txt` and `docs/modules.md` — DocTypes live under `quantbit_construction_management/<module_snake_case>/doctype/<doctype_snake_case>/`. If genuinely cross-cutting, prefer the `quantbit_construction_management` (core) module, matching the pattern used for `Costing`, `Site`, and the UOM masters.
2. **Use the Desk UI or `bench` to scaffold it** (`bench --site <site> new-doctype ...` or via Desk's "New DocType" form with Module set correctly), then let Frappe generate the `<doctype>.json`/`.py`/`.js`/`__init__.py` files.
3. **Naming**: follow the dominant pattern for the DocType's role (see `docs/database.md#naming-strategy`):
   - Transactional/submittable documents → `naming_series:` with a `PREFIX-.YYYY.-` (or `.####`) series, matching sibling doctypes in the same module (e.g. `SCB-`, `WO-`, `RAB-`).
   - Simple masters → `field:<fieldname>` (like `Site`) or autoincrement.
   - If a secondary human-readable ID is also needed (distinct from `name`), reuse `quantbit_construction_management.utils.generate_unique_8_digit_number(doctype, fieldname)` in `before_insert`, matching `SC Bill.bill_no`/`SC Work Order.wo_no`/etc.
4. **Permissions**: at minimum, add `System Manager` (full CRUD, + Submit/Cancel/Amend if submittable) and, if the record should be broadly visible, `All` with read-only — this is the pattern used by the overwhelming majority of existing DocTypes (`docs/permissions.md`). Add specific business roles only when the DocType participates in an approval flow (see the `Tender` permission table as a reference for adding workflow-approver roles).
5. **Link the Task hierarchy correctly, if relevant.** Many modules attach to the existing `Task`/`Project` hierarchy via a `project` Link plus either a direct `task`/`subtask` Link or the flattened `task_level1`…`task_level10` + `level{N}_subject` field pattern (used by Site Diary/RA Billing for SQL-joinable hierarchy position — see `docs/database.md`). Reuse this pattern rather than inventing a new hierarchy representation.
6. **Register fixtures if needed** (new Roles, Workflow States/Actions, Custom Fields, Property Setters) by adding them to `hooks.py`'s `fixtures` list (`hooks.py:35-164`) and running `bench --site <site> export-fixtures --app quantbit_construction_management` after creating them on a dev site, so they're captured as JSON under `fixtures/`.
7. **Migrate**: `bench --site <site> migrate`.

## How to Create APIs

Follow the existing whitelisted-method conventions (`docs/api-reference.md`):

```python
import frappe

@frappe.whitelist()
def my_new_endpoint(project, some_arg=None):
    # standard Frappe permission checks apply automatically unless
    # you explicitly pass ignore_permissions=True to ORM calls —
    # avoid ignore_permissions unless there's a specific, documented reason
    # (see docs/permissions.md for the existing cases where it's used)
    ...
    return result
```

- Put the function in the relevant DocType's `<doctype>.py` if it operates on that DocType's data (the dominant pattern — e.g. `bill_of_quantities.py`'s 14 methods), or in the app-root `api.py`/`utils.py` if it's a cross-doctype helper (matching `clone_task_hierarchy`/`convert_uom_or_warn`).
- Link-field search/query endpoints should follow the `get_depends_on_tasks`-style signature `(doctype, txt, searchfield, start, page_len, filters)` and be decorated with both `@frappe.whitelist()` and `@frappe.validate_and_sanitize_search_inputs` (used consistently across Site Diary/RA Billing/Costing — see `docs/api-reference.md`).
- **Do not** put live, whitelisted business logic under `public/` — the existing `public/pythonn/stock_entry.py` is a known deviation from convention (see `docs/known-limitations.md`), not a pattern to repeat. Whitelisted endpoints belong in a DocType controller or an app-root utility module.
- For anything that could run long (bulk import/export, large hierarchy operations), consider `frappe.enqueue(...)` — no endpoint in this app currently does this (`docs/scheduler-and-background-jobs.md`), so introducing it for a new heavy endpoint would be a deliberate improvement, not a deviation from convention.

## How to Add Reports

Match the existing Query Report pattern (`docs/reports.md`):

1. Create a `Report` DocType record (or `bench` scaffold) with `report_type: "Script Report"`, `ref_doctype` set to the primary DocType the report is about, and roles restricted to whoever should see it (existing reports range from `System Manager`-only to `System Manager` + `All`).
2. Implement `execute(filters=None)` returning `(columns, data)`, with a separate `get_columns()`/`get_data(filters)` split (every existing report follows this decomposition).
3. Prefer raw `frappe.db.sql` with named parameters (`%(param)s` + a values dict) for joins across child/parent tables, matching `equipment_usage_disel_details.py` and `daily_progress_report.py`; use in-memory Python grouping (like `boq_analysis_report.py`'s `task_group`/`subtask_group` dicts) when the source data is already a loaded document's child table rather than requiring a fresh query.
4. If the report needs to be embeddable inside a form (like `Project.custom_html_view`), no extra work is needed — the existing `report_handler.get_report_html` can render **any** Query Report by name.

## How to Add Workflows

Follow the pattern in `docs/workflows.md` (`fixtures/workflow.json`, `workflow_state.json`, `workflow_action_master.json`):

1. Design states and transitions in the Desk Workflow Builder (`Workflow` DocType) against the target `document_type`.
2. Create any new approval Roles needed (matching the existing `Analyzer`/`Technical Evaluator`/.../`Business Head` naming style — short, business-meaningful role names) and add them to `hooks.py`'s `fixtures` Role filter (`hooks.py:63-82`).
3. Export the Workflow, Workflow State, and Workflow Action Master fixtures (`bench export-fixtures`) and add their names to the corresponding filters in `hooks.py:100-163`.
4. **Avoid the case-sensitivity trap** documented in `docs/workflows.md` — if other code checks `doc.workflow_state == "..."`, make sure the exact casing matches what the workflow actually sets (the existing `"Tender created"` vs `"Tender Created"` mismatch is a cautionary example, not something to replicate).
5. Decide whether the target DocType should actually be `is_submittable: 1` — note that `Tender` is **not** submittable despite having workflow-driven states with a `before_submit()` hook; be intentional about which mechanism (docstatus vs. workflow_state) governs your new document's lifecycle.

## How to Write Tests

**No test suite currently exists in this app** (no `test_*.py` files under any `doctype/` folder, and no `tests/` directory — confirmed by repository-wide search). The only test-shaped files found, `public/pythonn/check_stages.py` and `public/pythonn/test_clone.py`, are standalone debug scripts that call `frappe.init()`/`frappe.connect()` directly and are **not** discovered or run by `bench run-tests` (see `docs/known-limitations.md`; `test_clone.py` also references a function, `create_stage_from_template`, that does not exist anywhere in `api.py`, confirming these scripts are stale).

To add real tests, follow standard Frappe convention (not yet present here, but this is the expected shape):

```python
# quantbit_construction_management/boq/doctype/bill_of_quantities/test_bill_of_quantities.py
import frappe
from frappe.tests.utils import FrappeTestCase

class TestBillOfQuantities(FrappeTestCase):
    def test_contract_value_rollup(self):
        ...
```

Run with:

```bash
bench --site <site> run-tests --app quantbit_construction_management
```

Given the scale of untested business logic (the RA Billing engine, Costing roll-ups, BOQ hierarchy operations — see `docs/known-limitations.md`), prioritize tests for: (1) the `Costing.get_costing` cost-roll-up cascade, (2) `RA Billing`'s quantity/amount computation across its three measurement modes, (3) `Bill of Quantities`' template import/clone/duplicate methods, and (4) the two workflows in `docs/workflows.md`.

## Following Project Conventions

- **Formatting/linting**: `ruff` (Python), `eslint`/`prettier` (JS) via `pre-commit` — see `docs/coding-guidelines.md`. Run `pre-commit install` once per clone (`README.md`).
- **Module placement**: match business domain, not technical layer — this app organizes by module (Tendering, BOQ, Site Diary, ...), not by type (no `models/`/`views/`/`controllers/` split).
- **Shared child tables**: several child DocTypes (`Material Details`, `Work Details`, `Labour Entry Details`) are reused as child tables across multiple parent DocTypes rather than duplicated per-module — prefer reusing an existing child DocType over creating a near-duplicate.
- **Hierarchy conventions**: reuse the `custom_is_stage`/`custom_is_task`/`custom_is_subtask` + `parent_task` pattern (not a new tree mechanism) whenever a new feature needs to attach to project structure.
