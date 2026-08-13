// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Drawing Review Record", {
	refresh(frm) {
		frm.trigger('next_revision_required');
	},
	next_revision_required(frm) {
		if (frm.doc.next_revision_required) {
			frm.set_df_property('review_comments', 'hidden', 0);
		} else {
			frm.set_df_property('review_comments', 'hidden', 1);
		}
	}
});
