// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Labour Attendance Bulk Entry", {
	refresh: function(frm) {
		// Auto-fill site_engineer with current logged-in user if field is empty
		if (!frm.doc.site_engineer) {
			frm.set_value("site_engineer", frappe.session.user);
		}
	},
	contractor: function(frm) {
		if (frm.doc.contractor) {
			frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Contractor",
					filters: { name: frm.doc.contractor },
					fieldname: ["contractor_type"]
				},
				callback: function(r) {
					if (r.message && r.message.contractor_type) {
						
						var contractor_type = r.message.contractor_type;
						if (contractor_type === "Individual") {
							frm.set_value("contractor_type", "Individuals");
						} else if (contractor_type === "Contract") {
							frm.set_value("contractor_type", "contract");
						}
					}
				}
			});
		} else {
			frm.set_value("contractor_type", "");
		}
	}
});
