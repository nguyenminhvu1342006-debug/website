"""Reception desk: patient registration, booking and check-in."""
import re
import secrets
import string

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import F, Max, Q, Value
from django.db.models.functions import Replace
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .booking import BookingSerializer, book
from .models import Appointment, Doctor, Patient, Receptionist
from .permissions import IsDoctor, IsReceptionist
from .serializers import DoctorAppointmentSerializer, PatientProfileSerializer, _build_initials

User = get_user_model()


def generated_patient_user_id(value):
    match = re.fullmatch(r'A([0-9]{7,19})', value.upper())
    if match:
        user_id = int(match.group(1))
        if 0 < user_id <= 9223372036854775807 and value.upper() == f'A{user_id:07d}':
            return user_id
    return None


def filter_patient_search(patients, search):
    if not search:
        return patients
    matches = (Q(full_name__icontains=search) | Q(phone__icontains=search)
               | Q(patient_id__icontains=search) | Q(user__username__icontains=search)
               | Q(address__icontains=search))
    user_id = generated_patient_user_id(search)
    if user_id:
        matches |= Q(user_id=user_id) & (Q(patient_id__isnull=True) | Q(patient_id=''))
    return patients.filter(matches)


class DoctorPatientSuggestionsView(APIView):
    permission_classes = [IsDoctor]

    def get(self, request):
        patients = Patient.objects.select_related('user').filter(
            user__is_active=True, user__appointments__doctor=request.user.doctor_profile,
        ).distinct()
        patients = filter_patient_search(patients, request.query_params.get('search', '').strip())
        return Response([{
            'id': patient.patient_id or f'A{patient.user_id:07d}',
            'user_id': patient.user_id, 'full_name': patient.full_name,
            'username': patient.user.username, 'phone': patient.phone,
        } for patient in patients.order_by('full_name', 'pk')[:100]])


def normalize_phone(phone):
    """'+84 902 123 456' -> '0902123456' (dùng để so trùng SĐT và làm tên đăng nhập mặc định)."""
    digits = ''.join(ch for ch in (phone or '') if ch.isdigit())
    if digits.startswith('84') and len(digits) == 11:
        digits = '0' + digits[2:]
    return digits


def generate_initial_password(length=10):
    """Mật khẩu ban đầu ngẫu nhiên (UC-10 bước 3), luôn có chữ hoa, chữ thường và số."""
    alphabet = string.ascii_letters + string.digits
    while True:
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.islower() for c in password) and any(c.isupper() for c in password)
                and any(c.isdigit() for c in password)):
            return password


def _digits_only(field):
    """Biểu thức SQL bỏ các ký tự định dạng thường gặp trong SĐT: khoảng trắng . - ( ) +"""
    expression = F(field)
    for char in (' ', '.', '-', '(', ')', '+'):
        expression = Replace(expression, Value(char), Value(''))
    return expression


def find_patient_by_phone(phone):
    """Tìm bệnh nhân có cùng SĐT, bất kể cách viết (+84 912 000 111 == 0912000111)."""
    digits = normalize_phone(phone)
    if len(digits) < 9:
        return None
    candidates = (Patient.objects.select_related('user')
                  .annotate(phone_digits=_digits_only('phone'))
                  .filter(phone_digits__endswith=digits[-9:]))
    return next((patient for patient in candidates if normalize_phone(patient.phone) == digits), None)


def _patient_code(patient):
    return patient.patient_id or f'A{patient.user_id:07d}'


class RegistrationSerializer(serializers.Serializer):
    # Bỏ trống username -> dùng SĐT; bỏ trống password -> hệ thống tự sinh và trả về một lần.
    username = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False, required=False, allow_blank=True)
    full_name = serializers.CharField(max_length=100)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    phone = serializers.CharField(max_length=20)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    blood_type = serializers.CharField(max_length=10, required=False, allow_blank=True)
    known_allergies = serializers.CharField(max_length=255, required=False, allow_blank=True)
    emergency_contact_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    emergency_contact_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_username(self, value):
        value = value.strip()
        if not value:
            return value
        try:
            User._meta.get_field('username').run_validators(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Tên đăng nhập đã tồn tại.')
        return value

    def validate_phone(self, value):
        if not 9 <= len(normalize_phone(value)) <= 15:
            raise serializers.ValidationError('Số điện thoại không hợp lệ.')
        return value.strip()

    def validate(self, attrs):
        if attrs.get('date_of_birth') and attrs['date_of_birth'] > timezone.localdate():
            raise serializers.ValidationError({'date_of_birth': 'Ngày sinh không được ở tương lai.'})

        # UC-10 (2a): SĐT đã đăng ký cho bệnh nhân khác -> báo trùng và gợi ý mở hồ sơ cũ.
        digits = normalize_phone(attrs['phone'])
        existing = find_patient_by_phone(attrs['phone'])
        if existing:
            raise serializers.ValidationError({
                'phone': 'Số điện thoại đã được đăng ký cho một bệnh nhân khác.',
                'existing_patient': {'user_id': existing.user_id, 'full_name': existing.full_name,
                                     'patient_code': _patient_code(existing), 'phone': existing.phone},
            })

        if not attrs.get('username'):
            if User.objects.filter(username=digits).exists():
                raise serializers.ValidationError({'phone': 'Số điện thoại này đã được dùng làm tên đăng nhập.'})
            attrs['username'] = digits

        attrs['password_generated'] = not attrs.get('password')
        if attrs['password_generated']:
            attrs['password'] = generate_initial_password()
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
        patients = filter_patient_search(patients, search)
        return Response([dict(PatientProfileSerializer(patient).data, user_id=patient.user_id,
                              username=patient.user.username) for patient in patients.order_by('full_name')[:100]])

    @transaction.atomic
    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data.copy()
        username = data.pop('username')
        password = data.pop('password')
        password_generated = data.pop('password_generated')
        # Serialize username creation against concurrent registration requests.
        User.objects.select_for_update().get(pk=request.user.pk)
        if User.objects.filter(username=username).exists():
            raise ValidationError({'username': 'Tên đăng nhập đã tồn tại.'})
        try:
            with transaction.atomic():
                user = User.objects.create_user(username=username, password=password)
        except IntegrityError:
            raise ValidationError({'username': 'Tên đăng nhập đã tồn tại.'})
        parts = data['full_name'].split(' ', 1)
        user.first_name, user.last_name = parts[0], parts[1] if len(parts) > 1 else ''
        user.save(update_fields=['first_name', 'last_name'])
        patient = Patient.objects.create(user=user, patient_id=f'A{user.pk:07d}', **data)
        result = dict(PatientProfileSerializer(patient).data, user_id=user.pk, username=username)
        if password_generated:
            # Trả về đúng một lần để Lễ tân đưa cho bệnh nhân (thay cho bước gửi SMS).
            result['initial_password'] = password
        return Response(result, status=201)


class ReceptionAppointmentsView(APIView):
    permission_classes = [IsReceptionist]

    def get(self, request):
        params = request.query_params
        query = serializers.DateField()
        appointments = Appointment.objects.select_related(
            'doctor__specialization', 'patient__patient_profile', 'medical_record',
        )
        # Mặc định: lịch của một ngày (?date=, mặc định hôm nay).
        # Màn hình Check-in dùng khoảng ngày: ?date_from=&date_to= (bỏ qua ?date).
        if params.get('date_from') or params.get('date_to'):
            if params.get('date_from'):
                appointments = appointments.filter(date__gte=query.run_validation(params['date_from']))
            if params.get('date_to'):
                appointments = appointments.filter(date__lte=query.run_validation(params['date_to']))
        else:
            day = query.run_validation(params.get('date', timezone.localdate().isoformat()))
            appointments = appointments.filter(date=day)

        statuses = [item.strip() for item in params.get('status', '').split(',') if item.strip()]
        if statuses:
            valid = {choice for choice, _ in Appointment.STATUS_CHOICES}
            if not set(statuses) <= valid:
                raise ValidationError({'status': 'Trạng thái không hợp lệ.'})
            appointments = appointments.filter(status__in=statuses)

        search = params.get('search', '').strip()
        if search:
            matches = (
                Q(patient__patient_profile__full_name__icontains=search)
                | Q(patient__patient_profile__phone__icontains=search)
                | Q(patient__username__icontains=search)
                | Q(patient__patient_profile__patient_id__iexact=search)
            )
            user_id = generated_patient_user_id(search)
            if user_id:
                no_custom_code = (Q(patient__patient_profile__patient_id__isnull=True)
                                  | Q(patient__patient_profile__patient_id=''))
                matches |= Q(patient_id=user_id) & no_custom_code
            code = search[1:] if search.startswith('#') else ''
            if code.isdigit():  # UC-09: tra theo mã lịch hẹn, vd "#12"
                matches = Q(pk=int(code))
            appointments = appointments.filter(matches)

        order = ('-date', '-time', '-pk') if params.get('order') == 'desc' else ('date', 'time', 'pk')
        return Response([dict(DoctorAppointmentSerializer(app).data,
                              doctor_id=app.doctor_id,
                              doctor_name=app.doctor.full_name,
                              doctor_specialty=app.doctor.specialization.name if app.doctor.specialization else '',
                              queue_number=app.queue_number)
                         for app in appointments.order_by(*order)[:200]])

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
            return Response(self.check_in(pk))
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


    @staticmethod
    @transaction.atomic
    def check_in(pk):
        """UC-09: Confirmed -> Checked-in và cấp số thứ tự hàng chờ theo bác sĩ trong ngày."""
        today = timezone.localdate()
        doctor_id = Appointment.objects.filter(pk=pk).values_list('doctor_id', flat=True).first()
        # Khóa bác sĩ trước (cùng thứ tự với booking.book) để số thứ tự không bị trùng.
        Doctor.objects.select_for_update().filter(pk=doctor_id).first()
        appointment = Appointment.objects.select_for_update().filter(
            pk=pk, date=today, status='Confirmed').first()
        if not appointment:
            raise ValidationError('Không tìm thấy lịch hẹn hợp lệ: chỉ check-in lịch hôm nay, đang ở trạng thái Confirmed.')
        last = Appointment.objects.filter(doctor_id=doctor_id, date=today).aggregate(
            value=Max('queue_number'))['value'] or 0
        appointment.status = 'Checked-in'
        appointment.queue_number = last + 1
        appointment.save(update_fields=['status', 'queue_number'])
        return {'message': 'Đã check-in.', 'queue_number': appointment.queue_number}


class ReceptionProfileSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=100)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    position = serializers.CharField(max_length=100, required=False, allow_blank=True)
    assigned_counter = serializers.CharField(max_length=50, required=False, allow_blank=True)
    department = serializers.CharField(max_length=100, required=False, allow_blank=True)
    current_shift = serializers.CharField(max_length=100, required=False, allow_blank=True)


class ReceptionProfileView(APIView):
    """Hồ sơ nhân viên Lễ tân (màn hình Staff Profile)."""

    permission_classes = [IsReceptionist]
    WORK_FIELDS = ('phone', 'position', 'assigned_counter', 'department', 'current_shift')

    def get(self, request):
        user = request.user
        profile = Receptionist.objects.filter(user=user).first() or Receptionist(user=user)
        full_name = user.get_full_name() or user.username
        return Response(dict(
            {field: getattr(profile, field) for field in self.WORK_FIELDS},
            username=user.username, full_name=full_name, email=user.email,
            staff_code=profile.staff_code, avatar_initials=_build_initials(full_name, fallback='LT'),
        ))

    @transaction.atomic
    def put(self, request):
        serializer = ReceptionProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        parts = data['full_name'].strip().split(' ', 1)
        user = request.user
        user.first_name = parts[0]
        user.last_name = parts[1] if len(parts) > 1 else ''
        user.email = data.get('email', user.email)
        user.save(update_fields=['first_name', 'last_name', 'email'])
        profile, _ = Receptionist.objects.get_or_create(user=user)
        for field in self.WORK_FIELDS:
            if field in data:
                setattr(profile, field, data[field])
        profile.save()
        return self.get(request)
