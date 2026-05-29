import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import today


class ContractorBilling(Document):

    def before_submit(self):
        self.create_journal_entry()

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