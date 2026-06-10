# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
class ManpowerUsage(Document):

	def before_submit(self):
		self.set_total_labour_cost()

	def set_total_labour_cost(self):
		task_wise_total = {}

		# Loop through child table
		for row in self.manpower_usage:

			if not row.subtask:
				continue

			amount = row.amount or 0

			# Sum amount for same subtask
			if row.subtask in task_wise_total:
				task_wise_total[row.subtask] += amount
			else:
				task_wise_total[row.subtask] = amount

		# Update Task doctype
		for task, total in task_wise_total.items():
			existing_total = frappe.db.get_value(
				"Task",
				task,
				"custom_total_labour_cost"
			) or 0

			new_total = existing_total + total

			frappe.db.set_value(
				"Task",
				task,
				"custom_total_labour_cost",
				new_total
			)

@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_contractor_manpower_items(doctype, txt, searchfield, start, page_len, filters):
	contractor = filters.get("contractor")
	if not contractor:
		return []

	# Cast to int to prevent MySQL syntax error in LIMIT clause
	start = int(start) if start else 0
	page_len = int(page_len) if page_len else 20

	return frappe.db.sql("""
		select c.item, i.item_name 
		from `tabSite Diary Contractor Item Details` c
		left join `tabItem` i on c.item = i.name
		where c.parent = %s and c.parenttype = 'Contractor'
		and i.custom_item_type = 'Man'
		and (c.item like %s or i.item_name like %s)
		limit %s, %s
	""", (contractor, "%%%s%%" % txt, "%%%s%%" % txt, start, page_len))