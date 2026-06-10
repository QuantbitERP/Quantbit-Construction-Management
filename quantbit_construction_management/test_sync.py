import frappe
from quantbit_construction_management.subcontractor_management.doctype.contractor_billing.contractor_billing import sync_contractor_billing_payment_status

def execute():
    try:
        # Assuming CB-00029 is the contractor billing. Let's trace it.
        # Print status of CB-00029 before
        cb = frappe.get_doc("Contractor Billing", "CB-00029")
        print(f"CB-00029 before sync: paid_amount={cb.paid_amount}, outstanding={cb.outstanding_amount}")
        
        # Manually trigger sync
        sync_contractor_billing_payment_status("CB-00029")
        
        # Re-fetch
        cb = frappe.get_doc("Contractor Billing", "CB-00029")
        print(f"CB-00029 after sync: paid_amount={cb.paid_amount}, outstanding={cb.outstanding_amount}")
        
    except Exception as e:
        print(e)
