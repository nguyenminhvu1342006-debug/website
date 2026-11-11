from rest_framework import serializers

from .models import Patient


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
        parts = patient.full_name.split()
        return ''.join(part[0] for part in (parts[:1] + parts[-1:] if len(parts) > 1 else parts)).upper()
