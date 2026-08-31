#!/bin/sh
set -e

sh scripts/migrate.sh

exec "$@"
