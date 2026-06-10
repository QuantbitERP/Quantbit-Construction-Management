import frappe
from quantbit_construction_management.subcontractor_management.doctype.contractor_billing.contractor_billing import sync_contractor_billing_payment_status

def execute():
    try:
        sync_contractor_billing_payment_status("CB-00029")
        print("Sync complete.")
        
        # Check rows
        res = frappe.db.get_all('Contractor Billing Details', filters={'parent': 'CB-00029'}, fields=['name', 'reference_row_name'])
        for r in res:
            if r.reference_row_name:
                paid = frappe.db.get_value("Equipment Usage Details", r.reference_row_name, "paid")
                print(f"Row {r.reference_row_name} paid: {paid}")
                
    except Exception as e:
        print(e)
