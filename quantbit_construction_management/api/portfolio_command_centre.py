import frappe

@frappe.whitelist()
def get_dashboard_numbers(from_date=None, to_date=None, project=None, site=None):
    # Base conditions for Project
    proj_conditions = ["is_active = 'Yes'"]
    proj_values = {}

    if project and project != "all":
        proj_conditions.append("name = %(project)s")
        proj_values["project"] = project
    if site and site != "all":
        proj_conditions.append("custom_site = %(site)s")
        proj_values["site"] = site
    if from_date:
        proj_conditions.append("IFNULL(expected_start_date, DATE(creation)) >= %(from_date)s")
        proj_values["from_date"] = from_date
    if to_date:
        proj_conditions.append("(expected_end_date <= %(to_date)s OR IFNULL(expected_end_date, '') = '')")
        proj_values["to_date"] = to_date

    proj_where = " AND ".join(proj_conditions)

    # 1. Total Contract Value
    total_contract_value = frappe.db.sql(f"""
        SELECT SUM(custom_contractalu_v) 
        FROM `tabProject` 
        WHERE {proj_where}
    """, proj_values)[0][0] or 0.0

    # 3. Active Projects Count
    active_projects_count = frappe.db.sql(f"""
        SELECT COUNT(*)
        FROM `tabProject`
        WHERE {proj_where}
    """, proj_values)[0][0] or 0

    # Base conditions for RA Billing
    bill_conditions = ["parent.docstatus = 1"]
    bill_values = {}

    if project and project != "all":
        bill_conditions.append("parent.project = %(project)s")
        bill_values["project"] = project
    if site and site != "all":
        bill_conditions.append("parent.site = %(site)s")
        bill_values["site"] = site
    if from_date:
        bill_conditions.append("parent.from_date >= %(from_date)s")
        bill_values["from_date"] = from_date
    if to_date:
        bill_conditions.append("parent.to_date <= %(to_date)s")
        bill_values["to_date"] = to_date

    bill_where = " AND ".join(bill_conditions)

    # 2. Billed to date
    billed_to_date = frappe.db.sql(f"""
        SELECT SUM(child.amount)
        FROM `tabRA Billing Details` child
        INNER JOIN `tabRA Billing` parent ON child.parent = parent.name
        WHERE {bill_where}
    """, bill_values)[0][0] or 0.0

    # Fetch filter options for UI dropdowns (all active projects & sites)
    projects_list = frappe.db.sql("""
        SELECT name, IFNULL(project_name, name) as project_name 
        FROM `tabProject` 
        WHERE is_active = 'Yes'
        ORDER BY project_name ASC
    """, as_dict=1)

    sites_list = frappe.db.sql("""
        SELECT DISTINCT custom_site as site 
        FROM `tabProject` 
        WHERE custom_site IS NOT NULL AND custom_site != '' 
        ORDER BY custom_site ASC
    """, as_list=1)
    sites_list = [s[0] for s in sites_list if s[0]]

    # Fetch projects for the Project health matrix table
    matrix_projects_raw = frappe.db.sql(f"""
        SELECT 
            p.name as id,
            IFNULL(p.project_name, p.name) as name,
            IFNULL(NULLIF(p.project_type, ''), 'General') as type,
            IFNULL(NULLIF(p.customer, ''), 'Internal') as client,
            IFNULL(p.custom_contractalu_v, 0.0) as contract_value,
            IFNULL(p.total_costing_amount, 0.0) as costing_amount,
            IFNULL(p.priority, 'Low') as priority,
            IFNULL(p.percent_complete, 0.0) as complete
        FROM `tabProject` p
        WHERE {proj_where}
        ORDER BY p.project_name ASC
    """, proj_values, as_dict=1)

    # Fetch billed amounts per project
    bill_group_conditions = ["parent.docstatus = 1"]
    if from_date:
        bill_group_conditions.append("parent.from_date >= %(from_date)s")
    if to_date:
        bill_group_conditions.append("parent.to_date <= %(to_date)s")
    if site and site != "all":
        bill_group_conditions.append("parent.site = %(site)s")
    
    bill_group_where = " AND ".join(bill_group_conditions)
    billed_by_proj_rows = frappe.db.sql(f"""
        SELECT parent.project, SUM(child.amount)
        FROM `tabRA Billing Details` child
        INNER JOIN `tabRA Billing` parent ON child.parent = parent.name
        WHERE {bill_group_where} AND parent.project IS NOT NULL AND parent.project != ''
        GROUP BY parent.project
    """, bill_values, as_dict=0)
    billed_by_proj = {r[0]: (r[1] or 0.0) for r in billed_by_proj_rows}

    # Fetch Planned Today (PV) and Achieved Today (EV) from Task Progress per project
    tp_group_conditions = ["parent.docstatus != 2"]
    if project and project != "all":
        tp_group_conditions.append("parent.project = %(project)s")
    if site and site != "all":
        tp_group_conditions.append("parent.site = %(site)s")
    if from_date:
        tp_group_conditions.append("parent.site_date >= %(from_date)s")
    if to_date:
        tp_group_conditions.append("parent.site_date <= %(to_date)s")

    tp_group_where = " AND ".join(tp_group_conditions)
    tp_by_proj_rows = frappe.db.sql(f"""
        SELECT parent.project, SUM(IFNULL(child.planned_today, 0.0)), SUM(IFNULL(child.achieved_today, 0.0))
        FROM `tabTask Progress Details` child
        INNER JOIN `tabTask Progress` parent ON child.parent = parent.name
        WHERE {tp_group_where} AND parent.project IS NOT NULL AND parent.project != ''
        GROUP BY parent.project
    """, bill_values, as_dict=0)
    tp_by_proj = {r[0]: {"pv": float(r[1] or 0.0), "ev": float(r[2] or 0.0)} for r in tp_by_proj_rows}

    # Fetch Open RFIs per project
    rfi_conditions = ["docstatus != 2", "status != 'Closed'", "status != 'Withdrawn'"]
    if project and project != "all":
        rfi_conditions.append("project = %(project)s")
    if site and site != "all":
        rfi_conditions.append("project IN (SELECT name FROM `tabProject` WHERE custom_site = %(site)s)")
    if from_date:
        rfi_conditions.append("raised_date >= %(from_date)s")
    if to_date:
        rfi_conditions.append("raised_date <= %(to_date)s")

    rfi_where = " AND ".join(rfi_conditions)
    rfi_rows = frappe.db.sql(f"""
        SELECT project, COUNT(*)
        FROM `tabRFI`
        WHERE {rfi_where} AND project IS NOT NULL AND project != ''
        GROUP BY project
    """, bill_values, as_dict=0)
    open_rfis_by_proj = {r[0]: (r[1] or 0) for r in rfi_rows}

    # Fetch Open NCRs per project
    ncr_conditions = ["docstatus != 2", "status != 'Closed'", "status != 'Voided'"]
    if project and project != "all":
        ncr_conditions.append("project = %(project)s")
    if site and site != "all":
        ncr_conditions.append("project IN (SELECT name FROM `tabProject` WHERE custom_site = %(site)s)")
    if from_date:
        ncr_conditions.append("raised_date >= %(from_date)s")
    if to_date:
        ncr_conditions.append("raised_date <= %(to_date)s")

    ncr_where = " AND ".join(ncr_conditions)
    ncr_rows = frappe.db.sql(f"""
        SELECT project, COUNT(*)
        FROM `tabNCR`
        WHERE {ncr_where} AND project IS NOT NULL AND project != ''
        GROUP BY project
    """, bill_values, as_dict=0)
    open_ncrs_by_proj = {r[0]: (r[1] or 0) for r in ncr_rows}

    # Fetch first user (PM) per project from More Info tab (tabProject User)
    pm_rows = frappe.db.sql("""
        SELECT pu.parent, IFNULL(NULLIF(pu.full_name, ''), pu.user)
        FROM `tabProject User` pu
        WHERE pu.parent IS NOT NULL AND pu.parent != ''
        ORDER BY pu.parent ASC, pu.idx ASC
    """, as_dict=0)
    pm_by_proj = {}
    for parent, pm_name in pm_rows:
        if parent not in pm_by_proj and pm_name:
            pm_by_proj[parent] = pm_name

    priority_map = {
        'High': 'Critical',
        'Medium': 'At Risk',
        'Low': 'On Track'
    }

    matrix_projects = []
    for idx, p in enumerate(matrix_projects_raw):
        p_id = p.get("id")
        c_val = float(p.get("contract_value") or 0.0)
        b_amt = float(billed_by_proj.get(p_id) or 0.0)

        tp_data = tp_by_proj.get(p_id, {"pv": 0.0, "ev": 0.0})
        pv_amt = tp_data["pv"]
        ev_amt = tp_data["ev"]
        ac_amt = float(p.get("costing_amount") or 0.0)

        # Calculate CPI = EV / AC (default 1.0 if AC is 0)
        if ac_amt > 0 and ev_amt > 0:
            calc_cpi = round(ev_amt / ac_amt, 2)
        elif ev_amt > 0 and ac_amt == 0:
            calc_cpi = 1.0
        else:
            calc_cpi = 1.0

        # Calculate SPI = EV / PV (default 1.0 if PV is 0)
        if pv_amt > 0 and ev_amt > 0:
            calc_spi = round(ev_amt / pv_amt, 2)
        elif ev_amt > 0 and pv_amt == 0:
            calc_spi = 1.0
        else:
            calc_spi = 1.0

        if c_val > 0:
            b_pct = min(100, int(round((b_amt / c_val) * 100)))
        else:
            b_pct = 0

        if c_val >= 10000000:
            val_str = f"₹{c_val / 10000000:.2f} Cr"
        elif c_val >= 100000:
            val_str = f"₹{c_val / 100000:.2f} L"
        elif c_val > 0:
            val_str = f"₹{c_val:,.2f}"
        else:
            val_str = "₹0 Cr"

        health_status = priority_map.get(p.get("priority"), "On Track")

        real_rfi = open_rfis_by_proj.get(p_id, 0)
        real_ncr = open_ncrs_by_proj.get(p_id, 0)
        mock_lti = ((idx * 13) % 200) + 10

        matrix_projects.append({
            "id": p_id,
            "name": p.get("name") or p_id,
            "type": p.get("type") or "General",
            "client": p.get("client") or "Internal",
            "value": val_str,
            "billed": b_pct,
            "billed_amount": b_amt,
            "health": health_status,
            "cpi": calc_cpi,
            "spi": calc_spi,
            "complete": int(round(float(p.get("complete") or 0.0))),
            "openRfi": real_rfi,
            "openNcr": real_ncr,
            "ltiDays": mock_lti,
            "pm": pm_by_proj.get(p_id, "Unassigned"),
            "pv": pv_amt,
            "ev": ev_amt,
            "ac": ac_amt
        })

    return {
        "total_contract_value": total_contract_value,
        "billed_to_date": billed_to_date,
        "active_projects_count": active_projects_count,
        "projects_list": projects_list,
        "sites_list": sites_list,
        "matrix_projects": matrix_projects
    }
