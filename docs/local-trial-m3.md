# Chạy thử M3 theo từng phần

## M3.1 — admin xem và thêm danh mục

Phần M3.1 ban đầu có danh sách và tạo danh mục thật trong PostgreSQL. M3.2 bổ sung sửa/bật/tắt; M3.3 bổ sung tạo sản phẩm nháp với một biến thể; M3.4.1 bổ sung sửa thông tin nháp; M3.4.2 bổ sung sửa/thêm/tắt biến thể của nháp; M3.5 bổ sung tải và gắn ảnh thật; M3.6 bổ sung sắp xếp/gỡ ảnh; M3.8 bổ sung xuất bản/ẩn; M3.7.1 (Người B) bổ sung xem/tìm tồn kho theo hướng dẫn phía dưới; M3.7.2 (Người B) bổ sung điều chỉnh tồn với idempotency key; M3.7.3 (Người B) bổ sung lịch sử tồn của từng SKU; M3.9 (Người B) thay trang giới thiệu `/shop` bằng catalog khách tìm/lọc/phân trang theo hướng dẫn phía dưới; M3.10 (Người B) bổ sung trang chi tiết `/products/:slug` và chọn biến thể theo hướng dẫn phía dưới; M3.11 (Người B) bổ sung lệnh `npm run seed:demo` nhập bộ dữ liệu demo. M3.12 ghép ca tổng `catalog.spec.ts` vào bộ E2E và có runbook toàn luồng phía dưới. Trạng thái kỹ thuật và nghiệm thu xem [progress.md](../progress.md); lộ trình tiếp theo xem [m3-implementation-plan.md](m3-implementation-plan.md).

### Chuẩn bị

- Hoàn tất thiết lập local trong [README](../README.md#chạy-local); giữ Docker Desktop và PostgreSQL hoạt động. M3.1 không thêm migration hoặc dependency.
- Cần tài khoản ADMIN. Nếu chưa có, tự đặt `ADMIN_EMAIL` và `ADMIN_PASSWORD` trong `apps/backend/.env` bị Git bỏ qua, rồi chạy `./tools/npm.ps1 run admin:create` từ root. Mật khẩu 12–128 ký tự, không gửi vào chat hoặc đưa vào Git. Xóa `ADMIN_PASSWORD` khỏi tệp sau khi tạo.
- CLI chỉ tạo tài khoản mới, không nâng quyền tài khoản CUSTOMER đã tồn tại. Không có mật khẩu admin mặc định.

Mở hai terminal PowerShell tại root:

```powershell
# Terminal 1
.\tools\npm.ps1 run dev:backend
```

```powershell
# Terminal 2
.\tools\npm.ps1 run dev:frontend
```

Mở **http://127.0.0.1:5173/login**, đăng nhập ADMIN → trang quản trị → **Danh mục**. Có thể mở trực tiếp **http://127.0.0.1:5173/admin/categories** sau khi đăng nhập.

### Thao tác và kết quả mong đợi

| Thao tác | Kết quả |
|---|---|
| Mở Danh mục | Hiện dữ liệu thật, hoặc thông báo chưa có danh mục nếu DB trống |
| Nhập tên `Áo thun`, đường dẫn `ao-thun`, giữ tick Bật danh mục khi tạo → Thêm danh mục | Báo đã lưu, form được làm trống và danh sách có Áo thun / ao-thun / Đang bật |
| Tải lại trang | Danh mục vừa tạo vẫn còn |
| Tạo tên khác nhưng giữ đường dẫn `ao-thun` | Báo đường dẫn đã dùng, dữ liệu form được giữ để sửa; không tạo bản ghi thứ hai |
| Sửa đường dẫn thành `ao-khoac`, bỏ tick rồi tạo | Lưu được danh mục mới và hiển thị Đang tắt |
| Bấm gửi liên tiếp lúc đang lưu | Nút và các trường bị khóa, không gửi hai yêu cầu song song |
| Mở bằng trình duyệt riêng tư chưa đăng nhập | Chuyển tới trang đăng nhập |
| Đăng nhập CUSTOMER và mở URL quản lý danh mục | Chuyển về tài khoản; API quản trị vẫn kiểm tra quyền ADMIN |
| Màn hình điện thoại khoảng 390 px | Form và danh sách xếp dọc, không tràn ngang; label và focus bàn phím rõ |

Nếu `ao-thun` đã có, dùng một đường dẫn khác, rồi dùng lại đúng đường dẫn đó để thử lỗi trùng. Dữ liệu bạn tạo sẽ được giữ trong DB local. Tên dài 2–80 ký tự; đường dẫn tối đa 120 ký tự, dùng chữ thường không dấu, số và dấu `-` ở giữa các nhóm, ví dụ `ao-thun-nam`.

Nếu tải danh sách lỗi, trang hiện thông báo và nút **Tải lại danh mục**. Nếu tạo lỗi mạng, trang giữ form; hãy tải lại danh sách để kiểm tra trước khi gửi lại vì phản hồi lỗi mạng có thể xảy ra sau khi server đã lưu. Slug duy nhất giúp chặn việc tạo lại cùng đường dẫn.

### Lần theo code

`AdminPage.tsx` mở route → `PrivateRoute` kiểm tra phiên/role cho UI → `CategoriesPage.tsx` đọc danh sách bằng Query, nhận dữ liệu từ `CategoryForm.tsx` (tên cũ CategoryCreateForm trước M3.2) → `categories.api.ts` gọi GET/POST `/api/v1/admin/categories` qua HTTP client/CSRF → backend `AdminCategoriesController` kiểm tra session/role và DTO → `CategoriesService` đọc/ghi bảng `categories` bằng Prisma → FE tải lại danh sách và báo thành công.

- `slug`: đường dẫn duy nhất của danh mục; không phải tên hiển thị.
- `active`: trạng thái bật/tắt tại lúc tạo; M3.1 chưa có sửa trạng thái danh mục cũ.
- `admin-categories`: query key để tải lại đúng danh sách sau khi tạo.
- `busy`: khóa đồng bộ trong form để chặn gửi lặp trước khi nút disabled được vẽ.
- `version`: API trả về để dùng khi sửa có kiểm soát xung đột ở M3.2; M3.1 chưa gửi trường này.

### Kiểm tra tự động riêng phần này

```powershell
.\tools\npm.ps1 run test --workspace=@clothing/frontend -- src/features/admin/categories/pages/CategoriesPage.test.tsx
.\tools\npm.ps1 run test:e2e -- categories.spec.ts
```

E2E chỉ ghi vào PostgreSQL `_test`, tạo tài khoản/danh mục riêng và dọn đúng dữ liệu đó. Cổng kiểm thử là API 3001, FE 5174. Toàn bộ `catalog.spec.ts` vẫn cần UI các phần M3 sau; không coi riêng M3.1 là hoàn thành toàn mốc.

## M3.2 — sửa/bật/tắt danh mục

Giữ hai terminal backend/frontend từ phần chuẩn bị ở trên, mở **http://127.0.0.1:5173/admin/categories** bằng ADMIN. Nếu chưa có danh mục, tạo một danh mục thử trước. M3.2 không cần dependency hoặc migration mới.

| Thao tác | Kết quả mong đợi |
|---|---|
| Bấm Sửa ở danh mục | Mở hộp thoại có đúng tên/đường dẫn/trạng thái đang lưu |
| Đổi tên/đường dẫn, bỏ tick Bật danh mục → Lưu thay đổi | Báo cập nhật thành công, đóng form, danh sách có giá trị mới và Đang tắt; refresh vẫn còn |
| Sửa lại, tick Bật danh mục rồi lưu | Danh sách thành Đang bật |
| Thử đường dẫn của danh mục khác | Báo xung đột, giữ input để chỉnh; không ghi đè danh mục còn lại |
| Chỉnh vài trường rồi Hủy hoặc Escape | Đóng hộp thoại, không lưu thay đổi; form tạo ở trang nền được giữ |
| Gửi liên tiếp lúc đang lưu | Chỉ một yêu cầu; khóa input, Lưu, Hủy, Tải dữ liệu mới và đóng bằng Escape/backdrop |

### Thử xung đột hai tab

1. Mở `/admin/categories` ở hai tab, bấm Sửa cùng một danh mục ở **cả hai tab trước khi lưu**.
2. Tab A đổi tên rồi lưu thành công.
3. Tab B nhập tên khác và lưu: bị từ chối do version cũ, giữ input. Dữ liệu Tab A vẫn là bản đang lưu trong DB; không tự ghi đè dù danh sách nền có refetch.
4. Tab B bấm **Tải dữ liệu mới**: form được thay bằng bản vừa lưu ở Tab A. Nút này chủ động bỏ phần chưa lưu trong form, có lời nhắc ngay trong hộp thoại.
5. Tab B chỉnh rồi lưu tiếp: lần này dùng version mới nên thành công; refresh hai tab thấy kết quả cuối.

API hiện trả chung `CONFLICT`/409 cho version cũ và slug trùng nên thông báo sửa nêu cả hai khả năng. Không coi mọi 409 là lỗi slug. Bạn có thể sửa slug khi biết bị trùng, hoặc tải dữ liệu mới khi cần đồng bộ. Lỗi mạng khi lưu/tải lại giữ form; nếu mất phản hồi sau khi server có thể đã lưu, tải dữ liệu mới để kiểm tra trước khi gửi lại.

Muốn kiểm tra trạng thái công khai khi chưa có UI public catalog: mở **http://127.0.0.1:5173/api/v1/categories**. Danh mục tắt không có trong kết quả; bật lại thì có. `/shop` chưa hiển thị danh mục/sản phẩm thật.

### Data flow / key M3.2

Chọn Sửa → `CategoryEditDialog` giữ snapshot của danh mục và `version` tại lúc mở → `CategoryForm` gửi dữ liệu sửa qua `categoriesApi.update(id,{name,slug,active,expectedVersion})` → backend kiểm tra ADMIN/CSRF/DTO và version trong transaction → cập nhật DB, tăng version → FE cập nhật cache và đọc lại danh sách. Tải dữ liệu mới gọi GET list và chỉ thay snapshot khi đọc thành công.

- `expectedVersion`: phiên bản bạn đang sửa; server chỉ chấp nhận khi bằng phiên bản hiện lưu.
- `snapshot`: giữ bản gốc của lần mở form, không tự thay theo refetch nền.
- `revision`: remount form sau khi bạn chủ động tải dữ liệu mới, kể cả version không đổi; chỉ lúc này mới bỏ draft.
- `busy`: ref khóa đồng bộ để ngăn gửi lặp, reload và đóng khi thao tác đang chạy.

Chạy test riêng: `./tools/npm.ps1 run test --workspace=@clothing/frontend -- src/features/admin/categories/pages/CategoriesPage.test.tsx` và `./tools/npm.ps1 run test:e2e -- categories.spec.ts auth.spec.ts` (chỉ PostgreSQL `_test`, fixture riêng).

## M3.3 — tạo sản phẩm nháp với một biến thể

Giữ backend/frontend local hoạt động theo phần chuẩn bị, đăng nhập ADMIN và có ít nhất một danh mục. Không cần dependency hoặc migration mới.

1. Mở **http://127.0.0.1:5173/admin** → **Sản phẩm** → **Thêm sản phẩm**, hoặc vào **http://127.0.0.1:5173/admin/products/new**.
2. Nhập tên `Áo cotton`, đường dẫn `ao-cotton`, chọn danh mục; mô tả không bắt buộc.
3. Biến thể đầu tiên: SKU `COTTON-M-DEN`, size `M`, màu `Đen`, giá `250000` VND.
4. Bấm **Lưu sản phẩm** → về danh sách, báo tạo nháp thành công. Thấy tên/danh mục/slug, nhãn **Nháp**, SKU, size/màu, giá và **Khả dụng: 0**.
5. Refresh: bản vừa tạo vẫn còn. Danh sách có phân trang 24 sản phẩm, số trang ở URL `?page=2` để mở lại/chia sẻ; nếu URL trang sai, bấm **Về trang đầu**.

Nếu SKU/slug trên đã tồn tại, dùng mã/đường dẫn khác. SKU được lưu chữ hoa, màu được chuẩn hóa chữ thường; không xem thay đổi đó là mất dữ liệu. Danh mục tắt được ghi `(Đang tắt)` trong lựa chọn, vẫn dùng để lưu nháp theo API hiện tại; xuất bản sau này yêu cầu danh mục bật.

### Các tình huống cần thử

| Thao tác | Kết quả mong đợi |
|---|---|
| Chưa có danh mục | Có thông báo và link Quản lý danh mục; không hiện form lưu sản phẩm không hợp lệ |
| Tạo mới nhưng giữ SKU cũ, dùng slug mới | Báo trùng, giữ input; đổi SKU rồi thử lại |
| Dùng SKU mới nhưng giữ slug cũ | Báo trùng, giữ input; đổi slug rồi lưu được |
| Giá 0, số lẻ hoặc lớn hơn 100.000.000 | Không lưu; giá yêu cầu số nguyên 1..100.000.000 VND |
| Bấm Lưu liên tiếp khi đang xử lý | Khóa input/nút và chỉ gửi một POST đang chờ; không tự retry tạo |
| Lỗi mạng | Báo lỗi, giữ input. Kiểm tra danh sách trước khi gửi lại nếu server có thể đã lưu mà phản hồi bị mất |
| Chuyển tab/quay lại và tải lại danh mục ở nền gặp lỗi | Cảnh báo/tải lại hiện riêng, dữ liệu sản phẩm đang nhập vẫn giữ khi cache danh mục còn dữ liệu |
| CUSTOMER/khách vào URL quản trị | Chuyển về tài khoản/đăng nhập; gọi admin API vẫn bị 403/401 |
| Xem API public `/api/v1/products/<slug-vừa-tạo>` | Không tìm thấy vì đang DRAFT; `/shop` vẫn chưa có danh sách hàng thật |
| Mobile 390px và bàn phím | Label/focus rõ, form/list không tràn ngang |

Tên 2–120 ký tự; slug tối đa 120 ký tự theo dạng `ao-cotton`; mô tả tối đa 5.000 ký tự. SKU tối đa 64 ký tự, chữ/số/`_`/`-` và bắt đầu bằng chữ/số. Size gồm XS/S/M/L/XL/XXL/3XL/FREESIZE; màu tối đa 40 ký tự. Backend vẫn kiểm tra tất cả dữ liệu gửi lên. Lỗi validation biến thể lồng nhau hiện có thể trả thông báo chung; form giữ input để chỉnh, chưa sửa cách serialize lỗi backend trong M3.3.

### Luồng dữ liệu / key M3.3

`ProductCreatePage` gọi GET admin categories → `ProductCreateForm` thu dữ liệu → `productsApi.create` POST `/api/v1/admin/products` qua cookie/CSRF → backend guards/DTO → `ProductsService.create` ghi Product/Variant/Inventory bằng nested create nguyên tử → trả sản phẩm → FE invalidate query `admin-products` và về danh sách, GET `/api/v1/admin/products?page=1&pageSize=24` đọc lại dữ liệu server.

- `SKU`: mã duy nhất của biến thể, không phải ID sản phẩm.
- `Variant`: tổ hợp size/màu kèm giá; M3.3 tạo đúng một biến thể đang bật.
- `DRAFT`: nháp do backend thiết lập, chưa công khai; không phải hàng đã xuất bản.
- `admin-products`: query key của danh sách, kèm số trang đọc từ URL.
- `available`: số khả dụng backend trả về; biến thể mới có onHand/reserved bằng 0 nên available=0.

Test riêng: `./tools/npm.ps1 run test --workspace=@clothing/frontend -- src/features/admin/products/pages/ProductCreatePage.test.tsx src/features/admin/products/pages/ProductsPage.test.tsx`. Test các phần đã làm: `./tools/npm.ps1 run test:e2e:implemented` (auth + categories + products). Ca catalog toàn M3 giữ nguyên, chưa coi là đạt khi UI ảnh/kho/public chưa có.

**Điểm dừng hiện tại: M3.8 (Người A) và M3.7.3 (Người B), chờ người dùng chạy thử.** Catalog khách (M3.9) cần kế hoạch riêng được duyệt.

## M3.4.1 — admin sửa thông tin sản phẩm nháp

Giữ backend/frontend local hoạt động theo phần chuẩn bị, đăng nhập ADMIN, có ít nhất một danh mục và một sản phẩm nháp tạo ở M3.3 (hoặc tạo mới). Không cần dependency hoặc migration mới.

1. Mở **http://127.0.0.1:5173/admin/products** → hàng sản phẩm nháp (nhãn **Nháp**) có nút **Sửa** → trang `/admin/products/<id>`.
2. Form điền sẵn tên/đường dẫn/danh mục/mô tả đang lưu. Từ M3.4.2 biến thể là các ô nhập được (xem mục M3.4.2).
3. Đổi tên và mô tả → **Lưu thay đổi** → về danh sách, báo "Đã cập nhật sản phẩm nháp …" và thấy tên mới; refresh vẫn còn.
4. Bấm **Tải dữ liệu mới** (có lời nhắc ngay trên trang): thay toàn bộ nội dung đang nhập bằng bản mới nhất trên máy chủ; tải lỗi thì giữ nguyên phần đang nhập.

### Các tình huống cần thử

| Thao tác | Kết quả mong đợi |
|---|---|
| Sửa tên/mô tả, lưu, refresh | Thay đổi còn nguyên; biến thể/tồn kho giữ nguyên (Khả dụng vẫn 0) |
| Đổi đường dẫn trùng sản phẩm khác hoặc để tab cũ lưu sau | Báo "Sản phẩm đã thay đổi, hoặc đường dẫn, SKU hoặc tổ hợp size/màu bị trùng…", giữ input; không đoán riêng lỗi slug |
| Sửa ở hai tab cùng sản phẩm | Tab lưu sau bằng version cũ bị từ chối, dữ liệu tab trước không bị ghi đè; Tải dữ liệu mới mới đồng bộ bản mới |
| Bấm Lưu liên tiếp khi đang lưu | Nút và các trường khóa, chỉ một PATCH đang chờ |
| Bấm Tải dữ liệu mới khi mạng chậm rồi thử Lưu | Các trường và Lưu bị khóa đến khi tải xong; không gửi PATCH chồng với explicit reload |
| Đang lưu rồi thử Tải dữ liệu mới | Tải dữ liệu mới bị khóa; nếu lưu lỗi thì form/input/thông báo lỗi vẫn còn và thao tác được mở lại |
| SKU hiện có dài 64 ký tự liền, mở trang sửa ở 390px | Từ M3.4.2 SKU nằm trong ô nhập (cuộn trong ô), không kéo rộng trang hoặc che nút |
| Chỉnh dang dở rồi sang tab khác quay lại | Refetch nền không xóa phần đang nhập và không đổi version đang giữ |
| Mở Sửa sản phẩm không phải Nháp | Không hiển thị form sửa; thông báo chỉ nháp được sửa ở phần này |
| CUSTOMER/khách vào URL `/admin/products/<id>` | Chuyển về tài khoản/đăng nhập; PATCH API vẫn bị 403/401 |

Tên 2–120 ký tự; slug theo dạng `ao-cotton`; mô tả tối đa 5.000 ký tự. Backend tiếp tục kiểm tra DTO, version và quyền; FE chỉ điều hướng. SKU duy nhất toàn hệ thống và size+màu duy nhất trong cùng sản phẩm không thay đổi — phần này không gửi lại dữ liệu biến thể khác bản đang lưu.

### Luồng dữ liệu / key M3.4.1

Nút Sửa → `ProductEditPage` GET chi tiết + danh mục → `ProductEditForm` điền sẵn từ snapshot → PATCH `/api/v1/admin/products/<id>` với `{name,slug,description,categoryId,variants[{id,sku,size,color,price,active}],expectedVersion}` qua cookie/CSRF → backend kiểm tra version/DTO trong transaction, tăng version → FE invalidate `admin-products` và về danh sách đọc lại dữ liệu server.

- `snapshot`: bản gốc chốt lúc mở form, quyết định biến thể gửi lại và `expectedVersion`; refetch nền không đổi.
- `revision`: đếm remount form; chỉ tăng khi bấm Tải dữ liệu mới thành công — thao tác duy nhất chủ động bỏ draft.
- `Tải dữ liệu mới`: refetch tường minh; thành công thay snapshot/form, lỗi giữ draft.
- `operationRef`/`operation`: khóa đồng bộ và trạng thái UI ở cấp page, ngăn lưu/tải mới chạy chồng nhau dù form có remount; lỗi cũng nhả khóa.
- `admin-products`: invalidate sau lưu để list và chi tiết đọc lại dữ liệu server.
- 409: API dùng chung cho version cũ và slug trùng; thông báo nêu cả hai khả năng.

Test riêng: `./tools/npm.ps1 run test --workspace=@clothing/frontend -- src/features/admin/products/pages/ProductEditPage.test.tsx src/features/admin/products/pages/ProductsPage.test.tsx`. Bộ đã triển khai: `./tools/npm.ps1 run test:e2e:implemented` (auth + categories + products + inventory list/search, 14 ca trên `_test`).

## M3.16 — cấu hình để backend chạy được trên VPS

Phần này không có thay đổi giao diện; nó làm backend sẵn sàng chạy sau reverse proxy HTTPS trên VPS. Danh sách biến môi trường production ở [README § Cấu hình production trên VPS](../README.md#cấu-hình-production-trên-vps-m316). Deploy thật (proxy, service, backup) thuộc M6 khi có VPS và domain.

| Thao tác | Kết quả mong đợi |
|---|---|
| Chạy local như cũ (`dev:backend`, `dev:frontend`) | Không đổi gì: API nghe `127.0.0.1`, ảnh vẫn ở `.local/uploads` dù chạy lệnh từ thư mục nào |
| Đăng ảnh sản phẩm ở admin, mở ảnh ở trang khách, xem DevTools → Network | Ảnh công khai (`/api/v1/media/...`) có `Cache-Control: public, max-age=86400`; ảnh xem trong admin và các API khác vẫn `no-store` |
| Thử khởi động với `NODE_ENV=production` mà thiếu `TRUST_PROXY` hoặc `UPLOADS_DIR` | Backend dừng và in "Invalid configuration: TRUST_PROXY is required in production" (hoặc UPLOADS_DIR), không in giá trị bí mật |

Kiểm tra tự động: `environment.spec.ts` (HOST, số hop proxy, thư mục ảnh, ràng buộc production), integration `production-config.integration.spec.ts` (upload chạy ở production và ghi vào `UPLOADS_DIR`; cookie `__Host-` Secure khi proxy chuyển HTTPS), `catalog.integration.spec.ts` (header cache ảnh).

## M3.15 — cửa hàng mang thông tin thật, bỏ dấu vết demo

Cửa hàng hiển thị tên **RMG Labels**, thông tin người bán (cá nhân kinh doanh, TP. Hồ Chí Minh, Instagram @rmglabels) và các chính sách thật đã được chủ shop duyệt. SĐT/Zalo và email chưa có nên chưa hiển thị; bổ sung trong `apps/frontend/src/shared/shop.ts` trước khi mở bán (M4.1 sẽ chuyển sang Cài đặt shop).

| Thao tác | Kết quả mong đợi |
|---|---|
| Mở `/shop` | Đầu trang "RMG LABELS", không còn banner "BẢN DEMO · DỮ LIỆU GIẢ"; header chỉ có Bộ sưu tập, Bảng size (admin đã đăng nhập thấy thêm Quản trị) |
| Kéo xuống chân trang | "Cá nhân kinh doanh · TP. Hồ Chí Minh", link Instagram @rmglabels mở tab mới; link Liên hệ, Giao hàng, Đổi & trả, Thanh toán, Bảo mật |
| Mở `/shipping`, `/returns-policy`, `/payment`, `/privacy`, `/contact` | Nội dung thật: phí 30.000đ, TP.HCM 1–2 ngày/tỉnh 2–5 ngày, kiểm hàng COD; đổi trả 7 ngày, còn tag, khách trả phí đổi theo nhu cầu, shop chịu phí hàng lỗi; COD/VietQR, hạn 2 giờ; dữ liệu thu và quyền của khách; thông tin người bán |
| Tab trình duyệt | Tiêu đề dạng "Giao hàng \| RMG Labels" |
| Mở `/login` | Không còn "Chưa có tài khoản? Đăng ký"; admin vẫn đăng nhập ở đây |
| Chạy `seed:demo` với `NODE_ENV=production` | Báo "seed:demo chỉ dùng trên máy local…, không chạy trên production." và dừng, không ghi gì |

Kiểm tra tự động: `StoreLayout.test.tsx`, `PolicyPage.test.tsx`, `App.test.tsx` (trang đăng nhập không quảng cáo đăng ký), integration `seed-demo.integration.spec.ts` (chặn production), E2E `auth.spec.ts`.

## M3.14 — Người A: sửa sản phẩm đang bán hoặc đã ẩn

Trước đây chỉ sản phẩm nháp mới sửa được. Từ M3.14, trang sửa mở form thông tin, biến thể và ảnh cho mọi trạng thái. Backend vẫn kiểm tra như cũ: sản phẩm đang bán phải còn danh mục bật, ít nhất một biến thể bật và ít nhất một ảnh.

| Thao tác | Kết quả mong đợi |
|---|---|
| Admin → Sản phẩm → bấm một sản phẩm **đang bán** | Tiêu đề "Sửa sản phẩm đang bán"; cảnh báo thay đổi hiển thị ngay khi lưu và đổi đường dẫn làm hỏng link đã chia sẻ; có form và phần ảnh |
| Đổi tên hoặc giá → **Lưu thay đổi** | Về danh sách với "Đã cập nhật sản phẩm “…”."; mở `/products/<slug>` thấy ngay tên/giá mới |
| Tắt biến thể bật duy nhất rồi lưu | Báo đúng lý do "Sản phẩm đang xuất bản cần danh mục và biến thể đang bật."; dữ liệu nhập giữ nguyên |
| Gỡ hết ảnh rồi lưu ảnh | Báo "Cần giữ ít nhất một ảnh cho sản phẩm đang xuất bản." |
| Bấm **Ẩn sản phẩm** rồi sửa tiếp | Tiêu đề đổi thành "Sửa sản phẩm đã ẩn", ghi chú khách chưa thấy thay đổi cho tới khi xuất bản lại; lưu vẫn được |
| Sản phẩm nháp | Như trước: "Sửa sản phẩm nháp", nút Xuất bản khóa khi còn thay đổi chưa lưu |

Kiểm tra tự động: test UI trang sửa (đang bán, đã ẩn, lý do 409), integration `catalog.integration.spec.ts` (sửa khi đang bán + mã lỗi `PUBLISH_RULE`), E2E `products.spec.ts` (sửa hàng đang bán, khách thấy ngay).

## M3.9 — Người B: catalog khách tìm và lọc hàng công khai

Phần này KHÔNG cần đăng nhập. Mở **http://127.0.0.1:5173/shop** với hai terminal dev như mục M3.1. Muốn thấy hàng, bấm hoặc chạy trước phần M3.8 để có sản phẩm Đã xuất bản.

### Các tình huống cần thử

| Thao tác | Kết quả |
|---|---|
| Mở `/shop` | Lưới chỉ gồm hàng Đã xuất bản (danh mục bật, có ít nhất một biến thể bật); sản phẩm ẩn/nháp/không danh mục bật không xuất hiện. Card: ảnh hoặc khối 'Chưa có ảnh', tên danh mục, tên sản phẩm, 'Giá từ …' |
| Gõ tên hoặc một phần SKU vào 'Tìm theo tên hoặc SKU' · Enter | Danh sách lọc; URL thành `/shop?q=...`; nút 'Xóa tìm kiếm' xuất hiện |
| Chọn 'Danh mục' | Lọc theo danh mục; URL thêm `categoryId=...`; quay về trang 1 |
| Đổi 'Thứ tự sắp xếp' | 'Mới nhất' / 'Giá thấp đến cao' / 'Giá cao đến thấp'; URL thêm `sort=...`; quay về trang 1 |
| Dùng phân trang khi số hàng > 12 | Sang trang, URL thêm `page=...`; trong lúc tải, các sản phẩm trang cũ vẫn hiển thị kèm 'Đang cập nhật bộ sưu tập…' và thanh phân trang tạm khóa |
| F5 hoặc Back/Diếp | Bộ lọc và trang còn nguyên, danh sách đúng trạng thái |
| Dán `/shop?page=abc`, `/shop?sort=ten-gi-do` hoặc `categoryId` sai định dạng | Cảnh báo tương ứng ('Số trang không hợp lệ.'/'Bộ lọc không hợp lệ.'), không gọi API; nút 'Về trang đầu'/'Xóa lọc' đưa về trạng thái hợp lệ |
| Mở `/shop?categoryId=<id danh mục vừa tắt ở admin>` (hoặc bấm breadcrumb danh mục cũ) | Cảnh báo 'Danh mục này không còn hiển thị.'; ô Danh mục ghi 'Danh mục không còn hiển thị' (không giả vờ 'Tất cả danh mục'); bấm 'Xóa lọc' về `/shop` |
| Tìm từ khóa không khớp → 'Xóa lọc' | 'Chưa có sản phẩm phù hợp bộ lọc hiện tại.'; bấm 'Xóa lọc' về trạng thái mặc định |
| Tắt backend (Ctrl+C ở Terminal 1), mở lại `/shop` | Alert 'Không thể kết nối…' và nút 'Tải lại bộ sưu tập'; bật backend lại, bấm nút → danh sách hiện |
| Bấm tên sản phẩm | Tới `/products/<slug>` — chi tiết sản phẩm (M3.10) |
| Thu hẹp cửa sổ về ~390px | Không tràn ngang; bộ lọc và card xếp dọc |

### Luồng dữ liệu / key M3.9

URL là nguồn sự thật: `q`/`categoryId`/`sort`/`page` được đọc và ghi qua `setSearch` trong `CatalogPage`; sai guard (`filtersUsable`) thì cả query sản phẩm lẫn danh mục đều không gọi API. Danh sách lấy `GET /api/v1/products?...&pageSize=12` — backend lọc cứng PUBLISHED + danh mục bật + biến thể bật và sort trên server; danh mục cho ô lọc từ `GET /api/v1/categories`. Giá hiển thị `priceFrom` qua `Intl.NumberFormat('vi-VN', VND)`.

Kiểm tra tự động riêng phần này: 15 test UI + E2E `catalog-list.spec.ts` (4 ca; cả bộ implemented 9 spec 30/30) — chi tiết và giới hạn xem [progress.md](../progress.md).

## M3.10 — Người B: chi tiết sản phẩm công khai và chọn biến thể

Phần này KHÔNG cần đăng nhập. Giữ hai terminal dev như M3.1, mở **http://127.0.0.1:5173/shop** rồi bấm vào một sản phẩm Đã xuất bản. Muốn thấy ảnh thật, thumbnail và dòng tồn đúng con số, làm trước M3.5/M3.6 (ảnh), M3.7.2 (nhập kho) và M3.8 (xuất bản).

### Các tình huống cần thử

| Thao tác | Kết quả |
|---|---|
| Bấm tên sản phẩm từ `/shop` | Tới `/products/<slug>`; breadcrumb 'Bộ sưu tập › danh mục › tên sản phẩm'; tên hiện ở heading; mô tả hiện khi admin đã nhập |
| Xem khi chưa chọn biến thể | Chỉ hiện 'Giá từ <mức thấp nhất>'; chưa có dòng tồn |
| Chọn nút 'M · đen' | Giá đổi thành giá của biến thể; hiện 'Còn N sản phẩm' (N là còn bán server trả: tồn thực có − đang giữ) |
| Chọn nút khác, ví dụ 'S · trắng' | Giá và 'Còn N sản phẩm' đổi theo biến thể mới, không gọi API thêm |
| Chọn biến thể còn bán 0 | Thay 'Còn N sản phẩm' bằng 'Hết hàng' |
| Bấm thumbnail 'Xem ảnh 2' | Ảnh chính đổi theo; nút đang chọn được đánh dấu `aria-pressed`; hàng không ảnh → khối 'Chưa có ảnh' |
| F5 tại đường chi tiết | Vẫn đúng sản phẩm đó; 'Giá từ …' trở lại vì lựa chọn không giữ (deep link/refresh hoạt động, chỉ mất lựa chọn) |
| Gõ slug lạ, ví dụ `/products/ao-o-la` | Alert 'Không tìm thấy sản phẩm.'; có 'Quay lại bộ sưu tập'; KHÔNG có nút 'Tải lại sản phẩm' (thử lại với 404 sẽ không hết) |
| Tắt backend rồi mở một slug | Alert 'Không thể kết nối…' + nút 'Tải lại sản phẩm'; bật lại và bấm → trang hiện |
| Bấm link danh mục trong breadcrumb | Về `/shop` đã lọc sẵn `categoryId` của danh mục đó |
| Mở hàng chưa xuất bản theo slug | Alert 'Không tìm thấy sản phẩm.' — hàng ẩn/nháp như hàng không tồn tại với khách |
| Thu hẹp cửa sổ ~390px | Gallery trên, thông tin dưới; nút biến thể xếp dọc wrap, không tràn ngang |

### Luồng dữ liệu / key M3.10

Từ `/shop` bấm link → `/products/<slug>` → `useQuery([...catalogDetailKey, slug])` gọi `GET /api/v1/products/:slug` → backend lọc `visible` (PUBLISHED + danh mục bật + biến thể bật) và trả 404 'Không tìm thấy sản phẩm.' khi hàng ẩn/slug sai → trang hiển thị ảnh (`/api/v1/media/<assetId>`), mô tả và variants sắp theo SKU tăng dần; bấm nút biến thể chỉ đổi `variantId` trong state cục bộ, giá và dòng tồn cập nhật ngay.

- `catalogApi.detail(slug)` trong `features/catalog/api/catalog.api.ts`: gọi API chi tiết; slug đi qua `encodeURIComponent`.
- Phân loại lỗi theo `ApiError.status`: 404 → chỉ 'Quay lại bộ sưu tập'; lỗi khác → thêm 'Tải lại sản phẩm' (refetch).
- Nhãn nút là `size · màu` như server lưu (size viết hoa, màu viết thường) — chuẩn khớp kỳ vọng E2E tổng `catalog.spec.ts` ở M3.12.

Kiểm tra tự động riêng phần này: 10 test UI + E2E `catalog-detail.spec.ts` (3 ca; cả bộ implemented giờ 10 spec 33/33) — chi tiết và giới hạn xem [progress.md](../progress.md).

## M3.11 — Người B: bộ dữ liệu demo bằng lệnh seed

Một lệnh, chạy từ root: `.\tools\npm.ps1 run seed:demo`. Điều kiện: backend đã build (lệnh tự build) và DB local hoạt động; cần ít nhất một tài khoản ADMIN (làm chủ ảnh demo — thông tin trong [README](../README.md#bộ-dữ-liệu-demo-m311)). Lệnh không đổi code ứng dụng và không tự seed khi server start.

| Thao tác | Kết quả |
|---|---|
| Chạy `seed:demo` lần đầu | Dòng log 'Đã tạo danh mục…/Đã tạo sản phẩm…' theo từng mục; tổng kết 'Bộ dữ liệu demo đã sẵn sàng…' |
| Chạy `seed:demo` lần 2 | Chỉ dòng 'Danh mục … đã có sẵn.'/'Sản phẩm … đã có sẵn.' + 'Toàn bộ bộ dữ liệu demo đã có sẵn. Không tạo sản phẩm/danh mục hay nhập kho thêm.' |
| Mở `/shop` | Thấy 3 sản phẩm demo xuất bản (2 danh mục): một bản 2 ảnh, một bản 1 ảnh, 'Quần jean mỗi ngày' khối 'Chưa có ảnh'; giá 'Giá từ 250.000/320.000/500.000 ₫' tương ứng |
| Bấm 'Áo cotton hợp ngày' | Chi tiết có 2 nút 'S · đen'/'M · đen'; chọn S 'Còn 13 sản phẩm' giá 250.000; M 'Còn 8' giá 290.000; bấm thumbnail đổi ảnh chính |
| Bấm 'Áo cotton giới hạn demo' | Chọn 'M · trắng' → 'Còn 1 sản phẩm'; chọn 'L · hồng' → 'Hết hàng' (tồn thực có 0) |
| Bấm 'Quần jean mỗi ngày' | Chi tiết không ảnh ('Chưa có ảnh'); 'M · xanh' 'Còn 10 sản phẩm'; 'S · xanh' 'Còn 10 sản phẩm' |
| Lịch sử kho (M3.7.3) của biến thể demo | Mỗi biến thể có tồn có đúng một giao dịch '+N', `0 → N`, lý do 'Nhập kho demo', người thực hiện là admin chủ ảnh; biến thể hết hàng ('L · hồng') chưa có giao dịch |
| Kho admin (M3.7.1) | SKU `DEMO-*` xuất hiện; đang giữ luôn là 0 vì demo không có đơn |
| Mở `/products/demo-ao-an` | 'Không tìm thấy sản phẩm.' — sản phẩm demo ẩn |
| Admin Danh mục | Thấy 'Áo thun demo'/'Quần jean demo'; có thể sửa/ẩn như dữ liệu thường |
| Xóa dữ liệu demo | Dùng Prisma Studio theo slug `demo-*` (không có nút xóa sản phẩm trên admin UI); không ảnh hưởng dữ liệu khác |

Chạy lại lệnh không tạo trùng và không cộng kho: skip theo slug; tồn kho và dòng lịch sử 'Nhập kho demo' chỉ ghi cùng lúc tạo sản phẩm lần đầu. Nếu bạn đã có sản phẩm trùng slug `demo-*`, seed bỏ qua bản đó (không ghi đè). Nếu một sản phẩm demo tạo lỗi (ví dụ SKU `DEMO-*` đã bị dùng), lệnh dừng với lỗi và xóa lại ảnh vừa tạo cho sản phẩm đó, không để file mồ côi.

Kiểm tra tự động riêng phần này: 2 test integration spawn CLI trên `_test` — chạy hai lượt (số liệu bằng nhau, đang giữ 0, mỗi biến thể có tồn có một dòng lịch sử, ảnh webp tồn tại) và lượt lỗi giữa chừng không để lại ảnh/asset — đã vào `test:integration`; chi tiết xem [progress.md](../progress.md) § M3.11.

## M3.7.3 — Người B: lịch sử tồn kho của từng SKU

Giữ hai terminal backend/frontend như Chuẩn bị. Đăng nhập ADMIN tại **http://127.0.0.1:5173/login** → **Kho**, hoặc mở **http://127.0.0.1:5173/admin/inventory**. Backend đã có sẵn `GET /api/v1/admin/inventory/movements`; phần này chỉ thêm UI đọc.

| Thao tác | Kết quả mong đợi |
|---|---|
| Bấm **Lịch sử** trên một hàng SKU | Dialog "Lịch sử <SKU>" mở; tiêu đề phụ là tên sản phẩm · size · màu; báo "Tìm thấy N giao dịch." |
| SKU vừa điều chỉnh +5 ở M3.7.2 | Một hàng: thời gian giao dịch, `+5`, `12 → 17`, lý do đã nhập, người thực hiện là tên admin |
| SKU mới chưa từng giao dịch | "Chưa có giao dịch cho SKU này." |
| SKU có hơn 10 giao dịch | Phân trang trong dialog (10/trang, mới nhất trước); sang trang không đóng dialog; "Tìm thấy N giao dịch." giữ nguyên |
| Giao dịch xuất kho (delta âm) | Số âm màu đỏ, ví dụ `-3`; `từ → thành` giảm tương ứng |
| Bấm **Đóng**, điều chỉnh SKU đó rồi mở lại **Lịch sử** | Dialog tắt, URL không đổi; mở lại thấy "Đang tải lịch sử…" rồi có ngay giao dịch mới, không hiện thoáng số cũ |
| Sang trang 2 | Trang hiện tại vẫn hiển thị (thanh phân trang tạm khóa) cho đến khi trang 2 tải xong |
| Chặn mạng, mở lại lịch sử | Thông báo lỗi + nút "Tải lại lịch sử" — bấm lại tải được; nếu server trả lỗi riêng thì hiển thị đúng thông báo server |
| Mở lịch sử cho SKU khác | Nội dung đúng theo biến thể; không lẫn giao dịch SKU khác |

Dialog chỉ đọc: không có thao tác ghi, không cần X-CSRF/Idempotency-Key. Thời gian hiển thị theo giờ Việt Nam (`Asia/Ho_Chi_Minh`) dù máy admin lệch múi giờ.

**Data flow:** nút Lịch sử → dialog → TanStack Query `inventoryApi.movements` → `GET /api/v1/admin/inventory/movements?variantId=&page=&pageSize=10` → guard ADMIN backend, sort `createdAt` desc → dialog đổi page gọi lại; "Đóng" không đổi URL.

- Query key `['admin-inventory-movements', variantId, page]`: tách theo biến thể + trang; sang trang không refetch danh sách tồn.
- `gcTime: 0`: đóng dialog là bỏ cache lịch sử, nên mở lại luôn tải mới thay vì hiện thoáng số cũ.
- `placeholderData: keepPreviousData`: giữ trang hiện tại trên màn hình trong lúc tải trang kế tiếp.
- `<time datetime>`: ISO nguyên vẹn trong DOM, phần nhìn là giờ Việt Nam cố định.
- Dấu `+`/`-` và `before → after`: lấy nguyên từ số server, không tự tính lại.
- Read-only: dialog không gọi API ghi nào; quyền vẫn do backend kiểm.

Test riêng: `./tools/npm.ps1 run test --workspace=@clothing/frontend -- src/features/admin/inventory/components/MovementHistory.test.tsx`. E2E lịch sử nằm ở `apps/frontend/e2e/inventory-history.spec.ts`, đã thêm vào `./tools/npm.ps1 run test:e2e:implemented`.

**Dừng M3.7.3 để người dùng thử.** Catalog khách M3.9 chưa được triển khai; cần kế hoạch riêng được duyệt.

## M3.7.2 — Người B: điều chỉnh tồn kho với idempotency key

Giữ hai terminal backend/frontend như Chuẩn bị. Đăng nhập ADMIN tại **http://127.0.0.1:5173/login** → **Kho**, hoặc mở **http://127.0.0.1:5173/admin/inventory**. Backend không đổi so với trước: điều chỉnh dùng `POST /api/v1/admin/inventory/adjustments` đã có.

| Thao tác | Kết quả mong đợi |
|---|---|
| Bấm **Điều chỉnh** trên một hàng SKU | URL thành `?variantId=<id>`, trang chỉ còn hàng đó; dialog mở với Tồn thực có / Đang giữ, còn bán, snapshot chốt tại thời điểm mở |
| Nhập +5 → Gửi | Thông báo "Khả dụng: 15" (nếu tồn thực có 12, giữ 2); thẻ tồn trong danh sách đổi ngay thành còn bán 15 mà không cần tải lại trang |
| Refresh URL `variantId` | Vẫn đúng hàng đó; tồn thực trong DB tăng theo delta (kiểm tra qua DB hoặc nút **Lịch sử** của M3.7.3) |
| Xuất quá mức, ví dụ -11 khi tồn thực có 12 và đang giữ 2 | Thông báo 409 từ server (tồn sau điều chỉnh nhỏ hơn lượng đang giữ); tồn không đổi; dialog KHÔNG có nút Gửi lại, chỉ "Đóng và tải lại tồn" |
| Để dialog mở, tab khác mua/ghi vào cùng SKU (version đổi) rồi gửi trong tab đầu | 409 "phiên bản không khớp" hoặc tương tự; tồn không đổi; chỉ "Đóng và tải lại tồn" |
| Chặn mạng trong khi gửi (DevTools → offline) → bật mạng → bấm Gửi lại | Gửi lại dùng CÙNG key: tồn chỉ tăng đúng một lần; form bị khóa trong lúc chờ |
| Sau lỗi mạng hoặc 409, bấm **Esc** hay bấm ra ngoài dialog | Giống "Đóng và tải lại tồn": dialog đóng và danh sách tải lại số mới |
| Không bấm Gửi lại mà đóng rồi mở dialog lần khác | Key mới (không trả kết quả cũ); nếu trước đó thành công danh sách hiển thị số mới |
| Đóng và tải lại tồn sau 409 | Đánh dấu cache tồn kho cũ: số tồn mới được tải lại từ server |
| Mở URL `?variantId=<chuỗi sai>` | Về trang tồn thường (bỏ tham số sai) |
| Đăng nhập CUSTOMER mở `/admin/inventory` | Về `/account`; POST API điều chỉnh trực tiếp bằng fetch (devtools) bị 403 |

Kho thay đổi chỉ qua API thật; UI không tự cộng/trừ. Key idempotency nằm trong header `Idempotency-Key` do FE sinh mỗi lần mở dialog; server mới là nơi quyết định cộng một lần.

**Data flow:** nút Điều chỉnh → URL `variantId` → GET list một biến thể → dialog snapshot version → POST `/api/v1/admin/inventory/adjustments` (Idempotency-Key + CSRF) → transaction backend đối chiếu key, version và mức giữ → tạo `InventoryMovement`, cập nhật tồn → thành công sửa số trong cache, 409/chưa rõ kết quả thì khóa dialog.

- `Idempotency-Key`: một phiên mở dialog một key; "Gửi lại" gửi lại chính key đó nên server không cộng kép.
- Snapshot + `expectedVersion`: chốt khi mở dialog; version đổi sau khi mở là 409.
- 409: chỉ "Đóng và tải lại tồn", không "Gửi lại" (yêu cầu server đã chắc chắn từ chối).
- Lỗi mạng/5xx: máy trạng thái cho "Gửi lại" cùng key vì chưa chắc chắn đã ghi.
- `cache.setQueriesData`: tồn mới áp cho mọi query cache khớp `variantId` không cần đổi mạng; invalidate ở "Đóng và tải lại tồn".

Test riêng: `./tools/npm.ps1 run test --workspace=@clothing/frontend -- src/features/admin/inventory/components/AdjustmentDialog.test.tsx`. E2E điều chỉnh nằm ở file mới `apps/frontend/e2e/inventory-adjust.spec.ts`, đã thêm vào `./tools/npm.ps1 run test:e2e:implemented`.

**Dừng M3.7.2 để người dùng thử.** Lịch sử kho (M3.7.3) chưa được triển khai; cần kế hoạch riêng được duyệt.

## M3.7.1 — Người B: xem và tìm tồn kho

Giữ hai terminal backend/frontend như phần Chuẩn bị. Đăng nhập ADMIN tại **http://127.0.0.1:5173/login** → **Kho**, hoặc mở **http://127.0.0.1:5173/admin/inventory**.

| Thao tác | Kết quả mong đợi |
|---|---|
| Mở Kho | Mỗi SKU hiển thị tên sản phẩm, SKU, size/màu và ba lượng: tồn thực có, đang giữ, còn bán |
| DB local chưa có sản phẩm/biến thể | Hiện hướng dẫn tạo sản phẩm; có thể tạo nháp một biến thể bằng UI M3.3 rồi quay lại Kho |
| Tạo một SKU mới rồi mở Kho | Tồn thực có = 0, đang giữ = 0, còn bán = 0; phần này chưa có nút nhập kho |
| Nhập một phần SKU hoặc tên → Tìm kiếm / Enter | Tìm không phân biệt hoa thường; URL có `q=...&page=1`; gõ chưa submit không gọi API mỗi phím |
| Refresh hoặc copy URL sang tab ADMIN khác | Giữ từ khóa và trang |
| Có hơn 24 SKU khớp → sang trang 2, Back/Forward | URL và kết quả theo đúng trang; ô tìm kiếm khớp lại URL |
| Nhập từ khóa không tồn tại | Thông báo không có kết quả; Xóa tìm kiếm quay lại trang 1 |
| Mở `?page=abc` hoặc `?page=0` | Báo số trang sai; Về trang đầu phục hồi |
| Mở trang vượt số kết quả, ví dụ `?page=99999` | Báo trang không có SKU, có nút Về trang đầu |
| Tắt kết nối API rồi tải trang; bật lại và bấm Tải lại tồn kho | Thông báo lỗi rồi tải được dữ liệu; refetch nền lỗi giữ số cũ kèm cảnh báo |
| Màn hình 390px với SKU dài 64 ký tự | Nội dung xuống dòng, các lượng tồn xếp dọc, không kéo ngang trang |
| Chưa đăng nhập / đăng nhập CUSTOMER | Chuyển tới login / account; GET API trực tiếp bị 401 / 403 |

UI chỉ đọc, không tạo dữ liệu mẫu vào DB local và không ghi tồn. Trong E2E `_test`, fixture có tồn 12, đang giữ 2, còn bán 10 và 25 SKU để kiểm tra phân trang; fixture được dọn sau lượt chạy, không xuất hiện ở DB local.

**Data flow:** nhập từ khóa → URL → TanStack Query → `inventoryApi.list` → GET `/api/v1/admin/inventory` → backend đọc PostgreSQL → thẻ SKU hiển thị số liệu server trả.

- `q/page`: từ khóa và trang chia sẻ được qua URL, tìm mới reset trang 1.
- `inventoryKey` (`admin-inventory`): cache được tách theo từ khóa/trang; tải lỗi nền vẫn giữ dữ liệu đọc trước đó.
- `onHand/reserved/available`: tồn thực có / đang giữ / còn bán; UI không tự cập nhật kho.
- `PrivateRoute admin`: bảo vệ trang phía frontend; quyền thật tiếp tục được guard ở backend kiểm tra.

Test riêng: `./tools/npm.ps1 run test --workspace=@clothing/frontend -- src/features/admin/inventory/pages/InventoryPage.test.tsx`. E2E đã triển khai: `./tools/npm.ps1 run test:e2e:implemented`.

**Dừng M3.7.1 để người dùng thử.** Điều chỉnh tồn và lịch sử là M3.7.2/M3.7.3, chưa được triển khai.

## M3.4.2 — admin sửa, thêm và tắt biến thể của sản phẩm nháp

Giữ backend/frontend local như M3.4.1, đăng nhập ADMIN và có một sản phẩm **Nháp**. Không cần dependency hoặc migration mới; backend không đổi.

1. Mở **http://127.0.0.1:5173/admin/products** → **Sửa** một sản phẩm nháp.
2. Mục **Biến thể** hiện mỗi biến thể là một khung "Biến thể 1, 2…" với SKU, Size, Màu, Giá (VND) và ô **Bật biến thể**.
3. Đổi giá biến thể 1 → bấm **Thêm biến thể** → điền SKU mới, size L, màu, giá → **Lưu thay đổi** → về danh sách; mở Sửa lại thấy đủ hai biến thể, refresh vẫn còn.
4. Bỏ chọn **Bật biến thể** của một dòng → lưu → biến thể vẫn còn trong form ở trạng thái tắt, không bị xóa.

### Các tình huống cần thử

| Thao tác | Kết quả mong đợi |
|---|---|
| Sửa giá/size/màu/SKU biến thể đã lưu | Lưu được; ID biến thể và tồn kho (Khả dụng) giữ nguyên |
| Thêm biến thể mới rồi lưu | Biến thể mới có tồn kho 0; giá thấp nhất của các biến thể đang bật thành "giá từ" trong danh sách |
| Thêm một dòng rồi bấm **Bỏ dòng này** trước khi lưu | Dòng mới biến mất, không gửi lên server. Biến thể đã lưu không có nút này |
| Hai dòng cùng SKU (không phân biệt hoa/thường, khoảng trắng) | Báo lỗi ngay ở dòng sau, không gửi request |
| Hai dòng cùng size và cùng màu | Báo "Đã có biến thể khác cùng size và màu." ở dòng sau |
| Giá 0, số lẻ hoặc trên 100.000.000 | Báo lỗi giá ở đúng dòng |
| SKU đã thuộc sản phẩm khác | Server trả 409; báo "…đường dẫn, SKU hoặc tổ hợp size/màu bị trùng…", giữ toàn bộ dữ liệu đang nhập; DB không đổi |
| Đổi chéo size/màu giữa hai biến thể trong một lần lưu | Có thể bị 409 (giới hạn đã biết, xem dưới); lưu thành hai lần qua một màu tạm |
| Màn hình 390px | Các ô xếp dọc, SKU dài nằm trong ô nhập, không kéo ngang trang |

Giới hạn đã biết: backend cập nhật lần lượt từng biến thể trong một transaction, còn DB có ràng buộc unique (sản phẩm, size, màu), nên đổi chéo size/màu giữa hai biến thể trong cùng một lần lưu bị từ chối (cả transaction rollback, không mất dữ liệu). Chỉ sản phẩm nháp sửa được biến thể; tồn kho vẫn chưa điều chỉnh được trên UI (M3.7).

### Luồng dữ liệu / key M3.4.2

Admin sửa/thêm/tắt dòng biến thể → `validateVariants` kiểm tra SKU/size–màu/giá theo dòng → PATCH `/api/v1/admin/products/<id>`: biến thể cũ kèm `id`, biến thể mới không có `id` → `ProductsService.update` kiểm tra version, chặn xóa biến thể, cập nhật hoặc tạo biến thể + inventory 0, tính lại `priceFrom` trong transaction → FE invalidate `admin-products` và về danh sách.

- `VariantDraft`: state một dòng biến thể trong form (`components/variantDrafts.ts`); giá giữ dạng chuỗi khi đang gõ.
- `id` có/không: có `id` là cập nhật biến thể đã lưu, không có là tạo mới; backend từ chối nếu thiếu `id` của biến thể đã có.
- `active`: tắt thay cho xóa; sản phẩm và biến thể đã có lịch sử không bị xóa.
- `variants.<index>.<field>`: khóa lỗi theo dòng để báo đúng ô.

Test riêng: `./tools/npm.ps1 run test --workspace=@clothing/frontend -- src/features/admin/products`. Bộ đã triển khai: `./tools/npm.ps1 run test:e2e:implemented`.

## M3.5 — admin tải và gắn ảnh thật cho sản phẩm nháp

Giữ backend/frontend local, đăng nhập ADMIN, có một sản phẩm **Nháp**. Không cần dependency hoặc migration mới. Ảnh local lưu ở `.local/uploads` (ngoài Git); môi trường production chưa cấu hình lưu ảnh nên upload bị từ chối ở đó.

1. Mở **http://127.0.0.1:5173/admin/products** → **Sửa** một sản phẩm nháp → khung **Ảnh sản phẩm** ở đầu trang.
2. Bấm **Chọn ảnh để tải lên** (hoặc Tab tới ô chọn file rồi Enter) → chọn ảnh JPEG/PNG/WebP → thấy thumbnail "Ảnh n · chưa lưu".
3. Bấm **Lưu thứ tự ảnh** → báo "Đã lưu ảnh sản phẩm."; refresh vẫn thấy ảnh.
4. Có thể sửa tên trước khi lưu ảnh: sau khi lưu ảnh, phần đang nhập còn nguyên và **Lưu thay đổi** vẫn thành công.

### Các tình huống cần thử

| Thao tác | Kết quả mong đợi |
|---|---|
| Chọn file GIF/SVG/PDF | Báo "Chỉ nhận ảnh JPEG, PNG hoặc WebP.", không gửi request |
| Chọn ảnh trên 5 MB | Báo "Ảnh vượt quá 5 MB." |
| Đổi đuôi một file không phải ảnh thành `.png` | Server giải mã thất bại, báo "Chỉ nhận JPEG, PNG, WebP tĩnh, mỗi chiều 64–8000…" |
| Ảnh nhỏ hơn 64 px hoặc ảnh động | Server từ chối với thông báo như trên |
| Bấm **Bỏ** ở ảnh chưa lưu | Ảnh biến mất, không được gắn; file tạm được dọn sau 24 giờ |
| Tải hơn 10 ảnh trong 1 phút | Server báo thao tác quá nhanh (429) |
| Đủ 8 ảnh | Ô chọn file bị khóa, ghi "Đã đủ 8 ảnh cho một sản phẩm." |
| Đang tải ảnh / đang lưu ảnh | Lưu thay đổi, Tải dữ liệu mới và các nút ảnh bị khóa đến khi xong |
| Lưu ảnh khi tab khác đã sửa sản phẩm | Báo lỗi version từ server, ảnh chưa lưu vẫn còn; bấm Tải dữ liệu mới rồi tải lại ảnh |
| Mở `/api/v1/media/<id ảnh>` khi sản phẩm còn nháp | 404, ảnh nháp không công khai |

Gỡ và đổi thứ tự ảnh đã lưu có ở M3.6. Bấm Tải dữ liệu mới sẽ bỏ cả ảnh chưa lưu như mọi phần đang nhập khác.

### Luồng dữ liệu / key M3.5

Chọn file → `uploadsApi.image` POST multipart `/api/v1/admin/uploads/images` (CSRF) → `UploadsService` giải mã bằng sharp, chuyển WebP, ghi file ngoài transaction và tạo `UploadAsset` tạm → thumbnail "chưa lưu" → **Lưu thứ tự ảnh** → `productsApi.images` PUT `/api/v1/admin/products/<id>/images` `{assetIds, expectedVersion}` → `ProductsService.images` kiểm tra version, chủ asset và hạn 24 giờ, ghi `ProductImage` trong transaction → page nhận version mới.

- `UploadAsset` tạm: ảnh đã tải nhưng chưa gắn; chỉ người tải xem được; dọn sau 24 giờ nếu không gắn.
- `assetIds`: toàn bộ danh sách ảnh theo thứ tự muốn lưu (ảnh cũ + ảnh mới); server thay cả danh sách.
- Chuỗi `version`: lưu ảnh tăng version; page lấy version trả về cho form thông tin nên phần đang nhập vẫn lưu được.
- Khóa `operation` của page có thêm `images`, để lưu ảnh không chạy chồng với lưu thông tin hoặc tải lại.

Test riêng: `./tools/npm.ps1 run test --workspace=@clothing/frontend -- src/features/admin/products`. Ca E2E ảnh nằm ở `e2e/product-images.spec.ts`. Bộ đã triển khai: `./tools/npm.ps1 run test:e2e:implemented`.

## M3.6 — admin sắp xếp và gỡ ảnh đã gắn

Giữ backend/frontend local, đăng nhập ADMIN, có một sản phẩm **Nháp** đã gắn ít nhất hai ảnh (làm theo M3.5). Không cần dependency hoặc migration mới; backend không đổi.

1. Mở trang **Sửa** sản phẩm nháp → khung **Ảnh sản phẩm**. Ảnh đầu tiên có nhãn **Ảnh chính**.
2. Bấm **Lên** ở ảnh 2 → ảnh 2 thành ảnh chính → **Lưu thứ tự ảnh** → refresh vẫn đúng thứ tự mới.
3. Bấm **Gỡ** ở một ảnh → ảnh biến mất, hiện cảnh báo "Ảnh đã gỡ sẽ không khôi phục được sau khi lưu." → bấm **Hủy thay đổi ảnh** để thấy ảnh quay lại.
4. Gỡ lại rồi **Lưu thứ tự ảnh** → refresh, ảnh đã gỡ không còn.

### Các tình huống cần thử

| Thao tác | Kết quả mong đợi |
|---|---|
| Ảnh đầu tiên / ảnh cuối cùng | Nút Lên của ảnh đầu và Xuống của ảnh cuối bị tắt |
| Chưa đổi gì | Lưu thứ tự ảnh và Hủy thay đổi ảnh đều tắt |
| Tải ảnh mới rồi bấm Lên cho nó | Ảnh mới thành ảnh chính, lưu một lần là vừa gắn vừa đúng thứ tự |
| Gỡ ảnh rồi Hủy thay đổi ảnh | Danh sách về đúng bản đã lưu (kể cả bỏ ảnh mới chưa lưu) |
| Gỡ hết ảnh của nháp rồi lưu | Được phép với nháp; trang hiện "Sản phẩm chưa có ảnh…" |
| Tab khác đã sửa sản phẩm rồi lưu thứ tự | Báo lỗi version, thứ tự đang chỉnh vẫn còn; bấm Tải dữ liệu mới rồi làm lại |
| Dùng bàn phím | Tab tới Lên/Xuống/Gỡ, Enter để thao tác; không cần kéo-thả |
| Màn hình 390px | Ảnh và nút xếp gọn, không kéo ngang trang |

Ảnh đã gỡ và lưu không lấy lại được: backend chỉ cho gắn lại ảnh tải lên trong 24 giờ và tự dọn ảnh không còn gắn khi đã quá 24 giờ.

### Luồng dữ liệu / key M3.6

Bấm Lên/Xuống/Gỡ chỉ đổi danh sách `rows` trong trình duyệt → **Lưu thứ tự ảnh** → PUT `/api/v1/admin/products/<id>/images` với `assetIds` theo thứ tự mới và `expectedVersion` → `ProductsService.images` xóa danh sách cũ, ghi lại `position` 0..n trong transaction → page nhận version mới; danh sách vừa gửi thành bản đã lưu.

- `saved` / `rows`: bản server đang giữ và thứ tự đang chỉnh; khác nhau thì bật Lưu và Hủy.
- `position`: thứ tự trong DB; ảnh `position` 0 là ảnh chính.
- Nhận biết ảnh "chưa lưu": ảnh có trong `rows` nhưng chưa có trong `saved`.

Test riêng: `./tools/npm.ps1 run test --workspace=@clothing/frontend -- src/features/admin/products`. E2E ảnh: `./tools/npm.ps1 run test:e2e -- product-images.spec.ts`.

## M3.8 — admin xuất bản và ẩn sản phẩm

Giữ backend/frontend local, đăng nhập ADMIN, có một sản phẩm **Nháp** thuộc danh mục đang bật. Không cần dependency hoặc migration mới; backend không đổi.

1. Mở trang **Sửa** sản phẩm nháp → khung **Trạng thái** ở trên khung ảnh, có nhãn **Nháp** và 3 điều kiện: danh mục đang bật, có ít nhất 1 ảnh đã lưu, có ít nhất 1 biến thể đang bật.
2. Nếu chưa có ảnh, nút **Xuất bản** bị khóa và dòng ảnh ghi **Chưa đạt**. Tải và lưu một ảnh (M3.5) → cả 3 dòng **Đạt** → nút mở.
3. Bấm **Xuất bản** → "Đã xuất bản sản phẩm."; trang chuyển thành **Quản lý sản phẩm**, không còn form sửa.
4. Mở http://127.0.0.1:5173/api/v1/products/&lt;slug&gt; trong trình duyệt → thấy JSON sản phẩm (trang khách `/shop` thuộc M3.9, chưa có).
5. Bấm **Ẩn sản phẩm** → "Đã ẩn sản phẩm."; URL API ở bước 4 trả "Không tìm thấy sản phẩm.".
6. Về danh sách sản phẩm → hàng **Đã ẩn** có nút **Quản lý** → bấm **Xuất bản** lại được.

### Các tình huống cần thử

| Thao tác | Kết quả mong đợi |
|---|---|
| Sửa tên/biến thể hoặc đổi ảnh mà chưa lưu | Xuất bản bị khóa, báo "Lưu hoặc hủy các thay đổi đang nhập trước khi xuất bản."; lưu hoặc hoàn tác thì mở lại |
| Tắt hết biến thể rồi lưu | Dòng biến thể **Chưa đạt**, không xuất bản được |
| Danh mục đang tắt (tắt ở trang Danh mục) | Dòng danh mục **Chưa đạt** |
| Tab khác tắt danh mục rồi bấm Xuất bản ở tab cũ | Server từ chối: "Cần danh mục bật, ít nhất một ảnh và một biến thể bật để xuất bản.", trạng thái giữ nguyên |
| Tab khác đã sửa sản phẩm | Server báo dữ liệu đã thay đổi; bấm Tải dữ liệu mới rồi thử lại |
| Sản phẩm đã xuất bản hoặc đã ẩn | Không có form sửa (giữ quy tắc chỉ sửa nháp); chỉ có khung Trạng thái |
| CUSTOMER/khách gọi API publish/hide | 403/401 |
| Màn hình 390px | Khung trạng thái và nút gọn, không kéo ngang |

Sau khi xuất bản, sản phẩm không quay lại nháp và không sửa được trên UI; sửa hàng đang bán cần phần riêng sau này.

### Luồng dữ liệu / key M3.8

Bấm **Xuất bản** → `productsApi.publish` POST `/api/v1/admin/products/<id>/publish` `{expectedVersion}` → `ProductsService.state` kiểm tra version, đổi trạng thái, kiểm tra lại danh mục/ảnh/biến thể trong transaction (không đạt thì 409 và rollback) → page thay snapshot bằng phản hồi, invalidate danh sách → API công khai `/api/v1/products` và `/api/v1/media/<id>` trả sản phẩm/ảnh. **Ẩn sản phẩm** đi qua `/hide` theo cùng luồng.

- `status`: DRAFT/PUBLISHED/HIDDEN; chỉ PUBLISHED trong danh mục bật và có biến thể bật mới hiện với khách.
- Điều kiện xuất bản trên UI tính từ dữ liệu đã lưu; server vẫn kiểm tra lại và là bên quyết định.
- `unsaved`: page gom cờ thay đổi chưa lưu từ form thông tin và khung ảnh; xuất bản sẽ ẩn hai phần này nên phải chờ không còn thay đổi.
- `operation = 'status'`: dùng chung khóa với lưu, lưu ảnh và tải dữ liệu mới.

Test riêng: `./tools/npm.ps1 run test --workspace=@clothing/frontend -- src/features/admin/products`. E2E: `./tools/npm.ps1 run test:e2e -- product-status.spec.ts`.

## M3.12 — Người B: chốt M3 — ca chấp nhận toàn luồng và ảnh còn sau restart

Ca này chạy đúng luồng E2E tổng `apps/frontend/e2e/catalog.spec.ts` (đã ghép vào `test:e2e:implemented`). Chuẩn bị backend + frontend như Chuẩn bị ở M3.1 và một tài khoản ADMIN. Ví dụ dưới chỉ là khuôn; tên/đường dẫn bạn tự đặt.

| Thao tác | Kết quả mong đợi |
|---|---|
| Đăng nhập ADMIN → **Sản phẩm** → **Thêm sản phẩm** | Tạo nháp được: tên riêng (vd. 'Áo checklist'), đường dẫn, chọn danh mục, SKU viết hoa, màu, giá → 'Lưu sản phẩm' |
| Sau lưu | Về danh sách sản phẩm với alert 'Đã tạo sản phẩm nháp "…".'; bấm **Sửa** trên hàng mới tạo được trang 'Sửa sản phẩm nháp' |
| Tải một file ảnh thật từ máy (png/jpg/webp, dưới giới hạn) → **Lưu thứ tự ảnh** | Alert 'Đã lưu ảnh sản phẩm.'; khối ảnh hiện thumbnail và nút gỡ/sắp xếp |
| **Kho** → tìm hoặc lọc theo SKU biến thể vừa tạo | Thẻ tồn xuất hiện với ba lượng 0; bấm **Điều chỉnh** |
| Nhập `+10`, lý do bất kỳ → **Lưu điều chỉnh** | 'Khả dụng: 10' ngay trong dialog; thẻ tồn đổi theo; tự động ghi chuyển kho vào lịch sử M3.7.3 |
| Về trang sửa nháp → **Xuất bản** | 'Đã xuất bản sản phẩm.'; trang đổi sang khuôn 'Quản lý sản phẩm' |
| Mở **http://127.0.0.1:5173/shop**, tìm theo tên/lọc theo danh mục vừa tạo | Thấy đúng 1 sản phẩm vừa dùng (bộ lọc q + categoryId + sort trả lời như M3.9) |
| Bấm tên sản phẩm ở danh sách | Vào chi tiết như M3.10: breadcrumb, ảnh chính (hoặc 'Chưa có ảnh'), chọn biến thể thấy 'Còn 10 sản phẩm' với giá đã nhập |
| Co nhỏ cửa sổ còn ~390 px (devtools) | Không tràn ngang; reload trang chi tiết vẫn hiển thị (deep-link giữ) |
| Về `/admin/products/<mã>` theo URL đúng mã → **Ẩn sản phẩm** | 'Đã ẩn sản phẩm.' |
| Mở `/products/<đường dẫn sản phẩm>` | Trang báo 'Không tìm thấy sản phẩm.' với hướng dẫn quay lại |

Kiểm tra ảnh còn sau restart: dừng backend (Ctrl+C ở terminal 1) và chạy lại `npm run dev:backend`; mở lại trang admin sản phẩm và trang chi tiết khách — ảnh đã gắn vẫn hiển thị (tệp nằm tại `.local/uploads`, bản ghi upload giữ nguyên; ảnh không biến thành 'Chưa có ảnh').

Kiểm tra tự động: ca này chính là spec E2E tổng đã ghép vào `test:e2e:implemented` — toàn bộ hiện 34 ca trên 11 spec, đạt local 40s (chi tiết [progress.md](../progress.md) § M3.12). Câu lệnh: `./tools/npm.ps1 run test:e2e:implemented`.

## M3.13a — Người B: nhập dữ liệu thật từ ảnh Instagram (CSV + lệnh `import:products`)

Mục tiêu: đưa 5 sản phẩm RMG (17 ảnh đã copy sẵn từ `Downloads\RMG` vào `data\import`) lên web bằng một lệnh. `products.csv` sinh sẵn với tên/danh mục/màu/mô tả theo caption và ảnh thật; **price/sizes/stock đã điền và lệnh import đã chạy thành công ngày 29/10** (5 sản phẩm PUBLISHED, 17 ảnh xem được; chi tiết [progress.md](../progress.md) § M3.13a). Trạng thái PUBLISHED theo lựa chọn của bạn.

Chuẩn bị: một tài khoản ADMIN (như M3.1); frontend/backend bật như thường khi muốn xem kết quả (chính lệnh import thì không cần server nào — nó nói thẳng với DB qua `.env`).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | *(đã xong 29/10)* `products.csv` đã điền đủ price/sizes/stock | CSV giữ đúng 8 cột mẫu, không thêm/bớt cột |
| 2 | *(đã xong 29/10)* Chạy `.\tools\npm.ps1 run import:products` | Log 'Đã tạo sản phẩm … — 1 biến thể, n ảnh, trạng thái PUBLISHED.' ×5 rồi 'Import xong: 5 sản phẩm mới, 0 đã có sẵn, 0 dòng CSV bị bỏ qua.' |
| 3 | Mở **http://127.0.0.1:5173/shop** | 'Tìm thấy 5 sản phẩm.'; 5 sản phẩm RMG hiện kèm ảnh thật, 'Giá từ 500.000 ₫' tới '1.000.000 ₫' |
| 4 | Bấm vào sản phẩm quần (slug `rmg-goldline-metal-baggy-pants`) rồi liệt kê 4 slug còn lại | Chi tiết M3.10: gallery ảnh thật, biến thể 'XL · đen' (áo thun đen là 'L · đen'), 'Còn 10 sản phẩm' (áo polo/áo thun: 'Còn 5') |
| 5 | `/admin` → **Kho** → tìm SKU `RMG…-XL` → **Điều chỉnh** `+10`, lý do tuỳ | Dialog 'Khả dụng: 15' (polo, 5+10); lịch sử M3.7.3 đã có sẵn dòng 'Nhập kho lúc import' từ lúc import + dòng điều chỉnh mới |
| 6 | Dừng cả hai server, bật lại, mở `/shop` | 5 sản phẩm và ảnh vẫn còn (dữ liệu trong DB, ảnh trong `.local/uploads`) |

Slug dự kiến: `rmg-black-wash-vtg-horse-tee`, `rmg-white-horse-tee`, `rmg-goldline-metal-baggy-pants`, `rmg-different-level-polo`, `rmg-different-metal-zip-hood`.

Lưu ý:

- Chạy lệnh khi CSV chưa điền giá là an toàn: toàn bộ dòng bị bỏ qua 'thiếu giá…', không tạo gì (đã chạy thử thật, nhận thấy exit 0, không dòng nào tạo).
- `--draft` nếu muốn nhập nháp soát trước; sản phẩm DRAFT không hiện ở `/shop` cho tới khi **Xuất bản** qua admin (M3.8).
- M3.13b: `.\tools\npm.ps1 run import:products -- --dir data\import-khac --draft` nay chuyển đúng cả hai tham số (trước đây npm nuốt mất, lệnh âm thầm đọc `data\import` và nhập PUBLISHED). `--dir` tương đối tính từ thư mục gốc repo.
- M3.13b: dòng thuộc danh mục đã có nhưng đang tắt bị bỏ qua khi nhập PUBLISHED, log 'danh mục … đang tắt. Bật danh mục trong admin rồi chạy lại, hoặc nhập nháp bằng --draft.'; với `--draft` vẫn nhập nháp được.
- Ảnh được crop vừa khung 750×1000 (cắt viền, không méo). Phần cắt không vừa ý thì thay/gắn lại ảnh qua admin (M3.5/3.6).
- Chạy lại là an toàn theo slug: dòng trùng tên bị bỏ qua; đổi tên sản phẩm trong CSV sẽ tạo sản phẩm MỚI (không tự sửa cái cũ) — sau khi import, mọi chỉnh sửa về giá/tồn/khác làm qua admin, không qua CSV.
