# Kiến trúc và contract

Ngày 23/10/2026; đây là thiết kế đích, không phải danh sách tính năng đã implement. Kết quả thực tế ở [progress](../progress.md).

## Module và data flow

React UI → API client → Controller (DTO/guard) → Service (nghiệp vụ/owner/transaction) → Prisma → PostgreSQL. Backend không phải MVC với server-rendered View; trang HTML share là ngoại lệ nhỏ phục vụ metadata, không đổi kiến trúc frontend SPA.

| Module | Sở hữu | Hướng dependency |
|---|---|---|
| Auth/Users | Tài khoản, phiên, token hash, role, guard/decorator | Prisma/Mail |
| Categories/Products | Catalog, variant/SKU, draft/publish/hide | Prisma/Uploads khi gắn ảnh |
| Inventory | Toàn bộ quy tắc thay đổi kho và ledger | Prisma |
| Payments | Thu, phân bổ, nghĩa vụ hoàn, hoàn và đối soát | Prisma |
| Orders | Tạo/hủy/xuất/giao, payment/expiry coordination, giao thất bại | Inventory/Payments/Products/Settings |
| Returns (ngoài phạm vi mở bán) | Điều kiện, claim, review/receive/inspect/resolve — chỉ làm khi chủ shop yêu cầu luồng tự động | Orders/Inventory/Payments |
| Uploads/Mail/Settings | Ảnh, gửi thông báo, cấu hình (phí giao, hạn chuyển khoản, tài khoản VietQR) | Prisma + dịch vụ ngoài khi cần |

Payments không gọi Orders; Orders không import Returns. Dùng cùng Prisma.TransactionClient giữa các service trong một nghiệp vụ. Không dùng forwardRef che dependency vòng. Không Repository bọc Prisma thuần túy.

Từ 29/10/2026 đổi trả xử lý thủ công (business-rules § Đổi/trả). Nếu sau này làm Returns tự động: Returns đọc ExchangeLink và trạng thái replacement để suy ra needsResolution; Orders không gọi ngược Returns hoặc cập nhật bảng Returns. Nhận lại giao thất bại luôn do Orders xử lý cả kho và nghĩa vụ tiền theo business-rules.

## Cấu trúc và trách nhiệm

`apps/backend/{prisma,src/config,src/common,src/modules,test}`; module chỉ có controller khi cung cấp HTTP. Vị trí source hiện tại: PrismaModule/PrismaService ở `src/modules/prisma`; InventoryModule/InventoryService ở `src/modules/inventory` sau refactor M3.0.2. Inventory giữ trách nhiệm nghiệp vụ độc lập; import phải khớp vị trí file thực tế.

`apps/frontend/src/{app,layouts,features,shared,theme}`; features auth/catalog/cart/checkout/account/admin. Trong feature: pages/components/hooks/api/types chỉ được tạo khi có nội dung.

Page kết nối dữ liệu/bố cục; component tương tác phạm vi rõ; hook logic React; API file gọi HTTP; controller nhận input/guard; service giữ nghiệp vụ; DTO allowlist không dùng Prisma input; response select rõ không password hash/token.

File nhiều trách nhiệm hoặc khoảng trên 300 dòng cần đánh giá tách, không máy móc. Không effect/hook khổng lồ hoặc memo hàng loạt.

### Tổ chức backend sau M3.0.2

- `*.module.ts` đăng ký imports/controllers/providers; controller nằm trong `*.controller.ts`. Categories và Products có controller public/admin riêng; Uploads tách admin upload và public media; Inventory có controller quản trị riêng.
- CategoriesService chứa truy vấn/transaction danh mục; UsersService cập nhật hồ sơ theo ID lấy từ phiên đã xác thực. Controller không thao tác Prisma cho các nghiệp vụ này. HealthController chỉ đọc `SELECT 1` để kiểm tra hạ tầng, không phải nghiệp vụ cần thêm lớp service.
- DTO thuộc feature đặt trong `modules/<feature>/dto`; `common/dto/request.dto.ts` giữ phân trang/version, `common/dto/transforms.ts` giữ chuẩn hóa chuỗi dùng chung. Categories/Inventory không phụ thuộc DTO của Products.
- `Roles` và `CurrentUser` ở `modules/auth/decorators`; RolesGuard đọc cùng metadata key `auth:roles`, tiếp tục chạy sau SessionGuard.
- Theo lựa chọn người dùng, UsersController và AdminAccessController vẫn là hai class trong `modules/users/users.controller.ts`; mỗi class có route/guard riêng. Không tạo `auth/admin-access.controller.ts`.
- Refactor này giữ HTTP contract, validation và nghiệp vụ; không đồng nghĩa frontend M3 đã hoàn thành. Danh sách file và kết quả kiểm tra ở [M3.0.2 trong progress](../progress.md).

### Tổ chức frontend sau M3.0.3

- `app/App.tsx` khai báo route; `app/router/PrivateRoute.tsx` xử lý trạng thái phiên/role và đưa user đã đọc cho nội dung route. Backend vẫn kiểm tra quyền độc lập.
- `features/catalog/pages/CatalogIntroPage.tsx` chỉ là intro empty state hiện có, chưa phải catalog API. Trang thông tin ở `features/information/pages/PolicyPage.tsx`, nội dung tại `features/information/content/policies.ts`; trang không tìm thấy ở `app/pages/NotFoundPage.tsx`.
- `shared/api/client.ts` gửi JSON hoặc FormData, không tự đặt Content-Type cho multipart để browser tạo boundary; nhận Idempotency-Key từ caller và giữ CSRF/no automatic mutation retry.
- Link token chỉ lưu trong memory. Chỉ fragment có tham số `token` mới cập nhật token và bị xóa khỏi URL; query được giữ, anchor như `#main-content` vẫn hoạt động. Nội dung form/kết quả verify/reset có vòng đời theo token để kết quả cũ không chồng lên link mới.
- M3.1–M3.2 có `/admin/categories` tại `features/admin/categories`: `pages/CategoriesPage.tsx` giữ Query/list/create/update flow; `components/CategoryForm.tsx` thay CategoryCreateForm, dùng chung field/state/validation cho tạo và sửa; `components/CategoryEditDialog.tsx` giữ snapshot/version của lần mở và điều khiển tải dữ liệu mới/đóng; `api/categories.api.ts` giữ contract GET/POST/PATCH. Đây là UI quản trị; module Categories ở backend vẫn độc lập. Form không tự quyết định quyền, backend guards/DTO/unique slug vẫn kiểm tra chính.
- Query `admin-categories` được invalidate sau tạo/sửa để đọc lại dữ liệu server. Snapshot edit không tự đổi khi query refetch; lỗi 409 giữ draft và version ban đầu. Nút Tải dữ liệu mới thay snapshot/form sau khi tải thành công theo thao tác tường minh; lỗi tải giữ input. Khóa đồng bộ ngăn submit lặp và đóng/reload trong lúc lưu.
- M3.3 thêm `features/admin/products`: `api/products.api.ts` chứa contract/allowlist size và API list/create; `components/ProductCreateForm.tsx` giữ input/error/busy; `pages/ProductCreatePage.tsx` tải danh mục và điều phối tạo; `pages/ProductsPage.tsx` đọc query list, hiển thị SKU/giá/khả dụng/status và phân trang bằng URL `?page=`. Routes đều qua PrivateRoute ADMIN; backend vẫn kiểm tra quyền độc lập.
- Tạo sản phẩm gửi đúng một phần tử variants, active=true; DRAFT và Inventory=0 do backend thiết lập, không nhận status/tồn kho từ form. POST lỗi giữ input và không tự retry; thành công invalidate `admin-products` rồi về danh sách. Danh mục tải lỗi ở nền vẫn giữ form dựa trên cache, cảnh báo/retry hiện riêng để không làm mất draft. Danh mục tắt vẫn có thể dùng để lưu nháp theo API hiện có, option được ghi rõ trạng thái. Kế hoạch từng phần ở [m3-implementation-plan.md](m3-implementation-plan.md).
- M3.4.1 thêm sửa thông tin nháp: `components/ProductInfoFields.tsx` nhóm trường tên/slug/danh mục/mô tả dùng chung cho `ProductCreateForm` và `ProductEditForm`; `components/ProductEditForm.tsx` giữ state/lỗi/busy và đọc biến thể + `expectedVersion` từ snapshot; `pages/ProductEditPage.tsx` giữ snapshot chốt lúc mở form (revision remount chỉ khi bấm Tải dữ liệu mới), refetch nền không rebase; `ProductsPage.tsx` thêm link Sửa chỉ cho DRAFT và alert cập nhật. `ProductEditForm` gửi đúng `{name,slug,description,categoryId,variants[{id,sku,size,color,price,active}],expectedVersion}`, không gửi inventory/available/images/status; 409 (version cũ hoặc slug trùng) giữ input và không đoán nguyên nhân. Route `/admin/products/:productId` qua PrivateRoute ADMIN; backend GET/PATCH guard/DTO/version kiểm tra độc lập. Chưa có UI sửa biến thể/ảnh/kho hoặc public catalog M3.
- Bản sửa review M3.4.1 đặt `operationRef` và `operation` ở page để khóa hai chiều save/reload, độc lập với vòng đời form. Form nhận disabled bên ngoài và kết hợp pending cục bộ; explicit reload đang chờ không cho PATCH, save đang chờ không cho explicit reload/remount. Khóa được nhả trong finally kể cả lỗi. Nội dung biến thể dùng overflowWrap:anywhere để SKU64 không có điểm ngắt vẫn vừa mobile.
- M3.4.2 cho sửa biến thể của nháp: `components/VariantFields.tsx` là một dòng SKU/size/màu/giá/bật; `components/variantDrafts.ts` giữ kiểu `VariantDraft`, chuyển đổi sang `VariantUpdateInput` và `validateVariants` (SKU trùng, size+màu trùng, giá nguyên 1..100.000.000) trả lỗi theo khóa `variants.<index>.<field>`. `ProductEditForm` giữ danh sách dòng; dòng đã lưu gửi kèm `id` và chỉ tắt được bằng `active`, dòng mới không có `id` và bỏ được trước khi lưu. 409 nêu version cũ, slug, SKU hoặc size/màu trùng. Biến thể hiển thị bằng ô nhập nên SKU dài cuộn trong ô, không còn cần overflowWrap của bản M3.4.1. Backend/DTO không đổi; đổi chéo size/màu giữa hai biến thể trong một lần lưu vẫn bị unique (product,size,color) từ chối.
- M3.5 thêm gắn ảnh trên trang sửa nháp: `api/uploads.api.ts` gửi multipart qua client CSRF chung; `components/ProductImagesManager.tsx` giữ ảnh vừa tải (UploadAsset tạm) ở state cục bộ, kiểm tra nhanh loại/5 MB/8 ảnh rồi gọi `onSave(assetIds)`; `ProductEditPage` PUT `/admin/products/:id/images` với version của snapshot, dùng chung khóa `operation` (`save`/`reload`/`images`). Lưu thông tin và lưu ảnh dùng chung `Product.version`: sau PUT thành công page chỉ thay `version`/`images` của snapshot, form thông tin đọc `expectedVersion` từ snapshot của page nên phần đang nhập vẫn lưu được. Việc này an toàn vì PUT chỉ thành công trên đúng version đã chốt. Thumbnail admin đọc `/api/v1/admin/uploads/images/:id` qua cookie; `/api/v1/media/:id` chỉ trả ảnh của sản phẩm PUBLISHED trong danh mục bật.
- M3.6 sắp xếp/gỡ ảnh: `ProductImagesManager` giữ `saved` (danh sách server đang giữ) và `rows` (thứ tự đang chỉnh, gồm cả upload chưa gắn); khác nhau thì bật Lưu/Hủy, ảnh trong `rows` nhưng không có trong `saved` là chưa lưu. Một ô ảnh tách ra `components/ProductImageTile.tsx` (thumbnail, nhãn Ảnh chính, Lên/Xuống/Gỡ bằng nút để dùng được bàn phím và mobile). Lưu gửi toàn bộ `assetIds` theo thứ tự; server thay cả danh sách, nên sau khi thành công `rows` thành `saved` mới. Ảnh gỡ đã lưu không khôi phục được vì backend chỉ gắn lại asset dưới 24 giờ. E2E luồng ảnh tách sang `e2e/product-images.spec.ts`.
- M3.8 xuất bản/ẩn: `components/ProductStatusPanel.tsx` hiện trạng thái, 3 điều kiện xuất bản tính từ snapshot đã lưu (danh mục bật lấy từ query danh mục, ảnh đã lưu, biến thể bật) và nút Xuất bản/Ẩn sản phẩm; server `ProductsService.state` vẫn kiểm tra lại trong transaction. `ProductEditPage` hiện khung trạng thái cho mọi trạng thái (form và khung ảnh chỉ cho DRAFT), thêm thao tác `status` vào khóa chung, thay snapshot bằng phản hồi sau khi đổi trạng thái. `ProductEditForm` và `ProductImagesManager` báo `onDirtyChange`; page khóa Xuất bản khi còn thay đổi chưa lưu vì xuất bản sẽ gỡ hai phần này khỏi trang. `ProductsPage` có link Quản lý cho hàng không phải nháp. E2E ở `e2e/product-status.spec.ts`.

## Sitemap, UI và state

Public: `/`, `/shop`, `/products/:slug`, `/cart`, `/checkout`, `/orders/lookup`, `/orders/:code` (link có token tra cứu), `/size-guide`, `/contact`, `/shipping`, `/returns-policy`, `/privacy` (chính sách bảo mật), trang thông tin người bán.

Auth: `/login` (admin), `/verify-email`, `/forgot-password`, `/reset-password`. `/register` và tài khoản khách của M2 ẩn khỏi cửa hàng từ 29/10/2026; code giữ lại cho nhu cầu sau.

Admin: `/admin/{products,categories,inventory,orders,payments,refunds,reports,settings}`. Không có `/admin/returns` khi mở bán.

```text
AppProviders (Theme, Query, Auth, Cart)
└── Router
    ├── StoreLayout (Header, Navigation, CartBadge, Footer có thông tin người bán)
    │   ├── CatalogPage → Filters, ProductGrid → ProductCard, Pagination
    │   ├── ProductDetail → Gallery, VariantSelector, QuantityInput
    │   ├── CartPage → CartItems, Summary
    │   ├── CheckoutPage → ContactAddressForm, PaymentMethod, OrderReview
    │   └── OrderLookup / OrderDetail → Timeline, PaymentSummary (VietQR), CancelAction
    ├── AuthLayout → AuthPage → AuthForm (admin đăng nhập)
    └── AdminLayout → FeaturePage → Table/Cards, Editor, Actions
```

Server state ở query cache; filter/search/sort/page ở URL; form/dialog/variant selection ở phạm vi gần nhất; cart ở context + localStorage (variantId/quantity/version). Không persist PII/token. Không lưu state suy ra được.

Cache catalog ngắn (đề xuất 60s), invalidate sau sửa; detail refetch khi mở/focus; checkout luôn server revalidate. Không optimistic update tiền/kho quan trọng. Effect nếu dùng phải cleanup/loại phản hồi cũ.

Thiết kế trắng/đen, ảnh 3:4, responsive hai cột mobile khi đủ chỗ, một cột khi quá hẹp, 3–4 desktop. Label/error/focus/keyboard rõ; target chạm rộng; không dùng hover/màu làm tín hiệu duy nhất. Loading/empty/error/retry và submitting state bắt buộc.

Refresh deep URL phải tới SPA. HTML ban đầu có metadata chung; `/share/products/:slug` HTML metadata do Nest trả, link tới SPA, phải thử crawler thực. Không hứa SPA có SEO/preview động đầy đủ chỉ vì JS đổi title.

## Phiên, proxy và bảo vệ

- Session server PostgreSQL; thư viện session/store trưởng thành, không JWT/localStorage dài hạn.
- Cookie deploy HttpOnly/Secure/SameSite=Lax/host-only, prefix __Host- phù hợp. Local HTTP dùng cấu hình cookie local riêng.
- Khách absolute 7d/idle 24h; admin absolute 12h/idle 30min. Rotate sau login; logout/reset/vô hiệu hóa thu hồi phiên theo quy tắc.
- CSRF synchronizer token + kiểm tra Origin cho write, kể cả login với pre-session. Không mutation qua GET.
- VPS: một reverse proxy HTTPS (ví dụ Caddy hoặc nginx) là public origin duy nhất; phục vụ SPA đã build, chuyển `/api/*` (và `/share/*` khi có) tới backend nội bộ, còn lại → `index.html`. FE gọi URL tương đối nên cookie cùng origin, không cần CORS. Backend chỉ nghe trong mạng nội bộ của VPS, bật `TRUST_PROXY` đúng số hop.
- Phải thử forwarding method/body/Set-Cookie/headers, CSRF và no-store trên deploy; không tự coi proxy đã đạt từ tài liệu.
- Proxy đặt header bảo mật cho SPA: CSP, `frame-ancestors 'none'`, HSTS, `nosniff`.
- Role/owner ở backend mỗi endpoint; không cho client chọn role/payment status; DTO whitelist + forbid unknown, query sort allowlist, giới hạn body/page.
- Rate limit ban đầu: login 5/min theo IP + email **và** giới hạn theo tài khoản độc lập IP (M3.17); reset/resend 3/15min/tài khoản; tạo đơn khách vãng lai theo IP và SĐT, tra cứu đơn theo IP (con số chốt ở M4.3/M4.4); upload 10 ảnh/min/admin. Một instance trên VPS nên store in-memory chấp nhận được; restart làm reset bộ đếm.
- Swagger local bật, deploy tắt. ADMIN bắt buộc xác thực 2 bước TOTP trước mở bán (M3.17).
- Secret chỉ server, không VITE_*. Log che cookie/token/hash/password/address. Không stack trace/hạ tầng trong error response.

## Dữ liệu đích

User, Session, AuthToken; Category, Product, Variant, ProductImage; Inventory, InventoryMovement; Order, OrderItem, OrderStatusHistory, CancellationRequest; Payment, PaymentAllocation, RefundObligation, Refund; ShopSettings, UploadAsset, NotificationDelivery, IdempotencyRecord, AuditLog. ReturnRequest/Item và ExchangeLink chỉ tạo khi làm lại đổi trả tự động.

Order của khách vãng lai: `userId` nullable; snapshot tên, SĐT đã chuẩn hóa, địa chỉ, email tùy chọn; `code` (mã đơn, unique) và băm của token tra cứu. ShopSettings: phí giao, hạn chuyển khoản, ngân hàng/số tài khoản/tên chủ tài khoản cho VietQR, thông tin người bán, `version`.

Tiền numeric(14,0), integer VND và API safe number trong giới hạn nghiệp vụ; thời gian UTC timestamptz, API ISO UTC, UI Asia/Ho_Chi_Minh. Snapshot tên/SKU/size/màu/giá/địa chỉ/phí/policy. Không hard-delete lịch sử. FK/check/unique cần migration SQL khi Prisma không mô tả đủ. Index theo query, không tự thêm hàng loạt.

## Contract M4 (chốt ở M4.0.1)

Chi tiết đầy đủ: [m4-contract.md](m4-contract.md). Điểm cốt lõi: Orders là service điều phối duy nhất mở transaction; Inventory/Payments nhận `TransactionClient`, không tự mở transaction hay gọi ngược; thứ tự khóa hàng đơn → kho theo `variantId` tăng dần → nguồn tiền. Actor ADMIN/GUEST/SYSTEM lưu `actorType` + `actorId` nullable; response lịch sử luôn có tên hiển thị ("Khách đặt hàng"/"Hệ thống" khi không có user). Idempotency: scope do server đặt, identity server cấp (không dùng IP), canonical hash SHA-256, cùng key+nội dung trả cùng resource, khác nội dung 409, record lưu response cùng commit. Token tra cứu ≥128 bit chỉ lưu SHA-256; mất response thì replay cùng key/body trả cùng resource nhưng không phát lại token, khách lấy lại qua tra cứu mã+SĐT. Các con số chống spam, quote TTL, retention là đề xuất chờ duyệt trong contract, không phải nghiệp vụ chính thức.

M4.0.2 (đã áp dụng migration `202610290001_m4_order_core` vào local/test 29/10) thêm schema `shop_settings`, `checkout_quotes`, `orders`/`order_items`/`order_status_history`, `idempotency_records` và metadata actor/source/effectKey cho `inventory_movements` (actorId chuyển nullable, backfill ADMIN cho lịch sử M3). M4.0.3 (đã triển khai) thêm `InventoryOperationsService` (reserve/release/ship nội bộ nhận TransactionClient, khóa theo variantId tăng dần, replay/conflict theo effectKey+hash), giữ nguyên API điều chỉnh admin M3; chưa có endpoint/UI M4.

## Contract HTTP chung

Prefix `/api/v1`; ID string, enum trạng thái rõ; không return Prisma model tràn trường.

Pagination page>=1, pageSize mặc định 24, max48; sort allowlist + id tiebreaker. Response `{items,page,pageSize,total}`.

Error `{code,message,fieldErrors,requestId}`; fieldErrors là danh sách `{field,message}`. 400 validation/unknown field; 401 session; 403 role/CSRF; 404 missing/không được biết tồn tại; 409 stock/version/state/idempotency/duplicate ref; 413/415 upload; 429 limit; 500/503 hệ thống an toàn.

Mutation nghiệp vụ cần `Idempotency-Key`, update cần expectedVersion. Retry không tự động cho create/payment/refund nếu chưa dùng lại key hợp lệ. GET tự retry có giới hạn khi thích hợp.

| Quyền/module | Endpoint | Input → Output / lỗi chính |
|---|---|---|
| Public Auth | GET /auth/csrf | pre-session → csrfToken; no-store |
| Public Auth | POST /auth/register | email/password/name → accepted; 400/429 |
| Public Auth | POST /auth/login | email/password → safe user + cookie; 401/429 |
| Session Auth | POST /auth/logout | → revoke cookie/session |
| Auth | POST /auth/verify-email, /resend-verification | token/request → result; 400/429 |
| Public Auth | POST /auth/forgot-password, /reset-password | email/token+password → uniform accepted/result; 400/429 |
| Owner Users | GET/PATCH /me | allowlisted profile → safe user; 401/400 |
| Admin Auth | GET /admin/access | → allowed boolean; kiểm chứng quyền cho trang vào admin M2, không thay đổi dữ liệu |
| Public Catalog | GET /categories, /products, /products/:slug | filter/sort/page → public catalog; 400/404 |
| Public Settings | GET /shop-settings/public | → fees/policy public only |
| Public Checkout | POST /checkout/quote | items/method → quoteId, currency, subtotal, shippingFee, total, expiresAt, settingsVersion; 400/409 |
| Public Orders | POST /orders | Idempotency-Key + quoteId/items/contact/address/method → mã đơn + link tra cứu (token chỉ trả một lần); 400/409/429 |
| Public Orders | GET /orders/:code (token trong header/body, không trong log), POST /orders/lookup | token hoặc mã đơn + SĐT → đơn đó (kèm VietQR nếu chuyển khoản); 404 đồng nhất/429 |
| Public Orders | POST /orders/:code/cancel, /cancellation-requests | token + reason/version → order/request; 404/409 |
| (Ngoài phạm vi) Returns | POST /orders/:id/returns, GET /returns/:id | chỉ khi làm lại đổi trả tự động |
| Admin Categories | GET/POST/PATCH /admin/categories[/:id] | category fields → category; 400/409 |
| Admin Products | GET/POST/PATCH /admin/products[/:id] | catalog/variant fields → admin product; 400/409 |
| Admin Products | POST /admin/products/:id/publish, /hide | version → state; 409 |
| Admin Products | PUT /admin/products/:id/images | owned asset IDs/order → images; 400/409 |
| Admin Uploads | POST /admin/uploads/images | JPEG/PNG/WebP max5MB, dimensions bounded → temp asset; 413/415/429 |
| Admin Inventory | GET /admin/inventory, /movements | filters → stock/ledger |
| Admin Inventory | POST /admin/inventory/adjustments | variant/delta/reason → stock/effect; 400/409 |
| Admin Orders | GET /admin/orders[/:id] | filters → list/detail |
| Admin Orders | POST /admin/orders/instagram | recipient/items/method → nullable-owner order; 400/409 |
| Admin Orders | POST /admin/orders/:id/confirm, /pack, /ship, /deliver | version/tracking/actual time → state; 409 |
| Admin Orders | POST /admin/orders/:id/cancel, /cancellation-decisions | reason/decision/version → result; 409 |
| Admin Orders | POST /admin/orders/:id/delivery-failure, /return-receipt | failure/inspection → order+stock; 409 |
| Admin Orders/Payments | POST /admin/orders/:id/payments | amount/time/method/account/reference/note → receipt+allocation+exception; 409 |
| (Ngoài phạm vi) Admin Returns | /admin/returns… review/receive/inspect/replacement | chỉ khi làm lại đổi trả tự động |
| Admin Payments | GET /admin/payments, /refund-obligations, /refunds | → ledger |
| Admin Payments | POST /admin/refund-obligations/:id/refunds | amount/status/time/reference → manual result; 409 |
| Admin Settings | GET/PATCH /admin/settings | allowlisted settings/version → settings; 400/409 |
| Admin Reports | GET /admin/reports/summary | date range → defined metrics; 400 |
| Ops | GET /health/live, /health/ready | minimal health; 503 if not ready |

## Deploy trên VPS (quyết định 29/10/2026)

Chủ shop thuê VPS; agent không tự thuê/mua. Bố cục dự kiến trên một VPS (chi tiết chốt ở M3.16/M6):

- Reverse proxy HTTPS (Caddy/nginx, chứng chỉ tự gia hạn) → SPA tĩnh + `/api` tới backend Node chạy như service tự khởi động lại.
- PostgreSQL trên cùng VPS (hoặc dịch vụ quản lý nếu chủ shop chọn), chỉ nghe nội bộ; `migrate deploy` trước khi bật bản mới.
- Ảnh lưu trên ổ đĩa VPS tại đường dẫn tuyệt đối cấu hình được (không phụ thuộc thư mục làm việc); proxy hoặc backend phục vụ ảnh công khai với cache dài.
- Backup hằng ngày `pg_dump` + thư mục ảnh ra **ngoài VPS** (dịch vụ lưu trữ khác), có mã hóa/kiểm soát truy cập; diễn tập khôi phục sang DB khác trước mở bán.
- Email gửi qua Resend (hoặc tương đương) với domain riêng đã cấu hình SPF/DKIM/DMARC; chưa có domain thì email chỉ tới chủ tài khoản.
- Server chạy liên tục nên quét hết hạn chuyển khoản chạy định kỳ; vẫn giữ catch-up lúc khởi động cho restart/deploy.
- Bảo vệ VPS: SSH chỉ bằng key, tường lửa chỉ mở 22/80/443, cập nhật bảo mật tự động; báo động khi `/api/v1/health/ready` lỗi.

Khảo sát hạ tầng miễn phí cũ (Render/Neon/Cloudinary, 23/10/2026) không còn là phương án chính: free tier ngủ sau 15 phút và ổ đĩa tạm mất ảnh khi deploy lại. Nguồn tham khảo giữ lại bên dưới.

Nguồn chính thức khảo sát ngày 23/10/2026:
- https://render.com/docs/free
- https://render.com/docs/redirects-rewrites
- https://render.com/pricing
- https://neon.com/pricing
- https://cloudinary.com/documentation/billing_and_plans
- https://resend.com/pricing
- https://resend.com/docs/knowledge-base/403-error-resend-dev-domain
- https://pricing.registrar.cloudflare.com/
- https://asvs.owasp.org/

Health/log/env fail-fast, migration review, seed tường minh, admin riêng không password mặc định, backup ngoài môi trường và restore thật. RPO mục tiêu ≤ 24 giờ theo backup hằng ngày; chủ shop chốt lại RPO/RTO ở M6. App rollback chỉ khi schema tương thích; không tự rollback data.

## Dependency và phiên bản

Ứng viên của bản kế hoạch chưa phải bộ đã cài: Node24 LTS, React19.3, Vite8.3, Router8, MUI9, Nest12, Prisma7 (không8 RC), PG18, TS5.9. Trước cài đọc registry engines/peers và metadata chính thức; ghi phiên bản chốt vào progress/lockfile. Node local hiện 22.20 cần kiểm chứng từng tool; không tự đổi OS Node.

Dependency chỉ thêm kèm lý do: TanStack Query (server cache), DTO validator/transformer (runtime), session+PGstore (phiên), Argon2 (hash), Prisma PGadapter/driver, Nest scheduler (jobs), Vitest/React test/Supertest/Playwright (test). Chưa Redux/Axios/shared-contract library.

Local M2 dùng adapter preview mail riêng, không cần tài khoản ngoài. Playwright chỉ test trình duyệt, concurrently chỉ dev watch TS + API; không đưa vào runtime sản phẩm. Guard hiện có hai bucket IP và IP+email, login 5/min trên identity, reset/resend/register 3/15min trên identity; IP chung 120/min để không khóa cả khách dùng proxy chung. Store in-memory có hạn chế restart/scale; chấp nhận được với một instance trên VPS, cần store dùng chung nếu sau này chạy nhiều instance.
