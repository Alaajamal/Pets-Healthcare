// Copyright (c) 2021, mawred and contributors
// For license information, please see license.txt

frappe.ui.form.on('Pet Owner', {
	onload: function(frm) {
		frm.set_query('customer', function(doc) {
			return {
				query: "erpnext.controllers.queries.customer_query"
			};
		});

	}
});
