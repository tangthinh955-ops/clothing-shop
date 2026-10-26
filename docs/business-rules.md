# Quy tắc nghiệp vụ — đặc tả demo

Ngày: 23/10/2026. Đây là chính sách demo đề xuất, chưa phải shop đã duyệt. Chỉ dùng dữ liệu giả, không tự thực hiện chuyển/hoàn tiền thật.

## Catalog và khách

- Một shop, CUSTOMER/ADMIN. Khách xem catalog không đăng nhập; đặt đơn phải đăng nhập và xác minh email.
- Product: DRAFT/PUBLISHED/HIDDEN. Chỉ published được bán; không xóa lịch sử sản phẩm/biến thể đã có đơn.
- Variant là một tổ hợp size × màu, SKU chuẩn hóa unique; giá có thể ở từng biến thể. Size/màu không hợp lệ phải bị backend từ chối.
- Tiền là số nguyên VND; tối đa 100.000.000đ/đơn vị và 1.000.000.000đ/đơn; số lượng đặt nguyên 1..99/dòng, tối đa 50 dòng sau chuẩn hóa.
- Backend tính lại giá, phí và tổng. Phí giao mặc định 30.000đ lấy từ Settings, snapshot khi tạo đơn.
- Quote có hạn, không giữ hàng. Giá/phí thay đổi phải trả QUOTE_CHANGED và yêu cầu xác nhận lại, không âm thầm tăng tiền.
- Giỏ local chỉ có variant ID, quantity và phiên bản cấu trúc; không token, địa chỉ hoặc dữ liệu thanh toán.

## Đơn và hủy

| Từ | Sang | Vai trò/điều kiện |
|---|---|---|
| Chưa có | PENDING | CUSTOMER đặt của mình hoặc ADMIN tạo Instagram; giữ kho atomic |
| PENDING | CONFIRMED | ADMIN; bank phải được phân bổ đủ, COD chưa cần thu |
| CONFIRMED | PACKING | ADMIN; chưa hủy, đủ điều kiện tiền |
| PACKING | SHIPPED | ADMIN; xuất cả thực có và đang giữ đúng một lần |
| SHIPPED | DELIVERED | ADMIN; ghi deliveredAt |
| PENDING/CONFIRMED | CANCELLED | Chủ đơn hoặc ADMIN; giải phóng giữ, tạo nghĩa vụ hoàn phần đã thu chưa có nghĩa vụ khác |
| PACKING | CANCELLED | ADMIN trước bàn giao; khách chỉ gửi cancellation request |
| SHIPPED | DELIVERY_FAILED | ADMIN; chưa cộng kho |
| DELIVERY_FAILED | RETURNED_TO_SHOP | ADMIN ghi thực nhận/kiểm tra; chỉ restock phần bán được |
| PENDING chưa đủ tiền, quá hạn | CANCELLED | Hệ thống; chỉ bank, chưa xuất, lý do PAYMENT_EXPIRED |

Không rewind trạng thái hoặc chuyển SHIPPED thẳng sang CANCELLED. Lịch sử ghi actor, thời gian, lý do và version.

Đơn Instagram: userId nullable, chung pipeline kho/tiền/idempotency; không tự nhận owner do trùng điện thoại/email. Luồng nhận lại giao thất bại do Orders điều phối, không đi qua điều kiện khách đã nhận trong 7 ngày của Returns.

Khi nhận lại giao thất bại: giả định demo hoàn tiền hàng của lượng thực nhận (kể cả phần không bán lại được), không hoàn phí giao gốc; phần thiếu chưa nhận có trạng thái tài chính cần xử lý thủ công, không tự kết luận đã giải quyết. Orders gọi Inventory và Payments cùng transaction, tạo nghĩa vụ chỉ trên tiền đã thu còn chưa được dành cho hoàn; COD chưa thu điều chỉnh khoản phải thu, không tạo hoàn tiền giả. Đây là giả định cần shop duyệt trước bán thật.

## Kho và đồng thời

- Inventory sở hữu `onHand`, `reserved`; `available = onHand - reserved`; CHECK 0 <= reserved <= onHand.
- Tạo đơn: tăng reserved khi available còn đủ; mọi SKU trong một transaction, lỗi bất kỳ rollback toàn bộ.
- Bàn giao: giảm onHand và reserved cùng lượng; không trừ onHand thêm ở lúc giao thành công.
- Hủy trước xuất: chỉ giảm reserved.
- Đổi/trả/giao thất bại: chỉ tăng onHand sau thực nhận và kiểm tra, không tăng chỉ vì có yêu cầu.
- Hàng không bán được ghi nhận cách ly/kết quả kiểm tra, không đưa vào onHand bán được.
- Điều chỉnh kho cần lý do; không hạ onHand dưới reserved.
- InventoryMovement có unique tham chiếu hiệu ứng nghiệp vụ, tránh thao tác lặp.
- Đọc tồn rồi ghi không kiểm soát không đủ. Dùng cập nhật có điều kiện/khóa dòng trong transaction và ràng buộc DB.
- Thứ tự khóa: các order/nguồn tiền liên quan theo ID tăng dần, rồi return/claim, rồi SKU theo ID tăng dần. Retry deadlock có giới hạn chỉ cho transaction DB chưa commit, không retry external payment/email tùy tiện.

## Chuyển khoản và hết hạn

- Deadline snapshot mặc định 30 phút, cấu hình cho đơn mới. COD không có deadline thanh toán bank.
- Xác nhận tiền và hết hạn khóa cùng order, kiểm tra thời gian database trong thao tác.
- Chỉ đủ tiền trước deadline mới cho đơn tiếp tục; thiếu tiền không gia hạn tự động.
- Đến/sau deadline: ghi khoản thu là LATE_PAYMENT, không tự phục hồi hoặc giữ lại hàng.
- Đơn đã CANCELLED nhận tiền ở bất cứ thời điểm nào, kể cả trước deadline: ghi ngoại lệ PAYMENT_AFTER_CANCELLATION và tạo nghĩa vụ trả toàn bộ khoản thu mới chưa được phân bổ/hoàn trong cùng transaction. Kiểm tra state dưới cùng khóa order; không đánh dấu đơn hủy là đã thanh toán để tiếp tục xử lý.
- Khi backend hoạt động: sweep định kỳ; startup catch-up; trước checkout xử lý giữ quá hạn phù hợp. Không chỉ timer trong RAM.
- Free tier ngủ: cutoff vẫn có hiệu lực khi kiểm tra, nhưng dọn kho/email có thể chạy muộn; không cam kết đúng phút khi asleep.

## Tiền và hoàn

- Trạng thái đơn, thanh toán và hoàn là ba chiều riêng.
- Payment là sổ khoản thu bất biến: amount, receivedAt, method, receiving account, reference, confirmedBy và note.
- Unique (receiving account, normalized reference) cho bank; COD có mã đối soát riêng. Ảnh biên lai không xác nhận tiền; MVP chưa cần upload biên lai.
- Tổng phân bổ đủ mới PAID; thiếu PARTIALLY_PAID; thu dư/đến muộn/chưa xác định ghi ngoại lệ riêng.
- COD không được coi đã thu lúc tạo, gửi hoặc chỉ vì giao thành công; phải ghi nhận đối soát thực tế demo.
- Ví dụ due 100.000, thu 120.000: allocate 100.000 và obligation trả dư 20.000. Hủy đơn chỉ tạo thêm 100.000, không 120.000.
- Bất biến: completed refunds + money reserved for refunds <= valid receipts. Không trừ completed refunds thêm lần nữa ở vế phải.
- Money reserved là tổng phần nghĩa vụ còn hiệu lực chưa SUCCEEDED; PROCESSING đã nằm trong phần đó, không cộng riêng lần hai. Ví dụ nghĩa vụ 100, đã hoàn 40, processing 20 và chưa thực hiện 40: tổng ngân sách chiếm dụng = 40 + 60 = 100.
- RefundObligation là khoản cần hoàn; Refund là giao dịch thực hiện thủ công ngoài hệ thống rồi ghi kết quả. Không coi hủy là đã hoàn.
- Refund: PENDING → PROCESSING → SUCCEEDED/FAILED; FAILED có thể thử lại có kiểm soát. VOIDED chỉ cho nghĩa vụ sai bằng lịch sử/lý do, không xóa giao dịch.
- Một nghĩa vụ có thể hoàn từng phần; không hoàn vượt nghĩa vụ hoặc nguồn tiền. Khóa nguồn tiền khi kiểm tra/tạo kết quả.
- Sửa sai bằng bản ghi điều chỉnh/đảo được audit và ràng buộc, không ghi đè/xóa khoản thu/hoàn.
- COD chưa thu mà có trả: điều chỉnh phần còn phải thu; chỉ phát sinh khoản hoàn có tiền bảo đảm, không tạo tiền đã hoàn giả.

## Đổi/trả

- Thời hạn đề xuất 7 ngày kể từ deliveredAt, snapshot chính sách. Chọn order item, lượng, lý do; ảnh minh chứng tùy nhu cầu.
- Khóa dòng/claim khi tạo. Lượng đủ điều kiện = delivered qty - successfully consumed qty - active claimed qty. Reject/withdraw giải phóng claim chưa tiêu thụ.
- REQUESTED → APPROVED/REJECTED; REQUESTED → WITHDRAWN; APPROVED → IN_TRANSIT; APPROVED/IN_TRANSIT → RECEIVED → INSPECTED → ACTION_PENDING → COMPLETED.
- Review/receive/inspect có lý do và version; kết quả từng dòng cho phép chấp nhận một phần.
- received <= approved <= requested; kết quả kiểm tra không vượt thực nhận; số bán lại được không vượt số hàng thực nhận đạt kiểm tra.
- Hàng được chấp nhận hoàn có thể không bán lại được (ví dụ shop nhận trách nhiệm hàng lỗi). Restock và refund entitlement là hai quyết định khác nhau.
- Trả hàng hoàn theo giá đã trả của lượng được chấp nhận; phí giao gốc mặc định không hoàn; phí đổi/trả theo ghi nhận thủ công riêng.
- Đổi chỉ cùng product/color, size khác, cùng giá đã trả; mỗi đơn vị hàng đổi tối đa một lần trong demo.
- Sau nhận kiểm: restock phần cũ bán được, kiểm tra size đích, reserve và tạo EXCHANGE order liên kết. Không sửa order cũ.
- Replacement cash due tiền hàng = 0; giữ snapshot giá trị và nguồn tiền gốc; không ghi doanh thu mới. Phí phát sinh phải ghi riêng.
- Không còn size: chờ hoặc chuyển return/refund sau quyết định được ghi nhận; không tạo reservation giả.
- Replacement hủy/giao thất bại: yêu cầu quay về cần xử lý; không đóng bỏ nghĩa vụ với khách.
- Đường điều phối không tạo vòng: Returns suy ra `needsResolution` từ ExchangeLink và trạng thái replacement khi đọc/xử lý; Orders không ghi trực tiếp bảng ReturnRequest. Yêu cầu giữ ACTION_PENDING tới khi replacement DELIVERED hoặc nghĩa vụ hoàn đã giải quyết; command resolve của Returns khóa lineage và gọi Orders/Payments cùng transaction. Chỉ tạo lại replacement sau hủy trước xuất hoặc sau khi hàng giao thất bại đã thực nhận/kiểm tra; không cho tồn tại hai replacement hoạt động trên cùng lượng claim.
- Trả replacement vẫn truy nguồn paid item gốc, kiểm soát lượng/tiền toàn lineage, không hoàn cả hàng cũ và replacement cho cùng quyền lợi. Thời hạn demo tính từ deliveredAt replacement.

## Tác vụ phụ, idempotency và audit

- Mọi nghiệp vụ nhiều module dùng cùng TransactionClient do bên điều phối mở; module con không mở transaction độc lập.
- Không Cloudinary/email trong transaction giữ khóa.
- Idempotency unique theo actor + operation + key; hash canonical request, resource và response cùng commit nghiệp vụ. Cùng key/nội dung replay cùng resource; khác nội dung 409.
- Có thể dọn response payload theo retention nhưng không xóa dấu key/resource để vô tình cho phép tạo lại nghiệp vụ tiền/đơn.
- Order commit xong email lỗi: vẫn thành công; NotificationDelivery retry ngoài transaction. Auth mail có resend, không lưu token link dạng rõ lâu dài.
- UploadAsset tạm quá 24h chỉ được dọn khi chắc chắn không còn tham chiếu; cleanup có thể chạy muộn trên free tier.
- Audit ghi actor/time/reason/needed changes/requestId, không secret hoặc nhân bản PII không cần thiết.

## Thống kê

- Cash received theo receivedAt; cash refunded chỉ SUCCEEDED theo refundedAt; net cash = received - refunded.
- Sales value chỉ đơn bán mới giao thành công; returns accepted là giảm trừ theo thời điểm xử lý. EXCHANGE báo riêng, không doanh thu mới.
- Phí giao báo riêng; chưa có giá vốn thì không gọi là lợi nhuận. Khoảng ngày hiển thị Việt Nam và đổi UTC đúng biên.
