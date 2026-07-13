# Installation

This app is installed the same way as any Frappe app, using the `bench` CLI. The instructions below are sourced from the repository's own `README.md` and general `bench`/Frappe conventions (Frappe/ERPNext installation mechanics themselves are not part of this repository, so those steps reference the standard `bench` toolchain rather than app-specific code).

## Prerequisites

- A working **Frappe Bench** environment (Frappe, plus `bench` CLI). Not found in this repository — provisioned separately per standard Frappe setup (Python, Node.js, Redis, MariaDB/Postgres, wkhtmltopdf, yarn).
- **Python ≥ 3.10** — `pyproject.toml:7` (`requires-python = ">=3.10"`).
- **The `erpnext` app installed on the same site**, because this app overrides ERPNext's `Task` DocType class (`quantbit_construction_management/overrides/task.py:3`, `import ... from erpnext.projects.doctype.task.task import Task`) and hooks into ERPNext's `Opportunity`, `Stock Entry`, `Payment Entry`, `Purchase Invoice`, and `Journal Entry` DocTypes (`quantbit_construction_management/hooks.py:284-302`). This dependency is **not declared** in `hooks.py`'s `required_apps` (that line is commented out — `hooks.py:11`), so `bench install-app` will not enforce it automatically; ERPNext must be installed on the target site first.
- A Frappe site already created (`bench new-site <site-name>`).

## Bench Setup

```bash
# 1. Create (or reuse) a bench
bench init frappe-bench --frappe-branch version-15   # or the branch matching your Frappe version
cd frappe-bench

# 2. Get ERPNext (required dependency — see Prerequisites above)
bench get-app erpnext --branch version-15

# 3. Create a site
bench new-site quantbit-construction-management.local

# 4. Install ERPNext on the site
bench --site quantbit-construction-management.local install-app erpnext
```

The exact `--branch` values above are illustrative defaults, not values found in this repository (the app's own dependency on `frappe` is commented out in `pyproject.toml:10-12`, so no version is pinned here).

## App Installation

Per the repository's own `README.md`:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch main
bench install-app quantbit_construction_management
```

Source: `README.md:5-13`.

This registers the app's fixtures on install/migrate, including (from `quantbit_construction_management/hooks.py:35-164`):
- Custom Fields belonging to the "Quantbit Construction Management" module
- `UOM` and `UOM Conversion Rate` masters
- An Accounting Dimension named `Site`
- Ten custom Roles (`Preliminary Approver`, `Commercial Approver`, `Top Management`, `Business Head`, `Analyzer`, `Technical Evaluator`, `Financial Evaluator`, `Sales Evaluator`, `Business Developer`, `All`)
- `Item Type` and `Contract Type` masters
- Property Setters scoped to this module
- Workflow States, Workflow Action Masters, and two Workflows (`Tender Submission`, `Tender Creation`) — see `docs/workflows.md`

## Developer Mode Setup (for contributing)

`README.md:15-22` documents the `pre-commit` setup used for this repository:

```bash
cd apps/quantbit_construction_management
pre-commit install
```

Pre-commit runs: `ruff` (import sort + lint + format), `eslint`, `prettier`, and `pyupgrade`-equivalent checks (via `ruff --select=UP`), plus generic hygiene checks (trailing whitespace, merge-conflict markers, JSON/TOML/YAML/AST validation, debug-statement detection). Source: `.pre-commit-config.yaml`.

## Migration Commands

Standard `bench`/Frappe migration commands apply (this repository defines DocType schema via JSON files under each `doctype/` folder, which `bench migrate` synchronizes to the database):

```bash
bench --site <site-name> migrate
```

`quantbit_construction_management/patches.txt` defines two patch hook sections, `[pre_model_sync]` and `[post_model_sync]`, both currently **empty** (no data migration patches are registered in this repository):

```
[pre_model_sync]
# Patches added in this section will be executed before doctypes are migrated

[post_model_sync]
# Patches added in this section will be executed after doctypes are migrated
```

Source: `quantbit_construction_management/patches.txt`.

## Build Commands

No frontend build step is defined by this app — there is no `package.json`, bundler config, or `public/dist` build pipeline in the repository (confirmed by directory search: only `public/js/*.js` and `public/pythonn/*.py` exist under `public/`). Client scripts are loaded directly via the `doctype_js` hook (`hooks.py:28-33`) and are served as-is by Frappe's asset pipeline (`bench build` still applies at the bench level to bundle/minify assets across all installed apps, but this app contributes no bundler-specific configuration of its own).

```bash
bench build --app quantbit_construction_management   # optional, bundles/minifies this app's public assets via Frappe's build system
```
