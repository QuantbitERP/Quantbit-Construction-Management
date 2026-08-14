# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from quantbit_construction_management.utils import generate_unique_8_digit_number


class Transmittal(Document):
	
	def before_insert(self):

		if not self.transmittal_no:

			self.transmittal_no = generate_unique_8_digit_number(
				"Transmittal",
				"transmittal_no"
			)

	def before_save(self):

		self.validate_response_due_date()


	def before_submit(self):

		self.validate_drawings_exist()
		self.status = "Sent"

	def on_submit(self):
		# Default acknowledgement status
		if not self.ack_status:
			self.db_set("ack_status", "Pending")
			
		# Automatically generate review records for each drawing
		created_reviews = self.create_review_records()
		self.send_frappe_notification(created_reviews)

	def create_review_records(self):
		from frappe.utils import add_days
		
		created_records = []
		for item in self.drawings:
			drawing = frappe.get_doc("Drawing Register", item.drawing)
			
			review = frappe.new_doc("Drawing Review Record")
			review.drawing = drawing.name
			review.drawing_no = getattr(item, "drawing_no", None) or getattr(drawing, "drawing_no", None)
			review.transmittal_no = self.name
			review.drawing_file = getattr(item, "attach_zuit", None)
			
			review.doc_type_link_transmittal = "Transmittal"
			review.doc_link_transmittal = self.name
			review.doc_type_link_drawing_register = "Drawing Register"
			review.doc_link_drawing_register = drawing.name
			
			review.is_ecn = item.get("is_ecn") or drawing.get("is_ecn")
			review.ecn_reference = item.get("ecn_reference") or drawing.get("ecn_reference")
			
			review.append("review_comments", {
				"sheet_no": item.sheet_no,
				"transmittal_no": self.name
			})
			
			review.revision_reviewed = item.revision
			review.review_date = self.date
			review.target_response_date = self.response_due or add_days(self.date, 7)
			review.review_type = "Interdisciplinary"
			review.status = "Open"
			
			if drawing.project: review.project = drawing.project
			if drawing.discipline: review.discipline = drawing.discipline
			if drawing.title: review.title = drawing.title
			
			review.from_entity_type = self.from_entity_type
			review.from_entity = self.from_entity
			review.to_entity_type = self.to_entity_type
			review.to_entity = self.to_entity
			
			if self.to_entity_type == "User" and self.to_entity:
				review.reviewer = self.to_entity
				
			review.insert(ignore_permissions=True)
			
			created_records.append({
				"drawing_id": drawing.name,
				"review_id": review.name,
				"revision": item.revision,
				"title": drawing.title or ""
			})
			
			# Pass attachment to the review record globally
			if drawing.file:
				try:
					file_doc = frappe.get_doc({
						"doctype": "File",
						"file_url": drawing.file,
						"attached_to_doctype": "Drawing Review Record",
						"attached_to_name": review.name,
						"is_private": 0
					})
					file_doc.insert(ignore_permissions=True)
				except Exception:
					pass
		
		return created_records

	def send_frappe_notification(self, created_reviews=None):
		from frappe.utils import get_url_to_form
		
		if self.to_entity_type == "User" and self.to_entity:
			notification = frappe.new_doc("Notification Log")
			notification.subject = f"Transmittal {self.name} has been submitted and assigned to you."
			notification.for_user = self.to_entity
			notification.document_type = "Transmittal"
			notification.document_name = self.name
			notification.insert(ignore_permissions=True)
			
			# Build HTML Table for the email
			html_table = ""
			if created_reviews:
				html_table = "<table border='1' style='border-collapse: collapse; width: 100%; margin-top: 15px; text-align: left;'>"
				html_table += "<tr style='background-color: #f3f4f6;'><th style='padding: 8px;'>Drawing No</th><th style='padding: 8px;'>Title</th><th style='padding: 8px;'>Rev</th><th style='padding: 8px;'>Review Record</th></tr>"
				
				for record in created_reviews:
					drawing_link = get_url_to_form("Drawing Register", record["drawing_id"])
					review_link = get_url_to_form("Drawing Review Record", record["review_id"])
					
					html_table += "<tr>"
					html_table += f"<td style='padding: 8px;'><a href='{drawing_link}'>{record['drawing_id']}</a></td>"
					html_table += f"<td style='padding: 8px;'>{record['title']}</td>"
					html_table += f"<td style='padding: 8px; text-align: center;'>{record['revision']}</td>"
					html_table += f"<td style='padding: 8px;'><a href='{review_link}'>{record['review_id']}</a></td>"
					html_table += "</tr>"
				html_table += "</table>"
			
			# Send Email via default outgoing account
			user_details = frappe.db.get_value("User", self.to_entity, ["email", "first_name"], as_dict=True)
			if user_details and user_details.email:
				try:
					transmittal_link = get_url_to_form("Transmittal", self.name)
					greeting_name = user_details.first_name or self.to_entity
					project_name = frappe.db.get_value("Project", self.project, "project_name") or self.project
					
					email_message = f"""
					<div style='font-family: sans-serif; color: #333; line-height: 1.5;'>
						<p>Dear {greeting_name},</p>
						<p>You have been assigned to review <b>Transmittal <a href='{transmittal_link}'>{self.name}</a></b> for Project <b>{project_name}</b>.</p>
						<p>Below are the details of the drawing revisions submitted for your review. Please evaluate the drawings and either approve them or add your comments directly on the respective Review Records:</p>
						{html_table}
						<p style='margin-top: 20px;'>Please log into the system to view attachments and submit your disposition.</p>
						<br>
						<p>Best Regards,<br><b>Document Control Team</b></p>
					</div>
					"""
					frappe.sendmail(
						recipients=[user_details.email],
						subject=f"Action Required: New Transmittal Assigned - {self.name}",
						message=email_message,
						reference_doctype="Transmittal",
						reference_name=self.name,
						now=True
					)
				except Exception:
					pass


	def validate_response_due_date(self):

		if self.response_due and self.response_due <= self.date:

			frappe.throw(
				"Response due date must be after transmittal date."
			)


	def validate_drawings_exist(self):

		if not self.drawings:

			frappe.throw(
				"Add at least one drawing/document to the transmittal."
			)