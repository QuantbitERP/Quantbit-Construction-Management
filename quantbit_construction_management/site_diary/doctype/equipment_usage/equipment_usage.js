// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Equipment Usage", {
	setup(frm) {
        frm.set_query("task","equipment_usage_details",function() {
            return {
                filters: {
                    project: frm.doc.project,
                    "custom_is_task": 1,
                    "is_group": 1
                }
            };
        });
        
        frm.fields_dict.equipment_usage_details.grid.get_field('subtask').get_query = function(doc, cdt, cdn) {

                    let row = locals[cdt][cdn];

                    return {
                        filters: {
                            parent_task: row.task,
                            custom_is_subtask: 1
                        }
                    };
                };
	},
     onload(frm) {
        if (frm.is_new() && !frm.doc.site_date) {
            frm.set_value("site_date", frappe.datetime.get_today());
        }


        if (frm.is_new() && !frm.doc.site_engineer) {

            frappe.db.get_value(
                "Employee",
                { user_id: frappe.session.user },
                "employee_name",
                (r) => {
                    if (r && r.name) {
                        frm.set_value("site_engineer", r.name);
                    }
                }
            );
        }
    }
});

frappe.ui.form.on("Equipment Usage Details", {
    quantity: function(frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    working_hrs: function(frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    contractor: function(frm, cdt, cdn) {
        validate_equipment(frm, cdt, cdn);
    },
    equipment_item: function(frm, cdt, cdn) {
        validate_equipment(frm, cdt, cdn);
    }



});

function calculate_amount(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    row.amount = (row.quantity || 0) * (row.rate || 0)* (row.working_hrs || 0);

    frm.refresh_field("equipment_usage_details");
}

function validate_equipment(frm, cdt, cdn) {

    let row = locals[cdt][cdn];

    if (!row.contractor || !row.equipment_item) {
        return;
    }

    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Contractor",
            name: row.contractor
        },
        callback: function(r) {

            if (r.message) {

                let contractor_doc = r.message;

                let item_row = contractor_doc.site_diary_contractor_item_details.find(d =>
                    d.item === row.equipment_item
                );

                if (!item_row) {
                    frappe.model.set_value(cdt, cdn, "equipment_item", "");
                    frappe.model.set_value(cdt, cdn, "contractor", "");
                    frappe.throw({
                        title: __("Validation Error"),
                       message: __(`Equipment ${row.equipment_item} does not exist for this contractor, 
                            Add ${row.equipment_item} in contractor or change the contractor.`),
                        indicator: "red"
                    });
                } else {

                    // Fetch rate from contractor child table
                    frappe.model.set_value(cdt, cdn, "rate", item_row.rate || 0);
                }
            }
        }
    });
}