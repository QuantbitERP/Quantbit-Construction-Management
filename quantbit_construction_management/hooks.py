app_name = "quantbit_construction_management"
app_title = "Quantbit Construction Management"
app_publisher = "QTPL"
app_description = "construction management system"
app_email = "support@erpdata.in"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "quantbit_construction_management",
# 		"logo": "/assets/quantbit_construction_management/logo.png",
# 		"title": "Quantbit Construction Management",
# 		"route": "/quantbit_construction_management",
# 		"has_permission": "quantbit_construction_management.api.permission.has_app_permission"
# 	}
# ]

override_doctype_class = {
    "Task": "quantbit_construction_management.overrides.task.CustomTask"
}

doctype_js = {
  "Project" : "public/js/Project.js",
  "Task" : "public/js/Task.js",
  "Opportunity" : "public/js/Opportunity.js",
  "Stock Entry" : "public/js/Stock_Entry.js"
}

fixtures = [

    {
        "dt": "Custom Field",
        "filters": [
            [
                "module",
                "in",
                ["Quantbit Construction Management"]
            ]
        ]
    },
    {
        "doctype": "UOM"
    },

    {
        "doctype": "UOM Conversion Rate"
    },

    {
        "dt": "Accounting Dimension", "filters": [
            [
                "name", "in", [
                    "Site"
                ]
            ]
        ]
    },
    {
        "doctype": "Role"
    },
    {
        "doctype": "Workspace",
        "filters": [
            ["name", "=", "Construction Management System"]
        ]
    },
    {
        "doctype": "Workspace Link"
    },
    {
        "doctype": "Workspace Shortcut"
    },
    {
        "doctype": "Item Type"
    },
    {
        "doctype": "Contract Type"
    },
    {
        "dt": "Property Setter", "filters":
        [
            [
                "module", "in", [
                        "Quantbit Construction Management"

                ]
            ]
        ]
    },

    {
        "dt":"Workflow State" , "filters":
        [
            [
                "name", "in", [
                    "Approved By Analyzer",
                    "Approved By Technical Evaluator",
                    "Approved By Financial Evaluator",
                    "Approved By Sales",
                    "Approved By Top Management",
                    "Go For Bid",
                    "Don't Go For Bid",
                    "Preliminary Approved",
                    "Commercially Approved",
                    "Top Management Approved",
                    "Won",
                    "Lost",
                    "Alloted",
                    "New",
                    "Tender Submitted",
                    "In Progress",
                ]
            ]
        ]
    },
    {
        "dt":"Workflow Action Master" , "filters":
        [
            [
                "name", "in", [
                    "Pending Approval From Analyzer",
                    "Pending Approval From Technical Evaluator",
                    "Pending approval from Financial Evaluator",
                    "Pending Approval From Sales Evaluator",
                    "Pending Approval From Top Management",
                    "Pending Approval From Business Head",
                    "Go For Bid",
                    "Pending For Preliminary Approval",
                    "Pending For Commercial Approval",
                    "Pending For Top Management Approval",
                    "Submit Tender",
                    "Pending",
                    "Don't Go For Bid",
                    "Mark Won",
                    "Mark Lost",
                    "Allotment Received",
                    

                ]
            ]
        ]
    },
    {
        "dt":"Workflow" , "filters":
        [
            [
                "name", "in", [
                    "Tender Submission",
                    "Tender Creation",
                ]
            ]
        ]
    },
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/quantbit_construction_management/css/quantbit_construction_management.css"
# app_include_js = "/assets/quantbit_construction_management/js/quantbit_construction_management.js"

# include js, css files in header of web template
# web_include_css = "/assets/quantbit_construction_management/css/quantbit_construction_management.css"
# web_include_js = "/assets/quantbit_construction_management/js/quantbit_construction_management.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "quantbit_construction_management/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "quantbit_construction_management/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "quantbit_construction_management.utils.jinja_methods",
# 	"filters": "quantbit_construction_management.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "quantbit_construction_management.install.before_install"
# after_install = "quantbit_construction_management.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "quantbit_construction_management.uninstall.before_uninstall"
# after_uninstall = "quantbit_construction_management.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "quantbit_construction_management.utils.before_app_install"
# after_app_install = "quantbit_construction_management.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "quantbit_construction_management.utils.before_app_uninstall"
# after_app_uninstall = "quantbit_construction_management.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "quantbit_construction_management.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }
doc_events = {
	"Opportunity": {
		"on_update": "quantbit_construction_management.tendering.custom_crm.opportunity.on_update",

	},
    "Stock Entry": {
        "on_submit": "quantbit_construction_management.site_diary.custom_stock.stock_entry.update_task_material_cost"
    },
    "Payment Entry": {
        "on_submit": "quantbit_construction_management.subcontractor_management.doctype.contractor_billing.contractor_billing.on_payment_entry_submit",
        "on_cancel": "quantbit_construction_management.subcontractor_management.doctype.contractor_billing.contractor_billing.on_payment_entry_cancel"
    },
    "Purchase Invoice": {
        "on_update": "quantbit_construction_management.subcontractor_management.doctype.contractor_billing.contractor_billing.on_purchase_invoice_update"
    },
    "Journal Entry": {
        "on_update": "quantbit_construction_management.subcontractor_management.doctype.contractor_billing.contractor_billing.on_journal_entry_update"
    }
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"quantbit_construction_management.tasks.all"
# 	],
# 	"daily": [
# 		"quantbit_construction_management.tasks.daily"
# 	],
# 	"hourly": [
# 		"quantbit_construction_management.tasks.hourly"
# 	],
# 	"weekly": [
# 		"quantbit_construction_management.tasks.weekly"
# 	],
# 	"monthly": [
# 		"quantbit_construction_management.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "quantbit_construction_management.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "quantbit_construction_management.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "quantbit_construction_management.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "quantbit_construction_management.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["quantbit_construction_management.utils.before_request"]
# after_request = ["quantbit_construction_management.utils.after_request"]

# Job Events
# ----------
# before_job = ["quantbit_construction_management.utils.before_job"]
# after_job = ["quantbit_construction_management.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"quantbit_construction_management.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

