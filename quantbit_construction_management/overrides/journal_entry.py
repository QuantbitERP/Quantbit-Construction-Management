import frappe


def validate_journal_entry(doc, method=None):
	"""
	Automatically pass site and project from Journal Entry header
	to Journal Entry Account child table rows.
	"""
	site = doc.get("custom_site") or doc.get("site")
	project = doc.get("custom_project") or doc.get("project")

	if not site and not project:
		return

	for row in doc.get("accounts") or []:
		if site:
			if hasattr(row, "site") and not row.get("site"):
				row.site = site
			if hasattr(row, "custom_site") and not row.get("custom_site"):
				row.custom_site = site

		if project:
			if hasattr(row, "project") and not row.get("project"):
				row.project = project
			if hasattr(row, "custom_project") and not row.get("custom_project"):
				row.custom_project = project
