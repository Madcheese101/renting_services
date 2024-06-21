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
def report_to_pdf(content_html, defaults, letter_head = None):
    """
    Convert HTML content to PDF.
    
    Args:
        content_html (str): HTML content to be converted to PDF.
        defaults (str): JSON string containing default settings for the PDF.
        letter_head (str, optional): Name of the letterhead to be used for the PDF. Defaults to None.
    
    Returns:
        dict: Dictionary containing the generated PDF file, printer details, and print server.
    """
    
    pdf_file = None
    
    # Set default print settings
    print_settings = {
        "repeat_header_footer": 1,
        "with_letterhead": 1,
        "with_letter_head": 1,
        "letter_head": {},
        "orientation": "Portrait",
        "pick_columns": 0,
    }
    
    # Parse default settings from JSON string
    defaults = json.loads(defaults)

    # Get branch associated with the user
    user_branch = frappe.get_value("Employee", {"user_id": frappe.session.user}, ["branch"]) or None

    # Throw an exception if no branch is associated with the user
    if not user_branch:
        frappe.throw("فرع المحل غير محدد للموظف")

    # Get default printer and print server for the branch
    default_printer, print_server = frappe.get_value("Branch", user_branch, ["default_printer","print_server"])
    
    # Set default print server if not specified
    if not print_server:
        print_server = "localhost"
        
    # Set printer details if default printer is specified
    if default_printer:
        printer = {"printer": default_printer, "page_width":None, "page_height":None}
    else:
        # Throw an exception if no default printer is specified
        frappe.throw(f"لم يتم تحديد الطابعة الإفتراضية للمحل")
    
    # Set letterhead details if specified
    if letter_head:
        header, footer = frappe.db.get_value('Letter Head', letter_head, ['content', 'footer'])
        print_settings["letter_head"] = {"header": header, "footer": footer}

    # Set template variables for rendering the PDF template
    template_vars = {
        "print_settings": print_settings,
        "content": content_html, # insert custom template html
        "title": _(defaults["title"]),
        "base_url": defaults["base_url"],
        "print_css": defaults["print_css"],
        "layout_direction": defaults["layout_direction"],
        "lang": defaults["lang"],
        "landscape": 0,
        "columns": [],
        "can_use_smaller_font": 1,
    }
    
    # Render the PDF template with the specified template variables
    html = frappe.render_template("templates/report_template.html", template_vars)

    # Log the generated PDF file
    make_access_log(file_type="PDF", method="PDF", page=html)

    # Generate the PDF file
    pdf_file = get_pdf(html, {"orientation": print_settings["orientation"]})

    # Return the generated PDF file, printer details, and print server
    return {
        "pdf_file": pdf_file, 
        "printer": printer, 
        "print_server": print_server
    }
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