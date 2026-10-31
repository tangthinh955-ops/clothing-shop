# Deploy RMG lên VPS — M3.16.1

## Deploy qua script (từ M6.1.1)

Các lượt deploy sau lần đầu dùng script `deploy/deploy-release.sh` (nằm trong release, chạy trên VPS với root) thay cho việc gõ tay từng lệnh build/migrate/up:

```sh
bash /srv/rmg-shop/releases/<tag-mới>/deploy/deploy-release.sh /srv/rmg-shop/releases/<tag-mới>
```

Script lần lượt: khoá chống chạy song song (flock) → `compose config` → build `api`/`web`/`migrate` với tag riêng của release → `migrate` tường minh → ghi `RMG_RELEASE` mới vào `/etc/rmg-shop/backend.env` (giữ `0600 root:root`) → `up -d --wait api web` → đợi readiness `200 {"status":"ok"}` ở `127.0.0.1:4200` → kiểm tra chuỗi công khai qua HTTPS (health 200, `/shop` 200, admin không phiên 401, cookie `__Host-shop.sid` có Secure/HttpOnly/SameSite=Lax — chỉ kiểm thuộc tính, không in giá trị) → mới đổi symlink `/srv/rmg-shop/current`. Nếu bất kỳ bước nào lỗi **sau khi đã thay container**, script tự rollback: trả `RMG_RELEASE` cũ, `up -d --wait api web` từ thư mục release cũ và trả symlink; lỗi trước khi thay container thì release cũ không bị ảnh hưởng. Script không đụng volume DB, thư mục uploads, secret, nginx, certbot hay website khác; image release cũ vẫn giữ trên máy để quay lại khi cần.

Chuẩn bị trước khi gọi script vẫn theo các mục bên dưới: kiểm tra local/CI xanh, đóng gói đúng allowlist từ một Git commit, tạo thư mục release mới và giải nén vào đó. Việc đóng gói/tải lên đã tự động hoá qua GitHub Actions từ M6.1.2.

## Deploy qua GitHub Actions (từ M6.1.2)

Workflow `Deploy production` (`.github/workflows/deploy.yml`) chạy bằng nút **Run workflow** (`workflow_dispatch`), chọn ref (mặc định `main`). Thứ tự: resolve SHA → gate: **mọi** check-run CI của đúng commit phải hoàn tất và `success`, chưa thì dừng trước khi đụng VPS → đóng gói allowlist từ đúng SHA (`git archive`) → scp kèm đối chiếu SHA256 → giải nén vào release tag `ci-<ngày>-<giờ>-<sha7>` → chạy `deploy/deploy-release.sh` của release. `concurrency: production-deploy` chặn hai lượt deploy chạy chồng.

Bí mật: `DEPLOY_SSH_KEY` là private key **ed25519 riêng cho CI** (không phải key cá nhân của ai), public key nằm trong `authorized_keys` của VPS. Host key của VPS ghim công khai trong `deploy/ci-known-hosts` — VPS đổi key/host thì phải sửa file này qua PR. Xoá secret trên GitHub là thu hồi quyền deploy ngay lập tức; xoá dòng public key trên VPS cũng vậy.

## Phạm vi và bố cục

Domain `rmglabels.duckdns.org` trỏ tới VPS Ubuntu 24.04. nginx trên host kết thúc HTTPS, phục vụ thử thách ACME và chuyển `/api/` tới `127.0.0.1:4200`, đường dẫn còn lại tới `127.0.0.1:4180`. Container web phục vụ SPA và deep link; container API chạy Node 24.22.1 bằng user `node`. PostgreSQL 18.6 nằm trên mạng Docker riêng, không publish cổng.

Docker Compose project luôn là `rmg-shop`, định nghĩa trong `deploy/compose.production.yml`. Không dùng file `docker-compose.yml` ở root vì đó là cấu hình local. Không chạy lệnh Compose trong project của website khác.

| Vị trí trên VPS | Nội dung |
|---|---|
| `/srv/rmg-shop/releases/<release>/` | Snapshot source đã kiểm tra, không chứa `.env`, dữ liệu ảnh/CSV hoặc dependency từ Windows |
| `/srv/rmg-shop/current` | Symlink tới release đang chạy |
| `/etc/rmg-shop/backend.env` | Cấu hình API và tag image `RMG_RELEASE`; root sở hữu, quyền `0600` |
| `/etc/rmg-shop/db-admin-password` | Mật khẩu PostgreSQL bootstrap, quyền `0600`; Compose mount thành secret |
| `/etc/rmg-shop/db-password` | Mật khẩu role ứng dụng, quyền `0600`; khớp `DATABASE_URL` |
| `/var/lib/rmg-shop/uploads/` | Ảnh tồn tại qua restart/deploy; UID/GID `1000:1000`, quyền `0750` |
| `/var/lib/rmg-shop/acme/` | Webroot cho Certbot, không chứa dữ liệu ứng dụng |
| Volume `rmg-shop_postgres_data` | Database production; không xóa volume khi deploy/rollback |
| `/etc/nginx/sites-available/rmglabels` | Virtual host riêng cho RMG, symlink từ `sites-enabled` |

Role API `rmg_shop` là chủ database `rmg_shop_production`, có LOGIN nhưng không SUPERUSER/CREATEDB/CREATEROLE/REPLICATION. Mật khẩu app và bootstrap khác nhau, sinh ngẫu nhiên riêng; không đặt giá trị mặc định. Không tự tạo tài khoản ADMIN hoặc chạy `seed:demo` khi deploy.

## Chuẩn bị bản triển khai

1. Chạy typecheck/build/unit, integration và E2E trên local với DB `_test`. Xem lệnh trong README. Docker image được build trên Linux để native dependency của sharp/argon2 đúng nền tảng.
2. Đóng gói các file source/config cần thiết theo allowlist: root `package.json`, `package-lock.json`, `.npmrc`, `tsconfig.base.json`, `.dockerignore`; backend `package.json`, `tsconfig.json`, `prisma.config.ts`, `prisma/`, `src/`; frontend `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/`; thư mục `deploy/`. Loại `src/generated`, các `.env`, dependency, build artifact và dữ liệu local. Docker tự generate Prisma và build lại.
3. Tạo thư mục release mới, copy snapshot vào đó. Giữ release/image trước để rollback. Tag release phải riêng từng lần; không sửa source của release đã chạy.
4. Chuẩn bị `/etc/rmg-shop/backend.env` từ `deploy/production.env.example`; sinh secret trực tiếp trên VPS, không chép file env local lên. `MAIL_FROM=onboarding@resend.dev` chỉ dùng gửi thử tới email tài khoản Resend; chưa phải cấu hình gửi email cho khách. Không đưa khóa/email người nhận vào tài liệu hoặc log.

## Build và khởi động

Các lệnh sau chạy trên VPS trong thư mục release, ví dụ sau khi `cd /srv/rmg-shop/current`. Khi triển khai lần đầu, dùng đường dẫn release mới trước khi chuyển symlink.

```sh
docker compose --env-file /etc/rmg-shop/backend.env -f deploy/compose.production.yml config --quiet
docker compose --env-file /etc/rmg-shop/backend.env -f deploy/compose.production.yml build api
docker compose --env-file /etc/rmg-shop/backend.env -f deploy/compose.production.yml build web
docker compose --env-file /etc/rmg-shop/backend.env -f deploy/compose.production.yml --profile tools build migrate
docker compose --env-file /etc/rmg-shop/backend.env -f deploy/compose.production.yml up -d --wait db
```

Lần đầu, tạo role `rmg_shop` với mật khẩu đã sinh trong `db-password`, gán quyền sở hữu database cho role này thông qua socket nội bộ của container `db`. Chỉ thực hiện trên database mới của RMG; không đổi role/database ứng dụng khác. Các lần sau giữ nguyên role, secret và volume.

```sh
docker compose --env-file /etc/rmg-shop/backend.env -f deploy/compose.production.yml --profile tools run --rm migrate
docker compose --env-file /etc/rmg-shop/backend.env -f deploy/compose.production.yml up -d --wait api web
```

Migration chạy tường minh trước khi bật API. Không chạy `migrate reset`, không seed, không xóa volume. `restart: unless-stopped` giúp dịch vụ trở lại sau Docker/VPS restart; healthcheck báo lỗi nhưng không thay thế hệ thống báo động.

## HTTPS lần đầu

Kiểm tra chưa có virtual host RMG; lưu bản cấu hình nginx trước khi thay đổi. File nguồn `deploy/nginx/rmglabels.conf` có marker cho bootstrap ACME:

```sh
sed '/# HTTPS-BEGIN/,/# HTTPS-END/d' deploy/nginx/rmglabels.conf > /etc/nginx/sites-available/rmglabels
ln -s /etc/nginx/sites-available/rmglabels /etc/nginx/sites-enabled/rmglabels
nginx -t
systemctl reload nginx
certbot certonly --webroot --webroot-path /var/lib/rmg-shop/acme --domain rmglabels.duckdns.org --non-interactive --agree-tos --register-unsafely-without-email
install -m 0644 deploy/nginx/rmglabels.conf /etc/nginx/sites-available/rmglabels
nginx -t
systemctl reload nginx
```

Nếu `nginx -t` lỗi thì phục hồi file vừa thay và không reload. Không dùng `certbot --standalone` vì cổng 80 đã thuộc nginx. Kiểm tra `certbot.timer` và thêm deploy hook `nginx -t && systemctl reload nginx` để nginx nhận chứng chỉ sau gia hạn. Không công khai các cổng API/DB.

## Kiểm tra sau deploy

- `https://rmglabels.duckdns.org/shop` và tải lại deep link trả HTML, chứng chỉ đúng domain; HTTP chuyển sang HTTPS.
- `/api/v1/health/ready` trả `200 {"status":"ok"}` khi PostgreSQL sẵn sàng; Swagger `/api/docs` không mở ở production.
- GET `/api/v1/auth/csrf` qua HTTPS tạo cookie `__Host-shop.sid` với `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`. Chỉ kiểm tra các thuộc tính, không in hoặc lưu cookie/CSRF token vào log.
- API `/api/v1/admin/products` không có phiên phải trả 401; không tắt guard để sửa lỗi deploy.
- Kiểm tra Compose có ba dịch vụ healthy, không publish PostgreSQL; API và web chỉ bind loopback. Restart riêng API, đợi health và kiểm tra lại URL; không restart website khác.
- Kiểm tra persistence bằng file probe ngẫu nhiên của lần deploy trong uploads rồi restart API, xác nhận còn file và xóa đúng file probe. Không tạo/xóa sản phẩm thật để smoke test.
- Catalog có thể trống ở lần đầu vì database mới; nhập ảnh/sản phẩm local thuộc phần tiếp theo. Không dùng dữ liệu test hoặc `seed:demo` để lấp catalog production.

## Cập nhật, rollback và giới hạn

Release tiếp theo build image với tag mới, chạy migration đã review, đổi `RMG_RELEASE` trong file riêng và khởi động API/web từ release mới. Chỉ chuyển `/srv/rmg-shop/current` sau khi các dịch vụ healthy. Nếu lỗi ứng dụng và schema tương thích, chọn lại release/tag cũ và chạy `up -d --wait api web`; giữ nguyên database, ảnh và secret. Không tự rollback schema/data; migration không tương thích cần phương án riêng và backup trước khi áp dụng.

M3.16.1 chưa bao gồm nhập dữ liệu shop, backup ngoài VPS/diễn tập khôi phục (M6.2), cảnh báo downtime (M6.3), bảo vệ admin M3.17 hoặc luồng đơn hàng M4. Không kết luận sẵn sàng mở bán chỉ từ healthcheck xanh. Cấu hình Resend hiện chỉ hỗ trợ gửi thử; gửi cho khách cần domain gửi được xác minh.

## Bằng chứng deploy đầu tiên — 29/10/2026

- Release `m3-16-1-20261029-174430` đã chạy tại `https://rmglabels.duckdns.org/shop`; API readiness trả 200. Cả ba dịch vụ healthy; DB role không có quyền superuser; PostgreSQL không publish cổng. Chi tiết source SHA/image ID ở [progress.md](../progress.md).
- Kiểm tra HTTPS, proxy/cookie, guard, cache lỗi media, CSP/HSTS, desktop/mobile đạt. Restart DB và recreate API vẫn giữ hai bản ghi migration và file probe trong uploads; probe đã được dọn. Browser kiểm tra đã đóng đúng cách.
- Chứng chỉ thật hết hạn 27/01/2027, timer gia hạn active và dry-run riêng domain RMG với deploy hook đạt. Hook nằm tại `/etc/letsencrypt/renewal-hooks/deploy/rmglabels-reload-nginx.sh`.
- Database mới chưa có sản phẩm hoặc admin. Nhánh deploy M3.16 chưa gồm M3.15/PR #17 nên UI còn nhãn demo. Chưa gửi email thử, chưa cấu hình domain gửi cho khách; chưa có backup ngoài VPS/restore hoặc kết quả CI của snapshot thủ công. Dừng để người dùng thử URL.

Nguồn: [nginx reverse proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy), [Docker Compose production](https://docs.docker.com/compose/how-tos/production/), [Certbot webroot](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot), [giới hạn resend.dev](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
