# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


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