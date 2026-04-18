from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_skill import ProjectSkill
from app.models.project_skill_settings import ProjectSkillSettings
from app.models.project_skill_version import ProjectSkillVersion
from app.services.ai.project_skill_runtime import compile_project_skill_runtime_text


def _get_or_create_project_skill(db: Session, project_id: str) -> ProjectSkill:
    skill = (
        db.query(ProjectSkill)
        .filter(ProjectSkill.project_id == project_id)
        .order_by(ProjectSkill.created_at.asc(), ProjectSkill.id.asc())
        .first()
    )
    if skill:
        return skill
    now = datetime.utcnow()
    skill = ProjectSkill(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name="Shadow PO",
        created_at=now,
        updated_at=now,
    )
    db.add(skill)
    db.flush()
    return skill


def _get_legacy_skill_settings(db: Session, project_id: str) -> ProjectSkillSettings | None:
    return (
        db.query(ProjectSkillSettings)
        .filter(ProjectSkillSettings.project_id == project_id)
        .first()
    )


def get_project_skill_version(db: Session, skill_version_id: str | None) -> ProjectSkillVersion | None:
    if not skill_version_id:
        return None
    return db.get(ProjectSkillVersion, skill_version_id)


def ensure_active_skill_version(
    db: Session,
    project_id: str | None,
    *,
    force_new_version: bool = False,
) -> ProjectSkillVersion | None:
    if not project_id:
        return None
    project = db.get(Project, project_id)
    if not project:
        return None

    current_version = get_project_skill_version(db, project.active_skill_version_id)
    if current_version and not force_new_version:
        return current_version

    legacy_settings = _get_legacy_skill_settings(db, project_id)
    compiled_runtime_text = compile_project_skill_runtime_text(legacy_settings)

    if current_version and current_version.compiled_runtime_text == compiled_runtime_text and not force_new_version:
        return current_version

    skill = _get_or_create_project_skill(db, project_id)

    latest_version = (
        db.query(ProjectSkillVersion)
        .filter(ProjectSkillVersion.skill_id == skill.id)
        .order_by(ProjectSkillVersion.created_at.desc(), ProjectSkillVersion.id.desc())
        .first()
    )
    if latest_version and latest_version.compiled_runtime_text == compiled_runtime_text and not force_new_version:
        project.active_skill_version_id = latest_version.id
        skill.updated_at = datetime.utcnow()
        db.add(project)
        db.add(skill)
        db.flush()
        return latest_version

    version_count = db.query(ProjectSkillVersion).filter(ProjectSkillVersion.skill_id == skill.id).count()
    created_at = datetime.utcnow()
    version = ProjectSkillVersion(
        id=str(uuid.uuid4()),
        skill_id=skill.id,
        version_label=f"v{version_count + 1}",
        compiled_runtime_text=compiled_runtime_text,
        source_kind="legacy_project_skill_settings",
        created_at=created_at,
    )
    project.active_skill_version_id = version.id
    skill.updated_at = created_at
    db.add(version)
    db.add(project)
    db.add(skill)
    db.flush()
    return version
