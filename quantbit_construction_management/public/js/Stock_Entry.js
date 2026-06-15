frappe.ui.form.on("Stock Entry", {
    setup(frm) {
        frm.set_query('custom_task', 'items', function (doc, cdt, cdn) {
            let row = locals[cdt][cdn];
            return {
                filters: {
                    project: row.project,
                    custom_is_stage: 1
                }
            };
        });

        const source_map = {
            custom_subtask: "custom_task",
            custom_task_level1: "custom_subtask",
            custom_task_level2: "custom_task_level1",
            custom_task_level3: "custom_task_level2",
            custom_task_level4: "custom_task_level3",
            custom_task_level5: "custom_task_level4",
            custom_task_level6: "custom_task_level5",
            custom_task_level7: "custom_task_level6",
            custom_task_level8: "custom_task_level7",
            custom_task_level9: "custom_task_level8",
            custom_task_level10: "custom_task_level9",
            custom_task_level11: "custom_task_level10"
        };
        Object.keys(source_map).forEach(fieldname => {

            frm.fields_dict.items.grid.get_field(fieldname).get_query =
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
                        query: "quantbit_construction_management.public.pythonn.stock_entry.get_depends_on_tasks",
                        filters: {
                            task: task_name
                        }
                    };
                };
        });

    }
});

frappe.ui.form.on("Stock Entry Detail", {
    form_render(frm, cdt, cdn) {
        setTimeout(() => {
            refresh_task_levels(frm, cdt, cdn);
        }, 100);
    },
    project: function (frm, cdt, cdn) {
        frappe.model.set_value(cdt, cdn, 'custom_stage', '');
    },
    custom_task: function (frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        if (!row.custom_task) return;

        // clear all selections
        frappe.model.set_value(cdt, cdn, "custom_subtask", "");

        for (let i = 1; i <= 11; i++) {
            frappe.model.set_value(cdt, cdn, `custom_task_level${i}`, "");
        }

        // show only task field
        set_level_query(
            frm,
            row.name,
            "custom_task",
            "custom_subtask"
        );
    },
    custom_subtask: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },
    custom_task_level1: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },

    custom_task_level2: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },

    custom_task_level3: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },

    custom_task_level4: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },

    custom_task_level5: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },
    custom_task_level6: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },
    custom_task_level7: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },
    custom_task_level8: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    },
    custom_task_level9: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
    }

});

function get_deepest_task(frm, cdt, cdn) {
    const row = locals[cdt][cdn];

    const levels = [
        "custom_subtask",
        "custom_task_level1",
        "custom_task_level2",
        "custom_task_level3",
        "custom_task_level4",
        "custom_task_level5",
        "custom_task_level6",
        "custom_task_level7",
        "custom_task_level8",
        "custom_task_level9",
        "custom_task_level10"
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

function refresh_task_levels(frm, cdt, cdn) {
    const row = locals[cdt][cdn];

    const levels = [
        "custom_subtask",
        "custom_task_level1",
        "custom_task_level2",
        "custom_task_level3",
        "custom_task_level4",
        "custom_task_level5",
        "custom_task_level6",
        "custom_task_level7",
        "custom_task_level8",
        "custom_task_level9",
        "custom_task_level10"
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
        frappe.call({
            method: "quantbit_construction_management.public.pythonn.stock_entry.has_dependencies",
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

    const grid_row = frm.fields_dict.items.grid.grid_rows_by_docname[rowname];
    if (!grid_row) return;

    grid_row.toggle_display("custom_subtask", visible_level >= 1);

    for (let i = 1; i <= 11; i++) {
        grid_row.toggle_display(`custom_task_level${i}`, visible_level >= (i + 1));
    }
}