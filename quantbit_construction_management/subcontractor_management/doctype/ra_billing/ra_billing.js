frappe.ui.form.on("RA Billing", {
    get_details(frm) {
        if (!frm.doc.project) {
            frappe.msgprint(__("Please select a Project first."));
            return;
        }
        if (!frm.doc.from_date || !frm.doc.to_date) {
            frappe.msgprint(__("Please set both From Date and To Date."));
            return;
        }

        frappe.call({
            method: "quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.get_details_from_task_progress",
            args: {
                project: frm.doc.project,
                from_date: frm.doc.from_date,
                to_date: frm.doc.to_date
            },
            freeze: true,
            freeze_message: __("Fetching task progress details..."),
            callback: function (r) {
                if (!r.message || !r.message.length) {
                    frappe.msgprint(__("No submitted Task Progress records found for the selected project and date range."));
                    return;
                }

                frm.clear_table("ra_billing_details");

                r.message.forEach(row => {
                    let child = frm.add_child("ra_billing_details");

                    child.stage_subject    = row.stage;
                    child.stage            = row.stage_id;
                    child.task             = row.task_id;
                    child.task_subject     = row.task;
                    child.subtask          = row.subtask_id;
                    child.subtask_subject  = row.subtask;
                    child.total_quantity   = row.total_quantity;
                    child.total_achieved   = row.total_achieved;
                    child.rate             = row.rate;
                    child.billed_quantity  = row.billed_quantity;
                    child.billable_quantity = row.billable_quantity;
                    child.amount           = row.amount;
                    child.uom=row.uom;
                });

                frm.refresh_field("ra_billing_details");

                // Recalculate grand total
                let total = frm.doc.ra_billing_details.reduce(
                    (sum, row) => sum + flt(row.amount), 0
                );
                frm.set_value("grand_total", total);

                frappe.show_alert({
                    message: __("Details fetched successfully."),
                    indicator: "green"
                });
            }
        });
    },
    refresh(frm) {
        frm.add_custom_button(__("Export RA"), function () {

            window.open(
                frappe.urllib.get_full_url(
                    "/api/method/quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.export_ra_excel"
                    + "?ra_billing=" + frm.doc.name
                )
            );

});
        if (frm.doc.docstatus === 1) {

            frm.add_custom_button(__("Sales Invoice"), function () {

                let d = new frappe.ui.Dialog({
                    title: __("Select Item"),
                    fields: [
                        {
                            fieldname: "item_code",
                            fieldtype: "Link",
                            label: __("Item"),
                            options: "Item",
                            reqd: 1,
                            filters: {
                                "is_stock_item": 0
                            }
                        }
                    ],
                    primary_action_label: __("Create"),
                    primary_action(values) {

                        d.hide();

                        frappe.model.open_mapped_doc({
                            method: "quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.create_sales_invoice",
                            frm: frm,
                            args: {
                                item_code: values.item_code
                            }
                        });
                    }
                });

                d.show();

            }, __("Create"));
        }
    }
});
frappe.ui.form.on("RA Billing Details", {
    no1(frm, cdt, cdn) {
        calculate_quantity(frm, cdt, cdn);
    },
    no2(frm, cdt, cdn) {
        calculate_quantity(frm, cdt, cdn);
    },
    length(frm, cdt, cdn) {
        calculate_quantity(frm, cdt, cdn);
    },
    width(frm, cdt, cdn) {
        calculate_quantity(frm, cdt, cdn);
    },
    height(frm, cdt, cdn) {
        calculate_quantity(frm, cdt, cdn);
    },
    rate(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "amount", flt(row.quantity) * flt(row.rate));

        let total = frm.doc.ra_billing_details.reduce(
            (sum, r) => sum + flt(r.amount), 0
        );
        frm.set_value("grand_total", total);
    },
    quantity(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "amount", flt(row.quantity) * flt(row.rate));

        let total = frm.doc.ra_billing_details.reduce(
            (sum, r) => sum + flt(r.amount), 0
        );
        frm.set_value("grand_total", total);
    }
});

function calculate_quantity(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    let fields = ["no1", "no2", "length", "width", "height"];
    let quantity = 1;
    let has_value = false;

    fields.forEach(f => {
        if (flt(row[f])) {
            quantity *= flt(row[f]);
            has_value = true;
        }
    });

    quantity = has_value ? quantity : 0;

    frappe.model.set_value(cdt, cdn, "quantity", quantity);

    frappe.model.set_value(cdt, cdn, "amount", flt(quantity) * flt(row.rate));

    let total = frm.doc.ra_billing_details.reduce(
        (sum, r) => sum + flt(r.amount), 0
    );
    frm.set_value("grand_total", total);
}
