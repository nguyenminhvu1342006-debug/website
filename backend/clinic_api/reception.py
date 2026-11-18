"""Reception desk: patient registration, booking and check-in."""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .booking import BookingSerializer, book
from .models import Appointment, Patient
from .permissions import IsReceptionist
from .serializers import DoctorAppointmentSerializer, PatientProfileSerializer

User = get_user_model()


class RegistrationSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    full_name = serializers.CharField(max_length=100)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_username(self, value):
        try:
            User._meta.get_field('username').run_validators(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Tên đăng nhập đã tồn tại.')
        return value

    def validate(self, attrs):
        if attrs.get('date_of_birth') and attrs['date_of_birth'] > timezone.localdate():
            raise serializers.ValidationError({'date_of_birth': 'Ngày sinh không được ở tương lai.'})
        try:
            validate_password(attrs['password'], User(username=attrs['username']))
        except DjangoValidationError as error:
            raise serializers.ValidationError({'password': error.messages})
        return attrs


class ReceptionPatientsView(APIView):
    permission_classes = [IsReceptionist]

    def get(self, request):
        patients = Patient.objects.select_related('user').filter(user__is_active=True)
        search = request.query_params.get('search', '').strip()
        if search:
            patients = patients.filter(Q(full_name__icontains=search) | Q(phone__icontains=search)
                                       | Q(patient_id__icontains=search) | Q(user__username__icontains=search))
        return Response([dict(PatientProfileSerializer(patient).data, user_id=patient.user_id,
                              username=patient.user.username) for patient in patients.order_by('full_name')[:100]])

    @transaction.atomic
    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data.copy()
        username = data.pop('username')
        password = data.pop('password')
        # Serialize username creation against concurrent registration requests.
        User.objects.select_for_update().get(pk=request.user.pk)
        if User.objects.filter(username=username).exists():
            raise ValidationError({'username': 'Tên đăng nhập đã tồn tại.'})
        try:
            with transaction.atomic():
                user = User.objects.create_user(username=username, password=password)
        except IntegrityError:
            raise ValidationError({'username': 'Tên đăng nhập đã tồn tại.'})
        patient = Patient.objects.create(user=user, **data)
        return Response(dict(PatientProfileSerializer(patient).data, user_id=user.pk), status=201)


class ReceptionAppointmentsView(APIView):
    permission_classes = [IsReceptionist]

    def get(self, request):
        query = serializers.DateField()
        day = query.run_validation(request.query_params.get('date', timezone.localdate().isoformat()))
        appointments = Appointment.objects.select_related(
            'doctor__specialization', 'patient__patient_profile', 'medical_record',
        ).filter(date=day)
        search = request.query_params.get('search', '').strip()
        if search:
            appointments = appointments.filter(
                Q(patient__patient_profile__full_name__icontains=search)
                | Q(patient__patient_profile__phone__icontains=search)
                | Q(patient__username__icontains=search))
        return Response([dict(DoctorAppointmentSerializer(app).data,
                              doctor_name=app.doctor.full_name) for app in appointments.order_by('time', 'pk')])

    def post(self, request):
        patient_id = serializers.IntegerField(min_value=1).run_validation(request.data.get('patient_user_id'))
        patient = Patient.objects.select_related('user').filter(user_id=patient_id, user__is_active=True).first()
        if not patient:
            raise NotFound('Không tìm thấy bệnh nhân.')
        serializer = BookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appointment = book(patient.user, serializer.validated_data)
        return Response({'id': appointment.pk}, status=201)


class ReceptionAppointmentActionView(APIView):
    permission_classes = [IsReceptionist]

    def post(self, request, pk):
        action = request.data.get('action')
        if action == 'check-in':
            changed = Appointment.objects.filter(pk=pk, date=timezone.localdate(), status='Confirmed').update(status='Checked-in')
            if not changed:
                raise ValidationError('Chỉ check-in lịch hôm nay, đang ở trạng thái Confirmed.')
        elif action == 'cancel':
            changed = Appointment.objects.filter(pk=pk, status='Confirmed').update(status='Cancelled')
            if not changed:
                raise ValidationError('Chỉ được hủy lịch chưa check-in.')
        elif action == 'reschedule':
            appointment = Appointment.objects.select_related('patient').filter(pk=pk).first()
            if not appointment:
                raise NotFound('Không tìm thấy lịch.')
            serializer = BookingSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            book(appointment.patient, serializer.validated_data, appointment=appointment)
        else:
            raise ValidationError({'action': 'Thao tác không hợp lệ.'})
        return Response({'message': 'Đã cập nhật lịch hẹn.'})


class ReceptionProfileView(APIView):
    permission_classes = [IsReceptionist]

    def get(self, request):
        return Response({'username': request.user.username,
                         'full_name': request.user.get_full_name() or request.user.username,
                         'email': request.user.email})

    def put(self, request):
        class ProfileSerializer(serializers.Serializer):
            full_name = serializers.CharField(max_length=100)
            email = serializers.EmailField(required=False, allow_blank=True)
        serializer = ProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        parts = serializer.validated_data['full_name'].split(' ', 1)
        user = request.user
        user.first_name = parts[0]
        user.last_name = parts[1] if len(parts) > 1 else ''
        user.email = serializer.validated_data.get('email', user.email)
        user.save(update_fields=['first_name', 'last_name', 'email'])
        return self.get(request)
