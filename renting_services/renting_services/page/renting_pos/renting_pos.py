import json
import frappe
from erpnext.selling.page.point_of_sale.point_of_sale import get_pos_profile_data
from frappe.query_builder import DocType
from frappe.utils import get_fullname

@frappe.whitelist()
def get_pos_profile():
    profileslist = frappe.db.get_list("POS Profile", filters={"disabled": 0},pluck="name")

    if profileslist:
        return get_pos_profile_data(profileslist[0])
    
@frappe.whitelist()
def check_availability(before_date, after_date, item_code):
    items_doc = DocType("Sales Invoice Item")
    sales_doc = DocType("Sales Invoice")
    items = json.loads(item_code)
    result = (
    frappe.qb
        .from_(sales_doc)
        .from_(items_doc)
        .select(sales_doc.name, sales_doc.delivery_date,sales_doc.return_date, items_doc.item_name)
        .where(items_doc.parent == sales_doc.name)
        .where(items_doc.item_code.isin(items) )
        .where(sales_doc.docstatus == 1)
        # .where(sales_doc.paid_amount > 0)
        .where(sales_doc.delivery_date[before_date:after_date])
    ).run(as_dict=True)
    return result

@frappe.whitelist()
def get_past_order_list(search_term, limit=50):
    fields = ["name", "grand_total", "currency", "customer", "posting_time", "posting_date"]
    
    customer_filters = {"customer": ["like", "%{}%".format(search_term)]}
    name_filters = {"name": ["like", "%{}%".format(search_term)]}
        
    invoice_list = []
    
    if search_term:
        invoices_by_customer = frappe.db.get_all(
            "Sales Invoice",
            filters=customer_filters,
            fields=fields,limit=limit
        )
        invoices_by_name = frappe.db.get_all(
            "Sales Invoice",
            filters=name_filters,
            fields=fields,limit=limit
        )

        invoice_list = invoices_by_customer + invoices_by_name
    else:
        invoice_list = frappe.db.get_all("Sales Invoice", filters={"status": "Draft"}, 
                                    fields=fields, limit=limit)

    return invoice_list

@frappe.whitelist()
def deliver_items(sales_invoice_doc, guarantee_type):
    invoice_doc = json.loads(sales_invoice_doc)
    warehouse = frappe.db.get_value('POS Profile', invoice_doc["pos_profile"], 'warehouse')
    target_wh = frappe.db.get_value('Warehouse', warehouse, 'reserve_warehouse')
    
    
    
    doc = frappe.new_doc("Stock Entry")

    # Set the necessary fields
    doc.stock_entry_type = "خروج"
    doc.company = invoice_doc["company"]
    doc.flags.ignore_permissions=True
    # Add items to the Stock Entry
    for s_item in invoice_doc["items"]:
        item = doc.append('items', {})
        item.item_code = s_item["item_code"]
        item.s_warehouse = warehouse
        item.t_warehouse = target_wh
        item.qty = s_item["qty"]

    # Insert the new document into the database
    doc.save()
    doc.submit()

    frappe.db.set_value("Sales Invoice", invoice_doc["name"], "rent_status", "خارج")
    frappe.db.set_value("Sales Invoice", invoice_doc["name"], "guarantee_type", guarantee_type)
    guarantee_id = (get_fullname() if 
        guarantee_type == "موظف" else invoice_doc["name"])
    frappe.db.set_value("Sales Invoice", invoice_doc["name"], "guarantee_id", guarantee_id)

@frappe.whitelist()
def return_and_clean(sales_invoice_doc, notes):
    invoice_doc = json.loads(sales_invoice_doc)
    doc = frappe.get_doc("Sales Invoice", invoice_doc["name"])
    doc.run_method("recieve_and_clean", notes=notes)

@frappe.whitelist()
def make_sales_return(source_name, target_doc=None):
	from erpnext.controllers.sales_and_purchase_return import make_return_doc

	return make_return_doc("Sales Invoice", source_name, target_doc)
