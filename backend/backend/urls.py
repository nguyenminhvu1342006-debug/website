from django.contrib import admin
from django.urls import path, include  
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from clinic_api.views import AvailableSlotsView, BookAppointmentView, DoctorListView, MyAppointmentsView, UpcomingAppointmentView, CancelAppointmentView, UserProfileView

urlpatterns = [
    path('admin/', admin.site.urls),
    #path('api/', include('api.urls')),
    # API Đăng nhập
    path('api/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'), 
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # API Đặt lịch khám
    path('api/slots/', AvailableSlotsView.as_view(), name='available_slots'),
    path('api/book/', BookAppointmentView.as_view(), name='book_appointment'),
    path('api/upcoming-appointment/', UpcomingAppointmentView.as_view(), name='upcoming_appointment'),
    path('api/cancel/<int:pk>/', CancelAppointmentView.as_view(), name='cancel_appointment'),
    path('api/doctors/', DoctorListView.as_view(), name='doctor_list'),
    path('api/my-appointments/', MyAppointmentsView.as_view(), name='my-appointments'),
    path('api/profile/', UserProfileView.as_view(), name='user-profile'),
    path('api/profile/update/', UserProfileView.as_view(), name='user-profile-update'),
]