# Quy tắc nghiệp vụ

Soạn ngày 23/10/2026; cập nhật 29/10/2026 khi chủ shop xác nhận website là kênh bán thật. Các chính sách đã chốt: đặt hàng không cần tài khoản, phí giao cố định 30.000đ, hạn chuyển khoản 2 giờ, VietQR cho chuyển khoản, đổi trả xử lý thủ công. Hệ thống không tự chuyển/hoàn tiền; admin thực hiện ngoài hệ thống rồi ghi kết quả.

## Catalog và khách

- Một shop. Khách xem catalog và đặt hàng **không cần tài khoản**. Tài khoản đăng nhập dùng cho ADMIN; tài khoản CUSTOMER của M2 giữ trong code nhưng ẩn khỏi cửa hàng cho tới khi có nhu cầu (ví dụ lịch sử đơn).
- Product: DRAFT/PUBLISHED/HIDDEN. Chỉ published được bán; không xóa lịch sử sản phẩm/biến thể đã có đơn.
- Variant là một tổ hợp size × màu, SKU chuẩn hóa unique; giá có thể ở từng biến thể. Size/màu không hợp lệ phải bị backend từ chối.
- Tiền là số nguyên VND; tối đa 100.000.000đ/đơn vị và 1.000.000.000đ/đơn; số lượng đặt nguyên 1..99/dòng, tối đa 50 dòng sau chuẩn hóa.
- Backend tính lại giá, phí và tổng. Phí giao mặc định 30.000đ lấy từ Settings, snapshot khi tạo đơn.
- Quote có hạn, không giữ hàng. Giá/phí thay đổi phải trả QUOTE_CHANGED và yêu cầu xác nhận lại, không âm thầm tăng tiền.
- Giỏ local chỉ có variant ID, quantity và phiên bản cấu trúc; không token, địa chỉ hoặc dữ liệu thanh toán.

## Đơn khách vãng lai

- Thông tin bắt buộc: họ tên, số điện thoại Việt Nam (chuẩn hóa một dạng trước khi lưu/so sánh), địa chỉ nhận hàng (tỉnh/thành, phường/xã, địa chỉ chi tiết). Email và ghi chú tùy chọn; có email thì gửi thông báo đơn. Danh mục đơn vị hành chính và giới hạn độ dài chốt ở kế hoạch M4.3.
- Mỗi đơn có **mã đơn** ngắn dễ đọc (dùng làm nội dung chuyển khoản) và **token tra cứu** ngẫu nhiên ≥ 128 bit chỉ nằm trong link gửi khách; server lưu bản băm, không lưu token rõ.
- Khách xem đơn bằng link chứa token, hoặc tra bằng mã đơn + SĐT có giới hạn tần suất; sai thì trả cùng một thông báo, không tiết lộ đơn có tồn tại hay không.
- Chống đơn ảo giữ kho: giới hạn tạo đơn theo IP và theo SĐT; giới hạn số đơn PENDING chưa thanh toán của mỗi SĐT. Con số cụ thể chốt ở M4.3 và sửa được khi vận hành; vượt giới hạn trả lỗi dễ hiểu, không giữ kho.
- Không tự gộp đơn vãng lai vào tài khoản hay khách khác chỉ vì trùng SĐT/email.

## Dữ liệu cá nhân của khách

- Chỉ thu dữ liệu cần để giao hàng và liên hệ; chỉ ADMIN xem được dữ liệu đầy đủ. Trang tra cứu đơn chỉ hiện dữ liệu của đúng đơn đó.
- Không ghi tên, SĐT, địa chỉ, email vào log ứng dụng, tài liệu, progress hoặc chat; log dùng mã đơn/requestId.
- Website có trang chính sách bảo mật mô tả dữ liệu thu, mục đích, thời gian lưu và cách khách yêu cầu xem/xóa; yêu cầu xóa xử lý thủ công nhưng không xóa dữ liệu kế toán/đơn đã phát sinh nghĩa vụ.
- Backup chứa dữ liệu khách được mã hóa hoặc lưu ở nơi có kiểm soát truy cập; không chia sẻ công khai.

## Đơn và hủy

| Từ | Sang | Vai trò/điều kiện |
|---|---|---|
| Chưa có | PENDING | Khách đặt không cần tài khoản hoặc ADMIN tạo đơn Instagram; giữ kho atomic |
| PENDING | CONFIRMED | ADMIN; bank phải được phân bổ đủ, COD chưa cần thu |
| CONFIRMED | PACKING | ADMIN; chưa hủy, đủ điều kiện tiền |
| PACKING | SHIPPED | ADMIN; xuất cả thực có và đang giữ đúng một lần |
| SHIPPED | DELIVERED | ADMIN; ghi deliveredAt |
| PENDING/CONFIRMED | CANCELLED | Khách qua link/token của đơn hoặc ADMIN; giải phóng giữ, tạo nghĩa vụ hoàn phần đã thu chưa có nghĩa vụ khác |
| PACKING | CANCELLED | ADMIN trước bàn giao; khách chỉ gửi cancellation request |
| SHIPPED | DELIVERY_FAILED | ADMIN; chưa cộng kho |
| DELIVERY_FAILED | RETURNED_TO_SHOP | ADMIN ghi thực nhận/kiểm tra; chỉ restock phần bán được |
| PENDING chưa đủ tiền, quá hạn | CANCELLED | Hệ thống; chỉ bank, chưa xuất, lý do PAYMENT_EXPIRED |

Không rewind trạng thái hoặc chuyển SHIPPED thẳng sang CANCELLED. Lịch sử ghi actor, thời gian, lý do và version.

Đơn web và đơn Instagram đều có userId nullable, chung pipeline kho/tiền/idempotency; không tự nhận owner do trùng điện thoại/email. Luồng nhận lại giao thất bại do Orders điều phối.

Khi nhận lại giao thất bại (gồm khách không nhận hàng COD): đề xuất hoàn tiền hàng của lượng thực nhận nếu khách đã chuyển khoản, không hoàn phí giao gốc; phần thiếu chưa nhận có trạng thái tài chính cần xử lý thủ công, không tự kết luận đã giải quyết. Orders gọi Inventory và Payments cùng transaction, tạo nghĩa vụ chỉ trên tiền đã thu còn chưa được dành cho hoàn; COD chưa thu điều chỉnh khoản phải thu, không tạo hoàn tiền giả. Chủ shop xác nhận chính sách hoàn này trong kế hoạch M4.9.

## Kho và đồng thời

- Inventory sở hữu `onHand`, `reserved`; `available = onHand - reserved`; CHECK 0 <= reserved <= onHand.
- Tạo đơn: tăng reserved khi available còn đủ; mọi SKU trong một transaction, lỗi bất kỳ rollback toàn bộ.
- Bàn giao: giảm onHand và reserved cùng lượng; không trừ onHand thêm ở lúc giao thành công.
- Hủy trước xuất: chỉ giảm reserved.
- Giao thất bại và đổi trả thủ công: chỉ tăng onHand sau thực nhận và kiểm tra, không tăng chỉ vì có yêu cầu.
- Hàng không bán được ghi nhận cách ly/kết quả kiểm tra, không đưa vào onHand bán được.
- Điều chỉnh kho cần lý do; không hạ onHand dưới reserved.
- InventoryMovement có unique tham chiếu hiệu ứng nghiệp vụ, tránh thao tác lặp.
- Đọc tồn rồi ghi không kiểm soát không đủ. Dùng cập nhật có điều kiện/khóa dòng trong transaction và ràng buộc DB.
- Thứ tự khóa: các order/nguồn tiền liên quan theo ID tăng dần, rồi return/claim, rồi SKU theo ID tăng dần. Retry deadlock có giới hạn chỉ cho transaction DB chưa commit, không retry external payment/email tùy tiện.

## Chuyển khoản và hết hạn

- Deadline snapshot mặc định **2 giờ**, sửa trong Cài đặt cho đơn mới. COD không có deadline thanh toán bank.
- Trang đơn chuyển khoản hiển thị **VietQR** theo chuẩn của NAPAS: ngân hàng, số tài khoản, tên chủ tài khoản lấy từ Cài đặt; số tiền = tổng đơn còn phải trả; nội dung = mã đơn. Mã QR tạo trên server/ứng dụng của shop, không gửi dữ liệu đơn sang dịch vụ tạo QR bên ngoài. Hiển thị kèm thông tin dạng chữ để khách tự nhập nếu không quét được.
- VietQR chỉ giúp khách chuyển đúng; tiền chỉ được tính là đã thu khi admin ghi nhận khoản thu (chưa có kết nối ngân hàng tự động).
- Xác nhận tiền và hết hạn khóa cùng order, kiểm tra thời gian database trong thao tác.
- Chỉ đủ tiền trước deadline mới cho đơn tiếp tục; thiếu tiền không gia hạn tự động.
- Đến/sau deadline: ghi khoản thu là LATE_PAYMENT, không tự phục hồi hoặc giữ lại hàng.
- Đơn đã CANCELLED nhận tiền ở bất cứ thời điểm nào, kể cả trước deadline: ghi ngoại lệ PAYMENT_AFTER_CANCELLATION và tạo nghĩa vụ trả toàn bộ khoản thu mới chưa được phân bổ/hoàn trong cùng transaction. Kiểm tra state dưới cùng khóa order; không đánh dấu đơn hủy là đã thanh toán để tiếp tục xử lý.
- Khi backend hoạt động: sweep định kỳ; startup catch-up; trước checkout xử lý giữ quá hạn phù hợp. Không chỉ timer trong RAM.
- VPS restart/deploy: cutoff vẫn có hiệu lực khi kiểm tra; catch-up lúc khởi động xử lý phần quá hạn trong lúc server tắt.

## Tiền và hoàn

- Trạng thái đơn, thanh toán và hoàn là ba chiều riêng.
- Payment là sổ khoản thu bất biến: amount, receivedAt, method, receiving account, reference, confirmedBy và note.
- Unique (receiving account, normalized reference) cho bank; COD có mã đối soát riêng. Ảnh biên lai không xác nhận tiền; MVP chưa cần upload biên lai.
- Tổng phân bổ đủ mới PAID; thiếu PARTIALLY_PAID; thu dư/đến muộn/chưa xác định ghi ngoại lệ riêng.
- COD không được coi đã thu lúc tạo, gửi hoặc chỉ vì giao thành công; phải ghi nhận theo đối soát thực tế với đơn vị vận chuyển.
- Ví dụ due 100.000, thu 120.000: allocate 100.000 và obligation trả dư 20.000. Hủy đơn chỉ tạo thêm 100.000, không 120.000.
- Bất biến: completed refunds + money reserved for refunds <= valid receipts. Không trừ completed refunds thêm lần nữa ở vế phải.
- Money reserved là tổng phần nghĩa vụ còn hiệu lực chưa SUCCEEDED; PROCESSING đã nằm trong phần đó, không cộng riêng lần hai. Ví dụ nghĩa vụ 100, đã hoàn 40, processing 20 và chưa thực hiện 40: tổng ngân sách chiếm dụng = 40 + 60 = 100.
- RefundObligation là khoản cần hoàn; Refund là giao dịch thực hiện thủ công ngoài hệ thống rồi ghi kết quả. Không coi hủy là đã hoàn.
- Refund: PENDING → PROCESSING → SUCCEEDED/FAILED; FAILED có thể thử lại có kiểm soát. VOIDED chỉ cho nghĩa vụ sai bằng lịch sử/lý do, không xóa giao dịch.
- Một nghĩa vụ có thể hoàn từng phần; không hoàn vượt nghĩa vụ hoặc nguồn tiền. Khóa nguồn tiền khi kiểm tra/tạo kết quả.
- Sửa sai bằng bản ghi điều chỉnh/đảo được audit và ràng buộc, không ghi đè/xóa khoản thu/hoàn.
- COD chưa thu mà có trả: điều chỉnh phần còn phải thu; chỉ phát sinh khoản hoàn có tiền bảo đảm, không tạo tiền đã hoàn giả.

## Đổi/trả

Quyết định 29/10/2026: **xử lý thủ công**, không có luồng đổi trả trong hệ thống khi mở bán.

- Thời hạn và điều kiện đổi trả do chủ shop quyết định và đăng ở trang chính sách đổi trả.
- Khách liên hệ shop; chủ shop thỏa thuận ngoài hệ thống. Nhận lại hàng thì admin dùng điều chỉnh kho có lý do (ví dụ "Nhận lại đơn <mã đơn>"), chỉ cộng phần bán lại được.
- Hoàn tiền thực hiện ngoài hệ thống; khi M4 có ghi chú đơn thì ghi lại kết quả. Đổi size: tạo đơn mới (ví dụ đơn Instagram) và ghi chú liên kết, không sửa đơn cũ.

### Thiết kế đổi trả tự động (tham khảo, ngoài phạm vi)

Chỉ dùng khi chủ shop yêu cầu làm lại luồng tự động; không triển khai trong M4/M6.

- Thời hạn đề xuất 7 ngày kể từ deliveredAt, snapshot chính sách. Chọn order item, lượng, lý do; ảnh minh chứng tùy nhu cầu.
- Khóa dòng/claim khi tạo. Lượng đủ điều kiện = delivered qty - successfully consumed qty - active claimed qty. Reject/withdraw giải phóng claim chưa tiêu thụ.
- REQUESTED → APPROVED/REJECTED; REQUESTED → WITHDRAWN; APPROVED → IN_TRANSIT; APPROVED/IN_TRANSIT → RECEIVED → INSPECTED → ACTION_PENDING → COMPLETED.
- Review/receive/inspect có lý do và version; kết quả từng dòng cho phép chấp nhận một phần.
- received <= approved <= requested; kết quả kiểm tra không vượt thực nhận; số bán lại được không vượt số hàng thực nhận đạt kiểm tra.
- Hàng được chấp nhận hoàn có thể không bán lại được (ví dụ shop nhận trách nhiệm hàng lỗi). Restock và refund entitlement là hai quyết định khác nhau.
- Trả hàng hoàn theo giá đã trả của lượng được chấp nhận; phí giao gốc mặc định không hoàn; phí đổi/trả theo ghi nhận thủ công riêng.
- Đổi chỉ cùng product/color, size khác, cùng giá đã trả; mỗi đơn vị hàng đổi tối đa một lần.
- Sau nhận kiểm: restock phần cũ bán được, kiểm tra size đích, reserve và tạo EXCHANGE order liên kết. Không sửa order cũ.
- Replacement cash due tiền hàng = 0; giữ snapshot giá trị và nguồn tiền gốc; không ghi doanh thu mới. Phí phát sinh phải ghi riêng.
- Không còn size: chờ hoặc chuyển return/refund sau quyết định được ghi nhận; không tạo reservation giả.
- Replacement hủy/giao thất bại: yêu cầu quay về cần xử lý; không đóng bỏ nghĩa vụ với khách.
- Đường điều phối không tạo vòng: Returns suy ra `needsResolution` từ ExchangeLink và trạng thái replacement khi đọc/xử lý; Orders không ghi trực tiếp bảng ReturnRequest. Yêu cầu giữ ACTION_PENDING tới khi replacement DELIVERED hoặc nghĩa vụ hoàn đã giải quyết; command resolve của Returns khóa lineage và gọi Orders/Payments cùng transaction. Chỉ tạo lại replacement sau hủy trước xuất hoặc sau khi hàng giao thất bại đã thực nhận/kiểm tra; không cho tồn tại hai replacement hoạt động trên cùng lượng claim.
- Trả replacement vẫn truy nguồn paid item gốc, kiểm soát lượng/tiền toàn lineage, không hoàn cả hàng cũ và replacement cho cùng quyền lợi. Thời hạn tính từ deliveredAt replacement.

## Tác vụ phụ, idempotency và audit

- Mọi nghiệp vụ nhiều module dùng cùng TransactionClient do bên điều phối mở; module con không mở transaction độc lập.
- Không ghi file, gửi email hay gọi dịch vụ ngoài trong transaction giữ khóa.
- Idempotency unique theo actor + operation + key; hash canonical request, resource và response cùng commit nghiệp vụ. Cùng key/nội dung replay cùng resource; khác nội dung 409.
- Có thể dọn response payload theo retention nhưng không xóa dấu key/resource để vô tình cho phép tạo lại nghiệp vụ tiền/đơn.
- Order commit xong email lỗi: vẫn thành công; NotificationDelivery retry ngoài transaction. Auth mail có resend, không lưu token link dạng rõ lâu dài.
- UploadAsset tạm quá 24h chỉ được dọn khi chắc chắn không còn tham chiếu; cleanup có thể chạy muộn sau restart.
- Audit ghi actor/time/reason/needed changes/requestId, không secret hoặc nhân bản PII không cần thiết.

## Thống kê

- Cash received theo receivedAt; cash refunded chỉ SUCCEEDED theo refundedAt; net cash = received - refunded.
- Sales value chỉ đơn bán mới giao thành công; returns accepted là giảm trừ theo thời điểm xử lý. EXCHANGE báo riêng, không doanh thu mới.
- Phí giao báo riêng; chưa có giá vốn thì không gọi là lợi nhuận. Khoảng ngày hiển thị Việt Nam và đổi UTC đúng biên.
