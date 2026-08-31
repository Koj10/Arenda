from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import AuthContext, require_landlord
from app.db import get_session
from app.schemas.analytics import LandlordAnalyticsResponse
from app.services import analytics as analytics_service

router = APIRouter(prefix="/landlord")


@router.get(
    "/analytics",
    summary="Финансовый отчет",
    description="Показывает финансовый отчет",
    response_model=LandlordAnalyticsResponse,
)
def landlord_analytics(
    period: str,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return analytics_service.get_landlord_analytics(
        session=session,
        user_id=auth.user.id,
        period=period,
    )
