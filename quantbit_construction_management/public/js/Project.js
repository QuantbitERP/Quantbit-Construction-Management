window.expanded_nodes = window.expanded_nodes || new Set();
window.detail_expanded_nodes = window.detail_expanded_nodes || new Set();
window.last_project_progress = window.last_project_progress || null;

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
            frm.save().then(() => { link_and_load_hierarchy(frm); });
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
        args: { report_name: frm.doc.custom_report_name_, filters: filters },
        callback: function (r) {
            if (r.message) {
                let msg = r.message;
                let html = typeof msg === 'string' ? msg : msg.html;
                frm.set_df_property('custom_html_view', 'options', html);
                frm.refresh_field('custom_html_view');
                if (msg.status === "preparing") {
                    setTimeout(() => {
                        if (frm.doc.custom_report_name_) render_report_view(frm);
                    }, 5000);
                }
            }
        }
    });
}

function inject_hierarchy_css() {
    const css = `
        /* ── Base row ──────────────────────────────────────────────────── */
        .hierarchy-row {
            position: relative;
            cursor: pointer;
            margin-bottom: 4px;
            border-radius: 8px;
            overflow: hidden;
            transition: box-shadow 0.15s ease;
        }
        .hierarchy-row:hover {
            box-shadow: 0 3px 10px rgba(0,0,0,0.08);
        }

        /* ── Compact summary bar (always visible) ───────────────────────── */
        .h-summary {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 7px 12px;
            min-height: 38px;
            user-select: none;
        }

        /* ── Full detail panel (hidden by default) ──────────────────────── */
        .h-detail {
            display: none;
            padding: 10px 14px 12px 14px;
            border-top: 1px solid rgba(0,0,0,0.08);
            animation: fadeSlideDown 0.18s ease;
        }
        .h-detail.open { display: block; }

        @keyframes fadeSlideDown {
            from { opacity: 0; transform: translateY(-4px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Toggle arrow ───────────────────────────────────────────────── */
        .toggle-detail-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: rgba(255,255,255,0.18);
            border: 1px solid rgba(255,255,255,0.35);
            font-size: 10px;
            cursor: pointer;
            transition: transform 0.2s ease, background 0.15s;
            flex-shrink: 0;
            margin-right: 8px;
            color: inherit;
        }
        .toggle-detail-icon:hover { background: rgba(255,255,255,0.35); }
        .toggle-detail-icon.open  { transform: rotate(90deg); }

        /* ── Children expand icon ───────────────────────────────────────── */
        .toggle-children-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            border-radius: 4px;
            font-size: 10px;
            cursor: pointer;
            flex-shrink: 0;
            margin-right: 6px;
            opacity: 0.75;
            transition: opacity 0.15s;
        }
        .toggle-children-icon:hover { opacity: 1; }

        /* ── Hover tooltip ─────────────────────────────────────────────── */
        .hover-details {
            display: none;
            position: absolute;
            top: -10px;
            left: 50%;
            transform: translateX(-50%) translateY(-100%);
            background: #2d3436;
            color: #fff;
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 12px;
            width: 250px;
            z-index: 100;
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            pointer-events: none;
        }
        .hierarchy-row:hover .hover-details { display: block; }
        .detail-label { color: #bdc3c7; font-weight: bold; margin-right: 5px; }

        /* ── Controls bar ──────────────────────────────────────────────── */
        .hierarchy-controls {
            margin-bottom: 12px;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }

        /* ── Progress bar (inside detail) ──────────────────────────────── */
        .h-progress-bar {
            height: 6px;
            border-radius: 4px;
            background: #e0e0e0;
            overflow: hidden;
            margin-top: 6px;
            width: 160px;
        }
        .h-progress-fill { height: 6px; border-radius: 4px; }

        /* ── Cost strip (inside detail) ────────────────────────────────── */
        .h-cost-strip {
            font-size: 11px;
            margin-top: 6px;
            opacity: 0.85;
        }

        /* ── Action buttons row (inside detail) ────────────────────────── */
        .h-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-top: 10px;
            align-items: center;
        }
    `;
    frappe.dom.set_style(css, 'project-hierarchy-style');
}

/* ─── Node type helpers ──────────────────────────────────────────────────── */
function get_node_type(node) {
    if (node.custom_is_stage == 1)   return "stage";
    if (node.custom_is_task == 1)    return "task";
    if (node.custom_is_subtask == 1) return "subtask";
    return "task";
}

function get_node_colors(node_type) {
    if (node_type === "stage")   return { bg: "#1a365d", text: "#ffffff" };
    if (node_type === "task")    return { bg: "#e9c46a", text: "#333333" };
    return                              { bg: "#fdf6e3", text: "#333333" };
}

/* ─── Weight validation ──────────────────────────────────────────────────── */
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
        r.message.forEach(t => { if (t.name !== exclude_task) current_total += flt(t.task_weight || 0); });
        let projected_total = current_total + flt(new_weight || 0);
        return { valid: projected_total <= 100, current_total, projected_total, remaining: 100 - current_total };
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
        r.message.forEach(t => { if (t.name !== exclude_task) current_total += flt(t.task_weight || 0); });
        let projected_total = current_total + flt(new_weight || 0);
        return { valid: projected_total <= 100, current_total, projected_total, remaining: 100 - current_total };
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
        r.message.forEach(t => { if (t.name !== exclude_task) current_total += flt(t.task_weight || 0); });
        let projected_total = current_total + flt(new_weight || 0);
        return { valid: projected_total <= 100, current_total, projected_total, remaining: 100 - current_total };
    });
}

/* ─── Tree helpers ───────────────────────────────────────────────────────── */
function build_tree(tasks) {
    let taskMap = {};
    tasks.forEach(t => { taskMap[t.name] = { ...t, children: [] }; });
    let roots = [];
    tasks.forEach(t => {
        if (!t.parent_task) roots.push(taskMap[t.name]);
        else if (taskMap[t.parent_task]) taskMap[t.parent_task].children.push(taskMap[t.name]);
    });
    return roots;
}

function compute_costs(node) {
    if (!node.children || !node.children.length) {
        return {
            labour:    flt(node.custom_total_labour_cost    || 0),
            equipment: flt(node.custom_total_equipment_cost || 0),
            material:  flt(node.custom_total_material_cost  || 0)
        };
    }
    let labour = 0, equipment = 0, material = 0;
    node.children.forEach(child => {
        let c = compute_costs(child);
        labour    += c.labour;
        equipment += c.equipment;
        material  += c.material;
    });
    node.custom_total_labour_cost    = labour;
    node.custom_total_equipment_cost = equipment;
    node.custom_total_material_cost  = material;
    return { labour, equipment, material };
}

function get_descendant_count(node) {
    if (!node.children || !node.children.length) return 0;
    let total = 0;
    node.children.forEach(child => {
        total += 1;                              // count this child itself (stage/task/child-task/subtask)
        total += get_descendant_count(child);      // plus all of its descendants
    });
    return total;
}

function calculate_progress(node) {
    if (!node.children || !node.children.length) return flt(node.progress || 0);
    let total_progress = 0;
    node.children.forEach(child => {
        let cp = calculate_progress(child);
        total_progress += (flt(child.task_weight || 0) * flt(cp)) / 100;
    });
    node.calculated_progress = total_progress;
    frappe.call({
        method: "frappe.client.set_value",
        args: { doctype: "Task", name: node.name, fieldname: { progress: flt(total_progress) } }
    });
    return total_progress;
}

function calculate_project_progress(roots) {
    let project_progress = 0;
    roots.forEach(stage => {
        project_progress += (flt(stage.task_weight || 0) * flt(stage.calculated_progress || 0)) / 100;
    });
    return project_progress;
}

/* ─── Render total-weight badge row ─────────────────────────────────────── */
function render_total_row(label, total, margin_left) {
    let bg = total > 100 ? "#c0392b" : total >= 100 ? "#2ecc71" : total > 70 ? "#27ae60" : total > 30 ? "#f1c40f" : "#fb8c00";
    return `
    <div style="margin-left:${margin_left}px;margin-top:6px;display:flex;justify-content:flex-end;align-items:center;gap:8px;font-weight:600;font-size:13px;">
        <span>${label} :</span>
        <span style="background:${bg};color:white;padding:3px 10px;border-radius:4px;min-width:46px;text-align:center;">${total} %</span>
    </div>`;
}

/* ─── Render a single node ───────────────────────────────────────────────── */
function render_node(node, depth, frm) {
    let margin      = depth * 28;
    let node_type   = get_node_type(node);
    let colors      = get_node_colors(node_type);
    let has_children = node.children && node.children.length > 0;
    let descendant_count = node.custom_is_subtask ? 0 : get_descendant_count(node);
    let is_children_expanded = expanded_nodes.has(node.name);
    let is_detail_open       = detail_expanded_nodes.has(node.name);

    let children_icon = has_children ? (is_children_expanded ? "▼" : "▶") : "•";

    let progress = flt(
        node.calculated_progress != null ? node.calculated_progress : node.progress || 0
    );
    let progress_color = progress >= 100 ? "#2ecc71" : progress > 70 ? "#27ae60" : progress > 30 ? "#f1c40f" : "#fb8c00";

    /* ── Depth restriction logic ─────────────────────────────────────────
     *  depth 0  = Stage
     *  depth 1  = Task (direct child of Stage)           → task_level0 conceptually
     *  depth 2  = Child Task level 1  (task_level1)
     *  ...
     *  depth 9  = Child Task level 8  (task_level8)      → can still add child task OR subtask
     *  depth 10 = Child Task level 9  (task_level9)      → MUST be subtask, NO more children
     *  depth >10= subtask territory, no add buttons at all
     *
     *  Rules inside a Stage's task tree:
     *    - task_depth = depth - 1   (depth inside stage, 0-indexed from the Task)
     *    - task_depth 0..8  → can add Child Task AND Subtask
     *    - task_depth 9     → node IS already at max task level → no add buttons (children must be subtasks only, handled by add-subtask at level 8)
     *    - If node is subtask → no add buttons
     *  Actually:
     *    depth 1 (task)       → can add child-task (up to depth 9) + subtask
     *    depth 2..8 (task)    → can add child-task + subtask
     *    depth 9 (task)       → can ONLY add subtask (no more child tasks)
     *    depth 10+ or subtask → no buttons
     * ──────────────────────────────────────────────────────────────────── */
    let add_child_btn = "";
    if (node_type === "stage") {
        add_child_btn = `<button class="btn btn-light btn-xs add-task" data-stage="${node.name}">+ Task</button>`;
    } else if (node_type === "task") {
        if (depth <= 8) {
            // depth 1-8: can add both child task and subtask
            add_child_btn = `
                <button class="btn btn-light btn-xs add-child-task"
                    data-parent="${node.name}"
                    data-depth="${depth}"
                    title="Add Child Task (level ${depth} of 9)">
                    + Child Task <span style="font-size:9px;opacity:0.7;">(${depth}/9)</span>
                </button>
                <button class="btn btn-light btn-xs add-subtask"
                    data-task="${node.name}"
                    data-depth="${depth}">
                    + Subtask
                </button>`;
        } else if (depth === 9) {
            // depth 9: max task level reached — can ONLY add subtask now
            add_child_btn = `
                <button class="btn btn-light btn-xs add-subtask"
                    data-task="${node.name}"
                    data-depth="${depth}"
                    title="Maximum task depth reached. Only subtask allowed.">
                    + Subtask <span style="font-size:9px;opacity:0.7;">(max depth)</span>
                </button>
                <span style="font-size:10px;color:#dc2626;font-weight:600;padding:2px 6px;background:#fff5f5;border-radius:4px;border:1px solid #fca5a5;">
                    ⚠ Max task depth (9)
                </span>`;
        }
        // depth >= 10 → node IS a subtask or beyond, no add buttons
    }

    /* ── Node numbering label ────────────────────────────────────────── */
    let node_label_style = `font-size:${node_type === 'stage' ? '14px' : '13px'};font-weight:${node_type === 'stage' ? '700' : '600'};`;

    let html = `
    <div class="hierarchy-row"
         data-name="${node.name}"
         data-depth="${depth}"
         data-type="${node_type}"
         style="margin-left:${margin}px;margin-top:6px;background:${colors.bg};color:${colors.text};">

        <!-- Tooltip -->
        <div class="hover-details">
            <div style="border-bottom:1px solid #444;margin-bottom:5px;font-weight:bold;padding-bottom:3px;">${node.name}</div>
            <div><span class="detail-label">Status:</span> ${node.status || 'Open'}</div>
            <div><span class="detail-label">Priority:</span> ${node.priority || 'Medium'}</div>
            <div><span class="detail-label">Weight:</span> ${node.task_weight || 0}%</div>
            <div><span class="detail-label">Progress:</span> ${progress.toFixed(2)}%</div>
            <div style="margin-top:5px;font-style:italic;color:#ecf0f1;">${node.description || 'No description.'}</div>
        </div>

        <!-- ── COMPACT SUMMARY BAR (always visible) ── -->
        <div class="h-summary">

            <!-- Left: detail-toggle + children-toggle + name/id -->
            <div style="display:flex;align-items:center;flex:1;min-width:0;gap:2px;">

                <!-- Detail expand/collapse arrow (❯ / ❮) -->
                <span class="toggle-detail-icon ${is_detail_open ? 'open' : ''}"
                      data-name="${node.name}" title="Show / hide details">
                    ❯
                </span>

                <!-- Children expand/collapse (▶ / ▼ / •) -->
                <span class="toggle-children-icon" data-name="${node.name}" style="color:${colors.text};">
                    ${children_icon}
                </span>

                <!-- Name + ID -->
                <div style="min-width:0;">
                    <div style="${node_label_style}overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${node.subject}
                    </div>
                    <div style="font-size:10px;opacity:0.65;font-family:monospace;">${node.name}</div>
                </div>
            </div>

            <!-- Right: labeled badge group (Progress / Weight / Count) -->
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px;">

                ${!node.custom_is_subtask && descendant_count > 0
                    ? `<div style="display:flex;flex-direction:column;align-items:center;line-height:1;">
                            <span style="font-size:8px;opacity:0.7;margin-bottom:2px;letter-spacing:0.3px;">COUNT</span>
                            <span class="btn btn-info btn-xs" style="pointer-events:none;margin:0;" title="Total descendants (stages/tasks/child tasks/subtasks)">
                                ${descendant_count}
                            </span>
                       </div>`
                    : ""}

                <div style="display:flex;flex-direction:column;align-items:center;line-height:1;">
                    <span style="font-size:8px;opacity:0.7;margin-bottom:2px;letter-spacing:0.3px;">WEIGHT</span>
                    <span class="btn btn-warning btn-xs" style="pointer-events:none;margin:0;" title="Weight">
                        ${node.task_weight || 0}%
                    </span>
                </div>

                <div style="display:flex;flex-direction:column;align-items:center;line-height:1;">
                    <span style="font-size:8px;opacity:0.7;margin-bottom:2px;letter-spacing:0.3px;">PROGRESS</span>
                    <span class="btn btn-success btn-xs" style="pointer-events:none;margin:0;">
                        ${progress.toFixed(2)}%
                    </span>
                </div>
            </div>
        </div>

        <!-- ── FULL DETAIL PANEL (toggled) ── -->
        <div class="h-detail ${is_detail_open ? 'open' : ''}">

            <!-- Progress bar -->
            <div class="h-progress-bar">
                <div class="h-progress-fill" style="width:${progress}%;background:${progress_color};"></div>
            </div>

            <!-- Cost strip -->
            <div class="h-cost-strip">
                Labour Cost: ₹ ${flt(node.custom_total_labour_cost || 0).toFixed(2)}
                &nbsp;|&nbsp;
                Equipment Cost: ₹ ${flt(node.custom_total_equipment_cost || 0).toFixed(2)}
                &nbsp;|&nbsp;
                Material Cost: ₹ ${flt(node.custom_total_material_cost || 0).toFixed(2)}
            </div>

            <!-- Action buttons -->
            <div class="h-actions">
                <button class="btn btn-light btn-xs redirect-item" data-name="${node.name}">Show Details</button>
                ${!node.custom_is_subtask ? `<button class="btn btn-light btn-xs edit-item" data-name="${node.name}">✏ Edit</button>` : ""}
                <button class="btn btn-light btn-xs assign-item" data-name="${node.name}">👤 Assign</button>
                <button class="btn btn-light btn-xs delete-item" data-name="${node.name}">🗑 Delete</button>
                <button class="btn btn-light btn-xs update-item" data-name="${node.name}"
                    style="${node.custom_is_subtask ? '' : 'display:none;'}">⬆ Update</button>
                ${add_child_btn}
            </div>
        </div>
    </div>`;

    /* Recursively render expanded children */
    if (is_children_expanded && has_children) {
        node.children.forEach(child => { html += render_node(child, depth + 1, frm); });
        node.children.forEach(child => {
            html += render_total_row(
                child.subject,
                flt(child.task_weight || 0).toFixed(2),
                ((depth + 1) * 28) + 28
            );
        });
    }

    return html;
}

/* ─── Main load function ─────────────────────────────────────────────────── */
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
            let roots = build_tree(tasks);

            roots.forEach(root => { compute_costs(root); calculate_progress(root); });

            let project_progress = calculate_project_progress(roots);
            let progress_value   = flt(project_progress);

            if (window.last_project_progress === null ||
                Math.abs(flt(window.last_project_progress) - progress_value) > 0.01) {
                window.last_project_progress = progress_value;
                frappe.call({
                    method: "frappe.client.set_value",
                    args: { doctype: "Project", name: frm.doc.name, fieldname: { percent_complete: progress_value } },
                    callback: function () { frm.doc.percent_complete = progress_value; }
                });
            }

            roots.forEach(root => compute_costs(root));

            let html = `
            <div style="padding:12px;">
                <div class="hierarchy-controls">
                    <button class="btn btn-default btn-xs expand-all">Expand All</button>
                    <button class="btn btn-default btn-xs collapse-all">Collapse All</button>
                    <button class="btn btn-primary btn-xs add-stage">+ Add Stage</button>
                </div>`;

            roots.forEach(root => { html += render_node(root, 0, frm); });

            roots.forEach(root => {
                html += render_total_row(
                    root.subject,
                    flt(root.task_weight || 0).toFixed(2),
                    0
                );
            });

            html += `</div>`;

            frm.fields_dict.custom_task_hierarchy.$wrapper.html(html);
            attach_events(frm, tasks);
        }
    });
}

/* ─── Edit dialog (unchanged) ────────────────────────────────────────────── */
function open_edit_task_dialog(frm, docname, node_type) {
    let type_label = node_type === "stage" ? "Stage" : node_type === "task" ? "Task" : "Subtask";

    frappe.db.get_doc("Task", docname).then(doc => {
        frappe.prompt([
            { label: "Name",        fieldname: "subject",     fieldtype: "Data",       default: doc.subject,     reqd: 1 },
            { label: "Status",      fieldname: "status",      fieldtype: "Select",     options: ["Open","Working","Completed","Cancelled"], default: doc.status },
            { label: "Priority",    fieldname: "priority",    fieldtype: "Select",     options: ["Low","Medium","High","Urgent"], default: doc.priority },
            { label: "Weightage*",  fieldname: "task_weight", fieldtype: "Float",      default: doc.task_weight },
            { label: "Description", fieldname: "description", fieldtype: "Small Text", default: doc.description }
        ], function (values) {
            frappe.call({
                method: "frappe.client.set_value",
                args: { doctype: "Task", name: docname, fieldname: values },
                callback: function () {
                    frappe.show_alert({ message: __("{0} Updated", [type_label]), indicator: "green" });
                    load_hierarchy(frm);
                }
            });
        }, `Edit ${type_label}`);
    });
}

/* ─── Attach all events ──────────────────────────────────────────────────── */
function attach_events(frm, all_tasks) {
    const wrapper = frm.fields_dict.custom_task_hierarchy.$wrapper;

    /* ── Toggle DETAIL panel (the ❯ arrow on the right of the name) ─── */
    wrapper.find(".toggle-detail-icon").off("click").on("click", function (e) {
        e.stopPropagation();
        let name = $(this).data("name");
        let row  = wrapper.find(`.hierarchy-row[data-name="${name}"]`);
        let detail = row.find(".h-detail").first();
        let icon   = row.find(".toggle-detail-icon").first();

        if (detail_expanded_nodes.has(name)) {
            detail_expanded_nodes.delete(name);
            detail.removeClass("open");
            icon.removeClass("open");
        } else {
            detail_expanded_nodes.add(name);
            detail.addClass("open");
            icon.addClass("open");
        }
    });

    /* ── Toggle CHILDREN (the ▶ icon) ───────────────────────────────── */
    wrapper.find(".toggle-children-icon").off("click").on("click", function (e) {
        e.stopPropagation();
        let name = $(this).data("name");
        let row  = wrapper.find(`.hierarchy-row[data-name="${name}"]`);
        let type = row.data("type");

        if (type === "subtask") return;

        expanded_nodes.has(name)
            ? expanded_nodes.delete(name)
            : expanded_nodes.add(name);

        load_hierarchy(frm);
    });

    /* ── Expand All ─────────────────────────────────────────────────── */
    wrapper.find(".expand-all").off("click").on("click", function () {
        all_tasks.forEach(t => expanded_nodes.add(t.name));
        load_hierarchy(frm);
    });

    /* ── Collapse All ───────────────────────────────────────────────── */
    wrapper.find(".collapse-all").off("click").on("click", function () {
        expanded_nodes.clear();
        load_hierarchy(frm);
    });

    /* ── Delete ─────────────────────────────────────────────────────── */
    wrapper.find(".delete-item").off("click").on("click", function (e) {
        e.stopPropagation();
        let task_name = $(this).data("name");
        frappe.confirm(__("Delete this task and all child tasks?"), function () {
            frappe.call({
                method: "quantbit_construction_management.api.delete_task_with_dependencies",
                args: { task_name },
                freeze: true,
                freeze_message: __("Deleting Task..."),
                callback: function () {
                    frappe.show_alert({ message: __("Task Deleted"), indicator: "red" });
                    expanded_nodes.delete(task_name);
                    detail_expanded_nodes.delete(task_name);
                    load_hierarchy(frm);
                }
            });
        });
    });

    /* ── Add Stage ──────────────────────────────────────────────────── */
    wrapper.find(".add-stage").off("click").on("click", function () {
        let d = new frappe.ui.Dialog({
            title: "Add Stage",
            fields: [
                {
                    label: "Select Existing Stage", fieldname: "existing_stage", fieldtype: "Link", options: "Task",
                    get_query() { return { filters: { custom_is_stage: 1, is_group: 1 } }; }
                },
                { label: "Weightage", fieldname: "existing_stage_weight", fieldtype: "Float", depends_on: "eval:doc.existing_stage" },
                { label: "Include Tasks",    fieldname: "include_tasks",    fieldtype: "Check", default: 0, depends_on: "eval:doc.existing_stage" },
                { label: "Include Subtasks", fieldname: "include_children", fieldtype: "Check", default: 0, depends_on: "eval:doc.existing_stage" },
                { fieldtype: "Section Break" },
                { label: "OR Create New Stage", fieldname: "section_label", fieldtype: "HTML", options: "<b>Create New Stage</b>" },
                { label: "Stage Name",  fieldname: "subject",      fieldtype: "Data"       },
                { label: "Weightage",   fieldname: "task_weight",  fieldtype: "Float"      },
                { label: "Description", fieldname: "description",  fieldtype: "Small Text" }
            ],
            primary_action_label: "Add",
            primary_action(values) {
                if (values.existing_stage) {
                    if (!values.existing_stage_weight) {
                        frappe.msgprint("Enter weight for the linked stage");
                        return;
                    }
                    validate_total_weight(frm, values.existing_stage_weight).then(result => {
                        if (!result.valid) {
                            frappe.msgprint({
                                title: __("Weight Limit Exceeded"),
                                message: __("Total stage weight cannot exceed 100%. Current total: {0}%, Remaining: {1}%",
                                    [result.current_total.toFixed(2), result.remaining.toFixed(2)]),
                                indicator: "red"
                            });
                            return;
                        }
                        frappe.call({
                            method: "quantbit_construction_management.api.clone_task_hierarchy",
                            args: {
                                source_task: values.existing_stage, target_project: frm.doc.name,
                                include_dependencies: values.include_dependencies,
                                include_children: values.include_children,
                                task_weight: values.existing_stage_weight,
                                custom_boq_name: frm.doc.custom_bill_of_quantities,
                                /* Only copy subject + type/group flags — strip quantity/achieved/etc. */
                                fields_to_copy: ["subject", "custom_is_stage", "custom_is_task", "custom_is_subtask", "is_group"]
                            },
                            callback(r) {
                                if (r.message) {
                                    frappe.show_alert({ message: __("Stage Created from template"), indicator: "green" });
                                    d.hide(); load_hierarchy(frm);
                                }
                            }
                        });
                    });
                    return;
                }
                if (!values.subject || !values.task_weight) { frappe.msgprint("Enter stage details"); return; }
                validate_total_weight(frm, values.task_weight).then(result => {
                    if (!result.valid) { frappe.msgprint(__("Total weight cannot exceed 100%. Current: {0}%", [result.current_total])); return; }
                    frappe.call({
                        method: "frappe.client.insert",
                        args: { doc: { doctype: "Task", subject: values.subject, project: frm.doc.name,
                            custom_boq_name: frm.doc.custom_bill_of_quantities || null,
                            custom_is_stage: 1, is_group: 1, task_weight: values.task_weight, description: values.description } },
                        callback() { frappe.show_alert({ message: __("Stage Created"), indicator: "green" }); d.hide(); load_hierarchy(frm); }
                    });
                });
            }
        });
        d.show();
    });

    /* ── Add Task ───────────────────────────────────────────────────── */
    wrapper.find(".add-task").off("click").on("click", function () {
        let stage = $(this).data("stage");
        let d = new frappe.ui.Dialog({
            title: "Add Task",
            fields: [
                {
                    label: "Select Existing Task", fieldname: "existing_task", fieldtype: "Link", options: "Task",
                    get_query() { return { filters: { custom_is_task: 1, is_group: 1 } }; }
                },
                { label: "Weightage",           fieldname: "existing_task_weight", fieldtype: "Float", depends_on: "eval:doc.existing_task" },
                { label: "Include Subtasks", fieldname: "include_children",     fieldtype: "Check", default: 0, depends_on: "eval:doc.existing_task" },
                { label: "OR Create New Task", fieldname: "section_break", fieldtype: "Section Break" },
                { label: "Task Name",    fieldname: "subject",     fieldtype: "Data"  },
                { label: "Weightage",       fieldname: "task_weight", fieldtype: "Float" },
                { label: "Description",  fieldname: "description", fieldtype: "Data"  }
            ],
            primary_action_label: "Add",
            primary_action(values) {
                if (values.existing_task) {
                    if (!values.existing_task_weight) {
                        frappe.msgprint("Enter weight for the linked task");
                        return;
                    }
                    validate_task_weight(frm, stage, values.existing_task_weight).then(result => {
                        if (!result.valid) {
                            frappe.msgprint({
                                title: __("Weight Limit Exceeded"),
                                message: __("Total task weight under this stage cannot exceed 100%. Current total: {0}%, Remaining: {1}%",
                                    [result.current_total.toFixed(2), result.remaining.toFixed(2)]),
                                indicator: "red"
                            });
                            return;
                        }
                        frappe.call({
                            method: "quantbit_construction_management.api.clone_task_hierarchy",
                            args: { source_task: values.existing_task, target_project: frm.doc.name,
                                parent_task: stage, include_children: values.include_children,
                                task_weight: values.existing_task_weight,
                                custom_boq_name: frm.doc.custom_bill_of_quantities,
                                /* Only copy subject + type/group flags — strip quantity/achieved/etc. */
                                fields_to_copy: ["subject", "custom_is_stage", "custom_is_task", "custom_is_subtask", "is_group"]
                            },
                            callback() { frappe.show_alert({ message: __("Task Created from template"), indicator: "green" }); d.hide(); load_hierarchy(frm); }
                        });
                    });
                    return;
                }
                if (!values.subject || !values.task_weight) { frappe.msgprint("Enter task details"); return; }
                validate_task_weight(frm, stage, values.task_weight).then(result => {
                    if (!result.valid) { frappe.msgprint("Weight exceeded"); return; }
                    frappe.call({
                        method: "frappe.client.insert",
                        args: { doc: { doctype: "Task", subject: values.subject, project: frm.doc.name,
                            custom_boq_name: frm.doc.custom_bill_of_quantities || null,
                            parent_task: stage, custom_is_task: 1, is_group: 1,
                            task_weight: values.task_weight, description: values.description } },
                        callback() { frappe.show_alert("Task Created"); d.hide(); load_hierarchy(frm); }
                    });
                });
            }
        });
        d.show();
    });

    /* ── Add Child Task ─────────────────────────────────────────────── */
    wrapper.find(".add-child-task").off("click").on("click", function (e) {
        e.stopPropagation();
        let parent_name  = $(this).data("parent");
        let parent_depth = parseInt($(this).data("depth") || 1);
        let child_depth  = parent_depth + 1;  // the new child's depth

        // Hard guard: child tasks beyond depth 9 not allowed
        // (button shouldn't appear at depth 9 anyway, but double-check)
        if (parent_depth >= 9) {
            frappe.msgprint({
                title: __("Maximum Depth Reached"),
                message: __("You have reached the maximum task depth of 9 levels.<br>Please add a <b>Subtask</b> instead."),
                indicator: "red"
            });
            return;
        }

        let level_label = `Task Level ${child_depth - 1}`;  // task_level1 through task_level8
        let remaining   = 9 - parent_depth;  // how many more child-task levels are possible

        let d = new frappe.ui.Dialog({
            title: `Add Child Task  —  ${level_label}  (${parent_depth} of 9 deep)`,
            fields: [
                {
                    fieldtype: "HTML",
                    options: `<div style="background:#eff6ff;border-left:4px solid #2563eb;padding:10px 14px;border-radius:6px;margin-bottom:4px;font-size:13px;">
                        <b>Depth:</b> ${parent_depth} → ${child_depth} of 9 &nbsp;|&nbsp;
                        <b>Remaining child-task levels after this:</b> ${remaining - 1}
                        ${remaining === 1
                            ? '<br><span style="color:#dc2626;font-weight:600;">⚠ This will be the last child task level. The next level must be a Subtask.</span>'
                            : ''}
                    </div>`
                },
                {
                    label: "Select Existing Task", fieldname: "existing_task", fieldtype: "Link", options: "Task",
                    get_query() { return { filters: { custom_is_task: 1, is_group: 1 } }; }
                },
                { label: "Weightage",           fieldname: "existing_task_weight", fieldtype: "Float", depends_on: "eval:doc.existing_task" },
                { label: "Include Subtasks", fieldname: "include_children",     fieldtype: "Check", default: 0, depends_on: "eval:doc.existing_task" },
                { fieldtype: "Section Break" },
                { label: "OR Create New Child Task", fieldname: "section_label", fieldtype: "HTML", options: "<b>Create New Child Task</b>" },
                { label: "Task Name",    fieldname: "subject",     fieldtype: "Data"       },
                { label: "Weightage",       fieldname: "task_weight", fieldtype: "Float"      },
                { label: "Description",  fieldname: "description", fieldtype: "Small Text" }
            ],
            primary_action_label: "Add",
            primary_action(values) {
                if (values.existing_task) {
                    if (!values.existing_task_weight) {
                        frappe.msgprint("Enter weight for the linked task");
                        return;
                    }
                    validate_task_weight(frm, parent_name, values.existing_task_weight).then(result => {
                        if (!result.valid) {
                            frappe.msgprint({
                                title: __("Weight Limit Exceeded"),
                                message: __("Total weight under this parent task cannot exceed 100%. Current total: {0}%, Remaining: {1}%",
                                    [result.current_total.toFixed(2), result.remaining.toFixed(2)]),
                                indicator: "red"
                            });
                            return;
                        }
                        frappe.call({
                            method: "quantbit_construction_management.api.clone_task_hierarchy",
                            args: { source_task: values.existing_task, target_project: frm.doc.name,
                                parent_task: parent_name, include_children: values.include_children,
                                task_weight: values.existing_task_weight,
                                custom_boq_name: frm.doc.custom_bill_of_quantities,
                                /* Only copy subject + type/group flags — strip quantity/achieved/etc. */
                                fields_to_copy: ["subject", "custom_is_stage", "custom_is_task", "custom_is_subtask", "is_group"]
                            },
                            callback() {
                                frappe.show_alert({ message: __("Child Task linked from template"), indicator: "green" });
                                d.hide(); expanded_nodes.add(parent_name); load_hierarchy(frm);
                            }
                        });
                    });
                    return;
                }
                if (!values.subject) { frappe.msgprint("Enter task name"); return; }
                frappe.call({
                    method: "frappe.client.insert",
                    args: { doc: {
                        doctype: "Task",
                        subject: values.subject,
                        project: frm.doc.name,
                        custom_boq_name: frm.doc.custom_bill_of_quantities || null,
                        parent_task: parent_name,
                        custom_is_task: 1,
                        is_group: 1,
                        task_weight: values.task_weight || 0,
                        description: values.description
                    }},
                    callback() {
                        frappe.show_alert({ message: __("{0} Created", [level_label]), indicator: "green" });
                        expanded_nodes.add(parent_name); d.hide(); load_hierarchy(frm);
                    }
                });
            }
        });
        d.show();
    });

    /* ── Add Subtask ────────────────────────────────────────────────── */
    wrapper.find(".add-subtask").off("click").on("click", function () {
        let parent_task  = $(this).data("task");
        let parent_depth = parseInt($(this).data("depth") || 1);
        let at_max       = parent_depth >= 9;

        let d = new frappe.ui.Dialog({
            title: "Add Subtask",
            fields: [
                {
                    fieldtype: "HTML",
                    options: `<div style="background:${at_max ? '#fff5f5' : '#f0fdf4'};border-left:4px solid ${at_max ? '#dc2626' : '#16a34a'};padding:10px 14px;border-radius:6px;margin-bottom:4px;font-size:13px;">
                        ${at_max
                            ? '<b style="color:#dc2626;">⚠ Maximum task depth (9) reached.</b><br>This subtask will be the leaf node under this task chain.'
                            : `<b>Depth:</b> ${parent_depth} of 9 &nbsp;|&nbsp; Subtask will be the final leaf node here.`}
                    </div>`
                },
                {
                    label: "Select Existing Subtask", fieldname: "existing_subtask", fieldtype: "Link", options: "Task",
                    get_query() { return { filters: { custom_is_subtask: 1 } }; }
                },
                { label: "Weightage", fieldname: "existing_subtask_weight", fieldtype: "Float", depends_on: "eval:doc.existing_subtask" },
                { fieldtype: "Section Break" },
                { label: "OR Create New Subtask", fieldname: "section_label", fieldtype: "HTML", options: "<b>Create New Subtask</b>" },
                { label: "Subtask Name", fieldname: "subject",     fieldtype: "Data"       },
                { label: "Weightage",       fieldname: "task_weight", fieldtype: "Float"      },
                { label: "Description",  fieldname: "description", fieldtype: "Small Text" }
            ],
            primary_action_label: "Add",
            primary_action(values) {
                if (values.existing_subtask) {
                    if (!values.existing_subtask_weight) {
                        frappe.msgprint("Enter weight for the linked subtask");
                        return;
                    }
                    validate_subtask_weight(frm, parent_task, values.existing_subtask_weight).then(result => {
                        if (!result.valid) {
                            frappe.msgprint({
                                title: __("Weight Limit Exceeded"),
                                message: __("Total subtask weight under this task cannot exceed 100%. Current total: {0}%, Remaining: {1}%",
                                    [result.current_total.toFixed(2), result.remaining.toFixed(2)]),
                                indicator: "red"
                            });
                            return;
                        }
                        frappe.call({
                            method: "quantbit_construction_management.api.clone_task_hierarchy",
                            args: { source_task: values.existing_subtask, target_project: frm.doc.name,
                                parent_task: parent_task, task_weight: values.existing_subtask_weight,
                                custom_boq_name: frm.doc.custom_bill_of_quantities,
                                /* Only copy subject + type/group flags — strip quantity/achieved/etc. */
                                fields_to_copy: ["subject", "custom_is_stage", "custom_is_task", "custom_is_subtask", "is_group"]
                            },
                            callback() { frappe.show_alert({ message: "Subtask linked from template", indicator: "green" }); d.hide(); load_hierarchy(frm); }
                        });
                    });
                    return;
                }
                if (!values.subject || !values.task_weight) { frappe.msgprint("Enter subtask details"); return; }
                validate_subtask_weight(frm, parent_task, values.task_weight).then(result => {
                    if (!result.valid) { frappe.msgprint("Subtask weight exceeded"); return; }
                    frappe.call({
                        method: "frappe.client.insert",
                        args: { doc: {
                            doctype: "Task",
                            subject: values.subject,
                            project: frm.doc.name,
                            custom_boq_name: frm.doc.custom_bill_of_quantities || null,
                            parent_task: parent_task,
                            custom_is_subtask: 1,
                            task_weight: values.task_weight,
                            description: values.description
                        }},
                        callback() { frappe.show_alert({ message: "Subtask Created", indicator: "green" }); d.hide(); load_hierarchy(frm); }
                    });
                });
            }
        });
        d.show();
    });

    /* ── Edit ───────────────────────────────────────────────────────── */
    wrapper.find(".edit-item").off("click").on("click", function (e) {
        e.stopPropagation();
        let row       = $(this).closest(".hierarchy-row");
        let docname   = row.data("name");
        let node_type = row.data("type");
        let type_label = node_type === "stage" ? "Stage" : node_type === "task" ? "Task" : "Subtask";

        frappe.db.get_doc("Task", docname).then(doc => {
            frappe.prompt([
                { label: "Name",        fieldname: "subject",     fieldtype: "Data",       default: doc.subject,     reqd: 1 },
                { label: "Status",      fieldname: "status",      fieldtype: "Select",     options: ["Open","Working","Completed","Cancelled"], default: doc.status },
                { label: "Priority",    fieldname: "priority",    fieldtype: "Select",     options: ["Low","Medium","High","Urgent"], default: doc.priority },
                { label: "Weightage",      fieldname: "task_weight", fieldtype: "Float",      default: doc.task_weight },
                { label: "Description", fieldname: "description", fieldtype: "Small Text", default: doc.description }
            ], function (values) {

                function do_update() {
                    frappe.call({
                        method: "frappe.client.set_value",
                        args: { doctype: "Task", name: docname, fieldname: values },
                        callback() { frappe.show_alert({ message: __("{0} Updated", [type_label]), indicator: "green" }); load_hierarchy(frm); }
                    });
                }

                if (node_type === "stage") {
                    frappe.call({ method: "frappe.client.get", args: { doctype: "Task", name: docname },
                        callback(r) {
                            validate_total_weight(frm, values.task_weight, docname).then(result => {
                                if (!result.valid) { frappe.msgprint({ title: __("Weight Exceeded"), message: __("Remaining: {0}%", [result.remaining.toFixed(2)]), indicator: "red" }); return; }
                                do_update();
                            });
                        }
                    });
                } else if (node_type === "task") {
                    frappe.call({ method: "frappe.client.get", args: { doctype: "Task", name: docname },
                        callback(r) {
                            validate_task_weight(frm, r.message.parent_task, values.task_weight, docname).then(result => {
                                if (!result.valid) { frappe.msgprint({ title: __("Weight Exceeded"), message: __("Remaining: {0}%", [result.remaining.toFixed(2)]), indicator: "red" }); return; }
                                do_update();
                            });
                        }
                    });
                } else if (node_type === "subtask") {
                    frappe.db.get_value("Task", docname, "parent_task").then(r => {
                        if (r.message && r.message.parent_task) {
                            validate_subtask_weight(frm, r.message.parent_task, values.task_weight, docname).then(result => {
                                if (!result.valid) { frappe.msgprint({ title: __("Weight Exceeded"), message: __("Remaining: {0}%", [result.remaining.toFixed(2)]), indicator: "red" }); return; }
                                do_update();
                            });
                        } else { do_update(); }
                    });
                } else { do_update(); }

            }, `Edit ${type_label}`);
        });
    });

    /* ── Redirect ───────────────────────────────────────────────────── */
    wrapper.find(".redirect-item").off("click").on("click", function (e) {
        e.stopPropagation();
        frappe.set_route("Form", "Task", $(this).data("name"));
    });

    /* ── Assign ─────────────────────────────────────────────────────── */
    wrapper.find(".assign-item").off("click").on("click", function (e) {
        e.stopPropagation();
        let docname = $(this).closest(".hierarchy-row").data("name");
        frappe.db.get_doc("Task", docname).then(doc => {
            let d = new frappe.ui.Dialog({
                title: "Assign Task",
                fields: [
                    { label: "Assign To", fieldname: "assign_to",    fieldtype: "Link",  options: "User", reqd: 1 },
                    { label: "Hours",     fieldname: "expected_time", fieldtype: "Float", default: doc.expected_time || 0 },
                    { label: "End Date",  fieldname: "exp_end_date",  fieldtype: "Date",  default: doc.exp_end_date }
                ],
                primary_action_label: "Assign",
                primary_action(values) {
                    frappe.call({
                        method: "frappe.client.set_value",
                        args: { doctype: "Task", name: docname, fieldname: { expected_time: values.expected_time, exp_end_date: values.exp_end_date } },
                        callback() {
                            frappe.call({
                                method: "frappe.desk.form.assign_to.add",
                                args: { assign_to: [values.assign_to], doctype: "Task", name: docname, description: "" },
                                callback() { frappe.show_alert({ message: __("Task Assigned to ") + values.assign_to, indicator: "green" }); d.hide(); load_hierarchy(frm); }
                            });
                        }
                    });
                }
            });
            d.show();
        });
    });

    /* ── Update (subtask action menu) ───────────────────────────────── */
    wrapper.find(".update-item").off("click").on("click", function (e) {
        e.stopPropagation();
        let task_name = $(this).data("name");

        frappe.db.get_value("Task", task_name, ["project", "subject", "parent_task"]).then(r => {
            let project      = r.message && r.message.project;
            let task_subject = r.message && r.message.subject;

            const options = [
                { key: "edit",             label: "✏ Edit Task" },
                { key: "manpower",         label: "Manpower Usage",    doctype: "Manpower Usage"  },
                { key: "equipment",        label: "Equipment Usage",   doctype: "Equipment Usage" },
                { key: "progress",         label: "Task Progress",     doctype: "Task Progress"   },
                { key: "material",         label: "Material Consumed", doctype: "Stock Entry"     },
                { key: "material_receipt", label: "Material Received", doctype: "Stock Entry"     }
            ];

            let cards_html = `
                <style>
                    .update-option-card { display:flex;align-items:center;gap:12px;padding:12px 16px;border:2px solid #e0e0e0;border-radius:8px;cursor:pointer;transition:all 0.2s;margin-bottom:8px;background:#fff; }
                    .update-option-card:hover  { border-color:#5e64ff;background:#f0f0ff; }
                    .update-option-label { font-size:14px;color:#333; }
                </style>
                <div style="padding:4px 0 8px;">
                    <div style="font-size:12px;color:#888;margin-bottom:10px;">Task: <b>${task_subject || task_name}</b></div>`;

            options.forEach(opt => {
                cards_html += `<div class="update-option-card" data-key="${opt.key}" data-doctype="${opt.doctype}"><span class="update-option-label">${opt.label}</span></div>`;
            });
            cards_html += `</div>`;

            let d = new frappe.ui.Dialog({
                title: __("Update Task"),
                fields: [{ fieldtype: "HTML", fieldname: "update_options_html", options: cards_html }]
            });
            d.show();

            d.$wrapper.find(".update-option-card").on("dblclick", function () {
                let sel_key     = $(this).data("key");
                let sel_doctype = $(this).data("doctype");
                d.hide();
                if (sel_key === "edit") {
                    let row = wrapper.find(`.hierarchy-row[data-name="${task_name}"]`);
                    open_edit_task_dialog(frm, task_name, row.data("type"));
                } else if (sel_key === "manpower")         { open_manpower_usage_dialog(task_name, project); }
                else if (sel_key === "equipment")          { open_equipment_usage_dialog(task_name, project); }
                else if (sel_key === "progress")           { open_task_progress_dialog(task_name, project); }
                else if (sel_key === "material")           { open_material_consumed_dialog(task_name, project); }
                else if (sel_key === "material_receipt")   { open_material_received_dialog(task_name, project); }
                else { frappe.new_doc(sel_doctype, { project: project || "" }); }
            });
        });
    });
}

/* ══════════════════════════════════════════════════════════════════════════
   All inline dialog functions below are unchanged from original
   ══════════════════════════════════════════════════════════════════════════ */

function open_manpower_usage_dialog(task_name, project) {
    let today = frappe.datetime.get_today();

    async function get_ancestors(name) {
        let ancestors = [], current = name;
        while (current) {
            let res = await frappe.db.get_value("Task", current,
                ["name","subject","parent_task","custom_is_stage","custom_is_task","custom_is_subtask"]);
            if (!res.message) break;
            ancestors.unshift(res.message);
            current = res.message.parent_task;
        }
        return ancestors;
    }

    Promise.all([
        frappe.db.get_value("Employee", { user_id: frappe.session.user }, "name"),
        frappe.db.get_value("Project", project || "", "custom_site"),
        get_ancestors(task_name)
    ]).then(([emp_r, proj_r, ancestors]) => {
        let employee = emp_r.message && emp_r.message.name;
        let site     = proj_r.message && proj_r.message.custom_site;

        let first_row = {};
        if (ancestors.length >= 1) first_row.task    = ancestors[0].name;
        if (ancestors.length >= 2) first_row.subtask = ancestors[1].name;
        for (let i = 2; i < ancestors.length; i++) first_row[`task_level${i - 1}`] = ancestors[i].name;

        function calculate_row(row) {
            if (!row) return;
            if (row.time_in && row.time_out) {
                let t1 = moment(row.time_in, "HH:mm:ss"), t2 = moment(row.time_out, "HH:mm:ss");
                if (t2.isBefore(t1)) t2.add(1, 'days');
                row.hours = parseFloat(t2.diff(t1, 'hours', true).toFixed(2));
            }
            row.total_presenty = parseFloat(((row.quantity || 0) * (row.presenty || 0)).toFixed(4));
            row.amount = parseFloat((row.total_presenty * (row.rate || 0)).toFixed(2));
            if (d && d.fields_dict && d.fields_dict.manpower_usage) d.fields_dict.manpower_usage.grid.refresh();
        }

        let d = new frappe.ui.Dialog({
            title: __("New Manpower Usage"), size: "extra-large",
            fields: [
                { label: __("Project"),       fieldname: "project",       fieldtype: "Link",   options: "Project",  default: project,  read_only: 1, reqd: 1 },
                { label: __("Site"),          fieldname: "site",          fieldtype: "Link",   options: "Site",     default: site,     reqd: 1 },
                { label: __("Shift"),         fieldname: "shift",         fieldtype: "Select", options: "\nDay\nNight\nBoth", default: "", reqd: 1 },
                { fieldtype: "Column Break" },
                { label: __("Site Date"),     fieldname: "site_date",     fieldtype: "Date",   default: today,      reqd: 1 },
                { label: __("Site Engineer"), fieldname: "site_engineer", fieldtype: "Link",   options: "Employee", default: employee },
                { fieldtype: "Section Break", label: __("Manpower Details") },
                {
                    label: __("Manpower Usage"), fieldname: "manpower_usage", fieldtype: "Table",
                    options: "Manpower Usage Details", data: [first_row],
                    on_add_row: function (idx) {
                        let row = d.fields_dict.manpower_usage.df.data[idx - 1];
                        for (let k in first_row) { if (k.includes("task") || k.includes("warehouse")) row[k] = first_row[k]; }
                        d.fields_dict.manpower_usage.grid.refresh();
                    },
                    fields: [
                        { label: __("Stage"),   fieldname: "task",       fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("Task"),    fieldname: "subtask",    fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("SubTask"), fieldname: "task_level1",fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: "Task Level 1", fieldname: "task_level2",  fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level2" },
                        { label: "Task Level 2", fieldname: "task_level3",  fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level3" },
                        { label: "Task Level 3", fieldname: "task_level4",  fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level4" },
                        { label: "Task Level 4", fieldname: "task_level5",  fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level5" },
                        { label: "Task Level 5", fieldname: "task_level6",  fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level6" },
                        { label: "Task Level 6", fieldname: "task_level7",  fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level7" },
                        { label: "Task Level 7", fieldname: "task_level8",  fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level8" },
                        { label: "Task Level 8", fieldname: "task_level9",  fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level9" },
                        { label: "Task Level 9", fieldname: "task_level10", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.task_level10" },
                        {
                            label: __("Contractor"), fieldname: "contractor", fieldtype: "Link", options: "Contractor",
                            in_list_view: 1, reqd: 1, columns: 2,
                            onchange: function () {
                                let row = this.doc;
                                if (row) {
                                    row.equipment_item = ""; row.rate = 0; row.uom = ""; row.skill_type = "";
                                    d.fields_dict.manpower_usage.grid.refresh();
                                    if (row.contractor) {
                                        frappe.call({
                                            method: "frappe.desk.search.search_link",
                                            args: { txt: "", searchfield: "name", start: 0, page_length: 1000,
                                                doctype: "Item", reference_doctype: "Manpower Usage",
                                                query: "quantbit_construction_management.site_diary.doctype.manpower_usage.manpower_usage.get_contractor_manpower_items",
                                                filters: { contractor: row.contractor } },
                                            callback(r) { if (r.results) row._valid_items = r.results.map(x => x.value); }
                                        });
                                    }
                                }
                            }
                        },
                        {
                            label: __("Manpower Item"), fieldname: "equipment_item", fieldtype: "Link", options: "Item",
                            in_list_view: 1, reqd: 1, columns: 2,
                            get_query: function (doc, cdt, cdn) {
                                let row = d.fields_dict.manpower_usage.df.data.find(r => r.name === cdn) || (locals[cdt] && locals[cdt][cdn]);
                                if (!row || !row.contractor) { frappe.msgprint(__("Please select a Contractor first")); return {}; }
                                if (row._valid_items && row._valid_items.length > 0) return { filters: [["name","in",row._valid_items]] };
                                return { query: "quantbit_construction_management.site_diary.doctype.manpower_usage.manpower_usage.get_contractor_manpower_items", filters: { contractor: row.contractor } };
                            },
                            onchange: function () {
                                let row = this.doc;
                                if (!row || !row.equipment_item || !row.contractor) return;
                                frappe.db.get_value("Item", row.equipment_item, ["stock_uom","custom_skill_type"]).then(r => {
                                    if (r.message) { row.uom = r.message.stock_uom || ""; row.skill_type = r.message.custom_skill_type || ""; d.fields_dict.manpower_usage.grid.refresh(); }
                                });
                                frappe.call({
                                    method: "frappe.client.get", args: { doctype: "Contractor", name: row.contractor },
                                    callback(r) {
                                        if (r.message && r.message.site_diary_contractor_item_details) {
                                            let item_row = r.message.site_diary_contractor_item_details.find(d => d.item === row.equipment_item);
                                            if (item_row) { row.rate = item_row.rate || 0; calculate_row(row); }
                                            else { row.equipment_item = ""; d.fields_dict.manpower_usage.grid.refresh(); frappe.msgprint({ title: __("Validation Error"), message: __(`Item does not exist for this contractor.`), indicator: "red" }); }
                                        }
                                    }
                                });
                            }
                        },
                        { label: __("Skill Type"),      fieldname: "skill_type",     fieldtype: "Select",   options: "Skilled\nUnskilled", in_list_view: 1, columns: 1 },
                        { label: __("UOM"),             fieldname: "uom",            fieldtype: "Link",     options: "UOM", in_list_view: 1, reqd: 1, columns: 1 },
                        { label: __("Quantity"),        fieldname: "quantity",       fieldtype: "Float",    in_list_view: 1, columns: 1, onchange: function () { calculate_row(this.doc); } },
                        { label: __("Time In"),         fieldname: "time_in",        fieldtype: "Time",     in_list_view: 1, columns: 1, onchange: function () { calculate_row(this.doc); } },
                        { label: __("Time Out"),        fieldname: "time_out",       fieldtype: "Time",     in_list_view: 1, columns: 1, onchange: function () { calculate_row(this.doc); } },
                        { label: __("Hours"),           fieldname: "hours",          fieldtype: "Float",    in_list_view: 1, read_only: 1, columns: 1 },
                        { label: __("Presenty"),        fieldname: "presenty",       fieldtype: "Float",    in_list_view: 1, columns: 1, onchange: function () { calculate_row(this.doc); } },
                        { label: __("Total Presenty"),  fieldname: "total_presenty", fieldtype: "Float",    in_list_view: 1, read_only: 1, columns: 1 },
                        { label: __("Rate"),            fieldname: "rate",           fieldtype: "Currency", in_list_view: 1, columns: 1, onchange: function () { calculate_row(this.doc); } },
                        { label: __("Amount"),          fieldname: "amount",         fieldtype: "Currency", in_list_view: 1, read_only: 1, columns: 1 }
                    ]
                }
            ],
            primary_action_label: __("Save"),
            primary_action(values) {
                frappe.call({
                    method: "frappe.client.insert",
                    args: { doc: {
                        doctype: "Manpower Usage", docstatus: 1, naming_series: "MU-",
                        project: values.project, site: values.site, shift: values.shift,
                        site_date: values.site_date, site_engineer: values.site_engineer,
                        manpower_usage: (values.manpower_usage || []).map(row => ({
                            doctype: "Manpower Usage Details",
                            task: row.task, subtask: row.subtask,
                            task_level1: row.task_level1, task_level2: row.task_level2, task_level3: row.task_level3,
                            task_level4: row.task_level4, task_level5: row.task_level5, task_level6: row.task_level6,
                            task_level7: row.task_level7, task_level8: row.task_level8, task_level9: row.task_level9,
                            task_level10: row.task_level10,
                            contractor: row.contractor, equipment_item: row.equipment_item,
                            uom: row.uom, skill_type: row.skill_type, rate: row.rate,
                            quantity: row.quantity, amount: row.amount,
                            time_in: row.time_in, time_out: row.time_out,
                            presenty: row.presenty, hours: row.hours, total_presenty: row.total_presenty
                        }))
                    }},
                    freeze: true, freeze_message: __("Saving Manpower Usage..."),
                    callback(r) {
                        if (r.message) {
                            frappe.msgprint({ title: __("Manpower Usage Created"),
                                message: __("Manpower Usage <a href='/app/manpower-usage/{0}'><b>{0}</b></a> saved.", [r.message.name]),
                                indicator: "green" });
                            d.hide();
                        }
                    }
                });
            }
        });
        d.show();
    });
}

function open_equipment_usage_dialog(task_name, project) {
    let today = frappe.datetime.get_today();

    async function get_ancestors(name) {
        let ancestors = [], current = name;
        while (current) {
            let res = await frappe.db.get_value("Task", current,
                ["name","subject","parent_task","custom_is_stage","custom_is_task","custom_is_subtask"]);
            if (!res.message) break;
            ancestors.unshift(res.message); current = res.message.parent_task;
        }
        return ancestors;
    }

    Promise.all([
        frappe.db.get_value("Employee", { user_id: frappe.session.user }, "name"),
        frappe.db.get_value("Project", project || "", "custom_site"),
        get_ancestors(task_name)
    ]).then(([emp_r, proj_r, ancestors]) => {
        let employee = emp_r.message && emp_r.message.name;
        let site     = proj_r.message && proj_r.message.custom_site;

        let first_row = {};
        if (ancestors.length >= 1) first_row.task    = ancestors[0].name;
        if (ancestors.length >= 2) first_row.subtask = ancestors[1].name;
        for (let i = 2; i < ancestors.length; i++) first_row[`task_level${i - 1}`] = ancestors[i].name;

        function calculate_row(row) {
            if (!row) return;
            row.amount = parseFloat(((row.quantity || 0) * (row.rate || 0) * (row.working_hrs || 0)).toFixed(2));
            if (d && d.fields_dict && d.fields_dict.equipment_usage_details) d.fields_dict.equipment_usage_details.grid.refresh();
        }

        let d = new frappe.ui.Dialog({
            title: __("New Equipment Usage"), size: "extra-large",
            fields: [
                { label: __("Project"),       fieldname: "project",       fieldtype: "Link",   options: "Project",  default: project, read_only: 1, reqd: 1 },
                { label: __("Site"),          fieldname: "site",          fieldtype: "Link",   options: "Site",     default: site, reqd: 1 },
                { label: __("Shift"),         fieldname: "shift",         fieldtype: "Select", options: "\nDay\nNight\nBoth", default: "", reqd: 1 },
                { fieldtype: "Column Break" },
                { label: __("Site Date"),     fieldname: "site_date",     fieldtype: "Date",   default: today, reqd: 1 },
                { label: __("Site Engineer"), fieldname: "site_engineer", fieldtype: "Link",   options: "Employee", default: employee },
                { fieldtype: "Section Break", label: __("Equipment Details") },
                {
                    label: __("Equipment Usage"), fieldname: "equipment_usage_details", fieldtype: "Table",
                    options: "Equipment Usage Details", data: [first_row],
                    on_add_row: function (idx) {
                        let row = d.fields_dict.equipment_usage_details.df.data[idx - 1];
                        for (let k in first_row) { if (k.includes("task") || k.includes("warehouse")) row[k] = first_row[k]; }
                        d.fields_dict.equipment_usage_details.grid.refresh();
                    },
                    fields: [
                        { label: __("Stage"),   fieldname: "task",        fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("Task"),    fieldname: "subtask",     fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("SubTask"), fieldname: "task_level1", fieldtype: "Link", options: "Task", in_list_view: 0 },
                        {
                            label: __("Contractor"), fieldname: "contractor", fieldtype: "Link", options: "Contractor",
                            in_list_view: 1, reqd: 1, columns: 2,
                            onchange: function () {
                                let row = this.doc;
                                if (row) {
                                    row.equipment_item = ""; row.rate = 0; row.uom = "";
                                    d.fields_dict.equipment_usage_details.grid.refresh();
                                    if (row.contractor) {
                                        frappe.call({
                                            method: "frappe.desk.search.search_link",
                                            args: { txt: "", searchfield: "name", start: 0, page_length: 1000,
                                                doctype: "Item", reference_doctype: "Equipment Usage",
                                                query: "quantbit_construction_management.site_diary.doctype.equipment_usage.equipment_usage.get_contractor_items",
                                                filters: { contractor: row.contractor } },
                                            callback(r) { if (r.results) row._valid_items = r.results.map(x => x.value); }
                                        });
                                    }
                                }
                            }
                        },
                        {
                            label: __("Equipment Item"), fieldname: "equipment_item", fieldtype: "Link", options: "Item",
                            in_list_view: 1, reqd: 1, columns: 2,
                            get_query: function (doc, cdt, cdn) {
                                let row = d.fields_dict.equipment_usage_details.df.data.find(r => r.name === cdn) || (locals[cdt] && locals[cdt][cdn]);
                                if (!row || !row.contractor) { frappe.msgprint(__("Please select a Contractor first")); return {}; }
                                if (row._valid_items && row._valid_items.length > 0) return { filters: [["name","in",row._valid_items]] };
                                return { query: "quantbit_construction_management.site_diary.doctype.equipment_usage.equipment_usage.get_contractor_items", filters: { contractor: row.contractor } };
                            },
                            onchange: function () {
                                let row = this.doc;
                                if (!row || !row.equipment_item || !row.contractor) return;
                                frappe.db.get_value("Item", row.equipment_item, "stock_uom").then(r => {
                                    if (r.message) { row.uom = r.message.stock_uom || ""; d.fields_dict.equipment_usage_details.grid.refresh(); }
                                });
                                frappe.call({
                                    method: "frappe.client.get", args: { doctype: "Contractor", name: row.contractor },
                                    callback(r) {
                                        if (r.message && r.message.site_diary_contractor_item_details) {
                                            let item_row = r.message.site_diary_contractor_item_details.find(dx => dx.item === row.equipment_item);
                                            if (item_row) { row.rate = item_row.rate || 0; calculate_row(row); }
                                            else { row.equipment_item = ""; d.fields_dict.equipment_usage_details.grid.refresh(); frappe.msgprint({ title: __("Validation Error"), message: __("Item does not exist for this contractor."), indicator: "red" }); }
                                        }
                                    }
                                });
                            }
                        },
                        { label: __("UOM"),             fieldname: "uom",            fieldtype: "Link",     options: "UOM", in_list_view: 1, reqd: 1, columns: 1 },
                        { label: __("Rate"),            fieldname: "rate",           fieldtype: "Currency", in_list_view: 1, columns: 1, onchange: function () { calculate_row(this.doc); } },
                        { label: __("Quantity"),        fieldname: "quantity",       fieldtype: "Float",    in_list_view: 1, columns: 1, onchange: function () { calculate_row(this.doc); } },
                        { label: __("Working Hrs"),     fieldname: "working_hrs",    fieldtype: "Float",    in_list_view: 1, columns: 1, onchange: function () { calculate_row(this.doc); } },
                        { label: __("Opening Reading"), fieldname: "opening_reading",fieldtype: "Float",    in_list_view: 1, columns: 1 },
                        { label: __("Closing Reading"), fieldname: "closing_reading",fieldtype: "Float",    in_list_view: 1, columns: 1 },
                        { label: __("Diesel (LTR)"),   fieldname: "diesel_filledin_ltr", fieldtype: "Float", in_list_view: 1, columns: 1 },
                        { label: __("Amount"),         fieldname: "amount",         fieldtype: "Currency", in_list_view: 1, read_only: 1, columns: 1 }
                    ]
                }
            ],
            primary_action_label: __("Save"),
            primary_action(values) {
                frappe.call({
                    method: "frappe.client.insert",
                    args: { doc: {
                        doctype: "Equipment Usage", docstatus: 1, naming_series: "EU-",
                        project: values.project, site: values.site, site_date: values.site_date,
                        shift: values.shift, site_engineer: values.site_engineer,
                        equipment_usage_details: (values.equipment_usage_details || []).map(row => ({
                            doctype: "Equipment Usage Details",
                            task: row.task, subtask: row.subtask,
                            task_level1: row.task_level1, task_level2: row.task_level2, task_level3: row.task_level3,
                            task_level4: row.task_level4, task_level5: row.task_level5, task_level6: row.task_level6,
                            task_level7: row.task_level7, task_level8: row.task_level8, task_level9: row.task_level9,
                            task_level10: row.task_level10,
                            contractor: row.contractor, equipment_item: row.equipment_item, uom: row.uom,
                            rate: row.rate, quantity: row.quantity, working_hrs: row.working_hrs,
                            opening_reading: row.opening_reading, closing_reading: row.closing_reading,
                            diesel_filledin_ltr: row.diesel_filledin_ltr, amount: row.amount
                        }))
                    }},
                    freeze: true, freeze_message: __("Saving Equipment Usage..."),
                    callback(r) {
                        if (r.message) {
                            frappe.msgprint({ title: __("Equipment Usage Created"),
                                message: __("Equipment Usage <a href='/app/equipment-usage/{0}'><b>{0}</b></a> saved.", [r.message.name]),
                                indicator: "green" });
                            d.hide();
                        }
                    }
                });
            }
        });
        d.show();
    });
}

function open_task_progress_dialog(task_name, project) {
    let today = frappe.datetime.get_today();

    async function get_ancestors(name) {
        let ancestors = [], current = name;
        while (current) {
            let res = await frappe.db.get_value("Task", current,
                ["name","subject","parent_task","custom_total_quantity","custom_total_achieved","custom_uom"]);
            if (!res.message) break;
            ancestors.unshift(res.message); current = res.message.parent_task;
        }
        return ancestors;
    }

    Promise.all([
        frappe.db.get_value("Employee", { user_id: frappe.session.user }, "name"),
        frappe.db.get_value("Project", project || "", "custom_site"),
        get_ancestors(task_name)
    ]).then(([emp_r, proj_r, ancestors]) => {
        let employee = emp_r.message && emp_r.message.name;
        let site     = proj_r.message && proj_r.message.custom_site;

        let first_row = {};
        if (ancestors.length >= 1) first_row.parent_task = ancestors[0].name;
        if (ancestors.length >= 2) first_row.task        = ancestors[1].name;
        for (let i = 2; i < ancestors.length; i++) first_row[`task_level${i - 1}`] = ancestors[i].name;

        let deepest = ancestors[ancestors.length - 1];
        if (deepest) {
            first_row.total_qty = deepest.custom_total_quantity || 0;
            first_row._previous_total_achieved = deepest.custom_total_achieved || 0;
            first_row.total_achieved = first_row._previous_total_achieved;
            first_row.percent_completed = first_row.total_qty > 0
                ? parseFloat(((first_row.total_achieved / first_row.total_qty) * 100).toFixed(2)) : 0;
        }

        function calculate_row(row) {
            if (!row) return;
            let prev = row._previous_total_achieved || 0;
            row.total_achieved = prev + (row.achieved_today || 0);
            row.percent_completed = row.total_qty > 0
                ? parseFloat(((row.total_achieved / row.total_qty) * 100).toFixed(2)) : 0;
            if (d && d.fields_dict && d.fields_dict.task_progress_details) d.fields_dict.task_progress_details.grid.refresh();
        }

        let d = new frappe.ui.Dialog({
            title: __("New Task Progress"), size: "extra-large",
            fields: [
                { label: __("Project"),       fieldname: "project",       fieldtype: "Link",   options: "Project",  default: project, read_only: 1, reqd: 1 },
                { label: __("Site"),          fieldname: "site",          fieldtype: "Link",   options: "Site",     default: site, reqd: 1 },
                { fieldtype: "Column Break" },
                { label: __("Site Date"),     fieldname: "site_date",     fieldtype: "Date",   default: today, reqd: 1 },
                { label: __("Site Engineer"), fieldname: "site_engineer", fieldtype: "Link",   options: "Employee", default: employee },
                { label: __("Shift"),         fieldname: "shift",         fieldtype: "Select", options: "\nDay\nNight\nBoth", default: "Day" },
                { fieldtype: "Section Break", label: __("Task Progress Details") },
                {
                    label: __("Task Progress Details"), fieldname: "task_progress_details", fieldtype: "Table",
                    options: "Task Progress Details", data: [first_row],
                    on_add_row: function (idx) {
                        let row = d.fields_dict.task_progress_details.df.data[idx - 1];
                        for (let k in first_row) { if (k.includes("task") || k.includes("warehouse")) row[k] = first_row[k]; }
                        d.fields_dict.task_progress_details.grid.refresh();
                    },
                    fields: [
                        { label: __("Stage"),            fieldname: "parent_task",      fieldtype: "Link",  options: "Task", in_list_view: 0 },
                        { label: __("Task"),             fieldname: "task",             fieldtype: "Link",  options: "Task", in_list_view: 0 },
                        { label: __("SubTask"),          fieldname: "task_level1",      fieldtype: "Link",  options: "Task", in_list_view: 0 },
                        { label: __("Total Qty"),        fieldname: "total_qty",        fieldtype: "Float", in_list_view: 1, columns: 1, read_only: 1 },
                        { label: __("Planned Today"),    fieldname: "planned_today",    fieldtype: "Float", in_list_view: 1, columns: 1 },
                        { label: __("Achieved Today"),   fieldname: "achieved_today",   fieldtype: "Float", in_list_view: 1, columns: 1, reqd: 1, onchange: function () { calculate_row(this.doc); } },
                        { label: __("Total Achieved"),   fieldname: "total_achieved",   fieldtype: "Float", in_list_view: 1, columns: 1, read_only: 1 },
                        { label: __("% Completed"),      fieldname: "percent_completed",fieldtype: "Float", in_list_view: 1, columns: 1, read_only: 1 }
                    ]
                }
            ],
            primary_action_label: __("Save"),
            primary_action(values) {
                frappe.call({
                    method: "frappe.client.insert",
                    args: { doc: {
                        doctype: "Task Progress", docstatus: 1,
                        project: values.project, site: values.site,
                        site_date: values.site_date, site_engineer: values.site_engineer, shift: values.shift,
                        task_progress_details: (values.task_progress_details || []).map(row => ({
                            doctype: "Task Progress Details",
                            parent_task: row.parent_task, task: row.task,
                            task_level1: row.task_level1, task_level2: row.task_level2, task_level3: row.task_level3,
                            task_level4: row.task_level4, task_level5: row.task_level5, task_level6: row.task_level6,
                            task_level7: row.task_level7, task_level8: row.task_level8, task_level9: row.task_level9,
                            task_level10: row.task_level10,
                            total_qty: row.total_qty, planned_today: row.planned_today,
                            achieved_today: row.achieved_today, total_achieved: row.total_achieved,
                            percent_completed: row.percent_completed
                        }))
                    }},
                    freeze: true, freeze_message: __("Saving Task Progress..."),
                    callback(r) {
                        if (r.message) {
                            frappe.msgprint({ title: __("Task Progress Created"),
                                message: __("Task Progress <a href='/app/task-progress/{0}'><b>{0}</b></a> saved.", [r.message.name]),
                                indicator: "green" });
                            d.hide();
                        }
                    }
                });
            }
        });
        d.show();
    });
}

function open_material_consumed_dialog(task_name, project) {
    let today = frappe.datetime.get_today();

    async function get_ancestors(name) {
        let ancestors = [], current = name;
        while (current) {
            let res = await frappe.db.get_value("Task", current,
                ["name","subject","parent_task","custom_is_stage","custom_is_task","custom_is_subtask"]);
            if (!res.message) break;
            ancestors.unshift(res.message); current = res.message.parent_task;
        }
        return ancestors;
    }

    Promise.all([
        frappe.db.get_value("Project", project || "", ["custom_site","company"]),
        get_ancestors(task_name),
        frappe.db.get_list("Warehouse", { filters: { custom_project: project }, fields: ["name"] })
    ]).then(([proj_r, ancestors, wh_list]) => {
        let site    = proj_r.message && proj_r.message.custom_site;
        let company = proj_r.message && proj_r.message.company;
        let default_warehouse = (wh_list && wh_list.length === 1) ? wh_list[0].name : "";

        let first_row = {};
        if (ancestors.length >= 1) first_row.custom_task    = ancestors[0].name;
        if (ancestors.length >= 2) first_row.custom_subtask = ancestors[1].name;
        for (let i = 2; i < ancestors.length; i++) first_row[`custom_task_level${i - 1}`] = ancestors[i].name;
        first_row.s_warehouse = default_warehouse;

        let d = new frappe.ui.Dialog({
            title: __("Material Consumed (Material Issue)"), size: "extra-large",
            fields: [
                { label: __("Project"),      fieldname: "project",      fieldtype: "Link",   options: "Project", default: project, read_only: 1, reqd: 1 },
                { label: __("Site"),         fieldname: "site",         fieldtype: "Link",   options: "Site",    default: site, reqd: 1 },
                { label: __("Shift"),        fieldname: "shift",        fieldtype: "Select", options: "\nDay\nNight\nBoth", default: "", reqd: 1 },
                { fieldtype: "Column Break" },
                { label: __("Posting Date"), fieldname: "posting_date", fieldtype: "Date",   default: today, reqd: 1 },
                { label: __("Company"),      fieldname: "company",      fieldtype: "Link",   options: "Company", default: company, reqd: 1, read_only: 1 },
                { fieldtype: "Section Break", label: __("Items") },
                {
                    label: __("Items"), fieldname: "items", fieldtype: "Table",
                    options: "Stock Entry Detail", data: [first_row],
                    on_add_row: function (idx) {
                        let row = d.fields_dict.items.df.data[idx - 1];
                        for (let k in first_row) { if (k.includes("task") || k.includes("warehouse")) row[k] = first_row[k]; }
                        d.fields_dict.items.grid.refresh();
                    },
                    fields: [
                        { label: __("Stage"),   fieldname: "custom_task",       fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("Task"),    fieldname: "custom_subtask",    fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("SubTask"), fieldname: "custom_task_level1",fieldtype: "Link", options: "Task", in_list_view: 0 },
                        {
                            label: __("Item Code"), fieldname: "item_code", fieldtype: "Link", options: "Item", in_list_view: 1, reqd: 1, columns: 2,
                            onchange: function () {
                                let row = this.doc;
                                if (!row || !row.item_code) return;
                                frappe.db.get_value("Item", row.item_code, ["stock_uom"]).then(r => {
                                    if (r.message) { row.uom = row.stock_uom = r.message.stock_uom || ""; d.fields_dict.items.grid.refresh(); }
                                });
                            }
                        },
                        {
                            label: __("Source Warehouse"), fieldname: "s_warehouse", fieldtype: "Link", options: "Warehouse", in_list_view: 1, reqd: 1, columns: 2,
                            get_query() { return { filters: { custom_project: project } }; }
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
                    args: { doc: {
                        doctype: "Stock Entry", docstatus: 1, stock_entry_type: "Material Issue",
                        project: values.project, posting_date: values.posting_date,
                        custom_shift: values.shift, company: values.company,
                        items: (values.items || []).map(row => ({
                            doctype: "Stock Entry Detail", site: values.site,
                            item_code: row.item_code, s_warehouse: row.s_warehouse,
                            custom_task: row.custom_task, custom_subtask: row.custom_subtask,
                            custom_task_level1: row.custom_task_level1, custom_task_level2: row.custom_task_level2,
                            custom_task_level3: row.custom_task_level3, custom_task_level4: row.custom_task_level4,
                            custom_task_level5: row.custom_task_level5, custom_task_level6: row.custom_task_level6,
                            custom_task_level7: row.custom_task_level7, custom_task_level8: row.custom_task_level8,
                            custom_task_level9: row.custom_task_level9, custom_task_level10: row.custom_task_level10,
                            qty: row.qty, uom: row.uom, stock_uom: row.uom, received_qty: row.qty, project: values.project
                        }))
                    }},
                    freeze: true, freeze_message: __("Saving Material Issue..."),
                    callback(r) {
                        if (r.message) {
                            frappe.msgprint({ title: __("Stock Entry Created"),
                                message: __("Material Issue <a href='/app/stock-entry/{0}'><b>{0}</b></a> saved.", [r.message.name]),
                                indicator: "green" });
                            d.hide();
                        }
                    }
                });
            }
        });
        d.show();
    });
}

function open_material_received_dialog(task_name, project) {
    let today = frappe.datetime.get_today();

    async function get_ancestors(name) {
        let ancestors = [], current = name;
        while (current) {
            let res = await frappe.db.get_value("Task", current,
                ["name","subject","parent_task","custom_is_stage","custom_is_task","custom_is_subtask"]);
            if (!res.message) break;
            ancestors.unshift(res.message); current = res.message.parent_task;
        }
        return ancestors;
    }

    Promise.all([
        frappe.db.get_value("Project", project || "", ["custom_site","company"]),
        get_ancestors(task_name),
        frappe.db.get_list("Warehouse", { filters: { custom_project: project }, fields: ["name"] })
    ]).then(([proj_r, ancestors, wh_list]) => {
        let site    = proj_r.message && proj_r.message.custom_site;
        let company = proj_r.message && proj_r.message.company;
        let default_warehouse = (wh_list && wh_list.length === 1) ? wh_list[0].name : "";

        let first_row = {};
        if (ancestors.length >= 1) first_row.custom_task    = ancestors[0].name;
        if (ancestors.length >= 2) first_row.custom_subtask = ancestors[1].name;
        for (let i = 2; i < ancestors.length; i++) first_row[`custom_task_level${i - 1}`] = ancestors[i].name;
        first_row.warehouse = default_warehouse;

        let d = new frappe.ui.Dialog({
            title: __("Material Received (Purchase Receipt)"), size: "extra-large",
            fields: [
                { label: __("Project"),      fieldname: "project",      fieldtype: "Link",   options: "Project",  default: project, read_only: 1, reqd: 1 },
                { label: __("Site"),         fieldname: "site",         fieldtype: "Link",   options: "Site",     default: site, reqd: 1 },
                { label: __("Shift"),        fieldname: "shift",        fieldtype: "Select", options: "\nDay\nNight\nBoth", default: "", reqd: 1 },
                { fieldtype: "Column Break" },
                { label: __("Supplier"),     fieldname: "supplier",     fieldtype: "Link",   options: "Supplier", reqd: 1 },
                { label: __("Posting Date"), fieldname: "posting_date", fieldtype: "Date",   default: today, reqd: 1 },
                { label: __("Company"),      fieldname: "company",      fieldtype: "Link",   options: "Company",  default: company, reqd: 1, read_only: 1 },
                { fieldtype: "Section Break", label: __("Items") },
                {
                    label: __("Items"), fieldname: "items", fieldtype: "Table",
                    options: "Purchase Receipt Item", data: [first_row],
                    on_add_row: function (idx) {
                        let row = d.fields_dict.items.df.data[idx - 1];
                        for (let k in first_row) { if (k.includes("task") || k.includes("warehouse")) row[k] = first_row[k]; }
                        d.fields_dict.items.grid.refresh();
                    },
                    fields: [
                        { label: __("Stage"),       fieldname: "custom_task",        fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: __("Task"),        fieldname: "custom_subtask",     fieldtype: "Link", options: "Task", in_list_view: 0 },
                        { label: "Task Level 1",    fieldname: "custom_task_level1", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level1" },
                        { label: "Task Level 2",    fieldname: "custom_task_level2", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level2" },
                        { label: "Task Level 3",    fieldname: "custom_task_level3", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level3" },
                        { label: "Task Level 4",    fieldname: "custom_task_level4", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level4" },
                        { label: "Task Level 5",    fieldname: "custom_task_level5", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level5" },
                        { label: "Task Level 6",    fieldname: "custom_task_level6", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level6" },
                        { label: "Task Level 7",    fieldname: "custom_task_level7", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level7" },
                        { label: "Task Level 8",    fieldname: "custom_task_level8", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level8" },
                        { label: "Task Level 9",    fieldname: "custom_task_level9", fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level9" },
                        { label: "Task Level 10",   fieldname: "custom_task_level10",fieldtype: "Link", options: "Task", in_list_view: 0, depends_on: "eval:doc.custom_task_level10" },
                        {
                            label: __("Item Code"), fieldname: "item_code", fieldtype: "Link", options: "Item", in_list_view: 1, reqd: 1, columns: 2,
                            onchange: function () {
                                let row = this.doc;
                                if (!row || !row.item_code) return;
                                frappe.db.get_value("Item", row.item_code, ["stock_uom"]).then(r => {
                                    if (r.message) { row.uom = row.stock_uom = r.message.stock_uom || ""; d.fields_dict.items.grid.refresh(); }
                                });
                            }
                        },
                        {
                            label: __("Accepted Warehouse"), fieldname: "warehouse", fieldtype: "Link", options: "Warehouse", in_list_view: 1, reqd: 1, columns: 2,
                            get_query() { return { filters: { custom_project: project } }; }
                        },
                        { label: __("Accepted Qty"),     fieldname: "qty",           fieldtype: "Float",    in_list_view: 1, reqd: 1, columns: 1 },
                        { label: __("Rejected Warehouse"),fieldname: "r_warehouse",   fieldtype: "Link",     options: "Warehouse", in_list_view: 1, columns: 2 },
                        { label: __("Rejected Qty"),     fieldname: "rejected_qty",  fieldtype: "Float",    in_list_view: 1, columns: 1 },
                        { label: __("UOM"),              fieldname: "uom",           fieldtype: "Link",     options: "UOM", in_list_view: 1, read_only: 1, columns: 1 }
                    ]
                }
            ],
            primary_action_label: __("Save"),
            primary_action(values) {
                frappe.call({
                    method: "frappe.client.insert",
                    args: { doc: {
                        doctype: "Purchase Receipt", docstatus: 1,
                        project: values.project, supplier: values.supplier,
                        posting_date: values.posting_date, custom_shift: values.shift, company: values.company,
                        items: (values.items || []).map(row => ({
                            doctype: "Purchase Receipt Item",
                            item_code: row.item_code, warehouse: row.warehouse,
                            rejected_warehouse: row.r_warehouse,
                            qty: row.qty, rejected_qty: row.rejected_qty,
                            uom: row.uom, stock_uom: row.uom,
                            received_qty: (flt(row.qty || 0) + flt(row.rejected_qty || 0)),
                            project: values.project
                        }))
                    }},
                    freeze: true, freeze_message: __("Saving Purchase Receipt..."),
                    callback(r) {
                        if (r.message) {
                            frappe.msgprint({ title: __("Purchase Receipt Created"),
                                message: __("Material Receipt <a href='/app/purchase-receipt/{0}'><b>{0}</b></a> saved.", [r.message.name]),
                                indicator: "green" });
                            d.hide();
                        }
                    }
                });
            }
        });
        d.show();
    });
}