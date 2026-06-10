import frappe

def execute():
    cb = frappe.get_doc("Contractor Billing", "CB-00029")
    print(f"CB type: {cb.type}")
    print(f"CB grand_total: {cb.grand_total}")
    for row in cb.contractor_billing_details:
        print(f"Row item: {row.item}, amount: {row.amount}, rate: {row.rate}, qty: {row.quantity}, working_hrs: {row.working_hrs}")

