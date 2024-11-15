# Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from erpnext.accounts.utils import get_balance_on
from frappe.model.meta import get_field_currency
from frappe.utils import (
	cint,
	cstr,
	fmt_money,
)

def execute(filters=None):
	
	userBranch = None
	# get current user branch
	if(frappe.session.user != "Administrator"):
		userBranch = frappe.db.get_value("Employee", {'user_id':frappe.session.user}, ["branch"])
	report_summary, message = [],[]
	columns = get_columns()
	data = get_data(filters)
	
	if userBranch:
		report_summary = get_report_summary(filters, userBranch)
		message = [
			"<b>"+" الرصيد المتبقي في الخزائن (بعد التحويل) إلى يوم <span style='color:Red;'>"+filters.get("to_date")+"</span></b>"
		]
	return columns, data, message, None, report_summary
@frappe.whitelist()
def get_data(filters):

	payment_modes = []
	data = []
	payment_modes = frappe.db.get_list('Mode of Payment', pluck='name', order_by='name desc')
	# loop through mode of payments and add them to the result list as heads
	for payment in payment_modes:
		head = frappe.db.get_list('Payment Entry',
			fields=['mode_of_payment',
				'(sum(base_paid_amount)) as base_paid_amount',
				'(sum(received_amount)) as received_amount', 
				('(sum(received_amount)-sum(base_paid_amount)) as diff'),
				'(0) as indent', '(1) as has_value'],		
			filters={
				'status':"Submitted",
				'mode_of_payment':payment,
				'posting_date':["between", (filters.get("from_date"),filters.get("to_date"))],
				"payment_type": "Internal Transfer"}
			,order_by='posting_date desc'
			,group_by="mode_of_payment")
		if(head):
			data.extend(head)
		else:
			data.append({'mode_of_payment': payment,"base_paid_amount":0,"received_amount":0
		,"diff":0,'indent':0, 'has_value': True})


		# get the data for each mode of payment
		node_data = frappe.db.get_list('Payment Entry',
			fields=['mode_of_payment',
		   'name',
		   'paid_from_account_balance',
		   'base_paid_amount',
		   'received_amount', 
		   ('(received_amount-base_paid_amount) as diff'),
			'posting_date', 
			'(1) as indent', 
			'(0) as has_value'],		
			filters={
			'status':"Submitted",
			'mode_of_payment':payment,
			'posting_date':["between", (filters.get("from_date"),filters.get("to_date"))],
			"payment_type": "Internal Transfer"}
			,order_by='posting_date desc')

		data.extend(node_data)

	#return data list
	return data

def get_report_summary(filters, userBranch):
	accounts = frappe.db.get_list('Account', fields=['name', 'account_name'],filters={'parent_account':["like",f"%{userBranch}%"]}, order_by='name desc')
	report_summary = []
	# todate = filters.get("to_date") ? :
	if(accounts):
		for account in accounts:
			balance = get_balance_on(account.name,filters.get("to_date"), ignore_account_permission=True)
			account_name = ((account.account_name).replace("محل", "")).strip()
			
			color = "blue"

			if "بطاقة" in account.account_name:
				color = "blue"
			elif "نقد" in account.account_name:
				color = "green"
			elif "صك" in account.account_name:
				color = "red"

			report_summary.append({"label":account_name,"value":format_value(balance, {"fieldtype":"Currency"}),"indicator":color},)
		return report_summary
	
	else: return None

	
def format_value(value, df=None, doc=None, currency=None, translated=False, format=None):
	"""Format value based on given fieldtype, document reference, currency reference.
	If docfield info (df) is not given, it will try and guess based on the datatype of the value"""
	if isinstance(df, str):
		df = frappe._dict(fieldtype=df)

	if not df:
		df = frappe._dict()
		if isinstance(value, int):
			df.fieldtype = "Int"
		elif isinstance(value, float):
			df.fieldtype = "Float"
		else:
			df.fieldtype = "Data"
	elif isinstance(df, dict):
		# Convert dict to object if necessary
		df = frappe._dict(df)

	if value is None:
		value = ""
	elif translated:
		value = frappe._(value)

	if not df:
		return value
	elif (
		value == 0
		and df.get("fieldtype") in ("Int", "Float", "Currency", "Percent")
		and df.get("print_hide_if_no_value")
	):
		# this is required to show 0 as blank in table columns
		return ""
	elif df.get("fieldtype") == "Currency":
		default_currency = frappe.db.get_default("currency")
		currency = currency or get_field_currency(df, doc) or default_currency
		return fmt_money(value, precision=2, currency=currency, format=format)
	elif df.get("fieldtype") == "Float":
		precision = 2
		# I don't know why we support currency option for float
		currency = currency or get_field_currency(df, doc)

		# show 1.000000 as 1
		# options should not specified
		if not df.options and value is not None:
			temp = cstr(value).split(".")
			if len(temp) == 1 or cint(temp[1]) == 0:
				precision = 0

		return fmt_money(value, precision=precision, currency=currency)
	return value


def get_columns():

	return [
		# Mode of payment
		{
			"fieldname": "mode_of_payment",
			"label": _("طريقة الدفع"),
			"fieldtype": "Data",
			# "options": "Mode of Payment",
			"width": 130
		}
		,
		{
			"fieldname": "posting_date",
			"label": _("التاريخ"),
			"fieldtype": "Data",
			"width": 100
		}
		,
		# name
		{
			"fieldname": "name",
			"label": _("الرقم الإشاري"),
			"fieldtype": "Data",
			"width": 150
		}
		,
		{
			"fieldname": "paid_from_account_balance",
			"label": _("رصيد الحساب"),
			"fieldtype": "Float",
			"width": 100,
			"precision": 2
		}
		,
		{
			"fieldname": "base_paid_amount",
			"label": _("الحساب"),
			"fieldtype": "Float",
			"width": 100,
			"precision": 2
		}
		,
		{
			"fieldname": "received_amount",
			"label": _("المسلم"),
			"fieldtype": "Float",
			"width": 100,
			"precision": 2
		}
		,
		{
			"fieldname": "diff",
			"label": _("الفروقات"),
			"fieldtype": "Float",
			"width": 100,
			"precision": 2

		}
		
		
	]
