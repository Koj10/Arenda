# PropCount API (FastAPI)

Рабочий бэкенд. Папка `../api` — старая Node-заглушка, в проде не используется.

## Локально

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp ../.env.example .env   # DATABASE_URL, JWT_SECRET
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Документация: http://127.0.0.1:8000  
Health: http://127.0.0.1:8000/health

Docker только API + Postgres:

```bash
docker compose up --build
```

## Продакшен (сервер 94.228.166.142)

Сайт уже в корневом `docker-compose.yml` (:3005). API — отдельно на **:3001**, снаружи **https://api.propcount.ru**.

1. Образ: `ghcr.io/koj10/arenda-api:latest` (собирается из этой папки в GitHub Actions).
2. В корне репозитория `.env` с `DATABASE_URL` и `JWT_SECRET`.
3. `docker compose -f docker-compose.api.yml up -d`
4. Nginx: `deploy/host-nginx-api.conf` → `api.propcount.ru` на `127.0.0.1:3001`.
5. После выката миграции применяются сами (`scripts/entrypoint.sh`).

Либо uvicorn на хосте: `deploy/propcount-api.service`.
