import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, JSON, String, Text
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
    topic_nature: Mapped[str] = mapped_column(String(50), default="study_delivery", nullable=False)
    color: Mapped[str] = mapped_column(String(50), default="indigo", nullable=False)
    roadmap_start_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    roadmap_end_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    owner: Mapped[str | None] = mapped_column(String(255), nullable=True)
    teams: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    risks: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    dependencies: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    open_questions: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON(), default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
