import frappe

def check_stages():
    stages = frappe.get_all('Task', filters={'custom_is_stage': 1}, limit=5)
    print(f"Stages: {stages}")
    for stage in stages:
        children = frappe.get_all('Task', filters={'parent_task': stage.name})
        print(f"Stage {stage.name} has {len(children)} children: {children}")

if __name__ == "__main__":
    frappe.init(site="quantbit-construction-management.local")
    frappe.connect()
    check_stages()
