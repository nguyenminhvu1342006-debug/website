from datetime import timedelta
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.db.models import Case, IntegerField, Q, Value, When
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Appointment, Doctor, MedicalRecord, Patient
from .permissions import IsDoctor
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
    if user.is_superuser:
        return 'admin'
    return 'patient'

class AvailableSlotsView(APIView):
    permission_classes = [IsAuthenticated] # Bắt buộc phải đăng nhập mới xem được lịch

    def get(self, request):
        doctor_name = request.query_params.get('doctor')
        date_str = request.query_params.get('date') # Định dạng: YYYY-MM-DD
        
        if not doctor_name or not date_str:
            return Response({"error": "Vui lòng chọn bác sĩ và ngày"}, status=400)

        # 1. Khung giờ chuẩn (Full-time)
        standard_slots = [
            '09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00', '11:30:00',
            '13:00:00', '13:30:00', '14:00:00', '14:30:00', '15:00:00', '15:30:00'
        ]

        try:
            # Xử lý tên: Cắt bỏ chữ "Dr. " mà Frontend tự động gắn vào
            clean_name = doctor_name.replace("Dr. ", "").strip()
            
            # Dùng 'full_name__icontains' thay vì 'name=' để tìm kiếm chính xác
            doctor = Doctor.objects.filter(full_name__icontains=clean_name).first()
            
            if not doctor:
                return Response({"error": "Không tìm thấy bác sĩ"}, status=404)
            
            # 2. Tìm lịch đã đặt (dùng cột 'date' thay vì 'appointment_date')
            booked_appointments = Appointment.objects.filter(
                doctor=doctor, 
                date=date_str,
                status__in=['Confirmed', 'Checked-in']
            )
            
            # Lấy ra danh sách các giờ đã bị chiếm (dùng cột 'time' thay vì 'appointment_time')
            booked_times = [app.time.strftime('%H:%M:%S') for app in booked_appointments]
            
            # 3. Lọc ra các giờ còn trống
            available_slots = [slot for slot in standard_slots if slot not in booked_times]
            current_date = timezone.localtime().date().strftime('%Y-%m-%d')
            # Nếu người dùng đang xem lịch của ĐÚNG NGÀY HÔM NAY
            if date_str == current_date:
                current_time = timezone.localtime().time().strftime('%H:%M:%S')
                # Chỉ giữ lại những giờ trống lớn hơn giờ hiện tại
                available_slots = [slot for slot in available_slots if slot > current_time]
            
            return Response({"available_slots": available_slots}, status=200)
            
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class BookAppointmentView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        doctor_name = request.data.get('doctor')
        date_str = request.data.get('date')
        time_str = request.data.get('time')
        
        if not doctor_name or not date_str or not time_str:
            return Response({"error": "Vui lòng cung cấp đủ thông tin đặt lịch."}, status=400)
        
        try:
            # 1. Xử lý tên bác sĩ
            clean_name = doctor_name.replace("Dr. ", "").strip()
            doctor = Doctor.objects.filter(full_name__icontains=clean_name).first()
            
            if not doctor:
                return Response({"error": "Không tìm thấy bác sĩ"}, status=404)
            
            # A. Kiểm tra xem BÁC SĨ ĐÓ đã có ai đặt ở khung giờ này chưa
            doctor_booked = Appointment.objects.filter(
                doctor=doctor, 
                date=date_str, 
                time=time_str,
                status__in=['Confirmed', 'Checked-in']
            ).exists()
            
            if doctor_booked:
                return Response({"error": "Khung giờ này của bác sĩ vừa mới được người khác đặt. Vui lòng chọn giờ khác!"}, status=400)
            # B. Kiểm tra xem BỆNH NHÂN NÀY đã có lịch hẹn nào khác vào cùng ngày giờ này chưa (dù là khám bác sĩ nào)
            patient_booked = Appointment.objects.filter(
                patient=request.user,
                date=date_str,
                time=time_str,
                status__in=['Confirmed', 'Checked-in']
            ).exists()

            if patient_booked:
                return Response({"error": "Bạn đã có một lịch hẹn khác vào khung giờ này rồi. Không thể đặt trùng thời gian khám!"}, status=400)
            # 3. Tạo và lưu lịch hẹn (Truyền trực tiếp request.user vì trường patient trỏ tới User)
            Appointment.objects.create(
                patient=request.user,  # ✅ Sửa thành request.user ở đây
                doctor=doctor,
                date=date_str,
                time=time_str,
                status='Confirmed'
            )
            
            return Response({"message": "Đặt lịch thành công!"}, status=201)
            
        except Exception as e:
            return Response({"error": f"Lỗi hệ thống: {str(e)}"}, status=500)
class UpcomingAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localtime().date()
        current_time = timezone.localtime().time()
        
        # Tìm các lịch hẹn từ hôm nay trở đi (dùng trường 'date' và 'time' mới)
        upcoming_appointments = Appointment.objects.filter(
            patient=request.user,
            status='Confirmed',
            date__gte=today
        ).order_by('date', 'time')

        # Lọc thủ công để loại bỏ lịch cũ trong ngày hôm nay
        upcoming = next((app for app in upcoming_appointments if app.date > today or app.time > current_time), None)

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
            "date": upcoming.date,
            "time": upcoming.time.strftime('%I:%M %p') if upcoming.time else "",
            "doctor_name": upcoming.doctor.full_name,
            "doctor_specialty": specialty_name,
            "doctor_initials": initials
        }, status=200)


class CancelAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            # Tìm lịch hẹn của đúng user này và đang ở trạng thái Confirmed
            appointment = Appointment.objects.get(id=pk, patient=request.user, status='Confirmed')
            appointment.status = 'Cancelled' # Chuyển trạng thái sang Đã hủy
            appointment.save()
            return Response({"message": "Hủy lịch thành công"}, status=200)
        except Appointment.DoesNotExist:
            raise NotFound(detail="Không tìm thấy lịch hẹn hoặc đã bị hủy.")
class DoctorListView(APIView):
    permission_classes = [] 

    def get(self, request):
        # Lấy toàn bộ danh sách bác sĩ từ Database mới
        doctors = Doctor.objects.all()
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
                'initials': initials
            })
            
        return Response(doc_list)
class MyAppointmentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        status_param = request.query_params.get('status', 'Confirmed') # Mặc định lấy Upcoming
        
        # Ánh xạ tab từ Frontend sang giá trị status trong Database
        # Upcoming: 'Confirmed'
        # Completed: 'Completed'
        # Canceled: 'Cancelled'
        
        appointments = Appointment.objects.filter(
            patient=request.user,
            status=status_param
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
                "status": app.status
            })

        return Response(data, status=200)
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

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
            or base_qs.filter(date__gte=today, status='Confirmed').order_by('date', 'time').first()
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
            qs = qs.filter(date=date_param)
        elif range_param == 'today':
            qs = qs.filter(date=today)
        elif range_param == 'week':
            week_start = today - timedelta(days=today.weekday())
            week_end = week_start + timedelta(days=6)
            qs = qs.filter(date__range=(week_start, week_end))

        if status_param and status_param != 'All':
            qs = qs.filter(status=status_param)

        if search_param:
            qs = qs.filter(
                Q(patient__patient_profile__full_name__icontains=search_param)
                | Q(patient__patient_profile__phone__icontains=search_param)
                | Q(patient__patient_profile__patient_id__icontains=search_param)
                | Q(patient__username__icontains=search_param)
            )

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
            .select_related('patient', 'patient__patient_profile', 'doctor')
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

        serializer = CreateMedicalRecordSerializer(
            data=request.data,
            context={'appointment': appointment},
        )
        serializer.is_valid(raise_exception=True)
        record = serializer.save()

        appointment.status = 'Completed'
        appointment.save(update_fields=['status'])

        return Response(MedicalRecordSerializer(record).data, status=status.HTTP_201_CREATED)


class DoctorMedicalRecordListView(APIView):
    """UC-07: Tra cứu lịch sử biên bản khám và đơn thuốc (read-only)."""

    permission_classes = [IsDoctor]

    def get(self, request):
        doctor = request.user.doctor_profile
        patient_user_id = request.query_params.get('patient_user_id')
        search_param = (request.query_params.get('search') or '').strip()
        date_param = request.query_params.get('date')

        qs = (
            MedicalRecord.objects
            .select_related(
                'appointment',
                'appointment__doctor',
                'appointment__doctor__specialization',
                'appointment__patient',
                'appointment__patient__patient_profile',
            )
            .prefetch_related('prescriptions')
        )

        if patient_user_id:
            # Chỉ cho phép bác sĩ xem tiền sử của bệnh nhân đã có lịch hẹn với mình
            if not Appointment.objects.filter(doctor=doctor, patient_id=patient_user_id).exists():
                return Response(
                    {'error': 'Bạn không có quyền xem bệnh án của bệnh nhân này.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            qs = qs.filter(appointment__patient_id=patient_user_id)
        else:
            qs = qs.filter(appointment__doctor=doctor)

        if date_param:
            qs = qs.filter(appointment__date=date_param)

        if search_param:
            qs = qs.filter(
                Q(appointment__patient__patient_profile__full_name__icontains=search_param)
                | Q(appointment__patient__patient_profile__patient_id__icontains=search_param)
                | Q(appointment__patient__username__icontains=search_param)
                | Q(diagnosis__icontains=search_param)
            )

        return Response(MedicalRecordSerializer(qs, many=True).data, status=status.HTTP_200_OK)


class DoctorMedicalRecordDetailView(APIView):
    """UC-07: Xem chi tiết 1 biên bản khám bệnh và đơn thuốc."""

    permission_classes = [IsDoctor]

    def get(self, request, pk):
        doctor = request.user.doctor_profile
        record = (
            MedicalRecord.objects
            .select_related(
                'appointment',
                'appointment__doctor',
                'appointment__doctor__specialization',
                'appointment__patient',
                'appointment__patient__patient_profile',
            )
            .prefetch_related('prescriptions')
            .filter(id=pk)
            .first()
        )
        if record is None:
            raise NotFound(detail='Không tìm thấy hồ sơ bệnh án.')

        has_access = (
            record.appointment.doctor_id == doctor.id
            or Appointment.objects.filter(
                doctor=doctor, patient_id=record.appointment.patient_id
            ).exists()
        )
        if not has_access:
            return Response(
                {'error': 'Bạn không có quyền xem hồ sơ bệnh án này.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(MedicalRecordSerializer(record).data, status=status.HTTP_200_OK)


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
