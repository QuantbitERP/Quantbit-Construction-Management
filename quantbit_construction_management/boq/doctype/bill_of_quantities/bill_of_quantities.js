function getChildren(all_tasks, parent_name) {
    return all_tasks.filter(
        t => t.parent_task === parent_name
    );
}

function getLeafSubtasks(all_tasks, parent_name) {

    let result = [];

    let children = getChildren(
        all_tasks,
        parent_name
    );

    children.forEach(child => {

        let childChildren =
            getChildren(all_tasks, child.name);

        if (
            child.custom_is_subtask == 1 &&
            !childChildren.length
        ) {

            result.push(child);

        } else {

            result.push(
                ...getLeafSubtasks(
                    all_tasks,
                    child.name
                )
            );
        }

    });

    return result;
}
function getHierarchyPath(all_tasks, task_name) {

    let path = [];

    let current = all_tasks.find(
        t => t.name === task_name
    );

    while (current) {

        path.unshift(current.subject);

        current = all_tasks.find(
            t => t.name === current.parent_task
        );
    }

    return path.join(" > ");
}
frappe.ui.form.on("Bill of Quantities", {
    before_submit: async function (frm) {

        let all_tasks = await frappe.db.get_list("Task", {
            filters: {
                custom_boq_name: frm.doc.name
            },
            fields: [
                "name",
                "subject",
                "parent_task",
                "custom_is_stage",
                "custom_is_task",
                "custom_is_subtask",
                "creation"
            ],
            order_by: "creation asc",
            limit: 1000
        });
        let hierarchy_errors = [];

        all_tasks.forEach(node => {

            let children = all_tasks.filter(
                t => t.parent_task === node.name
            );

            // LEAF NODE
            if (!children.length) {

                // LAST NODE MUST BE SUBTASK
                if (node.custom_is_subtask != 1) {

                    hierarchy_errors.push(`
                <div style="
                    padding:12px;
                    margin-bottom:10px;
                    background:#fff5f5;
                    border-left:4px solid #dc2626;
                ">
                    <b>Invalid Hierarchy</b><br>

                    ${getHierarchyPath(
                        all_tasks,
                        node.name
                    )}

                    <br><br>

                    Last node
                    <b>${node.subject}</b>

                    has no
                    Subtask.
                </div>
            `);

                    return;
                }

                // CHECK BOQ ITEM
                let boq_items =
                    (frm.doc.boq_items || []).filter(row => {

                        return (
                            row.subtask === node.name ||

                            row.task_level1 === node.name ||
                            row.task_level2 === node.name ||
                            row.task_level3 === node.name ||
                            row.task_level4 === node.name ||
                            row.task_level5 === node.name ||
                            row.task_level6 === node.name ||
                            row.task_level7 === node.name ||
                            row.task_level8 === node.name ||
                            row.task_level9 === node.name ||
                            row.task_level10 === node.name
                        );

                    });

                if (!boq_items.length) {

                    hierarchy_errors.push(`
                <div style="
                    padding:12px;
                    margin-bottom:10px;
                    background:#fff7ed;
                    border-left:4px solid #ea580c;
                ">
                    <b>BOQ Item Missing</b><br>

                    ${getHierarchyPath(
                        all_tasks,
                        node.name
                    )}
                </div>
            `);

                }
            }

        });

        if (!all_tasks.length) {
            frappe.throw(__("No Stages found."));
        }

        let errors = [];

        // STAGES
        let stages = all_tasks.filter(d => d.custom_is_stage == 1);

        stages.forEach((stage, stage_index) => {

            // TASKS UNDER STAGE
            let tasks = all_tasks.filter(d =>
                d.parent_task === stage.name &&
                d.custom_is_task == 1
            );

            // TASK LOOP
            tasks.forEach((task, task_index) => {

                let leafSubtasks =
                    getLeafSubtasks(
                        all_tasks,
                        task.name
                    );

                leafSubtasks.forEach((subtask, subtask_index) => {
                    // BOQ ITEMS OF SUBTASK
                    let boq_items = (frm.doc.boq_items || []).filter(row => {

                        return (
                            row.subtask === subtask.name ||

                            row.task_level1 === subtask.name ||
                            row.task_level2 === subtask.name ||
                            row.task_level3 === subtask.name ||
                            row.task_level4 === subtask.name ||
                            row.task_level5 === subtask.name ||
                            row.task_level6 === subtask.name ||
                            row.task_level7 === subtask.name ||
                            row.task_level8 === subtask.name ||
                            row.task_level9 === subtask.name ||
                            row.task_level10 === subtask.name
                        );

                    });

                    // NO BOQ ITEMS
                    if (!boq_items.length) {

                        errors.push(`

                        <div style="
                            margin-bottom:12px;
                            padding:14px 16px;
                            border-radius:10px;
                            background:#fff5f5;
                            border-left:4px solid #dc2626;
                        ">

                            <div style="
                                display:flex;
                                flex-wrap:wrap;
                                gap:8px;
                                margin-bottom:12px;
                            ">

                                <span style="
                                    background:#2563eb;
                                    color:white;
                                    padding:4px 10px;
                                    border-radius:20px;
                                    font-size:12px;
                                    font-weight:600;
                                ">
                                    Stage ${stage_index + 1}
                                </span>

                                <span style="
                                    background:#7c3aed;
                                    color:white;
                                    padding:4px 10px;
                                    border-radius:20px;
                                    font-size:12px;
                                    font-weight:600;
                                ">
                                    Task ${task_index + 1}
                                </span>

                                <span style="
                                    background:#dc2626;
                                    color:white;
                                    padding:4px 10px;
                                    border-radius:20px;
                                    font-size:12px;
                                    font-weight:600;
                                ">
                                    Subtask ${subtask_index + 1}
                                </span>

                            </div>

                            <div style="line-height:1.9;font-size:14px;">

                                <div>
                                    <span style="color:#6b7280;">Stage :</span>
                                    <b>${stage.subject}</b>
                                </div>

                                <div>
                                    <span style="color:#6b7280;">Task :</span>
                                    <b>${task.subject}</b>
                                </div>

                                <div>
                                    <span style="color:#6b7280;">Subtask :</span>
                                    <b>${subtask.subject}</b>
                                </div>

                            </div>

                            <div style="
                                margin-top:12px;
                                color:#dc2626;
                                font-size:13px;
                                font-weight:700;
                            ">
                                ⚠ BOQ Item not created
                            </div>

                        </div>

                    `);

                    }

                });

            });

        });
        // HIERARCHY VALIDATION THROW
        if (hierarchy_errors.length) {

            frappe.throw({
                title: __("Hierarchy Validation Failed"),
                message: `
            <div style="
                max-height:500px;
                overflow:auto;
            ">
                ${hierarchy_errors.join("")}
            </div>
        `
            });

        }

        // EXISTING VALIDATION THROW
        if (errors.length) {

            frappe.throw({
                title: __("BOQ Hierarchy Validation Failed"),
                message: `
            ...
        `
            });

        }

    },

    refresh(frm) {
        if (
            frm.doc.import_file &&
            (frm.doc.tasks_details || []).length
        ) {

            frm.set_df_property("import_file", "read_only", 1);

            setTimeout(() => {

                frm.fields_dict.import_file.$wrapper
                    .find('[data-action="clear_attachment"]')
                    .hide();

                frm.fields_dict.import_file.$wrapper
                    .find(".close")
                    .hide();

                frm.fields_dict.import_file.$wrapper
                    .find(".attached-file .btn")
                    .hide();

            }, 500);
        }

        if (!frm.doc.document_type) {
            frm.set_value("document_type", "Task");
        }
        if (!frm.doc.import_type) {
            frm.set_value("import_type", "Insert New Records");
        }
        render_combined_boq(frm);

        // if (frm.doc.import_file && frm.doc.docstatus !== 1) 
        let has_imported_tasks =
            (frm.doc.tasks_details || []).length > 0;

        if (
            frm.doc.import_file &&
            !has_imported_tasks &&
            frm.doc.docstatus !== 1
        ) {

            frm.add_custom_button(__("Import Tasks"), () => {
                frappe.call({
                    method: "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.import_boq_tasks",
                    args: {
                        file_url: frm.doc.import_file,
                        boq_name: frm.doc.name
                    },
                    freeze: true,
                    freeze_message: __("Importing Tasks hierarchically..."),
                    callback: function (r) {
                        if (!r.exc) {

                            frappe.show_alert({
                                message: __("Tasks imported successfully."),
                                indicator: "green"
                            });

                            // MARK IMPORTED
                            frm.import_completed = true;

                            // REMOVE BUTTON
                            frm.remove_custom_button(__("Import Tasks"));

                            // READONLY ATTACH
                            frm.set_df_property("import_file", "read_only", 1);

                            // HIDE CLEAR BUTTON
                            setTimeout(() => {

                                // HIDE CLEAR BUTTON
                                frm.fields_dict.import_file.$wrapper
                                    .find('[data-action="clear_attachment"]')
                                    .hide();

                                // HIDE REMOVE ICON
                                frm.fields_dict.import_file.$wrapper
                                    .find(".close")
                                    .hide();

                                // HIDE CLEAR TEXT
                                frm.fields_dict.import_file.$wrapper
                                    .find(".attached-file .btn")
                                    .hide();

                            }, 500);

                            // RELOAD DOC
                            frm.reload_doc();
                        }
                    }
                });
            }).addClass("btn-primary");
        }

        frm.fields_dict["tasks_details"].grid.update_docfield_property(
            "task",
            "only_select",
            1
        );

        frm.set_query("task", "tasks_details", function () {
            return {
                filters: {
                    custom_boq_name: frm.doc.name,
                    custom_is_task: 1
                }
            };
        });

        // Display human-readable Subjects instead of raw Task IDs in the grid columns
        frm.fields_dict.boq_items.grid.get_docfield("task").formatter = function (value, df, active_doc, row) {
            if (!value) return "";
            let task_row = (frm.doc.tasks_details || []).find(d => d.task === value);
            if (task_row && task_row.task_subject) {
                return task_row.task_subject;
            }
            return value;
        };

        frm.fields_dict.boq_items.grid.get_docfield("subtask").formatter = function (value, df, active_doc, row) {
            if (!value) return "";
            if (active_doc && active_doc.subtask_name) {
                return active_doc.subtask_name;
            }
            return value;
        };

        sync_tasks_details(frm);
    },

    import_file(frm) {
        let imported_already =
            (frm.doc.tasks_details || []).length > 0;
        // FILE UPLOADED
        if (frm.doc.import_file) {

            frm.set_df_property("import_file", "read_only", 0);

            frm.trigger("refresh");

            return;
        }

        // FILE CLEARED
        if (
            !frm.doc.import_file &&
            (frm.doc.tasks_details || []).length
        ) {

            frappe.confirm(

                __("Remove imported tasks and BOQ items?"),

                function () {

                    frappe.call({

                        method: "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.delete_boq_tasks",

                        args: {
                            boq_name: frm.doc.name
                        },

                        callback: function () {

                            frm.clear_table("tasks_details");
                            frm.clear_table("boq_items");

                            frm.refresh_field("tasks_details");
                            frm.refresh_field("boq_items");

                            load_hierarchy(frm);

                            frappe.show_alert({
                                message: __("Imported tasks removed"),
                                indicator: "red"
                            });

                            frm.refresh();
                        }
                    });

                }
            );
        }
    },

    download_template: function (frm) {
        open_url_post("/api/method/quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.download_boq_task_template", {});
    }
});

async function remove_boq_items_for_task(frm, task_name_or_id) {
    if (!task_name_or_id) return;

    let i = (frm.doc.boq_items || []).length;
    while (i--) {
        if (frm.doc.boq_items[i].task === task_name_or_id) {
            let item = frm.doc.boq_items.splice(i, 1)[0];
            frappe.model.clear_doc("BOQ Item", item.name);
        }
    }

    frm.refresh_field("boq_items");

    frappe.show_alert({
        message: __("BOQ items removed for task: {0}", [task_name_or_id]),
        indicator: "orange"
    }, 4);
}

frappe.ui.form.on("BOQ Task Details", {

    async task(frm, cdt, cdn) {

        const row = locals[cdt][cdn];

        if (!row.task) {
            await remove_boq_items_for_task(frm, row._prev_task);
            row._prev_task = null;
            return;
        }

        // task_subject is auto-fetched via fetch_from: task.subject
        const is_duplicate = (frm.doc.tasks_details || []).some(
            r => r.task === row.task && r.name !== row.name
        );

        if (is_duplicate) {

            const task_doc = await frappe.db.get_doc("Task", row.task);

            frappe.model.set_value(cdt, cdn, "task", "");

            frappe.msgprint({
                title: __("Duplicate Task"),
                message: __("Task <b>{0}</b> is already added.", [task_doc.subject]),
                indicator: "red"
            });

            return;
        }

        if (row._prev_task && row._prev_task !== row.task) {
            await remove_boq_items_for_task(frm, row._prev_task);
        }

        row._prev_task = row.task;
        fetch_items_for_task(frm, row);
    },
});

async function fetch_items_for_task(frm, row) {
    if (!row.task) return;

    return new Promise((resolve, reject) => {
        frappe.call({
            method: "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.get_boq_items_from_task",
            args: { task_name: row.task },
            freeze: true,
            freeze_message: __("Loading BOQ items..."),
            callback: async function (r) {
                if (r.exc) {
                    frappe.msgprint(__("Error loading items. Check console for details."));
                    reject();
                    return;
                }
                const items = r.message || [];
                if (!items.length) {
                    frappe.show_alert({
                        message: __("No subtask BOM items found for this task."),
                        indicator: "orange"
                    }, 5);
                    resolve();
                    return;
                }
                for (let d of items) {
                    //check existing rows
                    const exists = (frm.doc.boq_items || []).some(R =>
                        R.task === d.task &&
                        R.subtask === d.subtask &&
                        R.item_code === d.item_code
                    );
                    if (exists) continue;

                    const child = frm.add_child("boq_items");
                    Object.assign(child, d);
                    // await frappe.model.set_value(child.doctype, child.name, d);
                }
                frm.refresh_field("boq_items");
                frappe.show_alert({
                    message: __("{0} item(s) added from task: {1}", [items.length, row.task_subject || row.task]),
                    indicator: "green"
                });
                resolve();
            }
        });
    });
}

frappe.ui.form.on("BOQ Item", {

    internal_qty: function (frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "internal_amount", (row.internal_qty || 0) * (row.internal_rate || 0));
    },

    internal_rate: function (frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "internal_amount", (row.internal_qty || 0) * (row.internal_rate || 0));
    },

    actual_qty: function (frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "actual_amount", (row.actual_qty || 0) * (row.actual_rate || 0));
    },

    actual_rate: function (frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "actual_amount", (row.actual_qty || 0) * (row.actual_rate || 0));
    }

});

function render_combined_boq(frm) {

    let boq_items = frm.doc.boq_items || [];

    if (!boq_items.length) {
        frm.fields_dict.combined_boq_details.$wrapper.html(
            `<div class="text-muted">No BOQ Items Found</div>`
        );
        return;
    }
    let grouped = {};
    boq_items.forEach(row => {
        if (!grouped[row.item_type]) grouped[row.item_type] = [];
        grouped[row.item_type].push(row);
    });

    let html = ``;

    Object.keys(grouped).forEach(item_type => {

        let items = grouped[item_type];
        let group_total = 0;

        html += `
            <div style="margin-bottom:20px;border:1px solid #d1d8dd;border-radius:8px;overflow:hidden;">
                <div style="background:#f7fafc;padding:12px;font-weight:bold;font-size:16px;border-bottom:1px solid #d1d8dd;">
                    ${item_type}
                </div>
                <table class="table table-bordered" style="margin-bottom:0;">
                    <thead>
                        <tr>
                            <th>Task</th><th>Subtask</th><th>Item</th>
                            <th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        items.forEach(row => {
            group_total += row.amount || 0;
            html += `
                <tr>
                    <td>${row.task || ""}</td>
                    <td>${row.subtask || ""}</td>
                    <td>${row.item_code || ""}</td>
                    <td>${row.quantity || 0}</td>
                    <td>${row.unit || ""}</td>
                    <td>₹ ${format_currency(row.unit_rate || 0)}</td>
                    <td>₹ ${format_currency(row.amount || 0)}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
                <div style="padding:10px;text-align:right;font-weight:bold;background:#fcfcfc;border-top:1px solid #d1d8dd;">
                    Group Total : ₹ ${format_currency(group_total)}
                </div>
            </div>
        `;
    });

    frm.fields_dict.combined_boq_details.$wrapper.html(html);
}

window.expanded_nodes = window.expanded_nodes || new Set();

frappe.ui.form.on('Bill of Quantities', {
    refresh: function (frm) {
        inject_hierarchy_css();
        if (frm.doc.name && typeof load_hierarchy === "function") {
            load_hierarchy(frm);
        }

        for (let i = 1; i <= 10; i++) {

            let has_data = (frm.doc.boq_items || []).some(
                r => r[`task_level${i}`]
            );

            frm.fields_dict.boq_items.grid.toggle_display(
                `task_level${i}`,
                has_data
            );
        }

        if (frm.doc.docstatus === 1) {
            // Project option — only if no project linked yet
            if (!frm.doc.project) {
                frm.add_custom_button(__("Project"), () => {
                    frappe.prompt([
                        {
                            label: __("Project Name"),
                            fieldname: "project_name",
                            fieldtype: "Data",
                            reqd: 1
                        },
                        {
                            label: __("Site Name"),
                            fieldname: "site_name",
                            fieldtype: "Link",
                            options: "Site",
                            reqd: 1
                        }
                    ], function (values) {
                        frappe.call({
                            method: "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.create_project_from_boq",
                            args: {
                                boq_name: frm.doc.name,
                                project_name: values.project_name,
                                site_name: values.site_name
                            },
                            freeze: true,
                            freeze_message: __("Creating Project..."),
                            callback: function (r) {
                                if (r.message) {
                                    frappe.msgprint({
                                        title: __("Project Created"),
                                        message: __("Project <a href='/app/project/{0}'><b>{0}</b></a> has been created and linked successfully.", [r.message]),
                                        indicator: "green"
                                    });
                                    frm.set_value("project", r.message);
                                    frm.reload_doc();
                                }
                            }
                        });
                    }, __("Create Project"), __("Create"));
                }, __("Create"));
            }

            // Site option — opens a simple prompt popup to create a Site
            frm.add_custom_button(__("Site"), () => {
                frappe.prompt([
                    {
                        label: __("Site Name"),
                        fieldname: "site_name",
                        fieldtype: "Data",
                        reqd: 1
                    }
                ], function (values) {
                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                doctype: "Site",
                                site_name: values.site_name
                            }
                        },
                        freeze: true,
                        freeze_message: __("Creating Site..."),
                        callback: function (r) {
                            if (r.message) {
                                frappe.msgprint({
                                    title: __("Site Created"),
                                    message: __("Site <a href='/app/site/{0}'><b>{0}</b></a> has been created successfully.", [r.message.name]),
                                    indicator: "green"
                                });
                            }
                        }
                    });
                }, __("Create New Site"), __("Create"));
            }, __("Create"));

            // Duplicate BOQ option
            frm.add_custom_button(__("Duplicate BOQ"), () => {
                frappe.confirm(
                    __("This will duplicate the BOQ along with all its tasks. Continue?"),
                    function () {
                        frappe.call({
                            method: "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.duplicate_boq",
                            args: {
                                boq_name: frm.doc.name
                            },
                            freeze: true,
                            freeze_message: __("Duplicating BOQ..."),
                            callback: function (r) {
                                if (r.message) {
                                    frappe.msgprint({
                                        title: __("BOQ Duplicated"),
                                        message: __("BOQ <a href='/app/bill-of-quantities/{0}'><b>{0}</b></a> has been created successfully.", [r.message]),
                                        indicator: "green"
                                    });
                                }
                            }
                        });
                    }
                );
            }, __("Create"));
        }
    }
});

frappe.realtime.on("project_progress_refresh", (data) => {

    if (!cur_frm || cur_frm.doc.doctype !== "Bill of Quantities") return;

    if (cur_frm.doc.name === data.project) {


        load_hierarchy(cur_frm);
    }
});

function inject_hierarchy_css() {
    const css = `
        .hierarchy-row { position: relative; transition: all 0.2s ease; cursor: pointer; margin-bottom: 5px; }
        .hierarchy-row:hover { filter: brightness(0.95); transform: translateX(5px); }
        .hover-details {
            display: none; position: absolute; top: -10px; left: 50%;
            transform: translateX(-50%) translateY(-100%); background: #2d3436;
            color: #fff; padding: 10px 15px; border-radius: 8px; font-size: 12px;
            width: 250px; z-index: 100; box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            pointer-events: none;
        }
        .hierarchy-row:hover .hover-details { display: block; }
        .toggle-icon { margin-right: 8px; font-weight: bold; cursor: pointer; width: 15px; display: inline-block; text-align: center; }
        .detail-label { color: #bdc3c7; font-weight: bold; margin-right: 5px; }
        .hierarchy-controls { margin-bottom: 15px; display: flex; gap: 10px; justify-content: flex-end; }
        .weight-warning { color: #e74c3c; font-weight: 600; margin-top: 5px; }
    `;
    frappe.dom.set_style(css, 'project-hierarchy-style');
}

function validate_total_weight(frm, new_weight, exclude_task = null) {
    return frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Task",
            filters: {
                custom_boq_name: frm.doc.name,
                custom_is_task: 1,

            },
            fields: ["task_weight"]
        }
    }).then(r => {
        if (!r.message) return { valid: true };

        let current_total = 0;
        r.message.forEach(task => {
            if (task.name !== exclude_task) {
                current_total += flt(task.task_weight || 0);
            }
        });

        let projected_total = current_total + flt(new_weight || 0);

        return {
            valid: projected_total <= 100,
            current_total: current_total,
            projected_total: projected_total,
            remaining: 100 - current_total
        };
    });
}

function validate_task_weight(frm, stage_name, new_weight, exclude_task = null) {
    return frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Task",
            filters: {
                custom_boq_name: frm.doc.name,
                parent_task: stage_name,
                custom_is_task: 1
            },
            fields: ["task_weight"]
        }
    }).then(r => {
        if (!r.message) return { valid: true };

        let current_total = 0;
        r.message.forEach(task => {
            if (task.name !== exclude_task) {
                current_total += flt(task.task_weight || 0);
            }
        });

        let projected_total = current_total + flt(new_weight || 0);

        return {
            valid: projected_total <= 100,
            current_total: current_total,
            projected_total: projected_total,
            remaining: 100 - current_total
        };
    });
}

function validate_subtask_weight(frm, task_name, new_weight, exclude_task = null) {
    return frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Task",
            filters: {
                custom_boq_name: frm.doc.name,
                parent_task: task_name,
                custom_is_subtask: 1
            },
            fields: ["task_weight"]
        }
    }).then(r => {
        if (!r.message) return { valid: true };

        let current_total = 0;
        r.message.forEach(task => {
            if (task.name !== exclude_task) {
                current_total += flt(task.task_weight || 0);
            }
        });

        let projected_total = current_total + flt(new_weight || 0);

        return {
            valid: projected_total <= 100,
            current_total: current_total,
            projected_total: projected_total,
            remaining: 100 - current_total
        };
    });
}

function load_hierarchy(frm) {
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Task",
            filters: {
                custom_boq_name: frm.doc.name

            },
            fields: [
                "name", "subject", "parent_task", "status", "priority",
                "description", "task_weight", "custom_is_stage",
                "custom_is_task", "custom_is_subtask", "expected_time", "exp_end_date", "progress"
            ],
            order_by: "creation asc",
            limit_page_length: 1000
        },
        callback: function (r) {
            if (!r.message) return;
            const tasks = r.message;
            window.current_hierarchy_tasks = tasks;
            let taskMap = {};
            tasks.forEach(t => taskMap[t.name] = t);

            let stages = {};
            tasks.forEach(t => {
                if (t.custom_is_stage == 1 || !t.parent_task) {
                    stages[t.name] = { data: t, tasks: [] };
                }
            });

            tasks.forEach(t => {
                if (!t.parent_task) return;
                let parent = taskMap[t.parent_task];
                if (parent && (t.custom_is_task == 1 || parent.parent_task)) {
                    if (stages[parent.name]) stages[parent.name].tasks.push({ data: t, subtasks: [] });
                }
            });
            Object.values(stages).forEach(stage => {
                stage.tasks.forEach(taskObj => {
                    tasks.forEach(t => {
                        if (
                            t.parent_task === taskObj.data.name &&
                            (
                                t.custom_is_subtask == 1 ||
                                t.custom_is_task == 1
                            )
                        ) {
                            taskObj.subtasks.push(t);
                        }
                    });
                });
            });
            function renderChildren(parentName, depth) {

                let children = tasks.filter(
                    t => t.parent_task === parentName
                );

                children.forEach(child => {

                    let child_type =
                        child.custom_is_subtask == 1
                            ? "subtask"
                            : "task";

                    let expanded =
                        expanded_nodes.has(child.name);

                    html += render_row(
                        child,
                        child_type,
                        expanded,
                        depth
                    );

                    if (expanded) {
                        renderChildren(
                            child.name,
                            depth + 1
                        );
                    }

                });

                if (children.length > 0) {
                    children.forEach(child => {
                        html += render_total_row(
                            child.subject,
                            flt(child.task_weight || 0).toFixed(2),
                            (depth * 35) + 28
                        );
                    });
                }
            }

            let html = `<div style="padding:15px;">
        <div class="hierarchy-controls">
          <button class="btn btn-default btn-xs expand-all">Expand All</button>
          <button class="btn btn-default btn-xs collapse-all">Collapse All</button>
          <button class="btn btn-primary btn-xs add-stage">+ Add Stage</button>
        </div>`;

            let overall_stage_total = 0;

            Object.values(stages).forEach(stageObj => {
                let stage_progress = 0;
                stageObj.tasks.forEach(taskObj => {
                    let progress = taskObj.data.progress || 0;
                    let weight = taskObj.data.task_weight || 0;
                    stage_progress += (progress * weight) / 100;
                });
                overall_stage_total += flt(stageObj.data.task_weight || 0);

                const is_stage_expanded = expanded_nodes.has(stageObj.data.name);
                html += render_row(stageObj.data, "stage", is_stage_expanded, 0);

                if (is_stage_expanded) {
                    stageObj.tasks.forEach(taskObj => {
                        let subtask_total = 0;
                        taskObj.subtasks.forEach(sub => {
                            subtask_total += flt(sub.task_weight || 0);
                        });

                        const is_task_expanded = expanded_nodes.has(taskObj.data.name);
                        html += render_row(taskObj.data, "task", is_task_expanded, 1);

                        if (is_task_expanded) {

                            taskObj.subtasks.forEach(sub => {

                                let row_type =
                                    sub.custom_is_task == 1
                                        ? "task"
                                        : "subtask";

                                let is_child_expanded =
                                    expanded_nodes.has(sub.name);

                                html += render_row(
                                    sub,
                                    row_type,
                                    is_child_expanded,
                                    2
                                );
                                // CHILD OF CHILD TASK
                                if (is_child_expanded) {

                                    renderChildren(
                                        sub.name,
                                        3
                                    );

                                }

                            });

                            taskObj.subtasks.forEach(sub => {
                                html += render_total_row(
                                    sub.subject,
                                    flt(sub.task_weight || 0).toFixed(2),
                                    98
                                );
                            });
                        }
                    });


                    let task_weight_sum = 0;
                    stageObj.tasks.forEach(tObj => {
                        task_weight_sum += flt(tObj.data.task_weight || 0);
                    });
                    stageObj.tasks.forEach(tObj => {
                        html += render_total_row(
                            tObj.data.subject,
                            flt(tObj.data.task_weight || 0).toFixed(2),
                            63
                        );
                    });
                }
            });


            Object.values(stages).forEach(stageObj => {
                html += render_total_row(
                    stageObj.data.subject,
                    flt(stageObj.data.task_weight || 0).toFixed(2),
                    0
                );
            });

            html += "</div>";
            frm.fields_dict.task_hierarchy.$wrapper.html(html);
            attach_events(frm, tasks);
        }
    });
}

function calculate_project_progress(tasks) {

    let total = 0;

    let count = 0;

    tasks.forEach(t => {

        if (t.custom_is_stage) {

            total += flt(t.progress || 0);

            count++;

        }

    });

    return count ? (total / count).toFixed(2) : 0;

}
function get_descendant_count(all_tasks, task_name) {

    let children = all_tasks.filter(
        t => t.parent_task === task_name
    );

    let count = 0;

    children.forEach(child => {

        count += 1;

        count += get_descendant_count(
            all_tasks,
            child.name
        );

    });

    return count;
}

function render_row(item, type, is_expanded, depth = 0) {
    //let margin = type === "stage" ? "0px" : (type === "task" ? "25px" : "60px");
    let margin = (depth * 35) + "px";
    let bg = type === "stage" ? "#1a365d" : (type === "task" ? "#e9c46a" : "#fdf6e3");
    let color = type === "stage" ? "white" : "#333";
    let btnClass = type === "stage" ? "btn-light" : "btn-default";

    // Icon logic
    let icon = "";
    if (type !== "subtask") {
        icon = is_expanded ? "▼" : "▶";
    }
    let progress = flt(item.progress || 0);
    let descendant_count = get_descendant_count(
        window.current_hierarchy_tasks || [],
        item.name
    );
    let descendant_btn = "";
    if (
        type !== "subtask" &&
        descendant_count > 0
    ) {
        descendant_btn = `
            <button class="btn btn-info btn-xs"
                title="Descendant Count">
                ${descendant_count}
            </button>
        `;
    }
    let progress_bar = `
    <div style="margin-top:6px;width:150px;background:#eee;border-radius:6px;height:6px;">
    <div style="width:${progress}%;background:#27ae60;height:6px;border-radius:6px;"></div>
    </div>
    `;
    return `
    <div class="hierarchy-row" data-name="${item.name}" data-type="${type}" style="margin-left:${margin}; margin-top:10px; padding:12px; background:${bg}; color:${color}; border-radius:8px; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">    
      <div class="hover-details">
         <div style="border-bottom: 1px solid #444; margin-bottom: 5px; font-weight: bold; padding-bottom: 3px;">${item.name}</div>
         <div><span class="detail-label">Status:</span> ${item.status || 'Open'}</div>
         <div><span class="detail-label">Priority:</span> ${item.priority || 'Medium'}</div>
         <div><span class="detail-label">Weight:</span> ${item.task_weight || 0}</div>
         <div><span class="detail-label">Progress %:</span>${progress.toFixed(2)}</div>
         <div style="margin-top:5px; font-style: italic; color: #ecf0f1;">${item.description || 'No description provided.'}</div>
      </div>

      <div class="toggle-node" style="display:flex; align-items:center; flex-grow:1;">
        <span class="toggle-icon">${icon}</span>
        <div>
          <div style="font-weight:600; font-size:${type === 'stage' ? '16px' : '14px'};">${item.subject}</div>
          <div style="font-size:11px; opacity:0.7;">${item.name}</div>
           ${progress_bar}
        </div>
      </div>

    <div style="display:flex; gap:5px; align-items:center;">
          <button class="btn btn-success btn-xs">
             ${progress.toFixed(2)}%
           </button>
    
           <button class="btn ${btnClass} btn-xs redirect-item"
                data-name="${item.name}"
                title="Open Form View"
                ${cur_frm.doc.docstatus == 1 ? "disabled" : ""}>
                Show Details
            </button>

            <button class="btn ${btnClass} btn-xs edit-item"
                data-name="${item.name}"
                ${cur_frm.doc.docstatus == 1 ? "disabled" : ""}>
                ✏ Edit
            </button>

            <button class="btn ${btnClass} btn-xs assign-item"
                data-name="${item.name}"
                ${cur_frm.doc.docstatus == 1 ? "disabled" : ""}>
                👤 Assign
            </button>

            <button class="btn ${btnClass} btn-xs delete-item"
                data-name="${item.name}"
                ${cur_frm.doc.docstatus == 1 ? "disabled" : ""}>
                🗑 Delete
            </button>

            ${type === "subtask"
            ? `<button class="btn btn-light btn-xs show-bom"
                    data-name="${item.name}"
                    ${cur_frm.doc.docstatus == 1 ? "disabled" : ""}>
                    📦 BOQ Item
                </button>`
            : ""}

            ${type === "stage"
            ? `<button class="btn btn-light btn-xs add-task"
                    data-stage="${item.name}"
                    ${cur_frm.doc.docstatus == 1 ? "disabled" : ""}>
                    + Task
                </button>`
            : ""}

            ${type === "task"
            ? `
                 <button class="btn btn-default btn-xs add-child-task"
                    data-parent="${item.name}"
                    ${cur_frm.doc.docstatus == 1 ? "disabled" : ""}>
                    + Child Task
                </button>
                <button class="btn btn-default btn-xs add-subtask"
                    data-task="${item.name}"
                    ${cur_frm.doc.docstatus == 1 ? "disabled" : ""}>
                    + Subtask
                </button>`
            : ""}
            ${descendant_btn}
            <button class="btn btn-warning btn-xs show-weight"
                data-name="${item.name}"
                title="Weight">
                ${item.task_weight || 0}%
            </button>
      </div>
    </div>`;

}

function render_total_row(label, total, margin_left) {
    let bg_color = "#fb8c00";
    if (total > 100) bg_color = "#c0392b";
    else if (total >= 100) bg_color = "#2ecc71";
    else if (total > 70) bg_color = "#27ae60";
    else if (total > 30) bg_color = "#f1c40f";

    return `
    <div style="
        margin-left:${margin_left}px;
        margin-top:10px;
        display:flex;
        justify-content:flex-end;
        align-items:center;
        gap:10px;
        font-weight:600;">

        <div>${label} :</div>

        <div style="
            background:${bg_color};
            color:white;
            padding:4px 10px;
            border-radius:4px;
            min-width:50px;
            text-align:center;">
            ${total} %
        </div>

    </div>
    `;
}

function attach_events(frm, all_tasks) {
    const wrapper = frm.fields_dict.task_hierarchy.$wrapper;

    // TOGGLE EXPAND / COLLAPSE
    wrapper.find(".toggle-node").off("click").on("click", function (e) {
        e.stopPropagation();
        let row = $(this).closest(".hierarchy-row");
        let name = row.data("name");
        let type = row.data("type");

        if (type === "subtask") return;

        expanded_nodes.has(name)
            ? expanded_nodes.delete(name)
            : expanded_nodes.add(name);

        load_hierarchy(frm);
    });

    // EXPAND ALL
    wrapper.find(".expand-all").off("click").on("click", function () {
        all_tasks.forEach(t => {
            if (t.custom_is_stage || t.custom_is_task || t.custom_is_subtask)
                expanded_nodes.add(t.name);
        });
        load_hierarchy(frm);
    });

    // COLLAPSE ALL
    wrapper.find(".collapse-all").off("click").on("click", function () {
        expanded_nodes.clear();
        load_hierarchy(frm);
    });

    // ADD STAGE
    wrapper.find(".add-stage").off("click").on("click", function () {

        let d = new frappe.ui.Dialog({

            title: "Add Stage",

            fields: [
                {
                    label: "Select Existing Stage",
                    fieldname: "existing_stage",
                    fieldtype: "MultiSelectPills",

                    get_data: function (txt) {

                        return frappe.db.get_list("Task", {
                            filters: [
                                ["custom_is_stage", "=", 1],
                                ["is_group", "=", 1],
                                ["is_template", "=", 1],
                                // ["subject", "like", "%" + txt + "%"]
                            ],
                            fields: ["name", "subject"],
                            // limit: 20
                        }).then(records => {
                            return records.map(row => ({
                                value: row.name,
                                label: row.subject
                            }));

                        });
                    }
                },
                {
                    label: "Include Tasks",
                    fieldname: "include_tasks",
                    fieldtype: "Check",
                    default: 0,
                    depends_on: "eval:doc.existing_stage && doc.existing_stage.length > 0"
                },
                {
                    label: "Include Subtasks",
                    fieldname: "include_children",
                    fieldtype: "Check",
                    default: 0,
                    depends_on: "eval:doc.existing_stage && doc.existing_stage.length > 0"
                },

                {
                    fieldtype: "Section Break"
                },

                {
                    label: "OR Create New Stage",
                    fieldname: "section_label",
                    fieldtype: "HTML",
                    options: "<b>Create New Stage</b>"
                },

                {
                    label: "Stage Name",
                    fieldname: "subject",
                    fieldtype: "Data"
                },

                {
                    label: "Weight",
                    fieldname: "task_weight",
                    fieldtype: "Float"
                },
                {
                    label: "Is Template",
                    fieldname: "is_template",
                    fieldtype: "Check",
                    default: 0
                },

                {
                    label: "Description",
                    fieldname: "description",
                    fieldtype: "Small Text"
                }

            ],

            primary_action_label: "Add",

            primary_action(values) {
                if (values.existing_stage && values.existing_stage.length > 0) {
                    frappe.call({
                        method: "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.create_stage_task",
                        args: {
                            boq_name: frm.doc.name,
                            selected_stages: values.existing_stage,
                            values: values,
                            include_tasks: values.include_tasks,
                            include_children: values.include_children
                        },

                        freeze: true,

                        callback() {

                            frappe.show_alert({
                                message: __("Stages linked successfully"),
                                indicator: "green"
                            });

                            d.hide();

                            load_hierarchy(frm);
                        }

                    });
                    return;
                }

                // CASE 2: create new stage
                if (!values.subject || !values.task_weight) {

                    frappe.msgprint("Enter stage details");

                    return;

                }

                validate_total_weight(frm, values.task_weight)
                    .then(result => {

                        if (!result.valid) {

                            frappe.msgprint({
                                title: __("Weight Limit Exceeded"),
                                message: __("Stage weight exceeds 100%"),
                                indicator: "red"
                            });

                            return;
                        }

                        let main_doc = {
                            doctype: "Task",
                            subject: values.subject,
                            custom_boq_name: frm.doc.name,
                            custom_is_stage: 1,
                            is_group: 1,
                            task_weight: values.task_weight,
                            description: values.description,
                            is_template: 0
                        };

                        // CREATE MAIN STAGE
                        frappe.call({

                            method: "frappe.client.insert",

                            args: {
                                doc: main_doc
                            },

                            callback: function () {

                                // IF TEMPLATE CHECKED
                                if (values.is_template) {

                                    let template_doc = {
                                        doctype: "Task",
                                        subject: values.subject,
                                        custom_is_stage: 1,
                                        is_group: 1,
                                        task_weight: values.task_weight,
                                        description: values.description,
                                        is_template: 1
                                    };

                                    frappe.call({

                                        method: "frappe.client.insert",

                                        args: {
                                            doc: template_doc
                                        },

                                        callback: function () {

                                            frappe.show_alert({
                                                message: __("Stage Created"),
                                                indicator: "green"
                                            });

                                            d.hide();

                                            load_hierarchy(frm);

                                        }

                                    });

                                } else {

                                    frappe.show_alert({
                                        message: __("Stage Created"),
                                        indicator: "green"
                                    });

                                    d.hide();

                                    load_hierarchy(frm);

                                }

                            }

                        });

                    });

                function validate_total_weight(frm, new_weight, old_weight = 0, parent_task = null) {

                    return new Promise(resolve => {

                        frappe.call({
                            method: "frappe.client.get_list",
                            args: {
                                doctype: "Task",
                                filters: parent_task
                                    ? { parent_task: parent_task }
                                    : { custom_boq_name: frm.doc.name, custom_is_stage: 1 },
                                fields: ["task_weight"]
                            },
                            callback: function (r) {

                                let current_total = 0;

                                if (r.message) {
                                    r.message.forEach(t => {
                                        current_total += t.task_weight || 0;
                                    });
                                }

                                // 🔥 FIXED LOGIC
                                let projected_total = (current_total - (old_weight || 0)) + new_weight;

                                let remaining = 100 - (current_total - (old_weight || 0));

                                resolve({
                                    valid: projected_total <= 100,
                                    current_total: current_total,
                                    projected_total: projected_total,
                                    remaining: remaining
                                });
                            }
                        });
                    });
                }

            }

        });
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Task",
                filters: {
                    custom_is_stage: 1,
                    is_template: 1
                },
                fields: ["name", "subject"],
                limit_page_length: 100
            },
            callback: function (r) {
                d.show();
            }
        }); d.show();

    });

    // ADD TASK
    wrapper.find(".add-task").off("click").on("click", function () {

        let stage = $(this).data("stage");

        let d = new frappe.ui.Dialog({
            title: "Add Task",
            fields: [

                {
                    label: "Select Existing Task",
                    fieldname: "existing_task",
                    fieldtype: "MultiSelectPills",

                    get_data: function (txt) {

                        return frappe.db.get_list("Task", {
                            filters: [
                                ["custom_is_task", "=", 1],
                                ["is_group", "=", 1],
                                ["is_template", "=", 1],
                                ["subject", "like", "%" + txt + "%"]
                            ],
                            fields: ["name", "subject"],
                            limit: 20
                        }).then(records => {

                            return records.map(row => ({
                                value: row.name,
                                label: row.subject
                            }));

                        });
                    }
                },
                {
                    label: "Include Subtasks",
                    fieldname: "include_children",
                    fieldtype: "Check",
                    default: 0,
                    depends_on: "eval:doc.existing_task && doc.existing_task.length > 0"
                },
                {
                    label: "OR Create New Task",
                    fieldname: "section_break",
                    fieldtype: "Section Break"
                },

                {
                    label: "Task Name",
                    fieldname: "subject",
                    fieldtype: "Data"
                },

                {
                    label: "Weight",
                    fieldname: "task_weight",
                    fieldtype: "Float"
                },
                {
                    label: "Is Template",
                    fieldname: "is_template",
                    fieldtype: "Check",
                    default: 0
                },

                {
                    label: "Description",
                    fieldname: "description",
                    fieldtype: "Data"
                }

            ],

            primary_action_label: "Add",

            primary_action(values) {
                if (values.existing_task && values.existing_task.length > 0) {
                    frappe.call({
                        method: "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.create_task",
                        args: {
                            boq_name: frm.doc.name,
                            selected_tasks: values.existing_task,
                            parent_stage: stage,
                            include_children: values.include_children
                        },

                        freeze: true,

                        callback() {

                            frappe.show_alert({
                                message: __("Task linked successfully"),
                                indicator: "green"
                            });

                            d.hide();

                            load_hierarchy(frm);
                        }

                    });
                    return;

                }

                if (!values.subject || !values.task_weight) {

                    frappe.msgprint("Enter task details");

                    return;
                }

                validate_task_weight(frm, stage, values.task_weight)
                    .then(result => {

                        if (!result.valid) {

                            frappe.msgprint("Weight exceeded");

                            return;
                        }

                        let main_doc = {
                            doctype: "Task",
                            subject: values.subject,
                            custom_boq_name: frm.doc.name,
                            parent_task: stage,
                            custom_is_task: 1,
                            is_group: 1,
                            task_weight: values.task_weight,
                            description: values.description,
                            is_template: 0
                        };

                        frappe.call({

                            method: "frappe.client.insert",

                            args: {
                                doc: main_doc
                            },

                            callback: function () {

                                if (values.is_template) {

                                    let template_doc = {
                                        doctype: "Task",
                                        subject: values.subject,
                                        custom_is_task: 1,
                                        is_group: 1,
                                        task_weight: values.task_weight,
                                        description: values.description,
                                        is_template: 1
                                    };

                                    frappe.call({

                                        method: "frappe.client.insert",

                                        args: {
                                            doc: template_doc
                                        },

                                        callback: function () {

                                            frappe.show_alert({
                                                message: __("Task Created"),
                                                indicator: "green"
                                            });

                                            d.hide();

                                            load_hierarchy(frm);

                                        }

                                    });

                                } else {

                                    frappe.show_alert({
                                        message: __("Task Created"),
                                        indicator: "green"
                                    });

                                    d.hide();

                                    load_hierarchy(frm);

                                }

                            }

                        });

                    });

            }

        });
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Task",
                filters: {
                    custom_is_task: 1,
                    is_template: 1
                },
                fields: ["name", "subject"],
                limit_page_length: 200
            },
            callback: function (r) {
                d.show();
            }
        });

        d.show();

    });

    wrapper.find(".add-child-task").off("click").on("click", function (e) {

        e.stopPropagation();

        let parent_name = $(this).data("parent");

        let d = new frappe.ui.Dialog({

            title: "Add Child Task",

            fields: [

                {
                    label: "Select Existing Task",
                    fieldname: "existing_task",
                    fieldtype: "MultiSelectPills",

                    get_data: function (txt) {

                        return frappe.db.get_list("Task", {
                            filters: [
                                ["custom_is_task", "=", 1],
                                ["is_group", "=", 1],
                                ["is_template", "=", 1],
                                ["subject", "like", "%" + txt + "%"]
                            ],
                            fields: ["name", "subject"],
                            limit: 20
                        }).then(records => {

                            return records.map(row => ({
                                value: row.name,
                                label: row.subject
                            }));

                        });
                    }
                },

                {
                    label: "Include Subtasks",
                    fieldname: "include_children",
                    fieldtype: "Check",
                    default: 0,
                    depends_on:
                        "eval:doc.existing_task && doc.existing_task.length > 0"
                },

                {
                    fieldtype: "Section Break"
                },

                {
                    label: "OR Create New Child Task",
                    fieldname: "section_label",
                    fieldtype: "HTML",
                    options: "<b>Create New Child Task</b>"
                },

                {
                    label: "Task Name",
                    fieldname: "subject",
                    fieldtype: "Data"
                },

                {
                    label: "Weight",
                    fieldname: "task_weight",
                    fieldtype: "Float"
                },

                {
                    label: "Is Template",
                    fieldname: "is_template",
                    fieldtype: "Check",
                    default: 0
                },

                {
                    label: "Description",
                    fieldname: "description",
                    fieldtype: "Small Text"
                }

            ],

            primary_action_label: "Add",

            primary_action(values) {

                // LINK EXISTING TASKS
                if (
                    values.existing_task &&
                    values.existing_task.length > 0
                ) {

                    frappe.call({

                        method:
                            "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.create_task",

                        args: {
                            boq_name: frm.doc.name,
                            selected_tasks: values.existing_task,
                            parent_stage: parent_name,
                            include_children: values.include_children
                        },

                        freeze: true,

                        callback() {

                            frappe.show_alert({
                                message: __("Child Task linked successfully"),
                                indicator: "green"
                            });

                            expanded_nodes.add(parent_name);

                            d.hide();

                            load_hierarchy(frm);
                        }

                    });

                    return;
                }

                // CREATE NEW CHILD TASK

                if (!values.subject) {

                    frappe.msgprint("Enter task details");

                    return;
                }

                let main_doc = {

                    doctype: "Task",

                    subject: values.subject,

                    custom_boq_name: frm.doc.name,

                    parent_task: parent_name,

                    custom_is_task: 1,

                    is_group: 1,

                    task_weight: values.task_weight || 0,

                    description: values.description,

                    is_template: 0
                };

                frappe.call({

                    method: "frappe.client.insert",

                    args: {
                        doc: main_doc
                    },

                    callback: function () {

                        if (values.is_template) {

                            let template_doc = {

                                doctype: "Task",

                                subject: values.subject,

                                custom_is_task: 1,

                                is_group: 1,

                                task_weight: values.task_weight || 0,

                                description: values.description,

                                is_template: 1
                            };

                            frappe.call({

                                method: "frappe.client.insert",

                                args: {
                                    doc: template_doc
                                },

                                callback: function () {

                                    frappe.show_alert({
                                        message: __("Child Task Created"),
                                        indicator: "green"
                                    });

                                    expanded_nodes.add(parent_name);

                                    d.hide();

                                    load_hierarchy(frm);
                                    sync_tasks_details(frm);

                                }

                            });

                        } else {

                            frappe.show_alert({
                                message: __("Child Task Created"),
                                indicator: "green"
                            });

                            expanded_nodes.add(parent_name);

                            d.hide();

                            load_hierarchy(frm);

                        }

                    }

                });

            }

        });

        d.show();

    });

    // ADD SUBTASK
    wrapper.find(".add-subtask").off("click").on("click", function () {

        let parent_task = $(this).data("task");

        let d = new frappe.ui.Dialog({

            title: "Add Subtask",

            fields: [
                {
                    label: "Select Existing Subtask",
                    fieldname: "existing_subtask",
                    fieldtype: "MultiSelectPills",

                    get_data: function (txt) {

                        return frappe.db.get_list("Task", {
                            filters: [
                                ["custom_is_subtask", "=", 1],
                                ["is_template", "=", 1],
                                ["subject", "like", "%" + txt + "%"]
                            ],
                            fields: ["name", "subject"],
                            limit: 20
                        }).then(records => {

                            return records.map(row => ({
                                value: row.name,
                                label: row.subject
                            }));

                        });
                    }
                },

                {
                    fieldtype: "Section Break"
                },

                {
                    label: "OR Create New Subtask",
                    fieldname: "section_label",
                    fieldtype: "HTML",
                    options: "<b>Create New Subtask</b>"
                },

                {
                    label: "Subtask Name",
                    fieldname: "subject",
                    fieldtype: "Data"
                },

                {
                    label: "Weight",
                    fieldname: "task_weight",
                    fieldtype: "Float"
                },
                {
                    label: "Is Template",
                    fieldname: "is_template",
                    fieldtype: "Check",
                    default: 0
                },

                {
                    label: "Description",
                    fieldname: "description",
                    fieldtype: "Small Text"
                }

            ],

            primary_action_label: "Add",

            primary_action(values) {

                if (values.existing_subtask && values.existing_subtask.length) {

                    frappe.call({
                        method: "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.create_subtask",
                        args: {
                            boq_name: frm.doc.name,
                            selected_stages: values.existing_subtask,
                            values: values,
                            task: parent_task
                        },

                        freeze: true,

                        callback() {

                            frappe.show_alert({
                                message: __("Subtasks linked successfully"),
                                indicator: "green"
                            });

                            d.hide();

                            load_hierarchy(frm);
                        }

                    });
                    return;
                }

                // CASE 2: create new subtask
                if (!values.subject || !values.task_weight) {

                    frappe.msgprint("Enter subtask details");

                    return;

                }

                validate_subtask_weight(frm, parent_task, values.task_weight)
                    .then(result => {

                        if (!result.valid) {

                            frappe.msgprint("Subtask weight exceeded");

                            return;

                        }

                        let main_doc = {
                            doctype: "Task",
                            subject: values.subject,
                            custom_boq_name: frm.doc.name,
                            parent_task: parent_task,
                            custom_is_subtask: 1,
                            task_weight: values.task_weight,
                            description: values.description,
                            is_template: 0
                        };

                        frappe.call({

                            method: "frappe.client.insert",

                            args: {
                                doc: main_doc
                            },

                            callback: function () {

                                if (values.is_template) {

                                    let template_doc = {
                                        doctype: "Task",
                                        subject: values.subject,
                                        custom_is_subtask: 1,
                                        task_weight: values.task_weight,
                                        description: values.description,
                                        is_template: 1
                                    };

                                    frappe.call({

                                        method: "frappe.client.insert",

                                        args: {
                                            doc: template_doc
                                        },

                                        callback: function () {

                                            frappe.show_alert({
                                                message: __("Subtask + Template Created"),
                                                indicator: "green"
                                            });

                                            d.hide();

                                            load_hierarchy(frm);

                                        }

                                    });

                                } else {

                                    frappe.show_alert({
                                        message: __("Subtask Created"),
                                        indicator: "green"
                                    });

                                    d.hide();

                                    load_hierarchy(frm);

                                }

                            }

                        });

                    });

            }

        });

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Task",
                filters: {
                    custom_is_subtask: 1,
                    is_template: 1
                },
                fields: ["name", "subject"],
                limit_page_length: 200
            },
            callback: function (r) {
                d.show();
            }
        });

    });

    // EDIT 
    wrapper.find(".edit-item").off("click").on("click", function (e) {
        e.stopPropagation();
        let row = $(this).closest(".hierarchy-row");
        let docname = row.data("name");
        let type = row.data("type");

        let update_message =
            type === "stage" ? "Stage Updated" :
                type === "task" ? "Task Updated" :
                    "Subtask Updated";

        let dialog_title =
            type === "stage" ? "Edit Stage" :
                type === "task" ? "Edit Task" :
                    "Edit Subtask";

        frappe.db.get_doc("Task", docname).then(doc => {
            frappe.prompt([
                { label: "Name", fieldname: "subject", fieldtype: "Data", default: doc.subject, reqd: 1 },
                {
                    label: "Status", fieldname: "status", fieldtype: "Select",
                    options: ["Open", "Working", "Completed", "Cancelled"],
                    default: doc.status
                },
                {
                    label: "Priority", fieldname: "priority", fieldtype: "Select",
                    options: ["Low", "Medium", "High", "Urgent"],
                    default: doc.priority
                },
                {
                    label: "Weight", fieldname: "task_weight", fieldtype: "Float",
                    default: doc.task_weight
                },
                {
                    label: "Description", fieldname: "description", fieldtype: "Small Text",
                    default: doc.description
                }
            ], function (values) {

                if (type === "stage") {

                    // 🔥 fetch existing task (stage)
                    frappe.call({
                        method: "frappe.client.get",
                        args: {
                            doctype: "Task",
                            name: docname
                        },
                        callback: function (r) {

                            let task = r.message;
                            let old_weight = task.task_weight || 0;

                            validate_total_weight(frm, values.task_weight, old_weight, null)
                                .then(result => {

                                    if (!result.valid) {
                                        frappe.msgprint({
                                            title: __("Weight Limit Exceeded"),
                                            message: __("Cannot update stage. Current total: {0}%, New total would be: {1}%. Maximum allowed is 100%.<br>Remaining weight available: {2}%",
                                                [result.current_total.toFixed(2), result.projected_total.toFixed(2), result.remaining.toFixed(2)]),
                                            indicator: "red"
                                        });
                                        return;
                                    }

                                    update_task_values(); // ✅ only after validation

                                });
                        }
                    });
                } else if (type === "task") {
                    frappe.call({
                        method: "frappe.client.get",
                        args: {
                            doctype: "Task",
                            name: docname
                        },
                        callback: function (r) {

                            let task = r.message;
                            let old_weight = task.task_weight || 0;

                            validate_total_weight(frm, values.task_weight, old_weight, task.parent_task)
                                .then(result => {

                                    if (!result.valid) {
                                        frappe.msgprint({
                                            title: __("Weight Limit Exceeded"),
                                            message: __("Cannot update task. Current total: {0}%, New total would be: {1}%. Maximum allowed is 100%.<br>Remaining weight available: {2}%",
                                                [result.current_total.toFixed(2), result.projected_total.toFixed(2), result.remaining.toFixed(2)]),
                                            indicator: "red"
                                        });
                                        return;
                                    }

                                    update_task_values();

                                });
                        }
                    });
                } else if (type === "subtask") {
                    // Get the parent task for subtask validation
                    frappe.db.get_value("Task", docname, "parent_task").then(r => {
                        if (r.message && r.message.parent_task) {
                            validate_subtask_weight(frm, r.message.parent_task, values.task_weight, docname).then(result => {
                                if (!result.valid) {
                                    frappe.msgprint({
                                        title: __("Subtask Weight Limit Exceeded"),
                                        message: __("Cannot update subtask. Current total for this task: {0}%, New total would be: {1}%. Maximum allowed is 100%.<br>Remaining weight available: {2}%",
                                            [result.current_total.toFixed(2), result.projected_total.toFixed(2), result.remaining.toFixed(2)]),
                                        indicator: "red"
                                    });
                                    return;
                                }
                                update_task_values();
                            });
                        } else {
                            update_task_values();
                        }
                    });
                } else {
                    update_task_values();
                }

                function update_task_values() {
                    frappe.call({
                        method: "frappe.client.set_value",
                        args: {
                            doctype: "Task",
                            name: docname,
                            fieldname: values
                        },
                        callback: function () {
                            frappe.show_alert({ message: __(update_message), indicator: "green" });
                            load_hierarchy(frm);
                        }
                    });
                }
            }, dialog_title);
        });
    });

    // REDIRECT TO FORM VIEW
    wrapper.find(".redirect-item").off("click").on("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        let docname = $(this).data("name");
        if (!docname) {
            frappe.msgprint(__("No document name found. Please refresh the page."));
            return;
        }
        // Build the correct Frappe desk URL: /desk/task/{encoded-name}
        let route = `/desk/task/${encodeURIComponent(docname)}`;
        window.open(route, "_blank");
    });

    // ASSIGN
    wrapper.find(".assign-item").off("click").on("click", function (e) {
        e.stopPropagation();
        let docname = $(this).closest(".hierarchy-row").data("name");

        frappe.db.get_doc("Task", docname).then(doc => {
            let d = new frappe.ui.Dialog({
                title: "Assign Task",
                fields: [
                    {
                        label: "Assign To",
                        fieldname: "assign_to",
                        fieldtype: "Link",
                        options: "User",
                        reqd: 1
                    },
                    {
                        label: "Hours",
                        fieldname: "expected_time",
                        fieldtype: "Float",
                        default: doc.expected_time || 0
                    },
                    {
                        label: "End Date",
                        fieldname: "exp_end_date",
                        fieldtype: "Date",
                        default: doc.exp_end_date
                    }
                ],
                primary_action_label: "Assign",
                primary_action(values) {
                    frappe.call({
                        method: "frappe.client.set_value",
                        args: {
                            doctype: "Task",
                            name: docname,
                            fieldname: {
                                expected_time: values.expected_time,
                                exp_end_date: values.exp_end_date
                            }
                        },
                        callback: function () {
                            frappe.call({
                                method: "frappe.desk.form.assign_to.add",
                                args: {
                                    assign_to: [values.assign_to],
                                    doctype: "Task",
                                    name: docname,
                                    description: ""
                                },
                                callback: function () {
                                    frappe.show_alert({
                                        message: __("Task Assigned to ") + values.assign_to,
                                        indicator: "green"
                                    });
                                    d.hide();
                                    load_hierarchy(frm);
                                }
                            });
                        }
                    });
                }
            });
            d.show();
        });
    });

    // DELETE ITEM
    wrapper.find(".delete-item").off("click").on("click", function (e) {

        e.stopPropagation();

        let docname = $(this).data("name");

        let row = $(this).closest(".hierarchy-row");

        let type = row.data("type");

        // CHECK CHILDREN
        let has_children = all_tasks.some(t => t.parent_task === docname);

        if (has_children) {

            frappe.msgprint({
                title: __("Cannot Delete"),
                message: __("This item has children (Tasks or Subtasks). Please delete children first."),
                indicator: "orange"
            });

            return;
        }

        frappe.confirm(
            __("Are you sure you want to delete this {0}?", [type]),

            function () {

                // =====================================
                // REMOVE MATCHING SUBTASK ROWS ONLY
                // =====================================

                let boq_index = (frm.doc.boq_items || []).length;

                while (boq_index--) {

                    let boq_row = frm.doc.boq_items[boq_index];

                    // MATCH CLICKED TASK/SUBTASK ID
                    if (
                        boq_row.subtask &&
                        boq_row.subtask === docname
                    ) {

                        let removed = frm.doc.boq_items.splice(boq_index, 1)[0];

                        frappe.model.clear_doc(
                            removed.doctype,
                            removed.name
                        );
                    }
                }

                frm.refresh_field("boq_items");
                frm.dirty();
                frm.save();

                // =====================================
                // REMOVE TASK ROW FROM tasks_details
                // =====================================

                let task_index = (frm.doc.tasks_details || []).findIndex(
                    d => d.task === docname
                );

                if (task_index !== -1) {

                    let removed_task =
                        frm.doc.tasks_details.splice(task_index, 1)[0];

                    frappe.model.clear_doc(
                        removed_task.doctype,
                        removed_task.name
                    );

                    frm.refresh_field("tasks_details");
                }

                // =====================================
                // DELETE DEPENDENCIES
                // =====================================

                frappe.call({
                    method: "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.delete_task_with_dependencies",
                    args: {
                        task_name: docname
                    },
                    freeze: true,
                    freeze_message: __("Deleting..."),
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.show_alert({
                                message: __("{0} deleted successfully", [type]),
                                indicator: "red"
                            });
                            load_hierarchy(frm);
                        }
                    }
                });

            }
        );

    });

    // SHOW BOM DIALOG
    wrapper.find(".show-bom").off("click").on("click", function (e) {
        e.stopPropagation();
        let docname = $(this).data("name");
        if (docname) {
            show_bom_dialog(frm, docname);
        } else {
            frappe.msgprint(__("Error: Could not find Task Name for this row."));
        }
    });
}

function show_bom_dialog(frm, task_name) {

    frappe.model.with_doc("Task", task_name, function () {
        let task_doc = frappe.get_doc("Task", task_name);

        let d = new frappe.ui.Dialog({
            title: __("BOQ Details: {0}", [task_doc.subject || task_name]),
            size: "large",
            fields: [
                {
                    fieldname: "custom_bom_details",
                    fieldtype: "Table",
                    label: __("BOM Items"),
                    options: "Task BOQ Details",
                    fields: [
                        {
                            fieldname: "item",
                            fieldtype: "Link",
                            options: "Item",
                            label: __("Item"),
                            in_list_view: 1,
                            columns: 2,
                            onchange: function () {
                                let row = this.doc;
                                if (!row || !row.item) return;

                                let grid = d.fields_dict.custom_bom_details.grid;
                                let grid_row = grid.get_row(row.name);

                                if (!grid_row) return;

                                frappe.db.get_value("Item", row.item, ["item_name", "stock_uom", "custom_item_type"])
                                    .then(r => {
                                        if (r && r.message) {
                                            row.item_name = r.message.item_name;
                                            row.uom = r.message.stock_uom;
                                            row.item_type = r.message.custom_item_type;

                                            grid_row.refresh_field("item_name");
                                            grid_row.refresh_field("uom");
                                            grid_row.refresh_field("item_type");
                                        }
                                    });
                            }
                        },
                        {
                            fieldname: "uom",
                            fieldtype: "Link",
                            options: "UOM",
                            label: __("UOM"),
                            in_list_view: 1,
                            columns: 2
                        },
                        {
                            fieldname: "qty",
                            fieldtype: "Float",
                            label: __("Qty"),
                            in_list_view: 1,
                            columns: 2
                        },

                        {
                            fieldname: "rate",
                            fieldtype: "Float",
                            label: __("Rate"),
                            in_list_view: 1,
                            columns: 2
                        },
                        {
                            fieldname: "amount",
                            fieldtype: "Float",
                            label: __("Amount"),
                            in_list_view: 1,
                            columns: 2
                        }
                    ]
                }
            ],
            primary_action_label: __("Save Changes"),
            primary_action: function () {
                let values = d.get_values();
                if (values) {
                    frappe.call({
                        method: "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.update_task_bom_details",
                        args: {
                            task_name: task_name,
                            bom_details: values.custom_bom_details || []
                        },
                        callback: function (r) {
                            if (!r.exc) {
                                frappe.show_alert({
                                    message: __("BOM Details saved successfully"),
                                    indicator: "green"
                                });
                                d.hide();
                                load_hierarchy(frm);
                                update_boq_items_for_subtask(frm, task_name);
                            }
                        }
                    });
                }
            }
        });

        // Set the data to the grid
        if (task_doc.custom_bom_details) {
            d.fields_dict.custom_bom_details.df.data = task_doc.custom_bom_details;
            d.fields_dict.custom_bom_details.grid.refresh();
        }
        d.show();

        let grid = d.fields_dict.custom_bom_details.grid;

        grid.wrapper.on(
            "focusout",
            'input[data-fieldname="qty"], input[data-fieldname="rate"]',
            function () {

                let row_name = $(this)
                    .closest(".grid-row")
                    .attr("data-name");

                if (!row_name) return;

                let grid_row = grid.get_row(row_name);

                if (!grid_row || !grid_row.doc) return;

                let row = grid_row.doc;

                // get latest values directly from inputs
                let qty = flt(
                    grid_row.columns.qty.field.get_value()
                );

                let rate = flt(
                    grid_row.columns.rate.field.get_value()
                );

                // set values
                row.qty = qty;
                row.rate = rate;
                row.amount = qty * rate;

                // refresh only amount field
                grid_row.refresh_field("amount");
            }
        );

    });
}

function sync_tasks_details(frm) {
    if (!frm.doc.name || frm.doc.__islocal || frm._is_syncing) return;

    frm._is_syncing = true;
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Task",
            filters: {
                custom_boq_name: frm.doc.name,
                custom_is_task: 1
            },
            fields: ["name", "subject"]
        },
        callback: function (r) {
            if (r.message && r.message.length > 0) {
                let existing_tasks = (frm.doc.tasks_details || []).map(d => d.task);
                let added = false;

                let fetch_promises = [];
                r.message.forEach(t => {
                    if (!existing_tasks.includes(t.name)) {
                        let child = frm.add_child("tasks_details");
                        child.task = t.name;
                        child.task_subject = t.subject;
                        fetch_promises.push(fetch_items_for_task(frm, child));
                        existing_tasks.push(t.name);
                        added = true;
                    }
                });

                Promise.all(fetch_promises).then(() => {
                    if (added) {
                        frm.refresh_field("tasks_details");
                        frm.refresh_field("boq_items");

                    }
                    frm._is_syncing = false;
                }).catch(() => {
                    frm._is_syncing = false;
                });
            } else {
                frm._is_syncing = false;
            }
        },
        error: function () {
            frm._is_syncing = false;
        }
    });
}

async function update_boq_items_for_subtask(frm, subtask_name) {
    if (!subtask_name) return;

    frappe.call({
        method: "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.get_boq_items_from_subtask",
        args: { subtask_name: subtask_name },
        freeze: true,
        freeze_message: __("Updating BOQ items..."),

        callback: async function (r) {

            if (r.exc) return;

            // REMOVE OLD ROWS OF THIS SUBTASK (OR TASK IF NO SUBTASK)
            let i = (frm.doc.boq_items || []).length;

            while (i--) {

                let row = frm.doc.boq_items[i];

                if (row.subtask === subtask_name || (!row.subtask && row.task === subtask_name)) {

                    let removed = frm.doc.boq_items.splice(i, 1)[0];

                    frappe.model.clear_doc(
                        removed.doctype,
                        removed.name
                    );
                }
            }

            // ADD UPDATED ROWS
            const items = r.message || [];
            for (let d of items) {

                const already_exists = (frm.doc.boq_items || []).some(row =>
                    row.task === d.task &&
                    row.subtask === d.subtask &&
                    row.item_code === d.item_code
                );

                // PREVENT DUPLICATE
                if (already_exists) continue;

                const child = frm.add_child("boq_items");

                Object.assign(child, d);
            }

            frm.refresh_field("boq_items");

            if (!frm.doc.__islocal && frm.is_dirty()) {
                frm.save();
            }
        }
    });
}
