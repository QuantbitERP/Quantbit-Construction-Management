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
def clone_task_hierarchy(source_task, target_project, parent_task=None, include_dependencies=False,
                          include_tasks=False, include_children=False,
                          task_weight=None, custom_boq_name=None, custom_floor=None, custom_block=None):
    """
    Clones source_task (and, depending on the flags below, its descendants) under
    parent_task in target_project.

    Relationship being cloned: Stage -> Task -> Child Tasks / Subtasks.
    - include_tasks:    when source_task is a Stage, also clone its direct child
                         Tasks. Has no effect when source_task is not a Stage.
    - include_children: when source_task is NOT a Stage (i.e. once we're already
                         inside a Task that was itself just cloned), recursively
                         clone everything under it (Subtasks, and any deeper
                         Child Task nesting).
    """
    include_dependencies = frappe.parse_json(include_dependencies)
    include_tasks = frappe.parse_json(include_tasks)
    include_children = frappe.parse_json(include_children)
    source_doc = frappe.get_doc("Task", source_task)
    resolved_boq_name = custom_boq_name or source_doc.custom_boq_name

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
    new_task.task_weight = task_weight or source_doc.task_weight
    new_task.custom_boq_name = resolved_boq_name
    # Floor / Block only ever apply to Stage-level tasks; only override when the
    # clone is itself a stage, and only when the caller actually passed a value.
    if new_task.custom_is_stage:
        if custom_floor is not None:
            new_task.custom_floor = custom_floor
        if custom_block is not None:
            new_task.custom_block = custom_block
    if not include_dependencies:
        new_task.depends_on = []
    new_task.insert()

    # Stage -> Task descent is gated by include_tasks; Task -> Subtask (and any
    # deeper Child Task nesting) descent is gated by include_children.
    is_stage = bool(source_doc.custom_is_stage)
    should_descend = (is_stage and include_tasks) or (not is_stage and include_children)

    if should_descend:
        children = frappe.get_all("Task", filters={"parent_task": source_task}, fields=["name", "subject"])
        for child in children:
            # Don't re-clone a child that's already present under this exact new
            # parent (e.g. this action already ran once, or the same template
            # child is reachable more than once in the source hierarchy).
            already_present = frappe.db.exists("Task", {
                "subject": child.subject,
                "parent_task": new_task.name,
                "project": target_project,
                "custom_boq_name": resolved_boq_name,
            })
            if already_present:
                continue
            # Recursive call: clone child and (per the flags above) its own children
            clone_task_hierarchy(
                child.name, target_project, new_task.name,
                include_dependencies=include_dependencies,
                include_tasks=include_tasks,
                include_children=include_children,
                custom_boq_name=resolved_boq_name,
            )
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





