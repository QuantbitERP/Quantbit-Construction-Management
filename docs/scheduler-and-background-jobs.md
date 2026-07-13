# Scheduler and Background Jobs

## Summary

This app registers **no scheduled jobs and no background/queued jobs**. Every whitelisted method and every hook handler runs synchronously within the web request that triggered it. This was confirmed by a repository-wide search for:

- `scheduler_events` — only appears in `hooks.py` as a commented-out template (`hooks.py:304-323`):

  ```python
  # scheduler_events = {
  # 	"all": [
  # 		"quantbit_construction_management.tasks.all"
  # 	],
  # 	"daily": [
  # 		"quantbit_construction_management.tasks.daily"
  # 	],
  # 	"hourly": [
  # 		"quantbit_construction_management.tasks.hourly"
  # 	],
  # 	"weekly": [
  # 		"quantbit_construction_management.tasks.weekly"
  # 	],
  # 	"monthly": [
  # 		"quantbit_construction_management.tasks.monthly"
  # 	],
  # }
  ```
  No `quantbit_construction_management/tasks.py` file exists in the repository — the module path referenced in the template doesn't exist, confirming this was never activated.
- `frappe.enqueue` / `frappe.enqueue_doc` — zero occurrences anywhere under `quantbit_construction_management/`.
- `before_job` / `after_job` — only present as a commented-out template (`hooks.py:366-369`).

## Implications

Every long-running or bulk operation in this app runs **inline** on the request/response cycle, including:

- `bulk_ra_billing.export_bulk_ra_excel` (~950 lines of Excel-generation logic across multiple projects/sheets).
- `bill_of_quantities.import_boq_tasks` / `duplicate_boq` (bulk Task-tree creation, potentially hundreds of Task documents per call).
- `ra_billing.py`'s Excel import/export and level-matrix calculation methods.
- `costing.get_costing` (recursive Task-hierarchy cost roll-up).

None of these are wrapped in `frappe.enqueue`, so they are subject to the web worker's request timeout (Frappe's default Gunicorn worker timeout, typically 120s, is not overridden anywhere in this repository) and will block the handling worker process for their full duration. See `docs/known-limitations.md` for the scaling risk this creates as project/task counts grow.

## What Would Be Needed to Add a Scheduled or Background Job

Not implemented, but for reference (standard Frappe mechanism): a scheduled job requires (1) a Python function, (2) an entry in `hooks.py`'s `scheduler_events` dict under `"all"`/`"hourly"`/`"daily"`/`"weekly"`/`"monthly"` or a cron-string key, and (3) the site's scheduler enabled (`bench --site <site> scheduler resume`). A background job requires wrapping a call in `frappe.enqueue("dotted.path.to.function", queue="default"|"short"|"long", **kwargs)` from within a request handler, and at least one `bench worker` process running to consume the queue. See `docs/developer-guide.md` for a suggested approach that would benefit this app's heaviest endpoints.
