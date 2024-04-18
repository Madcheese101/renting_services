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

@frappe.whitelist()
def cancel_unconfirmed_rents():
        # Daily at 12AM
        before_date = frappe.utils.add_to_date(frappe.utils.now(), days=-1)
        filters = {'docstatus': 1, 
                   'rent_status': 'غير مؤكد',
                   'creation': ['<=', before_date]}
        unconfirmed_invoices = frappe.db.get_all('Sales Invoice', 
                                    fields=['name'],
                                    filters=filters,
                                    pluck="name") or []
        for invoice in unconfirmed_invoices:
                doc = frappe.get_doc('Sales Invoice', invoice)
                doc.flags.ignore_permissions=True
                doc.cancel()