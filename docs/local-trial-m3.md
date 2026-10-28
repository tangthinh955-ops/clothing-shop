# Chạy thử M3 theo từng phần

## M3.1 — admin xem và thêm danh mục

Phần M3.1 ban đầu có danh sách và tạo danh mục thật trong PostgreSQL. M3.2 bổ sung sửa/bật/tắt; M3.3 bổ sung tạo sản phẩm nháp với một biến thể; M3.4.1 bổ sung sửa thông tin nháp; M3.4.2 bổ sung sửa/thêm/tắt biến thể của nháp; M3.5 bổ sung tải và gắn ảnh thật; M3.6 bổ sung sắp xếp/gỡ ảnh; M3.8 bổ sung xuất bản/ẩn; M3.7.1 (Người B) bổ sung xem/tìm tồn kho theo hướng dẫn phía dưới. Chưa có xóa danh mục, điều chỉnh tồn/lịch sử kho (M3.7.2/M3.7.3) hoặc trang khách (M3.9). Trạng thái kỹ thuật và nghiệm thu xem [progress.md](../progress.md); lộ trình tiếp theo xem [m3-implementation-plan.md](m3-implementation-plan.md).

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

**Điểm dừng hiện tại: M3.8 (Người A) và M3.7.1 (Người B), chờ người dùng chạy thử.** Điều chỉnh/lịch sử kho (M3.7.2/M3.7.3) và trang khách (M3.9) cần kế hoạch riêng được duyệt.

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
