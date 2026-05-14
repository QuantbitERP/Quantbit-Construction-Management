frappe.ui.form.on("Bill of Quantities", {
    refresh(frm) {
        if (!frm.doc.document_type) {
            frm.set_value("document_type", "Task");
        }
        if (!frm.doc.import_type) {
            frm.set_value("import_type", "Insert New Records");
        }
        render_combined_boq(frm);

        if (frm.doc.import_file) {
            frm.add_custom_button(__("Import Tasks"), () => {
                frappe.call({
                    method: "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.import_boq_tasks",
                    args: {
                        file_url: frm.doc.import_file,
                        boq_name: frm.doc.name
                    },
                    freeze: true,
                    freeze_message: __("Importing Tasks hierarchically..."),
                    callback: function(r) {
                        if (!r.exc) {
                            frappe.msgprint({
                                title: __('Success'),
                                indicator: 'green',
                                message: __('Tasks imported successfully.')
                            });
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
    },
    download_template: function(frm) {
        open_url_post("/api/method/quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.download_boq_task_template", {});
    }
});

function remove_boq_items_for_task(frm, task_name) {
    if (!task_name) return;

    const rows_to_remove = (frm.doc.boq_items || []).filter(
        item => item.task === task_name
    );

    rows_to_remove.forEach(item => frappe.model.clear_doc("BOQ Item", item.name));

    frm.refresh_field("boq_items");

    frappe.show_alert({
        message: __("BOQ items removed for task: {0}", [task_name]),
        indicator: "orange"
    }, 4);
}

frappe.ui.form.on("BOQ Task Details", {

    async task(frm, cdt, cdn) {

        const row = locals[cdt][cdn];

        if (!row.task) {
            remove_boq_items_for_task(frm, row._prev_task);
            row._prev_task = null;
            return;
        }
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
            remove_boq_items_for_task(frm, row._prev_task);
        }

        row._prev_task = row.task;

        const response = await frappe.call({
            method: "quantbit_construction_management.boq.doctype.bill_of_quantities.bill_of_quantities.get_boq_items_from_task",
            args: { task_name: row.task }
        });

        const items = response.message || [];

        if (!items.length) {
            frappe.msgprint(__("No dependent BOQ items found."));
            return;
        }

        items.forEach(d => {
            const child = frm.add_child("boq_items");
            Object.keys(d).forEach(key => { child[key] = d[key]; });
        });

        frm.refresh_field("boq_items");

        frappe.show_alert({
            message: __("{0} item(s) added", [items.length]),
            indicator: "green"
        });
    },

    before_tasks_details_remove: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        remove_boq_items_for_task(frm, row.task);
    }

});

frappe.ui.form.on("BOQ Item", {

    internal_qty: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "internal_amount", (row.internal_qty || 0) * (row.internal_rate || 0));
    },

    internal_rate: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "internal_amount", (row.internal_qty || 0) * (row.internal_rate || 0));
    },

    actual_qty: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "actual_amount", (row.actual_qty || 0) * (row.actual_rate || 0));
    },

    actual_rate: function(frm, cdt, cdn) {
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
                    <td>${row.subtask_name || ""}</td>
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

// Variable to track expanded nodes (Everything is collapsed by default)
window.expanded_nodes = window.expanded_nodes || new Set();

frappe.ui.form.on('Bill of Quantities', {
    refresh: function (frm) {
        inject_hierarchy_css();
        if (frm.doc.name && typeof load_hierarchy === "function") {
            load_hierarchy(frm);
        }
    }
});

frappe.realtime.on("project_progress_refresh", (data) => {

    if (!cur_frm || cur_frm.doc.doctype !== "Bill of Quantities") return;

    if (cur_frm.doc.name === data.project) {

        // 🔥 refresh hierarchy UI
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
                custom_is_stage: 1
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
            filters: { custom_boq_name: frm.doc.name },
            fields: [
                "name", "subject", "parent_task", "status", "priority",
                "description", "task_weight", "custom_is_stage",
                "custom_is_task", "custom_is_subtask", "expected_time", "exp_end_date","progress"
            ],
            order_by: "creation asc",
            limit_page_length: 1000
        },
        callback: function (r) {
            if (!r.message) return;
            const tasks = r.message;
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
                        if (t.parent_task === taskObj.data.name && t.custom_is_subtask == 1) {
                            taskObj.subtasks.push(t);
                        }
                    });
                });
            });

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
                html += render_row(stageObj.data, "stage", is_stage_expanded);

                if (is_stage_expanded) {
                    stageObj.tasks.forEach(taskObj => {
                        let subtask_total = 0;
                        taskObj.subtasks.forEach(sub => {
                            subtask_total += flt(sub.task_weight || 0);
                        });

                        const is_task_expanded = expanded_nodes.has(taskObj.data.name);
                        html += render_row(taskObj.data, "task", is_task_expanded);

                        if (is_task_expanded) {
                            taskObj.subtasks.forEach(sub => {
                                html += render_row(sub, "subtask", false);
                            });

                            // Subtask Total Row
                            html += render_total_row(
                                "Subtasks Total",
                                subtask_total,
                                80
                            );
                        }
                    });

                    // Task Total Row (Inside Stage)
                    html += render_total_row(
                        "Tasks Total",
                        stage_progress.toFixed(2),
                        40
                    );
                }
            });

            // Overall Stage Total (Bottom Styled Like Screenshot)
            html += `
      <div style="
          margin-top:15px;
          display:flex;
          justify-content:flex-end;
          align-items:center;
          gap:10px;
          font-weight:600;">

          <div>Total Stages Percentage :</div>

          <div style="
              background:#27ae60;
              color:white;
              padding:4px 10px;
              border-radius:4px;
              min-width:50px;
              text-align:center;">
              ${calculate_project_progress(tasks)} %
          </div>

      </div>
      `;

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

function render_row(item, type, is_expanded) {
    let margin = type === "stage" ? "0px" : (type === "task" ? "25px" : "60px");
    let bg = type === "stage" ? "#1E88E5" : (type === "task" ? "#E3F2FD" : "#F5F5F5");
    let color = type === "stage" ? "white" : "#333";
    let btnClass = type === "stage" ? "btn-light" : "btn-default";

    // Icon logic
    let icon = "";
    if (type !== "subtask") {
        icon = is_expanded ? "▼" : "▶";
    }

    let progress = item.progress || 0;

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
         <div><span class="detail-label">Progress %:</span> ${item.progress || 0}</div>
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
        <button class="btn ${btnClass} btn-xs redirect-item" data-name="${item.name}" title="Open Form View"> Redirect</button>
        <button class="btn ${btnClass} btn-xs edit-item" data-name="${item.name}">✏ Edit</button>
        <button class="btn ${btnClass} btn-xs assign-item" data-name="${item.name}">👤 Assign</button>
        ${type === "stage" ? `<button class="btn btn-light btn-xs add-task" data-stage="${item.name}">+ Task</button>` : ""}
        ${type === "task" ? `<button class="btn btn-default btn-xs add-subtask" data-task="${item.name}">+ Subtask</button>` : ""}
          
        <button class="btn btn-warning btn-xs show-weight" 
          data-name="${item.name}" 
          title="Weight">
          ${item.task_weight || 0}%
        </button>
      </div>
    </div>`;

}

function render_total_row(label, total, margin_left) {
    let bg_color = "#27ae60";
    if (total > 100) bg_color = "#e74c3c";

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
            if (t.custom_is_stage || t.custom_is_task)
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
                fieldtype: "Link",
                options: "Task",

                get_query() {
                    return {
                        filters: {
                            custom_is_stage: 1
                        }
                    };
                }
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
                label: "Description",
                fieldname: "description",
                fieldtype: "Small Text"
            }

        ],

        primary_action_label: "Add",

        primary_action(values) {

            // CASE 1: attach existing template stage
            if (values.existing_stage) {

                frappe.call({

                    method: "frappe.client.set_value",

                    args: {

                        doctype: "Task",

                        name: values.existing_stage,

                        fieldname: {

                            custom_boq_name: frm.doc.name,

                            custom_is_stage: 1,

                            is_group: 1

                        }

                    },

                    callback: function () {

                        frappe.show_alert({

                            message: __("Existing Stage Linked"),

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

    d.show();

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
                fieldtype: "Link",
                options: "Task",

                get_query() {


                    return {

                        // filters: {

                           

                        // }

                    };

                }

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
                label: "Description",
                fieldname: "description",
                fieldtype: "Data"
            }

        ],

        primary_action_label: "Add",

        primary_action(values) {

            if (values.existing_task) {

                frappe.call({
                    method: "frappe.client.set_value",
                    args: {
                        doctype: "Task",
                        name: values.existing_task,
                        fieldname: {
                            parent_task: stage,
                            custom_is_task: 1,
                            custom_boq_name: frm.doc.name
                        }
                    },
                    callback() {

                        frappe.show_alert("Existing task linked");

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

                    frappe.call({

                        method: "frappe.client.insert",

                        args: {
                            doc: {
                                doctype: "Task",
                                subject: values.subject,
                                custom_boq_name: frm.doc.name,
                                parent_task: stage,
                                custom_is_task: 1,
                                is_group: 1,
                                task_weight: values.task_weight,
                                description: values.description
                            }
                        },

                        callback() {

                            frappe.show_alert("Task Created");

                            d.hide();

                            load_hierarchy(frm);

                        }

                    });

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
                fieldtype: "Link",
                options: "Task",

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
                label: "Description",
                fieldname: "description",
                fieldtype: "Small Text"
            }

        ],

        primary_action_label: "Add",

        primary_action(values) {

            // CASE 1: attach existing template subtask
            if (values.existing_subtask) {

                frappe.call({

                    method: "frappe.client.set_value",

                    args: {
                        doctype: "Task",
                        name: values.existing_subtask,
                        fieldname: {
                            parent_task: parent_task,
                            custom_boq_name: frm.doc.name,
                            custom_is_subtask: 1
                        }
                    },

                    callback() {

                        frappe.show_alert({
                            message: "Existing subtask linked",
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

                frappe.call({

                    method: "frappe.client.insert",

                    args: {
                        doc: {
                            doctype: "Task",
                            subject: values.subject,
                            custom_boq_name: frm.doc.name,
                            parent_task: parent_task,
                            custom_is_subtask: 1,
                            task_weight: values.task_weight,
                            description: values.description
                        }
                    },

                    callback() {

                        frappe.show_alert({
                            message: "Subtask Created",
                            indicator: "green"
                        });

                        d.hide();

                        load_hierarchy(frm);

                    }

                });

            });

        }

    });

    d.show();

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
        let docname = $(this).data("name");
        frappe.set_route("Form", "Task", docname);
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
}