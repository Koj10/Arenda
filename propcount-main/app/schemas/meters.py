from datetime import datetime
from decimal import Decimal
from typing import List

from pydantic import BaseModel, Field, field_validator, model_validator

from app.enums import METERED_CRITERIA


class MeterReadingUpsert(BaseModel):
    unit_id: int
    period: str
    criterion: str
    previous_value: Decimal = Field(ge=0)
    current_value: Decimal = Field(ge=0)

    @field_validator("period")
    @classmethod
    def validate_period(cls, value: str) -> str:
        if len(value) != 7 or value[4] != "-":
            raise ValueError("period must be in YYYY-MM format")
        month = int(value.split("-")[1])
        if month < 1 or month > 12:
            raise ValueError("period month must be between 01 and 12")
        return value

    @field_validator("criterion")
    @classmethod
    def validate_criterion(cls, value: str) -> str:
        if value not in METERED_CRITERIA:
            raise ValueError("This criterion does not use meter readings")
        return value

    @model_validator(mode="after")
    def validate_values(self):
        if self.current_value < self.previous_value:
            raise ValueError("current_value cannot be less than previous_value")
        return self


class MeterReadingOut(BaseModel):
    id: int
    object_id: int
    unit_id: int
    unit_number: str
    criterion: str
    period: str
    previous_value: Decimal
    current_value: Decimal
    consumption: Decimal
    submitted_by_role: str
    updated_at: datetime


class ObjectMetersOut(BaseModel):
    object_id: int
    period: str
    criteria: List[str]
    readings: List[MeterReadingOut] = []


class TenantMeterUnitOut(BaseModel):
    unit_id: int
    unit_number: str
    object_id: int
    object_address: str


class TenantMetersOut(BaseModel):
    period: str
    criteria: List[str]
    readings: List[MeterReadingOut] = []
    units: List[TenantMeterUnitOut] = []
