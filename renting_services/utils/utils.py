import json

import frappe
from frappe import _
from frappe.utils import (
	add_days,
	add_months,
	cint,
	comma_and,
	flt,
	fmt_money,
	formatdate,
	get_last_day,
	get_link_to_form,
	getdate,
	nowdate,
	parse_json,
	today,
)

@frappe.whitelist()
def update_child_ready_qty(parent_doctype, trans_items, 
                           parent_doctype_name, next_step_doc, new_notes=None):
    data = json.loads(trans_items)
    parent = frappe.get_doc(parent_doctype, parent_doctype_name)
    process_items = []
    total_ready = 0
    
    for d in data:
        if not d.get("item_code"):
            # ignore empty rows
            continue

        if d.get("docname"):
            item_name = d.get("item_name")
            child_item = frappe.get_doc("Process Items", d.get("docname"))
            prev_qty, new_qty = child_item.get("ready_qty"), d.get("ready_qty")
            if d.get("ready_qty") > d.get("qty"):
                frappe.throw(f'الكمية المكتملة للصنف {item_name} لا يمكن ان تكون أكبر من كمية الصنف')
                

            if prev_qty < new_qty:
                process_items.append({"item_code": d.get("item_code"), "qty": d.get("ready_qty")})
                child_item.ready_qty = d.get("ready_qty")
                child_item.flags.ignore_validate_update_after_submit = True
                child_item.save(ignore_permissions=True)
            total_ready += d.get("ready_qty")

    if total_ready != parent.total_ready:
        parent.db_set('total_ready', total_ready)
        
    if process_items:
        next_doc = frappe.new_doc(next_step_doc)
        next_doc.invoice_id = parent.invoice_id
        if next_step_doc == "Repair":
            next_doc.cleaning_id = parent.name
        if next_step_doc == "Store Recieve Item":
            next_doc.repair_id = parent.name
        next_doc.notes = new_notes
        next_doc.total_qty = total_ready
        next_doc.set("items", process_items)
        next_doc.flags.ignore_mandatory = True
        next_doc.save(ignore_permissions=True)
        next_doc.submit()

    
    parent.set_status()
    parent.reload()
    return parent


@frappe.whitelist()
def create_defaults():
    create_roles()
    create_stock_entry_type()
    
def create_roles():
    if not frappe.db.exists("Role", "تنظيف"):
        cleaning = frappe.get_doc(doctype='Role', role_name='تنظيف')
        cleaning.save(ignore_permissions=True)
    if not frappe.db.exists("Role", "صيانة"):
        repair = frappe.get_doc(doctype='Role', role_name='صيانة')
        repair.save(ignore_permissions=True)
    if not frappe.db.exists("Role", "مشرف محل"):
        store_manager = frappe.get_doc(doctype='Role', role_name="مشرف محل")
        store_manager.save(ignore_permissions=True)
    if not frappe.db.exists("Role", "كاشير"):
        cashier = frappe.get_doc(doctype='Role', role_name="كاشير")
        cashier.save(ignore_permissions=True)
    frappe.db.commit()

def create_stock_entry_type():
    if not frappe.db.exists("Stock Entry Type", "خروج"):
        cleaning = frappe.get_doc(doctype='Stock Entry Type', role_name='خروج')
        cleaning.purpose = "Material Transfer"
        cleaning.add_to_transit = 0
        cleaning.save(ignore_permissions=True)

    frappe.db.commit()

