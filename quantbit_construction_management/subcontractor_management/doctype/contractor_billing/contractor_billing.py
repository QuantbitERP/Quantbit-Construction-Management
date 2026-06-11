import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import today


class ContractorBilling(Document):

    def before_submit(self):
        self.outstanding_amount = self.grand_total

    def on_submit(self):
        self.update_billed_status(1)
        
        create_jv = frappe.db.get_single_value("Billing Settings", "create_jv")
        create_pi = frappe.db.get_single_value("Billing Settings", "create_purchase_invoice")
        
        if create_jv:
            self.create_journal_entry()
            
        if create_pi:
            self.create_purchase_invoice()

    def on_cancel(self):
        self.update_billed_status(0)
        self.update_paid_status_in_child(0)
        self.cancel_journal_entry()
        self.cancel_purchase_invoice()
        self.unlink_payment_entries()

    def unlink_payment_entries(self):
        payment_entries = frappe.db.get_all(
            "Payment Entry",
            filters={
                "custom_doc_link_doctype": "Contractor Billing",
                "custom_doc_link": self.name
            },
            fields=["name"]
        )
        for pe in payment_entries:
            frappe.db.set_value("Payment Entry", pe.name, {
                "custom_doc_link_doctype": "",
                "custom_doc_link": ""
            })
            frappe.db.commit()

    def update_billed_status(self, status):
        child_doctype = ""
        if self.type == "Manpower":
            child_doctype = "Manpower Usage Details"
        elif self.type == "Equipment":
            child_doctype = "Equipment Usage Details"
        
        if not child_doctype:
            return

        for item in self.get("contractor_billing_details"):
            if item.reference_row_name:
                frappe.db.set_value(child_doctype, item.reference_row_name, "billed", status)

    def cancel_journal_entry(self):
        je_name = frappe.db.get_value("Journal Entry", {"custom_doc_link_doctype": "Contractor Billing", "custom_doc_link": self.name}, "name")
        frappe.msgprint(str(je_name))
        if je_name:
            je = frappe.get_doc("Journal Entry", je_name)
            if je.docstatus == 1:
                je.cancel()

    def cancel_purchase_invoice(self):
        pi_name = frappe.db.get_value("Purchase Invoice", {"custom_doc_link_doctype": "Contractor Billing", "custom_doc_link": self.name}, "name")
        if pi_name:
            pi = frappe.get_doc("Purchase Invoice", pi_name)
            if pi.docstatus == 1:
                pi.cancel()

    def create_purchase_invoice(self):
        pi = frappe.new_doc("Purchase Invoice")
        pi.supplier = self.supplier
        pi.project = self.project
        pi.company = self.company
        pi.custom_doc_link_doctype = "Contractor Billing"
        pi.custom_doc_link = self.name
        
        for item in self.get("contractor_billing_details"):
            qty = item.quantity or item.working_hrs or 1
            rate = item.amount / qty if qty else item.amount
            pi.append("items", {
                "item_code": item.item,
                "qty": qty,
                "rate": rate,
                "amount": item.amount,
                "uom": item.uom,
                "project": self.project
            })
            
        pi.insert(ignore_permissions=True)
        pi.submit()

    def create_journal_entry(self):

        je = frappe.new_doc("Journal Entry")

        je.voucher_type = "Journal Entry"
        je.posting_date = today()

        contractor_name = frappe.db.get_value(
            "Contractor",
            self.contractor,
            "contractor_name"
        )

        customer_name = frappe.db.get_value(
            "Project",
            self.project,
            "customer"
        )
        je.custom_doc_link_doctype = "Contractor Billing"
        je.custom_doc_link = self.name

        je.append("accounts", {
            "account": self.project_account,
            # "party_type": "Customer",
            # "party": customer_name,
            "credit_in_account_currency": 0,
            "debit_in_account_currency": self.grand_total,
			"project":self.project
        })

        je.append("accounts", {
            "account": self.contractor_account,
            "party_type": "Supplier",
            "party": self.supplier,
            "debit_in_account_currency":0,
            "credit_in_account_currency":  self.grand_total,
			"project":self.project
        })


        je.insert(ignore_permissions=True)
        je.submit()

    def update_paid_status_in_child(self, status):
        child_doctype = ""
        if self.type == "Manpower":
            child_doctype = "Manpower Usage Details"
        elif self.type == "Equipment":
            child_doctype = "Equipment Usage Details"
        
        if not child_doctype:
            return

        for item in self.get("contractor_billing_details"):
            if item.reference_row_name:
                frappe.db.set_value(child_doctype, item.reference_row_name, "paid", status)

@frappe.whitelist()
def create_payment_entry(source_name, target_doc=None):

    def set_missing_values(source, target):
        target.payment_type = "Pay"
        target.party_type = "Supplier"
        target.party = source.supplier
        target.party_name = source.supplier
        target.company = source.company
        target.custom_doc_link_doctype = "Contractor Billing"
        target.custom_doc_link = source.name
        target.posting_date = today()

        target.paid_to = source.contractor_account
        target.paid_to_account_currency = "INR"

        target.paid_amount = source.outstanding_amount
        target.project = source.project

    doc = get_mapped_doc(
        "Contractor Billing",
        source_name,
        {
            "Contractor Billing": {
                "doctype": "Payment Entry",
                "field_map": {
                    "grand_total": "paid_amount"
                }
            }
        },
        target_doc,
        set_missing_values
    )

    return doc

def on_payment_entry_submit(doc, method):
    update_payment_status(doc)

def on_payment_entry_cancel(doc, method):
    update_payment_status(doc)

def update_payment_status(payment_entry):
    cb_names = set()
    
    if payment_entry.custom_doc_link_doctype == "Contractor Billing" and payment_entry.custom_doc_link:
        cb_names.add(payment_entry.custom_doc_link)
        
    for ref in payment_entry.get("references", []):
        if ref.reference_doctype == "Purchase Invoice" and ref.reference_name:
            pi_link = frappe.db.get_value("Purchase Invoice", ref.reference_name, ["custom_doc_link_doctype", "custom_doc_link"], as_dict=True)
            if pi_link and pi_link.custom_doc_link_doctype == "Contractor Billing" and pi_link.custom_doc_link:
                cb_names.add(pi_link.custom_doc_link)

    if not cb_names:
        return
        
    for cb_name in cb_names:
        sync_contractor_billing_payment_status(cb_name)

def on_purchase_invoice_update(doc, method):
    if doc.custom_doc_link_doctype == "Contractor Billing" and doc.custom_doc_link:
        sync_contractor_billing_payment_status(doc.custom_doc_link)

def sync_contractor_billing_payment_status(cb_name):
    billing = frappe.get_doc("Contractor Billing", cb_name)
    from frappe.utils import flt
    
    is_paid = 0
    paid_amount = 0.0
    outstanding_amount = flt(billing.grand_total)
    
    # Check if Purchase Invoice is Paid
    pi_name = frappe.db.get_value("Purchase Invoice", {"custom_doc_link_doctype": "Contractor Billing", "custom_doc_link": cb_name}, "name")
    if pi_name:
        pi_data = frappe.db.get_value("Purchase Invoice", pi_name, ["status", "paid_amount", "outstanding_amount"], as_dict=True)
        if pi_data:
            paid_amount = flt(pi_data.paid_amount)
            outstanding_amount = flt(pi_data.outstanding_amount)
            if pi_data.status == "Paid":
                is_paid = 1
    else:
        # Fallback to direct Payment Entry logic
        direct_payments = frappe.db.get_all(
            "Payment Entry",
            filters={
                "custom_doc_link_doctype": "Contractor Billing",
                "custom_doc_link": cb_name,
                "docstatus": 1
            },
            fields=["paid_amount"]
        )
        paid_amount = sum(flt(p.paid_amount) for p in direct_payments)
        outstanding_amount = flt(billing.grand_total) - paid_amount
        if paid_amount >= flt(billing.grand_total):
            is_paid = 1
            
    # Update the parent Contractor Billing document fields
    billing.db_set("paid_amount", paid_amount)
    billing.db_set("outstanding_amount", outstanding_amount)
    
    # Update the child records' paid status
    billing.update_paid_status_in_child(is_paid)

