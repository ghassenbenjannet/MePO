from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.project import Project
from app.models.project_skill_version import ProjectSkillVersion
from app.schemas.skills import ActiveSkillRead, SkillEditorPayload, SkillVersionRead
from app.services.ai.active_skill_service import (
    activate_skill_version,
    apply_skill_v2,
    build_compiled_context,
    create_skill_version,
    ensure_active_skill_version,
    list_skill_versions,
)

router = APIRouter()


def _ensure_project(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _to_version_read(version: ProjectSkillVersion, active_version_id: str | None) -> SkillVersionRead:
    payload = version.editor_payload_json or {}
    return SkillVersionRead(
        id=version.id,
        projectId=version.project_id or "",
        versionLabel=version.version_label,
        editorPayload=SkillEditorPayload(
            mainSkillText=payload.get("main_skill_text") or "",
            generalDirectivesText=payload.get("general_directives_text") or "",
            modePoliciesText=payload.get("mode_policies_text") or "",
            actionPoliciesText=payload.get("action_policies_text") or "",
            outputTemplatesText=payload.get("output_templates_text") or "",
            guardrailsText=payload.get("guardrails_text") or "",
        ),
        compiledContextText=version.compiled_context_text or version.compiled_runtime_text or "",
        sourceKind=version.source_kind,
        createdAt=version.created_at,
        isActive=version.id == active_version_id,
    )


def _to_active_skill_read(project: Project, version: ProjectSkillVersion) -> ActiveSkillRead:
    return ActiveSkillRead(
        projectId=project.id,
        activeSkillVersionId=version.id,
        version=_to_version_read(version, version.id),
    )


@router.get("/projects/{project_id}/skills/active", response_model=ActiveSkillRead)
def get_active_skill(project_id: str, db: Session = Depends(get_db)):
    project = _ensure_project(db, project_id)
    version = ensure_active_skill_version(db, project_id)
    db.commit()
    db.refresh(project)
    return _to_active_skill_read(project, version)


@router.put("/projects/{project_id}/skills/active", response_model=ActiveSkillRead)
def save_active_skill(
    project_id: str,
    payload: SkillEditorPayload,
    db: Session = Depends(get_db),
):
    project = _ensure_project(db, project_id)
    version = create_skill_version(
        db,
        project_id,
        {
            "main_skill_text": payload.main_skill_text,
            "general_directives_text": payload.general_directives_text,
            "mode_policies_text": payload.mode_policies_text,
            "action_policies_text": payload.action_policies_text,
            "output_templates_text": payload.output_templates_text,
            "guardrails_text": payload.guardrails_text,
        },
    )
    db.commit()
    db.refresh(project)
    return _to_active_skill_read(project, version)


@router.get("/projects/{project_id}/skills/versions", response_model=list[SkillVersionRead])
def get_skill_versions(project_id: str, db: Session = Depends(get_db)):
    project = _ensure_project(db, project_id)
    versions = list_skill_versions(db, project_id)
    db.commit()
    return [_to_version_read(version, project.active_skill_version_id) for version in versions]


@router.get("/projects/{project_id}/skills/versions/{version_id}", response_model=SkillVersionRead)
def get_skill_version(project_id: str, version_id: str, db: Session = Depends(get_db)):
    project = _ensure_project(db, project_id)
    version = db.get(ProjectSkillVersion, version_id)
    if not version or version.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill version not found")
    return _to_version_read(version, project.active_skill_version_id)


@router.post("/projects/{project_id}/skills/apply-v2", response_model=ActiveSkillRead)
def apply_default_skill_v2(project_id: str, db: Session = Depends(get_db)):
    """Create and activate Skill v2 (Copilot PO/BA/QA documentaire) for this project."""
    project = _ensure_project(db, project_id)
    try:
        version = apply_skill_v2(db, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    db.refresh(project)
    return _to_active_skill_read(project, version)


@router.put("/projects/{project_id}/skills/raw", response_model=ActiveSkillRead)
def save_raw_skill(
    project_id: str,
    body: dict,
    db: Session = Depends(get_db),
):
    """Save a full markdown skill document as-is (no 6-section fragmentation)."""
    project = _ensure_project(db, project_id)
    raw_text = (body.get("raw_text") or "").strip()
    if not raw_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="raw_text is required")
    editor_payload = {"main_skill_text": raw_text}
    version = create_skill_version(db, project_id, editor_payload)
    db.commit()
    db.refresh(project)
    return _to_active_skill_read(project, version)


@router.post("/projects/{project_id}/skills/versions/{version_id}/activate", response_model=ActiveSkillRead)
def activate_skill(project_id: str, version_id: str, db: Session = Depends(get_db)):
    project = _ensure_project(db, project_id)
    try:
        version = activate_skill_version(db, project_id, version_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    db.commit()
    db.refresh(project)
    return _to_active_skill_read(project, version)
