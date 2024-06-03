frappe.ui.form.on('Item', {
    setup: function(frm) {
        // frm.set_query("reference_doctype", "references", function() {
		// 	if (frm.doc.party_type == "Customer") {
		// 		var doctypes = ["Sales Order", "Sales Invoice", "Journal Entry", "Dunning", "Rent Invoice"];
        //         frappe.msgprint("sang")

		// 	} else if (frm.doc.party_type == "Supplier") {
		// 		var doctypes = ["Purchase Order", "Purchase Invoice", "Journal Entry"];
		// 	} else {
		// 		var doctypes = ["Journal Entry"];
		// 	}

		// 	return {
		// 		filters: { "name": ["in", doctypes] }
		// 	};
		// });
	},
	refresh: function(frm){
		frm.add_custom_button(
			__('ارسال للتنظيف'),
			// () => this.make_rent_payment_entry(),
			() => notes_dialog(frm.doc.name, "clean"),
			__('اجراءات')
		);
		frm.add_custom_button(
			__('ارسال للصيانة'),
			// () => this.make_rent_payment_entry(),
			() => notes_dialog(frm.doc.name, "repair"),
			__('اجراءات')
		);
	},
});

notes_dialog = function(item_code, type){
	let d = new frappe.ui.Dialog({
		title: 'الرجاء كتابة أي ملاحظات ان وجدت',
		fields: [
			{
				fieldtype:'Text',
				fieldname:'notes',
				label: __('ملاحظات'),
			}
		],
		size: 'small', // small, large, extra-large 
		primary_action_label: 'إستقبال / إرسال للتنظيف',
		primary_action(values) {
			send_to_process(item_code, values.notes, type);
			d.hide();
		}
	});
	d.show();
}

send_to_process = function(item_code, items_notes, type){
	// const me = frm;
	const method_path = type=='clean' ? "renting_services.api.send_item_to_cleaning" 
		: "renting_services.api.send_item_to_repair";

	frappe.call({
		method: method_path,
		args: {item_code: item_code, notes: items_notes},
		callback: function(r) {
		}
	});
}