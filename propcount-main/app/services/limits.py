from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, select

from app.enums import PLAN_LIMITS, Plan, Role
from app.models import Object, Tenant, Unit
from app.schemas.subscription import LandlordSubscriptionResponse, LimitItem
from app.services.users import get_or_create_subscription


def as_int(value) -> int:
    if value is None:
        return 0
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    if hasattr(value, "__getitem__") and not isinstance(value, (str, bytes)):
        try:
            return as_int(value[0])
        except Exception:
            return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def get_plan_limits(plan: str) -> dict:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS[Plan.start.value])


def get_counts(session: Session, user_id: int) -> dict:
    objects_count = as_int(
        session.exec(
            select(func.count()).select_from(Object).where(Object.user_id == user_id)
        ).one()
    )

    tenants_count = as_int(
        session.exec(
            select(func.count()).select_from(Tenant).where(Tenant.user_id == user_id)
        ).one()
    )

    units_count = as_int(
        session.exec(
            select(func.count())
            .select_from(Unit)
            .join(Object, Unit.object_id == Object.id)
            .where(Object.user_id == user_id)
        ).one()
    )

    return {
        "objects": objects_count,
        "tenants": tenants_count,
        "units": units_count,
    }


def count_units_for_object(session: Session, object_id: int) -> int:
    return as_int(
        session.exec(
            select(func.count()).select_from(Unit).where(Unit.object_id == object_id)
        ).one()
    )


def build_limit_item(limit: int | None, occupied: int) -> LimitItem:
    if limit is None:
        return LimitItem(limit=-1, occupied=occupied, display=f"{occupied}/∞")
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

    unit_cap = limits.get("units_per_object")
    if unit_cap is None:
        unit_cap = limits.get("units")

    return LandlordSubscriptionResponse(
        plan=subscription.plan,
        status=subscription.status,
        started_at=subscription.started_at,
        expires_at=subscription.expires_at,
        objects=build_limit_item(limits["objects"], counts["objects"]),
        tenants=build_limit_item(limits["tenants"], counts["tenants"]),
        units=build_limit_item(unit_cap, counts["units"]),
    )


def ensure_object_limit(session: Session, user_id: int) -> None:
    subscription = get_or_create_subscription(
        session=session,
        user_id=user_id,
        role=Role.landlord.value,
    )

    limits = get_plan_limits(subscription.plan)
    counts = get_counts(session, user_id)
    cap = limits["objects"]

    if cap is not None and counts["objects"] >= cap:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Лимит объектов на текущем тарифе исчерпан. Перейдите на Profi.",
        )


def ensure_tenant_limit(session: Session, user_id: int) -> None:
    subscription = get_or_create_subscription(
        session=session,
        user_id=user_id,
        role=Role.landlord.value,
    )

    limits = get_plan_limits(subscription.plan)
    counts = get_counts(session, user_id)
    cap = limits["tenants"]

    if cap is not None and counts["tenants"] >= cap:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Лимит арендаторов на текущем тарифе исчерпан. Перейдите на Profi.",
        )


def ensure_unit_limit(session: Session, user_id: int, object_id: int) -> None:
    subscription = get_or_create_subscription(
        session=session,
        user_id=user_id,
        role=Role.landlord.value,
    )

    limits = get_plan_limits(subscription.plan)
    per_object = limits.get("units_per_object")

    if per_object is not None:
        occupied = count_units_for_object(session, object_id)
        if occupied >= per_object:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"На тарифе Start в одном объекте не больше {per_object} помещений.",
            )

    global_cap = limits.get("units")
    if global_cap is not None:
        counts = get_counts(session, user_id)
        if counts["units"] >= global_cap:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Лимит помещений исчерпан. Перейдите на Profi.",
            )
