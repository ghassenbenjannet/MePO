from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.contracts.skill import CompiledSkill, CompiledSkillProjection
from app.models.project_skill_settings import ProjectSkillSettings
from app.services.ai.skill_compiler.cache import (
    get_cached_compiled_skill,
    invalidate_compiled_skill,
    set_cached_compiled_skill,
)
from app.services.ai.skill_compiler.compiler import compile_skill, compile_skill_projection


def _should_rebuild(project_id: str, updated_at: datetime | None) -> bool:
    cached = get_cached_compiled_skill(project_id)
    if cached is None:
        return True
    return cached.updated_at != updated_at


def _get_project_skill_settings(db: Session, project_id: str) -> ProjectSkillSettings | None:
    return (
        db.query(ProjectSkillSettings)
        .filter(ProjectSkillSettings.project_id == project_id)
        .first()
    )


def get_compiled_skill(db: Session, project_id: str) -> tuple[CompiledSkill, datetime | None]:
    settings = _get_project_skill_settings(db, project_id)
    updated_at = settings.updated_at if settings else None
    if _should_rebuild(project_id, updated_at):
        compiled = compile_skill(settings, project_id=project_id)
        set_cached_compiled_skill(project_id, compiled_skill=compiled, updated_at=updated_at)
    cached = get_cached_compiled_skill(project_id)
    assert cached is not None
    return cached.compiled_skill, cached.updated_at


def compile_skill_projection_for_turn(
    db: Session,
    *,
    project_id: str | None,
    mode: str,
    include_output_templates: bool,
) -> tuple[CompiledSkillProjection | None, datetime | None]:
    if not project_id:
        return None, None
    compiled_skill, updated_at = get_compiled_skill(db, project_id)
    return (
        compile_skill_projection(
            compiled_skill,
            mode=mode,
            include_output_templates=include_output_templates,
        ),
        updated_at,
    )


def get_normalized_runtime_text(db: Session, project_id: str) -> tuple[str, datetime | None]:
    compiled_skill, updated_at = get_compiled_skill(db, project_id)
    return compiled_skill.normalized_runtime_text, updated_at


__all__ = [
    "compile_skill_projection_for_turn",
    "get_compiled_skill",
    "get_normalized_runtime_text",
    "invalidate_compiled_skill",
]
