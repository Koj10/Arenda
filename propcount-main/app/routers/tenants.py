from typing import List

from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.api.deps import AuthContext, require_landlord
from app.db import get_session
from app.schemas.tenants import (
    TenantCreate,
    TenantDetailOut,
    TenantOut,
    TenantSuggestItem,
    TenantUpdate,
)
from app.services import tenants as tenants_service

router = APIRouter(prefix="/landlord")


@router.get(
    "/tenants/suggest",
    summary="Список подсказок",
    response_model=List[TenantSuggestItem],
)
def suggest_tenants(
    inn: str = "",
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return tenants_service.suggest_tenants(session, auth.user.id, inn)


@router.get(
    "/tenants",
    summary="Список арендаторов",
    response_model=List[TenantOut],
)
def list_tenants(
    q: str = "",
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return tenants_service.list_tenants(session, auth.user.id, q)


@router.post(
    "/tenants",
    summary="Создание арендатора",
    response_model=TenantOut,
    status_code=status.HTTP_201_CREATED,
)
def create_tenant(
    payload: TenantCreate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return tenants_service.create_tenant(session, auth.user.id, payload)


@router.get(
    "/tenants/{tenant_id}",
    summary="Детали арендатора",
    response_model=TenantDetailOut,
)
def get_tenant(
    tenant_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return tenants_service.get_tenant_detail(session, auth.user.id, tenant_id)


@router.patch(
    "/tenants/{tenant_id}",
    summary="Обновление арендатора",
    response_model=TenantOut,
)
def update_tenant(
    tenant_id: int,
    payload: TenantUpdate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return tenants_service.update_tenant(session, auth.user.id, tenant_id, payload)


@router.delete(
    "/tenants/{tenant_id}",
    summary="Удаление арендатора",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_tenant(
    tenant_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    tenants_service.delete_tenant(session, auth.user.id, tenant_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
