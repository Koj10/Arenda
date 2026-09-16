#!/bin/sh
set -e

cd "$(dirname "$0")/.."

EMAIL="${CERTBOT_EMAIL:-admin@propcount.ru}"

echo "1) Поднимаем сайт на HTTP..."
docker compose pull
docker compose up -d
sleep 3

echo "2) Проверка что сайт отвечает на :80 ..."
curl -sI http://127.0.0.1/ | head -5

echo "3) Выпускаем сертификат Let's Encrypt..."
docker compose run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d propcount.ru \
  -d www.propcount.ru \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive

echo "4) Перезапуск web с HTTPS..."
docker compose up -d --force-recreate web

echo ""
echo "Готово → https://propcount.ru"
