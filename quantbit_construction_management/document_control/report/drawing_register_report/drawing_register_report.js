// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.query_reports["Drawing Register Report"] = {
	filters: [
		{
			"fieldname": "project",
			"label": __("Project"),
			"fieldtype": "Link",
			"options" : "Project",
			"width" : 100
		},
		{
			"fieldname": "drawing_no",
			"label" : __("Drawing No"),
			"fieldtype" : "Data",
			"width" : 100
		},
		{
			"fieldname": "issue_date",
			"label" : __("Issue Date"),
			"fieldtype" : "Date",
			"width" : 100
		}
	],
};
