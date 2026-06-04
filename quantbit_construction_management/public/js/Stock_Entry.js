frappe.ui.form.on("Stock Entry", {
    setup(frm) {
        frm.set_query('custom_task', 'items', function(doc, cdt, cdn) {
            let row = locals[cdt][cdn];
            return {
                filters: {
                    project: row.project,
                    custom_is_task: 1
                }
            };
        });

        frm.set_query('custom_subtask', 'items', function(doc, cdt, cdn) {
            let row = locals[cdt][cdn];
            return {
                filters: {
                    parent_task: row.custom_task,
                    custom_is_subtask: 1
                }
            };
        });
    }
});

frappe.ui.form.on("Stock Entry Detail", {
    project: function(frm, cdt, cdn) {
        frappe.model.set_value(cdt, cdn, 'custom_task', '');
        frappe.model.set_value(cdt, cdn, 'custom_subtask', '');
    },
    custom_task: function(frm, cdt, cdn) {
        frappe.model.set_value(cdt, cdn, 'custom_subtask', '');
    }
});