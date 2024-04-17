// Copyright (c) 2024, MadCheese and contributors
// For license information, please see license.txt
renting_services.common.setup_renting_controller();
renting_services.common.RepairController = class RepairController extends 
	(renting_services.item_process.CommonFunctions){
	// refresh(){
	// 	// super.refresh();
	// }
}
extend_cscript(cur_frm.cscript, new renting_services.common.RepairController({frm: cur_frm}));

frappe.ui.form.on('Repair', {
	// refresh: function(frm) {

	// }
});
