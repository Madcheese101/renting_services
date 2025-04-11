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

@frappe.whitelist()
def check_year_old_unallocated_payments():
    company = frappe.get_all("Company", pluck="name")[0]
    advance_payment_clearance_account, cost_center, receivable_payable_account = frappe.get_value("Company", company, ["advance_payment_clearance_account", "cost_center", "default_receivable_account"])
    if not advance_payment_clearance_account:
        frappe.throw(f"لا يوجد حساب مخصص لتسوية العرابين لشركة {company}")

    today = frappe.utils.nowdate()
    year_from_now = frappe.utils.add_to_date(today, months=-12, as_string=True)
    fields = ["name",
            "paid_from",
            "unallocated_amount",
            "party",
            "posting_date",
            "cost_center"]
    filters = {
            "payment_type": "Receive",
            "unallocated_amount": [">", 0],
            "party_type":"Customer",
            "docstatus": 1,
            # "payment_cleared":0,
            "posting_date":["<=", year_from_now]}
    result =  frappe.get_all("Payment Entry", 
                             fields=fields, 
                             filters=filters, 
                             order_by="posting_date desc") or []

    if not result:
        return False
    
    total = 0
    je = frappe.new_doc("Journal Entry")
    je.voucher_type = "Journal Entry"
    je.user_remark = "التسوية الشهرية للعرابين الأكبر من سنة"
    je.posting_date = today
    for payment_entry in result:
        total += payment_entry.unallocated_amount
        je.append("accounts", {
            "account": payment_entry.paid_from,
            "party_type": "Customer",
            "party": payment_entry.party,
            "credit_in_account_currency": 0,
            "debit_in_account_currency": payment_entry.unallocated_amount,
            "cost_center": payment_entry.cost_center})

    je.append("accounts", {
        "account": advance_payment_clearance_account,
        "credit_in_account_currency": total,
        "debit_in_account_currency": 0,
        "cost_center": cost_center})
    je.title = _("التسوية الشهرية للعرابين")
    je.ignore_permissions=True
    je.insert()
    je.submit()

    frappe.db.set_value("Journal Entry", je.name, "pay_to_recd_from", None)

    journal = je.name
    journal_date = je.posting_date
    for pe in result:
        # frappe.db.set_value("Payment Entry", pe.name, "payment_cleared", 1)
        # Create a Payment Reconciliation document
        pr = frappe.get_doc({
            "doctype": "Payment Reconciliation",
            "company": company,
            "party": pe.party,  # Replace with actual customer name
            "party_type": "Customer",
            "receivable_payable_account": receivable_payable_account,
            "invoices": [
                {
                    "invoice_type": "Journal Entry",
                    "invoice_number": journal,  # Replace with actual invoice number
                    "invoice_date": journal_date,  # Replace with actual invoice date
                    "outstanding_amount": pe.unallocated_amount
                }
            ],
            "payments": [
                {
                    "reference_type": "Payment Entry",
                    "reference_name": pe.name,  # Replace with actual payment entry name
                    "posting_date": pe.posting_date,  # Replace with actual posting date
                    "amount": pe.unallocated_amount
                }
            ]
        })


        if len(pr.invoices) > 0 and len(pr.payments) > 0:
            invoices = [x.as_dict() for x in pr.invoices]
            payments = [x.as_dict() for x in pr.payments]
            pr.allocate_entries(({"invoices": invoices, "payments": payments}))
        pr.reconcile() #skip_ref_details_update_for_pe=True
        frappe.db.commit()