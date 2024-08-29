# Copyright (c) 2024, MadCheese and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.query_builder import DocType


def execute(filters=None):
	columns, data = get_columns(), []
	
	items_doc = DocType("Sales Invoice Item")
	sales_doc = DocType("Sales Invoice")
	
	if filters.date_field:
		pos_profiles = frappe.get_list("POS Profile", pluck="name")
		items = (frappe.qb
			.from_(items_doc)
			.from_(sales_doc)
			.select(
					items_doc.item_name,
					# items_doc.qty
				)
			.where(items_doc.parent == sales_doc.name)
			.where(sales_doc.docstatus == 1)
			.where(sales_doc.rent_status != "غير مؤكد")
			.where(sales_doc.pos_profile.isin(pos_profiles))
			.where(sales_doc.delivery_date == filters.date_field)
			.orderby(items_doc.item_name)
			# .groupby(items_doc.item_name)
		).run(as_dict=True)
		data = items
	else:
		data = []
	return columns, data


def get_columns():

	return [
		# Mode of payment
		{
			"fieldname": "item_name",
			"label": _("الصنف"),
			"fieldtype": "Data",
			# "options": "Mode of Payment",
			"width": 300
		}
		,
		# {
		# 	"fieldname": "qty",
		# 	"label": _("الكمية"),
		# 	"fieldtype": "Data",
		# 	"width": 100
		# }
	]

