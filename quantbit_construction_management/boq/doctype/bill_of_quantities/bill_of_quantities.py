# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils.xlsxutils import build_xlsx_response, read_xlsx_file_from_attached_file


class BillofQuantities(Document):

    def validate(self):
        self.calculate_contract_value()
        self.validate_tasks_exist()
        self.validate_item_exist()
        self.validate_contract_value()
        self.validate_item_values()

    def calculate_contract_value(self):
        total = 0

        for row in self.boq_items:
            total += row.amount or 0

        self.contract_value = total

    def validate_item_exist(self):
        if not self.boq_items:
            frappe.throw("Add at least one item in the BOQ Items before saving.")

    def validate_tasks_exist(self):
        if not self.tasks_details:
            frappe.throw("Add Task in Task Details before saving.")

        for row in self.tasks_details:
            if not row.task:
                frappe.throw(
                    ("Add Task at row {0}")
                    .format(row.idx)
                )

    def validate_contract_value(self):
        if self.contract_value <= 0:
            frappe.throw(
                "Contract Value cannot be zero — add task with item, quantity and rates."
            )

    def validate_item_values(self):
        for row in self.boq_items:
            if row.quantity <= 0 or row.unit_rate <= 0:
                frappe.throw(
                    ("Item at row {0} - {1} has zero quantity or rate.")
                    .format(row.idx, row.item_code)
                )


@frappe.whitelist()
def get_boq_items_from_task(task_name):

    boq_items = []

    child_tasks = frappe.get_all(
        "Task",
        filters={"parent_task": task_name},
        fields=["name", "subject"]
    )

    for task in child_tasks:

        task_doc = frappe.get_doc("Task", task.name)

        for row in task_doc.custom_bom_details:

            boq_items.append({
                "task": task_name,
                "subtask": task.name,
                "subtask_name": task.subject,

                "item_code": row.item,
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