# Backend

## Python Packages

The backend is a single installable Python package, `quantbit_construction_management` (declared in `pyproject.toml`, built with `flit_core`). It has no internal sub-packages beyond the Frappe-mandated `<module>/doctype/<doctype>/` layout — there is no `services/`, `repositories/`, or similar layered-architecture package. App-root modules act as the closest thing to a "shared services" layer:

| File | Role |
|---|---|
| `hooks.py` | App manifest — fixtures, `doc_events`, `override_doctype_class`, `doctype_js` (see `docs/configuration.md`) |
| `api.py` | Whitelisted Task-hierarchy operations shared across Project/Task UI (`docs/api-reference.md`) |
| `utils.py` | `generate_unique_8_digit_number` (secondary human-readable IDs) and `convert_uom_or_warn` (whitelisted UOM conversion) |
| `report_handler.py` | Generic whitelisted Query-Report-to-HTML renderer |
| `overrides/task.py` | `CustomTask(Task)` — ERPNext Task class override |
| `<module>/custom_crm/opportunity.py`, `<module>/custom_project/project.py`, `<module>/custom_stock/stock_entry.py` | Hook-handler modules for ERPNext core DocTypes, not new DocTypes themselves |

## Services

**Not found in repository.** There is no dedicated service layer, dependency-injection container, or business-logic module separate from DocType controllers. Business logic lives directly in `<doctype>.py` files (see `docs/doctypes.md`) and the handful of app-root utility files above.

## Utility Functions

- **`utils.generate_unique_8_digit_number(doctype, fieldname)`** (`utils.py:5-17`) — loops `random.randint(10000000, 99999999)` until `frappe.db.exists(doctype, {fieldname: number})` is `False`. Used in `before_insert` hooks across Subcontractor Management (`SC Bill.bill_no`, `SC Work Order.wo_no`, `SC Payment Certificate.cert_no`, `Subcontract Agreement.sca_no`) and Document Control doctypes to generate secondary, human-friendly reference numbers distinct from the document's Frappe `name`.
- **`utils.convert_uom_or_warn(from_uom, to_uom, value)`** (`utils.py:20-60`, whitelisted) — see `docs/api-reference.md`.
- **`report_handler.get_report_html(report_name, filters=None)`** (whitelisted) — see `docs/reports.md`.

## Whitelisted APIs

See `docs/api-reference.md` for the full list (65 `@frappe.whitelist()` occurrences across the codebase; 2 additional occurrences are commented out — dead code, see `docs/known-limitations.md`).

## Hooks (`hooks.py`)

See `docs/configuration.md` for the full table of active hooks. This section documents **what each `doc_events` handler actually does**, since that is the app's primary cross-cutting backend logic.

### `Opportunity.on_update` → `tendering.custom_crm.opportunity.on_update`

- **Source**: `quantbit_construction_management/tendering/custom_crm/opportunity.py`
- Fires on every save of an ERPNext `Opportunity`. Watches for the Opportunity's tender-creation trigger condition and, when met, auto-creates a linked `Tender` document, with rollback/error-reversion handling if creation fails (per the researching agent's findings — see `docs/workflows.md` for the exact state-name mismatch bug this exposes: the check looks for `workflow_state == "Tender created"` while `create_tender_from_opportunity` sets `"Tender Created"`).

### `Stock Entry.on_submit` → `site_diary.custom_stock.stock_entry.update_task_material_cost`

- **Source**: `quantbit_construction_management/site_diary/custom_stock/stock_entry.py`
- Guards on `doc.docstatus == 1` and `doc.stock_entry_type == "Material Issue"` (returns immediately otherwise — other Stock Entry types, e.g. Material Receipt/Transfer, do **not** affect Task cost).
- Sums `row.amount` per `row.custom_subtask or row.custom_task` across `doc.items`.
- For each affected Task, reads the current `custom_total_material_cost` via `frappe.db.get_value`, **adds** the new total (cumulative, not a replace/overwrite), and writes it back via `frappe.db.set_value` followed by an explicit `frappe.db.commit()`.
- ⚠️ Because it uses `frappe.db.set_value` (not `doc.save()`), no `Task.validate()`/`on_update` hooks fire for this cost update, and the accumulation is **not idempotent** — resubmitting or amending the same Stock Entry (if ever cancelled and recreated) would double-count unless handled elsewhere. See `docs/known-limitations.md`.

### `Payment Entry.on_submit` / `on_cancel` → `contractor_billing.on_payment_entry_submit` / `on_payment_entry_cancel`

- **Source**: `quantbit_construction_management/subcontractor_management/doctype/contractor_billing/contractor_billing.py:196-200`
- Both call `update_payment_status(doc)`, which:
  1. Collects candidate `Contractor Billing` names — either directly from the Payment Entry's own `custom_doc_link_doctype`/`custom_doc_link` fields, or indirectly by walking `Payment Entry.references` and resolving each referenced `Purchase Invoice`/`Journal Entry`'s own `custom_doc_link` back to a Contractor Billing.
  2. Calls `sync_contractor_billing_payment_status(cb_name)` for each.

### `Purchase Invoice.on_update` → `contractor_billing.on_purchase_invoice_update`

- If the Purchase Invoice's `custom_doc_link_doctype == "Contractor Billing"`, calls `sync_contractor_billing_payment_status(doc.custom_doc_link)`.

### `Journal Entry.on_update` → `contractor_billing.on_journal_entry_update`

- Same pattern as Purchase Invoice, for Journal Entries linked back to a Contractor Billing.

### `sync_contractor_billing_payment_status(cb_name)` (shared logic, not itself a hook)

- **Source**: `contractor_billing.py:228-...`
- Loads the `Contractor Billing` document and recomputes `is_paid`/`paid_amount`/`outstanding_amount` against `billing.grand_total`:
  - If a linked `Purchase Invoice` exists (`custom_doc_link_doctype == "Contractor Billing"`), sums `Payment Entry Reference.allocated_amount` for submitted (`docstatus == 1`) Payment Entries referencing that invoice.
  - Otherwise falls back to summing **direct** `Payment Entry` records whose `custom_doc_link_doctype`/`custom_doc_link` point straight at the Contractor Billing (bypassing an intermediate Purchase Invoice), plus any linked `Journal Entry`.
  - Caps `paid_amount` at `grand_total`; treats `outstanding_amount <= 0.005` as fully paid (`is_paid = 1`).
  - Writes the recomputed `paid` flag onto each `Contractor Billing Details` child row via `reference_row_name`, propagating payment status down to the underlying usage records.
- **`create_payment_entry(source_name, target_doc=None)`** (whitelisted, `contractor_billing.py:161-194`) — the "Get Payment Entry" mapped-doc transform (`frappe.model.mapper.get_mapped_doc`) that creates a Payment Entry pre-filled from a Contractor Billing, including setting `custom_doc_link_doctype`/`custom_doc_link` so the reverse-sync above can find its way back.

## Background Jobs

**None.** No `frappe.enqueue(...)` calls exist anywhere in this app's Python source (confirmed by repository-wide search). All whitelisted methods — including the heaviest ones, `bulk_ra_billing.export_bulk_ra_excel` (~950 lines) and `bill_of_quantities`'s 14 methods — execute synchronously within the HTTP request. See `docs/scheduler-and-background-jobs.md` and `docs/known-limitations.md` for the performance implications.

## Scheduled Jobs

**None.** `hooks.py`'s `scheduler_events` block is present only as a commented-out template (`hooks.py:304-323`). See `docs/scheduler-and-background-jobs.md`.

## Event Handlers

Covered above (the five `doc_events` entries). Additionally, per-DocType lifecycle methods (`validate`, `before_save`, `on_submit`, `before_submit`, `on_cancel`, `before_insert`) are implemented directly on individual Document subclasses — see each DocType's "Validation / Server Logic" section in `docs/doctypes.md`. Two DocTypes stand out for non-trivial event logic beyond simple validation:
- **`Costing`** (`costing.py`) — the cost-estimation engine (`docs/modules.md#quantbit-construction-management-core`).
- **`Daily Progress Tracking`** (`daily_progress_tracking.py`) — `before_save` plus a recursive `update_parent_progress` that walks up the Task tree updating weighted progress.
- **`Task` override** (`overrides/task.py`) — `CustomTask.validate_status()` blocks marking a Task "Completed" while any of its `depends_on` tasks are not `Completed`/`Cancelled`, then calls ERPNext's `close_all_assignments`.
