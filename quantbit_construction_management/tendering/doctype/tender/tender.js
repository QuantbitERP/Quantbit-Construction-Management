// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt


frappe.ui.form.on("Tender", {
    refresh:function(frm){
        frm.set_query("opportunity_from", function () {
			return {
				filters: {
					name: ["in", ["Customer", "Lead"]],
				},
			};
		});

        
        if (frm.doc.show_create_customer_button == 1) {
            frm.add_custom_button(__('Create Customer'), function() {
                create_customer_from_lead(frm);
            });
        }

        
        
        if (frm.doc.workflow_state == "Alloted") {
            frm.add_custom_button(__('Create Project'), function() {
                show_project_creation_dialog(frm);
            });
        }
    },
    total_ctc: function(frm) {
        calculate_contract_values(frm);
    },

    profit_on_ctc: function(frm) {
        calculate_contract_values(frm);
    }
});

function calculate_contract_values(frm) {
    if (frm.doc.total_ctc && frm.doc.profit_on_ctc) {

        let contract_value = frm.doc.total_ctc * (1 + (frm.doc.profit_on_ctc / 100));
        let profit_margin = contract_value - frm.doc.total_ctc;
        let net_profit_margin = contract_value
            ? (profit_margin / contract_value) * 100
            : 0;

        frm.set_value("contract_value", contract_value);
        frm.set_value("profit_margin", profit_margin);
        frm.set_value("net_profit_margin", net_profit_margin);

    } else {
        frm.set_value("contract_value", 0);
        frm.set_value("profit_margin", 0);
        frm.set_value("net_profit_margin", 0);
    }
}

function create_customer_from_lead(frm) {
    frappe.call({
        method: 'create_customer_from_lead',
        doc: frm.doc,
        callback: function(r) {
            if (r.message) {
                frappe.show_alert({
                    message: r.message.message,
                    indicator: 'green'
                });
                
                
                frm.reload_doc();
            }
        },
        error: function(r) {
            frappe.show_alert({
                message: __('Error creating customer: ') + (r.responseJSON ? r.responseJSON.exc_type : r.statusText),
                indicator: 'red'
            });
        }
    });
}


window.show_project_creation_dialog = show_project_creation_dialog;

function show_project_creation_dialog(frm) {
                
    var d = new frappe.ui.Dialog({
        title: 'Create Project',
        fields: [
            {
                fieldname: 'project_name',
                label: 'Project Name',
                fieldtype: 'Data',
                reqd: 1,
                default: frm.doc.name,
                change: function() {
                    var value = d.get_value('project_name');
                }
            }
        ]
    });
    
    
    d.set_primary_action('Create Project Document', function() {
        var project_name = d.get_value('project_name');
        
        if (project_name && project_name.trim() !== '') {
            frappe.call({
                method: 'quantbit_construction_management.tendering.doctype.tender.tender.create_project_from_tender',
                args: {
                    tender_name: frm.doc.name,
                    project_name: project_name
                },
                callback: function(response) {
                    if (response && response.message) {
                        frappe.show_alert({
                            message: response.message.message,
                            indicator: 'green'
                        });
                        d.hide();
                        
                        frm.reload_doc();
                    } else {
                        frappe.show_alert({
                            message: 'No response from server',
                            indicator: 'red'
                        });
                    }
                },
                error: function(r) {
                    frappe.show_alert({
                        message: __('Error creating project: ') + (r.responseJSON ? r.responseJSON.exc_type : r.statusText),
                        indicator: 'red'
                    });
                }
            });
        } else {
            frappe.show_alert({
                message: 'Project name is required',
                indicator: 'red'
            });
        }
    });
    
    d.show();
}
