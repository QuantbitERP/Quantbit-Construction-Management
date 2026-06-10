import frappe
def execute():
    meta = frappe.get_meta("Purchase Invoice")
    found = False
    for f in meta.fields:
        if f.fieldname == "more_info_tab":
            found = True
        if found:
            print(f.fieldname, f.fieldtype)
            if f.fieldtype in ["Tab Break"]:
                if f.fieldname != "more_info_tab":
                    break
