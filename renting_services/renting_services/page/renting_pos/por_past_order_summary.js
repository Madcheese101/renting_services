renting_services.PointOfRent.PastOrderSummary = class {
	constructor({ wrapper, limit_cashiers, events }) {
		this.wrapper = wrapper;
		this.events = events;
		this.limit_cashiers = limit_cashiers;
		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.init_email_print_dialog();
		this.bind_events();
		this.attach_shortcuts();
	}

	prepare_dom() {
		this.wrapper.append(
			`<section class="past-order-summary">
				<div class="no-summary-placeholder">
					${__('Select an invoice to load summary data')}
				</div>
				<div class="invoice-summary-wrapper">
					<div class="abs-container">
						<div class="upper-section"></div>
						<div class="label">${__('Items')}</div>
						<div class="items-container summary-container"></div>
						<div class="label">${__('Totals')}</div>
						<div class="totals-container summary-container"></div>
						<div class="label">${__('Payments')}</div>
						<div class="payments-container summary-container"></div>
						<div class="summary-btns"></div>
					</div>
				</div>
			</section>`
		);

		this.$component = this.wrapper.find('.past-order-summary');
		this.$summary_wrapper = this.$component.find('.invoice-summary-wrapper');
		this.$summary_container = this.$component.find('.abs-container');
		this.$upper_section = this.$summary_container.find('.upper-section');
		this.$items_container = this.$summary_container.find('.items-container');
		this.$totals_container = this.$summary_container.find('.totals-container');
		this.$payment_container = this.$summary_container.find('.payments-container');
		this.$summary_btns = this.$summary_container.find('.summary-btns');
	}

	init_email_print_dialog() {
		const email_dialog = new frappe.ui.Dialog({
			title: 'Email Receipt',
			fields: [
				{fieldname: 'email_id', fieldtype: 'Data', options: 'Email', label: 'Email ID'},
				// {fieldname:'remarks', fieldtype:'Text', label:'Remarks (if any)'}
			],
			primary_action: () => {
				this.send_email();
			},
			primary_action_label: __('Send'),
		});
		this.email_dialog = email_dialog;

		const print_dialog = new frappe.ui.Dialog({
			title: 'Print Receipt',
			fields: [
				{fieldname: 'print', fieldtype: 'Data', label: 'Print Preview'}
			],
			primary_action: () => {
				this.print_receipt();
			},
			primary_action_label: __('Print'),
		});
		this.print_dialog = print_dialog;
	}

	get_upper_section_html(doc) {
		const { status } = doc;
		let indicator_color = '';

		in_list(['Paid', 'Consolidated'], status) && (indicator_color = 'green');
		status === 'Draft' && (indicator_color = 'red');
		status === 'Return' && (indicator_color = 'grey');
		indicator_color = indicator_color || 'yellow';
		
		return `<div class="left-section">
					<div class="customer-name">${doc.customer}</div>
					<div class="customer-email">${this.customer_email}</div>
					<div class="cashier">${__('Sold by')}: ${doc.owner}</div>
				</div>
				<div class="right-section">
					<div class="paid-amount">${format_currency(doc.paid_amount, doc.currency)}</div>
					<div class="invoice-name">${doc.name}</div>
					<div>
						<span class="indicator-pill whitespace-nowrap ${indicator_color}"><span>${doc.status}</span></span>
						<span class="indicator-pill whitespace-nowrap blue"><span>${doc.rent_status}</span></span>
					</div>
				</div>`;
	}

	get_item_html(doc, item_data) {
		return `<div class="item-row-wrapper">
					<div class="item-name">${item_data.item_name}</div>
					<div class="item-qty">${item_data.qty || 0}</div>
					<div class="item-rate-disc">${get_rate_discount_html()}</div>
				</div>`;

		function get_rate_discount_html() {
			if (item_data.rate && item_data.price_list_rate && item_data.rate !== item_data.price_list_rate) {
				return `<span class="item-disc">(${item_data.discount_percentage}% off)</span>
						<div class="item-rate">${format_currency(item_data.rate, doc.currency)}</div>`;
			} else {
				return `<div class="item-rate">${format_currency(item_data.price_list_rate || item_data.rate, doc.currency)}</div>`;
			}
		}
	}

	get_discount_html(doc) {
		if (doc.discount_amount) {
			return `<div class="summary-row-wrapper">
						<div>Discount (${doc.additional_discount_percentage} %)</div>
						<div>${format_currency(doc.discount_amount, doc.currency)}</div>
					</div>`;
		} else {
			return ``;
		}
	}

	get_net_total_html(doc) {
		return `<div class="summary-row-wrapper">
					<div>${__('Net Total')}</div>
					<div>${format_currency(doc.net_total, doc.currency)}</div>
				</div>`;
	}

	get_taxes_html(doc) {
		if (!doc.taxes.length) return '';

		let taxes_html = doc.taxes.map(t => {
			const description = /[0-9]+/.test(t.description) ? t.description : `${t.description} @ ${t.rate}%`;
			return `
				<div class="tax-row">
					<div class="tax-label">${description}</div>
					<div class="tax-value">${format_currency(t.tax_amount_after_discount_amount, doc.currency)}</div>
				</div>
			`;
		}).join('');

		return `<div class="taxes-wrapper">${taxes_html}</div>`;
	}

	get_grand_total_html(doc) {
		return `<div class="summary-row-wrapper grand-total">
					<div>${__('Grand Total')}</div>
					<div>${format_currency(doc.grand_total, doc.currency)}</div>
				</div>`;
	}
	get_outstanding_html(doc) {
		let result = `<div class="summary-row-wrapper grand-total">
			<div>${__('المدفوع')}</div>
			<div>${format_currency(doc.grand_total - doc.outstanding_amount, doc.currency)}</div>
			</div>`;
		if (doc.outstanding_amount > 0){
			result += `
			<div class="summary-row-wrapper grand-total">
				<div>${__('المتبقي')}</div>
				<div>${format_currency(doc.outstanding_amount, doc.currency)}</div>
			</div>
			`
		}
		return result;
	}
	get_payment_html(doc, payment) {
		return `<div class="summary-row-wrapper payments">
					<div>${__(payment.mode_of_payment)}</div>
					<div>${format_currency(payment.amount, doc.currency)}</div>
				</div>`;
	}

	bind_events() {
		this.$summary_container.on('click', '.return-btn', () => {
			this.events.process_return(this.doc.name);
			this.toggle_component(false);
			this.$component.find('.no-summary-placeholder').css('display', 'flex');
			this.$summary_wrapper.css('display', 'none');
		});

		this.$summary_container.on('click', '.edit-btn', () => {
			this.events.edit_order(this.doc.name);
			this.toggle_component(false);
			this.$component.find('.no-summary-placeholder').css('display', 'flex');
			this.$summary_wrapper.css('display', 'none');
		});

		this.$summary_container.on('click', '.delete-btn', () => {
			this.events.delete_order(this.doc.name);
			this.show_summary_placeholder();
		});

		// this.$summary_container.on('click', '.delete-btn', () => {
		// 	this.events.delete_order(this.doc.name);
		// 	this.show_summary_placeholder();
		// 	// this.toggle_component(false);
		// 	// this.$component.find('.no-summary-placeholder').removeClass('d-none');
		// 	// this.$summary_wrapper.addClass('d-none');
		// });

		this.$summary_container.on('click', '.new-btn', () => {
			this.events.new_order();
			this.toggle_component(false);
			this.$component.find('.no-summary-placeholder').css('display', 'flex');
			this.$summary_wrapper.css('display', 'none');
		});

		this.$summary_container.on('click', '.email-btn', () => {
			this.email_dialog.fields_dict.email_id.set_value(this.customer_email);
			this.email_dialog.show();
		});

		this.$summary_container.on('click', '.print-btn', () => {
			this.print_receipt();
		});

		this.$summary_container.on('click', '.confirm-rent-btn', () => {
			this.show_dialog();
		});
		this.$summary_container.on('click', '.deliver-btn', () => {
			this.deliver_dialog();
		});

		this.$summary_container.on('click', '.pay-rent-btn', () => {
			this.show_dialog();
		});

		this.$summary_container.on('click', '.recieve-rent-btn', () => {
			this.return_clean_dialog_notes();
		});

		this.$summary_container.on('click', '.return-points-btn', () => {
			// TODO: 
			// do one of the following:
			// 1. return invoice and add money to customer account
			// 2. cancel invoice and add money to customer account
			// 3. clear customer debt and add balance to his account/or Loyalty Points
			
			// the second option might not be possible due to
			// possible link to payment entry
		});
		this.$summary_container.on('click', '.change-rent-btn', () => {
			// do return invoice
		});
	}

	print_receipt() {
		const frm = this.events.get_frm();
		frappe.utils.print(
			this.doc.doctype,
			this.doc.name,
			frm.pos_print_format,
			this.doc.letter_head,
			this.doc.language || frappe.boot.lang
		);
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

	send_email() {
		const frm = this.events.get_frm();
		const recipients = this.email_dialog.get_values().email_id;
		const doc = this.doc || frm.doc;
		const print_format = frm.pos_print_format;

		frappe.call({
			method: "frappe.core.doctype.communication.email.make",
			args: {
				recipients: recipients,
				subject: __(frm.meta.name) + ': ' + doc.name,
				doctype: doc.doctype,
				name: doc.name,
				send_email: 1,
				print_format,
				sender_full_name: frappe.user.full_name(),
				_lang: doc.language
			},
			callback: r => {
				if (!r.exc) {
					frappe.utils.play_sound("email");
					if (r.message["emails_not_sent_to"]) {
						frappe.msgprint(__(
							"Email not sent to {0} (unsubscribed / disabled)",
							[ frappe.utils.escape_html(r.message["emails_not_sent_to"]) ]
						));
					} else {
						frappe.show_alert({
							message: __('Email sent successfully.'),
							indicator: 'green'
						});
					}
					this.email_dialog.hide();
				} else {
					frappe.msgprint(__("There were errors while sending email. Please try again."));
				}
			}
		});
	}

	add_summary_btns(map) {
		const outstanding_amount = this.doc.outstanding_amount;
		const total = this.doc.total;
		const rent_status = this.doc.rent_status;
		const docstatus = this.doc.docstatus;
		const limit_cashiers = this.limit_cashiers;
		const is_cashier = frappe.user.has_role('كاشير');
		const is_partial = outstanding_amount > 0 && total != outstanding_amount;
		this.$summary_btns.html('');
		map.forEach(m => {
			if (m.condition) {
				m.visible_btns.forEach(b => {
					const class_name = b.split(' ')[0].toLowerCase();
					const btn = __(b);
					this.$summary_btns.append(
						`<div class="summary-btn btn btn-default ${class_name}-btn">${btn}</div>`
					);
				});
			}
		});

		if (docstatus == 1){
			rent_status == 'غير مؤكد' && ((is_cashier == true && limit_cashiers == true) || 
			(limit_cashiers == false)) ? 
				this.$summary_btns.append(
					`<div class="summary-btn btn btn-default confirm-rent-btn">${__('تأكيد الحجز')}</div>`) 
					: '';
			if (rent_status == 'محجوز'){
				this.$summary_btns.append(
					`<div class="summary-btn btn btn-default deliver-btn">${__('تسليم للزبون')}</div>`);
				this.$summary_btns.append(
					`<div class="summary-btn btn btn-default return-points-btn">${__('رصيد للزبون')}</div>`);
				this.$summary_btns.append(
					`<div class="summary-btn btn btn-default change-rent-btn">${__('تغيير الحجز')}</div>`);
			}
			
			rent_status == 'خارج' ? 
				this.$summary_btns.append(
					`<div class="summary-btn btn btn-default recieve-rent-btn">${__('إستلام/تنظيف')}</div>`) 
					: '';
			if (is_partial){
				(is_cashier == true && limit_cashiers == true) || 
				(limit_cashiers == false) ? this.$summary_btns.append(
					`<div class="summary-btn btn btn-default pay-rent-btn">${__('دفع')}</div>`) 
					: '';
			}
			
		}
		
		this.$summary_btns.children().last().removeClass('mr-4');
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

	get_condition_btn_map(after_submission) {
		if (after_submission)
			return [{ condition: true, visible_btns: ['Print Receipt', 'Email Receipt', 'New Order'] }];

		return [
			{ condition: this.doc.docstatus === 0, visible_btns: ['Edit Order', 'Delete Order'] },
			{ condition: !this.doc.is_return && this.doc.docstatus === 1, visible_btns: ['Print Receipt', 'Email Receipt', 'Return']},
			{ condition: this.doc.is_return && this.doc.docstatus === 1, visible_btns: ['Print Receipt', 'Email Receipt']}
		];
	}

	load_summary_of(doc, after_submission=false) {
		after_submission ?
			this.$component.css('grid-column', 'span 10 / span 10') :
			this.$component.css('grid-column', 'span 6 / span 6');

		this.toggle_summary_placeholder(false);

		this.doc = doc;

		this.attach_document_info(doc);

		this.attach_items_info(doc);

		this.attach_totals_info(doc);

		this.attach_payments_info(doc);

		const condition_btns_map = this.get_condition_btn_map(after_submission);
		this.add_summary_btns(condition_btns_map);
	}

	attach_document_info(doc) {
		frappe.db.get_value('Customer', this.doc.customer, 'email_id').then(({ message }) => {
			this.customer_email = message.email_id || '';
			const upper_section_dom = this.get_upper_section_html(doc);
			this.$upper_section.html(upper_section_dom);
		});
	}

	attach_items_info(doc) {
		this.$items_container.html('');
		doc.items.forEach(item => {
			const item_dom = this.get_item_html(doc, item);
			this.$items_container.append(item_dom);
			this.set_dynamic_rate_header_width();
		});
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

	attach_payments_info(doc) {
		this.$payment_container.html('');
		doc.payments.forEach(p => {
			if (p.amount) {
				const payment_dom = this.get_payment_html(doc, p);
				this.$payment_container.append(payment_dom);
			}
		});
		if (doc.redeem_loyalty_points && doc.loyalty_amount) {
			const payment_dom = this.get_payment_html(doc, {
				mode_of_payment: 'Loyalty Points',
				amount: doc.loyalty_amount,
			});
			this.$payment_container.append(payment_dom);
		}
	}

	attach_totals_info(doc) {
		this.$totals_container.html('');

		const net_total_dom = this.get_net_total_html(doc);
		const taxes_dom = this.get_taxes_html(doc);
		const discount_dom = this.get_discount_html(doc);
		const grand_total_dom = this.get_grand_total_html(doc);
		const get_outstanding_dom = this.get_outstanding_html(doc);
		this.$totals_container.append(net_total_dom);
		this.$totals_container.append(taxes_dom);
		this.$totals_container.append(discount_dom);
		this.$totals_container.append(grand_total_dom);
		this.$totals_container.append(get_outstanding_dom);
		
	}

	toggle_component(show) {
		show ? this.$component.css('display', 'flex') : this.$component.css('display', 'none');
	}

	deliver_dialog(){
		const me = this;
		const rent_status = this.doc.rent_status;
		if(rent_status == 'محجوز'){
			let d = new frappe.ui.Dialog({
				title: 'الرجاء تحديد نوع الضمان',
				fields: [
					{
						label: 'نوع الضمان',
						fieldname: 'guarantee_type',
						fieldtype: 'Select',
						options: [
							"موظف",
							"جواز سفر",
							"بطاقة شخصية",
							"رخصة قيادة",
							"كتيب عائلة"
						],
						reqd: 1
					},
				],
				size: 'small', // small, large, extra-large 
				primary_action_label: 'Submit',
				primary_action(values) {
					me.deliver(values.guarantee_type);
					d.hide();
				}
			});
			d.show();
		}
	}
	deliver(guarantee_type){
		const me = this;
		frappe.call({
			method: 'renting_services.renting_services.page.renting_pos.renting_pos.deliver_items',
			args: {
				sales_invoice_doc: this.doc,
				guarantee_type: guarantee_type
			},
			// freeze the screen until the request is completed
			freeze: true,
			callback: (r) => {
				// on success
				me.reload_doc(me.doc.name);
			},
		})
	}
	return_clean_dialog_notes(){
		const me = this;
		let data = this.doc.items.map((d) => {
			return {
				"item_name": d.item_name,
				"notes": ''
			}
		});
		const fields = [
			{
				fieldtype:'Link',
				// fieldname:"item_code",
				fieldname:"item_name",
				options: 'Item',
				in_list_view: 1,
				read_only: 1,
				disabled: 0,
				label: __('الصنف'),

				// label: __('(أشر بالماوس لعرض الاسم) الصنف'),
				// get_query: function() {
				// 		let filters;
				// 		return {
				// 			query: "erpnext.controllers.queries.item_query",
				// 			filters: filters
				// 		};
				// 	}
			},
			{
				fieldtype:'Text',
				fieldname:"notes",
				in_list_view: 1,
				label: __('ملاحظات'),
			}
	
		];
		let d = new frappe.ui.Dialog({
			title: 'الرجاء كتابة أي ملاحظات ان وجدت',
			fields: [
				{
					fieldname: "items_notes",
					fieldtype: "Table",
					label: "Items",
					cannot_add_rows: true,
					in_place_edit: false,
					// reqd: 1,
					data: data,
					get_data: () => {
						return data;
					},
					fields: fields
				},
			],
			size: 'small', // small, large, extra-large 
			primary_action_label: 'إستقبال / إرسال للتنظيف',
			primary_action(values) {
				me.return_clean(values.items_notes);
				d.hide();
			}
		});
		d.show();
	}
	return_clean(items_notes){
		const me = this;
		const notes = items_notes
			.filter(i => i.notes)
			.map(i => `${i.item_name}:  ${i.notes}`);
		frappe.call({
			method: "renting_services.renting_services.page.renting_pos.renting_pos.return_and_clean",
			args: {sales_invoice_doc: this.doc, notes: notes},
			callback: function(r) {
				me.reload_doc(me.doc.name);
			}
		});
	}
	show_dialog(){	
		const me = this;
		frappe.call({
			doc: me.doc,
			method: "get_mode_of_payments",
			callback: function(r) {
				if(r.message && r.message != "nothing"){
					let payments = r.message;
					let d = new frappe.ui.Dialog({
						title: 'Enter details',
						fields: [
							{
								label: 'Payment Details',
								fieldname: 'payments',
								fieldtype: 'Table',
								cannot_add_rows: false,
								in_place_edit: true,
								data: payments,
								fields: [
									{ fieldname: 'mode_of_payment', 
										fieldtype: 'Data', label: 'Payment Mode', in_list_view: 1},
									{ fieldname: 'account', 
										fieldtype: 'Data', label: 'Account'},
									{ fieldname: 'type',
										fieldtype: 'Data', label: 'Type'},
									{ fieldname: 'base_amount', 
										fieldtype: 'Currency', label: 'Amount', in_list_view: 1 }
								]
							}
						],
						size: 'small', // small, large, extra-large 
						primary_action_label: 'دفع',
						async primary_action(values) {
							let payments = values.payments;
							let sum = payments.reduce((acc, curr) => acc + curr.base_amount, 0);
							if (sum > me.doc.outstanding_amount){
								d.hide();
								frappe.throw(__('اجمالي القيمة لا يمكن ان يتجاوز اجمالي الدين المتبقي'));
							}
							frappe.dom.freeze();
							for (const p of payments){
								if(p.base_amount > 0){
									await me.make_rent_payment_entry({"mode_of_payment":p.mode_of_payment,
										"account":p.account,
										"bank_amount":p.base_amount,
										"type":p.type})
								}
							}
							d.hide();
							frappe.dom.unfreeze();
							frappe.show_alert({message:__('تم الدفع بنجاح'), indicator: 'green'});
						}
					});
					d.show();
				}
			}
		});
	}
	async make_rent_payment_entry(payment_details) {
		// do ask for Card Reciet dialog
		let via_journal_entry = this.doc.__onload && this.doc.__onload.make_payment_via_journal_entry;
		let reference_no = "";

		if (payment_details.type == "Bank"){
			reference_no = `${this.doc.name} - ${frappe.datetime.nowdate()}`
		}
		if(this.has_discount_in_schedule() && !via_journal_entry) {
			// If early payment discount is applied, ask user for reference date
			this.prompt_user_for_reference_date();
		} else {
			let args = { "dt": this.doc.doctype,
				"dn": this.doc.name, 
				"party_type":"Customer",
				"mode_of_payment": payment_details.mode_of_payment,
				"bank_account":payment_details.account,
				"bank_amount":payment_details.bank_amount,
				"reference_no":reference_no};
			await this.make_mapped_rent_payment_entry(args);
		}
	}
	has_discount_in_schedule() {
		let is_eligible = in_list(
			["Sales Order", "Sales Invoice", "Purchase Order", "Purchase Invoice"],
			this.doc.doctype
		);
		let has_payment_schedule = this.doc.payment_schedule && this.doc.payment_schedule.length;
		if(!is_eligible || !has_payment_schedule) return false;

		let has_discount = this.doc.payment_schedule.some(row => row.discount);
		return has_discount;
	}
	reload_doc(docname){
		const me = this;
		frappe.db.get_doc('Sales Invoice', docname).then((doc) => {
			me.load_summary_of(doc);
		});
	}
	async make_mapped_rent_payment_entry(args) {
		const me = this;
		const doc_name = this.doc.name;

		args = args || { "dt": this.doc.doctype, "dn": this.doc.name, "party_type":"Customer" };
		return new Promise((resolve) => {
			frappe.call({
				method: "renting_services.overrides.rent_invoice.get_payment_entry",
				args: args,
				callback: async function(r) {
					r.message.mode_of_payment = args.mode_of_payment;
					var doclist = frappe.model.sync(r.message);
					frappe.call(
						{doc: me.doc,
						method:'insert_payment', 
						args:{"pdoc": doclist},
					callback: (r)=>{
						resolve();
						me.reload_doc(doc_name);
					}});
				}
			});
		})
	}
};
