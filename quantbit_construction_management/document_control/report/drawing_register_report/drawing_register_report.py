# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
    filters = filters or {}

    columns = get_columns()
    data = get_data(filters)

    return columns, data


def get_columns():
    return [
        {
            "label": _("Sr No"),
            "fieldname": "sr_no",
            "fieldtype": "Data",
            "width": 50
        },
        {
            "label": _("Drawing Register"),
            "fieldname": "entry_name",
            "fieldtype": "Link",
            "options": "Drawing Register",
            "width": 160
        },
        {
            "label": _("Drawing Number"),
            "fieldname": "drawing_no",
            "fieldtype": "Data",
            "width": 90
        },
        {
            "label": _("Drawing Title"),
            "fieldname": "title",
            "fieldtype": "Data",
            "width": 170
        },
        {
            "label": _("Drawing Type"),
            "fieldname": "drawing_type",
            "fieldtype": "Select",
            "width": 100
        },
        {
            "label": _("Discipline"),
            "fieldname": "discipline",
            "fieldtype": "Select",
            "width": 100
        },
        {
            "label": _("Project"),
            "fieldname": "project",
            "fieldtype": "Data",
            "width": 250
        },
        {
            "label": _("Revision"),
            "fieldname": "revision",
            "fieldtype": "Data",
            "width": 50
        },
        {
            "label": _("From Entity"),
            "fieldname": "from_entity",
            "fieldtype": "Data",
            "width": 200
        },
        {
            "label": _("Issue Date"),
            "fieldname": "issue_date",
            "fieldtype": "Date",
            "width": 110
        },
        {
            "label": _("Status"),
            "fieldname": "status",
            "fieldtype": "Select",
            "width": 100
        },
        {
            "label": _("On Hold"),
            "fieldname": "holdlist_flag",
            "fieldtype": "Data",
            "width": 70
        },
        {
            "label": _("Is Statutory"),
            "fieldname": "is_statutory",
            "fieldtype": "Data",
            "width": 80
        },
        {
            "label": _("Is Shop Drawing"),
            "fieldname": "is_shop_drawing",
            "fieldtype": "Data",
            "width": 90
        },
        {
            "label": _("Is Vendor Document"),
            "fieldname": "is_vendor_document",
            "fieldtype": "Data",
            "width": 100
        }
    ]


def get_data(filters):
    conditions = ""
    values = {}

    if filters.get("project"):
        conditions += " AND dr.project = %(project)s"
        values["project"] = filters.get("project")

    if filters.get("issue_date"):
        conditions += " AND dr.issue_date = %(issue_date)s"
        values["issue_date"] = filters.get("issue_date")

    if filters.get("drawing_no"):
        conditions += " AND dr.drawing_no = %(drawing_no)s"
        values["drawing_no"] = filters.get("drawing_no")

    data = frappe.db.sql(
        """
        SELECT
            dr.name AS entry_name,
            p.project_name AS project,

            dr.drawing_type,
            dr.discipline,
            dr.drawing_no,
            dr.title,
            dr.issue_date,

            child.revision,
            child.status,

            u.first_name AS from_entity,

            CASE
                WHEN dr.holdlist_flag = 1 THEN 'Yes'
                ELSE ''
            END AS holdlist_flag,

            CASE
                WHEN dr.is_statutory = 1 THEN 'Yes'
                ELSE ''
            END AS is_statutory,

            CASE
                WHEN dr.is_shop_drawing = 1 THEN 'Yes'
                ELSE ''
            END AS is_shop_drawing,

            CASE
                WHEN dr.is_vendor_document = 1 THEN 'Yes'
                ELSE ''
            END AS is_vendor_document

        FROM `tabDrawing Register` dr

        LEFT JOIN `tabProject` p
            ON p.name = dr.project

        LEFT JOIN `tabUser` u
            ON u.name = dr.from_entity

        LEFT JOIN `tabDrawing Revision` child
            ON child.parent = dr.name

        WHERE 1 = 1
        {conditions}

        ORDER BY dr.name
        """.format(conditions=conditions),
        values,
        as_dict=True
    )

    previous_parent = None
    serial_no = 0

    for row in data:

        original_entry_name = row["entry_name"]

        if previous_parent != original_entry_name:

            serial_no += 1

            row["sr_no"] = str(serial_no)

            previous_parent = original_entry_name

        else:

            row["sr_no"] = ""
            row["entry_name"] = ""
            row["project"] = ""
            row["drawing_type"] = ""
            row["drawing_no"] = ""
            row["title"] = ""
            row["from_entity"] = ""
            row["issue_date"] = ""
            row["discipline"] = ""

            
            row["holdlist_flag"] = ""
            row["is_statutory"] = ""
            row["is_shop_drawing"] = ""
            row["is_vendor_document"] = ""

    return data

