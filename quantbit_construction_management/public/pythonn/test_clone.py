import frappe
from quantbit_construction_management.api import create_stage_from_template

def test_clone():
    # Find a stage to clone
    stages = frappe.get_all('Task', filters={'custom_is_stage': 1, 'status': 'Template'}, limit=1)
    if not stages:
        print("No template stage found to test.")
        return
    
    source_stage = stages[0].name
    target_project = "PROJ-2026-0001" # Assuming this exists or just using a string
    
    print(f"Cloning stage {source_stage} to project {target_project}...")
    
    # Test without dependencies
    new_stage_name = create_stage_from_template(source_stage, target_project, include_dependencies=False)
    print(f"Created stage without deps: {new_stage_name}")
    
    # Test with dependencies
    new_stage_name_deps = create_stage_from_template(source_stage, target_project, include_dependencies=True)
    print(f"Created stage with deps: {new_stage_name_deps}")
    
    # Verify child tasks
    children = frappe.get_all('Task', filters={'parent_task': new_stage_name})
    print(f"Stage {new_stage_name} has {len(children)} children.")

if __name__ == "__main__":
    frappe.init(site="contruction_management.com")
    frappe.connect()
    test_clone()
