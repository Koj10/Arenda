#!/bin/sh
set -e

CERT_DIR="/etc/letsencrypt/live/propcount.ru"

# Пока нет Let's Encrypt — временный сертификат, чтобы nginx стартовал на 443
if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
  echo "[web] Creating temporary self-signed certificate..."
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 2 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/CN=propcount.ru" \
    2>/dev/null
  # chain для совместимости с ssl_trusted_certificate
  cp "$CERT_DIR/fullchain.pem" "$CERT_DIR/chain.pem"
fi

exec nginx -g "daemon off;"
