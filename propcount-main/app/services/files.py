from typing import Iterable, List

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.enums import FileLinkedType
from app.models import File


def link_files_by_ids(
    session: Session,
    user_id: int | None,
    file_ids: Iterable[int] | None,
    linked_type: FileLinkedType,
    linked_id: int,
    allow_any_owner: bool = False,
) -> List[File]:
    if not file_ids:
        return []

    unique_ids = list(set(file_ids))

    statement = select(File).where(File.id.in_(unique_ids))
    if not allow_any_owner:
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_id is required to link files",
            )
        statement = statement.where(File.user_id == user_id)

    files = session.exec(statement).all()

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
