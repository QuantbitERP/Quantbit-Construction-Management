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
def clone_task_hierarchy(source_task, target_project, parent_task=None, include_dependencies=True,
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
    - include_dependencies (default True): once the whole hierarchy this call
                         produces has been cloned, each cloned task's
                         `depends_on` links are recreated against the *newly
                         cloned* equivalents elsewhere in that same hierarchy —
                         at every depth, not just the top-level node. A
                         dependency pointing outside the hierarchy being cloned
                         (i.e. not among the tasks this call itself created)
                         has no local equivalent to link to, so it's dropped.
    """
    include_dependencies = frappe.parse_json(include_dependencies)
    include_tasks = frappe.parse_json(include_tasks)
    include_children = frappe.parse_json(include_children)

    # old_task_name -> new_task_name, accumulated across the whole recursive
    # clone so depends_on can be remapped once everything exists.
    cloned_map = {}

    def _clone(src_name, parent, top):
        source_doc = frappe.get_doc("Task", src_name)
        resolved_boq_name = custom_boq_name or source_doc.custom_boq_name

        new_task = frappe.copy_doc(source_doc)
        new_task.project = target_project
        new_task.parent_task = parent
        new_task.is_template = 0
        new_task.status = "Open"
        new_task.progress = 0
        new_task.completed_by = None
        new_task.completed_on = None
        new_task.act_start_date = None
        new_task.act_end_date = None
        # task_weight override only ever applies to the directly-requested
        # node; descendants keep their own source weight (matches the
        # pre-existing behavior, where the recursive call never propagated it).
        new_task.task_weight = (task_weight if top else None) or source_doc.task_weight
        new_task.custom_boq_name = resolved_boq_name
        # Floor / Block only ever apply to Stage-level tasks; only override when the
        # clone is itself a stage, and only when the caller actually passed a value.
        if new_task.custom_is_stage:
            if custom_floor is not None:
                new_task.custom_floor = custom_floor
            if custom_block is not None:
                new_task.custom_block = custom_block
        # depends_on is always rebuilt from scratch below (in the remap pass) —
        # copy_doc would otherwise carry over links pointing at the *template*
        # tasks, which is never what we want.
        new_task.depends_on = []
        new_task.insert()
        cloned_map[src_name] = new_task.name

        # Stage -> Task descent is gated by include_tasks; Task -> Subtask (and any
        # deeper Child Task nesting) descent is gated by include_children.
        is_stage = bool(source_doc.custom_is_stage)
        should_descend = (is_stage and include_tasks) or (not is_stage and include_children)

        if should_descend:
            children = frappe.get_all("Task", filters={"parent_task": src_name}, fields=["name", "subject"])
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
                    cloned_map[child.name] = already_present
                    continue
                _clone(child.name, new_task.name, top=False)

        return new_task.name

    root_new_name = _clone(source_task, parent_task, top=True)

    # Second pass: now that every node in this hierarchy has been cloned,
    # recreate depends_on links remapped to the freshly cloned equivalents —
    # across every level ("deepest hierarchy"), not just the top-level stage.
    if include_dependencies:
        for old_name, new_name in cloned_map.items():
            old_doc = frappe.get_doc("Task", old_name)
            if not old_doc.depends_on:
                continue

            new_doc = frappe.get_doc("Task", new_name)
            existing_deps = {d.task for d in new_doc.depends_on if d.task}
            updated = False

            for dep in old_doc.depends_on:
                target = cloned_map.get(dep.task)
                if not target or target in existing_deps:
                    continue
                new_doc.append("depends_on", {"task": target})
                existing_deps.add(target)
                updated = True

            if updated:
                new_doc.save()

    return root_new_name


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
