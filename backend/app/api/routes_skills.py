from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.project import Project
from app.schemas.skills import (
    ProjectSkillRuntimeRead,
    ProjectSkillSettingsRead,
    ProjectSkillSettingsUpdate,
)
from app.services.ai.project_skill_runtime import (
    get_or_create_project_skill_settings,
    get_project_skill_runtime,
)
from app.services.ai.project_skill_versions import ensure_active_skill_version
from app.services.ai.skill_compiler import invalidate_compiled_skill

router = APIRouter()


def _ensure_project(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("/projects/{project_id}/skills/settings", response_model=ProjectSkillSettingsRead)
def get_project_skill_settings(project_id: str, db: Session = Depends(get_db)):
    _ensure_project(db, project_id)
    return get_or_create_project_skill_settings(db, project_id)


@router.put("/projects/{project_id}/skills/settings", response_model=ProjectSkillSettingsRead)
def update_project_skill_settings(
    project_id: str,
    payload: ProjectSkillSettingsUpdate,
    db: Session = Depends(get_db),
):
    _ensure_project(db, project_id)
    settings = get_or_create_project_skill_settings(db, project_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, field, value.strip() if isinstance(value, str) else value)
    settings.updated_at = datetime.utcnow()
    db.add(settings)
    db.commit()
    ensure_active_skill_version(db, project_id, force_new_version=True)
    db.commit()
    db.refresh(settings)
    invalidate_compiled_skill(project_id)
    return settings


@router.get("/projects/{project_id}/skills/runtime", response_model=ProjectSkillRuntimeRead)
def get_project_skills_runtime(project_id: str, db: Session = Depends(get_db)):
    _ensure_project(db, project_id)
    _, compiled_text, updated_at = get_project_skill_runtime(db, project_id)
    return ProjectSkillRuntimeRead(
        projectId=project_id,
        compiledRuntimeText=compiled_text,
        updatedAt=updated_at,
    )
