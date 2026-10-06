#!/bin/sh
set -e

CERT="/etc/letsencrypt/live/propcount.ru/fullchain.pem"
HTTP_CONF="/etc/nginx/templates/propcount.http.conf"
HTTPS_CONF="/etc/nginx/templates/propcount.conf"
ACTIVE="/etc/nginx/conf.d/default.conf"

mkdir -p /var/www/certbot /etc/nginx/conf.d

if [ -f "$CERT" ]; then
  echo "[web] SSL cert found — HTTPS config"
  cp "$HTTPS_CONF" "$ACTIVE"
else
  echo "[web] No SSL cert — HTTP only (site works, then run issue-certs)"
  cp "$HTTP_CONF" "$ACTIVE"
fi

exec nginx -g "daemon off;"
