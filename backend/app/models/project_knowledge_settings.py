import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ProjectKnowledgeSettings(Base):
    __tablename__ = "project_knowledge_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, unique=True)
    vector_store_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_sync_status: Mapped[str] = mapped_column(String(50), nullable=False, default="idle")
    last_sync_started_at: Mapped[datetime | None] = mapped_column(DateTime(), nullable=True)
    last_sync_finished_at: Mapped[datetime | None] = mapped_column(DateTime(), nullable=True)
    last_sync_error: Mapped[str | None] = mapped_column(Text(), nullable=True)
    last_sync_summary_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
