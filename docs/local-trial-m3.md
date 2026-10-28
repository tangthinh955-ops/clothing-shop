# Chạy thử M3 theo từng phần

## M3.1 — admin xem và thêm danh mục

Phần M3.1 ban đầu có danh sách và tạo danh mục thật trong PostgreSQL. M3.2 bổ sung sửa/bật/tắt; M3.3 bổ sung tạo sản phẩm nháp với một biến thể; M3.4.1 bổ sung sửa thông tin nháp; M3.7.1 (Người B) bổ sung xem/tìm tồn kho theo hướng dẫn phía dưới. Chưa có xóa danh mục hoặc UI sửa biến thể/ảnh/điều chỉnh tồn/lịch sử kho. Trạng thái kỹ thuật và nghiệm thu xem [progress.md](../progress.md); lộ trình tiếp theo xem [m3-implementation-plan.md](m3-implementation-plan.md).

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

**Điểm dừng hiện tại: M3.4.1, chờ người dùng chạy thử.** M3.4.2 (sửa biến thể/thêm tắt) và các phần ảnh/kho/xuất bản cần kế hoạch riêng được duyệt. M3.4.1 chưa có UI sửa SKU/size/màu/giá, ảnh, điều chỉnh kho hoặc xuất bản.

## M3.4.1 — admin sửa thông tin sản phẩm nháp

Giữ backend/frontend local hoạt động theo phần chuẩn bị, đăng nhập ADMIN, có ít nhất một danh mục và một sản phẩm nháp tạo ở M3.3 (hoặc tạo mới). Không cần dependency hoặc migration mới.

1. Mở **http://127.0.0.1:5173/admin/products** → hàng sản phẩm nháp (nhãn **Nháp**) có nút **Sửa** → trang `/admin/products/<id>`.
2. Form điền sẵn tên/đường dẫn/danh mục/mô tả đang lưu. Biến thể hiện ở dạng chỉ đọc (SKU/size/màu/giá) kèm lời nhắc chưa cho sửa ở phần này.
3. Đổi tên và mô tả → **Lưu thay đổi** → về danh sách, báo "Đã cập nhật sản phẩm nháp …" và thấy tên mới; refresh vẫn còn.
4. Bấm **Tải dữ liệu mới** (có lời nhắc ngay trên trang): thay toàn bộ nội dung đang nhập bằng bản mới nhất trên máy chủ; tải lỗi thì giữ nguyên phần đang nhập.

### Các tình huống cần thử

| Thao tác | Kết quả mong đợi |
|---|---|
| Sửa tên/mô tả, lưu, refresh | Thay đổi còn nguyên; biến thể/tồn kho giữ nguyên (Khả dụng vẫn 0) |
| Đổi đường dẫn trùng sản phẩm khác hoặc để tab cũ lưu sau | Báo "Sản phẩm đã thay đổi hoặc đường dẫn sản phẩm bị trùng…", giữ input; không đoán riêng lỗi slug |
| Sửa ở hai tab cùng sản phẩm | Tab lưu sau bằng version cũ bị từ chối, dữ liệu tab trước không bị ghi đè; Tải dữ liệu mới mới đồng bộ bản mới |
| Bấm Lưu liên tiếp khi đang lưu | Nút và các trường khóa, chỉ một PATCH đang chờ |
| Bấm Tải dữ liệu mới khi mạng chậm rồi thử Lưu | Các trường và Lưu bị khóa đến khi tải xong; không gửi PATCH chồng với explicit reload |
| Đang lưu rồi thử Tải dữ liệu mới | Tải dữ liệu mới bị khóa; nếu lưu lỗi thì form/input/thông báo lỗi vẫn còn và thao tác được mở lại |
| SKU hiện có dài64 ký tự liền, mở trang sửa ở390px | SKU tự xuống dòng, không kéo rộng trang hoặc che nút |
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
