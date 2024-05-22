import json
import frappe
from erpnext.accounts.doctype.unreconcile_payment.unreconcile_payment import get_linked_payments_for_doc
from erpnext.accounts.doctype.unreconcile_payment.unreconcile_payment import create_unreconcile_doc_for_selection
from erpnext.controllers.sales_and_purchase_return import make_return_doc

def proccess_change_rent(doc, method=None):
    if doc.original_invoice:
        

        linked_payments = get_linked_payments_for_doc(company=doc.company, 
                                                    doctype=doc.doctype,
                                                    docname=doc.original_invoice)
        selection_map = []
        for payment in linked_payments:
            if payment.voucher_type == "Payment Entry":
                selection_map.append({
                    'company': payment.company,
                    'voucher_type': payment.voucher_type,
                    'voucher_no': payment.voucher_no,
                    'against_voucher_type': doc.doctype,
                    'against_voucher_no': doc.original_invoice
                })
        if len(selection_map) > 0:
            create_unreconcile_doc_for_selection(selections=json.dumps(selection_map))
    
        return_invoice = make_return_doc("Sales Invoice", doc.original_invoice, None)
        return_invoice.change_invoice = doc.name
        return_invoice.rent_status = "استبدال"
        return_invoice.is_pos = 0
        return_invoice.update_stock = 0
        return_invoice.update_outstanding_for_self = 0
        return_invoice.save()
        return_invoice.submit()

        frappe.db.set_value("Sales Invoice", doc.original_invoice, "rent_status", "استبدال")
        frappe.db.set_value("Sales Invoice", doc.original_invoice, "change_invoice", doc.name)
        frappe.db.commit()
