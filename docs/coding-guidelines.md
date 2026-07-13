# Coding Guidelines

These rules are sourced directly from the repository's own tooling configuration (`pyproject.toml`, `.eslintrc`, `.pre-commit-config.yaml`) plus conventions observably followed across the existing codebase.

## Python (ruff)

Configuration: `pyproject.toml:22-61`.

- **Target/format**: `line-length = 110`; formatter uses **double quotes** and **tab indentation** (`quote-style = "double"`, `indent-style = "tab"` — note this app's Python source uses tabs in some files and spaces in others; new code should use tabs per the formatter config, though `E101`/`W191` (mixed tabs/spaces, tab indentation) are explicitly ignored so this is not strictly enforced today — see `docs/known-limitations.md`).
- **Enabled lint rule groups**: `F` (Pyflakes), `E`/`W` (pycodestyle), `I` (import sorting), `UP` (pyupgrade), `B` (bugbear), `RUF` (Ruff-specific).
- **Explicitly ignored rules** (do not "fix" these if you see them in existing code — they're intentionally allowed): `B017`, `B018`, `B023`, `B904`, `E101`, `E402`, `E501` (line length not hard-enforced despite the 110 setting), `E741`, `F401` ("unused" imports — common in Frappe controllers that import for side effects/whitelisting), `F403`/`F405` (star imports), `F722`, `W191`, `UP030`/`UP031`/`UP032`/`UP037`/`UP040` (mostly translation-string-related pyupgrade rules, disabled because Frappe's `_()` translation calls rely on % / `.format()` patterns that pyupgrade would otherwise "modernize" incorrectly).
- **`typing-modules = ["frappe.types.DF"]`** — Frappe's typed-field annotation module is recognized by ruff's typing-aware rules.
- Run `ruff check` and `ruff format` via `pre-commit` before committing (`.pre-commit-config.yaml` runs ruff's import-sorter, linter, and formatter as three separate hooks).

## JavaScript (ESLint / Prettier)

Configuration: `.eslintrc`.

- Extends `eslint:recommended` in a browser + Node + ES2022 environment, `sourceType: "module"`.
- **Explicitly turned off**: `indent`, `brace-style`, `no-mixed-spaces-and-tabs`, `no-useless-escape`, `linebreak-style`, `quotes`, `semi`, `camelcase`, `no-unused-vars`, `no-extra-boolean-cast`, `no-control-regex` — i.e., this app does **not** enforce a specific quote style, semicolon usage, or indentation style via lint; `prettier` (also run via pre-commit) handles formatting instead.
- **`no-console`** is a **warning** (not an error) — existing code should avoid leaving `console.log` in committed client scripts, but it won't block a commit.
- A large `globals` allowlist declares the full Frappe Desk global surface (`frappe`, `cur_frm`, `flt`, `cstr`, `__`, jQuery `$`, Frappe's Gantt/DataTable/Awesomplete third-party globals, etc.) — client scripts should rely on these globals rather than importing/requiring them, matching every existing `public/js/*.js` file (plain `frappe.ui.form.on(...)` scripts, no `import`/`require`/bundler).

## Pre-commit Hooks

`.pre-commit-config.yaml` runs, in order, on every commit (`default_stages: [pre-commit]`, `fail_fast: false` — all hooks run even if an earlier one fails):

1. `pre-commit-hooks`: trailing-whitespace (scoped to `quantbit_construction_management.*`, excluding JSON/txt/csv/md/svg), merge-conflict markers, `check-ast`, `check-json`, `check-toml`, `check-yaml`, `debug-statements`.
2. `ruff` import sorter (`--select=I --fix`), `ruff` linter, `ruff-format`.
3. `prettier` (JS/Vue/SCSS), excluding `public/dist/`, `node_modules`, `boilerplate`, `templates/includes/`, `public/js/lib/`.
4. `eslint --quiet` (JS only), same exclusions as prettier.

Install once per clone: `cd apps/quantbit_construction_management && pre-commit install` (`README.md:17-22`).

## Naming Conventions Observed in Existing Code

- **DocType folder/file names**: `snake_case` matching the DocType's name lowercased with spaces→underscores (Frappe convention, followed consistently — e.g. `Bill of Quantities` → `bill_of_quantities/`).
- **Custom field prefix**: fields added by this app onto ERPNext core DocTypes (Task, Project, Opportunity, Stock Entry) consistently use the `custom_` prefix (Frappe's own Custom Field convention), e.g. `custom_is_stage`, `custom_boq_name`, `custom_total_material_cost`.
- **Hierarchy depth fields**: consistently named `task_level1` … `task_level10` (or `_level11` in `Stock Entry Detail`) with matching `level{N}_subject` label fields — reuse this exact naming if extending hierarchy-aware child tables.
- **Secondary reference numbers**: `<short_prefix>_no` Data fields generated via `utils.generate_unique_8_digit_number` (`bill_no`, `wo_no`, `cert_no`, `sca_no`).
- **Whitelisted "get" helpers**: consistently named `get_<noun>` (`get_boq_details`, `get_task_bom_details`, `get_material_deliveries`) — action-performing whitelisted methods use a verb prefix (`create_`, `update_`, `delete_`, `import_`, `export_`, `download_`, `duplicate_`, `clone_`, `link_`).

## Things to Avoid (per `docs/known-limitations.md`)

- Do not add new business logic under `public/` (Python) — reserve `public/` for actual static assets; `public/pythonn/stock_entry.py` is a pre-existing deviation, not a pattern to extend.
- Do not leave commented-out duplicate functions in place of deleting them (e.g. `site_diary.py`'s commented `update_daily_activity_progress_table` alongside the live one) — delete dead code rather than commenting it out.
- Do not rely on `workflow_state` string literals matching across files without a shared constant — the `"Tender created"` vs `"Tender Created"` mismatch documented in `docs/workflows.md` is the concrete cautionary example.
- Avoid `frappe.db.sql`/`frappe.db.set_value` + manual `frappe.db.commit()` when `frappe.get_doc(...).save()` would trigger the correct validation/hooks — used sparingly and intentionally in the current code (e.g. `api.link_boq_tasks_to_project`) for bulk updates, but should not become the default pattern for single-document writes.
