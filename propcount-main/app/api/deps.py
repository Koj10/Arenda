from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.core.security import decode_token
from app.db import get_session
from app.enums import Role
from app.models import User
from app.services.users import default_role, get_roles

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    user: User
    role: str


def get_current_payload(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return decode_token(credentials.credentials, "access")


def get_current_user(
    payload: dict = Depends(get_current_payload),
    session: Session = Depends(get_session),
) -> User:
    try:
        user_id = int(payload.get("sub"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = session.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_auth(
    user: User = Depends(get_current_user),
    payload: dict = Depends(get_current_payload),
    session: Session = Depends(get_session),
) -> AuthContext:
    role = payload.get("role")
    roles = get_roles(session, user.id)

    valid_roles = [Role.landlord.value, Role.tenant.value]

    if role not in valid_roles:
        role = default_role(roles)
    elif roles and role not in roles:
        role = default_role(roles)
    elif not roles:
        role = Role.landlord.value

    return AuthContext(user=user, role=role)


def require_landlord(
    auth: AuthContext = Depends(get_current_auth),
) -> AuthContext:
    if auth.role != Role.landlord.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Landlord role required",
        )

    return auth


def require_tenant(
    auth: AuthContext = Depends(get_current_auth),
) -> AuthContext:
    if auth.role != Role.tenant.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant role required",
        )

    return auth
