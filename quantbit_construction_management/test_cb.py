import frappe

def execute():
    res = frappe.db.get_all('Contractor Billing Details', fields=['name', 'parent', 'reference_row_name'], limit=5)
    for r in res:
        print(r)
