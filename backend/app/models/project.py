import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text(), nullable=True)
    openai_strategy: Mapped[str] = mapped_column(String(80), nullable=False, default="responses_plus_conversation")
    active_skill_version_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
    # OpenAI vector store ID for knowledge doc semantic search at runtime
    openai_vector_store_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
