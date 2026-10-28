# M3 local — kế hoạch tiếp tục theo từng phần

> Cập nhật 28/10/2026. Lộ trình dưới đây cần duyệt từng phần, không phải cho phép code liên tiếp. Mỗi phần: gửi kế hoạch → chờ duyệt → triển khai/kiểm tra → bàn giao → chờ người dùng thử. Không chuyển sang M4.

**Mục tiêu:** admin đăng hàng và ảnh thật, chỉnh kho có lịch sử; khách lọc và xem hàng đã xuất bản.
**Kiến trúc:** giữ Nest modules Categories/Products/Inventory/Uploads và React feature catalog/admin; PostgreSQL là nguồn dữ liệu chính.
**Stack:** stack hiện hành trong package.json; bổ sung sharp để kiểm tra/chuẩn hóa ảnh raster.
**Đặc tả:** [architecture.md](architecture.md), [business-rules.md](business-rules.md), mốc M3 trong [plan.md](plan.md).

## Điểm xuất phát hiện tại

- M3.0.1: sửa import Prisma/Inventory sau thay đổi thư mục, agent đã kiểm tra.
- M3.0.2: refactor backend, giữ UsersController/AdminAccessController chung file theo lựa chọn người dùng, agent đã kiểm tra.
- M3.0.3: sửa API client FE multipart/idempotency, vòng đời token và tách router/page; typecheck/build toàn repo đạt, 32 test công cụ/unit/UI và 2 E2E auth đạt. Đang chờ người dùng thử/xác nhận; không coi là đã nghiệm thu.
- Backend Categories/Products/Inventory/Uploads và migration local/test đã có; chưa kết luận tất cả ngoại lệ M3 được nghiệm thu. M3.1 thêm UI admin xem/tạo danh mục, M3.1.1 sửa UI theo phiên, M3.2 thêm sửa/bật/tắt với version; agent đã kiểm tra local và chờ người dùng thử M3.2. Chưa có UI sản phẩm M3.3; `/shop` vẫn là intro empty state.
- `e2e/catalog.spec.ts` là ca chấp nhận cho toàn luồng M3 đã viết trước, còn thiếu UI để đạt. Các ca auth/categories đã chạy đạt được ghi riêng trong progress; không che/skip ca catalog để gọi toàn M3 hoàn thành.

## Bảng chia phần đề xuất

| Mã | Thay đổi người dùng thấy được | Phạm vi chính | Cách thử / kết quả mong đợi | Phụ thuộc |
|---|---|---|---|---|
| M3.1 | Admin xem và thêm danh mục | List + form tạo; GET/POST admin categories | Tạo tên/slug/trạng thái, thấy trong list sau refresh; slug trùng có lỗi rõ | Người dùng thử M3.0.3, có tài khoản ADMIN local |
| M3.2 | Admin sửa/bật/tắt danh mục | PATCH category, expectedVersion | Sửa ở hai tab: dữ liệu cũ bị từ chối; tắt thì public API không trả danh mục | M3.1 đã được thử và yêu cầu tiếp tục |
| M3.3 | Admin tạo sản phẩm nháp với một biến thể | Tên/slug/danh mục/miêu tả + SKU/size/màu/giá | Tạo nháp, refresh vẫn còn; khách chưa xem được; SKU trùng bị từ chối | M3.1, kế hoạch riêng được duyệt |
| M3.4 | Admin sửa nháp và quản lý biến thể | Product PATCH + version, thêm/tắt variant | Sửa giá/size/màu, giữ ID và lịch sử; conflict/giá/size sai có lỗi | M3.3 |
| M3.5 | Admin tải và gắn một ảnh thật | Multipart upload → gắn asset vào product | Chọn JPEG/PNG/WebP hợp lệ, xem thumbnail sau refresh; file giả/quá lớn bị từ chối | M3.3; API client M3.0.3 |
| M3.6 | Admin sắp xếp/gỡ ảnh đã gắn | Chỉnh danh sách asset IDs + version | Đổi ảnh đầu và lưu; ảnh gắn được hiển thị đúng thứ tự; không làm mất ảnh do conflict | M3.5 |
| M3.7 | Admin điều chỉnh kho có bằng chứng | Form delta/reason, key/version, lịch sử của SKU | Nhập/xuất thử, thấy before/after/actor; gửi lặp không cộng hai lần; kho âm bị chặn | M3.3; API client M3.0.3 |
| M3.8 | Admin xuất bản/ẩn sản phẩm | State buttons + version/điều kiện publish | Thiếu ảnh/variant bị chặn; publish/hide đổi trạng thái và public API đúng | M3.4, M3.5 |
| M3.9 | Khách xem/lọc danh sách hàng công khai | GET categories/products, filter/sort/page trên URL | Chỉ hàng published, bộ lọc còn sau refresh; loading/empty/error rõ | M3.8 |
| M3.10 | Khách xem chi tiết và chọn biến thể | Detail, gallery, chọn size/màu, giá/available | Deep link/refresh được; chọn variant đúng giá/tồn; hàng ẩn trả not found | M3.9 |
| M3.11 | Có bộ dữ liệu demo chạy tường minh | Seed CLI có kiểm soát, không ghi đè dữ liệu người dùng | Chạy lại không tạo trùng/nhập kho lặp; không tự seed khi startup | Các model/luồng M3 đã thử; duyệt cách tạo dữ liệu trước khi code |
| M3.12 | Chạy thử toàn luồng và chốt M3 local | E2E catalog, quyền, mobile, restart/ảnh, checklist | Admin đăng hàng → ảnh → kho → publish → khách xem; báo ca đạt/chưa đạt và giới hạn | Các phần trước đã được người dùng thử |

Các dòng có nhiều thao tác kiểm tra vẫn tập trung một luồng dữ liệu. Nếu lúc lập kế hoạch chi tiết một phần còn quá lớn, tách thành M3.x.1/M3.x.2 trước khi triển khai. Bảng phụ thuộc không thay thế bước duyệt; điểm dừng hiện tại là M3.2, không tự bắt đầu M3.3.

## M3.1 — admin xem và thêm danh mục

**Trạng thái: người dùng đã duyệt, đã triển khai; kết quả kiểm tra và review ghi tại [progress.md](../progress.md).** Phạm vi M3.1 là xem/tạo. M3.2 bên dưới bổ sung sửa/bật/tắt; chưa có xóa danh mục hoặc tạo sản phẩm trên UI. Hướng dẫn thử: [local-trial-m3.md](local-trial-m3.md).

| Nội dung | Kế hoạch |
|---|---|
| Mục tiêu | Từ trang admin mở Danh mục, thấy danh sách và thêm một danh mục thật được lưu PostgreSQL |
| Thay đổi | Route `/admin/categories`, link từ dashboard, list + form tên/slug/active; loading/empty/error/retry và lỗi tạo trùng |
| API | GET `/api/v1/admin/categories`; POST cùng đường dẫn với `{name,slug,active}`; backend DTO/guards/unique slug hiện có giữ vai trò kiểm tra chính |
| File dự kiến | Danh sách được duyệt bên dưới; file thực tế và khác biệt ghi trong progress M3.1 |
| Data flow | Admin nhập form → categoriesApi gọi request qua proxy, lấy CSRF trước POST → SessionGuard/RolesGuard + CategoryDto → CategoriesService ghi PostgreSQL → trả category, FE cập nhật/refetch query list và báo kết quả |
| Kiểm tra | Unit/UI list/form/error và chặn submit lặp; backend integration hiện có; E2E riêng tạo danh mục/refresh/quyền với DB `_test`; typecheck/build |
| Điểm dừng | Người dùng tạo/xem danh mục thật tại local rồi phản hồi; chưa làm M3.2 |

### File đã được duyệt của riêng M3.1

| File | Thao tác / mục đích |
|---|---|
| `apps/frontend/src/features/admin/categories/api/categories.api.ts` | Thêm Category/CategoryInput và API list/create có kiểu rõ |
| `apps/frontend/src/features/admin/categories/components/CategoryCreateForm.tsx` | Thêm form tên/slug/active, field error và chặn gửi lặp |
| `apps/frontend/src/features/admin/categories/pages/CategoriesPage.tsx` | Thêm kết nối Query cache/list/create form; xử lý loading/empty/error/retry/success |
| `apps/frontend/src/features/admin/categories/pages/CategoriesPage.test.tsx` | Thêm test thao tác tạo/list và lỗi trùng/mạng, không dùng UI giả thay API thật trong E2E |
| `apps/frontend/src/app/App.tsx` | Sửa đăng ký route mới dưới PrivateRoute admin |
| `apps/frontend/src/features/admin/AdminPage.tsx` | Sửa thêm link Danh mục; giữ API admin/access và trang vào quản trị hiện tại |
| `apps/frontend/e2e/categories.spec.ts` | Thêm E2E nhỏ riêng cho M3.1; chỉ fixture và cleanup danh mục/user test tạo |
| `docs/local-trial-m3.md` | Thêm hướng dẫn thử đúng phần M3.1, admin tạo qua CLI hiện có nếu chưa có tài khoản; không mật khẩu mặc định |
| `progress.md` | Sửa ghi phần được duyệt, file thực tế, lệnh/kết quả và điểm dừng |
| `docs/m3-implementation-plan.md` | Sửa trạng thái M3.1 theo bằng chứng thực tế, không tự đánh dấu người dùng đã thử |

**Kết quả thử mong đợi:** admin tạo “Áo thun”, slug `ao-thun`, active=true; list có bản ghi mới sau refresh. Tạo lại cùng slug có thông báo conflict, input được giữ để chỉnh. CUSTOMER/anonymous không gọi được API quản trị. `/shop` chưa có danh mục hàng thật trong phần này.

## M3.2 — admin sửa/bật/tắt danh mục

**Trạng thái:** người dùng đã duyệt kế hoạch trong chat ngày 28/10/2026; triển khai và kiểm tra local đạt, review độc lập không finding cần sửa; **chờ người dùng chạy thử, chưa nghiệm thu**. Không triển khai M3.3.

| Nội dung | Phạm vi được duyệt / kết quả |
|---|---|
| Mục tiêu | Admin sửa tên/slug/trạng thái danh mục đã có và giữ dữ liệu sau refresh |
| UI | Nút Sửa → dialog điền sẵn → Lưu thay đổi/Hủy; Tải dữ liệu mới để đồng bộ tường minh |
| API | PATCH `/api/v1/admin/categories/:id` với `{name,slug,active,expectedVersion}` qua client CSRF hiện có; GET list khi reload |
| Dữ liệu cũ | Snapshot/version giữ từ lúc mở; refetch nền không rebase bản nhập. 409 giữ input, không retry ghi tự động |
| Dữ liệu mới | Chỉ nút Tải dữ liệu mới thay form/snapshot sau GET thành công; lỗi tải giữ bản nhập |
| Data flow | Form sửa → API typed PATCH → SessionGuard/RolesGuard + DTO → CategoriesService kiểm tra id/version, ghi DB và tăng version trong transaction → FE cập nhật cache và tải lại list |
| Kiểm tra | 12 UI categories, toàn repo 58 tools/unit/UI, 28 integration, 6 E2E auth/categories gồm hai tab thật và public API bật/tắt; typecheck/build đạt |
| Điểm dừng | Chờ người dùng thử theo [local-trial-m3.md](local-trial-m3.md); M3.3 cần kế hoạch riêng được duyệt |

File đã triển khai đúng danh sách duyệt: API categories, đổi `components/CategoryCreateForm.tsx` thành `components/CategoryForm.tsx` dùng chung, thêm `components/CategoryEditDialog.tsx`, sửa page/test categories, E2E categories; cập nhật hướng dẫn, architecture, README, plan và progress. Đường dẫn đầy đủ và mục đích từng file ở mục M3.2 trong [progress](../progress.md). Không thay backend, migration, dependency hoặc dữ liệu local; không commit/push.

Key: `expectedVersion` so khớp bản đang sửa với DB; `snapshot` không bị query cache thay tự động; `revision` remount form sau reload tường minh; `busy` chặn thao tác trùng/đóng trong lúc chờ. Backend hiện dùng cùng 409 cho stale version và duplicate slug, UI thông báo cả hai khả năng thay vì đoán sai nguyên nhân.

## Thiết kế kỹ thuật tham khảo

Các mục Task 1–3 phía dưới là bản thiết kế M3 ban đầu, dùng tra cứu contract/test; không phải lịch chạy nối tiếp và checkbox không đại diện tiến độ. Bảng chia phần ở trên và [progress](../progress.md) là điểm theo dõi hiện tại.

## Ràng buộc và quyết định local

- Người dùng yêu cầu tiếp tục M3 và tạo nhánh mới. Nhánh `feat/catalog-inventory` từ `main`; không tự push.
- Tiếp tục local theo lựa chọn trước đó: ảnh lưu ở `.local/uploads` ngoài Git; test ở `.local/test-uploads`. Chưa tích hợp Cloudinary, chưa tuyên bố deploy/ảnh bền vững trên free host.
- Ảnh JPEG/PNG/WebP tối đa 5 MB, tối đa 16 triệu pixel, mỗi chiều 64–8000; chuẩn hóa WebP bỏ metadata, giới hạn 1600×2000. Không nhận SVG/ảnh động. Tối đa 8 ảnh/sản phẩm, upload 10 lần/phút/admin.
- SKU chuẩn hóa uppercase, size thuộc XS/S/M/L/XL/XXL/3XL/FREESIZE; màu chuẩn hóa lowercase. Giá nguyên 1..100.000.000 VND. Kho demo 0..1.000.000/biến thể; thay đổi kho cần lý do.
- Không hard-delete sản phẩm/biến thể; tắt biến thể bằng `active`. Danh mục inactive làm hàng không xuất hiện công khai. Product dùng DRAFT/PUBLISHED/HIDDEN; xuất bản cần danh mục active, ảnh và biến thể active hợp lệ.
- Sửa dữ liệu cần expectedVersion; điều chỉnh kho cần Idempotency-Key, ghi actor/reason/before/after cùng transaction, chống trừ dưới reserved và chống gửi lặp.
- Không giỏ hàng/đơn/tiền M4. UI và tài liệu không hứa tính năng chưa có.

## Trọng tâm kiểm tra

1. Khách/anonymous không gọi được admin API; draft/hidden không lộ qua detail/media/list.
2. SKU trùng, size sai, giá ngoài giới hạn và ID biến thể của sản phẩm khác bị từ chối.
3. Hai cập nhật cùng version: chỉ một thắng; kho âm/dưới reserved và replay khác nội dung bị từ chối.
4. File giả MIME/SVG/quá lớn/ảnh động bị từ chối; chỉ gắn asset hợp lệ của admin hoặc ảnh đang thuộc sản phẩm.
5. Tải lại deep link, filter/page URL, lỗi mạng, mobile và upload lỗi có thông báo và cách thử lại.

## Task 1 — database và API catalog/kho

Files: schema + migration mới; modules/categories, products, inventory; `test/catalog.integration.spec.ts`; app.module.
Interfaces: DTO allowlist; public GET categories/products/products/:slug; admin GET/POST/PATCH categories/products, POST publish/hide; inventory GET list/movements, POST adjustments.

- [ ] Viết test HTTP với PostgreSQL, chạy trên API hiện chưa có để quan sát 404 thất bại.
- [ ] Tạo schema/migration Category/Product/Variant/Inventory/InventoryMovement/UploadAsset/ProductImage; FK, unique, CHECK tiền/kho, index theo query.
- [ ] Implement DTO, service/controller/module, mapping lỗi conflict; transaction cập nhật sản phẩm và kho; pagination max48/sort allowlist.
- [ ] Generate Prisma, apply migration cho local/test, chạy test tích hợp đến khi đạt.

## Task 2 — upload ảnh và gắn ảnh sản phẩm

Files: modules/uploads; product images endpoints; frontend API client multipart/header support; test catalog tích hợp.
Interfaces: POST /admin/uploads/images multipart file → assetId/previewUrl; PUT /admin/products/:id/images {assetIds,expectedVersion}; GET /media/:id chỉ ảnh public, GET /admin/uploads/images/:id cho admin.

- [ ] Viết test file giả, file hợp lệ, quyền/ảnh riêng tư và publish trước/sau gắn ảnh.
- [ ] Kiểm tra metadata và decode bằng sharp, write file ngoài transaction, lưu asset temp; gắn ảnh trong transaction có kiểm tra owner/version/reference.
- [ ] Dọn temp trên 24h có điều kiện không còn reference, chỉ xóa file do ứng dụng quản lý; không xóa ảnh đã attach.
- [ ] Kiểm tra API, giới hạn và ảnh sau restart từ thư mục local.

## Task 3 — giao diện và bàn giao

Files: features/catalog, features/admin/catalog; app routes/admin navigation; E2E catalog; docs local-trial-m3, README, progress/plan.
Interfaces: API typed, Query cache; query URL cho tìm kiếm/category/sort/page; form local cho editor và điều chỉnh kho.

- [ ] Viết E2E admin tạo category/product/variant, upload, nhập kho, publish; khách lọc/xem chọn size, ẩn hàng không còn public.
- [ ] Implement grid ảnh 3:4, detail/gallery/variant selector, admin forms/editor/image manager/inventory ledger. Loading/empty/error/retry, label/keyboard, responsive.
- [ ] Chạy typecheck/build/unit/integration/E2E; review độc lập phần M3, sửa lỗi quan trọng, ghi giới hạn thật.
- [ ] Cập nhật tiến độ và hướng dẫn chạy thử, giải thích SKU/variant/available/version/idempotency. Dừng chờ phản hồi, không tự chuyển M4.
