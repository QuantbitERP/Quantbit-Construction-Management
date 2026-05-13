
frappe.ui.form.on("Opportunity", {
	setup: function (frm) {

		frm.set_query("opportunity_from", function () {
			return {
				filters: {
					name: ["in", ["Customer", "Lead"]],
				},
			};
		});
	},
	onload: function(frm) {
		// Add click handler to redirect to Tender if linked
		if (frm.doc.custom_tender_created) {
			frm.add_custom_button(__('Go to Tender'), function() {
				frappe.set_route('Form', 'Tender', frm.doc.custom_tender_created);
			});
		}
	},
	refresh: function(frm) {
		
		if (frm.doc.workflow_state == "Go For Bid" && !frm.doc.custom_tender_created) {
			frm.add_custom_button(__('Create Tender'), function() {
				show_tender_creation_dialog(frm);
			});
		}
	}
});

function show_tender_creation_dialog(frm) {
	
	var d = new frappe.ui.Dialog({
		title: 'Create Tender',
		fields: [
			{
				fieldname: 'tender_name',
				label: 'Tender Name',
				fieldtype: 'Data',
				reqd: 1
			}
		],
		primary_action: {
			label: 'Create Tender Document'
		}
	});
	
		
	d.set_primary_action('Create Tender Document', function() {
		let values = d.get_values();
		
		if (!values || !values.tender_name) {
			frappe.show_alert({
				message: 'Tender Name is required',
				indicator: 'red'
			});
			return;
		}
		
		frappe.call({
			method: 'quantbit_construction_management.tendering.custom_crm.opportunity.create_tender_from_opportunity',
			args: {
				opportunity_name: frm.doc.name,
				tender_name: values.tender_name
			},
			callback: function(r) {
				if (r.message) {
					frappe.show_alert({
						message: 'Tender Created Successfully',
						indicator: 'green'
					});
					d.hide();
					frappe.set_route(
						'Form',
						'Tender',
						r.message.tender
					);
				} else {
					frappe.show_alert({
						message: 'No response from server',
						indicator: 'red'
					});
				}
			},
			error: function(err) {
				frappe.msgprint({
					title: __('Error'),
					message: __('Failed to create Tender'),
					indicator: 'red'
				});
			}
		});
	});
	
		
	d.show();
	
}