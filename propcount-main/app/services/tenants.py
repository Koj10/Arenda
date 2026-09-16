from datetime import date
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, update
from sqlmodel import Session, select

from app.enums import FileLinkedType
from app.models import File, Invoice, Lease, Object, Tenant, TenantProfile, Unit
from app.schemas.tenants import (
    LeaseInTenantDetail,
    TenantCreate,
    TenantDetailOut,
    TenantOut,
    TenantSuggestItem,
    TenantUpdate,
)
from app.services.limits import ensure_tenant_limit
from app.services.realestate import get_lease_status
from app.utils.inn import normalize_inn


def get_user_tenant(session: Session, user_id: int, tenant_id: int) -> Tenant:
    tenant = session.get(Tenant, tenant_id)

    if not tenant or tenant.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    return tenant


def get_active_leases_count(session: Session, tenant_id: int) -> int:
    return (
        session.exec(
            select(func.count(Lease.id)).where(
                Lease.tenant_id == tenant_id,
                Lease.end_date >= date.today(),
            )
        ).first()
        or 0
    )


def build_tenant_out(session: Session, tenant: Tenant) -> TenantOut:
    return TenantOut(
        id=tenant.id,
        name=tenant.name,
        inn=tenant.inn,
        created_at=tenant.created_at,
        active_leases_count=get_active_leases_count(session, tenant.id),
    )


def list_tenants(
    session: Session,
    user_id: int,
    q: str = "",
) -> List[TenantOut]:
    statement = select(Tenant).where(Tenant.user_id == user_id)

    if q:
        like = f"%{q}%"
        statement = statement.where(
            or_(
                Tenant.name.ilike(like),
                Tenant.inn.ilike(like),
            )
        )

    statement = statement.order_by(Tenant.name)

    tenants = session.exec(statement).all()

    return [build_tenant_out(session, tenant) for tenant in tenants]


def create_tenant(
    session: Session,
    user_id: int,
    payload: TenantCreate,
) -> TenantOut:
    ensure_tenant_limit(session, user_id)

    inn = normalize_inn(payload.inn)
    existing = session.exec(
        select(Tenant).where(
            Tenant.user_id == user_id,
            Tenant.inn == inn,
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant with this INN already exists",
        )

    tenant = Tenant(
        user_id=user_id,
        name=payload.name,
        inn=inn,
    )

    session.add(tenant)
    session.commit()
    session.refresh(tenant)

    return build_tenant_out(session, tenant)


def get_tenant_detail(
    session: Session,
    user_id: int,
    tenant_id: int,
) -> TenantDetailOut:
    tenant = get_user_tenant(session, user_id, tenant_id)

    leases = session.exec(
        select(Lease)
        .where(Lease.tenant_id == tenant.id)
        .order_by(Lease.end_date.desc())
    ).all()

    leases_out: List[LeaseInTenantDetail] = []

    for lease in leases:
        unit = session.get(Unit, lease.unit_id)
        obj = session.get(Object, unit.object_id) if unit else None

        leases_out.append(
            LeaseInTenantDetail(
                id=lease.id,
                unit_id=lease.unit_id,
                unit_number=unit.number if unit else "",
                object_address=obj.address if obj else "",
                rent_monthly=lease.rent_monthly,
                start_date=lease.start_date,
                end_date=lease.end_date,
                status=get_lease_status(lease.end_date),
                invoice_day=lease.invoice_day or 1,
            )
        )

    tenant_out = build_tenant_out(session, tenant)

    return TenantDetailOut(
        id=tenant_out.id,
        name=tenant_out.name,
        inn=tenant_out.inn,
        created_at=tenant_out.created_at,
        active_leases_count=tenant_out.active_leases_count,
        leases=leases_out,
    )


def update_tenant(
    session: Session,
    user_id: int,
    tenant_id: int,
    payload: TenantUpdate,
) -> TenantOut:
    tenant = get_user_tenant(session, user_id, tenant_id)

    if payload.name is not None:
        tenant.name = payload.name

    if payload.inn is not None:
        inn = normalize_inn(payload.inn)
        if inn != tenant.inn:
            existing = session.exec(
                select(Tenant).where(
                    Tenant.user_id == user_id,
                    Tenant.inn == inn,
                    Tenant.id != tenant.id,
                )
            ).first()

            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Tenant with this INN already exists",
                )

            tenant.inn = inn

    session.add(tenant)
    session.commit()
    session.refresh(tenant)

    return build_tenant_out(session, tenant)


def delete_tenant(session: Session, user_id: int, tenant_id: int) -> None:
    tenant = get_user_tenant(session, user_id, tenant_id)

    invoice_exists = session.exec(
        select(Invoice.id).where(Invoice.tenant_id == tenant.id).limit(1)
    ).first()

    if invoice_exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant has invoices and cannot be deleted",
        )

    active_lease_exists = session.exec(
        select(Lease.id)
        .where(
            Lease.tenant_id == tenant.id,
            Lease.end_date >= date.today(),
        )
        .limit(1)
    ).first()

    if active_lease_exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant has active leases and cannot be deleted",
        )

    lease_ids = session.exec(select(Lease.id).where(Lease.tenant_id == tenant.id)).all()

    if lease_ids:
        session.exec(
            update(File)
            .where(
                File.linked_type == FileLinkedType.lease.value,
                File.linked_id.in_(lease_ids),
            )
            .values(linked_type=None, linked_id=None)
        )

        session.exec(delete(Lease).where(Lease.id.in_(lease_ids)))

    session.delete(tenant)
    session.commit()


def suggest_tenants(
    session: Session,
    user_id: int,
    inn: str = "",
) -> List[TenantSuggestItem]:
    if not inn:
        return []

    like = f"%{inn}%"

    existing_tenants = session.exec(
        select(Tenant)
        .where(
            Tenant.user_id == user_id,
            Tenant.inn.ilike(like),
        )
        .order_by(Tenant.name)
        .limit(10)
    ).all()

    profiles = session.exec(
        select(TenantProfile).where(TenantProfile.inn.ilike(like)).limit(10)
    ).all()

    result: List[TenantSuggestItem] = []
    seen_inns = set()

    for tenant in existing_tenants:
        if tenant.inn in seen_inns:
            continue

        result.append(
            TenantSuggestItem(
                name=tenant.name,
                inn=tenant.inn,
                source="existing",
            )
        )
        seen_inns.add(tenant.inn)

    for profile in profiles:
        if profile.inn in seen_inns:
            continue

        result.append(
            TenantSuggestItem(
                name=profile.company_name,
                inn=profile.inn,
                source="profile",
            )
        )
        seen_inns.add(profile.inn)

    return result[:10]
