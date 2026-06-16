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
			'customer': self.customer_name if self.opportunity_from == "Lead" else self.party_name,
			'expected_start_date':self.expected_start_date,
			'expected_end_date':self.expected_end_date,
		    'custom_reference_doc_name':self.name


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
			self.party_name and not self.customer_name):
			
			
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
			
			customer_doc = frappe.get_doc("Customer", existing_customer)
			self.customer_name = customer_doc.name
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
		
		self.customer_name = customer.name
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
		'customer': tender_doc.customer_name if tender_doc.opportunity_from == "Lead" else tender_doc.party_name,
		'expected_start_date': tender_doc.expected_start_date,
		'expected_end_date': tender_doc.expected_end_date,
		'custom_reference_doc_name':tender_name,
		'custom_bill_of_quantities':tender_doc.boq
		
	})
	
	project.insert(ignore_permissions=True)

	# Update tasks and subtasks from BOQ Details with the new project name and BOQ
	updated_tasks = set()
	for item in tender_doc.boq_details:
		task_names = [
        item.task,
        item.subtask,
        item.task_level1,
        item.task_level2,
        item.task_level3,
        item.task_level4,
        item.task_level5,
        item.task_level6,
        item.task_level7,
        item.task_level8,
        item.task_level9,
        item.task_level10]
		for t_name in task_names: 
			if t_name and t_name not in updated_tasks:
				frappe.db.set_value("Task", t_name, {
					"project": project.name,
					"custom_boq_name": tender_doc.boq
				})
				updated_tasks.add(t_name)
				
				# Also update the stage (parent of the task)
				parent = frappe.db.get_value("Task", t_name, "parent_task")
				if parent and parent not in updated_tasks:
					frappe.db.set_value("Task", parent, {
						"project": project.name,
						"custom_boq_name": tender_doc.boq
					})
					updated_tasks.add(parent)
	
	frappe.db.set_value('Tender', tender_name, 'workflow_state', 'Project Created')
	
	message = 'Project <a href="/app/project/{0}">{1}</a> has been created successfully.'.format(project.name, project.name)
	frappe.msgprint(message, title='Project Created Successfully', indicator='green')
	
	return {
		'project': project.name,
		'message': message
	}

@frappe.whitelist()
def get_boq_details(boq):
	"""Fetch items from Bill of Quantities and map to Tender Item format"""
	if not boq:
		return []
	
	boq_doc = frappe.get_doc("Bill of Quantities", boq)
	details = []
	for item in boq_doc.boq_items:
		details.append({
			"item_code": item.item_code,
			"uom": item.unit,
			"qty": item.quantity,
			"rate": item.unit_rate,
			"amount": item.amount,
			"task": item.task,
			"subtask": item.subtask,
			"subtask_name": item.subtask_name,
		    "task_level1": item.task_level1,
			"level1_subject": item.level1_subject,
			"task_level2": item.task_level2,
			"level2_subject": item.level2_subject,
			"task_level3": item.task_level3,
			"level3_subject": item.level3_subject,
			"task_level4": item.task_level4,
			"level4_subject": item.level4_subject,
			"task_level5": item.task_level5,
			"level5_subject": item.level5_subject,
			"task_level6": item.task_level6,
			"level6_subject": item.level6_subject,
			"task_level7": item.task_level7,
			"level7_subject": item.level7_subject,
			"task_level8": item.task_level8,
			"level8_subject": item.level8_subject,
			"task_level9": item.task_level9,
			"level9_subject": item.level9_subject,
			"task_level10": item.task_level10,
			"level10_subject": item.level10_subject,
			"item_type": item.item_type,
			"cost_code": item.cost_code,
			"item_name": item.item_no
		})
	return details