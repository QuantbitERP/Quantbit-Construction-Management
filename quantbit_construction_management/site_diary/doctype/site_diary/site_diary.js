frappe.ui.form.on("Site Diary", {

    refresh(frm) {

        if (!frm.is_new()) return;

        let lat = 16.8524;
        let lon = 74.5815;

        frappe.call({
            method: "quantbit_construction_management.site_diary.doctype.site_diary.site_diary.get_current_weather",
            args: {
                lat: lat,
                lon: lon
            },
            callback: function (r) {

                if (r.message) {

                    let w = r.message;
                    let hour = new Date().getHours();

                    let weather_text = getWeatherText(w.weather_code);

                    if (hour < 12) {
                        frm.set_value("weather_am", weather_text);
                    } else {
                        frm.set_value("weather_pm", weather_text);
                    }

                    frm.set_value("max_temp", w.max_temp);
                    frm.set_value("min_temp", w.min_temp);
                    frm.set_value("wind_speed_kmh", w.wind_speed_kmh);
                }
            }
        });
    },

    setup(frm) {

        frm.set_query("task", "task", function (doc) {

            return {
                filters: {
                    custom_is_stage: 0,
                    is_group: 1,
                    project: doc.project
                }
            };

        });

    },

    after_save(frm) {

        if (!frm.doc.project) return;

        frappe.publish_realtime("project_progress_refresh", {
            project: frm.doc.project
        });

    },

    get_site_diary_details(frm) {

        let unique_tasks = new Map();

        if (!frm.doc.project || !frm.doc.site_date) {

            frappe.msgprint("Please select Project and Site Date");
            return;
        }

        frm.__loading_site_diary = true;

        frm.clear_table("manpower_log");
        frm.clear_table("equipment_log");
        frm.clear_table("material_deliveries");
        frm.clear_table("material_received");
        frm.clear_table("task");
        frm.clear_table("activity_progress");
        frm.clear_table("visitors");

        frm.refresh_fields([
            "manpower_log",
            "equipment_log",
            "material_deliveries",
            "material_received",
            "task",
            "activity_progress",
            "visitors"
        ]);

        // MANPOWER / EQUIPMENT / VISITOR
        let manpowerPromise = new Promise(resolve => {

            frappe.call({
                method: "quantbit_construction_management.site_diary.doctype.site_diary.site_diary.get_site_diary_details",
                args: {
                    project: frm.doc.project,
                    site_date: frm.doc.site_date
                },
                callback: function (r) {
                    if (r.message) {

                        (r.message.manpower || []).forEach(function (d) {

                            if (d.task) {

                                unique_tasks.set(d.task, {
                                    task: d.task
                                });

                            }

                            let row = frm.add_child("manpower_log");

                            row.parent_task = d.task;
                            row.task = d.subtask;
                            row.contractor = d.contractor;
                            row.daily_wages = d.rate;
                            row.total_wage = d.amount;
                            row.item_type = "Man";

                            row.task_level1 = d.task_level1;
                            row.task_level2 = d.task_level2;
                            row.task_level3 = d.task_level3;
                            row.task_level4 = d.task_level4;
                            row.task_level5 = d.task_level5;
                            row.task_level6 = d.task_level6;
                            row.task_level7 = d.task_level7;
                            row.task_level8 = d.task_level8;
                            row.task_level9 = d.task_level9;
                            row.task_level10 = d.task_level10;

                            row.task1_subject = d.level1_subject;
                            row.task2_subject = d.level2_subject;
                            row.task3_subject = d.level3_subject;
                            row.task4_subject = d.level4_subject;
                            row.task5_subject = d.level5_subject;
                            row.task6_subject = d.level6_subject;
                            row.task7_subject = d.level7_subject;
                            row.task8_subject = d.level8_subject;
                            row.task9_subject = d.level9_subject;
                            row.task10_subject = d.level10_subject;

                            if (d.skill_type == "Skilled") {
                                row.skilled = d.quantity;
                            } else {
                                row.unskilled = d.quantity;
                            }

                            frappe.db.get_value(
                                "Item",
                                d.equipment_item,
                                "item_name"
                            ).then(res => {

                                if (res.message) {

                                    row.tradecategory =
                                        res.message.item_name;

                                    frm.refresh_field("manpower_log");
                                }

                            });

                            frappe.db.get_value(
                                "Task",
                                d.task,
                                "subject"
                            ).then(res => {

                                if (res.message) {

                                    row.parent_task_subject =
                                        res.message.subject;

                                    frm.refresh_field("manpower_log");
                                }

                            });

                            frappe.db.get_value(
                                "Task",
                                d.subtask,
                                "subject"
                            ).then(res => {

                                if (res.message) {

                                    row.task_subject =
                                        res.message.subject;

                                    frm.refresh_field("manpower_log");
                                }

                            });

                        });

                        (r.message.equipment || []).forEach(function (d) {

                            if (d.task) {

                                unique_tasks.set(d.task, {
                                    task: d.task
                                });

                            }

                            let row = frm.add_child("equipment_log");
                            row.parent_task = d.task;
                            row.task = d.subtask;
                            row.item = d.equipment_item;
                            row.rate = d.rate;
                            row.total_amount = d.amount;
                            row.quantity = d.quantity;
                            row.contractor = d.contractor;
                            row.working_hours = d.working_hrs;

                            row.task_level1 = d.task_level1;
                            row.task_level2 = d.task_level2;
                            row.task_level3 = d.task_level3;
                            row.task_level4 = d.task_level4;
                            row.task_level5 = d.task_level5;
                            row.task_level6 = d.task_level6;
                            row.task_level7 = d.task_level7;
                            row.task_level8 = d.task_level8;
                            row.task_level9 = d.task_level9;
                            row.task_level10 = d.task_level10;

                            row.task1_subject = d.level1_subject;
                            row.task2_subject = d.level2_subject;
                            row.task3_subject = d.level3_subject;
                            row.task4_subject = d.level4_subject;
                            row.task5_subject = d.level5_subject;
                            row.task6_subject = d.level6_subject;
                            row.task7_subject = d.level7_subject;
                            row.task8_subject = d.level8_subject;
                            row.task9_subject = d.level9_subject;
                            row.task10_subject = d.level10_subject;

                            frappe.db.get_value(
                                "Item",
                                d.equipment_item,
                                "item_name"
                            ).then(res => {

                                if (res.message) {

                                    row.equipment_name =
                                        res.message.item_name;

                                    frm.refresh_field("equipment_log");
                                }

                            });

                            frappe.db.get_value(
                                "Task",
                                d.task,
                                "subject"
                            ).then(res => {

                                if (res.message) {

                                    row.parent_task_subject =
                                        res.message.subject;

                                    frm.refresh_field("equipment_log");
                                }

                            });

                            frappe.db.get_value(
                                "Task",
                                d.subtask,
                                "subject"
                            ).then(res => {

                                if (res.message) {

                                    row.task_subject =
                                        res.message.subject;

                                    frm.refresh_field("equipment_log");
                                }

                            });

                        });


                        (r.message.visitor || []).forEach(function (d) {

                            let row = frm.add_child("visitors");

                            row.visitor_name = d.visitor_name;
                            row.purpose = d.purpose;
                            row.time_in = d.time_in;
                            row.time_out = d.time_out;
                            row.accompanied_by = d.accompanied_by;
                            row.company = d.company;
                            row.safety_inducted = d.safety_inducted;
                            row.notes = d.notes;

                        });

                        frm.refresh_field("manpower_log");
                        frm.refresh_field("equipment_log");
                        frm.refresh_field("visitors");
                    }

                    resolve();
                }
            });

        });

        // MATERIAL RECEIVED
        let receivedPromise = new Promise(resolve => {

            frappe.call({
                method: "quantbit_construction_management.site_diary.doctype.site_diary.site_diary.get_material_received",
                args: {
                    project: frm.doc.project,
                    site_date: frm.doc.site_date
                },
                freeze: true,
                freeze_message: "Fetching Material Received...",
                callback: function (r) {
                    console.log(r);
                    frm.clear_table("material_received");

                    let data = r.message || [];

                    data.forEach(function (d) {

                        let row = frm.add_child("material_received");

                        row.item_code = d.item_code;
                        row.quantity = d.qty;
                        row.uom = d.uom;
                        row.transaction = d.reference_type;
                        row.transaction_type = d.rereference_name;
                        if (d.reference_type == "Purchase Receipt") {
                            row.warehouse = d.warehouse;
                        } else {
                            row.warehouse = d.target_warehouse;
                        }

                        row.rate = d.rate;
                        row.amount = d.amount;

                    });

                    frm.refresh_field("material_received");

                    resolve();
                }
            });

        });
        // MATERIAL DELIVERIES
        let materialDeliveryPromise = new Promise(resolve => {

            frappe.call({
                method: "quantbit_construction_management.site_diary.doctype.site_diary.site_diary.get_material_deliveries",
                args: {
                    project: frm.doc.project,
                    site_date: frm.doc.site_date
                },
                freeze: true,
                freeze_message: "Fetching Material Deliveries...",
                callback: function (r) {
                    frm.clear_table("material_deliveries");

                    let data = r.message || [];

                    data.forEach(function (d) {

                        if (d.task) {

                            unique_tasks.set(d.task, {
                                task: d.task
                            });

                        }

                        let row = frm.add_child("material_deliveries");

                        row.parent_task = d.task;
                        row.task = d.subtask;

                        row.item = d.item_code;
                        row.quantity = d.qty;
                        row.unit = d.uom;
                        row.warehouse = d.s_warehouse;
                        row.item_type = d.item_type;


                        row.task_level1 = d.task_level1;
                        row.task_level2 = d.task_level2;
                        row.task_level3 = d.task_level3;
                        row.task_level4 = d.task_level4;
                        row.task_level5 = d.task_level5;
                        row.task_level6 = d.task_level6;
                        row.task_level7 = d.task_level7;
                        row.task_level8 = d.task_level8;
                        row.task_level9 = d.task_level9;
                        row.task_level10 = d.task_level10;

                        row.task1_subject = d.level1_subject;
                        row.task2_subject = d.level2_subject;
                        row.task3_subject = d.level3_subject;
                        row.task4_subject = d.level4_subject;
                        row.task5_subject = d.level5_subject;
                        row.task6_subject = d.level6_subject;
                        row.task7_subject = d.level7_subject;
                        row.task8_subject = d.level8_subject;
                        row.task9_subject = d.level9_subject;
                        row.task10_subject = d.level10_subject;

                        row.rate =
                            d.basic_rate ||
                            d.valuation_rate ||
                            d.rate ||
                            0;

                        row.amount = d.amount || 0;

                        frappe.db.get_value(
                            "Task",
                            d.task,
                            "subject"
                        ).then(res => {

                            if (res.message) {

                                row.parent_task_subject =
                                    res.message.subject;

                                frm.refresh_field(
                                    "material_deliveries"
                                );
                            }

                        });

                        frappe.db.get_value(
                            "Task",
                            d.subtask,
                            "subject"
                        ).then(res => {

                            if (res.message) {

                                row.task_subject =
                                    res.message.subject;

                                frm.refresh_field(
                                    "material_deliveries"
                                );
                            }

                        });

                    });

                    frm.refresh_field("material_deliveries");

                    resolve();

                }
            });

        });
        // TASK PROGRESS
        let taskProgressPromise = new Promise(resolve => {

            frappe.call({
                method: "quantbit_construction_management.site_diary.doctype.site_diary.site_diary.get_latest_task_progress",
                args: {
                    project: frm.doc.project,
                    site_date: frm.doc.site_date
                },
                freeze: true,
                freeze_message: "Fetching Task Progress...",
                callback(r) {
                    if (r.message) {
                        let data = r.message || [];

                        data.forEach(function (d) {

                            if (d.parent_task) {
                                unique_tasks.set(d.parent_task, {
                                    task: d.parent_task
                                });

                            }
                        });
                        frm.refresh_field("activity_progress");
                    }
                    resolve();
                }
            });

        });
        // FINAL
        Promise.all([
            manpowerPromise,
            receivedPromise,
            materialDeliveryPromise,
            taskProgressPromise
        ]).then(() => {
            // TASK TABLE
            unique_tasks.forEach(function (val) {

                if (val.task) {

                    let row = frm.add_child("task");
                    row.task = val.task;

                    frappe.db.get_value("Task", val.task, "subject").then(r => {
                        if (r.message) {
                            row.task_subject = r.message.subject;
                            frm.refresh_field("task");
                        }
                    });

                }

            });

            frm.refresh_field("task");
            // ACTIVITY PROGRESS
            sync_activity_progress(frm);

            frm.__loading_site_diary = false;

            frappe.msgprint("Data fetched successfully");

        });

    }

});

frappe.ui.form.on("Task Summary", {

    task(frm, cdt, cdn) {

        if (frm.__loading_site_diary) return;
        let row = locals[cdt][cdn];
        if (row.task) {
            frappe.db.get_value("Task", row.task, "subject").then(r => {
                if (r.message) {
                    frappe.model.set_value(cdt, cdn, "task_subject", r.message.subject);
                }
            });
        } else {
            frappe.model.set_value(cdt, cdn, "task_subject", "");
        }

        sync_all_task_tables(frm);
    },

    task_remove(frm) {

        if (frm.__loading_site_diary) return;

        sync_all_task_tables(frm);
    }

});


function sync_all_task_tables(frm) {

    sync_activity_progress(frm);
    sync_bom_tables(frm);

}


function get_selected_parent_tasks(frm) {

    return (frm.doc.task || [])
        .map(r => r.task)
        .filter(Boolean);

}


function sync_activity_progress(frm) {

    if (!frm.doc.task || !frm.doc.task.length) {

        frm.clear_table("activity_progress");
        frm.refresh_field("activity_progress");

        return;
    }
    let existing_keys = new Set();
    frm.clear_table("activity_progress");

    frappe.call({
        method: "quantbit_construction_management.site_diary.doctype.site_diary.site_diary.get_latest_task_progress",
        args: {
            project: frm.doc.project,
            site_date: frm.doc.site_date
        },
        freeze: true,
        freeze_message: "Fetching Task Progress...",
        callback(r) {
            if (r.message) {
                //console.log(r);
                let data = r.message || [];

                data.forEach(function (d) {

                    let key = `${d.parent_task}|${d.task}`;
                    existing_keys.add(key);
                    let row = frm.add_child("activity_progress");

                    row.parent_task = d.parent_task;
                    row.parent_task_subject = d.parent_task_subject;
                    row.task = d.task;
                    row.task_subject = d.task_subject;
                    row.achieved_today = d.achieved_today;
                    row.total_qty = d.total_qty;
                    row.uom = d.uom;
                    row.percent_completed = d.percent_completed;
                    row.total_achieved = d.total_achieved;
                    row.planned_today = d.planned_today;

                    row.task_level1 = d.task_level1;
                    row.task_level2 = d.task_level2;
                    row.task_level3 = d.task_level3;
                    row.task_level4 = d.task_level4;
                    row.task_level5 = d.task_level5;
                    row.task_level6 = d.task_level6;
                    row.task_level7 = d.task_level7;
                    row.task_level8 = d.task_level8;
                    row.task_level9 = d.task_level9;
                    row.task_level10 = d.task_level10;

                    row.task1_subject = d.level1_subject;
                    row.task2_subject = d.level2_subject;
                    row.task3_subject = d.level3_subject;
                    row.task4_subject = d.level4_subject;
                    row.task5_subject = d.level5_subject;
                    row.task6_subject = d.level6_subject;
                    row.task7_subject = d.level7_subject;
                    row.task8_subject = d.level8_subject;
                    row.task9_subject = d.level9_subject;
                    row.task10_subject = d.level10_subject;

                });
                frm.refresh_field("activity_progress");
            }
        }
    });

    frappe.call({
        method: "quantbit_construction_management.site_diary.doctype.site_diary.site_diary.update_daily_activity_progress_table",
        args: {
            doc: frm.doc
        },
        callback(r) {

            if (!r.message) return;

            let new_data =
                r.message.activity_progress || [];

            // merge_child_table(
            //     frm,
            //     "activity_progress",
            //     new_data,
            //     ["parent_task", "task"]
            // );

            new_data.forEach(d => {

                let key = `${d.parent_task}|${d.task}`;
                if (existing_keys.has(key)) return;

                existing_keys.add(key);

                let row = frm.add_child("activity_progress");

                row.parent_task = d.parent_task;
                row.parent_task_subject = d.parent_task_subject;
                row.task = d.task;
                row.task_subject = d.task_subject;
                row.achieved_today = d.achieved_today;
                row.total_qty = d.total_qty;
                row.uom = d.uom;
                row.percent_completed = d.percent_completed;
                row.total_achieved = d.total_achieved;
                row.planned_today = d.planned_today;
            });


            frm.refresh_field("activity_progress");

        }
    });
}


function sync_bom_tables(frm) {

    let tasks = get_selected_parent_tasks(frm);

    if (!tasks.length) {

        frm.clear_table("material_deliveries");
        frm.clear_table("manpower_log");
        frm.clear_table("equipment_log");

        frm.refresh_field("material_deliveries");
        frm.refresh_field("manpower_log");
        frm.refresh_field("equipment_log");

        return;
    }

    frappe.call({
        method: "quantbit_construction_management.site_diary.doctype.site_diary.site_diary.get_multiple_task_bom_details",
        args: {
            tasks: tasks
        },
        callback(r) {

            if (!r.message) return;

            merge_child_table(
                frm,
                "material_deliveries",
                r.message.materials || [],
                ["parent_task", "task", "item"]
            );

            merge_child_table(
                frm,
                "manpower_log",
                r.message.manpower || [],
                ["parent_task", "task", "tradecategory"]
            );

            merge_child_table(
                frm,
                "equipment_log",
                r.message.equipment || [],
                ["parent_task", "task", "item"]
            );

            frm.refresh_field("material_deliveries");
            frm.refresh_field("manpower_log");
            frm.refresh_field("equipment_log");

        }
    });

}


function merge_child_table(
    frm,
    table_field,
    new_data,
    key_fields
) {

    let existing = frm.doc[table_field] || [];

    let new_keys = new Set(
        new_data.map(row => make_key(row, key_fields))
    );

    let old_rows_by_key = {};

    existing.forEach(row => {

        let key = make_key(row, key_fields);

        if (new_keys.has(key)) {
            old_rows_by_key[key] = row;
        }

    });

    frm.clear_table(table_field);

    new_data.forEach(new_row => {

        let key = make_key(new_row, key_fields);

        let old_row = old_rows_by_key[key] || {};

        let child = frm.add_child(table_field);

        Object.keys(new_row).forEach(field => {
            child[field] = new_row[field];
        });

        Object.keys(old_row).forEach(field => {

            if (
                ![
                    "name",
                    "idx",
                    "doctype",
                    "parent",
                    "parenttype",
                    "parentfield"
                ].includes(field)
                &&
                old_row[field]
                &&
                !child[field]
            ) {

                child[field] = old_row[field];

            }

        });

    });

}


function make_key(row, fields) {

    return fields
        .map(f => row[f] || "")
        .join("||");

}

frappe.ui.form.on("DPR Activity Progress", {

    achieved_today(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        // total_achieved = previous total + today's achieved
        let previous_total = row.previous_total_achieved || 0;
        let achieved_today = row.achieved_today || 0;

        let new_total = previous_total + achieved_today;
        let total_qty = row.total_qty || 0;

        let percent = total_qty > 0
            ? (new_total / total_qty) * 100
            : 0;

        frappe.model.set_value(cdt, cdn, "total_achieved", new_total);
        frappe.model.set_value(cdt, cdn, "percent_completed", percent);
    },

    total_qty(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        let total_achieved = row.total_achieved || 0;
        let total_qty = row.total_qty || 0;

        let percent = total_qty > 0
            ? (total_achieved / total_qty) * 100
            : 0;

        frappe.model.set_value(cdt, cdn, "percent_completed", percent);
    }

});