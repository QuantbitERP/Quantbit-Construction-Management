# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import today

class DrawingRegister(Document):
	def before_save(self):
		if self.is_main:
			# When child table is empty and it's a main drawing, set current_rev to "Main"
			if not self.get("revisions"):
				self.current_rev = "Main"
				if not self.status or self.status == "Draft":
					self.status = "In Preparation"
			else:
				# Set current_rev to the latest revision from the history
				self.current_rev = self.revisions[-1].revision
				
		self.update_drawing_number()

	def on_update(self):
		self.sync_to_ifc_package()

	def sync_to_ifc_package(self):
		if self.get("is__ifc_package") and self.get("ifc_package") and self.is_main:
			try:
				ifc = frappe.get_doc("IFC Package", self.ifc_package)
				exists = any(d.drawing == self.name for d in ifc.drawings)
				if not exists:
					ifc.append("drawings", {
						"drawing": self.name
					})
					ifc.flags.ignore_validate_update_after_submit = True
					ifc.save(ignore_permissions=True)
					frappe.msgprint(f"Drawing automatically added to IFC Package: <a href='/app/ifc-package/{self.ifc_package}'>{self.ifc_package}</a>")
			except Exception as e:
				frappe.log_error(f"Failed to sync to IFC Package: {str(e)}")

	def update_drawing_number(self):
		if self.is_main and not self.get("revisions"):
			self.current_rev = "Main"
			
		if not self.project or not self.discipline or not self.drawing_type:
			return
			
		# Generate sequence or extract base
		if not self.drawing_no:
			project_name = frappe.db.get_value("Project", self.project, "project_name") or self.project
			convention_name = frappe.db.get_value("Drawing Numbering Convention", {"project": self.project}, "name")
			
			disc_code = ""
			type_code = ""
			template = "PROJ-DISC-TYPE-NUM"
			
			if convention_name:
				convention = frappe.get_doc("Drawing Numbering Convention", convention_name)
				if convention.format_template:
					template = convention.format_template
				for row in convention.get("discipline_codes"):
					if row.discipline == self.discipline:
						disc_code = row.code
						break
				for row in convention.get("type_codes"):
					if row.drawing_type == self.drawing_type:
						type_code = row.code
						break
						
			# Fallbacks
			if not disc_code: disc_code = str(self.discipline)[:3].upper() if self.discipline else ""
			if not type_code: type_code = str(self.drawing_type)[0].upper() if self.drawing_type else ""
			proj_code = "".join([w[0].upper() for w in str(project_name).split() if w])
			
			# Build autoname format from template
			autoname_format = template.replace("PROJ", proj_code).replace("DISC", disc_code).replace("TYPE", type_code).replace("NUM", ".####")
			
			from frappe.model.naming import make_autoname
			base_number = make_autoname(autoname_format)
		else:
			base_number = self.drawing_no.split(" - ")[0]
			
		rev = self.current_rev or "Main"
		self.drawing_no = f"{base_number} - {rev}"

	def on_submit(self):
		# Create Transmittal against this drawing register
		transmittal = self.create_transmittal()
		
		# If transmittal is created, status should be IFR
		if transmittal:
			self.db_set("status", "IFR")
			frappe.msgprint(f"Drawing Submitted. Transmittal {transmittal.name} created automatically.")

	def create_transmittal(self):
		try:
			transmittal = frappe.new_doc("Transmittal")
			transmittal.project = self.project
			transmittal.date = today()
			transmittal.purpose = "IFR"
			
			# Map entity fields
			transmittal.from_entity_type = self.from_entity_type
			transmittal.from_entity = self.from_entity
			transmittal.to_entity_type = self.to_entity_type
			transmittal.to_entity = self.to_entity
			transmittal.doc_type_link_drawing_register = "Drawing Register"
			transmittal.doc_link_drawing_register = self.name
			transmittal.is_ecn = self.get("is_ecn")
			transmittal.ecn_reference = self.get("ecn_reference")
			
			# Fallback to fetch file from sidebar attachments if the field is empty
			file_url = self.file
			if not file_url:
				attached_file = frappe.db.get_value("File", {"attached_to_doctype": "Drawing Register", "attached_to_name": self.name}, "file_url")
				if attached_file:
					file_url = attached_file
			
			# Link the drawing in the Transmittal's child table
			transmittal.append("drawings", {
				"drawing": self.name,
				"drawing_no": self.drawing_no,
				"revision": self.current_rev,
				"purpose": "IFR",
				"attach_zuit": file_url,
				"sheet_no": self.sheet_no,
				"is_ecn": self.get("is_ecn"),
				"ecn_reference": self.get("ecn_reference")
			})
			
			transmittal.insert(ignore_permissions=True)
			transmittal.submit()
			return transmittal
		except Exception as e:
			frappe.throw(f"Failed to create Transmittal: {str(e)}")

@frappe.whitelist()
def sync_revision_to_main(main_id, revision=None, revision_date=None, file=None, status=None, issued_by=None, purpose=None, description=None, transmittal_no=None, is_ecn=0, ecn_reference=None):
	main_doc = frappe.get_doc("Drawing Register", main_id)
	
	# Avoid duplicate insertion
	for row in main_doc.revisions:
		if row.revision == revision:
			return
			
	main_doc.append("revisions", {
		"revision": revision,
		"revision_date": revision_date,
		"file": file,
		"status": status,
		"issued_by": issued_by,
		"purpose": purpose,
		"description": description,
		"transmittal_no": transmittal_no,
		"is_ecn": is_ecn,
		"ecn_reference": ecn_reference
	})
	main_doc.flags.ignore_validate_update_after_submit = True
	main_doc.save(ignore_permissions=True)

@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_entities_without_role(doctype, txt, searchfield, start, page_len, filters):
	entity_doctype = filters.get("entity_doctype")
	
	if entity_doctype == "User":
		return frappe.db.sql("""
			SELECT name, full_name
			FROM `tabUser`
			WHERE name NOT IN (
				SELECT parent FROM `tabHas Role` WHERE role = 'Drawing Reviwer'
			)
			AND (name LIKE %(txt)s OR full_name LIKE %(txt)s)
			ORDER BY name
			LIMIT %(start)s, %(page_len)s
		""", {
			"txt": f"%{txt}%",
			"start": start,
			"page_len": page_len
		})
	elif entity_doctype == "Customer":
		return frappe.db.sql("""
			SELECT name, customer_name
			FROM `tabCustomer`
			WHERE name LIKE %(txt)s OR customer_name LIKE %(txt)s
			ORDER BY name
			LIMIT %(start)s, %(page_len)s
		""", {
			"txt": f"%{txt}%",
			"start": start,
			"page_len": page_len
		})
	return []

@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_entities_with_role(doctype, txt, searchfield, start, page_len, filters):
	entity_doctype = filters.get("entity_doctype")
	
	if entity_doctype == "User":
		return frappe.db.sql("""
			SELECT name, full_name
			FROM `tabUser`
			WHERE name IN (
				SELECT parent FROM `tabHas Role` WHERE role = 'Drawing Reviwer'
			)
			AND (name LIKE %(txt)s OR full_name LIKE %(txt)s)
			ORDER BY name
			LIMIT %(start)s, %(page_len)s
		""", {
			"txt": f"%{txt}%",
			"start": start,
			"page_len": page_len
		})
	elif entity_doctype == "Customer":
		return frappe.db.sql("""
			SELECT name, customer_name
			FROM `tabCustomer`
			WHERE name LIKE %(txt)s OR customer_name LIKE %(txt)s
			ORDER BY name
			LIMIT %(start)s, %(page_len)s
		""", {
			"txt": f"%{txt}%",
			"start": start,
			"page_len": page_len
		})
	return []