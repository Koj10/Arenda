#!/bin/sh
set -e

# TLS снимает nginx на хосте (deploy/host-nginx-site.conf) и проксирует на :3005.
# В контейнере всегда HTTP на порту 80, иначе хост получает 502 на /login.
HTTP_CONF="/etc/nginx/templates/propcount.http.conf"
ACTIVE="/etc/nginx/conf.d/default.conf"

mkdir -p /var/www/certbot /etc/nginx/conf.d
echo "[web] HTTP on :80 (TLS on host → this container)"
cp "$HTTP_CONF" "$ACTIVE"

exec nginx -g "daemon off;"
