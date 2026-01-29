"""add notification_max_jobs to user_preferences

Revision ID: 004_add_notification_max_jobs
Revises: 003_add_notification_preferences
Create Date: 2025-01-29 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "004_add_notification_max_jobs"
down_revision = "003_add_notification_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "notification_max_jobs",
            sa.Integer(),
            nullable=False,
            server_default="5",
        ),
    )
    op.alter_column(
        "user_preferences",
        "notification_max_jobs",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "notification_max_jobs")
