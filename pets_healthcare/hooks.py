# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from . import __version__ as app_version

app_name = "pets_healthcare"
app_title = "Pets Healthcare"
app_publisher = "mawred"
app_description = "Customization for Healthcare system to suppourt pets "
app_icon = "octicon octicon-file-directory"
app_color = "grey"
app_email = "ahmad18189@gmail.com"
app_license = "MIT"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/pets_healthcare/css/pets_healthcare.css"
# app_include_js = "/assets/pets_healthcare/js/pets_healthcare.js"

# include js, css files in header of web template
# web_include_css = "/assets/pets_healthcare/css/pets_healthcare.css"
# web_include_js = "/assets/pets_healthcare/js/pets_healthcare.js"

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
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

# Website user home page (by function)
# get_website_user_home_page = "pets_healthcare.utils.get_home_page"

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Installation
# ------------

# before_install = "pets_healthcare.install.before_install"
# after_install = "pets_healthcare.install.after_install"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "pets_healthcare.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
#	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"pets_healthcare.tasks.all"
# 	],
# 	"daily": [
# 		"pets_healthcare.tasks.daily"
# 	],
# 	"hourly": [
# 		"pets_healthcare.tasks.hourly"
# 	],
# 	"weekly": [
# 		"pets_healthcare.tasks.weekly"
# 	]
# 	"monthly": [
# 		"pets_healthcare.tasks.monthly"
# 	]
# }

# Testing
# -------

# before_tests = "pets_healthcare.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "pets_healthcare.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "pets_healthcare.task.get_dashboard_data"
# }
# ~ fixtures = ["Custom Script","Custom Field","Print Format","Property Setter","Workflow","Workflow State","Workflow Action Master", "Role"]
fixtures = [
    {
        "dt": ("Custom Field"), 
        "filters": [["options", "in", ("Patient", "Pet Owner", "Healthcare Practitioner")]]
    }
]
