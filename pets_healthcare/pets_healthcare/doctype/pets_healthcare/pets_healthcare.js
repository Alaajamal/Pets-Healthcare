// Copyright (c) 2022, mawred and contributors
// For license information, please see license.txt

frappe.ui.form.on('Pets Healthcare', {
	refresh: function(frm) {
		frm.disable_save();
		frm.add_custom_button(__("Clear"), () => {
			return frm.trigger("clear");
		});
		frm.add_custom_button(__('Sales Invoice'), function() {
			frappe.route_options = {'patient': frm.doc.patient, 'pet_owner': frm.doc.pet_owner, 
				'ref_practitioner': frm.doc.practitioner};
			frappe.set_route('Form', 'Sales Invoice', 'New Sales Invoice 1');
		}, "Create");
		
	},
	clear: function(frm) {
		frm.clear_table("drug_prescription");
		frm.clear_table("investigations");
		frm.clear_table("procedures");
		frm.clear_table("pet_vaccine_schedule");
		frm.doc.patient = '';
		frm.doc.full_name = '';
		frm.doc.pet_owner = '';
		frm.doc.pet_type = '';
		frm.doc.dob = '';
		frm.doc.appointment = '';
		frm.doc.appointment_datetime = '';
		frm.doc.type = '';
		frm.doc.healthcare_practitioner = '';
		frm.doc.temperature = '';
		frm.doc.pulse = '';
		frm.doc.respiratory_rate = '';
		frm.doc.tongue = '';
		frm.doc.abdomen = '';
		frm.doc.reflexes = '';
		frm.doc.bp_systolic = '';
		frm.doc.bp_diastolic = '';
		frm.doc.pd = '';
		frm.doc.height = 0;
		frm.doc.weight = 0;
		frm.doc.complaints = '';
		frm.doc.diagnosis = '';
		frm.doc.sample = '';
		frm.doc.sample_uom = '';
		frm.doc.sample_quantity = 0;
		frm.doc.more_details = '';
		frm.refresh_fields();
	}, 
	add_vital_signs: function(frm){
		return frappe.call({
			method: "pets_healthcare.pets_healthcare.pets_healthcare.doctype.pets_healthcare.add_vital_signs",
			args: {
				data: frm.doc
			},
			callback: function(r) {
				if(r.message) {
					console.log(r.message)
				}
			}
		});
		
	}
});



