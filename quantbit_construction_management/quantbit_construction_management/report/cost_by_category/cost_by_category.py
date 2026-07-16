# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import today


def execute(filters: dict | None = None):
	"""Return columns and data for the report."""
	filters = filters or {}
	columns = get_columns(filters)
	data = get_data(filters)
	return columns, data


def get_columns(filters):
	category = filters.get("cost_category")

	base = [
		{"label": _("Category"),  "fieldname": "category",      "fieldtype": "Data",     "width": 140},
		{"label": _("Project"),   "fieldname": "project",       "fieldtype": "Link",     "options": "Project", "width": 200},
		{"label": _("Total Cost"),"fieldname": "total_amount",  "fieldtype": "Currency", "width": 180},
	]

	if category == "Labour":
		base[2]["label"] = _("Total Labour Cost")
	elif category == "Material":
		base[2]["label"] = _("Total Material Cost")
	elif category == "Equipment":
		base[2]["label"] = _("Total Equipment Cost")

	return base


def get_data(filters):
	project   = filters.get("project")
	from_date = filters.get("from_date")
	to_date   = filters.get("to_date")
	category  = filters.get("cost_category")

	# Resolve date range
	if from_date and not to_date:
		to_date = today()

	categories_to_run = []
	if category:
		categories_to_run = [category]
	else:
		categories_to_run = ["Labour", "Material", "Equipment"]

	data = []
	for cat in categories_to_run:
		if cat == "Labour":
			rows = get_labour_cost(project, from_date, to_date)
		elif cat == "Material":
			rows = get_material_cost(project, from_date, to_date)
		elif cat == "Equipment":
			rows = get_equipment_cost(project, from_date, to_date)
		else:
			rows = []
		data.extend(rows)

	return data


def _build_project_conditions(project, from_date, to_date, date_field):
	"""Build WHERE conditions and params for project + date filters."""
	conditions = []
	params = {}

	if project:
		conditions.append(f"parent.project = %(project)s")
		params["project"] = project

	if from_date and to_date:
		conditions.append(f"parent.{date_field} BETWEEN %(from_date)s AND %(to_date)s")
		params["from_date"] = from_date
		params["to_date"]   = to_date

	return conditions, params


def get_labour_cost(project, from_date, to_date):
	conditions = ["mu.docstatus != 2"]
	params = {}

	if project:
		conditions.append("mu.project = %(project)s")
		params["project"] = project

	if from_date and to_date:
		conditions.append("mu.site_date BETWEEN %(from_date)s AND %(to_date)s")
		params["from_date"] = from_date
		params["to_date"]   = to_date

	where_clause = " AND ".join(conditions)

	result = frappe.db.sql(
		f"""
		SELECT
			mu.project          AS project,
			SUM(mud.amount)     AS total_amount
		FROM
			`tabManpower Usage` mu
		INNER JOIN
			`tabManpower Usage Details` mud ON mud.parent = mu.name
		WHERE
			{where_clause}
		GROUP BY
			mu.project
		""",
		params,
		as_dict=True,
	)

	return [
		{"category": "Labour", "project": r.project, "total_amount": r.total_amount or 0}
		for r in result
	]


def get_material_cost(project, from_date, to_date):
	conditions = ["se.docstatus != 2", "se.stock_entry_type = 'Material Issue'"]
	params = {}

	if project:
		conditions.append("se.project = %(project)s")
		params["project"] = project

	if from_date and to_date:
		conditions.append("se.posting_date BETWEEN %(from_date)s AND %(to_date)s")
		params["from_date"] = from_date
		params["to_date"]   = to_date

	where_clause = " AND ".join(conditions)

	result = frappe.db.sql(
		f"""
		SELECT
			se.project                      AS project,
			SUM(se.total_outgoing_value)    AS total_amount
		FROM
			`tabStock Entry` se
		WHERE
			{where_clause}
		GROUP BY
			se.project
		""",
		params,
		as_dict=True,
	)

	return [
		{"category": "Material", "project": r.project, "total_amount": r.total_amount or 0}
		for r in result
	]


def get_equipment_cost(project, from_date, to_date):
	conditions = ["eu.docstatus != 2"]
	params = {}

	if project:
		conditions.append("eu.project = %(project)s")
		params["project"] = project

	if from_date and to_date:
		conditions.append("eu.site_date BETWEEN %(from_date)s AND %(to_date)s")
		params["from_date"] = from_date
		params["to_date"]   = to_date

	where_clause = " AND ".join(conditions)

	result = frappe.db.sql(
		f"""
		SELECT
			eu.project          AS project,
			SUM(eud.amount)     AS total_amount
		FROM
			`tabEquipment Usage` eu
		INNER JOIN
			`tabEquipment Usage Details` eud ON eud.parent = eu.name
		WHERE
			{where_clause}
		GROUP BY
			eu.project
		""",
		params,
		as_dict=True,
	)

	return [
		{"category": "Equipment", "project": r.project, "total_amount": r.total_amount or 0}
		for r in result
	]
