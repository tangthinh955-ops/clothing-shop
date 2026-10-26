# Chạy thử giai đoạn 2 — tài khoản trên local

Điểm dừng bàn giao: tài khoản và phân quyền. Danh mục hiện là trang giới thiệu trống; chưa có sản phẩm, giỏ hàng hoặc đơn hàng. Chờ phản hồi chạy thử trước khi triển khai M3.

## Khởi động trên máy hiện tại

Mở Docker Desktop, đợi engine sẵn sàng. Mở PowerShell tại thư mục dự án:

```powershell
cd C:\NAM4_2\ShopQuanAo_Codex
docker compose up -d db
.\tools\npm.ps1 run dev:backend
```

Giữ terminal đó mở. Mở terminal thứ hai tại cùng thư mục:

```powershell
cd C:\NAM4_2\ShopQuanAo_Codex
.\tools\npm.ps1 run dev:frontend
```

Mở **http://127.0.0.1:5173/register**. Dùng đúng `127.0.0.1`, không đổi sang `localhost`, vì origin phải khớp cấu hình CSRF. Máy hiện tại đã có dependency, cấu hình local và migration; nếu cài mới ở máy khác, làm các bước chuẩn bị trong [README](../README.md#chạy-local).

## Các bước thử

1. **Đăng ký:** nhập tên, email giả riêng như `ban-thu@example.test`, mật khẩu 12–128 ký tự. Kết quả mong đợi: thông báo đã tiếp nhận hướng dẫn.
2. **Đọc thư local:** không có email thật được gửi. Ở terminal thứ ba tại root, chạy lệnh dưới để hiện thư mới nhất, rồi sao chép nguyên URL trong phần nội dung vào trình duyệt:

   ```powershell
   $trialMail = Get-ChildItem .local\mailbox\mail-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1
   (Get-Content -LiteralPath $trialMail.FullName -Raw -Encoding UTF8 | ConvertFrom-Json).text
   ```

   Kiểm tra file đúng email vừa đăng ký nếu thử nhiều tài khoản. URL có phần `#token=...`; giữ nguyên khi sao chép. Thư chứa mã dùng thử cá nhân, không gửi nội dung vào chat.
3. **Xác minh email:** mở liên kết và bấm “Xác minh email”. Mong đợi: xác minh thành công; bấm lại liên kết đã dùng sẽ bị từ chối.
4. **Đăng nhập:** vào `/login`, nhập tài khoản vừa tạo. Mong đợi: đến `/account`, hiển thị email đã xác minh. Refresh trang vẫn giữ đăng nhập.
5. **Hồ sơ:** sửa họ tên và lưu. Refresh để kiểm tra tên đã được lưu. Thử `/admin` bằng tài khoản khách: quay về tài khoản, không có quyền quản trị.
6. **Quên mật khẩu:** vào `/forgot-password`, nhập email. Đọc thư local mới nhất như bước 2, mở URL đặt lại mật khẩu và nhập mật khẩu mới. Mong đợi: mật khẩu cũ không đăng nhập được; mật khẩu mới dùng được; phiên đăng nhập cũ không còn quyền truy cập.
7. **Đăng xuất:** bấm “Đăng xuất”, rồi mở `/account`. Mong đợi: về trang đăng nhập.
8. **Màn hình nhỏ:** thu hẹp cửa sổ hoặc dùng chế độ mobile của trình duyệt; form không tràn ngang, có thể chuyển trường bằng Tab.

Không có tài khoản admin mặc định. Nếu muốn thử quyền admin, làm theo phần tạo admin trong [README](../README.md#tài-khoản-và-thư-thử); `/admin` hiện chỉ kiểm tra quyền, chưa có quản lý hàng hóa.

## Dừng và xử lý lỗi thường gặp

- Dừng app: Ctrl+C trong hai terminal. Dừng database khi không dùng: `docker compose stop db` (giữ dữ liệu).
- Docker báo không kết nối được: mở Docker Desktop, đợi engine rồi chạy lại `docker compose up -d db`.
- Trang báo không kết nối API: kiểm tra terminal backend đang chạy và http://127.0.0.1:3000/api/v1/health/ready trả trạng thái sẵn sàng.
- Lỗi yêu cầu không hợp lệ/CSRF: mở đúng host và port ở trên, refresh rồi thử lại; không tắt CSRF.
- Thử sai mật khẩu liên tục sẽ bị giới hạn; đợi ít nhất một phút. Yêu cầu đăng ký/gửi thư nhiều lần cho cùng email có giới hạn ba lần trong 15 phút.
- Cổng 3000 hoặc 5173 đang được dùng: kiểm tra terminal đã mở trước đó, không khởi động thêm bản trùng. Nếu frontend tự chuyển sang cổng khác, dừng và giải phóng cổng 5173 trước khi thử lại.

Khi báo lỗi, gửi bước đang thử, thông báo lỗi và ảnh màn hình đã che thông tin nhạy cảm. Không gửi mật khẩu, cookie, token hoặc tệp `.env`.
