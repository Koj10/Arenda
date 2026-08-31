from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.enums import Plan


class LimitItem(BaseModel):
    limit: int
    occupied: int
    display: str


class LandlordSubscriptionResponse(BaseModel):
    plan: str
    status: str
    started_at: datetime
    expires_at: Optional[datetime] = None

    objects: LimitItem
    tenants: LimitItem
    units: LimitItem


class UpgradeRequest(BaseModel):
    plan: Optional[Plan] = None
