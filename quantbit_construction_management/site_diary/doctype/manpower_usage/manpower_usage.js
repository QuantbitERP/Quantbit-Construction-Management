// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Manpower Usage", {
	setup(frm) {
        frm.set_query("task","manpower_usage", function() {
            return {
                filters: {
                    project: frm.doc.project,
                    "custom_is_task": 1,
                    "is_group": 1
                }
            };
        });
        
        frm.set_query('subtask', 'manpower_usage', function(doc, cdt, cdn) {
            let row = frappe.get_doc(cdt, cdn);
            return {
                filters: {
                    parent_task: row.task,
                    custom_is_subtask: 1
                }
            };
        });

        frm.set_query('equipment_item', 'manpower_usage', function(doc, cdt, cdn) {
            let row = frappe.get_doc(cdt, cdn);
            if (!row.contractor) {
                frappe.msgprint(__("Please select a Contractor first"));
                return {};
            }
            return {
                query: "quantbit_construction_management.site_diary.doctype.manpower_usage.manpower_usage.get_contractor_manpower_items",
                filters: {
                    contractor: row.contractor
                }
            };
        });

	},
     onload(frm) {
        if (frm.is_new() && !frm.doc.site_date) {
            frm.set_value("site_date", frappe.datetime.get_today());
        }
    }
});

frappe.ui.form.on("Manpower Usage Details", {
    quantity: function(frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    presenty: function(frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    rate: function(frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    time_in: function(frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    time_out: function(frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    contractor: function(frm, cdt, cdn) {
        validate_equipment(frm, cdt, cdn);
    },
    equipment_item: function(frm, cdt, cdn) {
        validate_equipment(frm, cdt, cdn);
    }
});


function calculate_amount(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    if (row.time_in && row.time_out) {
        let t1 = moment(row.time_in, "HH:mm:ss");
        let t2 = moment(row.time_out, "HH:mm:ss");
        if (t2.isBefore(t1)) {
            t2.add(1, 'days');
        }
        let hours = t2.diff(t1, 'hours', true);
        frappe.model.set_value(cdt, cdn, "hours", hours);
    }

    let total_presenty = (row.quantity || 0) * (row.presenty || 0);
    frappe.model.set_value(cdt, cdn, "total_presenty", total_presenty);

    let amount = total_presenty * (row.rate || 0);
    frappe.model.set_value(cdt, cdn, "amount", amount);
}

function validate_equipment(frm, cdt, cdn) {

    let row = locals[cdt][cdn];

    if (!row.contractor || !row.equipment_item) {
        return;
    }

    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Contractor",
            name: row.contractor
        },
        callback: function(r) {

            if (r.message) {

                let contractor_doc = r.message;

                let item_row = contractor_doc.site_diary_contractor_item_details.find(d =>
                    d.item === row.equipment_item
                );

                if (!item_row) {
                    frappe.model.set_value(cdt, cdn, "equipment_item", "");
                    frappe.model.set_value(cdt, cdn, "contractor", "");

                    frappe.throw({
                        title: __("Validation Error"),
                        message: __(`Equipment ${row.equipment_item} does not exist for this contractor, 
                            Add ${row.equipment_item} in contractor or change the contractor.`),
                        indicator: "red"
                    });
                   
                } else {

                    // Fetch rate from contractor child table
                    frappe.model.set_value(cdt, cdn, "rate", item_row.rate || 0);
                }
            }
        }
    });
}