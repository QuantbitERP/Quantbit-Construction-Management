# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
import json
from frappe.model.document import Document
from frappe.utils.xlsxutils import build_xlsx_response, read_xlsx_file_from_attached_file


class BillofQuantities(Document):
    def validate(self):
        self.calculate_contract_value()
        # self.validate_contract_value()
        # self.validate_item_values()

    def calculate_contract_value(self):
        total = 0
        for row in self.boq_items:
            total += row.amount or 0
        self.contract_value = total

@frappe.whitelist()
def update_task_bom_details(task_name, bom_details):
    import json
    from frappe.utils import flt
    if isinstance(bom_details, str):
        bom_details = json.loads(bom_details)
    
    task = frappe.get_doc("Task", task_name)
    task.set("custom_bom_details", [])
    for row in bom_details:
        task.append("custom_bom_details", {
            "item": row.get("item"),
            "item_name": row.get("item_name"),
            "qty": row.get("qty"),
            "uom": row.get("uom"),
            "rate": row.get("rate"),
            "item_type": row.get("item_type"),
            "total_amount": flt(row.get("qty") or 0) * flt(row.get("rate") or 0)
        })
    task.save(ignore_permissions=True)
    return task.name


@frappe.whitelist()
def get_boq_items_from_task(task_name):

    boq_items = []

    child_tasks = frappe.get_all(
        "Task",
        filters={"parent_task": task_name},
        fields=["name", "subject"]
    )

    # Debug: log what we found
    frappe.logger().debug(f"get_boq_items_from_task: task={task_name}, child_tasks={[t.name for t in child_tasks]}")

    task_subject = frappe.db.get_value("Task", task_name, "subject")
    for task in child_tasks:

        task_doc = frappe.get_doc("Task", task.name)

        bom_rows = task_doc.get("custom_bom_details") or []
        frappe.logger().debug(f"  subtask={task.name}, bom_rows={len(bom_rows)}")

        for row in bom_rows:

            boq_items.append({
                "task": task_name,
                "task_subject":task_subject,
                "subtask": task.name,
                "subtask_name": task.subject,

                "item_code": row.item,
                "item_no": row.item_name,
                "item_type": row.item_type,

                "quantity": row.qty,
                "unit": row.uom,
                "unit_rate": row.rate,
                "amount": row.total_amount,

                "internal_qty": row.qty,
                "internal_rate": row.rate,
                "internal_amount": row.total_amount,

                "actual_qty": row.qty,
                "actual_rate": row.rate,
                "actual_amount": row.total_amount
            })

    return boq_items

@frappe.whitelist()
def get_boq_items_from_subtask(subtask_name):
    boq_items = []
    task_doc = frappe.get_doc("Task", subtask_name)
    
    # If the task has a parent, it's a subtask. Otherwise it's a top-level task.
    if task_doc.parent_task:
        task_id = task_doc.parent_task
        subtask_id = task_doc.name
    else:
        task_id = task_doc.name
        subtask_id = ""
    task_subject = frappe.db.get_value("Task", task_id, "subject")

    bom_rows = task_doc.get("custom_bom_details") or []
    for row in bom_rows:
        boq_items.append({
            "task": task_id,
            "subtask": subtask_id,
            "task_subject": task_subject,
            "subtask_name": task_doc.subject,
            "item_code": row.item,
            "item_no": row.item_name,
            "item_type": row.item_type,
            "quantity": row.qty,
            "unit": row.uom,
            "unit_rate": row.rate,
            "amount": row.total_amount,
            "internal_qty": row.qty,
            "internal_rate": row.rate,
            "internal_amount": row.total_amount,
            "actual_qty": row.qty,
            "actual_rate": row.rate,
            "actual_amount": row.total_amount
        })
    return boq_items

@frappe.whitelist()
def download_boq_task_template():
    columns = ["Stage", "Task", "Subtask", "Status", "Priority", "Task Weight"]
    data = [columns]
    build_xlsx_response(data, "BOQ_Task_Template")

@frappe.whitelist()
def import_boq_tasks(file_url, boq_name):
    rows = read_xlsx_file_from_attached_file(file_url=file_url)
    if not rows or len(rows) < 2:
        frappe.throw("The uploaded file is empty or missing data.")
    
    headers = rows[0]
    data_rows = rows[1:]

    def get_val(row, header_name):
        try:
            idx = headers.index(header_name)
            return row[idx]
        except ValueError:
            return None

    stages = {}
    tasks = {}
    subtasks = []

    for row in data_rows:
        stage_val = get_val(row, "Stage")
        task_val = get_val(row, "Task")
        subtask_val = get_val(row, "Subtask")

        status = get_val(row, "Status") or "Open"
        priority = get_val(row, "Priority") or "Medium"
        task_weight = get_val(row, "Task Weight (%)") or get_val(row, "Task Weight") or 0.0

        if not stage_val:
            continue

        if stage_val not in stages:
            stages[stage_val] = {
                "subject": stage_val,
                "status": "Open",
                "priority": "Medium",
                "task_weight": 0.0
            }

        if task_val:
            task_key = f"{stage_val}||{task_val}"
            if task_key not in tasks:
                tasks[task_key] = {
                    "subject": task_val,
                    "parent_subject": stage_val,
                    "status": "Open",
                    "priority": "Medium",
                    "task_weight": 0.0
                }

            if subtask_val:
                subtasks.append({
                    "subject": subtask_val,
                    "parent_key": task_key,
                    "status": status,
                    "priority": priority,
                    "task_weight": task_weight
                })
            else:
                tasks[task_key].update({
                    "status": status,
                    "priority": priority,
                    "task_weight": task_weight
                })
        else:
            stages[stage_val].update({
                "status": status,
                "priority": priority,
                "task_weight": task_weight
            })

    subject_to_name = {}

    for stage_val, t in stages.items():
        doc = frappe.get_doc({
            "doctype": "Task",
            "subject": t["subject"],
            "status": t["status"],
            "priority": t["priority"],
            "task_weight": t["task_weight"],
            "custom_is_stage": 1,
            "custom_boq_name": boq_name,
            "is_group": 1
        })
        doc.insert(ignore_permissions=True)
        subject_to_name[f"STAGE||{stage_val}"] = doc.name

    for task_key, t in tasks.items():
        parent_id = subject_to_name.get(f"STAGE||{t['parent_subject']}")
        doc = frappe.get_doc({
            "doctype": "Task",
            "subject": t["subject"],
            "status": t["status"],
            "priority": t["priority"],
            "task_weight": t["task_weight"],
            "custom_is_task": 1,
            "parent_task": parent_id,
            "custom_boq_name": boq_name,
            "is_group": 1
        })
        doc.insert(ignore_permissions=True)
        subject_to_name[f"TASK||{task_key}"] = doc.name

    for t in subtasks:
        parent_id = subject_to_name.get(f"TASK||{t['parent_key']}")
        doc = frappe.get_doc({
            "doctype": "Task",
            "subject": t["subject"],
            "status": t["status"],
            "priority": t["priority"],
            "task_weight": t["task_weight"],
            "custom_is_subtask": 1,
            "parent_task": parent_id,
            "custom_boq_name": boq_name,
        })
        doc.insert(ignore_permissions=True)

    return "Success"

@frappe.whitelist()
def create_stage_task(boq_name=None, selected_stages=None, values=None):
        if isinstance(selected_stages, str):
            selected_stages = json.loads(selected_stages)

        created = []

        for stage_name in selected_stages:

            old_doc = frappe.get_doc("Task", stage_name)

            new_doc = frappe.get_doc({
                "doctype": "Task",
                "subject": old_doc.subject,
                "custom_is_stage": 1,
                "is_group":1,
                "custom_boq_name":boq_name
            })

            new_doc.insert(ignore_permissions=True)

            created.append(new_doc.name)

        return created

@frappe.whitelist()
def create_task(  boq_name=None,
    selected_tasks=None,
    parent_stage=None,
    include_children=False):
        if isinstance(selected_tasks, str):
            selected_tasks = json.loads(selected_tasks)

        created = []
        # frappe.msgprint(stage)

        for stage_name in selected_tasks:

            old_doc = frappe.get_doc("Task", stage_name)

            new_doc = frappe.get_doc({
                "doctype": "Task",
                "subject": old_doc.subject,
                "custom_is_task": 1,
                "is_group":1,
                "custom_boq_name":boq_name,
                "parent_task":parent_stage
            })

            new_doc.insert(ignore_permissions=True)

            created.append(new_doc.name)

        return created

@frappe.whitelist()
def create_subtask(boq_name=None, selected_stages=None, values=None,task=None):
        if isinstance(selected_stages, str):
            selected_stages = json.loads(selected_stages)

        created = []

        for stage_name in selected_stages:

            old_doc = frappe.get_doc("Task", stage_name)

            new_doc = frappe.get_doc({
                "doctype": "Task",
                "subject": old_doc.subject,
                "custom_is_subtask": 1,
                "custom_boq_name":boq_name,
                "parent_task":task
            })

            new_doc.insert(ignore_permissions=True)

            created.append(new_doc.name)

        return created

@frappe.whitelist()
def delete_boq_tasks(boq_name):

    tasks = frappe.get_all(
        "Task",
        filters={
            "custom_boq_name": boq_name
        },
        pluck="name"
    )

    for task in tasks:
        frappe.delete_doc("Task", task, force=1)

    frappe.db.commit()

    return True