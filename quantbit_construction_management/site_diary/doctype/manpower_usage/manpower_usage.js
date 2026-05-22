// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Manpower Usage", {
	setup(frm) {
        frm.set_query("task","manpower_usage", function() {
            return {
                filters: {
                    project: frm.doc.project
                }
            };
        });
        
         frm.set_query("subtask","manpower_usage", function() {
            return {
                filters: {
                    parent_task: frm.doc.task,
                    custom_is_subtask: 1
                }
            };
        });

	},
});

frappe.ui.form.on("Manpower Usage Details", {
    rate: function(frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    }

});


function calculate_amount(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    row.amount = (row.quantity || 0) * (row.rate || 0);

    frm.refresh_field("manpower_usage");
}