# Quantbit Construction Management - Functional Application Process Document

## 1. Document Control

| Item | Details |
| --- | --- |
| Application | Quantbit Construction Management |
| Platform | Frappe Framework / ERPNext extension |
| Business domain | Construction project management |
| Document type | Functional process document |
| Scope | Customized construction business processes only |
| Primary users | Business development, tendering, planning, site execution, stores, document control, quality, safety, subcontract, billing, finance, and management teams |

## 2. Purpose

This document explains the functional process supported by the Quantbit Construction Management application. The application extends Frappe/ERPNext for construction organizations that need controlled tendering, BOQ management, site execution tracking, document control, labour and equipment usage, quality and safety controls, subcontractor billing, RA billing, and progress measurement.

## 3. Business Scope

The application is focused on construction business operations. It does not attempt to replace the full ERPNext core; instead, it adds construction-specific workflows and records around existing masters such as Project, Task, Item, Customer, Lead, Opportunity, Stock Entry, and accounting dimensions.

### In Scope

- Tender identification, evaluation, approval, submission, and award tracking.
- BOQ, rate analysis, BOQ revisions, and task-linked BOQ planning.
- Construction project and site master data.
- Site diary, daily progress, manpower, material, equipment, visitor, and task progress records.
- Drawing, transmittal, shop drawing, RFI, and revision controls.
- Labour gang, attendance, category, and skill tracking.
- Quality plans, ITPs, inspections, NCR, incidents, observations, risk, and toolbox talk records.
- Subcontractor agreements, work orders, RA bills, SC bills, and payment certificates.
- Progress claims, progress certificates, deductions, disputed BOQ items, earned value, and RA billing sheets.
- Construction-focused workflows, roles, fixtures, workspaces, and reports.

### Out of Scope

- Generic accounting, payroll, CRM, stock, and HR processes except where customized for construction use.
- Non-construction industries or unrelated service workflows.
- External integrations not represented in this repository.

## 4. Functional Modules

| Module | Functional responsibility |
| --- | --- |
| Tendering | Tender capture, qualification, commercial/technical review, bid submission, tender documents, corrigendum, recommendations, and award outcomes. |
| BOQ | BOQ item definition, rate analysis, revision tracking, and mapping BOQ lines to project tasks. |
| Core Construction Management | Sites, construction types/measures, costing, workers, equipment, work details, daily progress tracking, task summaries, and billing settings. |
| Site Diary | Daily site execution records for manpower, materials, equipment, visitors, task progress, and delivery logs. |
| Document Control | Drawing register, drawing revisions, RFIs, shop drawings, transmittals, and transmittal drawing mapping. |
| Labour Management | Labour categories, gangs, gang members, attendance bulk entries, labour entries, skills, and skill records. |
| Quality and Safety Management | Quality plans, ITPs, inspection lots/results, NCR, incidents, corrective actions, risks, observations, and toolbox talks. |
| Subcontractor Management | Contractors, subcontract agreements, work orders, RA billing, SC bills, payment certificates, and deductions. |
| Progress Measurement & Billing | Progress claims, progress certificates, claim items, deductions, disputed BOQ items, variation-order inclusion, and earned value records. |
| RA Billing | Running-account billing support through bulk RA billing, project data sheets, task-level sheets, formulas, tax details, and level-wise billing details. |

## 5. End-to-End Construction Application Process

```text
Lead / Opportunity
      ↓
Tender Creation and Qualification
      ↓
Tender Approval and Bid Submission
      ↓
Tender Award / Project Creation
      ↓
BOQ, Costing, Site, Task, Worker, Equipment Setup
      ↓
Document Control and Drawing Approval
      ↓
Site Diary / Daily Progress / Labour / Material / Equipment Capture
      ↓
Quality and Safety Controls
      ↓
Subcontractor Work Order and Billing
      ↓
Progress Measurement, RA Billing, Certification, and Dispute Tracking
      ↓
Management Review and Project Controls
```

## 6. Process Details

### 6.1 Tendering and Bid Management

**Objective:** Identify construction opportunities, evaluate eligibility, approve bid/no-bid decisions, and control bid submissions.

**Key records:** Lead, Customer, Opportunity, Tender, Tender Type, Tender Category, Contract Type, Item Type, Invoicing Type, Opportunity Parameter, Technical Qualification Details, Financial Qualification Details, Tender Documents, Tender Confidential Documents, Corrigendum, Deliverables, Pre-Bid Checklist, Bid Submission Checklist, Post-Bid Checklist, Sales Recommendation Details, Tender Competitor Details.

**Standard flow:**

1. Capture the construction opportunity from Lead/Opportunity.
2. Create a Tender record with tender category, type, contract type, dates, commercial terms, qualification criteria, and documents.
3. Record technical and financial qualification details.
4. Attach tender documents, confidential documents, and corrigendum records.
5. Prepare pre-bid checklist and internal evaluations.
6. Route the tender through approval roles such as Analyzer, Technical Evaluator, Financial Evaluator, Sales Evaluator, Business Head, Top Management, and Commercial Approver.
7. Decide Go for Bid or Don't Go for Bid.
8. For approved bids, complete bid submission checklist and mark Tender Submitted.
9. Record post-bid checklist, competitor details, sales recommendations, and outcome as Won/Lost.
10. If won/allotted, proceed with project setup.

**Business controls:**

- Approval states ensure tender reviews are completed before submission.
- Confidential documents are separated from normal tender documents.
- Corrigendum tracking ensures bid changes are auditable.
- Role-specific workflow actions support segregation of duties.

### 6.2 Project, Site, and Costing Setup

**Objective:** Convert awarded work into controlled construction execution data.

**Key records:** Project, Task, Site, Construction Type, Construction Measures, Costing, Costing Task, Work Details, Costing Work Details, Material Costing, Equipment Costing, Worker Costing, Worker Master, Worker Type, Billing Settings, Task Summary.

**Standard flow:**

1. Create or update Project from awarded tender details.
2. Define project sites and accounting dimensions for site-level tracking.
3. Create construction tasks and link them with BOQ/costing data.
4. Define material, equipment, worker, and work costing details.
5. Configure billing settings and task summaries for downstream billing.
6. Maintain worker and equipment masters required for execution.

**Business controls:**

- Project and task customization enables construction-specific quantity and billing logic.
- Site dimension supports site-wise costing and stock/accounting analysis.
- Costing records establish planned resource consumption before site execution.

### 6.3 BOQ and Rate Analysis

**Objective:** Maintain contractual quantities, rates, revisions, and task-level quantity mapping.

**Key records:** Bill of Quantities, BOQ Item, BOQ Rate Analysis, BOQ Revision, BOQ Task Details, BOQ Amendment Log, Task BOQ Details.

**Standard flow:**

1. Create BOQ master for the project/contract.
2. Add BOQ items with item descriptions, UOM, quantities, and rates.
3. Prepare BOQ rate analysis where detailed rate buildup is needed.
4. Map BOQ lines to project tasks for progress and billing measurement.
5. Record revisions and amendment logs whenever contractual scope changes.
6. Use the approved BOQ as the basis for progress claims, RA billing, subcontract work orders, and earned value records.

**Business controls:**

- BOQ revision records maintain change history.
- Task mapping supports measurable progress against BOQ quantities.
- Amendment logs make contractual quantity/rate changes auditable.

### 6.4 Document Control

**Objective:** Control construction drawings, revisions, transmittals, RFIs, and shop drawings.

**Key records:** Drawing Register, Drawing Revision, Transmittal, Transmittal Drawing, Shop Drawing, RFI.

**Standard flow:**

1. Register all construction drawings in Drawing Register.
2. Record revisions when drawings are updated.
3. Issue drawings through Transmittal and Transmittal Drawing details.
4. Raise RFIs for design/site clarifications.
5. Submit, review, and track Shop Drawings.
6. Ensure execution teams use the latest approved revision.

**Business controls:**

- Revision-controlled drawings reduce execution errors.
- Transmittals provide issue history and recipient accountability.
- RFIs formalize technical clarification and response tracking.

### 6.5 Site Diary and Daily Progress

**Objective:** Capture daily site activities and resource usage for operational control and billing support.

**Key records:** Site Diary, Site Diary Settings, Daily Progress Tracking, Task Progress, Task Progress Details, Task Progress Image, Manpower Log, Manpower Usage, Manpower Usage Details, Material Received, Material Details, Site Material Delivery, Equipment Usage, Equipment Usage Details, Equipment Usage Diesel Details, Site Equipment Log, Project Visitor, Site Visitor Log.

**Standard flow:**

1. Create daily Site Diary for each project/site/date.
2. Record task-wise progress quantities and supporting images.
3. Capture manpower usage and labour attendance.
4. Record material receipts, deliveries, and stock movements relevant to site work.
5. Capture equipment usage, diesel details, and site equipment logs.
6. Record visitor information and site remarks.
7. Submit/approve daily progress records for reporting and billing reference.

**Business controls:**

- Daily records become evidence for productivity, claims, and billing.
- Task progress images provide proof of physical progress.
- Material and equipment usage helps compare planned versus actual consumption.

### 6.6 Labour Management

**Objective:** Track labour availability, gangs, attendance, skill levels, and labour entries.

**Key records:** Labour Category, Gang, Gang Member, Labour Attendance Bulk Entry, Labour Attendance Row, Labour Entry Details, Skill Matrix, Skill Record, Worker Master, Worker Type.

**Standard flow:**

1. Define labour categories and worker types.
2. Create worker records and assign skill details.
3. Group workers into gangs where applicable.
4. Capture daily or bulk attendance entries.
5. Link labour consumption to project/site/task activity records.
6. Use labour entries for costing, productivity review, and site diary reporting.

**Business controls:**

- Bulk attendance reduces field data-entry effort.
- Skill matrix supports allocation of suitable workers to construction activities.
- Gang records support contractor or crew-based productivity tracking.

### 6.7 Quality and Safety Management

**Objective:** Maintain construction quality assurance and site safety compliance.

**Key records:** Quality Plan, Quality Plan ITP, Inspection Test Plan, ITP Item, Inspection Lot, Inspection Result, NCR, Incident Report, Incident CA, Safety Observation, Risk Register, Risk Item, Toolbox Talk, JBT Attendee, MS Activity.

**Standard flow:**

1. Prepare quality plan and inspection test plans for project activities.
2. Create inspection lots and record inspection results.
3. Raise NCR when work does not meet acceptance criteria.
4. Record corrective actions and close NCR/incident actions after verification.
5. Maintain risk register and risk items for project safety risks.
6. Record safety observations, incidents, toolbox talks, and attendees.

**Business controls:**

- ITP-based inspection supports quality checkpoints before acceptance.
- NCR and incident corrective actions support closure accountability.
- Toolbox talk and safety observations support site safety compliance evidence.

### 6.8 Subcontractor Management

**Objective:** Control subcontractor contracts, work orders, measurements, RA bills, SC bills, certificates, and payments.

**Key records:** Contractor, Subcontract Agreement, SC Work Order, WO Item, Site Diary Contractor Item Details, RA Billing, RA Billing Details, RA Abstract Details, Contractor Billing, Contractor Billing Details, SC Bill, SC Bill Item, SC Payment Certificate, SC Payment Deduction.

**Standard flow:**

1. Create Contractor master and subcontract agreement.
2. Create SC Work Order with BOQ/task-linked work items.
3. Capture subcontractor daily progress or site diary item details.
4. Prepare subcontractor RA bill based on measured work.
5. Generate contractor/SC bill and payment certificate.
6. Apply payment deductions as per contract terms.
7. Review and approve payment for finance processing.

**Business controls:**

- Work orders link subcontract scope to measurable BOQ/task quantities.
- Payment certificates and deductions support commercial control.
- RA billing details provide traceability from work executed to subcontractor payment.

### 6.9 Progress Measurement and Client Billing

**Objective:** Convert measured construction progress into claims, certificates, deductions, and billing records.

**Key records:** Progress Claim, Progress Claim Item, Progress Certificate, Cert Deduction, Claim Included VO, Disputed BOQ Item, Earned Value Record, Bulk RA Billing, Bulk RA Billing Projects Details, RA Billing Tax Details, Bulk RA Bill Tax Details, Task Level Sheet, Task Level Sheet Details, RA Bill Level Sheet Details, Level Task Details, Project Data Sheet Column Details, Project Formulas Details.

**Standard flow:**

1. Use BOQ/task progress and site diary data as measurement inputs.
2. Create progress claim with BOQ-wise claim items and included variation orders.
3. Record disputed BOQ items separately for follow-up.
4. Generate progress certificate with deductions where applicable.
5. Use RA billing sheets to calculate project/task/level-wise billing values.
6. Apply taxes using RA billing tax details or bulk tax details.
7. Submit certified values to finance/accounting for invoice processing.
8. Track earned value records for project performance analysis.

**Business controls:**

- Claim items and certificates separate claimed versus certified values.
- Deductions and disputes are explicitly recorded.
- Formulas and data-sheet columns support standard RA bill calculations.

## 7. Roles and Responsibilities

| Role | Responsibilities |
| --- | --- |
| Business Developer / Sales Evaluator | Capture opportunities, tender details, recommendations, and bid status. |
| Analyzer | Review tender feasibility and internal bid parameters. |
| Technical Evaluator | Review technical qualification, scope, drawings, and deliverables. |
| Financial Evaluator / Commercial Approver | Review commercial viability, rates, costing, deductions, and billing terms. |
| Business Head / Top Management | Approve strategic bid decisions and final tender outcomes. |
| Project Manager | Own project setup, site execution, daily progress, document control, and billing readiness. |
| Planning / QS Engineer | Maintain BOQ, progress measurement, RA billing, claims, and earned value records. |
| Site Engineer | Capture daily progress, task measurements, labour, material, equipment, and site records. |
| Document Controller | Maintain drawing register, revisions, transmittals, RFIs, and shop drawings. |
| Quality Engineer | Maintain quality plans, ITPs, inspections, NCRs, and closure evidence. |
| Safety Officer | Maintain risk registers, toolbox talks, incidents, observations, and corrective actions. |
| Subcontract Manager | Maintain contractors, subcontract agreements, work orders, RA bills, and payment certificates. |
| Finance / Accounts | Use certified values, deductions, taxes, and billing outputs for financial processing. |

## 8. Key Reports and Outputs

- Daily Progress Report for site execution review.
- Equipment Usage Diesel Details report for equipment fuel tracking.
- Tender status and approval history.
- BOQ revision and amendment history.
- Drawing register and transmittal history.
- Site diary and task progress evidence.
- Labour attendance and productivity records.
- Quality inspection, NCR, safety observation, and incident registers.
- Subcontractor RA bills, SC bills, payment certificates, and deductions.
- Progress claims, progress certificates, disputed BOQ items, and earned value records.
- RA billing sheets and tax summaries.

## 9. Functional Assumptions

- ERPNext/Frappe core masters are already available and configured.
- Users are assigned construction-specific roles before workflow execution.
- Project, task, BOQ, and site records should be prepared before site diary and billing activities.
- Billing should be based on approved measurements, BOQ/task progress, and certified values.
- Drawing and document revisions should be updated before execution teams use site records for work progress.

## 10. Success Criteria

The application process is successful when:

- Tender approvals and outcomes are auditable.
- Awarded projects are linked to sites, tasks, BOQ, costing, and execution records.
- Daily progress is captured with labour, material, equipment, and image evidence.
- Quality and safety records are maintained against project activities.
- Subcontractor and client RA billing are traceable to BOQ/task progress.
- Management can review project progress, claims, deductions, disputes, and earned value from system records.
