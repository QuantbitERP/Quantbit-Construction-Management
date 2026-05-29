frappe.ui.form.on("Task Progress", {
    setup(frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        frm.fields_dict.task_progress_details.grid.get_field(
            "parent_task"
        ).get_query = function(doc, cdt, cdn) {

            let child = locals[cdt][cdn];

            return {
                filters: {
                    "project": frm.doc.project,
                    "custom_is_task": 1,
                    "is_group": 1
                }
            };
        };

        frm.fields_dict.task_progress_details.grid.get_field(
            "task"
        ).get_query = function(doc, cdt, cdn) {

            let child = locals[cdt][cdn];

            return {
                filters: {
                    "parent_task": child.parent_task,
                    "custom_is_subtask": 1
                }
            };
        };
    },
    onload(frm) {

        if (frm.is_new() && !frm.doc.site_date) {
            frm.set_value("site_date", frappe.datetime.get_today());
        }
    }

});


frappe.ui.form.on("Task Progress Details", {
    task(frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        if (!row.task) return;

        frappe.call({
            method: "quantbit_construction_management.site_diary.doctype.task_progress.task_progress.get_previous_task_progress",
            args: {
                task: row.task,
                current_doc: frm.doc.name
            },

            callback(r) {

                if (!r.message) return;

                let d = r.message;

                frappe.model.set_value(cdt, cdn,
                    "total_qty",
                    d.total_qty || 0
                );

                frappe.model.set_value(cdt, cdn,
                    "total_achieved",
                    d.previous_total_achieved || 0
                );

                frappe.model.set_value(cdt, cdn,
                    "percent_completed",
                    d.percent_completed || 0
                );

                row._last_achieved_today = 0;
            }
        });

    },

    achieved_today(frm, cdt, cdn) {
        calculate_progress(frm, cdt, cdn);
    },

    total_qty(frm, cdt, cdn) {
        calculate_progress(frm, cdt, cdn);
    }

});


function calculate_progress(frm, cdt, cdn) {

    let row = locals[cdt][cdn];

    let previous_total = flt(row.total_achieved);

    let achieved_today = flt(row.achieved_today);

    let total_qty = flt(row.total_qty);

    let diff = achieved_today - (row._last_achieved_today || 0);

    let total_achieved = previous_total + diff;

    let percent_completed = 0;

    if (total_qty > 0) {
        percent_completed = (total_achieved / total_qty) * 100;
    }

    frappe.model.set_value(cdt, cdn,
        "total_achieved",
        total_achieved
    );

    frappe.model.set_value(cdt, cdn,
        "percent_completed",
        percent_completed
    );

    row._last_achieved_today = achieved_today;
}