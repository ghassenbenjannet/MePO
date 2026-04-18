import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id"), nullable=False)
    topic_id: Mapped[str | None] = mapped_column(ForeignKey("topics.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    skill_version_id_snapshot: Mapped[str | None] = mapped_column(String(36), nullable=True)
    openai_conversation_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    openai_response_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary_memory: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
