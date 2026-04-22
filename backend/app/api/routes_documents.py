from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.document import Document
from app.models.document_google_link import DocumentGoogleLink
from app.models.project_document_sync_state import ProjectDocumentSyncState
from app.models.space import Space
from app.schemas.document import (
    DocumentCreate,
    DocumentRead,
    DocumentUpdate,
    ProjectDocumentsSyncStatusRead,
)
from app.services.ai.workspace_cache import invalidate_workspace_cache
from app.services.documents.document_sync_service import get_or_create_project_sync_state

router = APIRouter()


def _document_to_read(
    document: Document,
    link: DocumentGoogleLink | None,
    project_sync_state: ProjectDocumentSyncState | None,
) -> DocumentRead:
    return DocumentRead(
        id=document.id,
        space_id=document.space_id,
        topic_id=document.topic_id,
        parent_id=document.parent_id,
        type=document.type,
        title=document.title,
        content=document.content,
        tags=document.tags or [],
        doc_metadata=document.doc_metadata or {},
        icon=document.icon,
        ai_enabled=document.ai_enabled,
        google_sync_status=link.sync_status if link else "queued",
        corpus_status=project_sync_state.corpus_status if project_sync_state else None,
        google_file_id=link.google_file_id if link else None,
        google_web_url=link.google_web_url if link else None,
        last_synced_at=link.last_synced_at if link else None,
        last_error=link.last_error if link else None,
        is_archived=document.is_archived,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def _space_project_ids(db: Session, space_ids: set[str]) -> dict[str, str]:
    if not space_ids:
        return {}
    rows = db.query(Space.id, Space.project_id).filter(Space.id.in_(space_ids)).all()
    return {space_id: project_id for space_id, project_id in rows}


def _links_by_document_id(db: Session, document_ids: list[str]) -> dict[str, DocumentGoogleLink]:
    if not document_ids:
        return {}
    links = db.query(DocumentGoogleLink).filter(DocumentGoogleLink.document_id.in_(document_ids)).all()
    return {link.document_id: link for link in links}


def _sync_state_by_project_id(db: Session, project_ids: set[str]) -> dict[str, ProjectDocumentSyncState]:
    if not project_ids:
        return {}
    states = (
        db.query(ProjectDocumentSyncState)
        .filter(ProjectDocumentSyncState.project_id.in_(project_ids))
        .all()
    )
    return {state.project_id: state for state in states}


def _ensure_document(db: Session, document_id: str) -> Document:
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.get("/documents", response_model=list[DocumentRead])
def list_documents(
    space_id: str | None = Query(None),
    topic_id: str | None = Query(None),
    parent_id: str | None = Query(None),
    type: str | None = Query(None),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
) -> list[DocumentRead]:
    query = db.query(Document)
    if space_id:
        query = query.filter(Document.space_id == space_id)
    if topic_id:
        query = query.filter(Document.topic_id == topic_id)
    if parent_id is not None:
        if parent_id == "root":
            query = query.filter(Document.parent_id.is_(None))
        else:
            query = query.filter(Document.parent_id == parent_id)
    if type:
        query = query.filter(Document.type == type)
    if not include_archived:
        query = query.filter(Document.is_archived.is_(False))

    documents = query.order_by(Document.type, Document.title).all()
    project_ids_by_space = _space_project_ids(db, {document.space_id for document in documents})
    links_by_document = _links_by_document_id(db, [document.id for document in documents])
    states_by_project = _sync_state_by_project_id(db, set(project_ids_by_space.values()))
    return [
        _document_to_read(
            document,
            links_by_document.get(document.id),
            states_by_project.get(project_ids_by_space.get(document.space_id, "")),
        )
        for document in documents
    ]


@router.post("/documents", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
def create_document(payload: DocumentCreate, db: Session = Depends(get_db)) -> DocumentRead:
    document = Document(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(document)
    db.commit()
    db.refresh(document)
    invalidate_workspace_cache(space_id=document.space_id, topic_id=document.topic_id)
    project_id = db.query(Space.project_id).filter(Space.id == document.space_id).scalar()
    sync_state = get_or_create_project_sync_state(db, project_id) if project_id else None
    db.commit()
    return _document_to_read(document, None, sync_state)


@router.get("/documents/{document_id}", response_model=DocumentRead)
def get_document(document_id: str, db: Session = Depends(get_db)) -> DocumentRead:
    document = _ensure_document(db, document_id)
    link = db.query(DocumentGoogleLink).filter(DocumentGoogleLink.document_id == document.id).one_or_none()
    project_id = db.query(Space.project_id).filter(Space.id == document.space_id).scalar()
    state = None
    if project_id:
        state = (
            db.query(ProjectDocumentSyncState)
            .filter(ProjectDocumentSyncState.project_id == project_id)
            .one_or_none()
        )
    return _document_to_read(document, link, state)


@router.patch("/documents/{document_id}", response_model=DocumentRead)
def update_document(document_id: str, payload: DocumentUpdate, db: Session = Depends(get_db)) -> DocumentRead:
    document = _ensure_document(db, document_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(document, field, value)
    document.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(document)
    invalidate_workspace_cache(space_id=document.space_id, topic_id=document.topic_id)
    link = db.query(DocumentGoogleLink).filter(DocumentGoogleLink.document_id == document.id).one_or_none()
    project_id = db.query(Space.project_id).filter(Space.id == document.space_id).scalar()
    state = get_or_create_project_sync_state(db, project_id) if project_id else None
    if state and state.corpus_status == "ready":
        state.corpus_status = "stale"
        state.google_sync_status = "stale"
        state.updated_at = datetime.utcnow()
        db.add(state)
        db.commit()
    return _document_to_read(document, link, state)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: str, db: Session = Depends(get_db)) -> None:
    document = _ensure_document(db, document_id)
    space_id = document.space_id
    topic_id = document.topic_id
    _delete_children(document_id, db)
    db.query(DocumentGoogleLink).filter(DocumentGoogleLink.document_id == document_id).delete()
    db.delete(document)
    db.commit()
    invalidate_workspace_cache(space_id=space_id, topic_id=topic_id)


def _delete_children(parent_id: str, db: Session) -> None:
    children = db.query(Document).filter(Document.parent_id == parent_id).all()
    for child in children:
        _delete_children(child.id, db)
        db.query(DocumentGoogleLink).filter(DocumentGoogleLink.document_id == child.id).delete()
        db.delete(child)


@router.get("/projects/{project_id}/documents/sync-status", response_model=ProjectDocumentsSyncStatusRead)
def get_project_documents_sync_status(project_id: str, db: Session = Depends(get_db)):
    state = get_or_create_project_sync_state(db, project_id)
    eligible_documents = (
        db.query(Document)
        .join(Space, Space.id == Document.space_id)
        .filter(Space.project_id == project_id)
        .filter(Document.is_archived.is_(False))
        .filter(Document.ai_enabled.is_(True))
        .count()
    )
    db.commit()
    return ProjectDocumentsSyncStatusRead(
        project_id=project_id,
        google_sync_status=state.google_sync_status,
        corpus_status=state.corpus_status,
        active_corpus_version=state.active_corpus_version,
        last_sync_started_at=state.last_sync_started_at,
        last_sync_finished_at=state.last_sync_finished_at,
        last_error=state.last_error,
        synced_documents=0,
        eligible_documents=eligible_documents,
    )


@router.post("/projects/{project_id}/documents/sync", response_model=ProjectDocumentsSyncStatusRead)
def trigger_project_documents_sync(project_id: str, db: Session = Depends(get_db)):
    # Space documents no longer sync to an external vector store.
    # Knowledge corpus sync is handled by /projects/{id}/knowledge/sync.
    state = get_or_create_project_sync_state(db, project_id)
    eligible_documents = (
        db.query(Document)
        .join(Space, Space.id == Document.space_id)
        .filter(Space.project_id == project_id)
        .filter(Document.is_archived.is_(False))
        .filter(Document.ai_enabled.is_(True))
        .count()
    )
    db.commit()
    return ProjectDocumentsSyncStatusRead(
        project_id=project_id,
        google_sync_status="synced",
        corpus_status="ready",
        active_corpus_version=state.active_corpus_version,
        last_sync_started_at=state.last_sync_started_at,
        last_sync_finished_at=state.last_sync_finished_at,
        last_error=None,
        synced_documents=0,
        eligible_documents=eligible_documents,
    )


@router.post("/documents/{document_id}/sync", response_model=DocumentRead)
def trigger_document_sync(document_id: str, db: Session = Depends(get_db)):
    document = _ensure_document(db, document_id)
    project_id = db.query(Space.project_id).filter(Space.id == document.space_id).scalar()
    state = get_or_create_project_sync_state(db, project_id) if project_id else None
    db.commit()
    return _document_to_read(document, None, state)
