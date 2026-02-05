frappe.provide("renting_services");

renting_services.create_new_size = function () {

    frappe.prompt({
        label: 'المقاس',
        fieldname: 'size',
        fieldtype: 'Data'
    }, (values) => {
        frappe.call("renting_services.utils.utils.create_new_size", {size: values.size});
    },
    'ادخل المقاس الجديد',
    "حفظ")

}

renting_services.create_new_color = function () {

    frappe.prompt({
        label: 'اللون',
        fieldname: 'color',
        fieldtype: 'Data'
    }, (values) => {
        frappe.call("renting_services.utils.utils.create_new_color", {color: values.color});
    },
    'ادخل اللون الجديد',
    "حفظ")
}

renting_services.create_new_code = function () {

    frappe.prompt({
        label: 'الكود',
        fieldname: 'code',
        fieldtype: 'Data'
    }, (values) => {
        frappe.call("renting_services.utils.utils.create_new_code", {code: values.code});
    },
    'ادخل الكود الجديد',
    "حفظ")

}

renting_services.create_new_item = async function () {
    attributes = await frappe.call("renting_services.utils.utils.get_attributes");
    attributes = attributes.message
    
    
    let dialog = new frappe.ui.Dialog({
        title: 'إنشاء صنف جديد',
        fields: [
            {
                label: 'كود الصنف',
                fieldname: 'code',
                fieldtype: 'Select',
                options: attributes.codes,
                reqd: 1
            },
            {
                label: 'المقاس',
                fieldname: 'size',
                fieldtype: 'Select',
                options: attributes.sizes,
                reqd: 1
            },
            {
                label: 'اللون',
                fieldname: 'color',
                fieldtype: 'Select',
                options: attributes.colors,
                reqd: 1
            }
        ],
        primary_action_label: 'إنشاء',
        primary_action(values) {
            dialog.hide();
            frappe.call("renting_services.utils.utils.create_new_item", {
                code: values.code,
                size: values.size,
                color: values.color
            })
        }
    });
    dialog.show();
}
