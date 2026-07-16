# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate


def execute(filters: dict | None = None):
	filters = filters or {}
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns() -> list[dict]:
	return [
		{
			"label": _("Project"),
			"fieldname": "project_name",
			"fieldtype": "Data",
			"width": 200,
		},
		{
			"label": _("Contractor"),
			"fieldname": "contractor",
			"fieldtype": "Link",
			"options": "Contractor",
			"width": 180,
		},
		{
			"label": _("Equipment Item"),
			"fieldname": "equipment_item",
			"fieldtype": "Link",
			"options": "Item",
			"width": 180,
		},
		{
			"label": _("Amount"),
			"fieldname": "amount",
			"fieldtype": "Currency",
			"width": 140,
		},
	]


def get_date_conditions(filters: dict) -> tuple[str, dict]:
	"""Same 3-case date logic used across the other cost reports."""
	from_date = filters.get("from_date")
	to_date = filters.get("to_date")

	values = {}
	if from_date and to_date:
		condition = " AND eu.site_date BETWEEN %(from_date)s AND %(to_date)s"
		values["from_date"] = getdate(from_date)
		values["to_date"] = getdate(to_date)
	elif from_date and not to_date:
		condition = " AND eu.site_date BETWEEN %(from_date)s AND %(today)s"
		values["from_date"] = getdate(from_date)
		values["today"] = getdate(nowdate())
	else:
		condition = ""

	return condition, values


def get_data(filters: dict) -> list[dict]:
	project_filter = filters.get("project")

	date_condition, values = get_date_conditions(filters)

	project_condition = ""
	if project_filter:
		project_condition = " AND eu.project = %(project)s"
		values["project"] = project_filter

	rows = frappe.db.sql(
		f"""
		SELECT
			eu.project AS project,
			proj.project_name AS project_name,
			eud.contractor AS contractor,
			eud.equipment_item AS equipment_item,
			SUM(eud.amount) AS amount
		FROM `tabEquipment Usage Details` eud
		INNER JOIN `tabEquipment Usage` eu ON eu.name = eud.parent
		LEFT JOIN `tabProject` proj ON proj.name = eu.project
		WHERE eu.docstatus = 1
			AND eu.project IS NOT NULL
			AND eu.project != ''
			{project_condition}
			{date_condition}
		GROUP BY eu.project, eud.contractor, eud.equipment_item
		ORDER BY proj.project_name, eud.contractor, eud.equipment_item
		""",
		values,
		as_dict=True,
	)

	return [
		{
			"project_name": r.project_name or r.project,
			"contractor": r.contractor,
			"equipment_item": r.equipment_item,
			"amount": flt(r.amount),
		}
		for r in rows
	]