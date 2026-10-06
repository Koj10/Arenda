#!/bin/sh
# На ЭТОМ же сервере, где крутится propcount.ru (хостовый nginx).
# Дефолт 1m режет POST /__api/files до Docker. Нужен 50m в http {}.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/00-http-body-size.conf"
DST="/etc/nginx/conf.d/zz-propcount-body-size.conf"

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите: sudo $0"
  exit 1
fi

cp "$SRC" "$DST"
echo "Wrote $DST"
nginx -t
systemctl reload nginx
echo "ok: client_max_body_size 50m"
echo "Проверьте, нет ли где-то 1m:"
grep -R --line-number client_max_body_size /etc/nginx || true
