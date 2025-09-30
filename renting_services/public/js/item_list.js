frappe.provide("renting_services");
frappe.listview_settings['Item'] = {
	refresh: function(listview) {
        listview.page.add_inner_button(__('اضافة مقاس جديد'), 
            function() {                
                renting_services.create_new_size();
            },
            "إدارة الأصناف");
        listview.page.add_inner_button(__('اضافة لون جديد'), 
            function() {                
                renting_services.create_new_color();
            },
            "إدارة الأصناف");
        listview.page.add_inner_button(__('اضافة كود جديد'), 
            function() {                
                renting_services.create_new_size();
            },
            "إدارة الأصناف");
        listview.page.add_inner_button(__('اضافة صنف جديد'), 
            function() {                
                renting_services.create_new_item();
            },
            "إدارة الأصناف");
    },
};