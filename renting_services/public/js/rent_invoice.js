frappe.provide("erpnext.accounts");

erpnext.accounts.RentInvoiceController = class RentInvoiceController extends erpnext.accounts.SalesInvoiceController  {
	make_mapped_rent_payment_entry(args) {
		var me = this;
		args = args || { "dt": this.frm.doc.doctype, "dn": this.frm.doc.name, "party_type":"Customer" };
		return frappe.call({
			method: "renting_services.overrides.rent_invoice.get_payment_entry",
			args: args,
			callback: function(r) {
				r.message.mode_of_payment = args.mode_of_payment;
				console.log(r.message);
				var doclist = frappe.model.sync(r.message);
				me.frm.call(
					{doc: me.frm.doc,
					method:'insert_payment', 
					args:{"pdoc": doclist[0]}});
				// frappe.set_route("Form", doclist[0].doctype, doclist[0].name);
			}
		});
	}
	show_dialog(doc){	
		const me = this;
		this.frm.call({
			doc: this.frm.doc,
			method: "get_mode_of_payments",
			callback: function(r) {
				if(r.message && r.message != "nothing"){
					let payments = r.message;
					let d = new frappe.ui.Dialog({
						title: 'Enter details',
						fields: [
							{
								label: 'Payment Details',
								fieldname: 'd_mode_of_payment',
								fieldtype: 'Table',
								cannot_add_rows: false,
								in_place_edit: true,
								data: payments,
								fields: [
									{ fieldname: 'mode_of_payment', 
										fieldtype: 'Data', label: 'Payment Mode', in_list_view: 1},
									{ fieldname: 'account', 
										fieldtype: 'Data', label: 'Account'},
									{ fieldname: 'type',
										fieldtype: 'Data', label: 'Type'},
									{ fieldname: 'base_amount', 
										fieldtype: 'Currency', label: 'Amount', in_list_view: 1 }
								]
							}
						],
						size: 'small', // small, large, extra-large 
						primary_action_label: 'دفع',
						primary_action(values) {
							let modes = values.d_mode_of_payment;
							modes.forEach((p) =>{
								if(p.base_amount > 0){
									me.make_rent_payment_entry({"mode_of_payment":p.mode_of_payment,
										"account":p.account,
										"bank_amount":p.base_amount})
								}
							});
							d.hide();
						}
					});
					d.show();
				}
			}
		});
	}
	make_rent_payment_entry(argss) {
		let via_journal_entry = this.frm.doc.__onload && this.frm.doc.__onload.make_payment_via_journal_entry;
		if(this.has_discount_in_schedule() && !via_journal_entry) {
			// If early payment discount is applied, ask user for reference date
			this.prompt_user_for_reference_date();
		} else {
			let args = { "dt": this.frm.doc.doctype,
				"dn": this.frm.doc.name, 
				"party_type":"Customer",
				"mode_of_payment": argss.mode_of_payment,
				"bank_account":argss.account,
				"bank_amount":argss.bank_amount};
			this.make_mapped_rent_payment_entry(args);
		}
	}
	refresh(doc, dt, dn) {
		const me = this;
		super.refresh(doc,dt, dn);
		
		if (doc.docstatus == 1 && doc.outstanding_amount!=0
			&& !(cint(doc.is_return) && doc.return_against)) {
				
			this.frm.add_custom_button(
				__('دفع الإيجار'),
				// () => this.make_rent_payment_entry(),
				() => this.show_dialog(doc),
				__('Renting Actions')
			);
			this.frm.page.set_inner_btn_group_as_primary(__('Renting Actions'));
		}
	}
}
// for backward compatibility: combine new and previous states
extend_cscript(cur_frm.cscript, new erpnext.accounts.RentInvoiceController({frm: cur_frm}));


frappe.ui.form.on('Sales Invoice', {
    // setup: function(frm) {
	// 	// frm.call("print_msg")
	// }
})