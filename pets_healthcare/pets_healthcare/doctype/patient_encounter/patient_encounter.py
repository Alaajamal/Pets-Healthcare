# -*- coding: utf-8 -*-
# Copyright (c) 2015, ESS LLP and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from frappe.utils import cstr
from frappe.utils import cstr, cint, flt, comma_or, getdate, nowdate, formatdate, format_time, now_datetime
from erpnext.stock.utils import get_incoming_rate
from erpnext.stock.stock_ledger import get_previous_sle, NegativeStockError, get_valuation_rate
from erpnext.stock.get_item_details import get_bin_details, get_default_cost_center, get_conversion_factor, get_reserved_qty_for_so
from erpnext.setup.doctype.item_group.item_group import get_item_group_defaults
from erpnext.setup.doctype.brand.brand import get_brand_defaults
from erpnext.stock.doctype.batch.batch import get_batch_no, set_batch_nos, get_batch_qty
from erpnext.stock.doctype.item.item import get_item_defaults
from erpnext.manufacturing.doctype.bom.bom import validate_bom_no, add_additional_cost
from erpnext.stock.utils import get_bin
from frappe.model.mapper import get_mapped_doc
from frappe import _
from frappe.utils.csvutils import getlink
from frappe.utils import add_days, getdate, nowdate, nowtime
from erpnext.stock.doctype.serial_no.serial_no import update_serial_nos_after_submit, get_serial_nos
from erpnext.stock.doctype.stock_reconciliation.stock_reconciliation import OpeningEntryAccountError
import json
from frappe.utils import add_to_date, now


from six import string_types, itervalues, iteritems

from erpnext.controllers.stock_controller import StockController

class PatientEncounter(StockController):
	def validate(self):
		self.posting_date = self.encounter_date
		self.posting_time = self.encounter_time
		
	def on_update(self):
		if(self.appointment):
			frappe.db.set_value("Patient Appointment", self.appointment, "status", "Closed")
		update_encounter_to_medical_record(self)

	def after_insert(self):
		insert_encounter_to_medical_record(self)

	def on_cancel(self):
		if(self.appointment):
			frappe.db.set_value("Patient Appointment", self.appointment, "status", "Open")
		delete_medical_record(self)
		self.update_stock_ledger()
		self.make_gl_entries_on_cancel()


	def get_item_details(self, args=None, for_update=False):
		item = frappe.db.sql("""select i.name, i.stock_uom, i.description, i.image, i.item_name, i.item_group,
				i.has_batch_no, i.sample_quantity, i.has_serial_no,
				id.expense_account, id.buying_cost_center
			from `tabItem` i LEFT JOIN `tabItem Default` id ON i.name=id.parent and id.company=%s
			where i.name=%s
				and i.disabled=0
				and (i.end_of_life is null or i.end_of_life='0000-00-00' or i.end_of_life > %s)""",
			(self.company, args.get('item_code'), nowdate()), as_dict = 1)

		if not item:
			frappe.throw(_("Item {0} is not active or end of life has been reached").format(args.get("item_code")))

		item = item[0]
		item_group_defaults = get_item_group_defaults(item.name, self.company)
		brand_defaults = get_brand_defaults(item.name, self.company)

		ret = frappe._dict({
			'uom'			      	: item.stock_uom,
			'stock_uom'				: item.stock_uom,
			'description'		  	: item.description,
			'image'					: item.image,
			'item_name' 		  	: item.item_name,
			'cost_center'			: get_default_cost_center(args, item, item_group_defaults, brand_defaults, self.company),
			'qty'					: args.get("qty"),
			'transfer_qty'			: args.get('qty'),
			'conversion_factor'		: 1,
			'batch_no'				: '',
			'actual_qty'			: 0,
			'basic_rate'			: 0,
			'serial_no'				: '',
			'has_serial_no'			: item.has_serial_no,
			'has_batch_no'			: item.has_batch_no,
			'sample_quantity'		: item.sample_quantity
		})

		# update uom
		if args.get("uom") and for_update:
			ret.update(get_uom_details(args.get('item_code'), args.get('uom'), args.get('qty')))

		ret["expense_account"] = (item.get("expense_account") or
			item_group_defaults.get("expense_account") or
			frappe.get_cached_value('Company',  self.company,  "default_expense_account"))

		for company_field, field in {'stock_adjustment_account': 'expense_account',
			'cost_center': 'cost_center'}.items():
			if not ret.get(field):
				ret[field] = frappe.get_cached_value('Company',  self.company,  company_field)

		args['posting_date'] = self.encounter_date
		args['posting_time'] = self.encounter_time

		stock_and_rate = get_warehouse_details(args) if args.get('warehouse') else {}
		ret.update(stock_and_rate)

		# automatically select batch for outgoing item
		if (args.get('s_warehouse', None) and args.get('qty') and
			ret.get('has_batch_no') and not args.get('batch_no')):
			args.batch_no = get_batch_no(args['item_code'], args['s_warehouse'], args['qty'])

		return ret

	def on_submit(self):
		self.posting_date = self.encounter_date
		self.posting_time = self.encounter_time
		
		self.update_stock_ledger()
		# ~ update_serial_nos_after_submit(self, "items")
		self.make_gl_entries()
		self.insert_signs_to_vital_sings_record()
		self.insert_sample_collection()
		self.insert_medical_record()
		self.insert_clinic_procedure()

	def update_stock_ledger(self):
		sl_entries = []

		# make sl entries for source warehouse first, then do for target warehouse
		for d in self.get('items'):
			if cstr(d.s_warehouse):
				sl_entries.append(self.get_sl_entries(d, {
					"warehouse": cstr(d.s_warehouse),
					"actual_qty": -flt(d.transfer_qty),
					"incoming_rate": 0
				}))


		# On cancellation, make stock ledger entry for
		# target warehouse first, to update serial no values properly

			# if cstr(d.s_warehouse) and self.docstatus == 2:
			# 	sl_entries.append(self.get_sl_entries(d, {
			# 		"warehouse": cstr(d.s_warehouse),
			# 		"actual_qty": -flt(d.transfer_qty),
			# 		"incoming_rate": 0
			# 	}))

		if self.docstatus == 2:
			sl_entries.reverse()

		self.make_sl_entries(sl_entries, self.amended_from and 'Yes' or 'No')
		
		
		# ~ create vital signs Document
	def insert_signs_to_vital_sings_record(doc):
		for d in doc.get("patient_vital_signs"):
			if not d.reference_name1:
				vital_signs = frappe.new_doc("Vital Signs") 
				vital_signs.patient = doc.patient
				vital_signs.signs_date = nowdate()
				vital_signs.signs_time = nowtime()
				vital_signs.temperature = d.temperature
				vital_signs.pulse = d.pulse
				vital_signs.respiratory_rate = d.respiratory_rate
				vital_signs.tongue = d.tongue
				vital_signs.abdomen = d.abdomen
				vital_signs.reflexes = d.reflexes
				vital_signs.bp_systolic = d.bp_systolic
				vital_signs.bp_diastolic = d.bp_diastolic
				vital_signs.bp_diastolic = d.bp_diastolic
				vital_signs.bp = d.bp
				vital_signs.height = d.height
				vital_signs.weight = d.weight
				vital_signs.save(ignore_permissions=True)
				vital_signs.submit()
				frappe.db.set_value(
					"Patient Vital Signs",
					d.name,
					"reference_name1",
					vital_signs.name,
					update_modified=False,
				)
				frappe.msgprint(_("Vital Sign(s) {0} created.").format(getlink("Vital Signs", vital_signs.name)))
			
			
		# ~ create Sample_collection document
	def insert_sample_collection(doc):
		for d in doc.get("sample"):
			if not d.reference_name1:
				sample = frappe.new_doc("Sample Collection")
				sample.patient = doc.patient
				sample.patient_age = doc.patient_age
				sample.practitioner = doc.practitioner
				sample.collected_time = now_datetime()
				sample.sample = d.sample
				sample.sample_uom = d.sample_uom
				sample.sample_quantity = d.sample_quantity
				sample.collected_by = d.collected_by
				sample.save(ignore_permissions=True)
				sample.submit()
				frappe.db.set_value(
					"Sample",
					d.name,
					"reference_name1",
					sample.name,
					update_modified=False,
				)
				frappe.msgprint(("Sample Collection {0} Created").format(getlink("Sample Collection", sample.name)))
			
		# Create Medical Record Document
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

		#Create Clinical Procedure Doument
	def insert_clinic_procedure(doc):
		for d in doc.get("procedure_prescription"):
			if not d.reference_name:
				procedure = frappe.new_doc("Clinical Procedure")
				procedure.patient = doc.patient
				procedure.patient_sex = doc.patient_sex
				procedure.patient_age = doc.patient_age
				procedure.medical_department = doc.visit_department
				procedure.practitioner = d.practitioner
				procedure.procedure_template= d.procedure
				procedure.start_date = d.date
				procedure.invoiced = 1
				procedure.status = "Draft"
				procedure.reference_name = doc.name
				procedure.save(ignore_permissions=True)
				frappe.db.set_value(
					"Procedure Prescription",
					d.name,
					"reference_name",
					procedure.name,
					update_modified=False,
				)
				frappe.msgprint(("Clinical Procedure {0} Created").format(getlink("Clinical Procedure", procedure.name)))

		
def insert_encounter_to_medical_record(doc):
	subject = set_subject_field(doc)
	medical_record = frappe.new_doc("Patient Medical Record")
	medical_record.patient = doc.patient
	medical_record.subject = subject
	medical_record.status = "Open"
	medical_record.communication_date = doc.encounter_date
	medical_record.reference_doctype = "Patient Encounter"
	medical_record.reference_name = doc.name
	medical_record.reference_owner = doc.owner
	medical_record.save(ignore_permissions=True)

def update_encounter_to_medical_record(encounter):
	medical_record_id = frappe.db.sql("select name from `tabPatient Medical Record` where reference_name=%s", (encounter.name))
	if medical_record_id and medical_record_id[0][0]:
		subject = set_subject_field(encounter)
		frappe.db.set_value("Patient Medical Record", medical_record_id[0][0], "subject", subject)
	else:
		insert_encounter_to_medical_record(encounter)

def delete_medical_record(encounter):
	frappe.db.sql("""delete from `tabPatient Medical Record` where reference_name = %s""", (encounter.name))

def set_subject_field(encounter):
	subject = encounter.practitioner+"<br/>"
	if(encounter.symptoms):
		subject += "Symptoms: "+ cstr(encounter.symptoms)+".<br/>"
	else:
		subject += "No Symptoms <br/>"
	if(encounter.diagnosis):
		subject += "Diagnosis: "+ cstr(encounter.diagnosis)+".<br/>"
	else:
		subject += "No Diagnosis <br/>"
	if(encounter.drug_prescription):
		subject +="\nDrug(s) Prescribed. "
	if(encounter.lab_test_prescription):
		subject += "\nTest(s) Prescribed."
	if(encounter.procedure_prescription):
		subject += "\nProcedure(s) Prescribed."

	return subject

def get_lab_test_prescription(self, procdure_template= None ):
	data = []
	if procdure_template:
		data = frappe.get_list("lab_test_prescription" , {"parent" : procdure_template})
	if data :
		for d in date:
			ltp_doc = frappe.get_doc("lab_test_prescription" , {"name":d["name"]})   #lab+test+prescription
			child.append("lab_test_prescription")
			child.test_code = ltp_doc.test_code
			child.test = ltp_doc.test
			child.comments = ltp_doc.comment
	return data
	
		

@frappe.whitelist()
def get_warehouse_details(args):
	if isinstance(args, string_types):
		args = json.loads(args)

	args = frappe._dict(args)

	ret = {}
	if args.warehouse and args.item_code:
		args.update({
			"posting_date": args.encounter_date,
			"posting_time": args.encounter_time,
		})
		ret = {
			"actual_qty" : get_previous_sle(args).get("qty_after_transaction") or 0,
			"basic_rate" : get_incoming_rate(args)
		}
	return ret




