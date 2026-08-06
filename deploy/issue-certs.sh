#!/bin/sh
# Выпуск / продление Let's Encrypt для propcount.ru
# Запускать на сервере из корня проекта:
#   chmod +x deploy/issue-certs.sh && ./deploy/issue-certs.sh

set -e

EMAIL="${CERTBOT_EMAIL:-admin@propcount.ru}"
DOMAIN="propcount.ru"
WWW="www.propcount.ru"

echo "==> Убедитесь: DNS A-записи $DOMAIN и $WWW → 77.91.100.153"
echo "==> Порты 80 и 443 открыты в firewall"
echo ""

# Старт стека из образов GHCR (без локальной сборки)
docker compose pull
docker compose up -d

echo "==> Выпускаем сертификат..."
docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "$DOMAIN" \
  -d "$WWW"

echo "==> Перезагружаем nginx..."
docker compose exec web nginx -s reload

echo ""
echo "Готово: https://$DOMAIN"
echo "Проверка: curl -I https://$DOMAIN"
echo ""
echo "Продление (cron раз в месяц):"
echo "  docker compose run --rm --entrypoint certbot certbot renew && docker compose exec web nginx -s reload"
