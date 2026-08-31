import logging
from datetime import date, timedelta

from sqlmodel import Session, select

from app.db import engine
from app.enums import InvoiceStatus
from app.models import Invoice, Lease, Notification, Object, Tenant, Unit

logger = logging.getLogger(__name__)


def notification_exists(
    session: Session,
    user_id: int,
    title: str,
    body: str,
) -> bool:
    return (
        session.exec(
            select(Notification.id).where(
                Notification.user_id == user_id,
                Notification.title == title,
                Notification.body == body,
            )
        ).first()
        is not None
    )


def create_overdue_invoice_notifications(session: Session) -> int:
    overdue_invoices = session.exec(
        select(Invoice).where(
            Invoice.status == InvoiceStatus.pending.value,
            Invoice.due_date < date.today(),
        )
    ).all()

    created = 0

    for invoice in overdue_invoices:
        tenant = session.get(Tenant, invoice.tenant_id)

        title = "Просроченный счёт"
        body = (
            f"Счёт №{invoice.id} ({invoice.kind}) для арендатора "
            f"{tenant.name if tenant else '—'} на сумму {invoice.amount} просрочен. "
            f"Срок оплаты был {invoice.due_date.isoformat()}."
        )

        if notification_exists(session, invoice.user_id, title, body):
            continue

        session.add(
            Notification(
                user_id=invoice.user_id,
                title=title,
                body=body,
                is_read=False,
            )
        )

        created += 1

    session.commit()

    return created


def create_expiring_lease_notifications(session: Session) -> int:
    today = date.today()
    threshold = today + timedelta(days=60)

    expiring_leases = session.exec(
        select(Lease).where(
            Lease.end_date >= today,
            Lease.end_date <= threshold,
        )
    ).all()

    created = 0

    for lease in expiring_leases:
        tenant = session.get(Tenant, lease.tenant_id)
        unit = session.get(Unit, lease.unit_id)
        obj = session.get(Object, unit.object_id) if unit else None

        title = "Истекает договор аренды"
        body = (
            f"Договор №{lease.id} истекает {lease.end_date.isoformat()}. "
            f"Арендатор: {tenant.name if tenant else '—'}. "
            f"Объект: {obj.address if obj else '—'}. "
            f"Помещение: {unit.number if unit else '—'}."
        )

        if notification_exists(session, lease.user_id, title, body):
            continue

        session.add(
            Notification(
                user_id=lease.user_id,
                title=title,
                body=body,
                is_read=False,
            )
        )

        created += 1

    session.commit()

    return created


def run_notifications_job() -> dict:
    with Session(engine) as session:
        overdue_created = create_overdue_invoice_notifications(session)
        expiring_created = create_expiring_lease_notifications(session)

        result = {
            "overdue_invoice_notifications": overdue_created,
            "expiring_lease_notifications": expiring_created,
        }

        logger.info("Notifications job result: %s", result)

        return result
