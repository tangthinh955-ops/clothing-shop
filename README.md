# Clothing Shop

Website một shop quần áo, phục vụ khách từ Instagram. React/Vite và NestJS là hai ứng dụng build/deploy độc lập; PostgreSQL lưu dữ liệu nghiệp vụ, Cloudinary lưu ảnh.

## Trạng thái

Dự án đang triển khai M3 theo từng phần sau nền tảng/tài khoản local. Xem [tiến độ thực tế](progress.md); một mục trong kế hoạch không đồng nghĩa tính năng đã hoàn thành.

Điểm dừng hiện tại: **M3.4.1 — admin sửa thông tin sản phẩm nháp (tên/slug/danh mục/mô tả), chờ người dùng chạy thử**. Xem [hướng dẫn M3.1–M3.4.1](docs/local-trial-m3.md) và [hướng dẫn nền tảng/tài khoản M2](docs/local-trial-m2.md). Chưa triển khai sửa SKU/size/màu/giá, thêm/tắt biến thể, ảnh và kho (M3.4.2 trở đi).

Chỉ dùng dữ liệu giả. Chưa được nghiệm thu để bán thật.

## Tài liệu

- [Quy tắc làm việc cho agent](AGENTS.md)
- [Kế hoạch và các bước triển khai](docs/plan.md)
- [Quy tắc nghiệp vụ và giả định demo](docs/business-rules.md)
- [Kiến trúc, dữ liệu, UI và API](docs/architecture.md)
- [Danh sách kiểm tra nghiệm thu](docs/acceptance-checklist.md)

## Chạy local

Cần Node **24.22.1+ trên dòng 24**, npm 11 và Docker Desktop đang chạy. Không dùng Node 22.20 của máy cho Router 8.5. Node 24 riêng của phiên triển khai được lưu trong `.local` (không commit). Trên Windows, `tools/npm.ps1` chọn runtime local nếu có và khôi phục PATH sau lệnh; máy khác cài Node tương thích rồi dùng npm bình thường.

Tại root, PowerShell:

```powershell
.\tools\npm.ps1 ci
.\tools\npm.ps1 run setup:local
docker compose up -d db
.\tools\npm.ps1 run db:generate
.\tools\npm.ps1 run db:migrate
.\tools\npm.ps1 run db:migrate:test -w @clothing/backend
```

`setup:local` tạo `.env` và `.env.test` từ example, sinh session secret ngẫu nhiên và **không ghi đè file đã có**. Database local là `clothing_local`, test là `clothing_test`; cổng DB chỉ bind `127.0.0.1:5433`, mật khẩu trong compose chỉ dành local. Không dùng cấu hình này cho database công khai.

Hai terminal:

```powershell
# Terminal 1 — API và TypeScript watch
.\tools\npm.ps1 run dev:backend

# Terminal 2 — React
.\tools\npm.ps1 run dev:frontend
```

Mở **http://127.0.0.1:5173**; API http://127.0.0.1:3000/api/v1, Swagger local http://127.0.0.1:3000/api/docs. Frontend gọi `/api` qua proxy. `APP_ORIGIN` phải khớp địa chỉ mở trình duyệt, gồm host và port; `localhost` và `127.0.0.1` là hai origin khác nhau. Không bỏ CSRF hoặc mở wildcard CORS để chữa lỗi origin.

## Xem database bằng Prisma Studio

Giữ Docker database đang chạy. Với Node/npm tương thích như yêu cầu ở trên, mở terminal mới (CMD hoặc PowerShell):

```shell
cd C:\NAM4_2\ShopQuanAo_Codex\apps\backend
npx prisma studio
```

Mở địa chỉ Studio được terminal hiển thị; chọn bảng `users` để xem tài khoản đã đăng ký. Nhấn Ctrl+C trong terminal này để dừng Studio.

`prisma.config.ts` tự đọc `.env` nằm cạnh nó khi chưa có `DATABASE_URL` và không ở `NODE_ENV=test`. Biến môi trường đã cung cấp (kể cả từ `.env.test` hoặc CI) được ưu tiên; chế độ test không tự đọc cấu hình local. Không cần cài thêm thư viện hoặc nạp `.env` thủ công mỗi lần mở Studio. Việc mở Studio không chạy migration; chỉnh sửa dữ liệu trong Studio sẽ ghi trực tiếp vào database.

## Tài khoản và thư thử

Đăng ký bằng email giả, ví dụ thuộc `example.test`. Khi MAIL_MODE=preview, thư xác minh/reset nằm trong `.local/mailbox/mail-*.json`: mở file và sao chép URL ở trường `text`. Không công khai thư mục này hoặc gửi token vào chat/log. Thư thử được dọn khi gửi tiếp sau hạn một giờ; token vẫn có hạn và dùng một lần. Preview chỉ local/test, startup production từ chối chế độ này.

Không có mật khẩu admin mặc định. Để tạo admin, đặt `ADMIN_EMAIL` và `ADMIN_PASSWORD` riêng trong môi trường của terminal hoặc `.env` bị Git bỏ qua, chạy:

```powershell
.\tools\npm.ps1 run admin:create
```

Mật khẩu 12–128 ký tự; xóa `ADMIN_PASSWORD` khỏi môi trường/tệp sau khi tạo. Lệnh chỉ tạo mới, không tự nâng quyền hay ghi đè tài khoản cũ. Không đưa mật khẩu vào tham số dòng lệnh hoặc commit.

## File đưa lên Git

| Đưa lên Git | Giữ ở máy local |
|---|---|
| Mã nguồn, test, tài liệu, migration, cấu hình build/CI | `node_modules/`, `dist/`, coverage và kết quả test |
| `package.json` ở root và các app, `package-lock.json` ở root | `.local/` gồm runtime, thư xác minh/reset và trình duyệt test |
| `.env.example`, `.env.test.example` chỉ chứa placeholder/cấu hình demo | `.env`, `.env.test` và cấu hình môi trường riêng |

`package.json` khai báo thư viện và lệnh chạy; `package-lock.json` cố định phiên bản để máy khác và CI cài lại bằng `npm ci`. Hai file này cần được commit; thư viện đã tải trong `node_modules/` được bỏ qua.

Trước khi commit, kiểm tra `git status --short`, `git diff --cached --stat` và `git diff --cached` trên máy. `.gitignore` không loại file đã được Git theo dõi; kiểm tra thêm `git ls-files -ci --exclude-standard` (mong đợi không có kết quả). Không dùng `git add -f` để đưa file bị ignore lên Git. Không gửi nội dung `.env`, thư local hoặc token vào chat.

## Kiểm tra

```powershell
.\tools\npm.ps1 run typecheck
.\tools\npm.ps1 run build
.\tools\npm.ps1 test
.\tools\npm.ps1 run test:integration
.\tools\npm.ps1 run test:e2e:install
.\tools\npm.ps1 run test:e2e:implemented
```

Hai phạm vi E2E được giữ tường minh:

| Lệnh từ root | Phạm vi |
|---|---|
| `./tools/npm.ps1 run test:e2e:implemented` | Auth + categories + products (tạo và sửa nháp) đã triển khai đến M3.4.1, hiện 11 ca; CI dùng lệnh này và ghi rõ tên bước |
| `./tools/npm.ps1 run test:e2e` | Toàn bộ E2E, gồm `catalog.spec.ts` kiểm tra sản phẩm/ảnh/kho/public catalog toàn M3; hiện chưa đạt vì các UI đó chưa có |

Không xóa hoặc skip test catalog. Khi triển khai thêm các phần M3, phải cập nhật phạm vi E2E đã triển khai; khi toàn M3 sẵn sàng, CI cần chạy bộ đầy đủ. Kết quả xanh của bộ implemented không phải nghiệm thu toàn M3.

Integration/E2E chỉ dùng database có hậu tố `_test`, từ chối chạy cleanup trên DB khác. E2E chạy API cổng 3001 và frontend 5174 riêng; Chromium tải vào `.local/ms-playwright`, không điều khiển browser cá nhân. Test chỉ dọn fixture do lần chạy đó tạo. CI được khai báo trong `.github/workflows/ci.yml`. Commit `d5953cf` đã chạy trên GitHub: typecheck/build/unit/integration đạt, E2E toàn M3 thất bại ở link Sản phẩm chưa có; kết quả cấu hình CI mới chỉ được xác nhận sau khi commit/push và có lượt chạy mới.

Build độc lập: `npm run build -w @clothing/backend` hoặc `npm run build -w @clothing/frontend`, sau khi generate Prisma ở môi trường build backend. Backend không tự migration/seed khi startup. Không dùng `prisma migrate reset` hoặc `docker compose down -v` với dữ liệu cần giữ.

Hướng dẫn deploy/admin đầy đủ được tạo khi tới mốc cần dùng. Không đưa secret vào Git hoặc biến `VITE_*`. Admin hiện quản lý danh mục tại `/admin/categories`, xem sản phẩm tại `/admin/products`, tạo nháp với một biến thể tại `/admin/products/new` và sửa thông tin nháp tại `/admin/products/:id` (nút Sửa trên danh sách, chỉ sản phẩm nháp); `/shop` vẫn là intro empty state. Chưa có UI sửa biến thể/ảnh/kho/đặt đơn/đổi trả.
