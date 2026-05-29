import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import today


class ContractorBilling(Document):

    def before_submit(self):
        self.create_journal_entry()

    def on_submit(self):
        self.update_billed_status(1)

    def on_cancel(self):
        self.update_billed_status(0)
        self.update_paid_status_in_child(0)
        self.cancel_journal_entry()
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
        if je_name:
            je = frappe.get_doc("Journal Entry", je_name)
            if je.docstatus == 1:
                je.cancel()

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
            "party_type": "Customer",
            "party": customer_name,
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

        target.paid_amount = source.grand_total
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
    if payment_entry.custom_doc_link_doctype != "Contractor Billing" or not payment_entry.custom_doc_link:
        return
    
    payments = frappe.db.get_all(
        "Payment Entry",
        filters={
            "custom_doc_link_doctype": "Contractor Billing",
            "custom_doc_link": payment_entry.custom_doc_link,
            "docstatus": 1
        },
        fields=["paid_amount"]
    )
    
    from frappe.utils import flt
    total_paid_amount = sum(flt(p.paid_amount) for p in payments)
    
    billing = frappe.get_doc("Contractor Billing", payment_entry.custom_doc_link)
    
    billing.db_set("paid_amount", total_paid_amount)
    outstanding = flt(billing.grand_total) - flt(total_paid_amount)
    billing.db_set("outstanding_amount", outstanding)
    
    if flt(total_paid_amount) >= flt(billing.grand_total):
        status = 1
    else:
        status = 0
        
    billing.update_paid_status_in_child(status)