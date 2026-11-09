from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Doctor, Patient, Appointment
from django.utils import timezone
from rest_framework.exceptions import NotFound

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
                status='Confirmed'
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
                status='Confirmed'
            ).exists()
            
            if doctor_booked:
                return Response({"error": "Khung giờ này của bác sĩ vừa mới được người khác đặt. Vui lòng chọn giờ khác!"}, status=400)
            # B. Kiểm tra xem BỆNH NHÂN NÀY đã có lịch hẹn nào khác vào cùng ngày giờ này chưa (dù là khám bác sĩ nào)
            patient_booked = Appointment.objects.filter(
                patient=request.user,
                date=date_str,
                time=time_str,
                status='Confirmed'
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
        user = request.user
        data = {
            "id": f"A{user.id:07d}",
            "full_name": user.get_full_name() or user.username,
            "date_of_birth": getattr(user, 'date_of_birth', 'Feb 20, 1975'),
            "phone": getattr(user, 'phone', ''),
            "address": getattr(user, 'address', ''),
            "blood_type": getattr(user, 'blood_type', ''),
            "allergies": getattr(user, 'allergies', ''),
            "emergency_contact_name": getattr(user, 'emergency_contact_name', ''),
            "emergency_contact_phone": getattr(user, 'emergency_contact_phone', ''),
            "avatar_initials": "PN"
        }
        return Response(data, status=200)

    def put(self, request):
        user = request.user
        data = request.data
        
        try:
            # Nhận dữ liệu từ Frontend gửi lên và cập nhật vào user/database
            full_name = data.get('full_name', '')
            if full_name:
                parts = full_name.split(' ', 1)
                user.first_name = parts[0]
                user.last_name = parts[1] if len(parts) > 1 else ''
            
            # Lưu các trường thông tin mở rộng (nếu bạn có lưu trong bảng UserProfile riêng, 
            # hoặc tạm thời lưu vào thuộc tính user tùy theo cấu trúc database của bạn)
            user.phone = data.get('phone', '')
            user.address = data.get('address', '')
            # ... (cập nhật thêm các trường y tế nếu bạn có cột tương ứng trong DB)
            
            user.save()
            return Response({"message": "Cập nhật thành công!"}, status=200)
            
        except Exception as e:
            return Response({"error": str(e)}, status=500)