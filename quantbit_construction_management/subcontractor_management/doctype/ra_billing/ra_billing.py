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
                current_billed + flt(row.quantity)
            )

@frappe.whitelist()
def get_details_from_task_progress(project, from_date, to_date):
    """
    Fetch submitted Task Progress records filtered by project and site_date range,
    aggregate achieved_today per subtask, then return enriched data.
    """

    tp_list = frappe.get_all(
        "Task Progress",
        filters={
            "project": project,
            "site_date": ["between", [from_date, to_date]],
            "docstatus": 1
        },
        fields=["name"]
    )

    if not tp_list:
        return []

    tp_names = [tp.name for tp in tp_list]

    tp_details = frappe.get_all(
        "Task Progress Details",
        filters={
            "parent": ["in", tp_names],
            "parenttype": "Task Progress"
        },
        fields=[
            "parent_task",   
            "task",          
            "achieved_today", 
        ]
    )

    if not tp_details:
        return []

    subtask_data = {}
    for row in tp_details:
        subtask_id = row.task
        if not subtask_id:
            continue

        qty = flt(row.achieved_today)

        if subtask_id not in subtask_data:
            subtask_data[subtask_id] = {
                "achieved_qty": 0,
                "parent_task": row.parent_task
            }
        subtask_data[subtask_id]["achieved_qty"] += qty

    if not subtask_data:
        return []

    result = []

    for subtask_id, info in subtask_data.items():
        # Fetch subtask details
        subtask = frappe.db.get_value(
            "Task",
            subtask_id,
            [
                "name", "subject", "parent_task",
                "custom_total_quantity", "custom_total_achieved",
                "custom_rate", "custom_billed_quantity","custom_uom"
            ],
            as_dict=True
        )

        if not subtask:
            continue

        task_id = info["parent_task"] or subtask.parent_task
        task = None
        stage = None

        if task_id:
            task = frappe.db.get_value(
                "Task",
                task_id,
                ["name", "subject", "parent_task"],
                as_dict=True
            )

        if task and task.parent_task:
            stage = frappe.db.get_value(
                "Task",
                task.parent_task,
                ["name", "subject"],
                as_dict=True
            )

        achieved_qty = info["achieved_qty"]
        billed_qty = flt(subtask.custom_billed_quantity)
        billable_qty = achieved_qty - billed_qty
        rate = flt(subtask.custom_rate)

        result.append({
            "stage":            stage.subject if stage else "",
            "stage_id":         stage.name if stage else "",
            "task_id":          task.name if task else "",
            "task":             task.subject if task else "",
            "subtask_id":       subtask.name,
            "subtask":          subtask.subject,
            "total_quantity":   subtask.custom_total_quantity,
            "rate":             rate,
            "billed_quantity":  billed_qty,
            "uom" : subtask.custom_uom or " "
        })

    return result

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