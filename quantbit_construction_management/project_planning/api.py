# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

"""Project Planning API.

Provides data + Critical Path Method (CPM) computation for the interactive
Gantt chart rendered on the Project form. Builds on top of the existing
Task Hierarchy Report (`site_diary/report/task_hierarchy_report`).
"""

from collections import defaultdict, deque

import frappe
from frappe import _
from frappe.utils import (
	add_to_date,
	cint,
	date_diff,
	flt,
	get_datetime,
	getdate,
	now_datetime,
)

from quantbit_construction_management.site_diary.report.task_hierarchy_report.task_hierarchy_report import (
	get_tasks,
)

# Ordered status palette shared with the frontend.
STATUS_COLORS = {
	"Not Started": "#94a3b8",
	"Open": "#94a3b8",
	"In Progress": "#3b82f6",
	"Working": "#3b82f6",
	"Overdue": "#f97316",
	"Delayed": "#f97316",
	"Completed": "#22c55e",
	"Cancelled": "#ef4444",
	"Template": "#a855f7",
	"Critical Path": "#dc2626",
}


@frappe.whitelist()
def get_planning_projects(search=None):
	"""Return a lightweight list of projects for the planning selector."""
	filters = {}
	if search:
		filters["project_name"] = ["like", f"%{search}%"]
	rows = frappe.get_all(
		"Project",
		filters=filters,
		fields=[
			"name",
			"project_name",
			"status",
			"expected_start_date",
			"expected_end_date",
			"percent_complete",
		],
		order_by="modified desc",
		limit_page_length=100,
	)
	return [
		{
			"name": r.name,
			"label": r.project_name or r.name,
			"status": r.status,
			"expected_start_date": r.expected_start_date,
			"expected_end_date": r.expected_end_date,
			"percent_complete": flt(r.percent_complete or 0),
		}
		for r in rows
	]


@frappe.whitelist()
def get_project_planning_data(project, from_date=None, to_date=None, contractor=None):
	"""Return the full planning payload for a project.

	Payload shape::

		{
			"project": {...},
			"tasks": [ {task fields + cpm fields + hierarchy}, ... ],
			"dependencies": [ {"from": task, "to": task}, ... ],
			"status_colors": {...}
		}
	"""
	if not project:
		frappe.throw(_("Project is required"))

	project_doc = frappe.db.get_value(
		"Project",
		project,
		[
			"name",
			"project_name",
			"expected_start_date",
			"expected_end_date",
			"percent_complete",
			"status",
		],
		as_dict=True,
	)
	if not project_doc:
		frappe.throw(_("Project {0} not found").format(project))

	filters = frappe._dict(
		{"project": project, "from_date": from_date, "to_date": to_date, "contractor": contractor}
	)
	tasks = get_tasks(project, from_date, to_date, contractor)

	if not tasks:
		return {
			"project": project_doc,
			"tasks": [],
			"dependencies": [],
			"status_colors": STATUS_COLORS,
		}

	task_names = [t.name for t in tasks]
	dependencies = _get_dependencies(task_names)

	# Build the enriched row map (hierarchy order preserved by lft asc).
	rows = _build_rows(tasks, project_doc)

	# Run CPM (forward + backward pass) on leaf-level scheduling.
	_compute_cpm(rows, dependencies)

	return {
		"project": project_doc,
		"tasks": rows,
		"dependencies": [{"from": s, "to": t} for t, preds in dependencies.items() for s in preds],
		"status_colors": STATUS_COLORS,
	}


def _get_dependencies(task_names):
	"""Return mapping {task: [predecessor_task, ...]} from `Task Depends On`."""
	deps = defaultdict(list)
	if not task_names:
		return deps

	rows = frappe.get_all(
		"Task Depends On",
		filters={"parent": ["in", task_names], "parenttype": "Task"},
		fields=["parent as task", "task as depends_on"],
	)
	valid = set(task_names)
	for r in rows:
		if r.depends_on in valid and r.depends_on not in deps[r.task]:
			deps[r.task].append(r.depends_on)
	return deps


def _build_rows(tasks, project_doc):
	"""Convert raw tasks into hierarchical planning rows."""
	task_map = {t.name: t for t in tasks}
	by_parent = defaultdict(list)
	for t in tasks:
		by_parent[t.parent_task or None].append(t)

	proj_start = get_datetime(project_doc.expected_start_date) if project_doc.expected_start_date else None
	proj_end = get_datetime(project_doc.expected_end_date) if project_doc.expected_end_date else None

	rows = []

	def walk(name, indent):
		t = task_map.get(name)
		if not t:
			return

		children = sorted(by_parent.get(name, []), key=lambda x: x.lft or 0)
		is_group = 1 if children else cint(t.is_group)

		start = get_datetime(t.exp_start_date) if t.exp_start_date else proj_start
		end = get_datetime(t.exp_end_date) if t.exp_end_date else proj_end

		# Guarantee a valid, non-inverted window.
		if start and end and end < start:
			end = start
		duration = (date_diff(end, start) + 1) if (start and end) else 1

		row = {
			"task_id": t.name,
			"subject": t.subject or t.name,
			"parent_task": t.parent_task or None,
			"indent": indent,
			"is_group": is_group,
			"is_milestone": 1 if (start and end and date_diff(end, start) == 0 and not children) else 0,
			"status": t.status or "Open",
			"progress": flt(t.progress or 0),
			"exp_start_date": start.isoformat() if start else None,
			"exp_end_date": end.isoformat() if end else None,
			"act_start_date": get_datetime(t.act_start_date).isoformat() if t.act_start_date else None,
			"act_end_date": get_datetime(t.act_end_date).isoformat() if t.act_end_date else None,
			"duration": duration,
			"contractor": t.custom_contractor,
			"total_quantity": flt(t.custom_total_quantity or 0),
			"total_achieved": flt(t.custom_total_achieved or 0),
			"uom": t.custom_uom,
			# CPM fields (filled later).
			"es": None,
			"ef": None,
			"ls": None,
			"lf": None,
			"slack": None,
			"is_critical": 0,
		}
		row["display_status"] = _display_status(row, proj_end)
		rows.append(row)

		for child in children:
			walk(child.name, indent + 1)

	for root in sorted(by_parent.get(None, []), key=lambda x: x.lft or 0):
		walk(root.name, 0)

	return rows


def _display_status(row, proj_end):
	"""Derive a normalized status used for colour coding."""
	status = row["status"]
	if status in ("Completed", "Cancelled"):
		return "Completed" if status == "Completed" else "Cancelled"

	today = now_datetime()
	end = get_datetime(row["exp_end_date"]) if row["exp_end_date"] else None
	if end and end < today and flt(row["progress"]) < 100:
		return "Delayed"
	if flt(row["progress"]) > 0:
		return "In Progress"
	return "Not Started"


def _compute_cpm(rows, dependencies):
	"""Forward + backward pass CPM on day offsets from the earliest task start.

	Only leaf tasks (non groups) participate; groups inherit critical status
	if any descendant is critical.
	"""
	leaves = [r for r in rows if not r["is_group"] and r["exp_start_date"]]
	if not leaves:
		return

	by_id = {r["task_id"]: r for r in rows}
	leaf_ids = {r["task_id"] for r in leaves}
	origin = min(get_datetime(r["exp_start_date"]) for r in leaves)

	# Successor map among leaf tasks only (skip group tasks / non-scheduled
	# leaves and de-duplicate edges so Kahn's in-degree stays consistent).
	successors = defaultdict(list)
	predecessors = defaultdict(list)
	for task, preds in dependencies.items():
		if task not in leaf_ids:
			continue
		for p in preds:
			if p in leaf_ids and p not in predecessors[task]:
				successors[p].append(task)
				predecessors[task].append(p)

	# Baseline ES/EF from stored dates (day offsets).
	for r in leaves:
		start = get_datetime(r["exp_start_date"])
		r["_dur"] = max(cint(r["duration"]), 1)
		r["es"] = date_diff(start, origin)
		r["ef"] = r["es"] + r["_dur"]

	# Topological order via Kahn's algorithm (ignores cycles gracefully).
	indeg = {r["task_id"]: len(predecessors.get(r["task_id"], [])) for r in leaves}
	queue = deque([n for n, d in indeg.items() if d == 0])
	topo = []
	while queue:
		n = queue.popleft()
		topo.append(n)
		for s in successors.get(n, []):
			indeg[s] -= 1
			if indeg[s] == 0:
				queue.append(s)
	# Include any nodes stuck in cycles so they still get late values.
	for r in leaves:
		if r["task_id"] not in topo:
			topo.append(r["task_id"])

	# Forward pass.
	for n in topo:
		r = by_id[n]
		preds = predecessors.get(n, [])
		if preds:
			r["es"] = max(r["es"], max(by_id[p]["ef"] for p in preds if p in by_id))
			r["ef"] = r["es"] + r["_dur"]

	project_ef = max(r["ef"] for r in leaves)

	# Backward pass.
	for r in leaves:
		r["lf"] = project_ef
	for n in reversed(topo):
		r = by_id[n]
		succs = successors.get(n, [])
		if succs:
			r["lf"] = min(by_id[s]["ls"] for s in succs if s in by_id)
		else:
			r["lf"] = project_ef
		r["ls"] = r["lf"] - r["_dur"]

	# Slack + critical flag.
	critical_leaves = set()
	for r in leaves:
		r["slack"] = r["ls"] - r["es"]
		r["is_critical"] = 1 if r["slack"] <= 0 else 0
		if r["is_critical"]:
			critical_leaves.add(r["task_id"])
		r.pop("_dur", None)

	# Propagate critical flag up to ancestor groups.
	for r in rows:
		if r["is_group"]:
			r["is_critical"] = 0
	for r in rows:
		if r["task_id"] in critical_leaves:
			parent = r["parent_task"]
			while parent and parent in by_id:
				by_id[parent]["is_critical"] = 1
				parent = by_id[parent]["parent_task"]


@frappe.whitelist()
def update_task_schedule(task, exp_start_date, exp_end_date, cascade=1):
	"""Persist new start/end dates for a task (drag / resize) and cascade.

	Returns the recomputed planning payload so the frontend can redraw.
	"""
	if not task:
		frappe.throw(_("Task is required"))

	doc = frappe.get_doc("Task", task)
	doc.exp_start_date = getdate(get_datetime(exp_start_date))
	doc.exp_end_date = getdate(get_datetime(exp_end_date))
	doc.save(ignore_permissions=True)

	project = doc.project
	if cint(cascade) and project:
		_cascade_dependents(project)

	frappe.db.commit()
	return get_project_planning_data(project)


def _cascade_dependents(project):
	"""Shift successors so they never start before a predecessor finishes."""
	tasks = frappe.get_all(
		"Task",
		filters={"project": project},
		fields=["name", "exp_start_date", "exp_end_date", "is_group"],
	)
	if not tasks:
		return

	by_id = {t.name: t for t in tasks}
	dep_rows = frappe.get_all(
		"Task Depends On",
		filters={"parent": ["in", list(by_id.keys())]},
		fields=["parent as task", "task as depends_on"],
	)
	successors = defaultdict(list)
	predecessors = defaultdict(list)
	for r in dep_rows:
		if r.depends_on in by_id and r.task in by_id:
			successors[r.depends_on].append(r.task)
			predecessors[r.task].append(r.depends_on)

	indeg = {t.name: len(predecessors.get(t.name, [])) for t in tasks}
	queue = deque([n for n, d in indeg.items() if d == 0])
	order = []
	while queue:
		n = queue.popleft()
		order.append(n)
		for s in successors.get(n, []):
			indeg[s] -= 1
			if indeg[s] == 0:
				queue.append(s)

	for n in order:
		preds = predecessors.get(n, [])
		if not preds:
			continue
		t = by_id[n]
		if not t.exp_start_date:
			continue
		latest_pred_end = None
		for p in preds:
			pe = by_id[p].exp_end_date
			if pe and (latest_pred_end is None or getdate(pe) > getdate(latest_pred_end)):
				latest_pred_end = pe
		if not latest_pred_end:
			continue
		required_start = add_to_date(getdate(latest_pred_end), days=1)
		if getdate(t.exp_start_date) < getdate(required_start):
			dur = 0
			if t.exp_end_date:
				dur = date_diff(t.exp_end_date, t.exp_start_date)
			new_start = getdate(required_start)
			new_end = add_to_date(new_start, days=max(dur, 0))
			frappe.db.set_value(
				"Task",
				n,
				{"exp_start_date": new_start, "exp_end_date": new_end},
				update_modified=False,
			)
			t.exp_start_date = new_start
			t.exp_end_date = new_end


@frappe.whitelist()
def update_task_dependency(task, depends_on, action="add"):
	"""Add or remove a dependency (`depends_on` is a predecessor of `task`)."""
	if not task or not depends_on:
		frappe.throw(_("Both task and dependency are required"))
	if task == depends_on:
		frappe.throw(_("A task cannot depend on itself"))

	doc = frappe.get_doc("Task", task)

	if action == "add":
		if _creates_cycle(doc.project, task, depends_on):
			frappe.throw(_("This dependency would create a circular reference"))
		exists = any(d.task == depends_on for d in doc.depends_on)
		if not exists:
			doc.append("depends_on", {"task": depends_on})
			doc.save(ignore_permissions=True)
	elif action == "remove":
		doc.depends_on = [d for d in doc.depends_on if d.task != depends_on]
		doc.save(ignore_permissions=True)
	else:
		frappe.throw(_("Invalid action {0}").format(action))

	if doc.project:
		_cascade_dependents(doc.project)

	frappe.db.commit()
	return get_project_planning_data(doc.project)


def _creates_cycle(project, task, new_pred):
	"""Return True if adding new_pred -> task introduces a cycle."""
	dep_rows = frappe.get_all(
		"Task Depends On",
		filters={"parenttype": "Task"},
		fields=["parent as task", "task as depends_on"],
	)
	preds = defaultdict(list)
	for r in dep_rows:
		preds[r.task].append(r.depends_on)
	preds[task].append(new_pred)

	# DFS from new_pred following predecessor edges; if we reach task -> cycle.
	stack = [new_pred]
	seen = set()
	while stack:
		cur = stack.pop()
		if cur == task:
			return True
		if cur in seen:
			continue
		seen.add(cur)
		stack.extend(preds.get(cur, []))
	return False


@frappe.whitelist()
def update_task_progress(task, progress):
	"""Persist progress (%) update from the Gantt bar."""
	if not task:
		frappe.throw(_("Task is required"))
	frappe.db.set_value("Task", task, "progress", flt(progress))
	frappe.db.commit()
	return {"task": task, "progress": flt(progress)}
