# Checklist nghiệm thu

Mọi mục chưa có bằng chứng đều **CHƯA KIỂM TRA**, không được suy ra pass từ build hoặc từ kế hoạch.

Mỗi lần chạy ghi: mã → điều kiện → bước → mong đợi → thực tế → bằng chứng → đạt/không đạt; kèm commit, URL/env, dataset, thời gian. Dữ liệu test riêng có thể phục hồi; chỉ test ứng dụng do người dùng quản lý, không quét website tham khảo.

## Ca trọng yếu

| Mã | Điều kiện/bước | Mong đợi | Thực tế | Bằng chứng | Kết luận |
|---|---|---|---|---|---|
| AUTH-01 | Admin login, logout, reset mật khẩu bằng mailbox được phép | Token một lần, phiên được tạo/thu hồi | Chưa chạy | — | Chưa đánh giá |
| AUTH-02 | Reset hết hạn/đã dùng, thử phiên cũ | Từ chối và thu hồi đúng | Chưa chạy | — | Chưa đánh giá |
| AUTH-03 | Dò tài khoản và vượt limit | Uniform response và giới hạn | Chưa chạy | — | Chưa đánh giá |
| AUTH-04 | Đoán mật khẩu admin từ nhiều IP; đăng nhập admin thiếu/sai mã 2 bước | Giới hạn theo tài khoản chặn được; không vào admin khi thiếu TOTP | Chưa chạy | — | Chưa đánh giá |
| ACL-01 | Dùng mã/token của đơn khác, sửa mã trong link, dò mã đơn + SĐT | Không xem/hủy được đơn người khác; thông báo đồng nhất; bị giới hạn tần suất | Chưa chạy | — | Chưa đánh giá |
| ACL-02 | Khách/ẩn danh gọi API admin, gửi role/status/paymentStatus | Từ chối, không mass assignment | Chưa chạy | — | Chưa đánh giá |
| GUEST-01 | Tạo đơn ảo hàng loạt từ một IP/một SĐT để giữ hết hàng | Vượt giới hạn bị từ chối, không giữ kho thêm; đơn chuyển khoản quá hạn tự giải phóng | Chưa chạy | — | Chưa đánh giá |
| PRIV-01 | Đặt đơn rồi xem log ứng dụng/proxy | Không có tên/SĐT/địa chỉ/email/token tra cứu trong log | Chưa chạy | — | Chưa đánh giá |
| SEC-01 | Injection/XSS trong input lưu và query | Không thực thi/đổi query trái phép | Chưa chạy | — | Chưa đánh giá |
| SEC-02 | Write thiếu/sai CSRF hoặc Origin | Bị chặn kể cả login | Chưa chạy | — | Chưa đánh giá |
| SEC-03 | Cookie/HTTPS/header/CORS/proxy/cache | Đúng cấu hình, private no-store | Chưa chạy | — | Chưa đánh giá |
| UP-01 | File giả MIME/quá lớn/quá kích thước | Từ chối và bounded resources | Chưa chạy | — | Chưa đánh giá |
| UP-02 | Upload bỏ form, chạy cleanup | Xóa tạm không còn dùng, giữ ảnh tham chiếu | Chưa chạy | — | Chưa đánh giá |
| ORD-01 | Sửa giá/phí/qty/tổng từ client | Từ chối hoặc tính lại theo contract | Chưa chạy | — | Chưa đánh giá |
| INV-01 | Hai khách mua cùng sản phẩm cuối | Chỉ một thành công, không âm kho | Chưa chạy | — | Chưa đánh giá |
| IDEM-01 | Replay tạo đơn kể cả mất response | Một order/một reservation | Chưa chạy | — | Chưa đánh giá |
| IDEM-02 | Cùng key khác payload | 409, không mutation mới | Chưa chạy | — | Chưa đánh giá |
| ORD-02 | Cancel và ship đồng thời | Một state winner, kho đúng | Chưa chạy | — | Chưa đánh giá |
| ORD-03 | Cancel/ship/restock lặp | Một hiệu ứng kho | Chưa chạy | — | Chưa đánh giá |
| PAY-01 | Confirm receipt và expiry đồng thời | Nhất quán deadline/khóa | Chưa chạy | — | Chưa đánh giá |
| PAY-02 | Thiếu/dư/muộn/trùng ref | Ngoại lệ đúng, không tự revive | Chưa chạy | — | Chưa đánh giá |
| PAY-03 | COD tạo/gửi/giao chưa đối soát | Chưa PAID | Chưa chạy | — | Chưa đánh giá |
| PAY-04 | Receipt→cancel và cancel→receipt trước deadline, gồm thu dư | Đơn vẫn hủy, nghĩa vụ đúng không trùng nguồn | Chưa chạy | — | Chưa đánh giá |
| PAY-05 | Quét VietQR của đơn chuyển khoản bằng app ngân hàng | Đúng ngân hàng/tài khoản/tên, số tiền còn phải trả, nội dung là mã đơn; đơn chưa thành đã thu cho tới khi admin ghi nhận | Chưa chạy | — | Chưa đánh giá |
| ORD-04 | Nhận hàng giao thất bại prepaid/COD, hàng tốt/hỏng/thiếu và nhận lặp | Restock đúng; nghĩa vụ tiền/giảm phải thu đúng; thiếu còn cần xử lý | Chưa chạy | — | Chưa đánh giá |
| REF-01 | Hoàn đồng thời hoặc quá nguồn thu | Không vượt ngân sách/obligation | Chưa chạy | — | Chưa đánh giá |
| FAIL-01 | Mail lỗi sau commit order | Order success, notification retry | Chưa chạy | — | Chưa đánh giá |
| FAIL-02 | Ghi file ảnh/DB lỗi, mạng ngắt | Không half-write, retry an toàn | Chưa chạy | — | Chưa đánh giá |
| OPS-01 | Restart/deploy VPS sau deadline | Catch-up đúng, late money exception | Chưa chạy | — | Chưa đánh giá |
| OPS-02 | Backup ngoài VPS rồi restore sang DB/thư mục khác | Đơn/kho/tiền đối chiếu đúng, ảnh hiển thị lại | Chưa chạy | — | Chưa đánh giá |
| OPS-03 | Restart/deploy lại trên VPS | Ảnh, phiên admin hợp lệ và đơn còn nguyên; HTTPS và cookie đúng | Chưa chạy | — | Chưa đánh giá |
| UI-01 | Deep refresh/Back/cart/checkout/mobile/mở từ Instagram | State/route hợp lệ, UI không vỡ | Chưa chạy | — | Chưa đánh giá |
| ZAP-01 | ZAP có auth trên môi trường thuộc shop (không quét website khác) | Cảnh báo phân tích và retest | Chưa chạy | — | Chưa đánh giá |

Đổi trả xử lý thủ công từ 29/10/2026 nên các ca returns/exchange tự động (RET-01/02, EXC-01..03 cũ) ra khỏi phạm vi; thêm lại khi làm luồng tự động.

## Khung ASVS

Tham chiếu ASVS **5.0.0 stable** theo https://asvs.owasp.org/ lúc khảo sát. Khi tạo security-test-plan phải map chính xác ID phiên bản `v5.0.0-...`, không đoán ID.

| Nhóm | Phạm vi | Trạng thái |
|---|---|---|
| Auth/session/password/authorization | Áp dụng | Chưa kiểm tra |
| Validation/injection/XSS/CSRF | Áp dụng | Chưa kiểm tra |
| API/cookie/CORS/HTTPS/headers | Áp dụng | Chưa kiểm tra |
| Upload/resources/data/log/secret/config/dependency | Áp dụng | Chưa kiểm tra |
| Business logic kho/đơn/tiền, đơn khách vãng lai | Áp dụng | Chưa kiểm tra |
| JWT/OAuth/GraphQL | Không áp dụng theo thiết kế | Đánh giá lại nếu thêm |
| Cổng thanh toán thật | Không tích hợp trong MVP | Kiểm soát tiền thủ công vẫn áp dụng |

## Cổng nghiệm thu

- [ ] Luồng trọng yếu đã chạy và có bằng chứng trên commit/env cụ thể.
- [ ] Không còn Critical/High đã xác nhận chưa xử lý; remaining findings có mức ảnh hưởng/cách xử lý/người chấp nhận.
- [ ] Retest sau fix, không chỉ scan lại đếm cảnh báo.
- [ ] Restore thật thành công, đối chiếu kho/tiền/đơn.
- [ ] Ghi giới hạn đã biết: một instance trên VPS, dung lượng ổ đĩa/ảnh, quota email, rate limit reset khi restart.
- [ ] Hướng dẫn admin/deploy/backup và quyền sở hữu dịch vụ (VPS, domain, email, tài khoản ngân hàng) được bàn giao cho chủ shop.
- [ ] Trước mở bán: chính sách giao hàng/đổi trả/thanh toán/bảo mật thật đã đăng; thông tin người bán hiển thị; thủ tục website bán hàng với Bộ Công Thương do chủ shop hoàn tất; MFA admin bật; email gửi từ domain riêng; backup ngoài VPS đã khôi phục thử.

Không tuyên bố an toàn tuyệt đối, đạt toàn bộ ASVS hoặc production-ready nếu chưa có bằng chứng tương ứng.
