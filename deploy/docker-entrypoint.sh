#!/bin/sh
set -e

# TLS снимает хостовый nginx (443 → :3005). В контейнере всегда HTTP и раздача файлов.
# Иначе при появлении сертификата внутри образа порт 80 начинает 301 на https — лендинг «падает».
HTTP_CONF="/etc/nginx/templates/propcount.http.conf"
ACTIVE="/etc/nginx/conf.d/default.conf"

mkdir -p /var/www/certbot /etc/nginx/conf.d /etc/nginx/snippets
cp "$HTTP_CONF" "$ACTIVE"

nginx -t
exec nginx -g "daemon off;"
