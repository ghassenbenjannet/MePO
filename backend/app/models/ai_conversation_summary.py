import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AIConversationSummary(Base):
    __tablename__ = "ai_conversation_summaries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("ai_conversations.id"), nullable=False)
    summary_text: Mapped[str] = mapped_column(Text(), nullable=False, default="")
    summary_version: Mapped[int] = mapped_column(nullable=False, default=1)
    last_message_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
