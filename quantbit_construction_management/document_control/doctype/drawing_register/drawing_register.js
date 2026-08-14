// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Drawing Register", {
	setup: function(frm) {
		frm.set_query("from_entity_type", function() {
			return {
				filters: { name: ["in", ["User", "Customer"]] }
			};
		});

		frm.set_query("to_entity_type", function() {
			return {
				filters: { name: ["in", ["User", "Customer"]] }
			};
		});

		frm.set_query("from_entity", function(doc) {
			if (doc.from_entity_type === "User" || doc.from_entity_type === "Customer") {
				return {
					query: "quantbit_construction_management.document_control.doctype.drawing_register.drawing_register.get_entities_without_role",
					filters: { entity_doctype: doc.from_entity_type }
				};
			}
		});

		frm.set_query("to_entity", function(doc) {
			if (doc.to_entity_type === "User" || doc.to_entity_type === "Customer") {
				return {
					query: "quantbit_construction_management.document_control.doctype.drawing_register.drawing_register.get_entities_with_role",
					filters: { entity_doctype: doc.to_entity_type }
				};
			}
		});
	},

	refresh: function(frm) {
		if (frm.is_new() && !frm.doc.issue_date) {
			frm.set_value("issue_date", frappe.datetime.get_today());
		}
		
		if (frm.doc.doc_link_drawing_register && frm.doc.amended_from) {
			frappe.db.get_value('Drawing Review Record', {
				'drawing': frm.doc.name,
				'revision_reviewed': frm.doc.current_rev
			}, ['name', 'status'], (r) => {
				if (!r || !r.name || r.status === 'Closed') {
					let btn_label = (r && r.status === 'Closed') ? __('Create Next Review') : __('Create Review Record');
					frm.add_custom_button(btn_label, function() {
						frappe.model.with_doctype('Drawing Review Record', function() {
							let doc = frappe.model.get_new_doc('Drawing Review Record');
							doc.drawing = frm.doc.name;
							doc.revision_reviewed = frm.doc.current_rev;
							doc.review_date = frappe.datetime.get_today();
							doc.target_response_date = frappe.datetime.add_days(frappe.datetime.get_today(), 7);
							doc.review_type = "Interdisciplinary";
							doc.status = 'Open';
							if (frm.doc.project) doc.project = frm.doc.project;
							if (frm.doc.discipline) doc.discipline = frm.doc.discipline;
							if (frm.doc.title) doc.title = frm.doc.title;
							frappe.set_route('Form', 'Drawing Review Record', doc.name);
						});
					}).addClass('btn-primary');
				} else {
					frm.add_custom_button(__('Open Review Record'), function() {
						frappe.set_route('Form', 'Drawing Review Record', r.name);
					}).addClass('btn-info');
				}
			});
		}
		
		let is_new_unlinked = frm.is_new() && !frm.doc.amended_from && !frm.doc.doc_link_drawing_register;
		let is_existing_main = !frm.is_new() && frm.doc.is_main;
		
		if (is_new_unlinked || is_existing_main) {
			frm.set_df_property('is_main', 'hidden', 0);
		} else {
			frm.set_df_property('is_main', 'hidden', 1);
		}
		
		// If Drawing is submitted, check the LATEST Acknowledgement
		if (frm.doc.docstatus === 1 && frm.doc.is_main) {
			let create_rev_fn = function(is_ecn_flag = 0, ecn_ref_val = null) {
				let latest_rev_in_table = "Main";
				if (frm.doc.revisions && frm.doc.revisions.length > 0) {
					latest_rev_in_table = frm.doc.revisions[frm.doc.revisions.length - 1].revision;
				}
				
				if (latest_rev_in_table === "Main") {
					generate_revision_doc(frm.doc, frm.doc.name, is_ecn_flag, ecn_ref_val);
				} else {
					frappe.db.get_list('Drawing Register', {
						filters: { 
							'doc_link_drawing_register': frm.doc.name,
							'current_rev': latest_rev_in_table
						},
						limit: 1
					}).then(records => {
						if (records && records.length > 0) {
							frappe.db.get_doc('Drawing Register', records[0].name).then(latest_doc => {
								generate_revision_doc(latest_doc, frm.doc.name, is_ecn_flag, ecn_ref_val);
							});
						} else {
							generate_revision_doc(frm.doc, frm.doc.name, is_ecn_flag, ecn_ref_val);
						}
					});
				}
			};

			if (frm.doc.revisions && frm.doc.revisions.length > 0) {
				let last_row = frm.doc.revisions[frm.doc.revisions.length - 1];
				if (last_row.transmittal_no) {
					frappe.db.get_value('Transmittal Acknowledgement', {
						'transmittal': last_row.transmittal_no,
						'docstatus': 1
					}, ['name', 'drawing_with_comments', 'drawings_received_ok', 'is_ecn', 'ecn_reference'], (r) => {
						if (r && r.name && r.drawing_with_comments) {
							frm.add_custom_button(__('Create Revision'), () => create_rev_fn(r.is_ecn, r.ecn_reference)).addClass('btn-danger');
						}
					});
				} else if (last_row.status === "Issued for Review") {
					frm.add_custom_button(__('Create Revision'), () => create_rev_fn(0, null)).addClass('btn-danger');
				}
			} else {
				frappe.db.get_value('Transmittal Acknowledgement', {
					'drawing_no': frm.doc.drawing_no,
					'docstatus': 1
				}, ['name', 'drawing_with_comments', 'drawings_received_ok', 'is_ecn', 'ecn_reference'], (r) => {
					if (r && r.name && !r.drawings_received_ok) {
						frm.add_custom_button(__('Create Revision'), () => create_rev_fn(r.is_ecn, r.ecn_reference)).addClass('btn-danger');
					}
				});
			}
			
			function generate_revision_doc(base_doc, main_name, is_ecn_flag = 0, ecn_ref_val = null) {
				frappe.model.with_doctype('Drawing Register', function() {
					let doc = frappe.model.get_new_doc('Drawing Register');
					
					let copy_fields = [
						'project', 'title', 'discipline', 'drawing_type', 'scale', 
						'sheet_size', 'client_drawing_no', 'vendor_drawing_no', 
						'is_vendor_document', 'is_shop_drawing', 'is_statutory', 
						'statutory_body', 'statutory_status', 'tags', 
						'to_entity', 'to_entity_type', 'from_entity', 
						'from_entity_type', 'sheet_no',
						'drawn_by', 'checked_by', 'approved_by'
					];
					
					copy_fields.forEach(f => {
						if (base_doc[f]) doc[f] = base_doc[f];
					});
					
					let latest_rev = base_doc.current_rev || "Main";
					let next_rev = "R1";
					if (latest_rev !== "Main" && latest_rev !== "0") {
						let match = latest_rev.match(/\d+/);
						if (match) {
							next_rev = "R" + (parseInt(match[0]) + 1);
						}
					}
					doc.current_rev = next_rev;
					doc.status = "In Preparation";
					doc.issue_date = frappe.datetime.get_today();
					
					doc.is_main = 0;
					doc.is_ecn = is_ecn_flag ? 1 : 0;
					if (ecn_ref_val) {
						doc.ecn_reference = ecn_ref_val;
					}
					doc.doc_type_link_drawing_register = "Drawing Register";
					doc.doc_link_drawing_register = main_name;
					
					if (frm.doc.revisions) {
						frm.doc.revisions.forEach(row => {
							let new_row = frappe.model.add_child(doc, "Drawing Revision", "revisions");
							new_row.revision = row.revision;
							new_row.revision_date = row.revision_date;
							new_row.file = row.file;
							new_row.status = row.status;
							new_row.issued_by = row.issued_by;
							new_row.purpose = row.purpose;
							new_row.description = row.description;
							new_row.transmittal_no = row.transmittal_no;
						});
					}
					
					frappe.set_route('Form', 'Drawing Register', doc.name);
				});
			}
		}
	},

	from_entity_type: function(frm) {
		if (frm.doc.from_entity_type) {
			frm.set_value("to_entity_type", frm.doc.from_entity_type);
		}
	},
	
	is_main: function(frm) {
		if (frm.doc.is_main) {
			frm.set_value("current_rev", "Main");
		}
	}
});
