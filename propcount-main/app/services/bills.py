from collections import defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Dict, List, Optional, Set

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.enums import METERED_CRITERIA, UTILITY_CRITERIA, InvoiceKind, InvoiceStatus, Payer
from app.models import File, Invoice, Lease, Object, Tenant, Unit, UtilityBill
from app.schemas.bills import (
    BillAllocationOut,
    BillInvoiceOut,
    BillObjectOut,
    PayersMatrixOut,
    UnitPayerRow,
    UtilityBillCreate,
    UtilityBillDetailOut,
    UtilityBillListItem,
)
from app.services.meters import get_consumption_map
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
        landlord_loss=Decimal("0"),
        allocations=[],
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
    landlord_loss = Decimal("0")
    allocation_records: List[dict] = []
    object_area = obj.total_area if obj.total_area and obj.total_area > 0 else Decimal("0")

    def destination_for(unit: Unit, criterion: str) -> tuple[str, Optional[int]]:
        payers = dict(unit.utility_payers or {})
        payer = payers.get(criterion, Payer.tenant.value)
        lease = active_lease_by_unit.get(unit.id)
        if payer == Payer.tenant.value and lease:
            return "tenant", lease.tenant_id
        return "loss", None

    def apply_share(unit: Unit, criterion: str, share: Decimal) -> None:
        nonlocal landlord_loss
        if share <= 0:
            return
        dest, tenant_id = destination_for(unit, criterion)
        allocation_records.append(
            {
                "unit_id": unit.id,
                "unit_number": unit.number,
                "criterion": criterion,
                "amount": str(share),
                "destination": dest,
                "tenant_id": tenant_id,
            }
        )
        if dest == "tenant" and tenant_id is not None:
            tenant_shares[tenant_id] += share
            tenant_units[tenant_id].add(unit.id)
        else:
            landlord_loss += share

    def split_by_weights(
        amount: Decimal,
        weights: List[tuple[Unit, Decimal]],
    ) -> List[tuple[Unit, Decimal]]:
        positive = [(unit, weight) for unit, weight in weights if weight > 0]
        total_w = sum((weight for _, weight in positive), Decimal("0"))
        if total_w <= 0:
            return []
        result: List[tuple[Unit, Decimal]] = []
        allocated = Decimal("0")
        for index, (unit, weight) in enumerate(positive):
            if index == len(positive) - 1:
                share = quantize_money(amount - allocated)
            else:
                share = quantize_money(amount * weight / total_w)
                allocated += share
            if share > 0:
                result.append((unit, share))
        return result

    for criterion, amount in normalized_amounts.items():
        if amount <= 0:
            continue

        used_metered = False
        if criterion in METERED_CRITERIA:
            consumption = get_consumption_map(session, obj.id, bill.period, criterion)
            weights = [(unit, consumption.get(unit.id, Decimal("0"))) for unit in units]
            shares = split_by_weights(amount, weights)
            if shares:
                used_metered = True
                for unit, share in shares:
                    apply_share(unit, criterion, share)

        if not used_metered:
            if object_area <= 0 or not units:
                landlord_loss += amount
                continue
            allocated = Decimal("0")
            for unit in units:
                share = quantize_money(amount * unit.area / object_area)
                allocated += share
                apply_share(unit, criterion, share)
            remainder = quantize_money(amount - allocated)
            if remainder > 0:
                landlord_loss += remainder

    bill.landlord_loss = quantize_money(landlord_loss)
    bill.allocations = allocation_records
    session.add(bill)

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

    tenant_names = {row.tenant_id: row.tenant_name for row in invoices_out}
    raw_allocations = bill.allocations or []
    allocation_rows: List[BillAllocationOut] = []
    for item in raw_allocations:
        tenant_id = item.get("tenant_id")
        allocation_rows.append(
            BillAllocationOut(
                unit_id=item.get("unit_id"),
                unit_number=item.get("unit_number") or "",
                criterion=item.get("criterion") or "",
                amount=Decimal(str(item.get("amount") or "0")),
                destination=item.get("destination") or "loss",
                tenant_id=tenant_id,
                tenant_name=tenant_names.get(tenant_id) if tenant_id else None,
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
        landlord_loss=bill.landlord_loss or Decimal("0"),
        allocations=raw_allocations,
        created_at=bill.created_at,
        object_address=obj.address if obj else "",
        invoices=invoices_out,
        allocation_rows=allocation_rows,
    )
