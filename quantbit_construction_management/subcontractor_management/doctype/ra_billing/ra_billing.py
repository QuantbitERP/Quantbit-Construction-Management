# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt
import frappe
from frappe.model.document import Document
from frappe.utils import flt
from frappe.model.mapper import get_mapped_doc

class RABilling(Document):

    def on_submit(self):
        self.update_billed_quantity()

    def update_billed_quantity(self):

        for row in self.ra_billing_details:

            if not row.subtask_subject:
                continue

            subtask_name = frappe.db.get_value(
                "Task",
                {
                    "subject": row.subtask_subject,
                    ""
                    "custom_is_subtask": 1,
                    "project": self.project
                },
                "name"
            )

            if not subtask_name:
                continue

            current_billed = flt(
                frappe.db.get_value(
                    "Task",
                    subtask_name,
                    "custom_billed_quantity"
                )
            )

            frappe.db.set_value(
                "Task",
                subtask_name,
                "custom_billed_quantity",
                current_billed + flt(row.billable_quantity)
            )

@frappe.whitelist()
def get_project_tasks(project):

    data = []
    # Fetch all stages (tasks without parent)
    stages = frappe.get_all(
        "Task",
        filters={
            "project": project,
            "custom_is_stage":1,
            "is_group":1,
            "parent_task": ["in", ["", None]]
        },
        fields=["name", "subject"],
        order_by="creation asc"
    )

    for stage in stages:
        # Fetch tasks under stage
        tasks = frappe.get_all(
            "Task",
            filters={
                "project": project,
                "custom_is_task":1,
                "is_group":1,
                "parent_task": stage.name
            },
            fields=["name", "subject"],
            order_by="creation asc"
        )

        for task in tasks:
            # Fetch subtasks under task
            subtasks = frappe.get_all(
                "Task",
                filters={
                    "project": project,
                    "custom_is_subtask":1,
                    "parent_task": task.name
                },
                fields=[
                    "name",
                    "subject",
                    "progress",
                    "custom_total_quantity",
                    "custom_total_achieved",
                    "custom_rate",
                    "custom_billed_quantity"
                ],
                order_by="creation asc"
            )

            for subtask in subtasks:

                data.append({
                    "stage": stage.subject,
                    "stage_id":stage.name,
                    "task_id":task.name,
                    "subtask_id":subtask.name,
                    "task": task.subject,
                    "subtask": subtask.subject,
                    "progress": subtask.progress,
                    "total_quantity": subtask.custom_total_quantity,
                    "total_achieved": subtask.custom_total_achieved,
                    "rate": subtask.custom_rate,
                    "billed_quantity": subtask.custom_billed_quantity
                })

    return data

from frappe.model.mapper import get_mapped_doc

@frappe.whitelist()
def create_sales_invoice(source_name, target_doc=None, item_code=None):
    item_code = frappe.flags.args.get("item_code")
    item_name = frappe.db.get_value("Item", item_code, "item_name")
    uom = frappe.db.get_value(
    "UOM Conversion Detail",
    {"parent": item_code},
    "uom"
)
    
    def set_missing_values(source, target):

        target.customer = source.customer
        target.project = source.project
        target.custom_doc_link_doctype = "RA Billing"
        target.custom_doc_link = source.name
        target.append("items", {
            "item_code": item_code,
            "item_name": item_name,
            "qty": 1,
            "uom": uom,
            "rate": source.grand_total
        })

    doc = get_mapped_doc(
        "RA Billing",
        source_name,
        {
            "RA Billing": {
                "doctype": "Sales Invoice"
            }
        },
        target_doc,
        set_missing_values
    )

    return doc