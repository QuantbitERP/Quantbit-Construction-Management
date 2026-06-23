# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters: dict | None = None):
	if not filters:
		filters = {}

	columns = get_columns()
	data = get_data(filters)

	return columns, data


def get_columns() -> list[dict]:
	return [
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
			"fieldtype": "Data",
			"width": 180,
		},
		{
			"label": _("UOM"),
			"fieldname": "uom",
			"fieldtype": "Link",
			"options": "UOM",
			"width": 100,
		},
		{
			"label": _("Quantity"),
			"fieldname": "quantity",
			"fieldtype": "Float",
			"width": 120,
		},
		{
			"label": _("Working Hrs"),
			"fieldname": "working_hrs",
			"fieldtype": "Float",
			"width": 120,
		},
		{
			"label": _("Diesel Filled (in LTR)"),
			"fieldname": "diesel_filledin_ltr",
			"fieldtype": "Float",
			"width": 160,
		},
	]


def get_data(filters: dict) -> list[dict]:
	conditions = []
	values = {}

	if filters.get("from_date"):
		conditions.append("eu.site_date >= %(from_date)s")
		values["from_date"] = filters.get("from_date")

	if filters.get("to_date"):
		conditions.append("eu.site_date <= %(to_date)s")
		values["to_date"] = filters.get("to_date")

	if filters.get("project"):
		conditions.append("eu.project = %(project)s")
		values["project"] = filters.get("project")

	if filters.get("equipment_item"):
		conditions.append("eud.equipment_item = %(equipment_item)s")
		values["equipment_item"] = filters.get("equipment_item")

	if filters.get("contractor"):
		conditions.append("eud.contractor = %(contractor)s")
		values["contractor"] = filters.get("contractor")

	condition_str = ""
	if conditions:
		condition_str = "AND " + " AND ".join(conditions)

	data = frappe.db.sql(f"""
		SELECT
			eud.contractor,
			item.item_name AS equipment_item,
			eud.uom,
			eud.quantity,
			eud.working_hrs,
			eud.diesel_filledin_ltr
		FROM
			`tabEquipment Usage Details` eud
		INNER JOIN
			`tabEquipment Usage` eu ON eu.name = eud.parent
		LEFT JOIN
			`tabItem` item ON item.name = eud.equipment_item
		WHERE
			eu.docstatus = 1
			{condition_str}
		ORDER BY
			eu.site_date DESC, eud.idx
	""", values, as_dict=True)

	return data


