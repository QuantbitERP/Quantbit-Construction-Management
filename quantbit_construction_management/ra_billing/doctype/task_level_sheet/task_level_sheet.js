// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

const LEVEL_CHAIN = [
    "stage", "task", "task_level1", "task_level2", "task_level3", "task_level4",
    "task_level5", "task_level6", "task_level7", "task_level8", "task_level9", "task_level10"
];

const SUBJECT_MAP = {
    stage:        "stage_subject",
    task:         "task_subject",
    task_level1:  "task_level1_subject",
    task_level2:  "task_level2_subject",
    task_level3:  "task_level3_subject",
    task_level4:  "task_level4_subject",
    task_level5:  "task_level5_subject",
    task_level6:  "task_level6_subject",
    task_level7:  "task_level7_subject",
    task_level8:  "task_level8_subject",
    task_level9:  "task_level9_subject_copy",  
    task_level10: "task_level10_subject"
};

const SOURCE_MAP = {
    task:         "stage",
    task_level1:  "task",
    task_level2:  "task_level1",
    task_level3:  "task_level2",
    task_level4:  "task_level3",
    task_level5:  "task_level4",
    task_level6:  "task_level5",
    task_level7:  "task_level6",
    task_level8:  "task_level7",
    task_level9:  "task_level8",
    task_level10: "task_level9"
};

frappe.ui.form.on("Task Level Sheet", {
    setup(frm) {
        setup_hierarchy_queries(frm);
    },

    onload(frm) {
        if (frm.is_new() && !frm.doc.date) {
            frm.set_value("date", frappe.datetime.get_today());
        }
    },

    refresh(frm) {
        refresh_task_levels(frm);
        recalculate_average(frm);
    },

    project(frm) {
        frm.set_value("site", "");
        clear_from_level(frm, 0);

        if (frm.doc.project) {
            frappe.db.get_value("Project", frm.doc.project, "custom_site").then(r => {
                if (r.message && r.message.custom_site) {
                    frm.set_value("site", r.message.custom_site);
                }
            });
        }
        refresh_task_levels(frm);
    },

    validate(frm) {
        if (!frm.doc.project) {
            frappe.throw(__("Please select a Project"));
        }
        if (!frm.doc.stage) {
            frappe.throw(__("Please select a Stage"));
        }
        if (!frm.doc.task) {
            frappe.throw(__("Please select a Task"));
        }
        if (!frm.doc.level_sheet_details || !frm.doc.level_sheet_details.length) {
            frappe.throw(__("Please add at least one row in Level Sheet Details"));
        }
        recalculate_average(frm);
    },

    level_sheet_details_add(frm) {
        recalculate_average(frm);
    },

    level_sheet_details_remove(frm) {
        recalculate_average(frm);
    }
});

LEVEL_CHAIN.forEach((fieldname, idx) => {
    frappe.ui.form.on("Task Level Sheet", fieldname, function (frm) {
        clear_from_level(frm, idx + 1);

        if (!frm.doc[fieldname]) {
            frm.set_value(SUBJECT_MAP[fieldname], "");
            refresh_task_levels(frm);
            return;
        }

        frappe.db.get_value("Task", frm.doc[fieldname], "subject").then(r => {
            frm.set_value(SUBJECT_MAP[fieldname], (r.message && r.message.subject) || "");
            refresh_task_levels(frm);
        });
    });
});

frappe.ui.form.on("Task Level Sheet Details", {
    rl(frm) {
        recalculate_average(frm);
    },
    level_sheet_details_remove(frm) {
        recalculate_average(frm);
    }
});


function setup_hierarchy_queries(frm) {
    frm.set_query("stage", function () {
        return {
            filters: {
                project: frm.doc.project,
                custom_is_stage: 1,
                is_group: 1
            }
        };
    });

    Object.keys(SOURCE_MAP).forEach(fieldname => {
        frm.set_query(fieldname, function () {
            let source_field = SOURCE_MAP[fieldname];
            let task_name = frm.doc[source_field];

            if (!task_name) {
                return { filters: { name: ["=", "___invalid___"] } };
            }

            return {
                query: "quantbit_construction_management.ra_billing.doctype.task_level_sheet.task_level_sheet.get_depends_on_tasks",
                filters: { task: task_name }
            };
        });
    });
}

function clear_from_level(frm, start_idx) {
    for (let i = start_idx; i < LEVEL_CHAIN.length; i++) {
        let fieldname = LEVEL_CHAIN[i];
        frm.set_value(fieldname, "");
        frm.set_value(SUBJECT_MAP[fieldname], "");
    }
}

function refresh_task_levels(frm) {
    let visible_level = 3; 

    for (let i = 0; i < LEVEL_CHAIN.length; i++) {
        if (frm.doc[LEVEL_CHAIN[i]]) {
            visible_level = i + 1;
        } else {
            break;
        }
    }
    if (visible_level < 3) visible_level = 3;

    let deepest_field = LEVEL_CHAIN[visible_level - 1];
    let deepest_task  = frm.doc[deepest_field];

    if (!deepest_task) {
        apply_visibility(frm, visible_level);
        return;
    }

    frappe.call({
        method: "quantbit_construction_management.ra_billing.doctype.task_level_sheet.task_level_sheet.has_dependencies",
        args: { task: deepest_task },
        callback: function (r) {
            let final_level = visible_level;
            if (r.message) {
                final_level = Math.min(visible_level + 1, LEVEL_CHAIN.length);
            }
            apply_visibility(frm, final_level);
        }
    });
}

function apply_visibility(frm, visible_level) {
    LEVEL_CHAIN.forEach((fieldname, idx) => {
        let show = idx < 3 ? true : (idx + 1) <= visible_level;
        frm.set_df_property(fieldname, "hidden", show ? 0 : 1);
        frm.set_df_property(SUBJECT_MAP[fieldname], "hidden", show ? 0 : 1);
    });
    frm.refresh_fields();
}

function recalculate_average(frm) {
    let rows = frm.doc.level_sheet_details || [];
    let rl_values = rows
        .filter(row => row.rl !== undefined && row.rl !== null && row.rl !== "")
        .map(row => flt(row.rl));

    let avg = rl_values.length
        ? flt((rl_values.reduce((a, b) => a + b, 0) / rl_values.length).toFixed(3))
        : 0;

    frm.set_value("average", avg);
}