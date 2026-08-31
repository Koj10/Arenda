from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import Index, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from app.enums import (
    UTILITY_CRITERIA,
    InvoiceKind,
    InvoiceStatus,
    Payer,
    Plan,
    Role,
    SubscriptionStatus,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def default_utility_payers() -> dict:
    return {criterion: Payer.tenant.value for criterion in UTILITY_CRITERIA}


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    password_hash: Optional[str] = Field(default=None)
    provider: Optional[str] = Field(default=None)
    provider_id: Optional[str] = Field(default=None)
    terms_accepted_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow)

    user_roles: List["UserRole"] = Relationship(back_populates="user")


class UserRole(SQLModel, table=True):
    __tablename__ = "user_roles"

    user_id: Optional[int] = Field(
        default=None,
        foreign_key="users.id",
        primary_key=True,
    )
    role: str = Field(primary_key=True)

    user: Optional[User] = Relationship(back_populates="user_roles")


class Subscription(SQLModel, table=True):
    __tablename__ = "subscriptions"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    plan: str = Field(default=Plan.start.value, index=True)
    status: str = Field(default=SubscriptionStatus.active.value, index=True)
    started_at: datetime = Field(default_factory=utcnow)
    expires_at: Optional[datetime] = Field(default=None)


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    title: str
    body: str
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=utcnow, index=True)


class Object(SQLModel, table=True):
    __tablename__ = "objects"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    address: str = Field(index=True)
    type: str = Field(default="office", index=True)
    total_area: Decimal = Field(sa_type=Numeric(12, 2))
    created_at: datetime = Field(default_factory=utcnow)

    units: List["Unit"] = Relationship(back_populates="linked_object")
    cadastre_entries: List["CadastreEntry"] = Relationship(back_populates="linked_object")
    utility_bills: List["UtilityBill"] = Relationship(back_populates="linked_object")
    transactions: List["Transaction"] = Relationship(back_populates="linked_object")


class CadastreEntry(SQLModel, table=True):
    __tablename__ = "cadastre_entries"
    __table_args__ = (
        UniqueConstraint(
            "object_id", "number", name="uq_cadastre_entries_object_number"
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    object_id: int = Field(foreign_key="objects.id", index=True)
    number: str = Field(index=True)
    cadastral_value: Decimal = Field(sa_type=Numeric(12, 2))
    purchase_price: Optional[Decimal] = Field(default=None, sa_type=Numeric(12, 2))

    linked_object: Optional[Object] = Relationship(back_populates="cadastre_entries")
    units: List["Unit"] = Relationship(back_populates="cadastre")


class Unit(SQLModel, table=True):
    __tablename__ = "units"

    id: Optional[int] = Field(default=None, primary_key=True)
    object_id: int = Field(foreign_key="objects.id", index=True)
    number: str = Field(index=True)
    area: Decimal = Field(sa_type=Numeric(12, 2))
    rent_rate: Optional[Decimal] = Field(default=None, sa_type=Numeric(12, 2))
    cadastre_id: Optional[int] = Field(
        default=None, foreign_key="cadastre_entries.id", index=True
    )
    utility_payers: dict = Field(default_factory=default_utility_payers, sa_type=JSONB)
    created_at: datetime = Field(default_factory=utcnow)

    linked_object: Optional[Object] = Relationship(back_populates="units")
    cadastre: Optional[CadastreEntry] = Relationship(back_populates="units")
    leases: List["Lease"] = Relationship(back_populates="unit")


class Tenant(SQLModel, table=True):
    __tablename__ = "tenants"
    __table_args__ = (
        UniqueConstraint("user_id", "inn", name="uq_tenants_user_inn"),
        Index("ix_tenants_inn", "inn"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    name: str = Field(index=True)
    inn: str
    created_at: datetime = Field(default_factory=utcnow)

    leases: List["Lease"] = Relationship(back_populates="tenant")


class Lease(SQLModel, table=True):
    __tablename__ = "leases"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    unit_id: int = Field(foreign_key="units.id", index=True)
    rent_monthly: Decimal = Field(sa_type=Numeric(12, 2))
    start_date: Optional[date] = Field(default=None)
    end_date: date
    created_at: datetime = Field(default_factory=utcnow)

    tenant: Optional[Tenant] = Relationship(back_populates="leases")
    unit: Optional[Unit] = Relationship(back_populates="leases")


class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    type: str = Field(index=True)
    title: str
    amount: Decimal = Field(sa_type=Numeric(12, 2))
    category: str = Field(index=True)
    object_id: Optional[int] = Field(default=None, foreign_key="objects.id", index=True)
    comment: Optional[str] = Field(default=None)
    transaction_date: date = Field(index=True)  # <--- ИСПРАВЛЕНО (было date: date)
    created_at: datetime = Field(default_factory=utcnow)

    linked_object: Optional[Object] = Relationship(back_populates="transactions")


class UtilityBill(SQLModel, table=True):
    __tablename__ = "utility_bills"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    object_id: int = Field(foreign_key="objects.id", index=True)
    file_id: Optional[int] = Field(default=None, foreign_key="files.id", index=True)
    title: str
    period: str = Field(index=True)
    pay_by: date
    amounts: dict = Field(sa_type=JSONB)
    total: Decimal = Field(sa_type=Numeric(12, 2))
    landlord_loss: Decimal = Field(default=Decimal("0"), sa_type=Numeric(12, 2))
    allocations: list = Field(default_factory=list, sa_type=JSONB)
    created_at: datetime = Field(default_factory=utcnow)

    linked_object: Optional[Object] = Relationship(back_populates="utility_bills")
    invoices: List["Invoice"] = Relationship(back_populates="source_bill")


class MeterReading(SQLModel, table=True):
    __tablename__ = "meter_readings"
    __table_args__ = (
        UniqueConstraint(
            "unit_id", "criterion", "period", name="uq_meter_readings_unit_criterion_period"
        ),
        Index("ix_meter_readings_object_period", "object_id", "period"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    object_id: int = Field(foreign_key="objects.id", index=True)
    unit_id: int = Field(foreign_key="units.id", index=True)
    criterion: str = Field(index=True)
    period: str = Field(index=True)
    previous_value: Decimal = Field(sa_type=Numeric(14, 4))
    current_value: Decimal = Field(sa_type=Numeric(14, 4))
    submitted_by_role: str
    submitted_by_user_id: int = Field(foreign_key="users.id")
    updated_at: datetime = Field(default_factory=utcnow)


class Invoice(SQLModel, table=True):
    __tablename__ = "invoices"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    unit_id: Optional[int] = Field(default=None, foreign_key="units.id", index=True)
    kind: str = Field(default=InvoiceKind.rent.value, index=True)
    source_bill_id: Optional[int] = Field(
        default=None, foreign_key="utility_bills.id", index=True
    )
    period: str = Field(index=True)
    amount: Decimal = Field(sa_type=Numeric(12, 2))
    due_date: date = Field(index=True)
    status: str = Field(default=InvoiceStatus.pending.value, index=True)
    paid_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow)

    source_bill: Optional[UtilityBill] = Relationship(back_populates="invoices")


class File(SQLModel, table=True):
    __tablename__ = "files"
    __table_args__ = (Index("ix_files_linked", "linked_type", "linked_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    original_name: str
    storage_key: str = Field(unique=True, index=True)
    mime_type: Optional[str] = Field(default=None)
    size: int
    kind: Optional[str] = Field(default=None, index=True)
    linked_type: Optional[str] = Field(default=None)
    linked_id: Optional[int] = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow)


class TenantProfile(SQLModel, table=True):
    __tablename__ = "tenant_profiles"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)
    company_name: str
    inn: str = Field(index=True)
    created_at: datetime = Field(default_factory=utcnow)
