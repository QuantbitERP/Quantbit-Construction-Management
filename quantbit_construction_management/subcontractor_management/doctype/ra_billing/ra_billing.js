frappe.ui.form.on("RA Billing", {
    setup(frm) {
        frm.set_query("stage", "ra_billing_details", function () {
            let filters = { "custom_is_stage": 1 };
            if (frm.doc.project) filters.project = frm.doc.project;
            return { filters: filters };
        });

        frm.set_query("task", "ra_billing_details", function () {
            let filters = { "custom_is_task": 1 };
            if (frm.doc.project) filters.project = frm.doc.project;
            return { filters: filters };
        });

        // frm.set_query("subtask", "ra_billing_details", function () {
        //     let filters = { "custom_is_subtask": 1 };
        //     if (frm.doc.project) filters.project = frm.doc.project;
        //     return { filters: filters };
        // });
    },
    taxes_and_charges(frm) {
        // Selecting a Taxes and Charges Template fetches its rows into the
        // `tax_details` table, exactly like Sales Invoice.
        if (!frm.doc.taxes_and_charges) {
            frm.clear_table("tax_details");
            frm.refresh_field("tax_details");
            calculate_taxes_and_totals(frm);
            return;
        }

        frm.call({
            doc: frm.doc,
            method: "get_template_details",
            callback: function (r) {
                frm.clear_table("tax_details");

                (r.message || []).forEach(function (row) {
                    let child = frm.add_child("tax_details");
                    child.type = row.type;
                    child.account_head = row.account_head;
                    child.description = row.description;
                    child.tax_rate = row.tax_rate;
                    child.row_id = row.row_id;
                });

                frm.refresh_field("tax_details");
                calculate_taxes_and_totals(frm);
            }
        });
    },
    tax_category(frm) {
        // Resolve the applicable template via the Tax Rule engine, then let the
        // taxes_and_charges handler load the rows (mirrors Sales Invoice.set_taxes).
        if (!frm.doc.tax_category) {
            return;
        }

        frm.call({
            doc: frm.doc,
            method: "set_taxes_from_category",
            callback: function (r) {
                if (r.message) {
                    frm.set_value("taxes_and_charges", r.message);
                } else {
                    frappe.show_alert({
                        message: __("No Tax Rule matched this Tax Category."),
                        indicator: "orange"
                    });
                }
            }
        });
    },
    with_tax(frm) {
        if (!frm.doc.with_tax) {
            // clear stale tax amounts so nothing lingers if re-checked later inconsistently
            (frm.doc.tax_details || []).forEach(row => {
                row.tax_amount = 0;
                row.on_amount = 0;
                row.total_amount = 0;
            });
            frm.refresh_field("tax_details");
        }
        calculate_taxes_and_totals(frm);
    },
    get_details(frm) {
        if (!frm.doc.project) {
            frappe.msgprint(__("Please select a Project first."));
            return;
        }

        frappe.call({
            method: "quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.get_project_tasks",
            args: {
                project: frm.doc.project
            },
            freeze: true,
            freeze_message: __("Fetching project tasks..."),
            callback: function (r) {
                console.log(r);

                if (!r.message || !r.message.length) {
                    frappe.msgprint(__("No tasks found for the selected project."));
                    return;
                }

                frm.clear_table("ra_billing_details");

                let max_level = 0;

                r.message.forEach(row => {
                    let child = frm.add_child("ra_billing_details");

                    child.stage_subject = row.stage;
                    child.stage = row.stage_id;

                    child.task = row.task_id;
                    child.task_subject = row.task;

                    child.total_quantity = row.total_quantity;
                    child.total_achieved = row.total_achieved;
                    child.rate = row.rate;
                    child.billed_quantity = row.billed_quantity;
                    child.billable_quantity = row.billable_quantity;
                    child.amount = row.amount;
                    child.uom = row.uom;

                    // Set link + subject for ALL levels (1-10) consistently
                    for (let i = 1; i <= 10; i++) {
                        if (row[`task_level${i}_id`]) {
                            child[`task_level${i}`] = row[`task_level${i}_id`];
                            child[`level${i}_subject`] = row[`task_level${i}`];

                            max_level = Math.max(max_level, i);
                        }
                    }
                });

                frm.refresh_field("ra_billing_details");

                // Show/hide level columns based on the deepest level actually used
                for (let i = 1; i <= 10; i++) {
                    let show = i <= max_level;

                    frm.fields_dict.ra_billing_details.grid.update_docfield_property(
                        `task_level${i}`,
                        "hidden",
                        !show
                    );

                    frm.fields_dict.ra_billing_details.grid.update_docfield_property(
                        `level${i}_subject`,
                        "hidden",
                        !show
                    );
                }

                // Recalculate grand total
                let total = frm.doc.ra_billing_details.reduce(
                    (sum, row) => sum + flt(row.amount), 0
                );
                frm.set_value("grand_total", total);

                frappe.show_alert({
                    message: __("Details fetched successfully."),
                    indicator: "green"
                });
            }
        });
    },
    get_details_(frm) {
    if (!frm.doc.project) {
        frappe.msgprint(__("Please select a Project first."));
        return;
    }

    frappe.call({
        method: "quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.get_project_steel_tasks",
        args: {
            project: frm.doc.project
        },
        freeze: true,
        freeze_message: __("Fetching steel tasks..."),
        callback: function (r) {

            if (!r.message || !r.message.length) {
                frappe.msgprint(__("No steel subtasks found for the selected project."));
                return;
            }

            frm.clear_table("ra_steel_details");

            let max_level = 0;

            r.message.forEach(row => {

                let child = frm.add_child("ra_steel_details");

                child.stage = row.stage_id;
                child.stage_subject = row.stage;

                child.task = row.task_id;
                child.task_subject = row.task;

                child.task_level1 = row.task_level1_id;
                child.task_level1_subject = row.task_level1;

              
                for (let i = 1; i <= 10; i++) {

                    if (row[`task_level${i}_id`]) {

                        child[`task_level${i}`] = row[`task_level${i}_id`];

                        // IMPORTANT
                        child[`level${i}_subject`] = row[`task_level${i}`];

                        max_level = Math.max(max_level, i);
                    }
                }
            });

            for (let i = 1; i <= 10; i++) {

                let show = i <= max_level;

                frm.fields_dict.ra_steel_details.grid.update_docfield_property(
                    `task_level${i}`,
                    "hidden",
                    !show
                );

                frm.fields_dict.ra_steel_details.grid.update_docfield_property(
                    `level${i}_subject`,
                    "hidden",
                    !show
                );
            }

            frm.refresh_field("ra_steel_details");

            let total = frm.doc.ra_steel_details.reduce(
                (sum, d) => sum + flt(d.amount),
                0
            );

            frm.set_value("grand_total", total);

            frappe.show_alert({
                message: __("Steel task details fetched successfully."),
                indicator: "green"
            });
        }
                });
    },
    download_template(frm) {

        if (!frm.doc.ra_steel_details || !frm.doc.ra_steel_details.length) {
            frappe.msgprint(__("Please fetch steel details first."));
            return;
        }

        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/api/method/quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.download_steel_template";

        const rows = document.createElement("input");
        rows.type = "hidden";
        rows.name = "rows";
        rows.value = JSON.stringify(frm.doc.ra_steel_details);

        const csrf = document.createElement("input");
        csrf.type = "hidden";
        csrf.name = "csrf_token";
        csrf.value = frappe.csrf_token;

        form.appendChild(rows);
        form.appendChild(csrf);

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    },  
    import_data(frm) {

        if (!frm.doc.import_file) {
            frappe.msgprint(__("Please attach the filled template file first."));
            return;
        }

        frappe.call({
            method: "quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.import_steel_template",
            args: {
                docname: frm.doc.name,
                file_url: frm.doc.import_file
            },
            freeze: true,
            freeze_message: __("Importing steel measurement data..."),
            callback: function (r) {
                if (!r.message) return;

                frappe.show_alert({
                    message: __("Imported {0} row(s). {1} row(s) could not be matched.", [
                        r.message.updated,
                        r.message.unmatched
                    ]),
                    indicator: r.message.unmatched ? "orange" : "green"
                });

                if (r.message.unmatched_rows && r.message.unmatched_rows.length) {
                    frappe.msgprint({
                        title: __("Unmatched Rows"),
                        message: r.message.unmatched_rows.join("<br>"),
                        indicator: "orange"
                    });
                }

                frm.reload_doc();
            }
        });
    }, 
    refresh(frm) {
        frm.add_custom_button(__("Export RA"), function () {

            window.open(
                frappe.urllib.get_full_url(
                    "/api/method/quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.export_ra_excel"
                    + "?ra_billing=" + frm.doc.name
                )
            );

        });
        if (frm.doc.docstatus === 1) {

            frm.add_custom_button(__("Sales Invoice"), function () {

                frappe.model.open_mapped_doc({
                    method: "quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.create_sales_invoice",
                    frm: frm
                });

            }, __("Create"));
        }
        if (frm.doc.level_data_json) {
            try {
                let data = JSON.parse(frm.doc.level_data_json);
                if (data && data.columns && data.columns.length) {
                    render_level_matrix(frm, data, true); 
                }
            } catch (e) {
                console.error("Failed to parse level_data_json", e);
            }
    }
    },

    get_levels(frm) {

        if (!frm.doc.project) {
            frappe.msgprint(__("Please select Project."));
            return;
        }

        frappe.call({
            method: "quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.get_level_sheet_details",
            args: {
                project: frm.doc.project
            },
            freeze: true,
            freeze_message: __("Fetching Level Sheet..."),

            callback: function(r) {

                if (!r.message || !r.message.length) {
                    frappe.msgprint(__("No Level Sheet found."));
                    return;
                }

                frm.clear_table("level_details");

                r.message.forEach(row => {

                    let child = frm.add_child("level_details");

                    if (row.is_header) {

                        child.task = row.task;
                        child.task_subject = row.task_subject;

                    } else if (row.is_average) {

                        child.average_rl = row.average_rl;
                        child.remark = row.remark;

                    } else {

                        child.design = row.design;
                        child.bs = row.bs;
                        child.is = row.is;
                        child.fs = row.fs;
                        child.hi = row.hi;
                        child.rl = row.rl;
                        child.remark = row.remark;
                    }

                });

                frm.refresh_field("level_details");

                frappe.show_alert({
                    message: __("Level Sheet fetched successfully."),
                    indicator: "green"
                });

            }
        });

    },
    add_column(frm) {

    if (!frm.doc.project) {
        frappe.msgprint("Select Project");
        return;
    }

    frappe.call({

        method: "quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.get_level_matrix",

        args: {
            project: frm.doc.project
        },

        callback(r) {

            if (!r.message)
                return;

            render_level_matrix(frm, r.message);

        }

    });

    },
    calculate(frm) {
 
        if (!frm.doc.project) {
            frappe.msgprint(__("Please select a Project first."));
            return;
        }
 
        let wrapper = frm.fields_dict.levelsheet_details && frm.fields_dict.levelsheet_details.$wrapper;
 
        if (!wrapper || !wrapper.find(".level-grid").length) {
            frappe.msgprint(__("Please generate the Level Matrix first using 'Add Column'."));
            return;
        }
 
        let matrix = gather_level_matrix(frm);
 
        frappe.call({
            method: "quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.calculate_level_matrix",
            args: {
                project: frm.doc.project,
                matrix: matrix
            },
            freeze: true,
            freeze_message: __("Calculating..."),
            callback(r) {
 
                if (!r.message)
                    return;
 
                render_level_matrix(frm, r.message);
 
                frappe.show_alert({
                    message: __("Level Matrix calculated successfully."),
                    indicator: "green"
                });
            }
        });
    }


});

function gather_level_matrix(frm) {
 
    const wrapper = frm.fields_dict.levelsheet_details.$wrapper;
 
    let columns = [];
    wrapper.find(".level-grid thead th").each(function (i) {
        // Skip the first two header cells: "Sr." and "Particular"
        if (i < 2) return;
        columns.push($(this).text().trim());
    });
 
    let rows = [];
    wrapper.find(".level-grid tbody tr").each(function () {
        const $tr = $(this);
        const particular = $tr.find("td").eq(1).text().trim();
        const task_id = $tr.data("task-id") || null;
        let values = {};
 
        $tr.find(".level-input").each(function () {
            const column = $(this).data("column");
            const val = $(this).val();
            values[column] = val;
        });
 
        rows.push({ particular: particular, task_id: task_id, values: values });
    });
 
    return { columns: columns, rows: rows };
}
 
function render_level_matrix(frm, data, from_load=false) {
 
    let html = `
    <style>
 
        .level-grid-container{
            width:100%;
            overflow-x:auto;
            overflow-y:auto;
            border:1px solid #d1d8dd;
        }
 
        .level-grid{
            border-collapse:collapse;
            table-layout:auto;
            width:max-content;
            min-width:100%;
        }
 
        .level-grid th,
        .level-grid td{
            border:1px solid #d1d8dd;
            white-space:nowrap;
        }
 
        .level-grid th{
            background:#f7f7f7;
            text-align:center;
            font-weight:600;
            padding:8px 12px;
        }
 
        .level-grid td{
            padding:0;
        }
 
        /* Sr */
        .level-grid th:first-child,
        .level-grid td:first-child{
            width:60px;
            min-width:60px;
            text-align:center;
            background:#fafafa;
            font-weight:600;
            padding:8px;
        }
 
        /* Particular */
        .level-grid th:nth-child(2),
        .level-grid td:nth-child(2){
            width:220px;
            min-width:220px;
            background:#fafafa;
            font-weight:600;
            padding:8px;
        }
 
        .dynamic-col{
            width:auto;
        }
 
        .level-input{
 
            display:inline-block;
 
            border:none;
            outline:none;
            background:transparent;
            box-shadow:none;
            appearance:none;
            -webkit-appearance:none;
            -moz-appearance:none;
 
            font:inherit;
            color:inherit;
 
            text-align:center;
 
            padding:8px 12px;
            margin:0;
 
            width:auto;
            min-width:20px;
 
            overflow:visible;
            white-space:nowrap;
 
        }
 
        .level-input:focus{
 
            background:#fffbe6;
            box-shadow:none;
            border:none;
            outline:none;
 
        }
 
    </style>
 
    <div class="level-grid-container">
 
    <table class="level-grid">
 
        <thead>
 
            <tr>
 
                <th>Sr.</th>
 
                <th>Particular</th>
    `;
 
    data.columns.forEach((col) => {
 
        html += `<th class="dynamic-col">${col}</th>`;
 
    });
 
    html += `
            </tr>
        </thead>
 
        <tbody>
    `;
 
    data.rows.forEach((row, index) => {
 
        html += `
            <tr data-task-id="${row.task_id || ''}">>
 
                <td>${index + 1}</td>
 
                <td>${row.particular}</td>
        `;
 
        data.columns.forEach((col) => {
 
            let value = row.values ? row.values[col] : "";
 
            if (value == null)
                value = "";
 
            html += `
                <td>
 
                    <input
                        type="text"
                        class="level-input"
                        value="${value}"
                        size="${Math.max(String(value).length, col.length, 4)}"
                        data-parent="${row.particular}"
                        data-column="${col}"
                        autocomplete="off"
                        spellcheck="false"
                    >
 
                </td>
            `;
 
        });
 
        html += `</tr>`;
 
    });
 
    html += `
        </tbody>
 
    </table>
 
    </div>
    `;
 
    frm.fields_dict.levelsheet_details.$wrapper.html(html);

    if (!from_load) {
        frappe.model.set_value(frm.doctype, frm.docname, "level_data_json", JSON.stringify(data));
        frm.dirty();
    }

    const wrapper = frm.fields_dict.levelsheet_details.$wrapper;

    wrapper.find(".level-input").on("input", function () {
        this.size = Math.max(
            this.value.length + 1,
            $(this).data("column").length,
            4
        );
    });

    wrapper.find(".level-input").on("blur", function () {
        const value = $(this).val().trim();
        if (!value) return;

        if (isNaN(Number(value))) {
            frappe.show_alert({
                message: __("Please enter a valid number."),
                indicator: "red"
            });
            $(this).val("").focus();
        }
    });
 
}
frappe.ui.form.on("RA Billing Details", {
    no1(frm, cdt, cdn) {
        calculate_quantity(frm, cdt, cdn);
    },
    no2(frm, cdt, cdn) {
        calculate_quantity(frm, cdt, cdn);
    },
    length(frm, cdt, cdn) {
        calculate_quantity(frm, cdt, cdn);
    },
    width(frm, cdt, cdn) {
        calculate_quantity(frm, cdt, cdn);
    },
    height(frm, cdt, cdn) {
        calculate_quantity(frm, cdt, cdn);
    },
    rate(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "amount", flt(row.quantity) * flt(row.rate));

        let total = frm.doc.ra_billing_details.reduce(
            (sum, r) => sum + flt(r.amount), 0
        );
        frm.set_value("grand_total", total);
        frappe.call({
            method: "quantbit_construction_management.subcontractor_management.doctype.ra_billing.ra_billing.validate_task_rates",
            args: {
                doc: frm.doc
            },
        });
    },
    quantity(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "amount", flt(row.quantity) * flt(row.rate));

        let total = frm.doc.ra_billing_details.reduce(
            (sum, r) => sum + flt(r.amount), 0
        );
        frm.set_value("grand_total", total);
    }
});


function calculate_quantity(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    let fields = ["no1", "no2", "length", "width", "height"];
    let quantity = 1;
    let has_value = false;

    fields.forEach(f => {
        if (flt(row[f])) {
            quantity *= flt(row[f]);
            has_value = true;
        }
    });

    quantity = has_value ? quantity : 0;

    frappe.model.set_value(cdt, cdn, "quantity", quantity);

    frappe.model.set_value(cdt, cdn, "amount", flt(quantity) * flt(row.rate));

    let total = frm.doc.ra_billing_details.reduce(
        (sum, r) => sum + flt(r.amount), 0
    );
    frm.set_value("grand_total", total);
}

frappe.ui.form.on("RA Steel Details", {
    no_of_fdn: function (frm, cdt, cdn) { calculate_steel_length(frm, cdt, cdn); },
    no_of_bar: function (frm, cdt, cdn) { calculate_steel_length(frm, cdt, cdn); },
    cutting_length: function (frm, cdt, cdn) { calculate_steel_length(frm, cdt, cdn); },
    weight_of_bar: function (frm, cdt, cdn) { calculate_steel_weight(frm, cdt, cdn); },
    total_length: function (frm, cdt, cdn) { calculate_steel_weight(frm, cdt, cdn); }
});

function calculate_steel_length(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let fields = ["no_of_fdn", "no_of_bar", "cutting_length"];
    let total_length = 1;
    let has_value = false;

    fields.forEach(f => {
        if (flt(row[f])) {
            total_length *= flt(row[f]);
            has_value = true;
        }
    });

    total_length = has_value ? total_length : 0;
    frappe.model.set_value(cdt, cdn, 'total_length', total_length);
    calculate_steel_weight(frm, cdt, cdn);
}

function calculate_steel_weight(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let total_weight = flt(row.total_length) * flt(row.weight_of_bar);
    frappe.model.set_value(cdt, cdn, 'total_weight', total_weight);
}
function calculate_grand_total(frm) {
    let total = (frm.doc.ra_billing_details || []).reduce(
        (sum, r) => sum + flt(r.amount), 0
    );
    frm.set_value("grand_total", total);

    // grand_total (net total) changed -> taxes based on it are stale, recompute all
    calculate_taxes_and_totals(frm);
}

// Resolve the reference row for "On Previous Row Amount/Total" charge types,
// mirroring ERPNext's use of row_id (1-indexed). Falls back to the row above.
function get_ref_tax_row(taxes, row, idx) {
    let pos = idx - 1;
    if (row.row_id) {
        let parsed = parseInt(row.row_id, 10);
        if (!isNaN(parsed)) {
            pos = parsed - 1;
        }
    }
    if (pos >= 0 && pos < taxes.length && pos !== idx) {
        return taxes[pos];
    }
    return null;
}

// Full charge-type aware tax calculation, mirroring Sales Invoice
// (erpnext.controllers.taxes_and_totals). Net total base = grand_total.
function calculate_taxes_and_totals(frm) {
    let net_total = flt(frm.doc.grand_total);
    let taxes = frm.doc.tax_details || [];

    if (!frm.doc.with_tax || !taxes.length) {
        frm.set_value("total_taxes_and_charges", 0);
        frm.set_value("final_grand_total", net_total);
        return;
    }

    let running_total = net_total;
    let total_taxes = 0;

    taxes.forEach((row, idx) => {
        let rate = flt(row.tax_rate);
        let on_amount = 0;
        let current_tax_amount = 0;

        if (row.type === "Actual") {
            current_tax_amount = flt(row.tax_amount);
        } else if (row.type === "On Net Total") {
            on_amount = net_total;
            current_tax_amount = (rate / 100) * on_amount;
        } else if (row.type === "On Previous Row Amount") {
            let ref = get_ref_tax_row(taxes, row, idx);
            on_amount = ref ? flt(ref.tax_amount) : 0;
            current_tax_amount = (rate / 100) * on_amount;
        } else if (row.type === "On Previous Row Total") {
            let ref = get_ref_tax_row(taxes, row, idx);
            on_amount = ref ? flt(ref.total_amount) : net_total;
            current_tax_amount = (rate / 100) * on_amount;
        } else {
            // On Item Quantity / unset -> not applicable to a lump-sum bill
            current_tax_amount = 0;
        }

        current_tax_amount = flt(current_tax_amount, precision("tax_amount", row));

        row.on_amount = on_amount;
        row.tax_amount = current_tax_amount;
        running_total += current_tax_amount;
        row.total_amount = running_total;
        total_taxes += current_tax_amount;
    });

    frm.refresh_field("tax_details");
    frm.set_value("total_taxes_and_charges", flt(total_taxes, precision("total_taxes_and_charges", frm.doc)));
    frm.set_value("final_grand_total", flt(net_total + total_taxes, precision("final_grand_total", frm.doc)));
}

frappe.ui.form.on("RA Billing Tax Details", {
    type(frm) {
        calculate_taxes_and_totals(frm);
    },
    tax_rate(frm) {
        calculate_taxes_and_totals(frm);
    },
    tax_amount(frm) {
        // Only "Actual" rows are user-entered; recompute so dependent rows update.
        calculate_taxes_and_totals(frm);
    },
    row_id(frm) {
        calculate_taxes_and_totals(frm);
    },
    account_head(frm) {
        calculate_taxes_and_totals(frm);
    },
    tax_details_add(frm) {
        calculate_taxes_and_totals(frm);
    },
    tax_details_remove(frm) {
        calculate_taxes_and_totals(frm);
    }
});

