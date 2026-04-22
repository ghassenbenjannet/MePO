import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("ai_conversations.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text(), nullable=False)
    use_case: Mapped[str | None] = mapped_column(String(50), nullable=True)
    turn_classification: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # business_turn | follow_up | micro_ack | local_system
    use_case_snapshot_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    payload_metadata: Mapped[dict] = mapped_column("metadata", JSON(), default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
