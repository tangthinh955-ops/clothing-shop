# M4 — Bán hàng: kế hoạch triển khai (Implementation Plan)

> Cập nhật 29/10/2026. **Người B phụ trách toàn bộ M4**: frontend khách, admin, API, dữ liệu và kiểm thử. Người dùng mới duyệt lập bộ tài liệu này; chưa duyệt code bất kỳ phần M4 nào. Mỗi phần vẫn phải gửi bảng kế hoạch trong chat → chờ duyệt → triển khai → kiểm tra → bàn giao → dừng để người dùng thử.

**Mục tiêu (Goal):** khách đặt COD/chuyển khoản không cần tài khoản, tra cứu/hủy đúng đơn; admin xử lý đơn, kho và khoản thu có lịch sử, không ghi lặp.

**Kiến trúc (Architecture):** React → API client chung → Nest Controller/DTO/Guard → service điều phối → Prisma/PostgreSQL. Orders điều phối Inventory/Payments/Settings bằng cùng transaction; Payments không gọi ngược Orders. Email, QR render và file I/O ở ngoài transaction giữ khóa.

**Stack (Tech Stack):** giữ stack và phiên bản trong package/lockfile hiện hành, Node 24.22.1+ trên dòng 24, npm workspaces. Chưa thêm dependency trong bước tài liệu; thư viện tạo QR nếu cần phải có lý do và được ghi trong kế hoạch riêng M4.6.1.

**Đặc tả (Spec):** [business-rules.md](business-rules.md), [architecture.md](architecture.md), [plan.md](plan.md), [acceptance-checklist.md](acceptance-checklist.md). **Chạy thử tương ứng:** [local-trial-m4.md](local-trial-m4.md). Trạng thái thực tế luôn đọc từ [progress.md](../progress.md).

**Dành cho agent:** thực thi trực tiếp từng phần theo `executing-plans`/AGENTS.md; test hành vi trước implementation khi phù hợp. Không suy ra quyền commit/push/deploy từ việc duyệt tài liệu. Tên file mới bên dưới là **dự kiến**, phải khảo sát lại và gửi danh sách đầy đủ, cụ thể trong chat trước phần đó; bảng tổng quan không thay thế bước duyệt.

## 1. Điểm xuất phát và ranh giới

- Khảo sát tại `main` `9386f0a`: đã có catalog, admin sản phẩm/danh mục/kho, session/CSRF và mail auth. Chưa có module Settings/Orders/Payments hoặc giỏ/checkout/tra cứu đơn M4.
- M3.16.1 đã có catalog/API trên VPS theo progress; điều này không có nghĩa M4 đã deploy hoặc được phép mở bán. Không truy cập VPS, DB, ảnh, backup hay dữ liệu khách thật trong lượt lập kế hoạch/kiểm tra local.
- Chính sách mới thay thế phương án demo cũ: **checkout không tài khoản; phí giao mặc định 30.000đ; hạn chuyển khoản mặc định 2 giờ, sửa cho đơn mới qua Settings; VietQR tạo trong ứng dụng shop**. Không dùng yêu cầu CUSTOMER/email verified hoặc hạn 30 phút của thiết kế cũ.
- Tài khoản CUSTOMER cũ giữ nguyên, không trở thành điều kiện đặt hàng. ADMIN vẫn dùng session/role/CSRF; khách chỉ có quyền trên đúng đơn qua cơ chế tra cứu được kiểm chứng.
- Không có giỏ hàng/checkout giả. Mỗi phần UI phải nối dữ liệu thật local; phần nền tảng không UI phải có cách kiểm tra DB/API rõ ràng.
- Đổi/trả tự động, tài khoản/lịch sử khách theo login, cổng ngân hàng/webhook, tự chuyển tiền và tự hoàn tiền không thuộc M4. Hoàn tiền thủ công được ghi kết quả/audit, không thực hiện chuyển tiền trong app.
- Mỗi phần một nhánh dự kiến `feat/m4-<ma-phan>-<ten>` từ trạng thái đã tích hợp phần phụ thuộc; mỗi lần chỉ một migration đang triển khai. Không sửa migration đã áp dụng, không reset DB để chữa lỗi.

## 2. Ràng buộc xuyên suốt (Global Constraints)

1. Backend quyết định giá, phí, tổng, quyền, điều kiện thanh toán và chuyển trạng thái. Tiền nguyên VND, đơn vị ≤100.000.000đ, đơn ≤1.000.000.000đ; quantity nguyên 1..99/dòng, tối đa50 dòng sau gộp biến thể trùng.
2. Quote có hạn, không giữ hàng. Khi tạo đơn phải kiểm tra lại giá/phí/hiển thị/biến thể/tồn; `QUOTE_CHANGED` yêu cầu khách xác nhận lại, không tự tăng tiền.
3. Đơn/sản phẩm/giá/phí/người nhận/phương thức/deadline lưu snapshot. Đổi Settings hay giá sản phẩm không viết lại đơn cũ.
4. Tạo đơn giữ `reserved`; hủy trước xuất chỉ giảm `reserved`; bàn giao giảm cả `onHand` và `reserved` đúng một lần. Mọi SKU trong cùng transaction, thứ tự khóa ổn định, ledger có tham chiếu hiệu ứng chống lặp.
   Ledger phải phân biệt actor admin/guest/system và nguồn hiệu ứng; migration giữ lịch sử M3. Không tạo tài khoản ADMIN giả để gán actor cho đơn khách vãng lai hoặc expiry.
5. Mutation quan trọng dùng Idempotency-Key, canonical request hash, resource/result lưu cùng commit; khác payload cùng key →409. Scope guest do server xác định, không tin actor do client gửi và không dùng IP làm định danh duy nhất.
6. Mất phản hồi sau ghi: khóa payload đang gửi, cho truy lại/gửi lại đúng key/body; không tự tạo key mới để đặt/thu/hoàn lần nữa. Không tự retry mutation ngoài cơ chế này; ref đồng bộ chặn bấm lặp trước khi state pending cập nhật.
7. Token tra cứu ≥128 bit, server chỉ lưu hash; không token rõ trong DB nghiệp vụ, log, URL query gửi HTTP, localStorage hoặc tài liệu. Chi tiết token fragment/header và phục hồi kết quả tạo đơn khi mất response phải chốt ở M4.0.1, kiểm chứng ở M4.3.1/M4.4.1.
8. Chuẩn hóa SĐT trước so sánh/giới hạn. Chống tạo đơn theo IP/SĐT/số PENDING; lookup sai trả thông báo đồng nhất, có rate limit. Không tự gán đơn cho tài khoản theo SĐT/email.
9. Trạng thái giao hàng, tiền thu và nghĩa vụ hoàn tách riêng. Giao COD thành công không tự thành PAID. Bank nhận trùng reference không tạo khoản thu mới; dư/muộn/sau hủy ghi ngoại lệ và nghĩa vụ đúng nguồn, không phục hồi đơn hủy.
10. Đủ tiền bank phải trước deadline theo thời gian DB; ghi tiền và expiry khóa cùng order. Có sweep/catch-up sau restart, không chỉ timer hoặc đồng hồ trình duyệt. Chưa có ngân hàng hợp lệ thì không cho chọn bank, COD vẫn dùng được.
11. Giỏ local chỉ variantId/quantity/schemaVersion; tên/SĐT/địa chỉ/email trong form memory, không persist hay log PII. Test dùng fixture giả, không dùng dữ liệu khách thật hoặc chuyển tiền thật.
12. Query cache cho server state, URL cho filter/page, state gần form cho draft. Có loading/empty/error/retry/success, keyboard/focus/label rõ, 390px không tràn ngang; thông báo không lộ dữ liệu nội bộ.
13. Đơn commit thành công dù gửi email thất bại; tạo delivery intent có kiểm soát, worker gửi/retry ngoài transaction. Không bắt lỗi rồi báo đơn thất bại khiến khách đặt lại.

## 3. Bảng chia phần và phụ thuộc

Tình trạng từng phần xem mục điểm dừng và progress. Cột chạy thử là tiêu chí, không phải kết quả pass. Tên URL/API xem mục4; hướng dẫn thao tác chi tiết cùng mã ở tài liệu local.

| Mã | Thay đổi người dùng thấy được | Phạm vi chính | Chạy thử / kết quả mong đợi | Phụ thuộc |
|---|---|---|---|---|
| M4.0.1 | Chưa có UI mới | Chốt contract/state/schema outline, cơ chế guest/recovery và các quyết định còn mở | Rà bảng API/quyền/trạng thái/race; phân biệt quyết định đã chốt với đề xuất | Tài liệu hiện hành |
| M4.0.2 | Chưa có UI mới | Schema COD/quote/settings/idempotency/token hash/lịch sử; actor/nguồn hiệu ứng ledger cho guest/system | Migration lên DB test riêng; constraint, rollback và unique test đạt; giữ lịch sử admin M3, không thay DB production | 0.1 |
| M4.0.3 | Chưa có UI mới | Inventory reserve/release/ship dùng TransactionClient của Orders | Hàng cuối chỉ một thắng, nhiều SKU rollback cùng nhau, replay không ghi ledger lặp | 0.2 |
| M4.1.1 | Admin xem Cài đặt | GET settings admin và public allowlist; đọc mặc định an toàn | Admin xem phí30.000/hạn120phút; public không nhận secret; CUSTOMER không vào admin | 0.2 |
| M4.1.2 | Admin lưu Cài đặt | PATCH version, phí/deadline/tài khoản ngân hàng | Hai tab: bản cũ409; refresh giữ dữ liệu; không đổi snapshot đã tạo | 1.1 |
| M4.2.1 | Khách thêm/sửa/xóa giỏ | Chọn variant/quantity, cart local và giải quyết thông tin từ API public | Refresh giữ giỏ; hàng ẩn/mất/vô hiệu báo rõ; không lưu giá/PII/token | 0.1 |
| M4.2.2 | Khách thấy tạm tính | POST quote, giá/phí/tổng từ server, quote có hạn | 2×200.000 +1×300.000 +30.000 =730.000; reserved không đổi | 2.1, 1.2 |
| M4.3.1 | Khách đặt COD và nhận xác nhận | Contact/address, validation/anti-abuse, POST order atomic + idempotency, màn kết quả | Không login; đặt thật, thiếu một SKU rollback hết, lost response replay cùng đơn; limit không giữ hàng | 2.2, 0.3 |
| M4.4.1 | Mở chi tiết đơn qua link | Token guard/hash, đọc đúng order, timeline/money summary và reload theo cơ chế đã chốt — **đã triển khai** | Link đúng mở được, sai không lộ đơn; token không nằm trong log/storage | 3.1 |
| M4.4.2 | Tra cứu bằng mã đơn +SĐT | Form lookup, chuẩn hóa, uniform failure và rate limit | Đúng vào đúng đơn; sai mã/sai SĐT cùng thông báo; không liệt kê các đơn khác | 4.1 |
| M4.4.3 | Khách hủy trước đóng gói | PENDING/CONFIRMED →CANCELLED, lý do/version/key | reserved giải phóng một lần; không hủy được đơn khác/đã SHIPPED | 4.1, 0.3 |
| M4.4.4 | Khách gửi yêu cầu hủy khi PACKING | CancellationRequest, không tự đổi trạng thái đơn | Yêu cầu hiện pending, đơn vẫn PACKING; gửi lặp không tạo yêu cầu trùng | 4.3, 5.4 |
| M4.5.1 | Admin xem danh sách đơn | GET list, filter/page trên URL | Đơn thật từ checkout xuất hiện; trạng thái/tiền riêng, quyền ADMIN | 3.1 |
| M4.5.2 | Admin mở chi tiết và ghi chú | GET detail/snapshot/history; note có audit | Refresh giữ ghi chú; không sửa hồi tố item/giá/địa chỉ bằng ghi chú | 5.1 |
| M4.5.3 | Admin xác nhận COD | PENDING →CONFIRMED | Đúng version; trạng thái sai409; lịch sử có actor/thời gian | 5.2 |
| M4.5.4 | Admin đóng gói | CONFIRMED →PACKING | Khách chỉ xin hủy; thao tác lặp không thêm hiệu ứng | 5.3 |
| M4.5.5 | Admin bàn giao | PACKING →SHIPPED, tracking, inventory ship | onHand/reserved cùng giảm đúng lượng; cancel/ship đồng thời có một kết quả hợp lệ | 5.4, 0.3 |
| M4.5.6 | Admin ghi giao thành công | SHIPPED →DELIVERED, deliveredAt | Không trừ kho lần nữa; chưa tự ghi thu COD | 5.5 |
| M4.5.7 | Admin hủy trước bàn giao | Hủy PENDING/CONFIRMED/PACKING có lý do | Giải phóng giữ một lần; bank đã thu chỉ tạo phần nghĩa vụ còn thiếu, không coi đã hoàn | 5.2, 0.3; mở rộng kiểm chứng khi6.2 có |
| M4.5.8 | Admin duyệt/từ chối yêu cầu hủy | Cancellation decision qua cùng cancel pipeline | Duyệt hủy một lần; từ chối giữ trạng thái; ship/duyệt hủy không cùng thắng | 4.4, 5.7 |
| M4.6.1 | Khách đặt bank và xem VietQR | Payment schema cần thiết, method bank/deadline snapshot, QR trong shop + thông tin dạng chữ | QR đúng ngân hàng/số tiền còn phải trả/mã đơn; chưa thu tiền; không gửi dữ liệu sang dịch vụ QR ngoài | 3.1, 4.1, 1.2 |
| M4.6.2 | Admin ghi khoản chuyển vào | Receipt immutable, reference unique, allocation/obligation trong cùng transaction | Thiếu chưa PAID; đủ trước hạn mới confirm; dư phân bổ đúng, key/reference trùng không thu lặp | 6.1, 5.3 |
| M4.6.3 | Admin xem sổ thu và nghĩa vụ | Ledger read-only/filter/page, trạng thái tiền độc lập | Từ khoản thu truy tới đơn/phần phân bổ/phần cần hoàn; không lộ cho khách khác | 6.2 |
| M4.6.4 | Admin đối soát COD | Ghi khoản COD thực nhận với mã đối soát | Giao xong chưa thu vẫn chưa PAID; ghi thu/replay không tạo hai receipt | 5.6, 6.2 |
| M4.6.5 | Admin ghi kết quả hoàn thủ công | Theo dõi RefundObligation/Refund, audit nguồn tiền; không chuyển tiền tự động | Ghi phần đã hoàn không vượt nghĩa vụ/receipt; hủy không tự thành đã hoàn | 6.3; chốt UI tối thiểu ở0.1 |
| M4.7.1 | Bank quá hạn được hủy/nhả giữ | Sweep, startup catch-up, cutoff DB và phối hợp checkout | Hạn2giờ có hiệu lực qua restart; nhận đủ tiền/expiry tranh chấp không xử lý đôi; COD không hết hạn bank | 6.2, 5.7 |
| M4.7.2 | Admin thấy tiền muộn/sau hủy | Ngoại lệ và phần nghĩa vụ chưa được dành cho hoàn; cập nhật QR theo trạng thái | Không tự revive/reserve; receipt sau CANCELLED cần hoàn toàn bộ phần chưa xử lý, không double-count dư | 7.1, 6.3 |
| M4.8.1 | Admin tạo đơn Instagram | Form recipient/items/method, dùng chung quote/create/stock/payment | Có nguồn Instagram; userId nullable; không gán owner theo số/email, không bypass giá/kho | 3.1, 5.2, 6.1 |
| M4.9.1 | Admin ghi giao thất bại | SHIPPED →DELIVERY_FAILED | Chưa nhập lại kho, không hủy thẳng đơn đã xuất | 5.5 |
| M4.9.2 | Admin nhận hàng về shop | Thực nhận/bán lại được/hỏng/thiếu, stock receipt và financial obligation | Chỉ restock phần bán được; nhận lặp không cộng thêm; phần thiếu còn cần xử lý | 9.1, 6.3; chủ shop chốt chính sách hoàn trước code |
| M4.10.1 | Shop/khách có email nhận thư tạo đơn | NotificationDelivery intent + mail preview ngoài transaction | Không email vẫn đặt được; mail lỗi không rollback; không gửi lại vô hạn/trùng mỗi lần replay | 3.1; rà thêm8.1 |
| M4.10.2 | Thư trạng thái và retry | Worker retry có giới hạn, nhận lại sau restart, thông báo trạng thái liên quan | Retry cùng delivery, không tạo lại đơn/kho/thu; không lộ link/token trong log | 10.1, 5.x, 7.x |
| M4.11.1 | Người dùng thử trọn luồng M4 | Full E2E/integration, quyền, money/stock races, mobile, restart và runbook | Ghi từng ca đã chạy/chưa chạy; dừng nghiệm thu; không tự deploy/open sale | Các phần trước |

`5.x`, `7.x` ở bảng chỉ nhóm phần phụ thuộc, không phải mã để ghi nghiệm thu; nghiệm thu luôn dùng mã cụ thể.

### Thứ tự thực hiện của Người B

`0.1 → 0.2 → 0.3 → 1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 4.1 → 4.2 → 4.3 → 5.1 → 5.2 → 5.3 → 5.4 → 4.4 → 5.5 → 5.6 → 5.7 → 5.8 → 6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 7.1 → 7.2 → 8.1 → 9.1 → 9.2 → 10.1 → 10.2 → 11.1`.

Đây là thứ tự đề xuất; có thể đổi khi có lý do phụ thuộc rõ và cập nhật tài liệu, không tự bỏ bước duyệt. Hoàn tất một phần không tự cho phép làm phần sau. Các tính năng bank không được phát hành production ở trạng thái thiếu expiry/exception handling.

## 4. Contract và điểm phải chốt trước implementation

Các endpoint dưới đây là **dự kiến theo architecture**, chưa có nghĩa API đã tồn tại. Prefix `/api/v1`.

| Phần | API / đầu vào chính | Đầu ra / trách nhiệm |
|---|---|---|
| Settings | GET `/shop-settings/public`; GET/PATCH `/admin/settings` với expectedVersion | Allowlist public; admin validate, version; không credentials/secrets trong response |
| Cart resolve | POST `/cart/resolve` `{items:[{variantId,quantity}]}` | Đã viết M4.2.1; đọc thông tin public của IDs trong giỏ, báo hàng không còn bán; không tạo quote/giữ kho. Đi qua CSRF/client chung, không dùng admin API |
| Quote | POST `/checkout/quote` `{items:[{variantId,quantity}],method}` | quoteId/currency/subtotal/shippingFee/total/expiresAt/settingsVersion; không reserved |
| Create | POST `/orders`, header Idempotency-Key, quoteId/items/contact/address/method | Mã đơn, snapshot xác nhận và cách tra cứu; guest throttle; cùng transaction order/items/history/stock/idem |
| Lookup | GET `/orders/:code` với token header; POST `/orders/lookup` mã+SĐT | Đúng một đơn; uniform404; token không query; quyền hủy phải được xác định ở server |
| Guest cancel | POST `/orders/:code/cancel`, `/cancellation-requests` | Token/quyền từ lookup + reason/expectedVersion/key; không tin code/SĐT đơn thuần làm quyền mutation |
| Admin orders | GET `/admin/orders[/:id]`; POST confirm/pack/ship/deliver/cancel/cancellation-decisions | SessionGuard/RolesGuard; state/version/key; note endpoint bổ sung chốt trước5.2 |
| Receipts | POST `/admin/orders/:id/payments` | amount/time/method/account/reference/note; immutable ledger và allocation/exception |
| Payments/refund | GET `/admin/payments`, `/admin/refund-obligations`, `/admin/refunds`; POST ghi kết quả hoàn theo contract architecture | Theo dõi nghĩa vụ/ghi kết quả tiền thực hiện ngoài app; không gọi ngân hàng |
| Instagram/failure | POST `/admin/orders/instagram`, `/admin/orders/:id/delivery-failure`, `/return-receipt` | Orders điều phối cùng transaction; form không bypass quy tắc chung |

### Các quyết định cần bàn giao ở M4.0.1

**Trạng thái 29/10/2026: M4.0.1 đã được duyệt và chốt tại [m4-contract.md](m4-contract.md)** — state machine, DTO/error dự kiến, snapshot, actor, idempotency, token, thứ tự khóa đã ghi; các con số chống spam/quote TTL/retention là đề xuất chờ duyệt riêng; phương án token mặc định là "phát một lần, replay không phát lại". Các mục bên dưới giữ làm phạm vi tham chiếu gốc:

- Chốt DTO/response/status/error (`QUOTE_CHANGED`, validation, uniform404,409,429) và state machine, bao gồm đường hủy/thu/xuất đồng thời.
- Chốt nguồn danh mục tỉnh/thành, phường/xã và phiên bản dữ liệu phù hợp shop; cách nhập địa chỉ, giới hạn độ dài, chuẩn hóa SĐT. Không tự nhập dataset hành chính hoặc thêm provider trong bước tài liệu này.
- Trình phương án và xin chủ shop duyệt các con số chống đơn ảo/lookup, giới hạn PENDING theo SĐT, quote TTL và cách cấu hình vận hành. Phí30.000/hạn2giờ đã chốt, không xin lại.
- Chốt scope guest idempotency, expiry/retention của key, rate limit, token lifecycle, cách reload link và phục hồi lost response: chỉ lưu hash token nhưng vẫn truy lại cùng resource an toàn; không giải quyết bằng lưu token rõ trong IdempotencyRecord hoặc tạo đơn mới. Đây là tiêu chí bắt buộc trước POST create, không để tới sau mở bán.
- Chốt tối thiểu ledger/nghĩa vụ/kết quả hoàn thủ công trong M4, tách khỏi module Returns/exchange ngoài phạm vi. Chính sách tiền hàng/phí giao khi giao thất bại phải được chủ shop xác nhận trước M4.9.2.
- Chốt method/snapshot khi đổi tài khoản ngân hàng, QR khi partial payment/expired/cancelled, thứ tự triển khai để không mở bank khi còn thiếu kiểm soát deadline.

## 5. File dự kiến và quyền sở hữu trách nhiệm

**Mọi file mới ở bảng này là dự kiến, chưa được tạo trong bước lập kế hoạch.** Khi chia kế hoạch phần cụ thể, liệt kê đầy đủ cả file gọi/chỉnh route, tests, migration, môi trường và tài liệu thực sự cần thay đổi. Không tạo file trống để khớp sơ đồ.

| Phần | Đường dẫn chính dự kiến | Trách nhiệm / kiểm tra |
|---|---|---|
| 0.1 | `docs/architecture.md`, `docs/business-rules.md`, `docs/m4-implementation-plan.md` | Chốt quyết định được duyệt; không tự đổi nghiệp vụ |
| 0.2 | `apps/backend/prisma/schema.prisma`, `apps/backend/prisma/migrations/<timestamp>_m4_order_core/migration.sql`, `apps/backend/test/orders-foundation.integration.spec.ts` | Order/Item/History/Quote/Settings/Idempotency và constraints; timestamp chọn lúc tạo, không sửa migration cũ |
| 0.3 | `apps/backend/src/modules/inventory/inventory.service.ts`, `apps/backend/src/modules/inventory/inventory.module.ts`, `apps/backend/test/inventory-orders.integration.spec.ts` | Thêm thao tác reserve/release/ship nội bộ, giữ API điều chỉnh M3; test cạnh tranh/rollback/ledger |
| 1.x | `apps/backend/src/modules/settings/settings.module.ts`, `apps/backend/src/modules/settings/settings.controller.ts`, `apps/backend/src/modules/settings/admin-settings.controller.ts`, `apps/backend/src/modules/settings/settings.service.ts`, `apps/backend/src/modules/settings/dto/settings.dto.ts` | GET public/admin, PATCH validate/version, default fee/deadline không bank mặc định |
| 1.x UI | `apps/frontend/src/features/admin/settings/api/settings.api.ts`, `apps/frontend/src/features/admin/settings/pages/SettingsPage.tsx`, `apps/frontend/src/features/admin/settings/pages/SettingsPage.test.tsx`, `apps/frontend/e2e/settings.spec.ts` | Admin form, snapshot/version và ACL; không public secret |
| 2.1 | `apps/frontend/src/features/cart/cart-store.ts`, `apps/frontend/src/features/cart/api/cart.api.ts`, `apps/frontend/src/features/cart/pages/CartPage.tsx`, `apps/frontend/src/features/cart/pages/CartPage.test.tsx`, `apps/frontend/src/features/catalog/pages/ProductDetailPage.tsx` | Local cart và add-to-cart; resolve variant qua public API, không phụ thuộc admin API |
| 2.1 resolver | `apps/backend/src/modules/products/cart-products.controller.ts`, `apps/backend/src/modules/products/dto/cart-items.dto.ts`, `apps/backend/src/modules/products/products.service.ts`, `apps/backend/src/modules/products/products.module.ts`, `apps/backend/test/cart-products.integration.spec.ts` | Endpoint đọc-only resolve IDs vì API detail hiện tại nhận slug; validate số dòng/qty, chỉ trả dữ liệu public, không thay stock |
| 2.2 | `apps/backend/src/modules/orders/checkout.controller.ts`, `apps/backend/src/modules/orders/checkout.service.ts`, `apps/backend/src/modules/orders/dto/quote.dto.ts`, `apps/frontend/src/features/checkout/api/checkout.api.ts`, `apps/frontend/src/features/checkout/pages/CheckoutPage.tsx` | Quote từ server và checkout preview, kiểm tra sản phẩm đang bán; unit/UI + integration quote |
| 3.1 | `apps/backend/src/modules/orders/orders.module.ts`, `apps/backend/src/modules/orders/orders.controller.ts`, `apps/backend/src/modules/orders/order-creation.service.ts`, `apps/backend/src/modules/orders/dto/create-order.dto.ts`, `apps/backend/src/modules/orders/guest-order-limit.guard.ts`, `apps/backend/src/modules/orders/order-idempotency.service.ts` | Public create, DTO/limits/quyền guest, idempotency lưu cùng transaction; không tạo universal framework khi chưa cần |
| 3.1 UI/test | `apps/frontend/src/features/checkout/components/ContactAddressForm.tsx`, `apps/frontend/src/features/checkout/pages/CheckoutPage.tsx`, `apps/frontend/src/features/checkout/pages/CheckoutPage.test.tsx`, `apps/backend/test/orders-create.integration.spec.ts`, `apps/frontend/e2e/checkout-cod.spec.ts` | Form thật, xác nhận/recovery và race hàng cuối/lost response |
| 4.x | `apps/backend/src/modules/orders/order-access.service.ts`, `apps/backend/src/modules/orders/order-access.guard.ts`, `apps/backend/src/modules/orders/order-cancellation.service.ts`, `apps/frontend/src/features/orders/api/orders.api.ts`, `apps/frontend/src/features/orders/pages/OrderLookupPage.tsx`, `apps/frontend/src/features/orders/pages/OrderDetailPage.tsx` | Token/lookup/hủy trên đúng đơn; không thêm yêu cầu login |
| 4.x test | `apps/backend/test/order-access.integration.spec.ts`, `apps/frontend/src/features/orders/pages/OrderLookupPage.test.tsx`, `apps/frontend/src/features/orders/pages/OrderDetailPage.test.tsx`, `apps/frontend/e2e/order-lookup.spec.ts` | Dò đơn/throttle/cancel/không lộ PII hoặc token |
| 5.x | `apps/backend/src/modules/orders/admin-orders.controller.ts`, `apps/backend/src/modules/orders/order-workflow.service.ts`, `apps/backend/src/modules/orders/dto/order-transition.dto.ts`, `apps/frontend/src/features/admin/orders/api/orders.api.ts`, `apps/frontend/src/features/admin/orders/pages/OrdersPage.tsx`, `apps/frontend/src/features/admin/orders/pages/OrderDetailPage.tsx` | Read/admin state, reason/version/history; component action tách theo trách nhiệm khi triển khai |
| 5.x test | `apps/backend/test/order-workflow.integration.spec.ts`, `apps/frontend/src/features/admin/orders/pages/OrderDetailPage.test.tsx`, `apps/frontend/e2e/admin-orders.spec.ts` | Chuyển hợp lệ/sai, bấm lặp, stale version và cancel/ship race |
| 6.x | `apps/backend/src/modules/payments/payments.module.ts`, `apps/backend/src/modules/payments/payments.service.ts`, `apps/backend/src/modules/payments/dto/payment.dto.ts`, `apps/backend/src/modules/payments/vietqr.service.ts`, `apps/backend/prisma/migrations/<timestamp>_m4_payments/migration.sql` | Receipts/allocations/obligations/manual results; QR local; Payments không gọi Orders |
| 6.x UI/test | `apps/frontend/src/features/orders/components/PaymentSummary.tsx`, `apps/frontend/src/features/admin/payments/api/payments.api.ts`, `apps/frontend/src/features/admin/payments/pages/PaymentsPage.tsx`, `apps/backend/test/payments.integration.spec.ts`, `apps/frontend/e2e/bank-payment.spec.ts`, `apps/frontend/e2e/cod-reconciliation.spec.ts` | QR/amount/deadline và ledger/admin input; test idempotency/reference/thiếu/dư/ngân sách hoàn |
| 7.x | `apps/backend/src/modules/orders/payment-expiry.service.ts`, `apps/backend/test/payment-expiry.integration.spec.ts`, `apps/frontend/e2e/payment-expiry.spec.ts` | Cutoff DB, sweep/catch-up; gọi Payments/Inventory trong cùng tx; UI dùng pages đơn/ledger đã có |
| 8.1 | `apps/backend/src/modules/orders/admin-orders.controller.ts`, `apps/backend/src/modules/orders/dto/instagram-order.dto.ts`, `apps/frontend/src/features/admin/orders/pages/InstagramOrderPage.tsx`, `apps/frontend/e2e/instagram-orders.spec.ts` | Tạo qua pipeline chung, source Instagram và guest recipient |
| 9.x | `apps/backend/src/modules/orders/delivery-failure.service.ts`, `apps/backend/src/modules/orders/dto/return-receipt.dto.ts`, `apps/frontend/src/features/admin/orders/components/ReturnReceiptDialog.tsx`, `apps/backend/test/delivery-failure.integration.spec.ts`, `apps/frontend/e2e/delivery-failure.spec.ts` | Hai bước ghi thất bại/thực nhận; không xây Returns tự động |
| 10.x | `apps/backend/src/modules/mail/mail.service.ts`, `apps/backend/src/modules/orders/order-notifications.service.ts`, `apps/backend/prisma/migrations/<timestamp>_m4_notifications/migration.sql`, `apps/backend/test/order-notifications.integration.spec.ts` | Delivery intent/retry và preview; không phá resend auth, không external I/O trong tx |
| Dùng chung khi cần | `apps/backend/src/app.module.ts`, `apps/frontend/src/app/App.tsx`, `apps/frontend/src/layouts/StoreLayout.tsx`, `apps/frontend/src/features/admin/AdminPage.tsx`, `package.json`, `.github/workflows/ci.yml` | Chỉ nối phần đã làm; thêm spec vào CI đúng thời điểm, không skip test M3 |
| 11.1 | `apps/frontend/e2e/sales-flow.spec.ts`, `docs/local-trial-m4.md`, `docs/acceptance-checklist.md`, `progress.md` | Full flow và bằng chứng; không mark toàn M4 đã deploy/được nghiệm thu từ test local |

### Lát cắt dữ liệu để lần theo code

- Giỏ/quote: chọn variant → cart store lưu IDs/qty → cartApi resolve IDs khi mở/refresh giỏ → checkoutApi POST quote → CheckoutService đọc Products/Settings → trả totals/expiry, không sửa Inventory.
- Tạo: ContactAddressForm + quote → order creation kiểm DTO/limits/idem và quote lại → reserve Inventory + order snapshots/history + key trong một tx → màn xác nhận; lỗi mạng giữ cùng command để truy lại.
- Hủy/xuất: action gửi token hoặc admin session + version/key → Orders kiểm quyền/state dưới khóa → Inventory release/ship + history → trả trạng thái, invalidate queries liên quan; frontend không tự cộng/trừ kho.
- Tiền: admin ghi receipt → Orders điều phối khóa order/nguồn, Payments kiểm ref/allocate/obligation → tx commit → UI ledger/money summary đọc server. QR và mail ở ngoài tx; QR không phải chứng cứ đã thu.
- Expiry: job hoặc catch-up lấy thời gian DB → khóa lại đơn/cutoff → cancel/release/exception theo cùng quy tắc với ghi tiền; restart không quên deadline.

## 6. Trọng tâm review và kiểm chứng (Review Focus)

| Nguy cơ | Phần chịu trách nhiệm | Bằng chứng phải có trước bàn giao |
|---|---|---|
| Response tạo đơn mất, token chỉ lưu hash, người dùng bấm lại sau reload | 0.1, 3.1, 4.1 | Cùng resource/key; có đường lấy lại đúng đơn, không lưu token rõ dài hạn, không reserve lần hai |
| Giá/phí/ẩn hàng thay đổi sau quote; giỏ bị chỉnh trong DevTools | 2.2, 3.1 | Backend quyết định; QUOTE_CHANGED và xác nhận lại; không dựa số tiền client |
| Hai khách tranh hàng cuối, hai SKU có thứ tự khác nhau; hủy và ship cùng lúc | 0.3, 3.1, 5.5, 5.7 | PostgreSQL thật; một kết quả hợp lệ, không âm kho/deadlock vô hạn, rollback mọi SKU |
| Thu đủ tiền và sweep đúng cutoff; tiền đến sau hủy, thu dư rồi hủy | 6.2, 7.1, 7.2 | Khóa chung order/nguồn; DB time; không revive/double-allocate/double-obligation |
| Dò token/mã+SĐT, phiên admin hết hạn, input dài và payload localStorage sai | 2.1, 3.1, 4.x, 5.x | Uniform failure/rate/ACL, parser an toàn; PII/token không log/persist; 390px/focus/error/retry |

Mỗi phần có test hành vi trước code khi phù hợp → xem RED đúng nguyên nhân → implementation tối thiểu → GREEN → rà cấu trúc → cập nhật progress/local guide → dừng. Không viết test soi tên file hoặc chỉ tăng số lượng.

### Lệnh kiểm tra sau từng phần code

Chạy từ root, chọn test mới theo rủi ro và giữ các kiểm tra bắt buộc; không chạy DB test khi chưa xác nhận `NODE_ENV=test`, PostgreSQL và database hậu tố `_test`.

```powershell
.\tools\npm.ps1 run typecheck
.\tools\npm.ps1 run build
.\tools\npm.ps1 test
.\tools\npm.ps1 run test:integration
.\tools\npm.ps1 run test:e2e:implemented
```

Integration/E2E mới phải dùng fixture riêng từng lượt, cleanup theo ID/file do lượt đó tạo; gặp namespace đã có phải từ chối hoặc cô lập, không xóa dữ liệu cũ theo slug/prefix rộng. Chưa có spec M4 thì không ghi nó đã chạy trong CI; thêm vào script khi phần tương ứng có UI/API hoàn chỉnh. Không cần chạy lại các lệnh app chỉ vì sửa tài liệu.

## 7. Theo dõi trạng thái và điều kiện chốt

- `Kế hoạch` → `Đã duyệt phần cụ thể` → `Đã viết` → `Agent đã kiểm tra local` → `Chờ người dùng thử` → `Người dùng xác nhận`. CI/deploy là bằng chứng riêng, không tự suy ra từ local.
- Cập nhật `progress.md` theo mã phần, ngày, file thực tế, lệnh/kết quả, giới hạn, test chưa chạy và điểm dừng; cập nhật checklist khi có chứng cứ. Không dùng dữ liệu khách thật minh họa.
- Trước mở bán phải chốt các phần bảo vệ/vận hành M3/M6/M7 liên quan, backup/restore và chính sách của shop; M4 không tự xử lý hay tự đánh dấu các mốc ấy đạt.
- M4.11.1 chỉ chốt khi COD/bank/Instagram, lookup/cancel, money/stock invariants, email failure và restart đã kiểm chứng; người dùng còn phải chạy thử. Không tự deploy hay commit/push sau khi code xong.

**Điểm dừng hiện tại (31/10/2026):** M4.0.1–M4.0.3, M4.1.1–M4.1.2, M4.2.1–M4.2.2, M4.3.1 đặt đơn COD không cần tài khoản (POST /orders + idempotency + quota SĐT + reserve + token tra cứu; FE form nhận hàng, replay mất-response, màn xác nhận) và **M4.4.1 xem đơn qua link riêng đã triển khai** (GET `/orders/:code` + `X-Order-Token`, 404 đồng nhất, rate 30/phút/IP; FE trang `/orders/:code#t=` giữ fragment, cache tách theo token) — tất cả đã kiểm tra local, kết quả thật ở [progress](../progress.md). Chờ người dùng chạy thử, chưa nghiệm thu. M4.4.2–M4.4.4 (tra cứu mã+SĐT, hủy) và M4.5 admin đơn chưa triển khai; cần kế hoạch/duyệt riêng.
