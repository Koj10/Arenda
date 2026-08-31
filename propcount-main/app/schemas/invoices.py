from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.enums import InvoiceKind, InvoiceStatus
from app.schemas.files import FileOut
from app.utils.period import validate_period_format


class InvoiceCreate(BaseModel):
    tenant_id: int
    unit_id: Optional[int] = None
    kind: InvoiceKind = InvoiceKind.rent
    period: str
    amount: Decimal = Field(gt=0)
    due_date: date
    file_ids: List[int] = Field(default_factory=list)

    @field_validator("period")
    @classmethod
    def validate_period(cls, value: str) -> str:
        return validate_period_format(value)


class InvoiceUpdate(BaseModel):
    status: Optional[InvoiceStatus] = None
    amount: Optional[Decimal] = Field(default=None, gt=0)
    due_date: Optional[date] = None
    period: Optional[str] = None
    file_ids: Optional[List[int]] = None

    @field_validator("period")
    @classmethod
    def validate_period(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value

        return validate_period_format(value)


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    tenant_id: int
    unit_id: Optional[int] = None
    kind: str
    source_bill_id: Optional[int] = None
    period: str
    amount: Decimal
    due_date: date
    status: str
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = None
    created_at: datetime

    computed_status: str
    tenant_name: str
    unit_number: Optional[str] = None
    object_address: Optional[str] = None


class InvoiceDetailOut(InvoiceOut):
    files: List[FileOut] = []


class GenerateInvoicesResponse(BaseModel):
    period: str
    created_count: int
    invoices: List[InvoiceOut] = []
