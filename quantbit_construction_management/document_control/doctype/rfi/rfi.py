# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from quantbit_construction_management.utils import generate_unique_8_digit_number


class RFI(Document):
	
	def before_insert(self):

		if not self.rfi_number:

			self.rfi_number = generate_unique_8_digit_number(
				"RFI",
				"rfi_number"
			)

	def validate(self):

		self.validate_required_by_date()
		self.validate_close_without_response()

	def validate_required_by_date(self):

		if self.required_by and self.required_by < self.raised_date:

			frappe.throw(
				"Response Required By date must be after Raised date."
			)

	def validate_close_without_response(self):

		if self.status == "Closed" and not self.response:

			frappe.throw(
				"RFI cannot be closed without a response."
			)

	def on_submit(self):

		if self.priority in ["High", "Urgent"]:
			frappe.msgprint(f"High priority RFI {self.name} submitted.")
			
		if self.response_by:
			try:
				frappe.sendmail(
					recipients=[self.response_by],
					subject=f"New RFI Submitted: {self.name} - {self.subject}",
					message=f"<p>Hello,</p><p>A new RFI <b>{self.name}</b> has been submitted by {self.raised_by}.</p><p><b>Subject:</b> {self.subject}</p><p>Please review and provide a response.</p>",
					reference_doctype=self.doctype,
					reference_name=self.name,
					now=True
				)
				frappe.msgprint(f"Email sent to {self.response_by}")
			except Exception as e:
				frappe.log_error(f"Failed to send RFI email: {str(e)}")

	def on_update_after_submit(self):
		doc_before_save = self.get_doc_before_save()
		if doc_before_save:
			if self.response and self.response != doc_before_save.response:
				if self.raised_by:
					try:
						frappe.sendmail(
							recipients=[self.raised_by],
							subject=f"RFI Responded: {self.name} - {self.subject}",
							message=f"<p>Hello,</p><p>A response has been added to RFI <b>{self.name}</b>.</p><p><b>Response:</b><br>{self.response}</p>",
							reference_doctype=self.doctype,
							reference_name=self.name,
							now=True
						)
						frappe.msgprint(f"Response notification sent to {self.raised_by}")
					except Exception as e:
						frappe.log_error(f"Failed to send RFI response email: {str(e)}")