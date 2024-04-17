# Copyright (c) 2024, MadCheese and contributors
# For license information, please see license.txt
import json
from frappe import _
import frappe
from frappe.model.document import Document
from frappe.utils import get_fullname
from renting_services.utils.utils import update_child_ready_qty

class Cleaning(Document):
	def on_cancel(self):
		if self.invoice_id:
			frappe.db.set_value("Sales Invoice", self.invoice_id, "rent_status", 'خارج')

	@frappe.whitelist()
	def assign_to(self, user):
		_user = user or frappe.session.user
		full_name = get_fullname(_user)
		self.db_set('employee', _user)
		self.db_set('employee_name', full_name)

	def set_status(self):
		if self.total_ready > 0 and self.total_ready != self.total_qty:
			self.db_set('status', 'مكتمل جزئي')
		
		if self.total_ready == self.total_qty:
			self.db_set('status', 'مكتمل')

		if self.employee and self.total_ready == 0:
			self.db_set('status', 'قيد التنظيف')
	

	@frappe.whitelist()
	def finish_cleaning(self, new_notes=None):
		repair_items = []
		total_ready = 0
		for item in self.get("items"):
			if item.qty > item.ready_qty:
				child_item = frappe.get_doc("Process Items", item.get("name"))
				
				qty = item.qty - item.ready_qty
				total_ready += qty
				repair_items.append({"item_code": item.item_code, "qty": qty})
				child_item.ready_qty = item.qty
				child_item.flags.ignore_validate_update_after_submit = True
				child_item.save(ignore_permissions=True)
		
		self.reload()
		self.total_ready = self.total_qty
		self.status = "مكتمل"

		self.flags.ignore_validate_update_after_submit = True
		self.save(ignore_permissions=True)
		notes = f"ملاحظات من المحل: <br>  {self.notes} <br> ملاحظات من قسم التنظيف: <br> {new_notes}"
		if repair_items:
			repair = frappe.new_doc("Repair")
			repair.invoice_id = self.invoice_id
			repair.cleaning_id = self.name
			repair.total_qty = total_ready
			repair.set("items", repair_items)
			repair.notes = notes
			repair.flags.ignore_mandatory = True
			repair.flags.ignore_permissions=True
			repair.save()
			repair.submit()

		

		

    
