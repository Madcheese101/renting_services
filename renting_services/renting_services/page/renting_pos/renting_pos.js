frappe.provide('renting_services.PointOfRent');

frappe.pages['renting-pos'].on_page_load = function(wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: 'نقطة الحجز',
		single_column: true
	});

	frappe.require('point-of-rent.bundle.js', function() {
		wrapper.pos = new renting_services.PointOfRent.Controller(wrapper);
		window.cur_pos = wrapper.pos;
	});
}

frappe.pages['renting-pos'].refresh = function(wrapper) {
	if (document.scannerDetectionData) {
		onScan.detachFrom(document);
		wrapper.pos.wrapper.html("");
		wrapper.pos.init_por();
	}
};