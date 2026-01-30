"""add notification preferences to user_preferences

Revision ID: 003_add_notification_preferences
Revises: 002
Create Date: 2025-02-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "003_add_notification_preferences"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "notification_frequency",
            sa.String(length=20),
            nullable=False,
            server_default="every_3_days",
        ),
    )
    op.add_column(
        "user_preferences",
        sa.Column(
            "send_empty_digest",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.alter_column(
        "user_preferences",
        "notification_frequency",
        server_default=None,
    )
    op.alter_column(
        "user_preferences",
        "send_empty_digest",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "send_empty_digest")
    op.drop_column("user_preferences", "notification_frequency")
