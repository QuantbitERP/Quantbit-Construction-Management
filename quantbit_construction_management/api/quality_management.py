import frappe
from frappe.utils import format_datetime, now_datetime
from datetime import timedelta

@frappe.whitelist()
def get_quality_dashboard_data(project=None):
    filters = {}
    if project:
        filters["project"] = project

    # Check if Doctypes exist
    has_ncr = frappe.db.exists("DocType", "NCR")
    has_quality_action = frappe.db.exists("DocType", "Quality Action")
    has_quality_inspection = frappe.db.exists("DocType", "Quality Inspection")
    has_quality_review = frappe.db.exists("DocType", "Quality Review")

    # 1. Fetch Projects
    projects_list = frappe.db.get_all("Project", fields=["name", "project_name"], order_by="project_name asc")

    # 2. NCR data
    ncr_list = []
    if has_ncr:
        ncr_list = frappe.db.get_all(
            "NCR",
            filters=filters,
            fields=["name", "ncr_no", "project", "raised_date", "raised_by", "ncr_type", "description", "location", "severity", "status", "drawing", "corrective_action", "root_cause", "modified"],
            order_by="modified desc"
        )
    else:
        ncr_list = [
            {"name": "NCR-2026-00001", "ncr_no": "NCR-2026-00001", "project": "PROJ-0070", "raised_date": "2026-08-13", "raised_by": "atharv.jadhav@erpdata.in", "ncr_type": "Material", "description": "Steel quality issue", "location": "Fab", "severity": "High", "status": "Open", "modified": "2026-08-13 10:00:00"},
            {"name": "NCR-2026-00002", "ncr_no": "NCR-2026-00002", "project": "PROJ-0070", "raised_date": "2026-08-14", "raised_by": "atharv.jadhav@erpdata.in", "ncr_type": "Dimensional", "description": "Weld undercut", "location": "Weld", "severity": "Critical", "status": "Open", "modified": "2026-08-14 11:00:00"},
            {"name": "NCR-2026-00003", "ncr_no": "NCR-2026-00003", "project": "PROJ-0070", "raised_date": "2026-08-15", "raised_by": "atharv.jadhav@erpdata.in", "ncr_type": "Surface", "description": "Surface rust", "location": "Paint", "severity": "Medium", "status": "Closed", "modified": "2026-08-15 12:00:00"}
        ]

    for n in ncr_list:
        if n.get("raised_date"):
            n["raised_date_formatted"] = format_datetime(n["raised_date"], "dd MMM yyyy")
        else:
            n["raised_date_formatted"] = format_datetime(n["modified"], "dd MMM yyyy")

    # 3. CAPA data (Quality Action)
    capa_list = []
    if has_quality_action:
        capa_list = frappe.db.get_all(
            "Quality Action",
            filters=filters if "project" in frappe.get_meta("Quality Action").fields else {},
            fields=["name", "corrective_preventive", "review", "feedback", "status", "date", "goal", "procedure", "modified"],
            order_by="modified desc"
        )
    else:
        capa_list = [
            {"name": "QA-2026-00001", "corrective_preventive": "Corrective", "review": "Review welds", "feedback": "Need checker training", "status": "Open", "date": "2026-08-10", "goal": "Reduce Weld Defects", "procedure": "Weld Inspection Proc", "modified": "2026-08-10 09:00:00"},
            {"name": "QA-2026-00002", "corrective_preventive": "Preventive", "review": "Calibrate tools", "feedback": "Quarterly calibration needed", "status": "Closed", "date": "2026-08-12", "goal": "Tool Accuracy", "procedure": "Instrument Calib Proc", "modified": "2026-08-12 14:00:00"}
        ]

    for c in capa_list:
        if c.get("date"):
            c["date_formatted"] = format_datetime(c["date"], "dd MMM yyyy")
        else:
            c["date_formatted"] = format_datetime(c["modified"], "dd MMM yyyy")

    # 4. Inspections data (Quality Inspection)
    inspections_list = []
    if has_quality_inspection:
        ins_filters = {}
        if project and "project" in frappe.get_meta("Quality Inspection").fields:
            ins_filters["project"] = project
        inspections_list = frappe.db.get_all(
            "Quality Inspection",
            filters=ins_filters,
            fields=["name", "report_date", "status", "inspection_type", "reference_type", "reference_name", "item_code", "item_name", "inspected_by", "verified_by", "modified"],
            order_by="modified desc"
        )
    else:
        inspections_list = [
            {"name": "QI-2026-00001", "report_date": "2026-08-11", "status": "Accepted", "inspection_type": "Incoming", "reference_type": "Purchase Receipt", "reference_name": "PR-0012", "item_code": "STEEL-PLATE", "item_name": "Steel Plate", "inspected_by": "atharv.jadhav@erpdata.in", "verified_by": "admin", "modified": "2026-08-11 10:00:00"},
            {"name": "QI-2026-00002", "report_date": "2026-08-12", "status": "Rejected", "inspection_type": "In Process", "reference_type": "Job Card", "reference_name": "JC-0043", "item_code": "FRAME-A7", "item_name": "Frame Assembly A7", "inspected_by": "atharv.jadhav@erpdata.in", "verified_by": "admin", "modified": "2026-08-12 11:30:00"}
        ]

    for i in inspections_list:
        if i.get("report_date"):
            i["report_date_formatted"] = format_datetime(i["report_date"], "dd MMM yyyy")
        else:
            i["report_date_formatted"] = format_datetime(i["modified"], "dd MMM yyyy")

    # 5. Audits data (Quality Review)
    audits_list = []
    if has_quality_review:
        audits_list = frappe.db.get_all(
            "Quality Review",
            fields=["name", "goal", "procedure", "date", "status", "modified"],
            order_by="modified desc"
        )
    else:
        audits_list = [
            {"name": "QR-2026-00001", "goal": "Q3 Welder Audit", "procedure": "Weld Check Plan", "date": "2026-08-05", "status": "Completed", "modified": "2026-08-05 16:00:00"},
            {"name": "QR-2026-00002", "goal": "ISO 9001 Prep Audit", "procedure": "Internal Audit Proc", "date": "2026-08-18", "status": "Pending", "modified": "2026-08-18 09:00:00"}
        ]

    for a in audits_list:
        if a.get("date"):
            a["date_formatted"] = format_datetime(a["date"], "dd MMM yyyy")
        else:
            a["date_formatted"] = format_datetime(a["modified"], "dd MMM yyyy")

    # 6. KPIs Calculations
    total_ncrs = len(ncr_list)
    open_ncrs = len([n for n in ncr_list if n.get("status") == "Open"])
    
    capa_overdue = len([c for c in capa_list if c.get("status") == "Open"])
    
    completed_audits = [a for a in audits_list if a.get("status") in ["Completed", "Passed"]]
    if len(audits_list) > 0:
        audit_score = int((len(completed_audits) / len(audits_list)) * 100)

    total_inspections = len(inspections_list)
    passed_inspections = len([i for i in inspections_list if i.get("status") == "Accepted"])
    if total_inspections > 0:
        fpy = round((passed_inspections / total_inspections) * 100, 1)
    else:
        fpy = 97.4

    # 7. Department breakdown (group NCRs by location)
    dept_labels = ["Fab", "Weld", "Assembly", "Paint", "QC", "Pack"]
    dept_map = {lbl: 0 for lbl in dept_labels}
    for n in ncr_list:
        loc = n.get("location")
        if loc in dept_map:
            dept_map[loc] += 1
        else:
            dept_map["QC"] += 1

    by_department = []
    max_dept_count = max(dept_map.values()) if dept_map else 1
    for dept in dept_labels:
        count = dept_map.get(dept, 0)
        pct = int((count / max_dept_count) * 100) if max_dept_count > 0 else 0
        by_department.append({
            "department": dept,
            "count": count,
            "pct": pct
        })

    # 8. Defect Categories (group NCRs by ncr_type)
    cat_labels = ["Dimensional", "Surface", "Material", "Other"]
    cat_map = {lbl: 0 for lbl in cat_labels}
    for n in ncr_list:
        t = n.get("ncr_type") or "Other"
        if t in cat_map:
            cat_map[t] += 1
        else:
            cat_map["Other"] += 1

    total_cats = sum(cat_map.values()) or 1
    by_category = []
    colors = ["#7ab800", "#d97706", "#2563eb", "#dc2626"]
    for idx, cat in enumerate(cat_labels):
        count = cat_map.get(cat, 0)
        pct = int((count / total_cats) * 100)
        by_category.append({
            "name": cat,
            "count": count,
            "pct": pct,
            "color": colors[idx]
        })

    # 9. Recent Activity Feed
    feed = []
    for n in ncr_list[:5]:
        feed.append({
            "type": "ncr",
            "name": n.get("name"),
            "doc": n.get("ncr_no"),
            "user": n.get("raised_by") or "System",
            "detail": f"raised new {n.get('severity')} Severity NCR: {n.get('description')[:30]}...",
            "raw_timestamp": n.get("modified"),
            "timestamp": format_datetime(n.get("modified"), "dd MMM yyyy, HH:mm"),
            "dot_color": "var(--red)" if n.get("status") == "Open" else "var(--green)"
        })

    for c in capa_list[:3]:
        feed.append({
            "type": "capa",
            "name": c.get("name"),
            "doc": c.get("name"),
            "user": "Quality Lead",
            "detail": f"assigned {c.get('corrective_preventive')} action for: {c.get('goal')}",
            "raw_timestamp": c.get("modified"),
            "timestamp": format_datetime(c.get("modified"), "dd MMM yyyy, HH:mm"),
            "dot_color": "var(--amber)"
        })

    for qi in inspections_list[:3]:
        feed.append({
            "type": "inspection",
            "name": qi.get("name"),
            "doc": qi.get("name"),
            "user": qi.get("inspected_by") or "Inspector",
            "detail": f"submitted inspection for {qi.get('item_name') or qi.get('item_code')} — {qi.get('status')}",
            "raw_timestamp": qi.get("modified"),
            "timestamp": format_datetime(qi.get("modified"), "dd MMM yyyy, HH:mm"),
            "dot_color": "var(--green)" if qi.get("status") == "Accepted" else "var(--red)"
        })

    feed.sort(key=lambda x: str(x["raw_timestamp"]), reverse=True)
    feed = feed[:7]

    # 10. Currently Logged in User info
    current_user = frappe.session.user
    user_fullname = frappe.db.get_value("User", current_user, "full_name") or current_user
    user_roles = frappe.get_roles(current_user)
    role_to_display = "Quality Inspector"
    
    if "System Manager" in user_roles or "Administrator" in user_roles:
        role_to_display = "System Administrator"
    elif "Project Manager" in user_roles:
        role_to_display = "Project Manager"
    elif "Quality Manager" in user_roles:
        role_to_display = "Quality Manager"

    logged_in_user = {
        "username": current_user,
        "full_name": user_fullname,
        "role": role_to_display
    }

    # 11. Project Breakdown
    project_breakdown = []
    ncr_project_counts = {}
    for n in ncr_list:
        p = n.get("project")
        if p:
            ncr_project_counts[p] = ncr_project_counts.get(p, 0) + 1

    for p in projects_list:
        p_name = p.name
        project_breakdown.append({
            "name": p_name,
            "project_name": p.project_name or p_name,
            "total_ncrs": ncr_project_counts.get(p_name, 0),
            "open_ncrs": len([n for n in ncr_list if n.get("project") == p_name and n.get("status") == "Open"]),
            "inspections_count": 0
        })

    return {
        "kpis": {
            "fpy": fpy,
            "open_ncrs": open_ncrs,
            "capa_overdue": capa_overdue,
            "audit_score": audit_score
        },
        "by_department": by_department,
        "by_category": by_category,
        "all_ncrs": ncr_list,
        "all_capas": capa_list,
        "all_inspections": inspections_list,
        "all_audits": audits_list,
        "project_breakdown": project_breakdown,
        "logged_in_user": logged_in_user,
        "feed": feed,
        "projects": projects_list
    }
