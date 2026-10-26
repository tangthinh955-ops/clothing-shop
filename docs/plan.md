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

- [ ] [CREATE] backend categories/products/inventory/uploads; frontend catalog và admin sản phẩm/danh mục/kho.
- [ ] [MODIFY] schema/migrations/routes; thêm seed giả chạy tường minh.
- [ ] Test SKU trùng, biến thể, nháp/ẩn, ảnh mồ côi, điều chỉnh kho và input upload.
- [ ] Catalog → Filters/ProductGrid/ProductCard/Pagination; Detail → Gallery/VariantSelector; Editor → Fields/Variants/ImageManager.
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
