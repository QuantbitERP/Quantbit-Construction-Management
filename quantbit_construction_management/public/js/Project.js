window.expanded_nodes = window.expanded_nodes || new Set();
window.last_project_progress =
    window.last_project_progress || null;

frappe.ui.form.on('Project', {
    refresh: function (frm) {
        inject_hierarchy_css();
        if (frm.doc.custom_report_name_) {
            render_report_view(frm);
        }
        if (frm.doc.custom_bill_of_quantities && typeof load_hierarchy === "function") {
            load_hierarchy(frm);
        }
    },
    custom_report_name_: function (frm) {
        if (frm.doc.custom_report_name_) {
            render_report_view(frm);
        } else {
            frm.set_value('custom_html_view', '');
        }
    },
    custom_bill_of_quantities: function (frm) {
        if (!frm.doc.custom_bill_of_quantities) {
            frm.fields_dict.custom_task_hierarchy.$wrapper.html('');
        }
    },
    custom_get_details: function (frm) {
        if (!frm.doc.custom_bill_of_quantities) {
            frappe.msgprint(__("Please select a Bill of Quantities first."));
            return;
        }
        if (frm.is_new() || frm.is_dirty()) {
            frm.save().then(() => {
                link_and_load_hierarchy(frm);
            });
        } else {
            link_and_load_hierarchy(frm);
        }
    }
});

function link_and_load_hierarchy(frm) {
    frappe.call({
        method: "quantbit_construction_management.api.link_boq_tasks_to_project",
        args: {
            boq_name: frm.doc.custom_bill_of_quantities,
            project_name: frm.doc.name
        },
        callback: function (r) {
            if (r.message && typeof load_hierarchy === "function") {
                load_hierarchy(frm);
            }
        }
    });
}

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
        callback: function (r) {
            if (r.message) {
                let msg = r.message;
                let html = typeof msg === 'string' ? msg : msg.html;

                frm.set_df_property('custom_html_view', 'options', html);
                frm.refresh_field('custom_html_view');

                if (msg.status === "preparing") {
                    setTimeout(() => {
                        if (frm.doc.custom_report_name_) {
                            render_report_view(frm);
                        }
                    }, 5000);
                }
            }
        }
    });
}

// frappe.realtime.on("project_progress_refresh", (data) => {
//     if (!cur_frm || cur_frm.doc.doctype !== "Project") return;
//     if (cur_frm.doc.name === data.project) {
//         load_hierarchy(cur_frm);
//     }
// });

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

// ─── Determine node type from flags ──────────────────────────────────────────
function get_node_type(node) {
    if (node.custom_is_stage == 1) return "stage";
    if (node.custom_is_task == 1) return "task";
    if (node.custom_is_subtask == 1) return "subtask";
    // fallback: infer from depth if flags are missing
    return "task";
}

function validate_total_weight(frm, new_weight, exclude_task = null) {
    return frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Task",
            filters: frm.doc.custom_bill_of_quantities
                ? { custom_boq_name: frm.doc.custom_bill_of_quantities, custom_is_stage: 1 }
                : { project: frm.doc.name, custom_is_stage: 1 },
            fields: ["name", "task_weight"]
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
            filters: frm.doc.custom_bill_of_quantities
                ? { custom_boq_name: frm.doc.custom_bill_of_quantities, parent_task: stage_name, custom_is_task: 1 }
                : { project: frm.doc.name, parent_task: stage_name, custom_is_task: 1 },
            fields: ["name", "task_weight"]
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
            filters: frm.doc.custom_bill_of_quantities
                ? { custom_boq_name: frm.doc.custom_bill_of_quantities, parent_task: task_name, custom_is_subtask: 1 }
                : { project: frm.doc.name, parent_task: task_name, custom_is_subtask: 1 },
            fields: ["name", "task_weight"]
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

// ─── Build a recursive tree from flat task list ───────────────────────────────
function build_tree(tasks) {
    let taskMap = {};
    tasks.forEach(t => {
        taskMap[t.name] = { ...t, children: [] };
    });

    let roots = [];
    tasks.forEach(t => {
        if (!t.parent_task) {
            roots.push(taskMap[t.name]);
        } else if (taskMap[t.parent_task]) {
            taskMap[t.parent_task].children.push(taskMap[t.name]);
        }
    });

    return roots;
}

// ─── Recursively compute cost rollups ────────────────────────────────────────
function compute_costs(node) {
    if (!node.children || node.children.length === 0) {
        return {
            labour: flt(node.custom_total_labour_cost || 0),
            equipment: flt(node.custom_total_equipment_cost || 0),
            material: flt(node.custom_total_material_cost || 0)
        };
    }

    let labour = 0, equipment = 0, material = 0;
    node.children.forEach(child => {
        let c = compute_costs(child);
        labour += c.labour;
        equipment += c.equipment;
        material += c.material;
    });

    node.custom_total_labour_cost = labour;
    node.custom_total_equipment_cost = equipment;
    node.custom_total_material_cost = material;

    return { labour, equipment, material };
}
function get_descendant_count(node) {

    if (!node.children || !node.children.length) {
        return node.custom_is_subtask ? 1 : 0;
    }

    let total = 0;

    node.children.forEach(child => {
        total += get_descendant_count(child);
    });

    return total;
}
function calculate_progress(node) {
    // Leaf node (subtask)
    if (!node.children || node.children.length === 0) {
        return flt(node.progress || 0);
    }
    let total_progress = 0;
    node.children.forEach(child => {
        let child_progress = calculate_progress(child);
        total_progress += (
            flt(child.task_weight || 0) *
            flt(child_progress)
        ) / 100;

    });
    node.calculated_progress = total_progress;
    frappe.call({
        method: "frappe.client.set_value",
        args: {
            doctype: "Task",
            name: node.name,
            fieldname: {
                progress: flt(total_progress)
            }
        }
    });
    return total_progress;
}
function calculate_project_progress(roots) {
    let project_progress = 0;
    roots.forEach(stage => {
        let stage_progress =
            flt(stage.calculated_progress || 0);

        project_progress += (
            flt(stage.task_weight || 0) *
            stage_progress
        ) / 100;

    });

    return project_progress;
}
// ─── Border colors by node type ──────────────────────────────────────────────
function get_border_color(node_type) {
    if (node_type === "stage") return "#ffffff";
    if (node_type === "task") return "#4FC3F7";
    if (node_type === "subtask") return "#B0BEC5";
    return "#FFD54F";
}

// ─── Render a single node row (recursive) ────────────────────────────────────
function render_node(node, depth, frm) {
    let margin = depth * 28;

    // ── Determine type from flags ──────────────────────────────────────────
    let node_type = get_node_type(node);
    let border_color = get_border_color(node_type);

    let has_children = node.children && node.children.length > 0;
    let descendant_count = get_descendant_count(node);

    if (node.custom_is_subtask) {
        descendant_count = 0;
    }
    let is_expanded = expanded_nodes.has(node.name);

    let icon = has_children ? (is_expanded ? "▼" : "▶") : "•";

    // let progress = flt(node.progress || 0);
    let progress = flt(
        node.calculated_progress != null
            ? node.calculated_progress
            : node.progress || 0
    );
    let progress_color = "#fb8c00";
    if (progress >= 100) progress_color = "#2ecc71";
    else if (progress > 70) progress_color = "#27ae60";
    else if (progress > 30) progress_color = "#f1c40f";

    let progress_bar = `
        <div style="margin-top:6px;width:150px;background:#eee;border-radius:6px;height:6px;">
            <div style="width:${progress}%;background:${progress_color};height:6px;border-radius:6px;"></div>
        </div>`;

    let cost_html = `
        <div style="font-size:11px; margin-top:4px; opacity:0.9;">
            Labour Cost: ₹ ${flt(node.custom_total_labour_cost || 0).toFixed(2)}
            &nbsp;|&nbsp;
            Equipment Cost: ₹ ${flt(node.custom_total_equipment_cost || 0).toFixed(2)}
            &nbsp;|&nbsp;
            Material Cost: ₹ ${flt(node.custom_total_material_cost || 0).toFixed(2)}
        </div>`;

    // ── Add-child button based on type flag ───────────────────────────────
    let add_child_btn = "";
    if (node_type === "stage") {
        add_child_btn = `<button class="btn btn-light btn-xs add-task" data-stage="${node.name}">+ Task</button>`;
    } else if (node_type === "task") {
        add_child_btn = `
            <button class="btn btn-light btn-xs add-child-task" data-parent="${node.name}">+ Child Task</button>
            <button class="btn btn-light btn-xs add-subtask" data-task="${node.name}">+ Subtask</button>`;
    }
    // subtask gets no add button
    let bg =
        node_type === "stage"
            ? "#1a365d"
            : node_type === "task"
                ? "#e9c46a"
                : "#fdf6e3";

    let textColor =
        node_type === "stage"
            ? "#ffffff"
            : "#333333";

    let html = `
    <div class="hierarchy-row"
        data-name="${node.name}"
        data-depth="${depth}"
        data-type="${node_type}"
        style="margin-left:${margin}px;
            margin-top:10px;
            padding:12px;
            background:${bg};
            color:${textColor};
            border-radius:8px;
            display:flex;
            justify-content:space-between;
            align-items:center;">

        <div class="hover-details">
            <div style="border-bottom:1px solid #444; margin-bottom:5px; font-weight:bold; padding-bottom:3px;">${node.name}</div>
            <div><span class="detail-label">Status:</span> ${node.status || 'Open'}</div>
            <div><span class="detail-label">Priority:</span> ${node.priority || 'Medium'}</div>
            <div><span class="detail-label">Weight:</span> ${node.task_weight || 0}</div>
            <div><span class="detail-label">Progress %:</span> ${node.progress || 0}</div>
            <div style="margin-top:5px; font-style:italic; color:#ecf0f1;">${node.description || 'No description provided.'}</div>
        </div>

        <div class="toggle-node" style="display:flex; align-items:center; flex-grow:1;">
            <span class="toggle-icon" style="color:#ffffff;">${icon}</span>
            <div>
                <div style="font-weight:600; font-size:${node_type === 'stage' ? '16px' : '14px'};">${node.subject}</div>
                <div style="font-size:11px; opacity:0.7;">${node.name}</div>
                ${progress_bar}
                ${cost_html}
            </div>
        </div>

        <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
            <button class="btn btn-success btn-xs" title="Progress">${progress.toFixed(2)}%</button>
            <button class="btn btn-light btn-xs redirect-item" data-name="${node.name}" title="Open Form View">Show Details</button>
            ${!node.custom_is_subtask ? `
    <button class="btn btn-light btn-xs edit-item"
        data-name="${node.name}"
        title="Edit">
        ✏ Edit
    </button>
` : ""}
            <button class="btn btn-light btn-xs assign-item" data-name="${node.name}">👤 Assign</button>
            <button class="btn btn-light btn-xs delete-item" data-name="${node.name}">🗑 Delete</button>
            <button class="btn btn-light btn-xs update-item" data-name="${node.name}" title="Update" style="${node.custom_is_subtask ? '' : 'display:none;'}">⬆ Update</button>
            ${add_child_btn}
            ${!node.custom_is_subtask && descendant_count > 0 ? `<button class="btn btn-info btn-xs" title="Descendant Count">${descendant_count}</button>` : ''}
            <button class="btn btn-warning btn-xs show-weight" data-name="${node.name}" title="Weight">${node.task_weight || 0}%</button>
        </div>
    </div>`;

    // Recursively render children if expanded
    if (is_expanded && has_children) {
        node.children.forEach(child => {
            html += render_node(child, depth + 1, frm);
        });

        // Show child weight total
        node.children.forEach(child => {
            html += render_total_row(
                child.subject,
                flt(child.task_weight || 0).toFixed(2),
                ((depth + 1) * 35) + 28
            );
        });
    }

    return html;
}
// ─── Main load function ───────────────────────────────────────────────────────
function load_hierarchy(frm) {
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Task",
            filters: frm.doc.custom_bill_of_quantities
                ? { custom_boq_name: frm.doc.custom_bill_of_quantities }
                : { project: frm.doc.name },
            fields: [
                "name", "subject", "parent_task", "status", "priority",
                "description", "task_weight", "custom_is_stage",
                "custom_is_task", "custom_is_subtask", "expected_time",
                "exp_end_date", "progress",
                "custom_total_labour_cost", "custom_total_equipment_cost", "custom_total_material_cost"
            ],
            order_by: "creation asc",
            limit_page_length: 1000
        },
        callback: function (r) {
            if (!r.message) return;
            const tasks = r.message;
            // Build recursive tree
            let roots = build_tree(tasks);
            roots.forEach(root => {
                compute_costs(root);
                calculate_progress(root);
            });
            let project_progress = calculate_project_progress(roots);
            let progress_value = flt(project_progress);
            if (
                window.last_project_progress === null ||
                Math.abs(
                    flt(window.last_project_progress) -
                    progress_value
                ) > 0.01
            ) {

                window.last_project_progress =
                    progress_value;
                frappe.call({
                    method: "frappe.client.set_value",
                    args: {
                        doctype: "Project",
                        name: frm.doc.name,
                        fieldname: {
                            percent_complete: progress_value
                        }
                    },
                    callback: function () {
                        frm.doc.percent_complete = progress_value;
                    }
                });
            }
            // Roll up costs recursively
            roots.forEach(root => compute_costs(root));

            let html = `<div style="padding:15px;">
                <div class="hierarchy-controls">
                    <button class="btn btn-default btn-xs expand-all">Expand All</button>
                    <button class="btn btn-default btn-xs collapse-all">Collapse All</button>
                    <button class="btn btn-primary btn-xs add-stage">+ Add Stage</button>
                </div>`;

            // Total weight of root-level nodes (stages)
            let overall_stage_total = roots.reduce((sum, r) => sum + flt(r.task_weight || 0), 0);

            roots.forEach(root => {
                html += render_node(root, 0, frm);
            });

            roots.forEach(root => {
                html += render_total_row(
                    root.subject,
                    flt(root.task_weight || 0).toFixed(2),
                    0
                );
            });
            html += "</div>";

            frm.fields_dict.custom_task_hierarchy.$wrapper.html(html);
            attach_events(frm, tasks);
        }
    });
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
    </div>`;
}
function open_edit_task_dialog(frm, docname, node_type) {

    let type_label =
        node_type === "stage" ? "Stage" :
            node_type === "task" ? "Task" :
                "Subtask";

    frappe.db.get_doc("Task", docname).then(doc => {

        frappe.prompt([
            {
                label: "Name",
                fieldname: "subject",
                fieldtype: "Data",
                default: doc.subject,
                reqd: 1
            },
            {
                label: "Status",
                fieldname: "status",
                fieldtype: "Select",
                options: ["Open", "Working", "Completed", "Cancelled"],
                default: doc.status
            },
            {
                label: "Priority",
                fieldname: "priority",
                fieldtype: "Select",
                options: ["Low", "Medium", "High", "Urgent"],
                default: doc.priority
            },
            {
                label: "Weightage*",
                fieldname: "task_weight",
                fieldtype: "Float",
                default: doc.task_weight
            },
            {
                label: "Description",
                fieldname: "description",
                fieldtype: "Small Text",
                default: doc.description
            }
        ], function (values) {

            frappe.call({
                method: "frappe.client.set_value",
                args: {
                    doctype: "Task",
                    name: docname,
                    fieldname: values
                },
                callback: function () {
                    frappe.show_alert({
                        message: __("{0} Updated", [type_label]),
                        indicator: "green"
                    });

                    load_hierarchy(frm);
                }
            });

        }, `Edit ${type_label}`);

    });
}

function attach_events(frm, all_tasks) {
    const wrapper = frm.fields_dict.custom_task_hierarchy.$wrapper;

    // ── Toggle expand/collapse ───────────────────────────────────────────────
    wrapper.find(".toggle-node").off("click").on("click", function (e) {
        e.stopPropagation();
        let row = $(this).closest(".hierarchy-row");
        let name = row.data("name");
        let type = row.data("type");

        // Subtasks have no children to expand
        if (type === "subtask") return;

        expanded_nodes.has(name)
            ? expanded_nodes.delete(name)
            : expanded_nodes.add(name);

        load_hierarchy(frm);
    });

    // ── Expand All ───────────────────────────────────────────────────────────
    wrapper.find(".expand-all").off("click").on("click", function () {
        all_tasks.forEach(t => expanded_nodes.add(t.name));
        load_hierarchy(frm);
    });

    // ── Collapse All ─────────────────────────────────────────────────────────
    wrapper.find(".collapse-all").off("click").on("click", function () {
        expanded_nodes.clear();
        load_hierarchy(frm);
    });
    // DELETE TASK
    wrapper.find(".delete-item").off("click").on("click", function (e) {

        e.stopPropagation();

        let task_name = $(this).data("name");

        frappe.confirm(
            __("Delete this task and all child tasks?"),
            function () {

                frappe.call({
                    method: "quantbit_construction_management.api.delete_task_with_dependencies",
                    args: {
                        task_name: task_name
                    },
                    freeze: true,
                    freeze_message: __("Deleting Task..."),

                    callback: function (r) {
                        frappe.show_alert({
                            message: __("Task Deleted"),
                            indicator: "red"
                        });

                        expanded_nodes.delete(task_name);

                        load_hierarchy(frm);
                    }
                });

            }
        );

    });

    // ── Add Stage ────────────────────────────────────────────────────────────
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
                        return { filters: { custom_is_stage: 1, is_template: 1 } };
                    }
                },
                {
                    label: "Weight",
                    fieldname: "existing_stage_weight",
                    fieldtype: "Float",
                    depends_on: "eval:doc.existing_stage",
                    reqd: 0
                },
                {
                    label: "Include Tasks",
                    fieldname: "include_tasks",
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
                { fieldtype: "Section Break" },
                {
                    label: "OR Create New Stage",
                    fieldname: "section_label",
                    fieldtype: "HTML",
                    options: "<b>Create New Stage</b>"
                },
                { label: "Stage Name", fieldname: "subject", fieldtype: "Data" },
                { label: "Weightage", fieldname: "task_weight", fieldtype: "Float" },
                { label: "Description", fieldname: "description", fieldtype: "Small Text" }
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
                            include_children: values.include_children,
                            task_weight: values.existing_stage_weight,
                            custom_boq_name: frm.doc.custom_bill_of_quantities,
                        },
                        callback: function (r) {
                            if (r.message) {
                                frappe.show_alert({ message: __("New Stage Created from existing Stage"), indicator: "green" });
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

                validate_total_weight(frm, values.task_weight).then(result => {
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
                                custom_boq_name: frm.doc.custom_bill_of_quantities || null,
                                custom_is_stage: 1,
                                is_group: 1,
                                task_weight: values.task_weight,
                                description: values.description
                            }
                        },
                        callback: function () {
                            frappe.show_alert({ message: __("Stage Created"), indicator: "green" });
                            d.hide();
                            load_hierarchy(frm);
                        }
                    });
                });
            }
        });
        d.show();
    });

    // ── Add Task (under a Stage) ─────────────────────────────────────────────
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
                        return { filters: { custom_is_task: 1, is_template: 1 } };
                    }
                },
                {
                    label: "Weight",
                    fieldname: "existing_task_weight",
                    fieldtype: "Float",
                    depends_on: "eval:doc.existing_task"
                },
                {
                    label: "Include Subtasks",
                    fieldname: "include_children",
                    fieldtype: "Check",
                    default: 0,
                    depends_on: "eval:doc.existing_task"
                },
                { label: "OR Create New Task", fieldname: "section_break", fieldtype: "Section Break" },
                { label: "Task Name", fieldname: "subject", fieldtype: "Data" },
                { label: "Weight", fieldname: "task_weight", fieldtype: "Float" },
                { label: "Description", fieldname: "description", fieldtype: "Data" }
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
                            include_children: values.include_children,
                            task_weight: values.existing_task_weight,
                            custom_boq_name: frm.doc.custom_bill_of_quantities
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

                validate_task_weight(frm, stage, values.task_weight).then(result => {
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
                                custom_boq_name: frm.doc.custom_bill_of_quantities || null,
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

    // ── Add Child Task (task inside another task) ────────────────────────────
    wrapper.find(".add-child-task").off("click").on("click", function (e) {
        e.stopPropagation();
        let parent_name = $(this).data("parent");

        let d = new frappe.ui.Dialog({
            title: "Add Child Task",
            fields: [
                {
                    label: "Select Existing Task",
                    fieldname: "existing_task",
                    fieldtype: "Link",
                    options: "Task",
                    get_query() {
                        return { filters: { custom_is_task: 1 } };
                    }
                },
                {
                    label: "Weight",
                    fieldname: "existing_task_weight",
                    fieldtype: "Float",
                    depends_on: "eval:doc.existing_task"
                },
                {
                    label: "Include Subtasks",
                    fieldname: "include_children",
                    fieldtype: "Check",
                    default: 0,
                    depends_on: "eval:doc.existing_task"
                },
                { fieldtype: "Section Break" },
                {
                    label: "OR Create New Child Task",
                    fieldname: "section_label",
                    fieldtype: "HTML",
                    options: "<b>Create New Child Task</b>"
                },
                { label: "Task Name", fieldname: "subject", fieldtype: "Data" },
                { label: "Weight", fieldname: "task_weight", fieldtype: "Float" },
                { label: "Description", fieldname: "description", fieldtype: "Small Text" }
            ],
            primary_action_label: "Add",
            primary_action(values) {
                if (values.existing_task) {
                    frappe.call({
                        method: "quantbit_construction_management.api.clone_task_hierarchy",
                        args: {
                            source_task: values.existing_task,
                            target_project: frm.doc.name,
                            parent_task: parent_name,
                            include_children: values.include_children,
                            task_weight: values.existing_task_weight,
                            custom_boq_name: frm.doc.custom_bill_of_quantities,
                        },
                        callback() {
                            frappe.show_alert("Child Task Created from existing Task");
                            d.hide();
                            expanded_nodes.add(parent_name);
                            load_hierarchy(frm);
                        }
                    });
                    return;
                }

                if (!values.subject) {
                    frappe.msgprint("Enter task name");
                    return;
                }

                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Task",
                            subject: values.subject,
                            project: frm.doc.name,
                            parent_task: parent_name,
                            custom_is_task: 1,
                            is_group: 1,
                            task_weight: values.task_weight || 0,
                            description: values.description
                        }
                    },
                    callback() {
                        frappe.show_alert({ message: "Child Task Created", indicator: "green" });
                        expanded_nodes.add(parent_name);
                        d.hide();
                        load_hierarchy(frm);
                    }
                });
            }
        });
        d.show();
    });

    // ── Add Subtask ──────────────────────────────────────────────────────────
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
                        return { filters: { custom_is_subtask: 1, is_template: 1 } };
                    }
                },
                {
                    label: "Weight",
                    fieldname: "existing_subtask_weight",
                    fieldtype: "Float",
                    depends_on: "eval:doc.existing_subtask"
                },
                { fieldtype: "Section Break" },
                {
                    label: "OR Create New Subtask",
                    fieldname: "section_label",
                    fieldtype: "HTML",
                    options: "<b>Create New Subtask</b>"
                },
                { label: "Subtask Name", fieldname: "subject", fieldtype: "Data" },
                { label: "Weight", fieldname: "task_weight", fieldtype: "Float" },
                { label: "Description", fieldname: "description", fieldtype: "Small Text" }
            ],
            primary_action_label: "Add",
            primary_action(values) {
                if (values.existing_subtask) {
                    frappe.call({
                        method: "quantbit_construction_management.api.clone_task_hierarchy",
                        args: {
                            source_task: values.existing_subtask,
                            target_project: frm.doc.name,
                            parent_task: parent_task,
                            task_weight: values.existing_subtask_weight,
                            custom_boq_name: frm.doc.custom_bill_of_quantities
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

                validate_subtask_weight(frm, parent_task, values.task_weight).then(result => {
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
                                custom_boq_name: frm.doc.custom_bill_of_quantities || null,
                                parent_task: parent_task,
                                custom_is_subtask: 1,
                                task_weight: values.task_weight,
                                description: values.description
                            }
                        },
                        callback() {
                            frappe.show_alert({ message: "Subtask Created", indicator: "green" });
                            d.hide();
                            load_hierarchy(frm);
                        }
                    });
                });
            }
        });
        d.show();
    });

    // ── Edit ─────────────────────────────────────────────────────────────────
    wrapper.find(".edit-item").off("click").on("click", function (e) {
        e.stopPropagation();
        let row = $(this).closest(".hierarchy-row");
        let docname = row.data("name");
        // ── Use data-type (from flags) instead of data-depth ──────────────
        let node_type = row.data("type");

        let type_label =
            node_type === "stage" ? "Stage" :
                node_type === "task" ? "Task" :
                    "Subtask";

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
                { label: "Weight", fieldname: "task_weight", fieldtype: "Float", default: doc.task_weight },
                { label: "Description", fieldname: "description", fieldtype: "Small Text", default: doc.description }
            ], function (values) {

                function update_task_values() {
                    frappe.call({
                        method: "frappe.client.set_value",
                        args: { doctype: "Task", name: docname, fieldname: values },
                        callback: function () {
                            frappe.show_alert({ message: __("{0} Updated", [type_label]), indicator: "green" });
                            load_hierarchy(frm);
                        }
                    });
                }

                // ── Weight validation by type flag ────────────────────────
                if (node_type === "stage") {
                    frappe.call({
                        method: "frappe.client.get",
                        args: { doctype: "Task", name: docname },
                        callback: function (r) {
                            validate_total_weight(frm, values.task_weight, docname).then(result => {
                                if (!result.valid) {
                                    frappe.msgprint({
                                        title: __("Weight Limit Exceeded"),
                                        message: __("Cannot update stage. Current total: {0}%, New total would be: {1}%. Remaining: {2}%",
                                            [result.current_total.toFixed(2), result.projected_total.toFixed(2), result.remaining.toFixed(2)]),
                                        indicator: "red"
                                    });
                                    return;
                                }
                                update_task_values();
                            });
                        }
                    });
                } else if (node_type === "task") {
                    frappe.call({
                        method: "frappe.client.get",
                        args: { doctype: "Task", name: docname },
                        callback: function (r) {
                            validate_task_weight(frm, r.message.parent_task, values.task_weight, docname).then(result => {
                                if (!result.valid) {
                                    frappe.msgprint({
                                        title: __("Weight Limit Exceeded"),
                                        message: __("Cannot update task. Current total: {0}%, New total would be: {1}%. Remaining: {2}%",
                                            [result.current_total.toFixed(2), result.projected_total.toFixed(2), result.remaining.toFixed(2)]),
                                        indicator: "red"
                                    });
                                    return;
                                }
                                update_task_values();
                            });
                        }
                    });
                } else if (node_type === "subtask") {
                    frappe.db.get_value("Task", docname, "parent_task").then(r => {
                        if (r.message && r.message.parent_task) {
                            validate_subtask_weight(frm, r.message.parent_task, values.task_weight, docname).then(result => {
                                if (!result.valid) {
                                    frappe.msgprint({
                                        title: __("Subtask Weight Limit Exceeded"),
                                        message: __("Cannot update subtask. Current total: {0}%, New total would be: {1}%. Remaining: {2}%",
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

            }, `Edit ${type_label}`);
        });
    });

    // ── Redirect ─────────────────────────────────────────────────────────────
    wrapper.find(".redirect-item").off("click").on("click", function (e) {
        e.stopPropagation();
        let docname = $(this).data("name");
        frappe.set_route("Form", "Task", docname);
    });

    // ── Assign ───────────────────────────────────────────────────────────────
    wrapper.find(".assign-item").off("click").on("click", function (e) {
        e.stopPropagation();
        let docname = $(this).closest(".hierarchy-row").data("name");

        frappe.db.get_doc("Task", docname).then(doc => {
            let d = new frappe.ui.Dialog({
                title: "Assign Task",
                fields: [
                    { label: "Assign To", fieldname: "assign_to", fieldtype: "Link", options: "User", reqd: 1 },
                    { label: "Hours", fieldname: "expected_time", fieldtype: "Float", default: doc.expected_time || 0 },
                    { label: "End Date", fieldname: "exp_end_date", fieldtype: "Date", default: doc.exp_end_date }
                ],
                primary_action_label: "Assign",
                primary_action(values) {
                    frappe.call({
                        method: "frappe.client.set_value",
                        args: {
                            doctype: "Task",
                            name: docname,
                            fieldname: { expected_time: values.expected_time, exp_end_date: values.exp_end_date }
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
                                    frappe.show_alert({ message: __("Task Assigned to ") + values.assign_to, indicator: "green" });
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

    // ── Update ───────────────────────────────────────────────────────────────
    wrapper.find(".update-item").off("click").on("click", function (e) {
        e.stopPropagation();
        let task_name = $(this).data("name");

        frappe.db.get_value("Task", task_name, ["project", "subject", "parent_task"]).then(r => {
            let project = r.message && r.message.project;
            let task_subject = r.message && r.message.subject;

            const options = [
                { key: "edit", label: "✏ Edit Task" },
                { key: "manpower", label: "Manpower Usage", doctype: "Manpower Usage" },
                { key: "equipment", label: "Equipment Usage", doctype: "Equipment Usage" },
                { key: "progress", label: "Task Progress", doctype: "Task Progress" },
                { key: "material", label: "Material Consumed", doctype: "Stock Entry" },
                { key: "material_receipt", label: "Material Received", doctype: "Stock Entry" }
            ];

            let cards_html = `
                <style>
                    .update-option-card {
                        display: flex; align-items: center; gap: 12px;
                        padding: 12px 16px; border: 2px solid #e0e0e0;
                        border-radius: 8px; cursor: pointer;
                        transition: all 0.2s; margin-bottom: 8px; background: #fff;
                    }
                    .update-option-card:hover  { border-color:#5e64ff; background:#f0f0ff; }
                    .update-option-card.selected { border-color:#5e64ff; background:#eef0ff; font-weight:600; }
                    .update-option-label { font-size:14px; color:#333; }
                </style>
                <div style="padding:4px 0 8px;">
                    <div style="font-size:12px;color:#888;margin-bottom:10px;">Task: <b>${task_subject || task_name}</b></div>
            `;
            options.forEach(opt => {
                cards_html += `
                    <div class="update-option-card" data-key="${opt.key}" data-doctype="${opt.doctype}">
                        <span class="update-option-label">${opt.label}</span>
                    </div>`;
            });
            cards_html += `</div>`;

            let selected_key = null;
            let selected_doctype = null;

            let d = new frappe.ui.Dialog({
                title: __("Update Task"),
                fields: [{ fieldtype: "HTML", fieldname: "update_options_html", options: cards_html }],
            });

            d.show();
            d.$wrapper.find(".update-option-card").on("dblclick", function () {

                let selected_key = $(this).data("key");
                let selected_doctype = $(this).data("doctype");

                d.hide();
                if (selected_key === "edit") {

                    let row = wrapper.find(
                        `.hierarchy-row[data-name="${task_name}"]`
                    );

                    let node_type = row.data("type");

                    open_edit_task_dialog(
                        frm,
                        task_name,
                        node_type
                    );

                    return;
                }
                if (selected_key === "manpower") {
                    open_manpower_usage_dialog(task_name, project);
                }
                else if (selected_key === "equipment") {
                    open_equipment_usage_dialog(task_name, project);
                }
                else if (selected_key === "progress") {
                    open_task_progress_dialog(task_name, project);
                }
                else if (selected_key === "material") {
                    open_material_consumed_dialog(task_name, project);
                }
                else if (selected_key === "material_receipt") {
                    open_material_received_dialog(task_name, project);
                }
                else {
                    frappe.new_doc(selected_doctype, {
                        project: project || ""
                    });
                }
            });
        });
    });

}

// ── Manpower Usage inline dialog ─────────────────────────────────────────────
function open_manpower_usage_dialog(task_name, project) {
    let today = frappe.datetime.get_today();

    async function get_ancestors(name) {
        let ancestors = [];
        let current = name;
        while (current) {
            let res = await frappe.db.get_value("Task", current,
                ["name", "subject", "parent_task", "custom_is_stage", "custom_is_task", "custom_is_subtask"]);
            if (!res.message) break;
            ancestors.unshift(res.message);
            current = res.message.parent_task;
        }
        return ancestors; // [stage, ...tasks, subtask_clicked]
    }

    Promise.all([
        frappe.db.get_value("Employee", { user_id: frappe.session.user }, "name"),
        frappe.db.get_value("Project", project || "", "custom_site"),
        get_ancestors(task_name)
    ]).then(([emp_r, proj_r, ancestors]) => {
        let employee = emp_r.message && emp_r.message.name;
        let site = proj_r.message && proj_r.message.custom_site;

        let breadcrumbs = ancestors.map(a => a.subject || a.name).join(' <i class="fa fa-chevron-right text-muted"></i> ');
        let first_row = {};
        if (ancestors.length >= 1) first_row.task = ancestors[0].name;
        if (ancestors.length >= 2) first_row.subtask = ancestors[1].name;
        for (let i = 2; i < ancestors.length; i++) {
            first_row[`task_level${i - 1}`] = ancestors[i].name;
        }

        // Shared recalculate function
        function calculate_row(row) {
            if (!row) return;

            // Time calculation using moment
            if (row.time_in && row.time_out) {
                let t1 = moment(row.time_in, "HH:mm:ss");
                let t2 = moment(row.time_out, "HH:mm:ss");
                if (t2.isBefore(t1)) {
                    t2.add(1, 'days');
                }
                row.hours = parseFloat(t2.diff(t1, 'hours', true).toFixed(2));
            }

            // Amount calculations
            row.total_presenty = parseFloat(((row.quantity || 0) * (row.presenty || 0)).toFixed(4));
            row.amount = parseFloat((row.total_presenty * (row.rate || 0)).toFixed(2));

            // In Dialog tables, setting the row object and manually refreshing the grid is more reliable
            if (d && d.fields_dict && d.fields_dict.manpower_usage) {
                d.fields_dict.manpower_usage.grid.refresh();
            }
        }

        let d = new frappe.ui.Dialog({
            title: __("New Manpower Usage"),
            size: "extra-large",
            fields: [
                {
                    label: __("Project"), fieldname: "project",
                    fieldtype: "Link", options: "Project",
                    default: project, read_only: 1, reqd: 1
                },
                {
                    label: __("Site"), fieldname: "site",
                    fieldtype: "Link", options: "Site",
                    default: site, reqd: 1
                },
                {
                    label: __("Shift"),
                    fieldname: "shift",
                    fieldtype: "Select",
                    options: "\nDay\nNight\nBoth",
                    default: "",
                    reqd: 1
                },
                { fieldtype: "Column Break" },
                {
                    label: __("Site Date"), fieldname: "site_date",
                    fieldtype: "Date", default: today, reqd: 1
                },
                {
                    label: __("Site Engineer"), fieldname: "site_engineer",
                    fieldtype: "Link", options: "Employee",
                    default: employee
                },
                { fieldtype: "Section Break", label: __("Manpower Details") },
                {
                    label: __("Manpower Usage"),
                    fieldname: "manpower_usage",
                    fieldtype: "Table",
                    options: "Manpower Usage Details",
                    data: [first_row],
                    on_add_row: function (idx) {
                        let row = d.fields_dict.manpower_usage.df.data[idx - 1];
                        for (let k in first_row) {
                            if (k.includes("task") || k.includes("warehouse")) {
                                row[k] = first_row[k];
                            }
                        }
                        d.fields_dict.manpower_usage.grid.refresh();
                    },
                    fields: [
                        { label: __("Stage"), fieldname: "task", fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("Task"), fieldname: "subtask", fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("SubTask"), fieldname: "task_level1", fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: "Task Level 1", fieldname: "custom_task_level2", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level2" },
                        { label: "Task Level 2", fieldname: "custom_task_level3", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level3" },
                        { label: "Task Level 3", fieldname: "custom_task_level4", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level4" },
                        { label: "Task Level 4", fieldname: "custom_task_level5", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level5" },
                        { label: "Task Level 5", fieldname: "custom_task_level6", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level6" },
                        { label: "Task Level 6", fieldname: "custom_task_level7", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level7" },
                        { label: "Task Level 7", fieldname: "custom_task_level8", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level8" },
                        { label: "Task Level 8", fieldname: "custom_task_level9", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level9" },
                        { label: "Task Level 9", fieldname: "custom_task_level10", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level10" },
                        { label: "Task Level 1", fieldname: "task_level2", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level2" },
                        { label: "Task Level 2", fieldname: "task_level3", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level3" },
                        { label: "Task Level 3", fieldname: "task_level4", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level4" },
                        { label: "Task Level 4", fieldname: "task_level5", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level5" },
                        { label: "Task Level 5", fieldname: "task_level6", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level6" },
                        { label: "Task Level 6", fieldname: "task_level7", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level7" },
                        { label: "Task Level 7", fieldname: "task_level8", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level8" },
                        { label: "Task Level 8", fieldname: "task_level9", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level9" },
                        { label: "Task Level 9", fieldname: "task_level10", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level10" },

                        {
                            label: __("Contractor"), fieldname: "contractor",
                            fieldtype: "Link", options: "Contractor",
                            in_list_view: 1, reqd: 1, columns: 2,
                            onchange: function () {
                                let row = this.doc;
                                if (row) {
                                    row.equipment_item = "";
                                    row.rate = 0;
                                    row.uom = "";
                                    row.skill_type = "";
                                    d.fields_dict.manpower_usage.grid.refresh();

                                    // Fetch and cache the manpower items for this contractor
                                    if (row.contractor) {
                                        frappe.call({
                                            method: "frappe.desk.search.search_link",
                                            args: {
                                                txt: "",
                                                searchfield: "name",
                                                start: 0,
                                                page_length: 1000,
                                                doctype: "Item",
                                                reference_doctype: "Manpower Usage",
                                                query: "quantbit_construction_management.site_diary.doctype.manpower_usage.manpower_usage.get_contractor_manpower_items",
                                                filters: { contractor: row.contractor }
                                            },
                                            callback: function (r) {
                                                if (r.results) {
                                                    row._valid_items = r.results.map(x => x.value);
                                                }
                                            }
                                        });
                                    }
                                }
                            }
                        },
                        {
                            label: __("Manpower Item"), fieldname: "equipment_item",
                            fieldtype: "Link", options: "Item",
                            in_list_view: 1, reqd: 1, columns: 2,
                            get_query: function (doc, cdt, cdn) {
                                let row = d.fields_dict.manpower_usage.df.data.find(r => r.name === cdn);
                                if (!row) {
                                    // fallback if standard dialog behavior acts weird
                                    row = locals[cdt] && locals[cdt][cdn];
                                }
                                if (!row || !row.contractor) {
                                    frappe.msgprint(__("Please select a Contractor first"));
                                    return {};
                                }
                                if (row._valid_items && row._valid_items.length > 0) {
                                    return { filters: [["name", "in", row._valid_items]] };
                                } else {
                                    return {
                                        query: "quantbit_construction_management.site_diary.doctype.manpower_usage.manpower_usage.get_contractor_manpower_items",
                                        filters: { contractor: row.contractor }
                                    };
                                }
                            },
                            onchange: function () {
                                let row = this.doc;
                                if (!row || !row.equipment_item || !row.contractor) return;

                                // Get UOM and Skill Type
                                frappe.db.get_value("Item", row.equipment_item, ["stock_uom", "custom_skill_type"]).then(r => {
                                    if (r.message) {
                                        row.uom = r.message.stock_uom || "";
                                        row.skill_type = r.message.custom_skill_type || "";
                                        d.fields_dict.manpower_usage.grid.refresh();
                                    }
                                });

                                // Get Rate from contractor
                                frappe.call({
                                    method: "frappe.client.get",
                                    args: { doctype: "Contractor", name: row.contractor },
                                    callback: function (r) {
                                        if (r.message && r.message.site_diary_contractor_item_details) {
                                            let item_row = r.message.site_diary_contractor_item_details.find(d => d.item === row.equipment_item);
                                            if (item_row) {
                                                row.rate = item_row.rate || 0;
                                                calculate_row(row);
                                            } else {
                                                row.equipment_item = "";
                                                d.fields_dict.manpower_usage.grid.refresh();
                                                frappe.msgprint({
                                                    title: __("Validation Error"),
                                                    message: __(`Equipment ${row.equipment_item} does not exist for this contractor.`),
                                                    indicator: "red"
                                                });
                                            }
                                        }
                                    }
                                });
                            }
                        },
                        { label: __("Skill Type"), fieldname: "skill_type", fieldtype: "Select", options: "Skilled\nUnskilled", in_list_view: 1, columns: 1 },
                        { label: __("UOM"), fieldname: "uom", fieldtype: "Link", options: "UOM", in_list_view: 1, reqd: 1, columns: 1 },
                        {
                            label: __("Quantity"), fieldname: "quantity", fieldtype: "Float", in_list_view: 1, columns: 1,
                            onchange: function () { calculate_row(this.doc); }
                        },
                        {
                            label: __("Time In"), fieldname: "time_in", fieldtype: "Time", in_list_view: 1, columns: 1,
                            onchange: function () { calculate_row(this.doc); }
                        },
                        {
                            label: __("Time Out"), fieldname: "time_out", fieldtype: "Time", in_list_view: 1, columns: 1,
                            onchange: function () { calculate_row(this.doc); }
                        },
                        { label: __("Hours"), fieldname: "hours", fieldtype: "Float", in_list_view: 1, read_only: 1, columns: 1 },
                        {
                            label: __("Presenty"), fieldname: "presenty", fieldtype: "Float", in_list_view: 1, columns: 1,
                            onchange: function () { calculate_row(this.doc); }
                        },

                        { label: __("Total Presenty"), fieldname: "total_presenty", fieldtype: "Float", in_list_view: 1, read_only: 1, columns: 1 },
                        {
                            label: __("Rate"), fieldname: "rate", fieldtype: "Currency", in_list_view: 1, columns: 1,
                            onchange: function () { calculate_row(this.doc); }
                        },
                        { label: __("Amount"), fieldname: "amount", fieldtype: "Currency", in_list_view: 1, read_only: 1, columns: 1 },

                    ]
                }
            ],
            primary_action_label: __("Save"),
            primary_action(values) {
                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Manpower Usage",
                            docstatus: 1,
                            naming_series: "MU-",
                            project: values.project,
                            site: values.site,
                            shift: values.shift,
                            site_date: values.site_date,
                            site_engineer: values.site_engineer,
                            manpower_usage: (values.manpower_usage || []).map(row => ({
                                doctype: "Manpower Usage Details",
                                task: row.task,
                                subtask: row.subtask,
                                task_level1: row.task_level1,
                                task_level2: row.task_level2,
                                task_level3: row.task_level3,
                                task_level4: row.task_level4,
                                task_level5: row.task_level5,
                                task_level6: row.task_level6,
                                task_level7: row.task_level7,
                                task_level8: row.task_level8,
                                task_level9: row.task_level9,
                                task_level10: row.task_level10,
                                contractor: row.contractor,
                                equipment_item: row.equipment_item,
                                uom: row.uom,
                                skill_type: row.skill_type,
                                rate: row.rate,
                                quantity: row.quantity,
                                amount: row.amount,
                                time_in: row.time_in,
                                time_out: row.time_out,
                                presenty: row.presenty,
                                hours: row.hours,
                                total_presenty: row.total_presenty
                            }))
                        }
                    },
                    freeze: true,
                    freeze_message: __("Saving Manpower Usage..."),
                    callback(r) {
                        if (r.message) {
                            frappe.msgprint({
                                title: __("Manpower Usage Created"),
                                message: __("Manpower Usage <a href='/app/manpower-usage/{0}'><b>{0}</b></a> has been saved.", [r.message.name]),
                                indicator: "green"
                            });
                            d.hide();
                        }
                    }
                });
            }
        });
        d.show();
    });
}

// ── Equipment Usage inline dialog ────────────────────────────────────────────
function open_equipment_usage_dialog(task_name, project) {
    let today = frappe.datetime.get_today();

    async function get_ancestors(name) {
        let ancestors = [];
        let current = name;
        while (current) {
            let res = await frappe.db.get_value("Task", current,
                ["name", "subject", "parent_task", "custom_is_stage", "custom_is_task", "custom_is_subtask"]);
            if (!res.message) break;
            ancestors.unshift(res.message);
            current = res.message.parent_task;
        }
        return ancestors; // [stage, ...tasks, subtask_clicked]
    }

    Promise.all([
        frappe.db.get_value("Employee", { user_id: frappe.session.user }, "name"),
        frappe.db.get_value("Project", project || "", "custom_site"),
        get_ancestors(task_name)
    ]).then(([emp_r, proj_r, ancestors]) => {
        let employee = emp_r.message && emp_r.message.name;
        let site = proj_r.message && proj_r.message.custom_site;

        let first_row = {};
        if (ancestors.length >= 1) first_row.task = ancestors[0].name;
        if (ancestors.length >= 2) first_row.subtask = ancestors[1].name;
        for (let i = 2; i < ancestors.length; i++) {
            first_row[`task_level${i - 1}`] = ancestors[i].name;
        }

        function calculate_row(row) {
            if (!row) return;

            row.amount = parseFloat(((row.quantity || 0) * (row.rate || 0) * (row.working_hrs || 0)).toFixed(2));

            if (d && d.fields_dict && d.fields_dict.equipment_usage_details) {
                d.fields_dict.equipment_usage_details.grid.refresh();
            }
        }

        let d = new frappe.ui.Dialog({
            title: __("New Equipment Usage"),
            size: "extra-large",
            fields: [
                {
                    label: __("Project"), fieldname: "project",
                    fieldtype: "Link", options: "Project",
                    default: project, read_only: 1, reqd: 1
                },
                {
                    label: __("Site"), fieldname: "site",
                    fieldtype: "Link", options: "Site",
                    default: site, reqd: 1
                },
                {
                    label: __("Shift"),
                    fieldname: "shift",
                    fieldtype: "Select",
                    options: "\nDay\nNight\nBoth",
                    default: "",
                    reqd: 1
                },
                { fieldtype: "Column Break" },
                {
                    label: __("Site Date"), fieldname: "site_date",
                    fieldtype: "Date", default: today, reqd: 1
                },
                {
                    label: __("Site Engineer"), fieldname: "site_engineer",
                    fieldtype: "Link", options: "Employee",
                    default: employee
                },
                { fieldtype: "Section Break", label: __("Equipment Details") },
                {
                    label: __("Equipment Usage"),
                    fieldname: "equipment_usage_details",
                    fieldtype: "Table",
                    options: "Equipment Usage Details",
                    data: [first_row],
                    on_add_row: function (idx) {
                        let row = d.fields_dict.equipment_usage_details.df.data[idx - 1];
                        for (let k in first_row) {
                            if (k.includes("task") || k.includes("warehouse")) {
                                row[k] = first_row[k];
                            }
                        }
                        d.fields_dict.equipment_usage_details.grid.refresh();
                    },
                    fields: [
                        { label: __("Stage"), fieldname: "task", fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("Task"), fieldname: "subtask", fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("SubTask"), fieldname: "task_level1", fieldtype: "Link", options: "Task", in_list_view: 0 },

                        {
                            label: __("Contractor"), fieldname: "contractor",
                            fieldtype: "Link", options: "Contractor",
                            in_list_view: 1, reqd: 1, columns: 2,
                            onchange: function () {
                                let row = this.doc;
                                if (row) {
                                    row.equipment_item = "";
                                    row.rate = 0;
                                    row.uom = "";
                                    d.fields_dict.equipment_usage_details.grid.refresh();

                                    if (row.contractor) {
                                        frappe.call({
                                            method: "frappe.desk.search.search_link",
                                            args: {
                                                txt: "",
                                                searchfield: "name",
                                                start: 0,
                                                page_length: 1000,
                                                doctype: "Item",
                                                reference_doctype: "Equipment Usage",
                                                query: "quantbit_construction_management.site_diary.doctype.equipment_usage.equipment_usage.get_contractor_items",
                                                filters: { contractor: row.contractor }
                                            },
                                            callback: function (r) {
                                                if (r.results) {
                                                    row._valid_items = r.results.map(x => x.value);
                                                }
                                            }
                                        });
                                    }
                                }
                            }
                        },
                        {
                            label: __("Equipment Item"), fieldname: "equipment_item",
                            fieldtype: "Link", options: "Item",
                            in_list_view: 1, reqd: 1, columns: 2,
                            get_query: function (doc, cdt, cdn) {
                                let row = d.fields_dict.equipment_usage_details.df.data.find(r => r.name === cdn);
                                if (!row) row = locals[cdt] && locals[cdt][cdn];

                                if (!row || !row.contractor) {
                                    frappe.msgprint(__("Please select a Contractor first"));
                                    return {};
                                }
                                if (row._valid_items && row._valid_items.length > 0) {
                                    return { filters: [["name", "in", row._valid_items]] };
                                } else {
                                    return {
                                        query: "quantbit_construction_management.site_diary.doctype.equipment_usage.equipment_usage.get_contractor_items",
                                        filters: { contractor: row.contractor }
                                    };
                                }
                            },
                            onchange: function () {
                                let row = this.doc;
                                if (!row || !row.equipment_item || !row.contractor) return;

                                // Get UOM
                                frappe.db.get_value("Item", row.equipment_item, "stock_uom").then(r => {
                                    if (r.message) {
                                        row.uom = r.message.stock_uom || "";
                                        d.fields_dict.equipment_usage_details.grid.refresh();
                                    }
                                });

                                // Get Rate from contractor
                                frappe.call({
                                    method: "frappe.client.get",
                                    args: { doctype: "Contractor", name: row.contractor },
                                    callback: function (r) {
                                        if (r.message && r.message.site_diary_contractor_item_details) {
                                            let item_row = r.message.site_diary_contractor_item_details.find(dx => dx.item === row.equipment_item);
                                            if (item_row) {
                                                row.rate = item_row.rate || 0;
                                                calculate_row(row);
                                            } else {
                                                row.equipment_item = "";
                                                d.fields_dict.equipment_usage_details.grid.refresh();
                                                frappe.msgprint({
                                                    title: __("Validation Error"),
                                                    message: __(`Equipment ${row.equipment_item} does not exist for this contractor.`),
                                                    indicator: "red"
                                                });
                                            }
                                        }
                                    }
                                });
                            }
                        },
                        { label: __("UOM"), fieldname: "uom", fieldtype: "Link", options: "UOM", in_list_view: 1, reqd: 1, columns: 1 },
                        {
                            label: __("Rate"), fieldname: "rate", fieldtype: "Currency", in_list_view: 1, columns: 1,
                            onchange: function () { calculate_row(this.doc); }
                        },
                        {
                            label: __("Quantity"), fieldname: "quantity", fieldtype: "Float", in_list_view: 1, columns: 1,
                            onchange: function () { calculate_row(this.doc); }
                        },
                        {
                            label: __("Working Hrs"), fieldname: "working_hrs", fieldtype: "Float", in_list_view: 1, columns: 1,
                            onchange: function () { calculate_row(this.doc); }
                        },
                        { label: __("Opening Reading"), fieldname: "opening_reading", fieldtype: "Float", in_list_view: 1, columns: 1 },
                        { label: __("Closing Reading"), fieldname: "closing_reading", fieldtype: "Float", in_list_view: 1, columns: 1 },
                        { label: __("Diesel filled(in LTR)"), fieldname: "diesel_filledin_ltr", fieldtype: "Float", in_list_view: 1, columns: 1 },
                        { label: __("Amount"), fieldname: "amount", fieldtype: "Currency", in_list_view: 1, read_only: 1, columns: 1 }
                    ]
                }
            ],
            primary_action_label: __("Save"),
            primary_action(values) {
                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Equipment Usage",
                            docstatus: 1,
                            naming_series: "EU-",
                            project: values.project,
                            site: values.site,
                            site_date: values.site_date,
                            shift: values.shift,
                            site_engineer: values.site_engineer,
                            equipment_usage_details: (values.equipment_usage_details || []).map(row => ({
                                doctype: "Equipment Usage Details",
                                task: row.task,
                                subtask: row.subtask,
                                task_level1: row.task_level1,
                                task_level2: row.task_level2,
                                task_level3: row.task_level3,
                                task_level4: row.task_level4,
                                task_level5: row.task_level5,
                                task_level6: row.task_level6,
                                task_level7: row.task_level7,
                                task_level8: row.task_level8,
                                task_level9: row.task_level9,
                                task_level10: row.task_level10,
                                contractor: row.contractor,
                                equipment_item: row.equipment_item,
                                uom: row.uom,
                                rate: row.rate,
                                quantity: row.quantity,
                                working_hrs: row.working_hrs,
                                opening_reading: row.opening_reading,
                                closing_reading: row.closing_reading,
                                diesel_filledin_ltr: row.diesel_filledin_ltr,
                                amount: row.amount
                            }))
                        }
                    },
                    freeze: true,
                    freeze_message: __("Saving Equipment Usage..."),
                    callback(r) {
                        if (r.message) {
                            frappe.msgprint({
                                title: __("Equipment Usage Created"),
                                message: __("Equipment Usage <a href='/app/equipment-usage/{0}'><b>{0}</b></a> has been saved.", [r.message.name]),
                                indicator: "green"
                            });
                            d.hide();
                        }
                    }
                });
            }
        });

        d.show();
    });
}


// ── Task Progress inline dialog ──────────────────────────────────────────────
function open_task_progress_dialog(task_name, project) {
    let today = frappe.datetime.get_today();

    async function get_ancestors(name) {
        let ancestors = [];
        let current = name;
        while (current) {
            let res = await frappe.db.get_value("Task", current,
                ["name", "subject", "parent_task", "custom_total_quantity", "custom_total_achieved", "custom_uom"]);
            if (!res.message) break;
            // attach the full record so we can extract uom/qty later
            ancestors.unshift(res.message);
            current = res.message.parent_task;
        }
        return ancestors; // [stage, ...tasks, subtask_clicked]
    }

    Promise.all([
        frappe.db.get_value("Employee", { user_id: frappe.session.user }, "name"),
        frappe.db.get_value("Project", project || "", "custom_site"),
        get_ancestors(task_name)
    ]).then(([emp_r, proj_r, ancestors]) => {
        let employee = emp_r.message && emp_r.message.name;
        let site = proj_r.message && proj_r.message.custom_site;

        let first_row = {};
        if (ancestors.length >= 1) first_row.parent_task = ancestors[0].name;
        if (ancestors.length >= 2) first_row.task = ancestors[1].name;
        for (let i = 2; i < ancestors.length; i++) {
            first_row[`task_level${i - 1}`] = ancestors[i].name;
        }

        // Extract deep task properties
        let deepest_task_record = ancestors[ancestors.length - 1];
        if (deepest_task_record) {
            first_row.total_qty = deepest_task_record.custom_total_quantity || 0;
            // Store previous total achieved so we can calculate accurately
            first_row._previous_total_achieved = deepest_task_record.custom_total_achieved || 0;
            first_row.total_achieved = first_row._previous_total_achieved;

            if (first_row.total_qty > 0) {
                first_row.percent_completed = parseFloat(((first_row.total_achieved / first_row.total_qty) * 100).toFixed(2));
            } else {
                first_row.percent_completed = 0;
            }
        }

        function calculate_row(row) {
            if (!row) return;

            let prev = row._previous_total_achieved || 0;
            let achieved_today = row.achieved_today || 0;

            row.total_achieved = prev + achieved_today;

            let total_qty = row.total_qty || 0;
            if (total_qty > 0) {
                row.percent_completed = parseFloat(((row.total_achieved / total_qty) * 100).toFixed(2));
            } else {
                row.percent_completed = 0;
            }

            if (d && d.fields_dict && d.fields_dict.task_progress_details) {
                d.fields_dict.task_progress_details.grid.refresh();
            }
        }

        let d = new frappe.ui.Dialog({
            title: __("New Task Progress"),
            size: "extra-large",
            fields: [
                {
                    label: __("Project"), fieldname: "project",
                    fieldtype: "Link", options: "Project",
                    default: project, read_only: 1, reqd: 1
                },
                {
                    label: __("Site"), fieldname: "site",
                    fieldtype: "Link", options: "Site",
                    default: site, reqd: 1
                },
                { fieldtype: "Column Break" },
                {
                    label: __("Site Date"), fieldname: "site_date",
                    fieldtype: "Date", default: today, reqd: 1
                },
                {
                    label: __("Site Engineer"), fieldname: "site_engineer",
                    fieldtype: "Link", options: "Employee",
                    default: employee
                },
                {
                    label: __("Shift"), fieldname: "shift",
                    fieldtype: "Select", options: "\nDay\nNight\nBoth",
                    default: "Day"
                },
                { fieldtype: "Section Break", label: __("Task Progress Details") },
                {
                    label: __("Task Progress Details"),
                    fieldname: "task_progress_details",
                    fieldtype: "Table",
                    options: "Task Progress Details",
                    data: [first_row],
                    on_add_row: function (idx) {
                        let row = d.fields_dict.task_progress_details.df.data[idx - 1];
                        for (let k in first_row) {
                            if (k.includes("task") || k.includes("warehouse")) {
                                row[k] = first_row[k];
                            }
                        }
                        d.fields_dict.task_progress_details.grid.refresh();
                    },
                    fields: [
                        { label: __("Stage"), fieldname: "parent_task", fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("Task"), fieldname: "task", fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("SubTask"), fieldname: "task_level1", fieldtype: "Link", options: "Task", in_list_view: 0 },

                        { label: __("Total Qty"), fieldname: "total_qty", fieldtype: "Float", in_list_view: 1, columns: 1, read_only: 1 },
                        { label: __("Planned Today"), fieldname: "planned_today", fieldtype: "Float", in_list_view: 1, columns: 1 },
                        {
                            label: __("Achieved Today"), fieldname: "achieved_today", fieldtype: "Float", in_list_view: 1, columns: 1, reqd: 1,
                            onchange: function () { calculate_row(this.doc); }
                        },
                        { label: __("Total Achieved"), fieldname: "total_achieved", fieldtype: "Float", in_list_view: 1, columns: 1, read_only: 1 },
                        { label: __("Percent Completed"), fieldname: "percent_completed", fieldtype: "Float", in_list_view: 1, columns: 1, read_only: 1 }
                    ]
                }
            ],
            primary_action_label: __("Save"),
            primary_action(values) {
                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Task Progress",
                            docstatus: 1,
                            project: values.project,
                            site: values.site,
                            site_date: values.site_date,
                            site_engineer: values.site_engineer,
                            shift: values.shift,
                            task_progress_details: (values.task_progress_details || []).map(row => ({
                                doctype: "Task Progress Details",
                                parent_task: row.parent_task,
                                task: row.task,
                                task_level1: row.task_level1,
                                task_level2: row.task_level2,
                                task_level3: row.task_level3,
                                task_level4: row.task_level4,
                                task_level5: row.task_level5,
                                task_level6: row.task_level6,
                                task_level7: row.task_level7,
                                task_level8: row.task_level8,
                                task_level9: row.task_level9,
                                task_level10: row.task_level10,
                                total_qty: row.total_qty,
                                planned_today: row.planned_today,
                                achieved_today: row.achieved_today,
                                total_achieved: row.total_achieved,
                                percent_completed: row.percent_completed
                            }))
                        }
                    },
                    freeze: true,
                    freeze_message: __("Saving Task Progress..."),
                    callback(r) {
                        if (r.message) {
                            frappe.msgprint({
                                title: __("Task Progress Created"),
                                message: __("Task Progress <a href='/app/task-progress/{0}'><b>{0}</b></a> has been saved.", [r.message.name]),
                                indicator: "green"
                            });
                            d.hide();
                        }
                    }
                });
            }
        });

        d.show();
    });
}


// ── Material Consumed (Stock Entry) inline dialog ───────────────────────────
function open_material_consumed_dialog(task_name, project) {
    let today = frappe.datetime.get_today();

    async function get_ancestors(name) {
        let ancestors = [];
        let current = name;
        while (current) {
            let res = await frappe.db.get_value("Task", current,
                ["name", "subject", "parent_task", "custom_is_stage", "custom_is_task", "custom_is_subtask"]);
            if (!res.message) break;
            ancestors.unshift(res.message);
            current = res.message.parent_task;
        }
        return ancestors;
    }

    Promise.all([
        frappe.db.get_value("Project", project || "", ["custom_site", "company"]),
        get_ancestors(task_name),
        frappe.db.get_list("Warehouse", { filters: { custom_project: project }, fields: ["name"] })
    ]).then(([proj_r, ancestors, wh_list]) => {
        let site = proj_r.message && proj_r.message.custom_site;
        let company = proj_r.message && proj_r.message.company;

        let default_warehouse = "";
        if (wh_list && wh_list.length === 1) {
            default_warehouse = wh_list[0].name;
        }

        let first_row = {};
        if (ancestors.length >= 1) first_row.custom_task = ancestors[0].name;
        if (ancestors.length >= 2) first_row.custom_subtask = ancestors[1].name;
        for (let i = 2; i < ancestors.length; i++) {
            first_row[`custom_task_level${i - 1}`] = ancestors[i].name;
        }
        first_row.s_warehouse = default_warehouse;

        let d = new frappe.ui.Dialog({
            title: __("Material Consumed (Material Issue)"),
            size: "extra-large",
            fields: [
                {
                    label: __("Project"), fieldname: "project",
                    fieldtype: "Link", options: "Project",
                    default: project, read_only: 1, reqd: 1
                },
                {
                    label: __("Site"), fieldname: "site",
                    fieldtype: "Link", options: "Site",
                    default: site, reqd: 1
                },
                {
                    label: __("Shift"),
                    fieldname: "shift",
                    fieldtype: "Select",
                    options: "\nDay\nNight\nBoth",
                    default: "",
                    reqd: 1
                },
                { fieldtype: "Column Break" },
                {
                    label: __("Posting Date"), fieldname: "posting_date",
                    fieldtype: "Date", default: today, reqd: 1
                },
                {
                    label: __("Company"), fieldname: "company",
                    fieldtype: "Link", options: "Company",
                    default: company, reqd: 1, read_only: 1
                },
                { fieldtype: "Section Break", label: __("Items") },
                {
                    label: __("Items"),
                    fieldname: "items",
                    fieldtype: "Table",
                    options: "Stock Entry Detail",
                    data: [first_row],
                    on_add_row: function (idx) {
                        let row = d.fields_dict.items.df.data[idx - 1];
                        for (let k in first_row) {
                            if (k.includes("task") || k.includes("warehouse")) {
                                row[k] = first_row[k];
                            }
                        }
                        d.fields_dict.items.grid.refresh();
                    },
                    fields: [
                        { label: __("Stage"), fieldname: "custom_task", fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("Task"), fieldname: "custom_subtask", fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("SubTask"), fieldname: "custom_task_level1", fieldtype: "Link", options: "Task", in_list_view: 0 },

                        {
                            label: __("Item Code"), fieldname: "item_code", fieldtype: "Link", options: "Item", in_list_view: 1, reqd: 1, columns: 2,
                            onchange: function () {
                                let row = this.doc;
                                if (!row || !row.item_code) return;
                                frappe.db.get_value("Item", row.item_code, ["stock_uom"]).then(r => {
                                    if (r.message) {
                                        row.uom = r.message.stock_uom || "";
                                        row.stock_uom = r.message.stock_uom || "";
                                        d.fields_dict.items.grid.refresh();
                                    }
                                });
                            }
                        },
                        {
                            label: __("Source Warehouse"), fieldname: "s_warehouse", fieldtype: "Link", options: "Warehouse", in_list_view: 1, reqd: 1, columns: 2,
                            get_query: function () {
                                return {
                                    filters: {
                                        custom_project: project
                                    }
                                };
                            }
                        },
                        { label: __("Qty"), fieldname: "qty", fieldtype: "Float", in_list_view: 1, reqd: 1, columns: 1 },
                        { label: __("UOM"), fieldname: "uom", fieldtype: "Link", options: "UOM", in_list_view: 1, read_only: 1, columns: 1 }
                    ]
                }
            ],
            primary_action_label: __("Save"),
            primary_action(values) {
                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Stock Entry",
                            docstatus: 1,
                            stock_entry_type: "Material Issue",
                            project: values.project,
                            posting_date: values.posting_date,
                            custom_shift: values.shift,
                            company: values.company,
                            items: (values.items || []).map(row => ({
                                doctype: "Stock Entry Detail",
                                site: values.site,
                                item_code: row.item_code,
                                s_warehouse: row.s_warehouse,
                                custom_task: row.custom_task,
                                custom_subtask: row.custom_subtask,
                                custom_task_level1: row.custom_task_level1,
                                custom_task_level2: row.custom_task_level2,
                                custom_task_level3: row.custom_task_level3,
                                custom_task_level4: row.custom_task_level4,
                                custom_task_level5: row.custom_task_level5,
                                custom_task_level6: row.custom_task_level6,
                                custom_task_level7: row.custom_task_level7,
                                custom_task_level8: row.custom_task_level8,
                                custom_task_level9: row.custom_task_level9,
                                custom_task_level10: row.custom_task_level10,
                                qty: row.qty,
                                uom: row.uom,
                                stock_uom: row.uom,
                                received_qty: row.qty,
                                project: values.project
                            }))
                        }
                    },
                    freeze: true,
                    freeze_message: __("Saving Material Issue..."),
                    callback(r) {
                        if (r.message) {
                            frappe.msgprint({
                                title: __("Stock Entry Created"),
                                message: __("Material Issue <a href='/app/stock-entry/{0}'><b>{0}</b></a> has been saved.", [r.message.name]),
                                indicator: "green"
                            });
                            d.hide();
                        }
                    }
                });
            }
        });

        d.show();
    });
}


// ── Material Received (Purchase Receipt) inline dialog ───────────────────────────
function open_material_received_dialog(task_name, project) {
    let today = frappe.datetime.get_today();

    async function get_ancestors(name) {
        let ancestors = [];
        let current = name;
        while (current) {
            let res = await frappe.db.get_value("Task", current,
                ["name", "subject", "parent_task", "custom_is_stage", "custom_is_task", "custom_is_subtask"]);
            if (!res.message) break;
            ancestors.unshift(res.message);
            current = res.message.parent_task;
        }
        return ancestors;
    }

    Promise.all([
        frappe.db.get_value("Project", project || "", ["custom_site", "company"]),
        get_ancestors(task_name),
        frappe.db.get_list("Warehouse", { filters: { custom_project: project }, fields: ["name"] })
    ]).then(([proj_r, ancestors, wh_list]) => {
        let site = proj_r.message && proj_r.message.custom_site;
        let company = proj_r.message && proj_r.message.company;

        let default_warehouse = "";
        if (wh_list && wh_list.length === 1) {
            default_warehouse = wh_list[0].name;
        }

        let first_row = {};
        if (ancestors.length >= 1) first_row.custom_task = ancestors[0].name;
        if (ancestors.length >= 2) first_row.custom_subtask = ancestors[1].name;
        for (let i = 2; i < ancestors.length; i++) {
            first_row[`custom_task_level${i - 1}`] = ancestors[i].name;
        }
        first_row.warehouse = default_warehouse;

        let d = new frappe.ui.Dialog({
            title: __("Material Received (Purchase Receipt)"),
            size: "extra-large",
            fields: [
                {
                    label: __("Project"), fieldname: "project",
                    fieldtype: "Link", options: "Project",
                    default: project, read_only: 1, reqd: 1
                },
                {
                    label: __("Site"), fieldname: "site",
                    fieldtype: "Link", options: "Site",
                    default: site, reqd: 1
                },
                {
                    label: __("Shift"),
                    fieldname: "shift",
                    fieldtype: "Select",
                    options: "\nDay\nNight\nBoth",
                    default: "",
                    reqd: 1
                },
                { fieldtype: "Column Break" },
                {
                    label: __("Supplier"), fieldname: "supplier",
                    fieldtype: "Link", options: "Supplier",
                    reqd: 1
                },
                {
                    label: __("Posting Date"), fieldname: "posting_date",
                    fieldtype: "Date", default: today, reqd: 1
                },
                {
                    label: __("Company"), fieldname: "company",
                    fieldtype: "Link", options: "Company",
                    default: company, reqd: 1, read_only: 1
                },
                { fieldtype: "Section Break", label: __("Items") },
                {
                    label: __("Items"),
                    fieldname: "items",
                    fieldtype: "Table",
                    options: "Purchase Receipt Item",
                    data: [first_row],
                    on_add_row: function (idx) {
                        let row = d.fields_dict.items.df.data[idx - 1];
                        for (let k in first_row) {
                            if (k.includes("task") || k.includes("warehouse")) {
                                row[k] = first_row[k];
                            }
                        }
                        d.fields_dict.items.grid.refresh();
                    },
                    fields: [
                        { label: __("Stage"), fieldname: "custom_task", fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("Task"), fieldname: "custom_subtask", fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: "Task Level 1", fieldname: "custom_task_level1", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level1" },
                        { label: "Task Level 2", fieldname: "custom_task_level2", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level2" },
                        { label: "Task Level 3", fieldname: "custom_task_level3", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level3" },
                        { label: "Task Level 4", fieldname: "custom_task_level4", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level4" },
                        { label: "Task Level 5", fieldname: "custom_task_level5", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level5" },
                        { label: "Task Level 6", fieldname: "custom_task_level6", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level6" },
                        { label: "Task Level 7", fieldname: "custom_task_level7", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level7" },
                        { label: "Task Level 8", fieldname: "custom_task_level8", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level8" },
                        { label: "Task Level 9", fieldname: "custom_task_level9", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level9" },
                        { label: "Task Level 10", fieldname: "custom_task_level10", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level10" },

                        {
                            label: __("Item Code"), fieldname: "item_code", fieldtype: "Link", options: "Item", in_list_view: 1, reqd: 1, columns: 2,
                            onchange: function () {
                                let row = this.doc;
                                if (!row || !row.item_code) return;
                                frappe.db.get_value("Item", row.item_code, ["stock_uom"]).then(r => {
                                    if (r.message) {
                                        row.uom = r.message.stock_uom || "";
                                        row.stock_uom = r.message.stock_uom || "";
                                        d.fields_dict.items.grid.refresh();
                                    }
                                });
                            }
                        },
                        {
                            label: __("Accepted Warehouse"), fieldname: "warehouse", fieldtype: "Link", options: "Warehouse", in_list_view: 1, reqd: 1, columns: 2,
                            get_query: function () {
                                return {
                                    filters: {
                                        custom_project: project
                                    }
                                };
                            }
                        },
                        { label: __("Accepted Qty"), fieldname: "qty", fieldtype: "Float", in_list_view: 1, reqd: 1, columns: 1 },
                        {
                            label: __("Rejected Warehouse"), fieldname: "r_warehouse", fieldtype: "Link", options: "Warehouse", in_list_view: 1, columns: 2,
                        },
                        { label: __("Rejected Qty"), fieldname: "rejected_qty", fieldtype: "Float", in_list_view: 1, columns: 1 },

                        { label: __("UOM"), fieldname: "uom", fieldtype: "Link", options: "UOM", in_list_view: 1, read_only: 1, columns: 1 }
                    ]
                }
            ],
            primary_action_label: __("Save"),
            primary_action(values) {
                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Purchase Receipt",
                            docstatus: 1,
                            project: values.project,
                            supplier: values.supplier,
                            posting_date: values.posting_date,
                            custom_shift: values.shift,
                            company: values.company,
                            items: (values.items || []).map(row => ({
                                doctype: "Purchase Receipt Item",
                                item_code: row.item_code,
                                warehouse: row.warehouse,
                                rejected_warehouse: row.r_warehouse,
                                qty: row.qty,
                                rejected_qty: row.rejected_qty,
                                uom: row.uom,
                                stock_uom: row.uom,
                                received_qty: (flt(row.qty || 0) + flt(row.rejected_qty || 0)),
                                project: values.project
                            }))
                        }
                    },
                    freeze: true,
                    freeze_message: __("Saving Purchase Receipt..."),
                    callback(r) {
                        if (r.message) {
                            frappe.msgprint({
                                title: __("Purchase Receipt Created"),
                                message: __("Material Receipt <a href='/app/purchase-receipt/{0}'><b>{0}</b></a> has been saved.", [r.message.name]),
                                indicator: "green"
                            });
                            d.hide();
                        }
                    }
                });
            }
        });

        d.show();
    });
}
