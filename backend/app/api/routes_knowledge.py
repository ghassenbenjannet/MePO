from __future__ import annotations

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.project import Project
from app.models.project_knowledge_document import ProjectKnowledgeDocument
from app.models.project_knowledge_settings import ProjectKnowledgeSettings
from app.schemas.knowledge import (
    KnowledgeDocCreate,
    KnowledgeDocRead,
    KnowledgeDocUpdate,
    KnowledgeSyncStatusRead,
    KnowledgeSyncTriggerResponse,
    ProjectKnowledgeSettingsRead,
    ProjectKnowledgeSettingsUpdate,
)
from app.services.knowledge.content_extractor import extract_text_from_file
from app.services.knowledge.sync_service import sync_project_knowledge
from app.services.ai.workspace_cache import invalidate_workspace_cache

logger = logging.getLogger(__name__)
router = APIRouter()


def _ensure_project(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _get_or_create_settings(db: Session, project_id: str) -> ProjectKnowledgeSettings:
    settings = (
        db.query(ProjectKnowledgeSettings)
        .filter(ProjectKnowledgeSettings.project_id == project_id)
        .first()
    )
    if settings:
        return settings
    settings = ProjectKnowledgeSettings(project_id=project_id)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/projects/{project_id}/knowledge/settings", response_model=ProjectKnowledgeSettingsRead)
def get_project_knowledge_settings(project_id: str, db: Session = Depends(get_db)):
    _ensure_project(db, project_id)
    settings = _get_or_create_settings(db, project_id)
    return settings


@router.put("/projects/{project_id}/knowledge/settings", response_model=ProjectKnowledgeSettingsRead)
def update_project_knowledge_settings(
    project_id: str,
    payload: ProjectKnowledgeSettingsUpdate,
    db: Session = Depends(get_db),
):
    _ensure_project(db, project_id)
    settings = _get_or_create_settings(db, project_id)
    settings.vector_store_id = (payload.vector_store_id or "").strip() or None
    settings.updated_at = datetime.utcnow()
    db.add(settings)
    db.commit()
    db.refresh(settings)
    invalidate_workspace_cache(project_id=project_id)
    return settings


@router.get("/projects/{project_id}/knowledge/sync-status", response_model=KnowledgeSyncStatusRead)
def get_project_knowledge_sync_status(project_id: str, db: Session = Depends(get_db)):
    _ensure_project(db, project_id)
    settings = _get_or_create_settings(db, project_id)
    return KnowledgeSyncStatusRead(
        project_id=project_id,
        vector_store_id=settings.vector_store_id,
        last_sync_status=settings.last_sync_status,
        last_sync_started_at=settings.last_sync_started_at,
        last_sync_finished_at=settings.last_sync_finished_at,
        last_sync_error=settings.last_sync_error,
        last_sync_summary_json=settings.last_sync_summary_json or {},
    )


@router.post("/projects/{project_id}/knowledge/sync", response_model=KnowledgeSyncTriggerResponse)
def trigger_project_knowledge_sync(project_id: str, db: Session = Depends(get_db)):
    _ensure_project(db, project_id)
    try:
        settings, summary = sync_project_knowledge(db=db, project_id=project_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("knowledge sync failed project_id=%s error=%s", project_id, exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Sync failed: {exc}") from exc

    return KnowledgeSyncTriggerResponse(
        project_id=project_id,
        vector_store_id=settings.vector_store_id or "",
        status=settings.last_sync_status,
        synced=summary.added + summary.updated,
        skipped=summary.ignored,
        no_file=0,
        errors=[
            item["message"]
            for item in summary.document_results
            if item.get("status") == "error"
        ],
        summary=summary.to_dict(),
    )


@router.get("/projects/{project_id}/knowledge/documents", response_model=list[KnowledgeDocRead])
@router.get("/projects/{project_id}/knowledge-documents", response_model=list[KnowledgeDocRead])
def list_project_knowledge_documents(project_id: str, db: Session = Depends(get_db)):
    _ensure_project(db, project_id)
    return (
        db.query(ProjectKnowledgeDocument)
        .filter(ProjectKnowledgeDocument.project_id == project_id)
        .order_by(
            ProjectKnowledgeDocument.is_active.desc(),
            ProjectKnowledgeDocument.updated_at.desc(),
            ProjectKnowledgeDocument.created_at.desc(),
        )
        .all()
    )


@router.post("/projects/{project_id}/knowledge/documents", response_model=KnowledgeDocRead, status_code=status.HTTP_201_CREATED)
@router.post("/projects/{project_id}/knowledge-documents", response_model=KnowledgeDocRead, status_code=status.HTTP_201_CREATED)
def create_project_knowledge_document(
    project_id: str,
    payload: KnowledgeDocCreate,
    db: Session = Depends(get_db),
):
    _ensure_project(db, project_id)
    doc = ProjectKnowledgeDocument(
        project_id=project_id,
        scope="project",
        document_type=payload.category,
        title=payload.title.strip(),
        category=payload.category,
        source_type=payload.source_type,
        summary=payload.summary,
        tags=payload.tags,
        linked_topic_ids=payload.linked_topic_ids,
        content_extracted_text=payload.content_extracted_text,
        mime_type=payload.mime_type,
        original_filename=payload.original_filename,
        local_file_id=str(uuid.uuid4()),
        content_hash=None,
        sync_status="not_synced",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    invalidate_workspace_cache(project_id=project_id)
    return doc


@router.post("/projects/{project_id}/knowledge/documents/upload", response_model=KnowledgeDocRead, status_code=status.HTTP_201_CREATED)
@router.post("/projects/{project_id}/knowledge-documents/upload", response_model=KnowledgeDocRead, status_code=status.HTTP_201_CREATED)
async def upload_project_knowledge_document(
    project_id: str,
    file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form("reference"),
    summary: str = Form(""),
    tags: str = Form(""),
    db: Session = Depends(get_db),
):
    _ensure_project(db, project_id)

    raw_bytes = await file.read()
    try:
        extracted_text = extract_text_from_file(file.filename or "document", file.content_type, raw_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible d'extraire le contenu du document: {exc}",
        ) from exc

    tag_list = [item.strip() for item in tags.split(",") if item.strip()]
    now = datetime.utcnow()
    doc = ProjectKnowledgeDocument(
        project_id=project_id,
        scope="project",
        document_type=category,
        category=category,
        title=title.strip(),
        source_type="upload",
        local_file_id=str(uuid.uuid4()),
        mime_type=file.content_type,
        original_filename=file.filename,
        summary=summary.strip() or None,
        tags=tag_list,
        content_extracted_text=extracted_text.strip(),
        sync_status="not_synced",
        created_at=now,
        updated_at=now,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    invalidate_workspace_cache(project_id=project_id)
    return doc


@router.patch("/knowledge/documents/{doc_id}", response_model=KnowledgeDocRead)
@router.patch("/knowledge-documents/{doc_id}", response_model=KnowledgeDocRead)
def update_project_knowledge_document(
    doc_id: str,
    payload: KnowledgeDocUpdate,
    db: Session = Depends(get_db),
):
    doc = db.get(ProjectKnowledgeDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge document not found")

    changed = False
    updated_fields = payload.model_dump(exclude_unset=True)
    for field, value in updated_fields.items():
        setattr(doc, field, value)
        changed = True
    if "category" in updated_fields and updated_fields["category"]:
        doc.document_type = updated_fields["category"]

    if changed:
        doc.updated_at = datetime.utcnow()
        if "is_active" in updated_fields:
            if doc.is_active:
                doc.sync_status = "not_synced"
                doc.sync_error = None
            else:
                doc.sync_status = "pending_removal"
                doc.sync_error = None
        elif doc.sync_status not in {"error", "removed"}:
            doc.sync_status = "not_synced"
            doc.sync_error = None
    db.add(doc)
    db.commit()
    db.refresh(doc)
    invalidate_workspace_cache(project_id=doc.project_id)
    return doc


@router.delete("/knowledge/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/knowledge-documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_knowledge_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.get(ProjectKnowledgeDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge document not found")
    doc.is_active = False
    doc.sync_status = "pending_removal"
    doc.sync_error = None
    doc.updated_at = datetime.utcnow()
    db.add(doc)
    db.commit()
    invalidate_workspace_cache(project_id=doc.project_id)
