from typing import List

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.api.deps import AuthContext, require_landlord
from app.db import get_session
from app.schemas.bills import (
    BillObjectOut,
    PayersMatrixOut,
    UtilityBillCreate,
    UtilityBillDetailOut,
    UtilityBillListItem,
)
from app.schemas.meters import MeterReadingOut, MeterReadingUpsert, ObjectMetersOut
from app.services import bills as bills_service
from app.services import meters as meters_service

router = APIRouter(prefix="/landlord")


@router.get(
    "/bills/objects", summary="Отчеты по объектам", response_model=List[BillObjectOut]
)
def bill_objects(
    q: str = "",
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return bills_service.get_bill_objects(session, auth.user.id, q)


@router.get(
    "/objects/{object_id}/payers",
    summary="Матрица платежей по объекту",
    response_model=PayersMatrixOut,
)
def object_payers_matrix(
    object_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return bills_service.get_payers_matrix(session, auth.user.id, object_id)


@router.get(
    "/objects/{object_id}/bills",
    summary="Отчеты по объекту",
    response_model=List[UtilityBillListItem],
)
def object_bills(
    object_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return bills_service.list_object_bills(session, auth.user.id, object_id)


@router.post(
    "/bills",
    summary="Создание счета",
    response_model=UtilityBillDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def create_bill(
    payload: UtilityBillCreate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return bills_service.create_utility_bill(session, auth.user.id, payload)


@router.get(
    "/objects/{object_id}/meters",
    summary="Показания счётчиков объекта",
    response_model=ObjectMetersOut,
)
def object_meters(
    object_id: int,
    period: str,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return meters_service.list_object_meters(session, auth.user.id, object_id, period)


@router.put(
    "/meters",
    summary="Сохранить показания счётчика",
    response_model=MeterReadingOut,
)
def upsert_meter(
    payload: MeterReadingUpsert,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return meters_service.upsert_landlord_meter(session, auth.user.id, payload)


@router.get(
    "/bills/{bill_id}", summary="Получение счета", response_model=UtilityBillDetailOut
)
def get_bill(
    bill_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return bills_service.get_bill_detail(session, auth.user.id, bill_id)
