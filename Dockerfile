# PropCount — landing + panel (nginx) + TLS

FROM node:22-alpine AS panel-build
WORKDIR /app/panel
COPY panel/package.json panel/package-lock.json* ./
RUN npm ci
COPY panel/ ./
ENV VITE_BASE_PATH=/panel/
RUN npm run build:docker

FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

COPY deploy/propcount.conf /etc/nginx/conf.d/default.conf
COPY deploy/docker-entrypoint.sh /docker-entrypoint-custom.sh
RUN chmod +x /docker-entrypoint-custom.sh

COPY landing/ /usr/share/nginx/html/
COPY --from=panel-build /app/panel/dist/ /usr/share/nginx/html/panel/

RUN mkdir -p /var/www/certbot /etc/letsencrypt

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD pgrep -x nginx >/dev/null || exit 1

ENTRYPOINT ["/docker-entrypoint-custom.sh"]
