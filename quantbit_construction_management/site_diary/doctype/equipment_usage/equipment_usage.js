// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Equipment Usage", {
	setup(frm) {
        frm.set_query("task","equipment_usage_details",function() {
            return {
                filters: {
                    project: frm.doc.project
                }
            };
        });
        
         frm.set_query("subtask","equipment_usage_details", function() {
            return {
                filters: {
                    parent_task: frm.doc.task,
                    custom_is_subtask: 1
                }
            };
        });
	},
});

frappe.ui.form.on("Equipment Usage Details", {
    rate: function(frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    quantity: function(frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    working_hrs: function(frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    }


});

function calculate_amount(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    row.amount = (row.quantity || 0) * (row.rate || 0)* (row.working_hrs || 0);

    frm.refresh_field("equipment_usage_details");
}