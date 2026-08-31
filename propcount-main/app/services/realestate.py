from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import delete, func, update
from sqlmodel import Session, select

from app.enums import UTILITY_CRITERIA, FileLinkedType, Payer
from app.models import (
    CadastreEntry,
    File,
    Invoice,
    Lease,
    Object,
    Tenant,
    Transaction,
    Unit,
    UtilityBill,
)
from app.schemas.cadastre import (
    CadastralObjectDetail,
    CadastralSummaryItem,
    CadastreCreate,
    CadastreOut,
    CadastreUpdate,
    UnitCadastreOut,
)
from app.schemas.files import FileOut
from app.schemas.objects import (
    ObjectCreate,
    ObjectDetailOut,
    ObjectListItem,
    ObjectMetrics,
    ObjectUpdate,
)
from app.schemas.units import (
    ActiveLeaseInfo,
    UnitCardOut,
    UnitCreate,
    UnitInObjectOut,
    UnitOut,
    UnitPayerUpdate,
    UnitUpdate,
)
from app.services.files import link_files_by_ids
from app.services.limits import ensure_object_limit, ensure_unit_limit


def get_lease_status(end_date: date) -> str:
    today_date = date.today()

    if end_date < today_date:
        return "просрочен"

    if end_date <= today_date + timedelta(days=60):
        return "истекает"

    return "активен"


def get_user_object(session: Session, user_id: int, object_id: int) -> Object:
    obj = session.get(Object, object_id)

    if not obj or obj.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Object not found",
        )

    return obj


def get_user_unit(session: Session, user_id: int, unit_id: int) -> Unit:
    unit = session.get(Unit, unit_id)

    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unit not found",
        )

    obj = session.get(Object, unit.object_id)

    if not obj or obj.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unit not found",
        )

    return unit


def get_user_cadastre_entry(
    session: Session,
    user_id: int,
    cadastre_id: int,
) -> CadastreEntry:
    entry = session.get(CadastreEntry, cadastre_id)

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cadastre entry not found",
        )

    obj = session.get(Object, entry.object_id)

    if not obj or obj.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cadastre entry not found",
        )

    return entry


def get_active_lease_for_unit(session: Session, unit_id: int) -> Optional[Lease]:
    statement = (
        select(Lease)
        .where(
            Lease.unit_id == unit_id,
            Lease.end_date >= date.today(),
        )
        .order_by(Lease.end_date.desc())
        .limit(1)
    )

    return session.exec(statement).first()


def object_has_active_leases(session: Session, object_id: int) -> bool:
    statement = (
        select(Lease.id)
        .join(Unit, Lease.unit_id == Unit.id)
        .where(
            Unit.object_id == object_id,
            Lease.end_date >= date.today(),
        )
        .limit(1)
    )

    return session.exec(statement).first() is not None


def get_object_metrics(
    session: Session,
    object_id: int,
    total_area: Decimal,
) -> ObjectMetrics:
    units = session.exec(select(Unit).where(Unit.object_id == object_id)).all()

    active_leases = session.exec(
        select(Lease)
        .join(Unit, Lease.unit_id == Unit.id)
        .where(
            Unit.object_id == object_id,
            Lease.end_date >= date.today(),
        )
    ).all()

    occupied_unit_ids = {lease.unit_id for lease in active_leases}

    occupied_area = sum(
        (unit.area for unit in units if unit.id in occupied_unit_ids),
        Decimal("0"),
    )

    monthly_income = sum(
        (lease.rent_monthly for lease in active_leases),
        Decimal("0"),
    )

    free_area = max(Decimal("0"), total_area - occupied_area)

    occupancy_percent = 0.0
    if total_area > 0:
        occupancy_percent = round(float((occupied_area / total_area) * 100), 2)

    return ObjectMetrics(
        occupied_area=occupied_area,
        free_area=free_area,
        occupancy_percent=occupancy_percent,
        monthly_income=monthly_income,
    )


def build_object_list_item(session: Session, obj: Object) -> ObjectListItem:
    metrics = get_object_metrics(session, obj.id, obj.total_area)

    return ObjectListItem(
        id=obj.id,
        address=obj.address,
        type=obj.type,
        total_area=obj.total_area,
        created_at=obj.created_at,
        occupied_area=metrics.occupied_area,
        free_area=metrics.free_area,
        occupancy_percent=metrics.occupancy_percent,
        monthly_income=metrics.monthly_income,
    )


def list_objects(
    session: Session,
    user_id: int,
    q: str = "",
) -> List[ObjectListItem]:
    statement = select(Object).where(Object.user_id == user_id)

    if q:
        statement = statement.where(Object.address.ilike(f"%{q}%"))

    statement = statement.order_by(Object.created_at.desc())

    objects = session.exec(statement).all()

    return [build_object_list_item(session, obj) for obj in objects]


def create_object(
    session: Session,
    user_id: int,
    payload: ObjectCreate,
) -> ObjectDetailOut:
    ensure_object_limit(session, user_id)

    obj = Object(
        user_id=user_id,
        address=payload.address,
        type=payload.type.value,
        total_area=payload.total_area,
    )

    session.add(obj)
    session.commit()
    session.refresh(obj)

    if payload.cadastre_number and payload.cadastral_value is not None:
        cadastre_entry = CadastreEntry(
            object_id=obj.id,
            number=payload.cadastre_number,
            cadastral_value=payload.cadastral_value,
            purchase_price=payload.purchase_price,
        )

        session.add(cadastre_entry)
        session.commit()

    if payload.file_ids:
        link_files_by_ids(
            session=session,
            user_id=user_id,
            file_ids=payload.file_ids,
            linked_type=FileLinkedType.object,
            linked_id=obj.id,
        )

    return get_object_detail(session, user_id, obj.id)


def get_object_detail(
    session: Session,
    user_id: int,
    object_id: int,
) -> ObjectDetailOut:
    obj = get_user_object(session, user_id, object_id)

    units = session.exec(
        select(Unit).where(Unit.object_id == obj.id).order_by(Unit.created_at.desc())
    ).all()

    active_leases = session.exec(
        select(Lease)
        .join(Unit, Lease.unit_id == Unit.id)
        .where(
            Unit.object_id == obj.id,
            Lease.end_date >= date.today(),
        )
    ).all()

    active_leases_by_unit: Dict[int, Lease] = {}

    for lease in active_leases:
        existing = active_leases_by_unit.get(lease.unit_id)

        if not existing or lease.end_date > existing.end_date:
            active_leases_by_unit[lease.unit_id] = lease

    units_out: List[UnitInObjectOut] = []

    for unit in units:
        lease = active_leases_by_unit.get(unit.id)

        tenant_name = None

        if lease:
            tenant = session.get(Tenant, lease.tenant_id)
            tenant_name = tenant.name if tenant else None

        units_out.append(
            UnitInObjectOut(
                id=unit.id,
                object_id=unit.object_id,
                number=unit.number,
                area=unit.area,
                rent_rate=unit.rent_rate,
                cadastre_id=unit.cadastre_id,
                utility_payers=unit.utility_payers,
                created_at=unit.created_at,
                is_occupied=lease is not None,
                active_tenant_name=tenant_name,
                active_lease_end_date=lease.end_date if lease else None,
                active_rent_monthly=lease.rent_monthly if lease else None,
            )
        )

    cadastre_entries = session.exec(
        select(CadastreEntry).where(CadastreEntry.object_id == obj.id)
    ).all()

    documents = session.exec(
        select(File).where(
            File.user_id == user_id,
            File.linked_type == FileLinkedType.object.value,
            File.linked_id == obj.id,
        )
    ).all()

    metrics = get_object_metrics(session, obj.id, obj.total_area)

    return ObjectDetailOut(
        id=obj.id,
        address=obj.address,
        type=obj.type,
        total_area=obj.total_area,
        created_at=obj.created_at,
        metrics=metrics,
        units=units_out,
        cadastre_entries=[
            CadastreOut.model_validate(item) for item in cadastre_entries
        ],
        documents=[FileOut.model_validate(item) for item in documents],
    )


def update_object(
    session: Session,
    user_id: int,
    object_id: int,
    payload: ObjectUpdate,
) -> ObjectDetailOut:
    obj = get_user_object(session, user_id, object_id)

    if payload.address is not None:
        obj.address = payload.address

    if payload.type is not None:
        obj.type = payload.type.value

    if payload.total_area is not None:
        obj.total_area = payload.total_area

    session.add(obj)
    session.commit()
    session.refresh(obj)

    return get_object_detail(session, user_id, obj.id)


def delete_object(session: Session, user_id: int, object_id: int) -> None:
    obj = get_user_object(session, user_id, object_id)

    if object_has_active_leases(session, obj.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Object has active leases",
        )

    unit_ids = session.exec(select(Unit.id).where(Unit.object_id == obj.id)).all()

    bill_ids = session.exec(
        select(UtilityBill.id).where(UtilityBill.object_id == obj.id)
    ).all()

    lease_ids = []

    if unit_ids:
        lease_ids = session.exec(
            select(Lease.id).where(Lease.unit_id.in_(unit_ids))
        ).all()

    if bill_ids:
        session.exec(
            update(Invoice)
            .where(Invoice.source_bill_id.in_(bill_ids))
            .values(source_bill_id=None)
        )

    if unit_ids:
        session.exec(
            update(Invoice).where(Invoice.unit_id.in_(unit_ids)).values(unit_id=None)
        )

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

    if unit_ids:
        session.exec(delete(Unit).where(Unit.id.in_(unit_ids)))

    if bill_ids:
        session.exec(delete(UtilityBill).where(UtilityBill.id.in_(bill_ids)))

    session.exec(
        update(Transaction)
        .where(Transaction.object_id == obj.id)
        .values(object_id=None)
    )

    session.exec(delete(CadastreEntry).where(CadastreEntry.object_id == obj.id))

    object_files = session.exec(
        select(File).where(
            File.user_id == user_id,
            File.linked_type == FileLinkedType.object.value,
            File.linked_id == obj.id,
        )
    ).all()

    for file in object_files:
        file.linked_type = None
        file.linked_id = None
        session.add(file)

    session.delete(obj)
    session.commit()


def create_unit(
    session: Session,
    user_id: int,
    object_id: int,
    payload: UnitCreate,
) -> UnitOut:
    obj = get_user_object(session, user_id, object_id)

    ensure_unit_limit(session, user_id)

    cadastre_id = payload.cadastre_id

    if cadastre_id is not None:
        cadastre_entry = session.get(CadastreEntry, cadastre_id)

        if not cadastre_entry or cadastre_entry.object_id != obj.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cadastre entry does not belong to this object",
            )

    unit = Unit(
        object_id=obj.id,
        number=payload.number,
        area=payload.area,
        rent_rate=payload.rent_rate,
        cadastre_id=cadastre_id,
    )

    session.add(unit)
    session.commit()
    session.refresh(unit)

    return UnitOut.model_validate(unit)


def get_unit_card(
    session: Session,
    user_id: int,
    unit_id: int,
) -> UnitCardOut:
    unit = get_user_unit(session, user_id, unit_id)
    obj = session.get(Object, unit.object_id)

    active_lease = get_active_lease_for_unit(session, unit.id)

    active_lease_info = None

    if active_lease:
        tenant = session.get(Tenant, active_lease.tenant_id)

        active_lease_info = ActiveLeaseInfo(
            id=active_lease.id,
            tenant_id=active_lease.tenant_id,
            tenant_name=tenant.name if tenant else "",
            tenant_inn=tenant.inn if tenant else "",
            rent_monthly=active_lease.rent_monthly,
            start_date=active_lease.start_date,
            end_date=active_lease.end_date,
            status=get_lease_status(active_lease.end_date),
        )

    return UnitCardOut(
        unit=UnitOut.model_validate(unit),
        object_address=obj.address if obj else "",
        is_occupied=active_lease is not None,
        active_lease=active_lease_info,
    )


def update_unit(
    session: Session,
    user_id: int,
    unit_id: int,
    payload: UnitUpdate,
) -> UnitOut:
    unit = get_user_unit(session, user_id, unit_id)

    if "number" in payload.model_fields_set and payload.number is not None:
        unit.number = payload.number

    if "area" in payload.model_fields_set and payload.area is not None:
        unit.area = payload.area

    if "rent_rate" in payload.model_fields_set:
        unit.rent_rate = payload.rent_rate

    if "cadastre_id" in payload.model_fields_set:
        if payload.cadastre_id is None:
            unit.cadastre_id = None
        else:
            cadastre_entry = session.get(CadastreEntry, payload.cadastre_id)

            if not cadastre_entry or cadastre_entry.object_id != unit.object_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cadastre entry does not belong to this object",
                )

            unit.cadastre_id = cadastre_entry.id

    session.add(unit)
    session.commit()
    session.refresh(unit)

    return UnitOut.model_validate(unit)


def delete_unit(session: Session, user_id: int, unit_id: int) -> None:
    unit = get_user_unit(session, user_id, unit_id)

    active_lease = get_active_lease_for_unit(session, unit.id)

    if active_lease:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unit has an active lease",
        )

    lease_ids = session.exec(select(Lease.id).where(Lease.unit_id == unit.id)).all()

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

    session.exec(update(Invoice).where(Invoice.unit_id == unit.id).values(unit_id=None))

    session.delete(unit)
    session.commit()


def update_unit_payer(
    session: Session,
    user_id: int,
    unit_id: int,
    payload: UnitPayerUpdate,
) -> UnitOut:
    unit = get_user_unit(session, user_id, unit_id)

    if payload.criterion not in UTILITY_CRITERIA:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid utility criterion",
        )

    payers = dict(unit.utility_payers or {})

    for criterion in UTILITY_CRITERIA:
        payers.setdefault(criterion, Payer.tenant.value)

    payers[payload.criterion] = payload.payer.value

    unit.utility_payers = payers

    session.add(unit)
    session.commit()
    session.refresh(unit)

    return UnitOut.model_validate(unit)


def get_cadastral_list(
    session: Session,
    user_id: int,
    q: str = "",
) -> List[CadastralSummaryItem]:
    statement = select(Object).where(Object.user_id == user_id)

    if q:
        statement = statement.where(Object.address.ilike(f"%{q}%"))

    statement = statement.order_by(Object.created_at.desc())

    objects = session.exec(statement).all()

    result: List[CadastralSummaryItem] = []

    for obj in objects:
        units_total = (
            session.exec(
                select(func.count(Unit.id)).where(Unit.object_id == obj.id)
            ).first()
            or 0
        )

        units_without_cadastre = (
            session.exec(
                select(func.count(Unit.id)).where(
                    Unit.object_id == obj.id,
                    Unit.cadastre_id.is_(None),
                )
            ).first()
            or 0
        )

        cadastre_numbers = (
            session.exec(
                select(func.count(CadastreEntry.id)).where(
                    CadastreEntry.object_id == obj.id
                )
            ).first()
            or 0
        )

        result.append(
            CadastralSummaryItem(
                object_id=obj.id,
                address=obj.address,
                units_total=units_total,
                units_without_cadastre=units_without_cadastre,
                cadastre_numbers=cadastre_numbers,
                summary=f"{units_without_cadastre} без кадастра · {cadastre_numbers} ном.",
            )
        )

    return result


def get_cadastral_object_detail(
    session: Session,
    user_id: int,
    object_id: int,
) -> CadastralObjectDetail:
    obj = get_user_object(session, user_id, object_id)

    cadastre_entries = session.exec(
        select(CadastreEntry).where(CadastreEntry.object_id == obj.id)
    ).all()

    units = session.exec(select(Unit).where(Unit.object_id == obj.id)).all()

    return CadastralObjectDetail(
        object_id=obj.id,
        address=obj.address,
        cadastre_entries=[
            CadastreOut.model_validate(item) for item in cadastre_entries
        ],
        units=[UnitCadastreOut.model_validate(item) for item in units],
    )


def create_cadastre_entry(
    session: Session,
    user_id: int,
    object_id: int,
    payload: CadastreCreate,
) -> CadastreOut:
    obj = get_user_object(session, user_id, object_id)

    existing = session.exec(
        select(CadastreEntry).where(
            CadastreEntry.object_id == obj.id,
            CadastreEntry.number == payload.number,
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cadastre number already exists for this object",
        )

    entry = CadastreEntry(
        object_id=obj.id,
        number=payload.number,
        cadastral_value=payload.cadastral_value,
        purchase_price=payload.purchase_price,
    )

    session.add(entry)
    session.commit()
    session.refresh(entry)

    return CadastreOut.model_validate(entry)


def update_cadastre_entry(
    session: Session,
    user_id: int,
    cadastre_id: int,
    payload: CadastreUpdate,
) -> CadastreOut:
    entry = get_user_cadastre_entry(session, user_id, cadastre_id)

    if payload.number is not None and payload.number != entry.number:
        existing = session.exec(
            select(CadastreEntry).where(
                CadastreEntry.object_id == entry.object_id,
                CadastreEntry.number == payload.number,
                CadastreEntry.id != entry.id,
            )
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cadastre number already exists for this object",
            )

        entry.number = payload.number

    if payload.cadastral_value is not None:
        entry.cadastral_value = payload.cadastral_value

    if "purchase_price" in payload.model_fields_set:
        entry.purchase_price = payload.purchase_price

    session.add(entry)
    session.commit()
    session.refresh(entry)

    return CadastreOut.model_validate(entry)


def delete_cadastre_entry(
    session: Session,
    user_id: int,
    cadastre_id: int,
) -> None:
    entry = get_user_cadastre_entry(session, user_id, cadastre_id)

    session.exec(
        update(Unit).where(Unit.cadastre_id == entry.id).values(cadastre_id=None)
    )

    session.delete(entry)
    session.commit()
