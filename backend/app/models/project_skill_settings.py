import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ProjectSkillSettings(Base):
    __tablename__ = "project_skill_settings"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), unique=True, nullable=False)
    main_skill_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    general_directives_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    source_hierarchy_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    mode_policies_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    action_policies_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    output_templates_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    guardrails_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), default=datetime.utcnow, nullable=False)
