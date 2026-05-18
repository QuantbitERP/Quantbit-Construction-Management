import frappe
from frappe import _
from frappe.desk.query_report import run

@frappe.whitelist()
def get_report_html(report_name, filters=None):
    if isinstance(filters, str):
        filters = frappe.parse_json(filters)
    
    if not filters:
        filters = {}

    
    if not filters.get("company"):
        filters["company"] = frappe.defaults.get_user_default("company") or frappe.db.get_single_value("Global Defaults", "default_company")
    
    if not filters.get("from_date"):
        filters["from_date"] = frappe.utils.add_months(frappe.utils.today(), -1)
    
    if not filters.get("to_date"):
        filters["to_date"] = frappe.utils.today()

   
    # Run the report directly, ignoring the 'Prepared Report' background flag
    try:
        data = run(report_name, filters, ignore_prepared_report=True)
    except Exception as e:
        # Check for common NoneType errors in filters
        error_msg = str(e)
        if "NoneType" in error_msg and "+" in error_msg:
             return f"<div class='alert alert-warning'><b>Filter Warning:</b> One of the mandatory filters for this report (e.g., Company or Dates) is missing or invalid.<br><small>Technical Error: {error_msg}</small></div>"
        return f"<div class='alert alert-danger'>Error running report: {error_msg}</div>"

    is_preparing = False
    # If run() still returns a prepared report flag (rare if ignored), handle it
    if isinstance(data, dict) and data.get("prepared_report"):
         return {
             "status": "preparing",
             "html": "<div class='alert alert-info'><i class='fa fa-spinner fa-spin'></i> This report is still being calculated. Please wait...</div>"
         }
    
    # Process successful data
    columns = data.get("columns")
    result = data.get("result")
    
    if not columns or not result:
        return "<div class='text-muted' style='padding: 20px; text-align: center;'>No data found for this report.</div>"
    
    # Filter Summary
    preparing_notice = ""
    if is_preparing:
        preparing_notice = "<div style='color: #fb8c00; font-size: 11px; margin-bottom: 10px;'><i class='fa fa-refresh fa-spin'></i> A newer version of this report is being prepared. Showing latest available data.</div>"

    filter_html = f"{preparing_notice}<div style='margin-bottom: 15px; font-size: 12px; color: #4a5568; display: flex; flex-wrap: wrap; gap: 8px;'>"
    filter_html += "<strong>Applied Filters:</strong> "
    for k, v in filters.items():
        if v:
            filter_html += f"<span style='background: #e2e8f0; padding: 2px 8px; border-radius: 12px;'>{k.replace('_', ' ').title()}: {v}</span>"
    filter_html += "</div>"

    html = """
    <style>
        .report-container { max-height: 600px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 10px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .custom-report-table { width: 100%; border-collapse: separate; border-spacing: 0; background: white; }
        .custom-report-table thead { position: sticky; top: 0; z-index: 10; }
        .custom-report-table th { background: #1a365d; color: white; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; border-bottom: 2px solid #2d3748; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.05em; }
        .custom-report-table td { padding: 10px 15px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #2d3748; white-space: nowrap; }
        .custom-report-table tr:hover { background-color: #f7fafc; }
        .custom-report-table tr:last-child td { border-bottom: none; }
        .num-cell { text-align: right; font-family: 'Courier New', Courier, monospace; }
        .pos-val { color: #059669; font-weight: 600; }
        .neg-val { color: #dc2626; font-weight: 600; }
    </style>
    """
    html = filter_html + html
    html += "<div class='report-container'>"
    html += "<table class='custom-report-table'>"
    
    html += "<thead><tr>"
    col_keys = []
    col_types = {}
    for col in columns:
        label = ""
        fieldname = ""
        ctype = "Data"
        if isinstance(col, dict):
            label = col.get("label") or col.get("fieldname") or ""
            fieldname = col.get("fieldname") or col.get("id") or col.get("label") or ""
            ctype = col.get("fieldtype", "Data")
        elif isinstance(col, (list, tuple)):
            label = col[0] if len(col) > 0 else ""
            fieldname = col[0] if len(col) > 0 else ""
            ctype = col[1] if len(col) > 1 else "Data"
        elif isinstance(col, str):
            label = col
            fieldname = col
            
        col_keys.append(fieldname)
        col_types[fieldname] = ctype
        html += f"<th>{label}</th>"
    html += "</tr></thead>"
    
    html += "<tbody>"
    for row in result:
        html += "<tr>"
        row_dict = row if (hasattr(row, "get") or isinstance(row, dict)) else None
        
        for i, key in enumerate(col_keys):
            val = ""
            if row_dict:
                val = row_dict.get(key, "")
            else:
                val = row[i] if i < len(row) else ""
            
            if val is None: val = ""
            
            cell_class = ""
            ctype = col_types.get(key, "Data")
            
            if isinstance(val, (int, float)) or ctype in ["Currency", "Float", "Int", "Percent"]:
                cell_class = "num-cell"
                try:
                    fval = float(val)
                    if fval > 0 and ("qty" in key.lower() or "amount" in key.lower()):
                        cell_class += " pos-val"
                    elif fval < 0:
                        cell_class += " neg-val"
                except:
                    pass
            
            html += f"<td class='{cell_class}'>{val}</td>"
        html += "</tr>"
    html += "</tbody>"
    
    html += "</table></div>"
    return html
