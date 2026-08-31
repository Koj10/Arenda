from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.enums import (
    FileLinkedType,
    InvoiceKind,
    InvoiceStatus,
    PaymentMethod,
    TransactionType,
)
from app.models import Invoice, Lease, Notification, Object, Tenant, TenantProfile, Transaction, Unit
from app.schemas.files import FileOut
from app.utils.inn import normalize_inn
from app.utils.period import parse_period


def current_period_for_date(value: date) -> str:
    return f"{value.year}-{value.month:02d}"


def due_date_for_period(period: str) -> date:
    month_start, month_end = parse_period(period)
    proposed = date(month_start.year, month_start.month, 10)
    return min(proposed, month_end)


def list_invoice_files(session: Session, invoice_id: int) -> List[FileOut]:
    from app.models import File

    files = session.exec(
        select(File).where(
            File.linked_type == FileLinkedType.invoice.value,
            File.linked_id == invoice_id,
        )
    ).all()
    return [FileOut.model_validate(item) for item in files]


def notify_user(session: Session, user_id: int, title: str, body: str) -> None:
    session.add(
        Notification(
            user_id=user_id,
            title=title,
            body=body,
            is_read=False,
        )
    )


def notify_tenant_users_by_inn(session: Session, inn: str, title: str, body: str) -> None:
    digits = normalize_inn(inn)
    if not digits:
        return
    profiles = session.exec(select(TenantProfile)).all()
    for profile in profiles:
        if normalize_inn(profile.inn) == digits:
            notify_user(session, profile.user_id, title, body)


def ensure_rent_invoice_for_lease(session: Session, lease: Lease) -> Optional[Invoice]:
    if lease.rent_monthly is None or lease.rent_monthly <= 0:
        return None

    today = date.today()
    start = lease.start_date or today
    ref = start if start > today else today
    if lease.end_date < ref:
        return None

    period = current_period_for_date(ref)
    existing = session.exec(
        select(Invoice).where(
            Invoice.user_id == lease.user_id,
            Invoice.tenant_id == lease.tenant_id,
            Invoice.unit_id == lease.unit_id,
            Invoice.kind == InvoiceKind.rent.value,
            Invoice.period == period,
        )
    ).first()
    if existing:
        return existing

    invoice = Invoice(
        user_id=lease.user_id,
        tenant_id=lease.tenant_id,
        unit_id=lease.unit_id,
        kind=InvoiceKind.rent.value,
        period=period,
        amount=lease.rent_monthly,
        due_date=due_date_for_period(period),
        status=InvoiceStatus.pending.value,
    )
    session.add(invoice)
    session.flush()

    tenant = session.get(Tenant, lease.tenant_id)
    unit = session.get(Unit, lease.unit_id)
    obj = session.get(Object, unit.object_id) if unit else None
    place = f"{obj.address if obj else 'объект'} · {unit.number if unit else 'помещение'}"
    amount = f"{invoice.amount}"
    notify_user(
        session,
        lease.user_id,
        "Выставлен счёт на аренду",
        f"Счёт №{invoice.id} на {amount} ₽ за {period}. {place}.",
    )
    if tenant:
        notify_tenant_users_by_inn(
            session,
            tenant.inn,
            "Новый счёт на аренду",
            f"Выставлен счёт №{invoice.id} на {amount} ₽ за {period}. {place}. Оплатите в разделе «Счета».",
        )
    return invoice


def _create_rent_income_transaction(session: Session, invoice: Invoice) -> Transaction:
    if invoice.income_transaction_id:
        existing = session.get(Transaction, invoice.income_transaction_id)
        if existing:
            return existing

    tenant = session.get(Tenant, invoice.tenant_id)
    unit = session.get(Unit, invoice.unit_id) if invoice.unit_id else None
    object_id = unit.object_id if unit else None
    title = (
        f"Аренда {invoice.period}"
        + (f" · {tenant.name}" if tenant else "")
        + (f" · {unit.number}" if unit else "")
    )
    tx = Transaction(
        user_id=invoice.user_id,
        type=TransactionType.income.value,
        title=title,
        amount=invoice.amount,
        category="rent",
        object_id=object_id,
        comment=f"[invoice:{invoice.id}]",
        transaction_date=date.today(),
    )
    session.add(tx)
    session.flush()
    invoice.income_transaction_id = tx.id
    return tx


def mark_invoice_paid(session: Session, invoice: Invoice, method: str) -> Invoice:
    invoice.status = InvoiceStatus.paid.value
    invoice.paid_at = datetime.now(timezone.utc)
    invoice.payment_method = method
    if not invoice.payment_submitted_at:
        invoice.payment_submitted_at = invoice.paid_at
    _create_rent_income_transaction(session, invoice)
    session.add(invoice)
    return invoice


def tenant_submit_payment(
    session: Session,
    invoice: Invoice,
    method: PaymentMethod,
    file_ids: Optional[List[int]] = None,
    payer_user_id: Optional[int] = None,
) -> Invoice:
    if invoice.status == InvoiceStatus.paid.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Счёт уже оплачен")
    if invoice.status == InvoiceStatus.awaiting_confirmation.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Оплата уже отправлена, ожидайте подтверждения арендодателя",
        )

    if method == PaymentMethod.bank and not file_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Для безналичной оплаты прикрепите чек или квитанцию",
        )

    from app.services.files import link_files_by_ids

    invoice.payment_method = method.value
    invoice.payment_submitted_at = datetime.now(timezone.utc)

    if file_ids:
        link_files_by_ids(
            session=session,
            user_id=payer_user_id,
            file_ids=file_ids,
            linked_type=FileLinkedType.invoice,
            linked_id=invoice.id,
            allow_any_owner=payer_user_id is None,
        )

    tenant = session.get(Tenant, invoice.tenant_id)
    unit = session.get(Unit, invoice.unit_id) if invoice.unit_id else None
    place = f"{unit.number}" if unit else "помещение"
    method_label = {
        PaymentMethod.cash.value: "наличными",
        PaymentMethod.bank.value: "безналом",
        PaymentMethod.in_app.value: "в приложении",
    }[method.value]

    if method == PaymentMethod.in_app:
        mark_invoice_paid(session, invoice, method.value)
        notify_user(
            session,
            invoice.user_id,
            "Аренда оплачена в приложении",
            f"Счёт №{invoice.id} на {invoice.amount} ₽ оплачен автоматически. {tenant.name if tenant else ''} · {place}.",
        )
        session.commit()
        session.refresh(invoice)
        return invoice

    invoice.status = InvoiceStatus.awaiting_confirmation.value
    session.add(invoice)
    notify_user(
        session,
        invoice.user_id,
        "Арендатор отметил оплату",
        f"Счёт №{invoice.id} на {invoice.amount} ₽ ({method_label}). "
        f"{tenant.name if tenant else ''} · {place}. "
        + ("Приложен чек. " if method == PaymentMethod.bank else "")
        + "Подтвердите оплату, чтобы зачислить в доходы.",
    )
    session.commit()
    session.refresh(invoice)
    return invoice


def landlord_confirm_payment(session: Session, invoice: Invoice) -> Invoice:
    if invoice.status == InvoiceStatus.paid.value:
        return invoice
    method = invoice.payment_method or PaymentMethod.cash.value
    mark_invoice_paid(session, invoice, method)
    tenant = session.get(Tenant, invoice.tenant_id)
    if tenant:
        notify_tenant_users_by_inn(
            session,
            tenant.inn,
            "Оплата подтверждена",
            f"Арендодатель подтвердил оплату счёта №{invoice.id} на {invoice.amount} ₽.",
        )
    session.commit()
    session.refresh(invoice)
    return invoice
