# Project Overview

## Purpose

Quantbit Construction Management is a custom [Frappe Framework](https://frappeframework.com/) application that adds a construction-project management layer on top of [ERPNext](https://erpnext.com/). It is defined in `quantbit_construction_management/hooks.py` with:

```python
app_name = "quantbit_construction_management"
app_title = "Quantbit Construction Management"
app_publisher = "QTPL"
app_description = "construction management system"
app_email = "support@erpdata.in"
app_license = "mit"
```

Source: `quantbit_construction_management/hooks.py:1-6`

## Business Problem

The app models the end-to-end lifecycle of a construction contracting business, from **pre-sales/tendering** through **site execution** to **billing and contractor payments**. This is evidenced by the module list in `quantbit_construction_management/modules.txt`:

```
Quantbit Construction Management
Site Diary
Tendering
Document Control
BOQ
Labour Management
Subcontractor Management
Quality and Safety Management
Progress Measurement & Billing
Billing
RA Billing
```

Each module corresponds to a distinct business capability (see `docs/modules.md` for details):

- **Tendering** – opportunity/tender qualification, bid submission checklists, and award tracking, built on top of ERPNext's CRM `Opportunity` and Projects `Project`/`Task`.
- **BOQ (Bill of Quantities)** – quantity take-off, rate analysis, revisions, and task-level costing.
- **Site Diary** – daily site records: manpower, equipment usage, material receipt, task progress, visitor logs.
- **Document Control** – drawing register/revisions, RFIs, transmittals.
- **Labour Management** – gangs, skills, attendance.
- **Quality and Safety Management** – inspections (ITP/NCR), incident reports, risk register, toolbox talks.
- **Subcontractor Management** – subcontract agreements, work orders, subcontractor (SC) bills, RA billing, payment certificates, and reconciliation against ERPNext `Payment Entry`/`Purchase Invoice`/`Journal Entry`.
- **Progress Measurement & Billing** and **RA Billing** – progress claims/certificates and running-account (RA) bill generation, including bulk RA billing across multiple projects.
- **Billing** – present in `modules.txt` as a module name; no DocTypes currently exist under `quantbit_construction_management/billing/doctype/` other than the package `__init__.py` (source: directory listing). Treat as reserved/placeholder — "Not found in repository" for implemented functionality beyond `billing_settings`, which is filed under the core `quantbit_construction_management` module instead.

## Scope

In scope (present in the repository):
- 131 custom DocTypes across the 11 modules above (see `docs/doctypes.md`).
- Server-side business logic (Python controllers, `@frappe.whitelist()` APIs) and client-side scripts (`.js`) for those DocTypes.
- Customizations/overrides of ERPNext core DocTypes: `Task` (class override), `Project`, `Opportunity`, `Stock Entry` (via Custom Fields + hooks + `doctype_js`).
- 4 Query Reports (2 under BOQ, 2 under Site Diary).
- A Frappe Workflow-driven Opportunity → Tender qualification and approval pipeline.
- Fixtures for custom Roles, Workflow definitions, Custom Fields, Property Setters, UOM/UOM Conversion data, an Accounting Dimension ("Site"), Item Type, and Contract Type.

Out of scope / not present (do not assume these exist):
- No REST/webhook integrations with external third-party systems were found (see `docs/integrations.md`).
- No `scheduler_events` are registered in `hooks.py` (the block is commented out) — see `docs/scheduler-and-background-jobs.md`.
- No automated test suite (`pytest`/`unittest`) was found under the app; only ad-hoc scripts in `quantbit_construction_management/public/pythonn/` (see `docs/known-limitations.md`).

## Technology Stack

| Layer | Technology | Source |
|---|---|---|
| Application framework | Frappe Framework (app built with `bench`) | `README.md`, `quantbit_construction_management/hooks.py` |
| Base ERP | ERPNext (`Task`, `Project`, `Opportunity`, `Stock Entry`, `Payment Entry`, `Purchase Invoice`, `Journal Entry` are extended/hooked) | `quantbit_construction_management/overrides/task.py:3`, `quantbit_construction_management/hooks.py` (`doc_events`, `override_doctype_class`) |
| Backend language | Python ≥ 3.10 | `pyproject.toml:7` (`requires-python = ">=3.10"`) |
| Backend build system | `flit_core` | `pyproject.toml:14-16` |
| Database | MariaDB/MySQL (standard Frappe/ERPNext datastore; accessed via `frappe.db.sql` raw queries throughout the app, e.g. `quantbit_construction_management/utils.py:36-51`) | inferred from `frappe.db.sql` usage — Frappe itself supports MariaDB (default) and PostgreSQL |
| Frontend | Frappe Desk framework (`frappe.ui.form.on`, `frappe.call`, `frappe.ui.Dialog`) — plain JavaScript, no separate SPA/build step for this app | `quantbit_construction_management/public/js/*.js` |
| Linting/formatting | `ruff` (Python), `eslint`/`prettier` (JS), `pyupgrade` | `pyproject.toml:22-61`, `.pre-commit-config.yaml`, `.eslintrc` |
| CI hooks | `pre-commit` (trailing whitespace, JSON/TOML/YAML checks, ruff, prettier, eslint) | `.pre-commit-config.yaml` |

## Frappe Version

Not pinned in this repository. `pyproject.toml` explicitly comments out the Frappe dependency:

```toml
dependencies = [
    # "frappe~=16.0.0" # Installed and managed by bench.
]
```

Source: `pyproject.toml:10-12`. The comment names Frappe `~=16.0.0` as the version historically used, but because it is commented out, the actual installed version is whatever the hosting `bench` environment provides — treat "Frappe v16" as indicative, not a guaranteed/enforced pin.

## Python Version

`requires-python = ">=3.10"` (`pyproject.toml:7`). Ruff is additionally configured with `target-version = "py314"` (`pyproject.toml:24`), i.e. lint/format rules target Python 3.14 syntax while the actual minimum supported runtime is 3.10.

## Dependencies

- **Runtime Python dependencies**: none declared explicitly in `pyproject.toml` beyond what `bench`/Frappe provides (the `dependencies` list is empty; the `frappe` line is commented out). Source: `pyproject.toml:10-12`.
- **Implicit dependency on ERPNext**: the app imports from and hooks into ERPNext DocTypes (`erpnext.projects.doctype.task.task.Task` in `overrides/task.py`, plus `doc_events` on `Opportunity`, `Stock Entry`, `Payment Entry`, `Purchase Invoice`, `Journal Entry`, all ERPNext DocTypes). This is a hard runtime dependency even though it is not declared in `hooks.py`'s `required_apps` (which is commented out in `hooks.py:11`).
- **Dev dependencies**: `[tool.bench.dev-dependencies]` is empty (`pyproject.toml:19-20`).
- **Pre-commit tool versions**: `pre-commit-hooks v6.0.0`, `ruff-pre-commit v0.14.10`, `mirrors-prettier v2.7.1`, `mirrors-eslint v8.44.0` (`.pre-commit-config.yaml`).

## License

MIT — `license.txt`, and `app_license = "mit"` in `hooks.py:6`.
