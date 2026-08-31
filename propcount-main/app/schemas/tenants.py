from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    inn: str = Field(min_length=1, max_length=32)


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    inn: Optional[str] = Field(default=None, min_length=1, max_length=32)


class TenantOut(BaseModel):
    id: int
    name: str
    inn: str
    created_at: datetime
    active_leases_count: int = 0


class TenantSuggestItem(BaseModel):
    name: str
    inn: str
    source: str


class LeaseInTenantDetail(BaseModel):
    id: int
    unit_id: int
    unit_number: str
    object_address: str
    rent_monthly: Decimal
    start_date: Optional[date] = None
    end_date: date
    status: str


class TenantDetailOut(TenantOut):
    leases: List[LeaseInTenantDetail] = []
