from typing import List

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import AuthContext, get_current_auth
from app.db import get_session
from app.models import Notification
from app.schemas.notifications import NotificationOut, NotificationUpdate

router = APIRouter()


@router.get(
    "/notifications",
    summary="Уведомления",
    response_model=List[NotificationOut],
)
def list_notifications(
    auth: AuthContext = Depends(get_current_auth),
    session: Session = Depends(get_session),
):
    notifications = session.exec(
        select(Notification)
        .where(Notification.user_id == auth.user.id)
        .order_by(Notification.created_at.desc())
        .limit(200)
    ).all()

    return notifications


@router.patch(
    "/notifications/{notification_id}",
    summary="Обновление уведомления",
    response_model=NotificationOut,
)
def update_notification(
    notification_id: int,
    auth: AuthContext = Depends(get_current_auth),
    session: Session = Depends(get_session),
    payload: NotificationUpdate | None = Body(default=None),
):
    notification = session.get(Notification, notification_id)

    if not notification or notification.user_id != auth.user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    notification.is_read = True if payload is None else payload.is_read

    session.add(notification)
    session.commit()
    session.refresh(notification)

    return NotificationOut.model_validate(notification)
