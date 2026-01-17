"""Add last_search_at and last_email_at columns to user_preferences

Revision ID: 001
Revises:
Create Date: 2026-01-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Add missing columns to user_preferences table (idempotent)
    if not column_exists('user_preferences', 'last_search_at'):
        op.add_column('user_preferences', sa.Column('last_search_at', sa.DateTime(), nullable=True))
    if not column_exists('user_preferences', 'last_email_at'):
        op.add_column('user_preferences', sa.Column('last_email_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    if column_exists('user_preferences', 'last_email_at'):
        op.drop_column('user_preferences', 'last_email_at')
    if column_exists('user_preferences', 'last_search_at'):
        op.drop_column('user_preferences', 'last_search_at')
