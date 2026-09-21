# PropCount

Лендинг и панель арендодателя. Backend живёт в отдельном репозитории и доступен на **https://api.propcount.ru**.

## Структура

```
landing/   — статический лендинг, вход и регистрация
panel/     — Vue 3 панель
deploy/    — nginx для Docker (прокси /__api → api.propcount.ru)
```

## Продакшен

| | |
|--|--|
| Домен | **https://propcount.ru** |
| Панель | `/panel/` |
| API | **https://api.propcount.ru** (браузер ходит через `/__api`) |

## Локальная разработка

Запросы `/__api` Vite проксирует на `https://api.propcount.ru`. Локальный бэкенд не нужен.

### Панель (порт 5173)

```bash
npm run dev
```

http://127.0.0.1:5173

### Лендинг (порт 3000)

```bash
npm run dev:landing
```

http://127.0.0.1:3000
