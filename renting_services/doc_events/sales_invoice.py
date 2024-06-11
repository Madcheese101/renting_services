import frappe

def cancel_pay_payment_entry(doc, method):
    if not doc.is_return:
        return None
    
    payment_entries = frappe.get_all(
        "Payment Entry",
        filters={
            "reference_no": doc.name,
            "docstatus": 1
        },
        pluck="name"
    )

    for payment_entry in payment_entries:
        pe = frappe.get_doc("Payment Entry", payment_entry)
        pe.flags.ignore_permissions = True
        pe.cancel()
        frappe.db.commit()

    if payment_entries:
        frappe.db.set_value("Sales Invoice", doc.return_against, "rent_status", "محجوز")
        frappe.db.commit()
    else:
        frappe.db.set_value("Sales Invoice", doc.return_against, "rent_status", "غير مؤكد")
        frappe.db.commit()
