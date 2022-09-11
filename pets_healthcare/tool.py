
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import  flt
import json

def insert_medical_record(doc):
	for d in doc.get("medical_record"):
		if not d.reference_name:
			record = frappe.new_doc("Patient Medical Record")
			record.patient = doc.patient
			record.pet_owner = doc.pet_owner
			record.subject = d.subject
			record.attach = d.attach_medical_record
			record.reference_doctype = "Patient Encounter"
			record.reference_name = doc.name
			record.save(ignore_permissions=True)
			frappe.db.set_value(
				"Medical Record",
				d.name,
				"reference_name",
				record.name,
				update_modified=False,
			)
			frappe.msgprint(("Patient Medical Record {0} Created").format(getlink("Patient Medical Record", record.name)))
