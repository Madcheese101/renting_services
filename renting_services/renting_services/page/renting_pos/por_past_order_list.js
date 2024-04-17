renting_services.PointOfRent.PastOrderList = class {
	constructor({ wrapper, events }) {
		this.wrapper = wrapper;
		this.events = events;

		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.make_filter_section();
		this.bind_events();
	}

	prepare_dom() {
		this.wrapper.append(
			`<section class="past-order-list">
				<div class="filter-section">
					<div class="label">${__('Recent Orders')}</div>
					<div class="search-field"></div>
				</div>
				<div class="invoices-container"></div>
			</section>`
		);

		this.$component = this.wrapper.find('.past-order-list');
		this.$invoices_container = this.$component.find('.invoices-container');
	}

	bind_events() {
		this.search_field.$input.on('input', (e) => {
			clearTimeout(this.last_search);
			this.last_search = setTimeout(() => {
				const search_term = e.target.value;
				// this.refresh_list(search_term, this.status_field.get_value());
				this.refresh_list(search_term);
			}, 300);
		});
		const me = this;
		this.$invoices_container.on('click', '.invoice-wrapper', function() {
			const invoice_name = unescape($(this).attr('data-invoice-name'));

			me.events.open_invoice_data(invoice_name);
		});
	}

	make_filter_section() {
		this.search_field = frappe.ui.form.make_control({
			df: {
				label: __('Search'),
				fieldtype: 'Data',
				placeholder: __('البحث حسب إسم الزبون أو رقم الفاتورة')
			},
			parent: this.$component.find('.search-field'),
			render_input: true,
		});
		this.search_field.toggle_label(false);
	}

	refresh_list(search_term) {
		frappe.dom.freeze();
		this.events.reset_summary();
		const _search_term = search_term || this.search_field.get_value();
		this.$invoices_container.html('');

		return frappe.call({
			method: "renting_services.renting_services.page.renting_pos.renting_pos.get_past_order_list",
			freeze: true,
			args: { search_term:_search_term },
			callback: (response) => {
				frappe.dom.unfreeze();
				response.message.forEach(invoice => {
					const invoice_html = this.get_invoice_html(invoice);
					this.$invoices_container.append(invoice_html);
				});
			}
		});
	}

	get_invoice_html(invoice) {
		const posting_datetime = moment(invoice.posting_date+" "+invoice.posting_time).format("Do MMMM, h:mma");
		return (
			`<div class="invoice-wrapper" data-invoice-name="${escape(invoice.name)}">
				<div class="invoice-name-date">
					<div class="invoice-name">${invoice.name}</div>
					<div class="invoice-date">
						<svg class="mr-2" width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
							<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
						</svg>
						${frappe.ellipsis(invoice.customer, 20)}
					</div>
				</div>
				<div class="invoice-total-status">
					<div class="invoice-total">${format_currency(invoice.grand_total, invoice.currency, 0) || 0}</div>
					<div class="invoice-date">${posting_datetime}</div>
				</div>
			</div>
			<div class="seperator"></div>`
		);
	}

	toggle_component(show) {
		show ? this.$component.css('display', 'flex') && this.refresh_list(null) : this.$component.css('display', 'none');
	}
};
