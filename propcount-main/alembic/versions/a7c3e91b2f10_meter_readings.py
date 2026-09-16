"""meter readings and bill losses

Revision ID: a7c3e91b2f10
Revises: df63e52465f4
Create Date: 2026-08-31 15:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a7c3e91b2f10"
down_revision = "df63e52465f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "utility_bills",
        sa.Column(
            "landlord_loss",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "utility_bills",
        sa.Column(
            "allocations",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.create_table(
        "meter_readings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("object_id", sa.Integer(), nullable=False),
        sa.Column("unit_id", sa.Integer(), nullable=False),
        sa.Column("criterion", sa.String(), nullable=False),
        sa.Column("period", sa.String(), nullable=False),
        sa.Column("previous_value", sa.Numeric(14, 4), nullable=False),
        sa.Column("current_value", sa.Numeric(14, 4), nullable=False),
        sa.Column("submitted_by_role", sa.String(), nullable=False),
        sa.Column("submitted_by_user_id", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["object_id"], ["objects.id"]),
        sa.ForeignKeyConstraint(["unit_id"], ["units.id"]),
        sa.ForeignKeyConstraint(["submitted_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "unit_id",
            "criterion",
            "period",
            name="uq_meter_readings_unit_criterion_period",
        ),
    )
    op.create_index(
        op.f("ix_meter_readings_object_id"), "meter_readings", ["object_id"], unique=False
    )
    op.create_index(
        op.f("ix_meter_readings_unit_id"), "meter_readings", ["unit_id"], unique=False
    )
    op.create_index(
        op.f("ix_meter_readings_criterion"), "meter_readings", ["criterion"], unique=False
    )
    op.create_index(
        op.f("ix_meter_readings_period"), "meter_readings", ["period"], unique=False
    )
    op.create_index(
        "ix_meter_readings_object_period",
        "meter_readings",
        ["object_id", "period"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_meter_readings_object_period", table_name="meter_readings")
    op.drop_index(op.f("ix_meter_readings_period"), table_name="meter_readings")
    op.drop_index(op.f("ix_meter_readings_criterion"), table_name="meter_readings")
    op.drop_index(op.f("ix_meter_readings_unit_id"), table_name="meter_readings")
    op.drop_index(op.f("ix_meter_readings_object_id"), table_name="meter_readings")
    op.drop_table("meter_readings")
    op.drop_column("utility_bills", "allocations")
    op.drop_column("utility_bills", "landlord_loss")
