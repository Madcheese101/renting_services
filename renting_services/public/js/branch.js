frappe.provide("erpnext.accounts");
frappe.provide("renting_services");

frappe.ui.form.on('Branch', {
	refresh(frm){
		const me = this;
		frappe.ui.form.qz_get_printer_list().then(result=>{
			me.printers=result;
			frm.fields_dict.printers.grid.update_docfield_property("printer", "options", result);
			frm.set_df_property("default_printer", "options", result);
			frm.refresh_field('printers');
			frm.refresh_field('default_printer');
		});
	}
})