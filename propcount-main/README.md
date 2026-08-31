uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

```yml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    volumes:
      - /data/databases/falbue/test/postgres:/var/lib/postgres
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    image: ghcr.io/falbue-work/propcount:latest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - storage_data:/app/storage
    env_file:
      - .env
    ports:
      - "3006:8000"
    environment:
      - IN_DOCKER=1

volumes:
  pgdata:
  storage_data:

```
