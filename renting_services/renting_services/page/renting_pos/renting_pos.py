import json
import frappe
from frappe import _
from pypika import Criterion
from frappe.query_builder import DocType

from erpnext.stock.utils import scan_barcode
from frappe.utils import get_fullname, cint, flt, add_to_date
from frappe.utils.nestedset import get_root_of
from erpnext.accounts.utils import get_balance_on

from erpnext.selling.page.point_of_sale.point_of_sale import get_pos_profile_data, search_by_term

from erpnext.accounts.party import get_dashboard_info
from erpnext.accounts.doctype.pos_invoice.pos_invoice import get_stock_availability
from erpnext.accounts.doctype.pos_profile.pos_profile import get_item_groups
from erpnext.accounts.doctype.payment_entry.payment_entry import get_company_defaults

@frappe.whitelist()
def get_pos_profile():
    profileslist = frappe.db.get_list("POS Profile", filters={"disabled": 0},pluck="name")

    if profileslist:
        return get_pos_profile_data(profileslist[0])
    
@frappe.whitelist()
def check_availability(before_date, after_date, item_code):
    items_doc = DocType("Sales Invoice Item")
    sales_doc = DocType("Sales Invoice")
    serials = frappe.get_all("Serial No", filters={"item_code": item_code}, pluck="name")
    final_result = []
    db_result = (
    frappe.qb
        .from_(sales_doc)
        .from_(items_doc)
        .select(
            sales_doc.name, 
            sales_doc.delivery_date, 
            sales_doc.return_date, 
            items_doc.item_name,
            items_doc.serial_no
        )
        .where(items_doc.parent == sales_doc.name)
        .where(items_doc.item_code == item_code)
        .where(sales_doc.docstatus == 1)
        .where(sales_doc.delivery_date[before_date:after_date])
        # .where(sales_doc.paid_amount > 0)
    ).run(as_dict=True)

    if serials:
        db_result_dict = {i["serial_no"]: i for i in db_result}
        for serial in serials:
            if serial in db_result_dict.keys():
                db_result_dict[serial]["avialable_status"] = False
                db_result_dict[serial]["add_to_cart"] = None
                db_result_dict[serial]["before_date"] = add_to_date(db_result_dict[serial]["delivery_date"], days=-1)
                final_result.append(db_result_dict[serial])
            else:
                final_result.append({"serial_no": serial,"add_to_cart":serial, "avialable_status": True})
    elif db_result:
        temp_dic = {**db_result[0], 
                    "avialable_status": False, 
                    "before_date": add_to_date(db_result[0]["delivery_date"], days=-1),
                    "add_to_cart": None}
        final_result.append(temp_dic)
    else:
        final_result.append({"avialable_status": True, "add_to_cart": item_code})
    
    return final_result

@frappe.whitelist()
def validate_availability(before_date, after_date,serials):
    serial_nos = json.loads(serials)
    sales_items_doc = DocType("Sales Invoice Item")
    sales_doc = DocType("Sales Invoice")
    query = (
        frappe.qb
            .from_(sales_doc)
            .from_(sales_items_doc)
            .select(
                sales_doc.name, 
                sales_doc.delivery_date,
                sales_doc.return_date, 
                sales_items_doc.item_name,
                sales_items_doc.serial_no
            )
            .where(sales_items_doc.parent == sales_doc.name)
            .where(sales_doc.docstatus == 1)
            .where(sales_items_doc.serial_no.isin(serial_nos))
            # .where(sales_doc.paid_amount > 0)
            .where(sales_doc.delivery_date[before_date:after_date])
    )
    result = query.run(as_dict=True)
    return result

@frappe.whitelist()
def get_available_products(pos_profile, before_date, after_date):
    items_doc = DocType("Sales Invoice Item")
    sales_doc = DocType("Sales Invoice")
    no_serial_items = (
        frappe.qb
            .from_(items_doc)
            .from_(sales_doc)
            .select(items_doc.item_code)
            .where(items_doc.parent == sales_doc.name)
            .where(sales_doc.docstatus == 1)
            .where(sales_doc.pos_profile == pos_profile)
            .where(sales_doc.rent_status != "غير مؤكد")
            .where(items_doc.use_serial_batch_fields == 0)
            .where(sales_doc.delivery_date[before_date:after_date])
    ).run(pluck="item_code")

    serial_items = (
        frappe.qb
            .from_(items_doc)
            .from_(sales_doc)
            .select(items_doc.serial_no)
            .where(items_doc.parent == sales_doc.name)
            .where(sales_doc.docstatus == 1)
            .where(sales_doc.pos_profile == pos_profile)
            .where(sales_doc.rent_status != "غير مؤكد")
            .where(items_doc.serial_no != "")
            .where(sales_doc.delivery_date[before_date:after_date])
    ).run(pluck="serial_no")
    return no_serial_items, serial_items

@frappe.whitelist()
def get_past_order_list(search_term, pos_profile, limit=50):
    fields = ["name", 
              "grand_total", 
              "currency", 
              "customer", 
              "posting_time", 
              "posting_date"]
    
    or_filters = {"name": ["like", "%{}%".format(search_term)],
                  "customer": ["like", "%{}%".format(search_term)]}
    invoice_list = []
    
    if search_term:
        invoices_by_name = frappe.db.get_all(
            "Sales Invoice",
            filters={"pos_profile":pos_profile},
            or_filters=or_filters,
            fields=fields,limit=limit
        )

        invoice_list = invoices_by_name
    else:
        invoice_list = frappe.db.get_all("Sales Invoice", 
                                        filters={"status": "Draft", 
                                                 "pos_profile":pos_profile}, 
                                        fields=fields, limit=limit)

    return invoice_list

@frappe.whitelist()
def get_customers_list(search_term, limit=50):
    fields = ["name", 
              "customer_name", 
              "mobile_no"]
    
    name_filter = {"customer_name": ["like", "%{}%".format(search_term)]}
    mobile_filter = {"mobile_no": ["like", "%{}%".format(search_term)]}
        
    customer_list = []
    
    if search_term:
        customers_by_name = frappe.db.get_all(
            "Customer",
            filters=name_filter,
            fields=fields,limit=limit
        )
        customers_by_mobile = frappe.db.get_all(
            "Customer",
            filters=mobile_filter,
            fields=fields,limit=limit
        )

        customer_list = customers_by_name + customers_by_mobile
    else:
        customer_list = frappe.db.get_all("Customer",
                                    fields=fields, limit=limit)

    return customer_list

@frappe.whitelist()
def load_customer_dashboard_info(docname, loyalty_program):
    return get_dashboard_info("Customer", docname, loyalty_program)

@frappe.whitelist()
def get_customer_invoices(customer):
    fields = ["posting_date",
              "name",
              "grand_total",
              "(grand_total - outstanding_amount) as paid_amount",
              "status",
              "rent_status",
              "name as name_to_print"]
    filters = {"customer":customer}
    return frappe.get_all("Sales Invoice", fields=fields, filters=filters) or []
    
@frappe.whitelist()
def get_customer_unlinked_payments(customer, payments):
    payments = json.loads(payments)
    fields = ["name",
            "paid_amount",
            "mode_of_payment",
            "posting_date",
            "name as name_to_print"]
    filters = {"party":customer,
            "payment_type": "Receive",
            "total_allocated_amount": 0,
        #    "mode_of_payment":["in", payments],
            "docstatus": 1}
    return frappe.get_all("Payment Entry", fields=fields, filters=filters) or []

@frappe.whitelist()
def get_customer_linked_payments(customer, payments):
    payments = json.loads(payments)
    result = []
    fields = ["name",
              "paid_amount",
              "total_allocated_amount",
              "mode_of_payment",
              "posting_date",
              "name as name_to_print",
              "(0) as indent"]
    filters = {"party":customer,
               "payment_type": "Receive",
               "total_allocated_amount": ["!=", 0],
            #    "mode_of_payment":["in", payments],
               "docstatus": 1}
    
    payments = frappe.get_all("Payment Entry", fields=fields, filters=filters)

    for payment in payments:
        payment["remaining_amount"] = payment.paid_amount - payment.total_allocated_amount
        result.append(payment)
        invoices = frappe.get_all("Payment Entry Reference",
                                  fields=[
                                      "reference_name as name",
                                    #   "total_amount as inv_amount",
                                    #   "outstanding_amount",
                                    #   "allocated_amount",
                                      "(1) as indent"
                                  ],
                                  filters={"parent":payment.name})
        result.extend(invoices)
        
    return  result or []

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
    completed_payments = []
    payments_ = json.loads(payments)
    return_invoice = make_return_doc("Sales Invoice", source_name, target_doc)
    return_invoice.is_pos = 0
    return_invoice.update_stock = 0
    return_invoice.update_outstanding_for_self = 0
    return_invoice.advances = []
    return_invoice.rent_status = ""
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
        payment_doc.reference_no = return_invoice.name
        payment_doc.save()
        payment_doc.title += " (إرجاع للزبون)"
        payment_doc.save()
        payment_doc.submit()
        completed_payments.append(payment_doc.name)
    return completed_payments

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
    serial_items = []

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
                items_doc.has_serial_no,
                (items_doc.image).as_("item_image"))
        .where(items_doc.disabled == 0)
        .where(items_doc.has_variants == 0)
        .where(items_doc.is_sales_item == 1)
        .where(items_doc.is_fixed_asset == 0)
        .where((items_doc.item_group).isin(related_grps))
        .orderby(items_doc.name)
    )
    if int(no_rented) == 1 :
        no_serial_items, serial_items = get_available_products(pos_profile, before_date, after_date)
        if no_serial_items: query = query.where((items_doc.name).notin(no_serial_items))

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

        item_prices = {d.item_code: d for d in item_prices_data}
            
        for item in items_data:
            item_code = item.item_code
            has_serial_no = item.has_serial_no

            if serial_items and has_serial_no:
                available_serials = frappe.get_all("Serial No", 
                                                filters={
                                                    "item_code": item_code,
                                                    "serial_no": ["not in", serial_items]},
                                                    pluck="serial_no")
                if not available_serials:
                    continue

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

@frappe.whitelist()
def get_accounts_balances(mode_of_payments, date, company):
    mode_of_payments = json.loads(mode_of_payments)
    result = []

    for mode_of_payment in mode_of_payments:
        account, middleman_account = frappe.get_value("Mode of Payment Account",{
                                     "parent": mode_of_payment,
                                     "company": company
                                    }, ["default_account", "middleman_account"])
        account_balance = get_balance_on(account, date, ignore_account_permission=True) or 0
        row = {"mode_of_payment": mode_of_payment,
               "company": company,
               "from_account": account,
               "to_account": middleman_account,
               "account_balance": account_balance, 
               "date": date,
               "paid_amount":0,
               "diff_amount":0,}
        result.append(row)
    return result

@frappe.whitelist()
def transfer_accounts_balance(data, cost_center=None):
    data = json.loads(data)
    docs = []
    for payment in data:
        # skip this iteration if 
        # paid amount == 0
        if payment["paid_amount"] == 0:
            continue
        
        if not payment["to_account"]:
            frappe.msgprint("حساب الوسيط غير معد لطريقة الدفع: {0}".format(payment["mode_of_payment"]))
            continue

        payment_mode_type = frappe.get_value("Mode of Payment",{
                                     "name": payment["mode_of_payment"]
                                    }, ["type"])
        
        payment_doc = frappe.new_doc("Payment Entry")
        payment_doc.payment_type = "Internal Transfer"
        payment_doc.mode_of_payment = payment["mode_of_payment"]
        payment_doc.posting_date = payment["date"]
        payment_doc.company = payment["company"]
        payment_doc.paid_from = payment["from_account"]
        payment_doc.paid_to = payment["to_account"]
        payment_doc.paid_amount = payment["account_balance"]
        payment_doc.received_amount = payment["paid_amount"]
        payment_doc.cost_center = cost_center
        
        payment_doc.set_missing_values()
        payment_doc.set_amounts()
        payment_doc.set_exchange_rate()
        if payment_mode_type == "Bank":
            payment_doc.reference_date = payment["date"]
            payment_doc.reference_no= f"{payment_doc.reference_date} - {payment_doc.mode_of_payment}"

        payment_doc.insert()

        if payment_doc.difference_amount != 0:
            company_defaults = get_company_defaults(payment["company"])
            write_off_row = [t for t in payment_doc.get("deductions", []) 
                             if t.get("account") == company_defaults.get("exchange_gain_loss_account")]
            row = None
            if not write_off_row and payment_doc.difference_amount:
                row = payment_doc.append("deductions")
                row.account = company_defaults.get("exchange_gain_loss_account")
                row.cost_center = cost_center or company_defaults.get("cost_center")
            else:
                row = write_off_row[0]

            if row:
                row.amount = flt(row.amount) + flt(payment_doc.difference_amount)
            else:
                frappe.msgprint(_("No gain or loss in the exchange rate"))
            payment_doc.save()
        
        payment_doc.submit()
        frappe.msgprint("تم ادخال إيصال تحويل لخزينة الوسيط لطريقة الدفع: {0}".format(payment["mode_of_payment"]))

    return docs

@frappe.whitelist()
def get_transfer_payments(mode_of_payments, date):
    mode_of_payments = json.loads(mode_of_payments)

    fields = ["name", 
            "mode_of_payment", 
            "posting_date",
            "paid_amount", 
            "received_amount", 
            "(paid_amount - received_amount) as diff_amount"]
    
    fitlers = {"mode_of_payment": ["in", mode_of_payments],
            "posting_date": date,
            "docstatus": 1}
    
    return frappe.get_all("Payment Entry", fields=fields, filters=fitlers)
@frappe.whitelist()
def get_close_day_report_data(mode_of_payments, date):

	payment_modes = json.loads(mode_of_payments)
	data = []
	# loop through mode of payments and add them to the result list as heads
	for payment in payment_modes:
		head = frappe.db.get_list('Payment Entry',
			fields=['mode_of_payment',
				'(sum(paid_amount)) as paid_amount',
				'(sum(received_amount)) as received_amount', 
				('(sum(received_amount)-sum(paid_amount)) as diff_amount'),
				'(0) as indent', '(1) as has_value'],		
			filters={
				'status':"Submitted",
				'mode_of_payment':payment,
				'posting_date':["between", (date,date)],
				"payment_type": "Internal Transfer"}
			,order_by='posting_date desc'
			,group_by="mode_of_payment")
		if(head):
			data.extend(head)
		else:
			data.append({'mode_of_payment': payment,"paid_amount":0,"received_amount":0
		,"diff_amount":0,'indent':0, 'has_value': True})


		# get the data for each mode of payment
		node_data = frappe.db.get_list('Payment Entry',
			fields=[
                'mode_of_payment',
                'name',
                'paid_from_account_balance',
                'paid_amount',
                'received_amount', 
                ('(received_amount-paid_amount) as diff_amount'),
                'posting_date', 
                '(1) as indent', 
                '(0) as has_value'
            ],		
			filters={
                'status':"Submitted",
                'mode_of_payment':payment,
                'posting_date':["between", (date,date)],
                "payment_type": "Internal Transfer"
            }
			,order_by='posting_date desc')

		data.extend(node_data)

	#return data list
	return data
