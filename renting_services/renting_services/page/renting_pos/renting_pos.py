import json
import frappe
from erpnext.selling.page.point_of_sale.point_of_sale import get_pos_profile_data
from frappe.query_builder import DocType
from pypika import Criterion
from frappe.utils import get_fullname, cint
from erpnext.selling.page.point_of_sale.point_of_sale import (search_by_term,
                                                              get_conditions,
                                                              get_item_group_condition)
from frappe.utils.nestedset import get_root_of

from erpnext.accounts.doctype.pos_invoice.pos_invoice import get_stock_availability
from erpnext.accounts.doctype.pos_profile.pos_profile import get_child_nodes, get_item_groups
from erpnext.stock.utils import scan_barcode
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
def get_available_products(pos_profile, before_date, after_date):
    items_doc = DocType("Sales Invoice Item")
    sales_doc = DocType("Sales Invoice")
    result = (
    frappe.qb
        .from_(items_doc)
        .from_(sales_doc)
        .select(items_doc.item_code)
        .where(items_doc.parent == sales_doc.name)
        .where(sales_doc.docstatus == 1)
        .where(sales_doc.pos_profile == pos_profile)
        .where(sales_doc.rent_status != "غير مؤكد")
        .where(sales_doc.delivery_date[before_date:after_date])
    )
    return result.run(pluck="item_code")

@frappe.whitelist()
def get_past_order_list(search_term, limit=50):
    fields = ["name", 
              "grand_total", 
              "currency", 
              "customer", 
              "posting_time", 
              "posting_date"]
    
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
    frappe.db.commit()

@frappe.whitelist()
def return_and_clean(sales_invoice_doc, notes):
    invoice_doc = json.loads(sales_invoice_doc)
    doc = frappe.get_doc("Sales Invoice", invoice_doc["name"])
    doc.run_method("recieve_and_clean", notes=notes)

@frappe.whitelist()
def make_sales_return(payments, source_name, target_doc=None):
    from erpnext.controllers.sales_and_purchase_return import make_return_doc
    from renting_services.overrides.rent_invoice import get_payment_entry

    payments_ = json.loads(payments)
    return_invoice = make_return_doc("Sales Invoice", source_name, target_doc)
    return_invoice.is_pos = 0
    return_invoice.update_stock = 0
    return_invoice.update_outstanding_for_self = 0
    return_invoice.save()
    return_invoice.submit()
    frappe.db.set_value("Sales Invoice", source_name, "rent_status", "مرتجع")
    frappe.db.commit()
    
    for payment in payments_:
        reference_no = ""
        if (payment["type"] == "Bank"):
            reference_no = f'{return_invoice.name} - {frappe.datetime.nowdate()}'
        payment_entry = get_payment_entry(dt= return_invoice.doctype, 
                                          dn=return_invoice.name,
                                          party_type="Customer",
                                          mode_of_payment=payment["mode_of_payment"],
                                          bank_account=payment["account"],
                                          bank_amount=payment["bank_amount"],
                                          reference_no=reference_no
                                        )
        payment_doc = frappe.get_doc(payment_entry)
        payment_doc.set_amounts()
        payment_doc.flags.ignore_permissions=True
        payment_doc.references = []
        payment_doc.save()
        payment_doc.title += " (إرجاع للزبون)"
        payment_doc.save()
        payment_doc.submit()

    return return_invoice

@frappe.whitelist()
def return_as_points(source_name, target_doc=None):
    # do unlink payments
    from erpnext.accounts.doctype.unreconcile_payment.unreconcile_payment import get_linked_payments_for_doc
    from erpnext.accounts.doctype.unreconcile_payment.unreconcile_payment import create_unreconcile_doc_for_selection
    from erpnext.controllers.sales_and_purchase_return import make_return_doc
    
    sales_doc = frappe.get_doc("Sales Invoice", source_name)
    linked_payments = get_linked_payments_for_doc(company=sales_doc.company, 
                                                  doctype=sales_doc.doctype,
                                                  docname=source_name)
    selection_map = []
    for payment in linked_payments:
        if payment.voucher_type == "Payment Entry":
            selection_map.append({
                'company': payment.company,
                'voucher_type': payment.voucher_type,
                'voucher_no': payment.voucher_no,
                'against_voucher_type': sales_doc.doctype,
                'against_voucher_no': sales_doc.name
            })

    return_invoice = make_return_doc("Sales Invoice", source_name, target_doc)
    return_invoice.is_pos = 0
    return_invoice.update_stock = 0
    return_invoice.update_outstanding_for_self = 0
    return_invoice.save()
    return_invoice.submit()

    if len(selection_map) > 0:
        create_unreconcile_doc_for_selection(selections=json.dumps(selection_map))
    frappe.db.set_value("Sales Invoice", source_name, "rent_status", "رصيد")
    frappe.db.commit()

@frappe.whitelist()
def unlink_payments(invoice_name, company, doctype):
    from erpnext.accounts.doctype.unreconcile_payment.unreconcile_payment import get_linked_payments_for_doc
    from erpnext.accounts.doctype.unreconcile_payment.unreconcile_payment import create_unreconcile_doc_for_selection

    linked_payments = get_linked_payments_for_doc(company=company, 
                                                  doctype=doctype,
                                                  docname=invoice_name)
    selection_map = []
    for payment in linked_payments:
        if payment.voucher_type == "Payment Entry":
            selection_map.append({
                'company': payment.company,
                'voucher_type': payment.voucher_type,
                'voucher_no': payment.voucher_no,
                'against_voucher_type': doctype,
                'against_voucher_no': invoice_name
            })
    if len(selection_map) > 0:
        create_unreconcile_doc_for_selection(selections=json.dumps(selection_map))

    
@frappe.whitelist()
def change_rent(new_inv_id, source_name, target_doc=None):
    from erpnext.controllers.sales_and_purchase_return import make_return_doc
    return_invoice = make_return_doc("Sales Invoice", source_name, target_doc)
    return_invoice.change_invoice = new_inv_id
    return_invoice.rent_status = "استبدال"
    return_invoice.is_pos = 0
    return_invoice.update_stock = 0
    return_invoice.update_outstanding_for_self = 0
    return_invoice.save()
    return_invoice.submit()

    frappe.db.set_value("Sales Invoice", source_name, "rent_status", "استبدال")
    frappe.db.set_value("Sales Invoice", source_name, "change_invoice", new_inv_id)
    frappe.db.commit()

    # TO-DO: unlink payments from old
    # then link to new invoice

@frappe.whitelist()
def get_items(start, page_length, price_list, 
              item_group, pos_profile, search_term="", 
              no_rented=0, before_date="", after_date=""):
    
    warehouse, hide_unavailable_items = frappe.db.get_value(
        "POS Profile", pos_profile, ["warehouse", "hide_unavailable_items"]
    )

    result = []

    if search_term:
        result = search_by_term(search_term, warehouse, price_list) or []
        if result:
            return result
    
    if not frappe.db.exists("Item Group", item_group):
        item_group = get_root_of("Item Group")
    lft, rgt = frappe.db.get_value("Item Group", item_group, ["lft", "rgt"])
    related_grps = frappe.get_list("Item Group", 
                                   filters={"lft": [">=", lft], "rgt":["<=", rgt]},
                                   pluck="name")
    profile_allowed_grps = get_item_groups(pos_profile)

    items_doc = DocType("Item")
    bin_doc = DocType("Bin")
    
    query = (frappe.qb
        .from_(items_doc)
        .select((items_doc.name).as_("item_code"), 
                items_doc.item_name, 
                items_doc.description,
                items_doc.stock_uom,
                items_doc.is_stock_item,
                (items_doc.image).as_("item_image"))
        .where(items_doc.disabled == 0)
        .where(items_doc.has_variants == 0)
        .where(items_doc.is_sales_item == 1)
        .where(items_doc.is_fixed_asset == 0)
        .where((items_doc.item_group).isin(related_grps))
        .orderby(items_doc.name)
    )
    if int(no_rented) == 1 :
        rented = get_available_products(pos_profile, before_date, after_date)
        if rented: query = query.where((items_doc.name).notin(rented))

    if hide_unavailable_items:
        query = (query.from_(bin_doc)
                 .where(bin_doc.warehouse == warehouse)
                 .where(bin_doc.item_code == items_doc.name)
                 .where(bin_doc.actual_qty > 0))
    
    if search_term:
        or_conds = [items_doc.name.like(f"%{search_term}%"),
                    items_doc.item_name.like(f"%{search_term}%")]
        search_fields = frappe.get_all("POS Search Fields", fields=["fieldname"])
        for field in search_fields:
            or_conds.append(items_doc.field.like(f"%{field}%"))
        query = query.where((Criterion.any(or_conds)))
    
    if profile_allowed_grps:
        query = query.where((items_doc.item_group).isin(profile_allowed_grps))

    query = query.limit("{page_length} offset {start}".format(
            start=cint(start),
            page_length=cint(page_length)))
    
    items_data = query.run(as_dict=1)

    if items_data:
        items = [d.item_code for d in items_data]
        
        item_prices_data = frappe.get_all(
            "Item Price",
            fields=["item_code", "price_list_rate", "currency"],
            filters={"price_list": price_list, "item_code": ["in", items]},
        )

        item_prices = {}
        for d in item_prices_data:
            item_prices[d.item_code] = d

        for item in items_data:
            item_code = item.item_code
            item_price = item_prices.get(item_code) or {}
            item_stock_qty, is_stock_item = get_stock_availability(item_code, warehouse)

            row = {}
            row.update(item)
            row.update(
                {
                    "price_list_rate": item_price.get("price_list_rate"),
                    "currency": item_price.get("currency"),
                    "actual_qty": item_stock_qty,
                }
            )
            result.append(row)
            
    return {"items": result}