# Integrations

## External APIs

### Open-Meteo Weather API

The **only** outbound third-party HTTP integration found anywhere in this app's source (repository-wide search for `requests.`/`smtplib`/`webhook`/`frappe.sendmail` found exactly one hit).

- **Source**: `quantbit_construction_management/site_diary/doctype/site_diary/site_diary.py:719-758`, function `get_current_weather(lat, lon)` (whitelisted).
- **Provider**: [Open-Meteo](https://open-meteo.com/) forecast API — `https://api.open-meteo.com/v1/forecast`.
- **Authentication**: **None** — Open-Meteo's free forecast endpoint requires no API key.
- **Request**: `GET` with query params `latitude`, `longitude`, `current=temperature_2m,wind_speed_10m,weather_code`, `daily=temperature_2m_max,temperature_2m_min`, `timezone=auto`; 10-second timeout (`requests.get(url, params=params, timeout=10)`).
- **Response handling**: returns a dict `{temp, wind_speed_kmh, weather_code, max_temp, min_temp}` extracted from the API's `current`/`daily` blocks. Non-OK HTTP status, an empty body, a timeout, or any other exception are all caught and logged via `frappe.log_error(..., "Weather API")`, with the function returning `None` rather than raising — callers must handle a `None` result.
- **Consumer**: called from the Site Diary form (client-side, via `frappe.call`) to auto-populate `weather_am`/`weather_pm`-style fields with current site conditions.
- **Reliability note**: because failures are silently logged and swallowed, a Site Diary can be saved successfully even if the weather lookup fails — there is no retry or fallback data source. See `docs/known-limitations.md`.

## Email

**Not found in repository.** No `frappe.sendmail(...)` calls, no custom Email Template/Notification DocType fixtures, and no `send_email_alert`-enabled Workflow states (`send_email: 1` is technically set on Workflow State transitions per `docs/workflows.md`'s fixture data, but that is standard Frappe Workflow email-alert behavior, not app-specific code — no custom email content/logic was found in this app's Python source).

## Webhooks

**Not found in repository.** No Frappe `Webhook` DocType fixtures, and no inbound webhook receiver endpoints (`allow_guest=True` whitelisted methods) exist in this app.

## Third-Party Integrations

- **ERPNext** — not a "third-party integration" in the usual sense but the app's foundational dependency; see `docs/architecture.md` and `docs/project-overview.md` for the full extent of the coupling (`override_doctype_class`, `doc_events` on five ERPNext DocTypes, and pervasive Link fields to ERPNext masters).
- **`openpyxl`** (implied) — `bulk_ra_billing.export_bulk_ra_excel`, `ra_billing.export_ra_excel`/`download_steel_template`/`import_steel_template`, and `bill_of_quantities.download_boq_task_template`/`import_boq_tasks` all read/write `.xlsx` files, which in the Frappe/ERPNext ecosystem is conventionally done via `openpyxl` or `frappe`'s bundled Excel utilities — the exact import statement was not captured verbatim by this documentation pass; treat "Excel import/export" as confirmed functionality and the specific library as "Not found in repository" pending direct verification of the `import openpyxl` (or equivalent) statement in those files. `openpyxl`/Excel handling is **not** declared as an explicit dependency in `pyproject.toml`, meaning it is expected to already be available via Frappe's own dependency tree.
- **No payment gateway, SMS gateway, or cloud storage (S3/GCS) integration** was found in this app's source.

## Authentication Methods

- **End-user authentication**: standard Frappe session-based login (handled entirely by the framework; this app defines no custom login page, SSO, or `auth_hooks` — the `auth_hooks` template in `hooks.py:398-400` is commented out).
- **API authentication**: standard Frappe API key/secret (`Authorization: token <key>:<secret>`) for the whitelisted endpoints in `docs/api-reference.md` — no app-specific token scheme.
- **Outbound (to Open-Meteo)**: none required, per above.
