import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ProjectDocumentSyncState(Base):
    """État agrégé de synchronisation documentaire Google par projet."""
    __tablename__ = "project_document_sync_states"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, unique=True)
    google_sync_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="queued"
    )  # queued | syncing | synced | stale | error
    corpus_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="not_indexed"
    )  # not_indexed | indexing | ready | stale | error
    active_corpus_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_sync_started_at: Mapped[datetime | None] = mapped_column(DateTime(), nullable=True)
    last_sync_finished_at: Mapped[datetime | None] = mapped_column(DateTime(), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text(), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
