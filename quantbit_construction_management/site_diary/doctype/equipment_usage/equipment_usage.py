# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EquipmentUsage(Document):

	def before_submit(self):
		self.set_total_equipment_cost()

	def set_total_equipment_cost(self):

		task_wise_total = {}

		# Loop through child table
		for row in self.equipment_usage_details:

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

			# Existing value from Task
			existing_total = frappe.db.get_value(
				"Task",
				task,
				"custom_total_equipment_cost"
			) or 0

			# Add existing + new
			new_total = existing_total + total

			frappe.db.set_value(
				"Task",
				task,
				"custom_total_equipment_cost",
				new_total
			)