from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from clinic_api.views import (
    AvailableSlotsView,
    BookAppointmentView,
    CancelAppointmentView,
    CustomLoginView,
    DoctorAppointmentListView,
    DoctorDashboardView,
    DoctorExamineView,
    DoctorListView,
    DoctorMedicalRecordDetailView,
    DoctorMedicalRecordListView,
    DoctorProfileView,
    MyAppointmentsView,
    UpcomingAppointmentView,
    UserInfoView,
    UserProfileView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    # API Đăng nhập & thông tin tài khoản hiện tại
    path('api/login/', CustomLoginView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/me/', UserInfoView.as_view(), name='user_info'),
    # API Đặt lịch khám (Bệnh nhân)
    path('api/slots/', AvailableSlotsView.as_view(), name='available_slots'),
    path('api/book/', BookAppointmentView.as_view(), name='book_appointment'),
    path('api/upcoming-appointment/', UpcomingAppointmentView.as_view(), name='upcoming_appointment'),
    path('api/cancel/<int:pk>/', CancelAppointmentView.as_view(), name='cancel_appointment'),
    path('api/doctors/', DoctorListView.as_view(), name='doctor_list'),
    path('api/my-appointments/', MyAppointmentsView.as_view(), name='my-appointments'),
    path('api/profile/', UserProfileView.as_view(), name='user-profile'),
    path('api/profile/update/', UserProfileView.as_view(), name='user-profile-update'),
    # API Bác sĩ (UC-06, UC-07, Dashboard, Profile)
    path('api/doctor/dashboard/', DoctorDashboardView.as_view(), name='doctor_dashboard'),
    path('api/doctor/appointments/', DoctorAppointmentListView.as_view(), name='doctor_appointments'),
    path('api/doctor/appointments/<int:pk>/examine/', DoctorExamineView.as_view(), name='doctor_examine'),
    path('api/doctor/records/', DoctorMedicalRecordListView.as_view(), name='doctor_records'),
    path('api/doctor/records/<int:pk>/', DoctorMedicalRecordDetailView.as_view(), name='doctor_record_detail'),
    path('api/doctor/profile/', DoctorProfileView.as_view(), name='doctor_profile'),
]