#!/usr/bin/env bash
# deploy-release.sh — deploy một release đã chuẩn bị trên VPS (M6.1.1).
# Cách dùng: ./deploy-release.sh /srv/rmg-shop/releases/<tag>
# Script chỉ thay container api/web/migrate của project rmg-shop; KHÔNG đụng volume DB,
# thư mục uploads, secret, nginx, certbot hay website khác. Lỗi sau khi đã thay container
# thì tự rollback về release/tag đang chạy trước đó.
set -Eeuo pipefail

SHOP_ROOT="/srv/rmg-shop"
ENV_FILE="/etc/rmg-shop/backend.env"
PUBLIC_BASE="https://rmglabels.duckdns.org"

log() { printf '[deploy %s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() {
  log "LỖI: $*"
  if [[ "${containers_replaced:-0}" == 1 ]]; then rollback; fi
  exit 1
}

[[ $EUID == 0 ]] || die "Chạy script với root."
RELEASE_DIR="${1:?Cách dùng: deploy-release.sh /srv/rmg-shop/releases/<release-tag>}"
RELEASE_DIR="$(cd "$RELEASE_DIR" 2>/dev/null && pwd)" || die "Không thấy thư mục release."
RELEASE_TAG="$(basename "$RELEASE_DIR")"
[[ -f "$RELEASE_DIR/deploy/compose.production.yml" ]] || die "Thiếu deploy/compose.production.yml trong release."
[[ -r "$ENV_FILE" ]] || die "Không đọc được $ENV_FILE."

PREV_TAG="$(sed -n 's/^RMG_RELEASE=//p' "$ENV_FILE" | head -n1)"
PREV_RELEASE_DIR="$(readlink -f "$SHOP_ROOT/current" 2>/dev/null || true)"
[[ -n "$PREV_TAG" ]] || die "Không đọc được RMG_RELEASE đang chạy trong $ENV_FILE."
[[ -n "$PREV_RELEASE_DIR" && -d "$PREV_RELEASE_DIR" ]] || die "Không xác định được release đang chạy qua $SHOP_ROOT/current."
[[ "$RELEASE_TAG" != "$PREV_TAG" ]] || die "Tag mới trùng tag đang chạy ($PREV_TAG)."
[[ -d "$PREV_RELEASE_DIR/deploy" ]] || die "Release cũ thiếu thư mục deploy — không có đường rollback an toàn."

# Một lượt deploy mỗi lần; khoá nhả ra khi script thoát.
exec 9>"$SHOP_ROOT/.deploy.lock"
flock -n 9 || die "Đang có lượt deploy khác chạy."

compose_in() { # compose_in <thư-mục-release> <lệnh compose...>
  local dir="$1"; shift
  (cd "$dir" && docker compose --env-file "$ENV_FILE" -f deploy/compose.production.yml "$@")
}

health_ok() { # readiness của API qua cổng loopback; không in nội dung chứa secret
  curl -fsS --max-time 10 "http://127.0.0.1:4200/api/v1/health/ready" 2>/dev/null | grep -q '"status":"ok"'
}

public_ok() { # chuỗi thật qua nginx/HTTPS; chỉ in mã trạng thái, không in header cookie
  local code headers
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$PUBLIC_BASE/api/v1/health/ready")"
  [[ "$code" == "200" ]] || { log "readiness qua HTTPS trả $code"; return 1; }
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$PUBLIC_BASE/shop")"
  [[ "$code" == "200" ]] || { log "/shop qua HTTPS trả $code"; return 1; }
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$PUBLIC_BASE/api/v1/admin/products")"
  [[ "$code" == "401" ]] || { log "guard admin trả $code (mong 401)"; return 1; }
  headers="$(curl -sS -D - -o /dev/null --max-time 15 "$PUBLIC_BASE/api/v1/auth/csrf")"
  grep -i '^set-cookie: __Host-shop\.sid=' <<<"$headers" | grep -qi 'secure' \
    && grep -i '^set-cookie: __Host-shop\.sid=' <<<"$headers" | grep -qi 'httponly' \
    && grep -i '^set-cookie: __Host-shop\.sid=' <<<"$headers" | grep -qi 'samesite=lax'
}

set_release_tag() { # ghi tag vào env file nhưng giữ đúng quyền 0600 root:root
  sed -i "s/^RMG_RELEASE=.*/RMG_RELEASE=$1/" "$ENV_FILE"
  chmod 0600 "$ENV_FILE"
  chown root:root "$ENV_FILE"
}

rollback() {
  log "ROLLBACK về release $PREV_TAG"
  set_release_tag "$PREV_TAG"
  if RMG_RELEASE="$PREV_TAG" compose_in "$PREV_RELEASE_DIR" up -d --wait api web; then
    ln -sfn "$PREV_RELEASE_DIR" "$SHOP_ROOT/current"
    health_ok && log "Rollback xong: readiness xanh." || log "CẢNH BÁO: readiness chưa xanh sau rollback — kiểm tra tay."
    public_ok && log "Rollback xong: kiểm tra công khai đạt." || log "CẢNH BÁO: kiểm tra công khai chưa đạt sau rollback."
  else
    log "CẢNH BÁO NGHIÊM TRỌNG: rollback container cũng lỗi — cần can thiệp tay (release cũ: $PREV_RELEASE_DIR)."
  fi
}

on_error() {
  if [[ "${containers_replaced:-0}" == 1 ]]; then rollback; else log "Chưa thay container — release cũ vẫn đang chạy, không cần rollback."; fi
  exit 1
}
trap on_error ERR

log "Release đang chạy: $PREV_TAG ($PREV_RELEASE_DIR)"
log "Release mới:       $RELEASE_TAG"

log "Bước 1/6 — kiểm tra cấu hình compose"
RMG_RELEASE="$RELEASE_TAG" compose_in "$RELEASE_DIR" config --quiet

log "Bước 2/6 — build image api/web/migrate với tag $RELEASE_TAG"
RMG_RELEASE="$RELEASE_TAG" compose_in "$RELEASE_DIR" build api web
RMG_RELEASE="$RELEASE_TAG" compose_in "$RELEASE_DIR" --profile tools build migrate

log "Bước 3/6 — migration (tường minh trước khi bật API)"
RMG_RELEASE="$RELEASE_TAG" compose_in "$RELEASE_DIR" --profile tools run --rm migrate

log "Bước 4/6 — thay container api/web từ release mới"
set_release_tag "$RELEASE_TAG"
containers_replaced=1
RMG_RELEASE="$RELEASE_TAG" compose_in "$RELEASE_DIR" up -d --wait api web

log "Bước 5/6 — đợi và kiểm tra health local"
ok=0
for _ in $(seq 1 12); do
  if health_ok; then ok=1; break; fi
  sleep 5
done
[[ "$ok" == 1 ]] || die "Readiness chưa xanh sau khi chờ 60 giây."
log "Readiness local: 200 ok"

log "Bước 6/6 — kiểm tra công khai rồi đổi symlink"
public_ok || die "Kiểm tra công khai chưa đạt (health/shop/guard/cookie)."
ln -sfn "$RELEASE_DIR" "$SHOP_ROOT/current"

log "HOÀN TẤT: current -> $RELEASE_DIR, RMG_RELEASE=$RELEASE_TAG."
log "Release cũ $PREV_TAG còn trên đĩa để rollback thủ công: chạy lại script với thư mục release cũ."
