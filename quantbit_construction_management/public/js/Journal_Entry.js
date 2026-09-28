frappe.ui.form.on("Journal Entry", {
	custom_site: function (frm) {
		sync_site_to_accounts(frm);
	},
	site: function (frm) {
		sync_site_to_accounts(frm);
	},
	custom_project: function (frm) {
		sync_project_to_accounts(frm);
		fetch_site_from_project_if_needed(frm);
	},
	project: function (frm) {
		sync_project_to_accounts(frm);
		fetch_site_from_project_if_needed(frm);
	},
	accounts_add: function (frm, cdt, cdn) {
		handle_accounts_add(frm, cdt, cdn);
	},
	validate: function (frm) {
		sync_empty_accounts(frm);
	}
});

frappe.ui.form.on("Journal Entry Account", {
	accounts_add: function (frm, cdt, cdn) {
		handle_accounts_add(frm, cdt, cdn);
	},
	form_render: function (frm, cdt, cdn) {
		handle_accounts_add(frm, cdt, cdn);
	}
});

function handle_accounts_add(frm, cdt, cdn) {
	set_site_and_project_in_row(frm, cdt, cdn);
	setTimeout(() => {
		set_site_and_project_in_row(frm, cdt, cdn);
	}, 50);
}

function sync_site_to_accounts(frm) {
	const site = frm.doc.custom_site || frm.doc.site || "";
	if (!frm.doc.accounts || !frm.doc.accounts.length) return;

	frm.doc.accounts.forEach((row) => {
		if (frappe.meta.has_field("Journal Entry Account", "site")) {
			frappe.model.set_value(row.doctype, row.name, "site", site);
		}
		if (frappe.meta.has_field("Journal Entry Account", "custom_site")) {
			frappe.model.set_value(row.doctype, row.name, "custom_site", site);
		}
	});
	frm.refresh_field("accounts");
}

function sync_project_to_accounts(frm) {
	const project = frm.doc.custom_project || frm.doc.project || "";
	if (!frm.doc.accounts || !frm.doc.accounts.length) return;

	frm.doc.accounts.forEach((row) => {
		if (frappe.meta.has_field("Journal Entry Account", "project")) {
			frappe.model.set_value(row.doctype, row.name, "project", project);
		}
		if (frappe.meta.has_field("Journal Entry Account", "custom_project")) {
			frappe.model.set_value(row.doctype, row.name, "custom_project", project);
		}
	});
	frm.refresh_field("accounts");
}

function fetch_site_from_project_if_needed(frm) {
	const project = frm.doc.custom_project || frm.doc.project;
	const current_site = frm.doc.custom_site || frm.doc.site;

	if (project && !current_site) {
		frappe.db.get_value("Project", project, "custom_site", (r) => {
			if (r && r.custom_site) {
				if (frappe.meta.has_field("Journal Entry", "custom_site")) {
					frm.set_value("custom_site", r.custom_site);
				} else if (frappe.meta.has_field("Journal Entry", "site")) {
					frm.set_value("site", r.custom_site);
				}
			}
		});
	}
}

function set_site_and_project_in_row(frm, cdt, cdn) {
	const row = locals[cdt] && locals[cdt][cdn];
	if (!row) return;

	const site = frm.doc.custom_site || frm.doc.site;
	const project = frm.doc.custom_project || frm.doc.project;

	if (site) {
		if (frappe.meta.has_field("Journal Entry Account", "site") && !row.site) {
			frappe.model.set_value(cdt, cdn, "site", site);
		}
		if (frappe.meta.has_field("Journal Entry Account", "custom_site") && !row.custom_site) {
			frappe.model.set_value(cdt, cdn, "custom_site", site);
		}
	}

	if (project) {
		if (frappe.meta.has_field("Journal Entry Account", "project") && !row.project) {
			frappe.model.set_value(cdt, cdn, "project", project);
		}
		if (frappe.meta.has_field("Journal Entry Account", "custom_project") && !row.custom_project) {
			frappe.model.set_value(cdt, cdn, "custom_project", project);
		}
	}
}

function sync_empty_accounts(frm) {
	const site = frm.doc.custom_site || frm.doc.site;
	const project = frm.doc.custom_project || frm.doc.project;

	if (!site && !project) return;

	(frm.doc.accounts || []).forEach((row) => {
		if (site && !row.site && frappe.meta.has_field("Journal Entry Account", "site")) {
			frappe.model.set_value(row.doctype, row.name, "site", site);
		}
		if (site && !row.custom_site && frappe.meta.has_field("Journal Entry Account", "custom_site")) {
			frappe.model.set_value(row.doctype, row.name, "custom_site", site);
		}
		if (project && !row.project && frappe.meta.has_field("Journal Entry Account", "project")) {
			frappe.model.set_value(row.doctype, row.name, "project", project);
		}
		if (project && !row.custom_project && frappe.meta.has_field("Journal Entry Account", "custom_project")) {
			frappe.model.set_value(row.doctype, row.name, "custom_project", project);
		}
	});
}
