import frappe
from frappe.model.document import Document

@frappe.whitelist()
def has_dependencies(task):

    doc = frappe.get_doc("Task", task)

    return len(doc.depends_on) > 0

@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_depends_on_tasks(doctype, txt, searchfield, start, page_len, filters):

    task = filters.get("task")

    if not task:
        return []

    doc = frappe.get_doc("Task", task)

    results = []

    for d in doc.depends_on:
        if not d.task:
            continue

        # optional search filter
        if txt and txt.lower() not in d.task.lower():
            continue

        subject = frappe.db.get_value("Task", d.task, "subject")

        results.append([
            d.task,        # VALUE stored
            subject or d.task  # DISPLAY text
        ])

    return results