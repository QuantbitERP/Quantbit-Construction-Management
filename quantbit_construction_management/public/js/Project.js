window.expanded_nodes = window.expanded_nodes || new Set();

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
        if (frm.doc.custom_bill_of_quantities && typeof load_hierarchy === "function") {
            load_hierarchy(frm);
        }
    },
    custom_get_details: function (frm) {
        if (frm.doc.name && typeof load_hierarchy === "function") {
            load_hierarchy(frm);
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

    let progress = flt(node.progress || 0);
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
            <button class="btn btn-success btn-xs" title="Progress">${node.progress || 0}%</button>
            <button class="btn btn-light btn-xs redirect-item" data-name="${node.name}" title="Open Form View">Redirect</button>
            <button class="btn btn-light btn-xs edit-item" data-name="${node.name}">✏ Edit</button>
            <button class="btn btn-light btn-xs assign-item" data-name="${node.name}">👤 Assign</button>
            <button class="btn btn-light btn-xs delete-item" data-name="${node.name}">🗑 Delete</button>
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
        let child_weight_total = node.children.reduce((sum, c) => sum + flt(c.task_weight || 0), 0);
        html += render_total_row("Child weight total", child_weight_total.toFixed(2), margin + 28);
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

            html += render_total_row("Stage percentage", overall_stage_total.toFixed(2), 0);
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
                { label: "Weight", fieldname: "task_weight", fieldtype: "Float" },
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
                            task_weight: values.existing_stage_weight
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
                            task_weight: values.existing_task_weight
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
                            task_weight: values.existing_task_weight
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
                            task_weight: values.existing_subtask_weight
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

}