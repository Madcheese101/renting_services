# Copyright (c) 2024, MadCheese and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import get_fullname

class StoreRecieveItem(Document):
	def on_submit(self):
		if self.invoice_id:
			frappe.db.set_value("Sales Invoice", self.invoice_id, "rent_status", 'جاهز')

	def on_cancel(self):
		if self.invoice_id:
			frappe.db.set_value("Sales Invoice", self.invoice_id, "rent_status", 'صيانة')
		
		# TO-DO edit cleaning doc after cancel
		if self.repair_id:
			pass
