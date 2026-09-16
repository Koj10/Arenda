from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import AuthContext, get_current_auth
from app.core.security import create_access_token, create_refresh_token
from app.db import get_session
from app.enums import Role
from app.models import TenantProfile
from app.schemas.auth import (
    AuthResponse,
    MeResponse,
    SelectRoleRequest,
    TenantProfileOut,
    TenantProfileUpdate,
    UserPublic,
)
from app.services.users import (
    ensure_role,
    get_or_create_subscription,
    get_roles,
)
from app.utils.inn import normalize_inn

router = APIRouter(prefix="/me")


@router.get(
    "", summary="Профиль", description="Личный профиль", response_model=MeResponse
)
def me(
    auth: AuthContext = Depends(get_current_auth),
    session: Session = Depends(get_session),
):
    user = auth.user
    roles = get_roles(session, user.id)

    tenant_profile = session.exec(
        select(TenantProfile).where(TenantProfile.user_id == user.id)
    ).first()

    return MeResponse(
        user=UserPublic.model_validate(user),
        roles=roles,
        current_role=auth.role,
        tenant_profile=(
            TenantProfileOut.model_validate(tenant_profile) if tenant_profile else None
        ),
    )


@router.post(
    "/select-role",
    summary="Выбор роли",
    description="Выбирает роль для доступа к ресурсам",
    response_model=AuthResponse,
)
def select_role(
    payload: SelectRoleRequest,
    auth: AuthContext = Depends(get_current_auth),
    session: Session = Depends(get_session),
):
    user = auth.user
    role = payload.role.value

    ensure_role(session, user, role)
    get_or_create_subscription(session, user.id, role)

    roles = get_roles(session, user.id)

    access_token = create_access_token(user.id, role)
    refresh_token = create_refresh_token(user.id, role)

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserPublic.model_validate(user),
        roles=roles,
        current_role=role,
    )


@router.get(
    "/tenant-profile",
    summary="Профиль арендатора",
    description="Возвращает профиль арендатора",
    response_model=TenantProfileOut,
)
def get_tenant_profile(
    auth: AuthContext = Depends(get_current_auth),
    session: Session = Depends(get_session),
):
    profile = session.exec(
        select(TenantProfile).where(TenantProfile.user_id == auth.user.id)
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant profile not found",
        )

    return TenantProfileOut.model_validate(profile)


@router.patch(
    "/tenant-profile",
    summary="Обновление профиля арендатора",
    description="Обновляет профиль арендатора",
    response_model=TenantProfileOut,
)
def update_tenant_profile(
    payload: TenantProfileUpdate,
    auth: AuthContext = Depends(get_current_auth),
    session: Session = Depends(get_session),
):
    profile = session.exec(
        select(TenantProfile).where(TenantProfile.user_id == auth.user.id)
    ).first()

    if profile:
        if payload.company_name is not None:
            profile.company_name = payload.company_name

        if payload.inn is not None:
            profile.inn = normalize_inn(payload.inn)
    else:
        if not payload.company_name or not payload.inn:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="company_name and inn are required to create tenant profile",
            )

        profile = TenantProfile(
            user_id=auth.user.id,
            company_name=payload.company_name,
            inn=normalize_inn(payload.inn),
        )

    session.add(profile)
    session.commit()
    session.refresh(profile)

    return TenantProfileOut.model_validate(profile)
