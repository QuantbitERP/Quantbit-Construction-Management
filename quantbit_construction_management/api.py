import frappe
@frappe.whitelist()
def get_template_subtasks(doctype, txt, searchfield, start, page_len, filters):
    parent_task = filters.get("parent_task")
    if not parent_task:
        return []
    task_doc = frappe.get_doc("Task", parent_task)
    depends_tasks = [
        d.task

        for d in task_doc.depends_on

        if d.task
    ]
    if not depends_tasks:
        return []
    return frappe.db.sql("""
        SELECT name, subject
        FROM `tabTask`
        WHERE name IN %(tasks)s
        AND name LIKE %(txt)s
        LIMIT %(page_len)s OFFSET %(start)s
    """, {
        "tasks": tuple(depends_tasks),
        "txt": f"%{txt}%",
        "page_len": page_len,
        "start": start
    })

@frappe.whitelist()
def clone_task_hierarchy(source_task, target_project, parent_task=None, include_dependencies=False, include_children=False,task_weight=None, custom_boq_name=None):
    include_dependencies = frappe.parse_json(include_dependencies)
    include_children = frappe.parse_json(include_children)
    source_doc = frappe.get_doc("Task", source_task)
    # Clone the Task
    new_task = frappe.copy_doc(source_doc)
    new_task.project = target_project
    new_task.parent_task = parent_task
    new_task.is_template = 0
    new_task.status = "Open"
    new_task.progress = 0
    new_task.completed_by = None
    new_task.completed_on = None
    new_task.act_start_date = None
    new_task.act_end_date = None
    new_task.task_weight = task_weight or source_task.task_weight
    new_task.custom_boq_name = custom_boq_name or source_task.custom_boq_name
    if not include_dependencies:
        new_task.depends_on = []
    new_task.insert()
    if include_children:
        # Get children
        children = frappe.get_all("Task", filters={"parent_task": source_task}, fields=["name"])
        for child in children:
            # Recursive call: clone child and its children
            clone_task_hierarchy(child.name, target_project, new_task.name, include_dependencies, True)
    return new_task.name


@frappe.whitelist()
def link_boq_tasks_to_project(boq_name, project_name):
    if not boq_name or not project_name:
        return False

    frappe.db.sql("""
        UPDATE `tabTask`
        SET `project` = %s
        WHERE `custom_boq_name` = %s
    """, (project_name, boq_name))
    frappe.db.commit()
    return True

@frappe.whitelist()
def delete_task_with_dependencies(task_name):
    dependencies = frappe.get_all("Task Depends On", filters={"task": task_name}, pluck="name")
    for dep in dependencies:
        frappe.delete_doc("Task Depends On", dep, ignore_permissions=True, force=1)   
    frappe.delete_doc("Task", task_name, ignore_permissions=True, force=1)
    return True