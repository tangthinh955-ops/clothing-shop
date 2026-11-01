# M4 Contract — bán hàng không tài khoản

Chốt ngày 29/10/2026 ở **M4.0.1**. Văn bản này ràng buộc schema (M4.0.2), nghiệp vụ kho (M4.0.3) và các phần M4.1–M4.11. Đặc tả nguồn: [business-rules.md](business-rules.md), [architecture.md](architecture.md), kế hoạch [m4-implementation-plan.md](m4-implementation-plan.md).

**Trạng thái quyết định trong tài liệu này:**
- **[ĐÃ DUYỆT]** — chính sách chủ shop đã chốt, là nghiệp vụ chính thức.
- **[ĐỀ XUẤT]** — con số/cơ chế đề xuất của người triển khai, chờ chủ shop duyệt; không được coi là nghiệp vụ chính thức và không chặn các phần phụ thuộc đã được duyệt.
- **[CƠ CHẾ]** — chi tiết kỹ thuật không đổi chính sách, người triển khai chốt để nhất quán giữa các phần.

## 1. Chính sách nền [ĐÃ DUYỆT]

- Khách đặt COD/chuyển khoản **không cần tài khoản**; token tra cứu là cơ chế truy cập đơn. Tài khoản CUSTOMER cũ giữ nguyên, không là điều kiện đặt hàng; ADMIN vẫn session/role/CSRF.
- Phí giao mặc định **30.000đ**; hạn chuyển khoản mặc định **2 giờ**, cấu hình cho đơn mới qua Settings.
- VietQR tạo trong ứng dụng shop; đổi/trả xử lý thủ công (không luồng tự động trong M4).
- Backend quyết định giá, phí, tổng, quyền, điều kiện thanh toán và chuyển trạng thái; quote **không giữ kho**.
- Không tạo ADMIN giả làm actor cho khách/hệ thống; không tài khoản ngân hàng mặc định; không lưu token rõ hay PII trong DB nghiệp vụ, log, URL query HTTP, localStorage.

## 2. State machine đơn

| Từ | Sang | Actor | Điều kiện | Hiệu ứng kho |
|---|---|---|---|---|
| — | PENDING | GUEST (web) / ADMIN (Instagram M4.8) | Quote còn hạn, giá/phí/settings khớp (khác → `QUOTE_CHANGED`), sản phẩm đang bán, đủ available | reserve mọi SKU trong cùng transaction |
| PENDING | CONFIRMED | ADMIN | COD: không cần thu; BANK (M4.6.2+): đủ tiền trước deadline theo giờ DB | — |
| CONFIRMED | PACKING | ADMIN | — | — |
| PACKING | SHIPPED | ADMIN | — | ship: giảm `onHand` và `reserved` cùng lượng, đúng một lần |
| SHIPPED | DELIVERED | ADMIN | — | ghi `deliveredAt`; không trừ kho lần nữa; COD chưa tự thành đã thu |
| SHIPPED | DELIVERY_FAILED | ADMIN (M4.9.1) | chưa nhập lại kho | — |
| DELIVERY_FAILED | RETURNED_TO_SHOP | ADMIN (M4.9.2) | thực nhận/kiểm tra theo chính sách được duyệt trước khi code | restock phần bán được = điều chỉnh kho admin có lý do |
| PENDING/CONFIRMED | CANCELLED | GUEST (đơn của mình qua token) hoặc ADMIN | trước PACKING với khách; giải phóng giữ một lần | release: chỉ giảm `reserved` |
| PACKING | CANCELLED | ADMIN (kể cả duyệt yêu cầu M4.5.8); GUEST chỉ gửi CancellationRequest | trước bàn giao | release khi hủy thành công |
| PENDING (bank) quá hạn | CANCELLED | SYSTEM | sweep/catch-up, deadline so với thời gian DB, lý do `PAYMENT_EXPIRED` | release |

- Không rewind trạng thái; SHIPPED không hủy thẳng (phải qua DELIVERY_FAILED → RETURNED_TO_SHOP).
- **Đường đồng thời:** mọi transition làm UPDATE có điều kiện `WHERE id = … AND version = expectedVersion` dưới khóa hàng đơn; cancel/ship/xác nhận tranh nhau → đúng một thắng, bên kia nhận 409; hiệu ứng kho chỉ nằm trong transaction của bên thắng. Replay cùng key không tạo hiệu ứng lần hai.
- Lịch sử `OrderStatusHistory` ghi from/to, actorType/actorId, lý do, version, thời gian; không xóa sửa.

## 3. Tách ba chiều trạng thái

1. **Giao hàng:** enum `OrderStatus` ở trên.
2. **Tiền thu (M4.6):** receipt bất biến theo khoản thực nhận; trạng thái tiền của đơn suy ra từ phân bổ (chưa thu / một phần / đủ) — giao COD thành công **không** tự PAID; bank phải đủ trước deadline mới CONFIRMED được.
3. **Nghĩa vụ hoàn:** dư thu / thu sau hủy / hoàn theo chính sách giao thất bại tạo `RefundObligation`; kết quả hoàn ghi thủ công (M4.6.5). Không tự chuyển tiền.
- M4.0.2 chỉ tạo bảng đơn; bảng Payment/Allocation/Obligation tạo ở M4.6 khi triển khai, không tạo sẵn.

## 4. Snapshot bắt buộc lúc tạo đơn

Item (variantId, sku, size, color, tên sản phẩm, đơn giá, quantity, lineTotal), subtotal, phí, tổng, `VND`, phương thức, người nhận (họ tên, SĐT chuẩn hóa, email tùy chọn, tỉnh/thành, quận/huyện, phường/xã, địa chỉ chi tiết, ghi chú tùy chọn), `bankDeadlineAt` (chỉ BANK), `settingsVersion`. Đổi Settings/giá sau đó không viết lại đơn cũ.

## 5. DTO, response và error

Prefix `/api/v1`, envelope lỗi hiện có `{code, message, fieldErrors, requestId}`. Endpoint **dự kiến theo architecture.md**; DTO chi tiết chốt lại trong kế hoạch từng phần khi triển khai:

| Phần | Request chính | Response thành công | Lỗi |
|---|---|---|---|
| Giỏ | POST `/cart/resolve` `{items:[{variantId,quantity}]}` | `{items:[{variantId,status,...thông tin công khai}]}`; chỉ đọc, qua CSRF, không giữ kho | 400 validation; 403 CSRF |
| Quote | POST `/checkout/quote` `{items:[{variantId,quantity}], method}` — **đã triển khai M4.2.2, chỉ COD** | `{quoteId, method, currency, items:[{variantId,productName,sku,size,color,unitPriceVnd,quantity,lineTotalVnd}], subtotal, shippingFee, total, settingsVersion, serverNow, expiresAt}`; lỗi: 400 `VALIDATION_ERROR` (input sai, giỏ rỗng, quá 50 dòng sau gộp/100 dòng thô, >99/variant sau gộp, tổng >1 tỷ), 409 `ITEM_UNAVAILABLE`/`OUT_OF_STOCK` kèm variantId client gửi qua `fieldErrors[items.variantId]`, 429 rate limit hiện có. Transaction RepeatableRead đọc nhất quán product/inventory/settings, ghi 1 row CheckoutQuote, `serverNow`/`expiresAt` lấy từ `now()` PostgreSQL, TTL 15 phút | 403 khi thiếu CSRF |
| Tạo đơn — **đã triển khai M4.3.1, chỉ COD** | POST `/orders`, header `Idempotency-Key` (`[A-Za-z0-9_-]{16,120}`, client dùng UUID), body `{quoteId, items, contact{name,phone,email?}, address{province,district?,ward,addressLine}, note?, method}` | 201 `{order:{code,status:PENDING,method,currency,items,subtotal,shippingFee,total}, lookupToken?, replay?}` — lookupToken 192-bit base64url chỉ trả lần đầu; replay trả cùng order không phát lại token; response lưu chống lặp không chứa token/PII | 400 `VALIDATION_ERROR`; 409 `QUOTE_CHANGED` (hết hạn theo giờ DB/giỏ khác/giá-phí-settings đổi), `OUT_OF_STOCK`, `ITEM_UNAVAILABLE` (kèm variantId qua fieldErrors), `CONFLICT` (key khác nội dung); 429 rate 5/phút/IP và quota 3 đơn PENDING/SĐT (chuẩn hóa một dạng qua `normalizeVietnamesePhone`) |
| Xem đơn — **đã triển khai M4.4.1** | GET `/orders/:code`, token **chỉ** ở header `X-Order-Token` (không bao giờ ở query string); rate 30/phút/IP | 200 `{order:{code,status,method,currency,createdAt,items:[{variantId,productName,sku,size,color,unitPriceVnd,quantity,lineTotalVnd}],subtotal,shippingFee,total,recipient:{name,phone,email,province,district,ward,addressLine,note}}, timeline:[{fromStatus,toStatus,actorLabel,reason,version,at}]}` — chỉ trường cho phép (allowlist), lấy từ snapshot đơn; timeline xếp `version asc`; actor là vai (`Cửa hàng`/`Khách đặt hàng`/`Hệ thống`), không tên nhân viên; đọc không ghi, giữ `Cache-Control: no-store` | 404 **đồng nhất** cho code sai/không có/thiếu token/token sai/token của đơn khác |
| Tra cứu — **đã triển khai M4.4.2** | POST `/orders/lookup` `{code, phone}` — qua CSRF/origin, không cần login; rate 5/phút/IP | 200 view allowlist như Xem đơn + `lookupToken` mới; xác minh SĐT, thay `lookupTokenHash` và đọc snapshot trong một transaction — link cũ hết hiệu lực, hai lookup đồng thời chỉ còn token thay hash cuối; SĐT chuẩn hóa một dạng qua `normalizeVietnamesePhone`, mã trim/uppercase | 400 `VALIDATION_ERROR` (thiếu/sai dạng); 404 **đồng nhất** cho mã không tồn tại hoặc SĐT sai, không lộ phần nào đúng và không liệt kê đơn khác cùng SĐT; 403 CSRF; 429 |
| Hủy khách | POST `/orders/:code/cancel` với token + `{reason, expectedVersion, Idempotency-Key}` | đơn `CANCELLED` | 404; 409 trạng thái/version; 429 |
| Admin chuyển trạng thái — **confirm đã triển khai M4.5.3, chỉ COD** | POST `/admin/orders/:id/{confirm,pack,ship,deliver,cancel,cancellation-decisions}` session + `{expectedVersion, Idempotency-Key, …}` | 200 đơn sau chuyển `{id,code,status,version}` | 400; 401/403; 409 (version cũ, sai trạng thái, đơn chuyển khoản, trùng key khác nội dung); 404 |

- Resolve giỏ nhận tối đa 100 dòng thô, gộp trùng rồi tối đa 50 variant, quantity nguyên 1–99 mỗi variant. Kết quả theo thứ tự xuất hiện: `AVAILABLE`, `EXCEEDS_STOCK`, `OUT_OF_STOCK` trả thông tin công khai và available; `UNAVAILABLE` chỉ trả variantId/status cho ID không tồn tại hoặc hàng/biến thể/danh mục không công khai. Không tạo quote, không ghi kho. Giá và tồn chỉ phản ánh lúc đọc.
- `QUOTE_CHANGED` (409): giá/phí/settings đã đổi so với quote — khách xác nhận lại bằng quote mới, không tự tăng tiền. `OUT_OF_STOCK` (409): thiếu hàng một phần hoặc toàn bộ — rollback tất cả SKU.
- Tra cứu sai mã, sai SĐT, token sai/ hết hạn trả **cùng một** thông báo 404, không tiết lộ đơn có tồn tại.

## 6. Actor

| ActorType | Định nghĩa | Định danh |
|---|---|---|
| `ADMIN` | thao tác qua session admin | userId |
| `GUEST` | khách vãng lai không đăng nhập | không có user; định danh idempotency = session do server cấp (pre-session hiện có), **không dùng IP** làm định danh duy nhất |
| `SYSTEM` | sweep hết hạn, catch-up sau restart | nhãn công việc (`expiry-sweep`, …) |

Lịch sử kho và lịch sử đơn lưu `actorType` + `actorId` nullable; response chuẩn hóa luôn có tên hiển thị: admin → tên user, GUEST → "Khách đặt hàng", SYSTEM → "Hệ thống".

## 7. Idempotency

- Scope do **server** đặt theo nghiệp vụ: `orders.create`, `orders.cancel`, `orders.transition:<action>`, `settings.update` (M4.1.2), `payments.receipt` (M4.6). Identity do server xác định (mục 6), key từ header `Idempotency-Key` do client gửi, server kiểm tra định dạng.
- **Canonical hash:** SHA-256 của biểu diễn chuẩn `{scope, items sắp theo variantId tăng dần, số điện thoại đã chuẩn hóa, các trường nghiệp vụ theo thứ tự cố định}`; hash lưu cùng record.
- Cùng scope+identity+key + cùng hash → trả lại resource/response đã lưu, **không** chạy lại hiệu ứng. Khác hash → **409**. Record (kèm response) commit **cùng** transaction với nghiệp vụ; bản ghi chỉ có sau khi commit thành công.
- Mất response: frontend giữ nguyên command (key + body) trong memory đến khi biết kết quả và cho truy lại bằng cùng key/body; không tự tạo key mới, không tự retry mutation ngoài cơ chế này.
- Thời hạn lưu record: **[ĐỀ XUẤT]** 30 ngày rồi dọn (không xóa dấu key/resource của nghiệp vụ tiền/đơn đang hiệu lực).

## 8. Token tra cứu

- Token ngẫu nhiên ≥128 bit **[CƠ CHẾ: 192-bit base64url]**, server chỉ lưu SHA-256 (`orders.lookupTokenHash`, unique). Không token rõ trong DB nghiệp vụ, log, query string HTTP, localStorage hay tài liệu; link dùng fragment (`#t=…`) hoặc header. **M4.4.1 đã thực hiện đúng cơ chế này:** link `/orders/:code#t=<token>` giữ token trong fragment (sống qua refresh), trang đọc fragment rồi gửi qua header `X-Order-Token`; không dùng cơ chế token thứ hai và không dùng `useLinkToken` (cơ chế đó strips fragment).
- **Phát hành:** tạo đơn thành công trả link tra cứu đúng một lần — **[ĐỀ XUẤT - MẶC ĐỊNH THEO architecture.md]** token chỉ cấp trong response tạo đơn; replay idempotency trả lại resource nhưng **không phát lại token**; khách mất link thì tra cứu mã đơn+SĐT — **M4.4.2 đã thực hiện:** POST `/orders/lookup` trả view cùng token 192-bit mới, tra cứu thành công **cấp token mới và thay hash cũ trong cùng transaction, link cũ hết hiệu lực** — hoặc liên hệ shop. Phương án token tất định HMAC phát lại được ghi nhận là phương án thay thế, chỉ áp dụng nếu chủ shop duyệt đổi trước M4.3.1.
- Đơn Instagram (M4.8) tạo bởi admin, không cần token trừ khi admin chủ động cấp cho người nhận.

## 9. Khóa, thứ tự và trách nhiệm module

- **Orders** là service điều phối duy nhất mở transaction cho một nghiệp vụ đơn; Inventory/Payments nhận `Prisma.TransactionClient` và **không tự mở transaction**, không gọi ngược Orders, không import lẫn nhau.
- Thứ tự khóa trong một transaction: hàng đơn (`orders` theo id) → các dòng kho theo **`variantId` tăng dần** → (M4.6) nguồn tiền theo id tăng dần. Retry deadlock có giới hạn, chỉ cho transaction DB chưa commit.
- Không external I/O (email, QR, file) bên trong transaction giữ khóa; sau commit mới tạo delivery intent/QR.
- Kho: reserve/release/ship qua `InventoryOperationsService` (M4.0.3) với `effectKey` do caller đặt theo hiệu ứng (`order:<orderId>:<effect>`), chống lặp bằng unique + so hash; không mượn API điều chỉnh admin để giả thao tác đặt đơn.

## 10. Đề xuất còn mở (không chặn phần đã duyệt)

| Đề xuất | Giá trị đề xuất | Ảnh hưởng nếu đổi |
|---|---|---|
| ~~Quote TTL~~ **ĐÃ CHỐT 31/10/2026 cho M4.2.2** | 15 phút, hằng số `QUOTE_TTL_MINUTES` v1 (không cấu hình) | CheckoutQuote.expiresAt; đổi sau chỉ ảnh hưởng giá trị ghi |
| Chống spam tạo đơn | theo IP và theo SĐT; số PENDING tối đa mỗi SĐT; con số chốt ở M4.3 | không ảnh hưởng schema |
| Tra cứu/hủy rate limit | giới hạn theo IP, failure đồng nhất; con số chốt ở M4.4 | không ảnh hưởng schema |
| Địa chỉ | nhập tay 4 trường, giới hạn độ dài; không dataset hành chính | cột text có sẵn, đổi sau không migrate |
| Format mã đơn | ~10–12 ký tự bảng chữ không nhập nhằng | cột `code` VarChar(24) chứa đủ |
| Retention idempotency | 30 ngày | chỉ dọn dữ liệu |

## 11. Chưa chốt trong văn bản này

- Chính sách hoàn khi giao thất bại (tiền hàng/phí giao) — chủ shop xác nhận trong kế hoạch M4.9.2 trước khi code.
- ~~Cách nhập/quản lý tài khoản ngân hàng ở Cài đặt~~ — **đã chốt (M4.1.2):** nhập tay 4 trường, dùng đủ hoặc trống toàn bộ; không thêm dataset ngân hàng.
- Nội dung chi tiết VietQR khi thanh toán một phần/quá hạn/đã hủy — chốt ở M4.6.1.
- ~~Endpoint ghi chú admin~~ — **đã chốt (M4.5.2):** `POST /admin/orders/:id/notes`, header `Idempotency-Key`, body `{body}` 1–1000 ký tự sau trim → 201 `{id, body, authorName, createdAt}`; 401/403/404; trùng key khác nội dung hoặc khác đơn 409. Ghi chú chỉ thêm, không sửa/xóa, lưu ở `order_notes` riêng, không đổi `Order.version`/trạng thái/tiền nên không cần `expectedVersion`; không có trong view của khách. `GET /admin/orders/:id` trả snapshot, lịch sử và ghi chú, không có hash token.
