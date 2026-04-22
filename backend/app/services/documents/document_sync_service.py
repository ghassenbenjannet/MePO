from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.document_google_link import DocumentGoogleLink
from app.models.project_document_sync_state import ProjectDocumentSyncState
from app.models.space import Space
from app.services.documents.google_document_service import project_document_to_google


@dataclass
class ProjectSyncSummary:
    project_id: str
    google_sync_status: str
    corpus_status: str
    active_corpus_version: str | None
    synced_documents: int
    last_error: str | None


def get_or_create_project_sync_state(db: Session, project_id: str) -> ProjectDocumentSyncState:
    state = (
        db.query(ProjectDocumentSyncState)
        .filter(ProjectDocumentSyncState.project_id == project_id)
        .one_or_none()
    )
    if state:
        return state

    state = ProjectDocumentSyncState(
        project_id=project_id,
        google_sync_status="queued",
        corpus_status="not_indexed",
        updated_at=datetime.utcnow(),
    )
    db.add(state)
    db.flush()
    return state


def _upsert_link(db: Session, document: Document) -> DocumentGoogleLink:
    link = (
        db.query(DocumentGoogleLink)
        .filter(DocumentGoogleLink.document_id == document.id)
        .one_or_none()
    )
    if link:
        return link

    link = DocumentGoogleLink(
        document_id=document.id,
        sync_status="queued",
        updated_at=datetime.utcnow(),
    )
    db.add(link)
    db.flush()
    return link


def _project_documents_query(db: Session, project_id: str):
    return (
        db.query(Document)
        .join(Space, Space.id == Document.space_id)
        .filter(Space.project_id == project_id)
        .filter(Document.is_archived.is_(False))
        .order_by(Document.updated_at.desc(), Document.title.asc())
    )


def sync_single_document(db: Session, document_id: str) -> DocumentGoogleLink:
    document = db.get(Document, document_id)
    if not document:
        raise ValueError("Document not found.")

    link = _upsert_link(db, document)
    link.sync_status = "syncing"
    link.updated_at = datetime.utcnow()
    db.add(link)
    db.flush()

    if not document.ai_enabled:
        link.sync_status = "stale"
        link.last_error = "Document exclu du corpus IA."
        link.updated_at = datetime.utcnow()
        db.add(link)
        db.flush()
        return link

    try:
        projection = project_document_to_google(document)
        link.google_file_id = projection.google_file_id
        link.google_web_url = projection.google_web_url
        link.google_mime_type = projection.google_mime_type
        link.last_synced_hash = projection.content_hash
        link.last_synced_at = datetime.utcnow()
        link.last_error = None
        link.sync_status = "synced"
    except Exception as exc:
        link.sync_status = "error"
        link.last_error = str(exc)
    link.updated_at = datetime.utcnow()
    db.add(link)
    db.flush()
    return link


def sync_project_documents(db: Session, project_id: str) -> ProjectSyncSummary:
    state = get_or_create_project_sync_state(db, project_id)
    state.google_sync_status = "syncing"
    state.corpus_status = "indexing"
    state.last_sync_started_at = datetime.utcnow()
    state.last_error = None
    state.updated_at = datetime.utcnow()
    db.add(state)
    db.flush()

    synced_documents = 0
    try:
        for document in _project_documents_query(db, project_id).all():
            link = sync_single_document(db, document.id)
            if link.sync_status == "synced":
                synced_documents += 1

        state.google_sync_status = "synced"
        state.corpus_status = "ready"
        state.active_corpus_version = state.last_sync_started_at.strftime("corpus-%Y%m%d%H%M%S")
        state.last_sync_finished_at = datetime.utcnow()
        state.updated_at = datetime.utcnow()
        db.add(state)
        db.flush()
    except Exception as exc:
        state.google_sync_status = "error"
        state.corpus_status = "error"
        state.last_error = str(exc)
        state.last_sync_finished_at = datetime.utcnow()
        state.updated_at = datetime.utcnow()
        db.add(state)
        db.flush()

    return ProjectSyncSummary(
        project_id=project_id,
        google_sync_status=state.google_sync_status,
        corpus_status=state.corpus_status,
        active_corpus_version=state.active_corpus_version,
        synced_documents=synced_documents,
        last_error=state.last_error,
    )
