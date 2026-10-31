# Clothing Shop

Website bán hàng thật của một shop quần áo, phục vụ khách từ Instagram. React/Vite và NestJS là hai ứng dụng build độc lập, deploy trên VPS của chủ shop sau một reverse proxy HTTPS; PostgreSQL lưu dữ liệu nghiệp vụ, ảnh lưu trên ổ đĩa VPS và cần backup ra ngoài trước mở bán.

## Trạng thái

Từ 29/10/2026 dự án là website bán hàng thật, không còn là demo (quyết định và lộ trình mới ở [kế hoạch](docs/plan.md#chuyển-sang-shop-thật-29102026)). Xem [tiến độ thực tế](progress.md); một mục trong kế hoạch không đồng nghĩa tính năng đã hoàn thành.

Điểm dừng hiện tại: ngày 31/10/2026 workflow GitHub **Deploy production** lần đầu đã deploy `main` `6d35c3d` — release `ci-20261031-1218-6d35c3d` tại [trang chủ](https://rmglabels.duckdns.org/) và [cửa hàng](https://rmglabels.duckdns.org/shop): M4.2 giỏ/quote, **5 sản phẩm thật** và **link preview M7.1.1** (`/api/v1/share/products/<slug>`). Gate CI + SSH key riêng cho CI + rollback tự động theo [hướng dẫn deploy](docs/deployment-guide.md). Cả ba dịch vụ healthy; chờ người dùng thử card Zalo bằng link share và nghiệm thu các phần đã làm. Bằng chứng ở [progress.md](progress.md); hướng dẫn M3/M4/tài khoản: [local-trial-m3](docs/local-trial-m3.md), [local-trial-m4](docs/local-trial-m4.md), [local-trial-m2](docs/local-trial-m2.md).

**Chưa mở bán:** giỏ hàng M4.2.1 và quote M4.2.2 đã lên production nhưng chưa được người dùng chạy thử/nghiệm thu; chưa có đặt hàng (M4.3+), diễn tập rollback (M6.1.3), backup ngoài VPS/khôi phục (M6.2), bảo vệ VPS/báo động (M6.3) và bảo vệ admin (M3.17). Local và test chỉ dùng dữ liệu thử; dữ liệu khách thật chỉ nằm trên production.

## Tài liệu

- [Quy tắc làm việc cho agent](AGENTS.md)
- [Kế hoạch và các bước triển khai](docs/plan.md)
- [Kế hoạch triển khai M4 — Người B phụ trách toàn bộ](docs/m4-implementation-plan.md)
- [Chạy thử local M4 theo từng phần — dự kiến, chưa triển khai](docs/local-trial-m4.md)
- [Quy tắc nghiệp vụ](docs/business-rules.md)
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

## Bộ dữ liệu demo (M3.11)

**Chỉ dùng trên máy local để thử giao diện; không chạy trên production**: từ M3.15 lệnh báo lỗi và dừng khi `NODE_ENV=production`, trước khi đọc cấu hình hay kết nối DB. Hàng thật của shop nhập bằng admin hoặc lệnh `import:products` bên dưới.

Sau khi có tài khoản ADMIN (lệnh trên), chạy một lần để `/shop` local có hàng mẫu:

```powershell
.\tools\npm.ps1 run seed:demo
```

Lệnh tạo phía backend CLI (`apps/backend/src/cli/seed-demo.ts`): 2 danh mục và 4 sản phẩm có slug `demo-*` (3 xuất bản: một bản hai ảnh, một bản một ảnh, một bản không ảnh; 1 bản ẩn), 7 biến thể `DEMO-*` kèm tồn kho đa dạng (mỗi lượng nhập có một dòng lịch sử kho 'Nhập kho demo', không có hàng đang giữ vì không có đơn) và ảnh webp 750×1000 ghi vào `.local/uploads`. Chạy lại lệnh là an toàn: phần đã có được bỏ qua — không tạo trùng, không nhập kho thêm, không đụng dữ liệu bạn đã tạo. Ảnh demo cần một tài khoản ADMIN làm chủ (ưu tiên `ADMIN_EMAIL` nếu có, nếu không dùng ADMIN mới nhất); chưa có admin thì lệnh báo lỗi và hướng dẫn tạo. Backend không tự seed khi startup. Dữ liệu demo là dữ liệu nghiệp vụ bình thường: có thể Ẩn/Xuất bản lại qua admin hoặc dọn bằng Prisma Studio theo slug `demo-*`.

## Nhập dữ liệu shop thật từ CSV và ảnh (M3.13a)

Chuẩn bị thư mục (mặc định `data\import`) gồm: ảnh sản phẩm (jpg/png/webp, mỗi sản phẩm 1–8 ảnh) và file `products.csv` theo khuôn dưới đây — mỗi dòng là một sản phẩm. Tên file ảnh trong cột `files` phải trùng đúng tên file nằm cùng thư mục, nhiều ảnh cách nhau bằng `|` (ảnh đầu là ảnh bìa).

```csv
name,category,color,sizes,price,stock,description,files
"RMG Goldline Metal Baggy Pants","Quần","đen","S|M","450000","","Denim 12oz, chi tiết kim loại.","anh-1.jpg|anh-2.jpg"
```

```powershell
.\tools\npm.ps1 run import:products          # đọc data\import
.\tools\npm.ps1 run import:products -- --dir "đường\dẫn\thư\mục\khác" --draft
```

| Ràng buộc | Giá trị |
|---|---|
| sizes | `XS`,`S`,`M`,`L`,`XL`,`XXL`,`3XL`,`FREESIZE`; trống = `FREESIZE`; nhiều size cách nhau `|`, mỗi size một biến thể cùng giá |
| price | số nguyên 1–100.000.000 (bắt buộc); `stock` trống = 0, tối đa 1.000.000 |
| ảnh | 1–8 ảnh mỗi sản phẩm (file phải nằm cùng thư mục CSV); lưu vào `.local/uploads` dạng webp 750×1000 (cắt viền vừa khung) |
| thư mục | `--dir` tương đối tính từ thư mục bạn đang đứng khi gõ lệnh (với `tools\npm.ps1` là thư mục gốc repo); đường dẫn tuyệt đối dùng nguyên |
| trạng thái | Mặc định PUBLISHED lên `/shop` ngay (cần danh mục bật + ≥1 ảnh + ≥1 biến thể); `--draft` để nhập nháp soát trước. Danh mục đã có mà đang tắt thì dòng bị bỏ qua khi nhập PUBLISHED (khách sẽ không thấy); bật danh mục trong admin hoặc dùng `--draft` |
| chạy lại | Theo slug từ tên: phần đã có bị bỏ qua (không ghi đè, không nhập kho thêm); đổi tên sản phẩm tạo sản phẩm mới |
| quyền | Cần một tài khoản ADMIN làm chủ ảnh (`ADMIN_EMAIL` nếu có; thiếu admin → exit 1 kèm hướng dẫn `admin:create`) |

Không thêm cột mới, không đổi bước này: dữ liệu thật chỉ vào web qua lệnh tường minh này. Nhập tồn hoạt động qua UI Kho (M3.7.2) để có lịch sử giao dịch.

## Cấu hình production trên VPS (M3.16)

Backend chạy sau một reverse proxy HTTPS trên VPS. M3.16.1 thực hiện sớm phần deploy catalog/API của M6.1 theo kế hoạch được duyệt: nginx hiện có → container frontend/API riêng của RMG → PostgreSQL riêng; ảnh nằm trên ổ đĩa giữ lâu dài. Xem [hướng dẫn deploy, kiểm tra và rollback](docs/deployment-guide.md). Backup ngoài VPS/diễn tập khôi phục và luồng đơn hàng còn thuộc các phần tiếp theo. Biến môi trường cần cho production, ngoài `DATABASE_URL`, `SESSION_SECRET`, `MAIL_MODE=resend`, `RESEND_API_KEY`, `MAIL_FROM`:

| Biến | Giá trị trên VPS | Nếu thiếu/sai |
|---|---|---|
| `NODE_ENV` | `production` | — |
| `APP_ORIGIN` | `https://<domain của shop>` | Không khởi động (bắt buộc HTTPS) |
| `HOST` | `127.0.0.1` khi proxy chạy cùng VPS (mặc định); `0.0.0.0` chỉ khi API chạy trong mạng container | — |
| `PORT` | Cổng nội bộ proxy chuyển tới, ví dụ `3000` | — |
| `TRUST_PROXY` | Số proxy đứng trước API: `1` cho Caddy/nginx | Không khởi động (thiếu thì cookie đăng nhập bảo mật không được gửi và mọi khách bị coi chung một IP) |
| `UPLOADS_DIR` | Đường dẫn **tuyệt đối** trên ổ đĩa giữ lâu dài và có backup, ví dụ `/var/lib/rmg-shop/uploads` | Không khởi động; đường dẫn tương đối bị từ chối |

Khi cấu hình sai, backend in rõ tên biến cần sửa (không in giá trị). Ảnh công khai trả `Cache-Control: public, max-age=86400`; mọi phản hồi khác giữ `no-store`. Lệnh `import:products` chạy trên VPS ghi ảnh vào cùng `UPLOADS_DIR`.

Các file triển khai nằm trong `deploy/`: Dockerfile build Linux với OpenSSL cho Prisma, Compose project `rmg-shop`, nginx cho SPA/deep link và virtual host `rmglabels.duckdns.org`. Cổng web/API chỉ bind `127.0.0.1:4180`/`127.0.0.1:4200`; PostgreSQL không publish cổng. File env thật ở `/etc/rmg-shop/backend.env` trên VPS, không nằm trong image/source; tạo database/session secret riêng và không dùng cấu hình local. `MAIL_FROM=onboarding@resend.dev` hiện chỉ dành cho thư thử tới email tài khoản Resend; gửi cho khách cần domain gửi đã xác minh.

## File đưa lên Git

| Đưa lên Git | Giữ ở máy local |
|---|---|
| Mã nguồn, test, tài liệu, migration, cấu hình build/CI | `node_modules/`, `dist/`, coverage và kết quả test |
| `package.json` ở root và các app, `package-lock.json` ở root | `.local/` gồm runtime, thư xác minh/reset và trình duyệt test |
| `.env.example`, `.env.test.example` chỉ chứa placeholder/cấu hình mẫu an toàn | `.env`, `.env.test` và cấu hình môi trường riêng |

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

Integration Cài đặt/schema đơn và toàn bộ runner E2E tạo DB riêng tên `clothing_<nhóm>_<mã-lượt>_test`, áp dụng migration rồi chỉ xóa DB do chính lượt đó tạo. Tài khoản PostgreSQL test cần quyền `CREATEDB` (role Docker/CI hiện có quyền này). `DATABASE_URL` nguồn vẫn phải trỏ tới DB `_test`; singleton Cài đặt có sẵn trong DB nguồn không bị sửa/xóa. Chạy E2E qua `tools/test-e2e.mjs` hoặc các script npm bên dưới để dùng đúng DB riêng; không gọi Playwright trực tiếp cho spec Cài đặt.

Hai phạm vi E2E được giữ tường minh:

| Lệnh từ root | Phạm vi |
|---|---|
| `./tools/npm.ps1 run test:e2e:implemented` | Auth, toàn bộ catalog/admin/kho M3 và xem/lưu Cài đặt M4.1.2; hiện 37 ca trên 12 spec, gồm ca tổng `catalog.spec.ts`; CI chạy lệnh này |
| `./tools/npm.ps1 run test:e2e` | Chạy cả thư mục `e2e/`; hiện trùng với bộ implemented, không có nghĩa toàn bộ M4 đã triển khai |

Không xóa hoặc skip test catalog. Khi triển khai thêm phần mới, phải cập nhật phạm vi E2E đã triển khai; kết quả xanh của bộ E2E không phải nghiệm thu toàn mốc.

Integration/E2E chỉ dùng database có hậu tố `_test`, từ chối chạy cleanup trên DB khác. E2E chạy API cổng 3001 và frontend 5174 riêng; Chromium tải vào `.local/ms-playwright`, không điều khiển browser cá nhân. Test chỉ dọn fixture do lần chạy đó tạo. CI được khai báo trong `.github/workflows/ci.yml`. Commit `d5953cf` đã chạy trên GitHub: typecheck/build/unit/integration đạt, E2E toàn M3 lúc đó thất bại ở link Sản phẩm chưa có; từ M3.12 ca tổng `catalog.spec.ts` đã nằm trong bộ implemented, tên bước CI mới được xác nhận bằng lượt chạy sau lần push tới.

Build độc lập: `npm run build -w @clothing/backend` hoặc `npm run build -w @clothing/frontend`, sau khi generate Prisma ở môi trường build backend. Backend không tự migration/seed khi startup. Không dùng `prisma migrate reset` hoặc `docker compose down -v` với dữ liệu cần giữ.

Hướng dẫn deploy/admin đầy đủ được tạo khi tới mốc cần dùng. Không đưa secret vào Git hoặc biến `VITE_*`. Admin hiện quản lý danh mục tại `/admin/categories`, xem sản phẩm tại `/admin/products`, tạo nháp với một biến thể tại `/admin/products/new`, sửa thông tin nháp tại `/admin/products/:id` (chỉ sản phẩm nháp) và xem/tìm tồn theo SKU/tên tại `/admin/inventory` (`q/page` nằm trên URL). `/shop` vẫn là intro empty state. Chưa có UI sửa biến thể/ảnh/điều chỉnh tồn/lịch sử kho/đặt đơn/đổi trả.
