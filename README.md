# PropCount

SaaS-прототип для арендодателей: лендинг + панель управления.

## Структура

```
landing/   — статический лендинг, вход и регистрация (HTML + Tailwind CDN)
panel/     — Vue 3 панель (дашборд после авторизации)
deploy/    — nginx для Docker
```

## Продакшен (Docker + HTTPS)

| | |
|--|--|
| Домен | **https://propcount.ru** |
| IP | 94.228.166.142 |
| Порты | **80**, **443** |
| Лендинг | `/` |
| Панель | `/panel/` |
| API | `/api/` |

```bash
# 1) DNS: propcount.ru и www → 94.228.166.142
# 2) Открыть firewall: 80, 443
cp .env.example .env   # пароли БД
chmod +x deploy/issue-certs.sh
./deploy/issue-certs.sh
```

Сервисы: `web` · `api` · `db` · `redis` · `certbot` (профиль certs).

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
