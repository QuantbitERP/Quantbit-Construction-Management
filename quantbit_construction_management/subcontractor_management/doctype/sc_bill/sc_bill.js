// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("SC Bill", {
    get_data(frm) {
        const missing = [];
        if (!frm.doc.project) missing.push(__("Project"));
        if (!frm.doc.subcontract) missing.push(__("Subcontract"));
        if (!frm.doc.period_from) missing.push(__("Period From"));
        if (!frm.doc.period_to) missing.push(__("Period To"));

        if (missing.length) {
            frappe.msgprint(__("Please select {0} first.", [missing.join(", ")]));
            return;
        }

        frappe.call({
            method: "quantbit_construction_management.subcontractor_management.doctype.sc_bill.sc_bill.get_sc_bill_data",
            args: {
                project: frm.doc.project,
                subcontractor: frm.doc.subcontract,
                period_from: frm.doc.period_from,
                period_to: frm.doc.period_to,
            },
            freeze: true,
            freeze_message: __("Fetching subcontractor data..."),
            callback(r) {
                if (!r.message || !r.message.length) {
                    frm.clear_table("bill_items");
                    frappe.msgprint(
                        __("No subcontractor data found for the selected filters.")
                    );
                    return;
                }

                frm.clear_table("bill_items");

                let max_level = 0;

                r.message.forEach(row => {
                    const child = frm.add_child("bill_items");

                    child.check = row.check;
                    child.parent_task = row.parent_task;
                    child.parent_task_subject = row.parent_task_subject;
                    child.task = row.task;
                    child.task_subject = row.task_subject;

                    child.qty = row.qty;
                    child.billable_qty = row.billable_qty;
                    child.rate = row.rate;
                    child.amount = row.amount;
                    child.billed_qty = row.billed_qty;
                    child.paid_qty = row.paid_qty;
                    child.subcontractor_refer = row.subcontractor_refer;

                    // Fill every populated hierarchy level (1-10) so the
                    // parent-child relationship is preserved on each row.
                    for (let i = 1; i <= 10; i++) {
                        if (row[`task_level${i}`]) {
                            child[`task_level${i}`] = row[`task_level${i}`];
                            child[`level${i}_subject`] = row[`level${i}_subject`];
                            max_level = Math.max(max_level, i);
                        }
                    }
                });

                frm.refresh_field("bill_items");

                // Show only the hierarchy columns actually in use.
                for (let i = 1; i <= 10; i++) {
                    const show = i <= max_level;
                    frm.fields_dict.bill_items.grid.update_docfield_property(
                        `task_level${i}`, "hidden", !show
                    );
                    frm.fields_dict.bill_items.grid.update_docfield_property(
                        `level${i}_subject`, "hidden", !show
                    );
                }

                recalc_sc_totals(frm);

                frappe.show_alert({
                    message: __("Data fetched successfully."),
                    indicator: "green",
                });
            },
        });
    },
    advance_recovery(frm) {
        recalc_sc_totals(frm);
    },
    retention(frm) {
        recalc_sc_totals(frm);
    },
});

frappe.ui.form.on("SC Bill Items", {
    form_render(frm, cdt, cdn) {
        render_task_view(frm, cdt, cdn);
    },
    check(frm) {
        recalc_sc_totals(frm);
    },
    qty(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        const max = flt(row.billable_qty);

        // A row can never bill more than its remaining billable quantity.
        if (flt(row.qty) > max) {
            frappe.msgprint(
                __("Qty cannot exceed the remaining billable quantity ({0}).", [max])
            );
            frappe.model.set_value(cdt, cdn, "qty", max);
            return;
        }

        frappe.model.set_value(cdt, cdn, "amount", flt(row.qty) * flt(row.rate));
    },
    rate(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "amount", flt(row.qty) * flt(row.rate));
    },
    amount(frm) {
        recalc_sc_totals(frm);
    },
    bill_items_remove(frm) {
        recalc_sc_totals(frm);
    },
});

// Gross = sum of selected rows' amount; Net = gross - advance recovery - retention.
function recalc_sc_totals(frm) {
    const gross = (frm.doc.bill_items || [])
        .filter(row => row.check)
        .reduce((sum, row) => sum + flt(row.amount), 0);

    frm.set_value("gross_amount", gross);
    frm.set_value(
        "net_amount",
        flt(gross) - flt(frm.doc.advance_recovery) - flt(frm.doc.retention)
    );
}

// Node style presets keyed by position in the hierarchy: the top node is the
// Stage, the deepest node is the billable leaf, everything between is a Task.
const SC_TASK_VIEW_STYLES = {
    stage: { bg: "#1a365d", color: "#ffffff", tag: __("Stage") },
    task: { bg: "#e9c46a", color: "#1a202c", tag: __("Task") },
    leaf: { bg: "#fdf6e3", color: "#1a202c", tag: __("Subtask") },
};

function collect_task_view_nodes(row) {
    // Ordered root -> deepest, matching HIERARCHY_FIELDS on the server side.
    const spec = [
        { link: "parent_task", subject: "parent_task_subject" },
        { link: "task", subject: "task_subject" },
    ];
    for (let i = 1; i <= 10; i++) {
        spec.push({ link: `task_level${i}`, subject: `level${i}_subject` });
    }

    const nodes = [];
    spec.forEach(f => {
        if (row[f.link] || row[f.subject]) {
            nodes.push({
                name: row[f.link] || "",
                subject: row[f.subject] || row[f.link] || "",
            });
        }
    });
    return nodes;
}

function render_task_view(frm, cdt, cdn) {
    const grid_row = frm.fields_dict.bill_items.grid.grid_rows_by_docname[cdn];
    if (!grid_row || !grid_row.grid_form) return;

    const field = grid_row.grid_form.fields_dict.task_view;
    if (!field) return;

    const row = locals[cdt][cdn];
    const nodes = collect_task_view_nodes(row);

    if (!nodes.length) {
        field.$wrapper.html(
            `<div style="color:#94a3b8;padding:8px 4px;font-style:italic;">${__(
                "No task hierarchy available for this row."
            )}</div>`
        );
        return;
    }

    const rows_html = nodes.map((node, idx) => {
        let style = SC_TASK_VIEW_STYLES.task;
        if (idx === 0) style = SC_TASK_VIEW_STYLES.stage;
        else if (idx === nodes.length - 1) style = SC_TASK_VIEW_STYLES.leaf;

        const indent = idx * 22;
        const connector = idx > 0
            ? `<span style="color:#cbd5e1;margin-right:6px;">&#9492;&#9472;</span>`
            : "";

        return `
            <div style="display:flex;align-items:center;margin:3px 0;padding-left:${indent}px;">
                ${connector}
                <span style="display:inline-block;font-size:10px;font-weight:600;letter-spacing:.4px;
                             text-transform:uppercase;padding:2px 8px;border-radius:10px;margin-right:8px;
                             background:${style.bg};color:${style.color};border:1px solid rgba(0,0,0,.08);">
                    ${frappe.utils.escape_html(style.tag)}
                </span>
                <span style="font-weight:500;color:#0f172a;">
                    ${frappe.utils.escape_html(node.subject)}
                </span>
            </div>`;
    }).join("");

    field.$wrapper.html(`
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;background:#ffffff;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;
                        letter-spacing:.5px;margin-bottom:8px;">
                ${__("Task Hierarchy")}
            </div>
            ${rows_html}
        </div>
    `);
}
