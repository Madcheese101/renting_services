// Copyright (c) 2024, MadCheese and contributors
// For license information, please see license.txt

frappe.query_reports["Close Day"] = {
	"filters": [
		{
            fieldname:"from_date",
            label: "From Date",
            fieldtype: "Date",
            default: frappe.datetime.add_days(frappe.datetime.get_today(), -1)
        },
        {
            fieldname:"to_date",
            label: "To Date",
            fieldtype: "Date",
            default: frappe.datetime.get_today()
        },
	],
	onload: function(report) {
		report.page.add_inner_button(__("Print Report"), function() {
            // frappe.call({
            //     method:"renting_services.utils.api.get_current_user_defaults",
            //     callback: function(r) {
            //         report.direct_print_report(r.message.letter_head);   
            //     }
            // });
			// console.log(frappe.get_route())
		});
	},
    "tree":true,
	"name_field":"mode_of_payment",
	"parent_field":"mode_of_payment",
	"initial_depth":2
};
