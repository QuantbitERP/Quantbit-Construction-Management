// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bulk RA Billing", {
    setup(frm) {
        frm.set_query("ra_bill", "project_details", function (doc, cdt, cdn) {
            let row = locals[cdt][cdn];
            return {
                filters: {
                    project: row.project
                }
            };
        });
    },
    get_projects(frm) {
        if (!frm.doc.site) {
            frappe.msgprint(__("Please select a Site first."));
            return;
        }

        frappe.call({
            method: "quantbit_construction_management.ra_billing.doctype.bulk_ra_billing.bulk_ra_billing.get_projects_for_site",
            args: { site: frm.doc.site },
            freeze: true,
            freeze_message: __("Fetching projects..."),
            callback: function (r) {
                if (!r.message || !r.message.length) {
                    frappe.msgprint(__("No projects found for this site."));
                    return;
                }

                frm.clear_table("project_details");

                r.message.forEach(p => {
                    let child = frm.add_child("project_details");
                    child.project = p.name;
                    child.project_name = p.project_name;
                });

                frm.refresh_field("project_details");

                frappe.show_alert({
                    message: __("Projects fetched successfully."),
                    indicator: "green"
                });
            }
        });
    },

    get_ra_bills(frm) {
        if (!frm.doc.project_details || !frm.doc.project_details.length) {
            frappe.msgprint(__("Please fetch projects and select RA Bills first."));
            return;
        }

        let missing = frm.doc.project_details.filter(r => !r.ra_bill);
        if (missing.length) {
            frappe.msgprint(__("Please select an RA Bill for every project row before proceeding."));
            return;
        }

        if (frm.is_dirty()) {
            frappe.msgprint(__("Please save the document before exporting."));
            return;
        }

        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/api/method/quantbit_construction_management.ra_billing.doctype.bulk_ra_billing.bulk_ra_billing.export_bulk_ra_excel";

        const docname = document.createElement("input");
        docname.type = "hidden";
        docname.name = "bulk_ra_billing";
        docname.value = frm.doc.name;

        const csrf = document.createElement("input");
        csrf.type = "hidden";
        csrf.name = "csrf_token";
        csrf.value = frappe.csrf_token;

        form.appendChild(docname);
        form.appendChild(csrf);

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    },
});

frappe.ui.form.on("Bulk RA Billing Projects Details", {
    project(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "ra_bill", "");
    }
});