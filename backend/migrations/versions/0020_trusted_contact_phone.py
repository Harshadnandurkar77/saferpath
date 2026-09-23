"""add optional trusted contact phone number

Revision ID: 0020_trusted_contact_phone
Revises: 0019_identity_onboarding
"""
import sqlalchemy as sa
from alembic import op

revision = "0020_trusted_contact_phone"
down_revision = "0019_identity_onboarding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trusted_contacts", sa.Column("phone_number", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("trusted_contacts", "phone_number")
