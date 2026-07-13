# Permissions

## Roles

### Custom Roles Shipped by This App

Ten custom Roles are exported as fixtures (`quantbit_construction_management/fixtures/role.json`) and installed via the `fixtures` hook (`hooks.py:63-82`):

| Role | `desk_access` | `disabled` |
|---|---|---|
| All | 1 | 0 |
| Analyzer | 1 | 0 |
| Technical Evaluator | 1 | 0 |
| Financial Evaluator | 1 | 0 |
| Sales Evaluator | 1 | 0 |
| Top Management | 1 | 0 |
| Business Developer | 1 | 0 |
| Preliminary Approver | 1 | 0 |
| Commercial Approver | 1 | 0 |
| Business Head | 1 | 0 |

Source: `quantbit_construction_management/fixtures/role.json`. Every one of these roles (except `All`, which is a built-in Frappe role) exists specifically to drive the two Frappe Workflows documented in `docs/workflows.md` — each is the `allow_edit`/`allowed` role for exactly one workflow state or transition on `Opportunity` or `Tender`.

### Standard Frappe/ERPNext Roles Referenced

DocType permission tables and report role lists across this app also reference standard roles that ship with Frappe/ERPNext itself (not defined by this app, but relied upon): `System Manager`, `Sales User`, `Sales Manager`, `Projects User`, `HR User`, `HR Manager`.

## Permission Manager Settings (Role Permissions Manager)

Aggregated from every DocType's `permissions` array across `docs/doctypes.md` (131 DocTypes):

- **`System Manager`** is granted full CRUD (and Submit/Cancel/Amend where the DocType is submittable) on effectively every custom DocType in the app — the dominant, near-universal permission row.
- **`All`** is granted **read-only** access on a large subset of DocTypes (mostly masters and log/record doctypes), giving any logged-in user with the built-in `All` role read visibility without write access.
- **Workflow-specific roles** (`Sales User`, `Sales Manager`, `Preliminary Approver`, `Commercial Approver`, `Top Management`, `Business Head`) appear explicitly in the `Tender` DocType's permission table with `read: 1, write: 1` at `permlevel: 0` — consistent with them being the approver roles for the Tender Submission workflow (`docs/workflows.md`).
- **Field-level permission (`permlevel`) usage is minimal**: only one field in the entire app is restricted above `permlevel 0` — `Tender.confidential_documents_details` (the tender's confidential-documents child table) is set to `permlevel: 4`. **No role in `Tender`'s permissions array is granted `permlevel: 4` read/write** (all seven roles are `permlevel: 0`), meaning this field is effectively hidden from every role except System Manager (who has implicit access to all permlevels) — see `docs/known-limitations.md` for the risk this creates (the field may be unintentionally inaccessible to the business roles that are supposed to see confidential tender documents, e.g. `Top Management`/`Business Head`).
- Most other DocTypes across the 11 modules follow a simple two-row pattern: `System Manager` (full access) + `All` (read-only) — see individual entries in `docs/doctypes.md` for exact per-DocType tables, especially any deviation from this pattern (e.g., report role restrictions in `docs/reports.md`).

## User Permissions

No `User Permission` records are shipped as fixtures, and no code in this app creates/queries `User Permission` records programmatically (no `frappe.get_all("User Permission", ...)` or `add_user_permission` calls found in the repository). **Not found in repository.**

## Custom Permission Queries

`hooks.py` provides `permission_query_conditions` and `has_permission` hook templates, but both are **commented out** (`hooks.py:265-271`):

```python
# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }
```

No active `permission_query_conditions` or `has_permission` hooks are registered by this app. All row-level access control is therefore whatever the standard Frappe Role Permissions Manager (the per-DocType `permissions` arrays referenced above) enforces — there is no additional server-side filtering (e.g., "only see records for your own Site/Project") implemented in code. This is called out as a potential gap in `docs/known-limitations.md`, since a construction ERP with multi-project/multi-site tenancy commonly needs row-level restriction by Project or Site, and none was found.

## Whitelisted-Method Authorization

Whitelisted (`@frappe.whitelist()`) methods in this app rely on Frappe's default authorization behavior: the caller must be logged in (session-authenticated), and any `frappe.get_doc`/`frappe.db.sql` operations inside the method are subject to standard DocType permissions **unless** the method explicitly passes `ignore_permissions=True`. Several deletion helpers do so explicitly, e.g. `api.py:delete_task_with_dependencies` calls `frappe.delete_doc(..., ignore_permissions=True, force=1)` — meaning any authenticated user who can reach that whitelisted endpoint can delete a `Task` and its `Task Depends On` rows regardless of their own Delete permission on `Task`. This pattern (whitelisted method + `ignore_permissions=True`) should be reviewed wherever it appears — see `docs/known-limitations.md` and `docs/api-reference.md`.
