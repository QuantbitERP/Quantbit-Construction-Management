// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.query_reports["Cost By Category"] = {
	filters: [
		{
			fieldname: "project",
			label: __("Project"),
			fieldtype: "Link",
			options: "Project",
		},
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
		},
		{
			fieldname: "cost_category",
			label: __("Category"),
			fieldtype: "Select",
			options: "\nLabour\nMaterial\nEquipment",
		},
	],
};