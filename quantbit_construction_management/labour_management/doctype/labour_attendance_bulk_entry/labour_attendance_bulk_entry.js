// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Labour Attendance Bulk Entry", {
    refresh: function(frm) {

        if (!frm.doc.site_engineer) {
            frm.set_value("site_engineer", frappe.session.user);
            frm.refresh_field("site_engineer");
        }
    }
});

frappe.ui.form.on("Labour Entry Details", {
	contractor: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if (row.contractor) {
			frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Contractor",
					filters: { name: row.contractor },
					fieldname: ["contractor_type"]
				},
				callback: function(r) {
					if (r.message && r.message.contractor_type) {
						var contractor_type = r.message.contractor_type;
						if (contractor_type === "Individual") {
							frappe.model.set_value(cdt, cdn, "contractor_type", "Individuals");
							frappe.model.set_value(cdt, cdn, "total_skilled", 1);
						} else if (contractor_type === "Contract") {
							frappe.model.set_value(cdt, cdn, "contractor_type", "Contract");
						}
					}
				}
			});
		} else {
			frappe.model.set_value(cdt, cdn, "contractor_type", "");
		}
	},
	contractor_type: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if (row.contractor_type === "Individuals") {
			frappe.model.set_value(cdt, cdn, "total_skilled", 1);
		}
	}
});
