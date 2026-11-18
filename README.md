# Clinic Portal

Website phòng khám với frontend React/Vite và backend Django REST Framework,
đăng nhập bằng JWT, lưu dữ liệu trong MySQL.

Chức năng đang có: đăng nhập, xem bác sĩ, đặt/hủy lịch khám, xem lịch hẹn và
cập nhật hồ sơ bệnh nhân. Một số giao diện còn đang phát triển.

## Chuẩn bị

- Git.
- Python và pip. Môi trường của người phát triển hiện dùng Python 3.13.5.
- Node.js và npm. Môi trường của người phát triển hiện dùng Node.js 24.22.1.
- MySQL server đang chạy, cùng tài khoản có quyền tạo database và bảng.

Các phiên bản trên mô tả môi trường hiện tại; chưa xác nhận quy trình trên mọi
phiên bản hoặc hệ điều hành. Hướng dẫn dưới đây dùng Windows PowerShell.

## 1. Clone repository

```powershell
git clone https://github.com/nguyenminhvu1342006-debug/website.git
cd website
```

## 2. Tạo môi trường Python và cài thư viện

Chạy tại thư mục gốc `website`:

```powershell
python -m venv backend/venv
.\backend\venv\Scripts\Activate.ps1
python -m pip install -r requirement.txt
```

Tên file là `requirement.txt`. Cài thư viện sau khi kích hoạt venv để Django và
`python-dotenv` nằm trong cùng môi trường. Không cần cài thư viện npm ở thư mục gốc.

Nếu PowerShell chặn script kích hoạt, có thể dùng trực tiếp Python của venv:

```powershell
.\backend\venv\Scripts\python.exe -m pip install -r requirement.txt
```

Trong các bước backend tiếp theo, thay `python` bằng đường dẫn Python venv nếu
không kích hoạt môi trường.

## 3. Cấu hình `.env`

Tại thư mục gốc, sao chép file mẫu một lần:

```powershell
Copy-Item .env.example .env
```

Không chạy lại lệnh sao chép nếu đã có `.env` chứa cấu hình riêng.
Tạo secret key sau khi cài dependencies:

```powershell
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Mở `.env`, điền secret key vừa tạo và thông tin MySQL trên máy bạn:

```dotenv
DJANGO_SECRET_KEY='paste-your-generated-secret-key-here'
DJANGO_DEBUG=True
DB_NAME=clinic_management_db
DB_USER=root
DB_PASSWORD='your-local-mysql-password'
DB_HOST=localhost
DB_PORT=3306
```

Đặt secret key và mật khẩu trong dấu nháy để giữ các ký tự đặc biệt.
File `.env` nằm cạnh `requirement.txt`, không nằm trong thư mục `backend`.
`settings.py` tự nạp file này. Không commit `.env` hoặc mật khẩu thật lên Git;
chỉ chia sẻ `.env.example`.

## 4. Tạo database MySQL

Mở MySQL Workbench hoặc MySQL CLI bằng tài khoản của bạn và chạy:

```sql
CREATE DATABASE IF NOT EXISTS clinic_management_db
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Nếu chọn tên khác, cập nhật `DB_NAME` trong `.env`. Tài khoản `DB_USER` cần quyền
tạo/sửa bảng và đọc/ghi dữ liệu trong database này.

## 5. Tạo bảng và nạp dữ liệu mẫu

Trong terminal đã kích hoạt venv:

```powershell
cd backend
python manage.py migrate
python manage.py seed_data --include-receptionist
```

`migrate` tạo bảng từ migration có trong repository, không tạo database MySQL.
Thành viên mới không cần chạy `makemigrations` khi model chưa thay đổi.

`seed_data` tạo hai chuyên khoa và các hồ sơ sau:

| Tài khoản | Hồ sơ | Chuyên khoa |
| --- | --- | --- |
| `dr.jane` | Jane Doe | Ngoại khoa |
| `dr.marcus` | Marcus Reed | Nội khoa |
| `dr.sofia` | Sofia Kim | Ngoại khoa |
| `dr.tran` | Trần | Nội khoa |
| `demo_patient` | Demo Patient | Bệnh nhân thử nghiệm |
| `demo_reception` | Demo Reception | Lễ tân (nhóm Receptionist) |

Mật khẩu của các tài khoản **được tạo mới** là `ClinicDemo2026!`.
Dùng `demo_patient` để thử giao diện bệnh nhân.
`dr.jane` đăng nhập vào `/doctor/dashboard`; `demo_reception` vào `/reception`.
Lệnh seed không có `--include-receptionist` vẫn chỉ tạo bác sĩ và bệnh nhân như trước.

Luồng thử: bệnh nhân đặt lịch → lễ tân xem lịch trong ngày và check-in → bác sĩ
thấy bệnh nhân chờ khám. Lễ tân chỉ được check-in lịch hôm nay ở trạng thái
`Confirmed`; sau check-in, bệnh nhân không thể hủy lịch đó. Khi bác sĩ hoàn tất
khám, bệnh án và đơn thuốc xuất hiện trong Medical Records của bệnh nhân.

Seed chỉ chạy khi `DJANGO_DEBUG=True`. Chạy lại không ghi đè hồ sơ hoặc mật khẩu
có sẵn và không tạo lịch hẹn. Trường hợp dữ liệu khớp không rõ ràng, lệnh báo lỗi
và hoàn tác lần chạy. Xem thêm [hướng dẫn seed](backend/clinic_api/management/commands/SEED_DATA.md).

Nếu cần truy cập Django Admin, tạo tài khoản quản trị riêng:

```powershell
python manage.py createsuperuser
```

## 6. Chạy backend

Từ thư mục `backend`, trong venv:

```powershell
python manage.py runserver 127.0.0.1:8000
```

- API: `http://127.0.0.1:8000/api/`
- Django Admin: `http://127.0.0.1:8000/admin/`

Giữ terminal này chạy. Django không phục vụ giao diện React tại trang `/`.

## 7. Chạy frontend

Mở terminal thứ hai tại thư mục gốc `website`:

```powershell
cd frontend
npm ci
npm run dev -- --port 5173 --strictPort
```

Mở `http://localhost:5173`, vào trang đăng nhập và dùng tài khoản bệnh nhân mẫu.
Phiên đăng nhập được lưu riêng cho từng tab bằng `sessionStorage`. Để thử cùng lúc
bệnh nhân, bác sĩ và lễ tân trên một trình duyệt, mở ba tab và đăng nhập tài khoản
tương ứng trong mỗi tab. Tải lại trang vẫn giữ phiên; đăng xuất ở một tab không
đăng xuất các tab khác. Sau khi cập nhật từ bản dùng `localStorage`, cần đăng nhập lại.
`--strictPort` giúp Vite báo lỗi nếu cổng 5173 bị chiếm thay vì tự chuyển sang
cổng chưa được CORS cho phép. Dừng tiến trình đang dùng cổng đó rồi chạy lại.

Frontend cấu hình base URL trong `frontend/src/api.js`. Backend hiện cho phép
CORS từ `http://localhost:5173` và `http://127.0.0.1:5173`.

## Khi pull thay đổi từ nhóm

Tại thư mục gốc, kích hoạt venv rồi chạy:

```powershell
git pull
python -m pip install -r requirement.txt
python backend/manage.py migrate
```

Nếu dependencies frontend thay đổi, chạy `npm ci` trong thư mục `frontend`.
Chỉ chạy lại seed khi cần bổ sung dữ liệu mẫu còn thiếu. Giữ nguyên `.env` riêng.

Mỗi thành viên dùng database riêng: migration đồng bộ cấu trúc, seed tạo dữ liệu
ban đầu. Lịch hẹn và thay đổi hồ sơ sau đó không tự đồng bộ giữa các máy.

## Lỗi thường gặp

| Lỗi | Cách xử lý |
| --- | --- |
| `No module named 'dotenv'` | Kích hoạt đúng `backend/venv`, chạy `python -m pip install -r requirement.txt`. |
| Thiếu `DJANGO_SECRET_KEY` hoặc `DB_NAME` | Kiểm tra `.env` ở thư mục gốc và điền đủ các biến trong `.env.example`. |
| MySQL `Access denied` | Kiểm tra tài khoản, mật khẩu và quyền database trong `.env`. |
| MySQL `Unknown database` | Tạo database ở bước 4, đối chiếu với `DB_NAME`. |
| Không kết nối MySQL | Kiểm tra MySQL server đang chạy và đúng `DB_HOST`/`DB_PORT`. |
| Thiếu bảng | Chạy `python manage.py migrate` trong thư mục `backend`. |
| Không đăng nhập được tài khoản mẫu | Chạy `seed_data` trên database đang dùng; seed không đặt lại mật khẩu tài khoản đã tồn tại. |
| Frontend báo network error | Kiểm tra backend đang chạy tại cổng 8000 và `frontend/src/api.js`. |
| Lỗi CORS | Dùng frontend ở cổng 5173 với một trong hai origin được cho phép ở trên. |
| Không cài được `mysqlclient` | Đọc lỗi pip; môi trường có thể cần công cụ build hoặc thư viện MySQL tương ứng với Python/hệ điều hành. |

## Phạm vi hiện tại

- Medical Records và Recent Visits lấy dữ liệu thật từ bệnh án đã hoàn tất.
- Frontend build bằng `npm run build`, kiểm tra mã bằng `npm run lint`.
- Đặt lịch dùng `doctor_id`, kiểm tra ngày/giờ ở server và dùng transaction/khóa
  hàng trên MySQL. Kiểm tra đồng thời đã xác nhận hai bệnh nhân không thể đặt cùng
  bác sĩ/khung giờ qua API. Sửa dữ liệu trực tiếp ngoài API không dùng cơ chế này.
- Các lệnh và tài khoản mẫu ở đây dành cho phát triển. Triển khai thật cần cấu hình
  riêng cho host, HTTPS, secret key, database và tắt DEBUG; không dùng tài khoản mẫu.
- Chưa xác nhận toàn bộ quy trình trên một bản clone sạch với MySQL trống.

## Luồng bệnh án và đơn thuốc

1. Lễ tân check-in lịch khám hôm nay.
2. Bác sĩ được phân công mở My Schedule → Khám bệnh, nhập chẩn đoán, lời dặn
   và đơn thuốc nếu cần. Mỗi thuốc phải có tên và liều lượng; có thể hoàn tất mà
   không kê thuốc.
3. Hoàn thành khám lưu bệnh án/thuốc trong cùng transaction và chuyển lịch sang
   `Completed`. Khóa hàng MySQL ngăn hai yêu cầu hoàn tất tạo trùng bệnh án.
4. Bác sĩ xem lại tại Medical Records; bệnh nhân xem Medical Records, Recent Visits
   hoặc nút Xem bệnh án trong lịch đã hoàn thành. Có tìm kiếm, lọc ngày/năm,
   nút Làm mới và in/lưu PDF qua hộp thoại in của trình duyệt.

Bệnh nhân chỉ đọc được bệnh án của chính mình. Lễ tân không có quyền đọc bệnh án.
Bác sĩ đọc bệnh án do mình lập; chỉ được đọc lịch sử của bác sĩ khác khi bệnh nhân
đã check-in hoặc đã khám với mình. Chỉ đặt lịch hoặc lịch đã hủy không cấp quyền
đọc tiền sử. Bệnh án đã hoàn tất là chỉ đọc qua API; chưa hỗ trợ chỉnh sửa/thu hồi.
Thông tin hồ sơ bệnh nhân và bác sĩ hiện hiển thị theo hồ sơ đang có, không phải
bản chụp thông tin tại thời điểm khám. Chưa triển khai chữ ký số hoặc nhật ký
chỉnh sửa phục vụ hệ thống bệnh án sử dụng thực tế.

API bệnh nhân: `GET /api/my-records/`, `GET /api/my-records/<id>/`.
API bác sĩ giữ đường dẫn `GET /api/doctor/records/` và chi tiết tương ứng.
Danh sách hỗ trợ `search`, `date` (YYYY-MM-DD), `year`, `limit` (1–100).
Chỉ API bác sĩ dùng `patient_user_id` để chọn bệnh nhân trong phạm vi được cấp quyền.

## Chạy kiểm thử

Backend nhanh, dùng SQLite tạm và không truy cập database MySQL đang làm việc:

```powershell
# Từ thư mục gốc, đã kích hoạt venv
python backend/manage.py test clinic_api --settings=backend.test_settings --noinput
```

Bài kiểm tra khóa đồng thời được bỏ qua trên SQLite vì cần MySQL thật. Nếu chạy
`python manage.py test clinic_api` với cấu hình MySQL thông thường, Django sẽ tạo
database test riêng; tài khoản MySQL phải có quyền tạo/xóa database test đó.

Kiểm thử trình duyệt (cần Google Chrome đã cài):

```powershell
cd frontend
npm ci
npm run test:e2e
```

Playwright tự khởi động frontend cổng 4174 và backend cổng 8011. Backend dùng
SQLite mới trong `.test-run/` cho mỗi lần chạy, không nạp seed vào MySQL của bạn.
Mặc định dùng Python trong `backend/venv`; nếu venv ở vị trí khác, đặt biến
`CLINIC_TEST_PYTHON` thành đường dẫn Python của venv trước khi chạy.
Kết quả và ảnh kiểm tra nằm trong `frontend/test-results/` và được Git bỏ qua.

Frontend có thể đổi địa chỉ API bằng `VITE_API_BASE_URL` trong
`frontend/.env.local`, ví dụ `VITE_API_BASE_URL=http://127.0.0.1:8000/api/`.
Backend phải cho phép origin frontend tương ứng khi đổi host/cổng.

## Tham chiếu thiết kế

[Mockup ĐATH_CNPM trên Figma](https://www.figma.com/design/OLGDcnT2iasJDWhMofmQ40)
là tham chiếu thiết kế. Đợt sửa này hoàn thiện chức năng từ source đang có; việc
đối chiếu đầy đủ kích thước, typography, asset và biểu đồ với mockup chưa hoàn tất
vì Figma MCP báo hết lượt đọc của gói Starter. Không coi bản hiện tại là bản khớp
hoàn toàn thiết kế hoặc đã sẵn sàng triển khai production.
