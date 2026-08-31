from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.enums import Role


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    password_confirm: str = Field(min_length=8, max_length=128)
    terms: bool

    @model_validator(mode="after")
    def validate_payload(self):
        if self.password != self.password_confirm:
            raise ValueError("Passwords do not match")

        if not self.terms:
            raise ValueError("Terms must be accepted")

        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    detail: str
    reset_token: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)
    password_confirm: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def validate_payload(self):
        if self.password != self.password_confirm:
            raise ValueError("Passwords do not match")

        return self


class SelectRoleRequest(BaseModel):
    role: Role


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    provider: Optional[str] = None
    created_at: datetime


class TenantProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    company_name: str
    inn: str
    created_at: datetime


class TenantProfileUpdate(BaseModel):
    company_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    inn: Optional[str] = Field(default=None, min_length=1, max_length=32)


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserPublic
    roles: List[str]
    current_role: str


class MeResponse(BaseModel):
    user: UserPublic
    roles: List[str]
    current_role: str
    tenant_profile: Optional[TenantProfileOut] = None
