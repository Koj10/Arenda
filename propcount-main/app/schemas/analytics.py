from decimal import Decimal
from typing import List

from pydantic import BaseModel


class AnalyticsCards(BaseModel):
    income: Decimal
    expenses: Decimal
    profit: Decimal
    rent_accrued: Decimal
    utility_accrued: Decimal
    invoices_pending: Decimal
    invoices_overdue: Decimal
    occupancy_percent: float


class CashflowPoint(BaseModel):
    date: str
    income: Decimal
    expense: Decimal
    profit: Decimal


class ExpenseBreakdownItem(BaseModel):
    category: str
    amount: Decimal


class RevenueComparison(BaseModel):
    current_period: str
    previous_period: str
    current: Decimal
    previous: Decimal
    difference: Decimal
    percent_change: float


class LandlordAnalyticsResponse(BaseModel):
    period: str
    cards: AnalyticsCards
    cashflow: List[CashflowPoint]
    expense_breakdown: List[ExpenseBreakdownItem]
    revenue_comparison: RevenueComparison
