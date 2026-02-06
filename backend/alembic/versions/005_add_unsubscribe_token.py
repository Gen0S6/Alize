"""add unsubscribe_token to users

Revision ID: 005_add_unsubscribe_token
Revises: 004_add_notification_max_jobs
Create Date: 2025-02-06 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "005_add_unsubscribe_token"
down_revision = "004_add_notification_max_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = {col["name"] for col in inspector.get_columns("users")}

    if "unsubscribe_token" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "unsubscribe_token",
                sa.String(64),
                nullable=True,
                unique=True,
            ),
        )
        op.create_index(
            "ix_users_unsubscribe_token",
            "users",
            ["unsubscribe_token"],
            unique=True,
        )


def downgrade() -> None:
    op.drop_index("ix_users_unsubscribe_token", table_name="users")
    op.drop_column("users", "unsubscribe_token")
