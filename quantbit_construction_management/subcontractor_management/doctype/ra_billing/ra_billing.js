frappe.ui.form.on("RA Billing", {
    project(frm) {
        if (!frm.doc.project) return;

        frappe.call({
            method: "quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.get_project_tasks",
            args: {
                project: frm.doc.project
            },
            callback: function (r) {
                if (r.message) {

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
                        child.progress = row.progress;
                        child.rate = row.rate;
                        child.billed_quantity = row.billed_quantity;
                        child.billable_quantity = child.total_achieved - child.billed_quantity;
                        child.amount = flt(child.billable_quantity) * flt(child.rate);
                    });
                    frm.refresh_field("ra_billing_details");

                    let total = 0;
                    for (let row of frm.doc.ra_billing_details) {
                        total += flt(row.amount);
                    }

                    frm.set_value("grand_total", total);
                }
            }
        });
    },
    refresh(frm) {
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