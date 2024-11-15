frappe.load_employee_defaults = function() {
    const boot_data = frappe.boot;
    frappe.session.branch = boot_data.branch;
    frappe.session.cleaning_branch = boot_data.cleaning_branch;
    frappe.session.repair_branch = boot_data.repair_branch;
    frappe.session.is_store_employee = boot_data.is_store_employee;
    frappe.session.pos_profile = boot_data.pos_profile;
}

// execute
frappe.load_employee_defaults();