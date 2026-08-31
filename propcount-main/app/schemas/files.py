from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    original_name: str
    storage_key: str
    mime_type: Optional[str] = None
    size: int
    kind: Optional[str] = None
    linked_type: Optional[str] = None
    linked_id: Optional[int] = None
    created_at: datetime
