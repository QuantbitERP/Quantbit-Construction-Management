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
    onload(frm) {
        calculate_total_amount(frm);
    },
    with_tax(frm) {
        frm.toggle_reqd("tax_details", frm.doc.with_tax);
        calculate_grand_total(frm);
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

        if (frm.doc.with_tax) {
            if (!frm.doc.tax_details || !frm.doc.tax_details.length) {
                frappe.msgprint(__("Please add at least one Tax row, or uncheck 'With Tax'."));
                return;
            }
            let bad_tax = frm.doc.tax_details.filter(r => !r.tax_category || !flt(r.tax_rate));
            if (bad_tax.length) {
                frappe.msgprint(__("Please set Tax Category and a valid Tax Rate for every tax row."));
                return;
            }
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
    validate(frm) {
        calculate_total_amount(frm);

        if (frm.doc.with_tax) {
            if (!frm.doc.tax_details || !frm.doc.tax_details.length) {
                frappe.throw(__("Please add at least one Tax row, or uncheck 'With Tax'."));
            }
            frm.doc.tax_details.forEach(row => {
                if (!row.tax_category) {
                    frappe.throw(__("Row #{0}: Tax Category is mandatory.", [row.idx]));
                }
                if (!flt(row.tax_rate) || flt(row.tax_rate) < 0) {
                    frappe.throw(__("Row #{0}: Tax Rate must be a positive value.", [row.idx]));
                }
            });
        }
    }
});

frappe.ui.form.on("Bulk RA Billing Projects Details", {
    project(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "ra_bill", "");
    },
    amount(frm, cdt, cdn) {
        calculate_total_amount(frm);
    },
    ra_bill(frm, cdt, cdn) {
        calculate_total_amount(frm);
    },
    project_details_remove(frm) {
        calculate_total_amount(frm);
    }
});

function calculate_total_amount(frm) {
    let total = 0;
    (frm.doc.project_details || []).forEach(row => {
        total += flt(row.amount);
    });
    frm.set_value("total_amount", total);
    frm.refresh_field("total_amount");
}

frappe.ui.form.on("Bulk RA Bill Tax Details", {
    tax_rate(frm, cdt, cdn) {
        calculate_row_tax(frm, cdt, cdn);
    },
    tax_category(frm, cdt, cdn) {
        calculate_row_tax(frm, cdt, cdn);
    },
    tax_details_add(frm, cdt, cdn) {
        calculate_row_tax(frm, cdt, cdn);
    },
    tax_details_remove(frm) {
        calculate_grand_total(frm);
    }
});

function calculate_total_amount(frm) {
    let total = 0;
    (frm.doc.project_details || []).forEach(row => {
        total += flt(row.amount);
    });
    frm.set_value("total_amount", total);

    recalculate_all_tax_rows(frm);
}

function recalculate_all_tax_rows(frm) {
    (frm.doc.tax_details || []).forEach(row => {
        row.tax_amount = flt(
            (flt(frm.doc.total_amount) * flt(row.tax_rate)) / 100,
            precision("tax_amount", row)
        );
    });
    frm.refresh_field("tax_details");
    calculate_grand_total(frm);
}

function calculate_row_tax(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let tax_amount = flt(
        (flt(frm.doc.total_amount) * flt(row.tax_rate)) / 100,
        precision("tax_amount", row)
    );
    frappe.model.set_value(cdt, cdn, "tax_amount", tax_amount);
    calculate_grand_total(frm);
}

function calculate_grand_total(frm) {
    let tax_total = 0;

    if (frm.doc.with_tax) {
        (frm.doc.tax_details || []).forEach(row => {
            tax_total += flt(row.tax_amount);
        });
    }

    let grand_total = flt(frm.doc.total_amount) + tax_total;
    frm.set_value("grand_total", grand_total);
}