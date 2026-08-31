from datetime import datetime
from decimal import Decimal
from typing import List

from pydantic import BaseModel, ConfigDict


class SearchObjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    address: str
    type: str
    total_area: Decimal
    created_at: datetime


class SearchTenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    inn: str


class SearchResponse(BaseModel):
    objects: List[SearchObjectOut] = []
    tenants: List[SearchTenantOut] = []
