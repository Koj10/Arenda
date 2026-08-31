import uuid
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi import (
    File as FileParam,
)
from sqlmodel import Session

from app.api.deps import AuthContext, get_current_auth
from app.core.config import settings
from app.db import get_session
from app.enums import FileKind, FileLinkedType
from app.models import File
from app.schemas.files import FileOut

router = APIRouter()


@router.post(
    "/files",
    summary="Загрузка файла",
    description="Загружает файл и возвращает его информацию",
    response_model=FileOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    file: UploadFile = FileParam(...),
    auth: AuthContext = Depends(get_current_auth),
    session: Session = Depends(get_session),
    kind: FileKind | None = Form(default=None),
    linked_type: FileLinkedType | None = Form(default=None),
    linked_id: int | None = Form(default=None),
):
    if linked_type is not None and linked_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="linked_id is required when linked_type is provided",
        )

    if linked_id is not None and linked_type is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="linked_type is required when linked_id is provided",
        )

    storage_dir = Path(settings.storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)

    original_name = file.filename or "file"
    suffix = Path(original_name).suffix

    storage_key = f"{uuid.uuid4().hex}{suffix}"
    file_path = storage_dir / storage_key

    size = 0

    with file_path.open("wb") as buffer:
        while True:
            chunk = await file.read(1024 * 1024)

            if not chunk:
                break

            buffer.write(chunk)
            size += len(chunk)

    file_row = File(
        user_id=auth.user.id,
        original_name=original_name,
        storage_key=storage_key,
        mime_type=file.content_type,
        size=size,
        kind=kind.value if kind else None,
        linked_type=linked_type.value if linked_type else None,
        linked_id=linked_id,
    )

    session.add(file_row)
    session.commit()
    session.refresh(file_row)

    return FileOut.model_validate(file_row)
