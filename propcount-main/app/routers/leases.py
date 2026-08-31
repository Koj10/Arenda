from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.api.deps import AuthContext, require_landlord
from app.db import get_session
from app.schemas.leases import LeaseCreate, LeaseDetailOut, LeaseUpdate
from app.services import leases as leases_service

router = APIRouter(prefix="/landlord")


@router.post(
    "/leases",
    summary="Создание договора",
    response_model=LeaseDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def create_lease(
    payload: LeaseCreate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return leases_service.create_lease(session, auth.user.id, payload)


@router.patch(
    "/leases/{lease_id}",
    summary="Обновление договора",
    response_model=LeaseDetailOut,
)
def update_lease(
    lease_id: int,
    payload: LeaseUpdate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return leases_service.update_lease(session, auth.user.id, lease_id, payload)


@router.delete(
    "/leases/{lease_id}",
    summary="Удаление договора",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_lease(
    lease_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    leases_service.delete_lease(session, auth.user.id, lease_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
