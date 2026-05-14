# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
import requests
from frappe.model.document import Document
from frappe.utils import getdate, today, get_link_to_form
import random

class SiteDiary(Document):

	def before_submit(self):
		self.validate_future_date()
		self.create_material_issue_entry()
		self.update_task_labour_cost()
		self.update_task_equipment_cost()
		self.update_task_progress()
				
	def update_task_progress(self):

		updated_tasks = set()

		for row in self.activity_progress:
			if not row.task or not row.total_qty:
				continue

			percent = (row.total_achieved / row.total_qty) * 100
			frappe.db.set_value("Task", row.task, "progress", percent)
			updated_tasks.add(row.task)

		for task in updated_tasks:
			update_parent_progress(task)


	def update_task_labour_cost(self):

		task_wages = {}

		# Consider ALL rows in manpower log
		for row in self.manpower_log:

			if not row.task:
				continue

			total_wage = row.total_wage or 0

			if row.task not in task_wages:
				task_wages[row.task] = 0

			task_wages[row.task] += total_wage


		for task, wage in task_wages.items():

			existing_wage = frappe.db.get_value(
				"Task",
				task,
				"custom_total_labour_cost"
			) or 0

			new_total = existing_wage + wage

			frappe.db.set_value(
				"Task",
				task,
				"custom_total_labour_cost",
				new_total
			)

	def update_task_equipment_cost(self):

		task_equipment_cost = {}

		# Consider ALL rows in equipment log
		for row in self.equipment_log:

			if not row.task:
				continue

			total_amount = row.total_amount or 0

			if row.task not in task_equipment_cost:
				task_equipment_cost[row.task] = 0

			task_equipment_cost[row.task] += total_amount


		for task, equipment_cost in task_equipment_cost.items():

			existing_equipment_cost = frappe.db.get_value(
				"Task",
				task,
				"custom_total_equipment_cost"
			) or 0

			new_total_equipment_cost = (
				existing_equipment_cost
				+ equipment_cost
			)

			frappe.db.set_value(
				"Task",
				task,
				"custom_total_equipment_cost",
				new_total_equipment_cost
			)


	def validate_dpr_date(self):
		one_record_restriction = frappe.db.get_single_value("Site Diary Settings","one_record_per_day_per_project")
		if not one_record_restriction:
			return

		existing = frappe.db.exists(
			"Site Diary",
			{
				"project": self.project,
				"site_date": self.site_date,
				"name": ["!=", self.name]
			}
		)

		if existing:
			frappe.throw(
				f"A DPR already exists for date {self.site_date} for project {self.project}"
			)


	def before_insert(self):
		if not self.diary_no:
			self.diary_no = self.generate_unique_diary_number()


	def validate(self):
		self.validate_unique_diary()
		self.validate_project_date_range()
		self.validate_stoppage_reason()
		self.calculate_contract_day_number()
		self.validate_temperature_range()

		self.validate_manpower_log()
		self.validate_equipment_log()
		self.validate_material_deliveries_log()
		self.validate_visitors_log()

		self.validate_dpr_date()		


	def validate_unique_diary(self):
		one_record_restriction = frappe.db.get_single_value("Site Diary Settings", "one_record_per_day_per_project")

		if not one_record_restriction:
			return  

		existing = frappe.db.exists(
			"Site Diary",
			{
				"project": self.project,
				"site_date": self.site_date,
				"name": ["!=", self.name]
			}
		)

		if existing:
			frappe.throw(
				f"Diary already exists for project {self.project} on {self.site_date}"
			)


	def validate_project_date_range(self):

		if not self.project or not self.site_date:
			return

		start_date, end_date = frappe.db.get_value(
			"Project",
			self.project,
			["expected_start_date", "expected_end_date"]
		)

		site_date = getdate(self.site_date)

		if start_date and site_date < getdate(start_date):
			frappe.throw("Diary date cannot be before project start date")

		if end_date and site_date > getdate(end_date):
			frappe.throw("Diary date cannot be after project end date")


	def validate_stoppage_reason(self):

		if self.work_stopped and not self.stoppage_reason:
			frappe.throw("Please provide stoppage reason when work is stopped")


	def validate_future_date(self):

		if getdate(self.site_date) > getdate(today()):
			frappe.throw("Diary date cannot be in the future")


	def calculate_contract_day_number(self):

		start_date = frappe.db.get_value(
			"Project",
			self.project,
			"expected_start_date"
		)

		if start_date:
			self.day_no_of_contract = (
				getdate(self.site_date) - getdate(start_date)
			).days + 1


	def validate_temperature_range(self):

		if self.min_temp and self.max_temp:

			if self.min_temp > self.max_temp:
				frappe.throw("Min temperature cannot exceed max temperature")


	def generate_unique_diary_number(self):

		while True:

			number = str(random.randint(10000, 99999))

			exists = frappe.db.exists(
				"Site Diary",
				{"diary_no": number}
			)

			if not exists:
				return number


	def validate_manpower_log(self):

		if not self.manpower_log:
			return

		for row in self.manpower_log:

			total_workers = (
				(row.skilled or 0)
				+ (row.unskilled or 0)
			)

			if total_workers <= 0:
				frappe.throw(
					f"Total manpower must be greater than zero in row {row.idx}"
				)

			total_hours = (
				(row.hours_worked or 0)
				+ (row.overtime_hours or 0)
			)

			if total_hours > 16:
				frappe.throw(
					f"Working hours + overtime cannot exceed 16 in row {row.idx}"
				)


	def validate_equipment_log(self):

		if not self.equipment_log:
			return

		for row in self.equipment_log:

			if row.working_hours and row.working_hours < 0:
				frappe.throw(
					f"Equipment hours cannot be negative in row {row.idx}"
				)

			if row.working_hours and row.working_hours > 24:
				frappe.throw(
					f"Equipment hours cannot exceed 24 in row {row.idx}"
				)


	def validate_material_deliveries_log(self):

		if not self.material_deliveries:
			return

		for row in self.material_deliveries:

			if not row.item:
				frappe.throw(
					f"Material must be selected in row {row.idx}"
				)

			if row.quantity <= 0:
				frappe.throw(
					f"Material quantity must be greater than zero in row {row.idx}"
				)


	def validate_visitors_log(self):

		if not self.visitors:
			return

		for row in self.visitors:

			if not row.visitor_name:
				frappe.throw(
					f"Visitor name required in row {row.idx}"
				)

			if not row.purpose:
				frappe.throw(
					f"Visitor purpose required in row {row.idx}"
				)
	def create_material_issue_entry(self):

		if not self.material_deliveries:
			return

		if not self.warehouse:
			frappe.throw("Warehouse is mandatory")

		stock_entry = frappe.new_doc("Stock Entry")

		stock_entry.stock_entry_type = "Material Issue"
		stock_entry.posting_date = self.site_date

		for row in self.material_deliveries:

			if not row.item:
				continue

			if not row.quantity:
				continue

			actual_qty = frappe.db.get_value(
				"Bin",
				{
					"item_code": row.item,
					"warehouse": self.warehouse
				},
				"actual_qty"
			) or 0

			if actual_qty < row.quantity:

				frappe.throw(
					f"Insufficient stock for item {row.item} "
					f"in warehouse {self.warehouse}. "
					f"Available qty is {actual_qty}"
				)

			stock_entry.append("items", {

				"item_code": row.item,
				"qty": row.quantity,
				"s_warehouse": self.warehouse,
				"project" : self.project

			})

		if not stock_entry.items:
			return

		stock_entry.insert(ignore_permissions=True)
		stock_entry.submit()

		frappe.msgprint(
			f"""
				Stock Entry
				{get_link_to_form("Stock Entry", stock_entry.name)}
				created successfully
				"""	
)

@frappe.whitelist()
def update_daily_activity_progress_table(doc):

	doc = frappe.get_doc(frappe.parse_json(doc))

	new_rows = []

	seen = set()

	for parent_row in doc.task:

		if not parent_row.task:
			continue

		parent_task = frappe.get_doc("Task", parent_row.task)

		for sub in parent_task.depends_on:

			if not sub.task:
				continue

			key = (parent_row.task, sub.task)

			if key in seen:
				continue

			seen.add(key)

			sub_task = frappe.get_doc("Task", sub.task)

			previous = frappe.db.sql("""
				SELECT total_qty, total_achieved, percent_completed
				FROM `tabDPR Activity Progress`
				WHERE parent_task=%s
				AND task=%s
				ORDER BY creation DESC
				LIMIT 1
			""", (
				parent_row.task,
				sub.task,
			), as_dict=True)

			total_achieved = 0
			percent_completed = 0
			total_qty = 0

			if previous:
				total_qty = previous[0].total_qty
				total_achieved = previous[0].total_achieved
				percent_completed = previous[0].percent_completed

			new_rows.append({

				"parent_task": parent_row.task,
				"task": sub.task,
				"task_subject":sub_task.subject,
				"construction_type": sub_task.custom_construction_type,
				"total_qty": total_qty,
				"uom": sub_task.custom_uom,
				"total_achieved": total_achieved,
				"percent_completed": percent_completed

			})

	doc.set("activity_progress", new_rows)

	return doc


@frappe.whitelist()
def update_task_progress_from_dpr(task, achieved_qty, total_qty):

	if not total_qty:
		return

	percent = (achieved_qty / total_qty) * 100

	frappe.db.set_value("Task", task, "progress", percent)

	update_parent_progress(task)


def update_parent_progress(task):

	parent = frappe.db.get_value("Task", task, "parent_task")

	if not parent:
		return

	children = frappe.get_all(
		"Task",
		filters={"parent_task": parent},
		fields=["progress", "task_weight"]
	)

	if not children:
		return

	weighted_total = 0

	for c in children:

		progress = c.progress or 0
		weight = c.task_weight or 0

		weighted_total += (progress * weight) / 100

	frappe.db.set_value("Task", parent, "progress", weighted_total)

	update_parent_progress(parent)


@frappe.whitelist()
def get_current_weather(lat, lon):

	url = "https://api.open-meteo.com/v1/forecast"

	params = {
		"latitude": lat,
		"longitude": lon,
		"current": "temperature_2m,wind_speed_10m,weather_code",
		"daily": "temperature_2m_max,temperature_2m_min",
		"timezone": "auto"
	}

	res = requests.get(url, params=params)

	data = res.json()

	current = data.get("current", {})
	daily = data.get("daily", {})

	return {
		"temp": current.get("temperature_2m"),
		"wind_speed_kmh": current.get("wind_speed_10m"),
		"weather_code": current.get("weather_code"),
		"max_temp": daily.get("temperature_2m_max", [None])[0],
		"min_temp": daily.get("temperature_2m_min", [None])[0],
	}


@frappe.whitelist()
def get_task_bom_details(task):

	materials = []
	manpower = []
	equipment = []

	all_tasks = []

	# Recursive function
	def get_child_tasks(parent):

		children = frappe.get_all(
			"Task",
			filters={"parent_task": parent},
			fields=["name"]
		)

		for child in children:

			all_tasks.append(child.name)

			get_child_tasks(child.name)

	# Start recursion
	get_child_tasks(task)

	# Fetch BOM Details
	for task_name in all_tasks:

		doc = frappe.get_doc("Task", task_name)

		for d in doc.custom_bom_details:

			row = {
				"parent_task": doc.parent_task,
	            "task": task_name,
	            "task_subject": doc.subject,
				"item": d.item,
				"task": task_name,
				"item_name": d.item_name,
				"qty": d.qty,
				"uom": d.uom,
				"item_type": d.item_type
			}

			if d.item_type == "Material":
				materials.append(row)

			elif d.item_type == "Man":
				manpower.append(row)

			elif d.item_type == "Equipment":
				equipment.append(row)

	return {
		"materials": materials,
		"manpower": manpower,
		"equipment": equipment
	}