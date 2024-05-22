frappe.ui.form.on('Payment Entry', {
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
	}
})