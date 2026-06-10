import frappe

def execute():
    pi_name = frappe.db.get_value("Purchase Invoice", {"custom_doc_link_doctype": "Contractor Billing", "custom_doc_link": "CB-00029"}, "name")
    print(f"PI Name: {pi_name}")
    if pi_name:
        pi = frappe.get_doc("Purchase Invoice", pi_name)
        print(f"PI docstatus: {pi.docstatus}")
        print(f"PI grand_total: {pi.grand_total}")
        print(f"PI outstanding_amount: {pi.outstanding_amount}")
        print(f"PI status: {pi.status}")
