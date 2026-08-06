# PropCount — production image (landing + Vue panel behind nginx)

# ---- build panel ----
FROM node:22-alpine AS panel-build
WORKDIR /app/panel

COPY panel/package.json panel/package-lock.json* ./
RUN npm ci

COPY panel/ ./
ENV VITE_BASE_PATH=/panel/
RUN npm run build:docker

# ---- runtime ----
FROM nginx:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY landing/ /usr/share/nginx/html/
COPY --from=panel-build /app/panel/dist/ /usr/share/nginx/html/panel/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
