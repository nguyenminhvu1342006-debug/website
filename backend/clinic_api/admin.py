from django.contrib import admin
from .models import Doctor, Patient, Appointment, Specialty, MedicalRecord, Prescription, Receptionist

admin.site.register(Doctor)
admin.site.register(Appointment)
admin.site.register(Patient)
admin.site.register(Specialty)
admin.site.register(MedicalRecord)
admin.site.register(Prescription)
admin.site.register(Receptionist)
