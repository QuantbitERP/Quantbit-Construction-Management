// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Manpower Usage", {
	setup(frm) {
        frm.set_query("task","manpower_usage", function() {
            return {
                filters: {
                    project: frm.doc.project
                }
            };
        });
        
       frm.fields_dict.manpower_usage.grid.get_field('subtask').get_query = function(doc, cdt, cdn) {

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
    }
});

frappe.ui.form.on("Manpower Usage Details", {
    rate: function(frm, cdt, cdn) {
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

    row.amount = (row.quantity || 0) * (row.rate || 0);

    frm.refresh_field("manpower_usage");
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

                    frappe.throw({
                        title: __("Validation Error"),
                        message: __(`Equipment ${row.equipment_item} does not exist for this contractor`),
                        indicator: "red"
                    });

                    frappe.model.set_value(cdt, cdn, "rate", 0);

                } else {

                    // Fetch rate from contractor child table
                    frappe.model.set_value(cdt, cdn, "rate", item_row.rate || 0);
                }
            }
        }
    });
}