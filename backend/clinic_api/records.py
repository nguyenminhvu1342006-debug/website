"""Read-only finalized medical records, scoped to the requesting user."""
from django.db.models import Q
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Appointment, MedicalRecord
from .permissions import IsDoctor, IsPatient
from .reception import generated_patient_user_id
from .serializers import MedicalRecordSerializer


class RecordFilters(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True, max_length=200)
    date = serializers.DateField(required=False)
    year = serializers.IntegerField(required=False, min_value=1900, max_value=9999)
    patient_user_id = serializers.IntegerField(required=False, min_value=1)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=100)


def record_queryset():
    return MedicalRecord.objects.select_related(
        'appointment__doctor__specialization', 'appointment__patient__patient_profile',
    ).prefetch_related('prescriptions').filter(appointment__status='Completed').order_by(
        '-appointment__date', '-appointment__time', '-id',
    )


def can_read_patient_history(doctor, patient_id):
    # A cancelled or merely scheduled appointment does not authorize reading
    # another clinician's records. Checked-in/completed care does.
    return Appointment.objects.filter(doctor=doctor, patient_id=patient_id,
                                      status__in=['Checked-in', 'Completed']).exists()


def filtered_records(qs, params):
    if 'date' in params:
        qs = qs.filter(appointment__date=params['date'])
    if 'year' in params:
        qs = qs.filter(appointment__date__year=params['year'])
    search = params.get('search', '').strip()
    if search:
        matches = (Q(diagnosis__icontains=search) | Q(notes__icontains=search)
                   | Q(appointment__doctor__full_name__icontains=search)
                   | Q(appointment__doctor__specialization__name__icontains=search)
                   | Q(appointment__patient__patient_profile__full_name__icontains=search)
                   | Q(appointment__patient__username__icontains=search)
                   | Q(appointment__patient__patient_profile__patient_id__iexact=search)
                   | Q(prescriptions__medication_name__icontains=search))
        user_id = generated_patient_user_id(search)
        if user_id:
            matches |= (Q(appointment__patient_id=user_id)
                        & (Q(appointment__patient__patient_profile__patient_id__isnull=True)
                           | Q(appointment__patient__patient_profile__patient_id='')))
        qs = qs.filter(matches).distinct()
    if 'limit' in params:
        qs = qs[:params['limit']]
    return qs


class PatientMedicalRecordListView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        serializer = RecordFilters(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        # Patient IDs from the client never determine ownership.
        qs = record_queryset().filter(appointment__patient=request.user)
        return Response(MedicalRecordSerializer(filtered_records(qs, serializer.validated_data), many=True).data)


class PatientMedicalRecordDetailView(APIView):
    permission_classes = [IsPatient]

    def get(self, request, pk):
        record = record_queryset().filter(pk=pk, appointment__patient=request.user).first()
        if not record:
            raise NotFound('Không tìm thấy bệnh án của bạn.')
        return Response(MedicalRecordSerializer(record).data)


class DoctorMedicalRecordListView(APIView):
    permission_classes = [IsDoctor]

    def get(self, request):
        serializer = RecordFilters(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        params = serializer.validated_data
        doctor = request.user.doctor_profile
        qs = record_queryset()
        patient_id = params.get('patient_user_id')
        if patient_id:
            if not can_read_patient_history(doctor, patient_id):
                raise PermissionDenied('Chỉ được đọc tiền sử bệnh nhân đã check-in hoặc đã khám với bạn.')
            qs = qs.filter(appointment__patient_id=patient_id)
        else:
            qs = qs.filter(appointment__doctor=doctor)
        return Response(MedicalRecordSerializer(filtered_records(qs, params), many=True).data)


class DoctorMedicalRecordDetailView(APIView):
    permission_classes = [IsDoctor]

    def get(self, request, pk):
        doctor = request.user.doctor_profile
        record = record_queryset().filter(pk=pk).first()
        if not record:
            raise NotFound('Không tìm thấy bệnh án đã hoàn tất.')
        if (record.appointment.doctor_id != doctor.pk
                and not can_read_patient_history(doctor, record.appointment.patient_id)):
            raise PermissionDenied('Bạn không có quyền xem bệnh án này.')
        return Response(MedicalRecordSerializer(record).data)
