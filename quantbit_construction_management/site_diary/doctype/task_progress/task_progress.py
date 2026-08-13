import frappe
from frappe.model.document import Document
from frappe.utils import flt, today


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
                "custom_percent_completed": row.percent_completed
            })

            if row.is_subcontractor and row.subcontractor:
                self.update_subcontractor_details(task_to_update, row, reverse=False)

            self.update_parent_progress(task_to_update)

    def on_cancel(self):

        for row in self.task_progress_details:

            task_to_update = self.get_deepest_task(row)

            if not task_to_update:
                continue

            task_data = frappe.db.get_value(
                "Task",
                task_to_update,
                ["custom_total_achieved", "custom_total_quantity"],
                as_dict=True
            )

            total_qty = flt(task_data.custom_total_quantity)
            total_achieved = flt(task_data.custom_total_achieved) - flt(row.achieved_today)
            total_achieved = max(total_achieved, 0)

            percent_completed = 0
            if total_qty:
                percent_completed = min((total_achieved / total_qty) * 100, 100)

            frappe.db.set_value("Task", task_to_update, {
                "progress": percent_completed,
                "custom_total_achieved": total_achieved,
                "custom_percent_completed": percent_completed
            })

            if row.is_subcontractor and row.subcontractor:
                self.update_subcontractor_details(task_to_update, row, reverse=True)

            self.update_parent_progress(task_to_update)

    def update_subcontractor_details(self, task_to_update, row, reverse=False):
        """Add (or, on cancel, remove) this row's contribution to the
        Task's subcontractor-wise breakup, then recalculate the Task's
        subcontracting totals."""

        task_doc = frappe.get_doc("Task", task_to_update)

        qty_delta = flt(row.achieved_today)
        rate = flt(row.rate)
        amount_delta = flt(row.amount) if row.amount else qty_delta * rate

        if reverse:
            qty_delta = -qty_delta
            amount_delta = -amount_delta

        target_row = None
        for d in task_doc.custom_subcontractor_details:
            if d.subcontractor == row.subcontractor and d.date == self.site_date:
                target_row = d
                break

        if not target_row:
            if reverse:
                # nothing left to revert against
                return
            target_row = task_doc.append("custom_subcontractor_details", {
                "subcontractor": row.subcontractor,
                "subcontractor_name": frappe.db.get_value(
                    "Contractor", row.subcontractor, "contractor_name"
                ) or row.subcontractor,
                "quantity": 0,
                "amount": 0,
                "date": self.site_date
            })

        target_row.quantity = flt(target_row.quantity) + qty_delta
        target_row.amount = flt(target_row.amount) + amount_delta

        if rate:
            target_row.rate = rate

        target_row.date = self.site_date

        if reverse and target_row.quantity <= 0 and target_row.amount <= 0:
            task_doc.remove(target_row)

        self.recalculate_subcontracting_totals(task_doc)

        task_doc.flags.ignore_validate_update_after_submit = True
        task_doc.save(ignore_permissions=True)

    def recalculate_subcontracting_totals(self, task_doc):

        total_qty = 0
        total_billed = 0
        total_paid = 0
        total_amount = 0

        for d in task_doc.custom_subcontractor_details:
            total_qty += flt(d.quantity)
            total_billed += flt(d.billed_qty)
            total_paid += flt(d.paid_qty)
            total_amount += flt(d.amount)

        task_doc.custom_total_subcontracting_qty = total_qty
        task_doc.custom_total_billed_qty = total_billed
        task_doc.custom_total_paid_qty = total_paid
        task_doc.custom_total_subcontracting_amount = total_amount

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

    conditions = "task=%(task)s"
    values = {"task": task}

    if current_doc:
        conditions += " AND parent != %(current_doc)s"
        values["current_doc"] = current_doc

    previous = frappe.db.sql(f"""
        SELECT
            total_qty,
            total_achieved,
            percent_completed
        FROM `tabTask Progress Details`
        WHERE {conditions}
        ORDER BY creation DESC
        LIMIT 1
    """, values, as_dict=True)

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
