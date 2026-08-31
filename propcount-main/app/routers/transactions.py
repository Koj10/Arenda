from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlmodel import Session

from app.api.deps import AuthContext, require_landlord
from app.db import get_session
from app.enums import TransactionType
from app.schemas.transactions import (
    TransactionCreate,
    TransactionDetailOut,
    TransactionOut,
    TransactionUpdate,
)
from app.services import transactions as transactions_service

router = APIRouter(prefix="/landlord")


@router.get(
    "/transactions",
    summary="Список транзакций",
    response_model=List[TransactionOut],
)
def list_transactions(
    q: Optional[str] = None,
    type: Optional[TransactionType] = None,
    category: Optional[str] = None,
    object_id: Optional[int] = None,
    date_from: Optional[date] = Query(default=None, alias="from"),
    date_to: Optional[date] = Query(default=None, alias="to"),
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return transactions_service.list_transactions(
        session=session,
        user_id=auth.user.id,
        q=q,
        type_=type,
        category=category,
        object_id=object_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.post(
    "/transactions",
    summary="Создание транзакции",
    response_model=TransactionDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(
    payload: TransactionCreate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return transactions_service.create_transaction(session, auth.user.id, payload)


@router.get(
    "/transactions/{transaction_id}",
    summary="Получение транзакции",
    response_model=TransactionDetailOut,
)
def get_transaction(
    transaction_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return transactions_service.get_transaction_detail(
        session,
        auth.user.id,
        transaction_id,
    )


@router.patch(
    "/transactions/{transaction_id}",
    summary="Обновление транзакции",
    response_model=TransactionDetailOut,
)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return transactions_service.update_transaction(
        session,
        auth.user.id,
        transaction_id,
        payload,
    )


@router.delete(
    "/transactions/{transaction_id}",
    summary="Удаление транзакции",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_transaction(
    transaction_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    transactions_service.delete_transaction(session, auth.user.id, transaction_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
