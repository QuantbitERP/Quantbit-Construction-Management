# Troubleshooting

Issues below are derived from concrete patterns found in the source code, not hypothetical scenarios. Where a fix is known, it's stated; otherwise the workaround/diagnostic approach is given.

## "Create Tender" button never appears on a qualified Opportunity, or a Tender isn't auto-created

**Cause**: `tendering/custom_crm/opportunity.py`'s `on_update` handler checks for `workflow_state == "Tender created"` (lowercase "created"), but `Opportunity.js`'s dialog / `create_tender_from_opportunity` set the field to `"Tender Created"` (capital "C") in different code paths. If whatever sets `workflow_state` elsewhere uses one casing and the check uses the other, the automatic hand-off silently does nothing (no error — the condition simply doesn't match). See `docs/workflows.md`.

**Fix/workaround**: verify the exact `workflow_state` value stored on the Opportunity record (check via the Desk field, not just the visible label) against what the handler checks for; align casing, or make the comparison case-insensitive.

## Deleting a Task via the Project hierarchy widget removes it even though your user lacks Delete permission on Task

**Cause**: `api.py:delete_task_with_dependencies` (called from `Project.js`'s "Delete" button) uses `frappe.delete_doc(..., ignore_permissions=True, force=1)`. This is by design for the hierarchy widget's UX, but it means the permission check happens nowhere in that call path. See `docs/permissions.md` and `docs/api-reference.md`.

**Fix/workaround**: if this is unintended for your deployment, restrict who can access the Project form's hierarchy widget (e.g., via a client-side role check before rendering the Delete button), since the server-side call itself will not stop the operation.

## A cancelled "Material Issue" Stock Entry doesn't reduce a Task's material cost back down

**Cause**: `hooks.py`'s `doc_events` registers `Stock Entry.on_submit` → `update_task_material_cost`, which **adds** the issued amount to `Task.custom_total_material_cost`. There is **no** corresponding `Stock Entry.on_cancel` hook to subtract that amount back out. Cancelling (or amending) a Material Issue Stock Entry therefore leaves the Task's material cost permanently inflated. See `docs/backend.md`.

**Fix/workaround**: manually recompute `custom_total_material_cost` for the affected Task (re-sum all currently-submitted Material Issue Stock Entries referencing it) after cancelling one, until an `on_cancel` handler is added.

## `Task.status` won't change to "Completed" even though the task looks done

**Cause**: `overrides/task.py`'s `CustomTask.validate_status()` blocks the "Completed" transition while any task in `depends_on` is not itself `Completed`/`Cancelled`. This is intentional dependency enforcement, not a bug — check the Task's `Depends On` table for incomplete prerequisite tasks.

## Stage/Task/Subtask weight totals exceed 100% after a bulk import or a direct API call

**Cause**: the 100%-weight-cap rule (`task_weight` among siblings must sum to ≤100%) is enforced **only** in `Project.js`'s dialogs (`validate_total_weight`/`validate_task_weight`/`validate_subtask_weight`). Any Task created via `frappe.client.insert`, the Desk list view directly, `bill_of_quantities.py`'s import/clone methods, or a data import/API call bypasses this check entirely, since no Python controller enforces it. See `docs/known-limitations.md`.

**Fix/workaround**: audit weight totals manually (e.g., `frappe.db.sql` grouping by `parent_task`) after any bulk operation; do not rely on the UI dialogs alone to guarantee data integrity.

## A Query Report shows "Filter Warning" or a blank result

**Cause**: `report_handler.get_report_html` (used when embedding a report inside the Project form) catches exceptions and special-cases `NoneType`/`+` errors as a missing mandatory filter (commonly `company` or a date range), returning an inline warning instead of raising. See `docs/reports.md`.

**Fix/workaround**: check that the Project (or whichever form is embedding the report) has the fields the report's filters are auto-populated from (`company`, `expected_start_date`/`expected_end_date`) actually set.

## Weather doesn't populate on a Site Diary

**Cause**: `get_current_weather(lat, lon)` (`site_diary.py`) calls the free Open-Meteo API with a 10-second timeout and silently returns `None` on any failure (timeout, non-200 response, empty body, or any other exception), logging to the **Error Log** doctype under the title "Weather API" rather than surfacing anything to the user. See `docs/integrations.md`.

**Fix/workaround**: check the Frappe **Error Log** list (Desk) filtered to title "Weather API" for the underlying failure reason (network egress blocked, Open-Meteo rate limit, invalid lat/lon, etc.).

## A whitelisted bulk operation (Excel export, BOQ import, RA billing calculation) times out or hangs the browser on a large project

**Cause**: no background job/queue mechanism is used anywhere in this app (`docs/scheduler-and-background-jobs.md`) — every whitelisted method, including `bulk_ra_billing.export_bulk_ra_excel` (~950 lines) and `bill_of_quantities`'s import/duplicate methods, runs synchronously inside the web request and is subject to the web worker's request timeout.

**Fix/workaround**: for very large projects/BOQs, consider running the operation during low-traffic periods, increasing the Gunicorn/worker timeout at the bench level (outside this app's control), or — as a code change — wrapping the heaviest endpoints in `frappe.enqueue(...)` (see `docs/developer-guide.md`).

## `ImportError` or `AttributeError` referencing `create_stage_from_template`

**Cause**: `public/pythonn/test_clone.py` imports `create_stage_from_template` from `quantbit_construction_management.api`, but **no such function exists** anywhere in the repository (`api.py` only defines `get_template_subtasks`, `clone_task_hierarchy`, `link_boq_tasks_to_project`, `delete_task_with_dependencies`). This script is stale/broken and is not part of the app's real runtime path — see `docs/known-limitations.md`.

**Fix/workaround**: do not run `test_clone.py` as-is; if you need its intended behavior, use `api.clone_task_hierarchy` instead, which appears to be the function it was meant to call.

## Migrations run but nothing changes

**Cause**: `patches.txt` currently defines no patches in either `[pre_model_sync]` or `[post_model_sync]` (`docs/installation.md`). If you expected a data migration to run, it hasn't been written yet — schema (DocType JSON) changes are picked up automatically by `bench migrate`, but data transformations require an explicit patch.

**Fix/workaround**: write a patch module and register it in `patches.txt` following standard Frappe patch conventions.
