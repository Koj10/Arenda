# PropCount

SaaS-прототип для арендодателей: лендинг + панель управления.

## Структура

```
landing/   — статический лендинг, вход и регистрация (HTML + Tailwind CDN)
panel/     — Vue 3 панель (дашборд после авторизации)
```

## Запуск

### Лендинг (порт 3000)

```bash
npm run dev:landing
```

Откройте http://localhost:3000

### Панель (порт 5173)

```bash
cd panel
npm run dev
```

Откройте http://localhost:5173

## Навигация

| Страница | URL |
|----------|-----|
| Лендинг | `/landing/index.html` |
| Вход (лендинг) | `/landing/login.html` |
| Регистрация (лендинг) | `/landing/register.html` |
| Панель — вход | `/login` |
| Панель — дашборд | `/` (после входа) |

После успешного входа/регистрации на лендинге — редирект в `../panel/`.

## Стек

- **Landing:** HTML, Tailwind CSS (CDN), Feather Icons, AOS.js, tsParticles
- **Panel:** Vue 3, TypeScript, Vite, Tailwind v4, Pinia, Vue Router
