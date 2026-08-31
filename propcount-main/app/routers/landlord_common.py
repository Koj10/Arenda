from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlmodel import Session, select

from app.api.deps import AuthContext, require_landlord
from app.db import get_session
from app.enums import LANDLORD_PLANS, Plan, Role, SubscriptionStatus
from app.models import Object, Tenant
from app.schemas.search import SearchResponse
from app.schemas.subscription import LandlordSubscriptionResponse, UpgradeRequest
from app.services.limits import get_landlord_subscription_response
from app.services.users import get_or_create_subscription

router = APIRouter(prefix="/landlord")


@router.get(
    "/search",
    summary="Поиск",
    response_model=SearchResponse,
)
def search(
    q: str = "",
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    objects = []
    tenants = []

    if q:
        like = f"%{q}%"

        objects = session.exec(
            select(Object)
            .where(
                Object.user_id == auth.user.id,
                Object.address.ilike(like),
            )
            .order_by(Object.created_at.desc())
            .limit(50)
        ).all()

        tenants = session.exec(
            select(Tenant)
            .where(
                Tenant.user_id == auth.user.id,
                or_(
                    Tenant.name.ilike(like),
                    Tenant.inn.ilike(like),
                ),
            )
            .order_by(Tenant.name)
            .limit(50)
        ).all()

    return SearchResponse(objects=objects, tenants=tenants)


@router.get(
    "/subscription",
    summary="Подписка",
    response_model=LandlordSubscriptionResponse,
)
def landlord_subscription(
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return get_landlord_subscription_response(session, auth.user.id)


@router.post(
    "/subscription/upgrade",
    summary="Улучшение подписки",
    response_model=LandlordSubscriptionResponse,
)
def landlord_subscription_upgrade(
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
    payload: UpgradeRequest | None = None,
):
    plan_value = payload.plan.value if payload and payload.plan else Plan.profi.value

    if plan_value not in LANDLORD_PLANS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This plan is not available for landlord role",
        )

    subscription = get_or_create_subscription(
        session=session,
        user_id=auth.user.id,
        role=Role.landlord.value,
    )

    subscription.plan = plan_value
    subscription.status = SubscriptionStatus.active.value
    subscription.started_at = datetime.now(timezone.utc)
    subscription.expires_at = None

    session.add(subscription)
    session.commit()
    session.refresh(subscription)

    return get_landlord_subscription_response(session, auth.user.id)
