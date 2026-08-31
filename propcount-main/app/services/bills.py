from collections import defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Dict, List, Optional, Set

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.enums import UTILITY_CRITERIA, InvoiceKind, InvoiceStatus, Payer
from app.models import File, Invoice, Lease, Object, Tenant, Unit, UtilityBill
from app.schemas.bills import (
    BillInvoiceOut,
    BillObjectOut,
    PayersMatrixOut,
    UnitPayerRow,
    UtilityBillCreate,
    UtilityBillDetailOut,
    UtilityBillListItem,
)
from app.services.realestate import get_user_object


def quantize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_bill_objects(
    session: Session,
    user_id: int,
    q: str = "",
) -> List[BillObjectOut]:
    statement = select(Object).where(Object.user_id == user_id)

    if q:
        statement = statement.where(Object.address.ilike(f"%{q}%"))

    statement = statement.order_by(Object.created_at.desc())

    objects = session.exec(statement).all()

    return [BillObjectOut.model_validate(item) for item in objects]


def get_payers_matrix(
    session: Session,
    user_id: int,
    object_id: int,
) -> PayersMatrixOut:
    obj = get_user_object(session, user_id, object_id)

    units = session.exec(select(Unit).where(Unit.object_id == obj.id)).all()

    active_leases = session.exec(
        select(Lease)
        .join(Unit, Lease.unit_id == Unit.id)
        .where(
            Unit.object_id == obj.id,
            Lease.end_date >= date.today(),
        )
    ).all()

    active_lease_by_unit: Dict[int, Lease] = {}

    for lease in active_leases:
        existing = active_lease_by_unit.get(lease.unit_id)

        if not existing or lease.end_date > existing.end_date:
            active_lease_by_unit[lease.unit_id] = lease

    tenant_names: Dict[int, str] = {}

    for lease in active_lease_by_unit.values():
        if lease.tenant_id not in tenant_names:
            tenant = session.get(Tenant, lease.tenant_id)
            tenant_names[lease.tenant_id] = tenant.name if tenant else ""

    rows: List[UnitPayerRow] = []

    for unit in units:
        payers = dict(unit.utility_payers or {})

        for criterion in UTILITY_CRITERIA:
            payers.setdefault(criterion, Payer.tenant.value)

        active_lease = active_lease_by_unit.get(unit.id)

        rows.append(
            UnitPayerRow(
                unit_id=unit.id,
                number=unit.number,
                area=unit.area,
                utility_payers=payers,
                active_tenant_name=(
                    tenant_names.get(active_lease.tenant_id) if active_lease else None
                ),
            )
        )

    return PayersMatrixOut(
        object_id=obj.id,
        address=obj.address,
        criteria=UTILITY_CRITERIA,
        units=rows,
    )


def list_object_bills(
    session: Session,
    user_id: int,
    object_id: int,
) -> List[UtilityBillListItem]:
    obj = get_user_object(session, user_id, object_id)

    bills = session.exec(
        select(UtilityBill)
        .where(UtilityBill.object_id == obj.id)
        .order_by(UtilityBill.created_at.desc())
    ).all()

    return [UtilityBillListItem.model_validate(item) for item in bills]


def create_utility_bill(
    session: Session,
    user_id: int,
    payload: UtilityBillCreate,
) -> UtilityBillDetailOut:
    obj = get_user_object(session, user_id, payload.object_id)

    if payload.file_id is not None:
        file = session.get(File, payload.file_id)

        if not file or file.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found",
            )

        if file.linked_type is not None or file.linked_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Utility bill file must not be linked via linked_type/linked_id",
            )

    normalized_amounts: Dict[str, Decimal] = {}

    for criterion, amount in payload.amounts.items():
        normalized_amounts[criterion] = quantize_money(amount)

    total = quantize_money(sum(normalized_amounts.values(), Decimal("0")))

    stored_amounts = {
        criterion: str(amount) for criterion, amount in normalized_amounts.items()
    }

    bill = UtilityBill(
        user_id=user_id,
        object_id=obj.id,
        file_id=payload.file_id,
        title=payload.title,
        period=payload.period,
        pay_by=payload.pay_by,
        amounts=stored_amounts,
        total=total,
    )

    session.add(bill)
    session.commit()
    session.refresh(bill)

    units = session.exec(select(Unit).where(Unit.object_id == obj.id)).all()

    active_leases = session.exec(
        select(Lease)
        .join(Unit, Lease.unit_id == Unit.id)
        .where(
            Unit.object_id == obj.id,
            Lease.end_date >= date.today(),
        )
    ).all()

    active_lease_by_unit: Dict[int, Lease] = {}

    for lease in active_leases:
        existing = active_lease_by_unit.get(lease.unit_id)

        if not existing or lease.end_date > existing.end_date:
            active_lease_by_unit[lease.unit_id] = lease

    tenant_shares: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    tenant_units: Dict[int, Set[int]] = defaultdict(set)

    for criterion, amount in normalized_amounts.items():
        if amount <= 0:
            continue

        eligible_units: List[Unit] = []

        for unit in units:
            payers = dict(unit.utility_payers or {})
            payer = payers.get(criterion, Payer.tenant.value)

            if payer == Payer.tenant.value and unit.area > 0:
                eligible_units.append(unit)

        total_area = sum((unit.area for unit in eligible_units), Decimal("0"))

        if total_area <= 0:
            continue

        for unit in eligible_units:
            lease = active_lease_by_unit.get(unit.id)

            if not lease:
                continue

            share = quantize_money(amount * unit.area / total_area)

            tenant_shares[lease.tenant_id] += share
            tenant_units[lease.tenant_id].add(unit.id)

    invoices: List[Invoice] = []

    for tenant_id, amount in tenant_shares.items():
        if amount <= 0:
            continue

        unit_ids = list(tenant_units.get(tenant_id, set()))
        unit_id = unit_ids[0] if len(unit_ids) == 1 else None

        invoice = Invoice(
            user_id=user_id,
            tenant_id=tenant_id,
            unit_id=unit_id,
            kind=InvoiceKind.utility.value,
            source_bill_id=bill.id,
            period=bill.period,
            amount=quantize_money(amount),
            due_date=bill.pay_by,
            status=InvoiceStatus.pending.value,
        )

        session.add(invoice)
        invoices.append(invoice)

    if invoices:
        session.flush()

    session.commit()

    return get_bill_detail(session, user_id, bill.id)


def get_bill_detail(
    session: Session,
    user_id: int,
    bill_id: int,
) -> UtilityBillDetailOut:
    bill = session.get(UtilityBill, bill_id)

    if not bill or bill.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utility bill not found",
        )

    obj = session.get(Object, bill.object_id)

    invoices = session.exec(
        select(Invoice).where(Invoice.source_bill_id == bill.id)
    ).all()

    invoices_out: List[BillInvoiceOut] = []

    for invoice in invoices:
        tenant = session.get(Tenant, invoice.tenant_id)

        invoices_out.append(
            BillInvoiceOut(
                id=invoice.id,
                tenant_id=invoice.tenant_id,
                tenant_name=tenant.name if tenant else "",
                amount=invoice.amount,
                unit_id=invoice.unit_id,
                due_date=invoice.due_date,
                status=invoice.status,
            )
        )

    return UtilityBillDetailOut(
        id=bill.id,
        user_id=bill.user_id,
        object_id=bill.object_id,
        file_id=bill.file_id,
        title=bill.title,
        period=bill.period,
        pay_by=bill.pay_by,
        amounts=bill.amounts,
        total=bill.total,
        created_at=bill.created_at,
        object_address=obj.address if obj else "",
        invoices=invoices_out,
    )
