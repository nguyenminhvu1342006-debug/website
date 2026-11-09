from django.db import models
from django.contrib.auth.models import User

class Specialty(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="Tên chuyên khoa")

    def __str__(self):
        return self.name

# 1. HỒ SƠ BỆNH NHÂN (PATIENT)
class Patient(models.Model):
    # Liên kết 1-1 với tài khoản đăng nhập
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile', null=True, blank=True)
    
    # Thông tin cơ bản
    patient_id = models.CharField(max_length=20, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=100)
    date_of_birth = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=255, blank=True)
    
    # Y tế & Khẩn cấp
    blood_type = models.CharField(max_length=10, blank=True)
    known_allergies = models.CharField(max_length=255, blank=True)
    emergency_contact_name = models.CharField(max_length=100, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f"{self.patient_id or 'No ID'} - {self.full_name}"

# 2. HỒ SƠ BÁC SĨ (DOCTOR)
class Doctor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor_profile', null=True, blank=True)
    full_name = models.CharField(max_length=100)
    date_of_birth = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=255, blank=True)
    
    specialization = models.ForeignKey(Specialty, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Chuyên khoa")
    
    education = models.CharField(max_length=255, blank=True)
    certificate = models.CharField(max_length=255, blank=True)

    def __str__(self):
        # Tránh lỗi khi bác sĩ chưa được gán chuyên khoa
        spec_name = self.specialization.name if self.specialization else "Chưa phân khoa"
        return f"Dr. {self.full_name} - {spec_name}"

# 3. LỊCH HẸN (APPOINTMENT) - Kế thừa từ chức năng cũ
class Appointment(models.Model):
    STATUS_CHOICES = [
        ('Confirmed', 'Confirmed'),   # Lịch hẹn sắp tới
        ('Completed', 'Completed'),   # Đã khám xong (do lễ tân/bác sĩ cập nhật)
        ('Cancelled', 'Cancelled'),   # Đã hủy
    ]
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='appointments')
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='appointments')
    date = models.DateField()
    time = models.TimeField()
    status = models.CharField(max_length=20, default='Confirmed') # Confirmed, Cancelled
    
    def __str__(self):
        return f"Hẹn khám: {self.patient.username} gặp {self.doctor.full_name} ({self.date} {self.time})"