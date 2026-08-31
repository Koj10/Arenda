from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, select

from app.enums import PLAN_LIMITS, Plan, Role
from app.models import Object, Tenant, Unit
from app.schemas.subscription import LandlordSubscriptionResponse, LimitItem
from app.services.users import get_or_create_subscription


def get_plan_limits(plan: str) -> dict:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS[Plan.start.value])


def get_counts(session: Session, user_id: int) -> dict:
    objects_count = (
        session.exec(
            select(func.count(Object.id)).where(Object.user_id == user_id)
        ).first()
        or 0
    )

    tenants_count = (
        session.exec(
            select(func.count(Tenant.id)).where(Tenant.user_id == user_id)
        ).first()
        or 0
    )

    units_count = (
        session.exec(
            select(func.count(Unit.id))
            .join(Object, Unit.object_id == Object.id)
            .where(Object.user_id == user_id)
        ).first()
        or 0
    )

    return {
        "objects": objects_count,
        "tenants": tenants_count,
        "units": units_count,
    }


def build_limit_item(limit: int, occupied: int) -> LimitItem:
    return LimitItem(
        limit=limit,
        occupied=occupied,
        display=f"{occupied}/{limit}",
    )


def get_landlord_subscription_response(
    session: Session,
    user_id: int,
) -> LandlordSubscriptionResponse:
    subscription = get_or_create_subscription(
        session=session,
        user_id=user_id,
        role=Role.landlord.value,
    )

    limits = get_plan_limits(subscription.plan)
    counts = get_counts(session, user_id)

    return LandlordSubscriptionResponse(
        plan=subscription.plan,
        status=subscription.status,
        started_at=subscription.started_at,
        expires_at=subscription.expires_at,
        objects=build_limit_item(limits["objects"], counts["objects"]),
        tenants=build_limit_item(limits["tenants"], counts["tenants"]),
        units=build_limit_item(limits["units"], counts["units"]),
    )


def ensure_object_limit(session: Session, user_id: int) -> None:
    subscription = get_or_create_subscription(
        session=session,
        user_id=user_id,
        role=Role.landlord.value,
    )

    limits = get_plan_limits(subscription.plan)
    counts = get_counts(session, user_id)

    if counts["objects"] >= limits["objects"]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Object limit reached. Please upgrade subscription.",
        )


def ensure_tenant_limit(session: Session, user_id: int) -> None:
    subscription = get_or_create_subscription(
        session=session,
        user_id=user_id,
        role=Role.landlord.value,
    )

    limits = get_plan_limits(subscription.plan)
    counts = get_counts(session, user_id)

    if counts["tenants"] >= limits["tenants"]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Tenant limit reached. Please upgrade subscription.",
        )


def ensure_unit_limit(session: Session, user_id: int) -> None:
    subscription = get_or_create_subscription(
        session=session,
        user_id=user_id,
        role=Role.landlord.value,
    )

    limits = get_plan_limits(subscription.plan)
    counts = get_counts(session, user_id)

    if limits["units"] <= 0:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Unit creation requires profi subscription.",
        )

    if counts["units"] >= limits["units"]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Unit limit reached. Please upgrade subscription.",
        )
