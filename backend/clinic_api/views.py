from datetime import timedelta
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.db.models import Case, IntegerField, Q, Value, When
from django.utils import timezone
from rest_framework import status, serializers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Appointment, Doctor, Patient
from .records import DoctorMedicalRecordListView, DoctorMedicalRecordDetailView
from .reception import generated_patient_user_id
from .permissions import IsDoctor, IsPatient
from .booking import BookingSerializer, SlotQuerySerializer, SLOTS, OCCUPIED, book
from .serializers import (
    CreateMedicalRecordSerializer,
    DoctorAppointmentSerializer,
    DoctorProfileSerializer,
    MedicalRecordSerializer,
    PatientProfileSerializer,
)

User = get_user_model()


def _resolve_user_role(user):
    if hasattr(user, 'doctor_profile'):
        return 'doctor'
    if user.is_superuser or user.groups.filter(name='Receptionist').exists():
        return 'receptionist'
    return 'patient'

class AvailableSlotsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = SlotQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        data = query.validated_data
        if not Doctor.objects.filter(pk=data['doctor_id']).exists():
            raise NotFound('Không tìm thấy bác sĩ.')
        booked = set(Appointment.objects.filter(
            doctor_id=data['doctor_id'], date=data['date'], status__in=OCCUPIED,
        ).values_list('time', flat=True))
        now = timezone.localtime()
        slots = [slot.strftime('%H:%M:%S') for slot in SLOTS if slot not in booked
                 and (data['date'] > now.date() or slot > now.time())]
        return Response({'available_slots': slots})


class BookAppointmentView(APIView):
    permission_classes = [IsPatient]

    def post(self, request):
        serializer = BookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appointment = book(request.user, serializer.validated_data)
        return Response({'id': appointment.pk, 'message': 'Đặt lịch thành công.'}, status=201)


class UpcomingAppointmentView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        today = timezone.localtime().date()
        current_time = timezone.localtime().time()
        
        # Tìm các lịch hẹn từ hôm nay trở đi (dùng trường 'date' và 'time' mới)
        upcoming_appointments = Appointment.objects.filter(
            patient=request.user,
            status__in=['Confirmed', 'Checked-in'],
            date__gte=today
        ).order_by('date', 'time')

        # Lọc thủ công để loại bỏ lịch cũ trong ngày hôm nay
        upcoming = next((app for app in upcoming_appointments if app.status == 'Checked-in' or app.date > today or app.time > current_time), None)

        if not upcoming:
            return Response({"message": "Không có lịch hẹn sắp tới"}, status=204)

        # Tạo initials tự động từ tên bác sĩ (Ví dụ: "Dr. Jane Doe" -> "JD")
        doctor_name = upcoming.doctor.full_name
        name_parts = doctor_name.replace("Dr. ", "").split()
        initials = "".join([part[0].upper() for part in name_parts[:2]]) if name_parts else "DR"

        # Lấy tên chuyên khoa an toàn
        specialty_name = upcoming.doctor.specialization.name if upcoming.doctor.specialization else "General"

        # Trả về dữ liệu chi tiết của lịch hẹn gần nhất
        return Response({
            "id": upcoming.id,
            "status": upcoming.status,
            "date": upcoming.date,
            "time": upcoming.time.strftime('%I:%M %p') if upcoming.time else "",
            "doctor_name": upcoming.doctor.full_name,
            "doctor_specialty": specialty_name,
            "doctor_initials": initials
        }, status=200)


class CancelAppointmentView(APIView):
    permission_classes = [IsPatient]

    def post(self, request, pk):
        changed = Appointment.objects.filter(pk=pk, patient=request.user, status='Confirmed').update(status='Cancelled')
        if not changed:
            raise NotFound('Không tìm thấy lịch được phép hủy; lịch có thể đã check-in.')
        return Response({'message': 'Hủy lịch thành công.'})


class DoctorListView(APIView):
    permission_classes = [] 

    def get(self, request):
        # Lấy toàn bộ danh sách bác sĩ từ Database mới
        doctors = Doctor.objects.select_related('specialization').filter(Q(user__is_active=True) | Q(user__isnull=True))
        doc_list = []
        
        for doc in doctors:
            # Lấy Họ tên và Chuyên khoa trực tiếp từ bảng Doctor
            full_name = doc.full_name if doc.full_name else "Unnamed"
            if not full_name.startswith("Dr."):
                full_name = f"Dr. {full_name}"
                
            specialty_name = doc.specialization.name if doc.specialization else "General"

            # Tự động tạo 2 chữ cái viết tắt cho Avatar (Ví dụ: Tran Thi B -> TB)
            clean_name = full_name.replace("Dr. ", "").strip()
            names = clean_name.split()
            initials = "DR"
            if names:
                initials = (names[0][0] + (names[-1][0] if len(names) > 1 else '')).upper()
                
            doc_list.append({
                'id': doc.id,
                'name': full_name,
                'specialty': specialty_name,
                'initials': initials,
                'full_name': doc.full_name,
                'education': doc.education,
                'certificate': doc.certificate,
            })
            
        return Response(doc_list)
class MyAppointmentsView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        status_param = request.query_params.get('status', 'Confirmed') # Mặc định lấy Upcoming
        
        # Ánh xạ tab từ Frontend sang giá trị status trong Database
        # Upcoming: 'Confirmed'
        # Completed: 'Completed'
        # Canceled: 'Cancelled'
        
        valid_statuses = {'Confirmed', 'Checked-in', 'Completed', 'Cancelled'}
        if status_param not in valid_statuses:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'status': 'Trạng thái không hợp lệ.'})
        statuses = ['Confirmed', 'Checked-in'] if status_param == 'Confirmed' else [status_param]
        appointments = Appointment.objects.select_related('doctor__specialization', 'medical_record').filter(
            patient=request.user, status__in=statuses
        ).order_by('date', 'time')

        data = []
        for app in appointments:
            doctor_name = app.doctor.full_name
            name_parts = doctor_name.replace("Dr. ", "").split()
            initials = "".join([part[0].upper() for part in name_parts[:2]]) if name_parts else "DR"
            specialty_name = app.doctor.specialization.name if app.doctor.specialization else "General"

            data.append({
                "id": app.id,
                "date": app.date.strftime('%b %d, %Y'), # Format giống mock-up: Oct 24, 2023
                "time": app.time.strftime('%I:%M %p'), # Format giống mock-up: 10:00 AM
                "doctor_name": doctor_name,
                "doctor_specialty": specialty_name,
                "doctor_initials": initials,
                "status": app.status,
                "medical_record_id": app.medical_record.pk if hasattr(app, "medical_record") and app.status == "Completed" else None,
            })

        return Response(data, status=200)
class UserProfileView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        patient = Patient.objects.filter(user=request.user).first()
        if patient is None:
            patient = Patient(
                user=request.user,
                full_name=request.user.get_full_name() or request.user.username,
            )
        return Response(PatientProfileSerializer(patient).data)

    @transaction.atomic
    def put(self, request):
        patient = Patient.objects.filter(user=request.user).first()
        if patient is None:
            patient = Patient(
                user=request.user,
                full_name=request.user.get_full_name() or request.user.username,
            )
        data = request.data.copy()
        if data.get('date_of_birth') == '':
            data['date_of_birth'] = None
        serializer = PatientProfileSerializer(patient, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if 'full_name' in serializer.validated_data:
            parts = patient.full_name.split(' ', 1)
            request.user.first_name = parts[0]
            request.user.last_name = parts[1] if len(parts) > 1 else ''
            request.user.save(update_fields=['first_name', 'last_name'])
        return Response(serializer.data)


# ==============================================================================
# AUTH ROLE & DOCTOR USE CASE VIEWS (UC-01, UC-06, UC-07, Doctor Profile)
# ==============================================================================

def _doctor_appointment_queryset(doctor):
    status_priority = Case(
        When(status='Checked-in', then=Value(0)),
        When(status='Confirmed', then=Value(1)),
        When(status='Completed', then=Value(2)),
        When(status='Cancelled', then=Value(3)),
        default=Value(4),
        output_field=IntegerField(),
    )
    return (
        Appointment.objects
        .filter(doctor=doctor)
        .select_related('patient', 'patient__patient_profile', 'doctor', 'medical_record')
        .annotate(status_priority=status_priority)
    )


class CustomLoginView(APIView):
    """UC-01: Đăng nhập, kiểm tra khóa tài khoản và trả role cho Frontend."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''

        if not username or not password:
            return Response(
                {'detail': 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_user = User.objects.filter(username=username).first()
        if existing_user and existing_user.check_password(password) and not existing_user.is_active:
            return Response(
                {'detail': 'Tài khoản của bạn đã bị khóa, vui lòng liên hệ quản trị viên.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = authenticate(request=request, username=username, password=password)
        if user is None:
            return Response(
                {'detail': 'Tài khoản hoặc mật khẩu không chính xác.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'role': _resolve_user_role(user),
            'username': user.username,
        }, status=status.HTTP_200_OK)


class UserInfoView(APIView):
    """Trả thông tin người dùng hiện tại, role và profile tương ứng."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        role = _resolve_user_role(user)
        profile_data = None
        if role == 'doctor':
            profile_data = DoctorProfileSerializer(user.doctor_profile).data
        elif role == 'patient':
            patient = Patient.objects.filter(user=user).first()
            if patient:
                profile_data = PatientProfileSerializer(patient).data

        return Response({
            'id': user.id,
            'username': user.username,
            'role': role,
            'profile': profile_data,
        }, status=status.HTTP_200_OK)


class DoctorDashboardView(APIView):
    """Tổng quan dành cho Bác sĩ: thống kê trong ngày và danh sách lịch hẹn hôm nay."""

    permission_classes = [IsDoctor]

    def get(self, request):
        doctor = request.user.doctor_profile
        today = timezone.localtime().date()

        base_qs = _doctor_appointment_queryset(doctor)
        today_qs = base_qs.filter(date=today).order_by('status_priority', 'time')

        next_appointment = (
            today_qs.filter(status='Checked-in').first()
            or base_qs.filter(Q(date__gt=today) | Q(date=today, time__gt=timezone.localtime().time()), status='Confirmed').order_by('date', 'time').first()
        )

        return Response({
            'doctor': DoctorProfileSerializer(doctor).data,
            'today_date': today.isoformat(),
            'stats': {
                'today_total': today_qs.exclude(status='Cancelled').count(),
                'today_waiting': today_qs.filter(status='Checked-in').count(),
                'today_confirmed': today_qs.filter(status='Confirmed').count(),
                'today_completed': today_qs.filter(status='Completed').count(),
                'total_patients_seen': (
                    base_qs.filter(status='Completed').values('patient_id').distinct().count()
                ),
            },
            'next_appointment': (
                DoctorAppointmentSerializer(next_appointment).data if next_appointment else None
            ),
            'today_appointments': DoctorAppointmentSerializer(today_qs, many=True).data,
        }, status=status.HTTP_200_OK)


class DoctorAppointmentListView(APIView):
    """UC-06: Xem danh sách lịch khám của bác sĩ (lọc theo ngày/tuần/trạng thái/tìm kiếm)."""

    permission_classes = [IsDoctor]

    def get(self, request):
        doctor = request.user.doctor_profile
        qs = _doctor_appointment_queryset(doctor)

        date_param = request.query_params.get('date')
        range_param = request.query_params.get('range', 'all')
        status_param = request.query_params.get('status', 'All')
        search_param = (request.query_params.get('search') or '').strip()

        today = timezone.localtime().date()
        if date_param:
            qs = qs.filter(date=serializers.DateField().run_validation(date_param))
        elif range_param == 'today':
            qs = qs.filter(date=today)
        elif range_param == 'week':
            week_start = today - timedelta(days=today.weekday())
            week_end = week_start + timedelta(days=6)
            qs = qs.filter(date__range=(week_start, week_end))

        if status_param and status_param != 'All':
            qs = qs.filter(status=status_param)

        if search_param:
            matches = (
                Q(patient__patient_profile__full_name__icontains=search_param)
                | Q(patient__patient_profile__phone__icontains=search_param)
                | Q(patient__patient_profile__patient_id__icontains=search_param)
                | Q(patient__username__icontains=search_param)
            )
            user_id = generated_patient_user_id(search_param)
            if user_id:
                matches |= Q(patient_id=user_id) & (
                    Q(patient__patient_profile__patient_id__isnull=True)
                    | Q(patient__patient_profile__patient_id='')
                )
            qs = qs.filter(matches)

        qs = qs.order_by('date', 'status_priority', 'time')
        return Response(DoctorAppointmentSerializer(qs, many=True).data, status=status.HTTP_200_OK)


class DoctorExamineView(APIView):
    """UC-06 -> UC-07: Ghi nhận chẩn đoán, đơn thuốc và hoàn tất buổi khám (chỉ lịch Checked-in)."""

    permission_classes = [IsDoctor]

    @transaction.atomic
    def post(self, request, pk):
        doctor = request.user.doctor_profile
        appointment = (
            Appointment.objects
            .select_for_update()
            .filter(id=pk, doctor=doctor)
            .first()
        )
        if appointment is None:
            raise NotFound(detail='Không tìm thấy lịch hẹn thuộc bác sĩ hiện tại.')

        if hasattr(appointment, 'medical_record'):
            return Response(
                {'error': 'Lịch hẹn này đã được lập bệnh án trước đó.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if appointment.status == 'Confirmed':
            return Response(
                {'error': 'Bệnh nhân chưa check-in tại quầy Lễ tân. Chỉ có thể khám lịch hẹn ở trạng thái Checked-in.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if appointment.status != 'Checked-in':
            return Response(
                {'error': f'Không thể khám lịch hẹn đang ở trạng thái {appointment.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if appointment.date > timezone.localdate():
            return Response({'error': 'Không thể hoàn tất lịch khám ở ngày tương lai.'}, status=400)

        serializer = CreateMedicalRecordSerializer(
            data=request.data,
            context={'appointment': appointment},
        )
        serializer.is_valid(raise_exception=True)
        record = serializer.save()

        appointment.status = 'Completed'
        appointment.save(update_fields=['status'])

        return Response(MedicalRecordSerializer(record).data, status=status.HTTP_201_CREATED)


class DoctorProfileView(APIView):
    """Xem và cập nhật hồ sơ cá nhân của Bác sĩ."""

    permission_classes = [IsDoctor]

    def get(self, request):
        return Response(DoctorProfileSerializer(request.user.doctor_profile).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def put(self, request):
        doctor = request.user.doctor_profile
        data = request.data.copy()
        if data.get('date_of_birth') == '':
            data['date_of_birth'] = None

        serializer = DoctorProfileSerializer(doctor, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if 'full_name' in serializer.validated_data:
            parts = doctor.full_name.split(' ', 1)
            request.user.first_name = parts[0]
            request.user.last_name = parts[1] if len(parts) > 1 else ''
            request.user.save(update_fields=['first_name', 'last_name'])

        return Response(serializer.data, status=status.HTTP_200_OK)
