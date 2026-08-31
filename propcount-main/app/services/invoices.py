from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlmodel import Session, select

from app.enums import FileLinkedType, InvoiceKind, InvoiceStatus
from app.models import File, Invoice, Lease, Object, Tenant, Unit, UtilityBill
from app.schemas.files import FileOut
from app.schemas.invoices import (
    GenerateInvoicesResponse,
    InvoiceCreate,
    InvoiceDetailOut,
    InvoiceOut,
    InvoiceUpdate,
)
from app.services.files import link_files_by_ids
from app.services.realestate import get_user_unit
from app.services.tenants import get_user_tenant
from app.utils.period import parse_period, validate_period_format


def computed_invoice_status(invoice: Invoice) -> str:
    if (
        invoice.status == InvoiceStatus.pending.value
        and invoice.due_date < date.today()
    ):
        return "overdue"

    return invoice.status


def get_user_invoice(session: Session, user_id: int, invoice_id: int) -> Invoice:
    invoice = session.get(Invoice, invoice_id)

    if not invoice or invoice.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    return invoice


def build_invoice_out(session: Session, invoice: Invoice) -> InvoiceOut:
    tenant = session.get(Tenant, invoice.tenant_id)

    unit_number = None
    object_address = None

    if invoice.unit_id:
        unit = session.get(Unit, invoice.unit_id)

        if unit:
            unit_number = unit.number
            obj = session.get(Object, unit.object_id)

            if obj:
                object_address = obj.address
    elif invoice.source_bill_id:
        bill = session.get(UtilityBill, invoice.source_bill_id)

        if bill:
            obj = session.get(Object, bill.object_id)

            if obj:
                object_address = obj.address

    return InvoiceOut(
        id=invoice.id,
        user_id=invoice.user_id,
        tenant_id=invoice.tenant_id,
        unit_id=invoice.unit_id,
        kind=invoice.kind,
        source_bill_id=invoice.source_bill_id,
        period=invoice.period,
        amount=invoice.amount,
        due_date=invoice.due_date,
        status=invoice.status,
        paid_at=invoice.paid_at,
        created_at=invoice.created_at,
        computed_status=computed_invoice_status(invoice),
        tenant_name=tenant.name if tenant else "",
        unit_number=unit_number,
        object_address=object_address,
    )


def build_invoice_detail(session: Session, invoice: Invoice) -> InvoiceDetailOut:
    files = session.exec(
        select(File).where(
            File.user_id == invoice.user_id,
            File.linked_type == FileLinkedType.invoice.value,
            File.linked_id == invoice.id,
        )
    ).all()

    invoice_out = build_invoice_out(session, invoice)

    return InvoiceDetailOut(
        id=invoice_out.id,
        user_id=invoice_out.user_id,
        tenant_id=invoice_out.tenant_id,
        unit_id=invoice_out.unit_id,
        kind=invoice_out.kind,
        source_bill_id=invoice_out.source_bill_id,
        period=invoice_out.period,
        amount=invoice_out.amount,
        due_date=invoice_out.due_date,
        status=invoice_out.status,
        paid_at=invoice_out.paid_at,
        created_at=invoice_out.created_at,
        computed_status=invoice_out.computed_status,
        tenant_name=invoice_out.tenant_name,
        unit_number=invoice_out.unit_number,
        object_address=invoice_out.object_address,
        files=[FileOut.model_validate(item) for item in files],
    )


def list_invoices(
    session: Session,
    user_id: int,
    status_filter: Optional[str] = None,
    tenant_id: Optional[int] = None,
    period: Optional[str] = None,
) -> List[InvoiceOut]:
    statement = select(Invoice).where(Invoice.user_id == user_id)

    if tenant_id is not None:
        statement = statement.where(Invoice.tenant_id == tenant_id)

    if period:
        try:
            validate_period_format(period)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc

        statement = statement.where(Invoice.period == period)

    if status_filter:
        status_value = status_filter.lower()

        if status_value in ("all", ""):
            pass
        elif status_value == InvoiceStatus.pending.value:
            statement = statement.where(
                Invoice.status == InvoiceStatus.pending.value,
                Invoice.due_date >= date.today(),
            )
        elif status_value == InvoiceStatus.paid.value:
            statement = statement.where(Invoice.status == InvoiceStatus.paid.value)
        elif status_value == "overdue":
            statement = statement.where(
                Invoice.status == InvoiceStatus.pending.value,
                Invoice.due_date < date.today(),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid status filter",
            )

    statement = statement.order_by(
        Invoice.due_date.desc(),
        Invoice.created_at.desc(),
    )

    invoices = session.exec(statement).all()

    return [build_invoice_out(session, invoice) for invoice in invoices]


def create_invoice(
    session: Session,
    user_id: int,
    payload: InvoiceCreate,
) -> InvoiceDetailOut:
    tenant = get_user_tenant(session, user_id, payload.tenant_id)

    unit_id = None

    if payload.unit_id is not None:
        unit = get_user_unit(session, user_id, payload.unit_id)
        unit_id = unit.id

    invoice = Invoice(
        user_id=user_id,
        tenant_id=tenant.id,
        unit_id=unit_id,
        kind=payload.kind.value,
        source_bill_id=None,
        period=payload.period,
        amount=payload.amount,
        due_date=payload.due_date,
        status=InvoiceStatus.pending.value,
    )

    session.add(invoice)
    session.commit()
    session.refresh(invoice)

    if payload.file_ids:
        link_files_by_ids(
            session=session,
            user_id=user_id,
            file_ids=payload.file_ids,
            linked_type=FileLinkedType.invoice,
            linked_id=invoice.id,
        )

    return build_invoice_detail(session, invoice)


def update_invoice(
    session: Session,
    user_id: int,
    invoice_id: int,
    payload: InvoiceUpdate,
) -> InvoiceDetailOut:
    invoice = get_user_invoice(session, user_id, invoice_id)

    if payload.status is not None:
        if payload.status == InvoiceStatus.paid:
            invoice.status = InvoiceStatus.paid.value
            invoice.paid_at = datetime.now(timezone.utc)
        else:
            invoice.status = InvoiceStatus.pending.value
            invoice.paid_at = None

    if payload.amount is not None:
        invoice.amount = payload.amount

    if payload.due_date is not None:
        invoice.due_date = payload.due_date

    if payload.period is not None:
        invoice.period = payload.period

    session.add(invoice)
    session.commit()
    session.refresh(invoice)

    if payload.file_ids:
        link_files_by_ids(
            session=session,
            user_id=user_id,
            file_ids=payload.file_ids,
            linked_type=FileLinkedType.invoice,
            linked_id=invoice.id,
        )

    return build_invoice_detail(session, invoice)


def delete_invoice(session: Session, user_id: int, invoice_id: int) -> None:
    invoice = get_user_invoice(session, user_id, invoice_id)

    session.exec(
        update(File)
        .where(
            File.user_id == user_id,
            File.linked_type == FileLinkedType.invoice.value,
            File.linked_id == invoice.id,
        )
        .values(linked_type=None, linked_id=None)
    )

    session.delete(invoice)
    session.commit()


def generate_rent_invoices(
    session: Session,
    user_id: int,
    period: str,
) -> GenerateInvoicesResponse:
    month_start, month_end = parse_period(period)

    leases = session.exec(
        select(Lease).where(
            Lease.user_id == user_id,
            Lease.end_date >= month_start,
        )
    ).all()

    created: List[Invoice] = []

    for lease in leases:
        if lease.start_date and lease.start_date > month_end:
            continue

        if lease.rent_monthly <= 0:
            continue

        existing = session.exec(
            select(Invoice.id).where(
                Invoice.user_id == user_id,
                Invoice.tenant_id == lease.tenant_id,
                Invoice.unit_id == lease.unit_id,
                Invoice.kind == InvoiceKind.rent.value,
                Invoice.period == period,
            )
        ).first()

        if existing:
            continue

        invoice = Invoice(
            user_id=user_id,
            tenant_id=lease.tenant_id,
            unit_id=lease.unit_id,
            kind=InvoiceKind.rent.value,
            source_bill_id=None,
            period=period,
            amount=lease.rent_monthly,
            due_date=month_start,
            status=InvoiceStatus.pending.value,
        )

        session.add(invoice)
        created.append(invoice)

    if created:
        session.flush()

    session.commit()

    invoices_out = [build_invoice_out(session, invoice) for invoice in created]

    return GenerateInvoicesResponse(
        period=period,
        created_count=len(invoices_out),
        invoices=invoices_out,
    )
