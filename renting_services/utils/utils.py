import base64
import io
import json

import numpy as np
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
from frappe.utils.print_format import get_pdf
from frappe.core.doctype.access_log.access_log import make_access_log

from frappe.www.printview import validate_print_permission
from frappe.translate import print_language
from frappe.utils.pdf import prepare_options
from PIL import Image, ImageDraw, ImageFont

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

@frappe.whitelist()
def get_print_as_pdf(doctype, name, format=None, doc=None, 
                  no_letterhead=0, language=None, letterhead=None):
    pdf_file = None
    doc = doc or frappe.get_doc(doctype, name)

    user_branch = frappe.get_value("Employee", {"user_id": frappe.session.user}, ["branch"]) or None

    if not user_branch:
        frappe.throw("فرع المحل غير محدد للموظف")
    
    
    letterhead_, default_printer, print_server = frappe.get_value("Branch", user_branch, ["letter_head","default_printer", "print_server"])
    
    if not print_server:
        print_server = "localhost"
    printing_settings = frappe.get_all("Branch Printers", 
                                      filters={"print_doctype": doctype,
                                               "print_format": format,
                                               "parent": user_branch},
                                        fields=["printer", "page_width", "page_height"],
                                        limit=1)
    if printing_settings:
        printer = printing_settings[0]
        if printer["page_width"] == 0:
            printer["page_width"] == None
        if printer["page_height"] == 0:
            printer["page_height"] == None

    elif default_printer:
        printer = {"printer": default_printer, "page_width":None, "page_height":None}
    else:
        frappe.throw(f"لم يتم تحديد الطابعة الإفتراضية للمحل أو تحديد الطابعة لقالب الطباعة : {format}")
    

    if not letterhead and (no_letterhead == 0):
        letterhead = letterhead_ or None
        
        
    validate_print_permission(doc)
    with print_language(language):
        pdf_file = frappe.get_print(
            doctype, name, format, doc=doc,
            letterhead=letterhead, no_letterhead=no_letterhead,
            as_pdf=True, 
        )
    return pdf_file, printer, print_server

@frappe.whitelist()
def create_bitmap_from_text(text="", font_size=25):
    path="/assets/renting_services/output.png"
    output_path=f".{path}"
    # Create an image with a white background
    width = 400
    height = 50
    img = Image.new("RGB", (width, height), color="white")
    draw = ImageDraw.Draw(img)

    # Load a font (you can specify a different font path)
    fontFile = "./assets/renting_services/Sahel.ttf"
    font = ImageFont.truetype(fontFile, font_size)
    multiline_text = """يارا 6389 مقاس 80×150 بيج/بيج"""

    draw.multiline_text((0, 0), multiline_text, fill="black", 
                        font=font, spacing=4, align="left",
                        direction="rtl", language="ar")

    img.save(output_path)

    return (frappe.utils.get_url()+path), {"width": width, "height": height}
@frappe.whitelist()
def get_base64_img(path="./assets/renting_services/js/output.png"):
    import base64
    with open(path, 'rb') as image_file:
        
        base64_bytes = base64.b64encode(image_file.read())
        # frappe.msgprint(base64_bytes)
        return  base64_bytes #base64_bytes