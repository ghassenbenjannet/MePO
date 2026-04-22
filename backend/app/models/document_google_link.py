import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DocumentGoogleLink(Base):
    __tablename__ = "document_google_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), nullable=False, unique=True)
    google_file_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_web_url: Mapped[str | None] = mapped_column(Text(), nullable=True)
    google_mime_type: Mapped[str | None] = mapped_column(String(150), nullable=True)
    sync_status: Mapped[str] = mapped_column(String(30), nullable=False, default="queued")
    last_synced_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text(), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
