from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.enums import ObjectType
from app.schemas.cadastre import CadastreOut
from app.schemas.files import FileOut
from app.schemas.units import UnitInObjectOut


class ObjectCreate(BaseModel):
    address: str = Field(min_length=1, max_length=255)
    type: ObjectType = ObjectType.office
    total_area: Decimal = Field(gt=0)

    cadastre_number: Optional[str] = Field(default=None, min_length=1, max_length=100)
    cadastral_value: Optional[Decimal] = Field(default=None, ge=0)
    purchase_price: Optional[Decimal] = Field(default=None, ge=0)

    file_ids: List[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_first_cadastre(self):
        if self.cadastre_number and self.cadastral_value is None:
            raise ValueError(
                "cadastral_value is required when cadastre_number is provided"
            )

        return self


class ObjectUpdate(BaseModel):
    address: Optional[str] = Field(default=None, min_length=1, max_length=255)
    type: Optional[ObjectType] = None
    total_area: Optional[Decimal] = Field(default=None, gt=0)


class ObjectMetrics(BaseModel):
    occupied_area: Decimal
    free_area: Decimal
    occupancy_percent: float
    monthly_income: Decimal


class ObjectListItem(BaseModel):
    id: int
    address: str
    type: str
    total_area: Decimal
    created_at: datetime

    occupied_area: Decimal
    free_area: Decimal
    occupancy_percent: float
    monthly_income: Decimal


class ObjectDetailOut(BaseModel):
    id: int
    address: str
    type: str
    total_area: Decimal
    created_at: datetime

    metrics: ObjectMetrics
    units: List[UnitInObjectOut] = []
    cadastre_entries: List[CadastreOut] = []
    documents: List[FileOut] = []
