import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AIUseCaseSnapshot(Base):
    """Snapshot du contexte métier utilisé pour un business_turn.
    Les follow_up suivants peuvent le réutiliser sans relancer le retrieval.
    """
    __tablename__ = "ai_use_case_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("ai_conversations.id"), nullable=False)
    trigger_message_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    use_case: Mapped[str] = mapped_column(String(50), nullable=False)
    topic_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    skill_version_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    corpus_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_object_ids: Mapped[list] = mapped_column(JSON(), default=list, nullable=False)
    document_ids: Mapped[list] = mapped_column(JSON(), default=list, nullable=False)
    summary_version: Mapped[int] = mapped_column(nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
