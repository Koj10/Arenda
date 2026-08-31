from typing import List, Optional

from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.api.deps import AuthContext, require_landlord
from app.db import get_session
from app.schemas.invoices import (
    GenerateInvoicesResponse,
    InvoiceCreate,
    InvoiceDetailOut,
    InvoiceOut,
    InvoiceUpdate,
)
from app.services import invoices as invoices_service

router = APIRouter(prefix="/landlord")


@router.get(
    "/invoices",
    summary="Список счетов",
    response_model=List[InvoiceOut],
)
def list_invoices(
    status: Optional[str] = None,
    tenant_id: Optional[int] = None,
    period: Optional[str] = None,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return invoices_service.list_invoices(
        session=session,
        user_id=auth.user.id,
        status_filter=status,
        tenant_id=tenant_id,
        period=period,
    )


@router.post(
    "/invoices/generate",
    summary="Генерация счетов",
    response_model=GenerateInvoicesResponse,
    status_code=status.HTTP_200_OK,
)
def generate_invoices(
    period: str,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return invoices_service.generate_rent_invoices(session, auth.user.id, period)


@router.post(
    "/invoices",
    summary="Создание счета",
    response_model=InvoiceDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice(
    payload: InvoiceCreate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return invoices_service.create_invoice(session, auth.user.id, payload)


@router.get(
    "/invoices/{invoice_id}",
    summary="Получение счета",
    response_model=InvoiceDetailOut,
)
def get_invoice(
    invoice_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    invoice = invoices_service.get_user_invoice(session, auth.user.id, invoice_id)
    return invoices_service.build_invoice_detail(session, invoice)


@router.patch(
    "/invoices/{invoice_id}",
    summary="Обновление счета",
    response_model=InvoiceDetailOut,
)
def update_invoice(
    invoice_id: int,
    payload: InvoiceUpdate,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return invoices_service.update_invoice(session, auth.user.id, invoice_id, payload)


@router.delete(
    "/invoices/{invoice_id}",
    summary="Удаление счета",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_invoice(
    invoice_id: int,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    invoices_service.delete_invoice(session, auth.user.id, invoice_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
