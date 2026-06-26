# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

from email import message
import frappe
import json
from frappe.utils import flt, cstr
from frappe.model.document import Document
from frappe.utils.xlsxutils import build_xlsx_response, read_xlsx_file_from_attached_file


class BillofQuantities(Document):
    def validate(self):
        self.calculate_contract_value()
        # self.validate_contract_value()
        # self.validate_item_values()

    def calculate_contract_value(self):
        total = 0
        for row in self.boq_items:
            total += row.amount or 0
        self.contract_value = total

@frappe.whitelist()
def update_task_bom_details(task_name, bom_details):
    if isinstance(bom_details, str):
        bom_details = json.loads(bom_details)
    
    task = frappe.get_doc("Task", task_name)
    task.set("custom_bom_details", [])
    for row in bom_details:
        task.append("custom_bom_details", {
            "item": row.get("item"),
            "item_name": row.get("item_name"),
            "qty": row.get("qty"),
            "uom": row.get("uom"),
            "rate": row.get("rate"),
            "item_type": row.get("item_type"),
            "total_amount": flt(row.get("qty") or 0) * flt(row.get("rate") or 0)
        })
    task.save(ignore_permissions=True)
    return task.name

def build_task_hierarchy(task_name):
    hierarchy = []

    current = frappe.get_doc("Task", task_name)

    while current:
        hierarchy.insert(0, {
            "name": current.name,
            "subject": current.subject
        })

        if not current.parent_task:
            break

        current = frappe.get_doc("Task", current.parent_task)

    return hierarchy
def get_flat_hierarchy_for_boq(task_name):

    hierarchy = build_task_hierarchy(task_name)

    row_data = {}

    if not hierarchy:
        return row_data

    # Stage
    row_data["task"] = hierarchy[0]["name"]
    row_data["task_subject"] = hierarchy[0]["subject"]

    # Top Task
    if len(hierarchy) > 1:
        top_task = hierarchy[1]

        row_data["subtask"] = top_task["name"]
        row_data["subtask_name"] = top_task["subject"]

        descendants = []

        def collect_children(parent):

            children = frappe.get_all(
                "Task",
                filters={"parent_task": parent},
                fields=["name", "subject"],
                order_by="creation asc"
            )

            for child in children:

                descendants.append(child)

                collect_children(child.name)

        collect_children(top_task["name"])

        level = 1

        for node in descendants:

            if level > 10:
                break

            row_data[f"task_level{level}"] = node["name"]
            row_data[f"level{level}_subject"] = node["subject"]

            level += 1

    return row_data
def fill_hierarchy_fields(task_name):

    hierarchy = build_task_hierarchy(task_name)

    row_data = {}

    if not hierarchy:
        return row_data

    # Stage
    row_data["task"] = hierarchy[0]["name"]
    row_data["task_subject"] = hierarchy[0]["subject"]

    # First task under stage
    if len(hierarchy) > 1:
        row_data["subtask"] = hierarchy[1]["name"]
        row_data["subtask_name"] = hierarchy[1]["subject"]

    # Remaining hierarchy
    level_index = 1

    for node in hierarchy[2:]:

        if level_index > 10:
            break

        row_data[f"task_level{level_index}"] = node["name"]
        row_data[f"level{level_index}_subject"] = node["subject"]

        level_index += 1

    return row_data

def get_all_descendants(task_name):

    descendants = []

    children = frappe.get_all(
        "Task",
        filters={"parent_task": task_name},
        fields=["name"]
    )

    for child in children:

        descendants.append(child.name)

        descendants.extend(
            get_all_descendants(child.name)
        )

    return descendants

@frappe.whitelist()
def get_boq_items_from_task(task_name):

    boq_items = []

    child_task_names = get_all_descendants(task_name)

    child_tasks = [
        frappe.get_doc("Task", name)
        for name in child_task_names
    ]

    frappe.logger().debug(
        f"get_boq_items_from_task: task={task_name}, child_tasks={[t.name for t in child_tasks]}"
    )

    for task in child_tasks:

        task_doc = task
        bom_rows = task_doc.get("custom_bom_details") or []
        if not bom_rows:
            continue
        children = frappe.get_all(
            "Task",
            filters={"parent_task": task_doc.name},
            fields=["name"]
        )

        if children:
            continue

        frappe.logger().debug(
            f"subtask={task.name}, bom_rows={len(bom_rows)}"
        )
        row_data = fill_hierarchy_fields(task_doc.name)

        # Create BOQ rows
        for row in bom_rows:

            boq_row = dict(row_data)

            boq_row.update({
                "item_code": row.item,
                "item_no": row.item_name,
                "item_type": row.item_type,

                "quantity": row.qty,
                "unit": row.uom,
                "unit_rate": row.rate,
                "amount": row.total_amount,

                "internal_qty": row.qty,
                "internal_rate": row.rate,
                "internal_amount": row.total_amount,

                "actual_qty": row.qty,
                "actual_rate": row.rate,
                "actual_amount": row.total_amount
            })

            boq_items.append(boq_row)

    return boq_items

@frappe.whitelist()
def get_boq_items_from_subtask(subtask_name):

    boq_items = []

    task_doc = frappe.get_doc("Task", subtask_name)
    row_data = fill_hierarchy_fields(task_doc.name)

    bom_rows = task_doc.get("custom_bom_details") or []

    for row in bom_rows:

        boq_row = dict(row_data)

        boq_row.update({
            "item_code": row.item,
            "item_no": row.item_name,
            "item_type": row.item_type,

            "quantity": row.qty,
            "unit": row.uom,
            "unit_rate": row.rate,
            "amount": row.total_amount,

            "internal_qty": row.qty,
            "internal_rate": row.rate,
            "internal_amount": row.total_amount,

            "actual_qty": row.qty,
            "actual_rate": row.rate,
            "actual_amount": row.total_amount
        })

        boq_items.append(boq_row)

    return boq_items

@frappe.whitelist()
def download_boq_task_template():
    columns = ["Stage", "Task","Task Level1", "Task Level1", "Task Level2", "Task Level3","Task Level4", "Task Level5", "Task Level6" , "Task Level7","Task Level8" ,"Task Level9", "Task Level10", "Task Weight"]
    data = [columns]
    build_xlsx_response(data, "BOQ_Task_Template")


@frappe.whitelist()
def import_boq_tasks(file_url, boq_name):

    rows = read_xlsx_file_from_attached_file(file_url=file_url)

    if not rows or len(rows) < 2:
        frappe.throw("The uploaded file is empty or missing data.")

    headers = rows[0]
    data_rows = rows[1:]

    def get_val(row, header_name):
        try:
            idx = headers.index(header_name)
            return row[idx]
        except (ValueError, IndexError):
            return None

    task_columns = [
        "Task",
        "Task Level1",
        "Task Level2",
        "Task Level3",
        "Task Level4",
        "Task Level5",
        "Task Level6",
        "Task Level7",
        "Task Level8",
        "Task Level9",
        "Task Level10"
    ]

    created_tasks = {}

    for row in data_rows:

        stage = cstr(get_val(row, "Stage") or "").strip()

        if not stage:
            continue

        task_weight = flt(get_val(row, "Task Weight") or 0)

        stage_key = f"STAGE::{stage}"

        # Create Stage
        if stage_key not in created_tasks:

            stage_doc = frappe.get_doc({
                "doctype": "Task",
                "subject": stage,
                "custom_boq_name": boq_name,
                "custom_is_stage": 1,
                "is_group": 1,
                "status": "Open",
                "priority": "Medium"
            })

            stage_doc.insert(ignore_permissions=True)

            created_tasks[stage_key] = stage_doc.name

        parent_task = created_tasks[stage_key]

        # Get all populated task levels
        levels = []

        for col in task_columns:
            value = cstr(get_val(row, col) or "").strip()

            if value:
                levels.append(value)

        if not levels:
            continue

        current_path = stage

        for idx, level_name in enumerate(levels):

            current_path += f"::{level_name}"

            is_last = idx == len(levels) - 1

            if current_path in created_tasks:
                parent_task = created_tasks[current_path]
                continue

            task_doc = frappe.get_doc({
                "doctype": "Task",
                "subject": level_name,
                "parent_task": parent_task,
                "custom_boq_name": boq_name,
                "status": "Open",
                "priority": "Medium",
                "task_weight": task_weight if is_last else 0,
                "is_group": 0 if is_last else 1,
                "custom_is_task": 1 if not is_last else 0,
                "custom_is_subtask": 1 if is_last else 0
            })

            task_doc.insert(ignore_permissions=True)

            created_tasks[current_path] = task_doc.name
            parent_task = task_doc.name

    return "Success"

def get_all_dependencies(task_name, visited=None):
    """
    Recursively gets all dependency task names (depends_on) for a given task.
    """
    if visited is None:
        visited = set()
    if task_name in visited:
        return []
    visited.add(task_name)

    direct_deps = frappe.get_all(
        "Task Depends On",
        filters={"parent": task_name},
        pluck="task"
    )

    deps = []
    for d in direct_deps:
        if d:
            deps.append(d)
            deps.extend(get_all_dependencies(d, visited))
    return deps

def get_all_children(task_name, visited=None):
    """
    Recursively gets all child task names (parent_task) for a given task.
    """
    if visited is None:
        visited = set()
    if task_name in visited:
        return []
    visited.add(task_name)

    direct_children = frappe.get_all(
        "Task",
        filters={"parent_task": task_name},
        pluck="name"
    )

    children = []
    for child in direct_children:
        if child:
            children.append(child)
            children.extend(get_all_children(child, visited))
    return children

def clone_task_hierarchy(stage_name, boq_name, include_tasks=False, include_children=False):
    """
    Clones a stage and its tasks/subtasks/dependencies recursively into a BOQ.
    1. Collects templates into a dynamic dictionary hierarchy:
       hierarchy_dict = { stage: { task: [ subtask, ... ] } }
    2. Logs hierarchy_dict to Frappe Error Log.
    3. Creates new documents in order: Stage -> Task -> Subtask.
    4. Recreates parent_task and depends_on links.
    """
    hierarchy_dict = {}
    visited = set()

    def process_task(t_name, current_stage=None, current_task=None):
        if not t_name or t_name in visited:
            return
        visited.add(t_name)

        t_data = frappe.get_value(
            "Task",
            t_name,
            ["name", "custom_is_stage", "custom_is_task", "custom_is_subtask", "parent_task"],
            as_dict=True
        )
        if not t_data:
            return

        # Categorize and update context dynamically
        if t_data.custom_is_stage:
            current_stage = t_name
            if current_stage not in hierarchy_dict:
                hierarchy_dict[current_stage] = {}
        elif t_data.custom_is_subtask:
            if not current_task:
                current_task = t_data.parent_task
            if not current_stage:
                if current_task:
                    current_stage = frappe.get_value("Task", current_task, "parent_task") or stage_name
                else:
                    current_stage = stage_name
            if current_stage not in hierarchy_dict:
                hierarchy_dict[current_stage] = {}
            if current_task:
                if current_task not in hierarchy_dict[current_stage]:
                    hierarchy_dict[current_stage][current_task] = []
                if t_name not in hierarchy_dict[current_stage][current_task]:
                    hierarchy_dict[current_stage][current_task].append(t_name)
            else:
                current_task = t_name
                if current_task not in hierarchy_dict[current_stage]:
                    hierarchy_dict[current_stage][current_task] = []
        else:
            # Custom is task or fallback
            if not current_stage:
                current_stage = t_data.parent_task or stage_name
            if current_stage not in hierarchy_dict:
                hierarchy_dict[current_stage] = {}
            current_task = t_name
            if current_task not in hierarchy_dict[current_stage]:
                hierarchy_dict[current_stage][current_task] = []

        # Recursively get all dependencies
        deps = frappe.get_all(
            "Task Depends On",
            filters={"parent": t_name},
            pluck="task"
        )
        frappe.log_error(message=str(frappe.as_json(deps)), title="Tasks")
        for dep_name in deps:
            process_task(dep_name, current_stage=current_stage, current_task=current_task)

        # Recursively get child tasks/subtasks depending on hierarchy flags
        is_stage = bool(t_data.custom_is_stage)
        is_task = bool(t_data.custom_is_task) or (not is_stage and not t_data.custom_is_subtask)

        should_get_children = False
        if is_stage and include_tasks:
            should_get_children = True
        elif is_task and include_children:
            should_get_children = True

        if should_get_children:
            children = frappe.get_all(
                "Task",
                filters={"parent_task": t_name},
                pluck="name"
            )
            for child_name in children:
                process_task(child_name, current_stage=current_stage, current_task=current_task)

    # Start traversal with the stage itself
    process_task(stage_name)

    # Get direct tasks under the selected stage if include_tasks is checked
    if include_tasks:
        direct_tasks = frappe.get_all(
            "Task",
            filters={"parent_task": stage_name},
            pluck="name"
        )
        for t_name in direct_tasks:
            process_task(t_name)

    # Log hierarchy_dict as requested
    frappe.log_error(
        message=json.dumps(hierarchy_dict, indent=4),
        title="BOQ Clone Hierarchy Dict"
    )

    # Map to store { old_task_name: new_task_name }
    cloned_map = {}

    # Helper function to clone/insert a task doc
    def insert_task(t_name):
        old_task = frappe.get_doc("Task", t_name)
        status = old_task.status
        if status == "Template":
            status = "Open"

        new_task = frappe.get_doc({
            "doctype": "Task",
            "subject": old_task.subject,
            "custom_is_stage": old_task.custom_is_stage,
            "custom_is_task": old_task.custom_is_task,
            "custom_is_subtask": old_task.custom_is_subtask,
            "is_group": old_task.is_group,
            "custom_boq_name": boq_name,
            "parent_task": None,
            "task_weight": 0,
            "description": old_task.description,
            "status": status,
            "priority": old_task.priority,
            "is_template": 0
        })
        frappe.log_error(message=str(frappe.as_json(new_task)), title="Test")

        new_task.insert(ignore_permissions=True)
        cloned_map[t_name] = new_task.name

        # Copy BOM details
        if old_task.get("custom_bom_details"):
            for row in old_task.custom_bom_details:
                new_task.append("custom_bom_details", {
                    "item": row.item,
                    "item_name": row.item_name,
                    "qty": row.qty,
                    "uom": row.uom,
                    "rate": row.rate,
                    "item_type": row.item_type,
                    "total_amount": row.total_amount
                })
            new_task.save(ignore_permissions=True)

    # 1. Create Stage first
    for s_name in hierarchy_dict.keys():
        insert_task(s_name)

    # 2. Create Task second
    for s_name, tasks_dict in hierarchy_dict.items():
        for t_name in tasks_dict.keys():
            insert_task(t_name)

    # 3. Create Subtask third
    for s_name, tasks_dict in hierarchy_dict.items():
        for t_name, subtasks_list in tasks_dict.items():
            for st_name in subtasks_list:
                insert_task(st_name)

    # 4. Recreate parent_task and depends_on relationships
    for old_name, new_name in cloned_map.items():
        old_task = frappe.get_doc("Task", old_name)
        new_task = frappe.get_doc("Task", new_name)
        updated = False

        # parent_task
        if old_task.parent_task:
            new_parent = cloned_map.get(old_task.parent_task) or cloned_map.get(stage_name)
            if new_parent and new_task.parent_task != new_parent:
                new_task.parent_task = new_parent
                updated = True
        elif old_name != stage_name:
            new_parent = cloned_map.get(stage_name)
            if new_parent and new_task.parent_task != new_parent:
                new_task.parent_task = new_parent
                updated = True

        # depends_on
        if old_task.depends_on:
            existing_deps = {d.task for d in new_task.depends_on if d.task}
            added_deps = set()
            for dep in old_task.depends_on:
                if dep.task in cloned_map:
                    target_task = cloned_map[dep.task]
                    if target_task not in existing_deps and target_task not in added_deps:
                        new_task.append("depends_on", {
                            "task": target_task
                        })
                        added_deps.add(target_task)
                        updated = True
        if updated:
            new_task.save(ignore_permissions=True)

    # Return list of all created task names in this hierarchy
    return list(cloned_map.values())

@frappe.whitelist()
def create_stage_task(boq_name=None, selected_stages=None, values=None, include_tasks=0, include_children=0):
        if isinstance(selected_stages, str):
            if selected_stages.startswith("[") or selected_stages.startswith("{"):
                try:
                    selected_stages = json.loads(selected_stages)
                except Exception:
                    selected_stages = [s.strip() for s in selected_stages.split(",") if s.strip()]
            else:
                selected_stages = [s.strip() for s in selected_stages.split(",") if s.strip()]

        if isinstance(include_tasks, str):
            include_tasks = frappe.parse_json(include_tasks)
        if isinstance(include_children, str):
            include_children = frappe.parse_json(include_children)

        created = []
        for stage_name in selected_stages:
            new_tasks = clone_task_hierarchy(
                stage_name=stage_name,
                boq_name=boq_name,
                include_tasks=bool(include_tasks),
                include_children=bool(include_children)
            )
            if new_tasks:
                created.extend(new_tasks)
        return created

@frappe.whitelist()
def create_task(  boq_name=None,
    selected_tasks=None,
    parent_stage=None,
    include_children=0):
        if isinstance(selected_tasks, str):
            selected_tasks = json.loads(selected_tasks)

        if isinstance(include_children, str):
            include_children = frappe.parse_json(include_children)
        created = []

        for task_name in selected_tasks:

            old_doc = frappe.get_doc("Task", task_name)

            new_doc = frappe.get_doc({
                "doctype": "Task",
                "subject": old_doc.subject,
                "custom_is_task": 1,
                "is_group":1,
                "custom_boq_name":boq_name,
                "parent_task":parent_stage,
                "task_weight": old_doc.task_weight,
                "description": old_doc.description
            })

            new_doc.insert(ignore_permissions=True)

            created.append(new_doc.name)

            if include_children:
                subtasks = frappe.get_all("Task", filters={"parent_task": old_doc.name, "custom_is_subtask": 1})
                for st in subtasks:
                    old_subtask = frappe.get_doc("Task", st.name)
                    new_subtask = frappe.get_doc({
                        "doctype": "Task",
                        "subject": old_subtask.subject,
                        "custom_is_subtask": 1,
                        "custom_boq_name": boq_name,
                        "parent_task": new_doc.name,
                        "task_weight": old_subtask.task_weight,
                        "description": old_subtask.description
                    })
                    new_subtask.insert(ignore_permissions=True)
                    
                    if old_subtask.get("custom_bom_details"):
                        for row in old_subtask.custom_bom_details:
                            new_subtask.append("custom_bom_details", {
                                "item": row.item,
                                "item_name": row.item_name,
                                "qty": row.qty,
                                "uom": row.uom,
                                "rate": row.rate,
                                "item_type": row.item_type,
                                "total_amount": row.total_amount
                            })
                        new_subtask.save(ignore_permissions=True)

        return created

@frappe.whitelist()
def create_subtask(boq_name=None, selected_stages=None, values=None,task=None):
        if isinstance(selected_stages, str):
            selected_stages = json.loads(selected_stages)

        created = []

        for stage_name in selected_stages:

            old_doc = frappe.get_doc("Task", stage_name)

            new_doc = frappe.get_doc({
                "doctype": "Task",
                "subject": old_doc.subject,
                "custom_is_subtask": 1,
                "custom_boq_name":boq_name,
                "parent_task":task
            })

            new_doc.insert(ignore_permissions=True)

            created.append(new_doc.name)

        return created

@frappe.whitelist()
def delete_boq_tasks(boq_name):

    tasks = frappe.get_all(
        "Task",
        filters={
            "custom_boq_name": boq_name
        },
        pluck="name"
    )

    for task in tasks:
        frappe.delete_doc("Task", task, force=1)

    frappe.db.commit()

    return True

@frappe.whitelist()
def delete_task_with_dependencies(task_name):
    dependencies = frappe.get_all("Task Depends On", filters={"task": task_name}, pluck="name")
    for dep in dependencies:
        frappe.delete_doc("Task Depends On", dep, ignore_permissions=True, force=1)
    
    frappe.delete_doc("Task", task_name, ignore_permissions=True, force=1)
    
    return True

@frappe.whitelist()
def create_project_from_boq(boq_name, project_name,site_name):
    # 1. Validation: At least one Stage, Task, Subtask, or Child Task is mandatory.
    tasks = frappe.get_all(
        "Task",
        filters={"custom_boq_name": boq_name},
        limit=1
    )
    if not tasks:
        frappe.throw("At least one Stage, Task, Subtask, or Child Task is mandatory to create a project.")

    contract_value = frappe.db.get_value("Bill of Quantities", boq_name, "contract_value") or 0.0

    # 2. Create the Project
    project = frappe.get_doc({
        "doctype": "Project",
        "project_name": project_name,
        "status": "Open",
        "custom_bill_of_quantities": boq_name,
        "custom_site": site_name,
        "custom_contractalu_v": contract_value
    })
    project.insert(ignore_permissions=True)
    
    # 3. Link all tasks of this BOQ to the new project
    frappe.db.sql("""
        UPDATE `tabTask`
        SET `project` = %s
        WHERE `custom_boq_name` = %s
    """, (project.name, boq_name))
    
    # 4. Pass the created project to BOQ
    frappe.db.set_value("Bill of Quantities", boq_name, "project", project.name)
    
    frappe.db.commit()
    return project.name


@frappe.whitelist()
def duplicate_boq(boq_name):
    """
    Duplicates the given BOQ document as a new Draft and recreates all linked
    Tasks fresh (new names, same hierarchy, weight = 0) for the new BOQ.
    Returns the new BOQ name.
    """
    # 1. Copy the BOQ doc
    source_boq = frappe.get_doc("Bill of Quantities", boq_name)
    new_boq = frappe.copy_doc(source_boq)
    new_boq.docstatus = 0          # keep as Draft
    new_boq.project = None         # clear any project link
    new_boq.insert(ignore_permissions=True)
    new_boq_name = new_boq.name

    # 2. Fetch ALL tasks linked to the source BOQ ordered by creation
    #    so parents are always created before their children.
    all_tasks = frappe.get_all(
        "Task",
        filters={"custom_boq_name": boq_name},
        fields=[
            "name", "subject", "parent_task",
            "custom_is_stage", "custom_is_task", "custom_is_subtask",
            "is_group", "task_weight", "description",
            "status", "priority"
        ],
        order_by="creation asc",
        limit=5000
    )

    # 3. Map: old_task_name -> new_task_name
    task_map = {}

    for t in all_tasks:
        status = t.status
        if status == "Template":
            status = "Open"

        new_task = frappe.get_doc({
            "doctype": "Task",
            "subject": t.subject,
            "custom_is_stage": t.custom_is_stage,
            "custom_is_task": t.custom_is_task,
            "custom_is_subtask": t.custom_is_subtask,
            "is_group": t.is_group,
            "custom_boq_name": new_boq_name,
            "parent_task": None,           # will be set in pass-2
            "task_weight": t.task_weight,  # keep weight on duplicate
            "description": t.description,
            "status": status,
            "priority": t.priority or "Medium",
            "is_template": 0
        })
        new_task.insert(ignore_permissions=True)

        # Copy BOM details
        old_task_doc = frappe.get_doc("Task", t.name)
        if old_task_doc.get("custom_bom_details"):
            for row in old_task_doc.custom_bom_details:
                new_task.append("custom_bom_details", {
                    "item": row.item,
                    "item_name": row.item_name,
                    "qty": row.qty,
                    "uom": row.uom,
                    "rate": row.rate,
                    "item_type": row.item_type,
                    "total_amount": row.total_amount
                })
            new_task.save(ignore_permissions=True)

        task_map[t.name] = new_task.name

    # 4. Second pass: wire parent_task using the map
    for t in all_tasks:
        if t.parent_task and t.parent_task in task_map:
            new_task_name = task_map[t.name]
            new_parent_name = task_map[t.parent_task]
            frappe.db.set_value("Task", new_task_name, "parent_task", new_parent_name)

    frappe.db.commit()
    return new_boq_name