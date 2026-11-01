# Kế hoạch triển khai Clothing Shop

**Mục tiêu:** Website bán hàng **thật** của shop quần áo (khách chủ yếu đến từ Instagram): frontend, backend, PostgreSQL và ảnh thật, chạy trên VPS của chủ shop, nhận đơn của khách thật. Từ 29/10/2026 dự án không còn là bản demo; quyết định và lộ trình mới ở mục [Chuyển sang shop thật](#chuyển-sang-shop-thật-29102026).

**Kiến trúc:** React SPA → API client → Nest Controller/DTO/Guard → Service → Prisma → PostgreSQL. Backend là modular monolith. Hai app build/deploy riêng; chưa thêm Repository, Redis, queue, microservices, GraphQL hoặc Next.js.

**Đặc tả:** [business-rules.md](business-rules.md), [architecture.md](architecture.md). Yêu cầu gốc: tài liệu người dùng gửi ngày 23/10/2026 và bản kế hoạch trong hội thoại đã được cho phép tiến hành.

**Cách làm:** Thực hiện trực tiếp từng bước nhỏ; test nghiệp vụ trước implementation. Chạy kiểm tra, cập nhật `progress.md` theo kết quả thật. Không tự mở rộng phạm vi; thay đổi kiến trúc/API/schema vượt thiết kế phải được giải thích và xác nhận.

## Ràng buộc toàn dự án

- React + Vite + TypeScript strict + React Router + MUI; NestJS + Prisma + PostgreSQL.
- DTO validation runtime, CUSTOMER/ADMIN, session server và cookie HttpOnly, không token dài hạn trong localStorage.
- npm workspaces, một lockfile ở root; kiểm tra phiên bản trước cài, khóa major trong tính năng.
- Backend tính giá/phí/tổng, kiểm tra quyền sở hữu; không dùng `any` che lỗi.
- Mọi thay đổi kho đi qua Inventory; nghiệp vụ nhiều module dùng chung transaction; không external I/O trong transaction.
- Dữ liệu khách là dữ liệu thật: chỉ thu thông tin cần để giao hàng, không ghi PII vào log/tài liệu/chat, backup có kiểm soát. Hạ tầng là VPS chủ shop thuê; agent không tự mua hoặc kích hoạt dịch vụ trả phí khác.
- Không reset DB có đơn, seed không tự phá dữ liệu khi startup; không công khai mật khẩu admin mặc định; dữ liệu demo (`seed:demo`) không được vào production.
- Chính sách đã chốt ngày 29/10/2026: đặt hàng không cần tài khoản; phí giao cố định 30.000đ/đơn; hạn chuyển khoản 2 giờ (sửa trong Cài đặt); chuyển khoản hiển thị VietQR; đổi trả xử lý thủ công.

## Chuyển sang shop thật (29/10/2026)

Chủ shop xác nhận website là kênh bán thật, không còn là demo. Đánh giá lại M1–M3 theo chuẩn bán thật: nền tảng auth/session/CSRF/role, kho có lịch sử và catalog giữ nguyên; còn thiếu bán hàng (M4), hạ tầng chạy thật (cấu hình VPS, deploy, backup) và một số việc chặn mở bán.

| Quyết định | Ảnh hưởng thiết kế |
|---|---|
| Đặt hàng không cần đăng ký | Đơn khách vãng lai: tên, SĐT, địa chỉ bắt buộc, email tùy chọn; truy cập đơn bằng link bí mật hoặc mã đơn + SĐT; chống đơn ảo giữ kho bằng giới hạn theo IP/SĐT và số đơn đang chờ mỗi SĐT. Ẩn Đăng ký/Đăng nhập của khách trên cửa hàng; trang đăng nhập giữ cho admin |
| Deploy trên VPS | Server chạy liên tục nên quét hết hạn chạy đúng giờ; ảnh lưu trên ổ đĩa VPS (đường dẫn cấu hình được) và **bắt buộc backup DB + ảnh ra ngoài VPS hằng ngày**; PostgreSQL không mở ra internet; một instance nên rate limit trong RAM chấp nhận được |
| Chuyển khoản hiển thị VietQR | Cài đặt lưu ngân hàng, số tài khoản, tên chủ tài khoản; mã QR (số tiền + mã đơn) tạo trên server của shop; admin vẫn xác nhận tiền về |
| Đổi trả thủ công | M5 tự động ra khỏi phạm vi mở bán; admin dùng điều chỉnh kho có lý do khi nhận lại hàng |
| Phí giao 30.000đ | Chính sách thật, lưu trong Cài đặt và snapshot vào đơn |

Lộ trình đến khi mở bán (mỗi phần vẫn gửi kế hoạch riêng và chờ duyệt trước khi code):

| Mã | Thay đổi người dùng thấy được | Người |
|---|---|---|
| P0 | Tài liệu gốc chuyển từ demo sang shop thật | A |
| M3.13b | Sửa 2 lỗi còn mở của lệnh nhập CSV M3.13a: chuyển tham số `--dir`/`--draft` từ root, không xuất bản vào danh mục đang tắt | B |
| M3.14 | Admin sửa được sản phẩm đang bán (backend đã cho phép, UI đang chặn) | A |
| M3.15 | Bỏ dấu vết demo trên cửa hàng; `seed:demo` từ chối chạy ở production; trang thông tin người bán, chính sách bảo mật và các chính sách thật (chủ shop cung cấp nội dung) | B |
| M3.16 | Cấu hình chạy trên VPS: host lắng nghe cấu hình được, bắt buộc `TRUST_PROXY` ở production, bật upload với thư mục ảnh tuyệt đối, cache ảnh công khai | A |
| M3.16.1 | Theo kế hoạch được người dùng duyệt: deploy sớm catalog/API lên VPS qua HTTPS, nginx hiện có + Docker project riêng + DB/ảnh persistent; bàn giao URL để thử, chưa nhập dữ liệu shop | A |
| UI.0–UI.4 | Thiết kế lại giao diện cửa hàng, tham khảo cách trình bày của Uniqlo (không dùng nhận diện của họ): UI.0 giải xung đột PR M3.15; UI.1 theme/font Be Vietnam Pro, header dính có danh mục + tìm kiếm + menu điện thoại, footer 3 cột; UI.2 trang chủ `/`; UI.3 lưới và bộ lọc `/shop` (bỏ bảng lọc trượt vì chỉ có 2 bộ lọc); UI.4 trang chi tiết (nút "Nhắn shop qua Instagram" cho tới M4). Đã viết và kiểm tra local 30/10/2026, chờ người dùng nghiệm thu và commit | A |
| M3.17 | Bảo vệ admin: giới hạn đăng nhập theo tài khoản (không chỉ IP) và xác thực 2 bước TOTP | B |
| M4.0–M4.11 | Bán hàng: chốt contract/nền tảng, cài đặt shop, giỏ + tạm tính, đặt COD không cần tài khoản, tra cứu/hủy, admin đơn, VietQR/tiền, hết hạn, Instagram, giao thất bại, email và E2E; chia nhỏ ở [kế hoạch M4](m4-implementation-plan.md) | B toàn bộ |
| M6.1–M6.3 | Deploy VPS + HTTPS + deploy sau CI; backup ngoài VPS + diễn tập khôi phục; bảo vệ VPS + báo động khi web sập | A/B |
| Mở bán | Khi xong các phần trên, chính sách thật đã đăng, thủ tục website bán hàng với Bộ Công Thương do chủ shop hoàn tất | Chủ shop |
| Sau mở bán | Link sản phẩm hiện ảnh/tên khi chia sẻ Instagram/Zalo, nhật ký hoạt động admin, kiểm thử bảo mật định kỳ (M7 rút gọn) | A/B |

## Thời gian và bản trình diễn

Người dùng có 10 giờ/tuần. Ước lượng intern: 310–460 giờ, cộng 25% dự phòng: 388–575 giờ, khoảng 39–58 tuần. Ước lượng lại sau hai mốc đầu theo tốc độ thực tế; không coi đây là hạn bàn giao cam kết.

Tháng đầu khoảng 40 giờ: ưu tiên thiết kế, nền tảng và deploy thử. Không hứa hoàn thành toàn bộ kho/tiền/đổi trả trong một tháng. Bản trình diễn danh mục sớm nếu được ưu tiên không thay thế nghiệm thu nghiệp vụ.

Sau quyết định 29/10/2026 (bỏ M5 tự động, M7 rút gọn), phần còn lại đến mở bán ước khoảng 130–190 giờ cho hai người; con số chỉ để sắp ưu tiên, không phải hạn cam kết.

## Các mốc

| Mốc | Sản phẩm kiểm tra được | Giờ |
|---|---|---:|
| M1 | Quy tắc, UI/state, API/database, checklist nhất quán | 24–36 |
| M2 | Tài khoản/session/role chạy FE–API–DB local; cấu hình CI; deploy thử hoãn theo yêu cầu local trước | 40–60 |
| M3 | Admin đăng hàng/ảnh, catalog công khai, kho có lịch sử | 48–68 |
| Chuẩn bị bán thật | M3.13b–M3.17: sửa import, sửa hàng đang bán, bỏ demo + chính sách thật, cấu hình VPS, bảo vệ admin | 30–45 |
| M4 | Giỏ, quote, đơn khách vãng lai, COD/chuyển khoản VietQR, hủy, đơn Instagram, giao thất bại | 75–105 |
| M5 | Ngoài phạm vi mở bán: đổi trả xử lý thủ công (quyết định 29/10/2026) | 0 |
| M6 | VPS, HTTPS, restart, smoke test, backup ngoài VPS/khôi phục và rollback — deploy catalog/API được làm sớm ở M3.16.1; hoàn tất vận hành trước mở bán | 24–40 |
| M7 | Rút gọn: kiểm thử bảo mật trước mở bán; ASVS/ZAP đầy đủ, link preview, nhật ký admin sau mở bán | 20–40 |

## Nhịp triển khai và chạy thử từng phần

- M1–M7 là các mốc tổng quan. Trước khi code mỗi mốc, lập bảng chia thành `Mx.1`, `Mx.2`, `Mx.3`... theo một thay đổi hoặc luồng nhỏ có thể chạy thử ngay; phần còn lớn tiếp tục chia thành `Mx.1.1`, `Mx.1.2`... .
- Bảng chia phần ghi rõ thay đổi quan sát được, phạm vi, cách thử/kết quả mong đợi và phụ thuộc. Ưu tiên mỗi phần dùng được xuyên suốt FE–API–DB; phần nền tảng chưa có UI phải có cách kiểm tra và giới hạn rõ.
- Trước từng phần: gửi kế hoạch riêng trong chat → dừng chờ duyệt → triển khai đúng phần → kiểm tra và cập nhật `progress.md` → bàn giao cách thử → dừng chờ phản hồi. Không code cả mốc rồi mới gửi hướng dẫn.
- Duyệt lộ trình không đồng nghĩa cho phép tự chạy hết các phần. Chỉ chuyển phần khi người dùng yêu cầu và phần tiếp theo có kế hoạch cụ thể đã được duyệt; sửa lỗi phần đang thử trước khi đi tiếp.
- Ghi riêng trạng thái đã viết, đã kiểm tra kỹ thuật và đã được người dùng chạy thử; giữ tiêu chí hoàn thành của mốc bên dưới. Các phần cụ thể cần đối chiếu working tree trước khi lập, không suy ra trạng thái từ tài liệu thiết kế.

## Phân công hai người

Từ 29/10/2026 phần còn lại chia cho hai người. Chi tiết M3 ở [m3-implementation-plan.md](m3-implementation-plan.md#phân-công-hai-người-29102026). **Cập nhật theo yêu cầu mới nhất: toàn bộ M4 do Người B thực hiện**, thay phân công A/B cũ của riêng M4; giữ phân công các mốc khác. Xem [implementation M4](m4-implementation-plan.md) và [chạy thử local M4](local-trial-m4.md). Từng phần vẫn phải duyệt trước khi bắt đầu.

| Giai đoạn | Người A | Người B |
|---|---|---|
| Chuẩn bị bán thật | P0, M3.14 sửa hàng đang bán, M3.16 cấu hình VPS | M3.13b sửa import, M3.15 bỏ demo + chính sách, M3.17 bảo vệ admin |
| M4.0–M4.10 | — | Toàn bộ: contract/schema, Settings, giỏ/checkout/đơn khách, admin đơn, kho/tiền/VietQR, expiry, Instagram, giao thất bại, email |
| M4.11 | — | E2E toàn luồng, bàn giao người dùng chạy thử và chốt theo bằng chứng |
| M6 | M6.1 deploy VPS + HTTPS + deploy sau CI | M6.2 backup/khôi phục, M6.3 bảo vệ VPS + báo động |
| M7 rút gọn | E2E mobile/Instagram, link preview | Kiểm thử bảo mật, hướng dẫn admin |

M4 do B làm tuần tự theo phụ thuộc: M4.0 contract/nền tảng → M4.1 → M4.2 → M4.3, sau đó các phần tra cứu/admin/tiền và ngoại lệ trong bảng M4 chi tiết. Mỗi lần chỉ một migration đang triển khai; tích hợp phần trước và cập nhật `main` trước khi tạo migration tiếp theo, không sửa lịch sử đã áp dụng. Lộ trình không tự cho phép code liên tiếp.

Mỗi phần một nhánh và PR, người còn lại review. Chỉ một PR có migration tại một thời điểm.

## Bước thực hiện và điều kiện hoàn thành

### M1 — Thiết kế

- [x] [CREATE] `docs/plan.md`, `business-rules.md`, `architecture.md`, `acceptance-checklist.md`, `progress.md`, `README.md`.
- [x] Kiểm tra vòng đời đơn, tác động kho/tiền, quyền, contract và snapshot.
- [x] Chốt sitemap và Component Tree trong architecture; chưa tạo file rỗng theo cây thư mục.
- [x] Review các race và ngoại lệ bên dưới; ghi vấn đề chưa kiểm chứng.
- Hoàn thành khi tài liệu liên kết được, không mâu thuẫn quyền sở hữu module hoặc số liệu. Không có build/test ứng dụng ở bước tài liệu.

### M2 — Nền tảng và tài khoản

- [x] [CREATE] package/workspace/lockfile/TS configs, `.env.example`, Docker Compose PostgreSQL, cấu hình CI (chưa chạy trên GitHub).
- [x] [CREATE] `apps/backend/src/config`, `prisma`, `modules/auth`, `modules/users`, adapter `modules/mail` tối thiểu cho verify/reset; Prisma schema/migration tương ứng.
- [x] [CREATE] frontend `app`, `layouts`, `theme`, `features/auth`, `shared/api`.
- [x] Test validation cấu hình và auth/session/role: sai mật khẩu, hết hạn, logout, reset một lần, owner/role, CSRF.
- [x] Implement từng lát cắt và chạy typecheck/build/test; integration dùng PostgreSQL thật; E2E qua proxy local.
- [ ] Deploy thử proxy/session và chạy CI trên GitHub: hoãn theo yêu cầu người dùng làm local trước, không thuộc điểm dừng chạy thử này.
- [ ] Người dùng chạy thử và phản hồi theo [hướng dẫn M2 local](local-trial-m2.md); dừng trước M3.
- Tree/state: AuthLayout → AuthPage → AuthForm; form local, current user trong query cache, cookie do trình duyệt quản lý.
- Data flow: form → DTO → AuthService → user/session PostgreSQL → cookie → `/me`.
- Rủi ro: engine/ESM, Postgres local, cookie/proxy, quota và sender email.
- Hoàn thành khi các ca auth quan trọng pass và giới hạn email được ghi rõ.

### M3 — Sản phẩm, ảnh và kho

Điểm dừng hiện tại và kế hoạch tiếp tục theo phần: [m3-implementation-plan.md](m3-implementation-plan.md). M3 chia giữa hai người thành M3.1–M3.12 và đã triển khai xong: UI kho (M3.7.1–M3.7.3), admin xuất bản/ẩn (M3.8), catalog khách (M3.9/M3.10), seed demo (M3.11), ca chấp nhận toàn luồng `catalog.spec.ts` ghép vào bộ E2E implemented (M3.12) đạt local 34/34. Chỉ còn người dùng chạy thử và nghiệm thu toàn M3 theo [hướng dẫn M3](local-trial-m3.md); kết quả từng kiểm tra ở [progress.md](../progress.md).

- [x] [CREATE] backend categories/products/inventory/uploads; frontend catalog và admin sản phẩm/danh mục/kho (M3.1–M3.10).
- [x] [MODIFY] schema/migrations/routes; thêm seed demo chạy tường minh qua `seed:demo`, không tự seed khi startup (M3.11).
- [x] Test SKU trùng, biến thể, nháp/ẩn, ảnh mồ côi, điều chỉnh kho và input upload (unit/UI 199 + integration 31 + E2E implemented 34 ca).
- [x] Catalog → Filters/ProductGrid/ProductCard/Pagination; Detail → Gallery/VariantSelector; Editor → Fields/Variants/ImageManager (ca tổng M3.12 chạy qua toàn luồng admin → khách).
- State: filter trên URL, dữ liệu server ở query cache, form/ảnh tạm ở editor.
- Flow: upload ngoài transaction → asset tạm → lưu sản phẩm/gắn ảnh; cập nhật kho qua Inventory.
- Hoàn thành khi admin sửa hàng không deploy lại, ảnh thật tồn tại và kho có lịch sử.
- M3.13a (Người B) đã thêm lệnh nhập sản phẩm thật từ CSV (`import:products`); còn 2 lỗi mở sửa ở M3.13b.
- Chuẩn bị bán thật (sau đánh giá 29/10/2026), xem bảng ở mục [Chuyển sang shop thật](#chuyển-sang-shop-thật-29102026):
- [ ] M3.13b sửa import CSV; M3.14 sửa sản phẩm đang bán; M3.15 bỏ demo + chính sách thật; M3.16 cấu hình VPS; M3.17 bảo vệ admin.

### M4 — Bán hàng

**Người B phụ trách toàn bộ; M4.0.1–M4.0.3, M4.1, M4.2, M4.3.1 (đặt đơn COD không cần tài khoản), M4.4.1 (xem đơn qua link riêng) và M4.4.2 (tra cứu mã đơn+SĐT) đã được triển khai theo từng phạm vi duyệt — chưa có hủy đơn, admin xử lý đơn, thanh toán; đang chờ người dùng chạy thử/nghiệm thu.** Kết quả kiểm tra mới nhất và giới hạn ở [progress.md](../progress.md). Phần tiếp theo dự kiến là M4.4.3 hủy đơn của khách trước đóng gói, cần kế hoạch và duyệt riêng.

- [ ] [CREATE] orders/payments/settings và features cart/checkout/order lookup/admin orders/payments; [MODIFY] Mail bổ sung notification của đơn.
- [ ] [MODIFY] schema/migration; thêm idempotency và lịch sử.
- [ ] Test PostgreSQL thật: hàng cuối, tạo lặp, spam đơn khách vãng lai, hủy/xuất, xác nhận tiền/hết hạn, trùng khoản thu.
- [ ] Checkout → ContactAddressForm/PaymentMethod/OrderReview; OrderLookup/OrderDetail → Timeline/PaymentSummary(VietQR)/CancelAction.
- State: giỏ local chỉ variantId/quantity/version; quote/đơn server; form tên/SĐT/địa chỉ trong page, không persist localStorage; token tra cứu đơn chỉ nằm trong link, server lưu bản băm.
- Flow: quote không giữ kho → create recheck + chống spam → giữ atomic → xác nhận/đóng gói/xuất; hủy giải phóng giữ và tạo nghĩa vụ hoàn phần đã thu.
- Phần dự kiến (mỗi phần duyệt riêng): M4.1 cài đặt shop (phí 30.000đ, hạn chuyển khoản 2 giờ, tài khoản VietQR); M4.2 giỏ + tạm tính; M4.3 đặt hàng COD không cần tài khoản; M4.4 tra cứu/hủy đơn; M4.5 admin xử lý đơn; M4.6 VietQR + ghi nhận tiền; M4.7 hết hạn + tiền muộn/sau hủy; M4.8 đơn Instagram; M4.9 giao thất bại/nhận lại; M4.10 email shop + khách có email; M4.11 E2E chốt.
- Hoàn thành khi luồng COD/chuyển khoản VietQR/Instagram đúng, không vượt kho, không tạo trùng nghiệp vụ và đơn ảo không giữ kho vượt giới hạn.

### M5 — Sau bán hàng (ngoài phạm vi mở bán)

Quyết định 29/10/2026: đổi trả xử lý thủ công. Admin nhận lại hàng thì dùng điều chỉnh kho có lý do (M3.7.2); hoàn tiền ngoài hệ thống và ghi chú vào đơn khi M4 có ghi chú. Thiết kế returns/exchange tự động trong business-rules và architecture giữ làm tham khảo, chỉ làm lại khi chủ shop yêu cầu.

### M6 — Vận hành trên VPS (trước mở bán)

- M3.16.1 thực hiện sớm phần deploy đầu tiên theo bảng kế hoạch đã duyệt trong chat: snapshot source hiện tại được kiểm tra local, build trên Linux, database mới riêng cho RMG, nginx/HTTPS và smoke test. Kết quả thật ghi trong `progress.md`; không nhận kết quả local là CI. Chưa coi toàn M6 đạt.
- [x] [CREATE] Hoàn tất vận hành deploy VPS: cấu hình proxy/service và `docs/deployment-guide.md` được làm ở M3.16.1; deploy sau CI + rollback đã diễn tập (M6.1, 31/10/2026); **backup/restore DB + ảnh ngoài VPS đã làm ở M6.2 (31/10/2026, Người A nhận lại từ Người B theo duyệt): backup nightly + bản sao ngoài VPS + diễn tập khôi phục vào DB khác đạt.**
- [ ] [MODIFY] health/log/CI/README theo môi trường thật; các lượt deploy qua pipeline chỉ chạy sau khi CI xanh. Snapshot thủ công M3.16.1 chưa có kết quả CI riêng.
- [ ] Bảo vệ VPS: chỉ SSH bằng key, tường lửa chỉ mở 22/80/443, PostgreSQL không mở ra ngoài, cập nhật bảo mật tự động; báo động khi `/api/v1/health/ready` lỗi.
- [ ] Smoke test HTTPS/proxy/refresh, restart/catch-up, ảnh/đơn còn nguyên sau restart (đã đạt ở M3.16.1/M6.1), rollback app tương thích schema (đã diễn tập M6.1.3); restore sang DB khác đã diễn tập ở M6.2.
- Hoàn thành khi có bằng chứng deploy/restore; chưa đạt nếu chỉ có hướng dẫn chưa chạy.

### M7 — Nghiệm thu (rút gọn)

- [ ] Trước mở bán: kiểm thử bảo mật các luồng auth admin, đơn khách vãng lai, VietQR/ghi nhận tiền; sửa và kiểm tra lại.
- [ ] Sau mở bán: ASVS 5.0.0 map đúng ID, ZAP có auth trên ứng dụng thuộc quyền quản lý, link preview sản phẩm cho Instagram/Zalo, nhật ký hoạt động admin, `docs/admin-guide.md`.
- [ ] Ghi commit/môi trường/dataset và phát hiện còn lại; không ghi pass trước khi chạy.
- Hoàn thành theo [acceptance-checklist.md](acceptance-checklist.md).

## Trọng tâm review xuyên suốt

1. Mạng ngắt sau commit: tạo đơn/thu/hoàn phải truy lại được mà không tạo mới; M4 kiểm tra idempotency thật.
2. Hai thao tác cùng thời điểm: khóa đơn/nguồn tiền và kho theo thứ tự thống nhất; M4 test đồng thời thật.
3. Restart/deploy trên VPS: deadline không dựa timer RAM; M4/M6 thử catch-up và tiền muộn.
4. Đơn khách vãng lai: không đăng nhập nên phải chống đơn ảo giữ kho và chống dò đơn của người khác (token băm, giới hạn tra cứu); M4 test.
5. Proxy/SPA: deep link, Set-Cookie, CSRF, POST body, không cache dữ liệu riêng tư; M3.16/M6 kiểm chứng deploy.

## Kiểm tra dự kiến

CI: clean install từ lockfile, lint/typecheck, build độc lập, unit và PostgreSQL integration quan trọng; E2E cho luồng trọng yếu. Không thêm test chỉ soi cấu trúc file hoặc để tăng số lượng.

Agent không tự thuê VPS, mua domain hoặc kích hoạt dịch vụ có phí. VPS, domain, tài khoản email gửi đi và tài khoản ngân hàng nhận tiền do chủ shop cung cấp hoặc tự thiết lập; không lưu secret hay dữ liệu khách vào progress/log.
