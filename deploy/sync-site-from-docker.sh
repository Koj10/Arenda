#!/bin/sh
set -e
# Скопировать лендинг и панель из контейнера на диск для хостового nginx.
DEST="${DEST:-/var/www/propcount}"
sudo mkdir -p "$DEST"
CID="$(docker compose ps -q app 2>/dev/null || true)"
if [ -z "$CID" ]; then
  echo "Контейнер app не запущен. Положите файлы вручную:"
  echo "  sudo rsync -a landing/ $DEST/"
  echo "  sudo rsync -a panel/dist/ $DEST/panel/"
  exit 1
fi
sudo docker cp "$CID":/usr/share/nginx/html/. "$DEST/"
echo "Скопировано в $DEST"
ls -la "$DEST/login.html" "$DEST/register.html"
echo "Дальше: sudo cp deploy/host-nginx-site.conf /etc/nginx/sites-available/propcount.ru && sudo nginx -t && sudo systemctl reload nginx"
