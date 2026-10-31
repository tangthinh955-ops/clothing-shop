# Chạy thử M4 theo từng phần — Người B

> Cập nhật 31/10/2026. M4.0.1–M4.0.3, M4.1.1–M4.1.2 và M4.2.1 giỏ hàng đã viết; kết quả kiểm tra thực tế xem [progress.md](../progress.md). **Chưa có API/UI đặt hàng và chưa được người dùng nghiệm thu.** M4.2.2 trở đi là runbook dự kiến, chưa triển khai.

Kế hoạch kỹ thuật cùng mã: [m4-implementation-plan.md](m4-implementation-plan.md). Kết quả thật: [progress.md](../progress.md). Người B phụ trách toàn bộ M4; duyệt runbook/lộ trình không cho phép agent tự code hoặc chạy hết các phần.

## 1. Môi trường local và giới hạn

- Chỉ dùng máy local và PostgreSQL local/test, dữ liệu thử do người dùng/test tạo. Không lấy DB, ảnh, backup hoặc thông tin khách thật từ VPS; không deploy và không gửi/chuyển tiền thật trong runbook này.
- Node24.22.1+ trên dòng24, npm11, Docker Desktop. Trên Windows dùng `tools/npm.ps1`; không đổi Node toàn máy. Chuẩn bị chung theo [README](../README.md#chạy-local).
- Thử tay: `clothing_local`, API `http://127.0.0.1:3000/api/v1`, frontend **http://127.0.0.1:5173**. API chỉ được gọi qua proxy frontend khi kiểm tra cookie/CSRF.
- Tự động integration/E2E: `NODE_ENV=test` và PostgreSQL database nguồn hậu tố `_test` (`clothing_test`). Integration Cài đặt/schema đơn và runner E2E tạo DB riêng cho mỗi lượt, migrate rồi chỉ dọn DB do lượt đó tạo; role test cần `CREATEDB`. Không sửa/xóa singleton Cài đặt có sẵn trong DB nguồn. E2E API3001/frontend5174; chạy qua script npm/`tools/test-e2e.mjs`, không gọi trực tiếp Playwright cho spec Cài đặt. Không in DATABASE_URL hoặc secret.
- Khách mở cửa sổ riêng tư để thử đặt/tra cứu **không login**. ADMIN dùng cửa sổ khác, tài khoản tạo đúng CLI đã có; không tạo mật khẩu mặc định và không nâng quyền CUSTOMER bằng sửa DB.
- Local email dùng preview mailbox theo README. Không gửi token/link riêng tư hoặc dữ liệu nhận hàng vào chat, log, screenshot chia sẻ hoặc Git.

### Lệnh hiện có từ root

Nếu chưa thiết lập, xem README trước. Các lệnh dưới không được tự chạy lên VPS hoặc thay môi trường thật. `setup:local` giữ file env đã có; các bước ghi DB chỉ chạy khi phần migration được duyệt và kết nối đã được xác nhận là local/test.

```powershell
# Thiết lập local nếu chưa có, theo README
.\tools\npm.ps1 run setup:local
docker compose up -d db
.\tools\npm.ps1 run db:generate
# Chỉ áp dụng các migration đã được duyệt vào đúng DB local/test
.\tools\npm.ps1 run db:migrate
.\tools\npm.ps1 run db:migrate:test --workspace=@clothing/backend
```

Sau khi môi trường sẵn sàng, dùng hai terminal:

```powershell
# Terminal 1
.\tools\npm.ps1 run dev:backend
```

```powershell
# Terminal 2
.\tools\npm.ps1 run dev:frontend
```

Mở http://127.0.0.1:5173. Giữ host khớp APP_ORIGIN, không đổi qua lại `localhost`/`127.0.0.1` rồi bỏ CSRF để chữa lỗi. Không chạy lệnh reset/truncate, xóa volume hoặc sửa migration cũ.

### Dữ liệu thử có kiểm soát

Không có lệnh seed M4 trong repo lúc viết tài liệu. Sau khi các phần tương ứng có, tạo hàng bằng UI admin M3 và điều chỉnh kho với lý do thử; dùng SKU riêng mỗi lượt. Test tự động phải tạo và dọn fixture của chính nó, không xóa cả prefix dữ liệu có sẵn.

| Mẫu thử | Dữ liệu nghiệp vụ giả dự kiến |
|---|---|
| SKU-A | Published, variant active, giá200.000đ, onHand5/reserved0 |
| SKU-B | Published, variant active, giá300.000đ, onHand3/reserved0 |
| SKU-X | Hết hàng hoặc DRAFT/HIDDEN để thử bị chặn |
| Cài đặt | Phí30.000đ, hạn bank120phút; ngân hàng chỉ dùng dữ liệu thử được duyệt |
| Người nhận | Nhập dữ liệu giả hợp lệ theo DTO đã chốt M4.0.1/3.1; không sao chép khách thật vào fixture |

Không chạy `seed:demo` ở production. Giỏ2×A +1×B → subtotal700.000, phí30.000, tổng730.000. Mỗi ca hủy/xuất/thanh toán dùng đơn mới để không suy diễn sai số từ ca trước; không reset DB để đưa số về mẫu.

## 2. Cách ghi kết quả

Với mỗi mã bên dưới, ghi ở progress: mã/commit/môi trường → điều kiện → thao tác → mong đợi → thực tế → đạt/chưa đạt/chưa chạy → giới hạn và điểm dừng. Token/PII không được sao chép vào bằng chứng. Phân biệt **đã viết**, **agent đã kiểm tra**, **chờ người dùng thử**, **người dùng xác nhận**, **CI**, **deploy**.

Các ca dưới đây là tiêu chí thao tác, không tự coi là đã đạt. Xem từng mục và progress để phân biệt phần đã viết, đã kiểm tra, chưa triển khai và chưa nghiệm thu.

## 3. Chạy thử theo đúng mã implementation

### M4.0.1 — Chốt contract, chưa có UI

**Đã chốt (29/10/2026):** đọc [m4-contract.md](m4-contract.md) — state machine, DTO/error dự kiến, snapshot, actor ADMIN/GUEST/SYSTEM, idempotency, token và thứ tự khóa. Phân biệt [ĐÃ DUYỆT]/[ĐỀ XUẤT]/[CƠ CHẾ] ngay trong tài liệu; các con số chống spam, quote TTL, retention là đề xuất chờ duyệt. Phần này chỉ là tài liệu: không chạy migration/test app. Người dùng kiểm tra bằng cách đọc và phản hồi các mục [ĐỀ XUẤT].

### M4.0.2 — Schema nền tảng, chưa có UI

**Đã triển khai và agent đã kiểm tra local (29/10/2026); migration `202610290001_m4_order_core` đã áp dụng vào `clothing_local` và `clothing_test` (chưa đụng DB production trên VPS).** Cách kiểm chứng:

1. `docker exec clothing-shop-db-1 psql -U clothing -d clothing_local -c "\dt"` thấy `shop_settings`, `checkout_quotes`, `orders`, `order_items`, `order_status_history`, `idempotency_records`; `inventory_movements` có thêm `actorType`, `source`, `effectKey` và `actorId` nhận NULL.
2. Chạy `./tools/npm.ps1 run test:integration`: spec mới `orders-foundation.integration.spec.ts` 4/4 (unique mã đơn/lookupTokenHash/(scope,identity,key), CHECK tiền/quantity/settings, snapshot + rollback giữa chừng, movement guest/system không cần user).
3. Prisma Studio (`apps/backend`, `npx prisma studio`) xem các bảng mới; chưa có API/UI nào đọc ghi chúng — đây là nền tảng, không phải tính năng dùng được.

### M4.0.3 — Giữ/giải phóng/xuất kho, chưa có UI mới

**Đã triển khai và agent đã kiểm tra local (29/10/2026); chưa có endpoint/UI — chỉ service nội bộ cho Orders gọi ở M4.3 trở đi.** Chạy `./tools/npm.ps1 run test:integration`, spec `inventory-orders.integration.spec.ts` 8/8 phủ: reserve đủ điều kiện và replay không nhân đôi; cùng effectKey khác nội dung bị chặn; hai transaction tranh chiếc cuối chỉ một thắng; giỏ thiếu một SKU rollback tất cả; release (actor SYSTEM) và ship giảm đúng cột, replay an toàn; hai giỏ ngược thứ tự không deadlock (khóa theo variantId tăng dần); transaction ngoài rollback cuốn cả kho và ledger; hồi quy điều chỉnh admin M3 và lịch sử hiện "Khách đặt hàng"/"Hệ thống" ở dòng không có user. API Điều chỉnh kho M3 trên UI vẫn dùng như cũ.

### M4.1.1 — Xem Cài đặt

**Đã triển khai và agent đã kiểm tra local (30/10/2026); trang chỉ đọc — phần chỉnh/lưu nằm ở M4.1.2, đã triển khai (xem dưới).** ADMIN đăng nhập → `/admin` → nút **Cài đặt** → `/admin/settings`: thấy Phí giao hàng (VND), Hạn chuyển khoản (phút), Ngân hàng/Mã BIN/Số tài khoản/Tên chủ tài khoản — trường chưa có hiển thị "Chưa cấu hình". Refresh trực tiếp `/admin/settings` vẫn mở được. Cấu hình ngân hàng chưa đủ thì chỉ hiển thị, chưa ảnh hưởng checkout (chưa có luồng bank).

| Thao tác | Kết quả mong đợi |
|---|---|
| ADMIN mở `/admin/settings` | 200 với dữ liệu thật từ `shop_settings`; chưa có bản ghi thì thấy mặc định 30.000đ/120 phút |
| CUSTOMER/khách vào URL hoặc gọi API | UI chuyển về tài khoản/đăng nhập; GET `/api/v1/admin/settings` bị 403/401 |
| Gọi `/api/v1/shop-settings/public` không đăng nhập | 200 với đúng hai trường phí + hạn; không có dữ liệu ngân hàng |
| Reload trang | Dữ liệu giữ nguyên, không đổi DB (GET không ghi) |

Test riêng: integration `test/settings.integration.spec.ts` (trong `./tools/npm.ps1 run test:integration`) và `./tools/npm.ps1 run test:e2e -- settings.spec.ts`.

### M4.1.2 — Lưu Cài đặt

**Đã triển khai và agent đã kiểm tra local (30/10/2026): PATCH `/api/v1/admin/settings` với phiên bản lạc quan + Idempotency-Key; chưa được người dùng nghiệm thu.** Tài khoản ngân hàng dùng đủ hoặc trống toàn bộ 4 trường; cấu hình áp cho đơn mới, báo giá và đơn đã tạo giữ nguyên snapshot (giao diện hiện "phiên bản N" của cấu hình đang sửa). Kiểm thử tự động: integration 14 ca (`test/settings.integration.spec.ts` trong `./tools/npm.ps1 run test:integration`) và E2E 3 ca (`settings.spec.ts` trong `./tools/npm.ps1 run test:e2e:implemented`).

| Thao tác | Kết quả mong đợi |
|---|---|
| ADMIN sửa trường rồi bấm **Lưu cài đặt** | Thấy "Đã lưu cài đặt. Cấu hình mới áp dụng cho các đơn mới."; ghi chú chuyển sang phiên bản kế tiếp; refresh giữ giá trị vừa lưu |
| Tab hai giữ snapshot cũ lưu sau khi tab một đã lưu | Alert "Cài đặt đã thay đổi…" (409): form khóa nội dung, giữ bản nháp, có **Tải cấu hình mới** — không ghi đè im lặng |
| Mở **Tải cấu hình mới** | Dialog "Tải cấu hình mới?" cảnh báo bản nháp chưa lưu: xác nhận "Xoá và tải cấu hình mới" nạp cấu hình mới; "Tiếp tục chỉnh sửa" hủy, không mất gì |
| Lưu khi mất mạng/5xx | Alert lỗi và form khóa nội dung với **Gửi lại** (cùng key + body, không tự đổi key) hoặc **Tải cấu hình mới** |
| Lưu bị chặn định dạng/4xx | Alert lỗi, form mở lại chỉnh sửa được; lần lưu kế tiếp dùng key mới giữ nội dung mới |
| Bấm Lưu lặp khi request chưa xong | Nút Lưu và các trường khóa cho đến khi biết kết quả |
| Xác nhận tải cấu hình mới nhưng request tải lại lỗi | Giữ bản nháp, version, trạng thái khóa và command cũ; vẫn gửi lại được đúng thao tác chưa xác định |
| Tải cấu hình mới đang chờ | Khóa trường, Lưu, Gửi lại và tải lại; không có PATCH chạy chồng với reload |
| PATCH nhận HTTP 200 nhưng JSON sai cấu trúc | Không báo đã lưu; giữ nguyên bản nháp và chỉ cho gửi lại cùng key/body hoặc tải cấu hình mới |
| Sửa fee/hạn vượt biên (UI validation) | Không gửi request; báo lỗi dưới trường |
| Xem trên mobile 390px | Không tràn ngang; nút và trường thao tác được |

Giới hạn: mất kết nối/mất gói chỉ thử tay (E2E không chủ ý fail mạng); kiểm tra snapshot quote/đơn đã tạo chỉ chốt khi M4.2.2/M4.3.1 triển khai.

### M4.2.1 — Giỏ hàng

Trên local, tạo sản phẩm xuất bản có biến thể còn hàng bằng tài khoản ADMIN (dùng dữ liệu thử), sau đó mở `/shop` như khách:

1. Mở chi tiết, chọn màu/size, nhập số lượng và bấm **Thêm vào giỏ**. Drawer bên phải mở và hiện hàng vừa thêm; đóng bằng nút hoặc Escape để chọn tiếp.
2. Thêm biến thể khác; bấm biểu tượng giỏ ở header để mở lại. Badge hiện tổng số chiếc. Bấm **Đi tới giỏ hàng** đến `/cart`.
3. Đổi số lượng rồi nhấn Enter hoặc rời ô; refresh trang, giỏ vẫn còn. Xóa một dòng hoặc bấm **Tiếp tục mua**.
4. Dùng ADMIN giảm tồn hoặc ẩn sản phẩm thử, sau đó refresh `/cart`: dòng tương ứng báo không đủ hàng hoặc không truy cập được, không tự xóa. Kiểm tra Kho trước/sau: chỉ thêm/xem giỏ không giữ hay trừ hàng.
5. Kiểm tra cửa sổ rộng 390px và thử mất mạng: có thông báo lỗi/tải lại; giỏ vẫn giữ. Nếu storage bị chặn thì có cảnh báo và giỏ chỉ tồn tại trong tab.

Giỏ local chỉ lưu variantId/quantity/schemaVersion; giá/tồn đọc từ API public. Giá tạm hiển thị chưa gồm phí giao; quote/đặt đơn thuộc M4.2.2/M4.3.1. E2E chạy qua `./tools/npm.ps1 run test:e2e:implemented`, dùng database `_test` riêng của runner.

### M4.2.2 — Quote/tạm tính từ server

**Đã triển khai và agent đã kiểm tra local (31/10/2026): giỏ 2×A +1×B → bấm "Xem phí và tổng tiền" trên `/cart` → `/checkout` → "Lấy báo giá" thấy tiền hàng 700.000đ, phí 30.000đ, tổng 730.000đ do server tính; hết hạn 15 phút theo giờ server; chưa có bước đặt đơn.**

| Thao tác | Kết quả mong đợi |
|---|---|
| `/cart` giỏ không rỗng → "Xem phí và tổng tiền" | Vào `/checkout`, thấy dòng "Phương thức hiện tại: COD" |
| Bấm "Lấy báo giá" | Danh sách dòng đúng giỏ (đơn giá × số lượng), tiền hàng/phí/tổng từ server; "Báo giá chưa giữ hàng"; hết hạn ~15 phút |
| Chỉnh giỏ rồi lấy lại | "Giỏ đã thay đổi…" hoặc quote mới khớp giỏ; giá/phí đổi thì hiện "Dùng báo giá mới" để xác nhận, không tự thay tổng |
| Chờ hết 15 phút | "Báo giá đã hết hạn" + "Cập nhật báo giá"; không tự lấy mới |
| Giỏ có hàng ẩn/hết tồn | Bị chặn toàn bộ (409 ITEM_UNAVAILABLE/OUT_OF_STOCK), không có dòng nào được báo giá |
| Mất mạng khi lấy | Báo lỗi giữ giỏ; chỉ thử lại khi bấm |
| Reload `/checkout` | Trang mở lại được; quote không lưu localStorage |

Đối chiếu DB: row `checkout_quotes` khớp response, `inventory` không đổi, không có row orders/movements. Test riêng: integration `test/checkout-quote.integration.spec.ts` và `./tools/npm.ps1 run test:e2e -- checkout-quote.spec.ts`.

### M4.3.1 — Đặt COD không cần tài khoản

1. Cửa sổ riêng tư, điền form dữ liệu giả hợp lệ và đặt COD, không có bước đăng nhập/xác minh email.
2. Nhận mã đơn và màn xác nhận; với2×A, tồn ban đầu5/0 thành5/2, còn bán3. Chưa thu tiền COD.
3. Bấm đúp, mạng chậm và mất response sau server commit: cùng key/payload phải trả cùng đơn, không giữ thêm2. Form khóa nội dung khi chưa biết kết quả, không tạo key mới tùy tiện.
4. Integration dùng2browser tranh hàng cuối, giỏ có1SKU thiếu, quote đổi giá, input/address/SĐT sai và anti-abuse vượt limit. Chỉ trường hợp hợp lệ giữ kho; thất bại rollback hết.

Chưa có phần4.1 thì màn xác nhận phải vẫn xem được kết quả thật vừa tạo; không tạo link/nút dẫn vào trang chưa triển khai. Khi4.1 có, kiểm chứng thêm link/reload theo cơ chế token đã chốt.

### M4.4.1 — Xem đơn qua link

Mở link riêng được cấp khi tạo đơn trong cửa sổ mới, xem đúng snapshot/timeline/tổng tiền; refresh theo cơ chế đã bàn giao. Sửa token hoặc dùng token đơn khác cho mã hiện tại → lỗi đồng nhất, không trả PII. Kiểm tra token không có trong query HTTP, log hoặc localStorage; không chia sẻ link thật làm bằng chứng.

### M4.4.2 — Tra cứu mã đơn +SĐT

Mở `/orders/lookup`, nhập đúng dữ liệu của đơn thử → vào đúng đơn. Thử mã không tồn tại/SĐT sai cùng thông báo, thử vượt rate limit có lỗi429 dễ hiểu, không lộ số đơn khác của cùng SĐT. Khả năng hủy sau lookup phải theo quyền server, không chỉ bật nút theo dữ liệu form.

### M4.4.3 — Khách hủy trước đóng gói

Đơn riêng PENDING hoặc CONFIRMED giữ2×A: mở đúng link → Hủy kèm lý do. Mong đợi CANCELLED, reserved giảm2, onHand không tăng; gửi lại không giải phóng lần nữa. Đơn khác hoặc SHIPPED không hủy được. Khi bank có, thu tiền rồi hủy phải sinh nghĩa vụ đúng phần chưa xử lý, không hiển thị đã hoàn tiền.

### M4.4.4 — Xin hủy khi PACKING

Sau M4.5.4, admin chuyển đơn thử tới PACKING; khách gửi yêu cầu hủy. Mong đợi đơn vẫn PACKING, yêu cầu pending, gửi lại không trùng; việc hủy thực sự chờ M4.5.8. Không cho dùng API hủy trực tiếp để vượt bước.

### M4.5.1 — Admin danh sách đơn

ADMIN vào `/admin/orders`: thấy đơn thật vừa tạo; filter/page nằm trên URL, refresh giữ; empty/error/retry rõ. Khách/CUSTOMER gọi GET admin bị401/403; thông tin một đơn không lẫn vào dòng khác. Không dùng fixture giả trong UI sản phẩm để báo luồng đã chạy.

### M4.5.2 — Chi tiết và ghi chú admin

Mở dòng đơn ở `/admin/orders/<id>`, đối chiếu mã/items/giá/phí/người nhận snapshot và lịch sử. Thêm ghi chú thử → refresh còn; lỗi mạng/version giữ draft và báo rõ, không ghi đè trường nghiệp vụ. Sau khi có thao tác tiếp theo, kiểm tra lịch sử actor/thời gian/lý do.

### M4.5.3 — Xác nhận COD

Đơn PENDING → Xác nhận → CONFIRMED; tồn giữ nguyên, chưa thu COD. Lưu bằng tab snapshot cũ hoặc trạng thái sai →409. Bấm đúp không tạo hai history/effect. Bank chỉ thử sau6.2: thiếu tiền không confirm, đủ trước hạn mới hợp lệ.

### M4.5.4 — Đóng gói

CONFIRMED → Đóng gói → PACKING. Khách giờ chỉ gửi yêu cầu hủy; nút/API hủy trực tiếp không được. Thử transition sai, stale version và double-click, số kho/tiền không bị đổi ngoài hiệu ứng được thiết kế.

### M4.5.5 — Bàn giao vận chuyển

Với đơn2×A trước ship onHand5/reserved2: nhập tracking theo DTO → Bàn giao → SHIPPED, kho3/0. Gửi lại cùng key không xuống1/-2. Integration cancel/ship đồng thời phải có một kết quả hợp lệ, không đơn hủy mà vẫn xuất hoặc ngược lại.

### M4.5.6 — Giao thành công

SHIPPED → Giao thành công → DELIVERED, có deliveredAt. Kho vẫn3/0, không trừ thêm. COD vẫn chưa thu cho tới khi admin đối soát ở6.4; giao thành công không phải bằng chứng tiền đã nhận.

### M4.5.7 — Admin hủy

Tạo các đơn riêng PENDING/CONFIRMED/PACKING để hủy có lý do. Reserved được giải phóng đúng một lần, history giữ; SHIPPED không hủy thẳng. Khi có bank, kiểm tra thu dư rồi hủy chỉ tạo nghĩa vụ bổ sung phần allocated, không cộng dư hai lần.

### M4.5.8 — Duyệt/từ chối yêu cầu hủy

Mở yêu cầu từ4.4.4: từ chối thì đơn vẫn PACKING, có lý do; dùng đơn khác để duyệt thì CANCELLED và giải phóng giữ. Integration duyệt hủy/ship cùng lúc, replay quyết định và version cũ phải giữ nhất quán.

### M4.6.1 — Đơn bank và VietQR

Khi Settings ngân hàng hợp lệ, khách chọn bank và tạo đơn thử1×A → tổng230.000đ, có deadline2giờ được snapshot. Xem QR cùng thông tin chữ: ngân hàng/tài khoản/tên được cấu hình, số tiền còn phải trả và nội dung mã đơn. Chỉ đối chiếu/giải mã payload QR hoặc màn xác nhận quét; **không xác nhận chuyển tiền thật**. QR không gửi dữ liệu sang dịch vụ tạo QR ngoài, đơn chưa tự PAID. Thiếu bank config phải chặn bank, COD không hỏng.

### M4.6.2 — Ghi chuyển khoản thiếu/đủ/dư

- Đơn due230.000: admin ghi100.000 → PARTIALLY_PAID, chưa confirm; thêm130.000 trước hạn → đủ và confirm được.
- Đơn khác due230.000, thu260.000 → phân bổ230.000 và nghĩa vụ trả dư30.000, không coi toàn260.000 là doanh thu/phần còn phải trả âm.
- Gửi lại key cũ không ghi thêm; cùng ngân hàng receiving account/reference chuẩn hóa bị từ chối khi tạo receipt mới. Nội dung/số tiền sửa với key cũ →409, không tự retry bằng key mới.

Sau7.x, phải chạy lại nhận tiền đúng/sau deadline và sau hủy. Không phát hành luồng bank production trước khi xử lý các ca đó.

### M4.6.3 — Sổ thu và nghĩa vụ

ADMIN mở trang dự kiến `/admin/payments`, lọc và đối chiếu receipts/allocations/obligations của hai đơn trên. Trạng thái tiền tách khỏi giao hàng; refresh không mất lịch sử, quyền khách bị chặn. Sổ thu không có thao tác ghi đè/xóa khoản đã xác nhận; sai phải đi qua cách điều chỉnh được duyệt.

### M4.6.4 — Đối soát COD

Lấy đơn DELIVERED ở5.6 chưa thu, admin ghi khoản đối soát COD bằng dữ liệu thử. Mong đợi ledger/payment summary đổi theo số thực nhận; cùng mã đối soát/key không tạo hai khoản. Tạo/ship/deliver lại không tự phát sinh receipt.

### M4.6.5 — Ghi kết quả hoàn thủ công

Đối chiếu nghĩa vụ trả dư30.000; chỉ sau thao tác ngoài hệ thống giả lập mới ghi kết quả theo flow được duyệt. Ghi từng phần10.000 rồi phần còn lại20.000 phải hợp lệ; ghi vượt nghĩa vụ/nguồn hoặc lặp thành công bị chặn. UI không gọi ngân hàng và không coi nghĩa vụ là tiền đã hoàn.

### M4.7.1 — Hết hạn và catch-up

Integration trên `_test` đặt deadline fixture đã qua để kiểm tra nhanh, không sửa đồng hồ máy/DB hoặc deadline production. Bank thiếu tiền quá hạn → CANCELLED/PAYMENT_EXPIRED và nhả reserved; COD không bị bank-expiry. Chỉ thử tay với cấu hình hạn được duyệt, dùng đơn mới rồi khôi phục cài đặt; không âm thầm rút hạn2giờ mặc định.

Thử tắt backend rồi khởi động lại sau cutoff trên dữ liệu thử: catch-up xử lý, không giữ kho vô hạn. Race receipt/expiry kiểm bằng PostgreSQL thật, không dùng timeout JS làm bằng chứng đúng thứ tự commit.

### M4.7.2 — Tiền muộn/sau hủy

Đơn bank đã hết hạn: ghi tiền → LATE_PAYMENT, không phục hồi/giữ hàng. Đơn hủy trước deadline mà nhận tiền → PAYMENT_AFTER_CANCELLATION và nghĩa vụ trả phần mới chưa xử lý. Ví dụ due230.000, đã thu dư260.000: dư30.000 đã có nghĩa vụ, hủy chỉ thêm230.000, tổng260.000; không thành290.000. QR/số cần trả phải phản ánh trạng thái hiện tại, không tiếp tục hướng khách trả cho đơn hủy.

### M4.8.1 — Đơn Instagram

ADMIN vào form dự kiến `/admin/orders/instagram`, nhập recipient giả và chọn SKU/method, xem tổng rồi tạo. Mong đợi source Instagram, giữ kho/tính tiền qua pipeline chung, không tự gán tài khoản theo SĐT/email. Thử duplicate key, hàng thiếu, bank chưa cấu hình và rate/quyền theo contract admin; không dùng form để bypass ràng buộc.

### M4.9.1 — Giao thất bại

Đơn SHIPPED → ghi thất bại có lý do → DELIVERY_FAILED. OnHand không tăng, chưa coi nhận lại hàng và không chuyển SHIPPED thẳng sang CANCELLED. Lịch sử giữ tracking/actor/version.

### M4.9.2 — Nhận hàng về shop

Chỉ thử sau khi chủ shop chốt chính sách hoàn tiền/phí giao. Đơn xuất3đơn vị, nhận2 trong đó1bán lại được/1hỏng → chỉ cộng1onHand; đơn vị chưa nhận còn trạng thái cần xử lý, không tự restock cả3. Gửi lại cùng hiệu ứng không cộng thêm. COD chưa thu không phát sinh tiền hoàn giả; bank đã thu tạo nghĩa vụ theo chính sách và nguồn tiền, không tự gửi tiền.

### M4.10.1 — Mail tạo đơn

MAIL_MODE=preview; tạo đơn có email thử → xem mailbox local theo README, có thông tin/link đúng đơn nhưng không đưa link vào log/bằng chứng chia sẻ. Không có email vẫn đặt được và shop nhận thông báo theo cài đặt đã chốt. Giả lập mail lỗi trong test: đơn/giữ kho vẫn tồn tại, có delivery intent chờ xử lý, replay create không gửi thêm thư tùy tiện.

### M4.10.2 — Retry và mail trạng thái

Đổi trạng thái hợp lệ → delivery đúng event. Test delivery thất bại/retry/restart với provider giả hoặc preview: cùng event không tạo thêm order/stock/receipt, retry có giới hạn; không sửa mail auth hiện có để biến mọi lỗi thành thành công giả. Không dùng email khách thật khi thử.

### M4.11.1 — Nghiệm thu toàn luồng

Chạy các kịch bản độc lập sau trên local/`_test`:

| Luồng | Điểm phải chứng minh |
|---|---|
| COD | Guest cart → quote → order → token/lookup → admin confirm/pack/ship/deliver → đối soát COD; đủ snapshot/ledger/history |
| Hủy | Guest/admin hủy trước ship, request lúc PACKING, approve/reject và race ship/cancel; không nhả kho hai lần |
| Bank | VietQR → partial/full/excess → expiry/restart → late/after-cancel; không revive hoặc tạo nghĩa vụ đôi |
| Instagram | Admin tạo qua pipeline chung, không gán owner theo dữ liệu liên hệ |
| Giao thất bại | Ghi thất bại chưa restock; thực nhận/kiểm tra mới nhập phần bán được và ghi nghĩa vụ đúng |
| Quyền/mạng/mobile | Token sai, uniform lookup error, CSRF/role/rate, key replay khác payload, response mất, URL deep link, 390px/keyboard/input dài |
| Mail/persistence | Email lỗi sau commit không mất đơn; restart giữ đơn/kho/ledger và catch-up đúng |

Chạy các lệnh kiểm tra ở mục4, ghi số ca/kết quả thật và các mục chưa chạy. Sau đó người dùng thao tác theo từng luồng để xác nhận; agent không tự đánh dấu nghiệm thu hay mở bán vì CI xanh.

## 4. Kiểm tra tự động dự kiến

Các lệnh đã tồn tại; M4 đã có test cho phần nền, Settings và giỏ. Kết quả từng lượt xem progress; không skip test M3 hay tăng timeout để che lỗi. Điều kiện `_test` phải được kiểm tra trước bất kỳ setup/cleanup DB nào.

```powershell
.\tools\npm.ps1 run typecheck
.\tools\npm.ps1 run build
.\tools\npm.ps1 test
.\tools\npm.ps1 run test:integration
.\tools\npm.ps1 run test:e2e:implemented
```

Chỉ cài browser test nếu máy thiếu và phần E2E đã được giao, theo `test:e2e:install` trong README. Chọn unit/UI/DB/E2E theo rủi ro: giữ kho/tiền/race bắt buộc PostgreSQL thật; form/URL/error có UI test; cookie/CSRF/proxy và guest/admin có browser thật. Test chỉ dọn fixture thuộc lượt đó, không dọn namespace rộng có sẵn.

## 5. Điểm dừng

**Điểm dừng: M4.2.1 giỏ hàng + M4.2.2 báo giá server, chờ người dùng chạy thử.** M4.3.1 tạo đơn và các phần sau cần kế hoạch riêng được duyệt trước khi code. Trạng thái chi tiết và kết quả thật: [progress.md](../progress.md).
