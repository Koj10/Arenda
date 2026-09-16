"""invoice payment fields

Revision ID: b8d4f02c3a21
Revises: a7c3e91b2f10
Create Date: 2026-08-31 17:40:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "b8d4f02c3a21"
down_revision = "a7c3e91b2f10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("payment_method", sa.String(), nullable=True))
    op.add_column("invoices", sa.Column("payment_submitted_at", sa.DateTime(), nullable=True))
    op.add_column("invoices", sa.Column("income_transaction_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_invoices_payment_method"), "invoices", ["payment_method"], unique=False)
    op.create_index(
        op.f("ix_invoices_income_transaction_id"),
        "invoices",
        ["income_transaction_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_invoices_income_transaction_id"), table_name="invoices")
    op.drop_index(op.f("ix_invoices_payment_method"), table_name="invoices")
    op.drop_column("invoices", "income_transaction_id")
    op.drop_column("invoices", "payment_submitted_at")
    op.drop_column("invoices", "payment_method")
