# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from quantbit_construction_management.document_control.doctype.drawing_register.drawing_register import sync_revision_to_main

class TransmittalAcknowledgement(Document):
	def before_submit(self):
		drawing_no = getattr(self, "drawing_no", None)
		if drawing_no:
			try:
				transmitted_drawing_name = frappe.db.get_value("Drawing Register", {"drawing_no": drawing_no}, "name")
				if not transmitted_drawing_name:
					return
				transmitted_drawing = frappe.get_doc("Drawing Register", transmitted_drawing_name)
				
				main_target = transmitted_drawing.name
				if not transmitted_drawing.is_main and transmitted_drawing.doc_link_drawing_register:
					main_target = transmitted_drawing.doc_link_drawing_register
					
				child_status = "Preliminary"
				if self.drawing_with_comments:
					child_status = "Issued for Review"
				elif self.drawings_received_ok:
					child_status = "Issued for Approval"
					
				sync_revision_to_main(
					main_id=main_target,
					revision=transmitted_drawing.current_rev,
					revision_date=transmitted_drawing.issue_date,
					file=transmitted_drawing.file,
					status=child_status,
					issued_by=transmitted_drawing.from_entity,
					purpose="IFR",
					description=self.comments,
					transmittal_no=self.transmittal,
					is_ecn=self.get("is_ecn"),
					ecn_reference=self.get("ecn_reference")
				)
			except Exception:
				pass
		
		if self.transmittal:
			frappe.db.set_value("Transmittal", self.transmittal, {
				"ack_status": "Acknowledged",
				"acknowledgement_no": self.name,
				"ack_by": self.ack_by,
				"ack_date": self.ack_date
			}, update_modified=True)
			
		if self.comments or getattr(self, "drawing_with_comments", 0):
			self.send_acknowledgement_email()
			
	def send_acknowledgement_email(self):
		if not self.to_entity or self.to_entity_type != "User":
			return
			
		recipient_email = self.to_entity
		recipient_name = frappe.db.get_value("User", recipient_email, "first_name") or "Team"
		reviewer_name = frappe.db.get_value("User", self.from_entity, "full_name") or self.from_entity
		drawing_id = frappe.db.get_value("Drawing Register", {"drawing_no": self.drawing_no}, "name") or "N/A"
		
		from frappe.utils import get_url_to_form
		drawing_link = get_url_to_form("Drawing Register", drawing_id) if drawing_id != "N/A" else "#"
		ack_link = get_url_to_form(self.doctype, self.name)
		
		subject = f"Drawing Approved with Comments: {self.drawing_no}"
		
		message = f"""
		<p>Dear {recipient_name},</p>
		<p>The following drawing has been reviewed and acknowledged with comments. Some changes are required.</p>
		
		<table style="border-collapse: collapse; width: 100%; max-width: 600px; margin-bottom: 20px;" border="1" cellpadding="8">
			<tr style="background-color: #f4f5f6; text-align: left;">
				<th style="width: 30%;">Field</th>
				<th>Details</th>
			</tr>
			<tr>
				<td><strong>Drawing Number</strong></td>
				<td>{self.drawing_no}</td>
			</tr>
			<tr>
				<td><strong>Drawing ID</strong></td>
				<td><a href="{drawing_link}">{drawing_id}</a></td>
			</tr>
			<tr>
				<td><strong>Title</strong></td>
				<td>{getattr(self, "drawing_tiltle", "") or 'N/A'}</td>
			</tr>
			<tr>
				<td><strong>Reviewer</strong></td>
				<td>{reviewer_name}</td>
			</tr>
			<tr>
				<td><strong>Comments</strong></td>
				<td style="white-space: pre-wrap; color: #d93025;">{self.comments}</td>
			</tr>
		</table>
		
		<p>Please <a href="{ack_link}">click here</a> to view the full Transmittal Acknowledgement in the system.</p>
		<br>
		<p>Best Regards,</p>
		<p>Document Control System</p>
		"""
		
		frappe.sendmail(
			recipients=[recipient_email],
			subject=subject,
			message=message,
			reference_doctype=self.doctype,
			reference_name=self.name
		)
