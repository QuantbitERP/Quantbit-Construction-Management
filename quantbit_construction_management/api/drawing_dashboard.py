import frappe
from frappe.utils import format_datetime, now_datetime
from datetime import timedelta

@frappe.whitelist()
def get_dashboard_data(project=None):
    filters = {}
    if project:
        filters["project"] = project

    # 1. KPIs
    total_drawings = frappe.db.count("Drawing Register", filters)
    
    ifc_filters = filters.copy()
    ifc_filters["status"] = "IFC"
    ifc_drawings = frappe.db.count("Drawing Register", ifc_filters)
    
    pending_filters = filters.copy()
    pending_filters["status"] = ["in", ["Under Review", "IFA", "IFR"]]
    pending_approval = frappe.db.count("Drawing Register", pending_filters)
    
    superseded_filters = filters.copy()
    superseded_filters["status"] = ["in", ["Superseded", "Void"]]
    superseded = frappe.db.count("Drawing Register", superseded_filters)
    
    # Transmittals sent this month
    today = now_datetime()
    start_of_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    trans_filters = {}
    if project:
        trans_filters["project"] = project
    trans_filters["date"] = [">=", start_of_month.strftime("%Y-%m-%d")]
    transmittals_this_month = frappe.db.count("Transmittal", trans_filters)

    # 2. Drawings by Discipline
    discipline_list = [
        "Structural", "Mechanical", "Electrical", "Process", 
        "Civil", "I&C", "Architectural", "Piping", 
        "Plumbing", "Firefighting", "Landscape", "Survey"
    ]
    
    if project:
        disc_data = frappe.db.sql("""
            SELECT discipline, count(name) as count
            FROM `tabDrawing Register`
            WHERE project = %s
            GROUP BY discipline
        """, (project,), as_dict=True)
    else:
        disc_data = frappe.db.sql("""
            SELECT discipline, count(name) as count
            FROM `tabDrawing Register`
            GROUP BY discipline
        """, as_dict=True)
    
    disc_map = {d["discipline"]: d["count"] for d in disc_data if d.get("discipline")}
    by_discipline = []
    
    max_disc_count = max(disc_map.values()) if disc_map else 1
    
    for disc in discipline_list:
        count = disc_map.get(disc, 0)
        pct = int((count / max_disc_count) * 100) if max_disc_count > 0 else 0
        by_discipline.append({
            "discipline": disc,
            "count": count,
            "pct": pct
        })
    
    # Sort disciplines by count descending
    by_discipline.sort(key=lambda x: x["count"], reverse=True)

    # 3. Revision Status Breakdown
    if project:
        status_data = frappe.db.sql("""
            SELECT status, count(name) as count
            FROM `tabDrawing Register`
            WHERE project = %s
            GROUP BY status
        """, (project,), as_dict=True)
    else:
        status_data = frappe.db.sql("""
            SELECT status, count(name) as count
            FROM `tabDrawing Register`
            GROUP BY status
        """, as_dict=True)
    
    status_breakdown = {
        "IFC": {"count": 0, "label": "Issued for Construction (IFC)", "color": "var(--green)"},
        "IFA": {"count": 0, "label": "Pending Client Approval", "color": "var(--amber)"},
        "Under Review": {"count": 0, "label": "In Review / Markup", "color": "var(--blue)"},
        "In Preparation": {"count": 0, "label": "Draft (Not Issued)", "color": "var(--purple)"},
        "Superseded": {"count": 0, "label": "Superseded / Void", "color": "var(--muted)"}
    }
    
    for sd in status_data:
        status = sd["status"]
        count = sd["count"]
        
        if status in ["IFC", "As-Built"]:
            status_breakdown["IFC"]["count"] += count
        elif status in ["IFA"]:
            status_breakdown["IFA"]["count"] += count
        elif status in ["Under Review", "IFR"]:
            status_breakdown["Under Review"]["count"] += count
        elif status in ["In Preparation"]:
            status_breakdown["In Preparation"]["count"] += count
        elif status in ["Superseded", "Void"]:
            status_breakdown["Superseded"]["count"] += count

    total_for_breakdown = sum(item["count"] for item in status_breakdown.values()) or 1
    status_breakdown_list = []
    for key, value in status_breakdown.items():
        value["pct"] = int((value["count"] / total_for_breakdown) * 100)
        value["key"] = key
        status_breakdown_list.append(value)
    
    status_breakdown_list.sort(key=lambda x: x["count"], reverse=True)

    # 4. Approval Pipeline Stages
    stage1_count = frappe.db.count("Drawing Register", {**filters, "status": "In Preparation"})
    stage2_count = frappe.db.count("Drawing Register", {**filters, "status": "IFR"})
    stage3_count = frappe.db.count("Drawing Register", {**filters, "status": "Under Review"})
    stage4_count = frappe.db.count("Drawing Register", {**filters, "status": "IFA"})
    
    seven_days_ago = today - timedelta(days=7)
    stage5_count = frappe.db.count("Drawing Register", {
        **filters, 
        "status": "IFC",
        "modified": [">=", seven_days_ago.strftime("%Y-%m-%d %H:%M:%S")]
    })

    pipeline_stages = [
        {"stage": 1, "name": "Drafter / Design", "detail": "Initial markup → PDF", "count": stage1_count, "color": "var(--blue)", "bg": "var(--blue-light)"},
        {"stage": 2, "name": "Checker Review", "detail": "Technical + calc check", "count": stage2_count, "color": "var(--purple)", "bg": "var(--purple-light)"},
        {"stage": 3, "name": "Lead Eng. Approval", "detail": "Discipline sign-off", "count": stage3_count, "color": "var(--amber)", "bg": "var(--amber-light)"},
        {"stage": 4, "name": "Client Approval", "detail": "Awaiting return", "count": stage4_count, "color": "var(--red)", "bg": "var(--red-light)"},
        {"stage": 5, "name": "Issued (IFC)", "detail": "This week", "count": stage5_count, "color": "var(--green)", "bg": "var(--green-light)", "is_check": True}
    ]

    # 5. Drawing Register - Recent Activity Table
    recent_drawings = frappe.db.get_all(
        "Drawing Register",
        filters=filters,
        fields=["name", "drawing_no", "title", "drawing_type", "current_rev", "discipline", "issue_date", "status", "modified"],
        order_by="modified desc",
        limit=10
    )
    
    # Format dates for drawings
    for rd in recent_drawings:
        if rd.get("issue_date"):
            rd["issue_date_formatted"] = format_datetime(rd["issue_date"], "dd MMM")
        else:
            rd["issue_date_formatted"] = format_datetime(rd["modified"], "dd MMM")

    # Fetch all drawings with revision history for tabs
    all_drawings = frappe.db.get_all(
        "Drawing Register",
        filters=filters,
        fields=["name", "drawing_no", "title", "drawing_type", "current_rev", "discipline", "issue_date", "status", "modified"],
        order_by="modified desc"
    )
    
    drawing_names = [ad.name for ad in all_drawings]
    revisions_list = []
    if drawing_names:
        revisions_list = frappe.db.get_all(
            "Drawing Revision",
            filters={"parent": ["in", drawing_names]},
            fields=["parent", "revision", "revision_date", "file", "status", "description", "modified"],
            order_by="idx asc"
        )
        
    revisions_map = {}
    for r in revisions_list:
        if r.parent not in revisions_map:
            revisions_map[r.parent] = []
        revisions_map[r.parent].append(r)
        
    for ad in all_drawings:
        ad["revisions"] = revisions_map.get(ad.name, [])
        if ad.get("issue_date"):
            ad["issue_date_formatted"] = format_datetime(ad["issue_date"], "dd MMM")
        else:
            ad["issue_date_formatted"] = format_datetime(ad["modified"], "dd MMM")

    # Fetch all transmittals for transmittal history tab
    all_transmittals = frappe.db.get_all(
        "Transmittal",
        filters={"project": project} if project else {},
        fields=["name", "transmittal_no", "modified_by", "modified", "status", "project"],
        order_by="modified desc"
    )
    for t in all_transmittals:
        t["drawing_count"] = frappe.db.count("Transmittal Drawing", {"parent": t.name})
        t["modified_formatted"] = format_datetime(t.modified, "dd MMM yyyy, HH:mm")

    # 6. Recent Activity Feed
    feed = []
    
    drawings = frappe.db.get_all(
        "Drawing Register",
        filters=filters,
        fields=["name", "drawing_no", "title", "current_rev", "modified_by", "modified"],
        order_by="modified desc",
        limit=7
    )
    
    transmittals = frappe.db.get_all(
        "Transmittal",
        filters={"project": project} if project else {},
        fields=["name", "transmittal_no", "modified_by", "modified", "status"],
        order_by="modified desc",
        limit=5
    )
    for t in transmittals:
        t["drawing_count"] = frappe.db.count("Transmittal Drawing", {"parent": t.name})
        
    reviews = []
    if drawings:
        reviews = frappe.db.get_all(
            "Drawing Review Record",
            filters={"drawing": ["in", [d.name for d in drawings]]},
            fields=["name", "drawing", "drawing_no", "revision_reviewed", "reviewer", "disposition", "modified", "status"],
            order_by="modified desc",
            limit=5
        )

    def get_user_name(username):
        if not username:
            return "System"
        full_name = frappe.db.get_value("User", username, "full_name")
        return full_name or username

    for d in drawings:
        feed.append({
            "type": "drawing",
            "name": d.name,
            "doc": d.drawing_no,
            "title": d.title,
            "user": get_user_name(d.modified_by),
            "detail": f"uploaded Rev {d.current_rev or 'A'}",
            "raw_timestamp": d.modified,
            "timestamp": format_datetime(d.modified, "dd MMM yyyy, HH:mm"),
            "dot_color": "var(--lime)"
        })

    for t in transmittals:
        feed.append({
            "type": "transmittal",
            "name": t.name,
            "doc": t.transmittal_no or t.name,
            "title": f"Transmittal with {t.drawing_count} drawings",
            "user": get_user_name(t.modified_by),
            "detail": f"sent to client — {t.status}",
            "raw_timestamp": t.modified,
            "timestamp": format_datetime(t.modified, "dd MMM yyyy, HH:mm"),
            "dot_color": "var(--blue)"
        })

    for r in reviews:
        disp = r.disposition or "Reviewed"
        feed.append({
            "type": "review",
            "name": r.drawing,
            "doc": r.drawing_no or r.drawing,
            "title": f"Review of Rev {r.revision_reviewed or 'A'}",
            "user": get_user_name(r.reviewer),
            "detail": f"disposition: {disp}",
            "raw_timestamp": r.modified,
            "timestamp": format_datetime(r.modified, "dd MMM yyyy, HH:mm"),
            "dot_color": "var(--amber)"
        })

    feed.sort(key=lambda x: x["raw_timestamp"], reverse=True)
    feed = feed[:7]

    # 7. Projects
    projects_list = frappe.db.get_all("Project", fields=["name", "project_name"], order_by="project_name asc")

    # 8. RFIs
    all_rfis = frappe.db.get_all(
        "RFI",
        filters={"project": project} if project else {},
        fields=["name", "rfi_number", "subject", "project", "raised_by", "raised_date", "related_drawing", "discipline", "status", "priority", "modified"],
        order_by="modified desc"
    )
    for rfi in all_rfis:
        rfi["raised_date_formatted"] = format_datetime(rfi["raised_date"], "dd MMM yyyy") if rfi.get("raised_date") else ""

    # 9. Project Breakdown (counts per project)
    project_counts = frappe.db.sql("""
        SELECT project, COUNT(*) as count 
        FROM `tabDrawing Register`
        GROUP BY project
    """, as_dict=True)
    project_map = {pc["project"]: pc["count"] for pc in project_counts}
    
    project_breakdown = []
    for p in projects_list:
        project_breakdown.append({
            "name": p.name,
            "project_name": p.project_name or p.name,
            "total_drawings": project_map.get(p.name, 0),
            "ifc_drawings": frappe.db.count("Drawing Register", {"project": p.name, "status": "IFC"}),
            "open_rfis": frappe.db.count("RFI", {"project": p.name, "status": ["!=", "Closed"]})
        })

    # 10. Currently Logged in User info
    current_user = frappe.session.user
    user_fullname = frappe.db.get_value("User", current_user, "full_name") or current_user
    user_roles = frappe.get_roles(current_user)
    role_to_display = "Drafter / Designer"
    
    # Map roles nicely
    if "System Manager" in user_roles or "Administrator" in user_roles:
        role_to_display = "System Administrator"
    elif "Lead Engineer" in user_roles or "Drawing Approver" in user_roles:
        role_to_display = "Lead Engineer"
    elif "Drawing Checker" in user_roles:
        role_to_display = "Drawing Checker"
    elif "Project Manager" in user_roles:
        role_to_display = "Project Manager"
    else:
        filtered_roles = [r for r in user_roles if r not in ["All", "Guest", "Customer"]]
        if filtered_roles:
            role_to_display = filtered_roles[0]

    logged_in_user = {
        "username": current_user,
        "full_name": user_fullname,
        "role": role_to_display
    }

    return {
        "kpis": {
            "total_drawings": total_drawings,
            "ifc_drawings": ifc_drawings,
            "pending_approval": pending_approval,
            "superseded": superseded,
            "transmittals_this_month": transmittals_this_month
        },
        "by_discipline": by_discipline,
        "status_breakdown": status_breakdown_list,
        "pipeline": pipeline_stages,
        "recent_drawings": recent_drawings,
        "all_drawings": all_drawings,
        "all_transmittals": all_transmittals,
        "all_rfis": all_rfis,
        "project_breakdown": project_breakdown,
        "logged_in_user": logged_in_user,
        "feed": feed,
        "projects": projects_list
    }


