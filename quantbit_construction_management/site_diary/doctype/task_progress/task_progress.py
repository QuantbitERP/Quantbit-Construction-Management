import frappe
from frappe.model.document import Document


class TaskProgress(Document):

    def before_save(self):
        for i, row in enumerate(self.task_progress_details, start=1):

            task_to_update = self.get_deepest_task(row)
            if not task_to_update:
                continue

            data = frappe.db.get_value(
                "Task",
                task_to_update,
                ["subject", "custom_is_subtask"],
                as_dict=True
            )

            if not data.custom_is_subtask:
                frappe.throw(f'Row {i} : Task "{data.subject}" is not a subtask.')
           

    def before_submit(self):

        for row in self.task_progress_details:

            task_to_update = self.get_deepest_task(row)

            if not task_to_update:
                continue
            frappe.db.set_value("Task", task_to_update, {
                "progress": row.percent_completed,
                "custom_total_quantity": row.total_qty,
                "custom_total_achieved": row.total_achieved,
                "custom_percent_completed":row.percent_completed
            })
            self.update_parent_progress(row.task)
    
    def get_deepest_task(self,row):
        levels = [
            "task",
            "task_level1",
            "task_level2",
            "task_level3",
            "task_level4",
            "task_level5",
            "task_level6",
            "task_level7",
            "task_level8",
            "task_level9",
            "task_level10"
        ]

        last_task = None

        for field in levels:
            task = getattr(row, field, None)
            if task:
                last_task = task
            else:
                break

        return last_task

    def update_parent_progress(self, task):

        parent = frappe.db.get_value("Task", task, "parent_task")

        if not parent:

            project = frappe.db.get_value("Task", task, "project")

            if not project:
                return

            stages = frappe.get_all(
                "Task",
                filters={
                    "project": project,
                    "custom_is_stage": 1
                },
                fields=["progress", "task_weight"]
            )

            if not stages:
                frappe.db.set_value(
                    "Project",
                    project,
                    "percent_complete",
                    0
                )
                return

            project_progress = 0

            for stage in stages:

                progress = stage.progress or 0
                weight = stage.task_weight or 0

                project_progress += (
                    progress * weight
                ) / 100

            project_progress = min(project_progress, 100)

            frappe.db.set_value(
                "Project",
                project,
                "percent_complete",
                project_progress
            )

            frappe.publish_realtime(
                "project_progress_refresh",
                {"project": project}
            )

            return

        children = frappe.get_all(
            "Task",
            filters={
                "parent_task": parent
            },
            fields=[
                "progress",
                "task_weight"
            ]
        )

        if not children:
            return

        weighted_total = 0

        for c in children:

            progress = c.progress or 0
            weight = c.task_weight or 0

            weighted_total += (
                progress * weight
            ) / 100

        weighted_total = min(weighted_total, 100)

        frappe.db.set_value(
            "Task",
            parent,
            "progress",
            weighted_total
        )

        self.update_parent_progress(parent)

@frappe.whitelist()
def get_previous_task_progress(task, current_doc=None):

    previous = frappe.db.sql("""
        SELECT
            total_qty,
            total_achieved,
            percent_completed
        FROM `tabTask Progress Details`
        WHERE task=%s
        AND name != %s
        ORDER BY creation DESC
        LIMIT 1
    """, (
        task,
        current_doc or ""
    ), as_dict=True)

    percent_completed = 0

    if previous:
        percent_completed = previous[0].percent_completed or 0

    data = {
        "previous_total_achieved": 0,
        "total_qty": 0,
        "percent_completed": percent_completed
    }

    if previous:
        data.update({
            "previous_total_achieved": previous[0].total_achieved or 0,
            "total_qty": previous[0].total_qty or 0,
            "percent_completed": previous[0].percent_completed or 0
        })

    return data

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