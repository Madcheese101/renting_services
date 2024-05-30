renting_services.PointOfRent.CloseDay = class {
	constructor({ wrapper, settings, events }) {
		this.wrapper = wrapper;
		this.events = events;
		// this.date_value = frappe.datetime.get_today();
		this.date_value = null;
		this.payments = settings.payments.map((p) => {
			return p.mode_of_payment
		});
		this.company = settings.company;
		this.currency = settings.currency;
		this.cost_center = settings.cost_center;
		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.make_fields();
		this.bind_events();
	}

	prepare_dom() {
		this.wrapper.append(
			`<section class="close-day">
				<div class="label">${__('إغلاق اليوم')}</div>
				<hr class="solid">
				<div class="close-day-container">
					<div class="upper-section">
						<div class="date-field"></div>
						<div class="btn btn-primary ellipsis transfer-balance-btn">${__('إغلاق اليوم')}</div>
					</div>
					<div class="accounts-container"></div>
					<div class="payment-entries-container"></div>
				</div>
			</section>`
		);

		this.$component = this.wrapper.find('.close-day');
		this.$close_day_container = this.$component.find('.close-day-container');
		this.$upper_section = this.$close_day_container.find('.upper-section');
	}

	make_fields() {
		this.$upper_section.find('.date-field').html('');
		this.date_field = frappe.ui.form.make_control({
			df: {
				label: __('التاريخ'),
				fieldtype: 'Date',
				placeholder: __('إختر التاريخ'),
				// default: frappe.datetime.get_today(),
				reqd: 1
			},
			parent: this.$upper_section.find('.date-field'),
			render_input: true,
		});

		this.items_datatable = frappe.ui.form.make_control({
			df: {
				label: 'أرصدة الخزائن',
				fieldname: 'payments',
				fieldtype: 'Table',
				cannot_add_rows: true,
				in_place_edit: true,
				data: [],
				fields: [
					{ fieldname: 'mode_of_payment', 
						fieldtype: 'Data', 
						label: 'طريقة الدفع', in_list_view: 1,
						read_only: 1},
					{ fieldname: 'date', 
						fieldtype: 'Date', label: 'التاريخ', in_list_view: 1,
						read_only: 1},
					{ fieldname: 'account_balance',
						fieldtype: 'Currency', label: 'رصيد الحساب', in_list_view: 1,
						read_only: 1 ,precision: 1},
					{ fieldname: 'paid_amount', 
						fieldtype: 'Currency', label: 'المدفوع', in_list_view: 1,
						precision:1,
						change: function() {
							const val = this.get_value()
							const account_balance = this.grid_row.on_grid_fields_dict.account_balance.get_value();
							const diff = account_balance - val;
							this.grid_row.on_grid_fields_dict
										.diff_amount.set_value(diff)
						}},
					{ fieldname: 'diff_amount', 
						fieldtype: 'Currency', label: 'الفرق', in_list_view: 1,
						read_only: 1, precision:1 },
					{ fieldname: 'from_account', 
						fieldtype: 'Data', 
						label: 'From Account', in_list_view: 0,
						read_only: 1},
					{ fieldname: 'to_account', 
						fieldtype: 'Data', 
						label: 'To Account', in_list_view: 0,
						read_only: 1},
					{ fieldname: 'company', 
						fieldtype: 'Data', 
						label: 'Company', in_list_view: 0,
						read_only: 1}
				],
			},
			parent: this.$close_day_container.find('.accounts-container'),
			render_input: true,
			get_data: () => {
				return this.items_datatable.df.data;
			},
		});

		this.payment_entries_datatable = frappe.ui.form.make_control({
			df: {
				label: 'تحويلات الخزائن لخزينة الوسيط',
				fieldname: 'payment_entries',
				fieldtype: 'Table',
				cannot_add_rows: true,
				in_place_edit: true,
				data: [],
				fields: [
					{ fieldname: 'name', 
						fieldtype: 'Link', options: "Payment Entry",
						label: 'رقم الإيصال', in_list_view: 1,
						read_only: 1},
					{ fieldname: 'mode_of_payment', 
						fieldtype: 'Data', 
						label: 'طريقة الدفع', in_list_view: 1,
						read_only: 1},
					{ fieldname: 'posting_date', 
						fieldtype: 'Date', label: 'التاريخ', in_list_view: 1,
						read_only: 1},
					{ fieldname: 'paid_amount',
						fieldtype: 'Currency', label: 'الرصيد', in_list_view: 1,
						read_only: 1 ,precision: 1},
					{ fieldname: 'received_amount', 
						fieldtype: 'Currency', label: 'المدفوع', in_list_view: 1,
						precision:1, read_only: 1},
					{ fieldname: 'diff_amount', 
						fieldtype: 'Currency', label: 'الفرق', in_list_view: 1,
						read_only: 1, precision:1 },
				],
			},
			parent: this.$close_day_container.find('.payment-entries-container'),
			render_input: true,
			get_data: () => {
				return this.payment_entries_datatable.df.data;
			},
		});
	}

	bind_events() {
		const me = this;
		this.$close_day_container.on('click', '.transfer-balance-btn', () => {
			this.close_day();
		});
		this.date_field.$input.on('change', (value) => {
			let new_val = value.target.value
			let correct_date = new_val.split('-').reverse().join('-');
			// if(correct_date == "" && correct_date !== me.date_value){
			// 	this.date_value = null;
			// }
			if(correct_date !== me.date_value){
				me.date_value = correct_date;
				if(correct_date !== ""){
					me.refresh_list(correct_date)
				}
				else {
					me.$items_datatable.refresh([], [])
				}
			}
			
		});
	}
	close_day(){
		frappe.call({
			method: "renting_services.renting_services.page.renting_pos.renting_pos.transfer_accounts_balance",
			freeze: true,
			args: {
				data: this.items_datatable.get_data(),
				cost_center: this.cost_center
			},
			callback: (response) => {
				this.refresh_list(this.date_value)
			}
		});
		
		// frappe.set_route('query-report', 'Close Day', {from_date:this.date_value, to_date:this.date_value});
	}
	refresh_list(date) {
		frappe.call({
			method: "renting_services.renting_services.page.renting_pos.renting_pos.get_accounts_balances",
			freeze: true,
			args: { 
				mode_of_payments: this.payments,
				date: date,
				company: this.company
			},
			callback: (response) => {
				this.items_datatable.df["data"] = response.message;
				this.items_datatable.refresh();
			}
		});
		frappe.call({
			method: "renting_services.renting_services.page.renting_pos.renting_pos.get_transfer_payments",
			freeze: true,
			args: { 
				mode_of_payments: this.payments,
				date: date,
			},
			callback: (response) => {
				this.payment_entries_datatable.df["data"] = response.message;
				this.payment_entries_datatable.refresh();
			}
		});
	}

	get_customers_html(customer) {
		return (
			`<div class="customer-wrapper" data-customer-name="${escape(customer.name)}">
				<div class="customer-name-mobile">
					<div class="customer-name">${customer.customer_name}</div>
					<div class="customer-mobile">
						<svg class="mr-2" width="15" height="15" viewBox="0 0 33 33" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
							<path d="M11.748 5.773S11.418 5 10.914 5c-.496 0-.754.229-.926.387S6.938 7.91 6.938 7.91s-.837.731-.773 2.106c.054 1.375.323 3.332 1.719 6.058 1.386 2.72 4.855 6.876 7.047 8.337 0 0 2.031 1.558 3.921 2.191.549.173 1.647.398 1.903.398.26 0 .719 0 1.246-.385.536-.389 3.543-2.807 3.543-2.807s.736-.665-.119-1.438c-.859-.773-3.467-2.492-4.025-2.944-.559-.459-1.355-.257-1.699.054-.343.313-.956.828-1.031.893-.112.086-.419.365-.763.226-.438-.173-2.234-1.148-3.899-3.426-1.655-2.276-1.837-3.02-2.084-3.824a.56.56 0 0 1 .225-.657c.248-.172 1.161-.933 1.161-.933s.591-.583.344-1.27-1.906-4.716-1.906-4.716z"/>
						</svg>
						${frappe.ellipsis(customer.mobile_no, 20)}
					</div>
				</div>
			</div>
			<div class="seperator"></div>`
		);
	}

	toggle_component(show) {
		// show ? this.$component.css('display', 'flex') && this.refresh_list(this.date_value) : this.$component.css('display', 'none');
		show ? this.$component.css('display', 'flex') : this.$component.css('display', 'none');

	}
};
