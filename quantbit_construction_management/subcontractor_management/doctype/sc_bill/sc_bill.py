# Copyright (c) 2026, QTPL and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, getdate
from quantbit_construction_management.utils import generate_unique_8_digit_number


class SCBill(Document):

    def before_insert(self):

        if not self.bill_no:

            self.bill_no = generate_unique_8_digit_number(
                "SC Bill",
                "bill_no"
            )

    def validate(self):
        self.validate_billable_qty()
        self.calculate_totals()

    def on_submit(self):
        self.apply_billed_qty(reverse=False)

    def on_cancel(self):
        self.apply_billed_qty(reverse=True)

    def validate_billable_qty(self):
        """Block billing more than the remaining (contracted - already billed)
        quantity for any selected row."""
        for row in self.bill_items:
            if not row.check or not row.subcontractor_refer:
                continue

            detail = frappe.db.get_value(
                "Subcontractor Details",
                row.subcontractor_refer,
                ["quantity", "billed_qty"],
                as_dict=True,
            )
            if not detail:
                continue

            remaining = flt(detail.quantity) - flt(detail.billed_qty)
            # Keep the guard field in sync with the live remaining figure.
            row.billable_qty = remaining

            if flt(row.qty) > remaining + 1e-9:
                frappe.throw(
                    _("Row #{0}: Qty {1} exceeds the remaining billable quantity {2}.")
                    .format(row.idx, flt(row.qty), remaining)
                )

    def calculate_totals(self):
        """Gross/Net are driven only by the selected (checked) rows."""
        gross = sum(
            flt(row.amount) for row in self.bill_items if row.check
        )
        self.gross_amount = gross
        self.net_amount = (
            flt(gross) - flt(self.advance_recovery) - flt(self.retention)
        )

    def apply_billed_qty(self, reverse=False):
        """On submit, add each selected row's Qty onto the linked Subcontractor
        Details' billed_qty (and Task totals); on cancel, subtract it back."""
        for row in self.bill_items:
            if not row.check or not row.subcontractor_refer:
                continue

            qty = flt(row.qty)
            if not qty:
                continue

            _update_subcontractor_detail(row.subcontractor_refer, qty, reverse)


# Ordered hierarchy fields on the SC Bill Items child table, root -> deepest.
# parent_task holds the top-level Stage, task the next level, then task_level1..10.
HIERARCHY_FIELDS = ["parent_task", "task"] + [f"task_level{i}" for i in range(1, 11)]

# Map each hierarchy link field to its read-only subject (fetch_from) field.
SUBJECT_FIELDS = {
    "parent_task": "parent_task_subject",
    "task": "task_subject",
    **{f"task_level{i}": f"level{i}_subject" for i in range(1, 11)},
}


def _update_subcontractor_detail(detail_name, qty, reverse=False):
    """Adjust one Subcontractor Details child row's ``billed_qty`` by ``qty``
    (subtracting when ``reverse``), then re-sum the owning Task's
    subcontracting totals so they never drift from the child table."""
    parent_task = frappe.db.get_value("Subcontractor Details", detail_name, "parent")
    if not parent_task:
        return

    task_doc = frappe.get_doc("Task", parent_task)

    target = None
    for d in task_doc.custom_subcontractor_details:
        if d.name == detail_name:
            target = d
            break

    if not target:
        return

    delta = -flt(qty) if reverse else flt(qty)
    target.billed_qty = max(flt(target.billed_qty) + delta, 0)

    _recalculate_subcontracting_totals(task_doc)

    task_doc.flags.ignore_validate_update_after_submit = True
    task_doc.save(ignore_permissions=True)


def _recalculate_subcontracting_totals(task_doc):
    """Re-sum the Task-level subcontracting rollup fields from the child table."""
    total_qty = 0
    total_billed = 0
    total_paid = 0
    total_amount = 0

    for d in task_doc.custom_subcontractor_details:
        total_qty += flt(d.quantity)
        total_billed += flt(d.billed_qty)
        total_paid += flt(d.paid_qty)
        total_amount += flt(d.amount)

    task_doc.custom_total_subcontracting_qty = total_qty
    task_doc.custom_total_billed_qty = total_billed
    task_doc.custom_total_paid_qty = total_paid
    task_doc.custom_total_subcontracting_amount = total_amount


def _build_hierarchy_path(task_name):
    """Return the ancestor chain [root ... task_name] as a list of
    {name, subject}, walking Task.parent_task upward."""
    hierarchy = []
    current = frappe.db.get_value(
        "Task", task_name, ["name", "subject", "parent_task"], as_dict=True
    )
    visited = set()
    while current and current.name not in visited:
        visited.add(current.name)
        hierarchy.insert(0, {"name": current.name, "subject": current.subject})
        if not current.parent_task:
            break
        current = frappe.db.get_value(
            "Task", current.parent_task,
            ["name", "subject", "parent_task"], as_dict=True
        )
    return hierarchy


@frappe.whitelist()
def get_sc_bill_data(project, subcontractor, period_from=None, period_to=None):
    """Fetch the Stage -> Task -> Subtask hierarchy for the given Project,
    restricted to nodes whose ``custom_subcontractor_details`` child table has
    an entry for ``subcontractor`` (a Contractor) within the billing period.

    Returns one row per matching Subcontractor Details entry, carrying the full
    hierarchy path plus quantity/rate/amount/billed_qty/paid_qty, ready to be
    poured into the SC Bill ``bill_items`` table.
    """
    if not project or not subcontractor:
        frappe.throw(_("Project and Subcontractor are required."))

    detail_rows = frappe.get_all(
        "Subcontractor Details",
        filters={
            "parenttype": "Task",
            "parentfield": "custom_subcontractor_details",
            "subcontractor": subcontractor,
        },
        fields=[
            "name", "parent", "subcontractor", "subcontractor_name",
            "quantity", "rate", "amount", "date", "billed_qty", "paid_qty",
        ],
    )
    if not detail_rows:
        return []

    from_date = getdate(period_from) if period_from else None
    to_date = getdate(period_to) if period_to else None

    task_project_cache = {}
    result = []

    for d in detail_rows:
        task_name = d.parent

        if task_name not in task_project_cache:
            task_project_cache[task_name] = frappe.db.get_value(
                "Task", task_name, "project"
            )

        # Restrict to the selected project.
        if task_project_cache[task_name] != project:
            continue

        # Restrict to the billing period (only when the entry carries a date).
        if d.date:
            entry_date = getdate(d.date)
            if from_date and entry_date < from_date:
                continue
            if to_date and entry_date > to_date:
                continue

        # Remaining billable quantity = contracted qty - already billed qty.
        total_qty = flt(d.quantity)
        already_billed = flt(d.billed_qty)
        remaining = total_qty - already_billed

        # Only fully/partly unbilled entries are eligible for a new bill.
        if remaining <= 0:
            continue

        hierarchy = _build_hierarchy_path(task_name)
        if not hierarchy:
            continue

        rate = flt(d.rate)

        row = {
            "check": 1,
            "subcontractor_refer": d.name,
            "qty": remaining,
            "billable_qty": remaining,
            "rate": rate,
            "amount": remaining * rate,
            "billed_qty": already_billed,
            "paid_qty": flt(d.paid_qty),
        }

        for idx, node in enumerate(hierarchy):
            if idx >= len(HIERARCHY_FIELDS):
                break
            fieldname = HIERARCHY_FIELDS[idx]
            row[fieldname] = node["name"]
            row[SUBJECT_FIELDS[fieldname]] = node["subject"]

        result.append(row)

    return result