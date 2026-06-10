import frappe
def execute():
    try:
        doc1 = frappe.get_doc("Custom Field", "Purchase Invoice-custom_doc_link_doctype")
        doc1.insert_after = "remarks"
        doc1.save()
        
        doc2 = frappe.get_doc("Custom Field", "Purchase Invoice-custom_doc_link")
        doc2.insert_after = "custom_doc_link_doctype"
        doc2.save()
        frappe.db.commit()
        print("Success")
    except Exception as e:
        print(f"Error: {e}")
