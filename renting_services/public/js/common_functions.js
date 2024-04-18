frappe.provide("renting_services.item_process");

renting_services.common = {
	setup_renting_controller: function () {
		renting_services.item_process.CommonFunctions = class CommonFunctions extends frappe.ui.form.Controller {
            doctypes_defaults = {
                "Cleaning": {
                    btn_grp_label: __('إجراءات التنظيف'), 
                    finish_method: "finish_cleaning", 
                    part_finish: __("اكمال جزئي/صيانة"), 
                    finish: __("اكمال/صيانة"),
                    next_step_doc: "Repair",
                    next_note_label: "ملاحظات من قسم النظافة: ",
                    dialog_title: __("تسليم جزئي للصيانة")},
                "Repair": {
                    btn_grp_label: __('إجراءات الصيانة'), 
                    finish_method: "finish_repair", 
                    part_finish: __("إرسال جزئي للمحل"), 
                    finish: __("إرسال للمحل"),
                    next_step_doc: "Store Recieve Item",
                    next_note_label: "ملاحظات من قسم الصيانة: ",
                    dialog_title: __("تسليم جزئي للمحل")},
                "Store Recieve Item": {
                    btn_grp_label: __('إجراءات المراجعة'), 
                    finish_method: "recieve_all", 
                    part_finish: __("قبول جزئي للفساتين"), 
                    finish: __("قبول الفساتين"),
                    next_step_doc: ""},
            }
            refresh(doc){
                const frm = this.frm;
                const btn_grp_label = this.doctypes_defaults[frm.doctype].btn_grp_label;
                if (doc.docstatus == 1) {
                    if(!doc.employee && frm.doctype !== "Store Recieve Item"){
                        frm.add_custom_button(
                        	__('قبول'),
                        	() => this.assign_to(),
                        	btn_grp_label
                        );
                        if(frappe.user.has_role("System Manager")){
                            this.frm.add_custom_button(
                                __('تكليف'),
                                () => this.assign_to(),
                                btn_grp_label
                            );
                        }
                    }

                    if(doc.total_ready !== doc.total_qty && doc.status!=='إنتظار'){
                        // Partial Finsih repair/cleaning BTN
                        frm.add_custom_button(
                            this.doctypes_defaults[frm.doctype].part_finish,
                            () => this.choose_dialog({
                                frm: frm,
                                child_docname: "items",
                                child_doctype: "Process Items",
                                cannot_add_row: true,
                            }),
                            btn_grp_label
                        );
                        
                        // complete finish repair/cleaning BTN
                        frm.add_custom_button(
                            this.doctypes_defaults[frm.doctype].finish,
                            () => this.add_notes(doc), //notes dialog before finish clean/repair
                            btn_grp_label
                        );
                    }
                    frm.page.set_inner_btn_group_as_primary(btn_grp_label);
		        }
            }
            choose_dialog(opts){
                const frm = opts.frm;
                const cannot_add_row = true;
                const child_docname = (typeof opts.cannot_add_row === 'undefined') ? "items" : opts.child_docname;
                // const child_meta = frappe.get_meta(`Process Items`);
                const next_step_doc = this.doctypes_defaults[frm.doctype].next_step_doc;
                const next_note_label = this.doctypes_defaults[frm.doctype].next_note_label;
                
                let data = frm.doc[opts.child_docname].map((d) => {
                    return {
                        "docname": d.name,
                        "name": d.name,
                        "item_code": d.item_code,
                        "item_name": d.item_name,
                        "qty": d.qty,
                        "ready_qty": d.ready_qty
                    }
                });
        
                const fields = [
                    {
                        fieldtype:'Data',
                        fieldname:"docname",
                        read_only: 1,
                        hidden: 1,
                    }, {
                        fieldtype:'Link',
                        fieldname:"item_code",
                        options: 'Item',
                        in_list_view: 0,
                        read_only: 1,
                        disabled: 0,
                        label: __('(أشر بالماوس لعرض الاسم) الصنف'),
                        get_query: function() {
                            let filters;
                            return {
                                query: "erpnext.controllers.queries.item_query",
                                filters: filters
                            };
                        }
                    },
                    {
                        fieldtype:'Data',
                        fieldname:"item_name",
                        in_list_view: 1,
                        read_only: 1,
                        disabled: 0,
                        label: __('إسم الصنف'),
                    },
                    {
                        fieldtype:'Int',
                        fieldname:"qty",
                        read_only: 1,
                        in_list_view: 1,
                        label: __('الكمية')
                    }, {
                        fieldtype:'Int',
                        fieldname:"ready_qty",
                        default: 0,
                        read_only: 0,
                        in_list_view: 1,
                        reqd: 1,
                        label: __('الكمية (جاهز)')
                    },
                    {
                        fieldtype:'Text',
                        fieldname:"notes",
                        in_list_view: 1,
                        label: __('ملاحظات'),
                    }
                ];
        
                let d = new frappe.ui.Dialog({
                    title: this.doctypes_defaults[frm.doctype].dialog_title,
                    size: "large",
                    fields: [
                        {
                            fieldname: "trans_items",
                            fieldtype: "Table",
                            label: "Items",
                            cannot_add_rows: cannot_add_row,
                            in_place_edit: false,
                            reqd: 1,
                            data: data,
                            get_data: () => {
                                return data;
                            },
                            fields: fields
                        },
                    ],
                    primary_action: function() {
                        const trans_items = this.get_values()["trans_items"].filter((item) => !!item.item_code);
                        const new_notes = trans_items
                            .filter(i => i.notes)
                            .map(i => `${i.item_name}:  ${i.notes}`);
                        var final_notes = frm.doc.notes;
                        if (new_notes.length) 
                            final_notes += ` <br><br> ${next_note_label} <br> ${new_notes}`;

                        frappe.call({
                            method: 'renting_services.utils.utils.update_child_ready_qty',
                            freeze: true,
                            args: {
                                'parent_doctype': frm.doc.doctype,
                                'trans_items': trans_items,
                                'parent_doctype_name': frm.doc.name,
                                'child_docname': child_docname,
                                "next_step_doc": next_step_doc,
                                "new_notes": final_notes
                            },
                            callback: function(r) {
                                if (r.message){
                                    frm.reload_doc();
                                    d.hide();
                                    refresh_field("items");
                                }
                            }
                        });
            
                    },
                    primary_action_label: __('تحديث')
                });
                d.show();
            
            }
            add_notes(doc){
                const me = this;
                let data = doc.items.map((d) => {
                    return {
                        "item_name": d.item_name,
                        "notes": ''
                    }
                });
                const fields = [
                    {
                        fieldtype:'Data',
                        // fieldname:"item_code",
                        fieldname:"item_name",
                        in_list_view: 1,
                        read_only: 1,
                        disabled: 0,
                        label: __('الصنف'),
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
                    primary_action_label: 'موافق',
                    primary_action(values) {
                        const notes = values.items_notes
                            .filter(i => i.notes)
                            .map(i => `${i.item_name}:  ${i.notes}`);
                        frappe.call({doc: doc,
                            method: me.doctypes_defaults[me.frm.doctype].finish_method,
                            args: {"new_notes": notes},
                            callback: function(r){
                                me.frm.reload_doc();
                                refresh_field("items");
                        }})
                        d.hide();
                    }
                });
                d.show();
            }
            assign_to(){
                const me = this;
                
                let d = new frappe.ui.Dialog({
                    title: 'قبول / تكليف',
                    fields: [
                        {
                            label: 'تكليف موظف (اختياري)',
                            fieldname: 'employee',
                            fieldtype: 'Link',
                            options: 'User',
                            ignore_user_permissions: 1,
                            read_only_depends_on: (!frappe.user.has_role('System Manager'))
                        }
                    ],
                    size: 'small', // small, large, extra-large 
                    primary_action_label: 'قبول/تكيلف',
                    primary_action(values) {
                        // do if has certain role here
                        let user = values['employee'] || null;
                        me.frm.call({
                            doc: me.frm.doc,
                            method: "assign_to",
                            args: {"user": user}
                        });
                        d.hide();
                    }
                });
                d.show();
            }
        }
    }
}