#!/bin/sh
set -e

HTTP_CONF="/etc/nginx/templates/propcount.http.conf"
SSL_CONF="/etc/nginx/templates/propcount.ssl.conf"
ACTIVE="/etc/nginx/conf.d/default.conf"
CERT="/etc/letsencrypt/live/propcount.ru/fullchain.pem"

mkdir -p /var/www/certbot /etc/nginx/conf.d /tmp

cp "$HTTP_CONF" "$ACTIVE"

if [ -f "$CERT" ] && [ -f "$SSL_CONF" ]; then
  echo "[web] HTTP :80 + HTTPS :443"
  cat "$SSL_CONF" >> "$ACTIVE"
else
  echo "[web] HTTP :80 only"
fi

exec nginx -g "daemon off;"
