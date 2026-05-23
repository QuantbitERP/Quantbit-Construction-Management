frappe.ui.form.on("Stock Entry", {

    setup(frm) {

        frm.fields_dict.items.grid.get_field('custom_task').get_query = function(doc, cdt, cdn) {

            let row = locals[cdt][cdn];

            return {
                filters: {
                    project: row.project
                }
            };
        };

        frm.fields_dict.items.grid.get_field('custom_subtask').get_query = function(doc, cdt, cdn) {

            let row = locals[cdt][cdn];

            return {
                filters: {
                    parent_task: row.custom_task,
                    custom_is_subtask: 1
                }
            };
        };
    }
});