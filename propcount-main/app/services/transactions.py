from datetime import date
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import or_, update
from sqlmodel import Session, select

from app.enums import (
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
    FileLinkedType,
    TransactionType,
)
from app.models import File, Object, Transaction
from app.schemas.files import FileOut
from app.schemas.transactions import (
    TransactionCreate,
    TransactionDetailOut,
    TransactionOut,
    TransactionUpdate,
)
from app.services.files import link_files_by_ids
from app.services.realestate import get_user_object


def validate_transaction_category(transaction_type: str, category: str) -> None:
    allowed_categories = (
        INCOME_CATEGORIES
        if transaction_type == TransactionType.income.value
        else EXPENSE_CATEGORIES
    )

    if category not in allowed_categories:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid category for selected transaction type",
        )


def get_user_transaction(
    session: Session,
    user_id: int,
    transaction_id: int,
) -> Transaction:
    transaction = session.get(Transaction, transaction_id)

    if not transaction or transaction.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    return transaction


def build_transaction_out(session: Session, transaction: Transaction) -> TransactionOut:
    object_address = None

    if transaction.object_id:
        obj = session.get(Object, transaction.object_id)
        object_address = obj.address if obj else None

    return TransactionOut(
        id=transaction.id,
        user_id=transaction.user_id,
        type=transaction.type,
        title=transaction.title,
        amount=transaction.amount,
        category=transaction.category,
        object_id=transaction.object_id,
        comment=transaction.comment,
        transaction_date=transaction.transaction_date,
        created_at=transaction.created_at,
        object_address=object_address,
    )


def build_transaction_detail(
    session: Session,
    transaction: Transaction,
) -> TransactionDetailOut:
    files = session.exec(
        select(File).where(
            File.user_id == transaction.user_id,
            File.linked_type == FileLinkedType.transaction.value,
            File.linked_id == transaction.id,
        )
    ).all()

    transaction_out = build_transaction_out(session, transaction)

    return TransactionDetailOut(
        id=transaction_out.id,
        user_id=transaction_out.user_id,
        type=transaction_out.type,
        title=transaction_out.title,
        amount=transaction_out.amount,
        category=transaction_out.category,
        object_id=transaction_out.object_id,
        comment=transaction_out.comment,
        transaction_date=transaction_out.transaction_date,
        created_at=transaction_out.created_at,
        object_address=transaction_out.object_address,
        files=[FileOut.model_validate(item) for item in files],
    )


def list_transactions(
    session: Session,
    user_id: int,
    q: Optional[str] = None,
    type_: Optional[TransactionType] = None,
    category: Optional[str] = None,
    object_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[TransactionOut]:
    statement = select(Transaction).where(Transaction.user_id == user_id)

    if q:
        like = f"%{q}%"
        statement = statement.where(
            or_(
                Transaction.title.ilike(like),
                Transaction.comment.ilike(like),
            )
        )

    if type_:
        statement = statement.where(Transaction.type == type_.value)

    if category:
        statement = statement.where(Transaction.category == category)

    if object_id is not None:
        statement = statement.where(Transaction.object_id == object_id)

    if date_from:
        statement = statement.where(Transaction.transaction_date >= date_from)

    if date_to:
        statement = statement.where(Transaction.transaction_date <= date_to)

    statement = statement.order_by(
        Transaction.transaction_date.desc(),
        Transaction.created_at.desc(),
    )

    transactions = session.exec(statement).all()

    return [build_transaction_out(session, item) for item in transactions]


def create_transaction(
    session: Session,
    user_id: int,
    payload: TransactionCreate,
) -> TransactionDetailOut:
    validate_transaction_category(payload.type.value, payload.category)

    if payload.object_id is not None:
        get_user_object(session, user_id, payload.object_id)

    transaction = Transaction(
        user_id=user_id,
        type=payload.type.value,
        title=payload.title,
        amount=payload.amount,
        category=payload.category,
        object_id=payload.object_id,
        comment=payload.comment,
        transaction_date=payload.transaction_date,
    )

    session.add(transaction)
    session.commit()
    session.refresh(transaction)

    if payload.file_ids:
        link_files_by_ids(
            session=session,
            user_id=user_id,
            file_ids=payload.file_ids,
            linked_type=FileLinkedType.transaction,
            linked_id=transaction.id,
        )

    return build_transaction_detail(session, transaction)


def update_transaction(
    session: Session,
    user_id: int,
    transaction_id: int,
    payload: TransactionUpdate,
) -> TransactionDetailOut:
    transaction = get_user_transaction(session, user_id, transaction_id)

    final_type = payload.type.value if payload.type else transaction.type
    final_category = (
        payload.category if payload.category is not None else transaction.category
    )

    validate_transaction_category(final_type, final_category)

    if payload.type is not None:
        transaction.type = payload.type.value

    if payload.title is not None:
        transaction.title = payload.title

    if payload.amount is not None:
        transaction.amount = payload.amount

    if payload.category is not None:
        transaction.category = payload.category

    if "object_id" in payload.model_fields_set:
        if payload.object_id is None:
            transaction.object_id = None
        else:
            get_user_object(session, user_id, payload.object_id)
            transaction.object_id = payload.object_id

    if "comment" in payload.model_fields_set:
        transaction.comment = payload.comment

    if payload.transaction_date is not None:
        transaction.transaction_date = payload.transaction_date

    session.add(transaction)
    session.commit()
    session.refresh(transaction)

    if payload.file_ids:
        link_files_by_ids(
            session=session,
            user_id=user_id,
            file_ids=payload.file_ids,
            linked_type=FileLinkedType.transaction,
            linked_id=transaction.id,
        )

    return build_transaction_detail(session, transaction)


def delete_transaction(session: Session, user_id: int, transaction_id: int) -> None:
    transaction = get_user_transaction(session, user_id, transaction_id)

    session.exec(
        update(File)
        .where(
            File.user_id == user_id,
            File.linked_type == FileLinkedType.transaction.value,
            File.linked_id == transaction.id,
        )
        .values(linked_type=None, linked_id=None)
    )

    session.delete(transaction)
    session.commit()


def get_transaction_detail(
    session: Session,
    user_id: int,
    transaction_id: int,
) -> TransactionDetailOut:
    transaction = get_user_transaction(session, user_id, transaction_id)
    return build_transaction_detail(session, transaction)
