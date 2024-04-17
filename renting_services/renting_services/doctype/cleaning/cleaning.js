// Copyright (c) 2024, MadCheese and contributors
// For license information, please see license.txt
frappe.provide("renting_services.item_process");

renting_services.common.setup_renting_controller();
renting_services.common.CleaningController = class CleaningController extends (renting_services.item_process.CommonFunctions){

}
extend_cscript(cur_frm.cscript, new renting_services.common.CleaningController({frm: cur_frm}));

frappe.ui.form.on('Cleaning', {
});
