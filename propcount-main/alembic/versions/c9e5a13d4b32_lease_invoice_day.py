"""lease invoice day

Revision ID: c9e5a13d4b32
Revises: b8d4f02c3a21
Create Date: 2026-08-31 18:20:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "c9e5a13d4b32"
down_revision = "b8d4f02c3a21"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "leases",
        sa.Column("invoice_day", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("leases", "invoice_day")
