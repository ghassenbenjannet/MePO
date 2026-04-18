import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ProjectKnowledgeSyncItem(Base):
    __tablename__ = "project_knowledge_sync_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False)
    knowledge_document_id: Mapped[str] = mapped_column(ForeignKey("project_knowledge_documents.id"), nullable=False)
    vector_store_id: Mapped[str] = mapped_column(String(100), nullable=False)
    openai_file_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    openai_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_hash_synced: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sync_status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text(), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
