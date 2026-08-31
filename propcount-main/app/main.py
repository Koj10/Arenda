from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from scalar_fastapi import get_scalar_api_reference
from sqlalchemy import text

from app.core.config import settings
from app.db import engine
from app.routers import (
    analytics,
    auth,
    bills,
    cadastre,
    files,
    invoices,
    landlord_common,
    leases,
    me,
    notifications,
    objects,
    reports,
    tenant,
    tenants,
    transactions,
    units,
)
from app.services.scheduler import shutdown_scheduler, start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.storage_dir).mkdir(parents=True, exist_ok=True)

    start_scheduler()

    yield

    shutdown_scheduler()


app = FastAPI(
    title="PropCount",
    description="API PropCount сервиса",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
async def scalar_html():
    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        title=app.title,
    )


app.include_router(auth.router, tags=["Авторизация"])
app.include_router(me.router, tags=["Профиль"])
app.include_router(files.router, tags=["Файлы"])
app.include_router(notifications.router, tags=["Уведомления"])

app.include_router(landlord_common.router, tags=["Арендодатель"])
app.include_router(objects.router, tags=["Объекты"])
app.include_router(units.router, tags=["Помещения"])
app.include_router(cadastre.router, tags=["Кадастр"])
app.include_router(tenants.router, tags=["Арендаторы"])
app.include_router(leases.router, tags=["Аренда"])
app.include_router(transactions.router, tags=["Транзакции"])
app.include_router(bills.router, tags=["Счета"])
app.include_router(invoices.router, tags=["Выставление счетов"])
app.include_router(analytics.router, tags=["Аналитика"])
app.include_router(reports.router, tags=["Отчеты"])

app.include_router(tenant.router, tags=["Арендатор"])


@app.get("/health", summary="Проверка состояния сервиса")
def health() -> dict:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "db": "error"})
