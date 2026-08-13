# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import today

class DrawingReviewRecord(Document):
	def on_submit(self):
		transmittal_no = getattr(self, "transmittal_no", None)
		if not transmittal_no:
			for comment in self.get("review_comments", []):
				if getattr(comment, "transmittal_no", None):
					transmittal_no = comment.transmittal_no
					break
				
		if transmittal_no:
			self.create_transmittal_acknowledgement(transmittal_no)
			
		# Map people fields to the Drawing Register
		if self.drawing:
			updates = {}
			drawing_from_entity = frappe.db.get_value("Drawing Register", self.drawing, "from_entity")
			if drawing_from_entity:
				updates["drawn_by"] = drawing_from_entity
			if self.reviewer:
				updates["checked_by"] = self.reviewer
			if self.approver:
				updates["approved_by"] = self.approver
			if updates:
				frappe.db.set_value("Drawing Register", self.drawing, updates)
			
	def create_transmittal_acknowledgement(self, transmittal_no):
		# Check if an acknowledgement already exists for this transmittal by this entity (Reversed logic)
		existing_ack = frappe.db.exists("Transmittal Acknowledgement", {
			"transmittal": transmittal_no,
			"from_entity": self.to_entity,
			"docstatus": ["<", 2]
		})
		
		# Gather comments and sheet_no from child table
		sheet_nos = []
		comments = []
		for row in self.get("review_comments", []):
			if getattr(row, "transmittal_no", None) == transmittal_no:
				if getattr(row, "sheet_no", None) and row.sheet_no not in sheet_nos:
					sheet_nos.append(row.sheet_no)
				if getattr(row, "comment", None):
					comments.append(row.comment)
		
		if not existing_ack:
			ack = frappe.new_doc("Transmittal Acknowledgement")
			ack.transmittal = transmittal_no
			ack.drawing_no = self.drawing_no
			ack.drawing_file = getattr(self, "drawing_file", None)
			
			ack.doc_type_link_review_record = "Drawing Review Record"
			ack.doc_link_review_record = self.name
			ack.doc_type_link_drawing_register = "Drawing Register"
			ack.doc_link_drawing_register = self.drawing
			if self.drawing:
				ack.drawing_tiltle = frappe.db.get_value("Drawing Register", self.drawing, "title")
				
			if sheet_nos:
				ack.sheet_no = ", ".join(sheet_nos)
				
			if comments:
				ack.comments = "\n\n".join(comments)
				
			if self.next_revision_required:
				ack.drawing_with_comments = 1
			else:
				ack.drawings_received_ok = 1
			ack.ack_date = today()
			ack.ack_by = self.to_entity
			ack.ack_method = "Email"
			
			# Reverse entities so it's addressed back to the sender
			ack.from_entity_type = self.to_entity_type
			ack.from_entity = self.to_entity
			ack.to_entity_type = self.from_entity_type
			ack.to_entity = self.from_entity
			
			ack.insert(ignore_permissions=True)
			ack.submit()
			frappe.msgprint(f"Transmittal Acknowledgement {ack.name} generated and submitted automatically.")