#!/bin/sh
set -e

HTTP_CONF="/etc/nginx/templates/propcount.http.conf"
ACTIVE="/etc/nginx/conf.d/default.conf"

mkdir -p /var/www/certbot /etc/nginx/conf.d
echo "[web] HTTP :80 (TLS terminates on host, proxy to :3005)"
cp "$HTTP_CONF" "$ACTIVE"

exec nginx -g "daemon off;"
