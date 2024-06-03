import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate

@frappe.whitelist()
def send_item_to_cleaning(item_code, user=None, notes=None):
    doc = frappe.new_doc("Cleaning")
    doc.invoice_id = None
    doc.employee = user
    if user:
        doc.employee = user
        doc.status = "قيد التنظيف"
        doc.accept_date = nowdate()
    
    doc.append("items", {
        "item_code": item_code,
        "qty": 1
    })
    doc.total_qty = 1
    doc.notes = str(notes) if notes else ''
    doc.flags.ignore_mandatory = True
    doc.flags.ignore_permissions=True
    doc.save()
    doc.submit()

@frappe.whitelist()
def send_item_to_repair(item_code, user=None, notes=None):
    doc = frappe.new_doc("Repair")
    doc.invoice_id = None
    doc.employee = user
    if user:
        doc.employee = user
        doc.status = "قيد الصيانة"
        doc.accept_date = nowdate()
    
    doc.append("items", {
        "item_code": item_code,
        "qty": 1
    })
    doc.total_qty = 1
    doc.notes = str(notes) if notes else ''
    doc.flags.ignore_mandatory = True
    doc.flags.ignore_permissions=True
    doc.save()
    doc.submit()