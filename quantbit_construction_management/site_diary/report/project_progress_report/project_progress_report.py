# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

from collections import defaultdict

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate


def execute(filters=None):

    filters = filters or {}

    project = filters.get("project")

    if not project:
        frappe.throw(_("Please select a Project"))

    as_on_date = getdate(filters.get("as_on_date") or nowdate())

    columns = get_columns()
    data = get_data(project, as_on_date)

    return columns, data


def to_date(value):
    return getdate(value) if value else None


def compute_delay_days(status, planned_end, actual_end, as_on_date):

    if not planned_end:
        return None

    if actual_end:
        return (actual_end - planned_end).days

    if status in ("Completed", "Cancelled"):
        return None

    if as_on_date > planned_end:
        return (as_on_date - planned_end).days

    return 0


def get_last_site_update_map(project):
    """Latest Site Date on which each Task received a Task Progress entry."""

    rows = frappe.db.sql("""
        SELECT
            tpd.task AS task,
            MAX(tp.site_date) AS last_update
        FROM `tabTask Progress Details` tpd
        INNER JOIN `tabTask Progress` tp
            ON tp.name = tpd.parent
        WHERE
            tp.project = %(project)s
            AND tp.docstatus = 1
        GROUP BY tpd.task
    """, {"project": project}, as_dict=True)

    return {row.task: row.last_update for row in rows if row.task}


def get_project_summary_row(project, as_on_date):

    project_doc = frappe.db.get_value(
        "Project",
        project,
        [
            "project_name",
            "status",
            "percent_complete",
            "expected_start_date",
            "expected_end_date",
            "actual_start_date",
            "actual_end_date",
            "customer",
            "custom_site",
        ],
        as_dict=True,
    )

    if not project_doc:
        return None

    planned_end = to_date(project_doc.expected_end_date)
    actual_end = to_date(project_doc.actual_end_date)

    return {
        "section": f"PROJECT: {project_doc.project_name or project}",
        "indent": 0,
        "is_group": 0,
        "bold": 1,
        "status": project_doc.status,
        "progress": project_doc.percent_complete or 0,
        "planned_start": to_date(project_doc.expected_start_date),
        "planned_end": planned_end,
        "actual_start": to_date(project_doc.actual_start_date),
        "actual_end": actual_end,
        "delay_days": compute_delay_days(project_doc.status, planned_end, actual_end, as_on_date),
        "remarks": f"Customer: {project_doc.customer or '-'}  |  Site: {project_doc.custom_site or '-'}",
    }


def get_task_tree_rows(project, as_on_date):

    tasks = frappe.get_all(
        "Task",
        filters={"project": project},
        fields=[
            "name",
            "subject",
            "parent_task",
            "status",
            "progress",
            "exp_start_date",
            "exp_end_date",
            "act_start_date",
            "act_end_date",
            "custom_total_quantity",
            "custom_total_achieved",
            "custom_uom",
            "lft",
        ],
        order_by="lft asc",
    )

    if not tasks:
        return []

    task_map = {t.name: t for t in tasks}

    by_parent = defaultdict(list)
    for t in tasks:
        by_parent[t.parent_task or None].append(t)

    last_update_map = get_last_site_update_map(project)

    # Bottom-up: roll up quantities and last-update date from children.
    agg = {}

    def compute_aggregates(name):

        node = task_map[name]

        total_qty = flt(node.custom_total_quantity)
        achieved_qty = flt(node.custom_total_achieved)
        last_update = last_update_map.get(name)

        for child in by_parent.get(name, []):

            compute_aggregates(child.name)
            child_agg = agg[child.name]

            total_qty += child_agg["total_qty"]
            achieved_qty += child_agg["achieved_qty"]

            if child_agg["last_update"] and (
                not last_update or child_agg["last_update"] > last_update
            ):
                last_update = child_agg["last_update"]

        agg[name] = {
            "total_qty": total_qty,
            "achieved_qty": achieved_qty,
            "last_update": last_update,
        }

    for root in by_parent.get(None, []):
        compute_aggregates(root.name)

    # Top-down: emit rows in display order (parent immediately followed by its subtree).
    rows = []

    def emit(name, indent):

        node = task_map[name]
        node_agg = agg[name]

        children = sorted(by_parent.get(name, []), key=lambda x: x.lft)

        planned_start = to_date(node.exp_start_date)
        planned_end = to_date(node.exp_end_date)
        actual_start = to_date(node.act_start_date)
        actual_end = to_date(node.act_end_date)
        last_update = node_agg["last_update"]

        rows.append({
            "section": node.subject or node.name,
            "task_id": node.name,
            "indent": indent,
            "is_group": 1 if children else 0,
            "status": node.status,
            "progress": node.progress or 0,
            "planned_start": planned_start,
            "planned_end": planned_end,
            "actual_start": actual_start,
            "actual_end": actual_end,
            "delay_days": compute_delay_days(node.status, planned_end, actual_end, as_on_date),
            "total_qty": node_agg["total_qty"] or None,
            "achieved_qty": node_agg["achieved_qty"] or None,
            "uom": node.custom_uom,
            "last_site_update": last_update,
            "days_since_update": (as_on_date - last_update).days if last_update else None,
        })

        for child in children:
            emit(child.name, indent + 1)

    for root in sorted(by_parent.get(None, []), key=lambda x: x.lft):
        emit(root.name, 0)

    return rows


def get_site_diary_log_rows(project, as_on_date):

    diaries = frappe.get_all(
        "Site Diary",
        filters={
            "project": project,
            "site_date": ["<=", as_on_date],
        },
        fields=[
            "name",
            "site_date",
            "status",
            "site_engineer_name",
            "work_stopped",
            "stoppage_reason",
            "general_remarks",
        ],
        order_by="site_date desc",
        limit_page_length=20,
    )

    if not diaries:
        return []

    rows = [{
        "section": "Site Diary Log (Most Recent 20)",
        "indent": 0,
        "is_group": 1,
        "bold": 1,
    }]

    for d in diaries:

        if d.work_stopped:
            remarks = f"Work Stopped: {d.stoppage_reason or ''}".strip()
        else:
            remarks = d.general_remarks or ""

        rows.append({
            "section": f"{d.name} ({frappe.utils.formatdate(d.site_date)})",
            "task_id": d.name,
            "indent": 1,
            "is_group": 0,
            "status": d.status,
            "last_site_update": d.site_date,
            "site_engineer": d.site_engineer_name,
            "remarks": remarks,
        })

    return rows


def get_data(project, as_on_date):

    data = []

    summary_row = get_project_summary_row(project, as_on_date)
    if summary_row:
        data.append(summary_row)
        data.append({})

    data.extend(get_task_tree_rows(project, as_on_date))
    data.append({})

    data.extend(get_site_diary_log_rows(project, as_on_date))

    return data


def get_columns():

    return [
        {
            "label": _("Task / Stage / Site Diary"),
            "fieldname": "section",
            "fieldtype": "Data",
            "width": 340
        },
        {
            "label": _("ID"),
            "fieldname": "task_id",
            "fieldtype": "Data",
            "width": 110
        },
        {
            "label": _("Status"),
            "fieldname": "status",
            "fieldtype": "Data",
            "width": 130
        },
        {
            "label": _("Progress %"),
            "fieldname": "progress",
            "fieldtype": "Percent",
            "width": 100
        },
        {
            "label": _("Planned Start"),
            "fieldname": "planned_start",
            "fieldtype": "Date",
            "width": 100
        },
        {
            "label": _("Planned End"),
            "fieldname": "planned_end",
            "fieldtype": "Date",
            "width": 100
        },
        {
            "label": _("Actual Start"),
            "fieldname": "actual_start",
            "fieldtype": "Date",
            "width": 100
        },
        {
            "label": _("Actual End"),
            "fieldname": "actual_end",
            "fieldtype": "Date",
            "width": 100
        },
        {
            "label": _("Delay (Days)"),
            "fieldname": "delay_days",
            "fieldtype": "Int",
            "width": 100
        },
        {
            "label": _("Total Qty"),
            "fieldname": "total_qty",
            "fieldtype": "Float",
            "width": 100
        },
        {
            "label": _("Achieved Qty"),
            "fieldname": "achieved_qty",
            "fieldtype": "Float",
            "width": 100
        },
        {
            "label": _("UOM"),
            "fieldname": "uom",
            "fieldtype": "Data",
            "width": 80
        },
        {
            "label": _("Last Site Update"),
            "fieldname": "last_site_update",
            "fieldtype": "Date",
            "width": 130
        },
        {
            "label": _("Days Since Update"),
            "fieldname": "days_since_update",
            "fieldtype": "Int",
            "width": 140
        },
        {
            "label": _("Site Engineer"),
            "fieldname": "site_engineer",
            "fieldtype": "Data",
            "width": 140
        },
        {
            "label": _("Remarks"),
            "fieldname": "remarks",
            "fieldtype": "Data",
            "width": 280
        }
    ]
