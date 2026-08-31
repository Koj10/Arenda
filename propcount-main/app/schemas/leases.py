from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class LeaseCreate(BaseModel):
    tenant_id: int
    unit_id: int
    rent_monthly: Decimal = Field(ge=0)
    start_date: Optional[date] = None
    end_date: date
    file_ids: List[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date")

        return self


class LeaseUpdate(BaseModel):
    tenant_id: Optional[int] = None
    unit_id: Optional[int] = None
    rent_monthly: Optional[Decimal] = Field(default=None, ge=0)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    file_ids: Optional[List[int]] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date")

        return self


class LeaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    tenant_id: int
    unit_id: int
    rent_monthly: Decimal
    start_date: Optional[date] = None
    end_date: date
    created_at: datetime


class LeaseDetailOut(LeaseOut):
    tenant_name: str
    tenant_inn: str
    unit_number: str
    object_address: str
    status: str
