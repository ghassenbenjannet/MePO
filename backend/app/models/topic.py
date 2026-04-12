import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    priority: Mapped[str] = mapped_column(String(50), default="medium", nullable=False)
    teams: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    risks: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    open_questions: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
