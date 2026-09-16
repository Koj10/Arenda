#!/bin/sh
set -e
cd "$(dirname "$0")/.."
docker compose pull
docker compose up -d
docker compose ps
