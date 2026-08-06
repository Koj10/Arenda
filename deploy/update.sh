#!/bin/sh
# Обновление с GitHub (GHCR) на сервере
set -e

echo "==> Pull образов..."
docker compose pull

echo "==> Перезапуск..."
docker compose up -d

echo "==> Готово"
docker compose ps
