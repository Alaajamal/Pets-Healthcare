// Copyright (c) 2016, ESS LLP and contributors
// For license information, please see license.txt
frappe.provide("erpnext.stock");

frappe.ui.form.on('Patient Encounter', {
	setup: function(frm) {
		frm.get_field('drug_prescription').grid.editable_fields = [
			{fieldname: 'drug_code', columns: 2},
			{fieldname: 'drug_name', columns: 2},
			{fieldname: 'dosage', columns: 2},
			{fieldname: 'period', columns: 2}
		];
		frm.get_field('lab_test_prescription').grid.editable_fields = [
			{fieldname: 'lab_test_code', columns: 2},
			{fieldname: 'lab_test_name', columns: 4},
			{fieldname: 'lab_test_comment', columns: 4}
		];
	},
	show_stock_ledger: function(frm) {
		if(frm.doc.docstatus===1) {
			cur_frm.add_custom_button(__("Stock Ledger"), function() {
				frappe.route_options = {
					voucher_no: frm.doc.name,
					from_date: frm.doc.posting_date,
					to_date: frm.doc.posting_date,
					company: frm.doc.company
				};
				frappe.set_route("query-report", "Stock Ledger");
			}, __("View"));
		}

	},

	show_general_ledger: function(frm) {
		if(frm.doc.docstatus===1) {
			cur_frm.add_custom_button(__('Accounting Ledger'), function() {
				frappe.route_options = {
					voucher_no: frm.doc.name,
					from_date: frm.doc.posting_date,
					to_date: frm.doc.posting_date,
					company: frm.doc.company,
					group_by: "Group by Voucher (Consolidated)"
				};
				frappe.set_route("query-report", "General Ledger");
			}, __("View"));
		}
	},
	refresh: function(frm) {
		var me = this;
		frm.events.show_stock_ledger(frm);
		if (frm.doc.docstatus===1 && erpnext.is_perpetual_inventory_enabled(frm.doc.company)) {
			frm.events.show_general_ledger(frm);
		}
		refresh_field('drug_prescription');
		refresh_field('lab_test_prescription');
		if (!frm.doc.__islocal){
			frappe.call({
				method: 'frappe.client.get_value',
				args: {
					doctype: 'Patient',
					fieldname: 'inpatient_status',
					filters: {name: frm.doc.patient}
				},
				callback: function(data) {
					if(data.message && data.message.inpatient_status == "Admission Scheduled" || data.message.inpatient_status == "Admitted"){
						frm.add_custom_button(__('Schedule Discharge'), function() {
							schedule_discharge(frm);
						});
					}
					else if(data.message.inpatient_status != "Discharge Scheduled"){
						frm.add_custom_button(__('Schedule Admission'), function() {
							schedule_inpatient(frm);
						});
					}
				}
			});
		}
		frm.add_custom_button(__('Patient History'), function() {
			if (frm.doc.patient) {
				frappe.route_options = {"patient": frm.doc.patient};
				frappe.set_route("patient_history");
			} else {
				frappe.msgprint(__("Please select Patient"));
			}
		},"View");
		frm.add_custom_button(__('Vital Signs'), function() {
			btn_create_vital_signs(frm);
		},"Create");
		frm.add_custom_button(__('Medical Record'), function() {
			create_medical_record(frm);
		},"Create");

		frm.add_custom_button(__("Procedure"),function(){
			btn_create_procedure(frm);
		},"Create");

		frm.set_query("patient", function () {
			return {
				filters: {"status": "Active"}
			};
		});
		frm.set_query("drug_code", "drug_prescription", function() {
			return {
				filters: {
					is_stock_item:'1'
				}
			};
		});
		frm.set_query("lab_test_code", "lab_test_prescription", function() {
			return {
				filters: {
					is_billable:'1'
				}
			};
		});
		frm.set_query("medical_code", "codification_table", function() {
			return {
				filters: {
					medical_code_standard: frappe.defaults.get_default("default_medical_code_standard")
				}
			};
		});
		frm.set_query("appointment", function() {
			return {
				filters: {
					//	Scheduled filter for demo ...
					status:['in',["Open","Scheduled"]]
				}
			};
		});
		frm.set_df_property("appointment", "read_only", frm.doc.__islocal ? 0:1);
		frm.set_df_property("patient", "read_only", frm.doc.__islocal ? 0:1);
		frm.set_df_property("patient_age", "read_only", frm.doc.__islocal ? 0:1);
		frm.set_df_property("patient_sex", "read_only", frm.doc.__islocal ? 0:1);
		frm.set_df_property("type", "read_only", frm.doc.__islocal ? 0:1);
		frm.set_df_property("practitioner", "read_only", frm.doc.__islocal ? 0:1);
		frm.set_df_property("visit_department", "read_only", frm.doc.__islocal ? 0:1);
		frm.set_df_property("encounter_date", "read_only", frm.doc.__islocal ? 0:1);
		frm.set_df_property("encounter_time", "read_only", frm.doc.__islocal ? 0:1);
	},
	set_basic_rate: function(frm, cdt, cdn) {
		const item = locals[cdt][cdn];
		item.transfer_qty = flt(item.qty) * flt(item.conversion_factor);

		const args = {
			'item_code'			: item.item_code,
			'posting_date'		: frm.doc.posting_date,
			'posting_time'		: frm.doc.posting_time,
			'warehouse'			: cstr(item.s_warehouse) || cstr(item.t_warehouse),
			'serial_no'			: item.serial_no,
			'company'			: frm.doc.company,
			'qty'				: item.s_warehouse ? -1*flt(item.transfer_qty) : flt(item.transfer_qty),
			'voucher_type'		: frm.doc.doctype,
			'voucher_no'		: item.name,
			'allow_zero_valuation': 1,
		};

		if (item.item_code || item.serial_no) {
			frappe.call({
				method: "erpnext.stock.utils.get_incoming_rate",
				args: {
					args: args
				},
				callback: function(r) {
					frappe.model.set_value(cdt, cdn, 'basic_rate', (r.message || 0.0));
					frm.events.calculate_basic_amount(frm, item);
				}
			});
		}
	},
	calculate_basic_amount: function(frm, item) {
		item.basic_amount = flt(flt(item.transfer_qty) * flt(item.basic_rate),
			precision("basic_amount", item));

		frm.events.calculate_amount(frm);
	},
	calculate_amount: function(frm) {

		const total_basic_amount = frappe.utils.sum(
			(frm.doc.items || []).map(function(i) { return i.t_warehouse ? flt(i.basic_amount) : 0; })
		);

		for (let i in frm.doc.items) {
			let item = frm.doc.items[i];

			if (item.t_warehouse && total_basic_amount) {
				item.additional_cost = (flt(item.basic_amount) / total_basic_amount) * frm.doc.total_additional_costs;
			} else {
				item.additional_cost = 0;
			}

			item.amount = flt(item.basic_amount + flt(item.additional_cost),
				precision("amount", item));

			item.valuation_rate = flt(flt(item.basic_rate)
				+ (flt(item.additional_cost) / flt(item.transfer_qty)),
				precision("valuation_rate", item));
		}

		refresh_field('items');
	},
	set_serial_no: function(frm, cdt, cdn, callback) {
		var d = frappe.model.get_doc(cdt, cdn);
		if(!d.item_code && !d.s_warehouse && !d.qty) return;
		var	args = {
			'item_code'	: d.item_code,
			'warehouse'	: cstr(d.s_warehouse),
			'stock_qty'		: d.transfer_qty
		};
		frappe.call({
			method: "erpnext.stock.get_item_details.get_serial_no",
			args: {"args": args},
			callback: function(r) {
				if (!r.exe && r.message){
					frappe.model.set_value(cdt, cdn, "serial_no", r.message);

					if (callback) {
						callback();
					}
				}
			}
		});
	},
});

var schedule_inpatient = function(frm) {
	frappe.call({
		method: "erpnext.healthcare.doctype.inpatient_record.inpatient_record.schedule_inpatient",
		args: {patient: frm.doc.patient, encounter_id: frm.doc.name, practitioner: frm.doc.practitioner},
		callback: function(data) {
			if(!data.exc){
				frm.reload_doc();
			}
		},
		freeze: true,
		freeze_message: "Process Inpatient Scheduling"
	});
};

var schedule_discharge = function(frm) {
	frappe.call({
		method: "erpnext.healthcare.doctype.inpatient_record.inpatient_record.schedule_discharge",
		args: {patient: frm.doc.patient, encounter_id: frm.doc.name, practitioner: frm.doc.practitioner},
		callback: function(data) {
			if(!data.exc){
				frm.reload_doc();
			}
		},
		freeze: true,
		freeze_message: "Process Discharge"
	});
};

var create_medical_record = function (frm) {
	if(!frm.doc.patient){
		frappe.throw(__("Please select patient"));
	}
	frappe.route_options = {
		"patient": frm.doc.patient,
		"status": "Open",
		"reference_doctype": "Patient Medical Record",
		"reference_owner": frm.doc.owner
	};
	frappe.new_doc("Patient Medical Record");
};

var btn_create_vital_signs = function (frm) {
	if(!frm.doc.patient){
		frappe.throw(__("Please select patient"));
	}
	frappe.route_options = {
		"patient": frm.doc.patient,
		"appointment": frm.doc.appointment
	};
	frappe.new_doc("Vital Signs");
};

var btn_create_procedure = function (frm) {
	if(!frm.doc.patient){
		frappe.throw(__("Please select patient"));
	}
	frappe.route_options = {
		"patient": frm.doc.patient,
		"medical_department": frm.doc.visit_department
	};
	frappe.new_doc("Clinical Procedure");
};

frappe.ui.form.on("Patient Encounter", "appointment", function(frm){
	if(frm.doc.appointment){
		frappe.call({
			"method": "frappe.client.get",
			args: {
				doctype: "Patient Appointment",
				name: frm.doc.appointment
			},
			callback: function (data) {
				frappe.model.set_value(frm.doctype,frm.docname, "patient", data.message.patient);
				frappe.model.set_value(frm.doctype,frm.docname, "type", data.message.appointment_type);
				frappe.model.set_value(frm.doctype,frm.docname, "practitioner", data.message.practitioner);
				frappe.model.set_value(frm.doctype,frm.docname, "invoiced", data.message.invoiced);
			}
		});
	}
	else{
		frappe.model.set_value(frm.doctype,frm.docname, "patient", "");
		frappe.model.set_value(frm.doctype,frm.docname, "type", "");
		frappe.model.set_value(frm.doctype,frm.docname, "practitioner", "");
		frappe.model.set_value(frm.doctype,frm.docname, "invoiced", 0);
	}
});

frappe.ui.form.on("Patient Encounter", "practitioner", function(frm) {
	if(frm.doc.practitioner){
		frappe.call({
			"method": "frappe.client.get",
			args: {
				doctype: "Healthcare Practitioner",
				name: frm.doc.practitioner
			},
			callback: function (data) {
				frappe.model.set_value(frm.doctype,frm.docname, "visit_department",data.message.department);
			}
		});
	}
});

frappe.ui.form.on("Patient Encounter", "symptoms_select", function(frm) {
	if(frm.doc.symptoms_select){
		var symptoms = null;
		if(frm.doc.symptoms)
			symptoms = frm.doc.symptoms + "\n" +frm.doc.symptoms_select;
		else
			symptoms = frm.doc.symptoms_select;
		frappe.model.set_value(frm.doctype,frm.docname, "symptoms", symptoms);
		frappe.model.set_value(frm.doctype,frm.docname, "symptoms_select", null);
	}
});
frappe.ui.form.on("Patient Encounter", "diagnosis_select", function(frm) {
	if(frm.doc.diagnosis_select){
		var diagnosis = null;
		if(frm.doc.diagnosis)
			diagnosis = frm.doc.diagnosis + "\n" +frm.doc.diagnosis_select;
		else
			diagnosis = frm.doc.diagnosis_select;
		frappe.model.set_value(frm.doctype,frm.docname, "diagnosis", diagnosis);
		frappe.model.set_value(frm.doctype,frm.docname, "diagnosis_select", null);
	}
});

frappe.ui.form.on("Patient Encounter", "patient", function(frm) {
	if(frm.doc.patient){
		frappe.call({
			"method": "erpnext.healthcare.doctype.patient.patient.get_patient_detail",
			args: {
				patient: frm.doc.patient
			},
			callback: function (data) {
				var age = "";
				if(data.message.dob){
					age = calculate_age(data.message.dob);
				}
				frappe.model.set_value(frm.doctype,frm.docname, "patient_age", age);
				frappe.model.set_value(frm.doctype,frm.docname, "patient_sex", data.message.sex);
			}
		});
	}
});

frappe.ui.form.on("Drug Prescription", {
	drug_code:  function(frm, cdt, cdn) {
		var child = locals[cdt][cdn];
		if(child.drug_code){
			frappe.call({
				"method": "frappe.client.get",
				args: {
					doctype: "Item",
					name: child.drug_code,
				},
				callback: function (data) {
					frappe.model.set_value(cdt, cdn, 'drug_name',data.message.item_name);
				}
			});
		}
	},
	dosage: function(frm, cdt, cdn){
		frappe.model.set_value(cdt, cdn, 'update_schedule', 1);
		var child = locals[cdt][cdn];
		if(child.dosage){
			frappe.model.set_value(cdt, cdn, 'in_every', 'Day');
			frappe.model.set_value(cdt, cdn, 'interval', 1);
		}
	},
	period: function(frm, cdt, cdn){
		frappe.model.set_value(cdt, cdn, 'update_schedule', 1);
	},
	in_every: function(frm, cdt, cdn){
		frappe.model.set_value(cdt, cdn, 'update_schedule', 1);
		var child = locals[cdt][cdn];
		if(child.in_every == "Hour"){
			frappe.model.set_value(cdt, cdn, 'dosage', null);
		}
	}
});


frappe.ui.form.on("Procedure Prescription", {
	procedure:  function(frm, cdt, cdn) {
		var child = locals[cdt][cdn];
		if(child.procedure){
			frappe.call({
				"method": "frappe.client.get_value",
				args: {
					doctype: "Clinical Procedure Template",
					fieldname: "medical_department",
					filters: {name: child.procedure}
				},
				callback: function (data) {
					frappe.model.set_value(cdt, cdn, 'department',data.message.medical_department);
				}
			});
		}
	}
});


var calculate_age = function(birth) {
	var ageMS = Date.parse(Date()) - Date.parse(birth);
	var age = new Date();
	age.setTime(ageMS);
	var years =  age.getFullYear() - 1970;
	return  years + " Year(s) " + age.getMonth() + " Month(s) " + age.getDate() + " Day(s)";
};


frappe.ui.form.on('Patient Encounter Item', {
	qty: function(frm, cdt, cdn) {
		frm.events.set_serial_no(frm, cdt, cdn, () => {
			frm.events.set_basic_rate(frm, cdt, cdn);
		});
	},

	conversion_factor: function(frm, cdt, cdn) {
		frm.events.set_basic_rate(frm, cdt, cdn);
	},

	s_warehouse: function(frm, cdt, cdn) {
		frm.events.set_serial_no(frm, cdt, cdn, () => {
			frm.events.get_warehouse_details(frm, cdt, cdn);
		});
	},

	t_warehouse: function(frm, cdt, cdn) {
		frm.events.get_warehouse_details(frm, cdt, cdn);
	},

	basic_rate: function(frm, cdt, cdn) {
		var item = locals[cdt][cdn];
		frm.events.calculate_basic_amount(frm, item);
	},

	barcode: function(doc, cdt, cdn) {
		var d = locals[cdt][cdn];
		if (d.barcode) {
			frappe.call({
				method: "erpnext.stock.get_item_details.get_item_code",
				args: {"barcode": d.barcode },
				callback: function(r) {
					if (!r.exe){
						frappe.model.set_value(cdt, cdn, "item_code", r.message);
					}
				}
			});
		}
	},

	uom: function(doc, cdt, cdn) {
		var d = locals[cdt][cdn];
		if(d.uom && d.item_code){
			return frappe.call({
				method: "erpnext.stock.doctype.stock_entry.stock_entry.get_uom_details",
				args: {
					item_code: d.item_code,
					uom: d.uom,
					qty: d.qty
				},
				callback: function(r) {
					if(r.message) {
						frappe.model.set_value(cdt, cdn, r.message);
					}
				}
			});
		}
	},

	item_code: function(frm, cdt, cdn) {
		var d = locals[cdt][cdn];
		if(d.item_code) {
			var args = {
				'item_code'			: d.item_code,
				'warehouse'			: cstr(d.s_warehouse) || cstr(d.t_warehouse),
				'transfer_qty'		: d.transfer_qty,
				'serial_no'		: d.serial_no,
				'bom_no'		: d.bom_no,
				'expense_account'	: d.expense_account,
				'cost_center'		: d.cost_center,
				'company'		: frm.doc.company,
				'qty'			: d.qty,
				'voucher_type'		: frm.doc.doctype,
				'voucher_no'		: d.name,
				'allow_zero_valuation': 1,
			};

			return frappe.call({
				doc: frm.doc,
				method: "get_item_details",
				args: args,
				callback: function(r) {
					if(r.message) {
						var d = locals[cdt][cdn];
						$.each(r.message, function(k, v) {
							if (v) {
								frappe.model.set_value(cdt, cdn, k, v); // qty and it's subsequent fields weren't triggered
							}
						});
						refresh_field("items");

						if (!d.serial_no) {
							erpnext.stock.select_batch_and_serial_no(frm, d);
						}
					}
				}
			});
		}
	},
	expense_account: function(frm, cdt, cdn) {
		erpnext.utils.copy_value_in_all_rows(frm.doc, cdt, cdn, "items", "expense_account");
	},
	cost_center: function(frm, cdt, cdn) {
		erpnext.utils.copy_value_in_all_rows(frm.doc, cdt, cdn, "items", "cost_center");
	},
	sample_quantity: function(frm, cdt, cdn) {
		validate_sample_quantity(frm, cdt, cdn);
	},
	batch_no: function(frm, cdt, cdn) {
		validate_sample_quantity(frm, cdt, cdn);
	},
});


erpnext.stock.select_batch_and_serial_no = (frm, item) => {
	let get_warehouse_type_and_name = (item) => {
		let value = '';
		if(frm.fields_dict.from_warehouse.disp_status === "Write") {
			value = cstr(item.s_warehouse) || '';
			return {
				type: 'Source Warehouse',
				name: value
			};
		} else {
			value = cstr(item.t_warehouse) || '';
			return {
				type: 'Target Warehouse',
				name: value
			};
		}
	}

	if(item && !item.has_serial_no && !item.has_batch_no) return;
	if (frm.doc.purpose === 'Material Receipt') return;

	frappe.require("assets/erpnext/js/utils/serial_no_batch_selector.js", function() {
		new erpnext.SerialNoBatchSelector({
			frm: frm,
			item: item,
			warehouse_details: get_warehouse_type_and_name(item),
		});
	});

}
