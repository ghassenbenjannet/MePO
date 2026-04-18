import uuid
from datetime import datetime

from sqlalchemy import DateTime, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AIActionProposal(Base):
    __tablename__ = "ai_action_proposals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    space_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    topic_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON(), nullable=False, default=dict)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="proposed")
    execution_message: Mapped[str | None] = mapped_column(Text(), nullable=True)
    execution_result: Mapped[dict | None] = mapped_column(JSON(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
