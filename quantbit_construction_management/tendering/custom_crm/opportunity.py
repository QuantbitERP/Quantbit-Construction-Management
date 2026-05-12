import frappe


def on_update(doc, method):

    if doc.workflow_state != "Tender created":
        return

    try:
        tender = frappe.get_doc({
            "doctype": "Tender",
            "opportunity": doc.name,
            "customer": doc.party_name,
            "company": doc.company,
            "tender_notification_date": doc.custom_tender_notification_date,
            "transaction_date": doc.transaction_date,
            "opportunity_owner": doc.opportunity_owner,
            "opportunity_from": doc.opportunity_from,
            "party_name": doc.party_name,
            "opportunity_type": doc.opportunity_type,
            "sales_stage": doc.sales_stage,
            "probability": doc.probability,
            "no_of_employees": doc.no_of_employees,
            "annual_revenue": doc.annual_revenue,
            "country": doc.country,
            "currency": doc.currency,
            "opportunity_amount": doc.opportunity_amount,
            "industry": doc.industry,
            "market_segment": doc.market_segment,
            "city": doc.city,
            "state": doc.state,
            "territory": doc.territory,
            "contact_person": doc.contact_person,
            "contact_email": doc.contact_email,
            "contact_mobile": doc.contact_mobile,
            "whatsapp": doc.whatsapp,
            "phone": doc.phone,
            "phone_ext": doc.phone_ext,
            "tenderrfp_number": doc.custom_tenderrfp_number,
            "tender_reference": doc.custom_tender_reference,
            "tender_submission_date": doc.custom_tender_submission_date,
            "project_duration": doc.custom_project_duration,
            "jvconsortium": doc.custom_jvconsortium,
            "tender_fee_exempted": doc.custom_tender_fee_exempted,
            "tender_fee": doc.custom_tender_fee,
            "tender_category": doc.custom_tender_category,
            "tender_type": doc.custom_tender_type,
            "emd_exempted": doc.custom_emd_exempted,
            "earnest_money_deposit": doc.custom_earnest_money_deposit,
            "next_activity_deadline": doc.custom_next_activity_deadline,
            "next_activity_summary": doc.custom_next_activity_summary,
            "scope_of_work": doc.custom_scope_of_work,
            "bid_evaluation_criteriacommerical": doc.custom_bid_evaluation_criteriacommercial,
            "bid_evaluation_criteriatechnical": doc.custom_bid_evaluation_criteriatechnical,
            "total": doc.total,
            "items": []
        })

        for row in doc.items:
            tender.append("items", {
                "item_code": row.item_code,
                "item_name": row.item_name,
                "qty": row.qty,
                "uom": row.uom,
                "rate": row.rate or 0,
                "amount": row.amount or 0,
                "base_rate": row.base_rate or row.rate or 0,
                "base_amount": row.base_amount or row.amount or 0,
                "description": row.description
            })

        tender.insert(ignore_permissions=True)

        doc.db_set("custom_tender_created", tender.name)

        frappe.msgprint(
            msg=f'''
                Tender created successfully:
                <a href="/app/tender/{tender.name}">
                    {tender.name}
                </a>
            ''',
            title="Success",
            indicator="green"
        )

    except Exception:
        frappe.db.rollback()

        doc.db_set("workflow_state", "Go For Bid")

        frappe.log_error(
            frappe.get_traceback(),
            f"Tender Creation Failed for Opportunity {doc.name}"
        )

        frappe.throw(
            "Tender creation failed due to an internal error. Workflow has been reverted to 'Go For Bid'. Please contact administrator."
        )

@frappe.whitelist()
def create_tender_from_opportunity(opportunity_name, tender_name):
    """Create Tender from Opportunity with custom name"""
    if not tender_name:
        frappe.throw("Tender Name is required")
   
    opportunity_doc = frappe.get_doc("Opportunity", opportunity_name)
    
    if frappe.db.exists("Tender", {"tender_name": tender_name}):
        frappe.throw("Tender {0} already exists".format(tender_name))
    

    tender = frappe.get_doc({
        "doctype": "Tender",
        "tender_name": tender_name,
        "title": tender_name,
        "party_name": opportunity_doc.party_name,
        "opportunity_from": opportunity_doc.opportunity_from,
        "company": opportunity_doc.company,
        "tender_notification_date": opportunity_doc.custom_tender_notification_date,
        "transaction_date": opportunity_doc.transaction_date,
        "opportunity_owner": opportunity_doc.opportunity_owner,
        "opportunity_type": opportunity_doc.opportunity_type,
        "sales_stage": opportunity_doc.sales_stage,
        "probability": opportunity_doc.probability,
        "no_of_employees": opportunity_doc.no_of_employees,
        "annual_revenue": opportunity_doc.annual_revenue,
        "country": opportunity_doc.country,
        "currency": opportunity_doc.currency,
        "opportunity_amount": opportunity_doc.opportunity_amount,
        "industry": opportunity_doc.industry,
        "market_segment": opportunity_doc.market_segment,
        "city": opportunity_doc.city,
        "state": opportunity_doc.state,
        "territory": opportunity_doc.territory,
        "contact_person": opportunity_doc.contact_person,
        "contact_email": opportunity_doc.contact_email,
        "contact_mobile": opportunity_doc.contact_mobile,
        "whatsapp": opportunity_doc.whatsapp,
        "phone": opportunity_doc.phone,
        "phone_ext": opportunity_doc.phone_ext,
        "tenderrfp_number": opportunity_doc.custom_tenderrfp_number,
        "tender_reference": opportunity_doc.custom_tender_reference,
        "tender_submission_date": opportunity_doc.custom_tender_submission_date,
        "project_duration": opportunity_doc.custom_project_duration,
        "jvconsortium": opportunity_doc.custom_jvconsortium,
        "tender_fee_exempted": opportunity_doc.custom_tender_fee_exempted,
        "tender_fee": opportunity_doc.custom_tender_fee,
        "tender_category": opportunity_doc.custom_tender_category,
        "tender_type": opportunity_doc.custom_tender_type,
        "emd_exempted": opportunity_doc.custom_emd_exempted,
        "earnest_money_deposit": opportunity_doc.custom_earnest_money_deposit,
        "next_activity_deadline": opportunity_doc.custom_next_activity_deadline,
        "next_activity_summary": opportunity_doc.custom_next_activity_summary,
        "scope_of_work": opportunity_doc.custom_scope_of_work,
        "bid_evaluation_criteriacommerical": opportunity_doc.custom_bid_evaluation_criteriacommercial,
        "bid_evaluation_criteriatechnical": opportunity_doc.custom_bid_evaluation_criteriatechnical,
        "total": opportunity_doc.total,
        "items": []
    })
    
    
    for row in opportunity_doc.items:
        tender.append("items", {
            "item_code": row.item_code,
            "item_name": row.item_name,
            "qty": row.qty,
            "uom": row.uom,
            "rate": row.rate or 0,
            "amount": row.amount or 0,
            "base_rate": row.base_rate or row.rate or 0,
            "base_amount": row.base_amount or row.amount or 0,
            "description": row.description
        })
    
    tender.insert(ignore_permissions=True)
   
    frappe.db.set_value('Tender', tender.name, 'tender_created', tender.name)
    
   
    frappe.db.set_value('Opportunity', opportunity_name, 'custom_tender_created_', tender.name)
    
   
    frappe.db.set_value('Opportunity', opportunity_name, 'workflow_state', 'Tender Created')
   
    frappe.db.commit()

    
    message = 'Tender <a href="/app/tender/{0}">{1}</a> has been created successfully.'.format(tender.name, tender_name)
    frappe.msgprint(message, title='Tender Created Successfully', indicator='green')
    
    return {
        'tender': tender.name,
        'message': message
    }