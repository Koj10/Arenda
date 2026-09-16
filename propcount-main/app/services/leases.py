from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlmodel import Session, select

from app.enums import FileLinkedType
from app.models import File, Lease, Object, Tenant, Unit
from app.schemas.leases import LeaseCreate, LeaseDetailOut, LeaseUpdate
from app.services.files import link_files_by_ids
from app.services.realestate import get_lease_status, get_user_unit
from app.services.tenants import get_user_tenant


def get_user_lease(session: Session, user_id: int, lease_id: int) -> Lease:
    lease = session.get(Lease, lease_id)

    if not lease or lease.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lease not found",
        )

    return lease


def ensure_lease_dates(start_date: date | None, end_date: date) -> None:
    if start_date and end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date cannot be earlier than start_date",
        )


def ensure_unit_not_in_active_lease(
    session: Session,
    unit_id: int,
    exclude_lease_id: int | None = None,
) -> None:
    statement = select(Lease).where(
        Lease.unit_id == unit_id,
        Lease.end_date >= date.today(),
    )

    if exclude_lease_id is not None:
        statement = statement.where(Lease.id != exclude_lease_id)

    existing = session.exec(statement).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unit already has an active lease",
        )


def build_lease_detail(session: Session, lease: Lease) -> LeaseDetailOut:
    tenant = session.get(Tenant, lease.tenant_id)
    unit = session.get(Unit, lease.unit_id)
    obj = session.get(Object, unit.object_id) if unit else None

    return LeaseDetailOut(
        id=lease.id,
        user_id=lease.user_id,
        tenant_id=lease.tenant_id,
        unit_id=lease.unit_id,
        rent_monthly=lease.rent_monthly,
        start_date=lease.start_date,
        end_date=lease.end_date,
        created_at=lease.created_at,
        invoice_day=lease.invoice_day or 1,
        tenant_name=tenant.name if tenant else "",
        tenant_inn=tenant.inn if tenant else "",
        unit_number=unit.number if unit else "",
        object_address=obj.address if obj else "",
        status=get_lease_status(lease.end_date),
    )


def create_lease(
    session: Session,
    user_id: int,
    payload: LeaseCreate,
) -> LeaseDetailOut:
    tenant = get_user_tenant(session, user_id, payload.tenant_id)
    unit = get_user_unit(session, user_id, payload.unit_id)

    ensure_lease_dates(payload.start_date, payload.end_date)
    ensure_unit_not_in_active_lease(session, unit.id)

    lease = Lease(
        user_id=user_id,
        tenant_id=tenant.id,
        unit_id=unit.id,
        rent_monthly=payload.rent_monthly,
        start_date=payload.start_date,
        end_date=payload.end_date,
        invoice_day=payload.invoice_day,
    )

    session.add(lease)
    session.flush()

    from app.services.invoice_payments import ensure_rent_invoice_for_lease

    ensure_rent_invoice_for_lease(session, lease)

    session.commit()
    session.refresh(lease)

    if payload.file_ids:
        link_files_by_ids(
            session=session,
            user_id=user_id,
            file_ids=payload.file_ids,
            linked_type=FileLinkedType.lease,
            linked_id=lease.id,
        )

    return build_lease_detail(session, lease)


def update_lease(
    session: Session,
    user_id: int,
    lease_id: int,
    payload: LeaseUpdate,
) -> LeaseDetailOut:
    lease = get_user_lease(session, user_id, lease_id)

    new_tenant_id = lease.tenant_id
    new_unit_id = lease.unit_id
    new_start_date = lease.start_date
    new_end_date = lease.end_date

    if payload.tenant_id is not None:
        tenant = get_user_tenant(session, user_id, payload.tenant_id)
        new_tenant_id = tenant.id

    if payload.unit_id is not None:
        unit = get_user_unit(session, user_id, payload.unit_id)
        new_unit_id = unit.id

    if "start_date" in payload.model_fields_set:
        new_start_date = payload.start_date

    if "end_date" in payload.model_fields_set:
        if payload.end_date is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="end_date cannot be null",
            )

        new_end_date = payload.end_date

    ensure_lease_dates(new_start_date, new_end_date)

    if new_end_date >= date.today():
        ensure_unit_not_in_active_lease(
            session=session,
            unit_id=new_unit_id,
            exclude_lease_id=lease.id,
        )

    lease.tenant_id = new_tenant_id
    lease.unit_id = new_unit_id
    lease.start_date = new_start_date
    lease.end_date = new_end_date

    if payload.rent_monthly is not None:
        lease.rent_monthly = payload.rent_monthly

    if payload.invoice_day is not None:
        lease.invoice_day = payload.invoice_day

    session.add(lease)
    session.commit()
    session.refresh(lease)

    if payload.file_ids:
        link_files_by_ids(
            session=session,
            user_id=user_id,
            file_ids=payload.file_ids,
            linked_type=FileLinkedType.lease,
            linked_id=lease.id,
        )

    return build_lease_detail(session, lease)


def delete_lease(session: Session, user_id: int, lease_id: int) -> None:
    lease = get_user_lease(session, user_id, lease_id)

    session.exec(
        update(File)
        .where(
            File.linked_type == FileLinkedType.lease.value,
            File.linked_id == lease.id,
        )
        .values(linked_type=None, linked_id=None)
    )

    session.delete(lease)
    session.commit()


def terminate_lease(session: Session, user_id: int, lease_id: int) -> LeaseDetailOut:
    lease = get_user_lease(session, user_id, lease_id)
    today = date.today()

    if lease.end_date < today:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Договор уже завершён",
        )

    new_end = today - timedelta(days=1)
    if lease.start_date and new_end < lease.start_date:
        lease.start_date = new_end

    lease.end_date = new_end
    session.add(lease)

    from app.services.invoice_payments import (
        cancel_pending_rent_invoices_for_lease,
        notify_tenant_users_by_inn,
        notify_user,
    )

    cancel_pending_rent_invoices_for_lease(session, lease)

    tenant = session.get(Tenant, lease.tenant_id)
    unit = session.get(Unit, lease.unit_id)
    obj = session.get(Object, unit.object_id) if unit else None
    place = f"{obj.address if obj else 'объект'} · {unit.number if unit else 'помещение'}"
    notify_user(
        session,
        user_id,
        "Договор досрочно завершён",
        f"Договор с {tenant.name if tenant else 'арендатором'} по {place} завершён. Помещение свободно.",
    )
    if tenant:
        notify_tenant_users_by_inn(
            session,
            tenant.inn,
            "Договор досрочно завершён",
            f"Арендодатель завершил договор по {place}. Неоплаченный счёт за аренду снят. "
            "Если вы уже отправили оплату, она останется на подтверждении.",
        )

    session.commit()
    session.refresh(lease)
    return build_lease_detail(session, lease)
