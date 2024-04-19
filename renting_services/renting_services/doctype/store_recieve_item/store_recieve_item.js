// Copyright (c) 2024, MadCheese and contributors
// For license information, please see license.txt

frappe.ui.form.on('Store Recieve Item', {
	refresh: function(frm) {
		const doc = frm.doc;
		const _frm = frm;
		if(doc.total_ready !== doc.total_qty && doc.status!=='إنتظار'){
			// complete finish
			frm.add_custom_button(
				__("إستلام"),
				() => frappe.call({doc: doc,
					method: "recieve_at_store",
					callback: function(r){
						_frm.reload_doc();
						refresh_field("items");
				}}),
				__("إجراءات")
			);
			
		}
		frm.page.set_inner_btn_group_as_primary(__("إجراءات"));
	}
});
