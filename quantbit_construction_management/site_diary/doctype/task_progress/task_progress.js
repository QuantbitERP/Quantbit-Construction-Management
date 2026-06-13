frappe.ui.form.on("Task Progress", {
    setup(frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        frm.fields_dict.task_progress_details.grid.get_field(
            "parent_task"
        ).get_query = function (doc, cdt, cdn) {

            let child = locals[cdt][cdn];

            return {
                filters: {
                    "project": frm.doc.project,
                    "custom_is_stage": 1,
                    "is_group": 1
                }
            };
        };

        const source_map = {
            task: "parent_task",
            task_level1: "task",
            task_level2: "task_level1",
            task_level3: "task_level2",
            task_level4: "task_level3",
            task_level5: "task_level4",
            task_level6: "task_level5",
            task_level7: "task_level6",
            task_level8: "task_level7",
            task_level9: "task_level8",
            task_level10: "task_level9",
            task_level11: "task_level10"
        };
        Object.keys(source_map).forEach(fieldname => {

            frm.fields_dict.task_progress_details.grid.get_field(fieldname).get_query =
                function (doc, cdt, cdn) {

                    let row = locals[cdt][cdn];

                    let source_field = source_map[fieldname];
                    let task_name = row[source_field];
                    if (!task_name) {
                        return {
                            filters: {
                                name: ["=", "___invalid___"]
                            }
                        };
                    }

                    return {
                        query: "quantbit_construction_management.site_diary.doctype.task_progress.task_progress.get_depends_on_tasks",
                        filters: {
                            task: task_name
                        }
                    };
                };
        });
    },
    onload(frm) {

        if (frm.is_new() && !frm.doc.site_date) {
            frm.set_value("site_date", frappe.datetime.get_today());
        }
    }

});


frappe.ui.form.on("Task Progress Details", {
    form_render(frm, cdt, cdn) {
        setTimeout(() => {
            refresh_task_levels(frm, cdt, cdn);
        }, 100);
    },
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
    parent_task: function (frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        if (!row.parent_task) return;

        // clear all selections
        frappe.model.set_value(cdt, cdn, "task", "");

        for (let i = 1; i <= 11; i++) {
            frappe.model.set_value(cdt, cdn, `task_level${i}`, "");
        }

        // show only task field
        toggle_levels(frm, row.name, 1);
        set_level_query(
            frm,
            row.name,
            "parent_task",
            "task"
        );
    },
    task: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },
    task_level1: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },

    task_level2: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },

    task_level3: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },

    task_level4: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },

    task_level5: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },
    task_level6: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },
    task_level7: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },
    task_level8: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },
    task_level9: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },
    achieved_today(frm, cdt, cdn) {
        calculate_progress(frm, cdt, cdn);
        validate_deepest_task(frm, cdt, cdn);
    },
    total_qty(frm, cdt, cdn) {
        calculate_progress(frm, cdt, cdn);
        validate_deepest_task(frm, cdt, cdn);
    }

});

function get_deepest_task(frm, cdt, cdn) {
    const row = locals[cdt][cdn];

    const levels = [
        "task",
        "task_level1",
        "task_level2",
        "task_level3",
        "task_level4",
        "task_level5",
        "task_level6",
        "task_level7",
        "task_level8",
        "task_level9",
        "task_level10"
    ];

    let last_task = null;

    for (let field of levels) {
        let task = row[field];

        if (task) {
            last_task = task;
        } else {
            break;
        }
    }

    return last_task;
}

// function validate_deepest_task(frm, cdt, cdn) {
//     let task = get_deepest_task(frm, cdt, cdn);
//     if (!task) return;

//     frappe.db.get_value('Task', task, ['custom_is_subtask', 'subject'])
//         .then(r => {
//             let data = r.message;

//             let is_subtask = data ? data.custom_is_subtask : 0;
//             let subject = data ? data.subject : '';

//             if (!is_subtask) {
//                 frappe.throw(`Task "${subject}" is not a subtask.`);
//             }
//         });
// }


function refresh_task_levels(frm, cdt, cdn) {
    const row = locals[cdt][cdn];

    const levels = [
        "task",
        "task_level1",
        "task_level2",
        "task_level3",
        "task_level4",
        "task_level5",
        "task_level6",
        "task_level7",
        "task_level8",
        "task_level9",
        "task_level10"
    ];

    let visible_level = 1;

    // 1. find deepest filled level
    for (let i = 0; i < levels.length; i++) {
        if (row[levels[i]]) {
            visible_level = i + 1;
        } else {
            break;
        }
    }

    // 2. dependency check ONLY on deepest level
    const deepest_field = levels[visible_level - 1];
    const deepest_task = row[deepest_field];

    if (!deepest_task) {
        apply_visibility(frm, row.name, visible_level);
        return;
    }

    if (deepest_task) {
        // Fetch task values
        frappe.db.get_value(
            "Task",
            deepest_task,
            [
                "custom_total_quantity",
                "custom_total_achieved"
            ]
        ).then(r => {

            if (r.message) {
                frappe.model.set_value(
                    cdt,
                    cdn,
                    "total_qty",
                    r.message.custom_total_quantity || 0
                );

                frappe.model.set_value(
                    cdt,
                    cdn,
                    "total_achieved",
                    r.message.custom_total_achieved || 0
                );
            }
        });

        frappe.call({
            method: "quantbit_construction_management.site_diary.doctype.task_progress.task_progress.has_dependencies",
            args: {
                task: deepest_task
            },
            callback: function (r) {

                if (r.message) {
                    visible_level += 1;
                }

                apply_visibility(frm, row.name, visible_level);
            }
        });
    } else {
        apply_visibility(frm, row.name, visible_level);
    }
}

function apply_visibility(frm, rowname, visible_level) {

    const grid_row = frm.fields_dict.task_progress_details.grid.grid_rows_by_docname[rowname];
    if (!grid_row) return;

    grid_row.toggle_display("task", visible_level >= 1);

    for (let i = 1; i <= 11; i++) {
        grid_row.toggle_display(`task_level${i}`, visible_level >= (i + 1));
    }
}

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
