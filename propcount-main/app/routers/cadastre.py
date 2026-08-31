from typing import List

from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.api.deps import AuthContext, require_landlord
from app.db import get_session
from app.schemas.cadastre import (
    CadastralObjectDetail,
    CadastralSummaryItem,
    CadastreCreate,
    CadastreOut,
    CadastreUpdate,
)
from app.services import realestate as realestate_service

router = APIRouter(prefix="/landlord")


@router.get(
    "/cadastral",
    summary="Список кадастровых объектов",
    response_model=List[CadastralSummaryItem],
)
def cadastral_list(
    q: str = "",
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return realestate_service.get_cadastral_list(session, auth.user.id, q)


@router.get(
    "/cadastral/{object_id}",
    summary="Детализация кадастрового объекта",
    response_model=CadastralObjectDetail,
)
def cadastral_object_detail(
    object_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return realestate_service.get_cadastral_object_detail(
        session, auth.user.id, object_id
    )


@router.post(
    "/objects/{object_id}/cadastre",
    summary="Создание кадастрового объекта",
    response_model=CadastreOut,
    status_code=status.HTTP_201_CREATED,
)
def create_cadastre_entry(
    object_id: int,
    payload: CadastreCreate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return realestate_service.create_cadastre_entry(
        session, auth.user.id, object_id, payload
    )


@router.patch(
    "/cadastre/{cadastre_id}",
    summary="Обновление кадастрового объекта",
    response_model=CadastreOut,
)
def update_cadastre_entry(
    cadastre_id: int,
    payload: CadastreUpdate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return realestate_service.update_cadastre_entry(
        session, auth.user.id, cadastre_id, payload
    )


@router.delete(
    "/cadastre/{cadastre_id}",
    summary="Удаление кадастрового объекта",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_cadastre_entry(
    cadastre_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    realestate_service.delete_cadastre_entry(session, auth.user.id, cadastre_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
