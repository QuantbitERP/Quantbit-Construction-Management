# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Tender(Document):
	def before_submit(self):
		project= frappe.get_doc({
			'doctype':'Project',
			'project_name':self.name,
			'status':'Open',
			'is_active':'Yes',
			'customer':self.party_name,
			'expected_start_date':self.expected_start_date,
			'expected_end_date':self.expected_end_date


		})
		project.insert(ignore_permissions=True)

	def validate(self):
		self.check_show_create_customer_button()

	def on_update(self):	
		
		self.check_show_create_customer_button()

	def on_update_after_submit(self):

		self.check_show_create_customer_button()

	def check_show_create_customer_button(self):
		"""Check if Create Customer button should be shown"""
		show_button = False
		
		
		if (getattr(self, 'workflow_state', None) == "Alloted" and 
			self.opportunity_from == "Lead" and 
			self.party_name):
			
			
			if frappe.db.exists("Lead", self.party_name):
				show_button = True
		
		self.show_create_customer_button = show_button

	@frappe.whitelist()
	def create_customer_from_lead(self):
		"""Create Customer from Lead"""
		if not (self.opportunity_from == "Lead" and self.party_name):
			frappe.throw("No Lead found to create Customer from")
		
	
		if not frappe.db.exists("Lead", self.party_name):
			frappe.throw(f"Lead {self.party_name} not found")
		
		
		existing_customer = frappe.db.get_value("Customer", {"lead_name": self.party_name}, "name")
		if existing_customer:
			
			self.opportunity_from = "Customer"
			self.party_name = existing_customer
			customer_doc = frappe.get_doc("Customer", existing_customer)
			self.customer_name = customer_doc.customer_name
			self.save(ignore_permissions=True)
			
			return {
				'customer': existing_customer,
				'customer_name': customer_doc.customer_name,
				'message': f'Existing Customer {customer_doc.customer_name} linked to Tender'
			}
		
		lead_doc = frappe.get_doc("Lead", self.party_name)
		
		customer = frappe.get_doc({
			'doctype': 'Customer',
			'customer_name': lead_doc.lead_name or lead_doc.company_name or self.party_name,
			'customer_type': 'Company',
			'lead_name': self.party_name
			
		})
		
		customer.insert(ignore_permissions=True)
		
		self.opportunity_from = "Customer"
		self.party_name = customer.name
		self.customer_name = customer.customer_name
		self.save(ignore_permissions=True)
		
		return {
			'customer': customer.name,
			'customer_name': customer.customer_name,
			'message': f'Customer {customer.customer_name} created successfully from Lead {self.party_name}'
		}

@frappe.whitelist()
def create_project_from_tender(tender_name, project_name):
	"""Create project with custom name from tender"""
	if not project_name:
		frappe.throw("Project Name is required")
	
	tender_doc = frappe.get_doc("Tender", tender_name)
	
	if frappe.db.exists("Project", project_name):
		frappe.throw("Project {0} already exists".format(project_name))
	
	project = frappe.get_doc({
		'doctype': 'Project',
		'project_name': project_name,
		'status': 'Open',
		'is_active': 'Yes',
		'customer': tender_doc.party_name,
		'expected_start_date': tender_doc.expected_start_date,
		'expected_end_date': tender_doc.expected_end_date
	})
	
	project.insert(ignore_permissions=True)
	
	frappe.db.set_value('Tender', tender_name, 'workflow_state', 'Project Created')
	
	message = 'Project <a href="/app/project/{0}">{1}</a> has been created successfully.'.format(project.name, project.name)
	frappe.msgprint(message, title='Project Created Successfully', indicator='green')
	
	return {
		'project': project.name,
		'message': message
	}

	 