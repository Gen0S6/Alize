"""Ensure last_search_at and last_email_at columns exist in user_preferences

This migration ensures the columns exist, in case migration 001 was recorded
as complete but the columns weren't actually added.

Revision ID: 002
Revises: 001
Create Date: 2026-01-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Ensure last_search_at column exists
    if not column_exists('user_preferences', 'last_search_at'):
        op.add_column('user_preferences', sa.Column('last_search_at', sa.DateTime(), nullable=True))

    # Ensure last_email_at column exists
    if not column_exists('user_preferences', 'last_email_at'):
        op.add_column('user_preferences', sa.Column('last_email_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Don't remove columns in downgrade - let migration 001 handle that
    pass
