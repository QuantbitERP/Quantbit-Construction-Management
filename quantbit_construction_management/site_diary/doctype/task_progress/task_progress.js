frappe.ui.form.on("Task Progress", {
    setup(frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        frm.fields_dict.task_progress_details.grid.get_field(
            "parent_task"
        ).get_query = function (doc, cdt, cdn) {

            let child = locals[cdt][cdn];

            return {
                filters: {
                    "project": frm.doc.project,
                    "custom_is_stage": 1,
                    "is_group": 1
                }
            };
        };
        frm.fields_dict.task_progress_details.grid.get_field(
            "item"
        ).get_query = function (doc, cdt, cdn) {

            let child = locals[cdt][cdn];

            return {
                filters: {
                    "custom_item_type": "Task"
                }
            };
        };

        const source_map = {
            task: "parent_task",
            task_level1: "task",
            task_level2: "task_level1",
            task_level3: "task_level2",
            task_level4: "task_level3",
            task_level5: "task_level4",
            task_level6: "task_level5",
            task_level7: "task_level6",
            task_level8: "task_level7",
            task_level9: "task_level8",
            task_level10: "task_level9",
            task_level11: "task_level10"
        };
        Object.keys(source_map).forEach(fieldname => {

            frm.fields_dict.task_progress_details.grid.get_field(fieldname).get_query =
                function (doc, cdt, cdn) {

                    let row = locals[cdt][cdn];

                    let source_field = source_map[fieldname];
                    let task_name = row[source_field];
                    if (!task_name) {
                        return {
                            filters: {
                                name: ["=", "___invalid___"]
                            }
                        };
                    }

                    return {
                        query: "quantbit_construction_management.site_diary.doctype.task_progress.task_progress.get_depends_on_tasks",
                        filters: {
                            task: task_name
                        }
                    };
                };
        });
    },
    onload(frm) {

        if (frm.is_new() && !frm.doc.site_date) {
            frm.set_value("site_date", frappe.datetime.get_today());
        }
    }

});


frappe.ui.form.on("Task Progress Details", {
    form_render(frm, cdt, cdn) {

        // hydrate the in-memory baseline from the row's own saved values
        // (does NOT re-fetch from Task, so re-rendering the row never
        // wipes out achieved_today / total_achieved that's already there)
        hydrate_baseline(frm, cdt, cdn);

        setTimeout(() => {
            refresh_task_levels(frm, cdt, cdn);
            render_html_images(frm, cdt, cdn);
        }, 100);
    },
    parent_task: function (frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        if (!row.parent_task) return;

        // clear all selections
        frappe.model.set_value(cdt, cdn, "task", "");

        for (let i = 1; i <= 11; i++) {
            frappe.model.set_value(cdt, cdn, `task_level${i}`, "");
        }

        // show only task field
        toggle_levels(frm, row.name, 1);
        set_level_query(
            frm,
            row.name,
            "parent_task",
            "task"
        );
    },
    task: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
        load_task_baseline(frm, cdt, cdn);
    },
    task_level1: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
        load_task_baseline(frm, cdt, cdn);
    },

    task_level2: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
        load_task_baseline(frm, cdt, cdn);
    },

    task_level3: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
        load_task_baseline(frm, cdt, cdn);
    },

    task_level4: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
        load_task_baseline(frm, cdt, cdn);
    },

    task_level5: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
        load_task_baseline(frm, cdt, cdn);
    },
    task_level6: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
        load_task_baseline(frm, cdt, cdn);
    },
    task_level7: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
        load_task_baseline(frm, cdt, cdn);
    },
    task_level8: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
        load_task_baseline(frm, cdt, cdn);
    },
    task_level9: function (frm, cdt, cdn) {
        refresh_task_levels(frm, cdt, cdn);
        load_task_baseline(frm, cdt, cdn);
    },
    achieved_today(frm, cdt, cdn) {
        calculate_progress(frm, cdt, cdn);
        calculate_amount(cdt, cdn);
    },
    total_qty(frm, cdt, cdn) {
        calculate_progress(frm, cdt, cdn);
        validate_deepest_task(frm, cdt, cdn);
    },
    is_lumsum_task(frm, cdt, cdn) {
        frappe.model.set_value(cdt, cdn, "item", "");
        frappe.model.set_value(cdt, cdn, "contractor", "");
        frappe.model.set_value(cdt, cdn, "uom", "");
        frappe.model.set_value(cdt, cdn, "rate", "");
        frappe.model.set_value(cdt, cdn, "amount", "");
    },
    item(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        if (!row.contractor || !row.item) return;

        frappe.db.get_doc("Contractor", row.contractor).then(doc => {

            let contractor_item = (doc.site_diary_contractor_item_details || []).find(
                d => d.item === row.item
            );
            if (contractor_item) {
                frappe.model.set_value(cdt, cdn, "rate", contractor_item.rate);
                frappe.model.set_value(cdt, cdn, "uom", contractor_item.uom);
                setTimeout(() => {
                    calculate_amount(cdt, cdn);
                }, 100);
            } else {
                let item_code = row.item;
                frappe.db.get_value("Item", item_code, "item_name")
                    .then(r => {
                        let item_name = r.message.item_name || item_code;
                        frappe.model.set_value(cdt, cdn, "item", "");
                        frappe.throw(
                            __("Please add Item <strong>{0}</strong> in Contractor Item Details for Contractor <strong>{1}</strong>.",
                                [item_name, row.contractor])
                        );
                    });
            }
        });
    }
});
function calculate_amount(cdt, cdn) {
    let row = locals[cdt][cdn];
    let amount = flt(row.achieved_today) * flt(row.rate);
    frappe.model.set_value(cdt, cdn, "amount", amount);
}
function get_deepest_task(frm, cdt, cdn) {
    const row = locals[cdt][cdn];

    const levels = [
        "task",
        "task_level1",
        "task_level2",
        "task_level3",
        "task_level4",
        "task_level5",
        "task_level6",
        "task_level7",
        "task_level8",
        "task_level9",
        "task_level10"
    ];

    let last_task = null;

    for (let field of levels) {
        let task = row[field];

        if (task) {
            last_task = task;
        } else {
            break;
        }
    }

    return last_task;
}

function refresh_task_levels(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const levels = [
        "task",
        "task_level1",
        "task_level2",
        "task_level3",
        "task_level4",
        "task_level5",
        "task_level6",
        "task_level7",
        "task_level8",
        "task_level9",
        "task_level10"
    ];
    let visible_level = 1;
    // 1. find deepest filled level
    for (let i = 0; i < levels.length; i++) {
        if (row[levels[i]]) {
            visible_level = i + 1;
        } else {
            break;
        }
    }
    // 2. dependency check ONLY on deepest level
    const deepest_field = levels[visible_level - 1];
    const deepest_task = row[deepest_field];

    if (!deepest_task) {
        apply_visibility(frm, row.name, visible_level);
        return;
    }

    // NOTE: this function only handles level-field visibility + the
    // dependency check. It must NOT touch total_qty/total_achieved -
    // it runs on every form_render (i.e. every time a row is opened),
    // and re-fetching those from the Task here used to stomp on
    // whatever the user had already entered in achieved_today.
    // See load_task_baseline()/hydrate_baseline() for that.
    frappe.call({
        method: "quantbit_construction_management.site_diary.doctype.task_progress.task_progress.has_dependencies",
        args: {
            task: deepest_task
        },
        callback: function (r) {

            if (r.message) {
                visible_level += 1;
            }

            apply_visibility(frm, row.name, visible_level);
        }
    });
}

function apply_visibility(frm, rowname, visible_level) {

    const grid_row = frm.fields_dict.task_progress_details.grid.grid_rows_by_docname[rowname];
    if (!grid_row) return;

    grid_row.toggle_display("task", visible_level >= 1);
    grid_row.toggle_display("task_level1", true);

    for (let i = 2; i <= 11; i++) {
        grid_row.toggle_display(`task_level${i}`, visible_level >= (i + 1));
    }
}

function load_task_baseline(frm, cdt, cdn) {
    // Loads the starting point for this row's progress calculation -
    // i.e. what the deepest task's quantity/achieved already are,
    // BEFORE today's entry - straight from the Task. Runs only when
    // the task selection actually changes, and only once per task, so
    // it never overwrites achieved_today that's already been typed in.

    let row = locals[cdt][cdn];

    let deepest_task = get_deepest_task(frm, cdt, cdn);

    if (!deepest_task || row._baseline_task === deepest_task) return;

    frappe.db.get_value(
        "Task",
        deepest_task,
        ["custom_total_quantity", "custom_total_achieved"]
    ).then(r => {

        if (!r.message) return;

        row._baseline_task = deepest_task;
        row._baseline_achieved = flt(r.message.custom_total_achieved);

        frappe.model.set_value(cdt, cdn, "total_qty", flt(r.message.custom_total_quantity));
        frappe.model.set_value(cdt, cdn, "achieved_today", 0);
        apply_progress(frm, cdt, cdn);
    });
}

function hydrate_baseline(frm, cdt, cdn) {
    // Restores the in-memory baseline for a row that already has saved
    // total_achieved/achieved_today (e.g. re-opening an existing draft),
    // without re-fetching from the Task. Runs once per row.

    let row = locals[cdt][cdn];

    if (row._baseline_achieved !== undefined) return;

    let deepest_task = get_deepest_task(frm, cdt, cdn);
    if (!deepest_task) return;

    row._baseline_task = deepest_task;
    row._baseline_achieved = flt(row.total_achieved) - flt(row.achieved_today);
}

function calculate_progress(frm, cdt, cdn) {
    // Make sure a baseline exists (covers rows loaded straight from the
    // database, e.g. via bulk edit, where form_render's hydrate never ran).
    hydrate_baseline(frm, cdt, cdn);
    apply_progress(frm, cdt, cdn);
}

function apply_progress(frm, cdt, cdn) {

    let row = locals[cdt][cdn];

    let baseline_achieved = flt(row._baseline_achieved);

    let achieved_today = flt(row.achieved_today);

    let total_qty = flt(row.total_qty);

    let total_achieved = baseline_achieved + achieved_today;

    let percent_completed = 0;

    if (total_qty > 0) {
        percent_completed = (total_achieved / total_qty) * 100;
    }

    frappe.model.set_value(cdt, cdn,
        "total_achieved",
        total_achieved
    );

    frappe.model.set_value(cdt, cdn,
        "percent_completed",
        percent_completed
    );
}

function render_html_images(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let grid_row = frm.fields_dict.task_progress_details.grid.grid_rows_by_docname[cdn];
    if (!grid_row || !grid_row.grid_form) return;
    
    // Ensure images_html exists in the layout
    if (!grid_row.grid_form.fields_dict.images_html) return;
    let wrapper = grid_row.grid_form.fields_dict.images_html.$wrapper;
    wrapper.empty();

    let html = `<div class="image-uploader-wrapper">
        <div class="uploaded-images" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">`;
    
    let image_count = 0;
    for (let i = 1; i <= 10; i++) {
        let img_url = row[`image_${i}`];
        if (img_url) {
            image_count++;
            html += `
                <div class="img-preview" style="position: relative; width: 100px; height: 100px; border: 1px solid #d1d8dd; border-radius: 4px; overflow: hidden;">
                    <img src="${img_url}" style="width: 100%; height: 100%; object-fit: cover;">
                    <button class="btn btn-xs btn-danger remove-img-btn" data-index="${i}" style="position: absolute; top: 2px; right: 2px; padding: 2px 6px;">
                        <i class="fa fa-times"></i>
                    </button>
                    <a href="${img_url}" target="_blank" class="btn btn-xs btn-default" style="position: absolute; bottom: 2px; right: 2px; padding: 2px 6px;">
                        <i class="fa fa-external-link"></i>
                    </a>
                </div>
            `;
        }
    }
    
    html += `</div>`;
    
    if (image_count < 10) {
        html += `<button class="btn btn-sm btn-default add-image-btn">
            <i class="fa fa-plus"></i> Add Image
        </button>`;
    }
    html += `</div>`;

    let $el = $(html).appendTo(wrapper);

    $el.find(".add-image-btn").on("click", function(e) {
        e.preventDefault();
        new frappe.ui.FileUploader({
            doctype: frm.doc.doctype,
            docname: frm.doc.name,
            folder: "Home/Attachments",
            on_success: (file_doc) => {
                let file_url = file_doc.file_url;
                for (let i = 1; i <= 10; i++) {
                    if (!row[`image_${i}`]) {
                        frappe.model.set_value(cdt, cdn, `image_${i}`, file_url);
                        break;
                    }
                }
                render_html_images(frm, cdt, cdn);
            }
        });
    });

    $el.find(".remove-img-btn").on("click", function(e) {
        e.preventDefault();
        let idx = $(this).attr("data-index");
        frappe.model.set_value(cdt, cdn, `image_${idx}`, "");
        
        let new_images = [];
        for (let i = 1; i <= 10; i++) {
            if (row[`image_${i}`]) {
                new_images.push(row[`image_${i}`]);
            }
        }
        for (let i = 1; i <= 10; i++) {
            frappe.model.set_value(cdt, cdn, `image_${i}`, new_images[i-1] || "");
        }
        
        render_html_images(frm, cdt, cdn);
    });
}
