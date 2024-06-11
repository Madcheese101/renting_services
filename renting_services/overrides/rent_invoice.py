import json
import frappe
from functools import reduce
from frappe import _, scrub
from frappe.utils import flt, getdate, nowdate
from erpnext.controllers.sales_and_purchase_return import make_return_doc

from erpnext.accounts.doctype.bank_account.bank_account import (
	get_party_bank_account,
)

from erpnext.accounts.doctype.sales_invoice.sales_invoice import (SalesInvoice, get_mode_of_payments_info, update_multi_mode_option)
from erpnext.accounts.doctype.payment_entry.payment_entry import (
	set_party_type,
	set_party_account,
	set_party_account_currency,
	set_payment_type,
	set_grand_total_and_outstanding_amount,
	get_bank_cash_account,
	apply_early_payment_discount,
	update_accounting_dimensions,
    split_early_payment_discount_loss,
    set_pending_discount_loss,
	get_reference_as_per_payment_terms
)

class RentInvoice(SalesInvoice):    
    
	@frappe.whitelist()
	def recieve_and_clean(self, user=None, notes=None):
		doc = frappe.new_doc("Cleaning")
		doc.invoice_id = self.name
		doc.employee = user
		if user:
			doc.employee = user
			doc.status = "قيد التنظيف"
			doc.accept_date = nowdate()
		
		total_qty = 0
		for item in self.get("items"):
			doc.append("items", {
				"item_code": item.item_code,
				"qty": item.qty
			})
			total_qty += item.qty
		doc.total_qty = total_qty
		doc.notes = str(notes) if notes else ''
		doc.flags.ignore_mandatory = True
		doc.flags.ignore_permissions=True
		doc.save()
		doc.submit()

		self.db_set('rent_status', 'نظافة')

	@frappe.whitelist()
	def insert_payment(self, pdoc):
		docs = pdoc
		for doc in docs:
			_doc = frappe.get_doc(doc)
			_doc.set_amounts()
			_doc.docstatus = 1
			_doc.insert(ignore_permissions=True)

		status = self.rent_status
		# grand_total = self.grand_total
		# outstanding = self.outstanding_amount
		if status == "غير مؤكد":
			self.db_set('rent_status', 'محجوز')
		if status == "جاهز" and self.outstanding_amount == 0:
			self.db_set('rent_status', 'مكتمل')

	@frappe.whitelist()
	def get_mode_of_payments(self):
		pos = frappe.get_doc("POS Profile", self.pos_profile)
		mode_of_payments = [d.mode_of_payment for d in pos.get("payments")]
		mode_of_payments_info = get_mode_of_payments_info(mode_of_payments, self.company)
		modes = []
		for key, value in mode_of_payments_info.items():
			modes.append({"mode_of_payment": key, 
					"account": value.default_account, 
					"type": value.type, "base_amount": 0})
			
		return modes or "nothing"
	
	@frappe.whitelist()
	def reset_mode_of_payments(self):
		if self.pos_profile:
			pos_profile = frappe.get_cached_doc("POS Profile", self.pos_profile)
			update_multi_mode_option(self, pos_profile)
			self.paid_amount = 0
	
	@frappe.whitelist()
	def unlink_payments(self):
		from erpnext.accounts.doctype.unreconcile_payment.unreconcile_payment import get_linked_payments_for_doc
		from erpnext.accounts.doctype.unreconcile_payment.unreconcile_payment import create_unreconcile_doc_for_selection

		linked_payments = get_linked_payments_for_doc(company=self.company, 
													doctype=self.doctype,
													docname=self.original_invoice)
		selection_map = []
		for payment in linked_payments:
			if payment.voucher_type == "Payment Entry":
				selection_map.append({
					'company': payment.company,
					'voucher_type': payment.voucher_type,
					'voucher_no': payment.voucher_no,
					'against_voucher_type': self.doctype,
					'against_voucher_no': self.original_invoice
				})
		if len(selection_map) > 0:
			create_unreconcile_doc_for_selection(selections=json.dumps(selection_map))
	
	@frappe.whitelist()
	def change_rent(self, payments):
		if self.original_invoice:
			return_invoice = make_return_doc("Sales Invoice", self.original_invoice, None)
			return_invoice.change_invoice = self.name
			return_invoice.rent_status = "استبدال"
			return_invoice.is_pos = 0
			return_invoice.update_stock = 0
			return_invoice.update_outstanding_for_self = 0
			return_invoice.save()
			return_invoice.submit()

			frappe.db.set_value("Sales Invoice", self.original_invoice, "rent_status", "استبدال")
			frappe.db.set_value("Sales Invoice", self.original_invoice, "change_invoice", self.name)
			frappe.db.commit()

			for payment in payments:
				reference_no = ""
				if (payment["type"] == "Bank"):
					reference_no = f'{return_invoice.name} - {frappe.datetime.nowdate()}'
				payment_entry = get_payment_entry(dt= return_invoice.doctype, 
												dn=return_invoice.name,
												party_type="Customer",
												mode_of_payment=payment["mode_of_payment"],
												bank_account=payment["account"],
												bank_amount=payment["bank_amount"],
												reference_no=reference_no,
												payment_type="Pay"
												)
				payment_doc = frappe.get_doc(payment_entry)
				payment_doc.set_amounts()
				payment_doc.flags.ignore_permissions=True
				payment_doc.references = []
				payment_doc.save()
				payment_doc.title += " (إرجاع للزبون)"
				payment_doc.save()
				payment_doc.submit()

@frappe.whitelist()
def get_payment_entry(
	dt,
	dn,
	party_amount=None,
	bank_account=None,
	bank_amount=None,
	party_type=None,
	payment_type=None,
	reference_date=None,
	reference_no=None,
	mode_of_payment=None
):
	# eval:(doc.paid_from_account_type == 'Bank' || doc.paid_to_account_type == 'Bank')
	doc = frappe.get_doc(dt, dn)
	over_billing_allowance = frappe.db.get_single_value("Accounts Settings", "over_billing_allowance")
	if dt in ("Sales Order", "Purchase Order") and flt(doc.per_billed, 2) >= (
		100.0 + over_billing_allowance
	):
		frappe.throw(_("Can only make payment against unbilled {0}").format(_(dt)))

	if not party_type:
		party_type = set_party_type(dt)

	party_account = set_party_account(dt, dn, doc, party_type)
	party_account_currency = set_party_account_currency(dt, party_account, doc)

	if not payment_type:
		payment_type = set_payment_type(dt, doc)

	grand_total, outstanding_amount = set_grand_total_and_outstanding_amount(
		party_amount, dt, party_account_currency, doc
	)

	# bank or cash
	bank = get_bank_cash_account(doc, bank_account)

	# if default bank or cash account is not set in company master and party has default company bank account, fetch it
	if party_type in ["Customer", "Supplier"] and not bank:
		party_bank_account = get_party_bank_account(party_type, doc.get(scrub(party_type)))
		if party_bank_account:
			account = frappe.db.get_value("Bank Account", party_bank_account, "account")
			bank = get_bank_cash_account(doc, account)

	paid_amount, received_amount = set_paid_amount_and_received_amount(
		dt, party_account_currency, bank, outstanding_amount, payment_type, bank_amount, doc
	)

	reference_date = getdate(reference_date)
	paid_amount, received_amount, discount_amount, valid_discounts = apply_early_payment_discount(
		paid_amount, received_amount, doc, party_account_currency, reference_date
	)

	pe = frappe.new_doc("Payment Entry")
	pe.payment_type = payment_type
	pe.mode_of_payment = mode_of_payment
	pe.company = doc.company
	pe.cost_center = doc.get("cost_center")
	pe.posting_date = nowdate()
	pe.reference_date = reference_date
	pe.reference_no = reference_no
	pe.party_type = party_type
	pe.party = doc.get(scrub(party_type))
	pe.contact_person = doc.get("contact_person")
	pe.contact_email = doc.get("contact_email")
	pe.ensure_supplier_is_not_blocked()

	pe.paid_from = party_account if payment_type == "Receive" else bank.account
	pe.paid_to = party_account if payment_type == "Pay" else bank.account
	pe.paid_from_account_currency = (
		party_account_currency if payment_type == "Receive" else bank.account_currency
	)
	pe.paid_to_account_currency = (
		party_account_currency if payment_type == "Pay" else bank.account_currency
	)
	pe.paid_amount = paid_amount
	pe.received_amount = received_amount
	pe.letter_head = doc.get("letter_head")

	if dt in ["Purchase Order", "Sales Order", "Sales Invoice", "Purchase Invoice"]:
		pe.project = doc.get("project") or reduce(
			lambda prev, cur: prev or cur, [x.get("project") for x in doc.get("items")], None
		)  # get first non-empty project from items

	if pe.party_type in ["Customer", "Supplier"]:
		bank_account = get_party_bank_account(pe.party_type, pe.party)
		pe.set("bank_account", bank_account)
		pe.set_bank_account_data()

	# only Purchase Invoice can be blocked individually
	if doc.doctype == "Purchase Invoice" and doc.invoice_is_blocked():
		frappe.msgprint(_("{0} is on hold till {1}").format(doc.name, doc.release_date))
	else:
		if doc.doctype in (
			"Sales Invoice",
			"Purchase Invoice",
			"Purchase Order",
			"Sales Order",
		) and frappe.get_cached_value(
			"Payment Terms Template",
			{"name": doc.payment_terms_template},
			"allocate_payment_based_on_payment_terms",
		):

			for reference in get_reference_as_per_payment_terms(
				doc.payment_schedule, dt, dn, doc, grand_total, outstanding_amount, party_account_currency
			):
				pe.append("references", reference)
		else:
			if dt == "Dunning":
				pe.append(
					"references",
					{
						"reference_doctype": "Sales Invoice",
						"reference_name": doc.get("sales_invoice"),
						"bill_no": doc.get("bill_no"),
						"due_date": doc.get("due_date"),
						"total_amount": doc.get("outstanding_amount"),
						"outstanding_amount": doc.get("outstanding_amount"),
						"allocated_amount": doc.get("outstanding_amount"),
					},
				)
				pe.append(
					"references",
					{
						"reference_doctype": dt,
						"reference_name": dn,
						"bill_no": doc.get("bill_no"),
						"due_date": doc.get("due_date"),
						"total_amount": doc.get("dunning_amount"),
						"outstanding_amount": doc.get("dunning_amount"),
						"allocated_amount": doc.get("dunning_amount"),
					},
				)
			else:
				pe.append(
					"references",
					{
						"reference_doctype": dt,
						"reference_name": dn,
						"bill_no": doc.get("bill_no"),
						"due_date": doc.get("due_date"),
						"total_amount": grand_total,
						"outstanding_amount": outstanding_amount,
						"allocated_amount": bank_amount,
					},
				)

	pe.setup_party_account_field()
	pe.set_missing_values()
	pe.set_missing_ref_details()
	pe.set_amounts()
	update_accounting_dimensions(pe, doc)

	if party_account and bank:
		pe.set_exchange_rate(ref_doc=doc)
		pe.set_amounts()

		if discount_amount:
			base_total_discount_loss = 0
			if frappe.db.get_single_value("Accounts Settings", "book_tax_discount_loss"):
				base_total_discount_loss = split_early_payment_discount_loss(pe, doc, valid_discounts)

			set_pending_discount_loss(
				pe, doc, discount_amount, base_total_discount_loss, party_account_currency
			)

		pe.set_difference_amount()

	return pe

def set_paid_amount_and_received_amount(
	dt, party_account_currency, bank, outstanding_amount, payment_type, bank_amount, doc
):
	paid_amount = received_amount = 0
	if party_account_currency == bank.account_currency:
		paid_amount = received_amount = abs(flt(bank_amount))
	else:
		company_currency = frappe.get_cached_value("Company", doc.get("company"), "default_currency")
		if payment_type == "Receive":
			paid_amount = abs(flt(bank_amount))
			if bank_amount:
				received_amount = bank_amount
			else:
				if bank and company_currency != bank.account_currency:
					received_amount = paid_amount / doc.get("conversion_rate", 1)
				else:
					received_amount = paid_amount * doc.get("conversion_rate", 1)
		else:
			received_amount = abs(outstanding_amount)
			if bank_amount:
				paid_amount = bank_amount
			else:
				if bank and company_currency != bank.account_currency:
					paid_amount = received_amount / doc.get("conversion_rate", 1)
				else:
					# if party account currency and bank currency is different then populate paid amount as well
					paid_amount = received_amount * doc.get("conversion_rate", 1)

	return paid_amount, received_amount
