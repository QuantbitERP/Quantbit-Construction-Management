# Diagrams

This page indexes every diagram in the documentation set and adds one cross-cutting diagram (module dependencies) not shown elsewhere. All diagrams are Mermaid and render directly on GitHub/most Markdown viewers.

## Index

| Diagram | Location | Shows |
|---|---|---|
| System architecture | `docs/architecture.md#system-architecture` | Bench/app/process topology |
| Layered architecture | `docs/architecture.md#layered-architecture` | Presentation → API → Controller → Hook → Data layers |
| Request lifecycle | `docs/architecture.md#request-lifecycle` | Sequence diagram of a Desk `frappe.call` round-trip |
| Event lifecycle | `docs/architecture.md#event-lifecycle` | `hooks.py` `doc_events` wiring graph |
| Construction lifecycle | `docs/workflows.md#construction-lifecycle-end-to-end` | Opportunity → Tender → Project → execution modules |
| Tender Creation workflow | `docs/workflows.md#approval-flow-1-tender-creation-on-opportunity` | State machine (Opportunity) |
| Tender Submission workflow | `docs/workflows.md#approval-flow-2-tender-submission-on-tender` | State machine (Tender) |
| Entity relationships | `docs/database.md#entity-relationships-high-level` | Cross-module ER diagram |
| Task hierarchy | `docs/database.md#the-task-hierarchy-central-data-model` | Self-referential Stage/Task/Subtask tree |

## Module Dependency Graph

Derived from the Link-field and hook relationships documented in `docs/modules.md` and `docs/architecture.md`:

```mermaid
graph TD
    ERPNext["ERPNext Core<br/>(Task, Project, Opportunity, Stock Entry,<br/>Payment Entry, Purchase Invoice, Journal Entry, Item)"]
    Core["Quantbit Construction Management (Core)<br/>Costing engine, UOM, Site, masters"]
    Tendering["Tendering"]
    BOQ["BOQ"]
    SiteDiary["Site Diary"]
    QSM["Quality and Safety Management"]
    DocControl["Document Control"]
    Labour["Labour Management"]
    Subcontractor["Subcontractor Management"]
    RABilling["RA Billing"]
    ProgBilling["Progress Measurement & Billing"]
    Billing["Billing (reserved, no DocTypes)"]

    ERPNext --> Core
    ERPNext --> Tendering
    ERPNext --> SiteDiary
    ERPNext --> Subcontractor
    Core --> Tendering
    Core --> BOQ
    Tendering --> BOQ
    BOQ --> Core
    Core --> SiteDiary
    Core --> Subcontractor
    Core --> QSM
    Core --> DocControl
    Core --> Labour
    Core --> ProgBilling
    Subcontractor --> RABilling
    Core --> RABilling
    Subcontractor -.->|"hooks.py doc_events<br/>(Payment Entry / Purchase Invoice / Journal Entry)"| ERPNext
    SiteDiary -.->|"hooks.py doc_events<br/>(Stock Entry.on_submit)"| ERPNext
    Tendering -.->|"hooks.py doc_events<br/>(Opportunity.on_update)"| ERPNext

    style Billing stroke-dasharray: 5 5
```

Solid arrows = Link-field or explicit API dependency (source module reads/writes target module's DocTypes). Dashed arrows = `hooks.py` `doc_events` reacting to an ERPNext-core event. `Billing` is dashed/empty because it declares no DocTypes (see `docs/modules.md#billing`).

## RA Billing Computation Flow (Sequence)

Illustrates how a subcontractor RA bill is produced, based on `subcontractor_management.RA Billing`'s whitelisted methods (`docs/modules.md#subcontractor-management`, `docs/doctypes.md`):

```mermaid
sequenceDiagram
    participant User
    participant RAForm as RA Billing Form (JS)
    participant RACtrl as ra_billing.py (whitelisted methods)
    participant Task as Task hierarchy
    participant DB as MariaDB

    User->>RAForm: Select Project + measurement mode (direct / dimensional formula / steel)
    RAForm->>RACtrl: frappe.call(get_task_wise_data / compute methods)
    RACtrl->>Task: Read stage→task→10-level hierarchy + previously billed qty
    Task-->>RACtrl: Task tree + custom_boq_name-linked BOQ rates
    RACtrl->>RACtrl: Compute qty (direct, no1×no2×length×width×height, or bar dia²/162 → MT)
    RACtrl->>RACtrl: qty × rate per task, roll up per stage into Abstract<br/>(carry-forward previous cumulative totals)
    RACtrl-->>RAForm: grand_total / final_grand_total (+ optional tax)
    User->>RAForm: Submit
    RAForm->>RACtrl: frappe.call(on_submit path)
    RACtrl->>Task: Write back billed quantities (prevents double-billing)
    RACtrl->>DB: Optionally create Sales Invoice against project's customer
```

## BOQ → Project Conversion Flow

```mermaid
sequenceDiagram
    participant User
    participant BOQForm as Bill of Quantities Form
    participant BOQCtrl as bill_of_quantities.py
    participant API as api.py (clone_task_hierarchy)
    participant Task as Task (ERPNext)

    User->>BOQForm: Import BOQ tasks (XLSX template)
    BOQForm->>BOQCtrl: import_boq_tasks(file)
    BOQCtrl->>Task: Create Stage → Task → Subtask rows (custom_boq_name = this BOQ)
    User->>BOQForm: create_project_from_boq
    BOQForm->>BOQCtrl: create_project_from_boq()
    BOQCtrl->>Task: Re-parent / link BOQ's Task tree to the new Project
    Note over API: Project.js also exposes an equivalent path via<br/>link_boq_tasks_to_project + clone_task_hierarchy for<br/>ad-hoc stage/task/subtask creation from templates
```
