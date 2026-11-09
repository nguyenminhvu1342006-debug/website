from rest_framework import serializers
from .models import Specialty, Doctor, Patient, ScheduleSlot, Appointment, MedicalRecord

class SpecialtySerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialty
        fields = '__all__'

class DoctorSerializer(serializers.ModelSerializer):
    # Lấy thêm tên chuyên khoa và tên user để hiển thị đẹp hơn trên Frontend
    specialty_name = serializers.CharField(source='specialty.name', read_only=True)
    doctor_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Doctor
        fields = '__all__'

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = '__all__'

class ScheduleSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduleSlot
        fields = '__all__'

class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    
    class Meta:
        model = Appointment
        fields = '__all__'

class MedicalRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalRecord
        fields = '__all__'