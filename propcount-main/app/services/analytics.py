from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, List

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, select

from app.enums import InvoiceKind, InvoiceStatus, TransactionType
from app.models import Invoice, Lease, Object, Transaction, Unit
from app.schemas.analytics import (
    AnalyticsCards,
    CashflowPoint,
    ExpenseBreakdownItem,
    LandlordAnalyticsResponse,
    RevenueComparison,
)
from app.utils.period import parse_period


def previous_period(period: str) -> str:
    year, month = map(int, period.split("-"))

    if month == 1:
        return f"{year - 1}-12"

    return f"{year}-{month - 1:02d}"


def decimal_zero(value) -> Decimal:
    return value or Decimal("0")


def percent_change(current: Decimal, previous: Decimal) -> float:
    if previous == 0:
        return 100.0 if current > 0 else 0.0

    return round(float(((current - previous) / previous) * 100), 2)


def sum_transactions(
    session: Session,
    user_id: int,
    type_value: str,
    date_from: date,
    date_to: date,
) -> Decimal:
    value = session.exec(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == type_value,
            Transaction.date >= date_from,
            Transaction.date <= date_to,
        )
    ).first()

    return Decimal(str(value or 0))


def sum_invoices(
    session: Session,
    user_id: int,
    period: str,
    kind: str | None = None,
    status_value: str | None = None,
    overdue: bool = False,
) -> Decimal:
    statement = select(func.coalesce(func.sum(Invoice.amount), 0)).where(
        Invoice.user_id == user_id,
        Invoice.period == period,
    )

    if kind:
        statement = statement.where(Invoice.kind == kind)

    if status_value:
        statement = statement.where(Invoice.status == status_value)

    if overdue:
        statement = statement.where(
            Invoice.status == InvoiceStatus.pending.value,
            Invoice.due_date < date.today(),
        )

    value = session.exec(statement).first()
    return Decimal(str(value or 0))


def calculate_occupancy(session: Session, user_id: int) -> float:
    objects = session.exec(select(Object).where(Object.user_id == user_id)).all()

    total_area = sum((obj.total_area for obj in objects), Decimal("0"))

    if total_area <= 0:
        return 0.0

    active_leases = session.exec(
        select(Lease)
        .join(Unit, Lease.unit_id == Unit.id)
        .join(Object, Unit.object_id == Object.id)
        .where(
            Object.user_id == user_id,
            Lease.end_date >= date.today(),
        )
    ).all()

    occupied_unit_ids = {lease.unit_id for lease in active_leases}

    if not occupied_unit_ids:
        return 0.0

    occupied_units = session.exec(
        select(Unit)
        .join(Object, Unit.object_id == Object.id)
        .where(
            Object.user_id == user_id,
            Unit.id.in_(occupied_unit_ids),
        )
    ).all()

    occupied_area = sum((unit.area for unit in occupied_units), Decimal("0"))

    return round(float((occupied_area / total_area) * 100), 2)


def build_cashflow(
    session: Session,
    user_id: int,
    date_from: date,
    date_to: date,
) -> List[CashflowPoint]:
    income_by_day: Dict[date, Decimal] = defaultdict(lambda: Decimal("0"))
    expense_by_day: Dict[date, Decimal] = defaultdict(lambda: Decimal("0"))

    transactions = session.exec(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.date >= date_from,
            Transaction.date <= date_to,
        )
    ).all()

    for transaction in transactions:
        if transaction.type == TransactionType.income.value:
            income_by_day[transaction.date] += transaction.amount
        else:
            expense_by_day[transaction.date] += transaction.amount

    paid_invoices = session.exec(
        select(Invoice).where(
            Invoice.user_id == user_id,
            Invoice.status == InvoiceStatus.paid.value,
            Invoice.paid_at.is_not(None),
        )
    ).all()

    for invoice in paid_invoices:
        paid_date = invoice.paid_at.date()

        if date_from <= paid_date <= date_to:
            income_by_day[paid_date] += invoice.amount

    result: List[CashflowPoint] = []

    current = date_from

    while current <= date_to:
        income = income_by_day[current]
        expense = expense_by_day[current]

        result.append(
            CashflowPoint(
                date=current.isoformat(),
                income=income,
                expense=expense,
                profit=income - expense,
            )
        )

        current += timedelta(days=1)

    return result


def build_expense_breakdown(
    session: Session,
    user_id: int,
    date_from: date,
    date_to: date,
) -> List[ExpenseBreakdownItem]:
    rows = session.exec(
        select(Transaction.category, func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.expense.value,
            Transaction.date >= date_from,
            Transaction.date <= date_to,
        )
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    ).all()

    return [
        ExpenseBreakdownItem(
            category=row[0],
            amount=Decimal(str(row[1] or 0)),
        )
        for row in rows
    ]


def get_landlord_analytics(
    session: Session,
    user_id: int,
    period: str,
) -> LandlordAnalyticsResponse:
    date_from, date_to = parse_period(period)

    prev_period = previous_period(period)

    income = sum_transactions(
        session,
        user_id,
        TransactionType.income.value,
        date_from,
        date_to,
    )

    expenses = sum_transactions(
        session,
        user_id,
        TransactionType.expense.value,
        date_from,
        date_to,
    )

    rent_accrued = sum_invoices(
        session,
        user_id,
        period,
        kind=InvoiceKind.rent.value,
        status_value=InvoiceStatus.paid.value,
    )

    utility_accrued = sum_invoices(
        session,
        user_id,
        period,
        kind=InvoiceKind.utility.value,
    )

    invoices_pending = sum_invoices(
        session,
        user_id,
        period,
        status_value=InvoiceStatus.pending.value,
    )

    invoices_overdue = sum_invoices(
        session,
        user_id,
        period,
        overdue=True,
    )

    current_revenue = rent_accrued + utility_accrued
    previous_revenue = sum_invoices(
        session,
        user_id,
        prev_period,
        kind=InvoiceKind.rent.value,
        status_value=InvoiceStatus.paid.value,
    ) + sum_invoices(session, user_id, prev_period, kind=InvoiceKind.utility.value)

    return LandlordAnalyticsResponse(
        period=period,
        cards=AnalyticsCards(
            income=income,
            expenses=expenses,
            profit=income - expenses,
            rent_accrued=rent_accrued,
            utility_accrued=utility_accrued,
            invoices_pending=invoices_pending,
            invoices_overdue=invoices_overdue,
            occupancy_percent=calculate_occupancy(session, user_id),
        ),
        cashflow=build_cashflow(session, user_id, date_from, date_to),
        expense_breakdown=build_expense_breakdown(session, user_id, date_from, date_to),
        revenue_comparison=RevenueComparison(
            current_period=period,
            previous_period=prev_period,
            current=current_revenue,
            previous=previous_revenue,
            difference=current_revenue - previous_revenue,
            percent_change=percent_change(current_revenue, previous_revenue),
        ),
    )
