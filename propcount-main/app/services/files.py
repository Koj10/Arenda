from typing import Iterable, List

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.enums import FileLinkedType
from app.models import File


def link_files_by_ids(
    session: Session,
    user_id: int,
    file_ids: Iterable[int] | None,
    linked_type: FileLinkedType,
    linked_id: int,
) -> List[File]:
    if not file_ids:
        return []

    unique_ids = list(set(file_ids))

    files = session.exec(
        select(File).where(
            File.id.in_(unique_ids),
            File.user_id == user_id,
        )
    ).all()

    if len(files) != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Some files not found",
        )

    for file in files:
        file.linked_type = linked_type.value
        file.linked_id = linked_id
        session.add(file)

    session.commit()

    return files
