# Quantbit Construction Management

A construction project management application built on the [Frappe Framework](https://frappeframework.com/) and [ERPNext](https://erpnext.com/). It extends ERPNext's `Task`, `Project`, `Opportunity`, and `Stock Entry` DocTypes with 131 custom DocTypes across 11 modules to cover the full construction contracting lifecycle — from tendering through site execution to subcontractor and client billing.

Full technical documentation is in [`docs/`](docs/README.md).

## Features

- **Tendering** — Opportunity qualification workflow, bid checklists, tender creation/approval workflow, and conversion into a fully-structured Project.
- **BOQ (Bill of Quantities)** — quantity take-off, rate analysis, revisions, and BOQ → Task-hierarchy → Project conversion, with Excel import/export.
- **Task hierarchy engine** — a deep, self-referential Stage → Task → Child Task (×8 levels) → Subtask model layered onto ERPNext's `Task`, with client- and server-side cost/progress roll-ups.
- **Site Diary** — daily manpower, equipment usage (with diesel tracking), material receipt/delivery, task progress, and visitor logs, plus a Daily Progress Report.
- **Document Control** — drawing register/revisions, RFIs, shop drawings, transmittals.
- **Labour Management** — gangs, skills, bulk attendance capture.
- **Quality and Safety Management** — inspection test plans/lots, NCRs, incident reports, risk register, toolbox talks.
- **Subcontractor Management** — subcontract agreements, work orders, SC bills, and a running-account (RA) billing engine reconciled against ERPNext Payment Entries, Purchase Invoices, and Journal Entries.
- **RA Billing (bulk/multi-project) & Progress Measurement & Billing** — bulk running-account billing tooling, level surveys, progress claims/certificates.
- **BOQ/Task-wise Analysis, Daily Progress, and Equipment Diesel Usage reports.**

See [`docs/modules.md`](docs/modules.md) for full per-module detail and [`docs/doctypes.md`](docs/doctypes.md) for every DocType.

## Technology Stack

- **Framework**: Frappe Framework (installed/managed via `bench`; ERPNext required as a runtime dependency — not declared in `hooks.py`, see [`docs/project-overview.md`](docs/project-overview.md))
- **Backend**: Python ≥ 3.10 (`pyproject.toml`)
- **Database**: MariaDB/Postgres via the Frappe ORM (standard Frappe deployment)
- **Frontend**: Frappe Desk framework — plain JavaScript client scripts (`public/js/`), no separate SPA/build step
- **Linting/formatting**: ruff (Python), eslint + prettier (JavaScript), enforced via `pre-commit`

See [`docs/project-overview.md`](docs/project-overview.md) for the full stack breakdown.

## Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI. **ERPNext must already be installed on the target site** (see [`docs/installation.md`](docs/installation.md) for why):

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch main
bench install-app quantbit_construction_management
```

For prerequisites, migrations, and build commands, see [`docs/installation.md`](docs/installation.md). For production deployment (workers, scheduler, Nginx/Supervisor), see [`docs/deployment.md`](docs/deployment.md).

## Documentation

Full documentation lives in [`docs/`](docs/README.md):

| | |
|---|---|
| [Project Overview](docs/project-overview.md) | [Architecture](docs/architecture.md) | [Diagrams](docs/diagrams.md) |
| [Installation](docs/installation.md) | [Configuration](docs/configuration.md) | [Deployment](docs/deployment.md) |
| [Modules](docs/modules.md) | [DocTypes](docs/doctypes.md) | [Database](docs/database.md) |
| [Workflows](docs/workflows.md) | [API Reference](docs/api-reference.md) | [Permissions](docs/permissions.md) |
| [Reports](docs/reports.md) | [Backend](docs/backend.md) | [Frontend](docs/frontend.md) |
| [Scheduler & Background Jobs](docs/scheduler-and-background-jobs.md) | [Integrations](docs/integrations.md) | [Developer Guide](docs/developer-guide.md) |
| [Coding Guidelines](docs/coding-guidelines.md) | [Troubleshooting](docs/troubleshooting.md) | [Known Limitations](docs/known-limitations.md) |
| [Changelog Notes](docs/changelog-notes.md) | | |

## Development Guide

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/quantbit_construction_management
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

See [`docs/coding-guidelines.md`](docs/coding-guidelines.md) for the full rule set and naming conventions, and [`docs/developer-guide.md`](docs/developer-guide.md) for how to add a DocType, API endpoint, report, or workflow in a way that's consistent with the rest of the codebase.

## Contributing

1. Fork/branch, and follow the conventions in [`docs/coding-guidelines.md`](docs/coding-guidelines.md).
2. Run `pre-commit install` (above) so formatting/linting runs automatically on commit.
3. No automated test suite currently exists in this repository — see [`docs/known-limitations.md`](docs/known-limitations.md) and [`docs/developer-guide.md#how-to-write-tests`](docs/developer-guide.md#how-to-write-tests) for the recommended approach if you're adding tests.
4. Open a pull request describing the change; large or architecturally significant changes should reference the relevant section of [`docs/architecture.md`](docs/architecture.md) or [`docs/modules.md`](docs/modules.md).

## License

MIT — see [`license.txt`](license.txt).
