# Configuration

## App Manifest (`hooks.py`)

All app-level configuration lives in `quantbit_construction_management/hooks.py`. Actually-enabled settings (as opposed to the many commented-out template blocks Frappe scaffolds by default) are:

| Setting | Value | Purpose |
|---|---|---|
| `app_name` / `app_title` / `app_publisher` / `app_description` / `app_email` / `app_license` | see `hooks.py:1-6` | App metadata shown in the Frappe "Apps" page and `bench` tooling |
| `override_doctype_class` | `{"Task": "quantbit_construction_management.overrides.task.CustomTask"}` | Replaces ERPNext's `Task` controller with `CustomTask`, which overrides `validate_status()` (`overrides/task.py`) |
| `doctype_js` | `Project`, `Task`, `Opportunity`, `Stock Entry` → files under `public/js/` | Injects extra client-side JS into these (mostly ERPNext-owned) DocType forms without modifying ERPNext itself |
| `fixtures` | Custom Field / UOM / UOM Conversion Rate / Accounting Dimension ("Site") / Role (10 roles) / Item Type / Contract Type / Property Setter / Workflow State / Workflow Action Master / Workflow | Data exported with the app so a fresh install/migrate recreates the same master data and approval workflow — see `hooks.py:35-164` |
| `doc_events` | `Opportunity.on_update`, `Stock Entry.on_submit`, `Payment Entry.on_submit`/`on_cancel`, `Purchase Invoice.on_update`, `Journal Entry.on_update` | Cross-DocType event wiring — see `docs/backend.md` and `docs/architecture.md#event-lifecycle` |

Source: `quantbit_construction_management/hooks.py:284-302` (doc_events), `:35-164` (fixtures), `:24-33` (override_doctype_class / doctype_js).

Everything else in `hooks.py` — `required_apps`, `home_page`, `role_home_page`, `website_generators`, `jinja`, `before_install`/`after_install`, `before_uninstall`/`after_uninstall`, `before_app_install`/`after_app_install`, `notification_config`, `permission_query_conditions`, `has_permission`, `scheduler_events`, `before_tests`, `extend_doctype_class`, `override_whitelisted_methods`, `override_doctype_dashboards`, `auto_cancel_exempted_doctypes`, `ignore_links_on_delete`, `before_request`/`after_request`, `before_job`/`after_job`, `user_data_fields`, `auth_hooks`, `export_python_type_annotations`, `default_log_clearing_doctypes`, `ignore_translatable_strings_from` — are present only as **commented-out templates** in `hooks.py:167-414`. None of these are active. If you need any of them, they must be implemented; do not assume they exist today.

## Site-Level Configuration

No `site_config.json` fragment, custom `common_site_config.json` keys, or environment-variable reads (`os.environ`, `frappe.conf.get(...)`) were found anywhere in this app's Python source (confirmed by repository-wide search for `site_config`/`common_site_config`). All configuration is therefore either:
1. Standard Frappe/bench site configuration (managed outside this repo), or
2. In-app "Settings" single DocTypes: `Billing Settings` (`quantbit_construction_management/quantbit_construction_management/doctype/billing_settings/`) and `Site Diary Settings` (`quantbit_construction_management/site_diary/doctype/site_diary_settings/`) — see `docs/doctypes.md` for their fields.

## Module Registration

`quantbit_construction_management/modules.txt` lists the 11 Module Def names that Frappe uses to group DocTypes in the Desk sidebar and in `bench export-fixtures`. Adding a new module requires adding a line here plus a matching `Module Def` fixture/record — see `docs/developer-guide.md`.

## Custom Fields, Property Setters, and Workflow Configuration

These are **not hardcoded** in Python — they live as exported fixture JSON under `quantbit_construction_management/fixtures/` (`custom_field.json`, `property_setter.json`, `workflow.json`, `workflow_state.json`, `workflow_action_master.json`, `role.json`, `accounting_dimension.json`, `contract_type.json`, `item_type.json`, `uom.json`, `uom_conversion_rate.json`, `price_list.json`). Because they are declared as `fixtures` in `hooks.py`, running `bench --site <site> migrate` (which triggers a fixture sync on export) or `bench --site <site> import-fixtures` will (re)apply them. Any change to Custom Fields, Property Setters, or Workflow states/transitions in the target site for this module should be re-exported via `bench --site <site> export-fixtures --app quantbit_construction_management` to keep the repository fixtures in sync — see `docs/developer-guide.md`.

## Client-Side Configuration

Client scripts are wired declaratively via the `doctype_js` hook rather than the `Client Script` DocType, meaning they ship with the app code and are version-controlled (`quantbit_construction_management/public/js/Project.js`, `Task.js`, `Opportunity.js`, `Stock_Entry.js`). No `Client Script` DocType records were found as fixtures — "Not found in repository" for any Desk-configured (non-code) client scripts.
