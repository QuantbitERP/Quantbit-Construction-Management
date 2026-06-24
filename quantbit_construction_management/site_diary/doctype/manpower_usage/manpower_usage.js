// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Manpower Usage", {
    setup(frm) {
        frm.set_query("task", "manpower_usage", function () {
            return {
                filters: {
                    project: frm.doc.project,
                    "custom_is_stage": 1,
                    "is_group": 1
                }
            };
        });

        frm.set_query('equipment_item', 'manpower_usage', function (doc, cdt, cdn) {
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
        const source_map = {
            subtask: "task",
            task_level1: "subtask",
            task_level2: "task_level1",
            task_level3: "task_level2",
            task_level4: "task_level3",
            task_level5: "task_level4",
            task_level6: "task_level5",
            task_level7: "task_level6",
            task_level8: "task_level7",
            task_level9: "task_level8",
            task_level10: "task_level9"
        };
        Object.keys(source_map).forEach(fieldname => {

            frm.fields_dict.manpower_usage.grid.get_field(fieldname).get_query =
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
                        query: "quantbit_construction_management.site_diary.doctype.manpower_usage.manpower_usage.get_depends_on_tasks",
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

frappe.ui.form.on("Manpower Usage Details", {
    form_render(frm, cdt, cdn) {
        setTimeout(() => {
            refresh_task_levels(frm, cdt, cdn);
        }, 100);
    },
    task: function (frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        if (!row.task) return;

        // clear all selections
        frappe.model.set_value(cdt, cdn, "subtask", "");

        for (let i = 1; i <= 11; i++) {
            frappe.model.set_value(cdt, cdn, `task_level${i}`, "");
        }

        // show only task field
        set_level_query(
            frm,
            row.name,
            "task",
            "subtask"
        );
    },
    subtask: function (frm, cdt, cdn) {
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
    quantity: function (frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    presenty: function (frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    rate: function (frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    time_in: function (frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    time_out: function (frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    contractor: function (frm, cdt, cdn) {
        validate_equipment(frm, cdt, cdn);
    },
    equipment_item: function (frm, cdt, cdn) {
        validate_equipment(frm, cdt, cdn);
    }
});

function get_deepest_task(frm, cdt, cdn) {
    const row = locals[cdt][cdn];

    const levels = [
        "subtask",
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

function refresh_task_levels(frm, cdt, cdn) {
    const row = locals[cdt][cdn];

    const levels = [
        "subtask",
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
        frappe.call({
            method: "quantbit_construction_management.site_diary.doctype.manpower_usage.manpower_usage.has_dependencies",
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

    const grid_row = frm.fields_dict.manpower_usage.grid.grid_rows_by_docname[rowname];
    if (!grid_row) return;

    grid_row.toggle_display("subtask", visible_level >= 1);
    grid_row.toggle_display("task_level1", true);

    for (let i = 2; i <= 11; i++) {
        grid_row.toggle_display(`task_level${i}`, visible_level >= (i + 1));
    }
}

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
        callback: function (r) {

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