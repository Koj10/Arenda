from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class TenantSpaceOut(BaseModel):
    lease_id: int
    status: str

    start_date: Optional[date] = None
    end_date: date
    rent_monthly: Decimal

    unit_id: int
    unit_number: str
    unit_area: Decimal

    object_id: int
    object_address: str


class TenantSpacesResponse(BaseModel):
    matched: bool
    message: Optional[str] = None
    spaces: List[TenantSpaceOut] = []


class TenantInvoiceOut(BaseModel):
    id: int
    kind: str
    period: str
    amount: Decimal
    due_date: date
    status: str
    computed_status: str

    object_address: Optional[str] = None
    unit_number: Optional[str] = None


class TenantInvoicesResponse(BaseModel):
    matched: bool
    message: Optional[str] = None
    invoices: List[TenantInvoiceOut] = []


class TenantReportResponse(BaseModel):
    tab: str
    period: str
    matched: bool
    message: Optional[str] = None
    rows: List[Dict[str, Any]] = []
    totals: Dict[str, Any] = {}


class TenantSubscriptionResponse(BaseModel):
    plan: str
    status: str
    started_at: datetime
    expires_at: Optional[datetime] = None
    can_export: bool
