# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate


def execute(filters: dict | None = None):
	"""Return columns and data for the report.

	Columns: Project, By Expense Claim, By Purchase Invoice (only if the
	"Include Purchase Invoice" checkbox is ticked), Total.

	Date filter behaviour:
	- No from_date / to_date given -> all-time data for every project.
	- Only from_date given -> from_date through today.
	- Both from_date and to_date given -> between the two, inclusive.
	"""
	filters = filters or {}
	include_pi = bool(filters.get("include_purchase_invoice"))

	columns = get_columns(include_pi)
	data = get_data(filters, include_pi)

	return columns, data


def get_columns(include_pi: bool) -> list[dict]:
	columns = [
		{
			"label": _("Project"),
			"fieldname": "project",
			"fieldtype": "Link",
			"options": "Project",
			"width": 200,
		},
		{
			"label": _("By Expense Claim"),
			"fieldname": "expense_claim_total",
			"fieldtype": "Currency",
			"width": 160,
		},
	]

	if include_pi:
		columns.append(
			{
				"label": _("By Purchase Invoice"),
				"fieldname": "purchase_invoice_total",
				"fieldtype": "Currency",
				"width": 160,
			}
		)

	columns.append(
		{
			"label": _("Total"),
			"fieldname": "total",
			"fieldtype": "Currency",
			"width": 160,
		}
	)

	return columns


def get_date_conditions(filters: dict) -> tuple[str, dict]:
	"""Build the WHERE-clause date fragment and its bind values based on the
	from_date / to_date combination rules described above."""
	from_date = filters.get("from_date")
	to_date = filters.get("to_date")

	values = {}
	if from_date and to_date:
		condition = " AND posting_date BETWEEN %(from_date)s AND %(to_date)s"
		values["from_date"] = getdate(from_date)
		values["to_date"] = getdate(to_date)
	elif from_date and not to_date:
		condition = " AND posting_date BETWEEN %(from_date)s AND %(today)s"
		values["from_date"] = getdate(from_date)
		values["today"] = getdate(nowdate())
	else:
		# Neither filter set -> no date restriction at all
		condition = ""

	return condition, values


def get_data(filters: dict, include_pi: bool) -> list[dict]:
	project_filter = filters.get("project")

	date_condition, date_values = get_date_conditions(filters)

	project_condition = ""
	values = dict(date_values)
	if project_filter:
		project_condition = " AND project = %(project)s"
		values["project"] = project_filter

	# --- Expense Claim totals, grouped by project ---
	expense_rows = frappe.db.sql(
		f"""
		SELECT
			project,
			SUM(total_sanctioned_amount) AS total
		FROM `tabExpense Claim`
		WHERE docstatus = 1
			AND project IS NOT NULL
			AND project != ''
			{project_condition}
			{date_condition}
		GROUP BY project
		""",
		values,
		as_dict=True,
	)
	expense_map = {row.project: flt(row.total) for row in expense_rows}

	# --- Purchase Invoice totals, grouped by project (only if requested) ---
	pi_map = {}
	if include_pi:
		pi_rows = frappe.db.sql(
			f"""
			SELECT
				project,
				SUM(base_grand_total) AS total
			FROM `tabPurchase Invoice`
			WHERE docstatus = 1
				AND project IS NOT NULL
				AND project != ''
				{project_condition}
				{date_condition}
			GROUP BY project
			""",
			values,
			as_dict=True,
		)
		pi_map = {row.project: flt(row.total) for row in pi_rows}

	# --- Build the project list to show ---
	# "Without any filter, show all projects" -> base the rows on Project,
	# not just projects that happen to have an Expense Claim / Purchase Invoice.
	project_query_filters = {}
	if project_filter:
		project_query_filters["name"] = project_filter

	projects = frappe.get_all(
		"Project",
		filters=project_query_filters,
		fields=["name"],
		order_by="name",
	)

	data = []
	for p in projects:
		expense_total = expense_map.get(p.name, 0.0)
		pi_total = pi_map.get(p.name, 0.0) if include_pi else 0.0
		total = expense_total + pi_total

		row = {
			"project": p.name,
			"expense_claim_total": expense_total,
			"total": total,
		}
		if include_pi:
			row["purchase_invoice_total"] = pi_total

		data.append(row)

	return data