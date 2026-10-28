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
| M3 Catalog/ảnh/kho | M3.8 (Người A) đã có xuất bản/ẩn sản phẩm, sau M3.4.2 biến thể, M3.5 gắn ảnh, M3.6 sắp xếp ảnh; M3.7.1 (Người B) đã có xem/tìm tồn kho; kết quả ở các mục riêng bên dưới, chờ người dùng thử. Chưa có điều chỉnh tồn/lịch sử kho (M3.7.2/M3.7.3) và catalog khách (M3.9 trở đi) |
| M4 Bán hàng | Chưa thực hiện |
| M5 Sau bán hàng | Chưa thực hiện |
| M6 Deploy/restore | Chưa thực hiện |
| M7 Nghiệm thu | Chưa thực hiện |

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
=======
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
