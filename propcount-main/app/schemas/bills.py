import re
from datetime import date, datetime
from decimal import Decimal
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.enums import UTILITY_CRITERIA


class BillObjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    address: str
    total_area: Decimal


class UnitPayerRow(BaseModel):
    unit_id: int
    number: str
    area: Decimal
    utility_payers: dict
    active_tenant_name: Optional[str] = None


class PayersMatrixOut(BaseModel):
    object_id: int
    address: str
    criteria: List[str]
    units: List[UnitPayerRow] = []


class UtilityBillListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    object_id: int
    file_id: Optional[int] = None
    title: str
    period: str
    pay_by: date
    total: Decimal
    landlord_loss: Decimal = Decimal("0")
    created_at: datetime


class UtilityBillCreate(BaseModel):
    object_id: int
    file_id: Optional[int] = None
    title: str = Field(min_length=1, max_length=255)
    period: str
    pay_by: date
    amounts: Dict[str, Decimal]

    @field_validator("period")
    @classmethod
    def validate_period(cls, value: str) -> str:
        if not re.fullmatch(r"\d{4}-\d{2}", value):
            raise ValueError("period must be in YYYY-MM format")

        month = int(value.split("-")[1])

        if month < 1 or month > 12:
            raise ValueError("period month must be between 01 and 12")

        return value

    @model_validator(mode="after")
    def validate_amounts(self):
        if not self.amounts:
            raise ValueError("amounts must not be empty")

        for criterion, amount in self.amounts.items():
            if criterion not in UTILITY_CRITERIA:
                raise ValueError(f"Unknown utility criterion: {criterion}")

            if amount is None:
                raise ValueError("Amount cannot be null")

            if amount < 0:
                raise ValueError("Amount cannot be negative")

        if all(amount == 0 for amount in self.amounts.values()):
            raise ValueError("At least one amount must be greater than zero")

        return self


class BillAllocationOut(BaseModel):
    unit_id: int
    unit_number: str
    criterion: str
    amount: Decimal
    destination: str
    tenant_id: Optional[int] = None
    tenant_name: Optional[str] = None


class UtilityBillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    object_id: int
    file_id: Optional[int] = None
    title: str
    period: str
    pay_by: date
    amounts: dict
    total: Decimal
    landlord_loss: Decimal = Decimal("0")
    allocations: list = []
    created_at: datetime


class BillInvoiceOut(BaseModel):
    id: int
    tenant_id: int
    tenant_name: str
    amount: Decimal
    unit_id: Optional[int] = None
    due_date: date
    status: str


class UtilityBillDetailOut(UtilityBillOut):
    object_address: str
    invoices: List[BillInvoiceOut] = []
    allocation_rows: List[BillAllocationOut] = []
