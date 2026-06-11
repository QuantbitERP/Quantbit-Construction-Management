frappe.ui.form.on("RA Billing", {
    setup(frm) {
        frm.set_query("stage", "ra_billing_details", function () {
            let filters = { "custom_is_stage": 1 };
            if (frm.doc.project) filters.project = frm.doc.project;
            return { filters: filters };
        });

        frm.set_query("task", "ra_billing_details", function () {
            let filters = { "custom_is_task": 1 };
            if (frm.doc.project) filters.project = frm.doc.project;
            return { filters: filters };
        });

        frm.set_query("subtask", "ra_billing_details", function () {
            let filters = { "custom_is_subtask": 1 };
            if (frm.doc.project) filters.project = frm.doc.project;
            return { filters: filters };
        });
    },
    get_details(frm) {
        if (!frm.doc.project) {
            frappe.msgprint(__("Please select a Project first."));
            return;
        }

        frappe.call({
            method: "quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.get_project_tasks",
            args: {
                project: frm.doc.project
            },
            freeze: true,
            freeze_message: __("Fetching project tasks..."),
            callback: function (r) {
                if (r.message && r.message.length) {
                    frm.clear_table("ra_billing_details");

                    r.message.forEach(row => {
                        let child = frm.add_child("ra_billing_details");

                        child.stage_subject = row.stage;
                        child.stage = row.stage_id;
                        child.task = row.task_id;
                        child.task_subject = row.task;
                        child.subtask = row.subtask_id;
                        child.subtask_subject = row.subtask;
                        child.total_quantity = row.total_quantity;
                        child.total_achieved = row.total_achieved;
                        child.rate = row.rate;
                        child.billed_quantity = row.billed_quantity;
                        child.billable_quantity = row.billable_quantity;
                        child.amount = row.amount;
                        child.uom = row.uom;
                    });

                    frm.refresh_field("ra_billing_details");

                    // Recalculate grand total
                    let total = frm.doc.ra_billing_details.reduce(
                        (sum, row) => sum + flt(row.amount), 0
                    );
                    frm.set_value("grand_total", total);
                } else {
                    frappe.msgprint(__("No tasks found for the selected project."));
                }

                frappe.show_alert({
                    message: __("Details fetched successfully."),
                    indicator: "green"
                });
            }
        });
    },

    get_details_(frm) {
        if (!frm.doc.project || !frm.doc.from_date || !frm.doc.to_date) {
            frappe.msgprint(__("Please select Project, From Date and To Date first."));
            return;
        }

        frappe.call({
            method: "quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.get_steel_details",
            args: {
                project: frm.doc.project,
                from_date: frm.doc.from_date,
                to_date: frm.doc.to_date
            },
            freeze: true,
            freeze_message: __("Fetching steel details..."),
            callback: function (steel_res) {
                frm.clear_table("ra_steel_details");
                if (steel_res.message && steel_res.message.length) {
                    steel_res.message.forEach(row => {

                        let child = frm.add_child("ra_steel_details");
                        child.item = row.item;
                        child.task = row.task;
                        child.subtask = row.subtask;
                        child.diamter_of_bar = row.diamter_of_bar;
                        child.unit = row.unit;
                        child.qty = row.qty;
                        child.id = row.name;
                        child.doc_name = "Stock Entry";
                    });
                    frm.refresh_field("ra_steel_details");
                    frappe.show_alert({
                        message: __("Steel Details fetched successfully."),
                        indicator: "green"
                    });
                } else {
                    frappe.msgprint(__("No steel details found."));
                }
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

frappe.ui.form.on("RA Steel Details", {
    no_of_fdn: function (frm, cdt, cdn) { calculate_steel_length(frm, cdt, cdn); },
    no_of_bar: function (frm, cdt, cdn) { calculate_steel_length(frm, cdt, cdn); },
    cutting_length: function (frm, cdt, cdn) { calculate_steel_length(frm, cdt, cdn); },
    weight_of_bar: function (frm, cdt, cdn) { calculate_steel_weight(frm, cdt, cdn); },
    total_length: function (frm, cdt, cdn) { calculate_steel_weight(frm, cdt, cdn); }
});

function calculate_steel_length(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let fields = ["no_of_fdn", "no_of_bar", "cutting_length"];
    let total_length = 1;
    let has_value = false;

    fields.forEach(f => {
        if (flt(row[f])) {
            total_length *= flt(row[f]);
            has_value = true;
        }
    });

    total_length = has_value ? total_length : 0;
    frappe.model.set_value(cdt, cdn, 'total_length', total_length);
    calculate_steel_weight(frm, cdt, cdn);
}

function calculate_steel_weight(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let total_weight = flt(row.total_length) * flt(row.weight_of_bar);
    frappe.model.set_value(cdt, cdn, 'total_weight', total_weight);
}
