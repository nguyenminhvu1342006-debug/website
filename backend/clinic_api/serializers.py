from rest_framework import serializers
from .models import Appointment, Doctor, MedicalRecord, Patient, Prescription


def _build_initials(full_name, fallback='U'):
    parts = (full_name or '').replace('Dr. ', '').split()
    if not parts:
        return fallback
    selected = parts[:1] + parts[-1:] if len(parts) > 1 else parts
    return ''.join(part[0] for part in selected).upper()


def _get_patient_info(user):
    """Lấy thông tin bệnh nhân an toàn từ Patient profile (fallback sang User)."""
    profile = getattr(user, 'patient_profile', None)
    full_name = (
        (profile.full_name if profile and profile.full_name else None)
        or user.get_full_name()
        or user.username
    )
    patient_code = (
        profile.patient_id if profile and profile.patient_id else f'A{user.id:07d}'
    )
    return {
        'user_id': user.id,
        'patient_code': patient_code,
        'full_name': full_name,
        'initials': _build_initials(full_name, fallback='BN'),
        'date_of_birth': profile.date_of_birth if profile else None,
        'phone': profile.phone if profile else '',
        'blood_type': profile.blood_type if profile else '',
        'known_allergies': profile.known_allergies if profile else '',
    }


class PatientProfileSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    allergies = serializers.CharField(source='known_allergies', required=False, allow_blank=True, max_length=255)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    avatar_initials = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = (
            'id', 'full_name', 'date_of_birth', 'phone', 'address',
            'blood_type', 'allergies', 'emergency_contact_name',
            'emergency_contact_phone', 'avatar_initials',
        )

    def get_id(self, patient):
        return patient.patient_id or f'A{patient.user_id:07d}'

    def get_avatar_initials(self, patient):
        return _build_initials(patient.full_name, fallback='BN')


class DoctorProfileSerializer(serializers.ModelSerializer):
    doctor_code = serializers.SerializerMethodField()
    specialization_name = serializers.SerializerMethodField()
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    avatar_initials = serializers.SerializerMethodField()

    class Meta:
        model = Doctor
        fields = (
            'id', 'doctor_code', 'full_name', 'date_of_birth', 'phone',
            'address', 'specialization_name', 'education', 'certificate',
            'avatar_initials',
        )
        read_only_fields = ('id', 'doctor_code', 'specialization_name', 'avatar_initials')

    def get_doctor_code(self, doctor):
        return f'BS{doctor.id:05d}' if doctor.id else 'BS00000'

    def get_specialization_name(self, doctor):
        return doctor.specialization.name if doctor.specialization else 'Chưa phân khoa'

    def get_avatar_initials(self, doctor):
        return _build_initials(doctor.full_name, fallback='DR')


class PrescriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prescription
        fields = ('id', 'medication_name', 'dosage', 'instructions')

    def validate_medication_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Tên thuốc không được để trống.')
        return cleaned

    def validate_dosage(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Liều lượng không được để trống.')
        return cleaned


class MedicalRecordSerializer(serializers.ModelSerializer):
    appointment_id = serializers.IntegerField(source='appointment.id', read_only=True)
    appointment_date = serializers.DateField(source='appointment.date', read_only=True)
    appointment_time = serializers.SerializerMethodField()
    doctor_id = serializers.IntegerField(source='appointment.doctor.id', read_only=True)
    doctor_name = serializers.CharField(source='appointment.doctor.full_name', read_only=True)
    doctor_specialty = serializers.SerializerMethodField()
    patient = serializers.SerializerMethodField()
    prescriptions = PrescriptionSerializer(many=True, read_only=True)

    class Meta:
        model = MedicalRecord
        fields = (
            'id', 'appointment_id', 'appointment_date', 'appointment_time',
            'doctor_id', 'doctor_name', 'doctor_specialty',
            'patient', 'diagnosis', 'notes', 'prescriptions', 'created_at',
        )

    def get_appointment_time(self, record):
        return record.appointment.time.strftime('%H:%M') if record.appointment.time else ''

    def get_doctor_specialty(self, record):
        spec = record.appointment.doctor.specialization
        return spec.name if spec else 'General'

    def get_patient(self, record):
        return _get_patient_info(record.appointment.patient)


class CreateMedicalRecordSerializer(serializers.Serializer):
    diagnosis = serializers.CharField(trim_whitespace=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    prescriptions = PrescriptionSerializer(many=True, required=False, default=list)

    def validate_diagnosis(self, value):
        if not value.strip():
            raise serializers.ValidationError('Vui lòng nhập chẩn đoán bệnh.')
        return value.strip()

    def create(self, validated_data):
        appointment = self.context['appointment']
        prescriptions_data = validated_data.pop('prescriptions', [])
        record = MedicalRecord.objects.create(
            appointment=appointment,
            diagnosis=validated_data['diagnosis'],
            notes=validated_data.get('notes', ''),
        )
        if prescriptions_data:
            Prescription.objects.bulk_create([
                Prescription(medical_record=record, **item)
                for item in prescriptions_data
            ])
        return record


class DoctorAppointmentSerializer(serializers.ModelSerializer):
    time = serializers.SerializerMethodField()
    patient_info = serializers.SerializerMethodField()
    has_medical_record = serializers.SerializerMethodField()
    medical_record_id = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = (
            'id', 'date', 'time', 'status',
            'patient_info', 'has_medical_record', 'medical_record_id',
        )

    def get_time(self, appointment):
        return appointment.time.strftime('%H:%M') if appointment.time else ''

    def get_patient_info(self, appointment):
        return _get_patient_info(appointment.patient)

    def get_has_medical_record(self, appointment):
        return hasattr(appointment, 'medical_record')

    def get_medical_record_id(self, appointment):
        record = getattr(appointment, 'medical_record', None)
        return record.id if record else None
