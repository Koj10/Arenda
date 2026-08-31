from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.api.deps import AuthContext, require_landlord
from app.db import get_session
from app.schemas.units import (
    UnitCardOut,
    UnitCreate,
    UnitOut,
    UnitPayerUpdate,
    UnitUpdate,
)
from app.services import realestate as realestate_service

router = APIRouter(prefix="/landlord")


@router.post(
    "/objects/{object_id}/units",
    summary="Создание помещения",
    response_model=UnitOut,
    status_code=status.HTTP_201_CREATED,
)
def create_unit(
    object_id: int,
    payload: UnitCreate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return realestate_service.create_unit(session, auth.user.id, object_id, payload)


@router.get(
    "/units/{unit_id}", summary="Получение помещения", response_model=UnitCardOut
)
def get_unit(
    unit_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return realestate_service.get_unit_card(session, auth.user.id, unit_id)


@router.patch(
    "/units/{unit_id}", summary="Обновление помещения", response_model=UnitOut
)
def update_unit(
    unit_id: int,
    payload: UnitUpdate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return realestate_service.update_unit(session, auth.user.id, unit_id, payload)


@router.delete(
    "/units/{unit_id}",
    summary="Удаление помещения",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_unit(
    unit_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    realestate_service.delete_unit(session, auth.user.id, unit_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/units/{unit_id}/payer", summary="Обновление арендатора", response_model=UnitOut
)
def update_unit_payer(
    unit_id: int,
    payload: UnitPayerUpdate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return realestate_service.update_unit_payer(session, auth.user.id, unit_id, payload)
