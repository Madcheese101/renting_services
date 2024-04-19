# Copyright (c) 2024, MadCheese and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import get_fullname
from erpnext.selling.page.point_of_sale.point_of_sale import get_pos_profile_data

class StoreRecieveItem(Document):
	# def on_submit(self):
	# 	if self.invoice_id:
	# 		frappe.db.set_value("Sales Invoice", self.invoice_id, "rent_status", 'جاهز')

	def on_cancel(self):
		if self.invoice_id:
			frappe.db.set_value("Sales Invoice", self.invoice_id, "rent_status", 'صيانة')
		
		# TO-DO edit cleaning doc after cancel
		if self.repair_id:
			pass

	def set_user(self):
			_user = frappe.session.user
			full_name = get_fullname(_user)
			self.db_set('employee', _user)
			self.db_set('employee_name', full_name)

	@frappe.whitelist()
	def recieve_at_store(self):
		profileslist = frappe.db.get_list("POS Profile", filters={"disabled": 0},pluck="name")
		profile_data = None
		if profileslist:
			profile_data =  get_pos_profile_data(profileslist[0])
			target_wh = profile_data["warehouse"]
			warehouse = frappe.db.get_value('Warehouse', target_wh, 'reserve_warehouse')
			
			stock_entry = frappe.new_doc("Stock Entry")
			# Set the necessary fields
			stock_entry.stock_entry_type = "خروج"
			stock_entry.company = profile_data["company"]
			stock_entry.flags.ignore_permissions=True

			for item in self.get("items"):
				child_item = frappe.get_doc("Process Items", item.get("name"))
				child_item.ready_qty = child_item.qty
				child_item.flags.ignore_validate_update_after_submit = True
				child_item.save(ignore_permissions=True)

				stock_entry.append({"item_code": item.item_code,
						"s_warehouse": warehouse,
						"t_warehouse":target_wh,
						"qty":item.qty,
						})
			
			stock_entry.save()
			stock_entry.submit()

			if self.invoice_id:
				invoice = frappe.get_doc("Sales Invoice", self.invoice_id)
				if (invoice.outstanding_amount == 0 and 
					invoice.total_qty == self.total_qty):
					frappe.db.set_value("Sales Invoice", self.invoice_id, "rent_status", 'مكتمل')
				else:
					frappe.db.set_value("Sales Invoice", self.invoice_id, "rent_status", 'جاهز')

			
			self.db_set("status", "تم الإستلام")
			self.set_user()