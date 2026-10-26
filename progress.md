# Tiến độ Clothing Shop

Kế hoạch: [docs/plan.md](docs/plan.md). Cập nhật theo kết quả thật, không ghi pass cho việc chưa chạy.

## Ngày 23/10/2026

- Người dùng cho phép tiến hành kế hoạch. Ngân sách ưu tiên miễn phí, thời gian 10 giờ/tuần.
- Workspace mới, không có Git repository hoặc source ứng dụng lúc khảo sát.
- Node local 22.20.0, npm 11.6.2, Docker Compose 2.39.4. Docker daemon chưa kết nối được (named pipe không tồn tại; config Docker có hạn chế quyền).
- Đã soạn bộ tài liệu M1; chờ kiểm tra liên kết/nội dung và review trước khi đánh dấu hoàn thành.
- Registry từ sandbox bị EACCES; đã yêu cầu quyền đọc metadata npm để chọn phiên bản trước cài.

## Trạng thái mốc

| Mốc | Trạng thái |
|---|---|
| M1 Thiết kế | Đã soạn và rà soát; tài liệu mục tiêu cho các mốc sau |
| M2 Nền tảng/auth | Bản local đã qua kiểm tra kỹ thuật; dừng để người dùng chạy thử |
| M3 Catalog/ảnh/kho | Chưa thực hiện |
| M4 Bán hàng | Chưa thực hiện |
| M5 Sau bán hàng | Chưa thực hiện |
| M6 Deploy/restore | Chưa thực hiện |
| M7 Nghiệm thu | Chưa thực hiện |

## Quyết định thực hiện

- Workspace hiện trống và chưa là repo: khởi tạo repo riêng tại thư mục người dùng chỉ định, dùng nhánh feature; không tạo worktree bên trong một repo chưa tồn tại hoặc sửa dự án khác.
- Kế hoạch được lưu ở `docs/plan.md`, đặc tả nghiệp vụ ở `docs/business-rules.md`, theo vị trí người dùng yêu cầu.
- Không đổi Node toàn máy, không tự mua dịch vụ; engine incompatibility phải được xử lý tường minh.
- Review M1 đã phát hiện và bổ sung: tiền đến sau hủy trước deadline; nghĩa vụ tiền khi nhận giao thất bại; Returns suy ra needsResolution để không gọi vòng Orders→Returns. Định nghĩa ngân sách hoàn không cộng PROCESSING hai lần; adapter Mail tối thiểu chuyển về M2 vì auth cần dùng.
- Metadata npm kiểm tra: React 19.3.1, Router 8.5.0 cần Node >=22.22; Nest 12.2.0; MUI 9.5.0; Vite 8.3.5; Prisma stable 7.10.1 (latest là 8 RC, không chọn). Node 24.22.1 đã tải vào `.local`, kiểm SHA256 từ nodejs.org, không thay hệ thống.
- Docker Desktop được khởi động nền; daemon trả phiên bản 28.4.0. Chưa có PostgreSQL/test ứng dụng chạy ở thời điểm ghi này.

## Kiểm tra

### Bản Git đầu tiên — 26/10/2026

- Người dùng yêu cầu commit/push toàn bộ mã nguồn lên `https://github.com/tangthinh955-ops/clothing-shop.git`; repo đích chưa có nhánh/commit ở lần kiểm tra.
- Kiểm tra trước commit phát hiện `.env.test.example` trùng session secret với cấu hình test local; thay bằng placeholder để `setup:local` sinh secret riêng. Không thay `.env` thật.
- Chạy lại `npm test`: 14 test công cụ/unit/UI đạt; typecheck và build hai ứng dụng đạt. Integration/E2E không chạy lại trong bước Git này; bằng chứng lần chạy trước được ghi ở M2 bên dưới.
- Mục tiêu push: source, migration, cấu hình mẫu, CI và tài liệu. `.env` thật, mailbox, runtime local, dependency và build artifact bị loại trừ. Trạng thái M2 vẫn chờ người dùng chạy thử; chưa triển khai M3.
- Đã tạo commit đầu tiên `3b67275` gồm 83 tệp và push thành công lên nhánh `main`; remote `origin` trỏ tới repo người dùng cung cấp. Nhánh local đã theo dõi `origin/main`. Kết quả push không đồng nghĩa GitHub CI đã đạt; CI chưa được xác nhận trong bước bàn giao này.

### Yêu cầu push GitHub — 26/10/2026

- Người dùng yêu cầu push tới `https://github.com/tangthinh955-ops/clothing-shop.git`; nhánh local hiện là `feat/foundation`, chưa có commit.
- Đã kiểm tra lại status, diff stat, index và `git ls-files -ci --exclude-standard`: không có file đang được theo dõi thuộc nhóm bị ignore. Chưa thay đổi phần staged; cấu hình riêng và dữ liệu local vẫn ngoài Git.
- Bị chặn trước khi tạo commit/push: `git remote add origin` báo không thể ghi `.git/config` (Permission denied); `git ls-remote --symref ... HEAD` không kết nối được và báo `getaddrinfo() thread failed to start`. Phiên hiện tại chỉ có quyền đọc `.git`; không thay quyền, không tạo remote hoặc commit thành công.
- Tìm phương án qua Plugin Management: GitHub có sẵn để kết nối nhưng chưa được cài/kết nối trong phiên. Đã hiển thị gợi ý kết nối; chưa dùng plugin để ghi repository.
- Chưa xác minh được trạng thái repository từ xa, chưa push và chưa xác nhận CI. Cần phiên có quyền ghi Git và truy cập GitHub, hoặc kết nối GitHub phù hợp, để tiếp tục. Không thay đổi tiến độ M2/M3.


### Kiểm tra

### Yêu cầu push GitHub — 26/10/2026

- Người dùng yêu cầu push tới `https://github.com/tangthinh955-ops/clothing-shop.git`; nhánh local hiện là `feat/foundation`, chưa có commit.
- Đã kiểm tra lại status, diff stat, index và `git ls-files -ci --exclude-standard`: không có file đang được theo dõi thuộc nhóm bị ignore. Chưa thay đổi phần staged; cấu hình riêng và dữ liệu local vẫn ngoài Git.
- Bị chặn trước khi tạo commit/push: `git remote add origin` báo không thể ghi `.git/config` (Permission denied); `git ls-remote --symref ... HEAD` không kết nối được và báo `getaddrinfo() thread failed to start`. Phiên hiện tại chỉ có quyền đọc `.git`; không thay quyền, không tạo remote hoặc commit thành công.
- Tìm phương án qua Plugin Management: GitHub có sẵn để kết nối nhưng chưa được cài/kết nối trong phiên. Đã hiển thị gợi ý kết nối; chưa dùng plugin để ghi repository.
- Chưa xác minh được trạng thái repository từ xa, chưa push và chưa xác nhận CI. Cần phiên có quyền ghi Git và truy cập GitHub, hoặc kết nối GitHub phù hợp, để tiếp tục. Không thay đổi tiến độ M2/M3.
 file chuẩn bị đưa lên Git — 26/10/2026

- Kiểm tra index, working tree và ignore bằng `git status --short`, `git diff --stat`, `git diff --cached --stat`, `git ls-files -ci --exclude-standard` và `git check-ignore -v --no-index`. Dùng `git -c safe.directory=C:/NAM4_2/ShopQuanAo_Codex ...` cho từng lệnh do khác owner Windows; không thay cấu hình Git toàn máy.
- `.env` và `.env.test` thật, dependency, build, Prisma generated, runtime và mailbox local đã được ignore; không có file đang được theo dõi thuộc nhóm bị ignore. Giữ các `.env*.example` cần thiết, `package.json` và lockfile để cài lại dự án. `.gitignore` hiện đủ cho các file local đã kiểm tra nên giữ nguyên.
- Quét 83 file tracked/untracked không bị ignore theo mẫu private key, token provider, URL chứa mật khẩu và secret gán trực tiếp; rà soát các vị trí khớp là cấu hình demo/test hoặc placeholder. Đối chiếu secret riêng đủ dài trong env local không thấy xuất hiện trong các file này. Kiểm tra thêm 9 file trong index không phát hiện token provider, private key hoặc secret local đã đối chiếu. Đây là kiểm tra theo mẫu và đối chiếu, không bảo đảm phát hiện mọi dạng secret.
- Bổ sung hướng dẫn file đưa lên Git trong README. `git diff --check` và `git diff --cached --check` đều đạt sau cập nhật; đã đọc diff và xác nhận danh sách staged không đổi. Không chạy lại ứng dụng vì chỉ sửa tài liệu.
- Repo hiện chưa có commit và chưa cấu hình remote. Không stage, commit hoặc push trong phần việc này; giữ nguyên phần đã staged của người dùng. Điểm dừng vẫn là chờ chạy thử M2 local.


### Quy trình làm việc — 26/10/2026

- Theo yêu cầu người dùng, thêm `AGENTS.md` ở root: thông báo kế hoạch trước mỗi phần/giai đoạn, thực hiện đúng phạm vi, kiểm chứng và cập nhật tài liệu sau khi làm, giải thích key quan trọng ngắn gọn, rồi dừng để người dùng chạy thử.
- Bổ sung quy tắc frontend/backend/database, bảo mật, Git và tiêu chí hoàn thành; README dẫn tới tệp quy tắc.
- Đây là thay đổi tài liệu; không triển khai M3. Trạng thái vẫn là chờ người dùng chạy thử M2 local.

### Cập nhật 24/10/2026

- Người dùng yêu cầu triển khai theo từng giai đoạn. Mốc đang thực hiện là M2; hoàn tất kiểm tra và báo kết quả M2 trước khi chuyển sang M3.
- Các ghi nhận môi trường ở ngày 23/10 phía trên là lịch sử: PostgreSQL local đã chạy và migration auth đã áp dụng cho database local và test.
- Đã triển khai khung backend/frontend, đăng ký, xác thực email qua hộp thư local, đăng nhập/đăng xuất, quên/đặt lại mật khẩu, hồ sơ và kiểm tra quyền admin.
- Kết quả đã quan sát trong phiên thực hiện: typecheck hai ứng dụng đạt; 11 test unit/UI đạt; bộ 8 test tích hợp auth ban đầu đạt.
- Sau đó bổ sung test tích hợp và E2E. Chưa xác nhận kết quả bộ mở rộng, E2E và build toàn bộ sau các chỉnh sửa mới nhất; không coi kết quả trước đó là nghiệm thu phiên bản hiện tại.
- Còn kiểm tra mở rộng, E2E, build toàn bộ, rà soát cuối và cập nhật hướng dẫn trước khi chốt M2. Chưa xác nhận CI trên GitHub.
- M3–M7 chưa thực hiện. Chưa deploy; hiện ưu tiên local theo yêu cầu người dùng.

### Điểm dừng chạy thử M2 — 24/10/2026

- Người dùng yêu cầu: hoàn tất một giai đoạn rồi dừng để tự chạy thử. Ruling: chốt M2 local, hoãn deploy/CI trên GitHub theo quyết định local trước; không bắt đầu M3 khi chưa có phản hồi.
- Đã chạy typecheck và build cả hai ứng dụng thành công. Vite cảnh báo bundle khoảng 535 kB trước gzip; ghi nhận để tối ưu khi phát triển catalog, chưa ảnh hưởng build local.
- Bộ auth tích hợp mở rộng: 16/16 đạt trên PostgreSQL thật. Unit/UI: 11/11 đạt. E2E Chromium: 2/2 đạt qua proxy local, gồm đăng ký → xác minh → đăng nhập → refresh → reset → đăng nhập mới → logout và kiểm tra mobile/focus. Đã xem ảnh mobile.
- Review độc lập phát hiện tệp `.env.test.example` bị bỏ qua và E2E kiểm tra database quá muộn. Đã thêm ngoại lệ Git và preflight NODE_ENV/test database trước khi khởi động Playwright. Ba test tái hiện đã thất bại trước sửa, đạt sau sửa; kết quả chạy lại toàn bộ được xác nhận ở bàn giao.
- Hướng dẫn người dùng: [chạy thử M2](docs/local-trial-m2.md). Không có mật khẩu admin mặc định; thư xác minh/reset chỉ ở hộp thư local.
- Giới hạn: chưa có bằng chứng GitHub CI/deploy/Resend thật; chưa có catalog, kho, đặt hàng, đổi trả. Đây là điểm dừng chạy thử, chưa phải nghiệm thu bán hàng.
