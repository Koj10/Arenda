from typing import List

from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.api.deps import AuthContext, require_landlord
from app.db import get_session
from app.schemas.objects import (
    ObjectCreate,
    ObjectDetailOut,
    ObjectListItem,
    ObjectUpdate,
)
from app.services import realestate as realestate_service

router = APIRouter(prefix="/landlord")


@router.get(
    "/objects",
    summary="Список объектов",
    response_model=List[ObjectListItem],
)
def list_objects(
    q: str = "",
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return realestate_service.list_objects(session, auth.user.id, q)


@router.post(
    "/objects",
    summary="Создание объекта",
    response_model=ObjectDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def create_object(
    payload: ObjectCreate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return realestate_service.create_object(session, auth.user.id, payload)


@router.get(
    "/objects/{object_id}",
    summary="Детали объекта",
    response_model=ObjectDetailOut,
)
def get_object(
    object_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return realestate_service.get_object_detail(session, auth.user.id, object_id)


@router.patch(
    "/objects/{object_id}",
    summary="Обновление объекта",
    response_model=ObjectDetailOut,
)
def update_object(
    object_id: int,
    payload: ObjectUpdate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return realestate_service.update_object(session, auth.user.id, object_id, payload)


@router.delete(
    "/objects/{object_id}",
    summary="Удаление объекта",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_object(
    object_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    realestate_service.delete_object(session, auth.user.id, object_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
