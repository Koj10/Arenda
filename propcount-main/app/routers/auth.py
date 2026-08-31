import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from jose import jwt as jose_jwt
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db import get_session
from app.enums import Role
from app.models import User
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserPublic,
)
from app.schemas.common import Message
from app.services.users import (
    default_role,
    ensure_role,
    get_or_create_oauth_user,
    get_or_create_subscription,
    get_roles,
)

router = APIRouter(prefix="/auth")


def build_auth_response(
    session: Session,
    user: User,
    role: str | None = None,
    *,
    assign_missing_role: bool = True,
) -> AuthResponse:
    roles = get_roles(session, user.id)

    if not roles and assign_missing_role:
        ensure_role(session, user, Role.landlord.value)
        roles = get_roles(session, user.id)

    if role and role not in roles and assign_missing_role:
        ensure_role(session, user, role)
        roles = get_roles(session, user.id)

    if role and role in roles:
        chosen = role
    elif roles:
        chosen = default_role(roles)
    else:
        chosen = ""

    if chosen:
        get_or_create_subscription(session, user.id, chosen)

    access_token = create_access_token(user.id, chosen)
    refresh_token = create_refresh_token(user.id, chosen)

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserPublic.model_validate(user),
        roles=roles,
        current_role=chosen,
    )


@router.post(
    "/register",
    summary="Регистрация",
    description="Регистрация нового пользователя",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: RegisterRequest,
    session: Session = Depends(get_session),
):
    existing_user = session.exec(
        select(User).where(User.email == payload.email)
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        terms_accepted_at=datetime.now(timezone.utc),
    )

    session.add(user)
    session.commit()
    session.refresh(user)

    return build_auth_response(session, user, assign_missing_role=False)


@router.post(
    "/login",
    summary="Вход",
    description="Вход в систему",
    response_model=AuthResponse,
)
def login(
    payload: LoginRequest,
    session: Session = Depends(get_session),
):
    user = session.exec(select(User).where(User.email == payload.email)).first()

    if (
        not user
        or not user.password_hash
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return build_auth_response(session, user)


@router.post(
    "/refresh",
    summary="Обновление токенов",
    response_model=AuthResponse,
)
def refresh_tokens(
    payload: RefreshRequest,
    session: Session = Depends(get_session),
):
    token_payload = decode_token(payload.refresh_token, expected_type="refresh")

    try:
        user_id = int(token_payload.get("sub"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        ) from exc

    user = session.get(User, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    role = token_payload.get("role")
    roles = get_roles(session, user.id)

    if role not in roles:
        role = default_role(roles)

    return build_auth_response(session, user, role)


@router.post(
    "/logout",
    summary="Выход",
    description="Выход из системы",
    response_model=Message,
)
def logout():
    return Message(detail="Logged out")


@router.post(
    "/forgot-password",
    summary="Запрос на сброс пароля",
    description="Запрос на сброс пароля",
    response_model=ForgotPasswordResponse,
)
def forgot_password(
    payload: ForgotPasswordRequest,
    session: Session = Depends(get_session),
):
    user = session.exec(select(User).where(User.email == payload.email)).first()

    if not user:
        return ForgotPasswordResponse(
            detail="If this email exists, a reset token was generated",
            reset_token=None,
        )

    reset_token = create_password_reset_token(user.id)

    return ForgotPasswordResponse(
        detail="Dev mode: reset token returned directly",
        reset_token=reset_token,
    )


@router.post(
    "/reset-password",
    summary="Сброс пароля",
    response_model=Message,
)
def reset_password(
    payload: ResetPasswordRequest,
    session: Session = Depends(get_session),
):
    token_payload = decode_token(payload.token, expected_type="reset")

    try:
        user_id = int(token_payload.get("sub"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token",
        ) from exc

    user = session.get(User, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token",
        )

    user.password_hash = hash_password(payload.password)

    session.add(user)
    session.commit()

    return Message(detail="Password updated")


@router.get("/google")
def auth_google():
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured",
        )

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
    }

    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return RedirectResponse(url)


@router.get("/google/callback", response_model=AuthResponse)
def google_callback(
    session: Session = Depends(get_session),
    code: str | None = None,
    error: str | None = None,
):
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google OAuth error: {error}",
        )

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google OAuth code",
        )

    token_url = "https://oauth2.googleapis.com/token"

    token_data = {
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.google_redirect_uri,
    }

    with httpx.Client(timeout=10.0) as client:
        token_response = client.post(token_url, data=token_data)

    if token_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange Google authorization code",
        )

    access_token = token_response.json().get("access_token")

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google access token not found",
        )

    with httpx.Client(timeout=10.0) as client:
        userinfo_response = client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to fetch Google user info",
        )

    userinfo = userinfo_response.json()

    provider_id = userinfo.get("id") or userinfo.get("sub")
    email = userinfo.get("email")
    name = userinfo.get("name") or (email.split("@")[0] if email else "Google User")

    if not provider_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google user data is incomplete",
        )

    user = get_or_create_oauth_user(
        session=session,
        provider="google",
        provider_id=str(provider_id),
        email=email,
        name=name,
    )

    return build_auth_response(session, user)


@router.get("/apple")
def auth_apple():
    if not settings.apple_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Apple OAuth is not configured",
        )

    params = {
        "client_id": settings.apple_client_id,
        "redirect_uri": settings.apple_redirect_uri,
        "response_type": "code id_token",
        "scope": "name email",
        "response_mode": "form_post",
        "state": "apple-auth",
    }

    url = f"https://appleid.apple.com/auth/authorize?{urlencode(params)}"
    return RedirectResponse(url)


def create_apple_client_secret() -> str:
    private_key = settings.apple_private_key

    if settings.apple_private_key_path:
        private_key = Path(settings.apple_private_key_path).read_text()
    elif private_key:
        private_key = private_key.replace("\\n", "\n")

    if (
        not settings.apple_team_id
        or not settings.apple_client_id
        or not settings.apple_key_id
        or not private_key
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Apple OAuth is not configured",
        )

    now = int(time.time())

    payload = {
        "iss": settings.apple_team_id,
        "iat": now,
        "exp": now + 15777000,
        "aud": "https://appleid.apple.com",
        "sub": settings.apple_client_id,
    }

    return jose_jwt.encode(
        payload,
        private_key,
        algorithm="ES256",
        headers={"kid": settings.apple_key_id},
    )


@router.api_route(
    "/apple/callback",
    methods=["GET", "POST"],
    response_model=AuthResponse,
)
async def apple_callback(
    request: Request,
    session: Session = Depends(get_session),
):
    data = {}
    data.update(dict(request.query_params))

    if request.method == "POST":
        form = await request.form()
        data.update(dict(form))

    error = data.get("error")

    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Apple OAuth error: {error}",
        )

    code = data.get("code")
    id_token = data.get("id_token")
    user_payload = data.get("user")

    email = None
    name = None

    if user_payload:
        try:
            user_info = json.loads(user_payload)
            email = user_info.get("email") or email

            name_data = user_info.get("name") or {}
            first_name = name_data.get("firstName", "")
            last_name = name_data.get("lastName", "")

            full_name = f"{first_name} {last_name}".strip()

            if full_name:
                name = full_name
        except json.JSONDecodeError:
            pass

    if code:
        client_secret = create_apple_client_secret()

        token_data = {
            "client_id": settings.apple_client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": settings.apple_redirect_uri,
        }

        with httpx.Client(timeout=10.0) as client:
            token_response = client.post(
                "https://appleid.apple.com/auth/token",
                data=token_data,
            )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange Apple authorization code",
            )

        token_json = token_response.json()
        id_token = token_json.get("id_token", id_token)

    provider_id = None

    if id_token:
        try:
            claims = jose_jwt.get_unverified_claims(id_token)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Apple id_token",
            ) from exc

        provider_id = claims.get("sub")
        email = email or claims.get("email")

    if not provider_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not determine Apple user id",
        )

    if not email:
        email = f"{provider_id}@privaterelay.appleid.com"

    if not name:
        name = email.split("@")[0]

    user = get_or_create_oauth_user(
        session=session,
        provider="apple",
        provider_id=str(provider_id),
        email=email,
        name=name,
    )

    return build_auth_response(session, user)
