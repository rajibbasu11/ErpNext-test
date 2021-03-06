// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt

{% include 'erpnext/selling/sales_common.js' %}
frappe.provide("erpnext.crm");

cur_frm.email_field = "contact_email";
frappe.ui.form.on("Opportunity", {
	setup: function(frm) {
		frm.custom_make_buttons = {
			'Quotation': 'Quotation',
			'Supplier Quotation': 'Supplier Quotation'
		},

		frm.set_query("opportunity_from", function() {
			return{
				"filters": {
					"name": ["in", ["Customer", "Lead"]],
				}
			}
		});
	},

	party_name: function(frm) {
		if (frm.doc.opportunity_from == "Customer") {
			frm.trigger('set_contact_link');
			erpnext.utils.get_party_details(frm);
		}
	},

	with_items: function(frm) {
		frm.trigger('toggle_mandatory');
	},

	customer_address: function(frm, cdt, cdn) {
		erpnext.utils.get_address_display(frm, 'customer_address', 'address_display', false);
	},

	contact_person: erpnext.utils.get_contact_details,

	opportunity_from: function(frm) {
		frm.toggle_reqd("party_name", frm.doc.opportunity_from);
		frm.trigger("set_dynamic_field_label");
	},

	refresh: function(frm) {
		var doc = frm.doc;
		frm.events.opportunity_from(frm);
		frm.trigger('toggle_mandatory');
		erpnext.toggle_naming_series();

		if(!doc.__islocal && doc.status!=="Lost") {
			if(doc.with_items){
				frm.add_custom_button(__('Supplier Quotation'),
					function() {
						frm.trigger("make_supplier_quotation")
					}, __('Create'));
			}

			frm.add_custom_button(__('Quotation'),
				cur_frm.cscript.create_quotation, __('Create'));

			if(doc.status!=="Quotation") {
				frm.add_custom_button(__('Lost'), () => {
					frm.trigger('set_as_lost_dialog');
				});
			}
		}

		if(!frm.doc.__islocal && frm.perm[0].write && frm.doc.docstatus==0) {
			if(frm.doc.status==="Open") {
				frm.add_custom_button(__("Close"), function() {
					frm.set_value("status", "Closed");
					frm.save();
				});
			} else {
				frm.add_custom_button(__("Reopen"), function() {
					frm.set_value("status", "Open");
					frm.save();
				});
			}
		}
	},

	set_contact_link: function(frm) {
		if(frm.doc.opportunity_from == "Customer" && frm.doc.party_name) {
			frappe.dynamic_link = {doc: frm.doc, fieldname: 'customer', doctype: 'Customer'}
		} else if(frm.doc.opportunity_from == "Lead" && frm.doc.party_name) {
			frappe.dynamic_link = {doc: frm.doc, fieldname: 'lead', doctype: 'Lead'}
		}
	},

	set_dynamic_field_label: function(frm){

		if (frm.doc.opportunity_from) {
			frm.set_df_property("party_name", "label", frm.doc.opportunity_from);
		}
	},

	make_supplier_quotation: function(frm) {
		frappe.model.open_mapped_doc({
			method: "erpnext.crm.doctype.opportunity.opportunity.make_supplier_quotation",
			frm: cur_frm
		})
	},

	toggle_mandatory: function(frm) {
		frm.toggle_reqd("items", frm.doc.with_items ? 1:0);
	}
})

// TODO commonify this code
erpnext.crm.Opportunity = frappe.ui.form.Controller.extend({
	onload: function() {

		if(!this.frm.doc.status)
			set_multiple(this.frm.doc.doctype, this.frm.doc.name, { status:'Open' });
		if(!this.frm.doc.company && frappe.defaults.get_user_default("Company"))
			set_multiple(this.frm.doc.doctype, this.frm.doc.name,
				{ company:frappe.defaults.get_user_default("Company") });
		if(!this.frm.doc.currency)
			set_multiple(this.frm.doc.doctype, this.frm.doc.name, { currency:frappe.defaults.get_user_default("Currency") });

		this.setup_queries();
	},

	setup_queries: function() {
		var me = this;

		if(this.frm.fields_dict.contact_by.df.options.match(/^User/)) {
			this.frm.set_query("contact_by", erpnext.queries.user);
		}

		me.frm.set_query('customer_address', erpnext.queries.address_query);

		this.frm.set_query("item_code", "items", function() {
			return {
				query: "erpnext.controllers.queries.item_query",
				filters: {'is_sales_item': 1}
			};
		});

		$.each([["lead", "lead"],
			["customer", "customer"],
			["contact_person", "contact_query"]],
			function(i, opts) {
				me.frm.set_query(opts[0], erpnext.queries[opts[1]]);
			});
	},

	create_quotation: function() {
		frappe.model.open_mapped_doc({
			method: "erpnext.crm.doctype.opportunity.opportunity.make_quotation",
			frm: cur_frm
		})
	}
});

$.extend(cur_frm.cscript, new erpnext.crm.Opportunity({frm: cur_frm}));

cur_frm.cscript.onload_post_render = function(doc, cdt, cdn) {
	if(doc.opportunity_from == 'Lead' && doc.party_name)
		cur_frm.cscript.lead(doc, cdt, cdn);
}

cur_frm.cscript.item_code = function(doc, cdt, cdn) {
	var d = locals[cdt][cdn];
	if (d.item_code) {
		return frappe.call({
			method: "erpnext.crm.doctype.opportunity.opportunity.get_item_details",
			args: {"item_code":d.item_code},
			callback: function(r, rt) {
				if(r.message) {
					$.each(r.message, function(k, v) {
						frappe.model.set_value(cdt, cdn, k, v);
					});
					refresh_field('image_view', d.name, 'items');
				}
			}
		})
	}
}

cur_frm.cscript.lead = function(doc, cdt, cdn) {
	cur_frm.toggle_display("contact_info", doc.party_name);
	erpnext.utils.map_current_doc({
		method: "erpnext.crm.doctype.lead.lead.make_opportunity",
		source_name: cur_frm.doc.party_name,
		frm: cur_frm
	});
}

