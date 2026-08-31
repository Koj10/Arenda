from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.enums import Payer


class UnitCreate(BaseModel):
    number: str = Field(min_length=1, max_length=100)
    area: Decimal = Field(gt=0)
    rent_rate: Optional[Decimal] = Field(default=None, ge=0)
    cadastre_id: Optional[int] = None


class UnitUpdate(BaseModel):
    number: Optional[str] = Field(default=None, min_length=1, max_length=100)
    area: Optional[Decimal] = Field(default=None, gt=0)
    rent_rate: Optional[Decimal] = Field(default=None, ge=0)
    cadastre_id: Optional[int] = None


class UnitPayerUpdate(BaseModel):
    criterion: str
    payer: Payer


class UnitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    object_id: int
    number: str
    area: Decimal
    rent_rate: Optional[Decimal] = None
    cadastre_id: Optional[int] = None
    utility_payers: dict
    created_at: datetime


class UnitInObjectOut(UnitOut):
    is_occupied: bool = False
    active_tenant_name: Optional[str] = None
    active_lease_end_date: Optional[date] = None
    active_rent_monthly: Optional[Decimal] = None


class ActiveLeaseInfo(BaseModel):
    id: int
    tenant_id: int
    tenant_name: str
    tenant_inn: str
    rent_monthly: Decimal
    start_date: Optional[date] = None
    end_date: date
    status: str


class UnitCardOut(BaseModel):
    unit: UnitOut
    object_address: str
    is_occupied: bool
    active_lease: Optional[ActiveLeaseInfo] = None
