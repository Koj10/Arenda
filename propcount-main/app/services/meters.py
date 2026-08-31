import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.enums import METERED_CRITERIA
from app.models import Lease, MeterReading, Object, Unit
from app.schemas.meters import (
    MeterReadingOut,
    MeterReadingUpsert,
    ObjectMetersOut,
    TenantMeterUnitOut,
    TenantMetersOut,
)
from app.services.realestate import get_user_object, get_user_unit
from app.services.tenant_panel import get_matched_tenant_ids, get_tenant_profile


def parse_period(value: str) -> str:
    if not re.fullmatch(r"\d{4}-\d{2}", value):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="period must be in YYYY-MM format",
        )
    month = int(value.split("-")[1])
    if month < 1 or month > 12:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="period month must be between 01 and 12",
        )
    return value


def consumption_of(previous: Decimal, current: Decimal) -> Decimal:
    delta = current - previous
    return delta if delta > 0 else Decimal("0")


def build_reading_out(session: Session, row: MeterReading) -> MeterReadingOut:
    unit = session.get(Unit, row.unit_id)
    return MeterReadingOut(
        id=row.id,
        object_id=row.object_id,
        unit_id=row.unit_id,
        unit_number=unit.number if unit else "",
        criterion=row.criterion,
        period=row.period,
        previous_value=row.previous_value,
        current_value=row.current_value,
        consumption=consumption_of(row.previous_value, row.current_value),
        submitted_by_role=row.submitted_by_role,
        updated_at=row.updated_at,
    )


def list_object_meters(
    session: Session,
    user_id: int,
    object_id: int,
    period: str,
) -> ObjectMetersOut:
    period = parse_period(period)
    obj = get_user_object(session, user_id, object_id)
    rows = session.exec(
        select(MeterReading).where(
            MeterReading.object_id == obj.id,
            MeterReading.period == period,
        )
    ).all()
    return ObjectMetersOut(
        object_id=obj.id,
        period=period,
        criteria=METERED_CRITERIA,
        readings=[build_reading_out(session, row) for row in rows],
    )


def upsert_landlord_meter(
    session: Session,
    user_id: int,
    payload: MeterReadingUpsert,
) -> MeterReadingOut:
    unit = get_user_unit(session, user_id, payload.unit_id)
    return _upsert_reading(
        session,
        unit=unit,
        payload=payload,
        role="landlord",
        user_id=user_id,
    )


def _tenant_leased_unit_ids(session: Session, user_id: int) -> List[int]:
    profile = get_tenant_profile(session, user_id)
    if not profile:
        return []
    tenant_ids = get_matched_tenant_ids(session, profile)
    if not tenant_ids:
        return []
    leases = session.exec(
        select(Lease).where(Lease.tenant_id.in_(tenant_ids))
    ).all()
    return [lease.unit_id for lease in leases]


def list_tenant_meters(
    session: Session,
    user_id: int,
    period: str,
) -> TenantMetersOut:
    period = parse_period(period)
    unit_ids = _tenant_leased_unit_ids(session, user_id)
    units = session.exec(select(Unit).where(Unit.id.in_(unit_ids))).all() if unit_ids else []
    rows = (
        session.exec(
            select(MeterReading).where(
                MeterReading.unit_id.in_(unit_ids),
                MeterReading.period == period,
            )
        ).all()
        if unit_ids
        else []
    )
    unit_payload = []
    for unit in units:
        obj = session.get(Object, unit.object_id)
        unit_payload.append(
            TenantMeterUnitOut(
                unit_id=unit.id,
                unit_number=unit.number,
                object_id=unit.object_id,
                object_address=obj.address if obj else "",
            )
        )
    return TenantMetersOut(
        period=period,
        criteria=METERED_CRITERIA,
        readings=[build_reading_out(session, row) for row in rows],
        units=unit_payload,
    )


def upsert_tenant_meter(
    session: Session,
    user_id: int,
    payload: MeterReadingUpsert,
) -> MeterReadingOut:
    unit_ids = _tenant_leased_unit_ids(session, user_id)
    if payload.unit_id not in unit_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unit not found",
        )
    unit = session.get(Unit, payload.unit_id)
    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")
    return _upsert_reading(
        session,
        unit=unit,
        payload=payload,
        role="tenant",
        user_id=user_id,
    )


def _upsert_reading(
    session: Session,
    unit: Unit,
    payload: MeterReadingUpsert,
    role: str,
    user_id: int,
) -> MeterReadingOut:
    existing = session.exec(
        select(MeterReading).where(
            MeterReading.unit_id == unit.id,
            MeterReading.criterion == payload.criterion,
            MeterReading.period == payload.period,
        )
    ).first()

    now = datetime.now(timezone.utc)

    if existing:
        existing.previous_value = payload.previous_value
        existing.current_value = payload.current_value
        existing.submitted_by_role = role
        existing.submitted_by_user_id = user_id
        existing.updated_at = now
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return build_reading_out(session, existing)

    row = MeterReading(
        object_id=unit.object_id,
        unit_id=unit.id,
        criterion=payload.criterion,
        period=payload.period,
        previous_value=payload.previous_value,
        current_value=payload.current_value,
        submitted_by_role=role,
        submitted_by_user_id=user_id,
        updated_at=now,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return build_reading_out(session, row)


def get_consumption_map(
    session: Session,
    object_id: int,
    period: str,
    criterion: str,
) -> dict[int, Decimal]:
    rows = session.exec(
        select(MeterReading).where(
            MeterReading.object_id == object_id,
            MeterReading.period == period,
            MeterReading.criterion == criterion,
        )
    ).all()
    return {
        row.unit_id: consumption_of(row.previous_value, row.current_value) for row in rows
    }
