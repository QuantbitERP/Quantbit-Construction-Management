# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class TechnicalDeviation(Document):
	def on_submit(self):
		self.create_ecn()

	def create_ecn(self):
		# Create an ECN automatically when Technical Deviation is submitted
		exists = frappe.db.exists("Engineering Change Notice", {"title": f"ECN for {self.name}"})
		if not exists:
			ecn = frappe.new_doc("Engineering Change Notice")
			ecn.title = f"ECN for {self.name}"
			ecn.project = self.project
			ecn.drawing = self.drawing
			ecn.drawing_number = self.drawing_number
			# Note: mapping to typo 'current_revusion' based on JSON field definition
			ecn.current_revusion = self.current_revision
			ecn.new_revision = self.new_revision
			
			# Map to a valid change_category in ECN
			if self.ncr_type == "Design":
				ecn.change_category = "Design Error"
			else:
				ecn.change_category = "Site Condition"
				
			ecn.initiated_by = self.raised_by or frappe.session.user
			ecn.initiation_date = self.raise_date or frappe.utils.today()
			ecn.description = self.deviation_description or f"Generated from Technical Deviation {self.name}"
			ecn.technical_justification = self.reason
			
			ecn.insert(ignore_permissions=True)
			frappe.msgprint(f"Engineering Change Notice <a href='/app/engineering-change-notice/{ecn.name}'>{ecn.name}</a> created automatically.")
