import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ProjectSkillVersion(Base):
    __tablename__ = "project_skill_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    skill_id: Mapped[str | None] = mapped_column(ForeignKey("project_skills.id"), nullable=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    version_label: Mapped[str] = mapped_column(String(50), nullable=False, default="v1")
    editor_payload_json: Mapped[dict] = mapped_column(JSON(), nullable=False, default=dict)
    compiled_context_text: Mapped[str] = mapped_column(Text(), nullable=False, default="")
    compiled_runtime_text: Mapped[str] = mapped_column(Text(), nullable=False, default="")
    source_kind: Mapped[str] = mapped_column(String(80), nullable=False, default="mepo_skill_editor")
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
