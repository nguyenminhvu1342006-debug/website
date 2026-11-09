from django.db import models
from django.contrib.auth.models import User

# 1. Bảng Chuyên khoa
class Specialty(models.Model):
    name = models.CharField(max_length=100, verbose_name="Tên chuyên khoa")
    description = models.TextField(blank=True, verbose_name="Mô tả")

    def __str__(self):
        return self.name

# 2. Bảng Bác sĩ
class Doctor(models.Model):
    # Liên kết với bảng User có sẵn của Django để quản lý đăng nhập
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    specialty = models.ForeignKey(Specialty, on_delete=models.SET_NULL, null=True, verbose_name="Chuyên khoa")
    phone = models.CharField(max_length=15, verbose_name="Số điện thoại")
    experience_years = models.IntegerField(default=0, verbose_name="Số năm kinh nghiệm")

    def __str__(self):
        return self.user.get_full_name() or self.user.username

# 3. Bảng Bệnh nhân
class Patient(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True)
    full_name = models.CharField(max_length=100, verbose_name="Họ và tên")
    phone = models.CharField(max_length=15, unique=True, verbose_name="Số điện thoại")
    date_of_birth = models.DateField(verbose_name="Ngày sinh")
    address = models.TextField(blank=True, verbose_name="Địa chỉ")

    def __str__(self):
        return self.full_name

# 4. Bảng Khung giờ khám (Schedule Slots)
class ScheduleSlot(models.Model):
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, verbose_name="Bác sĩ")
    date = models.DateField(verbose_name="Ngày khám")
    start_time = models.TimeField(verbose_name="Giờ bắt đầu")
    end_time = models.TimeField(verbose_name="Giờ kết thúc")
    is_booked = models.BooleanField(default=False, verbose_name="Đã đặt")

    def __str__(self):
        return f"{self.doctor} - {self.date} {self.start_time}"

# 5. Bảng Lịch hẹn (Appointments)
class Appointment(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Chờ xác nhận'),
        ('CONFIRMED', 'Đã xác nhận'),
        ('COMPLETED', 'Đã khám xong'),
        ('CANCELLED', 'Đã hủy'),
    )
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, verbose_name="Bệnh nhân")
    # Dùng OneToOneField đảm bảo 1 khung giờ chỉ được 1 bệnh nhân đặt
    schedule = models.OneToOneField(ScheduleSlot, on_delete=models.CASCADE, verbose_name="Khung giờ")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', verbose_name="Trạng thái")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Lịch khám: {self.patient.full_name} - {self.schedule}"

# 6. Bảng Hồ sơ bệnh án
class MedicalRecord(models.Model):
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, verbose_name="Lịch khám")
    diagnosis = models.TextField(verbose_name="Chẩn đoán bệnh")
    prescription = models.TextField(verbose_name="Đơn thuốc")
    notes = models.TextField(blank=True, verbose_name="Ghi chú thêm")
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Bệnh án của {self.appointment.patient.full_name}"

