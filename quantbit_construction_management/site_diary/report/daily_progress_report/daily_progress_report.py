import frappe

from quantbit_construction_management.site_diary.doctype.site_diary.site_diary import (
    get_material_deliveries,
    get_material_received
)


def execute(filters=None):

    if not filters:
        filters = {}

    project = filters.get("project")
    site_date = filters.get("site_date")

    columns = get_columns()
    data = []
    grand_total = 0

    project_name = frappe.db.get_value(
        "Project",
        project,
        "project_name"
    )

    task_subject_cache = {}
    item_type_cache = {}
    item_name_cache = {}

    def get_task_subject(task):

        if not task:
            return None

        if task not in task_subject_cache:
            task_subject_cache[task] = frappe.db.get_value(
                "Task",
                task,
                "subject"
            )

        return task_subject_cache[task]

    def get_item_type(item):

        if not item:
            return None

        if item not in item_type_cache:

            res = frappe.db.get_value(
                "Item",
                item,
                ["custom_item_type", "item_group"],
                as_dict=True
            )

            item_type_cache[item] = (
                res.get("custom_item_type")
                if res and res.get("custom_item_type")
                else res.get("item_group") if res else None
            )

        return item_type_cache[item]

    def get_item_name(item_code):

        if not item_code:
            return None

        if item_code not in item_name_cache:
            item_name_cache[item_code] = frappe.db.get_value(
                "Item",
                item_code,
                "item_name"
            )

        return item_name_cache[item_code]

    def row(section, **kwargs):

        return {
            "section": section,

            "project_name": kwargs.get("project_name"),

            "site_engineer": kwargs.get("site_engineer"),

            "task": kwargs.get("task"),
            "task_subject": kwargs.get("task_subject"),

            "subtask": kwargs.get("subtask"),
            "subtask_subject": kwargs.get("subtask_subject"),

            "item": kwargs.get("item"),
            "item_type": kwargs.get("item_type"),

            "contractor": kwargs.get("contractor"),

            "working_hours": kwargs.get("working_hours"),

            "visitor_name": kwargs.get("visitor_name"),
            "purpose": kwargs.get("purpose"),
            "company": kwargs.get("company"),
            "time_in": kwargs.get("time_in"),
            "time_out": kwargs.get("time_out"),

            "skill_type": kwargs.get("skill_type"),

            "warehouse": kwargs.get("warehouse"),
            "target_warehouse": kwargs.get("target_warehouse"),

            "uom": kwargs.get("uom"),

            "quantity": kwargs.get("quantity"),
            "rate": kwargs.get("rate"),
            "amount": kwargs.get("amount") or 0,

            "transaction_type": kwargs.get("transaction_type"),
            "entry_id": kwargs.get("entry_id"),
            "total_qty": kwargs.get("total_qty"),
            "total_achieved": kwargs.get("total_achieved"),
            "percent_completed": kwargs.get("percent_completed"),
            "achieved_today": kwargs.get("achieved_today"),
        }

    # EQUIPMENT USAGE
    equipment_total = 0

    data.append(row(
        "Equipment Usage",
        project_name=project_name
    ))

    equipment = frappe.db.sql("""
        SELECT
            emp.employee_name AS site_engineer,
            eud.task,
            eud.subtask,
            eud.equipment_item,
            eud.contractor,
            eud.working_hrs,
            eud.amount,
            eud.rate,
            eud.quantity,
            eud.uom

        FROM `tabEquipment Usage Details` eud

        INNER JOIN `tabEquipment Usage` eu
            ON eu.name = eud.parent

        LEFT JOIN `tabEmployee` emp
            ON emp.name = eu.site_engineer

        WHERE
            eu.project = %(project)s
            AND eu.site_date = %(site_date)s

    """, {
        "project": project,
        "site_date": site_date
    }, as_dict=1)

    for e in equipment:

        equipment_total += e.amount or 0

        data.append(row(
            "Equipment Usage",

            project_name=project_name,

            site_engineer=e.site_engineer,

            task=e.task,
            task_subject=get_task_subject(e.task),

            subtask=e.subtask,
            subtask_subject=get_task_subject(e.subtask),

            item=get_item_name(e.equipment_item),
            item_type=get_item_type(e.equipment_item),

            contractor=e.contractor,

            working_hours=e.working_hrs,

            amount=e.amount,
            rate=e.rate,
            quantity=e.quantity,
            uom=e.uom
        ))

    data.append(row(
        "Equipment Usage TOTAL",
        amount=equipment_total
    ))

    grand_total += equipment_total

    data.append({})
    data.append({})

    # VISITORS
    data.append(row(
        "Visitors",
        project_name=project_name
    ))

    visitors = frappe.get_all(
        "Project Visitor",
        filters={
            "project": project,
            "site_date": site_date
        },
        fields=[
            "visitor_name",
            "purpose",
            "company",
            "time_in",
            "time_out"
        ]
    )

    for v in visitors:

        data.append(row(
            "Visitors",

            project_name=project_name,

            visitor_name=v.visitor_name,
            purpose=v.purpose,
            company=v.company,
            time_in=v.time_in,
            time_out=v.time_out
        ))

    data.append({})
    data.append({})

    # MANPOWER USAGE
    manpower_total = 0

    data.append(row(
        "Manpower Usage",
        project_name=project_name
    ))

    manpower = frappe.db.sql("""
        SELECT
            mud.task,
            mud.subtask,
            mud.contractor,
            mud.skill_type,
            mud.quantity,
            mud.amount,
            mud.uom,
            mud.rate,
            mud.equipment_item

        FROM `tabManpower Usage Details` mud

        INNER JOIN `tabManpower Usage` mu
            ON mu.name = mud.parent

        WHERE
            mu.project = %(project)s
            AND mu.site_date = %(site_date)s

    """, {
        "project": project,
        "site_date": site_date
    }, as_dict=1)

    for m in manpower:

        manpower_total += m.amount or 0

        data.append(row(
            "Manpower Usage",

            project_name=project_name,

            task=m.task,
            task_subject=get_task_subject(m.task),
            item=get_item_name(m.equipment_item),

            subtask=m.subtask,
            subtask_subject=get_task_subject(m.subtask),

            contractor=m.contractor,
            skill_type=m.skill_type,

            quantity=m.quantity,
            amount=m.amount,
            rate=m.rate,
            uom=m.uom
        ))

    data.append(row(
        "Manpower Usage TOTAL",
        amount=manpower_total
    ))

    grand_total += manpower_total

    data.append({})
    data.append({})

    # MATERIAL CONSUMED
    consumed_total = 0

    data.append(row(
        "Material Consumed",
        project_name=project_name
    ))

    consumed = get_material_deliveries(project, site_date) or []

    for c in consumed:

        consumed_total += c.get("amount") or 0

        data.append(row(
            "Material Consumed",

            project_name=project_name,

            entry_id=c.get("stock_entry"),

            transaction_type="Material Issue",

            task=c.get("task"),
            task_subject=get_task_subject(c.get("task")),

            subtask=c.get("subtask"),
            subtask_subject=get_task_subject(c.get("subtask")),

            item=get_item_name(c.get("item_code")),
            item_type=c.get("item_type"),

            uom=c.get("uom"),

            quantity=c.get("qty"),

            warehouse=c.get("s_warehouse"),

            rate=c.get("basic_rate"),
            amount=c.get("amount")
        ))

    data.append(row(
        "Material Consumed TOTAL",
        amount=consumed_total
    ))

    grand_total += consumed_total

    data.append({})
    data.append({})

    # MATERIAL RECEIVED
    received_total = 0

    data.append(row(
        "Material Received",
        project_name=project_name
    ))

    final_received = get_material_received(project, site_date) or []

    for r in final_received:

        received_total += r.get("amount") or 0

        if r.get("reference_type") == "Purchase Receipt":

            data.append(row(
                "Material Received",

                project_name=project_name,

                entry_id=r.get("reference_name"),

                transaction_type=r.get("reference_type"),

                item=get_item_name(r.get("item_code")),
                item_type=get_item_type(r.get("item_code")),

                uom=r.get("uom"),

                quantity=r.get("qty"),

                rate=r.get("rate"),

                target_warehouse=r.get("warehouse"),

                amount=r.get("amount")
            ))

        else:

            data.append(row(
                "Material Received",

                project_name=project_name,

                entry_id=r.get("reference_name"),

                transaction_type=r.get("reference_type"),

                item=r.get("item_code"),
                item_type=get_item_type(r.get("item_code")),

                uom=r.get("uom"),

                quantity=r.get("qty"),

                rate=r.get("rate"),

                warehouse=r.get("warehouse"),

                target_warehouse=r.get("target_warehouse"),

                amount=r.get("amount")
            ))

    data.append(row(
        "Material Received TOTAL",
        amount=received_total
    ))

    grand_total += received_total

    data.append({})
    data.append({})

    # TASK PROGRESS
    task_progress_total = 0

    data.append(row(
        "Task Progress",
        project_name=project_name
    ))

    task_progress = frappe.db.sql("""
        SELECT
            tp.parent_task as task,
            tp.task as subtask,
            tp.parent_task_subject as task_subject,
            tp.task_subject as subtask_subject,
            tp.total_qty,
            tp.achieved_today,
            tp.total_achieved,
            tp.percent_completed
        FROM `tabTask Progress Details` tp
        INNER JOIN `tabTask Progress` t
            ON t.name = tp.parent
        WHERE
            t.project = %(project)s
            AND t.site_date = %(site_date)s
    """, {
        "project": project,
        "site_date": site_date
    }, as_dict=1)

    for t in task_progress:
        total_qty = t.get("total_qty") or 0
        achieved_today = t.get("achieved_today") or 0
        total_achieved = t.get("total_achieved") or 0
        percent_completed = t.get("percent_completed") or 0

        data.append(row(
            "Task Progress",

            project_name=project_name,
            task=t.get("task"),
            task_subject=get_task_subject(t.get("task")),
            subtask=t.get("subtask"),
            subtask_subject=get_task_subject(t.get("subtask")),

            total_qty=total_qty,
            total_achieved=total_achieved,
            percent_completed=percent_completed,
            achieved_today=achieved_today or 0
        ))

    data.append(row(
        "Task Progress TOTAL",
        amount=task_progress_total
    ))

    grand_total += task_progress_total

    # GRAND TOTAL
    data.append(row(
        "GRAND TOTAL",
        amount=grand_total,
        project_name=project_name
    ))

    return columns, data

def get_columns():

    return [
        {
            "label": "Section",
            "fieldname": "section",
            "fieldtype": "Data",
            "width": 160
        },
        {
            "label": "Site Engineer",
            "fieldname": "site_engineer",
            "fieldtype": "Data"
        },
        {
            "label": "Task",
            "fieldname": "task",
            "fieldtype": "Data"
        },
        {
            "label": "Task Subject",
            "fieldname": "task_subject",
            "fieldtype": "Data"
        },
        {
            "label": "Subtask",
            "fieldname": "subtask",
            "fieldtype": "Data"
        },
        {
            "label": "Subtask Subject",
            "fieldname": "subtask_subject",
            "fieldtype": "Data"
        },
       {
            "label": "Total Qty",
            "fieldname": "total_qty",
            "fieldtype": "Float"
        },
        {
            "label": "Achieved Today",
            "fieldname": "achieved_today",
            "fieldtype": "Float"
        },
        {
            "label": "Total Achieved",
            "fieldname": "total_achieved",
            "fieldtype": "Float"
        },
        {
            "label": "Progress Completed",
            "fieldname": "percent_completed",
            "fieldtype": "Percent"
        },
       {
            "label": "Item",
            "fieldname": "item",
            "fieldtype": "Data"
        },
        {
            "label": "Item Type",
            "fieldname": "item_type",
            "fieldtype": "Data"
        },
        {
            "label": "Contractor",
            "fieldname": "contractor",
            "fieldtype": "Data"
        },
        {
            "label": "Visitor Name",
            "fieldname": "visitor_name",
            "fieldtype": "Data"
        },
        {
            "label": "Purpose",
            "fieldname": "purpose",
            "fieldtype": "Data"
        },
        {
            "label": "Company",
            "fieldname": "company",
            "fieldtype": "Data"
        },
        {
            "label": "Time In",
            "fieldname": "time_in",
            "fieldtype": "Data"
        },
        {
            "label": "Time Out",
            "fieldname": "time_out",
            "fieldtype": "Data"
        },
        {
            "label": "Skill Type",
            "fieldname": "skill_type",
            "fieldtype": "Data"
        },
        {
            "label": "Transaction Type",
            "fieldname": "transaction_type",
            "fieldtype": "Data"
        },
        {
            "label": "Transaction ID",
            "fieldname": "entry_id",
            "fieldtype": "Data"
        },
        {
            "label": "Source Warehouse",
            "fieldname": "warehouse",
            "fieldtype": "Data"
        },
        {
            "label": "Target Warehouse",
            "fieldname": "target_warehouse",
            "fieldtype": "Data"
        },
        {
            "label": "UOM",
            "fieldname": "uom",
            "fieldtype": "Data"
        },
        {
            "label": "Rate",
            "fieldname": "rate",
            "fieldtype": "Float"
        },
        {
            "label": "Working Hours",
            "fieldname": "working_hours",
            "fieldtype": "Float"
        },
        {
            "label": "Quantity",
            "fieldname": "quantity",
            "fieldtype": "Float"
        },
        {
            "label": "Amount",
            "fieldname": "amount",
            "fieldtype": "Float"
        }
    ]