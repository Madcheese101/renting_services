frappe.provide("renting_services");

renting_services.PointOfRent.CustomerSummary = class {
	constructor({ wrapper, settings}) {
		this.wrapper = wrapper;
		this.payments = settings.payments.map((p) => {
			return p.mode_of_payment
		});
		this.payments.push("")
		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.bind_events();
		this.attach_shortcuts();
	}

	prepare_dom() {
		this.wrapper.append(
			`<section class="customer-summary">
				<div class="no-summary-placeholder">
					${__('الرجاء اختيار زبون لعرض البيانات')}
				</div>
				<div class="customer-summary-wrapper">
					<div class="abs-container">
						<div class="upper-section"></div>
						<div class="summary-btns"></div>
						<div class="label">${__('Items')}</div>
						<div class="items-header-row"></div>
						<div class="items-container summary-container"></div>
					</div>
				</div>
			</section>`
		);

		this.$component = this.wrapper.find('.customer-summary');
		this.$summary_wrapper = this.$component.find('.customer-summary-wrapper');
		this.$summary_container = this.$component.find('.abs-container');
		this.$upper_section = this.$summary_container.find('.upper-section');
		this.$summary_btns = this.$summary_container.find('.summary-btns');
		this.$items_header_row = this.$summary_container.find('.items-header-row')
		this.$items_container = this.$summary_container.find('.items-container');

		this.$items_datatable = new DataTable(this.$items_container.get(0), {
			columns: [],
			data: [],
			serialNoColumn: false,
			layout: "fluid",
			noDataMessage: "لا توجد بيانات",
			treeView:true
		  });
	}

	get_upper_section_html(doc) {
		return `<div class="left-section">
					<div class="customer-name">${doc.name}</div>
					<div class="customer-email">${doc.mobile_no || ''}</div>
				</div>
				<div class="right-section">
					<div class="paid-amount">${format_currency(this.customer_dashboard.total_unpaid, doc.currency)}</div>
				</div>`;
	}

	// attach_items_info(items, columns_) {
	// 	this.$items_container.html('');
	// 	new DataTable(this.$items_container.get(0), {
	// 		columns: columns_,
	// 		data: items,
	// 		serialNoColumn: false,
	// 		layout: "fluid"
	// 	  });

	// }

	bind_events() {
		const me = this;
		
		this.$summary_container.on('click', '.invoices-btn', () => {this.get_invoices()});
		this.$summary_container.on('click', '.linked-payments-btn', () => {this.get_linked_payments()});
		this.$summary_container.on('click', '.payments-btn', () => {this.get_payments()});
		this.$items_container.on('click', '.print-item', function() {
			const doc_id = unescape($(this).attr('doc-name-value'));

			if (me.doctype == "Sales Invoice"){
				renting_services.print_directly(me.doctype, doc_id, "Rent Invoice");
			}
			if (me.doctype == "Payment Entry"){
				renting_services.print_directly(me.doctype, doc_id, "Payment Receipt");

			}
		});
		
	}
	get_invoices(){
		this.doctype = "Sales Invoice";
		frappe.call({
			method: "renting_services.renting_services.page.renting_pos.renting_pos.get_customer_invoices",
			freeze: true,
			args: { customer: this.doc.name},
			callback: (response) => {
				let button_formatter = (value) => `<div class="print-item" doc-name-value="${value}">طباعة</div>`
				const columns = [
					// docname
					{
						name: 'الفاتورة',
						id: 'name',
						editable: false,
						// resizable: false,
						sortable: false,
						
						dropdown: false,
						
					},
					// posting_date
					{
						name: 'التاريخ',
						id: 'posting_date',
						editable: false,
						// resizable: false,
						sortable: false,
						
						dropdown: false,
						
						// format: (value) => {
						// 	return value.bold();
						// }
					},
					// grand_total
					{
						name: 'الاجمالي',
						id: 'grand_total',
						editable: false,
						// resizable: false,
						sortable: false,
						
						dropdown: false,
						
						format: (value) => {
							return format_currency(value, this.doc.currency, 1);
						}
					},
					// paid
					{
						name: 'المدفوع',
						id: 'paid_amount',
						editable: false,
						// resizable: false,
						sortable: false,
						
						dropdown: false,
						
						format: (value) => {
							return format_currency(value, this.doc.currency, 1);
						}
					},
					// status
					{
						name: 'الحالة',
						id: 'status',
						editable: false,
						resizable: false,
						dropdown: false,
					},
					// rent_status
					{
						name: 'حالة الايجار',
						id: 'rent_status',
						editable: false,
						resizable: false,
						dropdown: false,
					},
					// print_btn
					{
						name: ' ',
						id: 'name_to_print',
						editable: false,
						// resizable: false,
						dropdown: false,
						format: button_formatter
					},
				]
				this.$items_datatable.refresh(response.message, columns);
				// this.attach_items_info(response.message, columns);
				frappe.dom.unfreeze();				
			}
		});
	}
	get_linked_payments(){
		this.doctype = "Payment Entry";
		frappe.call({
			method: "renting_services.renting_services.page.renting_pos.renting_pos.get_customer_linked_payments",
			freeze: true,
			args: { customer: this.doc.name, payments: this.payments},
			callback: (response) => {
				let button_formatter = (value) => value ? 
					`<div class="print-item" doc-name-value="${value}">طباعة</div>` : '';
				const columns = [
					// docname
					{
						name: 'رقم الايصال',
						id: 'name',
						editable: false,
						// resizable: false,
						sortable: false,
						dropdown: false,
					},
					// posting_date
					{
						name: 'التاريخ',
						id: 'posting_date',
						editable: false,
						// resizable: false,
						// sortable: false,
						dropdown: false,
					},
					// mode_of_payment
					{
						name: 'طريقة الدفع',
						id: 'mode_of_payment',
						editable: false,
						// resizable: false,
						// sortable: false,
						dropdown: false,
					},
					// paid_amount
					{
						name: 'قيمة الإيصال',
						id: 'paid_amount',
						editable: false,
						// resizable: false,
						// sortable: false,
						dropdown: false,
						format: (value) => {
							return format_currency(value, this.doc.currency, 1);
						}
					},
					// remaining
					{
						name: 'الغير مخصص',
						id: 'remaining_amount',
						editable: false,
						// resizable: false,
						// sortable: false,
						dropdown: false,
						format: (value) => {
							return format_currency(value, this.doc.currency, 1);
						}
					},
					// print_btn
					{
						name: ' ',
						id: 'name_to_print',
						editable: false,
						// resizable: false,
						dropdown: false,
						format: button_formatter
					},
				]
				this.$items_datatable.refresh(response.message, columns);
				frappe.dom.unfreeze();
			}
		});
	}
	
	get_payments(){
		this.doctype = "Payment Entry";
		frappe.call({
			method: "renting_services.renting_services.page.renting_pos.renting_pos.get_customer_unlinked_payments",
			freeze: true,
			args: { customer: this.doc.name, payments: this.payments},
			callback: (response) => {
				let button_formatter = (value) => `<div class="print-item" doc-name-value="${value}">طباعة</div>`
				const columns = [
					// docname
					{
						name: 'رقم الايصال',
						id: 'name',
						editable: false,
						// resizable: false,
						sortable: false,
						dropdown: false,
					},
					// posting_date
					{
						name: 'التاريخ',
						id: 'posting_date',
						editable: false,
						// resizable: false,
						// sortable: false,
						dropdown: false,
					},
					// mode_of_payment
					{
						name: 'طريقة الدفع',
						id: 'mode_of_payment',
						editable: false,
						// resizable: false,
						// sortable: false,
						dropdown: false,
					},
					// paid_amount
					{
						name: 'القيمة',
						id: 'paid_amount',
						editable: false,
						// resizable: false,
						// sortable: false,
						dropdown: false,
						format: (value) => {
							return format_currency(value, this.doc.currency, 1);
						}
					},
					// print_btn
					{
						name: ' ',
						id: 'name_to_print',
						editable: false,
						// resizable: false,
						dropdown: false,
						format: button_formatter
					},
				]
				this.$items_datatable.refresh(response.message, columns);
				// this.attach_items_info(response.message, columns);
				frappe.dom.unfreeze();
			}
		});
	}
	attach_shortcuts() {
		const ctrl_label = frappe.utils.is_mac() ? '⌘' : 'Ctrl';
		this.$summary_container.find('.print-btn').attr("title", `${ctrl_label}+P`);
		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+p",
			action: () => this.$summary_container.find('.print-btn').click(),
			condition: () => this.$component.is(':visible') && this.$summary_container.find('.print-btn').is(":visible"),
			description: __("Print Receipt"),
			page: cur_page.page.page
		});
		this.$summary_container.find('.new-btn').attr("title", `${ctrl_label}+Enter`);
		frappe.ui.keys.on("ctrl+enter", () => {
			const summary_is_visible = this.$component.is(":visible");
			if (summary_is_visible && this.$summary_container.find('.new-btn').is(":visible")) {
				this.$summary_container.find('.new-btn').click();
			}
		});
		this.$summary_container.find('.edit-btn').attr("title", `${ctrl_label}+E`);
		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+e",
			action: () => this.$summary_container.find('.edit-btn').click(),
			condition: () => this.$component.is(':visible') && this.$summary_container.find('.edit-btn').is(":visible"),
			description: __("Edit Receipt"),
			page: cur_page.page.page
		});
	}

	add_summary_btns() {
		this.$summary_btns.html('');

		this.$summary_btns.append(
			`<div class="summary-btn btn btn-default invoices-btn">${__('عرض الفواتير')}</div>`);
		this.$summary_btns.append(
			`<div class="summary-btn btn btn-default linked-payments-btn">${__('عرض الإيصالات')}</div>`);
		this.$summary_btns.append(
			`<div class="summary-btn btn btn-default payments-btn">${__('إيصالات غير مربوطة')}</div>`);
		this.$summary_btns.children().last().removeClass('mr-4');
	}

	async load_summary_of(doc) {
		const me = this;
		// this.$items_container.html('');
		this.$items_datatable.refresh([],[]);
		const dashboard_info = await frappe.call({
			method: "renting_services.renting_services.page.renting_pos.renting_pos.load_customer_dashboard_info",
			freeze: true,
			args: { docname: doc.name, loyalty_program: doc.loyalty_program},
			callback: (response) => {
				frappe.dom.unfreeze();
			}
		});

		if(dashboard_info.message.length > 0){
			this.customer_dashboard = dashboard_info.message[0]
		}else{
			this.customer_dashboard = {"total_unpaid": 0}
		}

		this.$component.css('grid-column', 'span 6 / span 6');

		this.toggle_summary_placeholder(false);

		this.doc = doc;

		this.attach_document_info(doc);
		this.add_summary_btns();

	}

	attach_document_info(doc) {
		// frappe.db.get_value('Customer', this.doc.customer, 'email_id').then(({ message }) => {
		// 	this.customer_email = message.email_id || '';
		// 	const upper_section_dom = this.get_upper_section_html(doc);
		// 	this.$upper_section.html(upper_section_dom);
		// });
		const upper_section_dom = this.get_upper_section_html(doc);
			this.$upper_section.html(upper_section_dom);
	}

	set_dynamic_rate_header_width() {
		const rate_cols = Array.from(this.$items_container.find(".item-rate-disc"));
		this.$items_container.find(".item-rate-disc").css("width", "");
		let max_width = rate_cols.reduce((max_width, elm) => {
			if ($(elm).width() > max_width)
				max_width = $(elm).width();
			return max_width;
		}, 0);

		max_width += 1;
		if (max_width == 1) max_width = "";

		this.$items_container.find(".item-rate-disc").css("width", max_width);
	}

	toggle_component(show) {
		show ? this.$component.css('display', 'flex') : this.$component.css('display', 'none');
	}

	toggle_summary_placeholder(show) {
		if (show) {
			this.$summary_wrapper.css('display', 'none');
			this.$component.find('.no-summary-placeholder').css('display', 'flex');
		} else {
			this.$summary_wrapper.css('display', 'flex');
			this.$component.find('.no-summary-placeholder').css('display', 'none');
		}
	}
};
