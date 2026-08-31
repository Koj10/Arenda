import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    password_hash = hashlib.sha512(password.encode()).hexdigest()
    return pwd_context.hash(password_hash)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_hash = hashlib.sha512(plain_password.encode()).hexdigest()
    return pwd_context.verify(password_hash, hashed_password)


def _create_token(
    user_id: int,
    role: str,
    token_type: str,
    expires_delta: timedelta,
) -> str:
    now = datetime.now(timezone.utc)

    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def create_access_token(user_id: int, role: str) -> str:
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    return _create_token(
        user_id=user_id,
        role=role,
        token_type="access",
        expires_delta=expires_delta,
    )


def create_refresh_token(user_id: int, role: str) -> str:
    expires_delta = timedelta(days=settings.refresh_token_expire_days)
    return _create_token(
        user_id=user_id,
        role=role,
        token_type="refresh",
        expires_delta=expires_delta,
    )


def create_password_reset_token(user_id: int) -> str:
    expires_delta = timedelta(minutes=settings.password_reset_expire_minutes)
    return _create_token(
        user_id=user_id,
        role="",
        token_type="reset",
        expires_delta=expires_delta,
    )


def decode_token(token: str, expected_type: str) -> Dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:
        raise credentials_exception from exc

    if payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("sub") is None:
        raise credentials_exception

    return payload
