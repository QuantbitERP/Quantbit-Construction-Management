# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class EngineeringChangeNotice(Document):
	def on_submit(self):
		self.create_new_drawing_revision()

	def create_new_drawing_revision(self):
		if self.drawing and self.new_revision:
			orig_drg = frappe.get_doc("Drawing Register", self.drawing)
			
			# Clone the original Drawing Register
			new_drg = frappe.copy_doc(orig_drg)
			
			# Reset fields for the new revision
			new_drg.current_rev = self.new_revision
			new_drg.drawing_no = orig_drg.drawing_no  # Let before_save split it and add the new rev
			new_drg.status = "In Preparation"
			new_drg.is_main = 0
			new_drg.is_ecn = 1
			new_drg.ecn_reference = self.name
			new_drg.file = None
			new_drg.s3_file_key = None
			new_drg.qr_code = None
			new_drg.thumbnail_url = None
			
			new_drg.doc_type_link_drawing_register = "Drawing Register"
			new_drg.doc_link_drawing_register = orig_drg.name
			
			# Clear status history but KEEP the revisions (copied from orig_drg) so it displays previous revisions
			new_drg.set("status_history", [])
			
			new_drg.insert(ignore_permissions=True)
			
			frappe.msgprint(f"New Drawing Revision <a href='/app/drawing-register/{new_drg.name}'>{new_drg.name}</a> created automatically.")
