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
			"label": _("Item Code"),
			"fieldname": "item_code",
			"fieldtype": "Link",
			"options": "Item",
			"width": 180,
		},
		{
			"label": _("Item Name"),
			"fieldname": "item_name",
			"fieldtype": "Data",
			"width": 220,
		},
		{
			"label": _("UOM"),
			"fieldname": "uom",
			"fieldtype": "Link",
			"options": "UOM",
			"width": 80,
		},
		{
			"label": _("Total Qty"),
			"fieldname": "total_qty",
			"fieldtype": "Float",
			"width": 110,
		},
		{
			"label": _("Total Amount"),
			"fieldname": "total_amount",
			"fieldtype": "Currency",
			"width": 150,
		},
	]


def get_data(filters):
	project   = filters.get("project")
	from_date = filters.get("from_date")
	to_date   = filters.get("to_date")

	conditions = ["se.docstatus != 2", "se.stock_entry_type = 'Material Issue'"]

	if project:
		conditions.append("se.project = %(project)s")

	if from_date and to_date:
		conditions.append("se.posting_date BETWEEN %(from_date)s AND %(to_date)s")
	elif from_date:
		to_date = today()
		conditions.append("se.posting_date BETWEEN %(from_date)s AND %(to_date)s")
	# if neither date provided → no date filter (show all)

	where_clause = " AND ".join(conditions)

	data = frappe.db.sql(
		f"""
		SELECT
			sed.item_code       AS item_code,
			sed.item_name       AS item_name,
			sed.uom             AS uom,
			SUM(sed.qty)        AS total_qty,
			SUM(sed.amount)     AS total_amount
		FROM
			`tabStock Entry` se
		INNER JOIN
			`tabStock Entry Detail` sed ON sed.parent = se.name
		WHERE
			{where_clause}
		GROUP BY
			sed.item_code, sed.item_name, sed.uom
		ORDER BY
			sed.item_name
		""",
		{"project": project, "from_date": from_date, "to_date": to_date},
		as_dict=True,
	)

	return data
