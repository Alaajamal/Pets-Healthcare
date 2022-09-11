from __future__ import unicode_literals
from frappe import _

def get_data():
	return {
		'heatmap_message': _('This is based on transactions against this Pet Owner. See timeline below for details'),
		'fieldname': 'pet_owner',
		'transactions': [
			{
				'label': _('Appointments and Patient'),
				'items': ['Patient Appointment', 'Patient']
			}
			
		]
	}
