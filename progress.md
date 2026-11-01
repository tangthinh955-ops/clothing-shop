# Tiến độ Clothing Shop

Kế hoạch: [docs/plan.md](docs/plan.md). Cập nhật theo kết quả thật, không ghi pass cho việc chưa chạy.

## Ngày 01/11/2026 — M4.5.2: chi tiết đơn và ghi chú nội bộ cho admin

**Phạm vi đã duyệt:** người dùng duyệt kế hoạch M4.5.2 ("duyệt"), gồm ghi chú chỉ thêm không sửa/xóa và làm tiếp trên nhánh `feat/m4.5.1-admin-orders-list`. **Đã viết, agent đã kiểm tra local; chưa commit; chờ người dùng chạy thử.** Người dùng nói "tiếp tục" sau M4.5.1, chưa xác nhận đã chạy thử M4.5.1.

| File | Thay đổi |
|---|---|
| `apps/backend/prisma/schema.prisma`, `prisma/migrations/202611010001_m4_order_notes/migration.sql` | **Migration chỉ thêm bảng** `order_notes` (đơn, người viết, nội dung ≤1000, thời gian); xóa đơn thì xóa ghi chú, không xóa được user đã viết ghi chú. Chưa áp dụng vào DB local `clothing_local` và production; DB test tự áp dụng |
| `apps/backend/src/modules/orders/admin-orders.service.ts`, `admin-orders.controller.ts`, `orders.module.ts` | `GET /admin/orders/:id`: snapshot, lịch sử (tên người thao tác), ghi chú; không có hash token; id sai dạng 400, không có đơn 404 |
| `admin-order-notes.service.ts`, `dto/admin-order-note.dto.ts` (mới) | `POST /admin/orders/:id/notes` qua CSRF + `Idempotency-Key`: ghi chú và bản ghi chống trùng trong một transaction; gửi lại trả đúng ghi chú cũ, cùng key khác nội dung/khác đơn 409, hai request đua chỉ tạo một ghi chú. Không đổi `Order.version`/trạng thái/tiền |
| `apps/frontend/src/features/admin/orders/pages/AdminOrderDetailPage.tsx`, `components/OrderNotes.tsx`, `orderLabels.ts` (mới, `orderLabels.ts` **ngoài danh sách dự kiến** để list và chi tiết dùng chung nhãn); `api/admin-orders.api.ts`; `pages/AdminOrdersPage.tsx`; `app/App.tsx` | Mã đơn trong danh sách là link; quay lại giữ bộ lọc; trang chi tiết có Người nhận (SĐT bấm gọi được), Sản phẩm + tiền, Lịch sử, Ghi chú nội bộ. Lỗi mạng khóa nội dung và cho "Gửi lại" cùng key; server từ chối (4xx) thì giữ draft để sửa, dùng key mới |
| Test | `admin-orders.integration.spec.ts` +12; mới `AdminOrderDetailPage.test.tsx` (12); `AdminOrdersPage.test.tsx` +1; `e2e/admin-orders.spec.ts` thêm mở đơn, ghi chú, tải lại, quay lại giữ bộ lọc |
| `docs/m4-contract.md`, `docs/architecture.md`, `docs/local-trial-m4.md`, `docs/m4-implementation-plan.md`, `docs/plan.md` | Chốt API ghi chú; bỏ yêu cầu lỗi version của ghi chú; hướng dẫn thử |

**TDD:** 12 ca API và 12 ca UI RED (chưa có route/trang) → GREEN. Bản đầu của phần gửi lại ép kiểu mù JSON đã lưu; đã đổi sang đọc lại đúng ghi chú từ DB trước khi chạy kiểm tra cuối.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | Đạt |
| `npm test` (`VITEST_MAX_WORKERS=2`) | 10 công cụ + 69 backend + 414 frontend |
| `npm run test:integration` | 140/140, 15 file; gồm ghi chú không xuất hiện trong view của khách |
| `npm run test:e2e:implemented` | 52/52 (1,5 phút) |
| Ảnh Playwright 390px danh sách và chi tiết | Không tràn ngang; bản máy tính chỉ qua E2E, chưa xem ảnh |

**Giới hạn:** chưa có nút xử lý đơn (M4.5.3–5.8), chưa có trạng thái thu tiền (M4.6). Vẫn **không nên deploy `main`** cho tới khi xong M4.5.7 và M4.10.1. Chưa commit/push, chưa chạy CI. **Chạy thử:** cần `./tools/npm.ps1 run db:migrate` trước; xem [docs/local-trial-m4.md](docs/local-trial-m4.md) § M4.5.2. **Dừng chờ người dùng thử.**

## Ngày 01/11/2026 — M4.5.1: admin xem danh sách đơn

**Phạm vi đã duyệt:** người dùng duyệt kế hoạch M4.5.1 ("duyệt"). Nhánh `feat/m4.5.1-admin-orders-list` từ `main` `a421fcb`. Làm trước M4.4.3 vì shop cần thấy đơn trước tiên và phần này chỉ phụ thuộc M4.3.1; lý do đã ghi ở kế hoạch M4. Tài liệu giao M4 cho Người B, đã báo người dùng nên báo Người B tránh trùng việc. **Đã viết, agent đã kiểm tra local; chưa commit; chờ người dùng chạy thử.**

| File | Thay đổi |
|---|---|
| `apps/backend/src/modules/orders/admin-orders.controller.ts`, `admin-orders.service.ts`, `dto/admin-orders-query.dto.ts` (mới); `orders.module.ts` | `GET /admin/orders` chỉ ADMIN (`SessionGuard` + `RolesGuard`); lọc `status`, tìm `q` theo mã đơn/tên/SĐT (SĐT `+84…` được chuẩn hóa), mới nhất trước, mặc định 20 đơn/trang. Chỉ trả id, mã, trạng thái, nguồn, phương thức, tổng tiền, tên, SĐT, số sản phẩm, thời gian; không có địa chỉ, email, ghi chú, hash token. Chỉ đọc, không migration |
| `apps/frontend/src/features/admin/orders/api/admin-orders.api.ts`, `pages/AdminOrdersPage.tsx` (mới); `app/App.tsx`; `features/admin/AdminPage.tsx` | Trang `/admin/orders` với lọc/tìm/trang trên URL; đang tải, rỗng (phân biệt chưa có đơn và không khớp lọc), lỗi có "Tải lại đơn hàng", URL sai không gọi API; nút "Đơn hàng" là nút chính ở trang Quản trị |
| `apps/frontend/src/features/orders/orderStatusLabels.ts` (mới, **ngoài danh sách dự kiến**); `features/orders/pages/OrderDetailPage.tsx` | Nhãn trạng thái dùng chung thay vì chép lại ở trang admin; trang khách không đổi hành vi |
| Test | Mới `apps/backend/test/admin-orders.integration.spec.ts` (14 ca, gồm đơn thật qua `POST /orders`), `AdminOrdersPage.test.tsx` (12 ca), `apps/frontend/e2e/admin-orders.spec.ts` (2 ca, thêm vào `test:e2e:implemented`) |
| `docs/local-trial-m4.md`, `docs/m4-implementation-plan.md`, `docs/plan.md` | Hướng dẫn thử M4.5.1, điểm dừng, lý do đổi thứ tự |

**TDD:** 14 ca API RED (404 vì chưa có route) và 11/12 ca UI RED (chưa có trang; ca CUSTOMER đạt ngay vì route chưa tồn tại nên chưa chứng minh được chặn, sau khi có route vẫn đạt) → GREEN.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | Đạt |
| `npm test` (`VITEST_MAX_WORKERS=2`) | 10 công cụ + 69 backend + 401 frontend |
| `npm run test:integration` | 128/128, 15 file |
| `npm run test:e2e:implemented` | 52/52 (1,3 phút) |
| Ảnh Playwright 390px trong E2E | Không tràn ngang (`scrollWidth <= innerWidth`) |

**Giới hạn:** chưa xem được chi tiết đơn (M4.5.2), chưa có thao tác xử lý đơn (M4.5.3–5.8), chưa có trạng thái thu tiền vì bảng tiền thuộc M4.6. Vẫn **không nên deploy `main`** cho tới khi xong M4.5.7 và M4.10.1. Chưa commit/push, chưa chạy CI. **Chạy thử:** [docs/local-trial-m4.md](docs/local-trial-m4.md) § M4.5.1. **Dừng chờ người dùng thử.**

## Ngày 01/11/2026 — M4.4.2: cô lập rate limit giữa các spec E2E trên CI

- **Phạm vi được duyệt:** xác minh lỗi đăng nhập trong 6 ca E2E CI, cô lập client của từng spec, cải thiện assertion đăng nhập, cập nhật tiến độ rồi commit/push nhánh hiện tại. Không thay code ứng dụng, guard, giới hạn rate limit, schema hoặc timeout.
- **Chẩn đoán:** log CI ghi 44/50 đạt, 6 ca products/settings đứng ở `/login`. Chạy toàn bộ bản cũ trên Windows local đạt 50/50 trong 3,5 phút nên chưa tái hiện tự nhiên tốc độ Linux CI. Mỗi mutation lấy CSRF mới; các spec cũ cùng IP loopback và cùng bucket GET `/auth/csrf` 120/phút. Sau khi tạo tạm 121 GET CSRF bằng client loopback, endpoint trả **429** và chính ca `admin edits draft variants` thất bại đúng triệu chứng `/login` thay vì `/admin`. Đây là tái hiện có áp lực, không phải status thu trực tiếp từ CI.
- **RED → GREEN:** cùng kịch bản áp lực, trước sửa ca đích thất bại với `/auth/csrf 429`; sau cấu hình IP riêng, client áp lực vẫn bị 429 nhưng ca đăng nhập/chỉnh sản phẩm đạt. Đã bỏ toàn bộ pressure hook và log `[DEBUG-e2e-auth]` trước kiểm chứng bản cuối; giữ nguyên 50 ca nghiệp vụ.
- **File/data flow:** `apps/frontend/playwright.config.ts` tự tạo một project cho mỗi spec, gửi IP thử riêng qua `X-Forwarded-For`; riêng process backend E2E tin một hop proxy Vite, để guard áp dụng bucket của đúng client. `apps/frontend/e2e/products.spec.ts` và `apps/frontend/e2e/settings.spec.ts` kiểm status login hoặc CSRF lỗi trước kiểm điều hướng; ca hai tab dùng chung context fixture để cùng session/cấu hình client và được tự cleanup. Không có key hoặc biến nghiệp vụ mới.
- **Kiểm tra bản cuối:** `./tools/npm.ps1 test` với `VITEST_MAX_WORKERS=2` đạt **10 tools + 69 backend + 389 frontend = 468 test**; `./tools/npm.ps1 run typecheck` đạt; TypeScript riêng cả ba file E2E/config đạt **0 diagnostics**; `git diff --check` đạt. Review độc lập không có finding cần chặn commit; discovery đúng **50 test/18 spec**, mỗi test xuất hiện một lần. Lượt đầy đủ cuối của `npm run test:e2e:implemented` đạt **50/50 trong 3,9 phút, exit 0**, gồm cả 6 ca từng lỗi CI; runner build lại cả backend/frontend và cleanup DB riêng thành công. Còn cảnh báo bundle >500 kB/pg deprecation có sẵn. Không chạy lại integration vì chỉ thay hạ tầng/assertion E2E, không đổi ứng dụng.
- **Các lượt kiểm tra chưa đạt:** lượt đầu `npm test` chạy song song E2E bị timeout 15 giây ở `Prisma config loads backend .env when DATABASE_URL is missing` (9/10 tools đạt), chạy lại sau đó đạt cả 10 tools và toàn suite như trên, không sửa test hoặc timeout. Lượt E2E đầu bị `ECONNREFUSED` do Docker local đang tắt; đã khởi động đúng service `db` local, runner dùng database `_test` riêng. Lượt thu log E2E bằng chuyển hướng output qua PowerShell wrapper bị `NativeCommandError` trên warning stderr; không dùng mã thoát lượt này làm bằng chứng đạt, chạy lại trực tiếp để kiểm chứng.
- **Gián đoạn môi trường:** một lượt đầy đủ khác đạt 33 ca rồi PostgreSQL local nhận `fast shutdown request` lúc **22:43:59 (Asia/Bangkok)**, khiến backend mất kết nối (`57P01`), 8 ca lỗi, 9 ca chưa chạy và cleanup runner bị `ECONNRESET`. Docker xác nhận container đã dừng, không OOM. Không sửa ứng dụng để xử lý sự cố kiểm thử này; khởi động lại đúng service local và chạy lại toàn bộ bằng DB riêng mới. Không xóa thủ công DB còn lại của lượt bị ngắt khi chưa đối chiếu được tên sở hữu.
- **Git/điểm dừng:** đã kiểm chứng, chuẩn bị commit/push thường `feat/m4.4.2-order-lookup` theo phạm vi duyệt, không merge/deploy hoặc bắt đầu M4.4.3. Diff chỉ gồm đúng bốn file dự kiến; ignore loại env thật/runtime/dependency/build/log, không có file tracked bị ignore, mẫu credential hoặc marker conflict trong thay đổi. Local đạt không xác nhận CI mới hoặc nghiệm thu người dùng; chạy thử lại bằng `./tools/npm.ps1 run test:e2e:implemented`, kỳ vọng đủ 50 ca đạt, nhất là products/settings.

## Ngày 01/11/2026 — M4.4.2: giải quyết conflict rebase của test chờ khóa

- **Phạm vi được duyệt:** xử lý conflict trong `apps/backend/test/order-creation.integration.spec.ts`, giữ nội dung tiến độ đã staged, cập nhật kết quả và hoàn tất rebase đang dở của `feat/m4.4.2-order-lookup` lên `e2b34bb`; không push/deploy trong lượt này.
- **RED thực tế:** Vitest dừng ở `PARSE_ERROR` do marker conflict, không chạy test nào; kiểm tra cú pháp có 5 lỗi. TypeScript kiểm riêng còn bắt `holder`/`createPromise` bị shadow và dùng trước khai báo, `$transaction`/`$disconnect` không thuộc `pg.Client`.
- **Bản sửa:** giữ duy nhất cách lấy session advisory lock bằng `pg.Client` từ phía main, bỏ block Prisma bị ghép trùng; một holder, một request và một `commandKey`. Xác nhận request chờ đúng advisory lock, hết hạn quote bằng giờ PostgreSQL, nhả khóa rồi kiểm `409 QUOTE_CHANGED` và không phát sinh đơn/kho/movement/idempotency.
- **Cleanup:** dùng một hàm `cleanup` trên cả luồng thành công và lỗi; gọi `holder.end()` để giải phóng khóa trước khi đợi request kết thúc. Không còn shadowing, hai `finally` ghép nối hoặc gọi API Prisma trên `pg.Client`.
- **Tài liệu:** giữ các mục đã staged; bỏ một dòng `=======` cũ giữa hai mục tiến độ, không xóa nội dung hai bên. Mục sửa parse trước đó được giữ làm lịch sử; cách cleanup hiện tại được mô tả ở mục mới này.
- **GREEN thực tế:** spec tạo đơn **12/12**; toàn bộ `./tools/npm.ps1 run test:integration` **114/114, 14 file**; `./tools/npm.ps1 run typecheck` đạt; TypeScript riêng file integration **0 diagnostics**, `git diff --check` đạt. Review độc lập không có finding quan trọng. Test dùng PostgreSQL local và database `_test` riêng của runner; còn cảnh báo pg deprecation có sẵn.
- **Giới hạn:** code ứng dụng/dependency/schema không đổi; không chạy lại E2E trong lượt sửa test này và chưa có kết quả CI mới. Dừng sau khi hoàn tất rebase local để người dùng kiểm tra.

## Ngày 01/11/2026 — M4.4.2: sửa race của integration hết hạn báo giá trên CI

- **Phạm vi được duyệt:** sửa `apps/backend/test/order-creation.integration.spec.ts` và mục tiến độ này, rồi commit/push lại `feat/m4.4.2-order-lookup`; không đổi code ứng dụng, dependency, schema hoặc timeout của suite.
- **Nguyên nhân:** test cũ gửi HTTP trước khi kết nối holder lấy advisory lock. CI có thể cho request lấy khóa trước, tạo đơn hợp lệ `201` trong khi assertion mong `409`. Test còn phụ thuộc `Date.now() + 3000` và sleep 6 giây, không xác nhận request thực sự đang chờ khóa.
- **Tái hiện:** bản cũ chạy test đích riêng có thể đạt; thêm tạm độ trễ khởi động holder 250 ms đã tái hiện đúng lỗi CI **expected 201 to be 409**. Độ trễ chẩn đoán đã được loại khỏi bản cuối.
- **Bản sửa:** holder lấy khóa trước khi bắt đầu HTTP; `expect.poll` xác nhận advisory waiter bị đúng PID holder chặn qua `pg_stat_activity`/`pg_blocking_pids`; cập nhật hạn fixture bằng `clock_timestamp()` trong transaction holder rồi commit để công bố hạn và nhả khóa cùng nhau. Không dùng sleep cố định hoặc đồng hồ máy cho ca này. Cleanup đợi request kết thúc sau khi holder nhả khóa trước khi ngắt kết nối.
- **Assertion:** giữ `409 QUOTE_CHANGED` và không có đơn; bổ sung kho giữ nguyên, không có movement mới hoặc idempotency record của command bị từ chối. Không bỏ test hoặc nới timeout để che lỗi.
- **Kiểm tra mới:** test đích đạt **3 lượt liên tiếp** sau sửa (mỗi lượt 1 đạt/11 không thuộc bộ lọc); toàn bộ `./tools/npm.ps1 run test:integration` đạt **114/114, 14 file**; `./tools/npm.ps1 run typecheck` đạt; kiểm tra TypeScript riêng file integration đạt **0 diagnostics** vì tsconfig app không bao gồm test. `git diff --check` đạt; review độc lập không có finding quan trọng.
- **Môi trường:** đã xác nhận PostgreSQL local, `NODE_ENV=test` và DB hậu tố `_test`; runner tạo/migrate/cleanup DB riêng của từng lượt. Không chạy lại unit/UI/E2E trong lượt này vì code ứng dụng không đổi. Còn cảnh báo pg deprecation có sẵn.
- **Git/điểm dừng:** người dùng đã yêu cầu push bản sửa; kiểm tra đúng hai file và push thường lên nhánh hiện tại, không merge/deploy. Local đạt không đồng nghĩa CI mới đã xanh; chờ kết quả CI sau push.

## Ngày 01/11/2026 — Git M4.4.2: kiểm chứng trước push nhánh

- Người dùng yêu cầu commit/push bản M4.4.2 hiện tại lên `feat/m4.4.2-order-lookup`, gồm tra cứu mã đơn + SĐT và 4 bản sửa review. Không merge `main` hoặc deploy.
- Kiểm chứng mới trên cây chuẩn bị commit: `./tools/npm.ps1 run typecheck` và `./tools/npm.ps1 run build` đạt; đặt `VITEST_MAX_WORKERS=2` khi chạy `./tools/npm.ps1 test`, kết quả **10 tools + 69 backend + 389 frontend = 468 test** đạt (38 file frontend). Build còn cảnh báo chunk trên 500 kB.
- Xác nhận môi trường PostgreSQL local, `NODE_ENV=test` và DB hậu tố `_test` trước khi chạy 3 spec integration tạo/xem/tra cứu đơn bằng runner dùng DB riêng: **29/29** đạt, gồm bản sửa xác định bên thắng thật trong test tranh chiếc cuối của M4.3.1. Không chạy lại toàn bộ integration hoặc E2E trong lượt Git này; kết quả full ở mục triển khai bên dưới là bằng chứng lượt trước, không phải lần chạy mới.
- Đã rà diff, 27 file thay đổi/mới, ignore, remote và tác giả Git; không phát hiện mẫu credential hoặc dấu conflict trong các file chuẩn bị commit. Env thật, runtime, dependency và build artifact bị ignore; không có file tracked bị ignore. Dùng push thường lên nhánh feature, không force push.
- CI của commit mới và nghiệm thu của người dùng chưa có kết quả tại thời điểm chuẩn bị push.

## Ngày 01/11/2026 — M4.4.2: sửa lỗi parse integration trên CI

- **Phạm vi:** giữ nguyên kiểm thử nghiệp vụ hết hạn quote khi request chờ advisory lock; chỉ thay cấu trúc cleanup bị Vitest/OXC báo lỗi tại `finally`.
- **Thay đổi:** gom cleanup vào hàm `cleanup`, gọi từ nhánh `catch` rồi ném lại lỗi gốc, và gọi sau luồng thành công. Request đang chờ vẫn được đợi kết thúc trước khi đóng kết nối holder.
- **Kiểm tra:** `./tools/npm.ps1 run typecheck` và `./tools/npm.ps1 run build` đạt. Chạy riêng `order-creation.integration.spec.ts`: Vitest nạp/transform được file, không còn PARSE_ERROR; 12 test chưa chạy do sandbox chặn PostgreSQL test (`EACCES` tới localhost:5433). Lệnh toàn bộ integration cũng dừng vì cùng giới hạn kết nối DB. Build còn cảnh báo chunk frontend >500 kB.
- **Ghi chú CI:** `.env.test not found` trong log là cảnh báo; workflow cấp `DATABASE_URL` bằng env và cấu hình này không làm lệnh thất bại. Hai khối log người dùng gửi đều chỉ cùng lỗi `finally`.
- **Git/điểm dừng:** commit lên `feat/m4.4.2-order-lookup` theo yêu cầu; chưa push. Cần xem CI mới để xác nhận runner xanh; agent chưa xác nhận test PostgreSQL local.
## Ngày 01/11/2026 — M4.4.2 (bản sửa sau review): khóa submit, chặn cache chưa xác thực, bỏ kết quả sau unmount, ràng buộc response

**Phạm vi được duyệt:** người dùng duyệt sửa 4 lỗi review M4.4.2 trong chat — (1) khóa gửi lặp đồng bộ trong OrderLookupPage; (2) chặn hiện snapshot cache trước khi lượt GET xác thực của lần mở hiện tại thành công (không dùng GC làm kiểm quyền); (3) bỏ qua kết quả lookup trả về sau khi khách rời trang; (4) đối chiếu mã đơn response với request (trim+uppercase một lần ở API layer) và encode segment mã khi tạo URL. **Agent đã kiểm tra local; chờ người dùng chạy thử, chưa nghiệm thu.**

### RED đã quan sát trên bản pre-fix

Lượt chạy đầu trên code chưa sửa (test viết trước): **7 test fail** phủ đủ 4 lỗi — api `binds the answer…`, detail `never flashes the cached snapshot on an immediate same-tick remount…`, và 5 test trang lookup (double-submit, drag-back, foreign code, encode, lowercase). Hai test sau đó được hiệu chỉnh cách viết (double-submit: flush microtask trước khi release vì TanStack gọi mutationFn ở microtask sau `mutate`; lowercase: mock trả đúng mã đã chuẩn hóa) — assertion bắt lỗi giữ nguyên (2 POST thay vì 1; body gửi mã chưa chuẩn hóa).

### File đã đổi

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/orders/pages/OrderLookupPage.tsx` (sửa) | Khóa đồng bộ `submittingRef` đặt ngay trước `mutate`, nhả trong `onSettled` (kể cả lỗi); `mountedRef` chặn navigate khi khách đã rời trang; `encodeURIComponent(result.view.order.code)` khi tạo link; phối hợp với `isPending` không mâu thuẫn |
| `apps/frontend/src/features/orders/api/orders.api.ts` (sửa) | `parseOrderLookupResult(value, expectedCode)`: answer phải echo đúng mã (kể cả mã chưa trim) → không khớp là `INVALID_RESPONSE`; `ordersApi.lookup` chuẩn hóa mã trim+uppercase một lần (cùng rule DTO backend), SĐT passessthrough cho server chuẩn hóa |
| `apps/frontend/src/features/orders/pages/OrderDetailPage.tsx` (sửa) | Gate `verifiedHash`: chỉ render snapshot khi một GET thành công cho hash SHA-256 token hiện tại của lần mở này hoàn tất (đặt trong queryFn, kiểm `currentHashRef` khi response về muộn, `useLayoutEffect` xóa trước khi paint khi đổi token); giữ `staleTime: 0` + `gcTime: 0` nhưng GC/cache không còn là cơ chế kiểm quyền |
| `apps/frontend/src/features/orders/api/orders.api.test.ts` (sửa) | `parseOrderLookupResult` nhận expectedCode; +1 test ràng buộc (mã khác, mã chứa `?x=1`, echo chưa trim) |
| `apps/frontend/src/features/orders/pages/OrderLookupPage.test.tsx` (sửa) | Thay test double-click bằng hai `fireEvent.submit` cùng nhịp (+đếm POST trước và sau khi resolve); +4 test: rời trang khi pending không bị kéo lại, response mã khác giữ form, mã `A?X=1` encode thành `%3F` không thành query, mã lowercase gửi body chuẩn hóa |
| `apps/frontend/src/features/orders/pages/OrderDetailPage.test.tsx` (sửa) | +1 test remount ngay trong cùng tick KHÔNG chờ GC, GET mới pending rồi 404: không hiện snapshot dù thoáng qua |
| `apps/backend/test/order-creation.integration.spec.ts` (sửa — ngoài 4 lỗi, phục hồi kiểm tra bắt buộc) | Test "hai khách tranh chiếc cuối" giỏ định promise allSettled đầu tiên là bên thắng; thực tế ai thắng khóa hàng là ngẫu nhiên — khi request đầu là bên thua 409, `winnerCode` undefined làm count đếm toàn bộ đơn (fail 2 lần liên tiếp, backend không đổi). Sửa: xác định bên thắng từ response 201 thực tế. Không bỏ test, không nới timeout, không đụng nghiệp vụ |

### Data flow / key

- **`submittingRef` + `onSettled`** (`OrderLookupPage.tsx`): hai submit cùng tick đều qua handler nhưng chỉ lần đầu gửi — khóa là đồng bộ, không phụ thuộc rerender.
- **`mountedRef`** (`OrderLookupPage.tsx`): onSuccess kiểm tra trước `navigate` — response cũ không kéo người dùng về trang đơn, không ghi đè thao tác mới (lần mount mới có ref riêng).
- **`verifiedHash` + `currentHashRef`** (`OrderDetailPage.tsx`): "đã xác thực cho quyền hiện tại" là điều kiện render; response muộn của hash cũ không gỡ trạng thái đã xác thực của hash mới, đổi token xóa gate trước khi paint nên không flash.
- **Binding mã trong `parseOrderLookupResult`** (`orders.api.ts`): response không khớp request → `INVALID_RESPONSE`, form giữ nguyên; URL luôn `encodeURIComponent` nên mã chứa `?/#` không biến thành query.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| Test đích FE (orders + checkout + layouts) | **72/72** (389 test FE toàn bộ trong vòng `test`) |
| `./tools/npm.ps1 run typecheck` | 0 lỗi |
| `./tools/npm.ps1 run build` | đạt (432ms) |
| `./tools/npm.ps1 test` (VITEST_MAX_WORKERS=2) | **10 tools + 69 backend + 389 frontend = 468 test** đạt |
| `./tools/npm.ps1 run test:integration` | **114/114 (14 file)**; hai lượt trước fail 1 test tranh-giỏ do lỗi có sẵn của test M4.3.1 (nêu trên), 3 lần chạy riêng spec order-creation đạt liên tiếp sau khi sửa, vòng full đạt 114/114 |
| `./tools/npm.ps1 run test:e2e:implemented` | **50/50** (3.5 phút) |
| CI GitHub | Chưa chạy (chưa commit/push) |

### Giới hạn / còn lại

- Sửa test order-creation là sửa hạ tầng test của M4.3.1 ngoài 4 lỗi review — nêu rõ để review; nghiệp vụ đặt đơn không đổi.
- RED của hai test đã hiệu chỉnh được suy từ assertion giữ nguyên + RED lượt đầu của chính test đó (chưa chạy lại RED sau hiệu chỉnh trên bản pre-fix vì bản pre-fix chưa commit); các test còn lại RED thực tế trên bản pre-fix.
- Chưa có M4.4.3/M4.4.4, chưa chạy CI. Không commit/push/merge/deploy.

## Ngày 01/11/2026 — M4.4.2: tra cứu đơn bằng mã đơn + số điện thoại

**Phạm vi được duyệt:** người dùng duyệt kế hoạch M4.4.2 trong chat — POST `/orders/lookup` (code+phone, CSRF, 5/phút/IP, 404 đồng nhất, token mới thay hash cũ trong một transaction), trang `/orders/lookup` + link ở menu/footer/màn xác nhận, trang xem đơn luôn xác thực server trước khi hiện cache. Nhánh `feat/m4.4.2-order-lookup` từ 648ac99. **Agent đã kiểm tra local; chờ người dùng chạy thử, chưa nghiệm thu.**

### File đã đổi

| File | Thay đổi và lý do |
|---|---|
| `apps/backend/src/modules/orders/dto/order-lookup.dto.ts` (mới) | DTO `OrderLookupDto`: mã trim/uppercase, chặn shape bằng `INVALID_CODE_SHAPE` dùng lại từ access service (không rule thứ hai) → 400 trước khi tới PostgreSQL; SĐT chuẩn hóa qua `normalizeVietnamesePhone` hiện có |
| `apps/backend/src/modules/orders/order-lookup.service.ts` (mới) | `OrderLookupService.lookup`: một transaction — đọc phone kiểm tra (sai → 404 đồng nhất, không đổi hash), UPDATE `lookupTokenHash` (khóa hàng, hai lookup đồng thời chỉ còn token thay hash cuối), rồi đọc snapshot qua `OrderAccessService.snapshot` |
| `apps/backend/src/modules/orders/order-access.service.ts` (sửa) | Tách select/projection dùng chung (`ORDER_DETAIL_SELECT`, `projectOrderDetail`), thêm `snapshot(code, tx)` cho transaction lookup; export `INVALID_CODE_SHAPE`; hành vi `view` không đổi |
| `apps/backend/src/modules/orders/orders.controller.ts` (sửa) | Route `POST /orders/lookup` với `@Throttle({ ip: 5/phút })`, HttpCode 200, qua CSRF guard toàn cục có sẵn |
| `apps/backend/src/modules/orders/orders.module.ts` (sửa) | Đăng ký `OrderLookupService` |
| `apps/backend/test/order-lookup.integration.spec.ts` (mới) | 10 test PostgreSQL thật: 0…/+84…, 404 đồng nhất không lộ PII, không liệt kê đơn cùng SĐT, 400 validation, CSRF, rate limit thật, thất bại không đổi hash, một token còn hiệu lực khi hai lookup đua, không đổi kho/tiền/trạng thái/history/idempotency, token rõ không vào DB |
| `apps/frontend/src/features/orders/api/orders.api.ts` (sửa) | `parseOrderLookupResult` (parse view + kiểm tra token 32 ký tự base64url, payload lệch → `INVALID_RESPONSE` "Chưa đọc được kết quả tra cứu") và `ordersApi.lookup` |
| `apps/frontend/src/features/orders/api/orders.api.test.ts` (sửa) | +3 test parser lookup: nhận đúng, chặn token thiếu/sai, payload lệch không điều hướng |
| `apps/frontend/src/features/orders/pages/OrderLookupPage.tsx` (mới) | Form Mã đơn + SĐT chỉ ở memory; useMutation không retry; lỗi 400 theo field, 404/429/mạng giữ form; thành công chuyển `/orders/:code#t=<token mới>`; chặn gửi lặp khi pending |
| `apps/frontend/src/features/orders/pages/OrderLookupPage.test.tsx` (mới) | 8 test: một POST đúng body + fragment không query, form rỗng tự chặn, 404 giữ form không tự retry, fieldErrors theo ô, 429, mất mạng chỉ tra cứu lại khi khách bấm, payload malformed, double-click một request |
| `apps/frontend/src/features/orders/pages/OrderDetailPage.tsx` (sửa) | Query xem đơn đặt `staleTime: 0` + `gcTime: 0`: cache vẫn tách theo SHA-256 token nhưng không entry sống qua unmount — mở lại/link cũ đã bị thay token luôn chờ GET xác thực trước khi hiện (staleTime 0 một mình chưa đủ vì cache vẫn render khi refetch) |
| `apps/frontend/src/features/orders/pages/OrderDetailPage.test.tsx` (sửa) | +2 test: mở lại cùng token vẫn hỏi server trước khi hiện; link đã bị thay token bị 404 khi mở lại, không hiện dữ liệu cache |
| `apps/frontend/src/features/checkout/components/OrderConfirmation.tsx` (sửa) | Thêm link "Tra cứu bằng mã đơn và số điện thoại" → `/orders/lookup`, hiện cả khi replay không trả token |
| `apps/frontend/src/features/checkout/pages/CheckoutPage.test.tsx` (sửa) | +2 assertion: link tra cứu hiện ở cả màn có token và replay không token |
| `apps/frontend/src/layouts/store/storeLinks.ts` (sửa) | "Tra cứu đơn" vào `supportLinks` dùng chung footer + menu mobile |
| `apps/frontend/src/layouts/StoreLayout.test.tsx` (sửa) | +2 assertion: footer và menu mobile có link `/orders/lookup` |
| `apps/frontend/src/app/App.tsx` (sửa) | Route `orders/lookup` (đứng trước `orders/:code` theo ranking segment tĩnh) |
| `apps/frontend/e2e/order-lookup.spec.ts` (mới) | E2E: form thật → sai SĐT/sai mã 404 đồng nhất giữ form → đúng mã+SĐT vào link mới (token trong fragment, không `?`) → refresh còn → link cũ chết trong cùng phiên và cửa sổ mới, link mới vẫn mở → mobile 390px không tràn; 4 POST lookup nằm dưới giới hạn 5/phút/IP |
| `package.json` (sửa) | Thêm `order-lookup.spec.ts` vào `test:e2e:implemented` |
| `docs/m4-contract.md`, `docs/architecture.md`, `docs/m4-implementation-plan.md`, `docs/local-trial-m4.md`, `docs/plan.md`, `README.md` | Đồng bộ trạng thái M4.4.2 (hàng "Tra cứu", §8 phát hành token, API table, rate limit, FE lookup + cache, hướng dẫn chạy thử, điểm dừng). README: gỡ một dòng `=======` và một đoạn "**Chưa mở bán**" trùng/lệch thời điểm sót từ merge cũ trong HEAD (lỗi có sẵn trước khi làm M4.4.2) |

### Data flow / key

- **`OrderLookupService.lookup`** (`order-lookup.service.ts`): mã+SĐT → transaction đọc phone so với SĐT chuẩn hóa → sai: 404 đồng nhất không đụng hash; đúng: UPDATE `lookupTokenHash` = SHA-256(token 192-bit mới) rồi `OrderAccessService.snapshot` đọc allowlist trong cùng transaction → trả `{order, timeline, lookupToken}`. UPDATE giữ khóa hàng nên hai lookup đồng thời chỉ còn token thay hash cuối.
- **`snapshot(code, tx)`** (`order-access.service.ts`): phép đọc/projection allowlist dùng chung của M4.4.1, gọi được trong transaction — lookup không sao chép select.
- **`parseOrderLookupResult`** (`orders.api.ts`): view phải qua parser M4.4.1, thêm kiểm tra token 32 ký tự base64url; payload lệch không bao giờ dẫn tới trang đơn.
- **`gcTime: 0`** (`OrderDetailPage.tsx`): xóa cache entry ngay khi không còn observer — mở lại link (hoặc link cũ sau khi lookup thay token) luôn GET mới trước khi render; `staleTime: 0` một mình không đủ vì TanStack vẫn render cache khi refetch nền.
- **`supportLinks`** (`storeLinks.ts`): một entry "Tra cứu đơn" phủ cả footer và menu mobile; màn xác nhận đặt hàng link riêng trong `OrderConfirmation`.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| `./tools/npm.ps1 run typecheck` | 0 lỗi |
| `./tools/npm.ps1 run build` | đạt (frontend 624ms; backend tsc đạt) |
| `./tools/npm.ps1 test` (VITEST_MAX_WORKERS=2) | **10 tools + 69 backend + 383 frontend = 462 test** đạt (38 file FE; +13 test mới so với M4.4.1) |
| `./tools/npm.ps1 run test:integration` | **114/114 (14 file)**; lượt đầu 113/114 — test nhạy thời gian `refuses with QUOTE_CHANGED… phone lock` (order-creation, 6+ giây chờ khóa SĐT) fail một lần, hai lượt chạy lại đều 114/114; không thuộc file M4.4.2 |
| `./tools/npm.ps1 run test:e2e:implemented` | **50/50** (49 cũ + 1 `order-lookup.spec.ts`), 3.5 phút |
| RED→GREEN | Integration lookup: RED "Cannot POST /api/v1/orders/lookup" trước khi code, 10/10 sau; FE parser+trang: RED trước khi triển khai, GREEN sau |
| CI GitHub | Chưa chạy (chưa commit/push) |

### Giới hạn / còn lại

- Hai lookup đồng thời: cả hai nhận 200 với token riêng, chỉ token thay hash cuối còn mở được đơn — không có cơ chế nào báo cho tab đang giữ link cũ; nội dung đã hiển thị trên tab khác không hứa thu hồi từ xa (đã ghi trong local-trial).
- Rate limit lookup trong E2E dùng chung IP trình duyệt với cả bộ spec; hiện chỉ `order-lookup.spec.ts` POST `/orders/lookup` (4 lượt) nên còn dư 1 lượt/phút — thêm spec tra cứu khác phải tính lại ngân sách này.
- Chưa có M4.4.3/M4.4.4 (hủy đơn), chưa chạy CI. Không commit/push/merge/deploy.

## Ngày 01/11/2026 — Git M4.4.1: kiểm chứng trước push nhánh

- Người dùng yêu cầu commit/push bản M4.4.1 hiện tại lên nhánh `feat/m4.4.1-order-access`, gồm xem đơn qua link riêng và các bản sửa sau review. Không merge vào `main` hoặc deploy.
- Kiểm chứng mới trên cây chuẩn bị commit: `./tools/npm.ps1 run typecheck` và `./tools/npm.ps1 run build` đạt; đặt `VITEST_MAX_WORKERS=2` khi chạy `./tools/npm.ps1 test`, kết quả **10 tools + 69 backend + 370 frontend = 449 test** đạt. Frontend có 37 file test; build còn cảnh báo chunk trên 500 kB.
- Đã rà diff, danh sách 23 file thay đổi/mới, remote và tác giả Git; không phát hiện mẫu credential hoặc dấu conflict trong các file chuẩn bị commit. Env thật, runtime, dependency và build artifact bị ignore; không có file đã tracked nhưng bị ignore.
- Không chạy lại integration/E2E trong lượt Git này. Kết quả của lượt sửa trước được giữ riêng ở mục bên dưới; không coi là lần chạy mới hoặc CI. Dùng push thường lên nhánh feature, không force push. CI của commit mới và nghiệm thu của người dùng chưa có kết quả tại thời điểm chuẩn bị push.

## Ngày 31/10/2026 — M4.4.1 (bản sửa sau review): token cache SHA-256, parser theo trường, mã đơn lệch dạng

**Phạm vi được duyệt:** kế hoạch sửa 3 lỗi review M4.4.1 gửi trong chat — (1) queryKey cache trang xem đơn dùng FNV 32-bit dễ va chạm → thay bằng SHA-256; (2) parser FE gộp một giới hạn 254 làm từ chối note hợp lệ ≤500 → giới hạn theo từng trường; (3) mã đơn chứa `%00`/ký tự điều khiển làm backend 500 → chặn shape trước khi query, trả 404 đồng nhất. Kèm kiểm tra bổ sung và hồi quy đầy đủ. **Agent đã kiểm tra local; chờ người dùng chạy thử, chưa nghiệm thu.**

### File đã đổi

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/orders/token-tag.ts` (mới) | SHA-256 thuần JS đồng bộ (FIPS 180-4): WebCrypto `subtle` không có sẵn trong jsdom/HTTP thường, bản đồng bộ bảo đảm đổi token luôn rekey trong cùng một lần render |
| `apps/frontend/src/features/orders/token-tag.test.ts` (mới) | Vector NIST chính thức + đối chiếu khác biệt với `node:crypto` qua các độ dài biên block và UTF-8 |
| `apps/frontend/src/features/orders/pages/OrderDetailPage.tsx` (sửa) | queryKey dùng `sha256Hex(token)` thay FNV — token rõ không vào key; dòng "Ghi chú" thêm `overflowWrap: 'anywhere'` (E2E bắt tràn ngang mobile 390px với note 500 ký tự liền) |
| `apps/frontend/src/features/orders/pages/OrderDetailPage.test.tsx` (sửa) | +2 test: response của token cũ về muộn không hiện lại dưới token mới; queryKey chứa hash không chứa token rõ và localStorage/sessionStorage không có token (giữ lại test cache-seal, per-token, FNV va chạm, note 500 có sẵn từ lượt sửa trước) |
| `apps/frontend/src/features/orders/api/orders.api.ts` (sửa) | `nullableText(value, max)` giới hạn theo trường: email 254, note 500, timeline reason 500 |
| `apps/frontend/src/features/orders/api/orders.api.test.ts` (sửa) | Quét biên note 254/255/500 đạt, 501 chặn; reason 500/501; email 254; null nhận |
| `apps/backend/src/modules/orders/order-access.service.ts` (sửa) | `INVALID_CODE_SHAPE` chặn mã rỗng/>24 ký tự/ký tự điều khiển (gồm NUL từ `%00`) trước khi tới Prisma → 404 đồng nhất |
| `apps/backend/test/order-access.integration.spec.ts` (sửa) | +2 test PostgreSQL thật: mã NUL/25 ký tự/xuống dòng → 404 đồng nhất (một test gộp 3 ca); note 500 ký tự đi qua allowlist nguyên vẹn |
| `apps/frontend/e2e/order-access.spec.ts` (sửa) | Gộp ca note 500 vào test mở link riêng (điền "Ghi chú" 500 ký tự ở form thật → mở trang → assert nguyên văn → refresh vẫn còn); tách helper `trackCreatedOrder`; `checkoutAndOrder` nhận note tùy chọn |

Lưu ý lịch sử: `accessFingerprint` FNV-1a nêu ở mục M4.4.1 bên dưới **đã bị thay** bởi `sha256Hex` — hai dòng mô tả FNV trong mục đó không còn đúng code hiện tại.

### Lý do gộp ca E2E note 500 (không làm test riêng)

Bộ E2E chạy chung một backend và một IP: POST /orders giới hạn 5/phút/IP. Thêm một test đặt đơn mới đẩy tổng POST thật của full run lên 5; một resend tự động (cơ chế chống mất response của màn đặt hàng) trở thành request thứ 6 và nhận 429 — xác nhận qua snapshot trang fail chứa "Thao tác quá nhanh. Vui lòng thử lại sau." làm test hết hàng của `order-creation.spec.ts` fail 2 vòng liên tiếp (pass riêng lẻ). Gộp ca note 500 vào test mở link trả tổng POST thật về 4 như trước, vẫn phủ đủ UI→API→DB→UI cho note 500.

### Data flow / key

- **`sha256Hex(token)`** (`token-tag.ts`, dùng tại queryKey `OrderDetailPage.tsx`): mỗi cache entry gắn đúng một quyền truy cập riêng tư; không gian key 2^256 thay vì 2^32 của FNV; token rõ chỉ nằm trong fragment và header `X-Order-Token`.
- **`nullableText`** (`orders.api.ts`): giới hạn parser theo schema từng trường (note/reason 500, email 254) — hết khớp 254 chung.
- **`INVALID_CODE_SHAPE`** (`order-access.service.ts`): mọi mã lệch dạng bị chặn trước query, trả 404 đồng nhất — không còn 500 cho `%00`.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| Unit orders (3 file frontend) | **21/21**, gồm 2 test mới; chạy lại đạt sau khi sửa `overflowWrap` |
| `./tools/npm.ps1 run typecheck` | 0 lỗi (chạy lại trên cây cuối) |
| `./tools/npm.ps1 run build` | đạt (1.35s, cảnh báo chunk >500 kB như cũ) |
| `./tools/npm.ps1 test` | một vòng đạt **37/37 file**; các vòng khác cùng ngày flake 1–4 test findBy dưới tải 37 worker (App redirect, Settings, Inventory, Products — từng file chạy riêng đạt; không thuộc file M4.4.1; cùng pattern flake đã ghi nhận từ các mốc trước) |
| `./tools/npm.ps1 run test:integration` | **104/104** (13 file; order-access tăng 5→7 test) |
| `./tools/npm.ps1 run test:e2e -- order-access.spec.ts` | **3/3** (gồm note 500 mở trang + refresh + mobile không tràn sau sửa) |
| `./tools/npm.ps1 run test:e2e:implemented` | **49/49** trên cây cuối; 2 vòng trước đó fail do 429 đụng giới hạn POST /orders (đã xử lý theo mục trên) và flake tải |
| CI GitHub | Chưa chạy (chưa commit/push) |

### Giới hạn / còn lại

- Biên dư throttle E2E mỏng: full run có 4 POST /orders thật + dự phòng resend, sát giới hạn 5/phút/IP — nếu thêm spec đặt đơn phải tính chung ngân sách này.
- Đã sửa thêm một lỗi UI thật ngoài danh sách 3 lỗi review nhưng nằm trong ca kiểm chứng được giao: dòng "Ghi chú" tràn ngang mobile với chuỗi 500 ký tự liền (`overflowWrap`).
- Chưa có M4.4.2/M4.4.3/M4.4.4, chưa chạy CI. Không commit/push/merge/deploy.

**Dừng sau bản sửa M4.4.1 để người dùng chạy thử. Không làm M4.4.2.**

## Ngày 31/10/2026 — M4.4.1: xem chi tiết đơn qua link riêng

**Phạm vi được duyệt:** kế hoạch M4.4.1 gửi trong chat — khách COD mở/refresh link riêng `/orders/:code#t=<token>` không cần đăng nhập; GET `/orders/:code` + token **chỉ** ở header `X-Order-Token`, 404 đồng nhất mọi sai hụt, rate 30/phút/IP, response chỉ trả trường cho phép (allowlist) từ snapshot đơn, đọc không ghi; FE trang xem đơn + nút "Xem đơn hàng"/"Sao chép link riêng" trên màn xác nhận khi có token; chỉ luồng đọc. **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử, chưa nghiệm thu.**

### File đã đổi

| File | Thay đổi và lý do |
|---|---|
| `apps/backend/src/modules/orders/order-access.service.ts` (mới) | `view(code, token)`: so khớp SHA-256 token rồi đọc order theo allowlist (items/timeline/tổng tiền/người nhận từ snapshot, timeline xếp `version asc`, label vai `Cửa hàng`/`Khách đặt hàng`/`Hệ thống`, không tên nhân viên); mỗi sai hụt đều ném 404 đồng nhất `ORDER_ACCESS_NOT_FOUND` |
| `apps/backend/src/modules/orders/order-access.guard.ts` (mới) | Guard chỉ kiểm envelope token `/^[A-Za-z0-9_-]{32}$/`, đặt `request.orderToken`; token thiếu/sai dạng → 404 đồng nhất; phần đối chiếu hash thuộc service |
| `apps/backend/src/modules/orders/orders.controller.ts` (sửa) | Thêm `GET :code` với `@Throttle` ip 30/phút và `OrderAccessGuard`; không đổi POST create |
| `apps/backend/src/modules/orders/orders.module.ts` (sửa) | Đăng ký OrderAccessGuard + OrderAccessService |
| `apps/backend/test/order-access.integration.spec.ts` (mới) | 5 ca PostgreSQL thật: allowlist + `Cache-Control: no-store`, đọc không ghi, 404 đồng nhất×5, snapshot đứng vững sau khi đổi giá/trạng thái sản phẩm, 429 theo IP |
| `apps/frontend/src/features/orders/api/orders.api.ts` (mới) | Contract + `parseOrderDetailView` kiểm tra runtime chặt (trả `ApiError('INVALID_RESPONSE')` khi payload lộp); `ordersApi.view` gửi token qua `orderToken` |
| `apps/frontend/src/features/orders/pages/OrderDetailPage.tsx` (mới) | Đọc fragment `#t=` (giữ nguyên trong URL để refresh sống), kiểm tra dạng token, `useQuery` cache tách theo dấu vân FNV phi-hồi (không token trong queryKey), không retry 404/429, đủ loading/error/rỗng, cột mobile không tràn — *dấu vân FNV đã được thay bằng SHA-256 ở bản sửa review, xem mục trên* |
| `apps/frontend/src/features/orders/pages/OrderDetailPage.test.tsx` (mới) + `api/orders.api.test.ts` (mới) | Unit page + parser: fragment sống qua reload, không request khi thiếu token, message đồng nhất, token chỉ ở header; parser chặn status lạ/timeline lệch/số sai |
| `apps/frontend/src/shared/api/client.ts` (sửa) | `RequestOptions.orderToken` → gửi header `X-Order-Token` đúng một nơi dùng chung |
| `apps/frontend/src/features/checkout/components/OrderConfirmation.tsx` (sửa) | Thêm "Xem đơn hàng" (link) + "Sao chép link riêng" chỉ khi response có `lookupToken`; replay không token không hiện link giả |
| `apps/frontend/src/features/checkout/pages/CheckoutPage.test.tsx` (sửa) | +2 test: link hiện đúng `href=…#t=` khi có token; replay không token không có link/nút sao chép riêng |
| `apps/frontend/src/app/App.tsx` (sửa) | Route công khai `orders/:code` |
| `apps/frontend/e2e/order-access.spec.ts` (mới) | 3 E2E thật: token từ response → link mở trang riêng, sống qua refresh, không query/token trong URL, token ở header, không vào storage, mobile 390px không tràn; token sai/sai dạng/thiếu/token khác → 404 đồng nhất có control dương mở đúng bằng token chính chủ; replay không token không dựng link |
| `package.json` (sửa) | Thêm `order-access.spec.ts` vào `test:e2e:implemented` |
| `docs/m4-contract.md`, `docs/architecture.md`, `docs/m4-implementation-plan.md`, `docs/local-trial-m4.md` | Chốt response/token/rate-limit, cơ chế fragment + cache trang xem đơn, trạng thái M4.4.1, hướng dẫn chạy thử |

Sửa kèm trong phạm vi kiểm chứng: `apps/frontend/src/features/orders/pages/OrderDetailPage.test.tsx`, `api/orders.api.test.ts` — 2 lỗi kiểu (nullable email/note; mock thiếu kiểu `RequestOptions`) sau khi `typecheck` bắt, không đổi assertion gì.

### Data flow / key

Mở `/orders/<code>#t=<token>` → `OrderDetailPage` đọc fragment, kiểm dạng → `ordersApi.view(code, token)` → `client.ts` đặt header `X-Order-Token` → backend `OrderAccessGuard` kiểm envelope → `OrderAccessService.view` so SHA-256 rồi đọc snapshot theo allowlist → 200 view hoặc 404/429 → trang render snapshot + timeline; cache tách theo token nên data đơn này không lẫn vào truy vấn của token khác.

- **`X-Order-Token` + envelope 32 ký tự** (`order-access.guard.ts`): đường token duy nhất qua HTTP — fragment UI, header server; không tạo cơ chế token thứ hai.
- **`ORDER_ACCESS_NOT_FOUND`** (`order-access.service.ts`): một thông báo 404 cho mọi sai hụt; guard và service cùng import hằng số này.
- **`accessFingerprint` (FNV-1a → base36)** (`OrderDetailPage.tsx`): tách query cache theo token mà không đưa token vào key. *(Đã thay bằng `sha256Hex` ở bản sửa review — xem mục trên.)*
- **Response `OrderDetailResult` allowlist** (`order-access.service.ts`/`orders.api.ts`): snapshot từ `orders`, không join sản phẩm/settings hiện tại; `no-store` toàn cục giữ nguyên.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| Integration RED→GREEN | `order-access.integration.spec.ts` **5/5** (RED trước khi có endpoint/guard: 404 thông báo mặc định ≠ thông báo đồng nhất) |
| Unit frontend RED→GREEN | 4 file `client.test.ts` + `orders.api.test.ts` + `OrderDetailPage.test.tsx` + `CheckoutPage.test.tsx` chạy đích **38/38** |
| `./tools/npm.ps1 run typecheck` | các vòng fix: nullable email/note, `RequestOptions` của mock — cuối **0 lỗi** |
| `./tools/npm.ps1 run build` | đạt (`LASTEXITCODE=0`); còn cảnh báo chunk >500 kB như cũ |
| `./tools/npm.ps1 test` | tools 10/10 + backend 69/69; frontend lượt chạy root có 5 timeout flake (App/Settings/Inventory/ProductEdit) ở tải máy — 4 file lỗi chạy riêng đạt 69/69 và full frontend chạy lại đạt **362/362** (pattern flake đã ghi nhận sẵn) |
| `./tools/npm.ps1 run test:integration` | **102/102** (13 file) |
| `./tools/npm.ps1 run test:e2e:implemented` | **49/49** (17 file, gồm 3 test M4.4.1 mới); 1 vòng trước đó fail do regex tìm "Chưa thu tiền" viết hoa khác trang (sửa thành `/chưa thu tiền/i`) và 1 lỗi cú pháp `as` xuống dòng Playwright không parse (đã sửa) |
| CI GitHub | Chưa chạy (chưa commit/push) |

### Giới hạn

- Rate limit 30/phút/IP dùng Throttler in-memory: restart làm reset bộ đếm — đúng cơ chế hiện hành, không đo đếm chéo qua hai process.
- Đơn fixture E2E tạm thời dùng mã `ACCFIXTURE3X` (chứa chữ I ngoài bảng mã đơn server cấp) để khẳng định lookup không phụ thuộc bảng sinh mã; token điều khiển được là token fixture, không phải token thật của khách.
- Chưa có luồng phục hồi khi mất link/token (M4.4.2), chưa có hủy (M4.4.3/M4.4.4) và chưa có màn hình admin đơn (M4.5); chưa chạy CI.

**Dừng để người dùng chạy thử theo [docs/local-trial-m4.md §M4.4.1](docs/local-trial-m4.md). Không commit/push/merge/deploy.**

## Ngày 31/10/2026 — M4.3.1: ổn định test hết hạn trong lúc chờ khóa

- **Phạm vi đã duyệt:** sửa test CI nhận `201` thay vì `409`, commit và push lại `feat/m4.3.1-cod-checkout`. Làm trong worktree riêng từ `46f239e`; giữ nguyên M4.4.1 đang làm dở ở checkout chính.
- **Nguyên nhân:** test gửi request trước khi holder lấy advisory lock; request có thể tạo đơn hợp lệ trước lúc quote hết hạn. Chờ cố định 6 giây không bảo đảm request đã bị khóa.
- **File sửa:** `apps/backend/test/order-creation.integration.spec.ts` lấy session lock bằng kết nối `pg.Client` trước khi gửi HTTP, chờ `pg_blocking_pids` xác nhận request đang bị chặn, đặt hạn quote theo `clock_timestamp()` của PostgreSQL rồi nhả khóa. Kiểm tra `409 QUOTE_CHANGED`, không có đơn, reservation, movement hoặc idempotency record; `finally` đóng holder và đợi request kết thúc cả khi assertion thất bại. `progress.md` ghi bằng chứng và điểm dừng.
- **Kiểm chứng regression:** tạm đổi `clock_timestamp()` thành `now()` trong build ignored, test mới thất bại đúng `expected 201 to be 409`; đã khôi phục build và chạy test này đạt **5/5 lượt độc lập**, mỗi lượt có database `_test` riêng.
- **Kiểm tra toàn bộ:** typecheck và build đạt; `npm test` với `VITEST_MAX_WORKERS=2` đạt **10 tools + 69 backend + 345 frontend = 424 test**. Integration chạy qua npm đạt **97/97, 12 file** trên database `_test` mới của lượt này, đã cleanup. Lượt chạy Vitest trực tiếp trước đó có 1 lỗi ở test CLI import do thiếu `npm_execpath`; chạy lại đúng npm đã đạt, không sửa test CLI. Build còn cảnh báo chunk trên 500 kB; integration còn cảnh báo pg đã có sẵn.
- **Review/phạm vi:** review độc lập không phát hiện vấn đề cần sửa. Không đổi service production, timeout, dependency, schema, nghiệp vụ quote hay luồng chờ inventory; README còn dấu conflict đã được ghi ở mục trước, ngoài phạm vi lần sửa này. Không sửa file M4.4.1 ở checkout chính.
- **Điểm dừng:** người dùng đã yêu cầu push bản sửa lên nhánh M4.3.1; chưa có kết quả CI mới, không merge/deploy. Không chạy lại E2E vì chỉ thay test integration và tài liệu. Người dùng có thể chạy `npm run test:integration` với môi trường `_test` theo README.

## Ngày 31/10/2026 — M4.3.1: sửa EJSONPARSE sau merge main

- **Nguyên nhân:** commit merge `2a7c07a` để sót dòng `=======` và hai khóa `test:e2e:implemented` trong `package.json`. Đã tái hiện đúng lỗi `JSON.parse` ở dòng 23 trước sửa.
- **Thay đổi:** gộp thành một script E2E gồm đủ `order-creation.spec.ts` và `share-preview.spec.ts`, không đổi dependency/lockfile. Bỏ dấu conflict trong `progress.md`, giữ nội dung tiến độ của cả hai bên. Local đã fast-forward tới commit merge trước khi sửa.
- **Kiểm chứng:** parse được cả bốn manifest/lockfile; script E2E chỉ có một khóa, danh sách là hợp của hai parent và đủ 16 spec tồn tại; cấu hình dependency không đổi. `./tools/npm.ps1 ci --dry-run --ignore-scripts --no-fund` đạt (exit 0); `git diff --check` đạt. Đây là kiểm tra cài đặt thử, không chạy lại unit/integration/E2E và chưa có kết quả CI mới.
- **Giới hạn:** rà toàn bộ file tracked còn thấy `README.md:12` có dấu conflict và hai đoạn trạng thái trùng nhau; chưa sửa vì kế hoạch được duyệt chỉ gồm `package.json` và `progress.md`.
- **Điểm dừng:** người dùng đã yêu cầu commit/push bản sửa lên `feat/m4.3.1-cod-checkout`; không merge/deploy. Chờ kết quả CI mới và người dùng kiểm tra.

## Ngày 31/10/2026 — Git M4.3.1: kiểm chứng trước push nhánh

- Người dùng yêu cầu đưa bản hiện tại lên nhánh `feat/m4.3.1-cod-checkout`; phạm vi gồm đặt đơn COD khách và các bản sửa review. Không merge vào `main` hoặc deploy.
- Kiểm tra lại bản chuẩn bị commit: `./tools/npm.ps1 run typecheck` và `./tools/npm.ps1 run build` đạt; `VITEST_MAX_WORKERS=2` cùng `./tools/npm.ps1 test` đạt **10 tools + 69 backend + 345 frontend = 424 test**. Ba test UI thất bại ở lượt review trước đã đạt trong lượt chạy mới. Build còn cảnh báo chunk trên 500 kB.
- Đã rà diff, remote, tác giả, danh sách file và ignore: không đưa env thật, runtime, dependency, mailbox hoặc artifact build vào commit. Dùng push thường lên nhánh feature, không force push.
- Không chạy lại integration/E2E trong lượt Git này; kết quả của lượt triển khai được ghi riêng phía dưới. CI của commit mới và nghiệm thu của người dùng chưa có kết quả tại thời điểm chuẩn bị push.

## Ngày 31/10/2026 — M4.3.1: sửa 7 lỗi sau review

**Phạm vi được duyệt:** người dùng duyệt sửa 7 lỗi review trên nhánh `feat/m4.3.1-cod-checkout` (không đổi nghiệp vụ/dependency/schema; giữ nguyên thay đổi có sẵn; không commit/push). **Đã sửa đủ 7/7, agent đã kiểm tra local; chờ người dùng review/chạy thử, chưa nghiệm thu.**

### Từng lỗi và cách sửa

| # | Lỗi | Sửa | File |
|---|---|---|---|
| 1 | P1 — `SELECT now()` trả thời điểm bắt đầu transaction: quote hết hạn trong lúc chờ advisory/inventory lock vẫn tạo đơn | Đổi `clock_timestamp()` cho cả lượt kiểm chính và **re-check sau reserve** (hết hạn lúc đó → QUOTE_CHANGED, rollback toàn bộ gồm reserve); replay vẫn được nhận trước mọi re-check nên đơn đã commit vẫn replay được dù quote hết hạn | `order-creation.service.ts` |
| 2 | P1 — Giá/phí ghép từ hai thời điểm (RC đọc rời rạc) | Khóa `shop_settings FOR SHARE` + `variants FOR UPDATE` (theo variantId tăng dần, khớp thứ tự khóa của reserve) trước khi đọc — admin đổi phí/giá phải chờ order commit; retry hữu hạn 40001/P2034 giữ nguyên | `order-creation.service.ts` |
| 3 | P2 — Thiếu/null/sai kiểu contact/address → 500 | `@IsDefined()` + `@ValidateNested()` trên cả hai object → 400 VALIDATION_ERROR với fieldErrors trước khi vào canonicalizer | `dto/create-order.dto.ts` |
| 4 | P1 — Unknown mất nút Gửi lại (UI retry nằm trong gate quoteAccepted) | Unknown block tách thành early-return độc lập trên CheckoutPage: vượt quote hết hạn, giỏ rỗng/đổi, route change; trong unknown ẩn nút Lấy báo giá/Cập nhật (không tạo quote mới); test harness chuyển provider lên trên Routes đúng như App thật | `pages/CheckoutPage.tsx`, `pages/CheckoutPage.test.tsx` |
| 5 | P1 — Retry gặp 429 bị coi là thất bại chắc chắn | `run` nhận cờ `isRetry`: 429 RATE_LIMITED trong retry giữ unknown + command cũ (lần đầu có thể đã commit); 429 lần đầu vẫn failed; các lỗi nghiệp vụ xác định khác không đổi | `OrderSubmissionProvider.tsx` |
| 6 | P2 — Tiếp tục mua sắm giữ kết quả cũ + ref page reset có thể xóa giỏ mới | `dismiss()` chặn pending/unknown; `markCartHandled()` ghi nhận dọn giỏ once-per-command trong provider state (thay ref page); cả hai nút confirmation gọi `onContinue` kết thúc intent | `OrderSubmissionProvider.tsx`, `components/OrderConfirmation.tsx`, `pages/CheckoutPage.tsx` |
| 7 | P2 — Parser thiếu kiểm tra tiền/số lượng/khớp command | `parseOrderConfirmation`: quantity 1..99, variantId không trùng, đơn giá ≤100tr, không âm, lineTotal = đơn giá × SL, subtotal = tổng lineTotal, total = subtotal + phí ≤1 tỷ, **items khớp command gửi lên**; lệch → INVALID_RESPONSE giữ unknown/key cũ | `api/orders.api.ts`, `api/orders.api.test.ts` (mới, 4 test) |

### File đã đổi trong phiên sửa này

Backend: `order-creation.service.ts`, `dto/create-order.dto.ts`, `order-creation.service.spec.ts` (+3 test), `test/order-creation.integration.spec.ts` (+2 test). Frontend: `api/orders.api.ts`, `api/orders.api.test.ts` (mới), `OrderSubmissionProvider.tsx`, `hooks/useCreateOrder.ts` (cartMatchesQuote nhận danh sách dòng chung), `components/ContactAddressForm.tsx` (submit button trong form, bỏ form attribute ngoài), `components/OrderConfirmation.tsx`, `pages/CheckoutPage.tsx`, `pages/CheckoutPage.test.tsx` (harness provider-above-routes + 4 test mới + dọn probe debug).

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| Unit orders RED→GREEN | 2 test mới RED (clock_timestamp/FOR UPDATE chưa có; re-check sau reserve chưa có) → **24/24** |
| Integration RED→GREEN | 2 test mới RED (expiry-during-lock-wait trả 500 vì transaction timeout 5s; missing contact/address trả 500) → sửa `timeout: 15000, maxWait: 5000` cho `$transaction` của create + IsDefined → **12/12**; full suite **93/93** |
| Parser unit (mới) | **4/4**: khớp command, trùng variant, qty 100, phí âm, tổng sai, dòng lệch command |
| UI checkout | **16/16** sau khi sửa assertion theo thiết kế mới (unknown thay form; harness provider-above-routes; test thêm-giỏ-mới tái dùng A/B) |
| `typecheck` | các vòng fix TS (Prisma.join import, exactOptionalPropertyTypes, Throttle import, arg typing) → cuối **0 lỗi** |
| `build` | đạt |
| `test` (root) | backend 69/69; frontend **345/345** (lượt trước 1 timeout flake App.test — pass riêng) |
| `test:integration` | **93/93** (11 file); 1 lượt settings.integration flake giữa các full-run, pass 14/14 khi chạy riêng và full-run sau đạt |
| `test:e2e:implemented` | **44/44** |
| CI GitHub | Chưa chạy (chưa commit/push) |

### Giới hạn

- expiry-during-lock-wait test dùng holder transaction giữ advisory lock 6s — nếu máy chậm hơn 15s timeout của create, test có thể flake; chưa thấy trong các lượt chạy hiện có.
- Scenario trộn phí/giá trong review (đ phí40k rồi giá về200k) được chặn bằng khóa FOR SHARE/FOR UPDATE — không tái hiện được deterministic qua HTTP nên kiểm chứng bằng unit assert các lock statement + cơ chế khóa DB.
- 429 lần đầu vẫn failed (throttler chặn trước controller → chắc chắn không commit); chỉ 429 trong retry mới giữ unknown — đúng ngữ cảnh theo review.

**Dừng để người dùng review/chạy thử. Không commit/push/merge/deploy.**


## Ngày 31/10/2026 — M4.3.1: đặt đơn COD không cần tài khoản

**Phạm vi được duyệt:** kế hoạch M4.3.1 gửi trong chat (POST `/orders` guest + Idempotency-Key + quote re-check + giữ kho + token tra cứu lưu hash; FE form nhận hàng, mất-response "Gửi lại", màn xác nhận; không BANK/payment/tra cứu/email). **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử, chưa nghiệm thu.**

### Phân biệt phần có sẵn và phần mới

- **M4.2.2 có sẵn (đã merge main `899b52c`):** CheckoutService/quote, OrdersModule khung, `features/checkout` (api quote, hook, QuoteSummary, CheckoutPage). TTL quote hiện hành **15 phút** (đã chỉnh sau review M4.2.2, không phải 30).
- **M4.3.1 mới trong lượt này:** các file dưới đây.

| File | Thay đổi và lý do |
|---|---|
| `apps/backend/src/modules/orders/order-command.ts` (mới) | `normalizeVietnamesePhone` (một chuẩn hóa duy nhất 0/+84 cho DTO/hash/quota), `canonicalizeOrderCommand` + hash SHA-256, `generateOrderCode` 12 ký tự bảng chữ không nhập nhằng, `generateLookupToken` 192-bit base64url + `lookupTokenHash` |
| `apps/backend/src/modules/orders/dto/create-order.dto.ts` (mới) | DTO create: quoteId/items/contact/address/note, whitelist chặn giá/tổng/status/userId client gửi; SĐT chuẩn hóa ngay ở DTO; BANK bị từ chối |
| `apps/backend/src/modules/orders/order-creation.service.ts` (mới) | Transaction điều phối: advisory lock theo SĐT (câu lệnh đầu để snapshot không stale) → replay trước mọi re-check → quote còn hạn/COD/khớp giỏ → re-verify giá/phí/settings/tồn → quota 3 PENDING/SĐT → tạo Order+items+history (GUEST, actorId null) → `InventoryOperationsService.reserve` → IdempotencyRecord (response an toàn không token/PII) commit cùng nhau; retry hữu hạn 40001/P2034 và collision mã đơn; READ COMMITTED (RR làm snapshot stale khi tranh chuỗi lock — đã đổi có lý do) |
| `apps/backend/src/modules/orders/orders.controller.ts` (mới) + `orders.module.ts` (sửa) | POST `/orders` guest qua CSRF + `@Throttle` ip 5/phút riêng cho endpoint; identity idempotency = `guest:<sessionID>` do server cấp |
| `apps/backend/src/modules/orders/order-creation.service.spec.ts` (mới) | 13 unit: chuẩn hóa SĐT, snapshot 730.000, replay trước quote-hết-hạn, hash khác nội dung → 409, QUOTE_CHANGED các loại, ITEM_UNAVAILABLE/OUT_OF_STOCK, quota 429, rollback khi reserve lỗi, retry mã đơn trùng, key sai |
| `apps/backend/test/order-creation.integration.spec.ts` (mới) | 10 ca PostgreSQL thật (isolated DB, TRUST_PROXY + XFF cho IP test): atomic commit, replay sau quote hết hạn, key khác nội dung, concurrent same-key 1 đơn, tranh chiếc cuối, rollback thiếu SKU, whitelist, quota tuần tự + đồng thời, rate 429, CSRF |
| `apps/frontend/src/features/checkout/api/orders.api.ts` (mới) | createOrder với Idempotency-Key; `parseOrderConfirmation` kiểm tra runtime; `isDefiniteOrderError` phân biệt lỗi chắc chắn vs chưa rõ kết quả |
| `apps/frontend/src/features/checkout/OrderSubmissionProvider.tsx` (mới) | Máy trạng thái idle/pending/unknown/confirmed/failed giữ command (key+body) trên vòng đời App; retry đúng command cũ; beforeunload cảnh báo khi pending/unknown; fieldErrors từ API |
| `apps/frontend/src/features/checkout/hooks/useCreateOrder.ts` (mới) | Body từ quote (server-owned items), `cartMatchesQuote` chặn đặt khi giỏ drift |
| `apps/frontend/src/features/checkout/components/ContactAddressForm.tsx` (mới) | Form controlled 8 trường theo rule backend (SĐT plausible, email, 2..120…), draft do page giữ |
| `apps/frontend/src/features/checkout/components/OrderConfirmation.tsx` (mới) | Mã đơn + sao chép, Chờ xác nhận, chưa thu tiền, items/tổng server, không link sang trang chưa có |
| `apps/frontend/src/features/checkout/pages/CheckoutPage.tsx` (sửa) | Tích hợp form + submit + confirmed/unknown/failed; chặn đặt khi quote chưa accepted/giỏ drift; sau QUOTE_CHANGED hiện lại nút lấy quote, draft giữ |
| `apps/frontend/src/features/cart/cart-store.ts`, `CartProvider.tsx` (+test) | `clearCart`/`clear()` để dọn giỏ sau đặt thành công khi giỏ vẫn khớp đơn |
| `apps/frontend/src/app/App.tsx` | Bọc `OrderSubmissionProvider` ở cấp App (command sống qua route change) |
| `apps/frontend/src/features/checkout/pages/CheckoutPage.test.tsx` (sửa) | +4 test đặt đơn: thành công dọn giỏ khớp, draft giữ + field lỗi, Gửi lại đúng key (2 POST cùng key), fieldErrors server, không gửi subtotal client |
| `apps/frontend/e2e/order-creation.spec.ts` (mới) | 3 E2E thật: luồng COD đầy đủ + DB kiểm chứng, mất response sau commit (route.fetch + discard 201) → Gửi lại → cùng mã đơn reserved không tăng, OUT_OF_STOCK giữ form không tạo đơn |
| `package.json`, `.github/workflows/ci.yml` | Thêm order-creation.spec.ts vào implemented; tên bước CI ghi M4.3.1 |
| `docs/m4-contract.md`, `docs/m4-implementation-plan.md`, `docs/local-trial-m4.md`, `docs/plan.md`, `README.md` | Chốt contract create (response/error/token/quota/SĐT), trạng thái, hướng dẫn thử |
| `apps/frontend/e2e/checkout-quote.spec.ts` (sửa — **file bổ sung ngoài danh sách duyệt, nêu rõ**) | E2E quote M4.2.2 khớp text trang đã tiến hóa (heading "Đặt hàng — thanh toán khi nhận hàng"); scenario/khẳng định DB giữ nguyên |

### Data flow / key

Khách điền form → bấm "Đặt hàng COD" → provider chụp command (key UUID + body) → POST `/orders` → DTO whitelist → advisory lock theo SĐT → replay check → quote re-verify (hạn 15 phút theo giờ DB, giỏ khớp, giá/phí/settings khớp) → quota 3 PENDING/SĐT → tạo Order/items/history → `reserve` (khóa variantId tăng dần, tăng reserved, giữ onHand) → IdempotencyRecord commit cùng nhau → response code + token (lần đầu) → màn xác nhận; giỏ dọn nếu khớp.

- **Order command**: key UUID do client sinh một lần/ý định; hash chuẩn hóa che khuất thứ tự và SĐT form.
- **Advisory lock SĐT đầu transaction**: chống vượt quota và trùng command khi đồng thời; kết hợp READ COMMITTED thay RR (đã đổi có lý do: RR chụp snapshot trước lock khiến chuỗi 40001 khi 4 request đồng thời).
- **lookupToken 192-bit**: chỉ trả lần đầu, DB chỉ lưu SHA-256; replay không phát lại.
- **Unknown phase**: mất response/5xx/malformed → khóa form, "Gửi lại" đúng key+body cũ; failed chắc chắn (4xx nghiệp vụ) → được tạo intent mới với key mới.
- **Quota 3 PENDING/SĐT + 5/phút/IP**: DB count sau lock + Throttler override đúng endpoint.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| Unit RED → GREEN | thiếu module → sau triển khai orders 22/22 (service 13 + command 9) |
| Integration RED → GREEN | nhiều vòng fix: model tên `checkoutQuote` trong fake tx, CHECK variant SKU uppercase (fixture Prisma trực tiếp), Decimal→Number, `pg_advisory_xact_lock` trả void cần `IS NOT NULL AS locked`, 40001 serialization phải retry (P2010 wrapper), TDZ `quote` helper, RR snapshot stale → chuyển READ COMMITTED, assert count theo code đơn; sau sửa **10/10** |
| UI checkout + cart | **79/79** sau khi sửa: MUI required dấu `*` làm getByLabelText exact fail (chuyển required vào htmlInput như form tạo), button enabled khi draft hợp lệ, getAllByText cho tổng trùng, count theo code đơn, đợi localStorage clear; full-run còn 1-2 timeout flake ở App.test/ProductEditPage (pass khi chạy riêng — pattern tải máy đã biết) |
| E2E | 3 chỉnh (reserved đo theo delta giữa các scenario dùng chung DB, OUT_OF_STOCK hạ onHand về reserved, count đơn theo baseline) → **3/3** |
| `typecheck` | các vòng fix TS: Prisma InputJsonValue, `Throttle` từ `@nestjs/throttler`, `Matches` import, exactOptionalPropertyTypes cho email/note/token, provider import đường dẫn — cuối **0 lỗi** |
| `./tools/npm.ps1 test` | backend đạt; frontend 1 timeout flake App.test (pass khi chạy riêng — pattern tải máy đã biết) |
| `./tools/npm.ps1 run test:e2e:implemented` | 44/44 (41 cũ + 3 mới) — xác nhận ở mục kiểm chứng cuối phiên |
| CI GitHub | Chưa chạy (chưa commit/push) |

**Dừng sau M4.3.1 cho người dùng chạy thử; M4.4 tra cứu/hủy và M4.5 admin đơn chưa triển khai.**

## Ngày 31/10/2026 — M6.2: backup ngoài VPS + diễn tập khôi phục

**Phạm vi đã duyệt:** kế hoạch M6.2 trong chat ("duyệt") — người dùng chuyển phần này từ Người B sang phía A. Backup DB + ảnh hằng ngày trên VPS, bản sao ngoài VPS, diễn tập khôi phục vào DB khác. **Đã làm và xác minh đầy đủ; bản sao ngoài VPS nằm tại máy người dùng `.local/backups/20261031-130938/` (ngoài Git).**

- `deploy/backup.sh` (mới): `pg_dump -Fc` qua container DB + `tar` uploads + `SHA256SUMS` vào `/var/backups/rmg-shop/<stamp>/` (`0700`/`0600`), retention **7 bản**, flock chống chồng, không in dữ liệu. Bản cài ổn định: `/srv/rmg-shop/bin/backup.sh`. Lỗi đầu tiên (mở lock trước khi mkdir) đã sửa trước khi chạy thành công.
- Cron VPS: `0 3 * * * /srv/rmg-shop/bin/backup.sh` — entry riêng, không đụng backup của website khác trên cùng máy; log `/var/log/rmg-shop-backup.log`.
- Backup đầu tiên: `20261031-130938` (732K — dump 47K + uploads 691K); pull về máy người dùng, **SHA256 khớp**, `.local/backups/` được gitignore xác nhận.
- Diễn tập khôi phục: tạo DB `rmg_shop_restore_drill` → `pg_restore` — lần đầu dùng `--no-owner` khiến role ứng dụng mất quyền đọc `_prisma_migrations` (`migrate status` lỗi) → làm lại **không** `--no-owner`: 9 bảng khớp số hàng nguồn (products 5, categories 4, users 2, variants 5, product_images 17, upload_assets 17, inventory 5, movements 5, quotes 4), `_prisma_migrations` 3/3 applied, `migrate status` → **"Database schema is up to date!"**. DB drill đã xóa sạch (0 còn lại). Runbook trong guide ghi rõ cờ đúng.

| Kiểm tra | Kết quả |
|---|---|
| Backup chạy tay + cron entry | Đạt (log 3 bước, 732K, quyền 0700/0600) |
| SHA256 sau khi pull về máy | Khớp `SHA256SUMS` |
| Restore drill: đếm 9 bảng vs nguồn | Khớp toàn bộ |
| `migrate status` trên DB drill | "Database schema is up to date!" |
| Dọn DB drill | dropdb thành công, còn lại 0 |
| Backup lọt Git? | Không — `.local/` gitignore |

**Key:** `pg_dump -Fc` — format nén của PostgreSQL, restore bằng `pg_restore`; `--no-owner` — cờ KHÔNG dùng khi restore về cluster này (ownership phải trả về `rmg_shop`); retention 7 — vòng đời bản backup trên VPS; bản ngoài VPS — pull thủ công về `.local/backups/`, cập nhật theo thông lệ sau các mốc dữ liệu.

**Chạy thử:** người dùng xác nhận file tồn tại tại thư mục `.local/backups/20261031-130938/` trên máy. Muốn bản mới hơn: chạy 3 lệnh pull trong guide.

**Còn lại:** backup tự động hoàn toàn ra ngoài VPS cần lưu trữ đám mây (cần tài khoản người dùng cung cấp); M6.3 (bảo vệ VPS/báo động) còn lại của mốc M6; cron chạy lần đầu tự động 03:00 ngày mai — kiểm log buổi sáng sau.

## Ngày 31/10/2026 — M6.1.3: diễn tập rollback trên production

**Phạm vi đã duyệt:** bảng kế hoạch M6.1.3 trong chat ("oke"): rollback có chủ đích về release trước rồi roll-forward lại, không thay đổi code. **Đã diễn tập và xác minh đủ 3 pha; M6.1 hoàn tất 3/3 phần.**

- Pha rollback: `deploy-release.sh` với release `m4-2-20261031-1410-899b52c` — 6/6 bước đạt trong ~34 giây (layer cache); `current` + `RMG_RELEASE` trả về release cũ; health 200, `/shop` 200, **5 sản phẩm còn nguyên**; share preview trả **404** — chứng minh thật sự đang chạy bản cũ thiếu M7.1.1.
- Pha roll-forward: script với release `ci-20261031-1218-6d35c3d` — 6/6 bước đạt ~32 giây; `current` + `RMG_RELEASE` trở lại; health 200, `/shop` 200, 5 sản phẩm, share preview **200 + og:image** khôi phục.
- Container DB giữ nguyên cả hai pha; volume/ảnh/secret không đụng tới; downtime mỗi pha chỉ vài giây lúc recreate (shop chưa mở bán). Rollback tự động của script không kích hoạt có chủ ý — dùng cùng bộ lệnh với rollback tay đã diễn tập (rủi ro khi cố phá health trên production không đáng).

| Pha | Lệnh | current/RMG_RELEASE | health | shop | products | share preview |
|---|---|---|---|---|---|---|
| Trước diễn tập | — | ci-20261031-1218-6d35c3d | 200 | 200 | 5 | 200 |
| Sau rollback | script + release cũ | m4-2-20261031-1410-899b52c | 200 | 200 | 5 | **404** |
| Sau roll-forward | script + release mới | ci-20261031-1218-6d35c3d | 200 | 200 | 5 | **200** |

**Key:** rollback = chạy lại script với thư mục release cũ (không lệnh đặc biệt nào khác); schema không rollback — migration giữ nguyên, app cũ vẫn chạy vì schema tương thích xuôi; `current`/`RMG_RELEASE` — hai con trỏ phải luôn khớp nhau.

**Chạy thử:** người dùng không cần làm gì — trang [cửa hàng](https://rmglabels.duckdns.org/shop) vẫn chạy bình thường. Khi có sự cố thật: chạy `bash /srv/rmg-shop/releases/<tag-tốt>/deploy/deploy-release.sh /srv/rmg-shop/releases/<tag-tốt>`.

**Còn lại:** M6.1 chốt phía Người A; còn M6.1.3 không có phần code — các giới hạn M6.2 (backup ngoài VPS, cấp bách vì dữ liệu thật) và M6.3 (bảo vệ VPS/báo động) thuộc Người B; M7.1.2 E2E mobile tiếp theo khi người dùng yêu cầu.

## Ngày 31/10/2026 — M6.1.2: lượt deploy đầu qua GitHub Actions

**Phạm vi đã duyệt:** kế hoạch M6.1.2 (workflow bấm-chạy, gate CI, key riêng cho CI). Người dùng merge PR #22 (workflow + secret `DEPLOY_SSH_KEY` đã set, host key ghim `deploy/ci-known-hosts`) và PR #23 (M7.1.1); CI của `main` `6d35c3d` xanh → chạy workflow **Deploy production** lần đầu (run [41200471146](https://github.com/tangthinh955-ops/clothing-shop/actions/runs/41200471146), ref=main). **Đã deploy và agent đã kiểm tra; chờ người dùng thử card Zalo.**

- Tất cả bước workflow đạt: gate mọi check-run của đúng SHA → `git archive` allowlist → SSH bằng key ed25519 riêng cho CI (không dùng key cá nhân) → scp + đối chiếu SHA256 → chạy `deploy-release.sh` trên VPS. `concurrency: production-deploy` chống deploy chồng.
- Release mới: `/srv/rmg-shop/releases/ci-20261031-1218-6d35c3d` — gồm M4.2 giỏ/quote, 5 sản phẩm thật và M7.1.1 link preview. API/web healthy sau recreate; DB container giữ nguyên. `current` + `RMG_RELEASE` đã trỏ đúng.
- Kiểm tra công khai sau deploy: health `{"status":"ok"}`; `/shop` 200; products total 5; share preview `…/api/v1/share/products/rmg-black-wash-vtg-horse-tee` trả `og:title`/`og:image` với origin production + refresh đúng slug.

**Key:** gate CI trong workflow — dừng trước khi đụng VPS nếu commit chưa xanh; `DEPLOY_SSH_KEY` — key CI-only, xoá secret hoặc dòng `authorized_keys` là thu hồi quyền deploy.

**Chạy thử:** bấm Run workflow trên GitHub chọn commit bất kỳ đã có CI xanh — deploy tự diễn ra; link share để dán Zalo: `https://rmglabels.duckdns.org/api/v1/share/products/<slug>`.

**Còn lại:** diễn tập rollback có chủ đích (M6.1.3 — kế hoạch riêng); backup ngoài VPS (M6.2) càng cấp vì dữ liệu thật đã trên production.

## Ngày 31/10/2026 — M7.1.1: link preview sản phẩm cho Zalo/Instagram

**Phạm vi đã duyệt:** bảng kế hoạch M7.1.1 trong chat (người dùng "oke" + "bắt đầu làm M7.1.1 đi"): endpoint public server-render cho link share, thêm thẻ tĩnh `og:site_name`/`twitter:card` vào `index.html`. Làm trên nhánh `feat/m7.1.1-share-preview` từ `main` sau merge PR #22. **Đã viết, agent đã kiểm tra local; đã vào production qua workflow (release `ci-20261031-1218-6d35c3d` — xem mục M6.1.2 bên dưới); chờ người dùng dán link share vào Zalo thử card.**

| File thực tế | Thay đổi |
|---|---|
| `apps/backend/src/modules/products/products.service.ts` | Thêm `sharePreview(slug, origin)`: đọc sản phẩm PUBLISHED (cùng bộ lọc `visible` như detail) + ảnh đầu, trả HTML tĩnh với `og:title/description/type/url`, `og:image` tuyệt đối theo `APP_ORIGIN`, `twitter:card`, `meta refresh 0s` về `/products/<slug>`; mọi giá trị đưa vào HTML qua hàm escape (chống XSS qua og-tags); 404 đồng nhất cho hàng ẩn/nháp/sai slug |
| `apps/backend/src/modules/products/share-preview.controller.ts` (mới) | `GET /share/products/:slug` public, `text/html; charset=utf-8`, GET không CSRF, không đụng kho |
| `apps/backend/src/modules/products/products.module.ts` | Khai báo `SharePreviewController` |
| `apps/frontend/index.html` | Thêm `og:site_name`, `twitter:card summary` cho các trang SPA (không thêm `og:image` tĩnh vì chưa có logo — để trống thay vì ảnh giả) |
| `apps/backend/test/share-preview.integration.spec.ts` (mới) | 4 ca PostgreSQL thật: HTML đủ og-tags + ảnh tuyệt đối; fallback "Giá từ …" khi thiếu mô tả; tên/mô tả chứa `<b>"&` bị escape; 404 cho nháp/sai slug. Ba sản phẩm PUBLISHED cần ảnh riêng (asset 1-1 sản phẩm) — helper upload+gắn+publish |
| `apps/frontend/e2e/share-preview.spec.ts` (mới) | Fixture DB runner riêng (user ADMIN cho `ownerId` + asset + sản phẩm): link share → meta-refresh về trang chi tiết render đúng; fetch HTML khẳng định og-tags (origin-agnostic vì APP_ORIGIN khác nhau giữa local/CI); slug lạ → 404 |
| `package.json`, `docs/architecture.md`, `progress.md` | Thêm spec vào `test:e2e:implemented`; chốt lại đường dẫn `/api/v1/share/products/:slug` (trước đây dự kiến `/share/…`, đổi để không phải sửa nginx; URL ngắn hơn có thể thêm sau bằng 1 location nginx) |

**Data flow:** người bán dán link `…/api/v1/share/products/<slug>` vào Zalo/Instagram → crawler GET endpoint → `sharePreview` đọc sản phẩm đang bán + ảnh đầu → trả HTML với OG tags URL tuyệt đối → crawler dựng card (ảnh + tên + giá); người thật mở link → meta refresh về SPA `/products/<slug>`. Không đăng nhập, GET thuần.

| Kiểm tra thực tế | Kết quả |
|---|---|
| `typecheck`, `build` | Đạt |
| `./tools/npm.ps1 test` | Tools + backend **45** + frontend **334** đạt |
| `./tools/npm.ps1 run test:integration` | **11 file, 85/85** (4 ca share mới) |
| `test:e2e:implemented` (15 spec) | **43/43** (2 ca share mới) |
| Chưa chạy | Crawler thực của Zalo/Instagram — cần route vào production rồi dán link thật (sau deploy) |

**Key:** `sharePreview` — trang HTML server-render duy nhất của app, chỉ phục vụ crawler + redirect; hàm `escape` — toàn bộ tên/mô tả/slug đưa vào attribute phải qua escape; `APP_ORIGIN` — gốc URL tuyệt đối cho `og:image`/`og:url` (đã có cho CSRF, tái sử dụng); bộ lọc `visible` — share và detail dùng cùng điều kiện hàng đang bán.

**Chạy thử (local):** mở `http://localhost:5173/api/v1/share/products/<slug>` — trình duyệt nhảy ngay về trang sản phẩm; `curl -s <link> | head -30` thấy og-tags. **Trên production (đã xác minh bằng curl):** `https://rmglabels.duckdns.org/api/v1/share/products/<slug>` trả og:title/og:image production + refresh đúng — người dùng dán link vào Zalo để xem card.

**Còn lại:** card thực tế trên Zalo/IG do người dùng dán link thử; E2E mobile 390px (M7.1.2) tiếp theo — gửi kế hoạch riêng.
## Ngày 31/10/2026 — Nhập dữ liệu thật lên production (admin + 5 sản phẩm)

**Phạm vi:** người dùng yêu cầu "mang dữ liệu lên VPS". Tạo **tài khoản ADMIN production** (email do người dùng cung cấp trực tiếp; mật khẩu sinh ngẫu nhiên 24 ký tự, lưu `/etc/rmg-shop/admin-initial-password` `0600 root:root` trên VPS — không ghi mật khẩu/email vào repo, log hay chat) và nhập **5 sản phẩm thật** từ `data/import` (5 dòng CSV đủ giá/tồn + 17 ảnh RMG; giá 500.000–1.000.000đ) bằng CLI `import-products` chạy trong container API production, trạng thái **PUBLISHED** theo lựa chọn của người dùng. **Đã import và kiểm tra công khai; chờ người dùng đăng nhập, đổi mật khẩu và xem /shop.**

- Chuyển dữ liệu: tar 18 file → `/srv/rmg-shop/import-data` trên VPS (giữ lại để chạy lại an toàn — CLI bỏ qua slug đã có) → bơm vào container qua `docker exec -i` tar vào `/tmp/rmg-import` (container API `read_only`, `/tmp` là tmpfs; `docker cp` bị rootfs chặn). Tmp trong container đã xoá sau import.
- Admin: `create-admin` với env một lần (mật khẩu không in ra); CLI chỉ tạo mới, không nâng quyền tài khoản có sẵn; email là trường đăng nhập của chủ shop.
- Import: 5 sản phẩm PUBLISHED — mỗi cái 1 biến thể theo size trong CSV, kho theo cột `stock` kèm movement "Nhập kho lúc import" actor là admin; 4 danh mục tự tạo; SKU tự sinh `RMG<hash>-<size>`; ảnh nén webp 750×1000 vào `/var/lib/rmg-shop/uploads` (persistent volume); 0 dòng bị bỏ qua, 0 slug trùng.
- Data flow: `products.csv` + ảnh → CLI đọc/validate từng dòng (thiếu file/giá sai thì bỏ qua dòng, không nửa vời) → webp + UploadAsset (owner admin) → Product + Variant + Inventory + Movement + ProductImage trong DB production → `/api/v1/products` và `/shop` hiện ngay.

| Kiểm tra công khai (curl từ máy ngoài) | Kết quả |
|---|---|
| `GET /api/v1/products?pageSize=12` | total **5**, đúng tên/giá/danh mục/kho (avail 5/5/10/5/10) |
| `GET /api/v1/categories` | 4 danh mục: Áo thun, Áo polo, Quần, Áo hoodie |
| `GET /api/v1/media/<assetId>` | 200 `image/webp`; id lạ → 404 |
| `/shop` | 200 |

**Key:** `import-products --dir` — nhập CSV thật cho production (khác `seed:demo`), tự tạo danh mục bật, mỗi dòng = 1 sản phẩm nhiều size; `admin:create` — env `ADMIN_EMAIL`/`ADMIN_PASSWORD` một lần, không có mặc định; chuỗi ảnh — file → `UploadAsset` (owner admin) → `ProductImage`, dùng chung cơ chế `/api/v1/media` với upload admin.

**Chạy thử:** mở [/shop](https://rmglabels.duckdns.org/shop) — thấy 5 sản phẩm + ảnh; đăng nhập `/login` bằng email admin và mật khẩu trong file trên VPS (`ssh masoi cat /etc/rmg-shop/admin-initial-password`), vào `/admin` kiểm tra sản phẩm/kho, **đổi mật khẩu ngay** sau lần đăng nhập đầu.

**Còn lại:** đổi mật khẩu admin (khuyến nghị làm ngay); chưa có backup ngoài VPS (M6.2) — dữ liệu thật đã nằm trên production nên backup cần sớm; M6.1.2 chờ merge PR #22 để test workflow; các file docs chưa commit nằm trên nhánh PR.

## Ngày 31/10/2026 — M6.1.1: deploy qua script `deploy-release.sh`

**Phạm vi đã duyệt:** bảng kế hoạch M6.1.1 trong chat (người dùng duyệt "duyệt"): script hoá deploy trên VPS và chạy một lượt deploy thật của `main` `899b52c`. Không sửa code ứng dụng; release gồm M4.2 giỏ/quote **chưa nghiệm thu** (đã nêu khi duyệt — catalog production trống nên khách không thao tác được giỏ). **Đã deploy và agent đã kiểm tra local + URL công khai; chờ người dùng chạy thử.**

- Release mới: `/srv/rmg-shop/releases/m4-2-20261031-1410-899b52c`; sau khi healthy script đã đổi `/srv/rmg-shop/current` và `RMG_RELEASE` trong `/etc/rmg-shop/backend.env` (vẫn `0600 root:root`). URL: [trang chủ](https://rmglabels.duckdns.org/) và [cửa hàng](https://rmglabels.duckdns.org/shop).
- Đóng gói 204 file (291 entry gồm cả dòng thư mục) từ đúng commit `899b52c` theo allowlist guide; archive có SHA256 `790610dd239a7424e607d5852d7567698525e850b4d71317fe5a13472d0ae50d`, đối chiếu khớp sau khi tải lên VPS. So sánh danh sách file trong archive với `git ls-tree` của commit: **không thừa, không thiếu**. `deploy/deploy-release.sh` (mới, chưa commit) được tải riêng vào thư mục release.
- Image IDs: API `sha256:3b21203fee7e7c8c26eba03e57dc3b3e46c6a64ef4584083e2cbb83678696534`; web `sha256:edd9de0577780fa81c91bf1b85decaa583fdcc4876d3c74c16d19363d4bf2b88`; migrate `sha256:45f2bdbacd0253a35b7f644e1180cf418fd5790196c2ea1f075023eb3dc5662e`.
- Script chạy đủ 6 bước: `config --quiet` → build 3 image tag riêng → `migrate` tường minh — áp lần đầu migration `202610290001_m4_order_core` lên DB production (tổng 3 migrations) → recreate API/web với `--wait` → readiness local 200 → kiểm tra chuỗi công khai → đổi symlink. Container DB giữ nguyên (up 44 giờ), volume `rmg-shop_postgres_data` không đổi; không seed, không tạo admin, không đọc bảng dữ liệu.
- Rollback: script có rollback tự động (trả `RMG_RELEASE` + `up -d` từ release cũ + trả symlink) kích hoạt khi health fail **sau khi** đã thay container — lượt này không phải kích hoạt; release cũ `ui-20261030-ad9c854-01` và đủ bộ image cũ còn trên máy. Diễn tập rollback có chủ đích để M6.1.3. Tarball tạm trong `/tmp` đã xoá sau khi giải nén.

| Kiểm tra | Kết quả |
|---|---|
| Local trên đúng `899b52c` (sáng cùng ngày) | typecheck/build đạt; unit tools+backend 45+frontend 334; integration 81/81; E2E implemented 41/41 |
| `bash -n deploy/deploy-release.sh` | Đạt (LF, UTF-8) |
| SHA256 archive local ↔ trên VPS | Khớp |
| Log script trên VPS | Đủ 6 bước, không bước lỗi; migration báo "successfully applied" |
| Kiểm tra độc lập từ máy ngoài (curl) | readiness `200 {"status":"ok"}`; HTTP→HTTPS 301; `/` và `/shop` 200; admin không phiên 401; `/api/docs` 404; bundle mới `index-DHSXH1Sy.js` được phục vụ; HSTS+CSP có mặt; cookie `__Host-shop.sid` đủ Secure/HttpOnly/SameSite=Lax/Path=/, không Domain (chỉ kiểm thuộc tính, không in giá trị) |
| Docker trên VPS | API/web healthy mới recreate; DB healthy giữ nguyên; `current` trỏ đúng; env `0600 root:root`; đủ 3 release (m3-16-1, ui-20261030, m4-2-20261031) và 2 bộ image để rollback |

**File trong repo đổi ở lượt này:** `deploy/deploy-release.sh` (mới — script 6 bước + flock chống chạy song song + rollback tự động); `docs/deployment-guide.md` (mục "Deploy qua script" + runbook); `README.md`, `progress.md` (bản đang chạy + bằng chứng). **Chưa commit** — chờ yêu cầu.

**Key:** `deploy-release.sh` — pipeline 1 lệnh trên VPS, chốt "healthy rồi mới đổi symlink", khoá flock chống deploy chồng; `RMG_RELEASE` — tag image cả 3 dịch vụ, shell env override cho build, env file chỉ đổi sau khi healthy; rollback — trả env + `up -d` từ release cũ, không đụng volume/ảnh/secret; allowlist tarball — danh sách file khoá theo guide, đối chiếu bằng `git ls-tree`.

**Chạy thử:** mở [trang chủ](https://rmglabels.duckdns.org/) và [/shop](https://rmglabels.duckdns.org/shop) — giao diện như trước; giỏ hàng M4.2 giờ có trên production nhưng catalog trống nên chỉ xem được khung giỏ rỗng; việc thử giỏ đầy đủ làm local theo [local-trial-m4.md §M4.2](docs/local-trial-m4.md).

**Còn lại:** M6.1.2 (workflow GitHub Actions bấm-chạy, cần SSH key riêng cho deploy vào Secrets) và M6.1.3 (diễn tập rollback) — gửi kế hoạch riêng; M6.2/M6.3 thuộc Người B; file mới/docs chưa commit.

## Ngày 31/10/2026 — Git M4.2: đưa giỏ hàng và báo giá lên main

- Người dùng yêu cầu push toàn bộ M4.2.1/M4.2.2 lên `main`, sau đó xác nhận **giữ hạn báo giá 15 phút** thay cho 30 phút trong kế hoạch ban đầu. Giữ nguyên hằng số backend đã sửa; đồng bộ test unit/integration, fixture E2E, hướng dẫn và contract. UI dùng thời hạn server trả thay vì câu 30 phút cố định; hạn chuyển khoản vẫn là 120 phút.
- Kiểm chứng trước commit tái hiện thêm lỗi cập nhật quote: timer dùng hạn của quote cũ đã hết hạn làm quote mới đổi giá bị hết hạn ngay. Thêm regression RED→GREEN tại `CheckoutPage.test.tsx`; `useCheckoutQuote.ts` đếm theo pendingQuote khi xác nhận và chặn xác nhận quote đã hết hạn.
- Kiểm tra mới trên bản chuẩn bị push: `typecheck` đạt, `build` đạt; `VITEST_MAX_WORKERS=2` + `npm test` đạt **10 tools + 45 backend + 334 frontend**; integration PostgreSQL thật **81/81**; E2E implemented **41/41** (14 spec, DB riêng do runner tạo). Cảnh báo chunk >500 kB và pg deprecation có sẵn; khi E2E dừng server có log preview exit 1, nhưng runner hoàn tất exit 0 và đủ 41 ca đạt.
- Đã fetch và xác nhận base `960f518` trùng `origin/main` trước tích hợp. Rà danh sách 50 file staged, diff, remote và tác giả; env thật/runtime/dependency/build bị ignore, không nằm trong commit. Không force push hoặc deploy. CI của commit mới chưa có kết quả tại thời điểm ghi mục này; việc nghiệm thu thủ công vẫn chờ người dùng.

## Ngày 31/10/2026 — M4.2.2: báo giá giỏ hàng từ server

**Phạm vi được duyệt:** kế hoạch M4.2.2 gửi trong chat (POST `/checkout/quote` chỉ COD, TTL 30 phút theo giờ PostgreSQL, RepeatableRead, không giữ kho, không tạo đơn; FE `/cart` → `/checkout` với máy trạng thái báo giá). **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử, chưa nghiệm thu.**

### Phân biệt phần có sẵn và phần mới

- **M4.2.1 có sẵn trên nhánh `feat/m4.2.1-cart` (staged, không commit):** cart-store/CartProvider/AddToCartForm/CartDrawer/CartPage, `/cart/resolve` (cart-products.controller/service/dto), `e2e/cart.spec.ts`, các test cart. Giữ nguyên toàn bộ; nhánh `feat/m4.2.2-quote` tạo từ trạng thái này.
- **M4.2.2 mới trong lượt này:** các file dưới đây.

| File | Thay đổi và lý do |
|---|---|
| `apps/backend/src/modules/orders/dto/quote.dto.ts` (mới) | DTO quote: items 1..100 dòng thô, variantId UUID chuẩn hóa lowercase, quantity 1..99, `method` chỉ COD (BANK bị từ chối rõ ràng); whitelist chặn trường giá/tổng client gửi |
| `apps/backend/src/modules/orders/checkout.service.ts` (mới) | Gộp variant trùng → giới hạn 50 dòng/99 chiếc → transaction RepeatableRead đọc variant+inventory+settings cùng snapshot → chặn hàng không bán (409 ITEM_UNAVAILABLE) và thiếu tồn (409 OUT_OF_STOCK, fieldErrors chỉ mang variantId client gửi) → tính lineTotal/subtotal/total nguyên VND → `now()` từ PostgreSQL + TTL 30 phút → ghi 1 row CheckoutQuote; không đụng inventory/orders/network |
| `apps/backend/src/modules/orders/checkout.controller.ts`, `orders.module.ts`, `app.module.ts` | POST `/checkout/quote` guest qua CSRF + rate limit hiện có; đăng ký OrdersModule |
| `apps/backend/src/modules/settings/settings.service.ts` + spec | Thêm `currentInTx(tx)` đọc cấu hình trong transaction của caller cùng mặc định an toàn, không ghi; +2 unit test |
| `apps/frontend/src/features/checkout/api/checkout.api.ts` (mới) | Gọi POST quote qua `request()` chung; `parseCheckoutQuote` kiểm tra runtime từng trường (malformed → INVALID_RESPONSE, không bao giờ hiển thị như quote) |
| `apps/frontend/src/features/checkout/hooks/useCheckoutQuote.ts` (mới) | Máy trạng thái idle/pending/accepted/stale/expired/confirm/error: chặn gửi đúp (ref + sequence), response của giỏ cũ bị bỏ, drift giỏ → stale, hết hạn theo serverNow+offset (đếm hiển thị, không thẩm quyền), giá/phí đổi → confirm "Dùng báo giá mới" |
| `apps/frontend/src/features/checkout/components/QuoteSummary.tsx` (mới) | Hiển thị quote từ số server (items/tiền hàng/phí/tổng) + `describeQuoteChanges` liệt kê thay đổi |
| `apps/frontend/src/features/checkout/pages/CheckoutPage.tsx` (mới) | Trang public: empty state, COD, Lấy báo giá/Cập nhật/Thử lại, quay lại sửa giỏ, không form PII, không nút đặt hàng |
| `apps/frontend/src/app/App.tsx`, `features/cart/pages/CartPage.tsx` | Route `/checkout`; nút "Xem phí và tổng tiền" trên giỏ không rỗng |
| `apps/frontend/src/features/checkout/pages/CheckoutPage.test.tsx` (mới) | 8 UI test: empty, render đúng số server, double-click 1 request, response giỏ cũ bị bỏ, malformed, hết hạn, confirm giá mới, lỗi mạng + không persist quote |
| `apps/backend/test/checkout-quote.integration.spec.ts` (mới) | 6 ca PostgreSQL thật (isolated DB): 730.000 + snapshot DB khớp, hạn ~30 phút, không write kho/đơn, giá/settings đổi không sửa quote cũ mà quote mới đọc mới, unknown field/BANK/quantity sai bị chặn, không lộ hàng ẩn, CSRF |
| `apps/frontend/e2e/checkout-quote.spec.ts` (mới) | 3 E2E thật (isolated DB): luồng 2×A+1×B thấy 730.000 + DB kiểm chứng + mobile 390; giá đổi qua hết hạn → confirm "Dùng báo giá mới"; hàng ẩn/hết tồn bị chặn không ghi gì |
| `package.json`, `.github/workflows/ci.yml` | Thêm checkout-quote.spec.ts vào bộ implemented; tên bước CI ghi M4.2.2 |
| `docs/m4-contract.md` | Chốt response/error quote (ITEM_UNAVAILABLE/OUT_OF_STOCK kèm fieldErrors variantId), field mapping, TTL 30 phút chuyển từ đề xuất sang đã chốt cho M4.2.2 |
| `docs/m4-implementation-plan.md`, `docs/local-trial-m4.md`, `docs/plan.md`, `README.md` | Trạng thái + hướng dẫn chạy thử M4.2.2 |

### Data flow / key

Khách bấm "Lấy báo giá" → `checkoutApi.quote` POST `/checkout/quote` (CSRF pre-session) → DTO whitelist/validate → `CheckoutService.quote` mở transaction RepeatableRead: `settings.currentInTx` đọc phí + version, đọc variant/inventory/product/category, chặn hàng ẩn/thiếu tồn, tính tiền nguyên VND, `now()` PostgreSQL + 30 phút → ghi CheckoutQuote → response → hook so signature giá/phí: cùng mức → accepted; khác → confirm chờ "Dùng báo giá mới". Giỏ đổi giữa chừng → response bị bỏ và quote cũ thành stale.

- `RepeatableRead`: product/inventory/settings đọc cùng snapshot, không khóa kho, không giữ hàng.
- `serverNow`/`expiresAt`: giờ PostgreSQL; FE chỉ dùng để hiển thị, server kiểm tra lại ở M4.3.1.
- `signature` (items+fee): ranh giới "đã được khách chấp nhận" — khác signature phải confirm.
- `currentInTx`: đọc cấu hình trong transaction của caller, không nhân bản DEFAULTS.
- ITEM_UNAVAILABLE/OUT_OF_STOCK: 409 với `fieldErrors[items.variantId]` chỉ chứa id client gửi.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| Backend unit RED → GREEN | checkout.service.spec thất bại vì thiếu module; sau triển khai 32/32 (checkout 12 + settings 20) |
| UI RED → GREEN | 8 test thất bại vì route/trang chưa có; các chỉnh trong lượt: matcher tiền theo convention regex (NBSP), text trùng nút/status, sửa luôn nút pending đổi nhãn "Đang lấy báo giá…"; sau sửa 74/74 (checkout 8 + cart 66) |
| Integration | 4/6 đầu thất bại: message BANK nằm ở fieldErrors, `variantId` bị exception filter strip (filter chỉ phát code/message/fieldErrors), count quote dính fixture test trước — sửa: variantId đi qua `fieldErrors[items.variantId]`, count trước/sau; sau sửa **6/6** |
| E2E | 2 lần chỉnh: confirm flow phải qua hết hạn (navigate sang /cart làm unmount state → dùng `page.clock.fastForward('31:00')`), strict-mode "Dùng báo giá mới" trùng Alert → getByRole button; sau sửa **3/3** |
| `typecheck` / `build` | 1 lỗi TS Prisma InputJsonValue (sửa theo pattern settings M4.1.2); sau sửa đạt — kết quả cuối ở mục kiểm chứng cuối phiên dưới đây |
| CI GitHub | Chưa chạy (chưa commit/push) |

**Dừng sau M4.2.2 cho người dùng chạy thử; M4.3.1 (tạo đơn COD) chưa triển khai.**


## Ngày 31/10/2026 — M4.2.1: giỏ hàng khách và Drawer

**Phạm vi:** kế hoạch giỏ đã duyệt trong chat. OpenCode đã viết nền API/UI/test ban đầu trên nhánh `feat/m4.2.1-cart`; Codex tiếp tục hoàn thiện, sửa findings review và bổ sung E2E/tài liệu. Chưa commit/push. M4.2.2 quote và M4.3 đặt hàng chưa triển khai; chờ người dùng chạy thử, chưa nghiệm thu.

**Luồng:** khách chọn variant/số lượng → Context lưu IDs và quantity ở localStorage, mở Drawer → `/cart/resolve` đọc batch dữ liệu công khai/tồn mà không ghi DB → UI hiển thị dữ liệu hiện tại. `/cart` chỉnh số lượng bằng Enter hoặc rời ô; giỏ không giữ/trừ hàng. Dữ liệu tồn/giá cũ được ẩn trong lúc tải lại hoặc lỗi, bản nháp số lượng vẫn giữ khi refetch cùng giỏ.

**Key:** `schemaVersion` đánh dấu định dạng giỏ; `variantId` định danh tổ hợp size/màu; `available` là tồn có thể bán lúc đọc; `UNAVAILABLE` thống nhất hàng ẩn/vô hiệu/không tồn tại; query key theo giỏ ngăn response giỏ cũ ghi đè giỏ khác.

**Các file trong phạm vi M4.2.1:**

| File | Trách nhiệm |
|---|---|
| `apps/backend/src/modules/products/cart-products.controller.ts` | Endpoint public chỉ đọc đi qua CSRF |
| `apps/backend/src/modules/products/dto/cart-items.dto.ts` | Validate payload giỏ và giới hạn thô |
| `apps/backend/src/modules/products/cart-products.service.ts` | Chuẩn hóa UUID, gộp dòng, batch query public và tình trạng tồn |
| `apps/backend/src/modules/products/products.module.ts` | Đăng ký controller/service giỏ |
| `apps/backend/test/cart-products.integration.spec.ts` | Test API, quyền công khai, input và tồn trên DB cô lập |
| `apps/frontend/src/features/cart/cart-store.ts` | Chuẩn hóa, giới hạn và lưu/đọc giỏ |
| `apps/frontend/src/features/cart/cart-store.test.ts` | Test gộp, giới hạn và storage không tin cậy |
| `apps/frontend/src/features/cart/CartProvider.tsx` | Context giỏ, trạng thái Drawer và fallback memory |
| `apps/frontend/src/features/cart/CartProvider.test.tsx` | Test state, lỗi storage và StrictMode |
| `apps/frontend/src/features/cart/api/cart.api.ts` | Gọi resolve, kiểm tra shape và tập ID response |
| `apps/frontend/src/features/cart/api/cart.api.test.ts` | Test hợp đồng API và response lỗi |
| `apps/frontend/src/features/cart/hooks/useCartResolve.ts` | Cache và cập nhật dữ liệu giỏ theo query key |
| `apps/frontend/src/features/cart/hooks/useCartResolve.test.tsx` | Test cache và truy vấn giỏ |
| `apps/frontend/src/features/cart/components/AddToCartForm.tsx` | Nhập số lượng, chặn vượt tồn, thêm hàng |
| `apps/frontend/src/features/cart/components/AddToCartForm.test.tsx` | Test số lượng không nguyên, giới hạn và thông báo vượt tồn |
| `apps/frontend/src/features/cart/components/CartDrawer.tsx` | Drawer có danh sách, truy cập bàn phím và điều hướng |
| `apps/frontend/src/features/cart/components/CartDrawer.test.tsx` | Test mở/đóng, refetch, dialog và điều hướng |
| `apps/frontend/src/features/cart/pages/CartPage.tsx` | Xem/sửa/xóa giỏ, giữ draft khi refetch và ẩn tổng không đủ dữ liệu |
| `apps/frontend/src/features/cart/pages/CartPage.test.tsx` | Test giao diện, nhập số lượng, lỗi và refetch |
| `apps/frontend/src/features/catalog/pages/ProductDetailPage.tsx` | Nối form thêm biến thể vào giỏ |
| `apps/frontend/src/features/catalog/pages/ProductDetailPage.test.tsx` | Test thêm giỏ và kiểm tra tồn trong chi tiết |
| `apps/frontend/src/app/App.tsx` | Gắn provider và route `/cart` |
| `apps/frontend/src/layouts/StoreLayout.tsx` | Gắn Drawer cho cửa hàng |
| `apps/frontend/src/layouts/StoreLayout.test.tsx` | Test header và tích hợp giỏ |
| `apps/frontend/src/layouts/store/StoreHeader.tsx` | Nút giỏ và badge tổng số lượng |
| `apps/frontend/src/shared/ui/icons.tsx` | Icon giỏ phù hợp hệ thống icon hiện có |
| `apps/frontend/e2e/cart.spec.ts` | Kiểm tra guest, Drawer, giỏ, mobile, thay đổi tồn/ẩn và DB không bị giữ kho |
| `package.json`, `.github/workflows/ci.yml` | Đưa spec giỏ vào E2E implemented và cập nhật tên bước |
| `docs/m4-contract.md`, `docs/m4-implementation-plan.md`, `docs/plan.md` | Ghi hợp đồng resolve và điểm dừng lộ trình |
| `docs/local-trial-m4.md`, `README.md`, `progress.md` | Hướng dẫn chạy thử, trạng thái và bằng chứng |

**Review và kiểm tra:** 5 lỗi ban đầu được tái hiện/sửa (getter storage, số lượng, giỏ sai giới hạn, response sai IDs, dữ liệu cache lỗi); review độc lập bổ sung chuẩn hóa UUID, refetch khi mở giỏ, tạm tính thiếu dòng, dialog/điều hướng và giữ draft khi refetch. Đã chạy RED→GREEN cho các lỗi UI chính. Typecheck cuối đạt; build backend/frontend đạt trên bản cuối qua E2E; unit với `VITEST_MAX_WORKERS=2` đạt **10 tools + 32 backend + 325 frontend**; integration sau sửa UUID **75/75**; E2E implemented bản cuối **38/38**, dùng DB riêng và không còn DB tạm của lượt kiểm tra. Lượt integration đầu chạy song song bị timeout hook Settings, chạy riêng đạt; unit có một lượt fail assertion cũ sau đổi thông báo tồn, đã cập nhật và chạy lại đạt; không tăng timeout. Build có cảnh báo chunk >500 kB, không phải lỗi.

**Chạy thử:** làm theo [M4.2.1](docs/local-trial-m4.md#m421--giỏ-hàng); dùng sản phẩm và dữ liệu thử local. Không có checkout, quote, thanh toán hay đặt hàng thật trong phần này.

## Ngày 30/10/2026 — Git M4.1.2: đồng bộ main và push nhánh

- Người dùng yêu cầu push nhánh hiện tại `feat/m4.0-foundation`. Đã tạo commit chức năng `f7c09c4` (`feat(settings): save shop configuration safely`), gồm M4.1.2 và bốn bản sửa review; kiểm tra đủ 26 file, không có env thật, dependency, mailbox hoặc artifact build trong commit.
- Đồng bộ `origin/main` tại `5aa1747` để giữ giao diện storefront mới và bản sửa CI `1bce128`. Conflict duy nhất là `progress.md`: giữ đầy đủ các mục của hai bên; bỏ dòng `=======` thừa vốn đã có trên main. Không sửa nghiệp vụ mới trong bước Git.
- Cài đúng lockfile bằng `npm ci --no-fund`: 512 package, audit 0 vulnerability; generate lại Prisma client. Không đổi Node toàn máy.
- Kiểm tra lại **trên bản sau merge**: typecheck/build đạt; unit với `VITEST_MAX_WORKERS=2` đạt **10 tools + 32 backend + 255 frontend**; integration PostgreSQL thật **66/66**; E2E implemented **37/37** qua giao diện mới, gồm ba ca lưu Cài đặt/refresh/mobile, hai tab và ACL.
- Các test Cài đặt vẫn dùng DB riêng, không sửa cấu hình nguồn; kiểm tra hash và cleanup trước khi hoàn tất Git. Merge/push chỉ nhắm nhánh feature theo yêu cầu, không deploy hoặc bắt đầu M4.2.1. CI của merge mới chưa có kết quả tại thời điểm ghi mục này.

## Ngày 30/10/2026 — M4.1.2: sửa 4 lỗi review

**Phạm vi:** người dùng duyệt sửa 4 điểm review bằng "sửa đi": reload lỗi giữ bản nháp/command, khóa lưu với tải lại, kiểm tra response và cô lập DB test. Sửa trên phần M4.1.2 local có sẵn, không nhận phần triển khai ban đầu là thay đổi của lượt này. Chưa commit/push; chưa bắt đầu M4.2.1.

| File thực tế | Bản sửa trong lượt này |
|---|---|
| `apps/frontend/src/features/admin/settings/pages/SettingsPage.tsx` | Ref đồng bộ + state khóa save/reload; chỉ remount khi refetch thành công; giữ draft/command khi lỗi; hủy refetch nền trước save để cache cũ không ghi đè response |
| `apps/frontend/src/features/admin/settings/components/SettingsForm.tsx` | Nhận disabled ngoài; khóa toàn bộ thao tác cả Dialog; cho tải cấu hình mới qua xác nhận rõ ràng, giữ version/key khi reload lỗi |
| `apps/frontend/src/features/admin/settings/api/settings.api.ts` | Đọc response kiểu unknown, kiểm tra cấu trúc/biên số/nhóm ngân hàng; JSON 200 không hợp lệ thành INVALID_RESPONSE, không vào nhánh lưu thành công |
| `apps/frontend/src/features/admin/settings/pages/SettingsPage.test.tsx` | Thêm 4 ca hồi quy: reload lỗi giữ draft, reload pending khóa save, mất response + reload lỗi vẫn retry đúng command, malformed response vẫn resend đúng key/body; giữ mock danh mục đã sửa CI |
| `apps/frontend/src/features/admin/settings/api/settings.api.test.ts` (mới) | Kiểm tra JSON sai shape/nhóm ngân hàng và giữ số 0 đầu tài khoản |
| `tools/test-database.mjs`, `tools/test-database.d.mts`, `tools/test-database.test.mjs` (mới) | Tạo DB UUID riêng đuôi _test, migrate rồi chỉ drop DB vừa tạo; guard test/PostgreSQL/suffix; tên DB an toàn và có khai báo kiểu |
| `tools/test-e2e.mjs` | Chạy toàn bộ Playwright trên DB riêng của lượt, truyền marker sở hữu, đóng runner rồi dọn DB trong finally |
| `apps/backend/test/settings.integration.spec.ts`, `apps/backend/test/orders-foundation.integration.spec.ts` | Mỗi suite dùng DB riêng; bỏ hoàn toàn nhánh sửa/xóa/restore singleton foreign |
| `apps/frontend/e2e/settings.spec.ts` | Từ chối DB không thuộc runner; chỉ tạo/xóa fixture mình sở hữu, không restore hàng có sẵn |
| `README.md`, `docs/local-trial-m4.md` | Ghi quyền CREATEDB của role test, lệnh runner và thao tác thử lại khi reload/malformed response |
| `progress.md` | Ghi phạm vi bản sửa và bằng chứng thực tế |

**Data flow:** save/reload chiếm cùng khóa ở page; form chỉ thay baseline sau response hợp lệ hoặc reload thành công. Test nối từ DB nguồn _test để tạo DB mới trống, migrate và chạy API/browser trên DB mới; cấu hình nguồn không bị sửa/xóa.

**Key:** `operationRef` chống chồng thao tác cùng tick; `formEpoch` chỉ đổi sau đọc thành công; `INVALID_RESPONSE` giữ kết quả chưa xác định và key cũ; `CLOTHING_TEST_DATABASE` chứng minh DB E2E thuộc runner; DB riêng chỉ được dọn khi invocation đã tạo thành công.

**Đã viết và agent đã kiểm tra local; chờ người dùng chạy thử, chưa nghiệm thu.**

| Kiểm tra thực tế | Kết quả |
|---|---|
| RED trong review trước sửa | 3 ca UI bắt được mất draft sau reload lỗi, save còn bật khi reload pending và JSON sai vẫn báo đã lưu |
| `./tools/npm.ps1 run typecheck` (lượt cuối) | Backend + frontend đạt |
| `./tools/npm.ps1 run build` | Đạt; E2E cũng build lại backend/frontend phiên bản cuối. Cảnh báo bundle >500 kB có sẵn, không phải lỗi build |
| `$env:VITEST_MAX_WORKERS='2'` rồi `./tools/npm.ps1 test` | **10/10 tools + 32/32 backend + 228/228 frontend**, gồm 42 ca Settings UI/API |
| Lượt unit không giới hạn worker | Lượt chạy song song build bị timeout tiến trình Prisma 15s; chạy riêng sau đó đạt. Lượt cuối mặc định 227/228 frontend, một ca `App.test.tsx` chờ chuyển trang CUSTOMER quá 1s; cùng code chạy 2 worker đạt 228/228. Không sửa App/test đó hoặc tăng timeout trong bản sửa này |
| `./tools/npm.ps1 run test:integration` | **8 file, 65/65** PostgreSQL thật; Settings/schema chạy trên DB riêng, cleanup thành công |
| `./tools/npm.ps1 run test:e2e:implemented` | **37/37**, gồm 3 ca Settings lưu/refresh/mobile, hai tab và ACL; DB riêng được dọn sau runner |
| An toàn DB nguồn | Hash toàn bộ hàng Cài đặt nguồn (gồm version/updatedAt) trước/sau giống nhau; **0 DB tạm** của nhóm settings/order_schema/e2e còn lại |
| Rà cấu trúc + diff | Có review độc lập; bổ sung kiểm tra nhóm ngân hàng trong response theo finding cuối. `git diff --check` đạt; không còn khối DELETE/INSERT restore foreign trong các spec sửa |
| CI/Git | Chưa commit/push bản M4.1.2; chưa có CI cho các sửa local này |

**Chạy thử:** backend/frontend theo README → `/admin/settings`. Kiểm tra lưu/refresh, hai tab, reload lỗi vẫn giữ draft và command, reload đang chờ khóa thao tác; hướng dẫn ở [local-trial-m4.md](docs/local-trial-m4.md). Test DB cần role test có CREATEDB. **Dừng sau bản sửa, không bắt đầu M4.2.1.**

## Ngày 30/10/2026 — M4.1.2: admin lưu Cài đặt

**Phạm vi được duyệt:** kế hoạch M4.1.2 gửi trong chat (backend PATCH `/api/v1/admin/settings` — phiên bản lạc quan + Idempotency-Key transaction; frontend form lưu thật + xử lý 409/mạng; E2E + docs; TDD RED→GREEN; fixture sạch, restore bit-exact). **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử, chưa nghiệm thu.** Có 3 sửa ngoài lô để đạt lệnh test bắt buộc, khai báo ở phần thay đổi.

### Thay đổi và file thực tế

| File | Thay đổi và lý do |
|---|---|
| `apps/backend/src/modules/settings/dto/update-settings.dto.ts` (mới) | DTO PATCH: 6 trường nghiệp vụ + `expectedVersion`, kiểu VND nguyên dương/hạn phút theo biên schema; ràng buộc input runtime trước khi vào service |
| `apps/backend/src/modules/settings/settings.service.ts` (sửa) | Thêm `update()`: transaction `SELECT … FOR UPDATE`, so `expectedVersion`, tăng version, ghi `IdempotencyRecord` (scope `settings.update`, identity `admin:<userId>`, hash canonical kèm expectedVersion) commit cùng transaction; cùng key+nội dung → replay, cùng key khác nội dung/sai version → 409; bản ghi mới chỉ cho phép tạo khi chưa tồn tại và expectedVersion 0 |
| `apps/backend/src/modules/settings/admin-settings.controller.ts` (sửa) | Thêm `@Patch()` nhận `Idempotency-Key` từ header + DTO qua `@Body`, gọi service — controller không chứa nghiệp vụ |
| `apps/backend/src/modules/settings/settings.service.spec.ts` (sửa) | Unit tăng từ 4 → 16: thành công, replay cùng key, version cũ 409, key dùng nội dung khác 409, mất response không ghi DB, tranh chấp đồng thời, biên tạo/đổi cấu hình |
| `apps/backend/test/settings.integration.spec.ts` (sửa) | Mở rộng 14 ca HTTP thật qua proxy cookie+CSRF (lưu, replay, 409 hai tab, ACL, DTO lỗi); fixture row `default` có sẵn (foreign) được chụp một lần rồi restore bit-exact gồm `updatedAt`, idempotency records dọn theo identity |
| `apps/frontend/src/features/admin/settings/api/settings.api.ts` (sửa) | `settingsApi.update` + `SettingsUpdateInput`, gửi `Idempotency-Key` qua `request()` chung — không rải fetch trong component |
| `apps/frontend/src/features/admin/settings/components/SettingsForm.tsx` (mới) | Form 6 trường + máy trạng thái outcome (`saved`/`conflict`/`unconfirmed`/`rejected`); khóa nội dung khi chưa biết kết quả; "Gửi lại" tái dùng đúng key+body; Dialog xác nhận trước khi nạp cấu hình mới |
| `apps/frontend/src/features/admin/settings/components/SettingsForm.test.tsx` (mới) | 24 test: validation, lưu thành công làm baseline mới, 409 giữ nháp, mạng/rejected, double-click, key mới mỗi lượt lưu, Dialog chỉ hủy/xác nhận đúng một lần |
| `apps/frontend/src/features/admin/settings/pages/SettingsPage.tsx` (sửa) | Wire form + `formEpoch`: remount form chỉ sau xác nhận và refetch có dữ liệu mới; sau save response server là baseline (`setQueryData`) |
| `apps/frontend/src/features/admin/settings/pages/SettingsPage.test.tsx` (sửa) | 7 test khi wire: gọi PATCH, nêu nền server response, nạp lại qua xác nhận, loading/error |
| `apps/frontend/e2e/settings.spec.ts` (sửa) | 3 E2E thật: lưu + refresh + mobile 390; hai tab one-win/one-409 kết thúc "Tải cấu hình mới"; ACL backend độc lập; cleanup restore bit-exact + xóa idempotency theo identity |
| `.github/workflows/ci.yml` (sửa) | Nhãn bước E2E ghi "settings saving M4.1.2" |
| `apps/backend/test/orders-foundation.integration.spec.ts` (sửa ngoài lô) | Spec này `create` row `default` trong test CHECK-bounds — vấp row fixture có sẵn từ M4.1.2 (P2002): chụp `original` một lần khi row có sẵn, test bounds chạy trên row đó, cleanup restore bit-exact khi foreign / xóa khi do run tạo |
| `apps/backend/test/production-config.integration.spec.ts` (sửa ngoài lô) | beforeAll ném `Invalid configuration: SESSION_SECRET` vì spread kéo secret `.env.test` (54 ký tự nhưng chứa chuỗi thử `test-only`) vào cấu hình production-shape: cung cấp `SESSION_SECRET` production-shape hợp lệ tường minh cho đúng spread này, validator giữ nguyên |
| `apps/frontend/vite.config.ts` (sửa ngoài lô) | `testTimeout: 15000` — hai lượt chạy đầy đủ frontend fail timeout khác nhau ở suite nặng (products/categories…), chạy riêng từng file thì đủ 55/55; 5s mặc định flaky dưới tải CPU local |
| `docs/m4-contract.md`, `docs/m4-implementation-plan.md`, `docs/local-trial-m4.md`, `docs/plan.md` | Ghi scope `settings.update` + chốt nhập tay ngân hàng; trạng thái M4.1.2; bảng thao tác chạy thử lưu/409/mạng/mobile; điểm dừng |

### Data flow / key

ADMIN sửa 6 trường → PATCH `/api/v1/admin/settings` kèm `Idempotency-Key` (`crypto.randomUUID()` mỗi lượt lưu) → SessionGuard/RolesGuard → ValidationPipe → `SettingsService.update` mở transaction `FOR UPDATE`, so `expectedVersion`, tăng `version`, ghi `IdempotencyRecord` cùng transaction → response là baseline mới, TanStack `setQueryData` → UI hiển thị "Đã lưu". Version cũ → 409: form khóa, giữ nháp, "Tải cấu hình mới" qua Dialog xác nhận; page chỉ remount (`formEpoch`) sau khi refetch trả dữ liệu mới. 409 cùng key khác hash → không tự đổi key, "Gửi lại" đúng command cũ.

- `expectedVersion`: phiên bản row mà client chụp khi mở form — server chỉ nhận đúng giá trị này (hoặc tạo mới khi chưa có row), lệch là 409.
- `Idempotency-Key` + hash canonical: cùng key cùng nội dung → replay; cùng key khác nội dung → 409; trường hợp "Gửi lại" không tạo key mới.
- `formEpoch` (SettingsPage): reload một chiều — form chỉ remount sau khi xác nhận và refetch đã trả dữ liệu mới.
- Máy trạng thái outcome của `SettingsForm`: quyết định khóa nội dung và hành động (Gửi lại / Tải cấu hình mới / mở lại sửa).
- `testTimeout: 15000` (`vite.config.ts`): mặc định 5s flaky với các suite nặng dưới tải CPU local.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| Backend unit RED → GREEN | 16/16 unit `SettingsService` (viết test trước khi có update; cả backend 32/32 trong Root `test`) |
| Integration settings RED → GREEN | RED đầu: spec tự create/restore row `default` lệch giữa hai trạng thái DB (row do run khác tạo sẵn → P2002); sửa bằng chụp `original` một lần (gồm `updatedAt`) + restore DELETE+INSERT bit-exact: 14/14 cả khi DB có row foreign lẫn trống; psql xác minh sau run: 77777/333/version 12/`updatedAt` giữ nguyên, 0 idempotency records |
| UI RED → GREEN | 24 form + 7 page = 31/31 sau hai vòng sửa test: thứ tự stub trong queue (reject-Once ưu tiên trước base), tránh `type('')` trên chuỗi rỗng, tách ca phụ thuộc exit-animation MUI Dialog trong jsdom thành 2 test theo hành vi |
| E2E settings | 3/3 sau sửa hai lỗi: Playwright không có `toHaveTextContent` (đổi sang `toContainText`) và `login()` bỏ assert URL không đúng cho CUSTOMER; psql xác minh restore bit-exact sau cả lượt E2E tái chạy |
| `./tools/npm.ps1 run test:integration` | 8 files, 65/65 (qua lệnh chuẩn npm) |
| `node tools/test-e2e.mjs` (12 file `implemented`) | 37/37 passed (2.2 phút) |
| Root `typecheck`, `build`, `test` | exit 0; build chỉ warn chunk > 500 kB (đã có, không mới); `test`: tools 8/8, backend 32/32, frontend 217/217 |
| CI GitHub | Chưa chạy (chưa commit/push) |

**Dừng sau M4.1.2 cho người dùng chạy thử theo [local-trial-m4.md M4.1.2](docs/local-trial-m4.md); M4.2.1 (giỏ hàng) chưa triển khai, cần kế hoạch riêng được duyệt.**

## Ngày 30/10/2026 — Sửa CI M4.1.1 sau merge main

- **Phạm vi:** người dùng yêu cầu sửa và push riêng lỗi test Cài đặt sau merge `ea002b4`; không đưa phần M4.1.2 đang làm dở vào commit. Bản sửa được làm trong checkout cách ly từ nhánh remote `feat/m4.0-foundation`.
- **Nguyên nhân:** header mới gọi `catalogApi.categories()`, trong khi test Cài đặt mock mọi `request()` trả object cấu hình. Header nhận object thay vì mảng, gây `categories.map is not a function`; test loading còn tiêu thụ mock request của Cài đặt cho danh mục.
- **File sửa:** `apps/frontend/src/features/admin/settings/pages/SettingsPage.test.tsx` thêm import và mock riêng `catalogApi.categories()` trả `[]` trong `renderPage()`; `progress.md` ghi kết quả. Không thay đổi hành vi ứng dụng.
- **Data flow:** header/menu đọc danh mục từ mock riêng; các mock request của từng test chỉ phục vụ luồng Cài đặt, nên lỗi tải và retry được kiểm tra đúng API.
- **RED:** chạy spec Cài đặt trên đúng checkout merge trước sửa: 4 failed, 2 passed và 3 lỗi chưa xử lý `categories.map is not a function`.
- **GREEN:** chạy `node <repo>/node_modules/vitest/vitest.mjs run --config vite.config.ts --maxWorkers=2` tại `apps/frontend`: **23 file, 219/219 test đạt**, không có lỗi chưa xử lý.
- **Typecheck:** chạy `node <repo>/node_modules/typescript/bin/tsc --noEmit` tại `apps/frontend`: exit 0. `git diff --check`: đạt.
- **Giới hạn:** không chạy lại build/backend/integration/E2E local vì bản sửa chỉ thay mock unit/UI; CI đầy đủ sẽ chạy khi push. Chưa có kết quả CI cho commit bản sửa tại thời điểm ghi mục này.
- **Key:** mock riêng ở ranh giới `catalogApi.categories` giữ kiểu dữ liệu mảng và không làm lệch thứ tự/số lần mock request của Cài đặt. Dừng sau bản sửa CI; M4.1.2 giữ nguyên ngoài commit.

## Ngày 30/10/2026 — M4.1.1: admin xem Cài đặt (chỉ đọc)

**Phạm vi được duyệt:** kế hoạch M4.1.1 gửi trong chat (ADMIN xem `/admin/settings` chỉ đọc; public allowlist hai trường; không PATCH/expectedVersion — thuộc M4.1.2). **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử, chưa nghiệm thu.**

### Thay đổi và file thực tế

| File | Thay đổi và lý do |
|---|---|
| `apps/backend/src/modules/settings/settings.service.ts` (mới) | Đọc ShopSettings id="default" — thiếu bản ghi trả mặc định an toàn (30000/120/null/version 0) **không ghi DB**; lỗi DB truyền qua cơ chế chung, không bị che bằng fallback; admin view đủ 7 trường, public view allowlist tường minh 2 trường |
| `apps/backend/src/modules/settings/admin-settings.controller.ts` (mới) | GET `/admin/settings` theo mẫu admin-categories: SessionGuard + RolesGuard + ADMIN; thừa hưởng no-store toàn cục của `application.ts` |
| `apps/backend/src/modules/settings/settings.controller.ts` (mới) | GET `/shop-settings/public` không yêu cầu đăng nhập, chỉ trả view public |
| `apps/backend/src/modules/settings/settings.module.ts` (mới) + `app.module.ts` | Đăng ký SettingsModule |
| `apps/backend/src/modules/settings/settings.service.spec.ts` (mới) | 4 unit: thiếu bản ghi → mặc định và không ghi DB (mock chỉ có findUnique — mọi write khiến test đỏ); trả đúng bản ghi đã lưu; public allowlist; lỗi DB truyền qua |
| `apps/backend/test/settings.integration.spec.ts` (mới) | 4 ca HTTP thật: ADMIN 200 đúng dữ liệu; 401 khách/403 CUSTOMER; public không đăng nhập chỉ có 2 trường; đọc lặp không đổi version/updatedAt. Không sửa/xóa row "default" có sẵn — chỉ tạo khi thiếu và đánh dấu dọn; cleanup thu lỗi + đếm sót |
| `apps/frontend/src/features/admin/settings/api/settings.api.ts` (mới) | Kiểu `AdminSettings` + `settingsApi.adminView` qua `request()` chung; không dùng public endpoint thay kiểm tra quyền |
| `apps/frontend/src/features/admin/settings/pages/SettingsPage.tsx` (mới) | Trang chỉ đọc: phí VND, hạn "X phút", ngân hàng/"Chưa cấu hình", loading/error/retry, về quản trị, ghi chú chưa có chỉnh sửa |
| `apps/frontend/src/features/admin/settings/pages/SettingsPage.test.tsx` (mới) | 6 UI test: dữ liệu + định dạng, 4×"Chưa cấu hình", loading/error/retry hồi phục, không có control lưu, chặn guest/CUSTOMER |
| `apps/frontend/src/app/App.tsx`, `features/admin/AdminPage.tsx` | Route `/admin/settings` qua PrivateRoute ADMIN; nút "Cài đặt" trên trang quản trị |
| `apps/frontend/e2e/settings.spec.ts` (mới) | 2 E2E: ADMIN từ nút Cài đặt đọc dữ liệu thật, refresh deep link, mobile 390 không tràn; ACL backend độc lập (401/403, public đúng 2 trường) |
| `package.json`, `.github/workflows/ci.yml` | Thêm settings.spec.ts vào bộ implemented; tên bước CI ghi đến M4.1.1 |
| `docs/m4-implementation-plan.md`, `docs/local-trial-m4.md`, `docs/plan.md` | Cập nhật trạng thái và hướng dẫn chạy thử M4.1.1 |

### Data flow / key

ADMIN mở Cài đặt → PrivateRoute ADMIN → `SettingsPage` gọi `settingsApi.adminView` qua `request()`/cookie → SessionGuard/RolesGuard → `SettingsService.adminView` đọc `shop_settings` id="default" → trả view đủ trường (không trả Prisma model) → TanStack Query cache hiển thị. Khách đọc `/shop-settings/public` → service trả allowlist 2 trường. GET không ghi DB; thiếu bản ghi trả mặc định trong response, không tạo row.

- `shop_settings` "default": bản ghi cấu hình duy nhất; chưa có thì response dùng DEFAULTS, không seed ngầm.
- Public allowlist: chỉ `shippingFeeVnd` + `bankDeadlineMinutes`; ngân hàng/version không rời backend.
- no-store toàn cục: cấu hình không bị trình duyệt/proxy giữ bản cũ.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| Unit service RED → GREEN | 4 test thất bại vì thiếu module; sau triển khai 4/4 |
| Integration RED → GREEN | Lượt đầu beforeAll fail: login thiếu CSRF token (403) — sửa helper lấy `/auth/csrf` trước login; sau đó 4/4 |
| UI RED → GREEN | 6 test thất bại vì route/chưa có (404); hai điểm chỉnh test trong lượt: tiền khớp bằng regex `/45\.000/` do formatter chèn U+00A0 trước ₫ (convention M3.3), và chờ PrivateRoute mount trước khi assert trạng thái loading; sau sửa 6/6 |
| E2E settings | Lượt đầu fail ở matcher fee `exact: true` (element chứa cả ký hiệu ₫) — bỏ exact, khớp phần số; sau sửa 2/2; ảnh mobile 390px agent đã xem: label rõ, xếp dọc, không tràn ngang |
| `./tools/npm.ps1 run test:integration` | 53 pass, chỉ `production-config` vẫn fail do secret `.env.test` máy (lỗi môi trường có sẵn từ M4.0.2, cần chủ shop tạo lại nếu muốn xanh hoàn toàn) |
| `./tools/npm.ps1 run typecheck`, `run build`, `test` | Ghi nhận ở mục kiểm chứng cuối phiên (mục dưới) |
| CI GitHub | Chưa chạy (chưa commit/push) |

**Dừng sau M4.1.1 cho người dùng chạy thử; M4.1.2 (lưu cài đặt) chưa triển khai.**

## Ngày 30/10/2026 — M4.0.1–M4.0.3: sửa lỗi review

**Phạm vi được duyệt:** người dùng duyệt sửa 4 nhóm lỗi review (idempotency effectKey, hiển thị lịch sử kho, đồng bộ tài liệu, độ tin cậy cleanup) và yêu cầu triển khai ngay trong phạm vi đó. **Đã viết, agent đã kiểm tra local; chờ người dùng kiểm tra, chưa nghiệm thu.** Không bắt đầu M4.1.

### Thay đổi và file thực tế

| File | Thay đổi và lý do |
|---|---|
| `apps/backend/test/inventory-orders.integration.spec.ts` | Thêm 2 test RED trước khi sửa: cùng base effectKey với tập SKU rời rạc (tuần tự và đồng thời) phải 409 và kho không đổi; fixture thêm 3 biến thể riêng (H/I/J) để các ca độc lập trạng thái |
| `apps/backend/src/modules/inventory/inventory-operations.service.ts` | Gắn một base effectKey với hash của toàn bộ operation: dòng ledger đầu (variantId nhỏ nhất) giữ base key làm anchor (unique sẵn có), dòng sau giữ `base:variantId`; precheck/recheck/replay tra theo anchor; replay fetch `base` hoặc prefix `base:` (dấu hai chấm chặn base dài hơn trùng tiền tố). Cùng key+nội dung replay an toàn, khác nội dung 409 kể cả SKU không giao nhau hay gọi đồng thời (P2002 hủy transaction bên thua). Không đổi schema, không phá thứ tự khóa/rollback/adjust M3 |
| `apps/frontend/src/features/admin/inventory/api/inventory.api.ts` | `MovementRow` thêm `actorType`, `source`, `effectKey` khớp response backend |
| `apps/frontend/src/features/admin/inventory/components/MovementHistory.tsx` | Reserve/release hiển thị nhãn "Giữ hàng cho đơn"/"Nhả giữ đơn" + "Đang giữ: X · Còn bán: Y" thay `+0` và `trước → sau` bằng nhau; điều chỉnh/xuất hàng giữ nguyên hiển thị tồn thực; giữ mobile/a11y |
| `apps/frontend/src/features/admin/inventory/components/MovementHistory.test.tsx`, `pages/InventoryPage.test.tsx` | Fixture thêm trường mới; thêm 2 test hiển thị theo source và 1 test giữ hiển thị adjust/ship |
| `apps/backend/test/orders-foundation.integration.spec.ts`, `test/inventory-orders.integration.spec.ts` | Cleanup không nuốt lỗi: thu lỗi từng bước + đếm sót fixture sau khi dọn, còn sót thì ném lỗi làm suite đỏ; bỏ khối dọn user vô dụng ở orders-foundation |
| `docs/plan.md`, `docs/local-trial-m4.md` | Ghi đúng trạng thái: M4.0.1–0.3 đã triển khai/kiểm tra local, chưa API/UI đặt hàng, chưa nghiệm thu; các phần sau vẫn chưa triển khai |

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| RED trước sửa | 2 test mới thất bại đúng lỗi: lần gọi thứ hai với SKU rời rạc không bị chặn (tuần tự) và cả hai transaction cùng thắng (đồng thời) |
| GREEN sau sửa | `inventory-orders.integration.spec.ts` 10/10, `orders-foundation.integration.spec.ts` 4/4; test UI inventory 58/58 |
| Dư phẩm DB test sau cleanup | Truy vấn trực tiếp `clothing_test`: 0 fixture còn sót (slug `inv-orders%`/`m4-foundation%`) |
| `./tools/npm.ps1 run typecheck`, `run build` | Đạt |
| `./tools/npm.ps1 test` | tools + backend unit đạt; frontend workspace riêng 184/184; một lượt full-run còn 1 test UI timeout do tải (pass khi chạy riêng, pattern đã ghi từ trước) |
| `./tools/npm.ps1 run test:integration` | 49/51: chỉ `production-config.integration.spec.ts` vẫn thất bại do secret `.env.test` máy chứa "test-only" (lỗi môi trường local có sẵn từ trước, đã ghi ở mục M4.0.2; cần chủ shop tạo lại `.env.test` nếu muốn xanh hoàn toàn) |
| `./tools/npm.ps1 run test:e2e:implemented` | 34/34 đạt |
| CI GitHub | Chưa chạy (chưa commit/push) |

**Dừng sau bản sửa cho người dùng kiểm tra; M4.1 chưa bắt đầu.**

## Ngày 29/10/2026 — M4.0.3: nghiệp vụ kho phục vụ đơn hàng

**Phạm vi được duyệt:** kế hoạch M4.0.3 trong bảng đã gửi (người dùng duyệt cả ba phần M4.0.1–0.3 bằng "oke code đi"). Chỉ thêm service nội bộ cho Orders gọi; không có endpoint/UI mới; không đổi API điều chỉnh admin M3. **Đã viết, agent đã kiểm tra local; chờ người dùng kiểm tra nền tảng, chưa nghiệm thu.**

### Thay đổi và file thực tế

| File | Thay đổi và lý do |
|---|---|
| `apps/backend/src/modules/inventory/inventory-operations.service.ts` (mới) | `reserve/release/ship` nhận `Prisma.TransactionClient` từ service điều phối — không tự mở transaction, không gọi module khác. Khóa dòng kho theo `variantId` tăng dần (`FOR UPDATE`), recheck effectKey sau khi có khóa, UPDATE có điều kiện + RETURNING bảo đảm `0 ≤ reserved ≤ onHand`, ghi `InventoryMovement` (actorType/source/effectKey + requestHash SHA-256 nội dung canonical) cùng transaction; replay cùng key+nội dung trả kết quả đã ghi, khác nội dung 409 |
| `apps/backend/src/modules/inventory/inventory.module.ts` | Đăng ký + export `InventoryOperationsService` để Orders (M4.3+) dùng |
| `apps/backend/src/modules/inventory/inventory.service.ts` | `movements()` chuẩn hóa `actor.name` luôn có: user → tên thật, GUEST → "Khách đặt hàng", SYSTEM → "Hệ thống"; thêm `actorType`/`source`/`effectKey` vào response (additive) — frontend hiện tại đọc `actor.name` không lỗi |
| `apps/backend/test/inventory-orders.integration.spec.ts` (mới) | 8 ca hành vi thật trên PostgreSQL `_test` |

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| RED trước implementation | spec mới thất bại "Cannot find module .../inventory-operations.service.js" — đúng nguyên nhân service chưa có |
| `inventory-orders.integration.spec.ts` sau triển khai | 8/8: reserve+replay không nhân đôi; cùng effectKey khác payload bị chặn; hai transaction tranh chiếc cuối chỉ một thắng; thiếu một SKU rollback cả giỏ; release (SYSTEM)/ship replay an toàn; hai giỏ ngược thứ tự không deadlock; transaction ngoài rollback cuốn cả kho + ledger; hồi quy adjust M3 + nhãn actor |
| Lỗi test đã sửa trong lượt | Hai test đầu dùng chung biến thể giữa các ca làm sai trạng thái — tách biến thể riêng cho từng ca (fixture 7 biến thể); một lượt cleanup văng giữa chừng ở lượt RED làm sót fixture — đã xóa đúng fixture sót khỏi `_test` và gia cố afterAll dọn từng bước độc lập |
| `./tools/npm.ps1 run test:e2e:implemented` cuối | 34/34 đạt (2,0 phút) sau khi dọn fixture sót; hai ca catalog-list trước đó fail do sản phẩm fixture của lượt RED còn PUBLISHED trong DB test, đã xử lý gốc |
| `./tools/npm.ps1 run typecheck`, `run build` | Đạt |

**Dừng sau M4.0.3 cho người dùng kiểm tra; không bắt đầu M4.1.**

## Ngày 29/10/2026 — M4.0.2: schema nền tảng đơn hàng

**Phạm vi được duyệt:** kế hoạch M4.0.2 trong bảng đã gửi, gồm hai điểm người dùng đã thấy khi duyệt: token một lần (replay không phát lại) và nới CHECK `inventory_effect_valid`. **Đã viết, agent đã kiểm tra local; migration đã áp dụng `clothing_local` và `clothing_test`; chưa đụng DB production.**

### Thay đổi và file thực tế

| File | Thay đổi và lý do |
|---|---|
| `apps/backend/prisma/schema.prisma` | Thêm enums `ActorType`/`OrderStatus`/`OrderMethod`/`OrderSource`/`InventoryEffectSource` và models `ShopSettings` (1 dòng, phí 30000/hạn 120 phút mặc định, ngân hàng nullable không default), `CheckoutQuote` (items snapshot + totals + expiresAt), `Order` (code unique, status, source, userId nullable, snapshot người nhận, tiền, bankDeadlineAt, `lookupTokenHash` unique chỉ hash, tracking/deliveredAt/cancelledAt, version), `OrderItem` (snapshot dòng, unique orderId+variantId), `OrderStatusHistory` (from/to, actorType, actorId nullable, reason, version), `IdempotencyRecord` (unique scope+identity+key, requestHash, resourceId, response Json, expiresAt) |
| `apps/backend/prisma/migrations/202610290001_m4_order_core/migration.sql` (mới) | Viết tay review được theo convention M3; `inventory_movements`: `actorId` nullable, thêm `actorType`/`source` (backfill ADMIN/ADMIN_ADJUSTMENT qua DEFAULT) và `effectKey` unique nullable; nới CHECK `inventory_effect_valid` bỏ `delta <> 0` (reserve/release không đổi onHand; hành vi admin không đổi); không xóa/sửa dữ liệu M3 |
| `apps/backend/test/orders-foundation.integration.spec.ts` (mới) | 4 ca schema: unique mã đơn/lookupTokenHash/idempotency; CHECK chặn tiền lệch/quantity sai/settings sai; snapshot Order+Item+History nguyên tử và rollback giữa chừng; movement guest/system không user + giữ bất biến |

### Data flow / key

Orders (M4.3) sẽ mở transaction: khóa hàng đơn → `InventoryOperationsService` giữ/nhả/xuất kho theo `effectKey` (`order:<orderId>:<effect>:<variantId>`) → ghi `OrderStatusHistory` + `IdempotencyRecord` cùng commit. `identity` idempotency do server cấp (`guest:<sessionId>` / `admin:<userId>` / `system:<job>`), không dùng IP. Token tra cứu chỉ lưu SHA-256 ở `orders.lookupTokenHash`.

- `effectKey`: tham chiếu hiệu ứng nghiệp vụ duy nhất của reserve/release/ship — chống lặp bằng unique + so hash.
- `lookupTokenHash`: chỉ bản băm token khách; token rõ không nằm trong DB/log/query.
- `orders_money_valid`/`order_item_fields_valid`/`checkout_quote_totals_valid`: CHECK bảo đảm tổng = subtotal + phí, lineTotal = đơn giá × số lượng 1..99.

### Kiểm tra thực tế và xử lý trong lượt

| Kiểm tra | Kết quả |
|---|---|
| RED trước migration | 4/4 test mới thất bại "table public.orders does not exist" / "column actorType does not exist" — đúng nguyên nhân |
| `prisma validate` + `migrate diff --from-config-datasource --to-schema` | Schema hợp lệ; hai DB khớp schema tuyệt đối sau khi áp (exit 0) |
| `migrate deploy` | Đã áp `clothing_local` và `clothing_test` (`202610290001_m4_order_core`); lượt đầu thiếu DEFAULT `CURRENT_TIMESTAMP` cho `updatedAt` so với Prisma 7 → đã gỡ đúng đối tượng mới của migration này trên hai DB local/test (không reset, không đụng dữ liệu M3) và deploy lại bản sửa, diff exit 0 |
| `orders-foundation.integration.spec.ts` | 4/4 đạt |
| `./tools/npm.ps1 run test:integration` chuẩn (secret máy) | 47/49: chỉ `production-config.integration.spec.ts` thất bại — **lỗi môi trường local có sẵn, không do M4**: `.env.test` của máy chứa chuỗi "test-only" mà guard production từ chối (spec/environment.ts không đổi; chạy lại cùng spec với secret tạm hợp lệ qua env đạt 2/2). Tôi không được phép đổi secret nên để nguyên, người dùng có thể tạo lại `.env.test` bằng `setup:local` nếu muốn xanh hoàn toàn |
| Full integration qua npm với secret tạm hợp lệ | 49/49 đạt (7 file) |

**Dừng sau M4.0.2; chuyển M4.0.3 theo kế hoạch đã duyệt.**

## Ngày 29/10/2026 — M4.0.1: chốt contract M4

**Phạm vi được duyệt:** kế hoạch M4.0.1 gửi trong chat (người dùng duyệt cả ba phần M4.0.1–M4.0.3 với hai điểm mặc định đã nêu: token phát một lần — replay không phát lại; nới CHECK `inventory_effect_valid` ở M4.0.2). Chỉ soạn contract và đồng bộ tài liệu; chưa viết code/schema/migration trong phần này.

### Thay đổi và file thực tế

- `docs/m4-contract.md` (mới): state machine 10 đường chuyển kèm hiệu ứng kho và đường đồng thời (một transition thắng bằng version dưới khóa hàng); tách ba chiều đơn/tiền/nghĩa vụ; snapshot bắt buộc; DTO/response/error dự kiến cho quote, tạo đơn, tra cứu, hủy, admin chuyển trạng thái (`QUOTE_CHANGED`/`OUT_OF_STOCK` 409, tra cứu 404 đồng nhất, 429); actor ADMIN/GUEST/SYSTEM với định danh server cấp, không dùng IP; idempotency scope server đặt, canonical hash SHA-256, cùng key+nội dung trả cùng resource, khác nội dung 409, record lưu response cùng commit; token ≥128 bit chỉ lưu SHA-256, replay không phát lại, tra cứu lại cấp token mới thay hash cũ; thứ tự khóa hàng đơn → variantId tăng dần → nguồn tiền; phân mục [ĐÃ DUYỆT]/[ĐỀ XUẤT]/[CƠ CHẾ] và mục "chưa chốt" (hoàn khi giao thất bại chờ duyệt trước M4.9.2).
- `docs/architecture.md`: thêm mục "Contract M4 (chốt ở M4.0.1)" tóm tắt và dẫn contract; ghi trước schema/operation M4.0.2/0.3 sẽ thêm gì.
- `docs/m4-implementation-plan.md`: đánh dấu M4.0.1 đã chốt, giữ phạm vi gốc làm tham chiếu; cập nhật điểm dừng.
- `docs/business-rules.md` **không sửa**: bản hiện hành 29/10/2026 đã ghi đúng chính sách đã duyệt (không tài khoản, 30.000đ, 2 giờ, VietQR in-app, đổi trả thủ công).

### Kiểm tra và điểm dừng

Là thay đổi tài liệu: rà chéo state machine với bảng "Đơn và hủy" của business-rules và bảng API của architecture — khớp; liên kết file hợp lệ; `git diff --check` đạt. Không chạy migration/test app chỉ vì có tài liệu. Token recovery: người dùng không chọn → mặc định phương án B đã công bố trong kế hoạch (token một lần, replay không phát lại); phương án HMAC ghi là phương án thay thế chờ duyệt trước M4.3.1.

**Dừng sau M4.0.1; chuyển M4.0.2 theo kế hoạch đã duyệt.**

## Ngày 29/10/2026 — Lập kế hoạch M4: Người B phụ trách toàn bộ

**Phạm vi đã duyệt:** người dùng chốt B thực hiện toàn bộ M4 và duyệt tạo tài liệu implementation/local cùng các liên kết chung bằng "oke làm đi"; sau đó yêu cầu tạo nhánh mới. Đã tạo `docs/m4-plan` từ `main` `9386f0a`. Chỉ lập tài liệu, chưa duyệt hoặc bắt đầu code bất kỳ phần chức năng M4 nào; không chạy test app/DB, migration, seed hay truy cập production trong lượt này.

### File thực tế

| File | Thay đổi |
|---|---|
| `docs/m4-implementation-plan.md` | Mới: roadmap M4.0–M4.11 chia nhỏ, toàn bộ thuộc B; phụ thuộc, file dự kiến, API/data flow, ràng buộc, test/race và điểm dừng |
| `docs/local-trial-m4.md` | Mới: chuẩn bị local, lệnh hiện có, URL tương lai, fixture/số kho-tiền mẫu và thao tác/kết quả mong đợi cùng mã phần; tất cả ca M4 đánh dấu chưa triển khai/chưa chạy |
| `docs/plan.md` | Thay phân công A/B của riêng M4 thành B toàn bộ, liên kết hai tài liệu; giữ phân công M3/M6/M7 |
| `README.md` | Thêm liên kết implementation và local M4 |
| `progress.md` | Ghi phạm vi tài liệu, trạng thái và điểm dừng |

Danh sách đúng kế hoạch được duyệt. Không sửa source/backend/frontend, schema, package/lockfile hoặc cấu hình deploy; không commit/push.

### Nội dung / data flow

Đối chiếu quy tắc shop thật và code hiện tại → lập bảng phụ thuộc/mã phần trong implementation → tạo ca local có cùng mã → liên kết từ plan/README. Chính sách đã chốt: checkout không tài khoản, phí30.000đ, hạn bank2giờ, VietQR trong ứng dụng shop, đổi trả thủ công. Không dùng phương án demo cũ yêu cầu CUSTOMER/email verified/hạn30phút.

- `M4.x.y`: mỗi lát cắt có phụ thuộc, tiêu chí kiểm chứng và điểm dừng riêng; phải gửi kế hoạch trong chat/chờ duyệt trước code.
- `implementation`: nguồn thứ tự kỹ thuật, file dự kiến và data flow; file mới vẫn phải chốt lại ở phần cụ thể, không tạo scaffold từ roadmap.
- `local-trial`: nguồn thao tác, URL và mong đợi, phân biệt DB local/`_test`/production; không phải bằng chứng đã chạy.

### Kiểm tra và điểm dừng

Đã rà nội dung/phụ thuộc, mã phần và liên kết: implementation có33 phần nhỏ, local có đúng33 phần tương ứng, không thiếu/trùng mã; các liên kết file trong5 tài liệu hợp lệ. Thứ tự thực hiện bao phủ đủ33 phần và đi sau các phụ thuộc cụ thể; `git diff --check` exit0, UTF-8 hợp lệ và không có conflict marker. Git xác nhận chỉ5 file Markdown, index rỗng. Không chạy typecheck/build/unit/integration/E2E vì chỉ sửa Markdown, không nhận kết quả các lượt M3 trước là kết quả của lượt này.

**M4 mới hoàn tất bước lập kế hoạch; chưa có chức năng M4 để thử.** Người dùng đọc hai tài liệu, phản hồi; bước tiếp theo đề xuất là gửi kế hoạch chi tiết M4.0.1 để duyệt, không tự triển khai. Trạng thái production/M3 giữ theo các mục riêng bên dưới.

## Ngày 30/10/2026 — M3.16.1: deploy lại VPS với giao diện UI.1–UI.4

**Phạm vi:** người dùng yêu cầu "deploy lại VPS". Triển khai source đã commit trên nhánh `feat/ui-storefront-redesign`, SHA `ad9c854bdb6435e3cd6f333dc1614c536cccbd29`; không sửa code ứng dụng, không commit/push/merge, không nhập sản phẩm hoặc tạo admin. **Đã deploy và agent đã kiểm tra local, CI và URL production; chờ người dùng chạy thử.**

- Release mới: `/srv/rmg-shop/releases/ui-20261030-ad9c854-01`; `/srv/rmg-shop/current` và `RMG_RELEASE` đã trỏ tới bản này sau khi API/web healthy. URL: [trang chủ](https://rmglabels.duckdns.org/) và [cửa hàng](https://rmglabels.duckdns.org/shop).
- Đóng gói 163 file từ đúng Git commit theo allowlist của hướng dẫn deploy; archive `source-reviewed.tar.gz` có SHA256 `825bdfad69e2cb02f3748b615b400194ac93a49c687bdbb4a5bd6e0a9f01318c`, đã đối chiếu sau khi tải lên VPS. Không kèm env thật, dữ liệu local, dependency hoặc build artifact Windows; image build lại trên Linux.
- API image ID `sha256:03d3d4ea8c525298150c464e3f701c3d8b5668e2b7a06ce2854920e552b1e38d`; web `sha256:b8ac73c82616c718852a14ed1cce0a0a8f3d6e0ef74243584dae12b7c660f69f`; migration runner `sha256:dfd9a11b3b6c6d7133d8e1874572100d327c8bc0378afd7e277957de1750bee5`.
- Schema, hai migration và cấu hình Docker/Compose có checksum khớp bản cũ. `prisma migrate status` xác nhận schema cập nhật; `migrate deploy` báo không có migration chờ áp dụng. Chỉ recreate API/web với `--no-deps`; ID container DB không đổi, volume vẫn là `rmg-shop_postgres_data`. Không đọc bảng dữ liệu khách, seed hoặc thay đổi schema.
- File probe riêng của lượt deploy tồn tại trong uploads qua lần recreate API và đã được xóa đúng file sau kiểm tra. Secret được giữ nguyên; file env vẫn `0600 root:root`. Release/image cũ `m3-16-1-20261029-174430` còn để rollback; cơ chế rollback khi lỗi health đã chuẩn bị nhưng không phải kích hoạt.
- Data flow vận hành: snapshot commit → tải lên release mới và kiểm tra SHA256 → build image Linux → xác nhận migration → thay API/web và đợi healthy → kiểm tra HTTPS/bundle → đổi symlink `current`. FE tiếp tục gọi `/api/v1` qua nginx tới API và PostgreSQL/ảnh persistent hiện có.

| Kiểm tra mới trong lượt này | Kết quả |
|---|---|
| `./tools/npm.ps1 run typecheck`, `./tools/npm.ps1 run build` | Đạt; còn cảnh báo bundle >500 kB như trước |
| `./tools/npm.ps1 test` | 8 công cụ + 13 backend + 211 frontend, tổng 232 bài đạt |
| `./tools/npm.ps1 run test:integration` | 38/38; lần đầu lỗi kết nối vì container PostgreSQL local đang dừng, bật lại container có sẵn rồi chạy lại đạt |
| `./tools/npm.ps1 run test:e2e:implemented` với DB `_test` và Chromium riêng | 34/34, 46.5 giây |
| CI của đúng SHA triển khai | Hai lượt hoàn tất thành công: [40920149321](https://github.com/tangthinh955-ops/clothing-shop/actions/runs/40920149321), [40919923440](https://github.com/tangthinh955-ops/clothing-shop/actions/runs/40919923440) |
| Docker/HTTPS/API production | Cả ba dịch vụ healthy; readiness `200 {"status":"ok"}`; HTTP→HTTPS; admin không có phiên trả 401; Swagger 404; cookie `__Host-shop.sid` có Secure/HttpOnly/SameSite=Lax/Path=/, không Domain; CSP/HSTS có mặt; asset mới `index-CDEVY-r_.js` cache immutable |
| Playwright trên URL thật, 1440px và 390px | Trang chủ, `/shop`, menu/nav, tìm kiếm, đổi sắp xếp rồi reload, deep link `/shipping` đạt; font Be Vietnam Pro nạp; không tràn ngang, không page error hoặc HTTP 5xx; browser/context đã đóng đúng cách |
| Rà ảnh chụp và kiểm tra cuối | Đã xem ảnh trang chủ desktop/mobile và `/shop` mobile; đúng giao diện mới và empty state. Xác nhận lại release/tag, health, file probe đã dọn và image cũ còn |

**File trong repo đổi ở lượt này:** `progress.md` ghi bằng chứng và điểm dừng; `README.md` cập nhật bản đang chạy. Archive/ảnh kiểm tra ở `.local/deploy/` được ignore, không đưa vào Git. Không có key ứng dụng mới.

**Chạy thử:** mở trang chủ → **Xem bộ sưu tập**; trên điện thoại thử menu và tìm kiếm; tại `/shop` đổi thứ tự sắp xếp rồi tải lại. Kết quả mong đợi: giao diện mới, filter giữ trên URL, hiện **0 sản phẩm** vì catalog công khai đang trống. Chưa kiểm tra trang chi tiết sản phẩm thật trên production; luồng có sản phẩm đã được kiểm tra bằng fixture local/E2E, không tạo dữ liệu thử trên VPS. Các giới hạn M4/M3.17/M6.2/M6.3 giữ nguyên; dừng chờ người dùng thử, chưa xem là nghiệm thu mở bán.

## Ngày 30/10/2026 — UI.4: trang chi tiết sản phẩm

**Phạm vi đã duyệt:** người dùng duyệt kế hoạch UI.4 ("oke"). Làm tiếp trên nhánh `feat/ui.1-storefront-shell` (UI.1–UI.4 chưa commit). Xong UI.4 là xong lộ trình UI.0–UI.4. **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.**

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/catalog/pages/ProductDetailPage.tsx` | Chỉ còn trạng thái tải/lỗi/không tìm thấy và `ProductView`: đường dẫn "Tất cả sản phẩm › danh mục", lưới ảnh + khung thông tin dính khi cuộn (máy tính), giá, tồn, chọn biến thể, nút đặt, mô tả, chính sách |
| `features/catalog/components/ProductGallery.tsx` (mới) | Một khối ảnh: máy tính lưới 2 cột tất cả ảnh, điện thoại vuốt ngang có số "1 / N"; alt "Ảnh i của …"; bỏ hàng ảnh nhỏ |
| `features/catalog/components/VariantPicker.tsx` (mới) | Chọn màu (màu đầu chọn sẵn) rồi size của màu đó, xếp XS→3XL; size hết hàng gạch ngang, tên đọc "M, hết hàng"; link "Bảng size". Đổi màu thì bỏ size đã chọn để tồn/giá không thuộc biến thể sai |
| `features/catalog/components/OrderByMessage.tsx` (mới) | Nút "Nhắn shop qua Instagram để đặt" (tab mới, `noopener noreferrer`) + "Mã sản phẩm: SKU" khi đã chọn đủ |
| `features/catalog/components/ProductPolicies.tsx` (mới) | Mục gập Giao hàng, Đổi & trả đọc từ `features/information/content/policies.ts` (không chép lại nội dung) + link xem đầy đủ |
| `features/catalog/catalogFormat.ts` (mới) | `formatMoney`, `priceLabel` ("Từ …" chỉ khi giá khác nhau), `sortSizes` — dùng chung cho card và trang chi tiết (chuyển từ `ProductCard.tsx`) |
| `shared/ui/icons.tsx` | Thêm `ExpandIcon` cho mục gập |
| Test | `ProductDetailPage.test.tsx` viết lại 8 ca (ảnh đánh số, màu chọn sẵn/size theo màu, giá–tồn–SKU, đổi màu bỏ size, size hết hàng, nút Instagram, mục gập chính sách), giữ 4 ca lỗi/không tìm thấy/đang tải/không ảnh; E2E `catalog-detail.spec.ts`, `catalog.spec.ts` (chọn size), `products.spec.ts` (giá một mức) |

**TDD:** 8 ca RED (chưa có ảnh đánh số, chọn màu/size, SKU, nút Instagram, mục gập) → GREEN 12/12.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | Đạt |
| `npm test` | 8 công cụ + 13 backend + 211 frontend |
| `npm run test:integration` | 38/38 |
| `npm run test:e2e:implemented` (DB `_test`) | 34/34 (44.6s); lượt đầu 33/34 vì `catalog.spec.ts` còn bấm nút "M · đen" cũ — đã sửa sang chọn size |
| Chụp màn hình Playwright 390px và 1440px (trước/sau chọn size, mở mục Giao hàng) | Không tràn ngang |

**Giới hạn:** đặt hàng vẫn qua Instagram cho tới M4 (giỏ hàng); ảnh chưa phóng to khi bấm; không có bảng size riêng theo sản phẩm (trang Bảng size chung). **Chạy thử:** [docs/local-trial-m3.md](docs/local-trial-m3.md) § UI.4. **Dừng chờ người dùng thử.**

## Ngày 30/10/2026 — UI.3: lưới và bộ lọc trang `/shop`

**Phạm vi đã duyệt:** người dùng duyệt kế hoạch UI.3 ("oke"), gồm bỏ bảng lọc trượt trên điện thoại vì chỉ có 2 bộ lọc (danh mục, sắp xếp). Làm tiếp trên nhánh `feat/ui.1-storefront-shell` (UI.1–UI.3 chưa commit). **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.**

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/catalog/pages/CatalogPage.tsx` | Còn 77 dòng: tiêu đề động ("Tất cả sản phẩm" / tên danh mục / "Kết quả cho “…”", cả tiêu đề tab), thanh lọc, lưới 2/3/4 cột, phân trang giữa; bỏ dòng "EVERYDAY ESSENTIALS", đoạn mô tả kỹ thuật và ô tìm riêng (header đã có) |
| `features/catalog/hooks/useCatalogFilters.ts` (mới) | Đọc/kiểm tra/đổi `q`, `page`, `sort`, `categoryId` trên URL, tách nguyên từ page cũ (cùng quy tắc kiểm tra) |
| `features/catalog/components/CatalogToolbar.tsx` (mới) | Nhóm nút danh mục bo tròn (`aria-pressed`, điện thoại vuốt ngang); số sản phẩm; nhãn "Tìm: “…” ✕" khi đang tìm; "Xóa lọc"; ô "Thứ tự sắp xếp" gọn; báo khi không tải được danh mục |
| `features/catalog/components/ProductCard.tsx` | Máy có chuột rê lên card thì hiện ảnh thứ 2 (ảnh trang trí `alt=""`, không đọc hai lần); màn cảm ứng giữ ảnh bìa |
| Test | `CatalogPage.test.tsx`: lọc bằng nút danh mục (giữ sắp xếp, về trang 1, đổi tiêu đề), xóa tìm kiếm bằng ✕ và Back khôi phục, đọc bộ lọc từ URL qua tiêu đề/nút đang chọn; `ProductCard.test.tsx` +2 (ảnh thứ 2); `StoreLayout.test` tiêu đề sau khi tìm; E2E `catalog-list.spec.ts` theo tiêu đề/nút/số sản phẩm mới |

**TDD:** 6 test RED (tiêu đề động, nút danh mục, nhãn tìm kiếm, ảnh thứ 2) → GREEN. Các test cũ về sắp xếp, phân trang giữ lưới, URL sai, danh mục đã tắt, lỗi/thử lại giữ nguyên và đạt.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | Đạt |
| `npm test` | 8 công cụ + 13 backend + 209 frontend |
| `npm run test:integration` | 38/38 |
| `npm run test:e2e:implemented` (DB `_test`) | 34/34 (44.3s) |
| Chụp màn hình Playwright 390px và 1440px (mặc định, lọc danh mục, tìm kiếm, rê chuột) | Không tràn ngang; ảnh chụp phát hiện nút danh mục chưa bo tròn (số `999` bị nhân với bo góc 0 của theme) và hàng nút thụt lề trên điện thoại (Stack ghi đè margin) — đã sửa và chụp lại |

**Giới hạn:** tìm từ header thay bộ lọc hiện tại bằng đúng từ khóa (không giữ danh mục/sắp xếp đang chọn); trang chi tiết chưa đổi (UI.4). **Chạy thử:** [docs/local-trial-m3.md](docs/local-trial-m3.md) § UI.3. **Dừng chờ người dùng thử.**

## Ngày 29/10/2026 — UI.2: trang chủ `/`

**Phạm vi đã duyệt:** người dùng xem UI.1 ("oke") rồi duyệt kế hoạch UI.2 ("oke làm tiếp đi"). Làm tiếp trên nhánh `feat/ui.1-storefront-shell` (UI.1 chưa commit; PR #17 đã CLEAN, chờ người dùng merge). **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.**

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/catalog/pages/HomePage.tsx` (mới) | Trang chủ: banner, dải danh mục, lưới 8 hàng mới + "Xem tất cả sản phẩm"; trạng thái đang tải, lỗi có "Tải lại", rỗng có link Instagram; tiêu đề tab "RMG Labels" |
| `features/catalog/components/HomeHero.tsx` (mới) | Banner: ảnh đầu của sản phẩm mới nhất có ảnh (bấm vào mở sản phẩm), khối đen "Bộ sưu tập mới" + nút "Xem bộ sưu tập"; chưa có hàng thì chỉ còn khối chữ. Câu chữ chỉ nêu sự thật đã có trong chính sách, không tự đặt slogan |
| `features/catalog/components/CategoryStrip.tsx` (mới) | Ô danh mục có mũi tên; điện thoại vuốt ngang, máy tính lưới 4 cột |
| `features/catalog/components/ProductCard.tsx` (mới) | Card dùng chung: ảnh 3:4 nền xám nhạt (phóng nhẹ khi rê chuột), danh mục, tên (link phủ cả card), giá đậm — "Từ …" chỉ khi các biến thể đang bật có giá khác nhau, dải size theo thứ tự XS→3XL và số màu |
| `features/catalog/hooks/useCatalogCategories.ts` | Chuyển từ `layouts/store/useStoreCategories.ts` vì trang chủ cũng dùng; header/menu/footer import chỗ mới |
| `features/catalog/api/catalog.api.ts` | Thêm `catalogHomeKey` |
| `features/catalog/pages/CatalogPage.tsx` | Bỏ card cũ, dùng `ProductCard` (lưới/bộ lọc giữ nguyên tới UI.3) |
| `app/App.tsx`, `layouts/store/StoreHeader.tsx` | `/` hiển thị trang chủ thay vì chuyển sang `/shop`; logo dẫn về `/` |
| Test | Mới `ProductCard.test.tsx` (4), `HomePage.test.tsx` (5); `StoreLayout.test` logo → `/`; `CatalogPage.test` giá một mức không còn chữ "Giá từ" |

**TDD:** 9 test mới + 2 test sửa RED (chưa có card/trang chủ, logo vẫn `/shop`, card ghi "Giá từ") → GREEN.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | Đạt |
| `npm test` | 8 công cụ + 13 backend + 207 frontend |
| `npm run test:integration` | 38/38 |
| `npm run test:e2e:implemented` (DB `_test`) | 34/34 (45.2s) |
| Chụp màn hình Playwright 390px và 1440px (`/`, `/shop`) | Không tràn ngang; banner, dải danh mục, lưới hàng mới hiển thị đúng dữ liệu local |

**Giới hạn:** `/shop` vẫn lưới 1 cột trên điện thoại và bộ lọc cũ (UI.3); trang chi tiết chưa đổi (UI.4); chưa có nhãn "Mới" vì API chưa trả ngày đăng. **Chạy thử:** [docs/local-trial-m3.md](docs/local-trial-m3.md) § UI.2. **Dừng chờ người dùng thử.**

## Ngày 29/10/2026 — UI.1: khung cửa hàng mới (theme, header, footer)

**Phạm vi đã duyệt:** người dùng duyệt lộ trình UI.0–UI.4 (tham khảo cách trình bày của Uniqlo, không dùng nhận diện của họ) cùng 4 lựa chọn: đen/trắng + một màu nhấn, logo chữ, font `@fontsource/be-vietnam-pro` tự host, nút "Nhắn shop qua Instagram" ở UI.4; sau đó duyệt kế hoạch chi tiết UI.1 ("oke"). **UI.0:** merge `main` vào `feat/m3.15-real-storefront` (giữ cả mục M3.15 và M3.16 trong `progress.md`, `docs/local-trial-m3.md`), kiểm tra lại đạt (unit 8 + 13 + 193, integration 38/38, E2E 34/34), push; PR #17 hết xung đột, chờ CI và merge. **UI.1:** nhánh `feat/ui.1-storefront-shell` tách từ nhánh M3.15 vì PR #17 chưa merge; chỉ mở PR sau khi M3.15 vào `main`. **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.**

| File | Thay đổi |
|---|---|
| `apps/frontend/package.json`, `package-lock.json` | Thêm `@fontsource/be-vietnam-pro@5.3.0` (bản cố định) |
| `apps/frontend/src/main.tsx` | Nạp font tự host, chỉ bộ chữ tiếng Việt + Latin, độ đậm 400/500/700 (6 file woff2, mỗi file 11–22 kB) |
| `apps/frontend/src/theme/theme.ts` | Nền trắng, chữ `#111`, màu nhấn `#b42318` (khai báo sẵn cho nhãn "Mới"), bo góc 0, tiêu đề đậm không chân; `Paper elevation={0}` có viền mảnh để các khung admin không chìm trên nền trắng |
| `apps/frontend/src/layouts/StoreLayout.tsx` | Chỉ ghép dải thông báo, header, nội dung và footer |
| `apps/frontend/src/layouts/store/` (mới) | `AnnouncementBar` (dải đen "Giao hàng toàn quốc · Phí 30.000đ · Kiểm hàng khi nhận"); `StoreHeader` (dính khi cuộn, nav danh mục trên máy tính có gạch chân mục đang xem, nút ☰, nút "Mở ô tìm kiếm", link Quản trị cho admin); `HeaderSearch` (ô tìm, Enter → `/shop?q=…`, Esc đóng); `MobileMenu` (menu trượt: danh mục + hỗ trợ khách hàng, bấm link thì đóng); `StoreFooter` (3 cột: người bán, Hỗ trợ khách hàng, Mua sắm); `useStoreCategories` (dùng chung cache `catalogCategoriesKey`); `storeLinks` |
| `apps/frontend/src/shared/ui/icons.tsx` (mới) | 3 biểu tượng nét (menu, tìm, đóng) bằng `SvgIcon`, không thêm `@mui/icons-material` |
| `CatalogPage.tsx`, `ProductDetailPage.tsx`, `AuthLayout.tsx` | Bỏ font Georgia đặt cứng để dùng font theme; nút "Tìm kiếm" của `/shop` không xuống dòng với font mới |
| Test | `StoreLayout.test.tsx` +5 (dải thông báo, cột Mua sắm, menu điện thoại mở/đóng bằng Esc và khi bấm link, tìm kiếm từ trang bất kỳ), 3 test cũ kiểm tra trong `banner` thay vì nav; 5 file test admin/App stub `catalogApi.categories` vì header gọi thêm `/categories`; `CatalogPage.test` chỉ kiểm tra không gọi API sản phẩm khi URL sai; E2E `auth.spec.ts` dùng tên link mới "Tất cả sản phẩm" |
| `docs/plan.md`, `docs/local-trial-m3.md` | Thêm UI.0–UI.4 vào lộ trình; mục chạy thử UI.1 |

**TDD:** 5 test mới RED (chưa có dải thông báo, menu, ô tìm kiếm, cột Mua sắm) → GREEN 8/8. E2E bắt được hai nút cùng tên "Tìm kiếm" (header và trang kho) → đổi nút header thành "Mở ô tìm kiếm".

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | Đạt (cảnh báo chunk >500 kB như trước) |
| `npm test` | 8 công cụ + 13 backend + 198 frontend |
| `npm run test:integration` | 38/38 |
| `npm run test:e2e:implemented` (DB `_test`) | 34/34 (44.1s) |
| Chụp màn hình Playwright 390px và 1440px (`/shop`, `/shipping`, menu, ô tìm kiếm, footer) | Không tràn ngang (`scrollWidth − innerWidth = 0`), font Be Vietnam Pro đã nạp, header dính khi cuộn |

**Giới hạn:** trang chủ `/`, card sản phẩm/bộ lọc `/shop` và trang chi tiết chưa đổi bố cục (UI.2–UI.4); logo vẫn trỏ `/shop` cho tới khi có trang chủ. **Chạy thử:** [docs/local-trial-m3.md](docs/local-trial-m3.md) § UI.1. **Dừng chờ người dùng thử.**

## Ngày 29/10/2026 — M3.15: cửa hàng mang thông tin thật, bỏ dấu vết demo

**Phạm vi đã duyệt:** người dùng duyệt kế hoạch M3.15 ("oke"): tên shop **RMG Labels**, người bán cá nhân ở TP. Hồ Chí Minh, Instagram @rmglabels, nội dung chính sách theo đề xuất (đổi trả 7 ngày, còn tag, khách trả phí đổi theo nhu cầu, shop chịu phí hàng lỗi; giao toàn quốc 30.000đ, TP.HCM 1–2 ngày/tỉnh 2–5 ngày, kiểm hàng COD; COD/VietQR hạn 2 giờ; bảo mật dữ liệu). SĐT/Zalo, email chưa có nên không hiển thị (không điền giả). Nhánh `feat/m3.15-real-storefront` từ `main`. **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.**

| File | Thay đổi |
|---|---|
| `apps/frontend/src/shared/shop.ts` (mới) | `SHOP_NAME`, `seller` (tên, người bán, khu vực, Instagram; phone/email null) và `pageTitle()`. Đặt ở `shared` thay vì `features/information/content/shop.ts` như kế hoạch vì trang admin và layout cùng dùng, tránh import chéo feature |
| `apps/frontend/src/features/information/content/policies.ts`, `pages/PolicyPage.tsx` | Chính sách chia mục; nội dung thật cho Giao hàng, Đổi & trả, Liên hệ (lấy từ `seller`, chỉ hiện kênh đã có); thêm `/payment` và `/privacy` |
| `apps/frontend/src/layouts/StoreLayout.tsx` | Bỏ banner/dòng demo; tên RMG LABELS; header không còn Đăng nhập/Tài khoản của khách (admin vẫn thấy Quản trị); chân trang có người bán, Instagram và 5 link chính sách |
| `layouts/AuthLayout.tsx`, `features/auth/pages/AuthPage.tsx` | Tên shop; trang đăng nhập bỏ link "Đăng ký" (route `/register` giữ nguyên, không còn link tới) |
| 10 trang khác (`AccountPage`, `AdminPage`, `CategoriesPage`, `InventoryPage`, 3 trang sản phẩm admin, `CatalogPage`, `ProductDetailPage`), `index.html` | Tiêu đề/thương hiệu dùng `pageTitle`/`SHOP_NAME` thay "Clothing Shop"; meta mô tả không tự thêm định vị thương hiệu |
| `apps/backend/src/cli/seed-demo.ts` | `NODE_ENV=production` → báo lỗi và thoát trước khi đọc cấu hình hay kết nối DB |
| Test | Mới `StoreLayout.test.tsx` (3), `PolicyPage.test.tsx` (5); `App.test.tsx` +1; `seed-demo.integration.spec.ts` +1; E2E `auth.spec.ts` theo header mới |
| `README.md`, `docs/local-trial-m3.md` | Mục M3.15; `seed:demo` từ chối production |

**TDD:** 8 test UI RED (còn banner demo, tên cũ, link đăng nhập/đăng ký, chưa có trang thanh toán/bảo mật) → GREEN 20/20. Seed: RED vì lệnh chỉ dừng tình cờ do cấu hình test không hợp lệ cho production (cấu hình production thật sẽ nhập demo) → GREEN sau chặn có chủ đích.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | Đạt |
| `npm test` | 8 công cụ + 9 backend + 193 frontend |
| `npm run test:integration` | 36/36 |
| `npm run test:e2e:implemented` (DB `_test`) | 34/34 (42.8s) |

**Còn trước mở bán:** SĐT/Zalo và email của shop (sửa `shared/shop.ts`); thủ tục website bán hàng với Bộ Công Thương do chủ shop làm. **Chạy thử:** [docs/local-trial-m3.md](docs/local-trial-m3.md) § M3.15. **Dừng chờ người dùng thử.**


## Ngày 29/10/2026 — Chốt Git M3.16 và M3.16.1

- Người dùng yêu cầu commit/push rồi bổ sung tạo PR vào `main`. Phạm vi là 21 file cấu hình backend production, test, Docker/nginx, template env và tài liệu M3.16/M3.16.1 trên nhánh `feat/m3.16-vps-config`; không gộp M3.15, không tự merge PR hoặc triển khai lại VPS trong bước Git.
- Trước commit đã fetch `origin`, xác nhận remote `https://github.com/tangthinh955-ops/clothing-shop.git`, nhánh đích `main` và chưa có PR của nhánh này. Giữ tác giả Git hiện tại, không thêm dòng ghi công AI.
- Kiểm tra mới trong lượt Git: `./tools/npm.ps1 run typecheck`, `./tools/npm.ps1 run build` và `./tools/npm.ps1 test` đều exit 0; test đạt 8 công cụ + 13 backend + 184 frontend. Build vẫn có cảnh báo chunk >500 kB. Integration 37/37, E2E 34/34 và các smoke test VPS ở mục M3.16.1 bên dưới là bằng chứng của lượt deploy trước, không chạy lại trong bước Git vì code không đổi.
- Rà diff, index, danh sách file, mẫu token/private key và ignore: không phát hiện secret theo mẫu; `git ls-files -ci --exclude-standard` rỗng. Chỉ đưa template env vào commit; env thật, khóa Resend, dữ liệu shop, `.local/`, dependency và build artifact giữ ngoài Git.
- Điểm dừng của yêu cầu Git: commit/push nhánh và mở PR vào `main` để review; chưa merge, chưa xác nhận CI của commit mới. Trạng thái vận hành/giới hạn VPS giữ như mục M3.16.1.

## Ngày 29/10/2026 — M3.16.1: deploy catalog/API lên VPS qua HTTPS

**Phạm vi đã duyệt:** bảng kế hoạch M3.16.1 trong chat, người dùng đồng ý triển khai lên VPS/domain được cung cấp. Thực hiện sớm phần deploy catalog/API của M6.1; giữ riêng nhập sản phẩm, tạo admin, backup ngoài VPS và các luồng M4/M3.17. **Đã deploy và agent đã kiểm tra URL công khai, persistence và gia hạn chứng chỉ; chờ người dùng chạy thử.**

### Bản triển khai và quyền sở hữu thay đổi

- Dùng nhánh sẵn có `feat/m3.16-vps-config`, base `2e3c2cb`, giữ toàn bộ 13 file M3.16 có sẵn trước lượt này; không nhận phần cấu hình HOST/trustProxyHops/uploadsDir và production tests cũ là mới viết trong lượt deploy. Chưa commit/push, chưa có CI cho snapshot thủ công này. Kế hoạch cụ thể được duyệt dùng kiểm tra local trước deploy; pipeline deploy sau CI vẫn thuộc M6.1.
- Release `/srv/rmg-shop/releases/m3-16-1-20261029-174430`, symlink `/srv/rmg-shop/current`. Source cuối lưu trong `source-reviewed.tar.gz`, SHA256 `e57b1babc40a0d955c29b915865817116a8805d8971abe98f543917aa0dfe923`; archive đã loại env thật, dữ liệu ảnh/CSV, dependency Windows và build artifact. Build lại trên Linux.
- API image ID `sha256:3e69d8349803136239018590c44444fb268cb2f82ea695005f59d6344eefe3b7`; web `sha256:17f6a1347185ee5fbb7a349756c1ac7fbdd7688ef163e4fed5e3a0fb0bfb11e6`; migration runner `sha256:8a001c680ea8eac876d686e80407b6f7beb298c235dc7a1033c5e87e5ada52f6`.
- Chỉ thêm Compose project `rmg-shop`, virtual host RMG và hook gia hạn riêng; nginx cũ được sao lưu tại `/srv/rmg-shop/backups/nginx-before-rmg.tar.gz` trên VPS. Các container ứng dụng cũ giữ uptime và trạng thái; không sửa DB/volume của chúng.

### File thực tế thêm/sửa trong lượt này

| File | Thay đổi |
|---|---|
| `.dockerignore` (mới) | Loại env, dependency, generated/build/test artifact, dữ liệu local và thư mục agent khỏi build context |
| `deploy/Dockerfile` (mới) | Multi-stage Node 24.22.1/OpenSSL, generate Prisma/build Linux, runtime API chạy user node, frontend nginx và migration runner riêng |
| `deploy/compose.production.yml` (mới) | Dịch vụ DB/API/web riêng, migration tường minh, healthcheck, restart policy, giới hạn tài nguyên/log, ảnh persistent và secret mount |
| `deploy/nginx/frontend.conf` (mới) | SPA/deep link và cache asset có hash |
| `deploy/nginx/rmglabels.conf` (mới) | HTTP→HTTPS, ACME, proxy API giữ nguyên `/api`, ghi đè forwarded headers; CSP/HSTS cho SPA |
| `deploy/production.env.example` (mới) | Placeholder cho cấu hình production; không chứa key/password thật |
| `docs/deployment-guide.md` (mới) | Bố cục VPS, build/start/migration/HTTPS, kiểm tra, cập nhật/rollback và giới hạn |
| `README.md` | Thêm hướng dẫn deploy production và giới hạn email thử; giữ các thay đổi M3.16 đã có |
| `docs/plan.md` | Ghi M3.16.1 triển khai sớm phần M6.1, không đánh dấu toàn bộ vận hành/CI/backup hoàn tất |
| `apps/backend/src/modules/uploads/media.controller.ts` | Sửa blocker review trong phần M3.16 đã có: chỉ đặt cache public sau khi đọc ảnh thành công |
| `apps/backend/test/catalog.integration.spec.ts` | Thêm kiểm tra lỗi media 404/400 phải giữ `no-store`; giữ các thay đổi cũ |
| `progress.md` | Ghi phạm vi, nguồn gốc thay đổi, bằng chứng và điểm dừng của lượt deploy |

Hai file media/test được sửa thêm so với bảng deploy ban đầu để xử lý blocker thuộc cấu hình M3.16 trước khi đưa lên VPS. Không đổi nghiệp vụ catalog/kho, không thêm dependency ứng dụng hoặc migration mới.

### Data flow và key

Trình duyệt → nginx HTTPS của host → frontend ở `127.0.0.1:4180` hoặc API ở `127.0.0.1:4200` → PostgreSQL riêng trên mạng Docker nội bộ và thư mục ảnh `/var/lib/rmg-shop/uploads`. API chạy production, nhận HTTPS/IP qua đúng một reverse proxy; ảnh đọc thành công mới được cache công khai, lỗi vẫn `no-store`.

- `rmg-shop`: tên Compose project cố định, tách network/volume/container khỏi ứng dụng khác.
- `RMG_RELEASE`: tag chung cho ba image; source snapshot và image ID ghi ở trên giúp đối chiếu/rollback.
- `UPLOADS_DIR`: bind mount persistent, UID/GID 1000 và quyền 0750; API vẫn chạy với root filesystem chỉ đọc.
- `TRUST_PROXY=1`: backend hiểu HTTPS phía nginx, phát cookie `__Host-shop.sid` bảo mật; nginx ghi đè forwarded headers.
- Role DB `rmg_shop`: LOGIN và owner database mới, không SUPERUSER/CREATEDB/CREATEROLE/REPLICATION. Secret DB/session sinh trực tiếp trên VPS; file env/secret root:root 0600 trong thư mục 0700, không đưa vào Git/image/source/log.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| `./tools/npm.ps1 run typecheck`, `run build` | Exit 0; frontend còn cảnh báo chunk >500 kB có sẵn |
| `./tools/npm.ps1 test` sau sửa review | 8 công cụ + 13 backend + 184 frontend đạt |
| Regression cache media | RED đúng lý do: 404 nhận `public, max-age=86400` thay vì `no-store`; sửa sau `await read` → GREEN |
| `./tools/npm.ps1 run test:integration` sau sửa | 37/37 trên DB `_test` |
| `./tools/npm.ps1 run test:e2e:implemented` sau sửa | 34/34 (42.1s). Lượt trước 33/34, trace xác định login bị `net::ERR_NO_BUFFER_SPACE` của Windows, không có HTTP response; không sửa auth để che lỗi, chạy lại tuần tự đạt |
| Build ba image trên Linux | Đạt; migration runner xác nhận OpenSSL 3.0.22. Sửa ba Important từ review: OpenSSL, CSP/HSTS SPA, cache lỗi media |
| Compose/nginx và khởi động | `config --quiet`, `nginx -t` đạt; DB/API/web healthy. Lượt đầu Docker từ chối tmpfs do YAML tách dấu phẩy thành hai mục; quote cả chuỗi rồi khởi động đạt |
| Migration production | Hai migration auth/catalog áp dụng thành công vào DB mới `rmg_shop_production`, không reset/seed |
| HTTPS/proxy smoke chỉ đọc | TLS hợp lệ đúng domain; HTTP redirect; `/shop` + JS asset 200; readiness 200; cookie Secure/HttpOnly/SameSite=Lax/Path=/ và host-only; admin API 401; Swagger 404; media lỗi 400/404 `no-store`; CSP/HSTS có trên SPA |
| Browser production chỉ đọc | Chromium do Playwright quản lý, desktop và mobile 390px render được, không lỗi runtime/CSP hoặc tràn ngang; browser đã đóng đúng cách |
| Persistence | Restart riêng DB RMG, recreate API; hai bản ghi migration còn. File probe của lần deploy do API user ghi vẫn còn sau recreate, đã đọc/xóa đúng probe; không tạo hoặc xóa sản phẩm thật |
| Quyền/cổng/dịch vụ khác | Env/secret 0600, folder 0700; cổng 4180/4200 chỉ loopback; DB không publish; container ứng dụng cũ vẫn chạy, không restart chúng |
| Secret/source/image | Đối chiếu giá trị secret thật ngay trên VPS: không nằm trong source archive, biến runtime nhạy cảm không nằm trong cấu hình image; quét mẫu repo không phát hiện token/private key; không in giá trị khi đối chiếu |
| Gia hạn HTTPS | Certbot cấp chứng chỉ thật đúng domain, hết hạn 27/01/2027; timer active. `certbot renew --dry-run --cert-name rmglabels.duckdns.org --non-interactive --run-deploy-hooks` exit 0, simulated renewal thành công và hook kiểm tra/reload nginx chạy đạt; lệnh có random delay khoảng 238s trước khi thử |

### Chạy thử và điểm dừng

- Mở `https://rmglabels.duckdns.org/shop` hoặc readiness `https://rmglabels.duckdns.org/api/v1/health/ready`.
- Catalog hiện 0 sản phẩm vì database mới. Chưa tạo tài khoản ADMIN, chưa nhập ảnh/sản phẩm local. Snapshot nhánh M3.16 này chưa gồm M3.15/PR #17 nên UI còn nhãn demo; chưa tự gộp phần ngoài phạm vi deploy.
- Email cấu hình qua Resend với sender thử `onboarding@resend.dev`, chưa gửi mail kiểm thử và chưa có domain gửi đã xác minh để gửi khách. Không ghi khóa hoặc địa chỉ nhận riêng vào tài liệu.
- Chưa làm backup ngoài VPS/restore, tự động deploy sau CI, diễn tập rollback về phiên bản ứng dụng cũ (đây là release RMG đầu tiên), M3.17 hoặc M4; chưa nghiệm thu mở bán. Hướng dẫn chi tiết ở [deployment-guide.md](docs/deployment-guide.md).
- Dừng để người dùng chạy thử URL. Các phần tiếp theo cần yêu cầu/kế hoạch riêng; chưa commit/push trong lượt này.

## Ngày 29/10/2026 — M3.16: cấu hình để backend chạy được trên VPS

**Phạm vi:** người dùng yêu cầu "commit và mở PR [M3.15] đi sau đó cấu hình trên VPS". Làm M3.16 theo lộ trình P0: sửa code/cấu hình để backend chạy sau reverse proxy HTTPS trên VPS. Deploy thật (proxy, service, backup) thuộc M6, cần VPS và domain của chủ shop. Nhánh `feat/m3.16-vps-config` từ `main` (chưa gồm M3.15/PR #17). **Đã viết, agent đã kiểm tra local; chờ người dùng xem. Chưa commit.**

| File | Thay đổi |
|---|---|
| `apps/backend/src/config/environment.ts` | `HOST` (mặc định `127.0.0.1`, kiểm tra ký tự); `TRUST_PROXY` → `trustProxyHops` (false/true/1–5), **bắt buộc ≥ 1 ở production**; `UPLOADS_DIR` tuyệt đối, **bắt buộc ở production**, mặc định `.local/uploads` (test: `.local/test-uploads`) tính từ vị trí file, không phụ thuộc thư mục làm việc |
| `apps/backend/src/main.ts` | Nghe `config.host`; lỗi `Invalid configuration: …` (chỉ có tên biến) được in ra, lỗi khác vẫn thông báo chung để không lộ URL/credential |
| `apps/backend/src/application.ts` | `trust proxy` theo số hop cấu hình |
| `apps/backend/src/modules/uploads/uploads.service.ts` | Bỏ chặn `UPLOAD_NOT_CONFIGURED` ở production; thư mục ảnh lấy từ `config.uploadsDir` |
| `apps/backend/src/modules/uploads/media.controller.ts` | Ảnh công khai `Cache-Control: public, max-age=86400`; lỗi và phản hồi khác giữ `no-store` |
| `apps/backend/src/cli/import-products.ts` | Ghi ảnh vào `uploadsDir` từ cấu hình (trên VPS là `UPLOADS_DIR`). `seed-demo.ts` không đổi (chỉ dùng local, M3.15 chặn production) để tránh xung đột với PR #17 |
| `apps/backend/.env.example` | Thêm `HOST`, `UPLOADS_DIR`, giải thích `TRUST_PROXY` |
| Test | `environment.spec.ts` +5 (sửa 1); mới `test/production-config.integration.spec.ts` (2); `catalog.integration.spec.ts` thêm kiểm tra header cache |
| `README.md`, `docs/local-trial-m3.md` | Mục cấu hình production trên VPS; mục M3.16 |

**TDD:** 5 test cấu hình RED (chưa có `host`/`trustProxyHops`/`uploadsDir`) và header cache RED (`no-store`) → GREEN. Test upload production RED đúng lý do (`Chưa cấu hình lưu ảnh cho môi trường deploy.`) → GREEN sau khi bỏ chặn. Test cookie `__Host-` qua proxy đạt ngay (hành vi có sẵn, giữ làm test hồi quy cho cấu hình proxy).

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | Đạt |
| `npm test` | 8 công cụ + 13 backend + 184 frontend |
| `npm run test:integration` | 37/37 |
| `npm run test:e2e:implemented` (DB `_test`) | 34/34 (41.7s) |
| Khởi động `NODE_ENV=production` bằng giá trị giả, thiếu `TRUST_PROXY` / `UPLOADS_DIR` | In đúng "Invalid configuration: TRUST_PROXY is required in production" / "…UPLOADS_DIR…", exit 1, không kết nối DB |

**Còn lại:** M3.17 (bảo vệ admin); M6.1 deploy thật cần VPS + domain. **Dừng chờ người dùng xem.**

## Ngày 29/10/2026 — M3.13b (lộ trình giao Người B, agent của Người A làm theo yêu cầu): sửa lệnh nhập CSV

**Phạm vi:** người dùng yêu cầu làm luôn M3.13b: sửa 2 lỗi còn mở của M3.13a đã ghi ở PR #13. Nhánh `fix/m3.13b-import-args` từ `main`, PR #16; sau khi PR #15 (M3.14) merge, đã merge `main` vào nhánh để giải xung đột `progress.md` (giữ cả hai mục). **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.**

| File | Thay đổi |
|---|---|
| `package.json` (root) | `import:products` thêm `--` để npm chuyển `--dir`/`--draft` cho CLI. Trước đây npm hiểu chúng là cấu hình của chính npm (`Unknown cli config "--dir"`), lệnh âm thầm đọc `data\import` và nhập PUBLISHED |
| `apps/backend/src/cli/import-products.ts` | `--dir` tương đối tính từ `INIT_CWD` (nơi gõ lệnh) thay vì `apps/backend`; danh mục đã có mà đang tắt thì bỏ qua dòng khi nhập PUBLISHED, kèm hướng dẫn bật danh mục hoặc dùng `--draft`; tra/tạo danh mục chuyển vào `try` của từng dòng nên lỗi một dòng không dừng cả lượt |
| `apps/backend/test/import-products.integration.spec.ts` | +2 ca: gọi đúng lệnh ở root (`npm run import:products -- --dir <tương đối> --draft`) với DB bảo vệ không tồn tại nên không thể ghi dữ liệu dù lỗi còn hay đã sửa; danh mục đang tắt không xuất bản nhưng `--draft` vẫn nhập nháp |
| `README.md`, `docs/local-trial-m3.md` | Cách tính `--dir` tương đối và hành vi với danh mục đang tắt |

**TDD:** cả 2 ca RED đúng lý do trước khi sửa (log npm `Unknown cli config "--dir"`/`"--draft"`, CLI đọc thư mục mặc định rồi dừng ở DB bảo vệ, không ghi gì; sản phẩm vẫn PUBLISHED vào danh mục tắt) → GREEN 3/3. Vì `data/import` local chứa CSV thật đã có giá, test root cố ý trỏ DB không tồn tại để không bao giờ nhập dữ liệu thật vào `_test`.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Đạt |
| `npm test` (sau khi merge `main` có M3.14) | 8 công cụ + 9 backend + 184 frontend |
| `npm run test:integration` | 35/35 (33 của `main` + 2 ca M3.13b) |
| `npm run test:e2e:implemented` | 34/34 (42.6s) |

Chưa sửa điểm nhỏ "test cleanup prefix cố định" của review PR #13: integration chạy tuần tự (`fileParallelism: false`) nên chưa gây lỗi. **Chạy thử:** `.\tools\npm.ps1 run import:products -- --dir <thư mục khác> --draft` → sản phẩm nhập nháp từ đúng thư mục. **Dừng chờ người dùng thử.**

## Ngày 29/10/2026 — M3.14 (Người A): sửa sản phẩm đang bán hoặc đã ẩn

**Phạm vi:** người dùng yêu cầu "làm luôn" M3.14 theo lộ trình P0. Backend vốn cho sửa sản phẩm mọi trạng thái (giữ ràng buộc khi đang bán); UI chặn khác nháp. Nhánh `feat/m3.14-edit-live-products` từ `main`, đã merge vào `main` qua PR #15. **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.**

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.tsx` | Form và phần ảnh hiện cho mọi trạng thái; tiêu đề theo trạng thái (nháp/đang bán/đã ẩn); cảnh báo hàng đang bán (lưu là lên web, đổi đường dẫn làm hỏng link đã chia sẻ) và ghi chú hàng đã ẩn; khóa Xuất bản khi còn thay đổi chưa lưu áp dụng cho mọi trạng thái |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.tsx` | 409 mã `PUBLISH_RULE` hiện đúng lý do từ server thay vì thông báo chung "đã thay đổi/bị trùng"; nhãn form "Sửa sản phẩm" khi không phải nháp |
| `apps/frontend/src/features/admin/products/pages/ProductsPage.tsx` | Thông báo sau lưu "Đã cập nhật sản phẩm “…”." cho mọi trạng thái |
| `apps/backend/src/common/database-errors.ts`, `modules/products/products.service.ts` | Thêm `publishRuleConflict` (409, mã `PUBLISH_RULE`) cho 3 ràng buộc xuất bản: sửa hàng đang bán, xuất bản thiếu điều kiện, gỡ hết ảnh hàng đang bán. Thông báo giữ nguyên |
| `ProductEditPage.test.tsx` | Thay 2 test "không sửa được hàng không phải nháp" bằng: sửa hàng đang bán, lý do 409 hiện nguyên văn, hàng đã ẩn, tải dữ liệu mới thấy đang bán vẫn sửa được; test xuất bản → ẩn → lưu dùng version trả về (5) |
| `apps/backend/test/catalog.integration.spec.ts` | +1 ca: sửa tên/giá/mô tả hàng đang bán thì API công khai trả ngay giá trị mới; tắt hết biến thể hoặc gỡ hết ảnh trả 409 `PUBLISH_RULE` và không đổi version |
| `apps/frontend/e2e/products.spec.ts`, `e2e/product-status.spec.ts` | Ca "từ chối sửa hàng đã xuất bản" thành "sửa hàng đang bán, khách thấy ngay"; sau xuất bản form vẫn còn; đổi chữ thông báo |
| `docs/local-trial-m3.md` | Mục M3.14 |

**TDD:** integration mới RED đúng lý do (sửa khi đang bán đã chạy, mã lỗi còn `CONFLICT`) → GREEN 13/13 sau khi thêm `PUBLISH_RULE`. UI: 6 test RED (trang còn chặn hàng không phải nháp) → GREEN 63/63; một lần fail giữa chừng do stub của chính test trả tên cũ, đã sửa test.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Đạt |
| `npm test` | 8 công cụ + 9 backend + 184 frontend |
| `npm run test:integration` | 33/33 |
| `npm run test:e2e:implemented` (11 spec, DB `_test`) | 34/34 (42.5s) |

**Chạy thử:** [docs/local-trial-m3.md](docs/local-trial-m3.md) § M3.14. **Dừng chờ người dùng thử.**

## Ngày 29/10/2026 — P0: chuyển tài liệu gốc từ demo sang shop thật

**Bối cảnh:** chủ shop xác nhận website là kênh bán hàng thật, không còn là demo. Đánh giá lại M1–M3 theo chuẩn bán thật (nghiệp vụ/pháp lý, bảo mật, vận hành). Giữ nguyên nền tảng auth/session/CSRF/role, kho có lịch sử, catalog. Phát hiện chặn mở bán: upload bị tắt ở production và chỉ lưu ổ đĩa local; API chỉ nghe `127.0.0.1`; `TRUST_PROXY` không bắt buộc; chưa có deploy/backup; admin chỉ có mật khẩu, giới hạn đăng nhập theo IP + email; UI không cho sửa sản phẩm đã xuất bản (backend cho phép); chính sách và banner còn ghi demo; `seed:demo` chạy được trên production.

**Quyết định của chủ shop:** đặt hàng không cần đăng ký; deploy trên VPS; chuyển khoản hiển thị VietQR; đổi trả xử lý thủ công; phí giao 30.000đ. Theo đề xuất được duyệt: hạn chuyển khoản 2 giờ (sửa trong Cài đặt), ẩn Đăng ký/Đăng nhập của khách trên cửa hàng.

**Phạm vi đã duyệt:** chỉ sửa tài liệu, không đổi code.

| File | Thay đổi |
|---|---|
| `docs/plan.md` | Mục tiêu shop thật; ràng buộc mới (dữ liệu khách thật, VPS, chính sách đã chốt); mục "Chuyển sang shop thật" với bảng quyết định và lộ trình P0 → M3.13b–M3.17 → M4 → M6 → mở bán; bảng mốc và phân công A/B mới; M4 theo đơn khách vãng lai + VietQR; M5 ngoài phạm vi; M6 trên VPS; M7 rút gọn |
| `docs/business-rules.md` | Bỏ "đặc tả demo"; thêm mục đơn khách vãng lai (thông tin bắt buộc, mã đơn + token tra cứu băm, chống đơn ảo) và dữ liệu cá nhân của khách; hạn chuyển khoản 2 giờ + VietQR; đổi trả thủ công, thiết kế tự động giữ làm tham khảo |
| `docs/architecture.md` | Sitemap không còn tài khoản khách/returns, thêm tra cứu đơn và trang chính sách bảo mật; API đơn công khai theo token; Order/ShopSettings mới; deploy VPS (reverse proxy, ảnh trên ổ đĩa + backup ngoài VPS, bảo vệ VPS); rate limit và MFA admin |
| `AGENTS.md` | Mục 5: shop thật, không đưa dữ liệu khách thật vào local/log/chat, không đụng production khi chưa được yêu cầu, `seed:demo` không chạy production |
| `README.md` | Mô tả shop thật trên VPS; điểm dừng mới; `seed:demo` chỉ dùng local |
| `docs/acceptance-checklist.md` | Bỏ ca returns/exchange tự động; thêm AUTH-04 (MFA/đoán mật khẩu nhiều IP), ACL-01 theo token/mã đơn, GUEST-01 (đơn ảo), PRIV-01 (PII trong log), PAY-05 (VietQR), OPS-03 (restart VPS); cổng mở bán gồm chính sách thật, thông tin người bán, thủ tục Bộ Công Thương |

**Phát hiện thêm khi rà:** PR #13 (M3.13a import CSV, Người B) đã merge nhưng progress của PR ghi còn 2 lỗi mở (tham số `--dir`/`--draft` từ root; xuất bản vào danh mục đang tắt). Đưa vào lộ trình thành M3.13b; các phần chuẩn bị bán thật đánh số M3.14–M3.17 để không trùng.

**Kiểm tra:** rà diff; quét lại "demo/dữ liệu giả/miễn phí/free/Cloudinary" trong 6 tài liệu: còn lại là tên lệnh `seed:demo`, câu "không còn là demo" và nguồn khảo sát hạ tầng cũ đã ghi rõ không còn dùng. Không chạy test vì không đổi code.

**Điểm dừng:** chờ người dùng đọc lại tài liệu và duyệt. Phần tiếp theo cần kế hoạch riêng: M3.14 (A, sửa sản phẩm đang bán) và M3.13b (B, sửa import).

## Ngày 29/10/2026 — Chuẩn bị commit và PR M3.13a vào main

- Theo yêu cầu commit và MR của người dùng, fetch `origin` và xác nhận M3.9–M3.12 đã vào `main` qua PR #12 (`29fdd89`). Tạo nhánh `codex/m3.13a-product-import` từ `origin/main`; PR mới chỉ chứa CLI import CSV M3.13a, test, npm scripts, ignore dữ liệu local và tài liệu đang có. Không nhận các thay đổi có sẵn này là phần triển khai trong lượt Git.
- Kiểm tra mới trên working tree: `./tools/npm.ps1 run typecheck` và `run build` exit 0; `./tools/npm.ps1 test` đạt 8 công cụ + 9 backend + 182 frontend; `./tools/npm.ps1 run test:integration` đạt 32/32; `./tools/npm.ps1 run test:e2e:implemented` đạt 34/34 (44.1s). Xác nhận `NODE_ENV=test` và PostgreSQL có hậu tố `_test` trước test ghi dữ liệu. Integration lần đầu trong sandbox bị `EACCES`; chạy lại ngoài sandbox đạt. E2E dùng Chromium do Playwright quản lý. Build còn cảnh báo chunk >500 kB có sẵn.
- Kiểm tra `git diff --check`, danh sách tệp sẽ đưa lên Git, ignore và mẫu secret: không phát hiện private key/token theo mẫu đã quét; `git ls-files -ci --exclude-standard` rỗng. `data/`, `.env` thật, `.local/`, dependency và build artifact giữ ngoài commit. Giữ tác giả Git đang cấu hình, không thêm dòng ghi công AI.
- Review phát hiện lỗi cần sửa trước merge: script `import:products` ở root chưa chuyển tiếp đúng `--dir`/`--draft` qua npm workspace (thiếu dấu `--`). Có thể dùng thư mục mặc định và PUBLISHED dù người dùng yêu cầu thư mục khác/nhập nháp; test hiện spawn CLI trực tiếp nên chưa bắt được đường gọi root. Chuẩn bị PR dạng draft để review, chưa kết luận sẵn sàng merge. Không sửa code trong lượt này vì `AGENTS.md` yêu cầu gửi và duyệt kế hoạch cụ thể trước khi code.
- Review còn phát hiện importer tái sử dụng danh mục đang tắt rồi ghi sản phẩm PUBLISHED: CLI báo thành công nhưng khách không thấy sản phẩm; cần kiểm tra điều kiện danh mục trước xuất bản. Hai điểm nhỏ hơn: lỗi tạo danh mục có thể dừng cả lượt vì nằm ngoài `try` từng dòng, và test cleanup dùng prefix cố định có thể xung đột khi chạy đồng thời. Các điểm này chưa được sửa và sẽ ghi trong draft PR.
- Điểm dừng: commit/push và mở draft PR theo yêu cầu; chưa merge vào `main`, chưa chạy lại import trên DB local, chưa có xác nhận nghiệm thu mới từ người dùng. Kết quả test hiện tại không phủ lỗi chuyển tiếp tham số nêu trên.

## Ngày 23/10/2026

- Người dùng cho phép tiến hành kế hoạch. Ngân sách ưu tiên miễn phí, thời gian 10 giờ/tuần.
- Workspace mới, không có Git repository hoặc source ứng dụng lúc khảo sát.
- Node local 22.20.0, npm 11.6.2, Docker Compose 2.39.4. Docker daemon chưa kết nối được (named pipe không tồn tại; config Docker có hạn chế quyền).
- Đã soạn bộ tài liệu M1; chờ kiểm tra liên kết/nội dung và review trước khi đánh dấu hoàn thành.
- Registry từ sandbox bị EACCES; đã yêu cầu quyền đọc metadata npm để chọn phiên bản trước cài.

## Trạng thái mốc

> Cập nhật 31/10/2026. Trạng thái chi tiết từng phần đọc các mục theo ngày ở trên; bảng này chỉ tóm tắt.

| Mốc | Trạng thái |
|---|---|
| M1 Thiết kế | Đã soạn và rà soát; tài liệu mục tiêu cho các mốc sau |
| M2 Nền tảng/auth | Bản local đã qua kiểm tra kỹ thuật; dừng để người dùng chạy thử |
| M3 Catalog/ảnh/kho | M3.1–M3.16.1 và UI.1–UI.4 đã triển khai (M3.13b sửa import, M3.14 sửa hàng đang bán, M3.15 bỏ demo, M3.16 cấu hình VPS, M3.16.1 deploy — redeploy giao diện mới 30/10); M3.17 bảo vệ admin còn lại (phân công Người B). Chờ người dùng nhập dữ liệu thật (`import:products`, 17 ảnh đã ở `data/import`) và nghiệm thu toàn mốc |
| M4 Bán hàng | Người B phụ trách toàn bộ; M4.0.1–M4.0.3, M4.1.1–M4.1.2, M4.2.1 giỏ hàng, M4.2.2 quote server đã merge `main` (`899b52c`, 31/10). Còn M4.3.1 đặt COD trở đi; chờ người dùng chạy thử phần đã có |
| M5 Sau bán hàng | Ngoài phạm vi mở bán theo quyết định 29/10/2026 (đổi trả thủ công) |
| M6 Deploy/restore | M3.16.1 đã deploy tay catalog/API/UI lên VPS; còn M6.1 deploy sau CI + rollback (Người A), M6.2 backup/khôi phục ngoài VPS và M6.3 bảo vệ VPS + báo động (Người B) |
| M7 Nghiệm thu | Chưa thực hiện; trước mở bán cần kiểm thử bảo mật auth/đơn/VietQR |

## Ngày 29/10/2026 — Bản sửa sau review M3.9–M3.12

Người dùng duyệt "làm hết" cho 6 điểm review:

| Điểm | Sửa |
|---|---|
| Seed tạo `reserved` 2/3/2 không có đơn — trái quy tắc reserved chỉ tăng khi tạo đơn, sang M4 sẽ kẹt không giải phóng được | `seed-demo.ts`: bỏ `reserved`; biến thể hết hàng dùng `onHand: 0`. Còn bán giữ nguyên số cũ (13, 8, 1, 0, 10, 10, 5) |
| Seed ghi thẳng `onHand`, lịch sử kho trống | Mỗi biến thể có tồn tạo kèm một `InventoryMovement` 'Nhập kho demo' (0 → N, actor = admin chủ ảnh, key `seed-demo-<SKU>`), inventory `version` 1 như sau một lần điều chỉnh thật |
| Ghi file ảnh trong `$transaction` (AGENTS.md cấm), transaction lỗi để lại file mồ côi | Ảnh tạo ngoài transaction theo khuôn `uploads.service` (file → row, lỗi thì xóa lại); sản phẩm tạo bằng một nested create; tạo sản phẩm lỗi thì xóa asset/file vừa tạo. `ADMIN_EMAIL` bị khóa (`disabledAt`) không được chọn làm chủ ảnh |
| `progress.md` mất tiêu đề mục M3.11 | Thêm lại tiêu đề |
| `/shop?categoryId=<danh mục đã tắt>` hiện 'Tất cả danh mục' trong khi vẫn lọc | `CatalogPage.tsx`: cảnh báo 'Danh mục này không còn hiển thị.', ô Danh mục ghi 'Danh mục không còn hiển thị', nút 'Xóa lọc' về `/shop` |
| Sang trang `/shop` làm lưới biến mất rồi hiện lại | `placeholderData: keepPreviousData`: giữ card trang cũ kèm 'Đang cập nhật bộ sưu tập…', thanh phân trang khóa trong lúc tải |

Test mới, đều fail trước khi sửa đúng lý do rồi đạt sau khi sửa:
- `seed-demo.integration.spec.ts`: thêm ca "lượt lỗi giữa chừng không để lại ảnh/asset" (RED: còn `demo-ao-cotton-1/2.webp`); ca hai lượt thêm kiểm tra đang giữ 0, lịch sử 'Nhập kho demo' và version (RED: `reserved` khác 0). Cleanup test xóa thêm `InventoryMovement` của hàng demo.
- `CatalogPage.test.tsx`: +2 test danh mục đã tắt và giữ card khi tải trang 2.

Tài liệu: `docs/local-trial-m3.md` mục M3.9 (2 dòng thử mới) và M3.11 (giữ 0, lịch sử kho, lượt lỗi), câu mở đầu không còn ghi "còn ghép M3.12"; README mục seed; `docs/plan.md` số test.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | Đạt |
| `npm test` (sau khi merge `main` có M3.14) | 8 công cụ + 9 backend + 184 frontend |
| `npm run test:integration` | 31/31 |
| `npm run test:e2e:implemented` (11 spec, DB `_test`) | 34/34 (39.6s) |

Chưa chạy `seed:demo` trên DB local (chờ người dùng). Chưa commit/push.

## Ngày 29/10/2026 — M3.13a (Người B): nhập dữ liệu thật từ ảnh Instagram vào web

**Phạm vi:** người dùng muốn gắn ảnh sản phẩm thật từ [instagram.com/rmglabels](https://www.instagram.com/rmglabels/). Scraping trực tiếp bị từ chối (bảng khảo sát bên dưới) nên theo hướng dẫn: người dùng lưu 17 ảnh bài đăng vào `Downloads\RMG`; agent copy vào `data/import/`, sinh sẵn `products.csv` từ tên file/caption, người dùng điền **giá** và **size** rồi chạy 1 lệnh. Trạng thái **PUBLISHED** theo lựa chọn. **Đã viết, agent đã kiểm trên `_test`; chờ người dùng điền CSV + chạy trên DB local. Chưa commit.**

### Khảo sát Instagram (sự thật, chặn đã xác nhận)

| Thử | Kết quả |
|---|---|
| Profile GraphQL `/api/v1/users/web_profile_info` (2 lượt, UA khác nhau) | 429 — chặn mọi truy cập không phiên |
| HTML profile + trang `/p/<code>/` + `/embed/captioned/` | Chỉ khung app, không ảnh/caption |
| `?__a=1&__d=dis` | Đã ngừng phục vụ |
| Websearch | Chỉ thấy vài link bài, không đủ làm pipeline |

### Đã viết / file thực tế

| File | Thay đổi |
|---|---|
| `data/import/` (gitignore mới chọn `data/`) | 17 ảnh 1440×1800/1920 (copy từ `Downloads\RMG`, bản gốc giữ nguyên) + `products.csv` sinh tự: 5 dòng sản phẩm RMG (Black Wash VTG Horse Tee, White Horse Tee, Goldline Metal Baggy Pants, Different Level Polo, Different Metal Zip Hood), tên/danh mục ('Áo thun'/'Quần'/'Áo polo'/'Áo hoodie')/màu (đen/trắng — soi ảnh thật)/mô tả đã điền; `price`/`sizes`/`stock` để trống cho người dùng |
| `apps/backend/src/cli/import-products.ts` (mới) | CLI: đọc CSV parser tự viết (quote/comma, giữ số dòng thật); validate từng dòng (tên/ảnh ≤ 8/giá 1–100.000.000/size trong bộ XS,S,M,L,XL,XXL,3XL,FREESIZE/stock ≤ 1.000.000), dòng lỗi bị bỏ qua với lý do, phần còn lại vẫn nhập; slug từ tên (NFD, đ→d, thường); SKU `RMG<8 ký tự hex từ slug/size>-<SIZE>`; danh mục tạo theo tên nếu thiếu (mặc định 'Chưa phân loại'); ảnh sharp **cover-crop 750×1000** webp (cắt viền, không méo) → UploadAsset + ProductImage theo pipeline uploads.service, asset dọn khi tạo sản phẩm lỗi; idempotent theo slug — chạy lại bỏ qua, không ghi đè; status PUBLISHED (cờ `--draft` → DRAFT); kho: `stock` trống = 0 không ledger, có số → 1 bản ghi ledger 'Nhập kho lúc import' như chỉnh kho thật; log tổng kết phân nhánh có/không sản phẩm mới |
| `apps/backend/test/import-products.integration.spec.ts` (mới) | Guard `_test`; fixture tmp tự tạo (2 ảnh sharp nhỏ + CSV, admin riêng theo `ADMIN_EMAIL`); spawn CLI 2 lượt — snapshot deep-equal giữa lượt (slug, status, priceFrom, mô tả, ảnh, biến thể, tồn, ledger), lượt 2 no-op 'Toàn bộ sản phẩm trong CSV đã có sẵn'; thực hiện assert dòng lệnh Bỏ qua + thiếu giá trên stderr; cleanup prefix `import-fix-`/`rmg-import-fix-` theo bảng + file |
| `apps/backend/package.json`, root `package.json` | Script `import:products` (backend: build + `node --env-file-if-exists=.env dist/cli/import-products.js`; root: `npm run import:products -w @clothing/backend`) |
| `.gitignore` | Bỏ qua `data/` (ảnh shop + CSV không vào Git) |
| `README.md`, `docs/local-trial-m3.md`, `progress.md` | Mục 'Nhập dữ liệu shop thật (M3.13a)' + runbook + mục này. Ngoài ra sửa dòng kiểm tra M3.12 sai bộ đếm (frontend 180→182 vì +2 test CatalogPage của bản sửa sau review M3.11 đọc thiếu; integration 30→32 do cơ chế đếm lượt cũ, tổng ổn định đã đối chiếu từng file) |

### Data flow / key quan trọng

CSV (1 dòng = 1 sản phẩm, `sizes` ngăn `|` = mỗi size một biến thể cùng giá) → validate → mỗi sản phẩm: ảnh webp + UploadAsset → Category → Product + Variant + Inventory (0) → khách thấy qua API M3.8–M3.10 có sẵn. Giá đúng ra từ CSV; tồn ngoài CSV để 0 để bạn nhập kho thật qua UI Kho (có lịch sử giao dịch, khớp luồng M3.7.2/3.7.3).

- `slugify` + idempotency theo slug: sửa tên trong CSV tạo sản phẩm MỚI — không tự sửa sản phẩm cũ (chỉnh qua admin).
- `it.each` không dùng: frontend không đổi code — số test frontend 182 gồm baseline cũ + 2 test bản-review M3.11 này đọc thiếu lúc M3.12 (tree ổn định, chạy lại đều 182).
- Nếu thiếu ADMIN trên DB sẽ exit 1 với hướng dẫn `admin:create` (như `seed:demo`).

### Kiểm tra thực tế (Node 24.22.1; integration qua `vitest.integration.config.ts`)

| Lệnh | Kết quả |
|---|---|
| Test mới trước khi có CLI | FAIL đúng lý do: `MODULE_NOT_FOUND dist/cli/import-products.js` (RED) |
| Lượt sau CLI (1) | FAIL vì tôi để `files.split` trên destructuring undefined (noUncheckedIndexedAccess)-fix; thêm 2 assert chuẩn hóa (stderr 'Bỏ qua dòng', Set so sánh tên danh mục) |
| `test/import-products.integration.spec.ts` | GREEN — 2 lượt spawn deep-equal, dòng lỗi skip đúng, ledger chỉ khi stock > 0 |
| `test:integration` toàn bộ | 32/32 (auth 17 + catalog 12 + seed-demo 2 + import 1), exit 0 |
| `run typecheck` / `run build` | Exit 0 / Exit 0 |
| `npm test` workspace | tools 8 + backend 9 + frontend 182 đạt, exit 0 (tree ổn định — +2 là test CatalogPage có sẵn; giải trình ở dòng sửa M3.12) |
| Dry-run lệnh theo đúng chuỗi user (`npm.ps1 run import:products`, cwd workspace = apps/backend; CSV thật 5 dòng chưa điền giá) | 5 × 'Bỏ qua dòng … thiếu giá hợp lệ', tổng kết no-op, exit 0, **không ghi DB** — chứng nhận (1) mặc định `--dir` trúng `clothing-shop\data\import` sau khi sửa lấy repo root từ `import.meta.url` (cwd-based đã trượt vào `apps\backend\data\import`), (2) parser đọc đúng BOM/dòng `#`/tên file chứa `“`, dòng báo 3–7 trúng vị trí thật |
| `test:e2e:implemented` (11 spec, DB `_test`) | 34/34 passed (42.5s, exit 0) — code runtime FE/BE không đổi trong phần này, chạy lại để có hóa đơn đủ |

### Vấn đề gặp trong phần này

- Instagram chặn scraping anonymous (không tự lấy) — được người dùng đồng ý chuyển sang tự lưu ảnh.
- PowerShell 5.1 không có `??` trong script phụ sinh CSV; file CSV/ảnh sinh bằng tool cục bộ, hợp lệ UTF-8 BOM để Excel mở tên tiếng Việt đúng.
- Mặc định `--dir` ban đầu resolve theo cwd — khi chạy `npm run -w @clothing/backend` cwd là apps/backend nên sẽ trượt sang `apps\backend\data\import`. Sửa: repo root suy từ `import.meta.url` (4 cấp như uploadsRoot), chứng bằng dry-run ở bảng kiểm.
- PowerShell tô đỏ `NativeCommandError` cho dòng stderr đầu tiên khi npm host node, dù đó chỉ là cảnh báo dữ liệu: chuyển 4 thông báo theo dòng (thiếu giá/file/thêm path/tạo lỗi riêng) sang stdout, giữ stderr chỉ cho lỗi dừng lượt (không đọc được CSV, thiếu ADMIN — exit 1); test cập nhật kênh tương ứng.

### Chạy thử / điểm dừng

- Mở `data/import/products.csv` điền `price` (VND, số nguyên) và `sizes` (vd. `S|M`; trống = FREESIZE). Bảng chi tiết ở [docs/local-trial-m3.md](docs/local-trial-m3.md) § M3.13a.
- Chạy `.\tools\npm.ps1 run import:products` (mặc định đọc `data\import`), mở `http://127.0.0.1:5173/shop` kiểm 5 sản phẩm RMG; dùng Kho M3.7.2 nhập tồn thật có lịch sử.
- **Dừng chờ người dùng điền CSV, chạy import và phản hồi.** M3.12 runbook (§ M3.12) vẫn chờ chạy thử nếu chưa làm. Commit/push/PR chỉ khi được yêu cầu (không gộp `data/` — gitignore).


## Ngày 29/10/2026 — M3.12 (Người B): ca chấp nhận toàn luồng ghép vào E2E implemented — chốt M3 về mặt kỹ thuật

**Phạm vi:** người dùng duyệt kế hoạch M3.12: đưa `catalog.spec.ts` vào `test:e2e:implemented` (kèm đổi tên bước CI), sửa spec cho khớp flow UI hiện hành ở mức tối thiểu (không đổi code runtime), cập nhật tài liệu chốt M3. **Đã viết, agent đã kiểm tra toàn bộ trên DB `_test`; chờ người dùng chạy thử theo mục M3.12 của local-trial. Chưa nghiệm thu toàn M3. Chưa commit/push.**

### Đã viết / file thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/e2e/catalog.spec.ts` | 3 điều chỉnh khớp UI hiện hành: (1) đến khu Sản phẩm bằng `goto('/admin/products')` — các trang con admin không có nav 'Sản phẩm' (nút nav chỉ nằm trên landing `/admin`), trùng idiom `goto` của 10 spec còn lại; (2) sau 'Lưu sản phẩm' assert URL về `/admin/products` + alert 'Đã tạo sản phẩm nháp', lấy `productId` từ DB rồi `goto` trang sửa nháp, assert heading 'Sửa sản phẩm' (khớp 'Sửa sản phẩm nháp' vì getByRole string là substring) — luồng tạo nháp nay về danh sách, không còn nhảy thẳng trang sửa như spec cũ giả định; (3) assert chuyển trạng thái bằng text chính xác 'Đã xuất bản sản phẩm.'/'Đã ẩn sản phẩm.' như `product-status.spec.ts` — sau chuyển trạng thái trang hiển thị 2 alert cùng lúc nên `getByRole('alert')` vi phạm strict mode |
| `package.json` (root) | `test:e2e:implemented` thêm `catalog.spec.ts` (chèn sau `catalog-detail`) → 11 spec |
| `.github/workflows/ci.yml` | Tên bước E2E thêm 'full catalog M3.12' |
| `docs/plan.md` | Đoạn tổng kết M3 ghi M3.1–M3.12 đã triển khai xong, chỉ còn nghiệm thu; tick 4 dòng tiêu chí với ba bằng chứng (unit/UI 197, integration 30, E2E implemented 34) |
| `README.md` | Dòng điểm dừng: các phần M3.1–M3.12 xong, chờ chạy thử/nghiệm thu; bảng E2E: implemented = toàn bộ hiện hành 34 ca/11 spec, `test:e2e` trùng bộ implemented; ghi chú lịch sử CI `d5953cf` và tên bước mới chờ lượt chạy sau push |
| `docs/local-trial-m3.md` | Mục M3.12: runbook toàn luồng (danh mục → nháp → ảnh thật → kho +10 → xuất bản → khách tìm/xem/chọn biến thể → mobile → reload → ẩn → 404) + bảng 'ảnh còn sau restart' + câu lệnh bộ E2E |
| `progress.md` | Mục này + dòng trạng thái mốc M3 |

### Data flow / key quan trọng

Ca tự dựng dữ liệu bằng UI thật trên `_test` (đăng nhập → danh mục → nháp SKU `BROWSER-*` → upload ảnh sharp qua form → điều chỉnh kho +10 → Xuất bản), phía khách tìm `/shop?q&categoryId&sort` → chi tiết chọn 'M · đen' 'Còn 10 sản phẩm' → mobile 390 không tràn → reload → Ẩn → `/products/<slug>` 404; fixture tạo/xóa riêng của lượt chạy (beforeAll/afterAll).

- Nav admin chỉ ở landing `/admin`: chuyển khu admin trong E2E đi bằng URL (`goto`), không còn link nav dùng được giữa các trang con.
- Trang sửa sản phẩm sau chuyển trạng thái có nhiều alert: assert theo text chính xác thay vì `getByRole('alert')` chung.
- 'Sửa sản phẩm' khớp substring với 'Sửa sản phẩm nháp'; sau lưu nháp, phần thông báo tạo thành công hiển thị trên danh sách thay vì điều hướng sang trang sửa.

### Kiểm tra thực tế (Node 24.22.1; E2E qua `node tools/test-e2e.mjs`)

| Lệnh | Kết quả |
|---|---|
| `catalog.spec.ts` trước sửa (quan sát hiện trạng) | FAIL đúng điểm dự đoán trước: timeout chờ link 'Sản phẩm' không tồn tại trên trang con admin — ghi nhận RED trước khi sửa |
| `catalog.spec.ts` sau điều chỉnh (1) | FAIL vì strict mode 2 alert sau xuất bản — mới phát hiện điểm (3), sửa xong đạt |
| `catalog.spec.ts` riêng, cuối | 1 passed (2.4s, exit 0) |
| `test:e2e:implemented` 11 spec | **34/34 passed (40.4s, exit 0, không flake** — webServer Vite còn sống cả lượt) |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0 (cảnh báo chunk có sẵn) |
| `npm test` workspace | tools 8 + backend 9 + frontend 180 đạt, exit 0 — **sửa nhận định 29/10: phiên bản CatalogPage sau review của M3.11 (+2 test) lúc chạy này đọc thiếu; tree ổn định, chạy lại = 182** |
| `test:integration` | 30/30, exit 0 — **sửa nhận định 29/10: các file integration đủ gồm auth 17 + catalog 12 + seed-demo 2 = 31, run này báo 30; tổng kiểm sau M3.13a (bảng dưới) cho số ổn định 32 với import 1** |

### Vấn đề gặp trong phần này

- Spec cũ được viết trước khi UI admin có flow 'lưu → về danh sách' và trước khi nav con bị bỏ: 2 điểm lệch được phát hiện bằng lượt chạy quan sát (không chỉ đoán); còn 1 điểm strict-mode alert chỉ lộ khi luồng chạy đến bước xuất bản.
- Log lượt integration ghi sai chỗ do chuyển cwd trong `cmd /c`; exit 0 và 30/30 xác nhận từ log thật (`C:\Users\Admin\.local\integration-m312.log`).

### Chạy thử / điểm dừng

- Chạy thử ca này thủ công theo bảng [docs/local-trial-m3.md](docs/local-trial-m3.md) § M3.12: toàn luồng ở trên + dừng/restart backend rồi kiểm ảnh vẫn hiển thị. Lệnh bộ E2E: `./tools/npm.ps1 run test:e2e:implemented` (34 ca).
- **Dừng chờ người dùng chạy thử và nghiệm thu toàn M3.** Sau nghiệm thu mới nói 'M3 hoàn thành'; commit/push/PR chỉ khi được yêu cầu (toàn bộ thay đổi M3.9–M3.12 đang uncommitted trên nhánh `feat/m3.7.2-inventory-adjust`).

## Ngày 29/10/2026 — M3.11 (Người B): bộ dữ liệu demo bằng lệnh seed

**Phạm vi:** người dùng duyệt kế hoạch M3.11 trong chat theo định nghĩa m3-implementation-plan: Seed CLI có kiểm soát, idempotent theo slug `demo-*`, không ghi đè dữ liệu người dùng, không tự seed khi startup. Backend/UI/E2E/CI không đổi — chỉ thêm CLI, test tích hợp, script `seed:demo` và tài liệu. Tồn kho demo ghi lúc tạo biến thể, mỗi lượng nhập kèm một `InventoryMovement` 'Nhập kho demo' (đổi sau review, xem "Bản sửa sau review M3.9–M3.12") → "chạy lại không nhập kho lặp" hợp bởi cấu trúc. **Đã viết, agent đã kiểm tra trên `_test`; chờ người dùng chạy `seed:demo` trên DB local. Chưa commit/push.**

### Đã viết / file thực tế

| File | Thay đổi |
|---|---|
| `apps/backend/src/cli/seed-demo.ts` (mới) | CLI theo khuôn `create-admin.ts`: 2 danh mục, 4 sản phẩm (3 PUBLISHED — hai ảnh/một ảnh/không ảnh; 1 HIDDEN `demo-ao-an`), 7 biến thể SKU `DEMO-*` + inventory (dư 13/8, ít 1, hết 0, 10...; đang giữ luôn 0); ảnh webp 750×1000 sinh bằng sharp ghi `.local/uploads` (NODE_ENV=test → `test-uploads`), `storageKey` cố định `demo-<slug>-<n>.webp`; owner ảnh là ADMIN (ưu tiên `ADMIN_EMAIL`, nếu không → ADMIN mới nhất có `disabledAt` null), thiếu admin → exit 1 kèm hướng dẫn `admin:create`; tổng kết 'Đã tạo…'/'… đã có sẵn.' và dòng cuối phân biệt 'Bộ dữ liệu demo đã sẵn sàng…' (đã tạo gì đó) hay 'Toàn bộ bộ dữ liệu demo đã có sẵn…' (lượt chạy no-op) |
| `apps/backend/test/seed-demo.integration.spec.ts` (mới) | Spawn CLI hai lượt bằng `process.execPath`; snapshot (sản phẩm/trạng thái/giá/variants/available/assetKey + `access` file) phải bằng nhau sâu giữa hai lượt; assert 4 sản phẩm, 7 biến thể, ảnh 2/1/0/0 (PUBLISHED không ảnh duy nhất là `demo-quan-jean`), `priceFrom` = min biến thể, available có 0 và 1; cleanup `demo-*` trước/sau lượt chạy (bảng + file webp test-uploads), tự tạo xóa admin riêng của test |
| `apps/backend/package.json`, root `package.json` | Thêm `"seed:demo"` — backend: `npm run build && node --env-file-if-exists=.env dist/cli/seed-demo.js`; root: `npm run seed:demo -w @clothing/backend` |
| `README.md` | Mục mới 'Bộ dữ liệu demo (M3.11)' (điều kiện, hành vi chạy lại, cách dọn). Ngoài ra sửa 2 dòng bảng E2E bị lạc hậu từ trước M3.9 (số ca 18 → 33 và phạm vi catalog M3.9/M3.10) — ngoài danh sách file kế hoạch, cho phép để doc không nói sai |
| `docs/local-trial-m3.md`, `progress.md` | Mục M3.11 (bảng thao tác/thử) và mục này + bảng trạng thái |

### Data flow / key quan trọng

Lệnh `seed:demo` → backend tự build → `node --env-file-if-exists=.env dist/cli/seed-demo.js` → `readEnvironment(.env)` (DB dev) → chọn admin chủ ảnh → từng mục: tra slug → còn thiếu thì tạo ảnh ngoài transaction (file sharp rồi row asset, lỗi thì xóa lại) → một nested create sản phẩm + variants + inventory + movements + productImages → in log tổng kết. Đã có thì chỉ log 'Đã có sẵn', không ghi gì.

- Idempotency theo slug/`storageKey` cố định trong CLI (không thêm ràng buộc DB); chạy lại là no-op, tồn kho chỉ ghi một lần cùng lúc tạo biến thể.
- `uploadsRoot` suy 4 cấp từ `dist/cli` qua `import.meta.url` → độc lập cwd, luôn trùng `.local/uploads` của dev server (test → `test-uploads`).
- Không auto seed: CLI chỉ chạy qua npm script tường minh; không import trong bootstrap/module nào.

### Kiểm tra thực tế (Node 24.22.1; integration qua `vitest.integration.config.ts` với `.env.test`)

| Lệnh | Kết quả |
|---|---|
| Test integration mới trước khi có CLI | FAIL đúng lý do: `Cannot find module .../dist/cli/seed-demo.js` (RED) |
| Lượt test sau CLI | FAIL vì lỗi của chính test: đọc `image.storageKey` thay `image.asset.storageKey`, và assert số sản phẩm không ảnh = 1 (thiếu sản phẩm ẩn); sửa xong lại FAIL vì dòng tổng kết CLI in vô điều kiện → thêm đếm `createdCategories/createdProducts` phân nhánh 'sẵn sàng'/'Toàn bộ… đã có sẵn' |
| `test\seed-demo.integration.spec.ts` | GREEN — Bộ dữ liệu hai lượt deep-equal quay lại ví dụ nhau, ảnh webp tồn tại |
| `test:integration` toàn bộ | 30/30 (29 cũ + 1 mới) |
| `run typecheck` | Exit 0 |
| `npm test` workspace | tools 8 + backend 9 + frontend 180 đạt, exit 0 |
| `run build` | Exit 0 |
| E2E/CI | Không đổi (không spec mới); khung xanh 33/33 từ M3.10 giữ nguyên |

### Vấn đề gặp trong phần này

- `powershell tools/npm.ps1 run build -w @clothing/backend` không nhận `-w` (wrapper từ chối tham số) — agent build backend trực tiếp bằng tsc cục bộ; script `test:integration` của backend đã tự `npm run build` nên luồng chuẩn không bị ảnh hưởng.
- Lỗi còn lại nằm ở test tổng kết/assert của riêng phần này; không có thay đổi nghiệp vụ phát sinh ngoài bảng kế hoạch.

### Chạy thử / điểm dừng

- Chạy `.\tools\npm.ps1 run seed:demo` lần 1 (xem log 'Đã tạo…' + 'Bộ dữ liệu demo đã sẵn sàng…'), lần 2 thấy chỉ 'Đã có sẵn' + 'Toàn bộ… không tạo thêm'.
- Mở `http://127.0.0.1:5173/shop` → kiểm bảng từng tình huống ở [docs/local-trial-m3.md](docs/local-trial-m3.md) § M3.11 (gallery 2 ảnh, 'Còn 1 sản phẩm', 'Hết hàng', 'Chưa có ảnh', `/products/demo-ao-an` → 'Không tìm thấy sản phẩm.', kho admin thấy SKU `DEMO-*`, lịch sử kho có dòng 'Nhập kho demo').
- **Dừng ở M3.11 chờ người dùng chạy thử.** M3.12 (ghép `catalog.spec.ts` + checklist chốt M3) sẽ gửi kế hoạch riêng khi được yêu cầu. Commit/push/PR chỉ khi người dùng yêu cầu.

## Ngày 29/10/2026 — M3.10 (Người B): trang chi tiết sản phẩm công khai và chọn biến thể

**Phạm vi:** người dùng duyệt kế hoạch M3.10 trong chat: route `/products/:slug` (StoreLayout) — breadcrumb 'Bộ sưu tập → danh mục → tên'; nhóm ảnh chính + thumbnail ('Xem ảnh N'), khối 'Chưa có ảnh' khi trống; mô tả khi có; chọn biến thể bằng nút `size · màu` trong nhóm 'Chọn biến thể' (không chọn sẵn — chưa chọn hiện 'Giá từ …'); chọn xong hiện giá biến thể + 'Còn N sản phẩm' / 'Hết hàng'; hàng ẩn/slug sai → Alert 'Không tìm thấy sản phẩm.' có 'Quay lại bộ sưu tập', lỗi khác có 'Tải lại sản phẩm'. Backend `GET /products/:slug` có sẵn từ M3.4/M3.8 — không đổi code backend. Không làm nút thêm giỏ (giỏ thuộc mốc sau — tránh UI giả). `e2e/catalog.spec.ts` vẫn ngoài `test:e2e:implemented` (M3.12 ghép). **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.** Chưa commit/push phần này.

### Đã viết / file thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/catalog/api/catalog.api.ts` | Thêm `catalogApi.detail(slug)` → `GET /api/v1/products/:slug` (slug qua `encodeURIComponent`) và `catalogDetailKey`; tái dùng kiểu `CatalogProduct` |
| `apps/frontend/src/features/catalog/pages/ProductDetailPage.tsx` (mới) | Trang chi tiết: breadcrumb (nav 'Breadcrumb sản phẩm' có link danh mục về `/shop?categoryId=…`), Gallery (ảnh chính đổi khi bấm thumbnail, placeholder không ảnh), h1 tên, giá/dòng tồn theo biến thể chọn, nhóm nút biến thể, mô tả; loading 'Đang tải sản phẩm…'; 404 chỉ có 'Quay lại bộ sưu tập', lỗi khác thêm 'Tải lại sản phẩm' |
| `apps/frontend/src/features/catalog/pages/ProductDetailPage.test.tsx` (mới) | 10 test UI qua `App` (harness `renderDetail`, mock `client.request` theo đường dẫn): tải theo slug + breadcrumb + mô tả + 'Giá từ …' khi chưa chọn; gallery đổi ảnh theo thumbnail + aria-pressed; nhóm biến thể đủ tên; chọn 'M · đen' → 'Còn 10 sản phẩm' + giá; đổi 'S · trắng' → 'Còn 3 sản phẩm'; available 0 → 'Hết hàng'; 'Chưa có ảnh'; 404 alert + không nút tải lại + về `/shop`; lỗi mạng + tải lại thành công; loading chờ response |
| `apps/frontend/src/app/App.tsx` | Thêm route `products/:slug` → `ProductDetailPage` |
| `apps/frontend/e2e/catalog-detail.spec.ts` (mới) | 3 ca trên DB `_test` (seed Prisma, token uuid, SKU HOA, cleanup afterAll): vào từ `/shop` theo token → URL `/products/<slug>` + breadcrumb + mô tả + 'Giá từ 200.000 ₫' + thứ tự nút theo sku tăng ('M · đen', 'S · trắng') → chọn M 'Còn 10 sản phẩm' + 250.000, chọn S 'Còn 3 sản phẩm' + 200.000; reload giữ trang, lựa chọn không giữ sau reload, mobile 390px không tràn (kèm ảnh chụp); hàng HIDDEN và slug lạ → alert 'Không tìm thấy sản phẩm' + 'Quay lại bộ sưu tập' |
| `package.json`, `.github/workflows/ci.yml` | `test:e2e:implemented` và tên bước CI thêm `catalog-detail.spec.ts` (trước catalog-list theo bảng chữ cái → 10 spec) |
| `progress.md`, `docs/local-trial-m3.md` | Mục này và hướng dẫn chạy thử M3.10 |

### Data flow / key quan trọng

Khách bấm link tên trên `/shop` → `/products/<slug>` → `useQuery([...catalogDetailKey, slug])` gọi `GET /api/v1/products/:slug` → backend lọc `visible` (PUBLISHED + danh mục bật + biến thể bật), trả ảnh (URL `/api/v1/media/<assetId>`) và variants (size viết hoa, màu viết thường, `available = onHand − reserved`) sắp theo sku tăng → UI render; bấm nút biến thể chỉ đổi `variantId` state cục bộ — giá và dòng tồn đổi ngay, không gọi API thêm.

- Nhãn nút là `${variant.size} · ${variant.color}` — form admin viết thường màu trước khi lưu (`variantDrafts.ts`) và DTO viết hoa size, nên 'M · đen' khớp chính xác `/M · đen/` trong `catalog.spec.ts` (M3.12).
- Lỗi phân loại theo `ApiError.status === 404`: đúng hàng không có/hàng ẩn chỉ hiện đường về `/shop`; lỗi khác (mạng, dịch vụ) hiện 'Tải lại sản phẩm' (`refetch`, `retry: false`).
- Lựa chọn biến thể nằm trong state (không URL): F5 giữ đúng trang chi tiết nhưng về mặc định 'Giá từ …' — deep link/refresh hoạt động, chỉ mất lựa chọn.

### Kiểm tra thực tế (Node 24.22.1 qua `tools/npm.ps1`, E2E qua `node tools/test-e2e.mjs`)

| Lệnh | Kết quả |
|---|---|
| Test trang trước khi code | 10 test fail đúng lý do: `/products/<slug>` rơi vào NotFoundPage, thiếu heading/alert/gallery (RED) |
| `vitest ProductDetailPage.test.tsx` | Lượt 1: 7/10 — thiếu import `Alert` (MUI) và query link 'Bộ sưu tập' trùng nav header (thu hẹp trong breadcrumb); lượt 2: 10/10 |
| `vitest` frontend toàn bộ | 180/180 — baseline 170 ở M3.9 + 10 mới |
| `test` toàn workspace | tools 8 + backend 9 + frontend 180 đạt |
| `run typecheck` | 1 lần chạm `exact` không thuộc `ByRoleOptions` (test UI viết theo kiểu Playwright), gỡ khỏi role query → đạt |
| `run build` | Exit 0 đã xác minh (`EXITCODE=0`); cảnh báo chunk Vite có sẵn; lượt đầu PowerShell phiên dịch stderr thành exit 1, không phải lỗi build |
| `run test:integration` | 29/29 (exit 0 xác minh) |
| E2E riêng `catalog-detail.spec.ts` | Lượt 1: 2/3 — sai kỳ vọng thứ tự nút (seed theo mảng, backend trả theo sku asc); sửa kỳ vọng → 3/3 |
| E2E implemented 10 spec | 33/33 (37.3s), lượt này không gặp flake Vite |

### Vấn đề gặp trong phần này

- Seed E2E trực tiếp qua Prisma vẫn cần SKU viết HOA (CHECK `variant_fields_valid`) — đã nêu ở M3.9, giữ nguyên quy tắc.
- Lỗi trong lượt này đều là sai sót của bản test (import thiếu, kỳ vọng thứ tự), không có thay đổi thiết kế phát sinh so với bảng kế hoạch.
- E2E không seed ảnh thật (cần asset upload phức tạp) — gallery chỉ được phủ ở test UI với ảnh mock; khi M3.12 ghép `catalog.spec.ts` (upload ảnh thật qua admin) sẽ phủ thêm trang chi tiết có ảnh.

### Chạy thử / điểm dừng

- Mở `http://localhost:5173/shop` → bấm một card sản phẩm → thấy chi tiết: breadcrumb, ảnh/thumbnail (hàng có ảnh upload từ admin trước đó), mô tả; bấm 'M · đen' → giá + 'Còn N sản phẩm'; đổi variant khác đổi theo; F5 không mất trang, chỉ mất lựa chọn; 'Quay lại bộ sưu tập' về `/shop`.
- Hàng ẩn: vào `/products/<slug>` của hàng chưa xuất bản hoặc gõ slug lạ → 'Không tìm thấy sản phẩm.'.
- Hướng dẫn chi tiết: [docs/local-trial-m3.md](docs/local-trial-m3.md) § M3.10.
- **Dừng ở M3.10 chờ người dùng chạy thử.** M3.11 (seed demo) sẽ gửi kế hoạch riêng khi được yêu cầu. Commit/push/PR chỉ khi người dùng yêu cầu.

## Ngày 29/10/2026 — M3.9 (Người B): catalog khách tìm và lọc danh sách hàng công khai

**Phạm vi:** người dùng duyệt kế hoạch M3.9 trong chat: thay trang giới thiệu tại `/shop` bằng trang danh sách thật (tìm theo tên/SKU, chọn danh mục, sắp thứ tự, phân trang; bộ lọc nằm trên URL nên refresh/Back giữ đúng; card là liên kết tới `/products/<slug>` — trang chi tiết thuộc M3.10, bấm vào sẽ 404 tạm). `e2e/catalog.spec.ts` vẫn ở ngoài `test:e2e:implemented` theo chỉ dẫn cũ (M3.12 ghép khi đủ chi tiết + dữ liệu demo). **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.** Chưa commit/push phần này.

### Đã viết / file thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/catalog/api/catalog.api.ts` (mới) | `catalogApi.list({ q, page, sort, categoryId })` (pageSize cố định 12, bỏ tham số rỗng) và `catalogApi.categories()`; kiểu khớp response công khai của backend |
| `apps/frontend/src/features/catalog/pages/CatalogPage.tsx` (mới) | Trang `/shop`: tiêu đề gọn thay hero dài; form tìm (Enter/Tìm kiếm); select 'Thứ tự sắp xếp' + 'Danh mục' (native, nhãn shrink); nút 'Xóa tìm kiếm'/'Xóa lọc'; lưới card (ảnh đầu hoặc khối 'Chưa có ảnh', tên danh mục, tên sản phẩm là liên kết, 'Giá từ …' theo `Intl.NumberFormat('vi-VN', VND)`); phân trang MUI với nhãn tiếng Việt; loading/empty/error + 'Tải lại bộ sưu tập'; guard URL hợp lệ (trang, q ≤ 80, sort, categoryId UUID) |
| `apps/frontend/src/features/catalog/pages/CatalogPage.test.tsx` (mới) | 15 test: card/link/ảnh/giá/tổng; placeholder không ảnh; loading chờ response; tìm trim, đặt lại trang, Back khôi phục; sort/danh mục ghi URL và lần gọi API; phân trang giữ q; đọc cả 4 bộ lọc từ URL lúc đầu; empty có lọc (Xóa lọc) và không lọc; lỗi + tải lại; 4 loại bộ lọc sai không gọi API |
| `apps/frontend/src/app/App.tsx` | Route `/shop`: `CatalogIntroPage` → `CatalogPage` |
| `apps/frontend/src/features/catalog/pages/CatalogIntroPage.tsx` + `.test.tsx` | Xóa — trang giới thiệu placeholder (6 test) hết nhu cầu sau khi có danh sách thật |
| `apps/frontend/e2e/catalog-list.spec.ts` (mới) | 4 ca trên DB `_test`: chỉ PUBLISHED trong danh mục bật hiển thị (seed token uuid trùng khó: 4 sản phẩm gồm HIDDEN và PUBLISHED trong danh mục đã tắt); lọc kết hợp q+categoryId+sort trên URL, giữ qua reload, 'Xóa lọc' về mặc định; keyword không khớp + abort mạng + nút 'Tải lại bộ sưu tập'; mobile 390px + thứ tự mới nhất (kèm ảnh chụp) |
| `apps/frontend/e2e/auth.spec.ts` | 2 điểm kỳ vọng dựa vào khối phiên của trang intro bị xóa: lúc đăng nhập, `/shop` kiểm tra link 'Tài khoản' ở nav 'Điều hướng chính' (trước: trong `main`); lúc đăng xuất kiểm tra link 'Đăng nhập' và không còn 'Tài khoản'. Ý "trang /shop phản ánh phiên" giữ nguyên |
| `package.json`, `.github/workflows/ci.yml` | `test:e2e:implemented` và tên bước CI thêm `catalog-list.spec.ts` (thứ tự bảng chữ cái sau auth) |
| `progress.md`, `docs/local-trial-m3.md` | Mục này và hướng dẫn chạy thử M3.9 |

### Data flow / key quan trọng

Khách nhập tìm/chọn danh mục/đổi thứ tự/sang trang → `setSearch` cập nhật URL `/shop?...` → query TanStack `catalogApi.list` gọi `GET /api/v1/products` (q, categoryId, sort, page, pageSize=12) → backend lọc cố định `PUBLISHED + danh mục bật + biến thể bật`, sort `newest/price-asc/price-desc`, trả items + total → lưới card + 'Tìm thấy N sản phẩm.' + phân trang; danh mục cho ô lọc lấy từ `GET /api/v1/categories` (mảng danh mục bật).

- `filtersUsable` (trang hợp lệ + q ≤ 80 + sort hợp lệ + categoryId UUID): sai → alert + nút sửa ('Về trang đầu'/'Xóa tìm kiếm'/'Xóa lọc') và cả hai query đều không gọi API.
- 'Xóa lọc' chỉ nằm ở hàng bộ lọc, hiện khi có bộ lọc và guard hợp lệ; empty-state chỉ giữ 'Về trang đầu' cho trang > 1.
- Query key gồm `[shop-catalog, categoryId, q, rawSort, sort, page]` nên mỗi bộ lọc một cache riêng; đổi tham số tự gọi API mới (không nút Áp dụng cho sort/danh mục).

### Kiểm tra thực tế (Node 24.22.1 qua `tools/npm.ps1`, E2E qua `node tools/test-e2e.mjs`)

| Lệnh | Kết quả |
|---|---|
| Test trang trước khi code | 15 test fail đúng lý do: `/shop` còn trang giới thiệu, thiếu heading/card/guard (RED) |
| `vitest src/features/catalog` | 15/15 (kèm 3 lượt chỉnh: key form, lọc categories theo guard, regex giá dùng `\s`) |
| `vitest` frontend toàn bộ (sau chỉnh nhãn select) | 170/170 — baseline 161 ở M3.7.3, −6 test trang giới thiệu, +15 test M3.9 |
| `test` toàn workspace | 8 công cụ + 9 backend + 170 frontend đạt |
| `run typecheck` | Đạt (1 lần chạm `exactOptionalPropertyTypes`, sửa bằng spread có điều kiện) |
| `run build` | Exit 0; cảnh báo chunk Vite có sẵn |
| `run test:integration` | 29/29 |
| E2E implemented 9 spec | Lượt 1: 25/30 (2 lỗi spec mới + 2 điểm auth.spec); lượt 2: 29/30; lượt 3: 30/30 (38.1s) |

### Vấn đề gặp trong phần này

- Seed E2E trực tiếp qua Prisma bị DB chặn `variant_fields_valid` vì CHECK yêu cầu SKU viết HOA; seed không qua DTO nên tự viết hoa token trong SKU của spec.
- `auth.spec.ts` (chung) kỳ vọng khối phiên của trang intro trong `main` của `/shop` — trang intro bị xóa theo kế hoạch nên 2 điểm chuyển sang kiểm tra link phiên ở nav header; 'Tạo tài khoản' không còn hiển thị trên `/shop` (khách dùng link 'Đăng nhập', trang đăng nhập có đường sang đăng ký). Khác biệt so với bảng kế hoạch, nêu rõ tại đây.
- Nút 'Xóa lọc' đầu tiên chỉ nằm trong empty-state — E2E bắt thiếu khi lọc trả về có kết quả; chuyển nút lên hàng bộ lọc và bỏ bản trùng trong empty-state.
- Nhãn select 'Danh mục' đè chữ 'Tất cả danh mục' khi rỗng (select native); `inputLabel.shrink: true` sửa; bắt từ ảnh mobile 390px agent đã xem.
- Git sau phần này: `main` đã có M3.4.2–M3.8 (PR #9, #10); nhánh đang làm chứa commit M3.7.2 `8be0ab5`, M3.7.3 `94b2b33` + các thay đổi M3.9 chưa commit.

### Chạy thử / điểm dừng

- `tools/setup-local.mjs` như README để có server; mở `http://localhost:5173/shop` (hoặc theo hướng dẫn [docs/local-trial-m3.md](docs/local-trial-m3.md)): tìm theo tên/SKU, chọn danh mục, đổi thứ tự, sang trang; refresh và Back giữ bộ lọc; nhập URL sai (khi ví dụ `?page=abc`) thấy cảnh báo và không gọi API; gửi lỗi mạng bằng cách tắt server để thử 'Tải lại bộ sưu tập'.
- Bấm vào card → `/products/<slug>` 404 tạm — trang chi tiết là M3.10.
- **Dừng ở M3.9 chờ người dùng thử.** M3.10 (chi tiết + chọn biến thể) sẽ gửi kế hoạch riêng; M3.11 (seed demo) theo sau. Commit/push/PR chỉ khi người dùng yêu cầu.

## Ngày 29/10/2026 — Push, PR và CI cho M3.4.2–M3.8 (Người A)

- Người dùng yêu cầu push 4 nhánh và mở PR. Trước khi push, `main` đã có PR #4 (M3.7.1 của Người B) nên đã rebase cả chuỗi lên `main` mới; xung đột chỉ ở file dùng chung (README, CI, `package.json`, `progress.md`, `docs/local-trial-m3.md`), gộp giữ cả hai bên. Mã commit sau rebase: M3.4.2 `3c18ca9`, M3.5 `5c2447f`, M3.6 `3d184a4`, M3.8 `1e7b57b` (thay cho `31ef890`/`3e2bd91`/`cf5a141`/`e955675` ghi ở các mục dưới).
- Kiểm tra lại sau rebase bằng Node 24.22.1: typecheck, build đạt; unit 8 tools + 9 backend + 124 frontend; integration 29/29; E2E implemented 18/18 (gồm 3 ca kho của Người B).
- Mở PR xếp chồng #5 (M3.4.2 → `main`), #6 (M3.5), #7 (M3.6), #8 (M3.8). CI GitHub đạt cả 4 PR, đủ bước typecheck/build/unit/integration/E2E.
- Bốn PR được merge liền nhau: chỉ #5 vào `main`, #6–#8 rơi vào nhánh base trung gian. Đã mở #9 từ `feat/m3.8-publish` vào `main` (nội dung trùng khớp nhánh sau khi merge #6–#8, không xung đột); CI của #9 đạt, #9 đã merge. `main` tại `13b0578` có đủ M3.4.2, M3.5, M3.6, M3.8 và M3.7.1; CI trên `main` sau merge đạt.
- Bài học: với PR xếp chồng, merge từng PR và chờ PR kế tiếp đổi base sang `main`; hoặc mở PR thẳng vào `main` sau khi phần trước đã merge.
- Dọn dòng `=======` còn sót từ lần merge cũ trong `progress.md`. Bốn nhánh đã merge chưa xóa trên GitHub (thao tác xóa cần người dùng cho phép rõ).
- Trạng thái nghiệm thu: người dùng đã thử M3.5; M3.4.2, M3.6, M3.8 đã qua kiểm tra local và CI, chờ người dùng thử.

## Ngày 29/10/2026 — M3.8 (Người A): xuất bản và ẩn sản phẩm

**Phạm vi:** người dùng duyệt kế hoạch M3.8 (gồm khóa Xuất bản khi còn thay đổi chưa lưu) và cho commit M3.6 (`cf5a141`). Nhánh `feat/m3.8-publish` tạo từ `feat/m3.6-image-order`. Phiên làm việc bị ngắt sau khi viết test đầu; đã kiểm tra lại Git và tiếp tục đúng phạm vi. **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.** Chưa commit/push M3.8.

### File thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/admin/products/api/products.api.ts` | `productsApi.publish` / `hide` (POST `{expectedVersion}`) |
| `apps/frontend/src/features/admin/products/components/ProductStatusPanel.tsx` (mới) | Nhãn trạng thái, 3 điều kiện Đạt/Chưa đạt, Xuất bản/Ẩn sản phẩm, thông báo, chống bấm lặp |
| `apps/frontend/src/features/admin/products/components/ProductStatusPanel.test.tsx` (mới) | 9 test: xuất bản, điều kiện chưa đạt, danh mục chưa rõ, chưa lưu, ẩn, xuất bản lại khi đã ẩn, lỗi 409, bấm đúp, khóa khi page bận |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.tsx` | Khung trạng thái cho mọi trạng thái, thao tác `status`, thay snapshot sau khi đổi trạng thái, gom cờ chưa lưu, tiêu đề Quản lý sản phẩm khi không còn nháp |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.tsx` | `onDirtyChange`: so trạng thái form với lúc mở |
| `apps/frontend/src/features/admin/products/components/ProductImagesManager.tsx` | `onDirtyChange`: báo khi danh sách ảnh khác bản đã lưu |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.test.tsx` | 3 test: xuất bản rồi ẩn dùng đúng version, khóa khi thông tin chưa lưu, khóa khi ảnh chưa lưu |
| `apps/frontend/src/features/admin/products/pages/ProductsPage.tsx` / `.test.tsx` | Link Quản lý cho hàng Đã xuất bản/Đã ẩn và test |
| `apps/frontend/e2e/product-status.spec.ts` (mới) | Luồng xuất bản/ẩn/xuất bản lại với API công khai và media, server từ chối khi danh mục bị tắt ở DB, ACL, mobile |
| `package.json`, `.github/workflows/ci.yml`, `README.md`, `docs/local-trial-m3.md`, `docs/architecture.md`, `docs/m3-implementation-plan.md`, `docs/plan.md` | Đăng ký spec mới, trạng thái, hướng dẫn thử |

Đúng danh sách kế hoạch. Backend, schema, migration, dependency không đổi.

### Data flow / key

Bấm Xuất bản → POST `/admin/products/:id/publish` `{expectedVersion}` → `ProductsService.state` kiểm tra version, đổi trạng thái và kiểm tra lại danh mục/ảnh/biến thể trong transaction (409 + rollback nếu không đạt) → page thay snapshot, invalidate danh sách → `/api/v1/products` và `/api/v1/media/:id` công khai trả dữ liệu. Ẩn đi qua `/hide`.

- `status`: DRAFT/PUBLISHED/HIDDEN; HIDDEN xuất bản lại được, không có đường về DRAFT.
- Điều kiện trên UI tính từ dữ liệu đã lưu; server là bên quyết định.
- `unsaved` (từ `onDirtyChange`): chặn xuất bản khi form/ảnh còn thay đổi vì xuất bản gỡ hai phần này khỏi trang.

### Kiểm tra thực tế (Node 24.22.1 qua `./tools/npm.ps1`)

| Lệnh | Kết quả |
|---|---|
| Test mới trước khi viết code | 4 test trang/danh sách fail vì chưa có nút Xuất bản/link Quản lý; test khung trạng thái fail vì chưa có component (RED) |
| `run typecheck` | Đạt |
| `test` | 8 tools + 9 backend + 105 frontend đạt |
| `run build` | Exit 0; cảnh báo chunk Vite có sẵn |
| `run test:integration` | 29/29 đạt |
| `run test:e2e:implemented` | 15/15 đạt, khoảng 32 giây |
| Ảnh mobile 390px | Agent đã xem: Quản lý sản phẩm, nhãn Đã xuất bản, thông báo, nút Ẩn, không tràn ngang |

Lần chạy E2E đầu fail do test: trang tải lại danh mục sau khi test đã tắt danh mục trong DB nên UI đúng là khóa nút, test chờ bấm đến hết giờ. Sửa test chờ danh mục tải xong trước khi tắt ở DB; chạy lại 2/2 rồi toàn bộ 15/15 đạt. Không đổi code app cho lỗi này.

### Giới hạn / chạy thử / điểm dừng

- Sau khi xuất bản không quay lại nháp và không sửa được trên UI (giữ quy tắc chỉ sửa DRAFT).
- Trang khách `/shop` chưa có (M3.9); kiểm tra hiển thị công khai qua URL API.
- `e2e/catalog.spec.ts` vẫn cần trang tạo sản phẩm chuyển sang trang sửa (M3.12).
- Hướng dẫn: [local-trial-m3.md](docs/local-trial-m3.md#m38--admin-xuất-bản-và-ẩn-sản-phẩm).

**Dừng ở M3.8 chờ người dùng thử.** Các phần còn lại của Người A trong M3 là M3.12 (cùng Người B); M3.7/M3.9–M3.11 thuộc Người B.

## Ngày 29/10/2026 — Môi trường: Node 24.22.1 local và DB local

- Người dùng yêu cầu cài Node. Tải `node-v24.22.1-win-x64.zip` từ nodejs.org, SHA-256 khớp `SHASUMS256.txt`, giải nén vào `.local/node-v24.22.1-win-x64` (bị Git bỏ qua). Không đổi Node toàn máy. `./tools/npm.ps1` chạy được từ đây.
- DB `clothing_local` trên máy này chưa có migration (0 bảng) nên đăng nhập lỗi 500 `relation "sessions" does not exist`. Đã chạy `npm run db:migrate` (migrate deploy) trên DB trống; người dùng yêu cầu tạo admin và agent chạy `admin:create` với mật khẩu người dùng cung cấp (không ghi vào file/log).

## Ngày 29/10/2026 — M3.6 (Người A): sắp xếp và gỡ ảnh

**Phạm vi:** người dùng đã thử M3.5 (ảnh hiển thị và lưu được), duyệt kế hoạch M3.6 và cho commit M3.5 (`3e2bd91`). Nhánh `feat/m3.6-image-order` tạo từ `feat/m3.5-images`. **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.** Chưa commit/push M3.6.

### File thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/admin/products/components/ProductImagesManager.tsx` | Chuyển sang `saved`/`rows`: lên/xuống, gỡ ảnh đã lưu, Hủy thay đổi ảnh, Lưu chỉ bật khi khác bản đã lưu, cảnh báo khi gỡ |
| `apps/frontend/src/features/admin/products/components/ProductImageTile.tsx` (mới) | Một ô ảnh: thumbnail, nhãn Ảnh chính, nút Lên/Xuống/Gỡ (hoặc Bỏ) có aria-label theo vị trí |
| `apps/frontend/src/features/admin/products/components/ProductImagesManager.test.tsx` | 3 test mới: sắp xếp và lưu đúng thứ tự, gỡ + hủy + lưu, ảnh mới thành ảnh chính |
| `apps/frontend/e2e/product-images.spec.ts` (mới) | Fixture/cleanup riêng; ca M3.5 chuyển sang; ca M3.6 với 2 ảnh thật, kiểm tra `position` trong DB, hủy rồi gỡ, refresh, mobile |
| `apps/frontend/e2e/products.spec.ts` | Bỏ ca ảnh và phần dọn ảnh; giống hệt bản M3.4.2 |
| `package.json` | Thêm `product-images.spec.ts` vào `test:e2e:implemented` |
| `.github/workflows/ci.yml`, `README.md`, `docs/local-trial-m3.md`, `docs/architecture.md`, `docs/m3-implementation-plan.md`, `docs/plan.md` | Trạng thái, hướng dẫn thử và tổ chức code M3.6 |

Khác kế hoạch: tách E2E ảnh sang file riêng vì `products.spec.ts` đã 326 dòng; chỉ chuyển ca có sẵn, không đổi nội dung kiểm tra (thêm `animations: 'disabled'` cho ảnh chụp). Backend, schema, migration, dependency không đổi.

### Data flow / key

Lên/Xuống/Gỡ chỉ đổi `rows` trong trình duyệt → Lưu thứ tự ảnh → PUT `/admin/products/:id/images` với `assetIds` theo thứ tự và `expectedVersion` → transaction xóa danh sách cũ, ghi `position` 0..n → page nhận version mới, `rows` thành `saved`.

- `saved` / `rows`: bản server đang giữ và bản đang chỉnh.
- `position` 0: ảnh chính.
- Ảnh đã gỡ và lưu không khôi phục được (asset quá 24 giờ không gắn lại được và bị dọn).

### Kiểm tra thực tế (Node 24.22.1 qua `./tools/npm.ps1`)

| Lệnh | Kết quả |
|---|---|
| 3 test mới trước khi viết code | 3/3 fail vì chưa có nút Lên/Gỡ/Hủy (RED) |
| `run typecheck` | Đạt |
| `test` | 8 tools + 9 backend + 92 frontend đạt |
| `run build` | Exit 0; cảnh báo chunk Vite có sẵn |
| `run test:integration` | 29/29 đạt |
| `run test:e2e:implemented` | 13/13 đạt, khoảng 29 giây |
| Ảnh mobile 390px | Agent đã xem: một ảnh còn lại có Ảnh chính, Lên/Xuống tắt, Lưu/Hủy bật, cảnh báo gỡ rõ, không tràn ngang |

Ảnh chụp đầu tiên cho thấy nút Lưu còn xám vì chụp giữa hiệu ứng chuyển màu 250ms của MUI; thêm `animations: 'disabled'` cho `page.screenshot` và chạy lại spec ảnh (2/2 đạt) thì trạng thái nút khớp logic. Rà lại: đổi cảnh báo gỡ từ chữ màu `warning.main` (tương phản thấp) sang `Alert` warning `role="status"`.

### Giới hạn / chạy thử / điểm dừng

- Sắp xếp bằng nút Lên/Xuống, chưa có kéo-thả.
- Ảnh đã gỡ và lưu không lấy lại được.
- Hướng dẫn: [local-trial-m3.md](docs/local-trial-m3.md#m36--admin-sắp-xếp-và-gỡ-ảnh-đã-gắn).

**Dừng ở M3.6 chờ người dùng thử.** M3.8 (xuất bản/ẩn) cần kế hoạch riêng được duyệt.

## Ngày 29/10/2026 — M3.5 (Người A): tải và gắn ảnh thật

**Phạm vi:** người dùng duyệt kế hoạch M3.5 và cho commit M3.4.2 trước (`31ef890` trên `feat/m3.4.2-variants`). M3.5 làm trên nhánh `feat/m3.5-images` tạo từ nhánh đó. **Đã viết, agent đã kiểm tra local; người dùng đã thử (ảnh hiển thị và lưu được); đã commit `3e2bd91`, chưa push.**

### File thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/admin/products/api/uploads.api.ts` (mới) | `uploadsApi.image(file)` gửi multipart qua client CSRF chung |
| `apps/frontend/src/features/admin/products/api/products.api.ts` | `ProductImagesInput` và `productsApi.images` (PUT) |
| `apps/frontend/src/features/admin/products/components/ProductImagesManager.tsx` (mới) | Chọn file (ẩn trực quan nhưng Tab tới được), kiểm tra loại/5 MB/8 ảnh, thumbnail, ảnh chưa lưu, Lưu thứ tự ảnh, thông báo lỗi/thành công |
| `apps/frontend/src/features/admin/products/components/ProductImagesManager.test.tsx` (mới) | 8 test: tải và lưu đúng thứ tự, chặn loại/kích thước, lỗi 415/413, bỏ ảnh chưa lưu, lỗi gắn giữ ảnh, chống tải lặp, giới hạn 8, khóa khi page bận |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.tsx` | Khung ảnh, thao tác `images` trong khóa chung, cập nhật `version`/`images` của snapshot sau PUT; từ chối (không im lặng) khi không lấy được khóa |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.tsx` | Bỏ bản copy snapshot riêng, đọc `expectedVersion` từ snapshot của page |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.test.tsx` | Stub upload/PUT ảnh; test chuỗi version ảnh → thông tin và khóa nút trong lúc gắn ảnh |
| `apps/frontend/e2e/products.spec.ts` | Ca ảnh thật: file giả 415, PNG sharp, lưu ảnh rồi lưu tên (version 1 → 2), thumbnail tải được sau refresh, media công khai 404 cho nháp, mobile; cleanup xóa thêm product_images/upload_assets và file `.local/test-uploads` của lượt chạy |
| `.github/workflows/ci.yml`, `README.md`, `docs/local-trial-m3.md`, `docs/architecture.md`, `docs/m3-implementation-plan.md`, `docs/plan.md` | Trạng thái, hướng dẫn thử và tổ chức code M3.5 |

Đúng danh sách kế hoạch. Backend, schema, migration, dependency không đổi.

### Data flow / key

Chọn file → POST multipart `/admin/uploads/images` → sharp giải mã, ghi WebP ngoài transaction, tạo `UploadAsset` tạm → thumbnail chưa lưu → Lưu thứ tự ảnh → PUT `/admin/products/:id/images` `{assetIds, expectedVersion}` → transaction kiểm tra version/chủ asset/24 giờ, ghi `ProductImage` → page nhận version mới, form thông tin giữ phần đang nhập.

- `UploadAsset` tạm: ảnh đã tải chưa gắn, riêng người tải, dọn sau 24 giờ.
- `assetIds`: danh sách đầy đủ theo thứ tự; server thay toàn bộ.
- Chuỗi `version`: PUT chỉ thành công trên version đã chốt nên version trả về an toàn cho form thông tin.
- `operation = 'images'`: khóa chung với lưu/tải lại.

### Kiểm tra thực tế

| Lệnh | Kết quả |
|---|---|
| Test mới trước khi viết code | Page test fail vì chưa có ô "Tải ảnh sản phẩm"; test component fail vì chưa có `uploads.api` (RED) |
| `npm run typecheck` | Đạt |
| `npm test` | 9 backend + 89 frontend đạt (tools 8 đạt ở lượt M3.4.2, không đổi) |
| `npm run build` | Đạt; cảnh báo chunk Vite có sẵn |
| `npm run test:integration` | 29/29 đạt |
| `npm run test:e2e:implemented` | 12/12 đạt, khoảng 26 giây |
| Ảnh mobile 390px | Agent đã xem: thumbnail ảnh thật, thông báo đã lưu, form không tràn ngang |
| Thư mục `.local/test-uploads` sau E2E | Không còn file của lượt E2E; còn 4 file nhỏ có từ trước và từ lượt integration (xem giới hạn) |

Lệnh chạy bằng npm trực tiếp với Node 24.15.0 như M3.4.2 (chưa có Node 24.22.1+ trên máy). Rà lại code phát hiện `saveImages` trả về im lặng khi không lấy được khóa sẽ làm khung ảnh báo thành công giả; đã đổi sang từ chối.

### Giới hạn / chạy thử / điểm dừng

- Chưa gỡ/đổi thứ tự ảnh đã lưu (M3.6). Tải dữ liệu mới bỏ cả ảnh chưa lưu.
- Upload chỉ hoạt động local; production từ chối vì chưa cấu hình nơi lưu ảnh.
- `catalog.integration.spec.ts` có sẵn để lại một file WebP nhỏ trong `.local/test-uploads` mỗi lần chạy; ngoài phạm vi M3.5, cần sửa riêng.
- `e2e/catalog.spec.ts` mong trang tạo sản phẩm chuyển sang trang sửa; hiện về danh sách, để M3.12 xử lý.
- Hướng dẫn: [local-trial-m3.md](docs/local-trial-m3.md#m35--admin-tải-và-gắn-ảnh-thật-cho-sản-phẩm-nháp).

**Dừng ở M3.5 chờ người dùng thử.** M3.6 (gỡ/sắp xếp ảnh) cần kế hoạch riêng được duyệt.

## Ngày 29/10/2026 — M3.4.2 (Người A): sửa, thêm và tắt biến thể

**Phạm vi:** người dùng yêu cầu bắt đầu phần Người A theo kế hoạch M3.4.2 đã gửi; giữ quy tắc chỉ sản phẩm DRAFT. Nhánh `feat/m3.4.2-variants`. **Đã viết, agent đã kiểm tra local; người dùng cho tiếp tục; đã commit `31ef890`, chưa push.**

### File thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/admin/products/api/products.api.ts` | `VariantUpdateInput.id` thành tùy chọn để gửi biến thể mới |
| `apps/frontend/src/features/admin/products/components/variantDrafts.ts` (mới) | Kiểu `VariantDraft`, chuyển đổi sang input PATCH, `validateVariants` theo dòng |
| `apps/frontend/src/features/admin/products/components/VariantFields.tsx` (mới) | Một khung biến thể: SKU/size/màu/giá/bật, nút Bỏ dòng này cho dòng mới |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.tsx` | Danh sách dòng biến thể, thêm/bỏ dòng mới, kiểm tra trước gửi, thông báo 409 nêu cả SKU/size–màu |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.test.tsx` (mới) | 6 test: sửa giữ ID/tắt thay xóa, thêm không có id, bỏ dòng mới, lỗi theo dòng, 409 giữ input, khóa khi page bận |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.test.tsx` | Cập nhật kỳ vọng từ biến thể chỉ đọc sang ô nhập, thông báo 409 mới, khóa ô biến thể khi lưu |
| `apps/frontend/e2e/products.spec.ts` | Thay ca sửa nháp: sửa giá, thêm biến thể, SKU của sản phẩm khác bị 409 và DB không đổi, tắt biến thể, mobile; cập nhật thông báo ca hai tab |
| `.github/workflows/ci.yml` | Tên bước E2E ghi phạm vi đến M3.4.2 |
| `README.md`, `docs/local-trial-m3.md`, `docs/architecture.md`, `docs/m3-implementation-plan.md`, `docs/plan.md` | Trạng thái, hướng dẫn thử và tổ chức code M3.4.2 |

So với kế hoạch: thêm `variantDrafts.ts` để tách logic thuần (kiểm tra/chuyển đổi) khỏi component. Backend, schema, migration, dependency không đổi.

### Data flow / key

Admin sửa/thêm/tắt dòng → `validateVariants` chặn SKU trùng, size+màu trùng, giá sai ngay trên form → PATCH `/admin/products/:id` (biến thể cũ kèm `id`, mới không có `id`) → `ProductsService.update` kiểm tra version, chặn xóa, cập nhật/tạo biến thể + inventory 0, tính lại `priceFrom` trong transaction → FE invalidate `admin-products`, về danh sách.

- `VariantDraft`: state một dòng; giá giữ chuỗi khi đang gõ.
- `id` có/không: cập nhật hay tạo mới; biến thể đã lưu chỉ tắt bằng `active`.
- `variants.<index>.<field>`: khóa lỗi theo dòng; bỏ một dòng mới thì xóa lỗi cũ vì vị trí dịch chuyển.

### Kiểm tra thực tế

| Lệnh | Kết quả |
|---|---|
| Test component mới trước khi viết code | 6/6 thất bại vì chưa có ô biến thể/nút Thêm (RED đúng) |
| `npm run typecheck` | Backend/frontend đạt |
| `npm test` | 8 tools + 9 backend + 80 frontend đạt |
| `npm run build` | Hai app đạt; cảnh báo chunk Vite có sẵn |
| `npm run test:integration` | 29/29 đạt trên PostgreSQL `_test` (backend không đổi) |
| `npm run test:e2e:implemented` | 11/11 đạt, khoảng 33 giây |
| Ảnh mobile 390px | Agent đã xem: ô xếp dọc, SKU 64 ký tự trong ô nhập, không tràn ngang |

Các lệnh chạy bằng npm trực tiếp với Node 24.15.0 vì `tools/npm.ps1` từ chối Node dưới 24.22.1 và máy chưa có runtime `.local`; cần chạy lại bằng Node 24.22.1+ trước khi coi là khớp CI. Hai lỗi trong chính test mới đã sửa: assertion focus nhắm vào phần chữ thay vì khung Alert; ca 409 tạo biến thể trùng size/màu nên bị chặn trước khi gửi.

### Giới hạn / chạy thử / điểm dừng

- Đổi chéo size/màu giữa hai biến thể trong một lần lưu bị 409 (unique product+size+color, cập nhật tuần tự); transaction rollback, không mất dữ liệu.
- Chỉ DRAFT sửa được; tồn kho chưa chỉnh trên UI (M3.7).
- Hướng dẫn: [local-trial-m3.md](docs/local-trial-m3.md#m342--admin-sửa-thêm-và-tắt-biến-thể-của-sản-phẩm-nháp).

**Dừng ở M3.4.2 chờ người dùng thử.** M3.5 (ảnh) cần kế hoạch riêng được duyệt.

## Ngày 29/10/2026 — M3.7 (Người B) — M3.7.3: lịch sử tồn kho của từng SKU

**Phạm vi đã duyệt:** người dùng duyệt kế hoạch M3.7.3 bằng "duyệt". Nút "Lịch sử" mở dialog đọc-only về giao dịch của một SKU; chưa triển khai M3.9 catalog khách. Backend API `GET /api/v1/admin/inventory/movements` vốn có (guard ADMIN, sort `createdAt` desc, phân trang), nên backend/schema không đổi. Cùng nhánh `feat/m3.7.2-inventory-adjust` ngay sau M3.7.2, thay đổi chưa stage/commit.

### Đã viết / file thực tế

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/admin/inventory/api/inventory.api.ts` | Thêm `movements(variantId, page)` với `pageSize=10`, kiểu `MovementRow/MovementList` khớp response backend (delta, before/after, reason, actor, createdAt) |
| `apps/frontend/src/features/admin/inventory/components/MovementHistory.tsx` | Mới: dialog "Lịch sử <SKU>" đọc-only, dùng query riêng theo variantId + page; loading/empty/error + "Tải lại lịch sử"; hàng thể hiện thời gian (`<time datetime>`), dấu `+/-`, `từ → thành`, lý do, người thực hiện; phân trang khi hơn 10 giao dịch |
| `apps/frontend/src/features/admin/inventory/components/MovementHistory.test.tsx` | Mới: 9 test — đúng tham số gọi API, nội dung hàng, delta âm, empty, loading, lỗi + retry cùng trang, phân trang giữ dialog mở, đóng, không refetch khi row cha refresh cùng variant |
| `apps/frontend/src/features/admin/inventory/pages/InventoryPage.tsx` | Thêm state `history` + nút "Lịch sử <SKU>" trên mỗi hàng, mở dialog lịch sử (không đụng luồng điều chỉnh) |
| `apps/frontend/src/features/admin/inventory/pages/InventoryPage.test.tsx` | +3 test: mở/đóng lịch sử với URL API đủ `?variantId&page=1&pageSize=10`, phân trang trong dialog không đổi URL, empty state cho biến thể chưa giao dịch |
| `apps/frontend/e2e/inventory-history.spec.ts` | Mới: 3 E2E — điều chỉnh +5 rồi lịch sử hiện ngay 1 hàng `12 → 17` và meta khớp; 12 giao dịch seed qua Prisma chia 2 trang (10 + 2); biến thể không giao dịch hiển thị empty |
| `package.json` (root) | Thêm `inventory-history.spec.ts` vào `test:e2e:implemented` |
| `.github/workflows/ci.yml` | Tên bước E2E nêu rõ "+ history M3.7.3" |
| `docs/local-trial-m3.md` | Hướng dẫn chạy thử M3.7.3 |
| `progress.md` | Mục này |

File chạy thử `e2e/inventory-history.spec.ts` phải scope `listitem` trong `<ul aria-label="Lịch sử <SKU>">` vì DOM của dialog còn chứa `<li>` phân trang lẫn vào — đã sửa sau khi E2E bắt Expected 10 / Received 14. Backend, migration, `features/admin/products/`, lockfile: không đổi. Chưa stage/commit.

### Data flow / key quan trọng

Luồng: nút "Lịch sử" trên hàng tồn → dialog mở → TanStack Query gọi `inventoryApi.movements` → `GET /api/v1/admin/inventory/movements?variantId=<id>&page=<n>&pageSize=10` (guard backend kiểm ADMIN; server sắp `createdAt` desc) → hàng hiển thị thời gian, `+5`/`-3`, `before → after`, lý do, người thực hiện; sang trang gọi lại trong cùng dialog; "Đóng" không đổi URL, không invalidate gì (chỉ đọc).

- Query key `['admin-inventory-movements', variantId, page]`: cache tách theo biến thể + trang; dialog đổi trang không refetch danh sách tồn.
- `<time datetime>`: giữ ISO nguyên vẹn cho máy, hiển thị giờ Việt Nam (`Intl.DateTimeFormat` + `Asia/Ho_Chi_Minh`) — cố định múi giờ nên số hiển thị không chạy theo máy admin.
- Dấu `+`/`-`: nhập thêm hay xuất kho, tô xanh/đỏ để dễ nhìn; số lấy nguyên từ server.
- Empty state: "Chưa có giao dịch cho SKU này." cho biến thể 0 giao dịch — phân biệt nội dung hàng tồn.
- Read-only: không có PUT/POST trong dialog, không idempotency, thứ tự và tổng phụ thuộc API hoàn toàn.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| UI RED | MovementHistory chưa có (suite lỗi import) + 3 ca trang chưa có nút "Lịch sử" — 3 ca trang fail đúng lý do |
| UI GREEN | 54/54 trong thư mục inventory (19 dialog điều chỉnh + 26 trang + 9 lịch sử); frontend tổng 159/159 sau lần chỉnh cuối |
| `tools/npm.ps1 run typecheck` | 2 app 0 lỗi (lưu ý: hai lượt đầu gọi qua `cmd /c "tools\npm.ps1 ..."` không thật sự chạy file ps1, log trống; chạy lại bằng `powershell -File` hợp lệ) |
| `tools/npm.ps1 test` | 176 đạt: 8 công cụ + 9 backend + 159 frontend |
| `npm run test:integration` | 29/29 |
| E2E implemented (8 spec) | 4 lượt: L1 25/26 (test phân trang của tôi bắt 14 thay vì 10 — lỗi scope `listitem` gộp `<li>` phân trang, đã sửa); L2 8 pass rồi webServer Vite crash 0xC0000409 (flake máy đã ghi ở M3.7.2); L3 25/26 (test ảnh của Người A chập chờn); L4 26/26 sạch (34.7s) |

### Chạy thử / điểm dừng

Giữ dev backend/frontend như trước, đăng nhập ADMIN → Kho → hàng nào đó → bấm **Lịch sử**. Xem thời gian, số cộng/trừ, `từ → thành`, lý do, người thực hiện; số SKU có hơn 10 giao dịch có phân trang; SKU vừa điều chỉnh ở M3.7.2 sẽ có dòng giao dịch tương ứng. Chi tiết theo [hướng dẫn M3.7.3](docs/local-trial-m3.md).

**Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử/xác nhận. Dừng ở M3.7.3.** Catalog khách M3.9 cần duyệt riêng; chưa commit/push; chưa kiểm chứng CI GitHub.

### Bản sửa sau review (29/10/2026)

Người dùng duyệt "sửa lại hết" cho 4 điểm review:

| Điểm | Sửa |
|---|---|
| Mở lại lịch sử thoáng hiện số cũ từ cache (mở → đóng → điều chỉnh → mở lại vẫn thấy "Tìm thấy 1" trước khi về 2) | `MovementHistory.tsx`: query lịch sử dùng `gcTime: 0`, đóng dialog là bỏ cache nên mở lại luôn "Đang tải lịch sử…" rồi số mới |
| Sang trang làm danh sách và thanh phân trang biến mất, hiện "Đang tải…" rồi mới hiện lại | `placeholderData: keepPreviousData`: giữ trang hiện tại, thanh phân trang khóa trong lúc tải trang kế tiếp |
| Nhánh `actor.name ?? 'Tài khoản đã xóa'` không thể xảy ra (DB bắt buộc tên, không cho xóa user có giao dịch) | Bỏ nhánh; `MovementRow.actor` thành `{ name: string }` trong `inventory.api.ts` |
| Chữ lỗi | Mục M3.7.3 ở đây; mục M3.7.2 và M3.7.3 trong `docs/local-trial-m3.md` (kèm sửa giải thích ví dụ 409 -11, thêm dòng chạy thử Esc, mở lại lịch sử và sang trang; tên key/dấu trừ cho khớp code); comment seed trong `inventory-history.spec.ts` |

`MovementHistory.test.tsx` +2 test: giữ trang và thanh phân trang khi đang tải trang 2; mở lại sau khi đóng thì tải mới, không hiện số cũ. Cả hai fail trước khi sửa đúng lý do ("Đang tải lịch sử…" thay danh sách; "Đang tải" không xuất hiện vì dùng cache cũ), đạt sau khi sửa.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Đạt |
| `npm test` | 8 công cụ + 9 backend + 161 frontend đạt |
| `npm run test:integration` | 29/29 |
| `npm run test:e2e:implemented` (8 spec, DB `_test`) | 26/26 (34.4s) |

Lệnh chạy bằng Node local `.local/node-v24.22.1-win-x64` trong Bash, vì `tools/npm.ps1` dừng khi webServer E2E ghi ra stderr (`ErrorActionPreference = 'Stop'`); không đổi Node toàn máy. Chưa commit/push.

## Ngày 29/10/2026 — M3.7 (Người B) — M3.7.2: điều chỉnh tồn kho, một lần ghi mỗi idempotency key

**Phạm vi đã duyệt:** người dùng duyệt kế hoạch M3.7.2 bằng "triển khai". Chỉ làm dialog điều chỉnh tồn lọc theo một biến thể; chưa triển khai M3.7.3 lịch sử. API `POST /api/v1/admin/inventory/adjustments` (transaction + idempotency) vốn có, phần này chỉ tiêu dùng từ FE; backend/schema không đổi. Nhánh `feat/m3.7.2-inventory-adjust` từ `main` `3b054ff`.

### Đã viết / file thực tế

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/admin/inventory/components/AdjustmentDialog.tsx` | Mới: dialog điều chỉnh một SKU; snapshot tồn đóng băng theo version khi mở; máy trạng thái editing/pending/saved/unconfirmed/conflict; 409 chỉ hiện thông báo server + "Đóng và tải lại tồn"; lỗi mạng/5xx cho Gửi lại cùng key/body; khóa hoàn toàn khi pending hoặc không chắc chắn |
| `apps/frontend/src/features/admin/inventory/components/AdjustmentDialog.test.tsx` | Mới: 17 test, gồm khóa phím khi pending, key không đổi qua Gửi lại, phiên bản hết hạn đã được tab khác ghi, 409 không có Gửi lại, hiển thị "Khả dụng" sau thành công |
| `apps/frontend/src/features/admin/inventory/pages/InventoryPage.tsx` | Lọc `variantId` trên URL (UUID không hợp lệ tự về trang thường), nút "Điều chỉnh <SKU>", ghi thành công cập nhật số trong cache qua `setQueriesData` (không refetch), "Đóng và tải lại tồn" = invalidate + đóng |
| `apps/frontend/src/features/admin/inventory/pages/InventoryPage.test.tsx` | +4 test: mở dialog khi lọc variantId, điều chỉnh +5, cache số tồn đổi tức thời, đóng và tải lại tồn |
| `apps/frontend/src/features/admin/inventory/api/inventory.api.ts` | Thêm `list(q, page, variantId)` (URL `variantId` đứng trước `q`) và `adjust(input, key)` gửi header `Idempotency-Key` |
| `apps/frontend/e2e/inventory-adjust.spec.ts` | Mới: 5 E2E thật — lọc variantId + giao dịch +5 đặt một lần (DB 17/tồn mới/version 1/1 movement), phản hồi mất khóa form và Gửi lại cùng key tại đúng một lần ghi, tái phát cùng key trả lại kết quả cũ không cộng kép (21/version 1/1 movement), xuất dưới mức giữ bị 409 không đổi tồn, CUSTOMER gửi API trực tiếp bị 403 qua `page.evaluate` |
| `package.json` (root) | Thêm `inventory-adjust.spec.ts` vào `test:e2e:implemented` — khác kế hoạch vì spec tách file mới thay vì ghi vào `inventory.spec.ts` |
| `.github/workflows/ci.yml` | Tên bước E2E nêu rõ "+ adjustments M3.7.2" đi cùng thay đổi trên |
| `apps/frontend/vite.config.ts` | Thêm `preview.proxy` cho `/api` cùng quy tắc như dev — khác kế hoạch, dùng cho mitigation crash E2E dưới |
| `apps/frontend/playwright.config.ts` | webServer frontend E2E đổi từ `vite dev` sang `npm run build && vite preview` — khác kế hoạch, cùng mitigation |
| `docs/local-trial-m3.md` | Hướng dẫn chạy thử M3.7.2 và giải thích key |
| `progress.md` | Mục này |

Backend, migration, `features/admin/products/`, lockfile: không đổi. Chưa stage/commit.

### Data flow / key quan trọng

ADMIN mở Kho → tìm/nút "Điều chỉnh" theo SKU → URL `?variantId=<id>` → GET list lọc một biến thể → mở dialog: snapshot tồn được đóng băng (đồng bộ `version` từ server) → nhập delta → Gửi → `inventoryApi.adjust` POST với `Idempotency-Key` sinh mỗi lần mở dialog và `X-CSRF-Token` → backend chạy transaction: key trùng trả kết quả cũ (không cộng lại), `expectedVersion` hết hạn hoặc delta làm `available < reserved` thì 409, hợp lệ thì tạo `InventoryMovement` và cập nhật tồn → UI hiện `Khả dụng: <available>` và sửa số trong cache; đóng dialog bằng "Đóng và tải lại tồn" mới invalidate thật.

- `variantId` (URL): một điều chỉnh chỉ diễn ra với một biến thể; sai định dạng tự về trang tồn thường.
- `Idempotency-Key`: 1 key/phiên mở dialog; "Gửi lại" giữ nguyên key và body; đóng dialog hợp lệ mở lần sau dùng key mới.
- Snapshot đóng băng: hiển thị và `expectedVersion` chốt lúc mở dialog; người khác ghi đồng thời thì 409 thay vì ôm số cũ ghi đè.
- Máy trạng thái (`editing/pending/saved/unconfirmed/conflict`): pending và hai kiểu không chắc chắn khóa toàn bộ; chỉ lỗi mạng cho phép Gửi lại.
- `cache.setQueriesData`: thành công thì không refetch toàn trang, chỉ các query cache khớp `variantId` đổi số; invalidate là thao tác tường minh tại nút "Đóng và tải lại tồn".

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| UI trước khi thành phần | 17 ca dialog thất bại toàn bộ vì chưa có `AdjustmentDialog` (RED đúng lý do); sau khi triển khai 40/40 (17 mới + 23 trang, 4 ca mới trên tổng 19 cũ) |
| `node tools/typecheck` qua wrapper | 0 lỗi (chạy lại sau lần chỉnh config cuối cùng); backend/frontend đạt |
| `npm run build` | Đạt; Vite còn cảnh báo chunk >500 kB như trước (webServer E2E còn tự chạy lại build thành công 3 lần sau chỉnh config) |
| Vitest frontend toàn bộ (sau chỉnh config cuối) | 145/145 đạt 10.5s, gồm 40 ca M3.7.2 |
| Vitest toàn workspace trước chỉnh config | 162 đạt: 8 công cụ + 9 backend + 145 frontend |
| Integration (PostgreSQL `_test`) | 29/29 đạt, backend không đổi |
| E2E riêng `inventory-adjust.spec.ts` | 5/5 đạt (11.4s), chạy lại sau sửa bộ chờ giữa các ca không nhầm biến thể |
| E2E triển khai toàn bộ (7 spec) | 7 lượt: lượt 1, 2 (dev), 3, 5 (preview) crash giữa run do tiến trình Vite webServer chết với exit `3221226505` (0xC0000409, fail-fast native trên Windows, không có stack/WER); lượt 4, 6, 7 (preview) đạt 23/23 trong ~32s — 3 lượt sạch liên tiếp sau mitigation |
| Mobile | E2E xác nhận dialog hoạt động; không tràn ngang |

### Vấn đề môi trường và giải pháp đã thực hiện

- Triệu chứng: trong lượt E2E đủ 7 spec, tiến trình Vite (webServer 5174) tự chết âm thầm sau khoảng 25–40 giây; mọi ca sau đó `ERR_CONNECTION_REFUSED`. Tái hiện ở cả `vite dev` và `vite preview`, cả Node 24.22.1 (local) và 24.15.0 (hệ thống); chạy server thủ công bên ngoài Playwright (70s HTTP tĩnh và 60 lượt hai-tab có proxy) không crash. Flutter không chốt nguyên nhân gốc (nghĩrolldown-native, WebSocket HMR và chuỗi npm→cmd đều chưa loại trừ được); hạ tầng CI chạy Linux nên không gặp.
- Giải pháp chọn: webServer frontend E2E dùng bản build tĩnh qua `vite preview` + `preview.proxy` trong `vite.config.ts` (payload nhỏ hơn, không có pipeline transform/HMR của dev). Lưu ý: crash có thể vẫn là ngẫu nhiên của máy; 3 lượt đạt liên tiếp hiện tại là bằng chứng dần dần, không khẳng định nguyên nhân. Đây là khác biệt với kế hoạch, nêu rõ để người dùng duyệt/nhìn nhận phần bàn giao.
- Điểm khác với kế hoạch: spec E2E điều chỉnh tách file mới `inventory-adjust.spec.ts` (thay vì ghi vào `inventory.spec.ts`) nên đã phải sửa cả root `package.json` và tên bước `ci.yml`; đã nêu cả hai trong bảng file.

### Chạy thử / điểm dừng

Giữ Docker DB, hai terminal `dev:backend` và `dev:frontend` như M3.7.1. Đăng nhập ADMIN → Kho → tìm SKU → bấm **Điều chỉnh**. Số dương/âm, 409, mạng chập chờn, hai tab và role CUSTOMER theo [hướng dẫn M3.7.2](docs/local-trial-m3.md). Chi tiết trung gian như key/chi tiết không hiện ra cho người dùng; mọi thứ mắt thường trong bảng.

**Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử/xác nhận. Dừng ở M3.7.2.** Lịch sử kho M3.7.3 và catalog khách M3.9 cần duyệt riêng; chưa commit/push; chưa kiểm chứng GitHub CI.

### Bản sửa sau review (29/10/2026)

- Người dùng duyệt **giữ** thay đổi E2E sang `vite preview` (`playwright.config.ts`, `vite.config.ts`). Review chạy lại E2E đầy đủ hai lượt liên tiếp trên máy này: 23/23 và 23/23 đạt, không gặp crash.
- Sửa lỗ hổng: ở trạng thái chưa rõ đã ghi (lỗi mạng/không xác định) hoặc 409, đóng dialog bằng Esc/bấm ra ngoài trước đây chỉ đóng mà không tải lại tồn, trái quy tắc "chỉ Gửi lại hoặc Đóng và tải lại tồn". Nay `close()` gọi `onReload()` ở hai trạng thái đó (`components/AdjustmentDialog.tsx`).
- Test: thêm 2 ca Esc (lỗi mạng, 409) vào `AdjustmentDialog.test.tsx`. Đã xác nhận ca này fail khi gỡ bản sửa (Esc đóng im lặng) và đạt khi có bản sửa; lượt RED đầu không hợp lệ vì jsdom mất focus khi các ô bị khóa nên Esc không tới dialog, test được sửa để focus một nút trong dialog như trình duyệt thật.
- Sửa chữ lỗi do agent sinh trong mục này ("thành cônguese", "Hình cảnh", "Glänze").


## Ngày 29/10/2026 — M3.7 (Người B) — M3.7.1: xem và tìm tồn kho

**Phạm vi đã duyệt:** người dùng duyệt bảng kế hoạch M3.7.1 bằng "triển khai". Chỉ làm trang đọc/tìm tồn; chưa triển khai M3.7.2 điều chỉnh hoặc M3.7.3 lịch sử. Nhánh `feat/m3.7-inventory` từ `main` tại `568d4af`; runtime local Node24.22.1/npm11.19.1, không đổi Node toàn máy.

### Đã viết / file thực tế

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/admin/inventory/api/inventory.api.ts` | Mới: kiểu inventory/list, query key, API list qua shared client; encode từ khóa và phân trang24 |
| `apps/frontend/src/features/admin/inventory/pages/InventoryPage.tsx` | Mới: tìm SKU/tên theo URL q/page, thẻ SKU và ba lượng tồn, phân trang, loading/empty/error/retry và phục hồi URL sai |
| `apps/frontend/src/features/admin/inventory/pages/InventoryPage.test.tsx` | Mới:19 UI test, gồm route/ACL, tìm bằng submit, Back, phân trang, giữ cache khi lỗi nền và URL không hợp lệ |
| `apps/frontend/src/app/App.tsx` | Thêm route `/admin/inventory` qua `PrivateRoute admin` |
| `apps/frontend/src/features/admin/AdminPage.tsx` | Thêm link Kho; sửa tối thiểu file dùng chung |
| `apps/frontend/e2e/inventory.spec.ts` | Mới:3 E2E thật, fixture25 SKU/biên SKU64, tồn12/giữ2/còn10, tìm kiếm/URL/mobile/retry/401/403, kiểm tra DB chỉ đọc UI không đổi kho |
| `package.json` | Thêm inventory.spec.ts vào bộ E2E đã triển khai, giữ bộ catalog đầy đủ riêng |
| `.github/workflows/ci.yml` | Tên bước ghi rõ kho mới có list/search M3.7.1 |
| `README.md` | Route Kho và phạm vi E2E hiện hành |
| `docs/local-trial-m3.md` | Hướng dẫn chạy thử M3.7.1 và giải thích key |
| `docs/m3-implementation-plan.md` | Tách M3.7.1/.2/.3, ghi phạm vi và điểm dừng |
| `progress.md` | Ghi bằng chứng và trạng thái của riêng Người B |

Danh sách đúng kế hoạch đã duyệt; không sửa backend/schema/migration/dependency/lockfile hoặc `features/admin/products/` của Người A. Không stage/commit/push. Ledger thao tác tạm ở `.local/m371-20261029/progress.md` được Git bỏ qua.

### Data flow / key quan trọng

ADMIN bấm Kho → PrivateRoute kiểm tra phiên/role → nhập SKU/tên rồi Tìm kiếm/Enter → page trim từ khóa, cập nhật `q/page` trên URL (tìm mới về trang1) → TanStack Query gọi `inventoryApi.list` → GET `/api/v1/admin/inventory` → guard backend kiểm tra ADMIN, service đọc PostgreSQL → UI hiển thị nguyên `onHand/reserved/available` server trả. Không có POST/PATCH hay optimistic update tồn trong phần này.

- `q/page`: nguồn bộ lọc/trang là URL, refresh và Back/Forward giữ đúng tìm kiếm; gõ chưa submit không gọi API mỗi phím.
- `inventoryKey`: cache `admin-inventory` tách theo q/page, không trộn kết quả các lượt tìm kiếm.
- `onHand/reserved/available`: tồn thực có / đang giữ / còn bán; chỉ đọc, kho ban đầu của SKU mới là0.
- `retry: false`: GET không tự retry; nút Tải lại tồn kho là thao tác tường minh. Refetch nền lỗi vẫn giữ số cũ và hiện cảnh báo.
- `PrivateRoute admin`: bảo vệ giao diện, không thay guard quyền tại API.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| UI trước implementation | 19/19 thất bại vì route/trang Kho chưa có; xác nhận RED |
| UI sau implementation | 19/19 đạt; xác nhận GREEN |
| `./tools/npm.ps1 run typecheck` | Backend/frontend đạt; đã sửa option test không đúng kiểu trước khi chạy lại |
| `./tools/npm.ps1 run build` | Hai app đạt; Vite còn cảnh báo chunk598.21kB/gzip183.75kB |
| `./tools/npm.ps1 test` | Lượt tuần tự đạt8 công cụ +9 backend +93 frontend =110 test;19 ca Kho nằm trong93 frontend |
| `./tools/npm.ps1 run test:integration` | 29/29 đạt trên clothing_test; cảnh báo pg về query đồng thời, không sửa ngoài phạm vi |
| `./tools/npm.ps1 run test:e2e:implemented` | 14/14 đạt, khoảng1.3phút:2 auth +4 categories +5 products +3 inventory; API/proxy/DB thật |
| Mobile390px | E2E xác nhận không tràn ngang; agent đã xem ảnh inventory-mobile-390.png, SKU64 xuống dòng và tồn12/giữ2/còn10 hiển thị đủ |
| Review cấu trúc độc lập | Không phát hiện Critical/Important/Minor trong phạm vi M3.7.1; agent chính đã xác nhận E2E/ảnh |
| Rà phạm vi/diff/liên kết tài liệu | Không sửa phần Người A/backend; diff whitespace và liên kết file đạt |

Lượt `npm test` đầu dừng ở test công cụ Prisma do tiến trình con timeout15s khi chạy kiểm tra đồng thời; chạy lại tuần tự đạt, không tăng timeout/bỏ test. Lượt E2E đầu không chạy ca nào vì Docker engine mất kết nối (`ECONNREFUSED`/readiness timeout); đã khởi động lại Docker Desktop và container DB hiện có, giữ nguyên volume/dữ liệu. Lượt kế tiếp11 ca cũ đạt nhưng fixture mới thiếu `Product.priceFrom`, một ca lỗi setup và hai ca chưa chạy; đã bổ sung `priceFrom=100000` vào fixture và chạy lại toàn bộ14/14 đạt, không sửa backend.

### Chạy thử / điểm dừng

Giữ Docker DB, chạy `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend` ở hai terminal. Đăng nhập ADMIN tại http://127.0.0.1:5173/login → Kho hoặc mở http://127.0.0.1:5173/admin/inventory. Thử SKU/tên, Enter, refresh, phân trang, từ khóa không có kết quả, URL page sai và màn hình390px theo [hướng dẫn M3.7.1](docs/local-trial-m3.md). Nếu DB trống, tạo một nháp bằng UI M3.3 rồi quay lại Kho; phần này không tự seed và chưa có nhập kho.

**Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử/xác nhận. Dừng ở M3.7.1.** Điều chỉnh/lịch sử (M3.7.2/.3) cần duyệt riêng; không coi toàn M3 đã hoàn thành. Chưa kiểm chứng GitHub CI hoặc deploy.

## Ngày 29/10/2026 — Đánh giá repo và phân công hai người

- Pull `main` tới `13b02d1` (đã gồm PR #2 `fix/review-findings` và PR #3 M3.4). Không sửa code.
- Đối chiếu code: backend M3 đã có API sản phẩm (biến thể, publish/hide, gắn ảnh), upload, kho (list/movements/adjustments) và catalog công khai; frontend chưa có UI biến thể/ảnh/kho/xuất bản/catalog khách.
- Kiểm tra: `npm run typecheck` đạt; `npm test` đạt (9 backend + 74 frontend). Chạy bằng npm trực tiếp vì `tools/npm.ps1` từ chối Node 24.15.0 của máy và thiếu `.local/node-v24.22.1-win-x64`. Chưa chạy integration/E2E.
- Người dùng đồng ý chia việc hai người: bảng ở [docs/plan.md](docs/plan.md#phân-công-hai-người) và [docs/m3-implementation-plan.md](docs/m3-implementation-plan.md#phân-công-hai-người-29102026). Phần đầu đề xuất: M3.4.2 (A), M3.7 (B), chờ duyệt kế hoạch chi tiết. M3.4.1 vẫn chờ người dùng thử.

## Ngày 28/10/2026 — M3.4.1: sửa hai finding P2 từ review

**Người dùng đã duyệt sửa đúng hai lỗi review.** Đã sửa và kiểm tra local, chờ người dùng chạy thử; không bắt đầu M3.4.2. Chỉ nhận các chỉnh sửa dưới đây của lượt này, không nhận code M3.4.1 do OpenCode tạo là phần mới của agent.

### Đã sửa / file thực tế

| File | Thay đổi của riêng bản sửa review |
|---|---|
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.tsx` | Đặt khóa operationRef ở cấp page, begin/end chung cho save và explicit reload, nhả trong finally; truyền trạng thái khóa xuống form |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.tsx` | Kết hợp disabled từ page với pending cục bộ, chặn submit khi bị khóa; overflowWrap:anywhere cho nội dung biến thể |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.test.tsx` | Thêm hai regression deferred GET/PATCH: reload khóa save/field, save khóa reload và giữ input/error qua cập nhật cache |
| `apps/frontend/e2e/products.spec.ts` | Dùng SKU64 hợp lệ không có điểm ngắt trong ca sửa/mobile; tách SKU fixture published để vẫn đúng giới hạn64 |
| `docs/architecture.md` | Ghi khóa chung save/reload ở page và cách xử lý SKU dài |
| `docs/local-trial-m3.md` | Thêm bước thử mạng chậm/khóa hai chiều và SKU64 trên mobile |
| `docs/m3-implementation-plan.md` | Cập nhật kết quả bản sửa, số test và phạm vi regression |
| `progress.md` | Ghi nguyên nhân, RED→GREEN, kết quả và điểm dừng |

Không sửa backend/schema/migration/dependency/package/CI hoặc logic biến thể/kho. Snapshot trước bản sửa ở `.local/m341-review-fix-before-20261028`; giữ nguyên index và mọi thay đổi sẵn có của OpenCode, không stage/commit/push.

### Data flow / key quan trọng

Bấm Lưu hoặc Tải dữ liệu mới → page kiểm tra/đặt khóa đồng bộ trước khi bắt đầu request → các trường và nút nhận trạng thái khóa → PATCH hoặc GET hoàn tất/thất bại → finally nhả khóa. Reload thành công mới thay snapshot/revision; không thể remount form giữa một PATCH đang chờ. Endpoint/DTO/version và kiểm tra quyền giữ nguyên.

- `operationRef`: khóa tức thời ở page, không bị mất khi form remount; chỉ một save hoặc explicit reload được bắt đầu.
- `operation`: state phản ánh loại thao tác đang chạy lên UI và trạng thái disabled/loading.
- `locked`: pending của form kết hợp khóa ngoài, vừa khóa trường/nút vừa chặn programmatic submit.
- `overflowWrap: anywhere`: SKU64 không có dấu gạch vẫn xuống dòng trong vùng biến thể; không đổi SKU được lưu.

### Kiểm tra thực tế

| Lệnh/kiểm tra | Kết quả |
|---|---|
| Unit regression trước sửa | 1 thất bại / 13 đạt; input/Save chưa khóa trong explicit reload chậm |
| E2E sửa/mobile với SKU64 trước CSS fix | 1/1 thất bại đúng assertion không tràn ngang ở390px; không phải fixture/schema lỗi |
| `./tools/npm.ps1 run typecheck` sau sửa | Backend/frontend đạt |
| `./tools/npm.ps1 test` sau sửa | 88/88 đạt: 8 công cụ + 6 backend unit + 74 frontend unit/UI, gồm 14 ca editor |
| `./tools/npm.ps1 run build` sau sửa | Hai app đạt; cảnh báo Vite chunk593.74kB/gzip182.79kB, không tối ưu bundle ngoài phạm vi |
| `./tools/npm.ps1 run test:e2e:implemented` sau sửa | 11/11 đạt, khoảng1.3phút; giữ nguyên bộ auth/categories/products và biên SKU64 thật |
| Ảnh mobile sau sửa | Agent đã xem ảnh trang sửa: SKU64 xuống dòng trong vùng nội dung, không tràn ngang |
| Rà diff bản sửa so với snapshot | Chỉ khóa hai thao tác và wrap SKU trong source; giữ snapshot/version/DTO/variantID như trước |

Không chạy lại integration riêng trong bản sửa chỉ frontend này; 28/28 là kết quả review trước, backend không đổi. Không claim toàn M3 hoặc catalog E2E đã đạt, chưa xác nhận CI GitHub mới/deploy. Test hiện có không bị bỏ/skip hay tăng timeout để che lỗi. Source được sửa sau khi đã quan sát cả unit và E2E tái hiện lỗi, rồi xác nhận lại GREEN.

### Chạy thử / điểm dừng

Giữ/chạy backend và frontend ở hai terminal theo README. ADMIN mở http://127.0.0.1:5173/admin/products → Sửa một nháp. Có thể dùng Network throttling để thấy nút/trường khóa trong lúc Tải dữ liệu mới; thao tác Lưu bị chặn đến khi tải xong. Khi đang Lưu, nút tải mới cũng bị khóa; nếu lỗi, input/error còn và các nút mở lại. SKU dài64 ký tự liền trên màn hình390px phải xuống dòng, không kéo ngang trang. Hướng dẫn chi tiết ở [local-trial-m3.md](docs/local-trial-m3.md).

**Đã viết/agent đã kiểm tra; chờ người dùng thử/xác nhận. Dừng ở M3.4.1, không triển khai phần tiếp theo, chưa commit/push.**

## Ngày 28/10/2026 — M3.4.1: admin sửa thông tin sản phẩm nháp

**Phạm vi được duyệt:** người dùng duyệt trực tiếp M3.4.1 trong chat kèm điều kiện luồng (snapshot/version, PATCH DTO đúng, chỉ DRAFT, không gửi trường quản trị). Chỉ sửa tên/slug/danh mục/mô tả; chưa cho sửa SKU/size/màu/giá, thêm/tắt biến thể, ảnh, kho hoặc xuất bản; không triển khai M3.4.2 trở đi. **Đã viết, agent đã kiểm tra; chờ người dùng chạy thử, chưa nghiệm thu.**

### Thay đổi và file thực tế

- Danh sách sản phẩm có nút Sửa cho hàng **Nháp** (`aria-label` kèm tên sản phẩm), dẫn tới `/admin/products/:id` qua PrivateRoute ADMIN; backend guard/DTO độc lập.
- Trang sửa điền sẵn tên/slug/danh mục/mô tả; biến thể hiển thị chỉ đọc kèm lời nhắc "Phần này chưa cho sửa SKU, size, màu, giá hoặc thêm/tắt biến thể.".
- Snapshot chốt lúc mở form quyết định `expectedVersion` và biến thể gửi lại; refetch nền (kể cả khi lỗi) không rebase snapshot và không xóa phần đang nhập. Nút **Tải dữ liệu mới** là thao tác duy nhất chủ động thay draft: thành công mới thay snapshot và remount form (có lời nhắc giải thích trên trang); tải lỗi giữ draft và hiện lỗi.
- PATCH gửi đúng `{name, slug, description, categoryId, variants[{id,sku,size,color,price,active}], expectedVersion}` — không gửi inventory/available/images/status. Lỗi 409 (version cũ hoặc slug trùng) hiện thông báo chung nêu cả hai khả năng, giữ input, không tự retry. Thành công invalidate `admin-products`, về danh sách, báo "Đã cập nhật sản phẩm nháp …". Busy ref chặn gửi lặp cùng nhịp và khi đang chờ.
- Tách `ProductInfoFields` dùng chung cho form tạo và sửa; hành vi tạo giữ nguyên (hồi quy 9 test tạo đạt).

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/admin/products/api/products.api.ts` | Thêm `VariantUpdateInput`/`ProductUpdateInput`, `productsApi.detail/update`; thu hẹp `ProductVariant.size` về allowlist vì DTO backend luôn chuẩn hóa, giúp gửi lại biến thể có kiểu đúng |
| `apps/frontend/src/features/admin/products/components/ProductInfoFields.tsx` | Nhóm trường tên/slug/danh mục/mô tả dùng chung tạo/sửa, giữ label/helper/validation cũ |
| `apps/frontend/src/features/admin/products/components/ProductCreateForm.tsx` | Dùng nhóm trường chung, gom state info; giữ nguyên giá, biến thể, busy và thông báo |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.tsx` | Form sửa: state/lỗi/focus/busy, snapshot chốt lúc mount, map đúng 6 trường biến thể, thông báo 409 riêng |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.tsx` | Tải chi tiết+danh mục, snapshot/revision, reload tường minh (chỉ `isSuccess` mới rebase), save + invalidate + điều hướng |
| `apps/frontend/src/features/admin/products/pages/ProductsPage.tsx` | Link Sửa chỉ cho DRAFT và alert "Đã cập nhật sản phẩm nháp …" đọc từ navigation state |
| `apps/frontend/src/app/App.tsx` | Route `admin/products/:productId` qua PrivateRoute ADMIN |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.test.tsx` | 12 test sửa: điền sẵn/DTO đúng, 409/mạng giữ input, gửi lặp, refetch nền không rebase, lỗi danh mục nền, Tải dữ liệu mới, non-DRAFT, retry tải lỗi, ACL khách/CUSTOMER |
| `apps/frontend/src/features/admin/products/pages/ProductsPage.test.tsx` | Thêm test link Sửa chỉ có cho DRAFT (7 test list) |
| `apps/frontend/e2e/products.spec.ts` | Thêm 3 E2E: sửa thật (biến thể/tồn kho/ID đóng băng, DB kiểm chứng, mobile), hai tab thật (bản cũ bị chặn, chỉ rebase qua Tải dữ liệu mới), non-DRAFT không có form; bổ sung PATCH 401/403 vào ca ACL |
| `.github/workflows/ci.yml` | Tên bước E2E công khai phạm vi đến M3.4.1 |
| `README.md` | Trạng thái, bộ 11 E2E implemented, URL trang sửa |
| `docs/architecture.md` | Ghi tổ chức M3.4.1 và quy tắc snapshot/revision/DTO PATCH |
| `docs/local-trial-m3.md` | Hướng dẫn thử M3.4.1, hai tab, các lỗi và key |
| `docs/m3-implementation-plan.md` | Ghi phạm vi duyệt/kết quả/điểm dừng M3.4.1 |
| `docs/plan.md` | Cập nhật điểm dừng M3.4.1, chưa hoàn thành toàn M3 |
| `progress.md` | Ghi kết quả thật và các file của riêng phần này |

`package.json` không đổi vì `products.spec.ts` đã nằm trong `test:e2e:implemented`. Backend/schema/migration/dependency/lockfile không đổi. Không reset DB, không tạo admin, không seed; không stage/commit/push. Nhánh `feat/catalog-inventory` giữ nguyên các thay đổi đã có. E2E tạo fixture riêng trên PostgreSQL `_test` và dọn đúng product/variant/inventory/category/user UUID của lượt chạy.

### Data flow / key quan trọng

Nút Sửa → GET `/api/v1/admin/products/:id` + GET admin/categories → `ProductEditPage` chốt snapshot → `ProductEditForm` điền sẵn → PATCH `/api/v1/admin/products/:id` với DTO đúng qua cookie/CSRF → SessionGuard/RolesGuard + `ProductUpdateDto` → `ProductsService.update` kiểm tra version trong transaction (từ chối nếu DB đã đổi hoặc thiếu/thừa biến thể), tăng version → trả dữ liệu → FE invalidate `admin-products`, về danh sách GET đọc lại server.

- `snapshot`: bản gốc chốt lúc mở form, nằm ở page (`ProductEditPage`) — quyết định `expectedVersion` và biến thể gửi lại; refetch nền không đổi.
- `revision`: đếm remount `ProductEditForm`; chỉ tăng khi Tải dữ liệu mới thành công, là thao tác duy nhất bỏ draft.
- `isSuccess` của refetch: phản hồi lỗi vẫn giữ `data` cũ trong TanStack Query nên phải kiểm tra thành công trước khi rebase — đã bắt bằng test và sửa.
- `ProductUpdateInput`: kiểu PATCH cho phép đúng 6 trường biến thể (không `available`/inventory) để type chặn gửi thừa.
- 409 dùng chung version cũ/slug trùng; thông báo nêu cả hai, không gán nhầm lỗi slug.

### Kiểm tra thực tế

| Lệnh/kiểm tra | Kết quả |
|---|---|
| Test draft ban đầu (sửa lỗi cú pháp JSX của nháp) | 12/12 thất bại vì route/trang chưa có (404), đúng loại RED; không phải missing import |
| `./tools/npm.ps1 test --workspace=@clothing/frontend -- ...ProductEditPage.test.tsx ...ProductsPage.test.tsx ...ProductCreatePage.test.tsx` cuối | 28/28 đạt (12 sửa + 7 list + 9 tạo) |
| `./tools/npm.ps1 run typecheck` cuối | Backend/frontend đạt |
| `./tools/npm.ps1 run build` cuối | Hai app đạt; cảnh báo Vite chunk có sẵn, không tối ưu bundle ngoài phạm vi |
| `./tools/npm.ps1 test` cuối | 86/86 đạt: 8 công cụ + 6 backend unit + 72 frontend unit/UI |
| `./tools/npm.ps1 run test:integration` | 28/28 đạt trên PostgreSQL `_test` (backend không đổi) |
| `./tools/npm.ps1 run test:e2e:implemented` cuối | 11/11 đạt, khoảng 1,5 phút: 2 auth + 4 categories + 5 products (tạo, ACL PATCH 401/403, sửa thật, hai tab, non-DRAFT) |
| Ảnh E2E mobile trang sửa 390px | Agent đã xem: label/focus rõ, form xếp dọc, biến thể chỉ đọc, không tràn ngang |

Bốn lỗi thật đã bị test bắt và xử lý trong phạm vi: (1) nháp test có cú pháp JSX đóng nhầm thẻ và vài stub chưa thực tế — chỉnh stub PATCH echo tên mới, thêm lỗi ban đầu cho ca retry, bỏ hàm chết `patchBody`, đổi `getByRole` đồng bộ sang `await findByRole`; (2) khi refetch lỗi TanStack vẫn trả `data` cũ khiến trang sửa tưởng thành công và remount mất draft — sửa kiểm tra `fresh.isSuccess` trước khi rebase; (3) fixture E2E tạo thẳng qua Prisma nên SKU chứa UUID chữ thường vi phạm CHECK `variant_fields_valid` (DTO thường uppercase) — uppercase fixture, không đổi ràng buộc; (4) Prisma trả `price` dạng chuỗi Decimal — assertion dùng `Number()` như ca tạo hiện có. Một lỗi locator E2E tìm nút Tải dữ liệu mới trong scope form trong khi nút ở page — đưa về scope trang.

### Giới hạn / chạy thử / điểm dừng

- Chỉ DRAFT được sửa; sản phẩm PUBLISHED/HIDDEN mở URL sửa sẽ thấy thông báo và không có form (E2E phủ). Backend vẫn cho PATCH PUBLISHED theo API hiện có — phần này không thay nghiệp vụ backend.
- Chưa sửa được SKU/size/màu/giá, thêm/tắt biến thể, ảnh, kho, xuất bản; chưa có public catalog. Lỗi validation biến thể lồng nhau backend chưa flatten fieldErrors (giữ nguyên từ M3.3); lỗi 409 hiện thông báo chung.
- Chưa kiểm chứng CI GitHub với thay đổi M3.4.1 (chưa commit/push); chưa deploy.
- Hướng dẫn: [chạy thử M3.4.1](docs/local-trial-m3.md#m341--admin-sửa-thông-tin-sản-phẩm-nháp). Giữ `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend`. ADMIN mở http://127.0.0.1:5173/admin/products → Sửa một sản phẩm Nháp → đổi tên/mô tả → Lưu thay đổi → refresh; thử hai tab cùng sản phẩm để xem bản cũ bị chặn; thử Tải dữ liệu mới sau khi tab kia đã lưu.

**Dừng ở M3.4.1 cho người dùng chạy thử/xác nhận.** M3.4.2 — sửa biến thể/thêm tắt — và các phần sau cần kế hoạch riêng được duyệt; chưa triển khai.

## Ngày 28/10/2026 — M3.3: tạo sản phẩm nháp với một biến thể

**Phạm vi được duyệt:** kế hoạch M3.3 đã gửi trong chat, người dùng yêu cầu tiếp tục M3 sau bản sửa CI. Chỉ danh sách quản trị và tạo nháp với một biến thể; không triển khai M3.4. Đã viết và agent đã kiểm tra local, xử lý finding review bằng RED→GREEN và xác nhận lại suite/E2E. **Chờ người dùng chạy thử, chưa nghiệm thu.**

### Thay đổi và file thực tế

- Admin → Sản phẩm → danh sách `/admin/products` và form `/admin/products/new`, đều có PrivateRoute ADMIN và backend guard độc lập.
- Form có tên/slug/danh mục/mô tả và một biến thể SKU/size/màu/giá nguyên VND. Loading/empty/error/retry khi tải danh mục; lỗi POST giữ input, field error nếu API cung cấp, busy ref chặn gửi lặp; không tự retry POST. Giá được kiểm tra UI và backend, không dùng any/ép kiểu mù.
- Server tạo DRAFT + đúng một variant đang bật + Inventory onHand/reserved0 bằng nested create nguyên tử; client không gửi status hoặc tồn kho. SKU chuẩn hóa chữ hoa/màu chữ thường theo DTO hiện có.
- Thành công invalidate query `admin-products`, về danh sách và đọc dữ liệu thật; list có trạng thái/giá/SKU/size/màu/khả dụng và phân trang24 trên URL. Nháp không xuất hiện qua list/detail public.

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/admin/products/api/products.api.ts` | Thêm contract Product/Variant/Input/Page, allowlist size, query key và API GET/POST |
| `apps/frontend/src/features/admin/products/components/ProductCreateForm.tsx` | Thêm form state/validation/error/focus/busy, chỉ một biến thể |
| `apps/frontend/src/features/admin/products/pages/ProductCreatePage.tsx` | Tải danh mục, điều phối POST/cache/navigation, giữ draft khi refetch lỗi có cache |
| `apps/frontend/src/features/admin/products/pages/ProductsPage.tsx` | Danh sách quản trị, phản hồi tạo thành công, trạng thái tải/lỗi/empty và phân trang URL |
| `apps/frontend/src/features/admin/products/pages/ProductCreatePage.test.tsx` | Thêm 9 test tạo, danh mục loading/empty/retry, giữ input, giá, gửi lặp, quyền và lỗi refetch nền |
| `apps/frontend/src/features/admin/products/pages/ProductsPage.test.tsx` | Thêm 6 test list/empty/error/URL pagination/trang sai/quyền |
| `apps/frontend/e2e/products.spec.ts` | Thêm 2 E2E thật: tạo/refresh/unique/mobile/DRAFT+inventory0/public privacy và 401/403 UI/API |
| `apps/frontend/src/app/App.tsx` | Thêm 2 route products qua PrivateRoute admin |
| `apps/frontend/src/features/admin/AdminPage.tsx` | Thêm link Sản phẩm, các nút wrap trên mobile |
| `package.json` | Thêm products.spec.ts vào test:e2e:implemented; lệnh full giữ nguyên |
| `.github/workflows/ci.yml` | Tên bước CI công khai phạm vi auth+categories+draft products đến M3.3 |
| `README.md` | Cập nhật trạng thái, URL và phạm vi 8 E2E implemented |
| `docs/architecture.md` | Ghi tổ chức feature, query/form/API và trách nhiệm backend khi tạo nháp |
| `docs/local-trial-m3.md` | Hướng dẫn thử M3.3, các lỗi, dữ liệu/key và giới hạn |
| `docs/m3-implementation-plan.md` | Ghi phạm vi được duyệt/thực hiện và điểm dừng M3.3 |
| `docs/plan.md` | Cập nhật điểm dừng, không đánh dấu hoàn thành toàn M3 |
| `progress.md` | Ghi kết quả thật, review, giới hạn và các file của riêng phần này |

Hai file config CI/package bổ sung so với bảng file ban đầu để thực hiện quy tắc đã thống nhất ở M3.2.1: có tính năng mới thì mở rộng bộ E2E implemented, không để CI chỉ kiểm tra 6 ca cũ. Không thay backend/schema/migration/dependency/lockfile hoặc test catalog. Không seed/tạo admin/reset dữ liệu local. E2E kiểm tra NODE_ENV/test PostgreSQL `_test` trước tạo và cleanup, chỉ dọn product/variant/inventory/category/user UUID do lượt chạy tạo. Không stage/commit/push; nhánh `feat/catalog-inventory`, baseline `06afd99` do người dùng đã push. Snapshot `.local/m3-3-before-20261028`, ledger `.local/m3-3-execution.md` bị Git bỏ qua.

### Data flow / key quan trọng

Admin mở tạo → GET `/api/v1/admin/categories` → form gửi `{name,slug,description,categoryId,variants:[{sku,size,color,price,active:true}]}` qua `productsApi.create` và client cookie/CSRF → SessionGuard/RolesGuard + ProductDto/VariantDto → ProductsService tạo Product/Variant/Inventory trong một nested write nguyên tử → trả dữ liệu đã chuẩn hóa → FE invalidate `admin-products`, về list GET `/api/v1/admin/products?page=1&pageSize=24`. Giá/status/tồn kho công khai lấy từ server, không dùng dữ liệu giả để báo đã lưu.

- `SKU`: mã riêng duy nhất của biến thể; backend chuẩn hóa uppercase, khác ID sản phẩm.
- `Variant`: tổ hợp size/màu cùng giá, M3.3 gửi đúng một variant active; UI quản lý thêm/sửa thuộc M3.4.
- `DRAFT`: trạng thái nháp backend thiết lập, public list/detail không trả sản phẩm này.
- `admin-products`: query key danh sách kèm trang từ URL; invalidate sau tạo để đọc lại dữ liệu server.
- `available`: khả dụng do backend tính từ kho, variant mới có onHand/reserved/available0.

### Kiểm tra thực tế và review

| Lệnh/kiểm tra | Kết quả |
|---|---|
| 14 test UI mới trước implementation | 14 thất bại vì route/form/list chưa có (404), không phải missing module/import |
| 14 test UI sau implementation ban đầu | 14/14 đạt riêng phần M3.3 |
| Regression review trước fix | 1/9 thất bại: refetch danh mục lỗi làm mất input; 8 ca còn lại đạt |
| `./tools/npm.ps1 run typecheck` cuối sau fix | Backend/frontend đạt |
| `./tools/npm.ps1 test` cuối sau fix | 73/73 đạt: 8 công cụ + 6 backend unit + 59 frontend unit/UI, gồm 15 M3.3 |
| `./tools/npm.ps1 run build` cuối sau fix | Hai app đạt; Vite cảnh báo chunk587.64kB/gzip181.72kB; không tối ưu bundle ngoài phần này |
| `./tools/npm.ps1 run test:integration` | 28/28 đạt trên PostgreSQL `_test`, backend không đổi sau lượt kiểm tra |
| `./tools/npm.ps1 run test:e2e:implemented` | Lượt cuối sau fix review: 8/8 đạt, 47.1 giây; 2auth + 4categories + 2products |
| E2E discovery `--list` | Implemented8 ca/3file; full9 ca/4file còn catalog, không phải full9 ca đã đạt |
| Ảnh E2E mobile | Agent đã xem form và list tại390px, label/error rõ và không tràn ngang |
| Review độc lập `review_m3_3` | 1 Important mất draft khi background refetch lỗi; không Critical/Minor khác |

**Finding review đã sửa:** query lỗi khi đã có cache không còn unmount ProductCreateForm; cảnh báo/retry tách khỏi form. Test tái hiện refetch lỗi rồi phục hồi đã RED→GREEN; suite73 đạt sau sửa. Không bỏ qua finding hoặc xin phép người dùng để né xử lý trong phạm vi.

Hai vướng mắc kiểm tra đã xử lý đúng nguyên nhân: (1) một lượt tools/prisma-config.test.mjs timeout subprocess15s/statusnull khi máy bận, giữ nguyên test/timeout, rerun đạt; (2) helper UI gõ từng ký tự nhiều trường khiến một test chạm5s dưới tải tổng, đổi phần cấp dữ liệu test sang fireEvent.change hàng loạt và giữ select/click thực/assertions/timeout; E2E vẫn thao tác trình duyệt thật. Không tắt check hoặc tăng timeout toàn suite để che lỗi. Lượt cuối root suite đạt.

### Giới hạn / chạy thử / điểm dừng

- Backend hiện chưa flatten fieldErrors của variant lồng nhau; dữ liệu sai vẫn bị DTO chặn và UI báo lỗi chung/giữ input. Unit kiểm tra khả năng hiển thị nested path nếu API cung cấp, không nhận là backend đã serialize đủ; không mở rộng sửa backend trong phần này.
- Chưa có UI sửa sản phẩm/ảnh/điều chỉnh kho/xuất bản hoặc public catalog; chưa chạy/nhận full catalog E2E đạt. Cảnh báo pg concurrent query và NO_COLOR/FORCE_COLOR không làm test thất bại. Chưa kiểm chứng CI GitHub với thay đổi M3.3, chưa deploy.
- Hướng dẫn: [chạy thử M3.3](docs/local-trial-m3.md). Giữ/chạy `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend` ở hai terminal. ADMIN mở http://127.0.0.1:5173/admin/products → Thêm sản phẩm → tên/slug/danh mục + SKU/size/màu/giá → Lưu → refresh, phải còn Nháp/khả dụng0. Thử dùng lại SKU/slug để kiểm tra lỗi giữ input.

**Dừng ở M3.3 cho người dùng thử/xác nhận.** M3.4 — sửa nháp và quản lý biến thể — cần kế hoạch riêng được duyệt; chưa triển khai.

## Ngày 28/10/2026 — Sửa theo review repo (nhánh `fix/review-findings`)

**Trạng thái:** người dùng yêu cầu thực hiện các mục ưu tiên sau review. Đã viết và agent đã kiểm tra local; **chờ người dùng xem/merge**. Không thay đổi phạm vi M3, không bắt đầu M3.3.

| File | Thay đổi |
|---|---|
| `apps/backend/src/application.ts` | `logger: false` làm mọi log Nest bị tắt, kể cả lỗi 500 và lỗi gửi mail; đổi thành chỉ giữ `error`/`warn`. |
| `apps/backend/src/common/http-exception.filter.ts` | Lỗi 500 ngoài dự kiến ghi stack vào log server; response cho client vẫn chung chung như cũ. |
| `apps/backend/src/modules/auth/auth.service.ts` | Không chờ gửi mail trước khi trả response đăng ký/quên mật khẩu/gửi lại xác minh, để thời gian phản hồi không lộ email đã có tài khoản hay chưa. |
| `apps/backend/src/common/http-exception.filter.spec.ts`, `apps/backend/src/modules/auth/auth.service.spec.ts` | Unit test mới: 500 ghi stack nhưng body an toàn; register/requestToken không chờ mail provider. |
| `apps/backend/test/auth.integration.spec.ts`, `apps/frontend/e2e/auth.spec.ts` | Đọc hộp thư preview có chờ tối đa 5 giây vì mail gửi sau response; thêm ca kiểm tra app thật vẫn ghi log lỗi. |
| `README.md`, `progress.md` | Bỏ câu "fastLock/LiveOrder" không thuộc dự án; xóa khối "Yêu cầu push GitHub" bị chép trùng, sửa tiêu đề bị cắt, bỏ đường dẫn máy cá nhân trong ghi chú Git. |

**Kiểm tra (Node 24.15 với `--engine-strict=false`, PostgreSQL 18.6 Docker):** typecheck và build đạt; `npm test` 61/61 (8 tools, 9 backend unit, 44 frontend); integration 29/29; `test:e2e:implemented` 6/6 (catalog vẫn chờ UI theo M3.2.1). Ba unit test mới và ca log integration đã thấy thất bại trước khi sửa. Chưa chạy trên GitHub CI.

**Còn lại:** rate limit đăng nhập vẫn theo IP+email (chưa theo tài khoản); backend vẫn listen `127.0.0.1` (cần đổi trước deploy M6); ESLint/Prettier hoãn tới sau khi merge nhánh catalog để tránh diff format toàn repo.

## Ngày 28/10/2026 — M3.2.1: sửa phạm vi E2E của CI

**Người dùng đã duyệt bản sửa CI riêng, chưa duyệt triển khai M3.3.** Đã sửa cấu hình và kiểm tra local; CI mới chưa commit/push/chạy lại trên GitHub. Mốc sản phẩm vẫn dừng ở M3.2.

### Nguyên nhân đã xác nhận

- Commit `d5953cf` đã push thành công. API Actions xác nhận run `40665722000` thất bại ở bước `npm run test:e2e`; typecheck/build/unit/integration và cài browser đều thành công.
- Người dùng cung cấp log chi tiết: 6 E2E đạt, `catalog.spec.ts` thất bại tại dòng 54 chờ link Sản phẩm chưa có. Ca này kiểm tra toàn M3, vượt UI đang triển khai đến M3.2. Cấu hình CI đã chạy ca chấp nhận toàn M3 quá sớm.
- `.env.test not found` không phải nguyên nhân lỗi này vì CI cấp biến môi trường trực tiếp. Các cảnh báo Node/Ubuntu không thay thế lỗi locator đã nêu.

### File thực tế và thay đổi

| File | Mục đích |
|---|---|
| `package.json` | Thêm `test:e2e:implemented` chọn auth.spec.ts + categories.spec.ts; giữ nguyên test:e2e chạy toàn bộ |
| `.github/workflows/ci.yml` | Bước E2E chạy lệnh implemented và ghi rõ tên auth + categories through M3.2 |
| `README.md` | Phân biệt 6 ca implemented với 7 ca toàn bộ; yêu cầu mở rộng phạm vi khi triển khai tính năng tiếp theo |
| `progress.md` | Ghi lỗi gốc, kết quả kiểm tra mới, giới hạn CI và điểm dừng |

Danh sách đúng kế hoạch đã duyệt. Không thay `catalog.spec.ts`, test runner/guard `_test`, Playwright config, schema, dependency hoặc lockfile; không xóa/skip test, không thêm continue-on-error. Index Git và dữ liệu local giữ nguyên; E2E chỉ ghi/dọn fixture riêng trên `_test`.

**Luồng chạy:** CI → `npm run test:e2e:implemented` → `tools/test-e2e.mjs` kiểm tra NODE_ENV/test database rồi chuyển hai tên file tới Playwright → khởi động API/FE test → chạy auth và danh mục. `npm run test:e2e` vẫn không có filter và còn nguyên ca catalog.

### Kiểm tra mới trong phiên

| Kiểm tra | Kết quả |
|---|---|
| Gọi script mới trước sửa | Thất bại Missing script, xác nhận script chưa tồn tại |
| Parse package.json và đối chiếu scripts | JSON hợp lệ; script đầy đủ giữ nguyên, script mới đúng phạm vi |
| Liệt kê implemented bằng `--list` | 6 ca / 2 file, đúng auth + categories |
| Liệt kê full bằng `--list` | 7 ca / 3 file, vẫn có catalog.spec.ts; đây chỉ là discovery, không phải 7 ca đạt |
| `./tools/npm.ps1 run test:e2e:implemented` | 6/6 đạt thực tế trên `_test`, 41.2 giây |
| Review/diff | `review_ci_e2e_scope` review độc lập script/workflow/README: không Critical/Important/Minor, không hành vi bị bỏ qua đánh giá; agent rà progress sau cập nhật, diff/đường dẫn tài liệu đạt |

Khi thử discovery qua wrapper PowerShell, `--list` bị npm nhận như config nên đã dừng lượt đó; dùng npm native với Node24 local và mảng tham số để chuyển nguyên `--`/`--list`. Không sửa wrapper ngoài phạm vi. Lượt chạy chính thức của lệnh implemented phía trên không có tham số discovery, hoàn tất exit0.

Không chạy lại root typecheck/build/unit/integration cho bản sửa chỉ cấu hình/tài liệu này; không nhận kết quả M3.2/CI cũ là vừa chạy local. E2E tự build backend khi khởi động theo cấu hình hiện có. Full E2E chưa đạt vì UI các phần M3 sau chưa triển khai; CI xanh của implemented không đại diện nghiệm thu toàn M3.

**Key:** không có key dữ liệu nghiệp vụ mới. `test:e2e:implemented` là bộ tính năng đã triển khai; `test:e2e` là bộ đầy đủ; tên bước E2E trong CI công khai phạm vi kiểm tra đến M3.2. Khi thêm phần mới phải bổ sung ca đã sẵn sàng vào bộ implemented, khi toàn M3 đủ thì CI cần chạy bộ đầy đủ.

**Chạy thử:** `./tools/npm.ps1 run test:e2e:implemented` từ root, DB test và browser theo README. Người dùng có thể review/commit/push bản sửa để CI tạo run mới; agent chưa stage/commit/push và chưa xác nhận CI mới đạt. Dừng sau bản sửa CI; M3.3 còn chờ duyệt kế hoạch riêng.

## Ngày 28/10/2026 — M3.2: admin sửa/bật/tắt danh mục

**Trạng thái:** người dùng đã duyệt kế hoạch M3.2 trong chat. Đã viết, agent đã kiểm tra local và review độc lập không finding cần sửa; **chờ người dùng thử/xác nhận**. Không tự coi yêu cầu tiếp tục là nghiệm thu toàn M3 hoặc các phần trước.

### Thay đổi và file thực tế

- Nút Sửa mở dialog có tên/slug/active hiện tại; Lưu thay đổi ghi qua PATCH thật và refresh vẫn giữ; Hủy/Escape đóng mà không ghi.
- Form tạo/sửa dùng chung CategoryForm để không lặp field/validation/submit. `useId` tránh trùng ID giữa form tạo và dialog.
- Edit giữ snapshot/version lúc mở, không bị refetch nền thay draft. 409 giữ input/version, không tự ghi đè; Tải dữ liệu mới chỉ thay snapshot và bỏ draft khi GET thành công theo thao tác người dùng. Lời nhắc ngay trong dialog giải thích việc thay dữ liệu đang nhập.
- Busy ref khóa submit đồng bộ; trong lúc lưu/tải mới khóa input, Save/Cancel/reload và chặn Escape/backdrop. Sau PATCH thành công cập nhật cache, đóng dialog và invalidate list; refetch lỗi không báo nhầm ghi thất bại.

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/admin/categories/api/categories.api.ts` | Thêm CategoryUpdateInput/expectedVersion và hàm PATCH typed |
| `apps/frontend/src/features/admin/categories/components/CategoryCreateForm.tsx` → `apps/frontend/src/features/admin/categories/components/CategoryForm.tsx` | Đổi tên/tái sử dụng form tạo và sửa, giữ trạng thái/error/khóa submit, ID riêng cho mỗi instance |
| `apps/frontend/src/features/admin/categories/components/CategoryEditDialog.tsx` | Thêm dialog giữ snapshot, reload tường minh, pending/close guard và form sửa |
| `apps/frontend/src/features/admin/categories/pages/CategoriesPage.tsx` | Thêm nút Sửa, mutation update/cache và GET dữ liệu mới; giữ list/create |
| `apps/frontend/src/features/admin/categories/pages/CategoriesPage.test.tsx` | Thêm 5 test edit/reload/conflict/cancel/submit; giữ 7 test tạo/quyền |
| `apps/frontend/e2e/categories.spec.ts` | Thêm sửa/public visibility và hai tab thật; bổ sung chặn PATCH anonymous/CUSTOMER; cleanup cả slug đã đổi |
| `docs/local-trial-m3.md` | Hướng dẫn thao tác M3.2, thử hai tab và giới hạn catalog public |
| `docs/architecture.md` | Ghi trách nhiệm form/dialog/page và quy tắc snapshot/version |
| `docs/m3-implementation-plan.md` | Ghi phạm vi được duyệt, kết quả và điểm dừng M3.2 |
| `docs/plan.md` | Cập nhật điểm dừng M3.2, chưa hoàn thành toàn M3 |
| `README.md` | Cập nhật trạng thái/tài liệu chạy thử M3.2 |
| `progress.md` | Ghi bằng chứng kiểm tra, file thực tế và việc còn lại |

Danh sách thực tế đúng phạm vi dự kiến; backend/schema/migration/dependency giữ nguyên. Không sửa/reset dữ liệu local, không tạo admin local hoặc seed dữ liệu người dùng. E2E chỉ tạo/dọn fixture UUID của chính lượt chạy ở `_test`. Không thay index/stage/commit/push; nhánh vẫn `feat/catalog-inventory`, thay đổi các phần trước được giữ nguyên. Bản đối chiếu trước M3.2 nằm trong `.local/m3-2-before-20261028` bị Git bỏ qua.

### Data flow và key quan trọng

Admin chọn Sửa → `CategoryEditDialog` giữ `snapshot` gồm `version` đang xem → `CategoryForm` gửi `{name,slug,active}` → `categoriesApi.update` thêm `expectedVersion` của snapshot rồi PATCH qua proxy/CSRF → SessionGuard/RolesGuard + DTO kiểm tra → CategoriesService update theo id/version trong transaction, Prisma tăng version → FE cập nhật cache và refetch list. Danh mục tắt bị loại khỏi GET public categories, bật lại thì xuất hiện. UI public catalog vẫn chưa triển khai.

- `expectedVersion`: phiên bản của lần mở/sau lần reload tường minh; server từ chối khi DB đã đổi.
- `snapshot`: dữ liệu gốc của form sửa, không tự đồng bộ theo query list để tránh ghi đè bằng draft cũ.
- `revision`: remount form sau reload thành công dù version không đổi; chỉ thao tác này chủ động bỏ phần đang nhập.
- `busy`: khóa ref tức thời để chặn gửi/đóng/reload trùng trước khi React vẽ disabled.
- `CONFLICT`/409: API hiện dùng cho cả version cũ và slug trùng; form sửa nêu cả hai khả năng và giữ input, không gán nhầm mọi lỗi thành slug.

### Kiểm tra mới trong phiên

| Lệnh/kiểm tra | Kết quả đã quan sát |
|---|---|
| UI categories trước implementation | 5 test sửa thất bại vì chưa có nút Sửa, 7 test cũ đạt; không phải missing import |
| `./tools/npm.ps1 run typecheck` | Backend/frontend đạt |
| `./tools/npm.ps1 run test --workspace=@clothing/frontend -- src/features/admin/categories/pages/CategoriesPage.test.tsx` | 12/12 đạt sau sửa |
| `./tools/npm.ps1 test` | 58/58 đạt: 8 công cụ + 6 backend unit + 44 frontend unit/UI |
| `./tools/npm.ps1 run build` | Hai ứng dụng đạt; cảnh báo Vite chunk 567.98 kB/gzip 177.06 kB, chưa tối ưu bundle trong phần này |
| `./tools/npm.ps1 run test:integration` | 28/28 đạt trên PostgreSQL `_test`, gồm normalize/version/public visibility/allowlist và quyền |
| `./tools/npm.ps1 run test:e2e -- categories.spec.ts auth.spec.ts` | 6/6 đạt: 2 auth + 4 categories, gồm sửa/slug trùng/refresh/mobile/public visibility, PATCH 401/403 và hai tab thật |
| Screenshot mobile dialog | Agent đã xem ảnh E2E ở viewport 390: form/error/actions rõ, không tràn ngang |
| Review độc lập `review_m3_2` | Chỉ đọc diff với snapshot và các luồng/test liên quan; không Critical/Important/Minor, không hành vi bị bỏ qua đánh giá |

Không chạy toàn bộ `catalog.spec.ts` vì UI sản phẩm/ảnh/kho/public chưa có; không skip hoặc nhận toàn E2E M3 đã đạt. Cảnh báo `pg` concurrent query và NO_COLOR/FORCE_COLOR không làm kiểm tra thất bại. Chưa có bằng chứng GitHub CI hoặc deploy. Rà diff và liên kết tài liệu trước bàn giao.

### Chạy thử / điểm dừng

Xem [hướng dẫn M3.2](docs/local-trial-m3.md#m32--sửabậttắt-danh-mục). Chạy `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend` ở hai terminal nếu app chưa chạy. Mở http://127.0.0.1:5173/admin/categories bằng ADMIN → Sửa một danh mục → đổi tên/slug/active → Lưu → refresh. Mở Sửa cùng danh mục ở hai tab trước khi lưu để kiểm tra stale version; tab cũ phải bị chặn và giữ input.

**Dừng ở M3.2 để người dùng thử/phản hồi.** Phần tiếp theo là M3.3 — tạo sản phẩm nháp với một biến thể; cần kế hoạch riêng được duyệt, chưa triển khai.

## Ngày 28/10/2026 — M3.1.1: sửa giao diện theo phiên khi chạy thử

**Phạm vi được duyệt:** người dùng báo đã đăng nhập nhưng `/shop` vẫn có Tạo tài khoản, đồng ý thay nút theo phiên/role và chuyển người đã đăng nhập khỏi `/login`, `/register`. Đây là bản sửa trong lượt chạy thử, không triển khai M3.2.

**Nguyên nhân:** `CatalogIntroPage` luôn render link `/register`; `AuthPage` luôn render form login/register mà chưa kiểm tra phiên. Không có căn cứ từ lỗi UI này để kết luận cookie/session đã bị mất; không sửa hoặc bỏ backend guard.

### File thực tế của riêng bản sửa

| File | Thay đổi và mục đích |
|---|---|
| `apps/frontend/src/features/catalog/pages/CatalogIntroPage.tsx` | Dùng lại useCurrentUser; khách thấy Tạo tài khoản, CUSTOMER thấy Tài khoản, ADMIN thấy Quản trị; chờ/lỗi phiên không hiển thị nhầm link đăng ký |
| `apps/frontend/src/features/auth/pages/AuthPage.tsx` | EntryAuthPage kiểm tra phiên cho login/register, có loading/error/retry và Navigate replace theo role; forgot/reset giữ luồng riêng |
| `apps/frontend/src/features/catalog/pages/CatalogIntroPage.test.tsx` | Thêm 6 test guest/CUSTOMER/ADMIN, pending/error/retry và thay đổi cache sau logout |
| `apps/frontend/src/app/App.test.tsx` | Thêm 8 ca kiểm tra login/register theo phiên, khách, pending/error/retry; giữ 3 ca protected route đã có |
| `apps/frontend/e2e/auth.spec.ts` | Bổ sung vào luồng auth hiện có: /shop không hiện đăng ký khi có cookie thật, deep link login/register chuyển về account; logout thì link đăng ký hiện lại |
| `progress.md` | Ghi nguyên nhân, kiểm tra, các file của bản sửa và hướng dẫn thử |

E2E auth là file bổ sung so với dự kiến để chứng minh tích hợp cookie/proxy theo quy tắc dự án. Không thay dependency/backend/schema/API hoặc tạo dữ liệu người dùng local; index/thay đổi có sẵn được giữ nguyên, không stage/commit/push. Snapshot riêng phần này ở `.local/auth-ui-before-20261028` bị Git bỏ qua.

### Data flow và key quan trọng

`CatalogIntroPage` và `EntryAuthPage` dùng chung query `current-user` của `useCurrentUser`; khi cần, `authApi.me` gọi GET `/api/v1/me` qua proxy với cookie để backend đọc phiên. Chỉ khi đã xác nhận là khách mới hiện link/form đăng ký; có user thì nút và redirect theo role. Login cập nhật cache, logout xóa cache như trước; không tạo trạng thái đăng nhập thứ hai hoặc lưu token vào localStorage.

- `useCurrentUser`: hook/cache có sẵn làm nguồn dữ liệu phiên cho cả header, nút và trang auth.
- `EntryAuthPage`: component cục bộ chỉ kiểm soát login/register; không chặn người đang đăng nhập mở forgot/reset.
- `Navigate replace`: chuyển đến account/admin và thay entry lịch sử để Back không quay lại form đăng nhập vừa bị chuyển hướng.
- `isPending`/`isError`: phân biệt phiên đang tải hoặc kiểm tra thất bại với kết quả khách thực sự; lỗi có nút thử lại.

### Kiểm tra trong phiên

| Kiểm tra | Kết quả thực tế |
|---|---|
| Test tái hiện trước sửa CatalogIntroPage + App | 11 thất bại / 6 đạt; lỗi đúng link tạo tài khoản cố định, form hiện trước khi có phiên và thiếu redirect; không phải missing import |
| `./tools/npm.ps1 run typecheck` | Backend/frontend đạt |
| `./tools/npm.ps1 test` | 53/53 đạt: 8 công cụ + 6 backend unit + 39 frontend unit/UI, gồm hồi quy reset token và M3.1 |
| `./tools/npm.ps1 run build` | Backend/frontend đạt; cảnh báo Vite chunk 558.88 kB / gzip 174.75 kB được giữ nguyên phạm vi tối ưu sau |
| `./tools/npm.ps1 run test:e2e -- auth.spec.ts categories.spec.ts` | 4/4 đạt trên `_test`: cookie thật, refresh, CTA/redirect/logout, register/verify/reset, mobile và danh mục/quyền |
| `git diff --check` | Đạt sau code; rà lại sau cập nhật tài liệu trước bàn giao |

Không chạy lại integration backend trong bản sửa chỉ frontend này; 28/28 ở M3.1 là kết quả lượt trước, không nhận là vừa chạy. Chưa có bằng chứng CI GitHub hoặc deploy. Review độc lập `review_auth_ui` chỉ đọc production diff so với snapshot và các test/luồng liên quan: không finding Critical/Important/Minor, không hành vi bị bỏ qua đánh giá. Không có sửa source sau lượt kiểm tra cuối.

### Chạy thử / điểm dừng

Giữ hai terminal local đang chạy, hoặc mở từ root bằng `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend` ở hai terminal. Tại http://127.0.0.1:5173/shop:

1. Chưa đăng nhập: nút Tạo tài khoản dẫn tới register.
2. Đăng nhập CUSTOMER: nút đổi thành Tài khoản; ADMIN: đổi thành Quản trị. Refresh vẫn đúng và không có Tạo tài khoản.
3. Khi đang đăng nhập, nhập trực tiếp `/login` hoặc `/register`: chuyển về `/account` hoặc `/admin` theo role.
4. Đăng xuất và quay lại `/shop`: nút Tạo tài khoản hiện lại.
5. Luồng quên/đặt lại mật khẩu vẫn dùng được; khi kiểm tra phiên lỗi sẽ có nút Kiểm tra lại phiên.

**Đã viết và agent đã kiểm tra, chờ người dùng thử/xác nhận. Dừng tại bản sửa M3.1.1; không tự bắt đầu M3.2.**

## Ngày 28/10/2026 — M3.1: admin xem và tạo danh mục

**Trạng thái:** người dùng đã duyệt phần M3.1; đã viết và agent đã kiểm tra local, review độc lập không có finding cần sửa. **Chờ người dùng chạy thử**, chưa coi là nghiệm thu. Việc cho phép triển khai M3.1 không tự đánh dấu các phần trước đã được người dùng thử.

### Phạm vi và kết quả

- Route `/admin/categories` có PrivateRoute ADMIN, mở từ nút Danh mục ở trang quản trị.
- Danh sách đọc dữ liệu thật từ GET admin categories; có loading/empty/error/retry, tên/slug/trạng thái bật/tắt và bố cục mobile.
- Form tạo tên/slug/active qua POST hiện có, xử lý lỗi field/mạng/slug trùng và giữ input khi lỗi; khóa trường/nút và dùng `busy` để chặn submit cùng nhịp. Không tự retry POST.
- Tạo thành công báo kết quả, đọc lại query danh sách rồi làm trống form. Nếu refetch lỗi sau khi server đã lưu, thông báo đã lưu vẫn đúng, list có nút thử tải lại; không báo nhầm POST thất bại.
- Không thay backend/schema/migration/dependency hoặc tài khoản người dùng local. Tài khoản ADMIN/CUSTOMER E2E chỉ là fixture UUID riêng trong `_test`, được dọn sau test. Không seed dữ liệu demo vào database local.

### File thực tế của riêng M3.1

| File | Thay đổi và mục đích |
|---|---|
| `apps/frontend/src/features/admin/categories/api/categories.api.ts` | Thêm kiểu CategoryInput/Category và hàm gọi GET/POST danh mục |
| `apps/frontend/src/features/admin/categories/components/CategoryCreateForm.tsx` | Thêm form state/validation, phản hồi lỗi có focus, khóa submit và giữ input khi lỗi |
| `apps/frontend/src/features/admin/categories/pages/CategoriesPage.tsx` | Thêm Query/list/create flow, invalidate danh sách sau tạo, trạng thái tải/lỗi/thành công |
| `apps/frontend/src/features/admin/categories/pages/CategoriesPage.test.tsx` | Thêm 7 test UI/route: tải/tạo, retry, trùng slug, validation/mạng, submit lặp và quyền |
| `apps/frontend/src/app/App.tsx` | Thêm import và route danh mục có bảo vệ ADMIN, giữ route cũ |
| `apps/frontend/src/features/admin/AdminPage.tsx` | Thêm nút Danh mục sau khi API admin/access thành công |
| `apps/frontend/e2e/categories.spec.ts` | Thêm 2 test qua proxy/DB thật: active/inactive, refresh, duplicate, mobile và quyền GET/POST |
| `docs/local-trial-m3.md` | Thêm hướng dẫn chuẩn bị/admin CLI, chạy thử M3.1, data flow và giới hạn |
| `progress.md` | Ghi kết quả kiểm tra thực tế, file của phần này và điểm dừng |
| `docs/m3-implementation-plan.md` | Ghi M3.1 được duyệt/triển khai, giữ các phần tiếp theo chờ duyệt |
| `docs/plan.md` | Cập nhật điểm dừng M3.1, không đánh dấu hoàn tất toàn M3 |
| `README.md` | Sửa trạng thái cũ còn ghi chưa chuyển M3, dẫn tới hướng dẫn M3.1 |
| `docs/architecture.md` | Ghi cấu trúc feature admin/categories và query flow đang có |

Ba tài liệu cuối là bổ sung so với danh sách dự kiến để tránh mô tả sai trạng thái code; không mở rộng tính năng. Các thay đổi đã staged từ những phần trước giữ nguyên; M3.1 không stage/commit/push. Nhánh vẫn `feat/catalog-inventory`. Snapshot trước phần này ở `.local/m3-1-before-20261028`, ledger `.local/m3-1-execution.md` đều bị Git bỏ qua.

### Data flow và key

Admin mở Danh mục → `CategoriesPage` gọi `categoriesApi.list` qua client/proxy → backend SessionGuard/RolesGuard đọc phiên và quyền ADMIN → CategoriesService đọc bảng `categories`. Admin gửi `{name,slug,active}` từ form → client lấy CSRF rồi POST → DTO chuẩn hóa/kiểm tra và Prisma ghi DB với unique slug → FE báo thành công, invalidate `admin-categories` để tải lại dữ liệu server. Lỗi tạo được giữ tại form để chỉnh hoặc thử lại; backend vẫn quyết định quyền và tính hợp lệ.

- `slug`: đường dẫn duy nhất, không phải tên hiển thị; trùng sẽ bị DB/API từ chối.
- `active`: bật/tắt tại lúc tạo; M3.1 chưa sửa trạng thái danh mục cũ.
- `admin-categories`: query key xác định danh sách cần refetch sau POST thành công.
- `busy`: khóa đồng bộ bằng ref trong form để chặn gửi lặp trước khi React vẽ trạng thái disabled.
- `version`: response hiện có để dành cho chỉnh sửa có kiểm soát xung đột M3.2; M3.1 chưa gửi expectedVersion.

### Kiểm tra đã quan sát trong phiên

| Lệnh/kiểm tra | Kết quả |
|---|---|
| Test UI M3.1 trước implementation | 7/7 thất bại vì route chưa có, hiện 404; không phải lỗi import/missing module |
| `./tools/npm.ps1 run typecheck` | Backend và frontend đạt |
| `./tools/npm.ps1 test` | 39/39 đạt: 8 công cụ + 6 backend unit + 25 frontend unit/UI (gồm 7 M3.1) |
| `./tools/npm.ps1 run build` | Backend/frontend đạt; Vite cảnh báo chunk 557.75 kB, gzip 174.57 kB, chưa tối ưu bundle trong phần này |
| `./tools/npm.ps1 run test:integration` | 28/28 đạt trên PostgreSQL `_test` (16 auth + 12 catalog) |
| `./tools/npm.ps1 run test:e2e -- categories.spec.ts` | 2/2 đạt: dữ liệu thật, refresh, trùng slug, active=false, mobile390/focus và chặn quyền ở UI/API |
| `./tools/npm.ps1 run test:e2e -- auth.spec.ts` | 2/2 đạt: register/verify/login/refresh/reset/logout và mobile/focus, kiểm tra hồi quy App route |
| Review độc lập `review_m3_1` | Chỉ đọc source/diff so với snapshot, không finding Critical/Important/Minor; không hành vi bị bỏ qua đánh giá |
| Ảnh mobile E2E danh mục | Agent đã xem; form/list xếp dọc, slug dài wrap, không tràn ngang |

Trong lượt chạy UI đầu sau implementation, assertion đếm POST chạy trước microtask của TanStack mutation (0 thay vì 1); sửa test dùng waitFor trước khi đếm, không đổi code để che lỗi. Lượt cuối toàn suite đạt. Cảnh báo `pg` concurrent query và NO_COLOR/FORCE_COLOR hiện có không làm test thất bại; không nâng dependency để xử lý trong phần này. Diff/đường dẫn tài liệu được rà trước bàn giao.

### Chạy thử và điểm dừng

Xem [hướng dẫn M3.1](docs/local-trial-m3.md). Chạy `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend` ở hai terminal, mở http://127.0.0.1:5173/admin/categories bằng tài khoản ADMIN. Tạo Áo thun / ao-thun → thấy trong list sau refresh; tạo lại cùng slug → báo lỗi và giữ form. Không tự tạo admin hoặc cung cấp mật khẩu mặc định.

**Dừng tại M3.1 để người dùng thử và phản hồi.** M3.2 dự kiến sửa/bật/tắt danh mục cũ, cần kế hoạch riêng được duyệt. Chưa chạy toàn bộ catalog E2E vì UI các phần sau chưa có; không skip ca đó để gọi toàn M3 hoàn thành. Chưa xác nhận CI GitHub, chưa deploy và chưa commit/push.

## Quyết định thực hiện

- Workspace hiện trống và chưa là repo: khởi tạo repo riêng tại thư mục người dùng chỉ định, dùng nhánh feature; không tạo worktree bên trong một repo chưa tồn tại hoặc sửa dự án khác.
- Kế hoạch được lưu ở `docs/plan.md`, đặc tả nghiệp vụ ở `docs/business-rules.md`, theo vị trí người dùng yêu cầu.
- Không đổi Node toàn máy, không tự mua dịch vụ; engine incompatibility phải được xử lý tường minh.
- Review M1 đã phát hiện và bổ sung: tiền đến sau hủy trước deadline; nghĩa vụ tiền khi nhận giao thất bại; Returns suy ra needsResolution để không gọi vòng Orders→Returns. Định nghĩa ngân sách hoàn không cộng PROCESSING hai lần; adapter Mail tối thiểu chuyển về M2 vì auth cần dùng.
- Metadata npm kiểm tra: React 19.3.1, Router 8.5.0 cần Node >=22.22; Nest 12.2.0; MUI 9.5.0; Vite 8.3.5; Prisma stable 7.10.1 (latest là 8 RC, không chọn). Node 24.22.1 đã tải vào `.local`, kiểm SHA256 từ nodejs.org, không thay hệ thống.
- Docker Desktop được khởi động nền; daemon trả phiên bản 28.4.0. Chưa có PostgreSQL/test ứng dụng chạy ở thời điểm ghi này.

## Kiểm tra

### M3.0.3 — sửa lỗi và tổ chức frontend — 27/10/2026 (agent đã kiểm tra; chờ người dùng thử)

- Người dùng yêu cầu triển khai các điểm review FE, xong mới lập kế hoạch tiếp tục M3. Phạm vi đã nêu trong chat: API client multipart/idempotency, vòng đời link token, tách router/page và format JSX; chưa triển khai màn hình M3 mới.
- File chính: `shared/api/client.ts` + test; `features/auth/hooks/useLinkToken.ts` + test; `AuthPage.tsx`/`VerifyPage.tsx` + test để reset trạng thái của link cũ; `app/App.tsx`, mới `app/router/PrivateRoute.tsx`, `app/pages/NotFoundPage.tsx`, `features/catalog/pages/CatalogIntroPage.tsx`, `features/information/pages/PolicyPage.tsx`, `features/information/content/policies.ts`; format `layouts/StoreLayout.tsx`, `main.tsx`. Đường dẫn này tính từ `apps/frontend/src/`.
- Thực hiện test trước sửa, rồi kiểm tra typecheck/build/unit/E2E auth, review độc lập và cập nhật lộ trình M3 chia nhỏ. Chỉ lập kế hoạch M3 tiếp theo, dừng để người dùng thử/duyệt; không tự code tiếp M3.
- Đã quan sát 8 ca thất bại trước sửa: JSON/multipart thiếu Idempotency-Key, query bị mất khi xóa fragment, token cũ khi mở link mới/empty token, trạng thái verify/reset và kết quả in-flight của link cũ. Các ca hồi quy đã đạt sau sửa.
- Review độc lập phát hiện P2 skip-link `#main-content` xóa token. Đã viết ca hồi quy và thấy thất bại (1 fail/4 pass của hook); sửa để chỉ xử lý fragment có tham số `token`, bảo toàn anchor nội trang. Case clear token kiểm tra link explicit `#token=`; thêm thao tác keyboard skip-link vào cả verify và reset trong E2E auth. Reviewer kiểm lại bản sửa, không còn P1/P2 được phát hiện trong phạm vi này.
- Kết quả cuối: `npm run typecheck` và `npm run build` cả hai app đạt; `npm test` đạt **32 ca** (8 tools, 6 backend unit, 18 frontend unit/UI); `npm run test:e2e -- auth.spec.ts` đạt **2 ca** qua proxy/API/PostgreSQL, gồm keyboard skip-link và mobile. Backend integration 28 ca đã đạt ở M3.0.2, không chạy lại trong phần FE không sửa backend này. E2E catalog chưa đạt/chưa chạy lại vì UI M3 chưa có; không tuyên bố toàn bộ M3/CI đã đạt.
- Một lượt root test bị timeout 15s ở ca Prisma config có sẵn (status null), các lượt chạy lại nguyên trạng đạt; không sửa test hoặc tăng timeout để che lỗi. Vite còn cảnh báo bundle khoảng 535 kB trước gzip, được ghi nhận cho tối ưu sau này; build vẫn đạt.

#### File thực tế của M3.0.3

Các đường dẫn source dưới đây tính từ `apps/frontend/src/`; đối chiếu snapshot trước phần FE để không nhận các thay đổi backend/M3 đã có là của lần này.

| File | Thay đổi và mục đích |
|---|---|
| Sửa `shared/api/client.ts` | Thêm idempotencyKey, truyền FormData nguyên dạng, giữ JSON/CSRF/cookie và không tự retry mutation. |
| Sửa `shared/api/client.test.ts` | Khóa hành vi JSON/header/multipart và các lỗi mạng đã có. |
| Sửa `features/auth/hooks/useLinkToken.ts` | Nhận token mới ngay trên route đang mount, giữ query và anchor nội trang, bỏ token khỏi URL. |
| Thêm `features/auth/hooks/useLinkToken.test.tsx` | Kiểm tra link mới, empty token, query, StrictMode và skip-link. |
| Sửa `features/auth/pages/AuthPage.tsx` | Nội dung reset có key theo token, form/notice cũ không tồn tại sang link mới. |
| Thêm `features/auth/pages/AuthPage.test.tsx` | Kiểm tra reset link mới sau khi link cũ đã thành công. |
| Sửa `features/auth/pages/VerifyPage.tsx` | Nội dung verify có vòng đời theo token, tránh success/pending/result cũ chồng lên link mới. |
| Thêm `features/auth/pages/VerifyPage.test.tsx` | Kiểm tra link mới và response của yêu cầu cũ đang chạy. |
| Sửa `app/App.tsx` | Giữ khai báo route, dùng các page/guard đã tách, giữ URL hiện tại. |
| Thêm `app/App.test.tsx` | Khóa redirect anonymous/CUSTOMER và truy cập ADMIN sau refactor. |
| Thêm `app/router/PrivateRoute.tsx` | Tách kiểm tra phiên/role khỏi App; truyền user cho nội dung route. |
| Thêm `app/pages/NotFoundPage.tsx` | Chuyển trang 404 hiện có ra file riêng. |
| Thêm `features/catalog/pages/CatalogIntroPage.tsx` | Chuyển intro empty state hiện có ra khỏi router; chưa thêm catalog thật. |
| Thêm `features/information/content/policies.ts` | Chuyển nội dung thông tin/chính sách hiện có ra file dữ liệu. |
| Thêm `features/information/pages/PolicyPage.tsx` | Render trang thông tin bằng nội dung đã tách. |
| Sửa `layouts/StoreLayout.tsx` | Format JSX, giữ layout/header/footer/skip-link. |
| Sửa `main.tsx` | Format cây provider hiện có, không thêm lớp provider hoặc state mới. |

Ngoài source: sửa `apps/frontend/e2e/auth.spec.ts` để kiểm tra keyboard skip-link trên verify/reset (bổ sung theo finding review); sửa `docs/architecture.md`, `docs/plan.md`, `docs/m3-implementation-plan.md` và `progress.md` để ghi cấu trúc, kết quả và kế hoạch M3 tiếp theo. Không sửa backend/schema/migration/dependency, không cài thêm thư viện, không commit/push.

#### Data flow, key và chạy thử

- Request: feature API → request lấy CSRF trước mutation → gửi JSON hoặc multipart với key do caller cung cấp → proxy `/api` → backend hiện có. Browser tự tạo multipart boundary; client không tự lặp mutation khi mất response.
- Link: mở `#token=...` → hook giữ token trong memory và xóa riêng fragment khỏi URL → nội dung form/kết quả theo token; mở token mới làm mới nội dung. Skip-link `#main-content` giữ nguyên token và vẫn điều hướng nội trang.
- Router: App chọn route → PrivateRoute đọc current-user query → redirect hoặc render page với user; backend tiếp tục kiểm tra quyền ở API.
- Key: **multipart boundary** là thông tin browser tạo để phân tách file; **Idempotency-Key** do caller giữ để backend nhận biết một thao tác; **component key theo token** tách vòng đời form/kết quả; **PrivateRoute** chỉ kiểm soát điều hướng FE, không thay guard backend.
- Tại root, dùng hai terminal `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend`, mở `http://127.0.0.1:5173`. Thử đăng nhập/tài khoản, các trang thông tin và 404; thử verify/reset local như [M2](docs/local-trial-m2.md), bấm skip-link bằng bàn phím vẫn tiếp tục được. Mở link token khác trên cùng trang phải có form/trạng thái mới. Multipart/idempotency được kiểm tra bằng unit; UI upload/kho M3 chưa có để thử thủ công.
- Kế hoạch tiếp tục đã cập nhật ở [m3-implementation-plan.md](docs/m3-implementation-plan.md): **M3.1 chỉ xem và thêm danh mục admin**, file/API/data flow/test được nêu riêng, chưa được triển khai. Dừng để người dùng thử M3.0.3 và duyệt M3.1; nhánh vẫn `feat/catalog-inventory`.

### M3.0.2 — refactor cấu trúc backend — 27/10/2026 (agent đã kiểm tra; chờ người dùng thử)

- Người dùng duyệt gói sửa cấu trúc một lần sau rà soát toàn backend. Điều chỉnh đã chốt: giữ `UsersController` và `AdminAccessController` chung `users.controller.ts`, vẫn là hai class/guard riêng; không tạo `auth/admin-access.controller.ts`.
- Phạm vi: tách controller khỏi module Categories/Products/Uploads/Inventory; chuyển Prisma trong Categories/Users sang service; DTO theo feature + DTO/transform dùng chung; decorator Auth riêng; chuyển Inventory ra `modules/inventory` và đồng bộ import. Giữ API, validation, quyền, transaction và nghiệp vụ.
- Trình tự: (1) bổ sung kiểm tra HTTP cho category update/version/visibility/allowlist và quyền CUSTOMER, chạy baseline; (2) refactor file/import; (3) typecheck/build/unit/integration/E2E auth; (4) review độc lập, cập nhật kiến trúc + danh sách file/cách thử, dừng chờ người dùng.
- Không sửa schema/migration/dependency hoặc frontend M3 đang dang dở; không tự commit/push. Các thay đổi M3/Prisma Studio/AGENTS có sẵn được giữ nguyên, không tính là do lần refactor này.
- Kết quả: baseline 28/28 integration đạt trước refactor và 28/28 đạt sau refactor; backend typecheck/build đạt; 6/6 unit backend và 2/2 E2E auth đạt. E2E kiểm tra tài khoản thật qua proxy và mobile. Review độc lập đối chiếu snapshot 35 file source trước refactor không phát hiện P1/P2 do refactor; nhắc vị trí Inventory trong architecture đã được cập nhật.
- Typecheck toàn repo: backend đạt; frontend còn TS2353 ở `apps/frontend/src/shared/api/client.test.ts:11` vì `idempotencyKey` chưa thuộc `RequestOptions`, tồn tại từ phần M3 trước. Không khẳng định toàn repo hoặc E2E catalog đã đạt.
- Có cảnh báo deprecation `pg` trong test concurrent đã xuất hiện ở baseline; chưa đổi dependency/luồng nghiệp vụ để xử lý ngoài phạm vi cấu trúc.

#### File thực tế của M3.0.2

Đường dẫn source trong bảng tính từ `apps/backend/src/`. Đối chiếu snapshot riêng của phần này, không dựa vào toàn bộ working tree M3 chưa commit.

| Thao tác/file | Ý nghĩa |
|---|---|
| Sửa `app.module.ts` | Đăng ký Inventory ở đường dẫn mới độc lập với Auth. |
| Thêm `common/dto/request.dto.ts` | Giữ PageQuery/VersionDto dùng chung với đúng giới hạn/default cũ. |
| Thêm `common/dto/transforms.ts` | Giữ trim/NFC/lowercase dùng chung cho DTO M3. |
| Thêm `modules/auth/decorators/roles.decorator.ts` | Khai báo Roles và metadata key, không thực hiện kiểm tra quyền. |
| Thêm `modules/auth/decorators/current-user.decorator.ts` | Lấy user đã được SessionGuard xác thực. |
| Sửa `modules/auth/roles.guard.ts` | Chỉ kiểm tra role; dùng metadata key từ decorator. |
| Sửa `modules/categories/categories.module.ts` | Chỉ đăng ký controller/service/dependency. |
| Thêm `modules/categories/categories.controller.ts` | GET danh mục active công khai. |
| Thêm `modules/categories/admin-categories.controller.ts` | Nhận các API admin danh mục, giữ guard và DTO. |
| Thêm `modules/categories/categories.service.ts` | Giữ truy vấn, transaction/version và xử lý lỗi danh mục. |
| Thêm `modules/categories/dto/category.dto.ts` | Chuyển DTO danh mục khỏi Products, giữ validation. |
| Chuyển `modules/auth/inventory/inventory.module.ts` → `modules/inventory/inventory.module.ts` | Đăng ký Inventory độc lập, tách controller ra file riêng. |
| Chuyển `modules/auth/inventory/inventory.service.ts` → `modules/inventory/inventory.service.ts` | Giữ nguyên xử lý kho, khóa/idempotency/ledger; sửa import. |
| Thêm `modules/inventory/inventory.controller.ts` | Nhận API quản trị kho với guard và Idempotency-Key cũ. |
| Thêm `modules/inventory/dto/inventory.dto.ts` | Chuyển query/adjustment DTO về Inventory. |
| Sửa `modules/products/products.module.ts` | Chỉ đăng ký controller/service/dependency. |
| Thêm `modules/products/products.controller.ts` | Nhận API catalog công khai. |
| Thêm `modules/products/admin-products.controller.ts` | Nhận API quản trị sản phẩm/ảnh/trạng thái, giữ quyền. |
| Thêm `modules/products/dto/product.dto.ts` | Giữ DTO của riêng Products, dùng PageQuery/VersionDto chung. |
| Sửa `modules/products/products.service.ts` | Chỉ đổi import DTO; giữ nghiệp vụ. |
| Bỏ `modules/products/catalog.dto.ts` | DTO đã chuyển về đúng feature/common, không giữ bản trùng. |
| Sửa `modules/uploads/uploads.module.ts` | Chỉ đăng ký controller/service/dependency. |
| Thêm `modules/uploads/admin-uploads.controller.ts` | Giữ API upload/đọc ảnh admin, giới hạn và guards. |
| Thêm `modules/uploads/media.controller.ts` | Giữ API đọc ảnh đã được phép công khai. |
| Sửa `modules/users/users.controller.ts` | Giữ UsersController/AdminAccessController chung file; cập nhật hồ sơ qua service. |
| Sửa `modules/users/users.module.ts` | Đăng ký thêm UsersService. |
| Thêm `modules/users/users.service.ts` | Thực hiện cập nhật hồ sơ với select/safeUser cũ. |
| Thêm `modules/users/dto/profile.dto.ts` | Chuyển ProfileDto khỏi controller, giữ validation/Swagger. |

Ngoài source: sửa `apps/backend/test/catalog.integration.spec.ts` (3 ca hồi quy category/quyền và cleanup đúng các tài khoản test tạo); sửa `docs/architecture.md` (cấu trúc hiện tại/ngoại lệ Users); sửa `progress.md` (kế hoạch, bằng chứng và hướng dẫn bàn giao). Không có khác biệt phạm vi ngoài điều chỉnh giữ hai controller Users/AdminAccess cùng file đã được người dùng chốt.

#### Data flow và key quan trọng

Khi gọi `POST /api/v1/admin/categories`, global CSRF/rate guard và SessionGuard/RolesGuard kiểm tra request; CategoryDto chuẩn hóa/validate input, AdminCategoriesController gọi CategoriesService để ghi PostgreSQL qua Prisma rồi trả category như trước. Khi sửa tên từ trang tài khoản M2, `PATCH /me` đi qua UsersController → UsersService với user ID từ phiên, cập nhật DB và trả safeUser để UI cập nhật.

- Module: đăng ký các thành phần với Nest DI, không chứa hành động HTTP.
- Controller: nhận route/input và gọi service; guard tiếp tục bảo vệ từng class/endpoint.
- Service: chứa xử lý dữ liệu/nghiệp vụ; extraction không đổi transaction hoặc quyền.
- DTO: kiểm tra input runtime; metadata class vẫn được import bằng giá trị ở controller để validation hoạt động.
- Decorator: ghi metadata/lấy user; RolesGuard thực hiện kiểm tra dựa trên metadata đó.

#### Chạy thử và điểm dừng

1. Tại root, chạy `./tools/npm.ps1 run typecheck --workspace=@clothing/backend` và `./tools/npm.ps1 run build --workspace=@clothing/backend`: mong đợi mã kết thúc 0.
2. Với Docker/PostgreSQL đang chạy, chạy `./tools/npm.ps1 run test:integration`: mong đợi 28 ca đạt, bao gồm CRUD/version/ẩn danh mục và các quyền admin. Test dùng DB `_test`, không phải dữ liệu local của người dùng.
3. Chạy backend `./tools/npm.ps1 run dev:backend`; mở `http://127.0.0.1:3000/api/v1/health/ready` (status ok) và `/api/v1/categories` (JSON array chỉ danh mục active, có thể rỗng). Thử `/api/v1/admin/categories` trong cửa sổ ẩn danh chưa đăng nhập: mong đợi 401.
4. Mở frontend bằng lệnh M2 trong README, thử đăng nhập/sửa tên/đăng xuất như cũ; không có màn hình quản lý M3 mới trong đợt refactor này.
5. Đọc `modules/categories/categories.module.ts` → controller → service → DTO để thấy trách nhiệm đã tách; hai class Users/AdminAccess vẫn cùng file như người dùng yêu cầu.

Điểm dừng: **chờ người dùng thử/xác nhận M3.0.2**, chưa triển khai tính năng/UI M3 kế tiếp, chưa commit/push. Nhánh vẫn là `feat/catalog-inventory`.

### Review cách tổ chức frontend — 27/10/2026

- Theo yêu cầu người dùng, chỉ review frontend và ghi kết quả; không sửa source, cài dependency, chạy migration hoặc tiếp tục M3. Đối chiếu quy tắc feature/page/component/API và quản lý state trong `docs/architecture.md` với code hiện tại.
- Điểm tốt: auth chia pages/components/hooks/api; HTTP/CSRF/lỗi tập trung tại `shared/api/client.ts`; current user dùng TanStack Query; form giữ pending/error tại component; có layouts/theme riêng. Không cần thêm các tầng kiến trúc mới hoặc tách mọi component nhỏ.
- Vấn đề ưu tiên: test M3 `shared/api/client.test.ts:11` dùng `idempotencyKey` chưa có trong `RequestOptions`; API client hiện stringify mọi body nên FormData bị gửi thành `{}` và không có header Idempotency-Key. Đây là phần M3 còn dang dở, không khẳng định luồng auth hiện tại bị lỗi bởi phát hiện này.
- Điểm bảo trì: `app/App.tsx` vừa khai báo routes/kiểm tra truy cập vừa chứa CatalogIntro và nội dung chính sách; `AdminPage.tsx` khai báo endpoint HTTP ngay trong page; `AccountPage.tsx` gọi cập nhật hồ sơ qua authApi. Nên tách có giới hạn theo trách nhiệm khi được duyệt, không đánh giá file ngắn là bắt buộc phải có hook riêng. Nhiều JSX/handler gộp một dòng làm khó lần theo code.
- Kiểm tra thực tế: `./tools/npm.ps1 run typecheck --workspace=@clothing/frontend` thất bại TS2353 tại `client.test.ts:11`; `./tools/npm.ps1 run test --workspace=@clothing/frontend`: 5/6 test đạt, 1 test multipart/idempotency thất bại (body `{}` thay vì FormData, thiếu header). Không chạy build vì typecheck đã chặn, không chạy integration/E2E trong lần review.
- Data flow hiện tại của auth: AuthPage/AuthForm → auth.api.ts → shared/api/client.ts (CSRF/cookie) → backend; kết quả quay về query cache và giao diện. Không thêm key code mới. Điểm dừng: báo review, chờ yêu cầu và duyệt kế hoạch riêng trước khi sửa từng phần.

### M3.0.1 — sửa import Prisma/Inventory — 26/10/2026

- Người dùng đã duyệt phương án đồng bộ import theo thư mục hiện tại. Trạng thái: **agent đã sửa và kiểm tra; chờ người dùng chạy thử**, không tiếp tục tính năng M3.
- Nguyên nhân xác nhận bằng typecheck thất bại: Prisma chuyển từ `src/prisma` vào `src/modules/prisma`, Inventory vào `src/modules/auth/inventory`, nhưng import tương đối còn trỏ đường dẫn cũ. Import PrismaClient trong chính PrismaService sai làm mất kiểu kế thừa, kéo theo lỗi `variant`, `$transaction`, `$connect`, `$disconnect`. Client đã generate có delegate `variant`.
- Sửa import trong app/module/service/CLI, backend integration tests và frontend E2E fixtures; giữ nguyên vị trí thư mục và nghiệp vụ. Không sửa schema, generate lại client, cài dependency hoặc chạy migration trong phần này. Cập nhật vị trí module trong tài liệu kiến trúc.
- Kết quả: typecheck/build riêng backend đạt; 6/6 unit backend, 25/25 PostgreSQL integration và 2/2 E2E auth đạt. E2E gồm luồng tài khoản qua proxy và mobile. `git diff --check` đạt ở lần rà soát mã nguồn.
- Typecheck toàn repo: backend đạt, frontend vẫn thất bại ở `src/shared/api/client.test.ts:11` (TS2353: `idempotencyKey` chưa thuộc `RequestOptions`), là test M3 dang dở đã tồn tại trước bản sửa. Không sửa phần ngoài phạm vi đã duyệt; chưa chạy lại E2E catalog chưa có UI.
- Chạy thử tại root: `./tools/npm.ps1 run typecheck --workspace=@clothing/backend` cần kết thúc mã 0; sau đó `./tools/npm.ps1 run dev:backend` và kiểm tra `http://127.0.0.1:3000/api/v1/health/ready`. Nếu VS Code còn hiển thị lỗi cũ sau khi CLI đạt, dùng `TypeScript: Restart TS Server`.
- Key: import tương đối phụ thuộc vị trí file; PrismaClient là API được generate từ schema; PrismaService kế thừa client và được Nest cung cấp qua DI. Không thêm thuộc tính `variant` thủ công hay tắt kiểm tra TypeScript.
- Chưa commit/push; nhánh vẫn là `feat/catalog-inventory`. Dừng chờ người dùng xác nhận phần sửa lỗi này.

### Bổ sung danh sách file và data flow khi duyệt/bàn giao — 26/10/2026

- Theo yêu cầu người dùng, cập nhật `AGENTS.md`: kế hoạch trước mỗi phần phải có đường dẫn từng file dự kiến thay đổi, nội dung/lý do ngắn và data flow trong 1–3 câu; vẫn dừng chờ duyệt trước code.
- Mẫu bàn giao bổ sung file thực tế đã thay đổi và data flow sau triển khai. Giải thích bám thao tác, dữ liệu và tên file/hàm chính khi cần; không lặp định nghĩa module/service/controller đã biết. Giữ phần giải thích 3–5 key và điểm dừng chạy thử.
- Chỉ sửa `AGENTS.md` và ghi tiến độ tại đây; giữ nguyên các thay đổi ứng dụng đang có. Không có key code mới, không triển khai M3 hoặc chạy migration.
- Kiểm tra: đọc diff và `git diff --check -- AGENTS.md progress.md`; không chạy ứng dụng vì chỉ đổi tài liệu. Điểm dừng: bàn giao cập nhật quy tắc; chưa bắt đầu phần code tiếp theo.

### Tiện ích Prisma Studio — tự nạp cấu hình local — 26/10/2026

- Người dùng đã duyệt kế hoạch sửa cấu hình để chạy `npx prisma studio` trong `apps/backend`. Chỉ sửa `prisma.config.ts`, thêm test hồi quy và hướng dẫn README; giữ nguyên các thay đổi M3 đang có, không cài dependency, không chạy migration, không sửa `.env`.
- Dùng `node:process.loadEnvFile` đọc `.env` cạnh file cấu hình khi `DATABASE_URL` chưa được cung cấp và `NODE_ENV` không phải `test`. Giữ ưu tiên cấu hình môi trường/test/CI; vẫn cho phép generate offline khi không có `.env`.
- Test hồi quy: ca tự nạp `.env` thất bại trước sửa (3/4 ca còn lại đạt); sau sửa và bổ sung ca biến môi trường, 5/5 ca Prisma đạt. Chạy Node local `--test tools/*.test.mjs`: 8/8 đạt, gồm 3 ca bảo vệ môi trường E2E có sẵn; đây không phải chạy E2E trên trình duyệt.
- Prisma CLI `validate` chạy không có `--env-file` nạp được cấu hình và schema hợp lệ. Typecheck riêng `prisma.config.ts` đạt. `./tools/npm.ps1 run typecheck` và `./tools/npm.ps1 run build`: backend đạt; toàn repo thất bại ở test frontend M3 có sẵn `src/shared/api/client.test.ts:11` (TS2353: `idempotencyKey` chưa thuộc `RequestOptions`). Không sửa phần ngoài phạm vi đã duyệt.
- Kiểm tra kết nối PostgreSQL chỉ đọc (`SELECT 1`) bị môi trường thực thi chặn với `EACCES`; chưa xác minh giao diện Studio đọc bảng thực tế. Không chạy integration/E2E database trong lần sửa cấu hình này. Điểm dừng: chờ người dùng mở Studio và xác nhận danh sách bảng, chưa tiếp tục M3 hoặc commit/push.


### M3 đang thực hiện — 26/10/2026

- Theo yêu cầu tiếp tục M3, đã tạo nhánh `feat/catalog-inventory` từ `main`. Chưa commit/push các thay đổi M3.
- Kế hoạch chi tiết: [m3-implementation-plan.md](docs/m3-implementation-plan.md). Giữ local; ảnh lưu ngoài Git, chưa tích hợp Cloudinary.
- Đã viết test trước API: chín ca catalog mới quan sát thất bại ở endpoint chưa có. Sau triển khai schema/migration và API categories/products/inventory/uploads, bộ tích hợp 25/25 đạt (16 auth cũ + 9 M3). Migration mới đã áp dụng cho local/test, không reset dữ liệu.
- Đã generate Prisma; typecheck đạt ở thời điểm kiểm tra backend mới và trước khi thêm test frontend mới. Không dùng kết quả này để khẳng định toàn bộ working tree hiện tại đạt.
- Npm audit phát hiện dependency cũ: cập nhật concurrently 9.2.5 và override multer 2.5.0 cùng major; sau `npm update multer`, audit báo 0 vulnerabilities tại lần kiểm tra. Không nâng major Nest/Prisma.
- E2E M3 mới đã chạy và thất bại đúng ở link Danh mục chưa có trên trang admin. Test multipart/idempotency mới của API client cũng đang thất bại trước implementation. Frontend M3 chưa được triển khai, chưa có bản M3 hoàn chỉnh cho người dùng thử.
- Phát hiện `AGENTS.md`/phần tiến độ vừa được cập nhật bởi luồng khác với yêu cầu gửi bảng trong chat rồi dừng chờ duyệt. Giữ nguyên chỉnh sửa đó; dừng triển khai thêm để gửi bảng phạm vi M3 cho người dùng duyệt. Chỉ tiếp tục sau phản hồi duyệt; không bắt đầu M4.

### Chia nhỏ kế hoạch và dừng sau từng phần — 26/10/2026

- Theo yêu cầu người dùng, bổ sung `AGENTS.md` và `docs/plan.md`: chia mốc thành `Mx.1`, `Mx.2`...; nếu còn lớn tiếp tục tách nhỏ. Mỗi phần có thay đổi quan sát được, phạm vi, cách thử/kết quả mong đợi và phụ thuộc.
- Gửi kế hoạch riêng của từng phần, chờ duyệt trước code; sau kiểm tra/bàn giao phải dừng để người dùng thử và phản hồi. Duyệt lộ trình không cho phép tự triển khai tất cả phần liên tiếp. Phân biệt kiểm tra kỹ thuật với người dùng xác nhận.
- Chỉ cập nhật tài liệu quy trình, không sửa code hoặc kế hoạch M3 đang có trong working tree, không chạy migration và không kết luận lại trạng thái hoàn thiện của M3. Chưa lập/duyệt danh sách phần M3 cụ thể trong lần này.
- Kiểm tra: đọc diff và chạy `git diff --check -- AGENTS.md docs/plan.md progress.md`; không chạy ứng dụng vì không thay code. Không có key code mới. Điểm dừng: bàn giao quy tắc chia nhỏ, chưa bắt đầu phần code tiếp theo.

### Làm rõ bước duyệt kế hoạch — 26/10/2026

- Theo phản hồi người dùng, sửa `AGENTS.md`: gửi bảng kế hoạch trong chat trước mỗi nhiệm vụ/phần code, dừng lượt chờ duyệt rồi mới triển khai; không coi gửi kế hoạch hoặc im lặng là được duyệt. Kế hoạch cụ thể đã được duyệt không cần hỏi lại từng bước.
- Phân biệt bảng kế hoạch trước triển khai với `docs/local-trial-m2.md` là hướng dẫn chạy thử sau bàn giao. Không triển khai chức năng trong lần cập nhật quy tắc này; không có key code mới.
- Kiểm tra Git phát hiện sẵn các thay đổi backend/schema/dependency và file mới liên quan M3, cùng `docs/m3-implementation-plan.md`; giữ nguyên toàn bộ. Chưa kiểm chứng nguồn gốc, mức độ hoàn thiện hoặc kết quả kiểm tra của các thay đổi đó; dòng trạng thái M3 phía trên chưa phản ánh đầy đủ working tree. Không dùng cập nhật này để kết luận M3 đã hoàn thành.
- Kiểm tra phần này bằng đọc nội dung và `git diff --check -- AGENTS.md progress.md`; không chạy ứng dụng vì chỉ thay tài liệu. Điểm dừng: bàn giao quy tắc, chờ duyệt kế hoạch cụ thể trước nhiệm vụ code tiếp theo.

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

### Kiểm tra file chuẩn bị đưa lên Git — 26/10/2026

- Kiểm tra index, working tree và ignore bằng `git status --short`, `git diff --stat`, `git diff --cached --stat`, `git ls-files -ci --exclude-standard` và `git check-ignore -v --no-index`. Dùng `git -c safe.directory=<thư mục dự án> ...` cho từng lệnh do khác owner Windows; không thay cấu hình Git toàn máy.
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
