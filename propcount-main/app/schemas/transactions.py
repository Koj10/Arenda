from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field

from app.enums import TransactionType
from app.schemas.files import FileOut


class TransactionCreate(BaseModel):
    type: TransactionType
    title: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(gt=0)
    category: str = Field(min_length=1, max_length=100)
    object_id: Optional[int] = None
    comment: Optional[str] = None
    transaction_date: date
    file_ids: List[int] = Field(default_factory=list)


class TransactionUpdate(BaseModel):
    type: Optional[TransactionType] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    amount: Optional[Decimal] = Field(default=None, gt=0)
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    object_id: Optional[int] = None
    comment: Optional[str] = None
    transaction_date: Optional[date] = None
    file_ids: Optional[List[int]] = None


class TransactionOut(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    amount: Decimal
    category: str
    object_id: Optional[int] = None
    comment: Optional[str] = None
    transaction_date: date
    created_at: datetime
    object_address: Optional[str] = None


class TransactionDetailOut(TransactionOut):
    files: List[FileOut] = []
