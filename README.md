# PropCount

SaaS-прототип для арендодателей: лендинг + панель управления.

## Структура

```
landing/   — статический лендинг, вход и регистрация (HTML + Tailwind CDN)
panel/     — Vue 3 панель (дашборд после авторизации)
deploy/    — nginx для Docker
```

## Продакшен

| | |
|--|--|
| Домен | https://propcount.ru |
| IP | http://77.91.100.153:3001 |
| Порт на сервере | **3001** |
| Лендинг | `/` |
| Панель | `/panel/` |

```bash
docker compose up -d --build
```

Контейнер слушает `:80` внутри, наружу проброшен **3001:80**.

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
