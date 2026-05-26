import frappe


def update_task_material_cost(doc, method):

    if doc.docstatus != 1:
        return

    if doc.stock_entry_type != "Material Issue":
        return

    task_wise_amount = {}

    for row in doc.items:

        task = row.custom_subtask or row.custom_task

        if not task:
            continue

        amount = row.amount or 0

        if task not in task_wise_amount:
            task_wise_amount[task] = 0

        task_wise_amount[task] += amount

    for task, total_amount in task_wise_amount.items():

        existing_cost = frappe.db.get_value(
            "Task",
            task,
            "custom_total_material_cost"
        ) or 0

        new_total = existing_cost + total_amount

        frappe.db.set_value(
            "Task",
            task,
            "custom_total_material_cost",
            new_total
        )

    frappe.db.commit()