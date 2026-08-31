from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


class ReportRow(BaseModel):
    entity_type: str
    id: int
    name: str

    object_id: Optional[int] = None
    object_address: Optional[str] = None

    total_area: Decimal
    occupied_area: Decimal
    free_area: Decimal
    occupancy_percent: float

    rent_income: Decimal
    utility_income: Decimal
    transaction_income: Decimal
    expenses: Decimal
    profit: Decimal


class ReportTotals(BaseModel):
    total_area: Decimal
    occupied_area: Decimal
    free_area: Decimal
    occupancy_percent: float

    rent_income: Decimal
    utility_income: Decimal
    transaction_income: Decimal
    expenses: Decimal
    profit: Decimal


class ReportResponse(BaseModel):
    period: str
    rows: List[ReportRow]
    totals: ReportTotals
