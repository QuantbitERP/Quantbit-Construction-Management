window.expanded_nodes = window.expanded_nodes || new Set();

frappe.ui.form.on('Project', {
    refresh: function (frm) {
        inject_hierarchy_css();
        if (frm.doc.name && typeof load_hierarchy === "function") {
            load_hierarchy(frm);
        }
        if (frm.doc.custom_report_name_) {
            render_report_view(frm);
        }
    },
    custom_report_name_: function(frm) {
        if (frm.doc.custom_report_name_) {
            render_report_view(frm);
        } else {
            frm.set_value('custom_html_view', '');
        }
    }
});

function render_report_view(frm) {
    if (!frm.doc.custom_report_name_) return;

    let filters = {};
    if (frm.doc.name && !frm.doc.__islocal) filters.project = frm.doc.name;
    if (frm.doc.company) filters.company = frm.doc.company;
    if (frm.doc.expected_start_date) filters.from_date = frm.doc.expected_start_date;
    if (frm.doc.expected_end_date) filters.to_date = frm.doc.expected_end_date;

    frappe.call({
        method: "quantbit_construction_management.report_handler.get_report_html",
        args: {
            report_name: frm.doc.custom_report_name_,
            filters: filters
        },
        callback: function(r) {
            if (r.message) {
                let msg = r.message;
                let html = typeof msg === 'string' ? msg : msg.html;
                
                frm.set_df_property('custom_html_view', 'options', html);
                frm.refresh_field('custom_html_view');

                // If still preparing, poll again in 5 seconds
                if (msg.status === "preparing") {
                    setTimeout(() => {
                        // Check if we are still on the same report
                        if (frm.doc.custom_report_name_) {
                            render_report_view(frm);
                        }
                    }, 5000);
                }
            }
        }
    });
}

frappe.realtime.on("project_progress_refresh", (data) => {

    if (!cur_frm || cur_frm.doc.doctype !== "Project") return;

    if (cur_frm.doc.name === data.project) {

        load_hierarchy(cur_frm);

    }

});

function inject_hierarchy_css() {
    const css = `
        .hierarchy-row { 
            position: relative; 
            transition: all 0.2s ease; 
            cursor: pointer; 
            margin-bottom: 8px; 
            border: 1px solid #f0f0f0;
            border-radius: 8px;
        }
        .hierarchy-row:hover { 
            box-shadow: 0 4px 12px rgba(0,0,0,0.05); 
        }
        .hover-details {
            display: none; position: absolute; top: -10px; left: 50%;
            transform: translateX(-50%) translateY(-100%); background: #2d3436;
            color: #fff; padding: 10px 15px; border-radius: 8px; font-size: 12px;
            width: 250px; z-index: 100; box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            pointer-events: none;
        }
        .hierarchy-row:hover .hover-details { display: block; }
        .toggle-icon { margin-right: 12px; font-weight: bold; cursor: pointer; width: 15px; display: inline-block; text-align: center; color: #666; }
        .detail-label { color: #bdc3c7; font-weight: bold; margin-right: 5px; }
        .hierarchy-controls { margin-bottom: 15px; display: flex; gap: 10px; justify-content: flex-end; }
        .weight-warning { color: #fb8c00; font-weight: 600; margin-top: 5px; }
    `;
    frappe.dom.set_style(css, 'project-hierarchy-style');
}

function validate_total_weight(frm, new_weight, exclude_task = null) {
    return frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Task",
            filters: {
                project: frm.doc.name,
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
                project: frm.doc.name,
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
                project: frm.doc.name,
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
            filters: { project: frm.doc.name },
            fields: [
                "name", "subject", "parent_task", "status", "priority",
                "description", "task_weight", "custom_is_stage",
                "custom_is_task", "custom_is_subtask", "expected_time", "exp_end_date","progress","custom_total_labour_cost","custom_total_equipment_cost"
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

            Object.values(stages).forEach(stage => {

                let stage_labour_total = 0;
                let stage_equipment_total = 0;

                stage.tasks.forEach(taskObj => {

                    let task_labour_total = 0;
                    let task_equipment_total = 0;

                    taskObj.subtasks.forEach(sub => {
                        task_labour_total += flt(sub.custom_total_labour_cost || 0);
                        task_equipment_total += flt(sub.custom_total_equipment_cost || 0);
                    });

                    taskObj.data.custom_total_labour_cost = task_labour_total;
                    taskObj.data.custom_total_equipment_cost = task_equipment_total;

                    stage_labour_total += task_labour_total;
                    stage_equipment_total += task_equipment_total;
                });

                stage.data.custom_total_labour_cost = stage_labour_total;
                stage.data.custom_total_equipment_cost = stage_equipment_total;
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

                        
                            html += render_total_row(
                                "subtask percentage",
                                subtask_total.toFixed(2),
                                80
                            );
                        }
                    });

                    
                    let task_weight_sum = 0;
                    stageObj.tasks.forEach(tObj => {
                        task_weight_sum += flt(tObj.data.task_weight || 0);
                    });
                    html += render_total_row(
                        "Total task percentage",
                        task_weight_sum.toFixed(2),
                        40
                    );
                }
            });

        
            html += render_total_row(
                "stage percentage",
                overall_stage_total.toFixed(2),
                0
            );

            html += "</div>";
            frm.fields_dict.custom_task_hierarchy.$wrapper.html(html);
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
    let border_color = type === "stage" ? "#ffffff" : (type === "task" ? "#4FC3F7" : "#B0BEC5");
    let bg = "#1a365d";
    let color = "#ffffff";
    let btnClass = "btn-light";

    let icon = "";
    if (type !== "subtask") {
        icon = is_expanded ? "▼" : "▶";
    }

    let weight = item.task_weight || 0;
    let progress_color = "#fb8c00"; 
    if (weight >= 100) progress_color = "#2ecc71";
    else if (weight > 70) progress_color = "#27ae60";
    else if (weight > 30) progress_color = "#f1c40f";

    let progress_bar = `
    <div style="margin-top:6px;width:150px;background:#eee;border-radius:6px;height:6px;">
    <div style="width:${weight}%;background:${progress_color};height:6px;border-radius:6px;"></div>
    </div>
    `;

    let cost_html = "";

    if (type === "stage" || type === "task" || type === "subtask") {
        cost_html = `
            <div style="font-size:11px; margin-top:4px; opacity:0.9;">
                Labour Cost: ₹ ${flt(item.custom_total_labour_cost || 0).toFixed(2)}
                &nbsp; | &nbsp;
                Equipment Cost: ₹ ${flt(item.custom_total_equipment_cost || 0).toFixed(2)}
            </div>
        `;
    }

    return `
    <div class="hierarchy-row" data-name="${item.name}" data-type="${type}" style="margin-left:${margin}; margin-top:10px; padding:12px; background:${bg}; color:${color}; border-left: 6px solid ${border_color}; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
      
      <div class="hover-details">
         <div style="border-bottom: 1px solid #444; margin-bottom: 5px; font-weight: bold; padding-bottom: 3px;">${item.name}</div>
         <div><span class="detail-label">Status:</span> ${item.status || 'Open'}</div>
         <div><span class="detail-label">Priority:</span> ${item.priority || 'Medium'}</div>
         <div><span class="detail-label">Weight:</span> ${item.task_weight || 0}</div>
         <div><span class="detail-label">Progress %:</span> ${item.progress || 0}</div>
         <div style="margin-top:5px; font-style: italic; color: #ecf0f1;">${item.description || 'No description provided.'}</div>
      </div>

      <div class="toggle-node" style="display:flex; align-items:center; flex-grow:1;">
        <span class="toggle-icon" style="color: #ffffff;">${icon}</span>
        <div>
          <div style="font-weight:600; font-size:${type === 'stage' ? '16px' : '14px'};">${item.subject}</div>
          <div style="font-size:11px; opacity:0.7;">${item.name}</div>
            ${progress_bar}
            ${cost_html}
        </div>
      </div>

      <div style="display:flex; gap:5px; align-items:center;">
        <button class="btn ${btnClass} btn-xs redirect-item" data-name="${item.name}" title="Open Form View"> Redirect</button>
        <button class="btn ${btnClass} btn-xs edit-item" data-name="${item.name}">✏ Edit</button>
        <button class="btn ${btnClass} btn-xs assign-item" data-name="${item.name}">👤 Assign</button>
        <button class="btn ${btnClass} btn-xs delete-item" data-name="${item.name}">🗑 Delete</button>
        ${type === "stage" ? `<button class="btn ${btnClass} btn-xs add-task" data-stage="${item.name}">+ Task</button>` : ""}
        ${type === "task" ? `<button class="btn ${btnClass} btn-xs add-subtask" data-task="${item.name}">+ Subtask</button>` : ""}
          
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
    const wrapper = frm.fields_dict.custom_task_hierarchy.$wrapper;
        
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

    
    wrapper.find(".expand-all").off("click").on("click", function () {
        all_tasks.forEach(t => {
            if (t.custom_is_stage || t.custom_is_task)
                expanded_nodes.add(t.name);
        });
        load_hierarchy(frm);
    });

    
    wrapper.find(".collapse-all").off("click").on("click", function () {
        expanded_nodes.clear();
        load_hierarchy(frm);
    });

    
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
                            custom_is_stage: 1,
                            is_template: 1
                        }
                    };
                }
            },

            {
                label: "Include Dependencies",
                fieldname: "include_dependencies",
                fieldtype: "Check",
                default: 0,
                depends_on: "eval:doc.existing_stage"
            },

            {
                label: "Include Subtasks",
                fieldname: "include_children",
                fieldtype: "Check",
                default: 0,
                depends_on: "eval:doc.existing_stage"
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

        
            if (values.existing_stage) {

                frappe.call({
                    method: "quantbit_construction_management.api.clone_task_hierarchy",
                    args: {
                        source_task: values.existing_stage,
                        target_project: frm.doc.name,
                        include_dependencies: values.include_dependencies,
                        include_children: values.include_children
                    },
                    callback: function (r) {
                        if (r.message) {
                            frappe.show_alert({
                                message: __("New Stage Created from existing Stage"),
                                indicator: "green"
                            });
                            d.hide();
                            load_hierarchy(frm);
                        }
                    }
                });

                return;

            }

    
            if (!values.subject || !values.task_weight) {

                frappe.msgprint("Enter stage details");

                return;

            }

            validate_total_weight(frm, values.task_weight)
                .then(result => {
                    if (!result.valid) {
                        frappe.msgprint(__("Total weight of stages cannot exceed 100%. Current total: {0}%", [result.current_total]));
                        return;
                    }

                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                doctype: "Task",
                                subject: values.subject,
                                project: frm.doc.name,
                                custom_is_stage: 1,
                                is_group: 1,
                                is_template: 1,
                                task_weight: values.task_weight,
                                description: values.description
                            }
                        },
                        callback: function (r) {
                            frappe.show_alert({
                                message: __("Stage Created"),
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
                        filters: {
                            custom_is_task: 1,
                            is_template: 1
                        }
                    };
                }
            },

            {
                label: "Include Subtasks",
                fieldname: "include_children",
                fieldtype: "Check",
                default: 0,
                depends_on: "eval:doc.existing_task"
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
                    method: "quantbit_construction_management.api.clone_task_hierarchy",
                    args: {
                        source_task: values.existing_task,
                        target_project: frm.doc.name,
                        parent_task: stage,
                        include_children: values.include_children
                    },
                    callback() {
                        frappe.show_alert("New Task Created from existing Task");
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
                                project: frm.doc.name,
                                parent_task: stage,
                                custom_is_task: 1,
                                is_group: 1,
                                is_template: 1,
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
                get_query() {
                    return {
                        filters: {
                            custom_is_subtask: 1,
                            is_template: 1
                        }
                    };
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
                label: "Description",
                fieldname: "description",
                fieldtype: "Small Text"
            }

        ],

        primary_action_label: "Add",

        primary_action(values) {

          
            if (values.existing_subtask) {

                frappe.call({
                    method: "quantbit_construction_management.api.clone_task_hierarchy",
                    args: {
                        source_task: values.existing_subtask,
                        target_project: frm.doc.name,
                        parent_task: parent_task
                    },
                    callback() {
                        frappe.show_alert("New Subtask Created from existing Subtask");
                        d.hide();
                        load_hierarchy(frm);
                    }
                });

                return;
            }

           
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
                            project: frm.doc.name,
                            parent_task: parent_task,
                            custom_is_subtask: 1,
                            is_template: 1,
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

    
    wrapper.find(".delete-item").off("click").on("click", function (e) {
        e.stopPropagation();
        let docname = $(this).data("name");

        
        let has_children = all_tasks.some(t => t.parent_task === docname);

        if (has_children) {
            frappe.msgprint({
                title: __("Cannot Delete"),
                message: __("This item has children (Tasks or Subtasks). Please delete the children first."),
                indicator: "orange"
            });
            return;
        }

       
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Task Depends On",
                filters: { task: docname },
                fields: ["parent"]
            },
            callback: function (r) {
                if (r.message && r.message.length > 0) {
                    let dependents = r.message.map(d => d.parent).join(", ");
                    frappe.msgprint({
                        title: __("Cannot Delete"),
                        message: __("This task is a dependency for the following tasks: <b>{0}</b>. Please remove these dependencies first.", [dependents]),
                        indicator: "orange"
                    });
                    return;
                }

                frappe.confirm(__('Are you sure you want to delete {0}?', [docname]), () => {
                    frappe.call({
                        method: "frappe.client.delete",
                        args: {
                            doctype: "Task",
                            name: docname
                        },
                        callback: function () {
                            frappe.show_alert({ message: __("Task Deleted"), indicator: "red" });
                            load_hierarchy(frm);
                        }
                    });
                });
            }
        });
    });
}
