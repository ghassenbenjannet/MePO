import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ProjectSkillVersion(Base):
    __tablename__ = "project_skill_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    skill_id: Mapped[str] = mapped_column(ForeignKey("project_skills.id"), nullable=False)
    version_label: Mapped[str] = mapped_column(String(50), nullable=False, default="v1")
    compiled_runtime_text: Mapped[str] = mapped_column(Text(), nullable=False, default="")
    source_kind: Mapped[str] = mapped_column(String(80), nullable=False, default="legacy_project_skill_settings")
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
