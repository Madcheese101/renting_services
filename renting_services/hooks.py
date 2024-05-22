from . import __version__ as app_version

app_name = "renting_services"
app_title = "Renting Services"
app_publisher = "MadCheese"
app_description = "An app for renting services"
app_email = "leg.ly@hotmail.com"
app_license = "MIT"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = "renting-services.bundle.css"
app_include_js = "renting_services.bundle.js"
# app_include_js = "/assets/renting_services/js/renting_services.js"

# include js, css files in header of web template
# web_include_css = "/assets/renting_services/css/renting_services.css"
# web_include_js = "/assets/renting_services/js/renting_services.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "renting_services/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
doctype_js = {"Payment Entry" : "public/js/payment_entry.js",
              "Sales Invoice" : "public/js/rent_invoice.js",
              "Branch" : "public/js/branch.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
#	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
#	"methods": "renting_services.utils.jinja_methods",
#	"filters": "renting_services.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "renting_services.install.before_install"
# after_install = "renting_services.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "renting_services.uninstall.before_uninstall"
# after_uninstall = "renting_services.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "renting_services.utils.utils.create_defaults"
# after_app_install = "renting_services.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "renting_services.utils.before_app_uninstall"
# after_app_uninstall = "renting_services.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "renting_services.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
#	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
#	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
#	"ToDo": "custom_app.overrides.CustomToDo"
# }
override_doctype_class = {
	"Sales Invoice": "renting_services.overrides.rent_invoice.RentInvoice"
}
# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	# "*": {
	# 	"on_update": "method",
	# 	"on_cancel": "method",
	# 	"on_trash": "method"
	# }
    # "Sales Invoice": {
	# 	"on_submit": "renting_services.doc_events.sales_invoice.proccess_change_rent"
	# }
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
#	"all": [
#		"renting_services.tasks.all"
#	],
#	"daily": [
#		"renting_services.tasks.daily"
#	],
#	"hourly": [
#		"renting_services.tasks.hourly"
#	],
#	"weekly": [
#		"renting_services.tasks.weekly"
#	],
#	"monthly": [
#		"renting_services.tasks.monthly"
#	],
# }
scheduler_events = {
	"cron": {
        # run at 12AM
        "0 0 * * *":[
            "renting_services.renting_services.tasks.tasks.draft_invoice_check",
            "renting_services.renting_services.tasks.tasks.cancel_unconfirmed_rents"
        ]
	}
}
# Testing
# -------

# before_tests = "renting_services.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
#	"frappe.desk.doctype.event.event.get_events": "renting_services.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
#	"Task": "renting_services.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["renting_services.utils.before_request"]
# after_request = ["renting_services.utils.after_request"]

# Job Events
# ----------
# before_job = ["renting_services.utils.before_job"]
# after_job = ["renting_services.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
#	{
#		"doctype": "{doctype_1}",
#		"filter_by": "{filter_by}",
#		"redact_fields": ["{field_1}", "{field_2}"],
#		"partial": 1,
#	},
#	{
#		"doctype": "{doctype_2}",
#		"filter_by": "{filter_by}",
#		"partial": 1,
#	},
#	{
#		"doctype": "{doctype_3}",
#		"strict": False,
#	},
#	{
#		"doctype": "{doctype_4}"
#	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
#	"renting_services.auth.validate"
# ]

fixtures = [
    {
        "doctype": "Custom Field",
        "filters": [
            
            [
                "name",
                "in",
                (
                    "Sales Invoice-custom_return_date",
                    "Sales Invoice-custom_delivery_date",
                    "Sales Invoice-custom_حالة_الحجز",
                    "Sales Invoice-custom_guarantee_id",
                    "Sales Invoice-custom_guarantee_type",
                    "Sales Invoice-custom_change_invoice",
                    "Sales Invoice-custom_original_invoice",
                    "Warehouse-custom_reserve_warehouse",
                    "POS Profile-custom_rent_allow_credit_sale",
                    "POS Profile-custom_allowed_rent_period",
                    "POS Profile-custom_limit_cashiers",
                    "POS Profile-custom_limit_payment_refund",
                    "POS Profile-custom_allow_full_return_in_days",
                    "Branch-letter_head",
                    "Branch-warehouse",
                    "Branch-custom_printers",
                    "Branch-custom_default_printer"
                ),
            ]
        ]
    },
    {
        "doctype": "Property Setter",
        "filters": [
            
            [
                "name",
                "in",
                (
                    "Sales Invoice-is_return-depends_on", 
                    "Sales Invoice-payments_tab-label", 
                    "Sales Invoice-terms_tab-depends_on", 
                    "Sales Invoice-more_info_tab-depends_on", 
                    "Sales Invoice-payment_schedule_section-depends_on", 
                    "Sales Invoice-contact_and_address_tab-label", 
                    "Sales Invoice-is_pos-label", 
                    "Sales Invoice-loyalty_points_redemption-depends_on", 
                    "Sales Invoice-payments_section-depends_on", 
                    "Sales Invoice-payments_section-collapsible", 
                    "Sales Invoice-packing_list-depends_on", 
                    "Sales Invoice-pricing_rule_details-depends_on", 
                    "Sales Invoice-sec_tax_breakup-depends_on", 
                    "Sales Invoice-section_break_43-depends_on", 
                    "Sales Invoice-section_break_40-depends_on", 
                    "Sales Invoice-taxes_section-depends_on", 
                    "Sales Invoice-currency_and_price_list-depends_on", 
                    "Sales Invoice-accounting_dimensions_section-depends_on",
                    "Customer-customer_type-default",
                    "Customer-customer_type-hidden"
                ),
            ]
        ]
    }
]