"""Add last_search_at and last_email_at columns to user_preferences

Revision ID: 001
Revises:
Create Date: 2026-01-17
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing columns to user_preferences table
    op.add_column('user_preferences', sa.Column('last_search_at', sa.DateTime(), nullable=True))
    op.add_column('user_preferences', sa.Column('last_email_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('user_preferences', 'last_email_at')
    op.drop_column('user_preferences', 'last_search_at')
