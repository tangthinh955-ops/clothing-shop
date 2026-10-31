#!/usr/bin/env bash
# backup.sh — backup production database + uploads nightly (M6.2). Runs on the VPS as root.
# Lưu vào /var/backups/rmg-shop/<timestamp>/, giữ KEEP bản mới nhất; bản sao ngoài VPS do
# người dùng pull về máy theo runbook trong docs/deployment-guide.md. Không in nội dung dữ liệu.
set -Eeuo pipefail

BACKUP_ROOT="/var/backups/rmg-shop"
KEEP=7
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_ROOT/$STAMP"
ENV_FILE="/etc/rmg-shop/backend.env"
COMPOSE_FILE="/srv/rmg-shop/current/deploy/compose.production.yml"

log() { printf '[backup %s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

[[ $EUID == 0 ]] || { log "LỖI: chạy với root."; exit 1; }
[[ -r "$ENV_FILE" ]] || { log "LỖI: không đọc được $ENV_FILE."; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { log "LỖI: thiếu $COMPOSE_FILE."; exit 1; }
mkdir -p "$BACKUP_ROOT"

# Một lượt backup mỗi lần; khoá nhả ra khi script thoát.
exec 9>"$BACKUP_ROOT/.backup.lock"
flock -n 9 || { log "Bỏ qua: lượt backup trước chưa xong."; exit 0; }

mkdir -p "$DEST"
chmod 0700 "$BACKUP_ROOT" "$DEST"

log "1/3 dump database (custom format)"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U postgres -Fc rmg_shop_production > "$DEST/database.dump"
chmod 0600 "$DEST/database.dump"

log "2/3 đóng gói thư mục uploads"
tar -C /var/lib/rmg-shop -czf "$DEST/uploads.tar.gz" uploads
chmod 0600 "$DEST/uploads.tar.gz"

( cd "$DEST" && sha256sum database.dump uploads.tar.gz > SHA256SUMS && chmod 0600 SHA256SUMS )

log "3/3 retention: giữ tối đa $KEEP bản"
ls -1 "$BACKUP_ROOT" | grep -v '\.lock$' | sort | head -n -"$KEEP" | while read -r old; do
  rm -rf -- "$BACKUP_ROOT/$old"
  log "Đã xóa bản cũ: $old"
done

log "HOÀN TẤT: $DEST ($(du -sh "$DEST" | cut -f1))"
