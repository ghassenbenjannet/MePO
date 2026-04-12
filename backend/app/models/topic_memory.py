import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TopicMemory(Base):
    __tablename__ = "topic_memories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), nullable=False)
    facts: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    decisions: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    risks: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    dependencies: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    open_questions: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
