# Copyright (c) 2024, MadCheese and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import get_fullname

class Repair(Document):
	def on_submit(self):
		if self.invoice_id:
			frappe.db.set_value("Sales Invoice", self.invoice_id, "rent_status", 'صيانة')
		if self.employee and self.employee != frappe.session.user:
			from frappe.desk.form.assign_to import add
			args = {
				'assign_to' : [self.employee], 
				'doctype' : 'Repair', 
				'name' : self.name, 
				'description' : 'تم تعيينك لتولي فاتورة صيانة الأصناف التالية'}
			add(args, ignore_permissions=True)

	def on_cancel(self):
		if self.invoice_id:
			frappe.db.set_value("Sales Invoice", self.invoice_id, "rent_status", 'نظافة')
		
		# TO-DO edit cleaning doc after cancel
		if self.cleaning_id:
			pass
	
	@frappe.whitelist()
	def assign_to(self, user):
		_user = user or frappe.session.user
		full_name = get_fullname(_user)
		self.db_set('employee', _user)
		self.db_set('employee_name', full_name)
		
		if _user != frappe.session.user:
			from frappe.desk.form.assign_to import add
			args = {
				'assign_to' : [_user], 
				'doctype' : 'Repair', 
				'name' : self.name, 
				'description' : 'تم تعيينك لتولي فاتورة صيانة الأصناف التالية'}
			add(args, ignore_permissions=True)
			
	def set_status(self):
		if self.total_ready > 0 and self.total_ready != self.total_qty:
			self.db_set('status', 'مكتمل جزئي')
		
		if self.total_ready == self.total_qty:
			self.db_set('status', 'مكتمل')

		if self.employee and self.total_ready == 0:
			self.db_set('status', 'قيد الصيانة')

	@frappe.whitelist()
	def finish_repair(self, new_notes=None):
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
		notes = f"{self.notes} <br> ملاحظات من قسم الصيانة: <br> {new_notes}"
		if repair_items:
			send_to_store = frappe.new_doc("Store Recieve Item")
			send_to_store.invoice_id = self.invoice_id
			send_to_store.repair_id = self.name
			send_to_store.total_qty = total_ready
			send_to_store.set("items", repair_items)
			send_to_store.notes = notes
			send_to_store.flags.ignore_mandatory = True
			send_to_store.flags.ignore_permissions=True
			send_to_store.save()
			send_to_store.submit()
