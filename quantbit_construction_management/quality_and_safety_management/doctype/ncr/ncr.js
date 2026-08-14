// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("NCR", {
	setup: function(frm) {
		frm.set_query("drawing", function() {
			let filters = {
				is_main: 1
			};
			if (frm.doc.project) {
				filters.project = frm.doc.project;
			}
			return { filters: filters };
		});
	},
	drawing: function(frm) {
		if (frm.doc.drawing) {
			frappe.db.get_value("Drawing Register", frm.doc.drawing, 
				["drawing_no", "current_rev", "file"], 
				function(r) {
					if (r) {
						frm.set_value("drawing_number", r.drawing_no);
						frm.set_value("current_revision", r.current_rev);
						frm.set_value("drawing_file", r.file);
					}
				}
			);
		} else {
			frm.set_value("drawing_number", "");
			frm.set_value("current_revision", "");
			frm.set_value("drawing_file", "");
		}
	}
});
