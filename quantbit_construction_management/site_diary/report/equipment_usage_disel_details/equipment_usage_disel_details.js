// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.query_reports["Equipment Usage Disel Details"] = {
	filters: [
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			default: frappe.datetime.add_months(frappe.datetime.get_today(), -1),
			reqd: 1
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
			reqd: 1
		},
		{
			fieldname: "project",
			label: __("Project"),
			fieldtype: "Link",
			options: "Project"
		},
		{
			fieldname: "equipment_item",
			label: __("Equipment Item"),
			fieldtype: "Link",
			options: "Item"
		},
		{
			fieldname: "contractor",
			label: __("Contractor"),
			fieldtype: "Link",
			options: "Contractor"
		}
	]
};
