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
		# self.create_material_issue_entry()
		# self.update_task_labour_cost()
		# self.update_task_equipment_cost()
		# self.update_task_progress()

	
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

# @frappe.whitelist()
# def update_daily_activity_progress_table(doc):

# 	doc = frappe.get_doc(frappe.parse_json(doc))

# 	new_rows = []

# 	seen = set()

# 	for parent_row in doc.task:

# 		if not parent_row.task:
# 			continue

# 		parent_task = frappe.get_doc("Task", parent_row.task)

# 		for sub in parent_task.depends_on:

# 			if not sub.task:
# 				continue

# 			key = (parent_row.task, sub.task)

# 			if key in seen:
# 				continue

# 			seen.add(key)

# 			sub_task = frappe.get_doc("Task", sub.task)

# 			previous = frappe.db.sql("""
# 				SELECT total_qty, total_achieved, percent_completed
# 				FROM `tabDPR Activity Progress`
# 				WHERE parent_task=%s
# 				AND task=%s
# 				ORDER BY creation DESC
# 				LIMIT 1
# 			""", (
# 				parent_row.task,
# 				sub.task,
# 			), as_dict=True)

# 			total_achieved = 0
# 			percent_completed = 0
# 			total_qty = 0

# 			if previous:
# 				total_qty = previous[0].total_qty
# 				total_achieved = previous[0].total_achieved
# 				percent_completed = previous[0].percent_completed

# 			new_rows.append({

# 				"parent_task": parent_row.task,
# 				"parent_task_subject" : parent_task.subject,
# 				"task": sub.task,
# 				"task_subject":sub_task.subject,
# 				"construction_type": sub_task.custom_construction_type,
# 				"total_qty": total_qty,
# 				"uom": sub_task.custom_uom,
# 				"total_achieved": total_achieved,
# 				"percent_completed": percent_completed

# 			})

# 	doc.set("activity_progress", new_rows)

# 	return doc

@frappe.whitelist()
def update_daily_activity_progress_table(doc):

	doc = frappe.get_doc(frappe.parse_json(doc))

	new_rows = []
	seen = set()

	project = doc.project
	site_date = doc.site_date

	if not project or not site_date:
		return {"activity_progress": []}

	# MANPOWER USAGE DETAILS
	manpower_data = frappe.db.sql("""
		SELECT
			mud.task as parent_task,
			mud.subtask as task
		FROM `tabManpower Usage Details` mud
		INNER JOIN `tabManpower Usage` mu
			ON mu.name = mud.parent
		WHERE mu.project = %s
		AND mu.site_date = %s
		AND mu.docstatus = 1
	""", (project, site_date), as_dict=True)

	# EQUIPMENT USAGE DETAILS
	equipment_data = frappe.db.sql("""
		SELECT
			eud.task as parent_task,
			eud.subtask as task
		FROM `tabEquipment Usage Details` eud
		INNER JOIN `tabEquipment Usage` eu
			ON eu.name = eud.parent
		WHERE eu.project = %s
		AND eu.site_date = %s
		AND eu.docstatus = 1
	""", (project, site_date), as_dict=True)

	combined_data = manpower_data + equipment_data

	for row in combined_data:

		parent_task = row.get("parent_task")
		task = row.get("task")

		if not parent_task or not task:
			continue

		key = (parent_task, task)

		if key in seen:
			continue

		seen.add(key)

		parent_task_subject = frappe.db.get_value(
			"Task",
			parent_task,
			"subject"
		)

		task_doc = frappe.db.get_value(
			"Task",
			task,
			[
				"subject",
				"custom_construction_type",
				"custom_uom"
			],
			as_dict=True
		)
		
		# FETCH PREVIOUS PROGRESS
		previous = frappe.db.sql("""
			SELECT
				total_qty,
				total_achieved,
				percent_completed
			FROM `tabDPR Activity Progress`
			WHERE parent_task = %s
			AND task = %s
			ORDER BY creation DESC
			LIMIT 1
		""", (parent_task, task), as_dict=True)

		total_qty = 0
		total_achieved = 0
		percent_completed = 0

		if previous:

			total_qty = previous[0].total_qty or 0
			total_achieved = previous[0].total_achieved or 0
			percent_completed = previous[0].percent_completed or 0

		new_rows.append({

			"parent_task": parent_task,
			"parent_task_subject": parent_task_subject,

			"task": task,
			"task_subject": task_doc.subject if task_doc else "",

			"construction_type":
				task_doc.custom_construction_type
				if task_doc else "",

			"uom":
				task_doc.custom_uom
				if task_doc else "",

			"total_qty": total_qty,
			"total_achieved": total_achieved,
			"previous_total_achieved": total_achieved,
			"percent_completed": percent_completed

		})

	return {
		"activity_progress": new_rows
	}

@frappe.whitelist()
def update_task_progress_from_dpr(task, achieved_qty, total_qty):

	if not total_qty:
		return

	percent = (achieved_qty / total_qty) * 100

	frappe.db.set_value("Task", task, "progress", percent)

	update_parent_progress(task)

@frappe.whitelist()
def get_multiple_task_bom_details(tasks):
	tasks = frappe.parse_json(tasks)

	materials = []
	manpower = []
	equipment = []
	seen = set()

	for parent_task in tasks:
		data = get_task_bom_details(parent_task)

		for row in data.get("materials", []):
			key = (row.get("parent_task"), row.get("task"), row.get("item"))
			if key not in seen:
				seen.add(key)
				materials.append(row)

		for row in data.get("manpower", []):
			row["tradecategory"] = row.get("item")
			row["item_type"] = "Man" 

			if row.get("item"):
				row["daily_wages"] = frappe.db.get_value(
					"Item",
					row.get("item"),
					"custom_daily_wages"
				)

			key = (row.get("parent_task"), row.get("task"), row.get("tradecategory"))
			if key not in seen:
				seen.add(key)
				manpower.append(row)

		for row in data.get("equipment", []):
			row["equipment_name"] = row.get("item")

			key = (row.get("parent_task"), row.get("task"), row.get("item"))
			if key not in seen:
				seen.add(key)
				equipment.append(row)

	return {
		"materials": materials,
		"manpower": manpower,
		"equipment": equipment
	}

def update_parent_progress(task):

	parent = frappe.db.get_value("Task", task, "parent_task")

	if not parent:

		project = frappe.db.get_value("Task", task, "project")

		if not project:
			return

		stages = frappe.get_all(
			"Task",
			filters={
				"project": project,
				"custom_is_stage": 1
			},
			fields=["progress", "task_weight"]
		)

		if not stages:
			frappe.db.set_value("Project", project, "percent_complete", 0)
			return

		project_progress = 0

		for stage in stages:

			progress = stage.progress or 0
			weight = stage.task_weight or 0

			project_progress += (progress * weight) / 100

		# Limit to 100
		project_progress = min(project_progress, 100)

		frappe.db.set_value(
			"Project",
			project,
			"percent_complete",
			project_progress
		)

		# Realtime refresh
		frappe.publish_realtime(
			"project_progress_refresh",
			{
				"project": project
			}
		)

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

	# Limit to 100
	weighted_total = min(weighted_total, 100)

	frappe.db.set_value(
		"Task",
		parent,
		"progress",
		weighted_total
	)

	# Continue recursion upward
	update_parent_progress(parent)


@frappe.whitelist()
def get_current_weather(lat, lon):
    try:
        url = "https://api.open-meteo.com/v1/forecast"

        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,wind_speed_10m,weather_code",
            "daily": "temperature_2m_max,temperature_2m_min",
            "timezone": "auto"
        }

        res = requests.get(url, params=params, timeout=10)

        if not res.ok:
            frappe.log_error(f"Weather API error: {res.status_code} - {res.text}", "Weather API")
            return None

        if not res.text.strip():
            frappe.log_error("Weather API returned empty response", "Weather API")
            return None

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

    except requests.exceptions.Timeout:
        frappe.log_error("Weather API timed out", "Weather API")
        return None

    except Exception as e:
        frappe.log_error(f"Weather API failed: {str(e)}", "Weather API")
        return None


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
  
		parent_task_subject = frappe.db.get_value("Task", doc.parent_task, "subject")

		for d in doc.custom_bom_details:

			row = {
				"parent_task": doc.parent_task,
				"parent_task_subject" : parent_task_subject,
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

@frappe.whitelist()
def get_site_diary_details(project, site_date):

    manpower_data = frappe.db.sql("""
        SELECT
            mud.task,
            mud.subtask,
            mud.equipment_item,
            mud.contractor,
            mud.uom,
            mud.quantity,
            mud.rate,
            mud.amount,
            mud.skill_type
        FROM `tabManpower Usage Details` mud
        INNER JOIN `tabManpower Usage` mu
            ON mu.name = mud.parent
        WHERE mu.project = %s
        AND mu.site_date = %s
        AND mu.docstatus = 1
    """, (project, site_date), as_dict=True)


    equipment_data = frappe.db.sql("""
        SELECT
            eud.task,
            eud.subtask,
            eud.equipment_item,
            eud.contractor,
            eud.rate,
            eud.amount,
            eud.uom,
            eud.quantity,
            eud.working_hrs
        FROM `tabEquipment Usage Details` eud
        INNER JOIN `tabEquipment Usage` eu
            ON eu.name = eud.parent
        WHERE eu.project = %s
        AND eu.site_date = %s
        AND eu.docstatus = 1
    """, (project, site_date), as_dict=True)


    visitors_data = frappe.db.sql("""
        SELECT
            pv.project,
            pv.site_date,
            pv.visitor_name,
            pv.accompanied_by,
            pv.time_in,
            pv.time_out,
            pv.safety_inducted,
            pv.purpose,
            pv.company,
			pv.notes
        FROM `tabProject Visitor` pv
        WHERE pv.project = %s
        AND pv.site_date = %s
        AND pv.docstatus = 1
    """, (project, site_date), as_dict=True)


    return {
        "manpower": manpower_data,
        "equipment": equipment_data,
        "visitor": visitors_data
    }

@frappe.whitelist()
def get_material_deliveries(project, site_date):

    stock_entries = frappe.db.sql("""
        SELECT name
        FROM `tabStock Entry`
        WHERE stock_entry_type = 'Material Issue'
        AND posting_date = %s
    """, (site_date,), as_dict=True)
    
    if not stock_entries:
        return []

    entry_names = [d.name for d in stock_entries]

    data = frappe.db.sql("""
        SELECT
            se.name as stock_entry,
            sei.item_code,
            sei.qty,
            sei.uom,
			sei.basic_rate,
			sei.amount,
            sei.s_warehouse,
            sei.custom_task as task,
            sei.custom_subtask as subtask,
            sei.project
        FROM `tabStock Entry Detail` sei
        INNER JOIN `tabStock Entry` se ON se.name = sei.parent
        WHERE se.name IN %(entries)s
        AND sei.project = %(project)s
		AND se.docstatus = 1
    """, {
        "entries": tuple(entry_names),
        "project": project
    }, as_dict=True)
    # cache item + task lookups
    item_cache = {}
    task_cache = {}

    for d in data:

        if d.item_code not in item_cache:
            item_cache[d.item_code] = frappe.db.get_value(
                "Item", d.item_code, "custom_item_type"
            )
        d.item_type = item_cache[d.item_code]

        if d.task and d.task not in task_cache:
            task_cache[d.task] = frappe.db.get_value(
                "Task", d.task, "subject"
            )
        d.parent_task_subject = task_cache.get(d.task)

        if d.subtask and d.subtask not in task_cache:
            task_cache[d.subtask] = frappe.db.get_value(
                "Task", d.subtask, "subject"
            )
        d.task_subject = task_cache.get(d.subtask)

    return data

import frappe

@frappe.whitelist()
def get_material_received(project, site_date):

    final_data = []
    # PROJECT WAREHOUSES
    project_doc = frappe.get_doc("Project", project)

    warehouses = []

    if project_doc.get("custom_warehouses"):
        for row in project_doc.custom_warehouses:
            if hasattr(row, "warehouse") and row.warehouse:
                warehouses.append(row.warehouse)

    warehouses = list(set(warehouses))

    # PURCHASE RECEIPTS 
    if warehouses:
        purchase_receipts = frappe.db.sql("""
            SELECT
                pr.name as reference_name,
                'Purchase Receipt' as reference_type,
                pri.item_code,
                pri.item_name,
                pri.qty,
                pri.uom,
                pr.set_warehouse as warehouse,
                pri.project,
                pri.rate,
                pri.amount
            FROM `tabPurchase Receipt Item` pri
            INNER JOIN `tabPurchase Receipt` pr
                ON pr.name = pri.parent
            WHERE pr.posting_date = %(site_date)s
            AND pri.project = %(project)s
            AND pri.warehouse IN %(warehouses)s
            AND pr.docstatus = 1
        """, {
            "site_date": site_date,
            "project": project,
            "warehouses": tuple(warehouses)
        }, as_dict=True)

        final_data.extend(purchase_receipts)

    # STOCK ENTRIES (FIXED LOGIC)
    if warehouses:

        stock_entries = frappe.db.sql("""
            SELECT
                se.name as reference_name, 
				se.stock_entry_type as reference_type,
                sed.item_code,
                sed.item_name,
                sed.qty,
                sed.uom,
                sed.s_warehouse as warehouse,
                sed.t_warehouse as target_warehouse,
                sed.project,
                sed.basic_rate as rate,
                sed.amount
            FROM `tabStock Entry Detail` sed
            INNER JOIN `tabStock Entry` se
                ON se.name = sed.parent
            WHERE se.posting_date = %(site_date)s
            AND se.stock_entry_type = 'Material Transfer'
            AND sed.project = %(project)s
            AND sed.t_warehouse IN %(warehouses)s
            AND COALESCE(sed.s_warehouse, '') NOT IN %(warehouses)s
			AND se.docstatus = 1
        """, {
            "site_date": site_date,
            "project": project,
            "warehouses": tuple(warehouses)
        }, as_dict=True)

        final_data.extend(stock_entries)

    return final_data






@frappe.whitelist()
def get_latest_task_progress(project, site_date):

    task_progress_names = frappe.db.get_all(
        "Task Progress",
        filters={
            "project": project,
            "site_date": site_date,
            "docstatus": 1
        },
        pluck="name",
    )

    if not task_progress_names:
        return []

    data = frappe.db.sql("""
        SELECT
            parent_task,
			parent_task_subject,
            task,
			task_subject,
			uom,
            total_qty,
            achieved_today,
            total_achieved,
			planned_today,
            percent_completed
        FROM `tabTask Progress Details`
        WHERE parent IN %(parents)s
        ORDER BY parent, idx
    """, {
        "parents": tuple(task_progress_names)
    }, as_dict=True)

    return data