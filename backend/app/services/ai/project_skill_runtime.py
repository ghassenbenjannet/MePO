from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.project_skill_settings import ProjectSkillSettings
from app.services.ai.skill_compiler.compiler import compile_skill
from app.services.ai.skill_compiler.service import (
    get_normalized_runtime_text,
)

_LEGACY_HEADINGS = {
    "main_skill_text": "SKILL PRINCIPAL PROJET",
    "general_directives_text": "DIRECTIVES GENERALES",
    "source_hierarchy_text": "NOTES PROJET SUR LA HIERARCHIE DES SOURCES",
    "mode_policies_text": "POLITIQUES DE MODES",
    "action_policies_text": "POLITIQUES D'ACTIONS",
    "output_templates_text": "TEMPLATES DE SORTIE",
    "guardrails_text": "GARDE-FOUS",
}


def get_project_skill_settings(db: Session, project_id: str) -> ProjectSkillSettings | None:
    return (
        db.query(ProjectSkillSettings)
        .filter(ProjectSkillSettings.project_id == project_id)
        .first()
    )


def get_or_create_project_skill_settings(db: Session, project_id: str) -> ProjectSkillSettings:
    settings = get_project_skill_settings(db, project_id)
    if settings:
        return settings
    settings = ProjectSkillSettings(project_id=project_id)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def compile_project_skill_runtime_text(settings: ProjectSkillSettings | None) -> str:
    if not settings:
        return ""
    compiled = compile_skill(settings, project_id=settings.project_id)
    blocks: list[str] = []
    for section in compiled.sections:
        heading = _LEGACY_HEADINGS.get(section.name, section.title.upper())
        prefix = ""
        if section.name == "source_hierarchy_text":
            prefix = (
                "Ce bloc complete la politique de priorite codee en dur. "
                "Il ne peut pas modifier l'ordre canonique des sources.\n\n"
            )
        blocks.append(f"== {heading} ==\n{prefix}{section.normalized_text}")
    return "\n\n".join(blocks).strip()


def get_project_skill_runtime(
    db: Session,
    project_id: str,
) -> tuple[ProjectSkillSettings, str, datetime | None]:
    settings = get_project_skill_settings(db, project_id)
    if not settings:
        return ProjectSkillSettings(project_id=project_id), "", None
    _, updated_at = get_normalized_runtime_text(db, project_id)
    return settings, compile_project_skill_runtime_text(settings), updated_at
