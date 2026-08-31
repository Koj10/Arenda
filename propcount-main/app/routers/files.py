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
from fastapi.responses import FileResponse
from sqlmodel import Session

from app.api.deps import AuthContext, get_current_auth
from app.core.config import settings
from app.db import get_session
from app.enums import FileKind, FileLinkedType
from app.models import File, Invoice
from app.schemas.files import FileOut
from app.services.tenant_panel import get_accessible_invoice

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


def _can_access_file(session: Session, auth: AuthContext, file_row: File) -> bool:
    if file_row.user_id == auth.user.id:
        return True
    if file_row.linked_type != FileLinkedType.invoice.value or not file_row.linked_id:
        return False
    invoice = session.get(Invoice, file_row.linked_id)
    if not invoice:
        return False
    if invoice.user_id == auth.user.id:
        return True
    if auth.role == "tenant":
        try:
            get_accessible_invoice(session, auth.user.id, invoice.id)
            return True
        except HTTPException:
            return False
    return False


@router.get(
    "/files/{file_id}",
    summary="Скачать файл",
)
def download_file(
    file_id: int,
    auth: AuthContext = Depends(get_current_auth),
    session: Session = Depends(get_session),
):
    file_row = session.get(File, file_id)
    if not file_row or not _can_access_file(session, auth, file_row):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    path = Path(settings.storage_dir) / file_row.storage_key
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(
        path,
        filename=file_row.original_name,
        media_type=file_row.mime_type or "application/octet-stream",
    )
