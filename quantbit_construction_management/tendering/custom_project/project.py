import frappe

@frappe.whitelist()
def get_columns(project):
    tasks = frappe.get_all(
        "Task",
        filters={
            "project": project,
            "custom_is_level_task": 1
        },
        fields=["subject"],
        order_by="subject"
    )

    unique_subjects = set()
    result = []

    for task in tasks:
        if task.subject not in unique_subjects:
            unique_subjects.add(task.subject)
            result.append({
                "subject": task.subject,
                "level_task": 1
            })

    return result