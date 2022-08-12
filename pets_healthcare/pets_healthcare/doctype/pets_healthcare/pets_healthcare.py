# -*- coding: utf-8 -*-
# Copyright (c) 2022, Ahmed and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from frappe.utils import add_to_date, now
import json
from frappe import _
from frappe.utils import now,today

class PetsHealthcare(Document):
	pass

@frappe.whitelist()
def add_vital_signs(data):
	if doc.get("vital_signs"):
		vital_signs = frappe.new_doc("Vital Signs")
		vital_signs.patient = doc.patient
		vital_signs.signs_date = nowdate()
		vital_signs.signs_time = nowtime()
		vital_signs.temperature = doc.temperature
		vital_signs.pulse = doc.pulse
		vital_signs.respiratory_rate = doc.respiratory_rate
		vital_signs.tongue = doc.tongue
		vital_signs.abdomen = doc.abdomen
		vital_signs.reflexes = doc.reflexes
		vital_signs.bp_systolic = doc.bp_systolic
		vital_signs.bp_diastolic = doc.bp_diastolic
		vital_signs.bp = doc.bp
		vital_signs.height = doc.height
		vital_signs.weight = doc.weight
		vital_signs.submit()
		vital_signs.save(ignore_permissions=True)
		frappe.msgprint(("Vital Signs Created"))
