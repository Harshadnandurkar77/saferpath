"""create durable job runs foundation

Revision ID: 0001_job_runs
Revises:
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001_job_runs"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Required before later revisions create geometry/geography columns and GIST indexes.
    # Managed providers may require this to be enabled by a database administrator.
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table(
        "job_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_type", sa.String(length=100), nullable=False),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_class", sa.String(length=255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_type", "idempotency_key", name="uq_job_runs_type_key"),
    )


def downgrade() -> None:
    op.drop_table("job_runs")
