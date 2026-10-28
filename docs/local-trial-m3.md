# Chạy thử M3 theo từng phần

## M3.1 — admin xem và thêm danh mục

Phần M3.1 ban đầu có danh sách và tạo danh mục thật trong PostgreSQL. M3.2 bổ sung sửa/bật/tắt theo hướng dẫn phía dưới. Chưa có xóa danh mục hoặc UI sản phẩm/ảnh/kho. Trạng thái kỹ thuật và nghiệm thu xem [progress.md](../progress.md); lộ trình tiếp theo xem [m3-implementation-plan.md](m3-implementation-plan.md).

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

**Điểm dừng hiện tại: M3.2, chờ người dùng chạy thử.** Phần tiếp theo M3.3 dự kiến tạo sản phẩm nháp với một biến thể, cần kế hoạch riêng được duyệt.
