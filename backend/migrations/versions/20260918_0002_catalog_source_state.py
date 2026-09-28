"""Add source verification state for the curated legal catalog.

Revision ID: 20260918_0002
Revises: 20260918_0001
Create Date: 2026-09-18 00:30:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260918_0002"
down_revision: str | Sequence[str] | None = "20260918_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("legal_documents", sa.Column("jurisdiction", sa.String(length=16), nullable=True))
    op.add_column("legal_documents", sa.Column("legal_level", sa.String(length=64), nullable=True))
    op.create_index("ix_legal_documents_jurisdiction", "legal_documents", ["jurisdiction"])
    op.create_index("ix_legal_documents_legal_level", "legal_documents", ["legal_level"])

    op.add_column(
        "document_versions",
        sa.Column(
            "content_state",
            sa.String(length=32),
            server_default=sa.text("'verified_text'"),
            nullable=False,
        ),
    )
    op.add_column("document_versions", sa.Column("source_checked_at", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("document_versions", "source_checked_at")
    op.drop_column("document_versions", "content_state")
    op.drop_index("ix_legal_documents_legal_level", table_name="legal_documents")
    op.drop_index("ix_legal_documents_jurisdiction", table_name="legal_documents")
    op.drop_column("legal_documents", "legal_level")
    op.drop_column("legal_documents", "jurisdiction")
