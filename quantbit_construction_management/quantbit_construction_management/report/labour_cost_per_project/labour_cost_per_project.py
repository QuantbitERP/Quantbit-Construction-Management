# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import today


def execute(filters: dict | None = None):
	"""Return columns and data for the report."""
	filters = filters or {}
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns():
	return [
		{
			"label": _("Manpower Item Code"),
			"fieldname": "item_code",
			"fieldtype": "Link",
			"options": "Item",
			"width": 180,
		},
		{
			"label": _("Manpower Item Name"),
			"fieldname": "item_name",
			"fieldtype": "Data",
			"width": 220,
		},
		{
			"label": _("Total Amount"),
			"fieldname": "total_amount",
			"fieldtype": "Currency",
			"width": 160,
		},
	]


def get_data(filters):
	project   = filters.get("project")
	from_date = filters.get("from_date")
	to_date   = filters.get("to_date")

	conditions = ["mu.docstatus != 2"]

	if project:
		conditions.append("mu.project = %(project)s")

	if from_date and to_date:
		conditions.append("mu.site_date BETWEEN %(from_date)s AND %(to_date)s")
	elif from_date:
		to_date = today()
		conditions.append("mu.site_date BETWEEN %(from_date)s AND %(to_date)s")
	# if neither date provided → no date filter (show all)

	where_clause = " AND ".join(conditions)

	data = frappe.db.sql(
		f"""
		SELECT
			mud.equipment_item      AS item_code,
			i.item_name             AS item_name,
			SUM(mud.amount)         AS total_amount
		FROM
			`tabManpower Usage` mu
		INNER JOIN
			`tabManpower Usage Details` mud ON mud.parent = mu.name
		LEFT JOIN
			`tabItem` i ON i.name = mud.equipment_item
		WHERE
			{where_clause}
		GROUP BY
			mud.equipment_item, i.item_name
		ORDER BY
			i.item_name
		""",
		{"project": project, "from_date": from_date, "to_date": to_date},
		as_dict=True,
	)

	return data
