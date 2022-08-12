# -*- coding: utf-8 -*-
# Copyright (c) 2022, mawred and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.mapper import get_mapped_doc
from frappe.model.document import Document

class PatientOccupancies(Document):
	pass
@frappe.whitelist()
def make_invoice(source_name, target_doc=None):
	target_doc = get_mapped_doc("Patient Occupancies", source_name,
		{"Patient Occupancies": {
			"doctype": "Sales Invoice",
		},
		"Patient Occupancy": {
			"doctype": "Sales Invoice Item",
			"field_map": {
				"name": "patient_occupancy",
				"parent": "patient_occupancies",
			},
				"add_if_empty": True
		}
		
	}, target_doc)
	target.doc.run_method(set_missing_values)
	target.doc.run_method(set_other_charges)
	
	return target_doc

