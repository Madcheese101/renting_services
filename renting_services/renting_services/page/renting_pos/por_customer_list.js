renting_services.PointOfRent.CustomersList = class {
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
			`<section class="customers-list">
				<div class="filter-section">
					<div class="label">${__('الزبائن')}</div>
					<div class="search-field"></div>
				</div>
				<div class="customers-container"></div>
			</section>`
		);

		this.$component = this.wrapper.find('.customers-list');
		this.$customers_container = this.$component.find('.customers-container');
	}

	bind_events() {
		this.search_field.$input.on('input', (e) => {
			clearTimeout(this.last_search);
			this.last_search = setTimeout(() => {
				const search_term = e.target.value;
				this.refresh_list(search_term);
			}, 300);
		});
		const me = this;
		this.$customers_container.on('click', '.customer-wrapper', function() {
			const customer_id = unescape($(this).attr('data-customer-name'));

			me.events.open_customer_data(customer_id);
		});
	}

	make_filter_section() {
		this.search_field = frappe.ui.form.make_control({
			df: {
				label: __('Search'),
				fieldtype: 'Data',
				placeholder: __('البحث حسب إسم الزبون أو رقم الهاتف')
			},
			parent: this.$component.find('.search-field'),
			render_input: true,
		});
		this.search_field.toggle_label(false);
	}

	refresh_list(search_term) {
		frappe.dom.freeze();
		this.events.reset_customer_summary();
		const _search_term = search_term || this.search_field.get_value();
		this.$customers_container.html('');

		return frappe.call({
			method: "renting_services.renting_services.page.renting_pos.renting_pos.get_customers_list",
			freeze: true,
			args: { search_term:_search_term },
			callback: (response) => {
				frappe.dom.unfreeze();
				response.message.forEach(customer => {
					const customer_html = this.get_customers_html(customer);
					this.$customers_container.append(customer_html);
				});
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
		show ? this.$component.css('display', 'flex') && this.refresh_list(null) : this.$component.css('display', 'none');
	}
};
