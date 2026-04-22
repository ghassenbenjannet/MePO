"""MePO knowledge corpus sync service — provider-agnostic.

Scans ProjectKnowledgeDocument records for the project, computes content hashes,
updates sync_status on each document, and writes an aggregate summary to
ProjectKnowledgeSettings. Does NOT call any external provider (OpenAI removed).
Google file-search sync is handled separately by document_sync_service.py.
"""
from __future__ import annotations

import hashlib
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_knowledge_document import ProjectKnowledgeDocument
from app.models.project_knowledge_settings import ProjectKnowledgeSettings
from app.services.ai.workspace_cache import invalidate_workspace_cache

logger = logging.getLogger(__name__)

_SYNC_GUARD = threading.Lock()
_RUNNING_PROJECT_SYNCS: set[str] = set()


@dataclass
class KnowledgeSyncSummary:
    project_id: str
    vector_store_id: str = ""
    scanned: int = 0
    added: int = 0
    updated: int = 0
    ignored: int = 0
    removed: int = 0
    errors: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None
    document_results: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "project_id": self.project_id,
            "vector_store_id": self.vector_store_id,
            "scanned": self.scanned,
            "added": self.added,
            "updated": self.updated,
            "ignored": self.ignored,
            "removed": self.removed,
            "errors": self.errors,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "document_results": self.document_results,
        }


def _acquire_project_lock(project_id: str) -> None:
    with _SYNC_GUARD:
        if project_id in _RUNNING_PROJECT_SYNCS:
            raise RuntimeError("Une synchronisation est déjà en cours pour ce projet.")
        _RUNNING_PROJECT_SYNCS.add(project_id)


def _release_project_lock(project_id: str) -> None:
    with _SYNC_GUARD:
        _RUNNING_PROJECT_SYNCS.discard(project_id)


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
    db.flush()
    return settings


def _build_content_payload(doc: ProjectKnowledgeDocument) -> str:
    extracted = (doc.content_extracted_text or "").strip()
    fallback = (doc.summary or "").strip()
    return extracted or fallback


def _compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sync_project_knowledge(
    db: Session,
    project_id: str,
) -> tuple[ProjectKnowledgeSettings, KnowledgeSyncSummary]:
    """Local corpus sync: hash documents, update sync_status. No external calls."""
    _acquire_project_lock(project_id)
    try:
        project = db.get(Project, project_id)
        if not project:
            raise LookupError("Projet introuvable.")

        settings = _get_or_create_settings(db, project_id)
        now = datetime.utcnow()
        settings.last_sync_started_at = now
        settings.last_sync_finished_at = None
        settings.last_sync_error = None
        settings.last_sync_status = "running"
        settings.updated_at = now
        db.add(settings)
        db.commit()
        db.refresh(settings)

        summary = KnowledgeSyncSummary(
            project_id=project_id,
            started_at=settings.last_sync_started_at,
        )

        active_docs = (
            db.query(ProjectKnowledgeDocument)
            .filter(
                ProjectKnowledgeDocument.project_id == project_id,
                ProjectKnowledgeDocument.is_active.is_(True),
            )
            .all()
        )
        summary.scanned = len(active_docs)

        for doc in active_docs:
            content = _build_content_payload(doc)
            if not content:
                doc.sync_status = "error"
                doc.sync_error = "Aucun contenu textuel disponible pour ce document."
                db.add(doc)
                summary.errors += 1
                summary.document_results.append({
                    "document_id": doc.id,
                    "title": doc.title,
                    "status": "error",
                    "message": doc.sync_error,
                })
                continue

            new_hash = _compute_hash(content)
            if doc.content_hash == new_hash and doc.sync_status in {"synced", "ignored"}:
                doc.sync_status = "ignored"
                db.add(doc)
                summary.ignored += 1
                summary.document_results.append({
                    "document_id": doc.id,
                    "title": doc.title,
                    "status": "ignored",
                    "message": "Document inchangé.",
                })
                continue

            was_synced = doc.sync_status == "synced"
            doc.content_hash = new_hash
            doc.sync_status = "synced"
            doc.sync_error = None
            doc.synced_at = datetime.utcnow()
            db.add(doc)
            if was_synced:
                summary.updated += 1
            else:
                summary.added += 1
            summary.document_results.append({
                "document_id": doc.id,
                "title": doc.title,
                "status": doc.sync_status,
                "message": "Document indexé dans le corpus MePO.",
            })

        inactive_docs = (
            db.query(ProjectKnowledgeDocument)
            .filter(
                ProjectKnowledgeDocument.project_id == project_id,
                ProjectKnowledgeDocument.is_active.is_(False),
                ProjectKnowledgeDocument.sync_status != "removed",
            )
            .all()
        )
        for doc in inactive_docs:
            doc.sync_status = "removed"
            doc.sync_error = None
            db.add(doc)
            summary.removed += 1
            summary.document_results.append({
                "document_id": doc.id,
                "title": doc.title,
                "status": "removed",
                "message": "Document retiré du corpus.",
            })

        finish_time = datetime.utcnow()
        settings.last_sync_status = "success" if summary.errors == 0 else "partial"
        settings.last_sync_finished_at = finish_time
        settings.last_sync_error = None if summary.errors == 0 else "Certains documents n'ont pu être indexés."
        summary.finished_at = finish_time
        settings.last_sync_summary_json = summary.to_dict()
        settings.updated_at = finish_time
        db.add(settings)
        db.commit()
        invalidate_workspace_cache(project_id=project_id)

        logger.info(
            "knowledge_sync project_id=%s scanned=%s added=%s updated=%s ignored=%s removed=%s errors=%s",
            project_id, summary.scanned, summary.added, summary.updated,
            summary.ignored, summary.removed, summary.errors,
        )
        db.refresh(settings)
        return settings, summary

    except Exception:
        db.rollback()
        settings_after = (
            db.query(ProjectKnowledgeSettings)
            .filter(ProjectKnowledgeSettings.project_id == project_id)
            .first()
        )
        if settings_after:
            settings_after.last_sync_status = "failed"
            settings_after.last_sync_finished_at = datetime.utcnow()
            if not settings_after.last_sync_error:
                settings_after.last_sync_error = "La synchronisation a échoué."
            settings_after.updated_at = datetime.utcnow()
            db.add(settings_after)
            db.commit()
        raise
    finally:
        _release_project_lock(project_id)
