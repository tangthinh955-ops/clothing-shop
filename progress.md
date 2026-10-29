# Tiến độ Clothing Shop

Kế hoạch: [docs/plan.md](docs/plan.md). Cập nhật theo kết quả thật, không ghi pass cho việc chưa chạy.

## Ngày 29/10/2026 — M3.15: cửa hàng mang thông tin thật, bỏ dấu vết demo

**Phạm vi đã duyệt:** người dùng duyệt kế hoạch M3.15 ("oke"): tên shop **RMG Labels**, người bán cá nhân ở TP. Hồ Chí Minh, Instagram @rmglabels, nội dung chính sách theo đề xuất (đổi trả 7 ngày, còn tag, khách trả phí đổi theo nhu cầu, shop chịu phí hàng lỗi; giao toàn quốc 30.000đ, TP.HCM 1–2 ngày/tỉnh 2–5 ngày, kiểm hàng COD; COD/VietQR hạn 2 giờ; bảo mật dữ liệu). SĐT/Zalo, email chưa có nên không hiển thị (không điền giả). Nhánh `feat/m3.15-real-storefront` từ `main`. **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.**

| File | Thay đổi |
|---|---|
| `apps/frontend/src/shared/shop.ts` (mới) | `SHOP_NAME`, `seller` (tên, người bán, khu vực, Instagram; phone/email null) và `pageTitle()`. Đặt ở `shared` thay vì `features/information/content/shop.ts` như kế hoạch vì trang admin và layout cùng dùng, tránh import chéo feature |
| `apps/frontend/src/features/information/content/policies.ts`, `pages/PolicyPage.tsx` | Chính sách chia mục; nội dung thật cho Giao hàng, Đổi & trả, Liên hệ (lấy từ `seller`, chỉ hiện kênh đã có); thêm `/payment` và `/privacy` |
| `apps/frontend/src/layouts/StoreLayout.tsx` | Bỏ banner/dòng demo; tên RMG LABELS; header không còn Đăng nhập/Tài khoản của khách (admin vẫn thấy Quản trị); chân trang có người bán, Instagram và 5 link chính sách |
| `layouts/AuthLayout.tsx`, `features/auth/pages/AuthPage.tsx` | Tên shop; trang đăng nhập bỏ link "Đăng ký" (route `/register` giữ nguyên, không còn link tới) |
| 10 trang khác (`AccountPage`, `AdminPage`, `CategoriesPage`, `InventoryPage`, 3 trang sản phẩm admin, `CatalogPage`, `ProductDetailPage`), `index.html` | Tiêu đề/thương hiệu dùng `pageTitle`/`SHOP_NAME` thay "Clothing Shop"; meta mô tả không tự thêm định vị thương hiệu |
| `apps/backend/src/cli/seed-demo.ts` | `NODE_ENV=production` → báo lỗi và thoát trước khi đọc cấu hình hay kết nối DB |
| Test | Mới `StoreLayout.test.tsx` (3), `PolicyPage.test.tsx` (5); `App.test.tsx` +1; `seed-demo.integration.spec.ts` +1; E2E `auth.spec.ts` theo header mới |
| `README.md`, `docs/local-trial-m3.md` | Mục M3.15; `seed:demo` từ chối production |

**TDD:** 8 test UI RED (còn banner demo, tên cũ, link đăng nhập/đăng ký, chưa có trang thanh toán/bảo mật) → GREEN 20/20. Seed: RED vì lệnh chỉ dừng tình cờ do cấu hình test không hợp lệ cho production (cấu hình production thật sẽ nhập demo) → GREEN sau chặn có chủ đích.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | Đạt |
| `npm test` | 8 công cụ + 9 backend + 193 frontend |
| `npm run test:integration` | 36/36 |
| `npm run test:e2e:implemented` (DB `_test`) | 34/34 (42.8s) |

**Còn trước mở bán:** SĐT/Zalo và email của shop (sửa `shared/shop.ts`); thủ tục website bán hàng với Bộ Công Thương do chủ shop làm. **Chạy thử:** [docs/local-trial-m3.md](docs/local-trial-m3.md) § M3.15. **Dừng chờ người dùng thử.**

## Ngày 29/10/2026 — Chốt Git M3.16 và M3.16.1

- Người dùng yêu cầu commit/push rồi bổ sung tạo PR vào `main`. Phạm vi là 21 file cấu hình backend production, test, Docker/nginx, template env và tài liệu M3.16/M3.16.1 trên nhánh `feat/m3.16-vps-config`; không gộp M3.15, không tự merge PR hoặc triển khai lại VPS trong bước Git.
- Trước commit đã fetch `origin`, xác nhận remote `https://github.com/tangthinh955-ops/clothing-shop.git`, nhánh đích `main` và chưa có PR của nhánh này. Giữ tác giả Git hiện tại, không thêm dòng ghi công AI.
- Kiểm tra mới trong lượt Git: `./tools/npm.ps1 run typecheck`, `./tools/npm.ps1 run build` và `./tools/npm.ps1 test` đều exit 0; test đạt 8 công cụ + 13 backend + 184 frontend. Build vẫn có cảnh báo chunk >500 kB. Integration 37/37, E2E 34/34 và các smoke test VPS ở mục M3.16.1 bên dưới là bằng chứng của lượt deploy trước, không chạy lại trong bước Git vì code không đổi.
- Rà diff, index, danh sách file, mẫu token/private key và ignore: không phát hiện secret theo mẫu; `git ls-files -ci --exclude-standard` rỗng. Chỉ đưa template env vào commit; env thật, khóa Resend, dữ liệu shop, `.local/`, dependency và build artifact giữ ngoài Git.
- Điểm dừng của yêu cầu Git: commit/push nhánh và mở PR vào `main` để review; chưa merge, chưa xác nhận CI của commit mới. Trạng thái vận hành/giới hạn VPS giữ như mục M3.16.1.

## Ngày 29/10/2026 — M3.16.1: deploy catalog/API lên VPS qua HTTPS

**Phạm vi đã duyệt:** bảng kế hoạch M3.16.1 trong chat, người dùng đồng ý triển khai lên VPS/domain được cung cấp. Thực hiện sớm phần deploy catalog/API của M6.1; giữ riêng nhập sản phẩm, tạo admin, backup ngoài VPS và các luồng M4/M3.17. **Đã deploy và agent đã kiểm tra URL công khai, persistence và gia hạn chứng chỉ; chờ người dùng chạy thử.**

### Bản triển khai và quyền sở hữu thay đổi

- Dùng nhánh sẵn có `feat/m3.16-vps-config`, base `2e3c2cb`, giữ toàn bộ 13 file M3.16 có sẵn trước lượt này; không nhận phần cấu hình HOST/trustProxyHops/uploadsDir và production tests cũ là mới viết trong lượt deploy. Chưa commit/push, chưa có CI cho snapshot thủ công này. Kế hoạch cụ thể được duyệt dùng kiểm tra local trước deploy; pipeline deploy sau CI vẫn thuộc M6.1.
- Release `/srv/rmg-shop/releases/m3-16-1-20261029-174430`, symlink `/srv/rmg-shop/current`. Source cuối lưu trong `source-reviewed.tar.gz`, SHA256 `e57b1babc40a0d955c29b915865817116a8805d8971abe98f543917aa0dfe923`; archive đã loại env thật, dữ liệu ảnh/CSV, dependency Windows và build artifact. Build lại trên Linux.
- API image ID `sha256:3e69d8349803136239018590c44444fb268cb2f82ea695005f59d6344eefe3b7`; web `sha256:17f6a1347185ee5fbb7a349756c1ac7fbdd7688ef163e4fed5e3a0fb0bfb11e6`; migration runner `sha256:8a001c680ea8eac876d686e80407b6f7beb298c235dc7a1033c5e87e5ada52f6`.
- Chỉ thêm Compose project `rmg-shop`, virtual host RMG và hook gia hạn riêng; nginx cũ được sao lưu tại `/srv/rmg-shop/backups/nginx-before-rmg.tar.gz` trên VPS. Các container ứng dụng cũ giữ uptime và trạng thái; không sửa DB/volume của chúng.

### File thực tế thêm/sửa trong lượt này

| File | Thay đổi |
|---|---|
| `.dockerignore` (mới) | Loại env, dependency, generated/build/test artifact, dữ liệu local và thư mục agent khỏi build context |
| `deploy/Dockerfile` (mới) | Multi-stage Node 24.22.1/OpenSSL, generate Prisma/build Linux, runtime API chạy user node, frontend nginx và migration runner riêng |
| `deploy/compose.production.yml` (mới) | Dịch vụ DB/API/web riêng, migration tường minh, healthcheck, restart policy, giới hạn tài nguyên/log, ảnh persistent và secret mount |
| `deploy/nginx/frontend.conf` (mới) | SPA/deep link và cache asset có hash |
| `deploy/nginx/rmglabels.conf` (mới) | HTTP→HTTPS, ACME, proxy API giữ nguyên `/api`, ghi đè forwarded headers; CSP/HSTS cho SPA |
| `deploy/production.env.example` (mới) | Placeholder cho cấu hình production; không chứa key/password thật |
| `docs/deployment-guide.md` (mới) | Bố cục VPS, build/start/migration/HTTPS, kiểm tra, cập nhật/rollback và giới hạn |
| `README.md` | Thêm hướng dẫn deploy production và giới hạn email thử; giữ các thay đổi M3.16 đã có |
| `docs/plan.md` | Ghi M3.16.1 triển khai sớm phần M6.1, không đánh dấu toàn bộ vận hành/CI/backup hoàn tất |
| `apps/backend/src/modules/uploads/media.controller.ts` | Sửa blocker review trong phần M3.16 đã có: chỉ đặt cache public sau khi đọc ảnh thành công |
| `apps/backend/test/catalog.integration.spec.ts` | Thêm kiểm tra lỗi media 404/400 phải giữ `no-store`; giữ các thay đổi cũ |
| `progress.md` | Ghi phạm vi, nguồn gốc thay đổi, bằng chứng và điểm dừng của lượt deploy |

Hai file media/test được sửa thêm so với bảng deploy ban đầu để xử lý blocker thuộc cấu hình M3.16 trước khi đưa lên VPS. Không đổi nghiệp vụ catalog/kho, không thêm dependency ứng dụng hoặc migration mới.

### Data flow và key

Trình duyệt → nginx HTTPS của host → frontend ở `127.0.0.1:4180` hoặc API ở `127.0.0.1:4200` → PostgreSQL riêng trên mạng Docker nội bộ và thư mục ảnh `/var/lib/rmg-shop/uploads`. API chạy production, nhận HTTPS/IP qua đúng một reverse proxy; ảnh đọc thành công mới được cache công khai, lỗi vẫn `no-store`.

- `rmg-shop`: tên Compose project cố định, tách network/volume/container khỏi ứng dụng khác.
- `RMG_RELEASE`: tag chung cho ba image; source snapshot và image ID ghi ở trên giúp đối chiếu/rollback.
- `UPLOADS_DIR`: bind mount persistent, UID/GID 1000 và quyền 0750; API vẫn chạy với root filesystem chỉ đọc.
- `TRUST_PROXY=1`: backend hiểu HTTPS phía nginx, phát cookie `__Host-shop.sid` bảo mật; nginx ghi đè forwarded headers.
- Role DB `rmg_shop`: LOGIN và owner database mới, không SUPERUSER/CREATEDB/CREATEROLE/REPLICATION. Secret DB/session sinh trực tiếp trên VPS; file env/secret root:root 0600 trong thư mục 0700, không đưa vào Git/image/source/log.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| `./tools/npm.ps1 run typecheck`, `run build` | Exit 0; frontend còn cảnh báo chunk >500 kB có sẵn |
| `./tools/npm.ps1 test` sau sửa review | 8 công cụ + 13 backend + 184 frontend đạt |
| Regression cache media | RED đúng lý do: 404 nhận `public, max-age=86400` thay vì `no-store`; sửa sau `await read` → GREEN |
| `./tools/npm.ps1 run test:integration` sau sửa | 37/37 trên DB `_test` |
| `./tools/npm.ps1 run test:e2e:implemented` sau sửa | 34/34 (42.1s). Lượt trước 33/34, trace xác định login bị `net::ERR_NO_BUFFER_SPACE` của Windows, không có HTTP response; không sửa auth để che lỗi, chạy lại tuần tự đạt |
| Build ba image trên Linux | Đạt; migration runner xác nhận OpenSSL 3.0.22. Sửa ba Important từ review: OpenSSL, CSP/HSTS SPA, cache lỗi media |
| Compose/nginx và khởi động | `config --quiet`, `nginx -t` đạt; DB/API/web healthy. Lượt đầu Docker từ chối tmpfs do YAML tách dấu phẩy thành hai mục; quote cả chuỗi rồi khởi động đạt |
| Migration production | Hai migration auth/catalog áp dụng thành công vào DB mới `rmg_shop_production`, không reset/seed |
| HTTPS/proxy smoke chỉ đọc | TLS hợp lệ đúng domain; HTTP redirect; `/shop` + JS asset 200; readiness 200; cookie Secure/HttpOnly/SameSite=Lax/Path=/ và host-only; admin API 401; Swagger 404; media lỗi 400/404 `no-store`; CSP/HSTS có trên SPA |
| Browser production chỉ đọc | Chromium do Playwright quản lý, desktop và mobile 390px render được, không lỗi runtime/CSP hoặc tràn ngang; browser đã đóng đúng cách |
| Persistence | Restart riêng DB RMG, recreate API; hai bản ghi migration còn. File probe của lần deploy do API user ghi vẫn còn sau recreate, đã đọc/xóa đúng probe; không tạo hoặc xóa sản phẩm thật |
| Quyền/cổng/dịch vụ khác | Env/secret 0600, folder 0700; cổng 4180/4200 chỉ loopback; DB không publish; container ứng dụng cũ vẫn chạy, không restart chúng |
| Secret/source/image | Đối chiếu giá trị secret thật ngay trên VPS: không nằm trong source archive, biến runtime nhạy cảm không nằm trong cấu hình image; quét mẫu repo không phát hiện token/private key; không in giá trị khi đối chiếu |
| Gia hạn HTTPS | Certbot cấp chứng chỉ thật đúng domain, hết hạn 27/01/2027; timer active. `certbot renew --dry-run --cert-name rmglabels.duckdns.org --non-interactive --run-deploy-hooks` exit 0, simulated renewal thành công và hook kiểm tra/reload nginx chạy đạt; lệnh có random delay khoảng 238s trước khi thử |

### Chạy thử và điểm dừng

- Mở `https://rmglabels.duckdns.org/shop` hoặc readiness `https://rmglabels.duckdns.org/api/v1/health/ready`.
- Catalog hiện 0 sản phẩm vì database mới. Chưa tạo tài khoản ADMIN, chưa nhập ảnh/sản phẩm local. Snapshot nhánh M3.16 này chưa gồm M3.15/PR #17 nên UI còn nhãn demo; chưa tự gộp phần ngoài phạm vi deploy.
- Email cấu hình qua Resend với sender thử `onboarding@resend.dev`, chưa gửi mail kiểm thử và chưa có domain gửi đã xác minh để gửi khách. Không ghi khóa hoặc địa chỉ nhận riêng vào tài liệu.
- Chưa làm backup ngoài VPS/restore, tự động deploy sau CI, diễn tập rollback về phiên bản ứng dụng cũ (đây là release RMG đầu tiên), M3.17 hoặc M4; chưa nghiệm thu mở bán. Hướng dẫn chi tiết ở [deployment-guide.md](docs/deployment-guide.md).
- Dừng để người dùng chạy thử URL. Các phần tiếp theo cần yêu cầu/kế hoạch riêng; chưa commit/push trong lượt này.

## Ngày 29/10/2026 — M3.16: cấu hình để backend chạy được trên VPS

**Phạm vi:** người dùng yêu cầu "commit và mở PR [M3.15] đi sau đó cấu hình trên VPS". Làm M3.16 theo lộ trình P0: sửa code/cấu hình để backend chạy sau reverse proxy HTTPS trên VPS. Deploy thật (proxy, service, backup) thuộc M6, cần VPS và domain của chủ shop. Nhánh `feat/m3.16-vps-config` từ `main` (chưa gồm M3.15/PR #17). **Đã viết, agent đã kiểm tra local; chờ người dùng xem. Chưa commit.**

| File | Thay đổi |
|---|---|
| `apps/backend/src/config/environment.ts` | `HOST` (mặc định `127.0.0.1`, kiểm tra ký tự); `TRUST_PROXY` → `trustProxyHops` (false/true/1–5), **bắt buộc ≥ 1 ở production**; `UPLOADS_DIR` tuyệt đối, **bắt buộc ở production**, mặc định `.local/uploads` (test: `.local/test-uploads`) tính từ vị trí file, không phụ thuộc thư mục làm việc |
| `apps/backend/src/main.ts` | Nghe `config.host`; lỗi `Invalid configuration: …` (chỉ có tên biến) được in ra, lỗi khác vẫn thông báo chung để không lộ URL/credential |
| `apps/backend/src/application.ts` | `trust proxy` theo số hop cấu hình |
| `apps/backend/src/modules/uploads/uploads.service.ts` | Bỏ chặn `UPLOAD_NOT_CONFIGURED` ở production; thư mục ảnh lấy từ `config.uploadsDir` |
| `apps/backend/src/modules/uploads/media.controller.ts` | Ảnh công khai `Cache-Control: public, max-age=86400`; lỗi và phản hồi khác giữ `no-store` |
| `apps/backend/src/cli/import-products.ts` | Ghi ảnh vào `uploadsDir` từ cấu hình (trên VPS là `UPLOADS_DIR`). `seed-demo.ts` không đổi (chỉ dùng local, M3.15 chặn production) để tránh xung đột với PR #17 |
| `apps/backend/.env.example` | Thêm `HOST`, `UPLOADS_DIR`, giải thích `TRUST_PROXY` |
| Test | `environment.spec.ts` +5 (sửa 1); mới `test/production-config.integration.spec.ts` (2); `catalog.integration.spec.ts` thêm kiểm tra header cache |
| `README.md`, `docs/local-trial-m3.md` | Mục cấu hình production trên VPS; mục M3.16 |

**TDD:** 5 test cấu hình RED (chưa có `host`/`trustProxyHops`/`uploadsDir`) và header cache RED (`no-store`) → GREEN. Test upload production RED đúng lý do (`Chưa cấu hình lưu ảnh cho môi trường deploy.`) → GREEN sau khi bỏ chặn. Test cookie `__Host-` qua proxy đạt ngay (hành vi có sẵn, giữ làm test hồi quy cho cấu hình proxy).

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | Đạt |
| `npm test` | 8 công cụ + 13 backend + 184 frontend |
| `npm run test:integration` | 37/37 |
| `npm run test:e2e:implemented` (DB `_test`) | 34/34 (41.7s) |
| Khởi động `NODE_ENV=production` bằng giá trị giả, thiếu `TRUST_PROXY` / `UPLOADS_DIR` | In đúng "Invalid configuration: TRUST_PROXY is required in production" / "…UPLOADS_DIR…", exit 1, không kết nối DB |

**Còn lại:** M3.17 (bảo vệ admin); M6.1 deploy thật cần VPS + domain. **Dừng chờ người dùng xem.**

## Ngày 29/10/2026 — M3.13b (lộ trình giao Người B, agent của Người A làm theo yêu cầu): sửa lệnh nhập CSV

**Phạm vi:** người dùng yêu cầu làm luôn M3.13b: sửa 2 lỗi còn mở của M3.13a đã ghi ở PR #13. Nhánh `fix/m3.13b-import-args` từ `main`, PR #16; sau khi PR #15 (M3.14) merge, đã merge `main` vào nhánh để giải xung đột `progress.md` (giữ cả hai mục). **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.**

| File | Thay đổi |
|---|---|
| `package.json` (root) | `import:products` thêm `--` để npm chuyển `--dir`/`--draft` cho CLI. Trước đây npm hiểu chúng là cấu hình của chính npm (`Unknown cli config "--dir"`), lệnh âm thầm đọc `data\import` và nhập PUBLISHED |
| `apps/backend/src/cli/import-products.ts` | `--dir` tương đối tính từ `INIT_CWD` (nơi gõ lệnh) thay vì `apps/backend`; danh mục đã có mà đang tắt thì bỏ qua dòng khi nhập PUBLISHED, kèm hướng dẫn bật danh mục hoặc dùng `--draft`; tra/tạo danh mục chuyển vào `try` của từng dòng nên lỗi một dòng không dừng cả lượt |
| `apps/backend/test/import-products.integration.spec.ts` | +2 ca: gọi đúng lệnh ở root (`npm run import:products -- --dir <tương đối> --draft`) với DB bảo vệ không tồn tại nên không thể ghi dữ liệu dù lỗi còn hay đã sửa; danh mục đang tắt không xuất bản nhưng `--draft` vẫn nhập nháp |
| `README.md`, `docs/local-trial-m3.md` | Cách tính `--dir` tương đối và hành vi với danh mục đang tắt |

**TDD:** cả 2 ca RED đúng lý do trước khi sửa (log npm `Unknown cli config "--dir"`/`"--draft"`, CLI đọc thư mục mặc định rồi dừng ở DB bảo vệ, không ghi gì; sản phẩm vẫn PUBLISHED vào danh mục tắt) → GREEN 3/3. Vì `data/import` local chứa CSV thật đã có giá, test root cố ý trỏ DB không tồn tại để không bao giờ nhập dữ liệu thật vào `_test`.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Đạt |
| `npm test` (sau khi merge `main` có M3.14) | 8 công cụ + 9 backend + 184 frontend |
| `npm run test:integration` | 35/35 (33 của `main` + 2 ca M3.13b) |
| `npm run test:e2e:implemented` | 34/34 (42.6s) |

Chưa sửa điểm nhỏ "test cleanup prefix cố định" của review PR #13: integration chạy tuần tự (`fileParallelism: false`) nên chưa gây lỗi. **Chạy thử:** `.\tools\npm.ps1 run import:products -- --dir <thư mục khác> --draft` → sản phẩm nhập nháp từ đúng thư mục. **Dừng chờ người dùng thử.**

## Ngày 29/10/2026 — M3.14 (Người A): sửa sản phẩm đang bán hoặc đã ẩn

**Phạm vi:** người dùng yêu cầu "làm luôn" M3.14 theo lộ trình P0. Backend vốn cho sửa sản phẩm mọi trạng thái (giữ ràng buộc khi đang bán); UI chặn khác nháp. Nhánh `feat/m3.14-edit-live-products` từ `main`, đã merge vào `main` qua PR #15. **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.**

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.tsx` | Form và phần ảnh hiện cho mọi trạng thái; tiêu đề theo trạng thái (nháp/đang bán/đã ẩn); cảnh báo hàng đang bán (lưu là lên web, đổi đường dẫn làm hỏng link đã chia sẻ) và ghi chú hàng đã ẩn; khóa Xuất bản khi còn thay đổi chưa lưu áp dụng cho mọi trạng thái |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.tsx` | 409 mã `PUBLISH_RULE` hiện đúng lý do từ server thay vì thông báo chung "đã thay đổi/bị trùng"; nhãn form "Sửa sản phẩm" khi không phải nháp |
| `apps/frontend/src/features/admin/products/pages/ProductsPage.tsx` | Thông báo sau lưu "Đã cập nhật sản phẩm “…”." cho mọi trạng thái |
| `apps/backend/src/common/database-errors.ts`, `modules/products/products.service.ts` | Thêm `publishRuleConflict` (409, mã `PUBLISH_RULE`) cho 3 ràng buộc xuất bản: sửa hàng đang bán, xuất bản thiếu điều kiện, gỡ hết ảnh hàng đang bán. Thông báo giữ nguyên |
| `ProductEditPage.test.tsx` | Thay 2 test "không sửa được hàng không phải nháp" bằng: sửa hàng đang bán, lý do 409 hiện nguyên văn, hàng đã ẩn, tải dữ liệu mới thấy đang bán vẫn sửa được; test xuất bản → ẩn → lưu dùng version trả về (5) |
| `apps/backend/test/catalog.integration.spec.ts` | +1 ca: sửa tên/giá/mô tả hàng đang bán thì API công khai trả ngay giá trị mới; tắt hết biến thể hoặc gỡ hết ảnh trả 409 `PUBLISH_RULE` và không đổi version |
| `apps/frontend/e2e/products.spec.ts`, `e2e/product-status.spec.ts` | Ca "từ chối sửa hàng đã xuất bản" thành "sửa hàng đang bán, khách thấy ngay"; sau xuất bản form vẫn còn; đổi chữ thông báo |
| `docs/local-trial-m3.md` | Mục M3.14 |

**TDD:** integration mới RED đúng lý do (sửa khi đang bán đã chạy, mã lỗi còn `CONFLICT`) → GREEN 13/13 sau khi thêm `PUBLISH_RULE`. UI: 6 test RED (trang còn chặn hàng không phải nháp) → GREEN 63/63; một lần fail giữa chừng do stub của chính test trả tên cũ, đã sửa test.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Đạt |
| `npm test` | 8 công cụ + 9 backend + 184 frontend |
| `npm run test:integration` | 33/33 |
| `npm run test:e2e:implemented` (11 spec, DB `_test`) | 34/34 (42.5s) |

**Chạy thử:** [docs/local-trial-m3.md](docs/local-trial-m3.md) § M3.14. **Dừng chờ người dùng thử.**

## Ngày 29/10/2026 — P0: chuyển tài liệu gốc từ demo sang shop thật

**Bối cảnh:** chủ shop xác nhận website là kênh bán hàng thật, không còn là demo. Đánh giá lại M1–M3 theo chuẩn bán thật (nghiệp vụ/pháp lý, bảo mật, vận hành). Giữ nguyên nền tảng auth/session/CSRF/role, kho có lịch sử, catalog. Phát hiện chặn mở bán: upload bị tắt ở production và chỉ lưu ổ đĩa local; API chỉ nghe `127.0.0.1`; `TRUST_PROXY` không bắt buộc; chưa có deploy/backup; admin chỉ có mật khẩu, giới hạn đăng nhập theo IP + email; UI không cho sửa sản phẩm đã xuất bản (backend cho phép); chính sách và banner còn ghi demo; `seed:demo` chạy được trên production.

**Quyết định của chủ shop:** đặt hàng không cần đăng ký; deploy trên VPS; chuyển khoản hiển thị VietQR; đổi trả xử lý thủ công; phí giao 30.000đ. Theo đề xuất được duyệt: hạn chuyển khoản 2 giờ (sửa trong Cài đặt), ẩn Đăng ký/Đăng nhập của khách trên cửa hàng.

**Phạm vi đã duyệt:** chỉ sửa tài liệu, không đổi code.

| File | Thay đổi |
|---|---|
| `docs/plan.md` | Mục tiêu shop thật; ràng buộc mới (dữ liệu khách thật, VPS, chính sách đã chốt); mục "Chuyển sang shop thật" với bảng quyết định và lộ trình P0 → M3.13b–M3.17 → M4 → M6 → mở bán; bảng mốc và phân công A/B mới; M4 theo đơn khách vãng lai + VietQR; M5 ngoài phạm vi; M6 trên VPS; M7 rút gọn |
| `docs/business-rules.md` | Bỏ "đặc tả demo"; thêm mục đơn khách vãng lai (thông tin bắt buộc, mã đơn + token tra cứu băm, chống đơn ảo) và dữ liệu cá nhân của khách; hạn chuyển khoản 2 giờ + VietQR; đổi trả thủ công, thiết kế tự động giữ làm tham khảo |
| `docs/architecture.md` | Sitemap không còn tài khoản khách/returns, thêm tra cứu đơn và trang chính sách bảo mật; API đơn công khai theo token; Order/ShopSettings mới; deploy VPS (reverse proxy, ảnh trên ổ đĩa + backup ngoài VPS, bảo vệ VPS); rate limit và MFA admin |
| `AGENTS.md` | Mục 5: shop thật, không đưa dữ liệu khách thật vào local/log/chat, không đụng production khi chưa được yêu cầu, `seed:demo` không chạy production |
| `README.md` | Mô tả shop thật trên VPS; điểm dừng mới; `seed:demo` chỉ dùng local |
| `docs/acceptance-checklist.md` | Bỏ ca returns/exchange tự động; thêm AUTH-04 (MFA/đoán mật khẩu nhiều IP), ACL-01 theo token/mã đơn, GUEST-01 (đơn ảo), PRIV-01 (PII trong log), PAY-05 (VietQR), OPS-03 (restart VPS); cổng mở bán gồm chính sách thật, thông tin người bán, thủ tục Bộ Công Thương |

**Phát hiện thêm khi rà:** PR #13 (M3.13a import CSV, Người B) đã merge nhưng progress của PR ghi còn 2 lỗi mở (tham số `--dir`/`--draft` từ root; xuất bản vào danh mục đang tắt). Đưa vào lộ trình thành M3.13b; các phần chuẩn bị bán thật đánh số M3.14–M3.17 để không trùng.

**Kiểm tra:** rà diff; quét lại "demo/dữ liệu giả/miễn phí/free/Cloudinary" trong 6 tài liệu: còn lại là tên lệnh `seed:demo`, câu "không còn là demo" và nguồn khảo sát hạ tầng cũ đã ghi rõ không còn dùng. Không chạy test vì không đổi code.

**Điểm dừng:** chờ người dùng đọc lại tài liệu và duyệt. Phần tiếp theo cần kế hoạch riêng: M3.14 (A, sửa sản phẩm đang bán) và M3.13b (B, sửa import).

## Ngày 29/10/2026 — Chuẩn bị commit và PR M3.13a vào main

- Theo yêu cầu commit và MR của người dùng, fetch `origin` và xác nhận M3.9–M3.12 đã vào `main` qua PR #12 (`29fdd89`). Tạo nhánh `codex/m3.13a-product-import` từ `origin/main`; PR mới chỉ chứa CLI import CSV M3.13a, test, npm scripts, ignore dữ liệu local và tài liệu đang có. Không nhận các thay đổi có sẵn này là phần triển khai trong lượt Git.
- Kiểm tra mới trên working tree: `./tools/npm.ps1 run typecheck` và `run build` exit 0; `./tools/npm.ps1 test` đạt 8 công cụ + 9 backend + 182 frontend; `./tools/npm.ps1 run test:integration` đạt 32/32; `./tools/npm.ps1 run test:e2e:implemented` đạt 34/34 (44.1s). Xác nhận `NODE_ENV=test` và PostgreSQL có hậu tố `_test` trước test ghi dữ liệu. Integration lần đầu trong sandbox bị `EACCES`; chạy lại ngoài sandbox đạt. E2E dùng Chromium do Playwright quản lý. Build còn cảnh báo chunk >500 kB có sẵn.
- Kiểm tra `git diff --check`, danh sách tệp sẽ đưa lên Git, ignore và mẫu secret: không phát hiện private key/token theo mẫu đã quét; `git ls-files -ci --exclude-standard` rỗng. `data/`, `.env` thật, `.local/`, dependency và build artifact giữ ngoài commit. Giữ tác giả Git đang cấu hình, không thêm dòng ghi công AI.
- Review phát hiện lỗi cần sửa trước merge: script `import:products` ở root chưa chuyển tiếp đúng `--dir`/`--draft` qua npm workspace (thiếu dấu `--`). Có thể dùng thư mục mặc định và PUBLISHED dù người dùng yêu cầu thư mục khác/nhập nháp; test hiện spawn CLI trực tiếp nên chưa bắt được đường gọi root. Chuẩn bị PR dạng draft để review, chưa kết luận sẵn sàng merge. Không sửa code trong lượt này vì `AGENTS.md` yêu cầu gửi và duyệt kế hoạch cụ thể trước khi code.
- Review còn phát hiện importer tái sử dụng danh mục đang tắt rồi ghi sản phẩm PUBLISHED: CLI báo thành công nhưng khách không thấy sản phẩm; cần kiểm tra điều kiện danh mục trước xuất bản. Hai điểm nhỏ hơn: lỗi tạo danh mục có thể dừng cả lượt vì nằm ngoài `try` từng dòng, và test cleanup dùng prefix cố định có thể xung đột khi chạy đồng thời. Các điểm này chưa được sửa và sẽ ghi trong draft PR.
- Điểm dừng: commit/push và mở draft PR theo yêu cầu; chưa merge vào `main`, chưa chạy lại import trên DB local, chưa có xác nhận nghiệm thu mới từ người dùng. Kết quả test hiện tại không phủ lỗi chuyển tiếp tham số nêu trên.

## Ngày 23/10/2026

- Người dùng cho phép tiến hành kế hoạch. Ngân sách ưu tiên miễn phí, thời gian 10 giờ/tuần.
- Workspace mới, không có Git repository hoặc source ứng dụng lúc khảo sát.
- Node local 22.20.0, npm 11.6.2, Docker Compose 2.39.4. Docker daemon chưa kết nối được (named pipe không tồn tại; config Docker có hạn chế quyền).
- Đã soạn bộ tài liệu M1; chờ kiểm tra liên kết/nội dung và review trước khi đánh dấu hoàn thành.
- Registry từ sandbox bị EACCES; đã yêu cầu quyền đọc metadata npm để chọn phiên bản trước cài.

## Trạng thái mốc

| Mốc | Trạng thái |
|---|---|
| M1 Thiết kế | Đã soạn và rà soát; tài liệu mục tiêu cho các mốc sau |
| M2 Nền tảng/auth | Bản local đã qua kiểm tra kỹ thuật; dừng để người dùng chạy thử |
| M3 Catalog/ảnh/kho | M3.1–M3.12 triển khai đủ. Người A: danh mục, nháp, biến thể, ảnh, xuất bản/ẩn. Người B: kho xem/tìm + điều chỉnh + lịch sử (M3.7.1–3.7.3), catalog khách (M3.9/M3.10), seed demo (M3.11), ca E2E tổng ghép vào bộ implemented (M3.12) đạt 34/34 local; M3.13a hạ tầng CSV `import:products` xong (17 ảnh RMG đã vào `data/import`, chờ người dùng điền giá/size rồi chạy). Nghiệm thu toàn mốc thuộc người dùng |
| M4 Bán hàng | Chưa thực hiện |
| M5 Sau bán hàng | Chưa thực hiện |
| M6 Deploy/restore | Chưa thực hiện |
| M7 Nghiệm thu | Chưa thực hiện |

## Ngày 29/10/2026 — Bản sửa sau review M3.9–M3.12

Người dùng duyệt "làm hết" cho 6 điểm review:

| Điểm | Sửa |
|---|---|
| Seed tạo `reserved` 2/3/2 không có đơn — trái quy tắc reserved chỉ tăng khi tạo đơn, sang M4 sẽ kẹt không giải phóng được | `seed-demo.ts`: bỏ `reserved`; biến thể hết hàng dùng `onHand: 0`. Còn bán giữ nguyên số cũ (13, 8, 1, 0, 10, 10, 5) |
| Seed ghi thẳng `onHand`, lịch sử kho trống | Mỗi biến thể có tồn tạo kèm một `InventoryMovement` 'Nhập kho demo' (0 → N, actor = admin chủ ảnh, key `seed-demo-<SKU>`), inventory `version` 1 như sau một lần điều chỉnh thật |
| Ghi file ảnh trong `$transaction` (AGENTS.md cấm), transaction lỗi để lại file mồ côi | Ảnh tạo ngoài transaction theo khuôn `uploads.service` (file → row, lỗi thì xóa lại); sản phẩm tạo bằng một nested create; tạo sản phẩm lỗi thì xóa asset/file vừa tạo. `ADMIN_EMAIL` bị khóa (`disabledAt`) không được chọn làm chủ ảnh |
| `progress.md` mất tiêu đề mục M3.11 | Thêm lại tiêu đề |
| `/shop?categoryId=<danh mục đã tắt>` hiện 'Tất cả danh mục' trong khi vẫn lọc | `CatalogPage.tsx`: cảnh báo 'Danh mục này không còn hiển thị.', ô Danh mục ghi 'Danh mục không còn hiển thị', nút 'Xóa lọc' về `/shop` |
| Sang trang `/shop` làm lưới biến mất rồi hiện lại | `placeholderData: keepPreviousData`: giữ card trang cũ kèm 'Đang cập nhật bộ sưu tập…', thanh phân trang khóa trong lúc tải |

Test mới, đều fail trước khi sửa đúng lý do rồi đạt sau khi sửa:
- `seed-demo.integration.spec.ts`: thêm ca "lượt lỗi giữa chừng không để lại ảnh/asset" (RED: còn `demo-ao-cotton-1/2.webp`); ca hai lượt thêm kiểm tra đang giữ 0, lịch sử 'Nhập kho demo' và version (RED: `reserved` khác 0). Cleanup test xóa thêm `InventoryMovement` của hàng demo.
- `CatalogPage.test.tsx`: +2 test danh mục đã tắt và giữ card khi tải trang 2.

Tài liệu: `docs/local-trial-m3.md` mục M3.9 (2 dòng thử mới) và M3.11 (giữ 0, lịch sử kho, lượt lỗi), câu mở đầu không còn ghi "còn ghép M3.12"; README mục seed; `docs/plan.md` số test.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | Đạt |
| `npm test` (sau khi merge `main` có M3.14) | 8 công cụ + 9 backend + 184 frontend |
| `npm run test:integration` | 31/31 |
| `npm run test:e2e:implemented` (11 spec, DB `_test`) | 34/34 (39.6s) |

Chưa chạy `seed:demo` trên DB local (chờ người dùng). Chưa commit/push.

## Ngày 29/10/2026 — M3.13a (Người B): nhập dữ liệu thật từ ảnh Instagram vào web

**Phạm vi:** người dùng muốn gắn ảnh sản phẩm thật từ [instagram.com/rmglabels](https://www.instagram.com/rmglabels/). Scraping trực tiếp bị từ chối (bảng khảo sát bên dưới) nên theo hướng dẫn: người dùng lưu 17 ảnh bài đăng vào `Downloads\RMG`; agent copy vào `data/import/`, sinh sẵn `products.csv` từ tên file/caption, người dùng điền **giá** và **size** rồi chạy 1 lệnh. Trạng thái **PUBLISHED** theo lựa chọn. **Đã viết, agent đã kiểm trên `_test`; chờ người dùng điền CSV + chạy trên DB local. Chưa commit.**

### Khảo sát Instagram (sự thật, chặn đã xác nhận)

| Thử | Kết quả |
|---|---|
| Profile GraphQL `/api/v1/users/web_profile_info` (2 lượt, UA khác nhau) | 429 — chặn mọi truy cập không phiên |
| HTML profile + trang `/p/<code>/` + `/embed/captioned/` | Chỉ khung app, không ảnh/caption |
| `?__a=1&__d=dis` | Đã ngừng phục vụ |
| Websearch | Chỉ thấy vài link bài, không đủ làm pipeline |

### Đã viết / file thực tế

| File | Thay đổi |
|---|---|
| `data/import/` (gitignore mới chọn `data/`) | 17 ảnh 1440×1800/1920 (copy từ `Downloads\RMG`, bản gốc giữ nguyên) + `products.csv` sinh tự: 5 dòng sản phẩm RMG (Black Wash VTG Horse Tee, White Horse Tee, Goldline Metal Baggy Pants, Different Level Polo, Different Metal Zip Hood), tên/danh mục ('Áo thun'/'Quần'/'Áo polo'/'Áo hoodie')/màu (đen/trắng — soi ảnh thật)/mô tả đã điền; `price`/`sizes`/`stock` để trống cho người dùng |
| `apps/backend/src/cli/import-products.ts` (mới) | CLI: đọc CSV parser tự viết (quote/comma, giữ số dòng thật); validate từng dòng (tên/ảnh ≤ 8/giá 1–100.000.000/size trong bộ XS,S,M,L,XL,XXL,3XL,FREESIZE/stock ≤ 1.000.000), dòng lỗi bị bỏ qua với lý do, phần còn lại vẫn nhập; slug từ tên (NFD, đ→d, thường); SKU `RMG<8 ký tự hex từ slug/size>-<SIZE>`; danh mục tạo theo tên nếu thiếu (mặc định 'Chưa phân loại'); ảnh sharp **cover-crop 750×1000** webp (cắt viền, không méo) → UploadAsset + ProductImage theo pipeline uploads.service, asset dọn khi tạo sản phẩm lỗi; idempotent theo slug — chạy lại bỏ qua, không ghi đè; status PUBLISHED (cờ `--draft` → DRAFT); kho: `stock` trống = 0 không ledger, có số → 1 bản ghi ledger 'Nhập kho lúc import' như chỉnh kho thật; log tổng kết phân nhánh có/không sản phẩm mới |
| `apps/backend/test/import-products.integration.spec.ts` (mới) | Guard `_test`; fixture tmp tự tạo (2 ảnh sharp nhỏ + CSV, admin riêng theo `ADMIN_EMAIL`); spawn CLI 2 lượt — snapshot deep-equal giữa lượt (slug, status, priceFrom, mô tả, ảnh, biến thể, tồn, ledger), lượt 2 no-op 'Toàn bộ sản phẩm trong CSV đã có sẵn'; thực hiện assert dòng lệnh Bỏ qua + thiếu giá trên stderr; cleanup prefix `import-fix-`/`rmg-import-fix-` theo bảng + file |
| `apps/backend/package.json`, root `package.json` | Script `import:products` (backend: build + `node --env-file-if-exists=.env dist/cli/import-products.js`; root: `npm run import:products -w @clothing/backend`) |
| `.gitignore` | Bỏ qua `data/` (ảnh shop + CSV không vào Git) |
| `README.md`, `docs/local-trial-m3.md`, `progress.md` | Mục 'Nhập dữ liệu shop thật (M3.13a)' + runbook + mục này. Ngoài ra sửa dòng kiểm tra M3.12 sai bộ đếm (frontend 180→182 vì +2 test CatalogPage của bản sửa sau review M3.11 đọc thiếu; integration 30→32 do cơ chế đếm lượt cũ, tổng ổn định đã đối chiếu từng file) |

### Data flow / key quan trọng

CSV (1 dòng = 1 sản phẩm, `sizes` ngăn `|` = mỗi size một biến thể cùng giá) → validate → mỗi sản phẩm: ảnh webp + UploadAsset → Category → Product + Variant + Inventory (0) → khách thấy qua API M3.8–M3.10 có sẵn. Giá đúng ra từ CSV; tồn ngoài CSV để 0 để bạn nhập kho thật qua UI Kho (có lịch sử giao dịch, khớp luồng M3.7.2/3.7.3).

- `slugify` + idempotency theo slug: sửa tên trong CSV tạo sản phẩm MỚI — không tự sửa sản phẩm cũ (chỉnh qua admin).
- `it.each` không dùng: frontend không đổi code — số test frontend 182 gồm baseline cũ + 2 test bản-review M3.11 này đọc thiếu lúc M3.12 (tree ổn định, chạy lại đều 182).
- Nếu thiếu ADMIN trên DB sẽ exit 1 với hướng dẫn `admin:create` (như `seed:demo`).

### Kiểm tra thực tế (Node 24.22.1; integration qua `vitest.integration.config.ts`)

| Lệnh | Kết quả |
|---|---|
| Test mới trước khi có CLI | FAIL đúng lý do: `MODULE_NOT_FOUND dist/cli/import-products.js` (RED) |
| Lượt sau CLI (1) | FAIL vì tôi để `files.split` trên destructuring undefined (noUncheckedIndexedAccess)-fix; thêm 2 assert chuẩn hóa (stderr 'Bỏ qua dòng', Set so sánh tên danh mục) |
| `test/import-products.integration.spec.ts` | GREEN — 2 lượt spawn deep-equal, dòng lỗi skip đúng, ledger chỉ khi stock > 0 |
| `test:integration` toàn bộ | 32/32 (auth 17 + catalog 12 + seed-demo 2 + import 1), exit 0 |
| `run typecheck` / `run build` | Exit 0 / Exit 0 |
| `npm test` workspace | tools 8 + backend 9 + frontend 182 đạt, exit 0 (tree ổn định — +2 là test CatalogPage có sẵn; giải trình ở dòng sửa M3.12) |
| Dry-run lệnh theo đúng chuỗi user (`npm.ps1 run import:products`, cwd workspace = apps/backend; CSV thật 5 dòng chưa điền giá) | 5 × 'Bỏ qua dòng … thiếu giá hợp lệ', tổng kết no-op, exit 0, **không ghi DB** — chứng nhận (1) mặc định `--dir` trúng `clothing-shop\data\import` sau khi sửa lấy repo root từ `import.meta.url` (cwd-based đã trượt vào `apps\backend\data\import`), (2) parser đọc đúng BOM/dòng `#`/tên file chứa `“`, dòng báo 3–7 trúng vị trí thật |
| `test:e2e:implemented` (11 spec, DB `_test`) | 34/34 passed (42.5s, exit 0) — code runtime FE/BE không đổi trong phần này, chạy lại để có hóa đơn đủ |

### Vấn đề gặp trong phần này

- Instagram chặn scraping anonymous (không tự lấy) — được người dùng đồng ý chuyển sang tự lưu ảnh.
- PowerShell 5.1 không có `??` trong script phụ sinh CSV; file CSV/ảnh sinh bằng tool cục bộ, hợp lệ UTF-8 BOM để Excel mở tên tiếng Việt đúng.
- Mặc định `--dir` ban đầu resolve theo cwd — khi chạy `npm run -w @clothing/backend` cwd là apps/backend nên sẽ trượt sang `apps\backend\data\import`. Sửa: repo root suy từ `import.meta.url` (4 cấp như uploadsRoot), chứng bằng dry-run ở bảng kiểm.
- PowerShell tô đỏ `NativeCommandError` cho dòng stderr đầu tiên khi npm host node, dù đó chỉ là cảnh báo dữ liệu: chuyển 4 thông báo theo dòng (thiếu giá/file/thêm path/tạo lỗi riêng) sang stdout, giữ stderr chỉ cho lỗi dừng lượt (không đọc được CSV, thiếu ADMIN — exit 1); test cập nhật kênh tương ứng.

### Chạy thử / điểm dừng

- Mở `data/import/products.csv` điền `price` (VND, số nguyên) và `sizes` (vd. `S|M`; trống = FREESIZE). Bảng chi tiết ở [docs/local-trial-m3.md](docs/local-trial-m3.md) § M3.13a.
- Chạy `.\tools\npm.ps1 run import:products` (mặc định đọc `data\import`), mở `http://127.0.0.1:5173/shop` kiểm 5 sản phẩm RMG; dùng Kho M3.7.2 nhập tồn thật có lịch sử.
- **Dừng chờ người dùng điền CSV, chạy import và phản hồi.** M3.12 runbook (§ M3.12) vẫn chờ chạy thử nếu chưa làm. Commit/push/PR chỉ khi được yêu cầu (không gộp `data/` — gitignore).


## Ngày 29/10/2026 — M3.12 (Người B): ca chấp nhận toàn luồng ghép vào E2E implemented — chốt M3 về mặt kỹ thuật

**Phạm vi:** người dùng duyệt kế hoạch M3.12: đưa `catalog.spec.ts` vào `test:e2e:implemented` (kèm đổi tên bước CI), sửa spec cho khớp flow UI hiện hành ở mức tối thiểu (không đổi code runtime), cập nhật tài liệu chốt M3. **Đã viết, agent đã kiểm tra toàn bộ trên DB `_test`; chờ người dùng chạy thử theo mục M3.12 của local-trial. Chưa nghiệm thu toàn M3. Chưa commit/push.**

### Đã viết / file thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/e2e/catalog.spec.ts` | 3 điều chỉnh khớp UI hiện hành: (1) đến khu Sản phẩm bằng `goto('/admin/products')` — các trang con admin không có nav 'Sản phẩm' (nút nav chỉ nằm trên landing `/admin`), trùng idiom `goto` của 10 spec còn lại; (2) sau 'Lưu sản phẩm' assert URL về `/admin/products` + alert 'Đã tạo sản phẩm nháp', lấy `productId` từ DB rồi `goto` trang sửa nháp, assert heading 'Sửa sản phẩm' (khớp 'Sửa sản phẩm nháp' vì getByRole string là substring) — luồng tạo nháp nay về danh sách, không còn nhảy thẳng trang sửa như spec cũ giả định; (3) assert chuyển trạng thái bằng text chính xác 'Đã xuất bản sản phẩm.'/'Đã ẩn sản phẩm.' như `product-status.spec.ts` — sau chuyển trạng thái trang hiển thị 2 alert cùng lúc nên `getByRole('alert')` vi phạm strict mode |
| `package.json` (root) | `test:e2e:implemented` thêm `catalog.spec.ts` (chèn sau `catalog-detail`) → 11 spec |
| `.github/workflows/ci.yml` | Tên bước E2E thêm 'full catalog M3.12' |
| `docs/plan.md` | Đoạn tổng kết M3 ghi M3.1–M3.12 đã triển khai xong, chỉ còn nghiệm thu; tick 4 dòng tiêu chí với ba bằng chứng (unit/UI 197, integration 30, E2E implemented 34) |
| `README.md` | Dòng điểm dừng: các phần M3.1–M3.12 xong, chờ chạy thử/nghiệm thu; bảng E2E: implemented = toàn bộ hiện hành 34 ca/11 spec, `test:e2e` trùng bộ implemented; ghi chú lịch sử CI `d5953cf` và tên bước mới chờ lượt chạy sau push |
| `docs/local-trial-m3.md` | Mục M3.12: runbook toàn luồng (danh mục → nháp → ảnh thật → kho +10 → xuất bản → khách tìm/xem/chọn biến thể → mobile → reload → ẩn → 404) + bảng 'ảnh còn sau restart' + câu lệnh bộ E2E |
| `progress.md` | Mục này + dòng trạng thái mốc M3 |

### Data flow / key quan trọng

Ca tự dựng dữ liệu bằng UI thật trên `_test` (đăng nhập → danh mục → nháp SKU `BROWSER-*` → upload ảnh sharp qua form → điều chỉnh kho +10 → Xuất bản), phía khách tìm `/shop?q&categoryId&sort` → chi tiết chọn 'M · đen' 'Còn 10 sản phẩm' → mobile 390 không tràn → reload → Ẩn → `/products/<slug>` 404; fixture tạo/xóa riêng của lượt chạy (beforeAll/afterAll).

- Nav admin chỉ ở landing `/admin`: chuyển khu admin trong E2E đi bằng URL (`goto`), không còn link nav dùng được giữa các trang con.
- Trang sửa sản phẩm sau chuyển trạng thái có nhiều alert: assert theo text chính xác thay vì `getByRole('alert')` chung.
- 'Sửa sản phẩm' khớp substring với 'Sửa sản phẩm nháp'; sau lưu nháp, phần thông báo tạo thành công hiển thị trên danh sách thay vì điều hướng sang trang sửa.

### Kiểm tra thực tế (Node 24.22.1; E2E qua `node tools/test-e2e.mjs`)

| Lệnh | Kết quả |
|---|---|
| `catalog.spec.ts` trước sửa (quan sát hiện trạng) | FAIL đúng điểm dự đoán trước: timeout chờ link 'Sản phẩm' không tồn tại trên trang con admin — ghi nhận RED trước khi sửa |
| `catalog.spec.ts` sau điều chỉnh (1) | FAIL vì strict mode 2 alert sau xuất bản — mới phát hiện điểm (3), sửa xong đạt |
| `catalog.spec.ts` riêng, cuối | 1 passed (2.4s, exit 0) |
| `test:e2e:implemented` 11 spec | **34/34 passed (40.4s, exit 0, không flake** — webServer Vite còn sống cả lượt) |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0 (cảnh báo chunk có sẵn) |
| `npm test` workspace | tools 8 + backend 9 + frontend 180 đạt, exit 0 — **sửa nhận định 29/10: phiên bản CatalogPage sau review của M3.11 (+2 test) lúc chạy này đọc thiếu; tree ổn định, chạy lại = 182** |
| `test:integration` | 30/30, exit 0 — **sửa nhận định 29/10: các file integration đủ gồm auth 17 + catalog 12 + seed-demo 2 = 31, run này báo 30; tổng kiểm sau M3.13a (bảng dưới) cho số ổn định 32 với import 1** |

### Vấn đề gặp trong phần này

- Spec cũ được viết trước khi UI admin có flow 'lưu → về danh sách' và trước khi nav con bị bỏ: 2 điểm lệch được phát hiện bằng lượt chạy quan sát (không chỉ đoán); còn 1 điểm strict-mode alert chỉ lộ khi luồng chạy đến bước xuất bản.
- Log lượt integration ghi sai chỗ do chuyển cwd trong `cmd /c`; exit 0 và 30/30 xác nhận từ log thật (`C:\Users\Admin\.local\integration-m312.log`).

### Chạy thử / điểm dừng

- Chạy thử ca này thủ công theo bảng [docs/local-trial-m3.md](docs/local-trial-m3.md) § M3.12: toàn luồng ở trên + dừng/restart backend rồi kiểm ảnh vẫn hiển thị. Lệnh bộ E2E: `./tools/npm.ps1 run test:e2e:implemented` (34 ca).
- **Dừng chờ người dùng chạy thử và nghiệm thu toàn M3.** Sau nghiệm thu mới nói 'M3 hoàn thành'; commit/push/PR chỉ khi được yêu cầu (toàn bộ thay đổi M3.9–M3.12 đang uncommitted trên nhánh `feat/m3.7.2-inventory-adjust`).

## Ngày 29/10/2026 — M3.11 (Người B): bộ dữ liệu demo bằng lệnh seed

**Phạm vi:** người dùng duyệt kế hoạch M3.11 trong chat theo định nghĩa m3-implementation-plan: Seed CLI có kiểm soát, idempotent theo slug `demo-*`, không ghi đè dữ liệu người dùng, không tự seed khi startup. Backend/UI/E2E/CI không đổi — chỉ thêm CLI, test tích hợp, script `seed:demo` và tài liệu. Tồn kho demo ghi lúc tạo biến thể, mỗi lượng nhập kèm một `InventoryMovement` 'Nhập kho demo' (đổi sau review, xem "Bản sửa sau review M3.9–M3.12") → "chạy lại không nhập kho lặp" hợp bởi cấu trúc. **Đã viết, agent đã kiểm tra trên `_test`; chờ người dùng chạy `seed:demo` trên DB local. Chưa commit/push.**

### Đã viết / file thực tế

| File | Thay đổi |
|---|---|
| `apps/backend/src/cli/seed-demo.ts` (mới) | CLI theo khuôn `create-admin.ts`: 2 danh mục, 4 sản phẩm (3 PUBLISHED — hai ảnh/một ảnh/không ảnh; 1 HIDDEN `demo-ao-an`), 7 biến thể SKU `DEMO-*` + inventory (dư 13/8, ít 1, hết 0, 10...; đang giữ luôn 0); ảnh webp 750×1000 sinh bằng sharp ghi `.local/uploads` (NODE_ENV=test → `test-uploads`), `storageKey` cố định `demo-<slug>-<n>.webp`; owner ảnh là ADMIN (ưu tiên `ADMIN_EMAIL`, nếu không → ADMIN mới nhất có `disabledAt` null), thiếu admin → exit 1 kèm hướng dẫn `admin:create`; tổng kết 'Đã tạo…'/'… đã có sẵn.' và dòng cuối phân biệt 'Bộ dữ liệu demo đã sẵn sàng…' (đã tạo gì đó) hay 'Toàn bộ bộ dữ liệu demo đã có sẵn…' (lượt chạy no-op) |
| `apps/backend/test/seed-demo.integration.spec.ts` (mới) | Spawn CLI hai lượt bằng `process.execPath`; snapshot (sản phẩm/trạng thái/giá/variants/available/assetKey + `access` file) phải bằng nhau sâu giữa hai lượt; assert 4 sản phẩm, 7 biến thể, ảnh 2/1/0/0 (PUBLISHED không ảnh duy nhất là `demo-quan-jean`), `priceFrom` = min biến thể, available có 0 và 1; cleanup `demo-*` trước/sau lượt chạy (bảng + file webp test-uploads), tự tạo xóa admin riêng của test |
| `apps/backend/package.json`, root `package.json` | Thêm `"seed:demo"` — backend: `npm run build && node --env-file-if-exists=.env dist/cli/seed-demo.js`; root: `npm run seed:demo -w @clothing/backend` |
| `README.md` | Mục mới 'Bộ dữ liệu demo (M3.11)' (điều kiện, hành vi chạy lại, cách dọn). Ngoài ra sửa 2 dòng bảng E2E bị lạc hậu từ trước M3.9 (số ca 18 → 33 và phạm vi catalog M3.9/M3.10) — ngoài danh sách file kế hoạch, cho phép để doc không nói sai |
| `docs/local-trial-m3.md`, `progress.md` | Mục M3.11 (bảng thao tác/thử) và mục này + bảng trạng thái |

### Data flow / key quan trọng

Lệnh `seed:demo` → backend tự build → `node --env-file-if-exists=.env dist/cli/seed-demo.js` → `readEnvironment(.env)` (DB dev) → chọn admin chủ ảnh → từng mục: tra slug → còn thiếu thì tạo ảnh ngoài transaction (file sharp rồi row asset, lỗi thì xóa lại) → một nested create sản phẩm + variants + inventory + movements + productImages → in log tổng kết. Đã có thì chỉ log 'Đã có sẵn', không ghi gì.

- Idempotency theo slug/`storageKey` cố định trong CLI (không thêm ràng buộc DB); chạy lại là no-op, tồn kho chỉ ghi một lần cùng lúc tạo biến thể.
- `uploadsRoot` suy 4 cấp từ `dist/cli` qua `import.meta.url` → độc lập cwd, luôn trùng `.local/uploads` của dev server (test → `test-uploads`).
- Không auto seed: CLI chỉ chạy qua npm script tường minh; không import trong bootstrap/module nào.

### Kiểm tra thực tế (Node 24.22.1; integration qua `vitest.integration.config.ts` với `.env.test`)

| Lệnh | Kết quả |
|---|---|
| Test integration mới trước khi có CLI | FAIL đúng lý do: `Cannot find module .../dist/cli/seed-demo.js` (RED) |
| Lượt test sau CLI | FAIL vì lỗi của chính test: đọc `image.storageKey` thay `image.asset.storageKey`, và assert số sản phẩm không ảnh = 1 (thiếu sản phẩm ẩn); sửa xong lại FAIL vì dòng tổng kết CLI in vô điều kiện → thêm đếm `createdCategories/createdProducts` phân nhánh 'sẵn sàng'/'Toàn bộ… đã có sẵn' |
| `test\seed-demo.integration.spec.ts` | GREEN — Bộ dữ liệu hai lượt deep-equal quay lại ví dụ nhau, ảnh webp tồn tại |
| `test:integration` toàn bộ | 30/30 (29 cũ + 1 mới) |
| `run typecheck` | Exit 0 |
| `npm test` workspace | tools 8 + backend 9 + frontend 180 đạt, exit 0 |
| `run build` | Exit 0 |
| E2E/CI | Không đổi (không spec mới); khung xanh 33/33 từ M3.10 giữ nguyên |

### Vấn đề gặp trong phần này

- `powershell tools/npm.ps1 run build -w @clothing/backend` không nhận `-w` (wrapper từ chối tham số) — agent build backend trực tiếp bằng tsc cục bộ; script `test:integration` của backend đã tự `npm run build` nên luồng chuẩn không bị ảnh hưởng.
- Lỗi còn lại nằm ở test tổng kết/assert của riêng phần này; không có thay đổi nghiệp vụ phát sinh ngoài bảng kế hoạch.

### Chạy thử / điểm dừng

- Chạy `.\tools\npm.ps1 run seed:demo` lần 1 (xem log 'Đã tạo…' + 'Bộ dữ liệu demo đã sẵn sàng…'), lần 2 thấy chỉ 'Đã có sẵn' + 'Toàn bộ… không tạo thêm'.
- Mở `http://127.0.0.1:5173/shop` → kiểm bảng từng tình huống ở [docs/local-trial-m3.md](docs/local-trial-m3.md) § M3.11 (gallery 2 ảnh, 'Còn 1 sản phẩm', 'Hết hàng', 'Chưa có ảnh', `/products/demo-ao-an` → 'Không tìm thấy sản phẩm.', kho admin thấy SKU `DEMO-*`, lịch sử kho có dòng 'Nhập kho demo').
- **Dừng ở M3.11 chờ người dùng chạy thử.** M3.12 (ghép `catalog.spec.ts` + checklist chốt M3) sẽ gửi kế hoạch riêng khi được yêu cầu. Commit/push/PR chỉ khi người dùng yêu cầu.

## Ngày 29/10/2026 — M3.10 (Người B): trang chi tiết sản phẩm công khai và chọn biến thể

**Phạm vi:** người dùng duyệt kế hoạch M3.10 trong chat: route `/products/:slug` (StoreLayout) — breadcrumb 'Bộ sưu tập → danh mục → tên'; nhóm ảnh chính + thumbnail ('Xem ảnh N'), khối 'Chưa có ảnh' khi trống; mô tả khi có; chọn biến thể bằng nút `size · màu` trong nhóm 'Chọn biến thể' (không chọn sẵn — chưa chọn hiện 'Giá từ …'); chọn xong hiện giá biến thể + 'Còn N sản phẩm' / 'Hết hàng'; hàng ẩn/slug sai → Alert 'Không tìm thấy sản phẩm.' có 'Quay lại bộ sưu tập', lỗi khác có 'Tải lại sản phẩm'. Backend `GET /products/:slug` có sẵn từ M3.4/M3.8 — không đổi code backend. Không làm nút thêm giỏ (giỏ thuộc mốc sau — tránh UI giả). `e2e/catalog.spec.ts` vẫn ngoài `test:e2e:implemented` (M3.12 ghép). **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.** Chưa commit/push phần này.

### Đã viết / file thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/catalog/api/catalog.api.ts` | Thêm `catalogApi.detail(slug)` → `GET /api/v1/products/:slug` (slug qua `encodeURIComponent`) và `catalogDetailKey`; tái dùng kiểu `CatalogProduct` |
| `apps/frontend/src/features/catalog/pages/ProductDetailPage.tsx` (mới) | Trang chi tiết: breadcrumb (nav 'Breadcrumb sản phẩm' có link danh mục về `/shop?categoryId=…`), Gallery (ảnh chính đổi khi bấm thumbnail, placeholder không ảnh), h1 tên, giá/dòng tồn theo biến thể chọn, nhóm nút biến thể, mô tả; loading 'Đang tải sản phẩm…'; 404 chỉ có 'Quay lại bộ sưu tập', lỗi khác thêm 'Tải lại sản phẩm' |
| `apps/frontend/src/features/catalog/pages/ProductDetailPage.test.tsx` (mới) | 10 test UI qua `App` (harness `renderDetail`, mock `client.request` theo đường dẫn): tải theo slug + breadcrumb + mô tả + 'Giá từ …' khi chưa chọn; gallery đổi ảnh theo thumbnail + aria-pressed; nhóm biến thể đủ tên; chọn 'M · đen' → 'Còn 10 sản phẩm' + giá; đổi 'S · trắng' → 'Còn 3 sản phẩm'; available 0 → 'Hết hàng'; 'Chưa có ảnh'; 404 alert + không nút tải lại + về `/shop`; lỗi mạng + tải lại thành công; loading chờ response |
| `apps/frontend/src/app/App.tsx` | Thêm route `products/:slug` → `ProductDetailPage` |
| `apps/frontend/e2e/catalog-detail.spec.ts` (mới) | 3 ca trên DB `_test` (seed Prisma, token uuid, SKU HOA, cleanup afterAll): vào từ `/shop` theo token → URL `/products/<slug>` + breadcrumb + mô tả + 'Giá từ 200.000 ₫' + thứ tự nút theo sku tăng ('M · đen', 'S · trắng') → chọn M 'Còn 10 sản phẩm' + 250.000, chọn S 'Còn 3 sản phẩm' + 200.000; reload giữ trang, lựa chọn không giữ sau reload, mobile 390px không tràn (kèm ảnh chụp); hàng HIDDEN và slug lạ → alert 'Không tìm thấy sản phẩm' + 'Quay lại bộ sưu tập' |
| `package.json`, `.github/workflows/ci.yml` | `test:e2e:implemented` và tên bước CI thêm `catalog-detail.spec.ts` (trước catalog-list theo bảng chữ cái → 10 spec) |
| `progress.md`, `docs/local-trial-m3.md` | Mục này và hướng dẫn chạy thử M3.10 |

### Data flow / key quan trọng

Khách bấm link tên trên `/shop` → `/products/<slug>` → `useQuery([...catalogDetailKey, slug])` gọi `GET /api/v1/products/:slug` → backend lọc `visible` (PUBLISHED + danh mục bật + biến thể bật), trả ảnh (URL `/api/v1/media/<assetId>`) và variants (size viết hoa, màu viết thường, `available = onHand − reserved`) sắp theo sku tăng → UI render; bấm nút biến thể chỉ đổi `variantId` state cục bộ — giá và dòng tồn đổi ngay, không gọi API thêm.

- Nhãn nút là `${variant.size} · ${variant.color}` — form admin viết thường màu trước khi lưu (`variantDrafts.ts`) và DTO viết hoa size, nên 'M · đen' khớp chính xác `/M · đen/` trong `catalog.spec.ts` (M3.12).
- Lỗi phân loại theo `ApiError.status === 404`: đúng hàng không có/hàng ẩn chỉ hiện đường về `/shop`; lỗi khác (mạng, dịch vụ) hiện 'Tải lại sản phẩm' (`refetch`, `retry: false`).
- Lựa chọn biến thể nằm trong state (không URL): F5 giữ đúng trang chi tiết nhưng về mặc định 'Giá từ …' — deep link/refresh hoạt động, chỉ mất lựa chọn.

### Kiểm tra thực tế (Node 24.22.1 qua `tools/npm.ps1`, E2E qua `node tools/test-e2e.mjs`)

| Lệnh | Kết quả |
|---|---|
| Test trang trước khi code | 10 test fail đúng lý do: `/products/<slug>` rơi vào NotFoundPage, thiếu heading/alert/gallery (RED) |
| `vitest ProductDetailPage.test.tsx` | Lượt 1: 7/10 — thiếu import `Alert` (MUI) và query link 'Bộ sưu tập' trùng nav header (thu hẹp trong breadcrumb); lượt 2: 10/10 |
| `vitest` frontend toàn bộ | 180/180 — baseline 170 ở M3.9 + 10 mới |
| `test` toàn workspace | tools 8 + backend 9 + frontend 180 đạt |
| `run typecheck` | 1 lần chạm `exact` không thuộc `ByRoleOptions` (test UI viết theo kiểu Playwright), gỡ khỏi role query → đạt |
| `run build` | Exit 0 đã xác minh (`EXITCODE=0`); cảnh báo chunk Vite có sẵn; lượt đầu PowerShell phiên dịch stderr thành exit 1, không phải lỗi build |
| `run test:integration` | 29/29 (exit 0 xác minh) |
| E2E riêng `catalog-detail.spec.ts` | Lượt 1: 2/3 — sai kỳ vọng thứ tự nút (seed theo mảng, backend trả theo sku asc); sửa kỳ vọng → 3/3 |
| E2E implemented 10 spec | 33/33 (37.3s), lượt này không gặp flake Vite |

### Vấn đề gặp trong phần này

- Seed E2E trực tiếp qua Prisma vẫn cần SKU viết HOA (CHECK `variant_fields_valid`) — đã nêu ở M3.9, giữ nguyên quy tắc.
- Lỗi trong lượt này đều là sai sót của bản test (import thiếu, kỳ vọng thứ tự), không có thay đổi thiết kế phát sinh so với bảng kế hoạch.
- E2E không seed ảnh thật (cần asset upload phức tạp) — gallery chỉ được phủ ở test UI với ảnh mock; khi M3.12 ghép `catalog.spec.ts` (upload ảnh thật qua admin) sẽ phủ thêm trang chi tiết có ảnh.

### Chạy thử / điểm dừng

- Mở `http://localhost:5173/shop` → bấm một card sản phẩm → thấy chi tiết: breadcrumb, ảnh/thumbnail (hàng có ảnh upload từ admin trước đó), mô tả; bấm 'M · đen' → giá + 'Còn N sản phẩm'; đổi variant khác đổi theo; F5 không mất trang, chỉ mất lựa chọn; 'Quay lại bộ sưu tập' về `/shop`.
- Hàng ẩn: vào `/products/<slug>` của hàng chưa xuất bản hoặc gõ slug lạ → 'Không tìm thấy sản phẩm.'.
- Hướng dẫn chi tiết: [docs/local-trial-m3.md](docs/local-trial-m3.md) § M3.10.
- **Dừng ở M3.10 chờ người dùng chạy thử.** M3.11 (seed demo) sẽ gửi kế hoạch riêng khi được yêu cầu. Commit/push/PR chỉ khi người dùng yêu cầu.

## Ngày 29/10/2026 — M3.9 (Người B): catalog khách tìm và lọc danh sách hàng công khai

**Phạm vi:** người dùng duyệt kế hoạch M3.9 trong chat: thay trang giới thiệu tại `/shop` bằng trang danh sách thật (tìm theo tên/SKU, chọn danh mục, sắp thứ tự, phân trang; bộ lọc nằm trên URL nên refresh/Back giữ đúng; card là liên kết tới `/products/<slug>` — trang chi tiết thuộc M3.10, bấm vào sẽ 404 tạm). `e2e/catalog.spec.ts` vẫn ở ngoài `test:e2e:implemented` theo chỉ dẫn cũ (M3.12 ghép khi đủ chi tiết + dữ liệu demo). **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.** Chưa commit/push phần này.

### Đã viết / file thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/catalog/api/catalog.api.ts` (mới) | `catalogApi.list({ q, page, sort, categoryId })` (pageSize cố định 12, bỏ tham số rỗng) và `catalogApi.categories()`; kiểu khớp response công khai của backend |
| `apps/frontend/src/features/catalog/pages/CatalogPage.tsx` (mới) | Trang `/shop`: tiêu đề gọn thay hero dài; form tìm (Enter/Tìm kiếm); select 'Thứ tự sắp xếp' + 'Danh mục' (native, nhãn shrink); nút 'Xóa tìm kiếm'/'Xóa lọc'; lưới card (ảnh đầu hoặc khối 'Chưa có ảnh', tên danh mục, tên sản phẩm là liên kết, 'Giá từ …' theo `Intl.NumberFormat('vi-VN', VND)`); phân trang MUI với nhãn tiếng Việt; loading/empty/error + 'Tải lại bộ sưu tập'; guard URL hợp lệ (trang, q ≤ 80, sort, categoryId UUID) |
| `apps/frontend/src/features/catalog/pages/CatalogPage.test.tsx` (mới) | 15 test: card/link/ảnh/giá/tổng; placeholder không ảnh; loading chờ response; tìm trim, đặt lại trang, Back khôi phục; sort/danh mục ghi URL và lần gọi API; phân trang giữ q; đọc cả 4 bộ lọc từ URL lúc đầu; empty có lọc (Xóa lọc) và không lọc; lỗi + tải lại; 4 loại bộ lọc sai không gọi API |
| `apps/frontend/src/app/App.tsx` | Route `/shop`: `CatalogIntroPage` → `CatalogPage` |
| `apps/frontend/src/features/catalog/pages/CatalogIntroPage.tsx` + `.test.tsx` | Xóa — trang giới thiệu placeholder (6 test) hết nhu cầu sau khi có danh sách thật |
| `apps/frontend/e2e/catalog-list.spec.ts` (mới) | 4 ca trên DB `_test`: chỉ PUBLISHED trong danh mục bật hiển thị (seed token uuid trùng khó: 4 sản phẩm gồm HIDDEN và PUBLISHED trong danh mục đã tắt); lọc kết hợp q+categoryId+sort trên URL, giữ qua reload, 'Xóa lọc' về mặc định; keyword không khớp + abort mạng + nút 'Tải lại bộ sưu tập'; mobile 390px + thứ tự mới nhất (kèm ảnh chụp) |
| `apps/frontend/e2e/auth.spec.ts` | 2 điểm kỳ vọng dựa vào khối phiên của trang intro bị xóa: lúc đăng nhập, `/shop` kiểm tra link 'Tài khoản' ở nav 'Điều hướng chính' (trước: trong `main`); lúc đăng xuất kiểm tra link 'Đăng nhập' và không còn 'Tài khoản'. Ý "trang /shop phản ánh phiên" giữ nguyên |
| `package.json`, `.github/workflows/ci.yml` | `test:e2e:implemented` và tên bước CI thêm `catalog-list.spec.ts` (thứ tự bảng chữ cái sau auth) |
| `progress.md`, `docs/local-trial-m3.md` | Mục này và hướng dẫn chạy thử M3.9 |

### Data flow / key quan trọng

Khách nhập tìm/chọn danh mục/đổi thứ tự/sang trang → `setSearch` cập nhật URL `/shop?...` → query TanStack `catalogApi.list` gọi `GET /api/v1/products` (q, categoryId, sort, page, pageSize=12) → backend lọc cố định `PUBLISHED + danh mục bật + biến thể bật`, sort `newest/price-asc/price-desc`, trả items + total → lưới card + 'Tìm thấy N sản phẩm.' + phân trang; danh mục cho ô lọc lấy từ `GET /api/v1/categories` (mảng danh mục bật).

- `filtersUsable` (trang hợp lệ + q ≤ 80 + sort hợp lệ + categoryId UUID): sai → alert + nút sửa ('Về trang đầu'/'Xóa tìm kiếm'/'Xóa lọc') và cả hai query đều không gọi API.
- 'Xóa lọc' chỉ nằm ở hàng bộ lọc, hiện khi có bộ lọc và guard hợp lệ; empty-state chỉ giữ 'Về trang đầu' cho trang > 1.
- Query key gồm `[shop-catalog, categoryId, q, rawSort, sort, page]` nên mỗi bộ lọc một cache riêng; đổi tham số tự gọi API mới (không nút Áp dụng cho sort/danh mục).

### Kiểm tra thực tế (Node 24.22.1 qua `tools/npm.ps1`, E2E qua `node tools/test-e2e.mjs`)

| Lệnh | Kết quả |
|---|---|
| Test trang trước khi code | 15 test fail đúng lý do: `/shop` còn trang giới thiệu, thiếu heading/card/guard (RED) |
| `vitest src/features/catalog` | 15/15 (kèm 3 lượt chỉnh: key form, lọc categories theo guard, regex giá dùng `\s`) |
| `vitest` frontend toàn bộ (sau chỉnh nhãn select) | 170/170 — baseline 161 ở M3.7.3, −6 test trang giới thiệu, +15 test M3.9 |
| `test` toàn workspace | 8 công cụ + 9 backend + 170 frontend đạt |
| `run typecheck` | Đạt (1 lần chạm `exactOptionalPropertyTypes`, sửa bằng spread có điều kiện) |
| `run build` | Exit 0; cảnh báo chunk Vite có sẵn |
| `run test:integration` | 29/29 |
| E2E implemented 9 spec | Lượt 1: 25/30 (2 lỗi spec mới + 2 điểm auth.spec); lượt 2: 29/30; lượt 3: 30/30 (38.1s) |

### Vấn đề gặp trong phần này

- Seed E2E trực tiếp qua Prisma bị DB chặn `variant_fields_valid` vì CHECK yêu cầu SKU viết HOA; seed không qua DTO nên tự viết hoa token trong SKU của spec.
- `auth.spec.ts` (chung) kỳ vọng khối phiên của trang intro trong `main` của `/shop` — trang intro bị xóa theo kế hoạch nên 2 điểm chuyển sang kiểm tra link phiên ở nav header; 'Tạo tài khoản' không còn hiển thị trên `/shop` (khách dùng link 'Đăng nhập', trang đăng nhập có đường sang đăng ký). Khác biệt so với bảng kế hoạch, nêu rõ tại đây.
- Nút 'Xóa lọc' đầu tiên chỉ nằm trong empty-state — E2E bắt thiếu khi lọc trả về có kết quả; chuyển nút lên hàng bộ lọc và bỏ bản trùng trong empty-state.
- Nhãn select 'Danh mục' đè chữ 'Tất cả danh mục' khi rỗng (select native); `inputLabel.shrink: true` sửa; bắt từ ảnh mobile 390px agent đã xem.
- Git sau phần này: `main` đã có M3.4.2–M3.8 (PR #9, #10); nhánh đang làm chứa commit M3.7.2 `8be0ab5`, M3.7.3 `94b2b33` + các thay đổi M3.9 chưa commit.

### Chạy thử / điểm dừng

- `tools/setup-local.mjs` như README để có server; mở `http://localhost:5173/shop` (hoặc theo hướng dẫn [docs/local-trial-m3.md](docs/local-trial-m3.md)): tìm theo tên/SKU, chọn danh mục, đổi thứ tự, sang trang; refresh và Back giữ bộ lọc; nhập URL sai (khi ví dụ `?page=abc`) thấy cảnh báo và không gọi API; gửi lỗi mạng bằng cách tắt server để thử 'Tải lại bộ sưu tập'.
- Bấm vào card → `/products/<slug>` 404 tạm — trang chi tiết là M3.10.
- **Dừng ở M3.9 chờ người dùng thử.** M3.10 (chi tiết + chọn biến thể) sẽ gửi kế hoạch riêng; M3.11 (seed demo) theo sau. Commit/push/PR chỉ khi người dùng yêu cầu.

## Ngày 29/10/2026 — Push, PR và CI cho M3.4.2–M3.8 (Người A)

- Người dùng yêu cầu push 4 nhánh và mở PR. Trước khi push, `main` đã có PR #4 (M3.7.1 của Người B) nên đã rebase cả chuỗi lên `main` mới; xung đột chỉ ở file dùng chung (README, CI, `package.json`, `progress.md`, `docs/local-trial-m3.md`), gộp giữ cả hai bên. Mã commit sau rebase: M3.4.2 `3c18ca9`, M3.5 `5c2447f`, M3.6 `3d184a4`, M3.8 `1e7b57b` (thay cho `31ef890`/`3e2bd91`/`cf5a141`/`e955675` ghi ở các mục dưới).
- Kiểm tra lại sau rebase bằng Node 24.22.1: typecheck, build đạt; unit 8 tools + 9 backend + 124 frontend; integration 29/29; E2E implemented 18/18 (gồm 3 ca kho của Người B).
- Mở PR xếp chồng #5 (M3.4.2 → `main`), #6 (M3.5), #7 (M3.6), #8 (M3.8). CI GitHub đạt cả 4 PR, đủ bước typecheck/build/unit/integration/E2E.
- Bốn PR được merge liền nhau: chỉ #5 vào `main`, #6–#8 rơi vào nhánh base trung gian. Đã mở #9 từ `feat/m3.8-publish` vào `main` (nội dung trùng khớp nhánh sau khi merge #6–#8, không xung đột); CI của #9 đạt, #9 đã merge. `main` tại `13b0578` có đủ M3.4.2, M3.5, M3.6, M3.8 và M3.7.1; CI trên `main` sau merge đạt.
- Bài học: với PR xếp chồng, merge từng PR và chờ PR kế tiếp đổi base sang `main`; hoặc mở PR thẳng vào `main` sau khi phần trước đã merge.
- Dọn dòng `=======` còn sót từ lần merge cũ trong `progress.md`. Bốn nhánh đã merge chưa xóa trên GitHub (thao tác xóa cần người dùng cho phép rõ).
- Trạng thái nghiệm thu: người dùng đã thử M3.5; M3.4.2, M3.6, M3.8 đã qua kiểm tra local và CI, chờ người dùng thử.

## Ngày 29/10/2026 — M3.8 (Người A): xuất bản và ẩn sản phẩm

**Phạm vi:** người dùng duyệt kế hoạch M3.8 (gồm khóa Xuất bản khi còn thay đổi chưa lưu) và cho commit M3.6 (`cf5a141`). Nhánh `feat/m3.8-publish` tạo từ `feat/m3.6-image-order`. Phiên làm việc bị ngắt sau khi viết test đầu; đã kiểm tra lại Git và tiếp tục đúng phạm vi. **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.** Chưa commit/push M3.8.

### File thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/admin/products/api/products.api.ts` | `productsApi.publish` / `hide` (POST `{expectedVersion}`) |
| `apps/frontend/src/features/admin/products/components/ProductStatusPanel.tsx` (mới) | Nhãn trạng thái, 3 điều kiện Đạt/Chưa đạt, Xuất bản/Ẩn sản phẩm, thông báo, chống bấm lặp |
| `apps/frontend/src/features/admin/products/components/ProductStatusPanel.test.tsx` (mới) | 9 test: xuất bản, điều kiện chưa đạt, danh mục chưa rõ, chưa lưu, ẩn, xuất bản lại khi đã ẩn, lỗi 409, bấm đúp, khóa khi page bận |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.tsx` | Khung trạng thái cho mọi trạng thái, thao tác `status`, thay snapshot sau khi đổi trạng thái, gom cờ chưa lưu, tiêu đề Quản lý sản phẩm khi không còn nháp |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.tsx` | `onDirtyChange`: so trạng thái form với lúc mở |
| `apps/frontend/src/features/admin/products/components/ProductImagesManager.tsx` | `onDirtyChange`: báo khi danh sách ảnh khác bản đã lưu |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.test.tsx` | 3 test: xuất bản rồi ẩn dùng đúng version, khóa khi thông tin chưa lưu, khóa khi ảnh chưa lưu |
| `apps/frontend/src/features/admin/products/pages/ProductsPage.tsx` / `.test.tsx` | Link Quản lý cho hàng Đã xuất bản/Đã ẩn và test |
| `apps/frontend/e2e/product-status.spec.ts` (mới) | Luồng xuất bản/ẩn/xuất bản lại với API công khai và media, server từ chối khi danh mục bị tắt ở DB, ACL, mobile |
| `package.json`, `.github/workflows/ci.yml`, `README.md`, `docs/local-trial-m3.md`, `docs/architecture.md`, `docs/m3-implementation-plan.md`, `docs/plan.md` | Đăng ký spec mới, trạng thái, hướng dẫn thử |

Đúng danh sách kế hoạch. Backend, schema, migration, dependency không đổi.

### Data flow / key

Bấm Xuất bản → POST `/admin/products/:id/publish` `{expectedVersion}` → `ProductsService.state` kiểm tra version, đổi trạng thái và kiểm tra lại danh mục/ảnh/biến thể trong transaction (409 + rollback nếu không đạt) → page thay snapshot, invalidate danh sách → `/api/v1/products` và `/api/v1/media/:id` công khai trả dữ liệu. Ẩn đi qua `/hide`.

- `status`: DRAFT/PUBLISHED/HIDDEN; HIDDEN xuất bản lại được, không có đường về DRAFT.
- Điều kiện trên UI tính từ dữ liệu đã lưu; server là bên quyết định.
- `unsaved` (từ `onDirtyChange`): chặn xuất bản khi form/ảnh còn thay đổi vì xuất bản gỡ hai phần này khỏi trang.

### Kiểm tra thực tế (Node 24.22.1 qua `./tools/npm.ps1`)

| Lệnh | Kết quả |
|---|---|
| Test mới trước khi viết code | 4 test trang/danh sách fail vì chưa có nút Xuất bản/link Quản lý; test khung trạng thái fail vì chưa có component (RED) |
| `run typecheck` | Đạt |
| `test` | 8 tools + 9 backend + 105 frontend đạt |
| `run build` | Exit 0; cảnh báo chunk Vite có sẵn |
| `run test:integration` | 29/29 đạt |
| `run test:e2e:implemented` | 15/15 đạt, khoảng 32 giây |
| Ảnh mobile 390px | Agent đã xem: Quản lý sản phẩm, nhãn Đã xuất bản, thông báo, nút Ẩn, không tràn ngang |

Lần chạy E2E đầu fail do test: trang tải lại danh mục sau khi test đã tắt danh mục trong DB nên UI đúng là khóa nút, test chờ bấm đến hết giờ. Sửa test chờ danh mục tải xong trước khi tắt ở DB; chạy lại 2/2 rồi toàn bộ 15/15 đạt. Không đổi code app cho lỗi này.

### Giới hạn / chạy thử / điểm dừng

- Sau khi xuất bản không quay lại nháp và không sửa được trên UI (giữ quy tắc chỉ sửa DRAFT).
- Trang khách `/shop` chưa có (M3.9); kiểm tra hiển thị công khai qua URL API.
- `e2e/catalog.spec.ts` vẫn cần trang tạo sản phẩm chuyển sang trang sửa (M3.12).
- Hướng dẫn: [local-trial-m3.md](docs/local-trial-m3.md#m38--admin-xuất-bản-và-ẩn-sản-phẩm).

**Dừng ở M3.8 chờ người dùng thử.** Các phần còn lại của Người A trong M3 là M3.12 (cùng Người B); M3.7/M3.9–M3.11 thuộc Người B.

## Ngày 29/10/2026 — Môi trường: Node 24.22.1 local và DB local

- Người dùng yêu cầu cài Node. Tải `node-v24.22.1-win-x64.zip` từ nodejs.org, SHA-256 khớp `SHASUMS256.txt`, giải nén vào `.local/node-v24.22.1-win-x64` (bị Git bỏ qua). Không đổi Node toàn máy. `./tools/npm.ps1` chạy được từ đây.
- DB `clothing_local` trên máy này chưa có migration (0 bảng) nên đăng nhập lỗi 500 `relation "sessions" does not exist`. Đã chạy `npm run db:migrate` (migrate deploy) trên DB trống; người dùng yêu cầu tạo admin và agent chạy `admin:create` với mật khẩu người dùng cung cấp (không ghi vào file/log).

## Ngày 29/10/2026 — M3.6 (Người A): sắp xếp và gỡ ảnh

**Phạm vi:** người dùng đã thử M3.5 (ảnh hiển thị và lưu được), duyệt kế hoạch M3.6 và cho commit M3.5 (`3e2bd91`). Nhánh `feat/m3.6-image-order` tạo từ `feat/m3.5-images`. **Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử.** Chưa commit/push M3.6.

### File thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/admin/products/components/ProductImagesManager.tsx` | Chuyển sang `saved`/`rows`: lên/xuống, gỡ ảnh đã lưu, Hủy thay đổi ảnh, Lưu chỉ bật khi khác bản đã lưu, cảnh báo khi gỡ |
| `apps/frontend/src/features/admin/products/components/ProductImageTile.tsx` (mới) | Một ô ảnh: thumbnail, nhãn Ảnh chính, nút Lên/Xuống/Gỡ (hoặc Bỏ) có aria-label theo vị trí |
| `apps/frontend/src/features/admin/products/components/ProductImagesManager.test.tsx` | 3 test mới: sắp xếp và lưu đúng thứ tự, gỡ + hủy + lưu, ảnh mới thành ảnh chính |
| `apps/frontend/e2e/product-images.spec.ts` (mới) | Fixture/cleanup riêng; ca M3.5 chuyển sang; ca M3.6 với 2 ảnh thật, kiểm tra `position` trong DB, hủy rồi gỡ, refresh, mobile |
| `apps/frontend/e2e/products.spec.ts` | Bỏ ca ảnh và phần dọn ảnh; giống hệt bản M3.4.2 |
| `package.json` | Thêm `product-images.spec.ts` vào `test:e2e:implemented` |
| `.github/workflows/ci.yml`, `README.md`, `docs/local-trial-m3.md`, `docs/architecture.md`, `docs/m3-implementation-plan.md`, `docs/plan.md` | Trạng thái, hướng dẫn thử và tổ chức code M3.6 |

Khác kế hoạch: tách E2E ảnh sang file riêng vì `products.spec.ts` đã 326 dòng; chỉ chuyển ca có sẵn, không đổi nội dung kiểm tra (thêm `animations: 'disabled'` cho ảnh chụp). Backend, schema, migration, dependency không đổi.

### Data flow / key

Lên/Xuống/Gỡ chỉ đổi `rows` trong trình duyệt → Lưu thứ tự ảnh → PUT `/admin/products/:id/images` với `assetIds` theo thứ tự và `expectedVersion` → transaction xóa danh sách cũ, ghi `position` 0..n → page nhận version mới, `rows` thành `saved`.

- `saved` / `rows`: bản server đang giữ và bản đang chỉnh.
- `position` 0: ảnh chính.
- Ảnh đã gỡ và lưu không khôi phục được (asset quá 24 giờ không gắn lại được và bị dọn).

### Kiểm tra thực tế (Node 24.22.1 qua `./tools/npm.ps1`)

| Lệnh | Kết quả |
|---|---|
| 3 test mới trước khi viết code | 3/3 fail vì chưa có nút Lên/Gỡ/Hủy (RED) |
| `run typecheck` | Đạt |
| `test` | 8 tools + 9 backend + 92 frontend đạt |
| `run build` | Exit 0; cảnh báo chunk Vite có sẵn |
| `run test:integration` | 29/29 đạt |
| `run test:e2e:implemented` | 13/13 đạt, khoảng 29 giây |
| Ảnh mobile 390px | Agent đã xem: một ảnh còn lại có Ảnh chính, Lên/Xuống tắt, Lưu/Hủy bật, cảnh báo gỡ rõ, không tràn ngang |

Ảnh chụp đầu tiên cho thấy nút Lưu còn xám vì chụp giữa hiệu ứng chuyển màu 250ms của MUI; thêm `animations: 'disabled'` cho `page.screenshot` và chạy lại spec ảnh (2/2 đạt) thì trạng thái nút khớp logic. Rà lại: đổi cảnh báo gỡ từ chữ màu `warning.main` (tương phản thấp) sang `Alert` warning `role="status"`.

### Giới hạn / chạy thử / điểm dừng

- Sắp xếp bằng nút Lên/Xuống, chưa có kéo-thả.
- Ảnh đã gỡ và lưu không lấy lại được.
- Hướng dẫn: [local-trial-m3.md](docs/local-trial-m3.md#m36--admin-sắp-xếp-và-gỡ-ảnh-đã-gắn).

**Dừng ở M3.6 chờ người dùng thử.** M3.8 (xuất bản/ẩn) cần kế hoạch riêng được duyệt.

## Ngày 29/10/2026 — M3.5 (Người A): tải và gắn ảnh thật

**Phạm vi:** người dùng duyệt kế hoạch M3.5 và cho commit M3.4.2 trước (`31ef890` trên `feat/m3.4.2-variants`). M3.5 làm trên nhánh `feat/m3.5-images` tạo từ nhánh đó. **Đã viết, agent đã kiểm tra local; người dùng đã thử (ảnh hiển thị và lưu được); đã commit `3e2bd91`, chưa push.**

### File thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/admin/products/api/uploads.api.ts` (mới) | `uploadsApi.image(file)` gửi multipart qua client CSRF chung |
| `apps/frontend/src/features/admin/products/api/products.api.ts` | `ProductImagesInput` và `productsApi.images` (PUT) |
| `apps/frontend/src/features/admin/products/components/ProductImagesManager.tsx` (mới) | Chọn file (ẩn trực quan nhưng Tab tới được), kiểm tra loại/5 MB/8 ảnh, thumbnail, ảnh chưa lưu, Lưu thứ tự ảnh, thông báo lỗi/thành công |
| `apps/frontend/src/features/admin/products/components/ProductImagesManager.test.tsx` (mới) | 8 test: tải và lưu đúng thứ tự, chặn loại/kích thước, lỗi 415/413, bỏ ảnh chưa lưu, lỗi gắn giữ ảnh, chống tải lặp, giới hạn 8, khóa khi page bận |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.tsx` | Khung ảnh, thao tác `images` trong khóa chung, cập nhật `version`/`images` của snapshot sau PUT; từ chối (không im lặng) khi không lấy được khóa |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.tsx` | Bỏ bản copy snapshot riêng, đọc `expectedVersion` từ snapshot của page |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.test.tsx` | Stub upload/PUT ảnh; test chuỗi version ảnh → thông tin và khóa nút trong lúc gắn ảnh |
| `apps/frontend/e2e/products.spec.ts` | Ca ảnh thật: file giả 415, PNG sharp, lưu ảnh rồi lưu tên (version 1 → 2), thumbnail tải được sau refresh, media công khai 404 cho nháp, mobile; cleanup xóa thêm product_images/upload_assets và file `.local/test-uploads` của lượt chạy |
| `.github/workflows/ci.yml`, `README.md`, `docs/local-trial-m3.md`, `docs/architecture.md`, `docs/m3-implementation-plan.md`, `docs/plan.md` | Trạng thái, hướng dẫn thử và tổ chức code M3.5 |

Đúng danh sách kế hoạch. Backend, schema, migration, dependency không đổi.

### Data flow / key

Chọn file → POST multipart `/admin/uploads/images` → sharp giải mã, ghi WebP ngoài transaction, tạo `UploadAsset` tạm → thumbnail chưa lưu → Lưu thứ tự ảnh → PUT `/admin/products/:id/images` `{assetIds, expectedVersion}` → transaction kiểm tra version/chủ asset/24 giờ, ghi `ProductImage` → page nhận version mới, form thông tin giữ phần đang nhập.

- `UploadAsset` tạm: ảnh đã tải chưa gắn, riêng người tải, dọn sau 24 giờ.
- `assetIds`: danh sách đầy đủ theo thứ tự; server thay toàn bộ.
- Chuỗi `version`: PUT chỉ thành công trên version đã chốt nên version trả về an toàn cho form thông tin.
- `operation = 'images'`: khóa chung với lưu/tải lại.

### Kiểm tra thực tế

| Lệnh | Kết quả |
|---|---|
| Test mới trước khi viết code | Page test fail vì chưa có ô "Tải ảnh sản phẩm"; test component fail vì chưa có `uploads.api` (RED) |
| `npm run typecheck` | Đạt |
| `npm test` | 9 backend + 89 frontend đạt (tools 8 đạt ở lượt M3.4.2, không đổi) |
| `npm run build` | Đạt; cảnh báo chunk Vite có sẵn |
| `npm run test:integration` | 29/29 đạt |
| `npm run test:e2e:implemented` | 12/12 đạt, khoảng 26 giây |
| Ảnh mobile 390px | Agent đã xem: thumbnail ảnh thật, thông báo đã lưu, form không tràn ngang |
| Thư mục `.local/test-uploads` sau E2E | Không còn file của lượt E2E; còn 4 file nhỏ có từ trước và từ lượt integration (xem giới hạn) |

Lệnh chạy bằng npm trực tiếp với Node 24.15.0 như M3.4.2 (chưa có Node 24.22.1+ trên máy). Rà lại code phát hiện `saveImages` trả về im lặng khi không lấy được khóa sẽ làm khung ảnh báo thành công giả; đã đổi sang từ chối.

### Giới hạn / chạy thử / điểm dừng

- Chưa gỡ/đổi thứ tự ảnh đã lưu (M3.6). Tải dữ liệu mới bỏ cả ảnh chưa lưu.
- Upload chỉ hoạt động local; production từ chối vì chưa cấu hình nơi lưu ảnh.
- `catalog.integration.spec.ts` có sẵn để lại một file WebP nhỏ trong `.local/test-uploads` mỗi lần chạy; ngoài phạm vi M3.5, cần sửa riêng.
- `e2e/catalog.spec.ts` mong trang tạo sản phẩm chuyển sang trang sửa; hiện về danh sách, để M3.12 xử lý.
- Hướng dẫn: [local-trial-m3.md](docs/local-trial-m3.md#m35--admin-tải-và-gắn-ảnh-thật-cho-sản-phẩm-nháp).

**Dừng ở M3.5 chờ người dùng thử.** M3.6 (gỡ/sắp xếp ảnh) cần kế hoạch riêng được duyệt.

## Ngày 29/10/2026 — M3.4.2 (Người A): sửa, thêm và tắt biến thể

**Phạm vi:** người dùng yêu cầu bắt đầu phần Người A theo kế hoạch M3.4.2 đã gửi; giữ quy tắc chỉ sản phẩm DRAFT. Nhánh `feat/m3.4.2-variants`. **Đã viết, agent đã kiểm tra local; người dùng cho tiếp tục; đã commit `31ef890`, chưa push.**

### File thực tế

| File | Thay đổi |
|---|---|
| `apps/frontend/src/features/admin/products/api/products.api.ts` | `VariantUpdateInput.id` thành tùy chọn để gửi biến thể mới |
| `apps/frontend/src/features/admin/products/components/variantDrafts.ts` (mới) | Kiểu `VariantDraft`, chuyển đổi sang input PATCH, `validateVariants` theo dòng |
| `apps/frontend/src/features/admin/products/components/VariantFields.tsx` (mới) | Một khung biến thể: SKU/size/màu/giá/bật, nút Bỏ dòng này cho dòng mới |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.tsx` | Danh sách dòng biến thể, thêm/bỏ dòng mới, kiểm tra trước gửi, thông báo 409 nêu cả SKU/size–màu |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.test.tsx` (mới) | 6 test: sửa giữ ID/tắt thay xóa, thêm không có id, bỏ dòng mới, lỗi theo dòng, 409 giữ input, khóa khi page bận |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.test.tsx` | Cập nhật kỳ vọng từ biến thể chỉ đọc sang ô nhập, thông báo 409 mới, khóa ô biến thể khi lưu |
| `apps/frontend/e2e/products.spec.ts` | Thay ca sửa nháp: sửa giá, thêm biến thể, SKU của sản phẩm khác bị 409 và DB không đổi, tắt biến thể, mobile; cập nhật thông báo ca hai tab |
| `.github/workflows/ci.yml` | Tên bước E2E ghi phạm vi đến M3.4.2 |
| `README.md`, `docs/local-trial-m3.md`, `docs/architecture.md`, `docs/m3-implementation-plan.md`, `docs/plan.md` | Trạng thái, hướng dẫn thử và tổ chức code M3.4.2 |

So với kế hoạch: thêm `variantDrafts.ts` để tách logic thuần (kiểm tra/chuyển đổi) khỏi component. Backend, schema, migration, dependency không đổi.

### Data flow / key

Admin sửa/thêm/tắt dòng → `validateVariants` chặn SKU trùng, size+màu trùng, giá sai ngay trên form → PATCH `/admin/products/:id` (biến thể cũ kèm `id`, mới không có `id`) → `ProductsService.update` kiểm tra version, chặn xóa, cập nhật/tạo biến thể + inventory 0, tính lại `priceFrom` trong transaction → FE invalidate `admin-products`, về danh sách.

- `VariantDraft`: state một dòng; giá giữ chuỗi khi đang gõ.
- `id` có/không: cập nhật hay tạo mới; biến thể đã lưu chỉ tắt bằng `active`.
- `variants.<index>.<field>`: khóa lỗi theo dòng; bỏ một dòng mới thì xóa lỗi cũ vì vị trí dịch chuyển.

### Kiểm tra thực tế

| Lệnh | Kết quả |
|---|---|
| Test component mới trước khi viết code | 6/6 thất bại vì chưa có ô biến thể/nút Thêm (RED đúng) |
| `npm run typecheck` | Backend/frontend đạt |
| `npm test` | 8 tools + 9 backend + 80 frontend đạt |
| `npm run build` | Hai app đạt; cảnh báo chunk Vite có sẵn |
| `npm run test:integration` | 29/29 đạt trên PostgreSQL `_test` (backend không đổi) |
| `npm run test:e2e:implemented` | 11/11 đạt, khoảng 33 giây |
| Ảnh mobile 390px | Agent đã xem: ô xếp dọc, SKU 64 ký tự trong ô nhập, không tràn ngang |

Các lệnh chạy bằng npm trực tiếp với Node 24.15.0 vì `tools/npm.ps1` từ chối Node dưới 24.22.1 và máy chưa có runtime `.local`; cần chạy lại bằng Node 24.22.1+ trước khi coi là khớp CI. Hai lỗi trong chính test mới đã sửa: assertion focus nhắm vào phần chữ thay vì khung Alert; ca 409 tạo biến thể trùng size/màu nên bị chặn trước khi gửi.

### Giới hạn / chạy thử / điểm dừng

- Đổi chéo size/màu giữa hai biến thể trong một lần lưu bị 409 (unique product+size+color, cập nhật tuần tự); transaction rollback, không mất dữ liệu.
- Chỉ DRAFT sửa được; tồn kho chưa chỉnh trên UI (M3.7).
- Hướng dẫn: [local-trial-m3.md](docs/local-trial-m3.md#m342--admin-sửa-thêm-và-tắt-biến-thể-của-sản-phẩm-nháp).

**Dừng ở M3.4.2 chờ người dùng thử.** M3.5 (ảnh) cần kế hoạch riêng được duyệt.

## Ngày 29/10/2026 — M3.7 (Người B) — M3.7.3: lịch sử tồn kho của từng SKU

**Phạm vi đã duyệt:** người dùng duyệt kế hoạch M3.7.3 bằng "duyệt". Nút "Lịch sử" mở dialog đọc-only về giao dịch của một SKU; chưa triển khai M3.9 catalog khách. Backend API `GET /api/v1/admin/inventory/movements` vốn có (guard ADMIN, sort `createdAt` desc, phân trang), nên backend/schema không đổi. Cùng nhánh `feat/m3.7.2-inventory-adjust` ngay sau M3.7.2, thay đổi chưa stage/commit.

### Đã viết / file thực tế

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/admin/inventory/api/inventory.api.ts` | Thêm `movements(variantId, page)` với `pageSize=10`, kiểu `MovementRow/MovementList` khớp response backend (delta, before/after, reason, actor, createdAt) |
| `apps/frontend/src/features/admin/inventory/components/MovementHistory.tsx` | Mới: dialog "Lịch sử <SKU>" đọc-only, dùng query riêng theo variantId + page; loading/empty/error + "Tải lại lịch sử"; hàng thể hiện thời gian (`<time datetime>`), dấu `+/-`, `từ → thành`, lý do, người thực hiện; phân trang khi hơn 10 giao dịch |
| `apps/frontend/src/features/admin/inventory/components/MovementHistory.test.tsx` | Mới: 9 test — đúng tham số gọi API, nội dung hàng, delta âm, empty, loading, lỗi + retry cùng trang, phân trang giữ dialog mở, đóng, không refetch khi row cha refresh cùng variant |
| `apps/frontend/src/features/admin/inventory/pages/InventoryPage.tsx` | Thêm state `history` + nút "Lịch sử <SKU>" trên mỗi hàng, mở dialog lịch sử (không đụng luồng điều chỉnh) |
| `apps/frontend/src/features/admin/inventory/pages/InventoryPage.test.tsx` | +3 test: mở/đóng lịch sử với URL API đủ `?variantId&page=1&pageSize=10`, phân trang trong dialog không đổi URL, empty state cho biến thể chưa giao dịch |
| `apps/frontend/e2e/inventory-history.spec.ts` | Mới: 3 E2E — điều chỉnh +5 rồi lịch sử hiện ngay 1 hàng `12 → 17` và meta khớp; 12 giao dịch seed qua Prisma chia 2 trang (10 + 2); biến thể không giao dịch hiển thị empty |
| `package.json` (root) | Thêm `inventory-history.spec.ts` vào `test:e2e:implemented` |
| `.github/workflows/ci.yml` | Tên bước E2E nêu rõ "+ history M3.7.3" |
| `docs/local-trial-m3.md` | Hướng dẫn chạy thử M3.7.3 |
| `progress.md` | Mục này |

File chạy thử `e2e/inventory-history.spec.ts` phải scope `listitem` trong `<ul aria-label="Lịch sử <SKU>">` vì DOM của dialog còn chứa `<li>` phân trang lẫn vào — đã sửa sau khi E2E bắt Expected 10 / Received 14. Backend, migration, `features/admin/products/`, lockfile: không đổi. Chưa stage/commit.

### Data flow / key quan trọng

Luồng: nút "Lịch sử" trên hàng tồn → dialog mở → TanStack Query gọi `inventoryApi.movements` → `GET /api/v1/admin/inventory/movements?variantId=<id>&page=<n>&pageSize=10` (guard backend kiểm ADMIN; server sắp `createdAt` desc) → hàng hiển thị thời gian, `+5`/`-3`, `before → after`, lý do, người thực hiện; sang trang gọi lại trong cùng dialog; "Đóng" không đổi URL, không invalidate gì (chỉ đọc).

- Query key `['admin-inventory-movements', variantId, page]`: cache tách theo biến thể + trang; dialog đổi trang không refetch danh sách tồn.
- `<time datetime>`: giữ ISO nguyên vẹn cho máy, hiển thị giờ Việt Nam (`Intl.DateTimeFormat` + `Asia/Ho_Chi_Minh`) — cố định múi giờ nên số hiển thị không chạy theo máy admin.
- Dấu `+`/`-`: nhập thêm hay xuất kho, tô xanh/đỏ để dễ nhìn; số lấy nguyên từ server.
- Empty state: "Chưa có giao dịch cho SKU này." cho biến thể 0 giao dịch — phân biệt nội dung hàng tồn.
- Read-only: không có PUT/POST trong dialog, không idempotency, thứ tự và tổng phụ thuộc API hoàn toàn.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| UI RED | MovementHistory chưa có (suite lỗi import) + 3 ca trang chưa có nút "Lịch sử" — 3 ca trang fail đúng lý do |
| UI GREEN | 54/54 trong thư mục inventory (19 dialog điều chỉnh + 26 trang + 9 lịch sử); frontend tổng 159/159 sau lần chỉnh cuối |
| `tools/npm.ps1 run typecheck` | 2 app 0 lỗi (lưu ý: hai lượt đầu gọi qua `cmd /c "tools\npm.ps1 ..."` không thật sự chạy file ps1, log trống; chạy lại bằng `powershell -File` hợp lệ) |
| `tools/npm.ps1 test` | 176 đạt: 8 công cụ + 9 backend + 159 frontend |
| `npm run test:integration` | 29/29 |
| E2E implemented (8 spec) | 4 lượt: L1 25/26 (test phân trang của tôi bắt 14 thay vì 10 — lỗi scope `listitem` gộp `<li>` phân trang, đã sửa); L2 8 pass rồi webServer Vite crash 0xC0000409 (flake máy đã ghi ở M3.7.2); L3 25/26 (test ảnh của Người A chập chờn); L4 26/26 sạch (34.7s) |

### Chạy thử / điểm dừng

Giữ dev backend/frontend như trước, đăng nhập ADMIN → Kho → hàng nào đó → bấm **Lịch sử**. Xem thời gian, số cộng/trừ, `từ → thành`, lý do, người thực hiện; số SKU có hơn 10 giao dịch có phân trang; SKU vừa điều chỉnh ở M3.7.2 sẽ có dòng giao dịch tương ứng. Chi tiết theo [hướng dẫn M3.7.3](docs/local-trial-m3.md).

**Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử/xác nhận. Dừng ở M3.7.3.** Catalog khách M3.9 cần duyệt riêng; chưa commit/push; chưa kiểm chứng CI GitHub.

### Bản sửa sau review (29/10/2026)

Người dùng duyệt "sửa lại hết" cho 4 điểm review:

| Điểm | Sửa |
|---|---|
| Mở lại lịch sử thoáng hiện số cũ từ cache (mở → đóng → điều chỉnh → mở lại vẫn thấy "Tìm thấy 1" trước khi về 2) | `MovementHistory.tsx`: query lịch sử dùng `gcTime: 0`, đóng dialog là bỏ cache nên mở lại luôn "Đang tải lịch sử…" rồi số mới |
| Sang trang làm danh sách và thanh phân trang biến mất, hiện "Đang tải…" rồi mới hiện lại | `placeholderData: keepPreviousData`: giữ trang hiện tại, thanh phân trang khóa trong lúc tải trang kế tiếp |
| Nhánh `actor.name ?? 'Tài khoản đã xóa'` không thể xảy ra (DB bắt buộc tên, không cho xóa user có giao dịch) | Bỏ nhánh; `MovementRow.actor` thành `{ name: string }` trong `inventory.api.ts` |
| Chữ lỗi | Mục M3.7.3 ở đây; mục M3.7.2 và M3.7.3 trong `docs/local-trial-m3.md` (kèm sửa giải thích ví dụ 409 -11, thêm dòng chạy thử Esc, mở lại lịch sử và sang trang; tên key/dấu trừ cho khớp code); comment seed trong `inventory-history.spec.ts` |

`MovementHistory.test.tsx` +2 test: giữ trang và thanh phân trang khi đang tải trang 2; mở lại sau khi đóng thì tải mới, không hiện số cũ. Cả hai fail trước khi sửa đúng lý do ("Đang tải lịch sử…" thay danh sách; "Đang tải" không xuất hiện vì dùng cache cũ), đạt sau khi sửa.

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Đạt |
| `npm test` | 8 công cụ + 9 backend + 161 frontend đạt |
| `npm run test:integration` | 29/29 |
| `npm run test:e2e:implemented` (8 spec, DB `_test`) | 26/26 (34.4s) |

Lệnh chạy bằng Node local `.local/node-v24.22.1-win-x64` trong Bash, vì `tools/npm.ps1` dừng khi webServer E2E ghi ra stderr (`ErrorActionPreference = 'Stop'`); không đổi Node toàn máy. Chưa commit/push.

## Ngày 29/10/2026 — M3.7 (Người B) — M3.7.2: điều chỉnh tồn kho, một lần ghi mỗi idempotency key

**Phạm vi đã duyệt:** người dùng duyệt kế hoạch M3.7.2 bằng "triển khai". Chỉ làm dialog điều chỉnh tồn lọc theo một biến thể; chưa triển khai M3.7.3 lịch sử. API `POST /api/v1/admin/inventory/adjustments` (transaction + idempotency) vốn có, phần này chỉ tiêu dùng từ FE; backend/schema không đổi. Nhánh `feat/m3.7.2-inventory-adjust` từ `main` `3b054ff`.

### Đã viết / file thực tế

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/admin/inventory/components/AdjustmentDialog.tsx` | Mới: dialog điều chỉnh một SKU; snapshot tồn đóng băng theo version khi mở; máy trạng thái editing/pending/saved/unconfirmed/conflict; 409 chỉ hiện thông báo server + "Đóng và tải lại tồn"; lỗi mạng/5xx cho Gửi lại cùng key/body; khóa hoàn toàn khi pending hoặc không chắc chắn |
| `apps/frontend/src/features/admin/inventory/components/AdjustmentDialog.test.tsx` | Mới: 17 test, gồm khóa phím khi pending, key không đổi qua Gửi lại, phiên bản hết hạn đã được tab khác ghi, 409 không có Gửi lại, hiển thị "Khả dụng" sau thành công |
| `apps/frontend/src/features/admin/inventory/pages/InventoryPage.tsx` | Lọc `variantId` trên URL (UUID không hợp lệ tự về trang thường), nút "Điều chỉnh <SKU>", ghi thành công cập nhật số trong cache qua `setQueriesData` (không refetch), "Đóng và tải lại tồn" = invalidate + đóng |
| `apps/frontend/src/features/admin/inventory/pages/InventoryPage.test.tsx` | +4 test: mở dialog khi lọc variantId, điều chỉnh +5, cache số tồn đổi tức thời, đóng và tải lại tồn |
| `apps/frontend/src/features/admin/inventory/api/inventory.api.ts` | Thêm `list(q, page, variantId)` (URL `variantId` đứng trước `q`) và `adjust(input, key)` gửi header `Idempotency-Key` |
| `apps/frontend/e2e/inventory-adjust.spec.ts` | Mới: 5 E2E thật — lọc variantId + giao dịch +5 đặt một lần (DB 17/tồn mới/version 1/1 movement), phản hồi mất khóa form và Gửi lại cùng key tại đúng một lần ghi, tái phát cùng key trả lại kết quả cũ không cộng kép (21/version 1/1 movement), xuất dưới mức giữ bị 409 không đổi tồn, CUSTOMER gửi API trực tiếp bị 403 qua `page.evaluate` |
| `package.json` (root) | Thêm `inventory-adjust.spec.ts` vào `test:e2e:implemented` — khác kế hoạch vì spec tách file mới thay vì ghi vào `inventory.spec.ts` |
| `.github/workflows/ci.yml` | Tên bước E2E nêu rõ "+ adjustments M3.7.2" đi cùng thay đổi trên |
| `apps/frontend/vite.config.ts` | Thêm `preview.proxy` cho `/api` cùng quy tắc như dev — khác kế hoạch, dùng cho mitigation crash E2E dưới |
| `apps/frontend/playwright.config.ts` | webServer frontend E2E đổi từ `vite dev` sang `npm run build && vite preview` — khác kế hoạch, cùng mitigation |
| `docs/local-trial-m3.md` | Hướng dẫn chạy thử M3.7.2 và giải thích key |
| `progress.md` | Mục này |

Backend, migration, `features/admin/products/`, lockfile: không đổi. Chưa stage/commit.

### Data flow / key quan trọng

ADMIN mở Kho → tìm/nút "Điều chỉnh" theo SKU → URL `?variantId=<id>` → GET list lọc một biến thể → mở dialog: snapshot tồn được đóng băng (đồng bộ `version` từ server) → nhập delta → Gửi → `inventoryApi.adjust` POST với `Idempotency-Key` sinh mỗi lần mở dialog và `X-CSRF-Token` → backend chạy transaction: key trùng trả kết quả cũ (không cộng lại), `expectedVersion` hết hạn hoặc delta làm `available < reserved` thì 409, hợp lệ thì tạo `InventoryMovement` và cập nhật tồn → UI hiện `Khả dụng: <available>` và sửa số trong cache; đóng dialog bằng "Đóng và tải lại tồn" mới invalidate thật.

- `variantId` (URL): một điều chỉnh chỉ diễn ra với một biến thể; sai định dạng tự về trang tồn thường.
- `Idempotency-Key`: 1 key/phiên mở dialog; "Gửi lại" giữ nguyên key và body; đóng dialog hợp lệ mở lần sau dùng key mới.
- Snapshot đóng băng: hiển thị và `expectedVersion` chốt lúc mở dialog; người khác ghi đồng thời thì 409 thay vì ôm số cũ ghi đè.
- Máy trạng thái (`editing/pending/saved/unconfirmed/conflict`): pending và hai kiểu không chắc chắn khóa toàn bộ; chỉ lỗi mạng cho phép Gửi lại.
- `cache.setQueriesData`: thành công thì không refetch toàn trang, chỉ các query cache khớp `variantId` đổi số; invalidate là thao tác tường minh tại nút "Đóng và tải lại tồn".

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| UI trước khi thành phần | 17 ca dialog thất bại toàn bộ vì chưa có `AdjustmentDialog` (RED đúng lý do); sau khi triển khai 40/40 (17 mới + 23 trang, 4 ca mới trên tổng 19 cũ) |
| `node tools/typecheck` qua wrapper | 0 lỗi (chạy lại sau lần chỉnh config cuối cùng); backend/frontend đạt |
| `npm run build` | Đạt; Vite còn cảnh báo chunk >500 kB như trước (webServer E2E còn tự chạy lại build thành công 3 lần sau chỉnh config) |
| Vitest frontend toàn bộ (sau chỉnh config cuối) | 145/145 đạt 10.5s, gồm 40 ca M3.7.2 |
| Vitest toàn workspace trước chỉnh config | 162 đạt: 8 công cụ + 9 backend + 145 frontend |
| Integration (PostgreSQL `_test`) | 29/29 đạt, backend không đổi |
| E2E riêng `inventory-adjust.spec.ts` | 5/5 đạt (11.4s), chạy lại sau sửa bộ chờ giữa các ca không nhầm biến thể |
| E2E triển khai toàn bộ (7 spec) | 7 lượt: lượt 1, 2 (dev), 3, 5 (preview) crash giữa run do tiến trình Vite webServer chết với exit `3221226505` (0xC0000409, fail-fast native trên Windows, không có stack/WER); lượt 4, 6, 7 (preview) đạt 23/23 trong ~32s — 3 lượt sạch liên tiếp sau mitigation |
| Mobile | E2E xác nhận dialog hoạt động; không tràn ngang |

### Vấn đề môi trường và giải pháp đã thực hiện

- Triệu chứng: trong lượt E2E đủ 7 spec, tiến trình Vite (webServer 5174) tự chết âm thầm sau khoảng 25–40 giây; mọi ca sau đó `ERR_CONNECTION_REFUSED`. Tái hiện ở cả `vite dev` và `vite preview`, cả Node 24.22.1 (local) và 24.15.0 (hệ thống); chạy server thủ công bên ngoài Playwright (70s HTTP tĩnh và 60 lượt hai-tab có proxy) không crash. Flutter không chốt nguyên nhân gốc (nghĩrolldown-native, WebSocket HMR và chuỗi npm→cmd đều chưa loại trừ được); hạ tầng CI chạy Linux nên không gặp.
- Giải pháp chọn: webServer frontend E2E dùng bản build tĩnh qua `vite preview` + `preview.proxy` trong `vite.config.ts` (payload nhỏ hơn, không có pipeline transform/HMR của dev). Lưu ý: crash có thể vẫn là ngẫu nhiên của máy; 3 lượt đạt liên tiếp hiện tại là bằng chứng dần dần, không khẳng định nguyên nhân. Đây là khác biệt với kế hoạch, nêu rõ để người dùng duyệt/nhìn nhận phần bàn giao.
- Điểm khác với kế hoạch: spec E2E điều chỉnh tách file mới `inventory-adjust.spec.ts` (thay vì ghi vào `inventory.spec.ts`) nên đã phải sửa cả root `package.json` và tên bước `ci.yml`; đã nêu cả hai trong bảng file.

### Chạy thử / điểm dừng

Giữ Docker DB, hai terminal `dev:backend` và `dev:frontend` như M3.7.1. Đăng nhập ADMIN → Kho → tìm SKU → bấm **Điều chỉnh**. Số dương/âm, 409, mạng chập chờn, hai tab và role CUSTOMER theo [hướng dẫn M3.7.2](docs/local-trial-m3.md). Chi tiết trung gian như key/chi tiết không hiện ra cho người dùng; mọi thứ mắt thường trong bảng.

**Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử/xác nhận. Dừng ở M3.7.2.** Lịch sử kho M3.7.3 và catalog khách M3.9 cần duyệt riêng; chưa commit/push; chưa kiểm chứng GitHub CI.

### Bản sửa sau review (29/10/2026)

- Người dùng duyệt **giữ** thay đổi E2E sang `vite preview` (`playwright.config.ts`, `vite.config.ts`). Review chạy lại E2E đầy đủ hai lượt liên tiếp trên máy này: 23/23 và 23/23 đạt, không gặp crash.
- Sửa lỗ hổng: ở trạng thái chưa rõ đã ghi (lỗi mạng/không xác định) hoặc 409, đóng dialog bằng Esc/bấm ra ngoài trước đây chỉ đóng mà không tải lại tồn, trái quy tắc "chỉ Gửi lại hoặc Đóng và tải lại tồn". Nay `close()` gọi `onReload()` ở hai trạng thái đó (`components/AdjustmentDialog.tsx`).
- Test: thêm 2 ca Esc (lỗi mạng, 409) vào `AdjustmentDialog.test.tsx`. Đã xác nhận ca này fail khi gỡ bản sửa (Esc đóng im lặng) và đạt khi có bản sửa; lượt RED đầu không hợp lệ vì jsdom mất focus khi các ô bị khóa nên Esc không tới dialog, test được sửa để focus một nút trong dialog như trình duyệt thật.
- Sửa chữ lỗi do agent sinh trong mục này ("thành cônguese", "Hình cảnh", "Glänze").


## Ngày 29/10/2026 — M3.7 (Người B) — M3.7.1: xem và tìm tồn kho

**Phạm vi đã duyệt:** người dùng duyệt bảng kế hoạch M3.7.1 bằng "triển khai". Chỉ làm trang đọc/tìm tồn; chưa triển khai M3.7.2 điều chỉnh hoặc M3.7.3 lịch sử. Nhánh `feat/m3.7-inventory` từ `main` tại `568d4af`; runtime local Node24.22.1/npm11.19.1, không đổi Node toàn máy.

### Đã viết / file thực tế

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/admin/inventory/api/inventory.api.ts` | Mới: kiểu inventory/list, query key, API list qua shared client; encode từ khóa và phân trang24 |
| `apps/frontend/src/features/admin/inventory/pages/InventoryPage.tsx` | Mới: tìm SKU/tên theo URL q/page, thẻ SKU và ba lượng tồn, phân trang, loading/empty/error/retry và phục hồi URL sai |
| `apps/frontend/src/features/admin/inventory/pages/InventoryPage.test.tsx` | Mới:19 UI test, gồm route/ACL, tìm bằng submit, Back, phân trang, giữ cache khi lỗi nền và URL không hợp lệ |
| `apps/frontend/src/app/App.tsx` | Thêm route `/admin/inventory` qua `PrivateRoute admin` |
| `apps/frontend/src/features/admin/AdminPage.tsx` | Thêm link Kho; sửa tối thiểu file dùng chung |
| `apps/frontend/e2e/inventory.spec.ts` | Mới:3 E2E thật, fixture25 SKU/biên SKU64, tồn12/giữ2/còn10, tìm kiếm/URL/mobile/retry/401/403, kiểm tra DB chỉ đọc UI không đổi kho |
| `package.json` | Thêm inventory.spec.ts vào bộ E2E đã triển khai, giữ bộ catalog đầy đủ riêng |
| `.github/workflows/ci.yml` | Tên bước ghi rõ kho mới có list/search M3.7.1 |
| `README.md` | Route Kho và phạm vi E2E hiện hành |
| `docs/local-trial-m3.md` | Hướng dẫn chạy thử M3.7.1 và giải thích key |
| `docs/m3-implementation-plan.md` | Tách M3.7.1/.2/.3, ghi phạm vi và điểm dừng |
| `progress.md` | Ghi bằng chứng và trạng thái của riêng Người B |

Danh sách đúng kế hoạch đã duyệt; không sửa backend/schema/migration/dependency/lockfile hoặc `features/admin/products/` của Người A. Không stage/commit/push. Ledger thao tác tạm ở `.local/m371-20261029/progress.md` được Git bỏ qua.

### Data flow / key quan trọng

ADMIN bấm Kho → PrivateRoute kiểm tra phiên/role → nhập SKU/tên rồi Tìm kiếm/Enter → page trim từ khóa, cập nhật `q/page` trên URL (tìm mới về trang1) → TanStack Query gọi `inventoryApi.list` → GET `/api/v1/admin/inventory` → guard backend kiểm tra ADMIN, service đọc PostgreSQL → UI hiển thị nguyên `onHand/reserved/available` server trả. Không có POST/PATCH hay optimistic update tồn trong phần này.

- `q/page`: nguồn bộ lọc/trang là URL, refresh và Back/Forward giữ đúng tìm kiếm; gõ chưa submit không gọi API mỗi phím.
- `inventoryKey`: cache `admin-inventory` tách theo q/page, không trộn kết quả các lượt tìm kiếm.
- `onHand/reserved/available`: tồn thực có / đang giữ / còn bán; chỉ đọc, kho ban đầu của SKU mới là0.
- `retry: false`: GET không tự retry; nút Tải lại tồn kho là thao tác tường minh. Refetch nền lỗi vẫn giữ số cũ và hiện cảnh báo.
- `PrivateRoute admin`: bảo vệ giao diện, không thay guard quyền tại API.

### Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| UI trước implementation | 19/19 thất bại vì route/trang Kho chưa có; xác nhận RED |
| UI sau implementation | 19/19 đạt; xác nhận GREEN |
| `./tools/npm.ps1 run typecheck` | Backend/frontend đạt; đã sửa option test không đúng kiểu trước khi chạy lại |
| `./tools/npm.ps1 run build` | Hai app đạt; Vite còn cảnh báo chunk598.21kB/gzip183.75kB |
| `./tools/npm.ps1 test` | Lượt tuần tự đạt8 công cụ +9 backend +93 frontend =110 test;19 ca Kho nằm trong93 frontend |
| `./tools/npm.ps1 run test:integration` | 29/29 đạt trên clothing_test; cảnh báo pg về query đồng thời, không sửa ngoài phạm vi |
| `./tools/npm.ps1 run test:e2e:implemented` | 14/14 đạt, khoảng1.3phút:2 auth +4 categories +5 products +3 inventory; API/proxy/DB thật |
| Mobile390px | E2E xác nhận không tràn ngang; agent đã xem ảnh inventory-mobile-390.png, SKU64 xuống dòng và tồn12/giữ2/còn10 hiển thị đủ |
| Review cấu trúc độc lập | Không phát hiện Critical/Important/Minor trong phạm vi M3.7.1; agent chính đã xác nhận E2E/ảnh |
| Rà phạm vi/diff/liên kết tài liệu | Không sửa phần Người A/backend; diff whitespace và liên kết file đạt |

Lượt `npm test` đầu dừng ở test công cụ Prisma do tiến trình con timeout15s khi chạy kiểm tra đồng thời; chạy lại tuần tự đạt, không tăng timeout/bỏ test. Lượt E2E đầu không chạy ca nào vì Docker engine mất kết nối (`ECONNREFUSED`/readiness timeout); đã khởi động lại Docker Desktop và container DB hiện có, giữ nguyên volume/dữ liệu. Lượt kế tiếp11 ca cũ đạt nhưng fixture mới thiếu `Product.priceFrom`, một ca lỗi setup và hai ca chưa chạy; đã bổ sung `priceFrom=100000` vào fixture và chạy lại toàn bộ14/14 đạt, không sửa backend.

### Chạy thử / điểm dừng

Giữ Docker DB, chạy `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend` ở hai terminal. Đăng nhập ADMIN tại http://127.0.0.1:5173/login → Kho hoặc mở http://127.0.0.1:5173/admin/inventory. Thử SKU/tên, Enter, refresh, phân trang, từ khóa không có kết quả, URL page sai và màn hình390px theo [hướng dẫn M3.7.1](docs/local-trial-m3.md). Nếu DB trống, tạo một nháp bằng UI M3.3 rồi quay lại Kho; phần này không tự seed và chưa có nhập kho.

**Đã viết, agent đã kiểm tra local; chờ người dùng chạy thử/xác nhận. Dừng ở M3.7.1.** Điều chỉnh/lịch sử (M3.7.2/.3) cần duyệt riêng; không coi toàn M3 đã hoàn thành. Chưa kiểm chứng GitHub CI hoặc deploy.

## Ngày 29/10/2026 — Đánh giá repo và phân công hai người

- Pull `main` tới `13b02d1` (đã gồm PR #2 `fix/review-findings` và PR #3 M3.4). Không sửa code.
- Đối chiếu code: backend M3 đã có API sản phẩm (biến thể, publish/hide, gắn ảnh), upload, kho (list/movements/adjustments) và catalog công khai; frontend chưa có UI biến thể/ảnh/kho/xuất bản/catalog khách.
- Kiểm tra: `npm run typecheck` đạt; `npm test` đạt (9 backend + 74 frontend). Chạy bằng npm trực tiếp vì `tools/npm.ps1` từ chối Node 24.15.0 của máy và thiếu `.local/node-v24.22.1-win-x64`. Chưa chạy integration/E2E.
- Người dùng đồng ý chia việc hai người: bảng ở [docs/plan.md](docs/plan.md#phân-công-hai-người) và [docs/m3-implementation-plan.md](docs/m3-implementation-plan.md#phân-công-hai-người-29102026). Phần đầu đề xuất: M3.4.2 (A), M3.7 (B), chờ duyệt kế hoạch chi tiết. M3.4.1 vẫn chờ người dùng thử.

## Ngày 28/10/2026 — M3.4.1: sửa hai finding P2 từ review

**Người dùng đã duyệt sửa đúng hai lỗi review.** Đã sửa và kiểm tra local, chờ người dùng chạy thử; không bắt đầu M3.4.2. Chỉ nhận các chỉnh sửa dưới đây của lượt này, không nhận code M3.4.1 do OpenCode tạo là phần mới của agent.

### Đã sửa / file thực tế

| File | Thay đổi của riêng bản sửa review |
|---|---|
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.tsx` | Đặt khóa operationRef ở cấp page, begin/end chung cho save và explicit reload, nhả trong finally; truyền trạng thái khóa xuống form |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.tsx` | Kết hợp disabled từ page với pending cục bộ, chặn submit khi bị khóa; overflowWrap:anywhere cho nội dung biến thể |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.test.tsx` | Thêm hai regression deferred GET/PATCH: reload khóa save/field, save khóa reload và giữ input/error qua cập nhật cache |
| `apps/frontend/e2e/products.spec.ts` | Dùng SKU64 hợp lệ không có điểm ngắt trong ca sửa/mobile; tách SKU fixture published để vẫn đúng giới hạn64 |
| `docs/architecture.md` | Ghi khóa chung save/reload ở page và cách xử lý SKU dài |
| `docs/local-trial-m3.md` | Thêm bước thử mạng chậm/khóa hai chiều và SKU64 trên mobile |
| `docs/m3-implementation-plan.md` | Cập nhật kết quả bản sửa, số test và phạm vi regression |
| `progress.md` | Ghi nguyên nhân, RED→GREEN, kết quả và điểm dừng |

Không sửa backend/schema/migration/dependency/package/CI hoặc logic biến thể/kho. Snapshot trước bản sửa ở `.local/m341-review-fix-before-20261028`; giữ nguyên index và mọi thay đổi sẵn có của OpenCode, không stage/commit/push.

### Data flow / key quan trọng

Bấm Lưu hoặc Tải dữ liệu mới → page kiểm tra/đặt khóa đồng bộ trước khi bắt đầu request → các trường và nút nhận trạng thái khóa → PATCH hoặc GET hoàn tất/thất bại → finally nhả khóa. Reload thành công mới thay snapshot/revision; không thể remount form giữa một PATCH đang chờ. Endpoint/DTO/version và kiểm tra quyền giữ nguyên.

- `operationRef`: khóa tức thời ở page, không bị mất khi form remount; chỉ một save hoặc explicit reload được bắt đầu.
- `operation`: state phản ánh loại thao tác đang chạy lên UI và trạng thái disabled/loading.
- `locked`: pending của form kết hợp khóa ngoài, vừa khóa trường/nút vừa chặn programmatic submit.
- `overflowWrap: anywhere`: SKU64 không có dấu gạch vẫn xuống dòng trong vùng biến thể; không đổi SKU được lưu.

### Kiểm tra thực tế

| Lệnh/kiểm tra | Kết quả |
|---|---|
| Unit regression trước sửa | 1 thất bại / 13 đạt; input/Save chưa khóa trong explicit reload chậm |
| E2E sửa/mobile với SKU64 trước CSS fix | 1/1 thất bại đúng assertion không tràn ngang ở390px; không phải fixture/schema lỗi |
| `./tools/npm.ps1 run typecheck` sau sửa | Backend/frontend đạt |
| `./tools/npm.ps1 test` sau sửa | 88/88 đạt: 8 công cụ + 6 backend unit + 74 frontend unit/UI, gồm 14 ca editor |
| `./tools/npm.ps1 run build` sau sửa | Hai app đạt; cảnh báo Vite chunk593.74kB/gzip182.79kB, không tối ưu bundle ngoài phạm vi |
| `./tools/npm.ps1 run test:e2e:implemented` sau sửa | 11/11 đạt, khoảng1.3phút; giữ nguyên bộ auth/categories/products và biên SKU64 thật |
| Ảnh mobile sau sửa | Agent đã xem ảnh trang sửa: SKU64 xuống dòng trong vùng nội dung, không tràn ngang |
| Rà diff bản sửa so với snapshot | Chỉ khóa hai thao tác và wrap SKU trong source; giữ snapshot/version/DTO/variantID như trước |

Không chạy lại integration riêng trong bản sửa chỉ frontend này; 28/28 là kết quả review trước, backend không đổi. Không claim toàn M3 hoặc catalog E2E đã đạt, chưa xác nhận CI GitHub mới/deploy. Test hiện có không bị bỏ/skip hay tăng timeout để che lỗi. Source được sửa sau khi đã quan sát cả unit và E2E tái hiện lỗi, rồi xác nhận lại GREEN.

### Chạy thử / điểm dừng

Giữ/chạy backend và frontend ở hai terminal theo README. ADMIN mở http://127.0.0.1:5173/admin/products → Sửa một nháp. Có thể dùng Network throttling để thấy nút/trường khóa trong lúc Tải dữ liệu mới; thao tác Lưu bị chặn đến khi tải xong. Khi đang Lưu, nút tải mới cũng bị khóa; nếu lỗi, input/error còn và các nút mở lại. SKU dài64 ký tự liền trên màn hình390px phải xuống dòng, không kéo ngang trang. Hướng dẫn chi tiết ở [local-trial-m3.md](docs/local-trial-m3.md).

**Đã viết/agent đã kiểm tra; chờ người dùng thử/xác nhận. Dừng ở M3.4.1, không triển khai phần tiếp theo, chưa commit/push.**

## Ngày 28/10/2026 — M3.4.1: admin sửa thông tin sản phẩm nháp

**Phạm vi được duyệt:** người dùng duyệt trực tiếp M3.4.1 trong chat kèm điều kiện luồng (snapshot/version, PATCH DTO đúng, chỉ DRAFT, không gửi trường quản trị). Chỉ sửa tên/slug/danh mục/mô tả; chưa cho sửa SKU/size/màu/giá, thêm/tắt biến thể, ảnh, kho hoặc xuất bản; không triển khai M3.4.2 trở đi. **Đã viết, agent đã kiểm tra; chờ người dùng chạy thử, chưa nghiệm thu.**

### Thay đổi và file thực tế

- Danh sách sản phẩm có nút Sửa cho hàng **Nháp** (`aria-label` kèm tên sản phẩm), dẫn tới `/admin/products/:id` qua PrivateRoute ADMIN; backend guard/DTO độc lập.
- Trang sửa điền sẵn tên/slug/danh mục/mô tả; biến thể hiển thị chỉ đọc kèm lời nhắc "Phần này chưa cho sửa SKU, size, màu, giá hoặc thêm/tắt biến thể.".
- Snapshot chốt lúc mở form quyết định `expectedVersion` và biến thể gửi lại; refetch nền (kể cả khi lỗi) không rebase snapshot và không xóa phần đang nhập. Nút **Tải dữ liệu mới** là thao tác duy nhất chủ động thay draft: thành công mới thay snapshot và remount form (có lời nhắc giải thích trên trang); tải lỗi giữ draft và hiện lỗi.
- PATCH gửi đúng `{name, slug, description, categoryId, variants[{id,sku,size,color,price,active}], expectedVersion}` — không gửi inventory/available/images/status. Lỗi 409 (version cũ hoặc slug trùng) hiện thông báo chung nêu cả hai khả năng, giữ input, không tự retry. Thành công invalidate `admin-products`, về danh sách, báo "Đã cập nhật sản phẩm nháp …". Busy ref chặn gửi lặp cùng nhịp và khi đang chờ.
- Tách `ProductInfoFields` dùng chung cho form tạo và sửa; hành vi tạo giữ nguyên (hồi quy 9 test tạo đạt).

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/admin/products/api/products.api.ts` | Thêm `VariantUpdateInput`/`ProductUpdateInput`, `productsApi.detail/update`; thu hẹp `ProductVariant.size` về allowlist vì DTO backend luôn chuẩn hóa, giúp gửi lại biến thể có kiểu đúng |
| `apps/frontend/src/features/admin/products/components/ProductInfoFields.tsx` | Nhóm trường tên/slug/danh mục/mô tả dùng chung tạo/sửa, giữ label/helper/validation cũ |
| `apps/frontend/src/features/admin/products/components/ProductCreateForm.tsx` | Dùng nhóm trường chung, gom state info; giữ nguyên giá, biến thể, busy và thông báo |
| `apps/frontend/src/features/admin/products/components/ProductEditForm.tsx` | Form sửa: state/lỗi/focus/busy, snapshot chốt lúc mount, map đúng 6 trường biến thể, thông báo 409 riêng |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.tsx` | Tải chi tiết+danh mục, snapshot/revision, reload tường minh (chỉ `isSuccess` mới rebase), save + invalidate + điều hướng |
| `apps/frontend/src/features/admin/products/pages/ProductsPage.tsx` | Link Sửa chỉ cho DRAFT và alert "Đã cập nhật sản phẩm nháp …" đọc từ navigation state |
| `apps/frontend/src/app/App.tsx` | Route `admin/products/:productId` qua PrivateRoute ADMIN |
| `apps/frontend/src/features/admin/products/pages/ProductEditPage.test.tsx` | 12 test sửa: điền sẵn/DTO đúng, 409/mạng giữ input, gửi lặp, refetch nền không rebase, lỗi danh mục nền, Tải dữ liệu mới, non-DRAFT, retry tải lỗi, ACL khách/CUSTOMER |
| `apps/frontend/src/features/admin/products/pages/ProductsPage.test.tsx` | Thêm test link Sửa chỉ có cho DRAFT (7 test list) |
| `apps/frontend/e2e/products.spec.ts` | Thêm 3 E2E: sửa thật (biến thể/tồn kho/ID đóng băng, DB kiểm chứng, mobile), hai tab thật (bản cũ bị chặn, chỉ rebase qua Tải dữ liệu mới), non-DRAFT không có form; bổ sung PATCH 401/403 vào ca ACL |
| `.github/workflows/ci.yml` | Tên bước E2E công khai phạm vi đến M3.4.1 |
| `README.md` | Trạng thái, bộ 11 E2E implemented, URL trang sửa |
| `docs/architecture.md` | Ghi tổ chức M3.4.1 và quy tắc snapshot/revision/DTO PATCH |
| `docs/local-trial-m3.md` | Hướng dẫn thử M3.4.1, hai tab, các lỗi và key |
| `docs/m3-implementation-plan.md` | Ghi phạm vi duyệt/kết quả/điểm dừng M3.4.1 |
| `docs/plan.md` | Cập nhật điểm dừng M3.4.1, chưa hoàn thành toàn M3 |
| `progress.md` | Ghi kết quả thật và các file của riêng phần này |

`package.json` không đổi vì `products.spec.ts` đã nằm trong `test:e2e:implemented`. Backend/schema/migration/dependency/lockfile không đổi. Không reset DB, không tạo admin, không seed; không stage/commit/push. Nhánh `feat/catalog-inventory` giữ nguyên các thay đổi đã có. E2E tạo fixture riêng trên PostgreSQL `_test` và dọn đúng product/variant/inventory/category/user UUID của lượt chạy.

### Data flow / key quan trọng

Nút Sửa → GET `/api/v1/admin/products/:id` + GET admin/categories → `ProductEditPage` chốt snapshot → `ProductEditForm` điền sẵn → PATCH `/api/v1/admin/products/:id` với DTO đúng qua cookie/CSRF → SessionGuard/RolesGuard + `ProductUpdateDto` → `ProductsService.update` kiểm tra version trong transaction (từ chối nếu DB đã đổi hoặc thiếu/thừa biến thể), tăng version → trả dữ liệu → FE invalidate `admin-products`, về danh sách GET đọc lại server.

- `snapshot`: bản gốc chốt lúc mở form, nằm ở page (`ProductEditPage`) — quyết định `expectedVersion` và biến thể gửi lại; refetch nền không đổi.
- `revision`: đếm remount `ProductEditForm`; chỉ tăng khi Tải dữ liệu mới thành công, là thao tác duy nhất bỏ draft.
- `isSuccess` của refetch: phản hồi lỗi vẫn giữ `data` cũ trong TanStack Query nên phải kiểm tra thành công trước khi rebase — đã bắt bằng test và sửa.
- `ProductUpdateInput`: kiểu PATCH cho phép đúng 6 trường biến thể (không `available`/inventory) để type chặn gửi thừa.
- 409 dùng chung version cũ/slug trùng; thông báo nêu cả hai, không gán nhầm lỗi slug.

### Kiểm tra thực tế

| Lệnh/kiểm tra | Kết quả |
|---|---|
| Test draft ban đầu (sửa lỗi cú pháp JSX của nháp) | 12/12 thất bại vì route/trang chưa có (404), đúng loại RED; không phải missing import |
| `./tools/npm.ps1 test --workspace=@clothing/frontend -- ...ProductEditPage.test.tsx ...ProductsPage.test.tsx ...ProductCreatePage.test.tsx` cuối | 28/28 đạt (12 sửa + 7 list + 9 tạo) |
| `./tools/npm.ps1 run typecheck` cuối | Backend/frontend đạt |
| `./tools/npm.ps1 run build` cuối | Hai app đạt; cảnh báo Vite chunk có sẵn, không tối ưu bundle ngoài phạm vi |
| `./tools/npm.ps1 test` cuối | 86/86 đạt: 8 công cụ + 6 backend unit + 72 frontend unit/UI |
| `./tools/npm.ps1 run test:integration` | 28/28 đạt trên PostgreSQL `_test` (backend không đổi) |
| `./tools/npm.ps1 run test:e2e:implemented` cuối | 11/11 đạt, khoảng 1,5 phút: 2 auth + 4 categories + 5 products (tạo, ACL PATCH 401/403, sửa thật, hai tab, non-DRAFT) |
| Ảnh E2E mobile trang sửa 390px | Agent đã xem: label/focus rõ, form xếp dọc, biến thể chỉ đọc, không tràn ngang |

Bốn lỗi thật đã bị test bắt và xử lý trong phạm vi: (1) nháp test có cú pháp JSX đóng nhầm thẻ và vài stub chưa thực tế — chỉnh stub PATCH echo tên mới, thêm lỗi ban đầu cho ca retry, bỏ hàm chết `patchBody`, đổi `getByRole` đồng bộ sang `await findByRole`; (2) khi refetch lỗi TanStack vẫn trả `data` cũ khiến trang sửa tưởng thành công và remount mất draft — sửa kiểm tra `fresh.isSuccess` trước khi rebase; (3) fixture E2E tạo thẳng qua Prisma nên SKU chứa UUID chữ thường vi phạm CHECK `variant_fields_valid` (DTO thường uppercase) — uppercase fixture, không đổi ràng buộc; (4) Prisma trả `price` dạng chuỗi Decimal — assertion dùng `Number()` như ca tạo hiện có. Một lỗi locator E2E tìm nút Tải dữ liệu mới trong scope form trong khi nút ở page — đưa về scope trang.

### Giới hạn / chạy thử / điểm dừng

- Chỉ DRAFT được sửa; sản phẩm PUBLISHED/HIDDEN mở URL sửa sẽ thấy thông báo và không có form (E2E phủ). Backend vẫn cho PATCH PUBLISHED theo API hiện có — phần này không thay nghiệp vụ backend.
- Chưa sửa được SKU/size/màu/giá, thêm/tắt biến thể, ảnh, kho, xuất bản; chưa có public catalog. Lỗi validation biến thể lồng nhau backend chưa flatten fieldErrors (giữ nguyên từ M3.3); lỗi 409 hiện thông báo chung.
- Chưa kiểm chứng CI GitHub với thay đổi M3.4.1 (chưa commit/push); chưa deploy.
- Hướng dẫn: [chạy thử M3.4.1](docs/local-trial-m3.md#m341--admin-sửa-thông-tin-sản-phẩm-nháp). Giữ `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend`. ADMIN mở http://127.0.0.1:5173/admin/products → Sửa một sản phẩm Nháp → đổi tên/mô tả → Lưu thay đổi → refresh; thử hai tab cùng sản phẩm để xem bản cũ bị chặn; thử Tải dữ liệu mới sau khi tab kia đã lưu.

**Dừng ở M3.4.1 cho người dùng chạy thử/xác nhận.** M3.4.2 — sửa biến thể/thêm tắt — và các phần sau cần kế hoạch riêng được duyệt; chưa triển khai.

## Ngày 28/10/2026 — M3.3: tạo sản phẩm nháp với một biến thể

**Phạm vi được duyệt:** kế hoạch M3.3 đã gửi trong chat, người dùng yêu cầu tiếp tục M3 sau bản sửa CI. Chỉ danh sách quản trị và tạo nháp với một biến thể; không triển khai M3.4. Đã viết và agent đã kiểm tra local, xử lý finding review bằng RED→GREEN và xác nhận lại suite/E2E. **Chờ người dùng chạy thử, chưa nghiệm thu.**

### Thay đổi và file thực tế

- Admin → Sản phẩm → danh sách `/admin/products` và form `/admin/products/new`, đều có PrivateRoute ADMIN và backend guard độc lập.
- Form có tên/slug/danh mục/mô tả và một biến thể SKU/size/màu/giá nguyên VND. Loading/empty/error/retry khi tải danh mục; lỗi POST giữ input, field error nếu API cung cấp, busy ref chặn gửi lặp; không tự retry POST. Giá được kiểm tra UI và backend, không dùng any/ép kiểu mù.
- Server tạo DRAFT + đúng một variant đang bật + Inventory onHand/reserved0 bằng nested create nguyên tử; client không gửi status hoặc tồn kho. SKU chuẩn hóa chữ hoa/màu chữ thường theo DTO hiện có.
- Thành công invalidate query `admin-products`, về danh sách và đọc dữ liệu thật; list có trạng thái/giá/SKU/size/màu/khả dụng và phân trang24 trên URL. Nháp không xuất hiện qua list/detail public.

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/admin/products/api/products.api.ts` | Thêm contract Product/Variant/Input/Page, allowlist size, query key và API GET/POST |
| `apps/frontend/src/features/admin/products/components/ProductCreateForm.tsx` | Thêm form state/validation/error/focus/busy, chỉ một biến thể |
| `apps/frontend/src/features/admin/products/pages/ProductCreatePage.tsx` | Tải danh mục, điều phối POST/cache/navigation, giữ draft khi refetch lỗi có cache |
| `apps/frontend/src/features/admin/products/pages/ProductsPage.tsx` | Danh sách quản trị, phản hồi tạo thành công, trạng thái tải/lỗi/empty và phân trang URL |
| `apps/frontend/src/features/admin/products/pages/ProductCreatePage.test.tsx` | Thêm 9 test tạo, danh mục loading/empty/retry, giữ input, giá, gửi lặp, quyền và lỗi refetch nền |
| `apps/frontend/src/features/admin/products/pages/ProductsPage.test.tsx` | Thêm 6 test list/empty/error/URL pagination/trang sai/quyền |
| `apps/frontend/e2e/products.spec.ts` | Thêm 2 E2E thật: tạo/refresh/unique/mobile/DRAFT+inventory0/public privacy và 401/403 UI/API |
| `apps/frontend/src/app/App.tsx` | Thêm 2 route products qua PrivateRoute admin |
| `apps/frontend/src/features/admin/AdminPage.tsx` | Thêm link Sản phẩm, các nút wrap trên mobile |
| `package.json` | Thêm products.spec.ts vào test:e2e:implemented; lệnh full giữ nguyên |
| `.github/workflows/ci.yml` | Tên bước CI công khai phạm vi auth+categories+draft products đến M3.3 |
| `README.md` | Cập nhật trạng thái, URL và phạm vi 8 E2E implemented |
| `docs/architecture.md` | Ghi tổ chức feature, query/form/API và trách nhiệm backend khi tạo nháp |
| `docs/local-trial-m3.md` | Hướng dẫn thử M3.3, các lỗi, dữ liệu/key và giới hạn |
| `docs/m3-implementation-plan.md` | Ghi phạm vi được duyệt/thực hiện và điểm dừng M3.3 |
| `docs/plan.md` | Cập nhật điểm dừng, không đánh dấu hoàn thành toàn M3 |
| `progress.md` | Ghi kết quả thật, review, giới hạn và các file của riêng phần này |

Hai file config CI/package bổ sung so với bảng file ban đầu để thực hiện quy tắc đã thống nhất ở M3.2.1: có tính năng mới thì mở rộng bộ E2E implemented, không để CI chỉ kiểm tra 6 ca cũ. Không thay backend/schema/migration/dependency/lockfile hoặc test catalog. Không seed/tạo admin/reset dữ liệu local. E2E kiểm tra NODE_ENV/test PostgreSQL `_test` trước tạo và cleanup, chỉ dọn product/variant/inventory/category/user UUID do lượt chạy tạo. Không stage/commit/push; nhánh `feat/catalog-inventory`, baseline `06afd99` do người dùng đã push. Snapshot `.local/m3-3-before-20261028`, ledger `.local/m3-3-execution.md` bị Git bỏ qua.

### Data flow / key quan trọng

Admin mở tạo → GET `/api/v1/admin/categories` → form gửi `{name,slug,description,categoryId,variants:[{sku,size,color,price,active:true}]}` qua `productsApi.create` và client cookie/CSRF → SessionGuard/RolesGuard + ProductDto/VariantDto → ProductsService tạo Product/Variant/Inventory trong một nested write nguyên tử → trả dữ liệu đã chuẩn hóa → FE invalidate `admin-products`, về list GET `/api/v1/admin/products?page=1&pageSize=24`. Giá/status/tồn kho công khai lấy từ server, không dùng dữ liệu giả để báo đã lưu.

- `SKU`: mã riêng duy nhất của biến thể; backend chuẩn hóa uppercase, khác ID sản phẩm.
- `Variant`: tổ hợp size/màu cùng giá, M3.3 gửi đúng một variant active; UI quản lý thêm/sửa thuộc M3.4.
- `DRAFT`: trạng thái nháp backend thiết lập, public list/detail không trả sản phẩm này.
- `admin-products`: query key danh sách kèm trang từ URL; invalidate sau tạo để đọc lại dữ liệu server.
- `available`: khả dụng do backend tính từ kho, variant mới có onHand/reserved/available0.

### Kiểm tra thực tế và review

| Lệnh/kiểm tra | Kết quả |
|---|---|
| 14 test UI mới trước implementation | 14 thất bại vì route/form/list chưa có (404), không phải missing module/import |
| 14 test UI sau implementation ban đầu | 14/14 đạt riêng phần M3.3 |
| Regression review trước fix | 1/9 thất bại: refetch danh mục lỗi làm mất input; 8 ca còn lại đạt |
| `./tools/npm.ps1 run typecheck` cuối sau fix | Backend/frontend đạt |
| `./tools/npm.ps1 test` cuối sau fix | 73/73 đạt: 8 công cụ + 6 backend unit + 59 frontend unit/UI, gồm 15 M3.3 |
| `./tools/npm.ps1 run build` cuối sau fix | Hai app đạt; Vite cảnh báo chunk587.64kB/gzip181.72kB; không tối ưu bundle ngoài phần này |
| `./tools/npm.ps1 run test:integration` | 28/28 đạt trên PostgreSQL `_test`, backend không đổi sau lượt kiểm tra |
| `./tools/npm.ps1 run test:e2e:implemented` | Lượt cuối sau fix review: 8/8 đạt, 47.1 giây; 2auth + 4categories + 2products |
| E2E discovery `--list` | Implemented8 ca/3file; full9 ca/4file còn catalog, không phải full9 ca đã đạt |
| Ảnh E2E mobile | Agent đã xem form và list tại390px, label/error rõ và không tràn ngang |
| Review độc lập `review_m3_3` | 1 Important mất draft khi background refetch lỗi; không Critical/Minor khác |

**Finding review đã sửa:** query lỗi khi đã có cache không còn unmount ProductCreateForm; cảnh báo/retry tách khỏi form. Test tái hiện refetch lỗi rồi phục hồi đã RED→GREEN; suite73 đạt sau sửa. Không bỏ qua finding hoặc xin phép người dùng để né xử lý trong phạm vi.

Hai vướng mắc kiểm tra đã xử lý đúng nguyên nhân: (1) một lượt tools/prisma-config.test.mjs timeout subprocess15s/statusnull khi máy bận, giữ nguyên test/timeout, rerun đạt; (2) helper UI gõ từng ký tự nhiều trường khiến một test chạm5s dưới tải tổng, đổi phần cấp dữ liệu test sang fireEvent.change hàng loạt và giữ select/click thực/assertions/timeout; E2E vẫn thao tác trình duyệt thật. Không tắt check hoặc tăng timeout toàn suite để che lỗi. Lượt cuối root suite đạt.

### Giới hạn / chạy thử / điểm dừng

- Backend hiện chưa flatten fieldErrors của variant lồng nhau; dữ liệu sai vẫn bị DTO chặn và UI báo lỗi chung/giữ input. Unit kiểm tra khả năng hiển thị nested path nếu API cung cấp, không nhận là backend đã serialize đủ; không mở rộng sửa backend trong phần này.
- Chưa có UI sửa sản phẩm/ảnh/điều chỉnh kho/xuất bản hoặc public catalog; chưa chạy/nhận full catalog E2E đạt. Cảnh báo pg concurrent query và NO_COLOR/FORCE_COLOR không làm test thất bại. Chưa kiểm chứng CI GitHub với thay đổi M3.3, chưa deploy.
- Hướng dẫn: [chạy thử M3.3](docs/local-trial-m3.md). Giữ/chạy `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend` ở hai terminal. ADMIN mở http://127.0.0.1:5173/admin/products → Thêm sản phẩm → tên/slug/danh mục + SKU/size/màu/giá → Lưu → refresh, phải còn Nháp/khả dụng0. Thử dùng lại SKU/slug để kiểm tra lỗi giữ input.

**Dừng ở M3.3 cho người dùng thử/xác nhận.** M3.4 — sửa nháp và quản lý biến thể — cần kế hoạch riêng được duyệt; chưa triển khai.

## Ngày 28/10/2026 — Sửa theo review repo (nhánh `fix/review-findings`)

**Trạng thái:** người dùng yêu cầu thực hiện các mục ưu tiên sau review. Đã viết và agent đã kiểm tra local; **chờ người dùng xem/merge**. Không thay đổi phạm vi M3, không bắt đầu M3.3.

| File | Thay đổi |
|---|---|
| `apps/backend/src/application.ts` | `logger: false` làm mọi log Nest bị tắt, kể cả lỗi 500 và lỗi gửi mail; đổi thành chỉ giữ `error`/`warn`. |
| `apps/backend/src/common/http-exception.filter.ts` | Lỗi 500 ngoài dự kiến ghi stack vào log server; response cho client vẫn chung chung như cũ. |
| `apps/backend/src/modules/auth/auth.service.ts` | Không chờ gửi mail trước khi trả response đăng ký/quên mật khẩu/gửi lại xác minh, để thời gian phản hồi không lộ email đã có tài khoản hay chưa. |
| `apps/backend/src/common/http-exception.filter.spec.ts`, `apps/backend/src/modules/auth/auth.service.spec.ts` | Unit test mới: 500 ghi stack nhưng body an toàn; register/requestToken không chờ mail provider. |
| `apps/backend/test/auth.integration.spec.ts`, `apps/frontend/e2e/auth.spec.ts` | Đọc hộp thư preview có chờ tối đa 5 giây vì mail gửi sau response; thêm ca kiểm tra app thật vẫn ghi log lỗi. |
| `README.md`, `progress.md` | Bỏ câu "fastLock/LiveOrder" không thuộc dự án; xóa khối "Yêu cầu push GitHub" bị chép trùng, sửa tiêu đề bị cắt, bỏ đường dẫn máy cá nhân trong ghi chú Git. |

**Kiểm tra (Node 24.15 với `--engine-strict=false`, PostgreSQL 18.6 Docker):** typecheck và build đạt; `npm test` 61/61 (8 tools, 9 backend unit, 44 frontend); integration 29/29; `test:e2e:implemented` 6/6 (catalog vẫn chờ UI theo M3.2.1). Ba unit test mới và ca log integration đã thấy thất bại trước khi sửa. Chưa chạy trên GitHub CI.

**Còn lại:** rate limit đăng nhập vẫn theo IP+email (chưa theo tài khoản); backend vẫn listen `127.0.0.1` (cần đổi trước deploy M6); ESLint/Prettier hoãn tới sau khi merge nhánh catalog để tránh diff format toàn repo.

## Ngày 28/10/2026 — M3.2.1: sửa phạm vi E2E của CI

**Người dùng đã duyệt bản sửa CI riêng, chưa duyệt triển khai M3.3.** Đã sửa cấu hình và kiểm tra local; CI mới chưa commit/push/chạy lại trên GitHub. Mốc sản phẩm vẫn dừng ở M3.2.

### Nguyên nhân đã xác nhận

- Commit `d5953cf` đã push thành công. API Actions xác nhận run `40665722000` thất bại ở bước `npm run test:e2e`; typecheck/build/unit/integration và cài browser đều thành công.
- Người dùng cung cấp log chi tiết: 6 E2E đạt, `catalog.spec.ts` thất bại tại dòng 54 chờ link Sản phẩm chưa có. Ca này kiểm tra toàn M3, vượt UI đang triển khai đến M3.2. Cấu hình CI đã chạy ca chấp nhận toàn M3 quá sớm.
- `.env.test not found` không phải nguyên nhân lỗi này vì CI cấp biến môi trường trực tiếp. Các cảnh báo Node/Ubuntu không thay thế lỗi locator đã nêu.

### File thực tế và thay đổi

| File | Mục đích |
|---|---|
| `package.json` | Thêm `test:e2e:implemented` chọn auth.spec.ts + categories.spec.ts; giữ nguyên test:e2e chạy toàn bộ |
| `.github/workflows/ci.yml` | Bước E2E chạy lệnh implemented và ghi rõ tên auth + categories through M3.2 |
| `README.md` | Phân biệt 6 ca implemented với 7 ca toàn bộ; yêu cầu mở rộng phạm vi khi triển khai tính năng tiếp theo |
| `progress.md` | Ghi lỗi gốc, kết quả kiểm tra mới, giới hạn CI và điểm dừng |

Danh sách đúng kế hoạch đã duyệt. Không thay `catalog.spec.ts`, test runner/guard `_test`, Playwright config, schema, dependency hoặc lockfile; không xóa/skip test, không thêm continue-on-error. Index Git và dữ liệu local giữ nguyên; E2E chỉ ghi/dọn fixture riêng trên `_test`.

**Luồng chạy:** CI → `npm run test:e2e:implemented` → `tools/test-e2e.mjs` kiểm tra NODE_ENV/test database rồi chuyển hai tên file tới Playwright → khởi động API/FE test → chạy auth và danh mục. `npm run test:e2e` vẫn không có filter và còn nguyên ca catalog.

### Kiểm tra mới trong phiên

| Kiểm tra | Kết quả |
|---|---|
| Gọi script mới trước sửa | Thất bại Missing script, xác nhận script chưa tồn tại |
| Parse package.json và đối chiếu scripts | JSON hợp lệ; script đầy đủ giữ nguyên, script mới đúng phạm vi |
| Liệt kê implemented bằng `--list` | 6 ca / 2 file, đúng auth + categories |
| Liệt kê full bằng `--list` | 7 ca / 3 file, vẫn có catalog.spec.ts; đây chỉ là discovery, không phải 7 ca đạt |
| `./tools/npm.ps1 run test:e2e:implemented` | 6/6 đạt thực tế trên `_test`, 41.2 giây |
| Review/diff | `review_ci_e2e_scope` review độc lập script/workflow/README: không Critical/Important/Minor, không hành vi bị bỏ qua đánh giá; agent rà progress sau cập nhật, diff/đường dẫn tài liệu đạt |

Khi thử discovery qua wrapper PowerShell, `--list` bị npm nhận như config nên đã dừng lượt đó; dùng npm native với Node24 local và mảng tham số để chuyển nguyên `--`/`--list`. Không sửa wrapper ngoài phạm vi. Lượt chạy chính thức của lệnh implemented phía trên không có tham số discovery, hoàn tất exit0.

Không chạy lại root typecheck/build/unit/integration cho bản sửa chỉ cấu hình/tài liệu này; không nhận kết quả M3.2/CI cũ là vừa chạy local. E2E tự build backend khi khởi động theo cấu hình hiện có. Full E2E chưa đạt vì UI các phần M3 sau chưa triển khai; CI xanh của implemented không đại diện nghiệm thu toàn M3.

**Key:** không có key dữ liệu nghiệp vụ mới. `test:e2e:implemented` là bộ tính năng đã triển khai; `test:e2e` là bộ đầy đủ; tên bước E2E trong CI công khai phạm vi kiểm tra đến M3.2. Khi thêm phần mới phải bổ sung ca đã sẵn sàng vào bộ implemented, khi toàn M3 đủ thì CI cần chạy bộ đầy đủ.

**Chạy thử:** `./tools/npm.ps1 run test:e2e:implemented` từ root, DB test và browser theo README. Người dùng có thể review/commit/push bản sửa để CI tạo run mới; agent chưa stage/commit/push và chưa xác nhận CI mới đạt. Dừng sau bản sửa CI; M3.3 còn chờ duyệt kế hoạch riêng.

## Ngày 28/10/2026 — M3.2: admin sửa/bật/tắt danh mục

**Trạng thái:** người dùng đã duyệt kế hoạch M3.2 trong chat. Đã viết, agent đã kiểm tra local và review độc lập không finding cần sửa; **chờ người dùng thử/xác nhận**. Không tự coi yêu cầu tiếp tục là nghiệm thu toàn M3 hoặc các phần trước.

### Thay đổi và file thực tế

- Nút Sửa mở dialog có tên/slug/active hiện tại; Lưu thay đổi ghi qua PATCH thật và refresh vẫn giữ; Hủy/Escape đóng mà không ghi.
- Form tạo/sửa dùng chung CategoryForm để không lặp field/validation/submit. `useId` tránh trùng ID giữa form tạo và dialog.
- Edit giữ snapshot/version lúc mở, không bị refetch nền thay draft. 409 giữ input/version, không tự ghi đè; Tải dữ liệu mới chỉ thay snapshot và bỏ draft khi GET thành công theo thao tác người dùng. Lời nhắc ngay trong dialog giải thích việc thay dữ liệu đang nhập.
- Busy ref khóa submit đồng bộ; trong lúc lưu/tải mới khóa input, Save/Cancel/reload và chặn Escape/backdrop. Sau PATCH thành công cập nhật cache, đóng dialog và invalidate list; refetch lỗi không báo nhầm ghi thất bại.

| File | Thay đổi và lý do |
|---|---|
| `apps/frontend/src/features/admin/categories/api/categories.api.ts` | Thêm CategoryUpdateInput/expectedVersion và hàm PATCH typed |
| `apps/frontend/src/features/admin/categories/components/CategoryCreateForm.tsx` → `apps/frontend/src/features/admin/categories/components/CategoryForm.tsx` | Đổi tên/tái sử dụng form tạo và sửa, giữ trạng thái/error/khóa submit, ID riêng cho mỗi instance |
| `apps/frontend/src/features/admin/categories/components/CategoryEditDialog.tsx` | Thêm dialog giữ snapshot, reload tường minh, pending/close guard và form sửa |
| `apps/frontend/src/features/admin/categories/pages/CategoriesPage.tsx` | Thêm nút Sửa, mutation update/cache và GET dữ liệu mới; giữ list/create |
| `apps/frontend/src/features/admin/categories/pages/CategoriesPage.test.tsx` | Thêm 5 test edit/reload/conflict/cancel/submit; giữ 7 test tạo/quyền |
| `apps/frontend/e2e/categories.spec.ts` | Thêm sửa/public visibility và hai tab thật; bổ sung chặn PATCH anonymous/CUSTOMER; cleanup cả slug đã đổi |
| `docs/local-trial-m3.md` | Hướng dẫn thao tác M3.2, thử hai tab và giới hạn catalog public |
| `docs/architecture.md` | Ghi trách nhiệm form/dialog/page và quy tắc snapshot/version |
| `docs/m3-implementation-plan.md` | Ghi phạm vi được duyệt, kết quả và điểm dừng M3.2 |
| `docs/plan.md` | Cập nhật điểm dừng M3.2, chưa hoàn thành toàn M3 |
| `README.md` | Cập nhật trạng thái/tài liệu chạy thử M3.2 |
| `progress.md` | Ghi bằng chứng kiểm tra, file thực tế và việc còn lại |

Danh sách thực tế đúng phạm vi dự kiến; backend/schema/migration/dependency giữ nguyên. Không sửa/reset dữ liệu local, không tạo admin local hoặc seed dữ liệu người dùng. E2E chỉ tạo/dọn fixture UUID của chính lượt chạy ở `_test`. Không thay index/stage/commit/push; nhánh vẫn `feat/catalog-inventory`, thay đổi các phần trước được giữ nguyên. Bản đối chiếu trước M3.2 nằm trong `.local/m3-2-before-20261028` bị Git bỏ qua.

### Data flow và key quan trọng

Admin chọn Sửa → `CategoryEditDialog` giữ `snapshot` gồm `version` đang xem → `CategoryForm` gửi `{name,slug,active}` → `categoriesApi.update` thêm `expectedVersion` của snapshot rồi PATCH qua proxy/CSRF → SessionGuard/RolesGuard + DTO kiểm tra → CategoriesService update theo id/version trong transaction, Prisma tăng version → FE cập nhật cache và refetch list. Danh mục tắt bị loại khỏi GET public categories, bật lại thì xuất hiện. UI public catalog vẫn chưa triển khai.

- `expectedVersion`: phiên bản của lần mở/sau lần reload tường minh; server từ chối khi DB đã đổi.
- `snapshot`: dữ liệu gốc của form sửa, không tự đồng bộ theo query list để tránh ghi đè bằng draft cũ.
- `revision`: remount form sau reload thành công dù version không đổi; chỉ thao tác này chủ động bỏ phần đang nhập.
- `busy`: khóa ref tức thời để chặn gửi/đóng/reload trùng trước khi React vẽ disabled.
- `CONFLICT`/409: API hiện dùng cho cả version cũ và slug trùng; form sửa nêu cả hai khả năng và giữ input, không gán nhầm mọi lỗi thành slug.

### Kiểm tra mới trong phiên

| Lệnh/kiểm tra | Kết quả đã quan sát |
|---|---|
| UI categories trước implementation | 5 test sửa thất bại vì chưa có nút Sửa, 7 test cũ đạt; không phải missing import |
| `./tools/npm.ps1 run typecheck` | Backend/frontend đạt |
| `./tools/npm.ps1 run test --workspace=@clothing/frontend -- src/features/admin/categories/pages/CategoriesPage.test.tsx` | 12/12 đạt sau sửa |
| `./tools/npm.ps1 test` | 58/58 đạt: 8 công cụ + 6 backend unit + 44 frontend unit/UI |
| `./tools/npm.ps1 run build` | Hai ứng dụng đạt; cảnh báo Vite chunk 567.98 kB/gzip 177.06 kB, chưa tối ưu bundle trong phần này |
| `./tools/npm.ps1 run test:integration` | 28/28 đạt trên PostgreSQL `_test`, gồm normalize/version/public visibility/allowlist và quyền |
| `./tools/npm.ps1 run test:e2e -- categories.spec.ts auth.spec.ts` | 6/6 đạt: 2 auth + 4 categories, gồm sửa/slug trùng/refresh/mobile/public visibility, PATCH 401/403 và hai tab thật |
| Screenshot mobile dialog | Agent đã xem ảnh E2E ở viewport 390: form/error/actions rõ, không tràn ngang |
| Review độc lập `review_m3_2` | Chỉ đọc diff với snapshot và các luồng/test liên quan; không Critical/Important/Minor, không hành vi bị bỏ qua đánh giá |

Không chạy toàn bộ `catalog.spec.ts` vì UI sản phẩm/ảnh/kho/public chưa có; không skip hoặc nhận toàn E2E M3 đã đạt. Cảnh báo `pg` concurrent query và NO_COLOR/FORCE_COLOR không làm kiểm tra thất bại. Chưa có bằng chứng GitHub CI hoặc deploy. Rà diff và liên kết tài liệu trước bàn giao.

### Chạy thử / điểm dừng

Xem [hướng dẫn M3.2](docs/local-trial-m3.md#m32--sửabậttắt-danh-mục). Chạy `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend` ở hai terminal nếu app chưa chạy. Mở http://127.0.0.1:5173/admin/categories bằng ADMIN → Sửa một danh mục → đổi tên/slug/active → Lưu → refresh. Mở Sửa cùng danh mục ở hai tab trước khi lưu để kiểm tra stale version; tab cũ phải bị chặn và giữ input.

**Dừng ở M3.2 để người dùng thử/phản hồi.** Phần tiếp theo là M3.3 — tạo sản phẩm nháp với một biến thể; cần kế hoạch riêng được duyệt, chưa triển khai.

## Ngày 28/10/2026 — M3.1.1: sửa giao diện theo phiên khi chạy thử

**Phạm vi được duyệt:** người dùng báo đã đăng nhập nhưng `/shop` vẫn có Tạo tài khoản, đồng ý thay nút theo phiên/role và chuyển người đã đăng nhập khỏi `/login`, `/register`. Đây là bản sửa trong lượt chạy thử, không triển khai M3.2.

**Nguyên nhân:** `CatalogIntroPage` luôn render link `/register`; `AuthPage` luôn render form login/register mà chưa kiểm tra phiên. Không có căn cứ từ lỗi UI này để kết luận cookie/session đã bị mất; không sửa hoặc bỏ backend guard.

### File thực tế của riêng bản sửa

| File | Thay đổi và mục đích |
|---|---|
| `apps/frontend/src/features/catalog/pages/CatalogIntroPage.tsx` | Dùng lại useCurrentUser; khách thấy Tạo tài khoản, CUSTOMER thấy Tài khoản, ADMIN thấy Quản trị; chờ/lỗi phiên không hiển thị nhầm link đăng ký |
| `apps/frontend/src/features/auth/pages/AuthPage.tsx` | EntryAuthPage kiểm tra phiên cho login/register, có loading/error/retry và Navigate replace theo role; forgot/reset giữ luồng riêng |
| `apps/frontend/src/features/catalog/pages/CatalogIntroPage.test.tsx` | Thêm 6 test guest/CUSTOMER/ADMIN, pending/error/retry và thay đổi cache sau logout |
| `apps/frontend/src/app/App.test.tsx` | Thêm 8 ca kiểm tra login/register theo phiên, khách, pending/error/retry; giữ 3 ca protected route đã có |
| `apps/frontend/e2e/auth.spec.ts` | Bổ sung vào luồng auth hiện có: /shop không hiện đăng ký khi có cookie thật, deep link login/register chuyển về account; logout thì link đăng ký hiện lại |
| `progress.md` | Ghi nguyên nhân, kiểm tra, các file của bản sửa và hướng dẫn thử |

E2E auth là file bổ sung so với dự kiến để chứng minh tích hợp cookie/proxy theo quy tắc dự án. Không thay dependency/backend/schema/API hoặc tạo dữ liệu người dùng local; index/thay đổi có sẵn được giữ nguyên, không stage/commit/push. Snapshot riêng phần này ở `.local/auth-ui-before-20261028` bị Git bỏ qua.

### Data flow và key quan trọng

`CatalogIntroPage` và `EntryAuthPage` dùng chung query `current-user` của `useCurrentUser`; khi cần, `authApi.me` gọi GET `/api/v1/me` qua proxy với cookie để backend đọc phiên. Chỉ khi đã xác nhận là khách mới hiện link/form đăng ký; có user thì nút và redirect theo role. Login cập nhật cache, logout xóa cache như trước; không tạo trạng thái đăng nhập thứ hai hoặc lưu token vào localStorage.

- `useCurrentUser`: hook/cache có sẵn làm nguồn dữ liệu phiên cho cả header, nút và trang auth.
- `EntryAuthPage`: component cục bộ chỉ kiểm soát login/register; không chặn người đang đăng nhập mở forgot/reset.
- `Navigate replace`: chuyển đến account/admin và thay entry lịch sử để Back không quay lại form đăng nhập vừa bị chuyển hướng.
- `isPending`/`isError`: phân biệt phiên đang tải hoặc kiểm tra thất bại với kết quả khách thực sự; lỗi có nút thử lại.

### Kiểm tra trong phiên

| Kiểm tra | Kết quả thực tế |
|---|---|
| Test tái hiện trước sửa CatalogIntroPage + App | 11 thất bại / 6 đạt; lỗi đúng link tạo tài khoản cố định, form hiện trước khi có phiên và thiếu redirect; không phải missing import |
| `./tools/npm.ps1 run typecheck` | Backend/frontend đạt |
| `./tools/npm.ps1 test` | 53/53 đạt: 8 công cụ + 6 backend unit + 39 frontend unit/UI, gồm hồi quy reset token và M3.1 |
| `./tools/npm.ps1 run build` | Backend/frontend đạt; cảnh báo Vite chunk 558.88 kB / gzip 174.75 kB được giữ nguyên phạm vi tối ưu sau |
| `./tools/npm.ps1 run test:e2e -- auth.spec.ts categories.spec.ts` | 4/4 đạt trên `_test`: cookie thật, refresh, CTA/redirect/logout, register/verify/reset, mobile và danh mục/quyền |
| `git diff --check` | Đạt sau code; rà lại sau cập nhật tài liệu trước bàn giao |

Không chạy lại integration backend trong bản sửa chỉ frontend này; 28/28 ở M3.1 là kết quả lượt trước, không nhận là vừa chạy. Chưa có bằng chứng CI GitHub hoặc deploy. Review độc lập `review_auth_ui` chỉ đọc production diff so với snapshot và các test/luồng liên quan: không finding Critical/Important/Minor, không hành vi bị bỏ qua đánh giá. Không có sửa source sau lượt kiểm tra cuối.

### Chạy thử / điểm dừng

Giữ hai terminal local đang chạy, hoặc mở từ root bằng `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend` ở hai terminal. Tại http://127.0.0.1:5173/shop:

1. Chưa đăng nhập: nút Tạo tài khoản dẫn tới register.
2. Đăng nhập CUSTOMER: nút đổi thành Tài khoản; ADMIN: đổi thành Quản trị. Refresh vẫn đúng và không có Tạo tài khoản.
3. Khi đang đăng nhập, nhập trực tiếp `/login` hoặc `/register`: chuyển về `/account` hoặc `/admin` theo role.
4. Đăng xuất và quay lại `/shop`: nút Tạo tài khoản hiện lại.
5. Luồng quên/đặt lại mật khẩu vẫn dùng được; khi kiểm tra phiên lỗi sẽ có nút Kiểm tra lại phiên.

**Đã viết và agent đã kiểm tra, chờ người dùng thử/xác nhận. Dừng tại bản sửa M3.1.1; không tự bắt đầu M3.2.**

## Ngày 28/10/2026 — M3.1: admin xem và tạo danh mục

**Trạng thái:** người dùng đã duyệt phần M3.1; đã viết và agent đã kiểm tra local, review độc lập không có finding cần sửa. **Chờ người dùng chạy thử**, chưa coi là nghiệm thu. Việc cho phép triển khai M3.1 không tự đánh dấu các phần trước đã được người dùng thử.

### Phạm vi và kết quả

- Route `/admin/categories` có PrivateRoute ADMIN, mở từ nút Danh mục ở trang quản trị.
- Danh sách đọc dữ liệu thật từ GET admin categories; có loading/empty/error/retry, tên/slug/trạng thái bật/tắt và bố cục mobile.
- Form tạo tên/slug/active qua POST hiện có, xử lý lỗi field/mạng/slug trùng và giữ input khi lỗi; khóa trường/nút và dùng `busy` để chặn submit cùng nhịp. Không tự retry POST.
- Tạo thành công báo kết quả, đọc lại query danh sách rồi làm trống form. Nếu refetch lỗi sau khi server đã lưu, thông báo đã lưu vẫn đúng, list có nút thử tải lại; không báo nhầm POST thất bại.
- Không thay backend/schema/migration/dependency hoặc tài khoản người dùng local. Tài khoản ADMIN/CUSTOMER E2E chỉ là fixture UUID riêng trong `_test`, được dọn sau test. Không seed dữ liệu demo vào database local.

### File thực tế của riêng M3.1

| File | Thay đổi và mục đích |
|---|---|
| `apps/frontend/src/features/admin/categories/api/categories.api.ts` | Thêm kiểu CategoryInput/Category và hàm gọi GET/POST danh mục |
| `apps/frontend/src/features/admin/categories/components/CategoryCreateForm.tsx` | Thêm form state/validation, phản hồi lỗi có focus, khóa submit và giữ input khi lỗi |
| `apps/frontend/src/features/admin/categories/pages/CategoriesPage.tsx` | Thêm Query/list/create flow, invalidate danh sách sau tạo, trạng thái tải/lỗi/thành công |
| `apps/frontend/src/features/admin/categories/pages/CategoriesPage.test.tsx` | Thêm 7 test UI/route: tải/tạo, retry, trùng slug, validation/mạng, submit lặp và quyền |
| `apps/frontend/src/app/App.tsx` | Thêm import và route danh mục có bảo vệ ADMIN, giữ route cũ |
| `apps/frontend/src/features/admin/AdminPage.tsx` | Thêm nút Danh mục sau khi API admin/access thành công |
| `apps/frontend/e2e/categories.spec.ts` | Thêm 2 test qua proxy/DB thật: active/inactive, refresh, duplicate, mobile và quyền GET/POST |
| `docs/local-trial-m3.md` | Thêm hướng dẫn chuẩn bị/admin CLI, chạy thử M3.1, data flow và giới hạn |
| `progress.md` | Ghi kết quả kiểm tra thực tế, file của phần này và điểm dừng |
| `docs/m3-implementation-plan.md` | Ghi M3.1 được duyệt/triển khai, giữ các phần tiếp theo chờ duyệt |
| `docs/plan.md` | Cập nhật điểm dừng M3.1, không đánh dấu hoàn tất toàn M3 |
| `README.md` | Sửa trạng thái cũ còn ghi chưa chuyển M3, dẫn tới hướng dẫn M3.1 |
| `docs/architecture.md` | Ghi cấu trúc feature admin/categories và query flow đang có |

Ba tài liệu cuối là bổ sung so với danh sách dự kiến để tránh mô tả sai trạng thái code; không mở rộng tính năng. Các thay đổi đã staged từ những phần trước giữ nguyên; M3.1 không stage/commit/push. Nhánh vẫn `feat/catalog-inventory`. Snapshot trước phần này ở `.local/m3-1-before-20261028`, ledger `.local/m3-1-execution.md` đều bị Git bỏ qua.

### Data flow và key

Admin mở Danh mục → `CategoriesPage` gọi `categoriesApi.list` qua client/proxy → backend SessionGuard/RolesGuard đọc phiên và quyền ADMIN → CategoriesService đọc bảng `categories`. Admin gửi `{name,slug,active}` từ form → client lấy CSRF rồi POST → DTO chuẩn hóa/kiểm tra và Prisma ghi DB với unique slug → FE báo thành công, invalidate `admin-categories` để tải lại dữ liệu server. Lỗi tạo được giữ tại form để chỉnh hoặc thử lại; backend vẫn quyết định quyền và tính hợp lệ.

- `slug`: đường dẫn duy nhất, không phải tên hiển thị; trùng sẽ bị DB/API từ chối.
- `active`: bật/tắt tại lúc tạo; M3.1 chưa sửa trạng thái danh mục cũ.
- `admin-categories`: query key xác định danh sách cần refetch sau POST thành công.
- `busy`: khóa đồng bộ bằng ref trong form để chặn gửi lặp trước khi React vẽ trạng thái disabled.
- `version`: response hiện có để dành cho chỉnh sửa có kiểm soát xung đột M3.2; M3.1 chưa gửi expectedVersion.

### Kiểm tra đã quan sát trong phiên

| Lệnh/kiểm tra | Kết quả |
|---|---|
| Test UI M3.1 trước implementation | 7/7 thất bại vì route chưa có, hiện 404; không phải lỗi import/missing module |
| `./tools/npm.ps1 run typecheck` | Backend và frontend đạt |
| `./tools/npm.ps1 test` | 39/39 đạt: 8 công cụ + 6 backend unit + 25 frontend unit/UI (gồm 7 M3.1) |
| `./tools/npm.ps1 run build` | Backend/frontend đạt; Vite cảnh báo chunk 557.75 kB, gzip 174.57 kB, chưa tối ưu bundle trong phần này |
| `./tools/npm.ps1 run test:integration` | 28/28 đạt trên PostgreSQL `_test` (16 auth + 12 catalog) |
| `./tools/npm.ps1 run test:e2e -- categories.spec.ts` | 2/2 đạt: dữ liệu thật, refresh, trùng slug, active=false, mobile390/focus và chặn quyền ở UI/API |
| `./tools/npm.ps1 run test:e2e -- auth.spec.ts` | 2/2 đạt: register/verify/login/refresh/reset/logout và mobile/focus, kiểm tra hồi quy App route |
| Review độc lập `review_m3_1` | Chỉ đọc source/diff so với snapshot, không finding Critical/Important/Minor; không hành vi bị bỏ qua đánh giá |
| Ảnh mobile E2E danh mục | Agent đã xem; form/list xếp dọc, slug dài wrap, không tràn ngang |

Trong lượt chạy UI đầu sau implementation, assertion đếm POST chạy trước microtask của TanStack mutation (0 thay vì 1); sửa test dùng waitFor trước khi đếm, không đổi code để che lỗi. Lượt cuối toàn suite đạt. Cảnh báo `pg` concurrent query và NO_COLOR/FORCE_COLOR hiện có không làm test thất bại; không nâng dependency để xử lý trong phần này. Diff/đường dẫn tài liệu được rà trước bàn giao.

### Chạy thử và điểm dừng

Xem [hướng dẫn M3.1](docs/local-trial-m3.md). Chạy `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend` ở hai terminal, mở http://127.0.0.1:5173/admin/categories bằng tài khoản ADMIN. Tạo Áo thun / ao-thun → thấy trong list sau refresh; tạo lại cùng slug → báo lỗi và giữ form. Không tự tạo admin hoặc cung cấp mật khẩu mặc định.

**Dừng tại M3.1 để người dùng thử và phản hồi.** M3.2 dự kiến sửa/bật/tắt danh mục cũ, cần kế hoạch riêng được duyệt. Chưa chạy toàn bộ catalog E2E vì UI các phần sau chưa có; không skip ca đó để gọi toàn M3 hoàn thành. Chưa xác nhận CI GitHub, chưa deploy và chưa commit/push.

## Quyết định thực hiện

- Workspace hiện trống và chưa là repo: khởi tạo repo riêng tại thư mục người dùng chỉ định, dùng nhánh feature; không tạo worktree bên trong một repo chưa tồn tại hoặc sửa dự án khác.
- Kế hoạch được lưu ở `docs/plan.md`, đặc tả nghiệp vụ ở `docs/business-rules.md`, theo vị trí người dùng yêu cầu.
- Không đổi Node toàn máy, không tự mua dịch vụ; engine incompatibility phải được xử lý tường minh.
- Review M1 đã phát hiện và bổ sung: tiền đến sau hủy trước deadline; nghĩa vụ tiền khi nhận giao thất bại; Returns suy ra needsResolution để không gọi vòng Orders→Returns. Định nghĩa ngân sách hoàn không cộng PROCESSING hai lần; adapter Mail tối thiểu chuyển về M2 vì auth cần dùng.
- Metadata npm kiểm tra: React 19.3.1, Router 8.5.0 cần Node >=22.22; Nest 12.2.0; MUI 9.5.0; Vite 8.3.5; Prisma stable 7.10.1 (latest là 8 RC, không chọn). Node 24.22.1 đã tải vào `.local`, kiểm SHA256 từ nodejs.org, không thay hệ thống.
- Docker Desktop được khởi động nền; daemon trả phiên bản 28.4.0. Chưa có PostgreSQL/test ứng dụng chạy ở thời điểm ghi này.

## Kiểm tra

### M3.0.3 — sửa lỗi và tổ chức frontend — 27/10/2026 (agent đã kiểm tra; chờ người dùng thử)

- Người dùng yêu cầu triển khai các điểm review FE, xong mới lập kế hoạch tiếp tục M3. Phạm vi đã nêu trong chat: API client multipart/idempotency, vòng đời link token, tách router/page và format JSX; chưa triển khai màn hình M3 mới.
- File chính: `shared/api/client.ts` + test; `features/auth/hooks/useLinkToken.ts` + test; `AuthPage.tsx`/`VerifyPage.tsx` + test để reset trạng thái của link cũ; `app/App.tsx`, mới `app/router/PrivateRoute.tsx`, `app/pages/NotFoundPage.tsx`, `features/catalog/pages/CatalogIntroPage.tsx`, `features/information/pages/PolicyPage.tsx`, `features/information/content/policies.ts`; format `layouts/StoreLayout.tsx`, `main.tsx`. Đường dẫn này tính từ `apps/frontend/src/`.
- Thực hiện test trước sửa, rồi kiểm tra typecheck/build/unit/E2E auth, review độc lập và cập nhật lộ trình M3 chia nhỏ. Chỉ lập kế hoạch M3 tiếp theo, dừng để người dùng thử/duyệt; không tự code tiếp M3.
- Đã quan sát 8 ca thất bại trước sửa: JSON/multipart thiếu Idempotency-Key, query bị mất khi xóa fragment, token cũ khi mở link mới/empty token, trạng thái verify/reset và kết quả in-flight của link cũ. Các ca hồi quy đã đạt sau sửa.
- Review độc lập phát hiện P2 skip-link `#main-content` xóa token. Đã viết ca hồi quy và thấy thất bại (1 fail/4 pass của hook); sửa để chỉ xử lý fragment có tham số `token`, bảo toàn anchor nội trang. Case clear token kiểm tra link explicit `#token=`; thêm thao tác keyboard skip-link vào cả verify và reset trong E2E auth. Reviewer kiểm lại bản sửa, không còn P1/P2 được phát hiện trong phạm vi này.
- Kết quả cuối: `npm run typecheck` và `npm run build` cả hai app đạt; `npm test` đạt **32 ca** (8 tools, 6 backend unit, 18 frontend unit/UI); `npm run test:e2e -- auth.spec.ts` đạt **2 ca** qua proxy/API/PostgreSQL, gồm keyboard skip-link và mobile. Backend integration 28 ca đã đạt ở M3.0.2, không chạy lại trong phần FE không sửa backend này. E2E catalog chưa đạt/chưa chạy lại vì UI M3 chưa có; không tuyên bố toàn bộ M3/CI đã đạt.
- Một lượt root test bị timeout 15s ở ca Prisma config có sẵn (status null), các lượt chạy lại nguyên trạng đạt; không sửa test hoặc tăng timeout để che lỗi. Vite còn cảnh báo bundle khoảng 535 kB trước gzip, được ghi nhận cho tối ưu sau này; build vẫn đạt.

#### File thực tế của M3.0.3

Các đường dẫn source dưới đây tính từ `apps/frontend/src/`; đối chiếu snapshot trước phần FE để không nhận các thay đổi backend/M3 đã có là của lần này.

| File | Thay đổi và mục đích |
|---|---|
| Sửa `shared/api/client.ts` | Thêm idempotencyKey, truyền FormData nguyên dạng, giữ JSON/CSRF/cookie và không tự retry mutation. |
| Sửa `shared/api/client.test.ts` | Khóa hành vi JSON/header/multipart và các lỗi mạng đã có. |
| Sửa `features/auth/hooks/useLinkToken.ts` | Nhận token mới ngay trên route đang mount, giữ query và anchor nội trang, bỏ token khỏi URL. |
| Thêm `features/auth/hooks/useLinkToken.test.tsx` | Kiểm tra link mới, empty token, query, StrictMode và skip-link. |
| Sửa `features/auth/pages/AuthPage.tsx` | Nội dung reset có key theo token, form/notice cũ không tồn tại sang link mới. |
| Thêm `features/auth/pages/AuthPage.test.tsx` | Kiểm tra reset link mới sau khi link cũ đã thành công. |
| Sửa `features/auth/pages/VerifyPage.tsx` | Nội dung verify có vòng đời theo token, tránh success/pending/result cũ chồng lên link mới. |
| Thêm `features/auth/pages/VerifyPage.test.tsx` | Kiểm tra link mới và response của yêu cầu cũ đang chạy. |
| Sửa `app/App.tsx` | Giữ khai báo route, dùng các page/guard đã tách, giữ URL hiện tại. |
| Thêm `app/App.test.tsx` | Khóa redirect anonymous/CUSTOMER và truy cập ADMIN sau refactor. |
| Thêm `app/router/PrivateRoute.tsx` | Tách kiểm tra phiên/role khỏi App; truyền user cho nội dung route. |
| Thêm `app/pages/NotFoundPage.tsx` | Chuyển trang 404 hiện có ra file riêng. |
| Thêm `features/catalog/pages/CatalogIntroPage.tsx` | Chuyển intro empty state hiện có ra khỏi router; chưa thêm catalog thật. |
| Thêm `features/information/content/policies.ts` | Chuyển nội dung thông tin/chính sách hiện có ra file dữ liệu. |
| Thêm `features/information/pages/PolicyPage.tsx` | Render trang thông tin bằng nội dung đã tách. |
| Sửa `layouts/StoreLayout.tsx` | Format JSX, giữ layout/header/footer/skip-link. |
| Sửa `main.tsx` | Format cây provider hiện có, không thêm lớp provider hoặc state mới. |

Ngoài source: sửa `apps/frontend/e2e/auth.spec.ts` để kiểm tra keyboard skip-link trên verify/reset (bổ sung theo finding review); sửa `docs/architecture.md`, `docs/plan.md`, `docs/m3-implementation-plan.md` và `progress.md` để ghi cấu trúc, kết quả và kế hoạch M3 tiếp theo. Không sửa backend/schema/migration/dependency, không cài thêm thư viện, không commit/push.

#### Data flow, key và chạy thử

- Request: feature API → request lấy CSRF trước mutation → gửi JSON hoặc multipart với key do caller cung cấp → proxy `/api` → backend hiện có. Browser tự tạo multipart boundary; client không tự lặp mutation khi mất response.
- Link: mở `#token=...` → hook giữ token trong memory và xóa riêng fragment khỏi URL → nội dung form/kết quả theo token; mở token mới làm mới nội dung. Skip-link `#main-content` giữ nguyên token và vẫn điều hướng nội trang.
- Router: App chọn route → PrivateRoute đọc current-user query → redirect hoặc render page với user; backend tiếp tục kiểm tra quyền ở API.
- Key: **multipart boundary** là thông tin browser tạo để phân tách file; **Idempotency-Key** do caller giữ để backend nhận biết một thao tác; **component key theo token** tách vòng đời form/kết quả; **PrivateRoute** chỉ kiểm soát điều hướng FE, không thay guard backend.
- Tại root, dùng hai terminal `./tools/npm.ps1 run dev:backend` và `./tools/npm.ps1 run dev:frontend`, mở `http://127.0.0.1:5173`. Thử đăng nhập/tài khoản, các trang thông tin và 404; thử verify/reset local như [M2](docs/local-trial-m2.md), bấm skip-link bằng bàn phím vẫn tiếp tục được. Mở link token khác trên cùng trang phải có form/trạng thái mới. Multipart/idempotency được kiểm tra bằng unit; UI upload/kho M3 chưa có để thử thủ công.
- Kế hoạch tiếp tục đã cập nhật ở [m3-implementation-plan.md](docs/m3-implementation-plan.md): **M3.1 chỉ xem và thêm danh mục admin**, file/API/data flow/test được nêu riêng, chưa được triển khai. Dừng để người dùng thử M3.0.3 và duyệt M3.1; nhánh vẫn `feat/catalog-inventory`.

### M3.0.2 — refactor cấu trúc backend — 27/10/2026 (agent đã kiểm tra; chờ người dùng thử)

- Người dùng duyệt gói sửa cấu trúc một lần sau rà soát toàn backend. Điều chỉnh đã chốt: giữ `UsersController` và `AdminAccessController` chung `users.controller.ts`, vẫn là hai class/guard riêng; không tạo `auth/admin-access.controller.ts`.
- Phạm vi: tách controller khỏi module Categories/Products/Uploads/Inventory; chuyển Prisma trong Categories/Users sang service; DTO theo feature + DTO/transform dùng chung; decorator Auth riêng; chuyển Inventory ra `modules/inventory` và đồng bộ import. Giữ API, validation, quyền, transaction và nghiệp vụ.
- Trình tự: (1) bổ sung kiểm tra HTTP cho category update/version/visibility/allowlist và quyền CUSTOMER, chạy baseline; (2) refactor file/import; (3) typecheck/build/unit/integration/E2E auth; (4) review độc lập, cập nhật kiến trúc + danh sách file/cách thử, dừng chờ người dùng.
- Không sửa schema/migration/dependency hoặc frontend M3 đang dang dở; không tự commit/push. Các thay đổi M3/Prisma Studio/AGENTS có sẵn được giữ nguyên, không tính là do lần refactor này.
- Kết quả: baseline 28/28 integration đạt trước refactor và 28/28 đạt sau refactor; backend typecheck/build đạt; 6/6 unit backend và 2/2 E2E auth đạt. E2E kiểm tra tài khoản thật qua proxy và mobile. Review độc lập đối chiếu snapshot 35 file source trước refactor không phát hiện P1/P2 do refactor; nhắc vị trí Inventory trong architecture đã được cập nhật.
- Typecheck toàn repo: backend đạt; frontend còn TS2353 ở `apps/frontend/src/shared/api/client.test.ts:11` vì `idempotencyKey` chưa thuộc `RequestOptions`, tồn tại từ phần M3 trước. Không khẳng định toàn repo hoặc E2E catalog đã đạt.
- Có cảnh báo deprecation `pg` trong test concurrent đã xuất hiện ở baseline; chưa đổi dependency/luồng nghiệp vụ để xử lý ngoài phạm vi cấu trúc.

#### File thực tế của M3.0.2

Đường dẫn source trong bảng tính từ `apps/backend/src/`. Đối chiếu snapshot riêng của phần này, không dựa vào toàn bộ working tree M3 chưa commit.

| Thao tác/file | Ý nghĩa |
|---|---|
| Sửa `app.module.ts` | Đăng ký Inventory ở đường dẫn mới độc lập với Auth. |
| Thêm `common/dto/request.dto.ts` | Giữ PageQuery/VersionDto dùng chung với đúng giới hạn/default cũ. |
| Thêm `common/dto/transforms.ts` | Giữ trim/NFC/lowercase dùng chung cho DTO M3. |
| Thêm `modules/auth/decorators/roles.decorator.ts` | Khai báo Roles và metadata key, không thực hiện kiểm tra quyền. |
| Thêm `modules/auth/decorators/current-user.decorator.ts` | Lấy user đã được SessionGuard xác thực. |
| Sửa `modules/auth/roles.guard.ts` | Chỉ kiểm tra role; dùng metadata key từ decorator. |
| Sửa `modules/categories/categories.module.ts` | Chỉ đăng ký controller/service/dependency. |
| Thêm `modules/categories/categories.controller.ts` | GET danh mục active công khai. |
| Thêm `modules/categories/admin-categories.controller.ts` | Nhận các API admin danh mục, giữ guard và DTO. |
| Thêm `modules/categories/categories.service.ts` | Giữ truy vấn, transaction/version và xử lý lỗi danh mục. |
| Thêm `modules/categories/dto/category.dto.ts` | Chuyển DTO danh mục khỏi Products, giữ validation. |
| Chuyển `modules/auth/inventory/inventory.module.ts` → `modules/inventory/inventory.module.ts` | Đăng ký Inventory độc lập, tách controller ra file riêng. |
| Chuyển `modules/auth/inventory/inventory.service.ts` → `modules/inventory/inventory.service.ts` | Giữ nguyên xử lý kho, khóa/idempotency/ledger; sửa import. |
| Thêm `modules/inventory/inventory.controller.ts` | Nhận API quản trị kho với guard và Idempotency-Key cũ. |
| Thêm `modules/inventory/dto/inventory.dto.ts` | Chuyển query/adjustment DTO về Inventory. |
| Sửa `modules/products/products.module.ts` | Chỉ đăng ký controller/service/dependency. |
| Thêm `modules/products/products.controller.ts` | Nhận API catalog công khai. |
| Thêm `modules/products/admin-products.controller.ts` | Nhận API quản trị sản phẩm/ảnh/trạng thái, giữ quyền. |
| Thêm `modules/products/dto/product.dto.ts` | Giữ DTO của riêng Products, dùng PageQuery/VersionDto chung. |
| Sửa `modules/products/products.service.ts` | Chỉ đổi import DTO; giữ nghiệp vụ. |
| Bỏ `modules/products/catalog.dto.ts` | DTO đã chuyển về đúng feature/common, không giữ bản trùng. |
| Sửa `modules/uploads/uploads.module.ts` | Chỉ đăng ký controller/service/dependency. |
| Thêm `modules/uploads/admin-uploads.controller.ts` | Giữ API upload/đọc ảnh admin, giới hạn và guards. |
| Thêm `modules/uploads/media.controller.ts` | Giữ API đọc ảnh đã được phép công khai. |
| Sửa `modules/users/users.controller.ts` | Giữ UsersController/AdminAccessController chung file; cập nhật hồ sơ qua service. |
| Sửa `modules/users/users.module.ts` | Đăng ký thêm UsersService. |
| Thêm `modules/users/users.service.ts` | Thực hiện cập nhật hồ sơ với select/safeUser cũ. |
| Thêm `modules/users/dto/profile.dto.ts` | Chuyển ProfileDto khỏi controller, giữ validation/Swagger. |

Ngoài source: sửa `apps/backend/test/catalog.integration.spec.ts` (3 ca hồi quy category/quyền và cleanup đúng các tài khoản test tạo); sửa `docs/architecture.md` (cấu trúc hiện tại/ngoại lệ Users); sửa `progress.md` (kế hoạch, bằng chứng và hướng dẫn bàn giao). Không có khác biệt phạm vi ngoài điều chỉnh giữ hai controller Users/AdminAccess cùng file đã được người dùng chốt.

#### Data flow và key quan trọng

Khi gọi `POST /api/v1/admin/categories`, global CSRF/rate guard và SessionGuard/RolesGuard kiểm tra request; CategoryDto chuẩn hóa/validate input, AdminCategoriesController gọi CategoriesService để ghi PostgreSQL qua Prisma rồi trả category như trước. Khi sửa tên từ trang tài khoản M2, `PATCH /me` đi qua UsersController → UsersService với user ID từ phiên, cập nhật DB và trả safeUser để UI cập nhật.

- Module: đăng ký các thành phần với Nest DI, không chứa hành động HTTP.
- Controller: nhận route/input và gọi service; guard tiếp tục bảo vệ từng class/endpoint.
- Service: chứa xử lý dữ liệu/nghiệp vụ; extraction không đổi transaction hoặc quyền.
- DTO: kiểm tra input runtime; metadata class vẫn được import bằng giá trị ở controller để validation hoạt động.
- Decorator: ghi metadata/lấy user; RolesGuard thực hiện kiểm tra dựa trên metadata đó.

#### Chạy thử và điểm dừng

1. Tại root, chạy `./tools/npm.ps1 run typecheck --workspace=@clothing/backend` và `./tools/npm.ps1 run build --workspace=@clothing/backend`: mong đợi mã kết thúc 0.
2. Với Docker/PostgreSQL đang chạy, chạy `./tools/npm.ps1 run test:integration`: mong đợi 28 ca đạt, bao gồm CRUD/version/ẩn danh mục và các quyền admin. Test dùng DB `_test`, không phải dữ liệu local của người dùng.
3. Chạy backend `./tools/npm.ps1 run dev:backend`; mở `http://127.0.0.1:3000/api/v1/health/ready` (status ok) và `/api/v1/categories` (JSON array chỉ danh mục active, có thể rỗng). Thử `/api/v1/admin/categories` trong cửa sổ ẩn danh chưa đăng nhập: mong đợi 401.
4. Mở frontend bằng lệnh M2 trong README, thử đăng nhập/sửa tên/đăng xuất như cũ; không có màn hình quản lý M3 mới trong đợt refactor này.
5. Đọc `modules/categories/categories.module.ts` → controller → service → DTO để thấy trách nhiệm đã tách; hai class Users/AdminAccess vẫn cùng file như người dùng yêu cầu.

Điểm dừng: **chờ người dùng thử/xác nhận M3.0.2**, chưa triển khai tính năng/UI M3 kế tiếp, chưa commit/push. Nhánh vẫn là `feat/catalog-inventory`.

### Review cách tổ chức frontend — 27/10/2026

- Theo yêu cầu người dùng, chỉ review frontend và ghi kết quả; không sửa source, cài dependency, chạy migration hoặc tiếp tục M3. Đối chiếu quy tắc feature/page/component/API và quản lý state trong `docs/architecture.md` với code hiện tại.
- Điểm tốt: auth chia pages/components/hooks/api; HTTP/CSRF/lỗi tập trung tại `shared/api/client.ts`; current user dùng TanStack Query; form giữ pending/error tại component; có layouts/theme riêng. Không cần thêm các tầng kiến trúc mới hoặc tách mọi component nhỏ.
- Vấn đề ưu tiên: test M3 `shared/api/client.test.ts:11` dùng `idempotencyKey` chưa có trong `RequestOptions`; API client hiện stringify mọi body nên FormData bị gửi thành `{}` và không có header Idempotency-Key. Đây là phần M3 còn dang dở, không khẳng định luồng auth hiện tại bị lỗi bởi phát hiện này.
- Điểm bảo trì: `app/App.tsx` vừa khai báo routes/kiểm tra truy cập vừa chứa CatalogIntro và nội dung chính sách; `AdminPage.tsx` khai báo endpoint HTTP ngay trong page; `AccountPage.tsx` gọi cập nhật hồ sơ qua authApi. Nên tách có giới hạn theo trách nhiệm khi được duyệt, không đánh giá file ngắn là bắt buộc phải có hook riêng. Nhiều JSX/handler gộp một dòng làm khó lần theo code.
- Kiểm tra thực tế: `./tools/npm.ps1 run typecheck --workspace=@clothing/frontend` thất bại TS2353 tại `client.test.ts:11`; `./tools/npm.ps1 run test --workspace=@clothing/frontend`: 5/6 test đạt, 1 test multipart/idempotency thất bại (body `{}` thay vì FormData, thiếu header). Không chạy build vì typecheck đã chặn, không chạy integration/E2E trong lần review.
- Data flow hiện tại của auth: AuthPage/AuthForm → auth.api.ts → shared/api/client.ts (CSRF/cookie) → backend; kết quả quay về query cache và giao diện. Không thêm key code mới. Điểm dừng: báo review, chờ yêu cầu và duyệt kế hoạch riêng trước khi sửa từng phần.

### M3.0.1 — sửa import Prisma/Inventory — 26/10/2026

- Người dùng đã duyệt phương án đồng bộ import theo thư mục hiện tại. Trạng thái: **agent đã sửa và kiểm tra; chờ người dùng chạy thử**, không tiếp tục tính năng M3.
- Nguyên nhân xác nhận bằng typecheck thất bại: Prisma chuyển từ `src/prisma` vào `src/modules/prisma`, Inventory vào `src/modules/auth/inventory`, nhưng import tương đối còn trỏ đường dẫn cũ. Import PrismaClient trong chính PrismaService sai làm mất kiểu kế thừa, kéo theo lỗi `variant`, `$transaction`, `$connect`, `$disconnect`. Client đã generate có delegate `variant`.
- Sửa import trong app/module/service/CLI, backend integration tests và frontend E2E fixtures; giữ nguyên vị trí thư mục và nghiệp vụ. Không sửa schema, generate lại client, cài dependency hoặc chạy migration trong phần này. Cập nhật vị trí module trong tài liệu kiến trúc.
- Kết quả: typecheck/build riêng backend đạt; 6/6 unit backend, 25/25 PostgreSQL integration và 2/2 E2E auth đạt. E2E gồm luồng tài khoản qua proxy và mobile. `git diff --check` đạt ở lần rà soát mã nguồn.
- Typecheck toàn repo: backend đạt, frontend vẫn thất bại ở `src/shared/api/client.test.ts:11` (TS2353: `idempotencyKey` chưa thuộc `RequestOptions`), là test M3 dang dở đã tồn tại trước bản sửa. Không sửa phần ngoài phạm vi đã duyệt; chưa chạy lại E2E catalog chưa có UI.
- Chạy thử tại root: `./tools/npm.ps1 run typecheck --workspace=@clothing/backend` cần kết thúc mã 0; sau đó `./tools/npm.ps1 run dev:backend` và kiểm tra `http://127.0.0.1:3000/api/v1/health/ready`. Nếu VS Code còn hiển thị lỗi cũ sau khi CLI đạt, dùng `TypeScript: Restart TS Server`.
- Key: import tương đối phụ thuộc vị trí file; PrismaClient là API được generate từ schema; PrismaService kế thừa client và được Nest cung cấp qua DI. Không thêm thuộc tính `variant` thủ công hay tắt kiểm tra TypeScript.
- Chưa commit/push; nhánh vẫn là `feat/catalog-inventory`. Dừng chờ người dùng xác nhận phần sửa lỗi này.

### Bổ sung danh sách file và data flow khi duyệt/bàn giao — 26/10/2026

- Theo yêu cầu người dùng, cập nhật `AGENTS.md`: kế hoạch trước mỗi phần phải có đường dẫn từng file dự kiến thay đổi, nội dung/lý do ngắn và data flow trong 1–3 câu; vẫn dừng chờ duyệt trước code.
- Mẫu bàn giao bổ sung file thực tế đã thay đổi và data flow sau triển khai. Giải thích bám thao tác, dữ liệu và tên file/hàm chính khi cần; không lặp định nghĩa module/service/controller đã biết. Giữ phần giải thích 3–5 key và điểm dừng chạy thử.
- Chỉ sửa `AGENTS.md` và ghi tiến độ tại đây; giữ nguyên các thay đổi ứng dụng đang có. Không có key code mới, không triển khai M3 hoặc chạy migration.
- Kiểm tra: đọc diff và `git diff --check -- AGENTS.md progress.md`; không chạy ứng dụng vì chỉ đổi tài liệu. Điểm dừng: bàn giao cập nhật quy tắc; chưa bắt đầu phần code tiếp theo.

### Tiện ích Prisma Studio — tự nạp cấu hình local — 26/10/2026

- Người dùng đã duyệt kế hoạch sửa cấu hình để chạy `npx prisma studio` trong `apps/backend`. Chỉ sửa `prisma.config.ts`, thêm test hồi quy và hướng dẫn README; giữ nguyên các thay đổi M3 đang có, không cài dependency, không chạy migration, không sửa `.env`.
- Dùng `node:process.loadEnvFile` đọc `.env` cạnh file cấu hình khi `DATABASE_URL` chưa được cung cấp và `NODE_ENV` không phải `test`. Giữ ưu tiên cấu hình môi trường/test/CI; vẫn cho phép generate offline khi không có `.env`.
- Test hồi quy: ca tự nạp `.env` thất bại trước sửa (3/4 ca còn lại đạt); sau sửa và bổ sung ca biến môi trường, 5/5 ca Prisma đạt. Chạy Node local `--test tools/*.test.mjs`: 8/8 đạt, gồm 3 ca bảo vệ môi trường E2E có sẵn; đây không phải chạy E2E trên trình duyệt.
- Prisma CLI `validate` chạy không có `--env-file` nạp được cấu hình và schema hợp lệ. Typecheck riêng `prisma.config.ts` đạt. `./tools/npm.ps1 run typecheck` và `./tools/npm.ps1 run build`: backend đạt; toàn repo thất bại ở test frontend M3 có sẵn `src/shared/api/client.test.ts:11` (TS2353: `idempotencyKey` chưa thuộc `RequestOptions`). Không sửa phần ngoài phạm vi đã duyệt.
- Kiểm tra kết nối PostgreSQL chỉ đọc (`SELECT 1`) bị môi trường thực thi chặn với `EACCES`; chưa xác minh giao diện Studio đọc bảng thực tế. Không chạy integration/E2E database trong lần sửa cấu hình này. Điểm dừng: chờ người dùng mở Studio và xác nhận danh sách bảng, chưa tiếp tục M3 hoặc commit/push.


### M3 đang thực hiện — 26/10/2026

- Theo yêu cầu tiếp tục M3, đã tạo nhánh `feat/catalog-inventory` từ `main`. Chưa commit/push các thay đổi M3.
- Kế hoạch chi tiết: [m3-implementation-plan.md](docs/m3-implementation-plan.md). Giữ local; ảnh lưu ngoài Git, chưa tích hợp Cloudinary.
- Đã viết test trước API: chín ca catalog mới quan sát thất bại ở endpoint chưa có. Sau triển khai schema/migration và API categories/products/inventory/uploads, bộ tích hợp 25/25 đạt (16 auth cũ + 9 M3). Migration mới đã áp dụng cho local/test, không reset dữ liệu.
- Đã generate Prisma; typecheck đạt ở thời điểm kiểm tra backend mới và trước khi thêm test frontend mới. Không dùng kết quả này để khẳng định toàn bộ working tree hiện tại đạt.
- Npm audit phát hiện dependency cũ: cập nhật concurrently 9.2.5 và override multer 2.5.0 cùng major; sau `npm update multer`, audit báo 0 vulnerabilities tại lần kiểm tra. Không nâng major Nest/Prisma.
- E2E M3 mới đã chạy và thất bại đúng ở link Danh mục chưa có trên trang admin. Test multipart/idempotency mới của API client cũng đang thất bại trước implementation. Frontend M3 chưa được triển khai, chưa có bản M3 hoàn chỉnh cho người dùng thử.
- Phát hiện `AGENTS.md`/phần tiến độ vừa được cập nhật bởi luồng khác với yêu cầu gửi bảng trong chat rồi dừng chờ duyệt. Giữ nguyên chỉnh sửa đó; dừng triển khai thêm để gửi bảng phạm vi M3 cho người dùng duyệt. Chỉ tiếp tục sau phản hồi duyệt; không bắt đầu M4.

### Chia nhỏ kế hoạch và dừng sau từng phần — 26/10/2026

- Theo yêu cầu người dùng, bổ sung `AGENTS.md` và `docs/plan.md`: chia mốc thành `Mx.1`, `Mx.2`...; nếu còn lớn tiếp tục tách nhỏ. Mỗi phần có thay đổi quan sát được, phạm vi, cách thử/kết quả mong đợi và phụ thuộc.
- Gửi kế hoạch riêng của từng phần, chờ duyệt trước code; sau kiểm tra/bàn giao phải dừng để người dùng thử và phản hồi. Duyệt lộ trình không cho phép tự triển khai tất cả phần liên tiếp. Phân biệt kiểm tra kỹ thuật với người dùng xác nhận.
- Chỉ cập nhật tài liệu quy trình, không sửa code hoặc kế hoạch M3 đang có trong working tree, không chạy migration và không kết luận lại trạng thái hoàn thiện của M3. Chưa lập/duyệt danh sách phần M3 cụ thể trong lần này.
- Kiểm tra: đọc diff và chạy `git diff --check -- AGENTS.md docs/plan.md progress.md`; không chạy ứng dụng vì không thay code. Không có key code mới. Điểm dừng: bàn giao quy tắc chia nhỏ, chưa bắt đầu phần code tiếp theo.

### Làm rõ bước duyệt kế hoạch — 26/10/2026

- Theo phản hồi người dùng, sửa `AGENTS.md`: gửi bảng kế hoạch trong chat trước mỗi nhiệm vụ/phần code, dừng lượt chờ duyệt rồi mới triển khai; không coi gửi kế hoạch hoặc im lặng là được duyệt. Kế hoạch cụ thể đã được duyệt không cần hỏi lại từng bước.
- Phân biệt bảng kế hoạch trước triển khai với `docs/local-trial-m2.md` là hướng dẫn chạy thử sau bàn giao. Không triển khai chức năng trong lần cập nhật quy tắc này; không có key code mới.
- Kiểm tra Git phát hiện sẵn các thay đổi backend/schema/dependency và file mới liên quan M3, cùng `docs/m3-implementation-plan.md`; giữ nguyên toàn bộ. Chưa kiểm chứng nguồn gốc, mức độ hoàn thiện hoặc kết quả kiểm tra của các thay đổi đó; dòng trạng thái M3 phía trên chưa phản ánh đầy đủ working tree. Không dùng cập nhật này để kết luận M3 đã hoàn thành.
- Kiểm tra phần này bằng đọc nội dung và `git diff --check -- AGENTS.md progress.md`; không chạy ứng dụng vì chỉ thay tài liệu. Điểm dừng: bàn giao quy tắc, chờ duyệt kế hoạch cụ thể trước nhiệm vụ code tiếp theo.

### Bản Git đầu tiên — 26/10/2026

- Người dùng yêu cầu commit/push toàn bộ mã nguồn lên `https://github.com/tangthinh955-ops/clothing-shop.git`; repo đích chưa có nhánh/commit ở lần kiểm tra.
- Kiểm tra trước commit phát hiện `.env.test.example` trùng session secret với cấu hình test local; thay bằng placeholder để `setup:local` sinh secret riêng. Không thay `.env` thật.
- Chạy lại `npm test`: 14 test công cụ/unit/UI đạt; typecheck và build hai ứng dụng đạt. Integration/E2E không chạy lại trong bước Git này; bằng chứng lần chạy trước được ghi ở M2 bên dưới.
- Mục tiêu push: source, migration, cấu hình mẫu, CI và tài liệu. `.env` thật, mailbox, runtime local, dependency và build artifact bị loại trừ. Trạng thái M2 vẫn chờ người dùng chạy thử; chưa triển khai M3.
- Đã tạo commit đầu tiên `3b67275` gồm 83 tệp và push thành công lên nhánh `main`; remote `origin` trỏ tới repo người dùng cung cấp. Nhánh local đã theo dõi `origin/main`. Kết quả push không đồng nghĩa GitHub CI đã đạt; CI chưa được xác nhận trong bước bàn giao này.

### Yêu cầu push GitHub — 26/10/2026

- Người dùng yêu cầu push tới `https://github.com/tangthinh955-ops/clothing-shop.git`; nhánh local hiện là `feat/foundation`, chưa có commit.
- Đã kiểm tra lại status, diff stat, index và `git ls-files -ci --exclude-standard`: không có file đang được theo dõi thuộc nhóm bị ignore. Chưa thay đổi phần staged; cấu hình riêng và dữ liệu local vẫn ngoài Git.
- Bị chặn trước khi tạo commit/push: `git remote add origin` báo không thể ghi `.git/config` (Permission denied); `git ls-remote --symref ... HEAD` không kết nối được và báo `getaddrinfo() thread failed to start`. Phiên hiện tại chỉ có quyền đọc `.git`; không thay quyền, không tạo remote hoặc commit thành công.
- Tìm phương án qua Plugin Management: GitHub có sẵn để kết nối nhưng chưa được cài/kết nối trong phiên. Đã hiển thị gợi ý kết nối; chưa dùng plugin để ghi repository.
- Chưa xác minh được trạng thái repository từ xa, chưa push và chưa xác nhận CI. Cần phiên có quyền ghi Git và truy cập GitHub, hoặc kết nối GitHub phù hợp, để tiếp tục. Không thay đổi tiến độ M2/M3.

### Kiểm tra file chuẩn bị đưa lên Git — 26/10/2026

- Kiểm tra index, working tree và ignore bằng `git status --short`, `git diff --stat`, `git diff --cached --stat`, `git ls-files -ci --exclude-standard` và `git check-ignore -v --no-index`. Dùng `git -c safe.directory=<thư mục dự án> ...` cho từng lệnh do khác owner Windows; không thay cấu hình Git toàn máy.
- `.env` và `.env.test` thật, dependency, build, Prisma generated, runtime và mailbox local đã được ignore; không có file đang được theo dõi thuộc nhóm bị ignore. Giữ các `.env*.example` cần thiết, `package.json` và lockfile để cài lại dự án. `.gitignore` hiện đủ cho các file local đã kiểm tra nên giữ nguyên.
- Quét 83 file tracked/untracked không bị ignore theo mẫu private key, token provider, URL chứa mật khẩu và secret gán trực tiếp; rà soát các vị trí khớp là cấu hình demo/test hoặc placeholder. Đối chiếu secret riêng đủ dài trong env local không thấy xuất hiện trong các file này. Kiểm tra thêm 9 file trong index không phát hiện token provider, private key hoặc secret local đã đối chiếu. Đây là kiểm tra theo mẫu và đối chiếu, không bảo đảm phát hiện mọi dạng secret.
- Bổ sung hướng dẫn file đưa lên Git trong README. `git diff --check` và `git diff --cached --check` đều đạt sau cập nhật; đã đọc diff và xác nhận danh sách staged không đổi. Không chạy lại ứng dụng vì chỉ sửa tài liệu.
- Repo hiện chưa có commit và chưa cấu hình remote. Không stage, commit hoặc push trong phần việc này; giữ nguyên phần đã staged của người dùng. Điểm dừng vẫn là chờ chạy thử M2 local.


### Quy trình làm việc — 26/10/2026

- Theo yêu cầu người dùng, thêm `AGENTS.md` ở root: thông báo kế hoạch trước mỗi phần/giai đoạn, thực hiện đúng phạm vi, kiểm chứng và cập nhật tài liệu sau khi làm, giải thích key quan trọng ngắn gọn, rồi dừng để người dùng chạy thử.
- Bổ sung quy tắc frontend/backend/database, bảo mật, Git và tiêu chí hoàn thành; README dẫn tới tệp quy tắc.
- Đây là thay đổi tài liệu; không triển khai M3. Trạng thái vẫn là chờ người dùng chạy thử M2 local.

### Cập nhật 24/10/2026

- Người dùng yêu cầu triển khai theo từng giai đoạn. Mốc đang thực hiện là M2; hoàn tất kiểm tra và báo kết quả M2 trước khi chuyển sang M3.
- Các ghi nhận môi trường ở ngày 23/10 phía trên là lịch sử: PostgreSQL local đã chạy và migration auth đã áp dụng cho database local và test.
- Đã triển khai khung backend/frontend, đăng ký, xác thực email qua hộp thư local, đăng nhập/đăng xuất, quên/đặt lại mật khẩu, hồ sơ và kiểm tra quyền admin.
- Kết quả đã quan sát trong phiên thực hiện: typecheck hai ứng dụng đạt; 11 test unit/UI đạt; bộ 8 test tích hợp auth ban đầu đạt.
- Sau đó bổ sung test tích hợp và E2E. Chưa xác nhận kết quả bộ mở rộng, E2E và build toàn bộ sau các chỉnh sửa mới nhất; không coi kết quả trước đó là nghiệm thu phiên bản hiện tại.
- Còn kiểm tra mở rộng, E2E, build toàn bộ, rà soát cuối và cập nhật hướng dẫn trước khi chốt M2. Chưa xác nhận CI trên GitHub.
- M3–M7 chưa thực hiện. Chưa deploy; hiện ưu tiên local theo yêu cầu người dùng.

### Điểm dừng chạy thử M2 — 24/10/2026

- Người dùng yêu cầu: hoàn tất một giai đoạn rồi dừng để tự chạy thử. Ruling: chốt M2 local, hoãn deploy/CI trên GitHub theo quyết định local trước; không bắt đầu M3 khi chưa có phản hồi.
- Đã chạy typecheck và build cả hai ứng dụng thành công. Vite cảnh báo bundle khoảng 535 kB trước gzip; ghi nhận để tối ưu khi phát triển catalog, chưa ảnh hưởng build local.
- Bộ auth tích hợp mở rộng: 16/16 đạt trên PostgreSQL thật. Unit/UI: 11/11 đạt. E2E Chromium: 2/2 đạt qua proxy local, gồm đăng ký → xác minh → đăng nhập → refresh → reset → đăng nhập mới → logout và kiểm tra mobile/focus. Đã xem ảnh mobile.
- Review độc lập phát hiện tệp `.env.test.example` bị bỏ qua và E2E kiểm tra database quá muộn. Đã thêm ngoại lệ Git và preflight NODE_ENV/test database trước khi khởi động Playwright. Ba test tái hiện đã thất bại trước sửa, đạt sau sửa; kết quả chạy lại toàn bộ được xác nhận ở bàn giao.
- Hướng dẫn người dùng: [chạy thử M2](docs/local-trial-m2.md). Không có mật khẩu admin mặc định; thư xác minh/reset chỉ ở hộp thư local.
- Giới hạn: chưa có bằng chứng GitHub CI/deploy/Resend thật; chưa có catalog, kho, đặt hàng, đổi trả. Đây là điểm dừng chạy thử, chưa phải nghiệm thu bán hàng.
