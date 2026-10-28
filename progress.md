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
| M3 Catalog/ảnh/kho | M3.2 admin sửa/bật/tắt danh mục đã kiểm tra local và review, chờ người dùng chạy thử; chưa triển khai UI sản phẩm M3.3 |
| M4 Bán hàng | Chưa thực hiện |
| M5 Sau bán hàng | Chưa thực hiện |
| M6 Deploy/restore | Chưa thực hiện |
| M7 Nghiệm thu | Chưa thực hiện |

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
