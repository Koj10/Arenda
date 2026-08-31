from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CadastreCreate(BaseModel):
    number: str = Field(min_length=1, max_length=100)
    cadastral_value: Decimal = Field(ge=0)
    purchase_price: Optional[Decimal] = Field(default=None, ge=0)


class CadastreUpdate(BaseModel):
    number: Optional[str] = Field(default=None, min_length=1, max_length=100)
    cadastral_value: Optional[Decimal] = Field(default=None, ge=0)
    purchase_price: Optional[Decimal] = Field(default=None, ge=0)


class CadastreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    object_id: int
    number: str
    cadastral_value: Decimal
    purchase_price: Optional[Decimal] = None


class UnitCadastreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: str
    area: Decimal
    cadastre_id: Optional[int] = None


class CadastralSummaryItem(BaseModel):
    object_id: int
    address: str
    units_total: int
    units_without_cadastre: int
    cadastre_numbers: int
    summary: str


class CadastralObjectDetail(BaseModel):
    object_id: int
    address: str
    cadastre_entries: List[CadastreOut] = []
    units: List[UnitCadastreOut] = []
