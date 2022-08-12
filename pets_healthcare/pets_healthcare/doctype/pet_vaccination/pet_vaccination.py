# -*- coding: utf-8 -*-
# Copyright (c) 2021, mawred and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from frappe.utils import add_to_date, now
from frappe.model.mapper import get_mapped_doc
from frappe.utils import flt, get_link_to_form, get_time, getdate

class PetVaccination(Document):
	def get_vac_items(self,vac_template =None):
		data = []
		if vac_template:
			data = frappe.get_list("Vaccines Schedules",{"parent":vac_template},order_by='idx ASC')
			
		if data :
			for i in range(0, len(data)) :
				vs_doc = frappe.get_doc("Vaccines Schedules",{"name":data[i]["name"]})
				child = self.append('pet_vaccine_schedule')
				child.item = vs_doc.item_code
				child.idx = data[i].idx
				child.uom = vs_doc.uom
				child.qty = vs_doc.qty
				child.state = "Not Taken"
				child.date = add_to_date(self.date, days=vs_doc.vac_date_after_start)
					
		return data 
		
		






