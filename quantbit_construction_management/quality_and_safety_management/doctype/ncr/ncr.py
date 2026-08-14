# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class NCR(Document):
	def on_submit(self):
		self.create_technical_deviation()

	def create_technical_deviation(self):
		if self.drawing:
			exists = frappe.db.exists("Technical Deviation", {"linked_ncr": self.name})
			if not exists:
				dev = frappe.new_doc("Technical Deviation")
				dev.project = self.project
				dev.drawing = self.drawing
				dev.current_revision = self.current_revision
				dev.drawing_number = self.drawing_number
				dev.new_revision = self.new_revision
				dev.drawing__file = self.drawing_file
				dev.ncr_type = self.ncr_type
				dev.raised_by = self.raised_by
				dev.raise_date = self.raised_date or frappe.utils.today()
				dev.expiry_date = self.target_close_date
				dev.deviation_description = self.description or "Generated from NCR"
				dev.reason = self.root_cause or self.description or "Generated from NCR"
				dev.linked_ncr = self.name
				dev.insert(ignore_permissions=True)
				frappe.msgprint(f"Technical Deviation <a href='/app/technical-deviation/{dev.name}'>{dev.name}</a> created automatically.")
