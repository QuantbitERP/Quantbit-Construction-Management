# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt
from openpyxl.cell import read_only
import frappe
from frappe.model.document import Document
from frappe.utils import flt
from frappe.model.mapper import get_mapped_doc
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from io import BytesIO
from collections import defaultdict
class RABilling(Document):

    def before_save(self):
        self.sync_deleted_tasks()
        self.update_abstract_details()
        steel_map = {}
        for row in self.ra_steel_details:
            if row.subtask not in steel_map:
                steel_map[row.subtask] = 0
            steel_map[row.subtask] += (row.total_weight or 0)

        for row in self.ra_billing_details:
            if row.subtask in steel_map:
                row.quantity = steel_map[row.subtask]

    def sync_deleted_tasks(self):
        if not self.is_new() and self.get_doc_before_save():
            old_tasks = set(d.task for d in self.get_doc_before_save().ra_abstract_details if d.task)
            current_tasks = set(d.task for d in self.ra_abstract_details if d.task)
            deleted_tasks = old_tasks - current_tasks
            
            if deleted_tasks:
                valid_details = [d for d in self.ra_billing_details if d.task not in deleted_tasks]
                self.set("ra_billing_details", valid_details)

    def on_submit(self):
        self.update_billed_quantity()

    def update_abstract_details(self):
        self.set("ra_abstract_details", [])
        
        abstract_data = {}
        for row in self.ra_billing_details:
            key = (row.stage, row.stage_subject, row.task, row.task_subject, row.uom)
            if key not in abstract_data:
                abstract_data[key] = {
                    "billed_quantity": 0.0,
                    "rate": 0.0,
                    "amount": 0.0,
                    "description": getattr(row, "description", "")
                }
            
            abstract_data[key]["billed_quantity"] += flt(row.quantity)
            abstract_data[key]["rate"] = flt(row.rate)
            abstract_data[key]["amount"] += flt(row.amount)
            if not abstract_data[key]["description"]:
                abstract_data[key]["description"] = getattr(row, "description", "")
            
        for key, data in abstract_data.items():
            self.append("ra_abstract_details", {
                "stage": key[0],
                "stage_subject": key[1],
                "task": key[2],
                "task_subject": key[3],
                "uom": key[4],
                "rate": data["rate"],
                "billed_quantity": data["billed_quantity"],
                "amount": data["amount"],
                "description": data["description"]
            })
            
        self.grand_total = sum(flt(d.amount) for d in self.ra_billing_details)

    def update_billed_quantity(self):

        for row in self.ra_billing_details:

            if not row.subtask_subject:
                continue

            subtask_name = frappe.db.get_value(
                "Task",
                {
                    "subject": row.subtask_subject,
                    ""
                    "custom_is_subtask": 1,
                    "project": self.project
                },
                "name"
            )

            if not subtask_name:
                continue

            current_billed = flt(
                frappe.db.get_value(
                    "Task",
                    subtask_name,
                    "custom_billed_quantity"
                )
            )

            frappe.db.set_value(
                "Task",
                subtask_name,
                "custom_billed_quantity",
                current_billed + flt(row.quantity)
            )

@frappe.whitelist()
def validate_task_rates(doc):
    task_rate_map = {}
    doc = frappe.get_doc(frappe.parse_json(doc))
    for row in doc.ra_billing_details:
        task = (row.task or "").strip()
        rate = flt(row.rate)
        task_subject = frappe.db.get_value("Task",task, "subject")
        if task in task_rate_map:
            if task_rate_map[task] != rate:
                frappe.throw(
                    f"Task <b>{task_subject}</b> (Row {row.idx}) must have the same "
                    f"Rate: {task_rate_map[task]}, Current Rate: {rate}."
                )
        else:
            task_rate_map[task] = rate

@frappe.whitelist()
def get_project_tasks(project):
    """
    Fetch all subtasks for the selected project and return enriched data for RA Billing.
    """
    if not project:
        return []

    subtasks = frappe.get_all(
        "Task",
        filters={
            "project": project,
            "custom_is_subtask": 1
        },
        fields=[
            "name", "subject", "parent_task",
            "custom_total_quantity", "custom_total_achieved",
            "custom_rate", "custom_billed_quantity", "custom_uom"
        ]
    )

    if not subtasks:
        return []

    result = []
    for subtask in subtasks:
        task_id = subtask.parent_task
        task = None
        stage = None

        hierarchy = []

        current_task = subtask

        while current_task:

            hierarchy.insert(0, {
                "name": current_task.name,
                "subject": current_task.subject
            })

            if not current_task.parent_task:
                break

            current_task = frappe.db.get_value(
                "Task",
                current_task.parent_task,
                ["name", "subject", "parent_task"],
                as_dict=True
            )

        billed_qty = flt(subtask.custom_billed_quantity)
        rate = flt(subtask.custom_rate)
        achieved_qty = flt(subtask.custom_total_achieved)
        billable_qty = achieved_qty - billed_qty
        row = {
            "total_quantity": subtask.custom_total_quantity,
            "total_achieved": achieved_qty,
            "billed_quantity": billed_qty,
            "billable_quantity": billable_qty,
            "rate": flt(subtask.custom_rate),
            "uom": subtask.custom_uom
        }

        # Map hierarchy sequentially
        field_order = [
            "stage",
            "task",
            "subtask",
            "task_level1",
            "task_level2",
            "task_level3",
            "task_level4",
            "task_level5",
            "task_level6",
            "task_level7",
            "task_level8",
            "task_level9",
            "task_level10"
        ]

        for idx, node in enumerate(hierarchy):

            if idx >= len(field_order):
                break

            fieldname = field_order[idx]

            row[fieldname] = node["subject"]
            row[f"{fieldname}_id"] = node["name"]
        result.append(row)
    return result

@frappe.whitelist()
def create_sales_invoice(source_name, target_doc=None, item_code=None):
    if not item_code:
        args = getattr(frappe.flags, "args", None) or frappe.form_dict
        item_code = args.get("item_code")

    item_name = frappe.db.get_value("Item", item_code, "item_name")
    uom = frappe.db.get_value(
        "UOM Conversion Detail",
        {"parent": item_code},
        "uom"
    )
    if not uom and item_code:
        uom = frappe.db.get_value("Item", item_code, "stock_uom")
    
    def set_missing_values(source, target):
        target.customer = source.customer
        target.project = source.project
        target.custom_doc_link_doctype = "RA Billing"
        target.custom_doc_link = source.name
        
        target.append("items", {
            "item_code": item_code,
            "item_name": item_name,
            "qty": 1,
            "uom": uom,
            "rate": flt(source.grand_total),
            "price_list_rate": flt(source.grand_total),
            "amount": flt(source.grand_total),
            "base_rate": flt(source.grand_total),
            "base_amount": flt(source.grand_total),
            "base_price_list_rate": flt(source.grand_total)
        })
        
        target.run_method("set_missing_values")
        target.run_method("calculate_taxes_and_totals")

    doc = get_mapped_doc(
        "RA Billing",
        source_name,
        {
            "RA Billing": {
                "doctype": "Sales Invoice"
            }
        },
        target_doc,
        set_missing_values
    )

    return doc       

@frappe.whitelist()
def export_ra_excel(ra_billing):
    doc = frappe.get_doc("RA Billing", ra_billing)
    project_doc = frappe.get_doc("Project", doc.project)
    company_name = project_doc.company

    wb = openpyxl.Workbook()
    
    # Sheet 1: Abstract
    ws_abstract = wb.active
    ws_abstract.title = "Abstract"
    
    # Sheet 2: Measurement
    ws_meas = wb.create_sheet("Measurement")
    
    bold_font = Font(bold=True)
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")
    thin_border = Border(
        left=Side(style='thin'), 
        right=Side(style='thin'), 
        top=Side(style='thin'), 
        bottom=Side(style='thin')
    )
    
    # Helper for caching descriptions
    task_desc_cache = {}
    steel_task_totals = {}
    steel_stage_totals = {}
    steel_stage_weights = {}   
    def get_task_desc(task_id):
        if not task_id: return ""
        if task_id not in task_desc_cache:
            desc = frappe.db.get_value("Task", task_id, "description")
            task_desc_cache[task_id] = frappe.utils.strip_html(desc) if desc else ""
        return task_desc_cache[task_id]
    
    # --- Steel Sheet ---
    ws_steel = wb.create_sheet("Steel") 
    ws_steel.merge_cells('A1:L1')
    ws_steel['A1'] = company_name
    ws_steel['A1'].font = Font(bold=True, size=14)
    ws_steel['A1'].alignment = center_align

    ws_steel.merge_cells('A2:L2')
    ws_steel['A2'] = project_doc.project_name or project_doc.name
    ws_steel['A2'].font = Font(bold=True, size=12)
    ws_steel['A2'].alignment = center_align

    ws_steel.merge_cells('A3:L3')
    ws_steel['A3'] = f"RA Bill Number: {doc.name}"
    ws_steel['A3'].font = Font(bold=True, size=12)
    ws_steel['A3'].alignment = center_align

    ws_steel.merge_cells('A4:L4')
    ws_steel['A4'] = "STEEL DETAILS"
    ws_steel['A4'].font = Font(bold=True, size=12)
    ws_steel['A4'].alignment = center_align

    ws_steel.append([])
    steel_headers = ["Sr. No", "Content", "Description", "No of FDN", "No of Bar", "Dia meter of Bar", "Cutting Length", "Total Length", "Quantity", "Weight of Bar", "Total Weight", "Unit"]
    ws_steel.append(steel_headers)
    
    for col_num in range(1, 13):
        cell = ws_steel.cell(row=6, column=col_num)
        cell.font = bold_font
        cell.alignment = center_align if col_num not in (2, 3) else left_align
        cell.border = thin_border

    grouped_steel_data = {}
    for row in getattr(doc, "ra_steel_details", []):
        task = row.task
        subtask = row.subtask
        
        stage_subject = "No Stage"
        task_subject = "No Task"
        if task:
            task_info = frappe.db.get_value("Task", task, ["subject", "parent_task"], as_dict=True)
            if task_info:
                task_subject = task_info.get("subject") or "No Task"
                stage_id = task_info.get("parent_task")
                if stage_id:
                    stage_subj = frappe.db.get_value("Task", stage_id, "subject")
                    if stage_subj:
                        stage_subject = stage_subj
        
        subtask_subject = "No Subtask"
        if subtask:
            subtask_subj = frappe.db.get_value("Task", subtask, "subject")
            if subtask_subj:
                subtask_subject = subtask_subj
        
        if stage_subject not in grouped_steel_data:
            grouped_steel_data[stage_subject] = {}
        if task_subject not in grouped_steel_data[stage_subject]:
            grouped_steel_data[stage_subject][task_subject] = {}
        if subtask_subject not in grouped_steel_data[stage_subject][task_subject]:
            grouped_steel_data[stage_subject][task_subject][subtask_subject] = []
            
        grouped_steel_data[stage_subject][task_subject][subtask_subject].append(row)
        
    row_num = 7
    stage_idx = 1
    grand_total_weight = 0.0
    for stage, tasks in grouped_steel_data.items():
        stage_total_weight = 0.0
        cell_sr = ws_steel.cell(row=row_num, column=1, value=str(stage_idx))
        cell_sr.border = thin_border; cell_sr.alignment = left_align
        
        cell_desc = ws_steel.cell(row=row_num, column=2, value=stage)
        cell_desc.font = bold_font; cell_desc.border = thin_border; cell_desc.alignment = left_align
        
        for c in range(3, 13):
            cell = ws_steel.cell(row=row_num, column=c, value="")
            cell.border = thin_border; cell.alignment = center_align
        row_num += 1
        
        task_idx = 1
        for task, subtasks in tasks.items():
            cell_sr = ws_steel.cell(row=row_num, column=1, value=f"{stage_idx}.{task_idx}")
            cell_sr.border = thin_border; cell_sr.alignment = left_align
            
            cell_desc = ws_steel.cell(row=row_num, column=2, value="  " + task)
            cell_desc.font = bold_font; cell_desc.border = thin_border; cell_desc.alignment = left_align
            
            for c in range(3, 13):
                cell = ws_steel.cell(row=row_num, column=c, value="")
                cell.border = thin_border; cell.alignment = center_align
            row_num += 1
            
            subtask_idx = 1
            task_total_weight = 0.0
            for subtask, rows in subtasks.items():
                subtask_id = rows[0].subtask if len(rows) > 0 else None
                task_desc = get_task_desc(subtask_id)
                
                for r in rows:
                    cell_sr = ws_steel.cell(row=row_num, column=1, value=f"{stage_idx}.{task_idx}.{subtask_idx}")
                    cell_sr.border = thin_border; cell_sr.alignment = left_align
                    
                    cell_desc = ws_steel.cell(row=row_num, column=2, value="    " + subtask)
                    cell_desc.border = thin_border; cell_desc.alignment = left_align
                    
                    # If r.description exists, use it. Else use task_desc.
                    final_desc = r.description if r.description else task_desc
                    cell_subdesc = ws_steel.cell(row=row_num, column=3, value=final_desc)
                    cell_subdesc.border = thin_border; cell_subdesc.alignment = left_align
                    
                    cell = ws_steel.cell(row=row_num, column=4, value=r.no_of_fdn or "")
                    cell.border = thin_border; cell.alignment = center_align
                    
                    cell = ws_steel.cell(row=row_num, column=5, value=r.no_of_bar or "")
                    cell.border = thin_border; cell.alignment = center_align
                    
                    cell = ws_steel.cell(row=row_num, column=6, value=r.diamter_of_bar or "")
                    cell.border = thin_border; cell.alignment = center_align
                    
                    cell = ws_steel.cell(row=row_num, column=7, value=r.cutting_length or "")
                    cell.border = thin_border; cell.alignment = center_align
                    
                    t_len = flt(r.total_length)
                    cell = ws_steel.cell(row=row_num, column=8, value=t_len)
                    cell.border = thin_border; cell.alignment = center_align
                    if t_len: cell.number_format = '0.00'
                    
                    qty = flt(r.qty)
                    cell = ws_steel.cell(row=row_num, column=9, value=qty)
                    cell.border = thin_border; cell.alignment = center_align
                    if qty: cell.number_format = '0.00'
                    
                    w_bar = flt(r.weight_of_bar)
                    cell = ws_steel.cell(row=row_num, column=10, value=w_bar)
                    cell.border = thin_border; cell.alignment = center_align
                    if w_bar: cell.number_format = '0.00'
                    
                    t_weight = flt(r.total_weight)
                    task_total_weight += t_weight
                    grand_total_weight += t_weight
                    cell = ws_steel.cell(row=row_num, column=11, value=t_weight)
                    cell.border = thin_border; cell.alignment = center_align
                    if t_weight: cell.number_format = '0.00'
                    
                    cell = ws_steel.cell(row=row_num, column=12, value=r.unit or "")
                    cell.border = thin_border; cell.alignment = center_align
                    
                    row_num += 1
                subtask_idx += 1
            cell_sr = ws_steel.cell(row=row_num, column=1, value="")
            cell_sr.border = thin_border
            cell_sr.alignment = left_align

            cell_desc = ws_steel.cell(
                row=row_num,
                column=2,
                value="    Total"
            )
            cell_desc.font = bold_font
            cell_desc.border = thin_border
            cell_desc.alignment = left_align

            for c in range(3, 11):
                cell = ws_steel.cell(row=row_num, column=c, value="")
                cell.border = thin_border
                cell.alignment = center_align

            total_weight_cell = ws_steel.cell(
                row=row_num,
                column=11,
                value=task_total_weight
            )
            total_weight_cell.font = bold_font
            total_weight_cell.border = thin_border
            total_weight_cell.alignment = center_align
            total_weight_cell.number_format = '0.00'
            steel_task_totals[f"{stage}||{task}"] = task_total_weight
            stage_total_weight += task_total_weight
            cell = ws_steel.cell(row=row_num, column=12, value="")
            cell.border = thin_border
            cell.alignment = center_align

            row_num += 1
            # Metric Tonne Conversion Row
            cell_sr = ws_steel.cell(row=row_num, column=1, value="")
            cell_sr.border = thin_border

            cell_desc = ws_steel.cell(
                row=row_num,
                column=2,
                value="    Total (Metric Tonne)"
            )
            cell_desc.font = bold_font
            cell_desc.border = thin_border
            cell_desc.alignment = left_align

            for c in range(3, 11):
                cell = ws_steel.cell(row=row_num, column=c, value="")
                cell.border = thin_border
                cell.alignment = center_align

            mt_cell = ws_steel.cell(
                row=row_num,
                column=11,
                value=(task_total_weight / 1000)
            )
            mt_cell.font = bold_font
            mt_cell.border = thin_border
            mt_cell.alignment = center_align
            mt_cell.number_format = '0.000'

            unit_cell = ws_steel.cell(
                row=row_num,
                column=12,
                value="Metric Tonne"
            )
            unit_cell.border = thin_border
            unit_cell.alignment = center_align

            row_num += 1

            task_idx += 1
            steel_stage_weights[stage] = stage_total_weight
            steel_stage_totals[stage] = stage_total_weight / 1000
        stage_idx += 1
        stage_idx += 1

    cell_sr = ws_steel.cell(row=row_num, column=1, value="")
    cell_sr.border = thin_border

    cell_desc = ws_steel.cell(
        row=row_num,
        column=2,
        value="GRAND TOTAL"
    )
    cell_desc.font = bold_font
    cell_desc.border = thin_border
    cell_desc.alignment = left_align

    for c in range(3, 11):
        cell = ws_steel.cell(row=row_num, column=c, value="")
        cell.border = thin_border
        cell.alignment = center_align

    gt_cell = ws_steel.cell(
        row=row_num,
        column=11,
        value=grand_total_weight
    )
    gt_cell.font = bold_font
    gt_cell.border = thin_border
    gt_cell.alignment = center_align
    gt_cell.number_format = '0.00'

    cell = ws_steel.cell(row=row_num, column=12, value="Kg")
    cell.border = thin_border
    cell.alignment = center_align

    row_num += 1

    cell_sr = ws_steel.cell(row=row_num, column=1, value="")
    cell_sr.border = thin_border

    cell_desc = ws_steel.cell(
        row=row_num,
        column=2,
        value="GRAND TOTAL"
    )
    cell_desc.font = bold_font
    cell_desc.border = thin_border
    cell_desc.alignment = left_align

    for c in range(3, 11):
        cell = ws_steel.cell(row=row_num, column=c, value="")
        cell.border = thin_border
        cell.alignment = center_align

    mt_cell = ws_steel.cell(
        row=row_num,
        column=11,
        value=(grand_total_weight / 1000)
    )
    mt_cell.font = bold_font
    mt_cell.border = thin_border
    mt_cell.alignment = center_align
    mt_cell.number_format = '0.000'

    cell = ws_steel.cell(row=row_num, column=12, value="Metric Tonne")
    cell.border = thin_border
    cell.alignment = center_align
    ws_steel.column_dimensions[get_column_letter(12)].width = 15
    for col in ws_steel.columns:
        max_length = 0
        column = get_column_letter(col[0].column)
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except: pass
        ws_steel.column_dimensions[column].width = (max_length + 2)

    # --- Measurement Sheet ---
    ws_meas.merge_cells('A1:J1')
    ws_meas['A1'] = company_name
    ws_meas['A1'].font = Font(bold=True, size=14)
    ws_meas['A1'].alignment = center_align

    ws_meas.merge_cells('A2:J2')
    ws_meas['A2'] = project_doc.project_name or project_doc.name
    ws_meas['A2'].font = Font(bold=True, size=12)
    ws_meas['A2'].alignment = center_align

    ws_meas.merge_cells('A3:J3')
    ws_meas['A3'] = f"RA Bill Number: {doc.name}"
    ws_meas['A3'].font = Font(bold=True, size=12)
    ws_meas['A3'].alignment = center_align

    ws_meas.merge_cells('A4:J4')
    ws_meas['A4'] = "MEASUREMENT SHEET"
    ws_meas['A4'].font = Font(bold=True, size=12)
    ws_meas['A4'].alignment = center_align

    ws_meas.append([])
    meas_headers = ["Sr. No", "Content", "Description", "No.1", "No.2", "Length", "Width", "Depth", "Unit", "Qty"]
    ws_meas.append(meas_headers)

    for col_num in range(1, 11):
        cell = ws_meas.cell(row=6, column=col_num)
        cell.font = bold_font
        cell.alignment = center_align if col_num not in (2, 3) else left_align
        cell.border = thin_border

    steel_subtask_weights = {}
    for steel_row in getattr(doc, "ra_steel_details", []):
        key = (steel_row.task, steel_row.subtask)

        steel_subtask_weights[key] = (
            steel_subtask_weights.get(key, 0)
            + flt(steel_row.total_weight)
        )

    grouped_meas_data = {}
    for row in getattr(doc, "ra_billing_details", []):
        stage = row.stage_subject or "No Stage"
        task = row.task_subject or "No Task"
        if stage not in grouped_meas_data:
            grouped_meas_data[stage] = {}
        if task not in grouped_meas_data[stage]:
            grouped_meas_data[stage][task] = []
        grouped_meas_data[stage][task].append(row)
        
    row_num = 7
    stage_idx = 1
    for stage, tasks in grouped_meas_data.items():
        current_stage = stage
        cell_sr = ws_meas.cell(row=row_num, column=1, value=str(stage_idx))
        cell_sr.border = thin_border; cell_sr.alignment = left_align
        
        cell_desc = ws_meas.cell(row=row_num, column=2, value=stage)
        cell_desc.font = bold_font
        cell_desc.border = thin_border
        cell_desc.alignment = left_align
        
        for c in range(3, 11):
            cell = ws_meas.cell(row=row_num, column=c, value="")
            cell.border = thin_border; cell.alignment = center_align
            
        row_num += 1
        
        task_idx = 1
        show_mt_total = False
        for task, subtasks in tasks.items():
            current_task = task
            cell_sr = ws_meas.cell(row=row_num, column=1, value=f"{stage_idx}.{task_idx}")
            cell_sr.border = thin_border; cell_sr.alignment = left_align
            
            cell_desc = ws_meas.cell(row=row_num, column=2, value="  " + task)
            cell_desc.font = bold_font
            cell_desc.border = thin_border
            cell_desc.alignment = left_align
            
            for c in range(3, 11):
                cell = ws_meas.cell(row=row_num, column=c, value="")
                cell.border = thin_border; cell.alignment = center_align
            
            row_num += 1
            
            subtask_idx = 1
            task_total_qty = 0.0
            
            for row in subtasks:
                cell_sr = ws_meas.cell(row=row_num, column=1, value=f"{stage_idx}.{task_idx}.{subtask_idx}")
                cell_sr.border = thin_border; cell_sr.alignment = left_align
                
                cell_desc = ws_meas.cell(row=row_num, column=2, value="    " + (row.subtask_subject or ""))
                cell_desc.border = thin_border; cell_desc.alignment = left_align
                
                desc_val = row.description if hasattr(row, 'description') and row.description else get_task_desc(row.subtask)
                cell_subdesc = ws_meas.cell(row=row_num, column=3, value=desc_val)
                cell_subdesc.border = thin_border; cell_subdesc.alignment = left_align
                
                cell = ws_meas.cell(row=row_num, column=4, value=row.no1 or "")
                cell.border = thin_border; cell.alignment = center_align
                
                cell = ws_meas.cell(row=row_num, column=5, value=row.no2 or "")
                cell.border = thin_border; cell.alignment = center_align
                
                cell = ws_meas.cell(row=row_num, column=6, value=row.length or "")
                cell.border = thin_border; cell.alignment = center_align
                
                cell = ws_meas.cell(row=row_num, column=7, value=row.width or "")
                cell.border = thin_border; cell.alignment = center_align
                
                cell = ws_meas.cell(row=row_num, column=8, value=row.height or "")
                cell.border = thin_border; cell.alignment = center_align
                
                cell = ws_meas.cell(row=row_num, column=9, value=row.uom or "")
                if (row.uom or "").lower() in ["kg", "kilogram"]:
                    show_mt_total = True
                cell.border = thin_border; cell.alignment = center_align
                #unit cell
                unit_cell = ws_meas.cell(
                    row=row_num,
                    column=9,
                    value=row.uom or ""
                )
                unit_cell.border = thin_border
                unit_cell.alignment = center_align
                #qty cell
                qty = flt(row.quantity)
                task_total_qty += qty
                steel_weight = steel_subtask_weights.get(
                    (row.task, row.subtask),
                    0
                )
                # qty_cell = ws_meas.cell(row=row_num, column=10, value=steel_weight)

                if (row.uom or "").lower() in ["kg", "kilogram"]:
                    display_qty = steel_subtask_weights.get(
                        (row.task, row.subtask),
                        qty
                    )
                else:
                    display_qty = qty
                qty_cell = ws_meas.cell(row=row_num, column=10, value=display_qty)
                qty_cell.border = thin_border; qty_cell.alignment = center_align
                qty_cell.number_format = '0.00'
                
                row_num += 1
                subtask_idx += 1
                
            task_idx += 1
        if show_mt_total:

            stage_kg_total = steel_stage_weights.get(stage, 0)

            cell_sr = ws_meas.cell(row=row_num, column=1, value="")
            cell_sr.border = thin_border

            cell_desc = ws_meas.cell(
                row=row_num,
                column=2,
                value="Stage Total (Kg)"
            )
            cell_desc.font = bold_font
            cell_desc.border = thin_border
            cell_desc.alignment = left_align

            for c in range(3, 10):
                cell = ws_meas.cell(row=row_num, column=c, value="")
                cell.border = thin_border
                cell.alignment = center_align

            kg_cell = ws_meas.cell(
                row=row_num,
                column=10,
                value=stage_kg_total
            )

            kg_cell.font = bold_font
            kg_cell.border = thin_border
            kg_cell.alignment = center_align
            kg_cell.number_format = "0.00"

            row_num += 1
            stage_mt_total = steel_stage_totals.get(stage, 0)

            cell_sr = ws_meas.cell(row=row_num, column=1, value="")
            cell_sr.border = thin_border

            cell_desc = ws_meas.cell(
                row=row_num,
                column=2,
                value="Stage Total (Metric Tonne)"
            )
            cell_desc.font = bold_font
            cell_desc.border = thin_border
            cell_desc.alignment = left_align

            for c in range(3, 10):
                cell = ws_meas.cell(row=row_num, column=c, value="")
                cell.border = thin_border
                cell.alignment = center_align

            mt_cell = ws_meas.cell(
                row=row_num,
                column=10,
                value=stage_mt_total
            )

            mt_cell.font = bold_font
            mt_cell.border = thin_border
            mt_cell.alignment = center_align
            mt_cell.number_format = "0.000"
            row_num += 1

        stage_idx += 1

    for col in ws_meas.columns:
        max_length = 0
        column = get_column_letter(col[0].column)
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except: pass
        ws_meas.column_dimensions[column].width = (max_length + 2)
        
    # --- Abstract Sheet ---
    ws_abstract.merge_cells('A1:G1')
    ws_abstract['A1'] = company_name
    ws_abstract['A1'].font = Font(bold=True, size=14)
    ws_abstract['A1'].alignment = center_align

    ws_abstract.merge_cells('A2:G2')
    ws_abstract['A2'] = project_doc.project_name or project_doc.name
    ws_abstract['A2'].font = Font(bold=True, size=12)
    ws_abstract['A2'].alignment = center_align

    ws_abstract.merge_cells('A3:G3')
    ws_abstract['A3'] = f"RA Bill Number: {doc.name}"
    ws_abstract['A3'].font = Font(bold=True, size=12)
    ws_abstract['A3'].alignment = center_align

    ws_abstract.merge_cells('A4:G4')
    ws_abstract['A4'] = "ABSTRACT SHEET"
    ws_abstract['A4'].font = Font(bold=True, size=12)
    ws_abstract['A4'].alignment = center_align

    ws_abstract.append([])
    abs_headers = ["Sr. No", "Content", "Description", "Unit", "Qty", "Rate", "Amount"]
    ws_abstract.append(abs_headers)
    
    for col_num in range(1, 8):
        cell = ws_abstract.cell(row=6, column=col_num)
        cell.font = bold_font
        cell.alignment = center_align if col_num not in (2, 3) else left_align
        cell.border = thin_border

    row_num = 7
    sr_no = 1
    current_stage = None

    for row in getattr(doc, "ra_abstract_details", []):
        if row.stage_subject != current_stage:
            current_stage = row.stage_subject
            cell_sr = ws_abstract.cell(row=row_num, column=1, value="")
            cell_sr.border = thin_border; cell_sr.alignment = left_align
            
            cell_desc = ws_abstract.cell(row=row_num, column=2, value=current_stage or "No Stage")
            cell_desc.font = bold_font; cell_desc.border = thin_border; cell_desc.alignment = left_align
            
            for c in range(3, 8): 
                cell = ws_abstract.cell(row=row_num, column=c, value="")
                cell.border = thin_border; cell.alignment = center_align
            row_num += 1

        cell_sr = ws_abstract.cell(row=row_num, column=1, value=sr_no)
        cell_sr.border = thin_border; cell_sr.alignment = left_align
        
        cell_desc = ws_abstract.cell(row=row_num, column=2, value="  " + (row.task_subject or ""))
        cell_desc.border = thin_border; cell_desc.alignment = left_align
        
        # Abstract only groups by Task, it does not display subtasks, so description is task description
        desc_val = row.description if hasattr(row, 'description') and row.description else get_task_desc(row.task)
        cell_subdesc = ws_abstract.cell(row=row_num, column=3, value=desc_val)
        cell_subdesc.border = thin_border; cell_subdesc.alignment = left_align
        
        cell = ws_abstract.cell(row=row_num, column=4, value=row.uom or "")
        cell.border = thin_border; cell.alignment = center_align
        
        qty_cell = ws_abstract.cell(row=row_num, column=5, value=flt(row.billed_quantity))
        qty_cell.border = thin_border; qty_cell.alignment = center_align; qty_cell.number_format = '0.00'
        
        rate_cell = ws_abstract.cell(row=row_num, column=6, value=flt(row.rate))
        rate_cell.border = thin_border; rate_cell.alignment = center_align; rate_cell.number_format = '0.00'
        
        amt_cell = ws_abstract.cell(row=row_num, column=7, value=flt(row.amount))
        amt_cell.border = thin_border; amt_cell.alignment = center_align; amt_cell.number_format = '0.00'

        sr_no += 1
        row_num += 1

    for col in ws_abstract.columns:
        max_length = 0
        column = get_column_letter(col[0].column)
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except: pass
        ws_abstract.column_dimensions[column].width = (max_length + 2)

    file_data = BytesIO()
    wb.save(file_data)
    
    frappe.response['filename'] = f"RA_Bill_{doc.name}.xlsx"
    frappe.response['filecontent'] = file_data.getvalue()
    frappe.response['type'] = 'binary'


@frappe.whitelist()
def get_steel_details(project, from_date, to_date):
    if not project or not from_date or not to_date:
        return []

    query = """
        SELECT 
            sed.item_code as item,
            sed.custom_task as task,
            sed.custom_subtask as subtask,
            sed.custom_diameter_of_steel as diamter_of_bar,
            sed.uom as unit,
            sed.qty as qty,
            se.name
        FROM 
            `tabStock Entry` se
        JOIN 
            `tabStock Entry Detail` sed ON se.name = sed.parent
        JOIN
            `tabItem` item ON sed.item_code = item.name
        WHERE 
            (se.project = %s OR sed.project = %s)
            AND se.posting_date >= %s
            AND se.stock_entry_type = 'Material Issue'
            AND se.posting_date <= %s
            AND se.docstatus = 1
            AND LOWER(item.custom_item_type) = 'steel'
    """
    
    data = frappe.db.sql(query, (project, project, from_date, to_date), as_dict=1)
    return data