# Dữ liệu mẫu để phát triển

Sau khi cấu hình `.env`, tạo database MySQL và cài thư viện trong môi trường ảo,
chạy từ thư mục `backend`:

```powershell
python manage.py migrate
python manage.py seed_data
```

Lệnh chỉ hoạt động khi `DEBUG=True`. Lệnh không tạo lịch hẹn hay tài khoản quản trị.

| Tài khoản được tạo nếu chưa có dữ liệu tương ứng | Hồ sơ | Chuyên khoa |
| --- | --- | --- |
| `dr.jane` | Jane Doe | Ngoại khoa |
| `dr.marcus` | Marcus Reed | Nội khoa |
| `dr.sofia` | Sofia Kim | Ngoại khoa |
| `dr.tran` | Trần | Nội khoa |
| `demo_patient` | Demo Patient | Bệnh nhân thử nghiệm |

Mật khẩu cho **tài khoản mới**: `ClinicDemo2026!`. Đây là mật khẩu công khai dành
cho môi trường phát triển; không dùng các tài khoản này trên website thật.
Đăng nhập frontend bằng `demo_patient` để thử đặt lịch.

Chạy lại không đổi thông tin hoặc mật khẩu đã tồn tại. Bác sĩ được đối chiếu trước
theo tài khoản, sau đó theo tên và chuyên khoa. Nếu hồ sơ bác sĩ đã tồn tại nhưng
chưa có tài khoản, lệnh giữ nguyên và không tự gắn tài khoản. Nếu dữ liệu khớp không
rõ ràng hoặc tên tài khoản bị chiếm, lệnh báo lỗi và hoàn tác toàn bộ lần seed đó.

Dữ liệu chỉ gồm tên và chuyên khoa mẫu, không sao chép mật khẩu, số điện thoại,
địa chỉ hay thông tin bệnh nhân từ database của người phát triển.
