renting_services.PointOfRent.Controller = class {
	constructor(wrapper) {
		this.wrapper = $(wrapper).find('.layout-main-section');
		this.page = wrapper.page;

        this.init_por();
	}
    
    init_por() {
        this.prepare_app_defaults();
	}

	async prepare_app_defaults() {
		// this.pos_opening = data.name;
		// this.company = data.company;
		// this.pos_profile = data.pos_profile;
		// this.pos_opening_time = data.period_start_date;
		this.item_stock_map = {};
		this.settings = {};
        const me = this;
		frappe.db.get_value('Stock Settings', undefined, 'allow_negative_stock').then(({ message }) => {
			this.allow_negative_stock = flt(message.allow_negative_stock) || false;
		});

		frappe.call({
			method: "renting_services.renting_services.page.renting_pos.renting_pos.get_pos_profile",
			args: { "pos_profile": this.pos_profile },
			callback: (res) => {
				const profile = res.message;
                me.pos_profile = profile.name;
				me.company = profile.company;
				Object.assign(this.settings, profile);
				this.settings.customer_groups = profile.customer_groups.map(group => group.name);
				this.make_app();
			}
		});
	}

	make_app() {
		this.prepare_dom();
		this.prepare_components();
		this.prepare_menu();
		this.make_new_invoice();
	}

	prepare_dom() {
		this.wrapper.append(
			`<div class="point-of-sale-app"></div>`
		);

		this.$components_wrapper = this.wrapper.find('.point-of-sale-app');
	}

	prepare_components() {
		this.init_item_selector();
		this.init_item_details();
		this.init_item_cart();
		this.init_payments();
		this.init_recent_order_list();
		this.init_order_summary();
	}

	prepare_menu() {
		this.page.clear_menu();

		// this.page.add_menu_item(__("Open Form View"), this.open_form_view.bind(this), false, 'Ctrl+F');
		// this.page.add_menu_item(__("Toggle Recent Orders"), this.toggle_recent_order.bind(this), false, 'Ctrl+O');

		// this.page.add_menu_item(__("Save as Draft"), this.save_draft_invoice.bind(this), false, 'Ctrl+S');
		// this.page.add_menu_item(__('Close the POS'), this.close_pos.bind(this), false, 'Shift+Ctrl+C');
		this.page.add_inner_button('تجميد و جديد', this.save_draft_invoice.bind(this), 'إجراءات');
		this.page.add_inner_button('فاتورة جديدة', this.new_invoice.bind(this), 'إجراءات');
		this.page.add_inner_button('فواتير', this.toggle_recent_order.bind(this),null,'primary');
	}

	open_form_view() {
		frappe.model.sync(this.frm.doc);
		frappe.set_route("Form", this.frm.doc.doctype, this.frm.doc.name);
	}

	toggle_recent_order() {
		const show = this.recent_order_list.$component.is(':hidden');
		this.toggle_recent_order_list(show);
		// show ? this.page.set_primary_action('الرجوع لنقطة البيع', 
		// 	() => this.toggle_recent_order_list(false)) : '';

	}
	new_invoice(){
		frappe.run_serially([
			() => frappe.dom.freeze(),
			() => this.make_new_invoice(),
			() => frappe.dom.unfreeze(),
		]);
	}
	save_draft_invoice() {
		if (!this.$components_wrapper.is(":visible")) return;

		if (this.frm.doc.items.length == 0) {
			frappe.show_alert({
				message: __("You must add atleast one item to save it as draft."),
				indicator:'red'
			});
			frappe.utils.play_sound("error");
			return;
		}

		this.frm.save(undefined, undefined, undefined, () => {
			frappe.show_alert({
				message: __("There was an error saving the document."),
				indicator: 'red'
			});
			frappe.utils.play_sound("error");
		}).then(() => {
			frappe.run_serially([
				() => frappe.dom.freeze(),
				() => this.make_new_invoice(),
				() => frappe.dom.unfreeze(),
			]);
		});
	}

	init_item_selector() {
		this.item_selector = new renting_services.PointOfRent.ItemSelector({
			wrapper: this.$components_wrapper,
			pos_profile: this.pos_profile,
			settings: this.settings,
			events: {
				// item_selected: args => this.on_cart_update(args),
                item_selected: args => this.item_details.toggle_item_details_section(args),
				set_occ_date: date => {
					this.frm.set_value('delivery_date', date);
					this.item_details.occ_date = date
				},
				set_occ_duration: dur => {
					if(this.item_details.occ_date){
						let return_date = frappe.datetime.add_days(this.item_details.occ_date, dur);
						this.frm.set_value('return_date', return_date);
					}
					dur ? this.item_details.occ_duration = dur : '';
				},
				get_frm: () => this.frm || {}
			}
		})
	}

	init_item_cart() {
		this.cart = new renting_services.PointOfRent.ItemCart({
			wrapper: this.$components_wrapper,
			settings: this.settings,
			events: {
				get_frm: () => this.frm,                
				cart_item_clicked: (item) => {
					const item_row = this.get_item_from_frm(item);
					this.item_details.toggle_item_details_section(item_row);
                    
				},

				numpad_event: (value, action) => this.update_item_field(value, action),

				checkout: () => {
					this.save_and_checkout()
				},

				edit_cart: () => this.payment.edit_cart(),

				customer_details_updated: (details) => {
					this.customer_details = details;
					const discount = details.special_discount;
					if (discount > 0){
						this.frm.doc.items.forEach(item => {
							// discount customer special discount percentage
							const rate_after_disc = item.price_list_rate * (1 - (discount / 100));
							// round to nearest multiple of five
							const new_rate = Math.round(rate_after_disc/5)*5;
							const final_percentage = flt(((new_rate - item.price_list_rate)/item.price_list_rate)*100, 2);

							item.discount_percentage = final_percentage;
							item.rate = new_rate;
						});
					}
					
					// will add/remove LP payment method
					// this.payment.render_loyalty_points_payment_mode();
				}
			}
		})
	}

	init_item_details() {
		this.item_details = new renting_services.PointOfRent.ItemDetails({
			wrapper: this.$components_wrapper,
			settings: this.settings,
			events: {
				get_frm: () => this.frm,
                
                add_to_cart: args => this.on_cart_update(args),

				toggle_item_selector: (args) => {
					this.item_selector.resize_selector(args);

                    if (args.doctype != "Item") this.cart.toggle_numpad(args.minimize);
				},

				form_updated: (item, field, value) => {
					const item_row = frappe.model.get_doc(item.doctype, item.name);
					if (item_row && item_row[field] != value) {
						const args = {
							field,
							value,
							item: this.item_details.current_item
						};
						return this.on_cart_update(args);
					}

					return Promise.resolve();
				},

				highlight_cart_item: (item) => {
					const cart_item = this.cart.get_cart_item(item);
					this.cart.toggle_item_highlight(cart_item);
				},

				item_field_focused: (fieldname) => {
					this.cart.toggle_numpad_field_edit(fieldname);
				},
				set_value_in_current_cart_item: (selector, value) => {
					this.cart.update_selector_value_in_cart_item(selector, value, this.item_details.current_item);
				},
				clone_new_batch_item_in_frm: (batch_serial_map, item) => {
					// called if serial nos are 'auto_selected' and if those serial nos belongs to multiple batches
					// for each unique batch new item row is added in the form & cart
					Object.keys(batch_serial_map).forEach(batch => {
						const item_to_clone = this.frm.doc.items.find(i => i.name == item.name);
						const new_row = this.frm.add_child("items", { ...item_to_clone });
						// update new serialno and batch
						new_row.batch_no = batch;
						new_row.serial_no = batch_serial_map[batch].join(`\n`);
						new_row.qty = batch_serial_map[batch].length;
						this.frm.doc.items.forEach(row => {
							if (item.item_code === row.item_code) {
								this.update_cart_html(row);
							}
						});
					})
				},
				remove_item_from_cart: () => this.remove_item_from_cart(),
				get_item_stock_map: () => this.item_stock_map,
				close_item_details: () => {
					this.item_details.toggle_item_details_section(null);
					this.cart.prev_action = null;
					this.cart.toggle_item_highlight();
				},
				get_available_stock: (item_code, warehouse) => this.get_available_stock(item_code, warehouse)
			}
		});
	}

	init_payments() {
		this.payment = new renting_services.PointOfRent.Payment({
			wrapper: this.$components_wrapper,
			rent_allow_credit_sale: this.settings.rent_allow_credit_sale,
			events: {
				get_frm: () => this.frm || {},

				get_customer_details: () => this.customer_details || {},

				toggle_other_sections: (show) => {
					if (show) {
						this.item_details.$component.is(':visible') ? this.item_details.$component.css('display', 'none') : '';
						this.item_selector.toggle_component(false);
					} else {

						this.item_selector.toggle_component(true);
						this.item_selector.resize_selector({minimize:false, doctype: null})
					}
				},

				submit_invoice: () => this.submit_invoice()
			}
		});
	}

	init_recent_order_list() {
		this.recent_order_list = new renting_services.PointOfRent.PastOrderList({
			wrapper: this.$components_wrapper,
			events: {
				open_invoice_data: (name) => {
					// was POS Invoice
					frappe.db.get_doc('Sales Invoice', name).then((doc) => {
						this.order_summary.load_summary_of(doc);
					});
				},
				reset_summary: () => this.order_summary.toggle_summary_placeholder(true)
			}
		})
	}

	init_order_summary() {
		this.order_summary = new renting_services.PointOfRent.PastOrderSummary({
			wrapper: this.$components_wrapper,
			limit_cashiers: this.settings.limit_cashiers,
			events: {
				get_frm: () => this.frm,

				process_return: (name) => {
					this.recent_order_list.toggle_component(false);
					// was POS Invoice
					frappe.db.get_doc('Sales Invoice', name).then((doc) => {
						frappe.run_serially([
							() => this.make_return_invoice(doc),
							() => this.cart.load_invoice(),
							() => this.item_selector.toggle_component(true)
						]);
					});
				},
				edit_order: (name) => {
					this.recent_order_list.toggle_component(false);
					frappe.run_serially([
						() => this.frm.refresh(name),
						() => this.frm.call('reset_mode_of_payments'),
						() => this.cart.load_invoice(),
						() => this.item_selector.toggle_component(true)
					]);
				},
				delete_order: (name) => {
					frappe.model.delete_doc(this.frm.doc.doctype, name, () => {
						this.recent_order_list.refresh_list();
					});
				},
				new_order: () => {
					frappe.run_serially([
						() => frappe.dom.freeze(),
						() => this.make_new_invoice(),
						() => this.item_selector.toggle_component(true),
						() => this.item_selector.resize_selector({minimize:false, doctype: null}),
						() => frappe.dom.unfreeze(),
					]);
				}
			}
		})
	}

	toggle_recent_order_list(show) {
		this.toggle_components(!show);
		this.recent_order_list.toggle_component(show);
		this.order_summary.toggle_component(show);
		if (show){
			this.page.clear_inner_toolbar();
			this.page.add_inner_button('نقطة الحجز', this.toggle_recent_order.bind(this),null,'primary');

		}else{
			this.page.clear_inner_toolbar();
			this.page.add_inner_button('تجميد و جديد', this.save_draft_invoice.bind(this), 'إجراءات');
			this.page.add_inner_button('فاتورة جديدة', this.new_invoice.bind(this), 'إجراءات');
			this.page.add_inner_button('فواتير', this.toggle_recent_order.bind(this),null,'primary');
		}
	}

	toggle_components(show) {
		this.cart.toggle_component(show);
		this.item_selector.toggle_component(show);

		// do not show item details or payment if recent order is toggled off
		!show ? (this.item_details.toggle_component(false) || this.payment.toggle_component(false)) : '';
	}

	async submit_invoice(){
		this.frm.doc.paid_amount == 0 ? 
			this.frm.set_value('rent_status', "غير مؤكد") : this.frm.set_value('rent_status', "محجوز");
		this.frm.doc.update_stock = 0;
		var rent_exists = await this.check_availability();

		if (rent_exists.message.length > 0){
			const items = rent_exists.message.map(item=> item.item_name);
			frappe.throw( `يوجد حجز في الأصناف الأتية <br> ${items}`);
			return;
		}
		
		this.frm.savesubmit()
			.then((r) => {
				this.toggle_components(false);
				this.order_summary.toggle_component(true);
				this.order_summary.load_summary_of(this.frm.doc, true);
				frappe.show_alert({
					indicator: 'green',
					message: __('POS invoice {0} created succesfully', [r.doc.name])
				});
			});

	}
	async check_availability(){
		let expected_after = frappe.datetime.add_days(this.frm.doc.delivery_date, this.frm.doc.return_date);
		let expected_before = frappe.datetime.add_days(this.frm.doc.delivery_date, -1);
		var items = this.frm.doc.items.map(item => item.item_code);
		return frappe.call({
			method: "renting_services.renting_services.page.renting_pos.renting_pos.check_availability",
			args: { "before_date": expected_before,
					"after_date": expected_after,
					"item_code": items },
		});
	}

	make_new_invoice() {
		return frappe.run_serially([
			() => frappe.dom.freeze(),
			() => this.make_sales_invoice_frm(),
			() => this.set_pos_profile_data(),
			() => this.set_pos_profile_status(),
			() => this.cart.load_invoice(),
			() => frappe.dom.unfreeze(),
		]);
	}

	make_sales_invoice_frm() {
		const doctype = 'Sales Invoice';
		
		return new Promise(resolve => {
			if (this.frm) {
				this.frm = this.get_new_frm(this.frm);
				this.frm.doc.items = [];
				resolve();
			} else {
				frappe.model.with_doctype(doctype, () => {
					this.frm = this.get_new_frm();
					this.frm.doc.items = [];
					resolve();
				});
			}
		});
	}

	get_new_frm(_frm) {
		// was POS Invoice
		const doctype = 'Sales Invoice';
		const page = $('<div>');
		const frm = _frm || new frappe.ui.form.Form(doctype, page, false);
		const name = frappe.model.make_new_doc_and_get_name(doctype, true);
		frm.refresh(name);

		return frm;
	}

	async make_return_invoice(doc) {
		frappe.dom.freeze();
		this.frm = this.get_new_frm(this.frm);
		this.frm.doc.items = [];
		return frappe.call({
			// method: "erpnext.accounts.doctype.pos_invoice.pos_invoice.make_sales_return",
			method: "renting_services.renting_services.page.renting_pos.renting_pos.make_sales_return",
			args: {
				'source_name': doc.name,
				'target_doc': this.frm.doc
			},
			callback: (r) => {
				frappe.model.sync(r.message);
				frappe.get_doc(r.message.doctype, r.message.name).__run_link_triggers = false;
				this.set_pos_profile_data().then(() => {
					frappe.dom.unfreeze();
				});
			}
		});
	}

	set_pos_profile_data() {
		if (this.company && !this.frm.doc.company) this.frm.doc.company = this.company;
		if ((this.pos_profile && !this.frm.doc.pos_profile) | (this.frm.doc.is_return && this.pos_profile != this.frm.doc.pos_profile)) {
			this.frm.doc.pos_profile = this.pos_profile;
		}

		if (!this.frm.doc.company) return;

		return this.frm.trigger("set_pos_data");
	}

	set_pos_profile_status() {
		this.page.set_indicator(this.pos_profile, "blue");
	}

	async on_cart_update(args) {
		const warehouse = this.frm.doc.set_warehouse || this.settings.warehouse;

		frappe.dom.freeze();
		let item_row = undefined;
		try {
			let { field, value, item } = args;

			item_row = this.get_item_from_frm(item);
			const item_row_exists = !$.isEmptyObject(item_row);

			const from_selector = field === 'qty' && value === "+1";
			if (from_selector)
				value = flt(item_row.stock_qty) + flt(value);

			if (item_row_exists) {
				if (field === 'qty')
					value = flt(value);

				// if (['qty', 'conversion_factor'].includes(field) && value > 0 && !this.allow_negative_stock) {
				// 	const qty_needed = field === 'qty' ? value * item_row.conversion_factor : item_row.qty * value;
				// 	await this.check_stock_availability(item_row, qty_needed, warehouse);
				// }

				if (this.is_current_item_being_edited(item_row) || from_selector) {
					await frappe.model.set_value(item_row.doctype, item_row.name, field, value);
					this.update_cart_html(item_row);
				}

			} else {
				if (!this.frm.doc.customer)
					return this.raise_customer_selection_alert();

				const { item_code, batch_no, serial_no, price_list_rate } = item;
				const discount = this.customer_details.special_discount;

				if (!item_code)
					return;
	
				const new_item = { item_code, batch_no,
						[field]: value 
					};

				if (serial_no) {
					await this.check_serial_no_availablilty(item_code, warehouse, serial_no);
					new_item['serial_no'] = serial_no;
				}

				if (field === 'serial_no')
					new_item['qty'] = value.split(`\n`).length || 0;

				item_row = this.frm.add_child('items', new_item);


				// if (field === 'qty' && value !== 0 && !this.allow_negative_stock) {
				// 	const qty_needed = value * item_row.conversion_factor;
				// 	await this.check_stock_availability(item_row, qty_needed, warehouse);
				// }
				await this.trigger_new_item_events(item_row);

				if (discount > 0){
					// discount customer special discount percentage
					const rate_after_disc = price_list_rate * (1 - (discount / 100));
					// round to nearest multiple of five
					const new_rate = Math.round(rate_after_disc/5)*5;
					const final_percentage = flt(((new_rate - price_list_rate)/price_list_rate)*100, 2);
					await frappe.model.set_value(item_row.doctype, item_row.name, "rate", new_rate);
				}

				this.update_cart_html(item_row);

				// if (this.item_details.$component.is(':visible'))
				// 	this.edit_item_details_of(item_row);

				if (this.check_serial_batch_selection_needed(item_row) && !this.item_details.$component.is(':visible'))
					this.edit_item_details_of(item_row);
			}

		} catch (error) {
			console.log(error);
		} finally {
			frappe.dom.unfreeze();
			return item_row;
		}
	}

	raise_customer_selection_alert() {
		frappe.dom.unfreeze();
		frappe.show_alert({
			message: __('You must select a customer before adding an item.'),
			indicator: 'orange'
		});
		frappe.utils.play_sound("error");
	}

	get_item_from_frm({ name, item_code, batch_no, uom, rate }) {
		let item_row = null;
		if (name) {
			item_row = this.frm.doc.items.find(i => i.name == name);
		} else {
			// if item is clicked twice from item selector
			// then "item_code, batch_no, uom, rate" will help in getting the exact item
			// to increase the qty by one
			const has_batch_no = batch_no;
			item_row = this.frm.doc.items.find(
				i => i.item_code === item_code
					&& (!has_batch_no || (has_batch_no && i.batch_no === batch_no))
					&& (i.uom === uom)
					&& (i.rate == rate)
			);
		}

		return item_row || {};
	}

	edit_item_details_of(item_row) {
		this.item_details.toggle_item_details_section(item_row);
	}

	is_current_item_being_edited(item_row) {
		return item_row.name == this.item_details.current_item.name;
	}

	update_cart_html(item_row, remove_item) {
		this.cart.update_item_html(item_row, remove_item);
		this.cart.update_totals_section(this.frm);
	}

	check_serial_batch_selection_needed(item_row) {
		// right now item details is shown for every type of item.
		// if item details is not shown for every item then this fn will be needed
		const serialized = item_row.has_serial_no;
		const batched = item_row.has_batch_no;
		const no_serial_selected = !item_row.serial_no;
		const no_batch_selected = !item_row.batch_no;

		if ((serialized && no_serial_selected) || (batched && no_batch_selected) ||
			(serialized && batched && (no_batch_selected || no_serial_selected))) {
			return true;
		}
		return false;
	}

	async trigger_new_item_events(item_row) {
		await this.frm.script_manager.trigger('item_code', item_row.doctype, item_row.name);
		await this.frm.script_manager.trigger('qty', item_row.doctype, item_row.name);
	}

	async check_stock_availability(item_row, qty_needed, warehouse) {
		const resp = (await this.get_available_stock(item_row.item_code, warehouse)).message;

		const available_qty = resp[0];
		const is_stock_item = resp[1];

		frappe.dom.unfreeze();
		const bold_item_code = item_row.item_code.bold();
		const bold_warehouse = warehouse.bold();
		const bold_available_qty = available_qty.toString().bold()
		if (!(available_qty > 0)) {
			if (is_stock_item) {
				frappe.model.clear_doc(item_row.doctype, item_row.name);
				frappe.throw({
					title: __("Not Available"),
					message: __('Item Code: {0} is not available under warehouse {1}.', [bold_item_code, bold_warehouse])
				});
			} else {
				return;
			}
		} else if (is_stock_item && available_qty < qty_needed) {
			frappe.throw({
				message: __('Stock quantity not enough for Item Code: {0} under warehouse {1}. Available quantity {2}.', [bold_item_code, bold_warehouse, bold_available_qty]),
				indicator: 'orange'
			});
			frappe.utils.play_sound("error");
		}
		frappe.dom.freeze();
	}

	async check_serial_no_availablilty(item_code, warehouse, serial_no) {
		const method = "erpnext.stock.doctype.serial_no.serial_no.get_pos_reserved_serial_nos";
		const args = {filters: { item_code, warehouse }}
		const res = await frappe.call({ method, args });
		if (res.message.includes(serial_no)) {
			frappe.throw({
				title: __("Not Available"),
				message: __('Serial No: {0} has already been transacted into another POS Invoice.', [serial_no.bold()])
			});
		}
	}

	get_available_stock(item_code, warehouse) {
		const me = this;
		
		return frappe.call({
			method: "erpnext.accounts.doctype.pos_invoice.pos_invoice.get_stock_availability",
			args: {
				'item_code': item_code,
				'warehouse': warehouse,
			},
			callback(res) {
				if (!me.item_stock_map[item_code])
					me.item_stock_map[item_code] = {};
				me.item_stock_map[item_code][warehouse] = res.message;
			}
		});
	}

	update_item_field(value, field_or_action) {
		if (field_or_action === 'checkout') {
			this.item_details.toggle_item_details_section(null);
		} else if (field_or_action === 'remove') {
			this.remove_item_from_cart();
		} else {
			const field_control = this.item_details[`${field_or_action}_control`];
			if (!field_control) return;
			field_control.set_focus();
			value != "" && field_control.set_value(value);
		}
	}

	remove_item_from_cart() {
		frappe.dom.freeze();
		const { doctype, name, current_item } = this.item_details;

		return frappe.model.set_value(doctype, name, 'qty', 0)
			.then(() => {
				frappe.model.clear_doc(doctype, name);
				this.update_cart_html(current_item, true);
				this.item_details.toggle_item_details_section(null);
				frappe.dom.unfreeze();
			})
			.catch(e => console.log(e));
	}

	async save_and_checkout() {
		const limit_cashiers = this.settings.limit_cashiers;
		const is_cashier = frappe.user.has_role('كاشير');
		const enable_pay = (is_cashier == true && limit_cashiers == true) || 
					(limit_cashiers == false) ? 1 : 0;
		this.frm.set_value("is_pos", enable_pay);

		if (this.frm.is_dirty()) {
			let save_error = false;
			await this.frm.save(null, null, null, () => save_error = true);
			// only move to payment section if save is successful
			!save_error && this.payment.checkout();
			// show checkout button on error
			save_error && setTimeout(() => {
				this.cart.toggle_checkout_btn(true);
			}, 300); // wait for save to finish
		} else {
			this.payment.checkout();
		}
	}
};
