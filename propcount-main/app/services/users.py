from typing import List

from sqlmodel import Session, select

from app.enums import (
    LANDLORD_PLANS,
    TENANT_PLANS,
    Plan,
    Role,
    SubscriptionStatus,
)
from app.models import Subscription, User, UserRole


def get_roles(session: Session, user_id: int) -> List[str]:
    return session.exec(select(UserRole.role).where(UserRole.user_id == user_id)).all()


def has_role(session: Session, user: User, role: str) -> bool:
    return (
        session.exec(
            select(UserRole).where(
                UserRole.user_id == user.id,
                UserRole.role == role,
            )
        ).first()
        is not None
    )


def ensure_role(session: Session, user: User, role: str) -> None:
    if has_role(session, user, role):
        return

    user_role = UserRole(user_id=user.id, role=role)
    session.add(user_role)
    session.commit()


def default_role(roles: List[str]) -> str:
    if Role.landlord.value in roles:
        return Role.landlord.value

    if roles:
        return roles[0]

    return Role.landlord.value


def get_or_create_subscription(
    session: Session,
    user_id: int,
    role: str,
) -> Subscription:
    allowed_plans = LANDLORD_PLANS if role == Role.landlord.value else TENANT_PLANS

    statement = (
        select(Subscription)
        .where(
            Subscription.user_id == user_id,
            Subscription.status == SubscriptionStatus.active.value,
            Subscription.plan.in_(allowed_plans),
        )
        .order_by(Subscription.id.desc())
    )

    subscription = session.exec(statement).first()

    if subscription:
        return subscription

    plan = Plan.start.value if role == Role.landlord.value else Plan.tenant_free.value

    subscription = Subscription(
        user_id=user_id,
        plan=plan,
        status=SubscriptionStatus.active.value,
    )

    session.add(subscription)
    session.commit()
    session.refresh(subscription)

    return subscription


def get_or_create_oauth_user(
    session: Session,
    provider: str,
    provider_id: str,
    email: str,
    name: str,
) -> User:
    user = session.exec(
        select(User).where(
            User.provider == provider,
            User.provider_id == provider_id,
        )
    ).first()

    if user:
        return user

    user = session.exec(select(User).where(User.email == email)).first()

    if user:
        changed = False

        if not user.provider:
            user.provider = provider
            changed = True

        if not user.provider_id:
            user.provider_id = provider_id
            changed = True

        if changed:
            session.add(user)
            session.commit()
            session.refresh(user)

        ensure_role(session, user, Role.landlord.value)
        return user

    user = User(
        name=name,
        email=email,
        provider=provider,
        provider_id=provider_id,
    )

    session.add(user)
    session.commit()
    session.refresh(user)

    ensure_role(session, user, Role.landlord.value)

    return user
