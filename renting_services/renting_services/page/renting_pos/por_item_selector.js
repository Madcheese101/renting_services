import onScan from 'onscan.js';

renting_services.PointOfRent.ItemSelector = class {
	// eslint-disable-next-line no-unused-vars
	constructor({ frm, wrapper, events, pos_profile, settings }) {
		this.wrapper = wrapper;
		this.events = events;
		this.pos_profile = pos_profile;
		this.hide_images = settings.hide_images;
		this.auto_add_item = settings.auto_add_item_to_cart;
		this.occ_date_value = null;
		this.before_date = null;
		this.after_date = null;
		this.occ_duration = null;
		this.allowed_rent_period = settings.allowed_rent_period;
		this.no_rented = 0;
		this.inti_component();
	}

	inti_component() {
		this.prepare_dom();
		this.make_search_bar();
		this.load_items_data();
		this.bind_events();
		this.attach_shortcuts();
	}

	prepare_dom() {
		this.wrapper.append(
			`<section class="items-selector">
				<div class="filter-section">
					<div class="label">${__('All Items')}</div>
					<div class="search-field"></div>
					<div class="occ-date-field"></div>
					<div class="duration-field"></div>
				</div>
				<div class="filter-section-second-line">
					<div class="no-rented-check"></div>
				</div>
				<div class="items-container"></div>
			</section>`
		);

		this.$component = this.wrapper.find('.items-selector');
		this.$items_container = this.$component.find('.items-container');
	}

	async load_items_data() {
		if (!this.item_group) {
			const res = await frappe.db.get_value("Item Group", {lft: 1, is_group: 1}, "name");
			this.parent_item_group = res.message.name;
		}
		if (!this.price_list) {
			const res = await frappe.db.get_value("POS Profile", this.pos_profile, "selling_price_list");
			this.price_list = res.message.selling_price_list;
		}

		this.get_items({}).then(({message}) => {
			this.render_item_list(message.items);
		});
	}

	get_items({start = 0, page_length = 40, search_term=''}) {
		const doc = this.events.get_frm().doc;
		const price_list = (doc && doc.selling_price_list) || this.price_list;
		let { item_group, pos_profile, 
			no_rented, before_date, after_date } = this;

		!item_group && (item_group = this.parent_item_group);

		return frappe.call({
			method: "renting_services.renting_services.page.renting_pos.renting_pos.get_items",
			freeze: true,
			args: { start, page_length, price_list, 
				item_group, search_term, pos_profile, no_rented,
			before_date, after_date },
		});
	}


	render_item_list(items) {
		this.$items_container.html('');

		items.forEach(item => {
			const item_html = this.get_item_html(item);
			this.$items_container.append(item_html);
		});
	}

	get_item_html(item) {
		const me = this;
		// eslint-disable-next-line no-unused-vars
		const { item_image, serial_no, batch_no, barcode, actual_qty, stock_uom, price_list_rate } = item;
		const precision = flt(price_list_rate, 2) % 1 != 0 ? 2 : 0;
		let indicator_color;
		let qty_to_display = actual_qty;

		if (item.is_stock_item) {
			indicator_color = (actual_qty > 10 ? "green" : actual_qty <= 0 ? "red" : "orange");

			if (Math.round(qty_to_display) > 999) {
				qty_to_display = Math.round(qty_to_display)/1000;
				qty_to_display = qty_to_display.toFixed(1) + 'K';
			}
		} else {
			indicator_color = '';
			qty_to_display = '';
		}

		function get_item_image_html() {
			if (!me.hide_images && item_image) {
				return `<div class="item-qty-pill">
							<span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
						</div>
						<div class="flex items-center justify-center h-32 border-b-grey text-6xl text-grey-100">
							<img
								onerror="cur_pos.item_selector.handle_broken_image(this)"
								class="h-full item-img" src="${item_image}"
								alt="${frappe.get_abbr(item.item_name)}"
							>
						</div>`;
			} else {
				return `<div class="item-qty-pill">
							<span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
						</div>
						<div class="item-display abbr">${frappe.get_abbr(item.item_name)}</div>`;
			}
		}

		return (
			`<div class="item-wrapper"
				data-item-code="${escape(item.item_code)}" data-serial-no="${escape(serial_no)}"
				data-batch-no="${escape(batch_no)}" data-uom="${escape(stock_uom)}"
				data-rate="${escape(price_list_rate || 0)}"
				title="${item.item_name}">

				${get_item_image_html()}

				<div class="item-detail">
					<div class="item-name">
						${frappe.ellipsis(item.item_name, 18)}
					</div>
					<div class="item-rate">${format_currency(price_list_rate, item.currency, precision) || 0}</div>
				</div>
			</div>`
		);
	}

	handle_broken_image($img) {
		const item_abbr = $($img).attr('alt');
		$($img).parent().replaceWith(`<div class="item-display abbr">${item_abbr}</div>`);
	}

	make_search_bar() {
		const me = this;
		const doc = me.events.get_frm().doc;
		this.$component.find('.search-field').html('');
		this.$component.find('.occ-date-field').html('');
		this.$component.find('.duration-field').html('');
		this.$component.find('.no-rented-check').html('');

		this.search_field = frappe.ui.form.make_control({
			df: {
				label: __('Search'),
				fieldtype: 'Data',
				placeholder: __('Search by item code, serial number or barcode')
			},
			parent: this.$component.find('.search-field'),
			render_input: true,
		});
		this.occ_date_field = frappe.ui.form.make_control({
			df: {
				label: __('تاريخ المناسبة'),
				fieldtype: 'Date',
				placeholder: __('إختر تاريخ المناسبة'),
			},
			parent: this.$component.find('.occ-date-field'),
			render_input: true,
		});
		this.duration_field = frappe.ui.form.make_control({
			df: {
				label: __('مدة الحجز'),
				fieldtype: 'Select',
				options: [1,2],
				onchange: function() {
					me.occ_duration = this.value;
					me.events.set_occ_duration(this.value)
					if(me.no_rented==1){
						me.filter_items();
					}
				},
			},
			parent: this.$component.find('.duration-field'),
			render_input: true,
		});
		this.no_rented_check = frappe.ui.form.make_control({
			df: {
				label: __('عرض المتوفر فقط؟'),
				fieldtype: 'Check',
				onchange: function() {
					if(this.value !== me.no_rented){
						me.no_rented = this.value;
						me.filter_items();
					}			
				},
			},
			parent: this.$component.find('.no-rented-check'),
			render_input: true,
		});
		
		this.duration_field.set_value(1);
		this.attach_clear_btn();
	}

	set_dates(date){
		if (!date){
			this.events.set_occ_date(date);
			this.occ_date_value = date;
			this.before_date = date;
			this.after_date = date;
			this.toggle_dur_field(false);
			this.toggle_items(date);
			return;
		}
		if(this.allowed_rent_period > 0){
			let	date_diff = frappe.datetime.get_day_diff(date, frappe.datetime.nowdate());
			if(date_diff > this.allowed_rent_period){
				this.events.set_occ_date(null);
				this.occ_date_value = date;
				this.toggle_items(false);
				
				frappe.throw({
					message: __('تاريخ الحجز لا يمكن أن يتجاوز {0} يوم من تاريخ اليوم', [this.allowed_rent_period]),
					indicator: 'red'
				});
				frappe.utils.play_sound("error");

			}else{
				this.events.set_occ_date(date);
				this.occ_date_value = date;
				this.before_date = frappe.datetime.add_days(this.occ_date_value, -1);
				this.after_date = frappe.datetime.add_days(
					this.occ_date_value, this.occ_duration);
				this.toggle_dur_field(true);
				this.toggle_items(true);
			}
		}else{
			this.events.set_occ_date(date);
			this.occ_date_value = date;
			this.before_date = frappe.datetime.add_days(this.occ_date_value, -1);
			this.after_date = frappe.datetime.add_days(
				this.occ_date_value, this.occ_duration);
			this.toggle_dur_field(true);
			this.toggle_items(true);
		}
	}
	attach_clear_btn() {
		this.search_field.$wrapper.find('.control-input').append(
			`<span class="link-btn" style="top: 2px;">
				<a class="btn-open no-decoration" title="${__("Clear")}">
					${frappe.utils.icon('close', 'sm')}
				</a>
			</span>`
		);

		this.$clear_search_btn = this.search_field.$wrapper.find('.link-btn');

		this.$clear_search_btn.on('click', 'a', () => {
			this.set_search_value('');
			this.search_field.set_focus();
		});
	}
	
	set_search_value(value) {
		$(this.search_field.$input[0]).val(value).trigger("input");
	}

	bind_events() {
		const me = this;
		window.onScan = onScan;

		onScan.decodeKeyEvent = function (oEvent) {
			var iCode = this._getNormalizedKeyNum(oEvent);
			switch (true) {
				case iCode >= 48 && iCode <= 90: // numbers and letters
				case iCode >= 106 && iCode <= 111: // operations on numeric keypad (+, -, etc.)
				case (iCode >= 160 && iCode <= 164) || iCode == 170: // ^ ! # $ *
				case iCode >= 186 && iCode <= 194: // (; = , - . / `)
				case iCode >= 219 && iCode <= 222: // ([ \ ] ')
				case iCode == 32: // spacebar
					if (oEvent.key !== undefined && oEvent.key !== '') {
						return oEvent.key;
					}

					var sDecoded = String.fromCharCode(iCode);
					switch (oEvent.shiftKey) {
						case false: sDecoded = sDecoded.toLowerCase(); break;
						case true: sDecoded = sDecoded.toUpperCase(); break;
					}
					return sDecoded;
				case iCode >= 96 && iCode <= 105: // numbers on numeric keypad
					return 0 + (iCode - 96);
			}
			return '';
		};

		onScan.attachTo(document, {
			onScan: (sScancode) => {
				if (this.search_field && this.$component.is(':visible')) {
					this.search_field.set_focus();
					this.set_search_value(sScancode);
					this.barcode_scanned = true;
				}
			}
		});

		this.$component.on('click', '.item-wrapper', function() {
			if (me.occ_date_value){
				const $item = $(this);
				const item_code = unescape($item.attr('data-item-code'));
				let batch_no = unescape($item.attr('data-batch-no'));
				let serial_no = unescape($item.attr('data-serial-no'));
				let uom = unescape($item.attr('data-uom'));
				let rate = unescape($item.attr('data-rate'));
				// escape(undefined) returns "undefined" then unescape returns "undefined"
				batch_no = batch_no === "undefined" ? undefined : batch_no;
				serial_no = serial_no === "undefined" ? undefined : serial_no;
				uom = uom === "undefined" ? undefined : uom;
				rate = rate === "undefined" ? undefined : rate;
				
				frappe.db.get_doc('Item', item_code)
				.then(doc => {
					let dd = doc;
					dd.price_list_rate = rate;
					me.events.item_selected(dd);
				});
				me.search_field.set_focus();
			}else{
				frappe.show_alert({
					message: __("الرجاء إختيار تاريخ المناسبة أولاً"),
					indicator: "red"
				});
			}
			
		});

		this.search_field.$input.on('input', (e) => {
			clearTimeout(this.last_search);
			this.last_search = setTimeout(() => {
				const search_term = e.target.value;
				this.filter_items({ search_term });
			}, 300);

			this.$clear_search_btn.toggle(
				Boolean(this.search_field.$input.val())
			);
		});

		this.search_field.$input.on('focus', () => {
			this.$clear_search_btn.toggle(
				Boolean(this.search_field.$input.val())
			);
		});

		this.occ_date_field.$input.on('change', (value) => {
			let new_val = value.target.value
			let correct_date = new_val.split('-').reverse().join('-');
			if(correct_date == "" && correct_date !== me.occ_date_value){
				this.no_rented_check.set_value(0);
			}
			if(correct_date !== me.occ_date_value){
				me.set_dates(correct_date);
				if(me.no_rented){
					me.filter_items()
				}
			}
			
		});
	}

	attach_shortcuts() {
		const ctrl_label = frappe.utils.is_mac() ? '⌘' : 'Ctrl';
		this.search_field.parent.attr("title", `${ctrl_label}+I`);
		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+i",
			action: () => this.search_field.set_focus(),
			condition: () => this.$component.is(':visible'),
			description: __("Focus on search input"),
			ignore_inputs: true,
			page: cur_page.page.page
		});
		// this.item_group_field.parent.attr("title", `${ctrl_label}+G`);
		// frappe.ui.keys.add_shortcut({
		// 	shortcut: "ctrl+g",
		// 	action: () => this.item_group_field.set_focus(),
		// 	condition: () => this.$component.is(':visible'),
		// 	description: __("Focus on Item Group filter"),
		// 	ignore_inputs: true,
		// 	page: cur_page.page.page
		// });

		// for selecting the last filtered item on search
		frappe.ui.keys.on("enter", () => {
			const selector_is_visible = this.$component.is(':visible');
			if (!selector_is_visible || this.search_field.get_value() === "") return;

			if (this.items.length == 1) {
				this.$items_container.find(".item-wrapper").click();
				frappe.utils.play_sound("submit");
				this.set_search_value('');
			} else if (this.items.length == 0 && this.barcode_scanned) {
				// only show alert of barcode is scanned and enter is pressed
				frappe.show_alert({
					message: __("No items found. Scan barcode again."),
					indicator: 'orange'
				});
				frappe.utils.play_sound("error");
				this.barcode_scanned = false;
				this.set_search_value('');
			}
		});
	}

	filter_items({ search_term='' }={}) {
		if (search_term) {
			search_term = search_term.toLowerCase();

			// memoize
			this.search_index = this.search_index || {};
			if (this.search_index[search_term]) {
				const items = this.search_index[search_term];
				this.items = items;
				this.render_item_list(items);
				this.auto_add_item && this.items.length == 1 && this.add_filtered_item_to_cart();
				return;
			}
		}

		this.get_items({ search_term })
			.then(({ message }) => {
				// eslint-disable-next-line no-unused-vars
				const { items, serial_no, batch_no, barcode } = message;
				if (search_term && !barcode) {
					this.search_index[search_term] = items;
				}
				this.items = items;
				this.render_item_list(items);
				this.auto_add_item && this.items.length == 1 && this.add_filtered_item_to_cart();
			});
	}

	add_filtered_item_to_cart() {
		this.$items_container.find(".item-wrapper").click();
		this.set_search_value('');
	}

	resize_selector(args) {
		args.minimize && args.doctype === "Item" ?
			this.$component.css('display', 'none') : 
			this.$component.css('display', 'flex');

		args.minimize ?
			this.$component.find('.filter-section').css('grid-template-columns', 'repeat(1, minmax(0, 1fr))') :
			this.$component.find('.filter-section').css('grid-template-columns', 'repeat(12, minmax(0, 1fr))');

		args.minimize ?
			this.$component.find('.search-field').css('margin', 'var(--margin-sm) 0px') :
			this.$component.find('.search-field').css('margin', '0px var(--margin-sm)');

		args.minimize ?
			this.$component.css('grid-column', 'span 2 / span 2') :
			this.$component.css('grid-column', 'span 6 / span 6');

		args.minimize ?
			this.$items_container.css('grid-template-columns', 'repeat(1, minmax(0, 1fr))') :
			this.$items_container.css('grid-template-columns', 'repeat(4, minmax(0, 1fr))');
	}

	toggle_dur_field(show){
		show ?
			this.$component.find('.duration-field').css('display', 'flex') :
			this.$component.find('.duration-field').css('display', 'none');
		show ?
			this.$component.find('.occ-date-field').css('grid-column', 'span 3 / span 3') :
			this.$component.find('.occ-date-field').css('grid-column', 'span 5 / span 5');

		// manage no-rented-check display
		show ?
			this.$component.find('.no-rented-check').css('display', 'flex') :
			this.$component.find('.no-rented-check').css('display', 'none');
		show ?
			this.$component.find('.no-rented-check').css('grid-column', 'span 3 / span 3') :
			this.$component.find('.no-rented-check').css('grid-column', 'span 5 / span 5');
	}
	toggle_items(show) {
		this.$component.find('.items-container').css('display', show ? 'grid': 'none');
	}
	toggle_component(show) {
		this.set_search_value('');
		this.$component.css('display', show ? 'flex': 'none');
	}
};
