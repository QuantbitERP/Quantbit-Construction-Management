# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class LabourAttendanceBulkEntry(Document):
	def validate(self):
		if not self.site_engineer:
			self.site_engineer = frappe.session.user
