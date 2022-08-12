// Copyright (c) 2022, mawred and contributors
// For license information, please see license.txt

frappe.ui.form.on('Patient Occupancies', "refresh", function(frm) {
	frm.add_custom_button(__('Create Sales Invoice'), function() {
		frappe.model.open_mapped_doc({
			method : "erpnext.healthcare.doctype.patient_occupancies.patient_occupancies.make_invoice",
			frm: cur_frm
		})
	})
});
