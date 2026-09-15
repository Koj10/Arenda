# PropCount

SaaS-прототип для арендодателей: лендинг + панель управления.

## Структура

```
landing/   — статический лендинг, вход и регистрация (HTML + Tailwind CDN)
panel/     — Vue 3 панель (дашборд после авторизации)
docker/    — конфиги nginx и entrypoint для Docker-сборки фронтенда
```

> **API** разрабатывается в отдельном проекте и доступен по адресу `https://api.propcount.ru`.

## Продакшен (Docker)

| | |
|--|--|
| Домен | **https://propcount.ru** |
| Лендинг | `/` |
| Панель | `/panel/` |
| API | `https://api.propcount.ru` (отдельный сервис) |

```bash
# Собрать и запустить локально
docker compose up -d --build
# Панель доступна на http://localhost:3005
```

## Локальная разработка

### Лендинг (порт 3000)

```bash
npm run dev:landing
```

http://localhost:3000

### Панель (порт 5173)

```bash
cd panel && npm run dev
```

http://localhost:5173

## Навигация (прод)

| Страница | URL |
|----------|-----|
| Лендинг | `/` |
| Вход | `/login.html` |
| Регистрация | `/register.html` |
| Панель | `/panel/` |

После входа/регистрации — редирект на `/panel/?autologin=…` и выбор роли.

## Стек

- **Landing:** HTML, Tailwind CSS (CDN), Feather Icons, AOS.js
- **Panel:** Vue 3, TypeScript, Vite, Tailwind v4, Pinia, Vue Router
- **Deploy:** Docker + nginx
