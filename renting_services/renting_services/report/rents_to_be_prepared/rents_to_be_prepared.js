// Copyright (c) 2024, MadCheese and contributors
// For license information, please see license.txt

frappe.query_reports["Rents to be Prepared"] = {
	"filters": [
		{
            fieldname:"date_field",
            label: "التاريخ",
            fieldtype: "Date",
            default: frappe.datetime.add_days(frappe.datetime.get_today(), 1)
        },
	]
};
