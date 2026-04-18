import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ProjectKnowledgeDocument(Base):
    __tablename__ = "project_knowledge_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False)
    scope: Mapped[str] = mapped_column(String(50), nullable=False, default="project")
    document_type: Mapped[str] = mapped_column(String(100), nullable=False, default="reference")
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="reference")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, default="upload")
    local_file_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(150), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text(), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    linked_topic_ids: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    content_extracted_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    sync_status: Mapped[str] = mapped_column(String(50), nullable=False, default="not_synced")
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(), nullable=True)
    sync_error: Mapped[str | None] = mapped_column(Text(), nullable=True)
    openai_file_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
