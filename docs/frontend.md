# Frontend

This app has **no separate frontend application** — there is no SPA, no `package.json`, no bundler config, and no `public/dist` build output in the repository. All UI is the standard Frappe **Desk** framework (server-rendered forms/list views + vanilla JavaScript client scripts), extended via the `doctype_js` hook and DocType JSON (Workspaces, Desktop Icons, Query Reports).

## Client Scripts (`doctype_js`)

Wired in `hooks.py:28-33`:

```python
doctype_js = {
  "Project" : "public/js/Project.js",
  "Task" : "public/js/Task.js",
  "Opportunity" : "public/js/Opportunity.js",
  "Stock Entry" : "public/js/Stock_Entry.js"
}
```

All four target **ERPNext core DocTypes**, not doctypes defined by this app — this is how the app injects construction-specific UI behavior into standard ERPNext forms without forking ERPNext itself.

### `public/js/Project.js` (~2,095 lines — by far the largest client script)

Implements a full **client-rendered Task hierarchy widget** embedded in the Project form (`custom_task_hierarchy` HTML field), replacing the default Task list/Gantt view for this app's purposes:

- Fetches the Project's (or a linked Bill of Quantities') Tasks via `frappe.client.get_list`, builds an in-memory tree (`build_tree`) keyed by `parent_task`, and recursively computes cost roll-ups (`compute_costs`: labour/equipment/material) and weighted progress roll-ups (`calculate_progress`) — see `docs/database.md#the-task-hierarchy-central-data-model`.
- Renders each node (Stage/Task/Child Task ×8 levels/Subtask, distinguished by `custom_is_stage`/`custom_is_task`/`custom_is_subtask`) as an expandable/collapsible custom HTML row with inline progress bars, cost strips, and action buttons (Show Details, Edit, Assign, Delete, Update).
- Enforces the **100%-weight-cap rule** among sibling nodes entirely client-side (`validate_total_weight`/`validate_task_weight`/`validate_subtask_weight`, each a `frappe.call` to `frappe.client.get_list` followed by an in-JS sum check) — there is no equivalent server-side guard (see `docs/known-limitations.md`).
- Enforces a **maximum hierarchy depth of 9 task levels** (plus a terminal Subtask), with UI warnings when the limit is reached.
- "Add Stage/Task/Child Task/Subtask" dialogs support both **freeform creation** (`frappe.client.insert`) and **template cloning** from an existing Stage/Task/Subtask via `quantbit_construction_management.api.clone_task_hierarchy`.
- Delete actions call `quantbit_construction_management.api.delete_task_with_dependencies` (`ignore_permissions=True` server-side — see `docs/permissions.md`).
- `render_report_view(frm)` embeds any Query Report's output inline via `quantbit_construction_management.report_handler.get_report_html` when `Project.custom_report_name_` is set.
- `custom_get_columns` calls `tendering.custom_project.project.get_columns` to populate a data-sheet child table from the Task hierarchy.

### `public/js/Task.js`

Small (~86 lines) — recalculates a Task's BOM/BOQ total (`calculate_task_bom_total`) from its `custom_bom_details` child table rows on `qty`/`rate` change, and derives `progress`/`custom_percent_completed` from `custom_total_quantity`/`custom_total_achieved` on those fields' change events.

### `public/js/Opportunity.js`

- Adds a **"Go to Tender"** button (redirects to the linked `Tender`) when `custom_tender_created` is set.
- Adds a **"Create Tender"** button when `workflow_state == "Go For Bid"` and no Tender is linked yet, opening a dialog that collects a Tender Name and calls `tendering.custom_crm.opportunity.create_tender_from_opportunity`.
- Restricts the `opportunity_from` field's Link query to `Customer`/`Lead` only.

### `public/js/Stock_Entry.js`

Implements **cascading, dependency-aware Link field visibility** across up to 11 `custom_task_level{1..11}` fields on `Stock Entry Detail` rows — as the user picks a Task at one level, the script calls the whitelisted `quantbit_construction_management.public.pythonn.stock_entry.has_dependencies`/`get_depends_on_tasks` to determine whether a deeper level field should be shown and what options it should offer, mirroring the Task-hierarchy depth model used in `Project.js`. (Note the unconventional `public/pythonn/` location for live, whitelisted Python endpoints — see `docs/known-limitations.md`.)

## Workspaces

Five Desk Workspaces are defined under `quantbit_construction_management/quantbit_construction_management/workspace/`, all under the `Quantbit Construction Management` module:

| Workspace | File | Links |
|---|---|---|
| Bill Of Quantity | `bill_of_quantity/bill_of_quantity.json` | 2 |
| CMS | `cms/cms.json` | 0 (title/intro-only landing page) |
| QC | `qc/qc.json` | 4 |
| Safety | `safety/safety.json` | 4 |
| Tendaring *(sic)* | `tendaring/tendaring.json` | 13 — Item Type, Cost Code Master, Tender Type, Tender Category, Opportunity Parameter, Tender, Post/Pre Bid Checklist, Bid Submission Checklist, Tender Deliverables, Invoicing Type, Contract Type |

`quantbit_construction_management/workspace_sidebar/` contains 6 additional JSON files (`bill_of_quantity`, `cms`, `daily_progress`, `qc`, `safety`, `tendering`) that mirror the same groupings for sidebar navigation.

## Desktop Icons

`quantbit_construction_management/desktop_icon/` defines 6 Desk module-home icons: Bill Of Quantity, CMS, QC, Safety, Tendering, Daily Progress — each a simple label/icon JSON, no embedded logic.

## Module Onboarding

`quantbit_construction_management/quantbit_construction_management/module_onboarding/construction/construction.json` defines one Module Onboarding record ("construction") with a single onboarding step, `create_item` (`onboarding_step/create_item/create_item.json`) — standard Frappe "getting started" checklist UI, not custom logic.

## Reports (UI Surface)

The 4 Query Reports (`docs/reports.md`) render through Frappe's standard Report View (filters + data table), with 2 of them (`task_wise_boq_analysis`, `boq_analysis_report`) additionally shipping a `.js` file to customize the Report View's filter fields/behavior client-side.

## Print Formats

**Not found in repository.** No `Print Format` DocType fixtures exist. The `daily_progress_report.html` file alongside the Daily Progress Report script (`docs/reports.md`) is a report-embedded HTML template, not a registered Print Format.

## Custom UI Components

Beyond the Project hierarchy widget (the most substantial custom UI in the app), no other custom Desk pages (`Page` DocType), custom list views, or Vue/React components were found. All UI is either standard Frappe Desk rendering or inline HTML strings generated by the client scripts above.
