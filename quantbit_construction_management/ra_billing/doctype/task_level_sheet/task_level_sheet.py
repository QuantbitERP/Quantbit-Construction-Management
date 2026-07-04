# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class TaskLevelSheet(Document):	
    def before_submit(self):
        self.update_task_level_sheet()

    def update_task_level_sheet(self):
        task = None

        hierarchy = [
            self.task_level10,
            self.task_level9,
            self.task_level8,
            self.task_level7,
            self.task_level6,
            self.task_level5,
            self.task_level4,
            self.task_level3,
            self.task_level2,
            self.task_level1,
            self.task,
        ]

        for d in hierarchy:
            if d:
                task = d
                break

        if not task:
            frappe.throw("Task not found.")

        task_doc = frappe.get_doc("Task", task)

        task_doc.custom_average_level = self.average

        task_doc.set("custom_level_sheet_details", [])

        for row in self.level_sheet_details:

            task_doc.append(
                "custom_level_sheet_details",
                {
                    "design": row.get("design"),
                    "bs": row.get("bs"),
                    "is": row.get("is"),
                    "fs": row.get("fs"),
                    "hi": row.get("hi"),
                    "rl": row.get("rl"),
                    "remark": row.get("remark"),
                },
            )

        task_doc.save(ignore_permissions=True)
	

        frappe.msgprint(
            ("Level Sheet updated in Task <b>{0}</b>").format(task_doc.name),
            alert=True,
        )


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

        if txt and txt.lower() not in d.task.lower():
            continue

        subject = frappe.db.get_value("Task", d.task, "subject")

        results.append([
            d.task,        
            subject or d.task  
        ])

    return results

@frappe.whitelist()
def has_dependencies(task):

    doc = frappe.get_doc("Task", task)

    return len(doc.depends_on) > 0