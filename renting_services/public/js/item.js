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
	const btn_label = type=='clean' ? 'ارسال للتنظيف' : 'ارسال للصيانة';
	const is_clean = type=='clean' ? true : false;
	const is_repair = type=='repair' ? true : false;
	const field = type=='clean' ? 'cleaning_branch' : 'repair_branch';
	let d = new frappe.ui.Dialog({
		title: 'الرجاء كتابة أي ملاحظات ان وجدت',
		fields: [
			{
				label: __('ملاحظات'),
				fieldtype:'Text',
				fieldname:'notes',
			},
			{
				label: __('المحل'),
				fieldtype:'Link',
				fieldname:'branch',
				options: 'Branch',
				default: frappe.session.branch,
				read_only: frappe.session.is_store_employee,
				reqd: 1,
				get_query: () => {
					return {
						filters: {
							type: ''
						},
					};
				},
				onchange: async () => {
					const branch = d.get_value('branch');
					if (branch) {
						const { message } = await frappe.db.get_value('Branch', branch, field);
						d.set_value(field, message[field]);
					} else {
						d.set_value(field, '');
					}
				},
			},
			{
				label: __('قسم التنظيف'),
				fieldtype:'Data',
				fieldname:'cleaning_branch',
				default: frappe.session.cleaning_branch,
				read_only: 1,
				reqd: is_clean,
				hidden: !is_clean,

			},
			{
				label: __('قسم الصيانة'),
				fieldtype:'Data',
				fieldname:'repair_branch',
				default: frappe.session.repair_branch,
				read_only: 1,
				reqd: is_repair,
				hidden: !is_repair,
			}
		],
		size: 'small', // small, large, extra-large 
		primary_action_label: btn_label,
		primary_action(values) {
			send_to_process(item_code, values.notes, type, values.branch, values.cleaning_branch, values.repair_branch);
			d.hide();
		}
	});
	d.show();
}

send_to_process = function(item_code, items_notes, type, branch, cleaning_branch, repair_branch){
	// const me = frm;
	const method_path = type=='clean' ? "renting_services.api.send_item_to_cleaning" 
		: "renting_services.api.send_item_to_repair";
	const arguments = {item_code: item_code, notes: items_notes, };
	if(type=='clean'){
		arguments.cleaning_branch = cleaning_branch;
		arguments.branch = branch;
	}else{
		arguments.repair_branch = repair_branch;
		arguments.branch = branch;
	}
	frappe.call({
		method: method_path,
		args: arguments,
		callback: function(r) {
		}
	});
}