frappe.ui.form.on("Contractor Billing", {
    setup: function(frm) {
        frm.set_query("doc_name", "contractor_billing_details", function() {
            return {
                filters: {
                    name: ["in", ["Manpower Usage", "Equipment Usage"]]
                }
            };
        });
    },

     refresh: function(frm) {
        calculate_grand_total(frm);
        let outstanding = frm.doc.outstanding_amount !== undefined && frm.doc.outstanding_amount !== null 
            ? frm.doc.outstanding_amount 
            : (frm.doc.grand_total - flt(frm.doc.paid_amount));
            
        if (frm.doc.docstatus === 1 && flt(outstanding) > 0) {

        frm.add_custom_button("Create Payment Entry", function() {

            frappe.model.open_mapped_doc({
                method: "quantbit_construction_management.subcontractor_management.doctype.contractor_billing.contractor_billing.create_payment_entry",
                frm: frm
            });

        },
            "Create");
		}
    },

    get_details: async function(frm) {

        if (!frm.doc.project || !frm.doc.start_date || !frm.doc.end_date || !frm.doc.contractor || !frm.doc.type) {
            frappe.msgprint("Please fill all fields");
            return;
        }

        // clear old rows
        frm.clear_table("contractor_billing_details");

        let doctype = "";
        let child_table = "";

        if (frm.doc.type === "Manpower") {
            doctype = "Manpower Usage";
            child_table = "manpower_usage"; 
        }
        else if (frm.doc.type === "Equipment") {
            doctype = "Equipment Usage";
            child_table = "equipment_usage_details"; 
        }
        else if (frm.doc.type === "Task") {
            doctype = "Task Progress";
            child_table = "task_progress_details"; 
        }

        // get filtered parent docs
        let docs = await frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: doctype,
                fields: ["name", "site_date", "project"],
                filters: {
                    project: frm.doc.project,
                    site_date: ["between", [frm.doc.start_date, frm.doc.end_date]]
                },
                limit_page_length: 1000
            }
        });

        if (!docs.message.length) {
            frappe.msgprint("No records found");
            return;
        }

        for (let d of docs.message) {

            let full_doc = await frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: doctype,
                    name: d.name
                }
            });

            let data = full_doc.message;

            let rows = (data[child_table] || []).filter(row => {
                return row.contractor === frm.doc.contractor && !row.billed;
            });

            rows.forEach(row => {

                let child = frm.add_child("contractor_billing_details");

                child.id = data.name;
                child.doc_name = doctype;
                child.reference_row_name = row.name;
                child.site_date = data.site_date;
                child.item = row.equipment_item || row.item;
                child.uom = row.uom;
                child.quantity = row.quantity || row.qty || row.achieved_today;
                child.rate = row.rate;
                child.working_hrs = row.working_hrs;
                child.amount = row.amount;
                child.presenty = row.presenty;
                child.time_in = row.time_in;
                child.hours = row.hours;
                child.time_out = row.time_out;
                child.total_presenty = row.total_presenty;
                child.opening_reading = row.opening_reading;
                child.closing_reading = row.closing_reading;
                child.diesel_filledin_ltr = row.diesel_filledin_ltr;
            });
        }
        calculate_grand_total(frm);

        frm.refresh_field("contractor_billing_details");

        frappe.msgprint("Data fetched successfully");
    }
});

frappe.ui.form.on('Contractor Billing Details', {
    amount: function(frm, cdt, cdn) {
        calculate_grand_total(frm);
    },

    contractor_billing_details_remove: function(frm) {
        calculate_grand_total(frm);
    }
});

function calculate_grand_total(frm) {
    let total = 0;

    (frm.doc.contractor_billing_details || []).forEach(row => {
        total += flt(row.amount);
    });

    frm.set_value('grand_total', total);
}