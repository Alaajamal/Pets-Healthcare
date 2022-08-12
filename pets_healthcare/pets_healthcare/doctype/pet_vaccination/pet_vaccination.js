// Copyright (c) 2021, mawred and contributors
// For license information, please see license.txt

frappe.ui.form.on('Pet Vaccination', {
	refresh: function(frm) {

	},
	vaccine_template: function(frm) {
		console.log(frm.doc.vaccine_template);
		frappe.call({
            method: "get_vac_items", 
            doc:frm.doc,
            args:{"vac_template":frm.doc.vaccine_template},
            callback: function(r) {
				console.log(r)
                cur_frm.refresh()
            }
        })
	}
});


