// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.query_reports["Daily Progress Report"] = {

    filters: [

        {
            fieldname: "site_date",
            label: "Site Date",
            fieldtype: "Date",
            default: frappe.datetime.get_today(),
            reqd: 1
        },

        {
            fieldname: "project",
            label: "Project",
            fieldtype: "Link",
            options: "Project",
            reqd: 1
        }
    ]
};