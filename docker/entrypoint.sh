#!/bin/sh
set -e

envsubst '${SITE_DOMAIN}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf 2>/dev/null || true

exec nginx -g 'daemon off;'
