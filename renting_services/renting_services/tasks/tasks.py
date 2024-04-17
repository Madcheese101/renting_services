from datetime import datetime, timedelta

import frappe
from frappe import _
from erpnext.accounts.utils import get_balance_on


@frappe.whitelist()
def draft_invoice_check():
        # Daily at 12AM
        filters = {'docstatus': 0}
        draft_invoices = frappe.db.get_all('Sales Invoice', 
                                    fields=['name'],
                                    filters=filters,
                                    pluck="name",
                                    order_by="posting_date desc") or []
        for draft in draft_invoices:
                frappe.delete_doc('Sales Invoice', draft)