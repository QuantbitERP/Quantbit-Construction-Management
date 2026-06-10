import frappe
from quantbit_construction_management.site_diary.doctype.equipment_usage.equipment_usage import get_contractor_items

def execute():
    try:
        # Or print all contractors
        conts = frappe.db.sql("select parent from `tabSite Diary Contractor Item Details` where parenttype='Contractor' limit 2")
        print("Contractors:", conts)
        
        if conts:
            items = get_contractor_items("Equipment Usage Details", "", "equipment_item", 0, 20, {"contractor": conts[0][0]})
            print("Items:", items)
            
    except Exception as e:
        import traceback
        traceback.print_exc()
