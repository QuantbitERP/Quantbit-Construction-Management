// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.query_reports["Project Progress Report"] = {
    tree: true,
    initial_depth: 0,
    filters: [

        {
            fieldname: "project",
            label: "Project",
            fieldtype: "Link",
            options: "Project",
            reqd: 1
        },

        {
            fieldname: "as_on_date",
            label: "As On Date",
            fieldtype: "Date",
            default: frappe.datetime.get_today(),
            reqd: 1
        }
    ]
};
