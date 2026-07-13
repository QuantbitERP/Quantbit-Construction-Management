# Quantbit Construction Management - Technical Application Process Document

## 1. Document Control

| Item | Details |
| --- | --- |
| Application | Quantbit Construction Management |
| Framework | Frappe Framework / ERPNext app |
| Document type | Technical process document |
| Business domain | Construction management customization |
| Repository package | `quantbit_construction_management` |
| Scope | Technical design and implementation approach for construction-specific custom logic |

## 2. Purpose

This document describes the technical structure of the Quantbit Construction Management Frappe application. It explains how the application is organized, how it extends Frappe/ERPNext, and how construction business processes are implemented through DocTypes, controllers, client scripts, fixtures, workspaces, reports, overrides, and hooks.

## 3. Application Architecture

```text
Frappe / ERPNext Core
        │
        ├── Standard DocTypes: Project, Task, Opportunity, Lead, Customer, Stock Entry, Item, etc.
        │
        └── Quantbit Construction Management App
                ├── Construction-specific modules and DocTypes
                ├── Custom fields and property setters
                ├── Workflow fixtures and role fixtures
                ├── Doctype Python controllers
                ├── Doctype JavaScript controllers
                ├── Public JavaScript overrides for ERPNext forms
                ├── Reports
                ├── Workspaces and desktop/sidebar entries
                └── Task class override and utility APIs
```

The app follows standard Frappe app conventions. Each construction module contains DocType metadata in JSON, server-side controller classes in Python, optional client-side JavaScript, and tests where available.

## 4. Repository Structure

| Path | Purpose |
| --- | --- |
| `quantbit_construction_management/hooks.py` | App metadata, DocType class overrides, form JavaScript injection, fixtures, and Frappe hook configuration. |
| `quantbit_construction_management/modules.txt` | Registered Frappe modules for construction business areas. |
| `quantbit_construction_management/fixtures/` | Exported custom fields, roles, workflows, workflow actions, accounting dimensions, UOMs, property setters, and construction masters. |
| `quantbit_construction_management/tendering/` | Tendering DocTypes plus custom CRM/project extensions. |
| `quantbit_construction_management/boq/` | BOQ, BOQ item, rate analysis, revisions, and BOQ reports. |
| `quantbit_construction_management/site_diary/` | Site diary DocTypes, stock customizations, and site execution reports. |
| `quantbit_construction_management/document_control/` | Drawing, revision, transmittal, shop drawing, and RFI DocTypes. |
| `quantbit_construction_management/labour_management/` | Labour, gang, attendance, category, and skill DocTypes. |
| `quantbit_construction_management/quality_and_safety_management/` | Quality, inspection, NCR, risk, incident, safety, and toolbox talk DocTypes. |
| `quantbit_construction_management/subcontractor_management/` | Contractor, subcontract, work order, RA billing, SC billing, and payment certificate DocTypes. |
| `quantbit_construction_management/progress_measurement_&_billing/` | Progress claims, progress certificates, deductions, disputes, and earned value DocTypes. |
| `quantbit_construction_management/ra_billing/` | Bulk RA billing, task/level sheet, project data sheet, formula, and tax detail DocTypes. |
| `quantbit_construction_management/public/js/` | Client-side customizations injected into ERPNext standard forms. |
| `quantbit_construction_management/overrides/` | Python overrides for standard ERPNext behavior, including Task. |
| `quantbit_construction_management/workspace_sidebar/`, `desktop_icon/`, and workspace JSON files | UI navigation entries for construction modules. |

## 5. Frappe Hook Configuration

The application is registered as `quantbit_construction_management` with the title `Quantbit Construction Management`. The hook configuration defines construction-specific behavior including:

- Overriding the standard Task DocType class with `quantbit_construction_management.overrides.task.CustomTask`.
- Injecting custom JavaScript into standard ERPNext forms: Project, Task, Opportunity, and Stock Entry.
- Exporting fixtures for construction custom fields, UOMs, accounting dimension `Site`, roles, item types, contract types, property setters, workflow states, workflow action masters, and workflows.

## 6. Technical Modules and Main DocTypes

### 6.1 Tendering

**Technical package:** `quantbit_construction_management/tendering`

**Primary DocTypes:** Tender, Tender Type, Tender Category, Contract Type, Invoicing Type, Item Type, Opportunity Parameter, Tender Item, Tender Documents, Tender Confidential Documents, Tender Corrigendum, Tender Deliverables, Deliverable Details, Pre Bid Checklist, Bid Submission Checklist, Post Bid Checklist, Technical Qualification Details, Financial Qualification Details, Sales Recommendation Details, Tender Competitor Details, Cost Code Master, Project Warehouse Details, Task BOQ Details.

**Implementation notes:**

- Custom CRM modules extend Opportunity behavior for construction tender evaluation.
- Custom project logic supports transition from won tender to construction project setup.
- Workflow fixtures provide approval states and actions for tender creation/submission.

### 6.2 BOQ

**Technical package:** `quantbit_construction_management/boq`

**Primary DocTypes:** Bill of Quantities, BOQ Item, BOQ Rate Analysis, BOQ Revision, BOQ Task Details.

**Implementation notes:**

- BOQ DocTypes provide contractual quantity/rate data.
- BOQ task details provide the link between project execution tasks and BOQ measurement.
- BOQ revision records support version control for scope/rate changes.

### 6.3 Core Construction Management

**Technical package:** `quantbit_construction_management/quantbit_construction_management`

**Primary DocTypes:** Site, Construction Type, Construction Measures, Costing, Costing Task, Work Details, Costing Work Details, Material Costing, Equipment, Equipment Costing, Worker Master, Worker Type, Worker Costing, Daily Progress Tracking, DPR Activity Progress, Task Summary, Billing Settings, BOQ Amendment Log, UOM Conversion Rate, UOM Conversion Table, Material Details, Labour Entry Details.

**Implementation notes:**

- Provides central construction setup data used by execution, costing, and billing modules.
- Site is also configured as an accounting dimension fixture for site-wise tracking.
- Costing and resource DocTypes support planned material, equipment, and labour control.

### 6.4 Site Diary

**Technical package:** `quantbit_construction_management/site_diary`

**Primary DocTypes:** Site Diary, Site Diary Settings, Manpower Log, Manpower Usage, Manpower Usage Details, Material Received, Site Material Delivery, Site Equipment Log, Equipment Usage, Equipment Usage Details, Equipment Usage Diesel Details, Project Visitor, Site Visitor Log, Task Progress, Task Progress Details, Task Progress Image, RA Billing Steel Details.

**Reports:** Daily Progress Report, Equipment Usage Diesel Details.

**Implementation notes:**

- Custom Stock Entry and Item customizations connect site records with material movement.
- Site diary records are operational evidence for progress, resource usage, and billing.
- Report scripts provide server-side report datasets and report JavaScript provides client report behavior.

### 6.5 Document Control

**Technical package:** `quantbit_construction_management/document_control`

**Primary DocTypes:** Drawing Register, Drawing Revision, Transmittal, Transmittal Drawing, Shop Drawing, RFI.

**Implementation notes:**

- Drawing revision and transmittal details enable controlled document distribution.
- Client scripts support user interactions on drawing, transmittal, RFI, and shop drawing forms.
- Server controllers are available for validation and document lifecycle logic.

### 6.6 Labour Management

**Technical package:** `quantbit_construction_management/labour_management`

**Primary DocTypes:** Labour Category, Gang, Gang Member, Labour Attendance Bulk Entry, Labour Attendance Row, Labour Entry Details, Skill Matrix, Skill Record.

**Implementation notes:**

- Labour management separates workforce masters, gang grouping, attendance capture, and skill records.
- Attendance rows function as child records for bulk attendance entry.

### 6.7 Quality and Safety Management

**Technical package:** `quantbit_construction_management/quality_and_safety_management`

**Primary DocTypes:** Quality Plan, Quality Plan ITP, Inspection Test Plan, ITP Item, Inspection Lot, Inspection Result, NCR, Incident Report, Incident CA, Safety Observation, Risk Register, Risk Item, Toolbox Talk, JBT Attendee, MS Activity.

**Implementation notes:**

- Quality plan and ITP DocTypes define required construction inspection checkpoints.
- NCR, incident, corrective-action, and safety DocTypes record compliance exceptions and closure.

### 6.8 Subcontractor Management

**Technical package:** `quantbit_construction_management/subcontractor_management`

**Primary DocTypes:** Contractor, Subcontract Agreement, SC Work Order, WO Item, Site Diary Contractor Item Details, RA Billing, RA Billing Details, RA Abstract Details, Contractor Billing, Contractor Billing Details, SC Bill, SC Bill Item, SC Payment Certificate, SC Payment Deduction.

**Implementation notes:**

- Work order and RA billing details connect subcontract scope with measured progress.
- Payment certificate and deduction DocTypes support commercial settlement.

### 6.9 Progress Measurement & Billing

**Technical package:** `quantbit_construction_management/progress_measurement_&_billing`

**Primary DocTypes:** Progress Claim, Progress Claim Item, Progress Certificate, Cert Deduction, Claim Included VO, Disputed BOQ Item, Earned Value Record.

**Implementation notes:**

- Progress claim and certificate DocTypes separate claimed quantities/values from certified values.
- Disputed BOQ Item supports exception tracking.
- Earned Value Record supports project controls and performance reporting.

### 6.10 RA Billing

**Technical package:** `quantbit_construction_management/ra_billing`

**Primary DocTypes:** Bulk RA Billing, Bulk RA Billing Projects Details, Bulk RA Bill Tax Details, RA Billing Tax Details, Task Level Sheet, Task Level Sheet Details, RA Bill Level Sheet Details, Level Task Details, Project Data Sheet Column Details, Project Formulas Details.

**Implementation notes:**

- Bulk RA billing supports multi-project or consolidated RA billing preparation.
- Task-level and level-wise sheets support detailed quantity/value calculation.
- Formula details and project data sheet columns support configurable billing computation.
- Tax detail child records support tax calculations for RA billing outputs.

## 7. Data Flow

```text
Tendering DocTypes
      ↓
Project / Task / Site / Costing / BOQ Setup
      ↓
Document Control + Site Diary + Labour + Material + Equipment Records
      ↓
Quality & Safety Validation and Exceptions
      ↓
Subcontractor Measurement and Billing
      ↓
Progress Claim / Progress Certificate / RA Billing
      ↓
ERPNext Finance, Stock, and Management Reporting
```

## 8. Extension Points

| Extension point | Technical use |
| --- | --- |
| DocType JSON metadata | Defines forms, fields, child tables, permissions, list/search behavior, naming, and module assignment. |
| Python DocType controllers | Implement validation, lifecycle hooks, calculations, and server-side business rules. |
| JavaScript DocType controllers | Implement form events, field filters, client calculations, and user interface automation. |
| `hooks.py` `override_doctype_class` | Replaces standard Task controller with construction-specific task behavior. |
| `hooks.py` `doctype_js` | Adds custom client behavior to standard Project, Task, Opportunity, and Stock Entry forms. |
| Fixtures | Ships roles, workflows, custom fields, UOMs, accounting dimensions, property setters, item types, and contract types. |
| Reports | Provide scripted reporting for daily progress and equipment diesel usage. |
| Workspaces / sidebar / desktop icons | Expose construction modules in the Frappe Desk UI. |

## 9. Workflow and Fixture Design

The fixtures directory exports configuration required to make the construction process portable between sites. Key fixture categories are:

- **Roles:** Preliminary Approver, Commercial Approver, Top Management, Business Head, Analyzer, Technical Evaluator, Financial Evaluator, Sales Evaluator, Business Developer, and All.
- **Workflow states:** Tender and project lifecycle states such as New, In Progress, Tender Submitted, Go For Bid, Don't Go For Bid, Won, Lost, Alloted, Preliminary Approved, Commercially Approved, and Top Management Approved.
- **Workflow action masters:** Approval and decision actions for analyzer, evaluator, sales, top management, business head, tender submission, go/no-go, win/loss, and allotment.
- **Workflows:** Tender Creation and Tender Submission.
- **Custom fields and property setters:** Construction-specific changes to standard ERPNext forms.
- **Accounting dimension:** Site.
- **Masters:** UOM, UOM Conversion Rate, Item Type, Contract Type, and Price List.

## 10. Installation and Deployment Process

1. Install the app into a Frappe bench using Bench.
2. Install the app on the target site.
3. Run migrations so DocTypes, fixtures, custom fields, workflows, and property setters are applied.
4. Verify roles and workflows are present.
5. Assign users to construction roles.
6. Configure project, site, BOQ, costing, billing, and site diary settings.
7. Validate standard form customizations for Project, Task, Opportunity, and Stock Entry.

Example commands:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch main
bench --site <site-name> install-app quantbit_construction_management
bench --site <site-name> migrate
bench --site <site-name> clear-cache
```

## 11. Development Standards

- Follow Frappe app conventions for DocType folders, metadata JSON, Python controllers, JavaScript controllers, and tests.
- Keep business logic construction-specific and avoid duplicating generic ERPNext features unless customization is required.
- Put standard ERPNext form customizations in `public/js/` and register them from hooks.
- Put server-side lifecycle logic in DocType controller classes or explicit utility modules.
- Export reusable site configuration as fixtures.
- Keep workflow state/action names aligned with functional approval processes.
- Add or update tests for new DocType behavior where practical.
- Avoid wrapping imports in broad try/except blocks.

## 12. Technical Assumptions and Dependencies

- The application runs inside a compatible Frappe/ERPNext bench.
- ERPNext core modules supply baseline CRM, project, stock, accounting, and HR data structures.
- Construction-specific roles and workflows are installed from fixtures.
- The `Site` accounting dimension is used for site-level reporting and control.
- Users have appropriate permissions for the modules they operate.

## 13. Validation Checklist

Before moving changes to production, validate the following:

- App installs and migrates successfully on a test site.
- Fixtures load without duplicate or missing reference errors.
- Project, Task, Opportunity, and Stock Entry client scripts load without browser errors.
- Tender Creation and Tender Submission workflows are available and usable.
- BOQ, site diary, document control, labour, quality/safety, subcontractor, progress billing, and RA billing DocTypes can be created and submitted according to permissions.
- Reports execute with expected filters and output columns.
- Custom Task override does not break standard ERPNext project task operations.

## 14. Maintenance Notes

- When adding a new construction process, create a module-specific DocType instead of overloading unrelated ERPNext core DocTypes.
- When modifying standard ERPNext behavior, prefer custom fields, property setters, client scripts, or controlled class overrides.
- Review fixtures after workflow or role changes to keep new installations consistent.
- Maintain documentation whenever new modules, DocTypes, reports, or business rules are added.
