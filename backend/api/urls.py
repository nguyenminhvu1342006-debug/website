from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'specialties', views.SpecialtyViewSet)
router.register(r'doctors', views.DoctorViewSet)
router.register(r'patients', views.PatientViewSet)
router.register(r'schedules', views.ScheduleSlotViewSet)
router.register(r'appointments', views.AppointmentViewSet)
router.register(r'records', views.MedicalRecordViewSet)

urlpatterns = [
    path('', include(router.urls)),
]