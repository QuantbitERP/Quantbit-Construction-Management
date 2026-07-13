# Changelog Notes

## Versioning

`quantbit_construction_management/__init__.py` declares `__version__ = "0.0.1"` — this has not been bumped as of this documentation pass, and no `bump-version`/release-tag pattern is in use (no git tags exist in the repository, confirmed via `git tag`). **No `CHANGELOG.md` or release-notes file exists in the repository.** This page reconstructs recent development activity from `git log`, since that is the only historical record available; it is not a substitute for a maintained changelog and should not be treated as authoritative release history.

## Recent Development Activity (from `git log`, most recent first)

The commit history (113 commits at the time of this documentation pass, all on a single `main` line with PR-merge commits from contributors `Santosh2624` and `Vedikapatil0027`) shows an actively developed app with work tracked against an external issue tracker (commit messages reference `TASK260####`-style IDs not resolvable from within this repository — treat those IDs as pointers to an external system, not as documentation of what changed beyond what the commit message itself states). Representative recent themes, grouped by area (exact commit subjects preserved where quoted):

- **RA Billing**: `"RA Bill update"`, `"RA Bill with tax"`, `"RA Billing"` (multiple commits) — consistent with `subcontractor_management.RA Billing` being the most actively evolved single controller in the codebase (`docs/modules.md#subcontractor-management`).
- **Task Level Sheet**: `"Task Level Sheet"` — corresponds to the `ra_billing` module's level-survey feature (`docs/modules.md#ra-billing`).
- **Data Sheet**: `"Data Sheet"` — corresponds to `Project`'s `custom_data_sheet_column` feature (`custom_get_columns` in `Project.js` / `tendering.custom_project.project.get_columns`, `docs/frontend.md`).
- **Workspace setup**: `"Create workspace for Construction Management System- for all modules"` — corresponds to the Workspace/Desktop Icon/Workspace Sidebar JSON files documented in `docs/frontend.md`.
- **Task progress / images**: `"Task progress adding multiple images in childtable"`, `"Site diary- Multiple images show which added into task progress"` — corresponds to `Task Progress Image` (`docs/doctypes.md`).
- **Weightage**: `"Weightage update"` — corresponds to the `task_weight` roll-up logic discussed throughout `docs/database.md` and `docs/known-limitations.md`.
- **BOQ/Project field visibility**: `"BOQ- show project field only when we create project from BOQ"` — a UI-conditional-visibility change on the BOQ↔Project relationship.
- Numerous **custom field** additions/changes (`"Custom field"`, `"Custom_site_engineer field change"`, `"Custom_shift field issue"`) — consistent with the app's heavy reliance on ERPNext Custom Fields (`docs/doctypes.md`, `docs/configuration.md`) as the primary extension mechanism onto ERPNext core DocTypes.

## How to Maintain This Page Going Forward

Since no changelog file existed prior to this documentation pass, recommended practice going forward (not currently followed in this repository):

1. Add a `CHANGELOG.md` at the repository root following [Keep a Changelog](https://keepachangelog.com/) conventions, or adopt a git-tag-based release process (`git tag vX.Y.Z`) so `__version__` in `__init__.py` has a corresponding, discoverable release point.
2. Bump `__version__` in `quantbit_construction_management/__init__.py` alongside meaningful releases.
3. Reference this file (`docs/changelog-notes.md`) from the root `README.md` alongside the rest of the documentation set, and update it (or the new `CHANGELOG.md`) as part of the PR process for user-facing changes.
