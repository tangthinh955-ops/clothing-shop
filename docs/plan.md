# Kế hoạch triển khai Clothing Shop

**Mục tiêu:** Một website demo một shop có frontend, backend, PostgreSQL và upload ảnh thật; có thể kiểm thử, deploy và bàn giao.

**Kiến trúc:** React SPA → API client → Nest Controller/DTO/Guard → Service → Prisma → PostgreSQL. Backend là modular monolith. Hai app build/deploy riêng; chưa thêm Repository, Redis, queue, microservices, GraphQL hoặc Next.js.

**Đặc tả:** [business-rules.md](business-rules.md), [architecture.md](architecture.md). Yêu cầu gốc: tài liệu người dùng gửi ngày 23/10/2026 và bản kế hoạch trong hội thoại đã được cho phép tiến hành.

**Cách làm:** Thực hiện trực tiếp từng bước nhỏ; test nghiệp vụ trước implementation. Chạy kiểm tra, cập nhật `progress.md` theo kết quả thật. Không tự mở rộng phạm vi; thay đổi kiến trúc/API/schema vượt thiết kế phải được giải thích và xác nhận.

## Ràng buộc toàn dự án

- React + Vite + TypeScript strict + React Router + MUI; NestJS + Prisma + PostgreSQL.
- DTO validation runtime, CUSTOMER/ADMIN, session server và cookie HttpOnly, không token dài hạn trong localStorage.
- npm workspaces, một lockfile ở root; kiểm tra phiên bản trước cài, khóa major trong tính năng.
- Backend tính giá/phí/tổng, kiểm tra quyền sở hữu; không dùng `any` che lỗi.
- Mọi thay đổi kho đi qua Inventory; nghiệp vụ nhiều module dùng chung transaction; không external I/O trong transaction.
- Dữ liệu giả, dịch vụ miễn phí ưu tiên; không kích hoạt gói trả phí.
- Không reset DB có đơn, seed không tự phá dữ liệu khi startup; không công khai mật khẩu admin mặc định.
- Các chính sách 30.000đ, 30 phút, 7 ngày là giả định demo, chưa được shop duyệt.

## Thời gian và bản trình diễn

Người dùng có 10 giờ/tuần. Ước lượng intern: 310–460 giờ, cộng 25% dự phòng: 388–575 giờ, khoảng 39–58 tuần. Ước lượng lại sau hai mốc đầu theo tốc độ thực tế; không coi đây là hạn bàn giao cam kết.

Tháng đầu khoảng 40 giờ: ưu tiên thiết kế, nền tảng và deploy thử. Không hứa hoàn thành toàn bộ kho/tiền/đổi trả trong một tháng. Bản trình diễn danh mục sớm nếu được ưu tiên không thay thế nghiệm thu nghiệp vụ.

## Các mốc

| Mốc | Sản phẩm kiểm tra được | Giờ |
|---|---|---:|
| M1 | Quy tắc, UI/state, API/database, checklist nhất quán | 24–36 |
| M2 | Tài khoản/session/role chạy FE–API–DB local; cấu hình CI; deploy thử hoãn theo yêu cầu local trước | 40–60 |
| M3 | Admin đăng hàng/ảnh, catalog công khai, kho có lịch sử | 48–68 |
| M4 | Giỏ, quote, đơn, COD/chuyển khoản, hủy, đơn Instagram | 70–100 |
| M5 | Đổi/trả một phần, hoàn tiền, đơn thay thế, kiểm tra đồng thời | 64–92 |
| M6 | Deploy đầy đủ, restart, smoke test, backup/restore và rollback | 24–40 |
| M7 | ASVS/ZAP/E2E, sửa và kiểm tra lại, nghiệm thu/bàn giao | 40–64 |

## Nhịp triển khai và chạy thử từng phần

- M1–M7 là các mốc tổng quan. Trước khi code mỗi mốc, lập bảng chia thành `Mx.1`, `Mx.2`, `Mx.3`... theo một thay đổi hoặc luồng nhỏ có thể chạy thử ngay; phần còn lớn tiếp tục chia thành `Mx.1.1`, `Mx.1.2`... .
- Bảng chia phần ghi rõ thay đổi quan sát được, phạm vi, cách thử/kết quả mong đợi và phụ thuộc. Ưu tiên mỗi phần dùng được xuyên suốt FE–API–DB; phần nền tảng chưa có UI phải có cách kiểm tra và giới hạn rõ.
- Trước từng phần: gửi kế hoạch riêng trong chat → dừng chờ duyệt → triển khai đúng phần → kiểm tra và cập nhật `progress.md` → bàn giao cách thử → dừng chờ phản hồi. Không code cả mốc rồi mới gửi hướng dẫn.
- Duyệt lộ trình không đồng nghĩa cho phép tự chạy hết các phần. Chỉ chuyển phần khi người dùng yêu cầu và phần tiếp theo có kế hoạch cụ thể đã được duyệt; sửa lỗi phần đang thử trước khi đi tiếp.
- Ghi riêng trạng thái đã viết, đã kiểm tra kỹ thuật và đã được người dùng chạy thử; giữ tiêu chí hoàn thành của mốc bên dưới. Các phần cụ thể cần đối chiếu working tree trước khi lập, không suy ra trạng thái từ tài liệu thiết kế.

## Phân công hai người

Từ 29/10/2026 phần còn lại chia cho hai người. Chi tiết M3 ở [m3-implementation-plan.md](m3-implementation-plan.md#phân-công-hai-người-29102026). M4–M7 dưới đây là khung, sẽ chia lại thành `Mx.y` và duyệt trước khi bắt đầu mỗi mốc.

| Mốc | Người A | Người B |
|---|---|---|
| M4.0 | Schema/migration Order, Payment, Settings, Idempotency | Review migration trước merge |
| M4 | Khách: giỏ local → quote → tạo đơn COD giữ kho atomic → đơn của tôi → hủy | Admin/tiền: chuyển trạng thái đơn, chuyển khoản (deadline, ghi khoản thu, sweep hết hạn), đơn Instagram, email ngoài transaction |
| M5 | Trả hàng: yêu cầu → duyệt → nhận/kiểm → restock | Nghĩa vụ hoàn/refund, đơn thay thế đổi size |
| M6 | Deploy + smoke HTTPS/proxy | Backup/restore + rollback |
| M7 | E2E, mobile, UI Instagram | ASVS/ZAP, hướng dẫn admin |

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

### M4 — Bán hàng

- [ ] [CREATE] orders/payments/settings và features cart/checkout/account orders/admin orders/payments; [MODIFY] Mail bổ sung notification của đơn.
- [ ] [MODIFY] schema/migration; thêm idempotency và lịch sử.
- [ ] Test PostgreSQL thật: hàng cuối, tạo lặp, hủy/xuất, xác nhận tiền/hết hạn, trùng khoản thu.
- [ ] Checkout → AddressForm/PaymentMethod/OrderReview; OrderDetail → Timeline/PaymentSummary/CancelAction.
- State: giỏ local không PII/token; quote/đơn server; form địa chỉ trong page, không persist localStorage.
- Flow: quote không giữ kho → create recheck → giữ atomic → xác nhận/đóng gói/xuất; hủy giải phóng và tạo nghĩa vụ hoàn.
- Hoàn thành khi luồng COD/chuyển khoản/Instagram đúng, không vượt kho hoặc tạo trùng nghiệp vụ.

### M5 — Sau bán hàng

- [ ] [CREATE] returns và frontend account/admin returns/refunds.
- [ ] [MODIFY] Orders/Payments/Inventory/schema/migrations trong ranh giới đã chốt.
- [ ] Test claim trùng, trả một phần, nhận hàng lặp, refund đồng thời, lineage đơn thay thế.
- [ ] ReturnForm → EligibleItems/Reason/TargetSize; AdminDetail → Review/Receive/Inspection/Resolution.
- State: dữ liệu server query cache; bản kiểm tra chưa lưu là form local.
- Flow: yêu cầu → duyệt → nhận kiểm → restock phần bán được → replacement/refund obligation → kết quả.
- Hoàn thành khi không nhập/hoàn hai lần và đơn thay thế không ghi doanh thu mới.

### M6 — Vận hành

- [ ] [CREATE] cấu hình rewrite/deploy, `docs/deployment-guide.md`, quy trình backup/restore.
- [ ] [MODIFY] health/log/CI/README theo môi trường thật.
- [ ] Smoke test HTTPS/proxy/refresh, restart/catch-up, ảnh/đơn còn nguyên, restore sang DB khác, rollback app tương thích schema.
- Hoàn thành khi có bằng chứng deploy/restore; chưa đạt nếu chỉ có hướng dẫn chưa chạy.

### M7 — Nghiệm thu

- [ ] [CREATE] `docs/security-test-plan.md`, `docs/admin-guide.md` đúng lúc cần.
- [ ] Chạy ASVS 5.0.0 được map đúng ID, ZAP có auth trên ứng dụng thuộc quyền quản lý, UI mobile/Instagram, E2E.
- [ ] Sửa lỗi xác nhận, kiểm tra lại; không ghi pass trước khi chạy.
- [ ] Ghi commit/môi trường/dataset, phát hiện còn lại và giới hạn free tier.
- Hoàn thành theo [acceptance-checklist.md](acceptance-checklist.md).

## Trọng tâm review xuyên suốt

1. Mạng ngắt sau commit: tạo đơn/thu/hoàn phải truy lại được mà không tạo mới; M4/M5 kiểm tra idempotency thật.
2. Hai thao tác cùng thời điểm: khóa đơn/nguồn tiền và kho theo thứ tự thống nhất; M4/M5 test đồng thời thật.
3. Backend ngủ/restart: deadline không dựa timer RAM; M4/M6 thử catch-up và tiền muộn.
4. Đơn thay thế rồi trả lại: dùng nguồn tiền gốc, không hoàn/ghi doanh thu hai lần; M5 test lineage.
5. Proxy/SPA: deep link, Set-Cookie, CSRF, POST body, không cache dữ liệu riêng tư; M2/M6 kiểm chứng deploy.

## Kiểm tra dự kiến

CI: clean install từ lockfile, lint/typecheck, build độc lập, unit và PostgreSQL integration quan trọng; E2E cho luồng trọng yếu. Không thêm test chỉ soi cấu trúc file hoặc để tăng số lượng.

Không tự triển khai dịch vụ có phí hoặc mua domain. Tài khoản/secret dịch vụ là bước người dùng cung cấp hoặc tự thiết lập; không lưu secret vào progress/log.
