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
from app.models.project_knowledge_sync_item import ProjectKnowledgeSyncItem
from app.services.ai.workspace_cache import invalidate_workspace_cache
from app.services.knowledge.openai_vector_store_service import OpenAIKnowledgeGateway

logger = logging.getLogger(__name__)

_SYNC_GUARD = threading.Lock()
_RUNNING_PROJECT_SYNCS: set[str] = set()


@dataclass
class KnowledgeSyncSummary:
    project_id: str
    vector_store_id: str
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


def _build_document_payload(project: Project, doc: ProjectKnowledgeDocument) -> str:
    updated = doc.updated_at.isoformat() if doc.updated_at else ""
    tags = ", ".join(doc.tags or [])
    linked_topics = ", ".join(doc.linked_topic_ids or [])
    extracted_text = (doc.content_extracted_text or "").strip()
    fallback_text = (doc.summary or "").strip()
    effective_text = extracted_text or fallback_text
    return (
        f"Titre: {doc.title}\n"
        f"Projet: {project.name}\n"
        f"Catégorie: {doc.category}\n"
        f"Type documentaire: {getattr(doc, 'document_type', doc.category)}\n"
        f"Source: {doc.source_type}\n"
        f"MIME: {doc.mime_type or 'n/a'}\n"
        f"Fichier local: {doc.local_file_id or 'n/a'}\n"
        f"Dernière mise à jour: {updated}\n"
        f"Tags: {tags or 'aucun'}\n"
        f"Topics liés: {linked_topics or 'aucun'}\n"
        f"Résumé: {doc.summary or 'aucun'}\n"
        "\n=== CONTENU EXTRAIT ===\n"
        f"{effective_text}\n"
    ).strip()


def _compute_hash(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def sync_project_knowledge(
    db: Session,
    project_id: str,
    *,
    gateway: OpenAIKnowledgeGateway | None = None,
) -> tuple[ProjectKnowledgeSettings, KnowledgeSyncSummary]:
    _acquire_project_lock(project_id)
    try:
        project = db.get(Project, project_id)
        if not project:
            raise LookupError("Projet introuvable.")

        settings = _get_or_create_settings(db, project_id)
        settings.last_sync_started_at = datetime.utcnow()
        settings.last_sync_finished_at = None
        settings.last_sync_error = None
        settings.last_sync_status = "running"
        settings.updated_at = datetime.utcnow()
        db.add(settings)
        db.commit()
        db.refresh(settings)

        vector_store_id = (settings.vector_store_id or "").strip()
        if not vector_store_id:
            settings.last_sync_status = "failed"
            settings.last_sync_error = "Aucun vector_store_id n'est enregistré pour ce projet."
            settings.last_sync_finished_at = datetime.utcnow()
            db.add(settings)
            db.commit()
            raise ValueError(settings.last_sync_error)

        gateway = gateway or OpenAIKnowledgeGateway()

        try:
            gateway.retrieve_vector_store(vector_store_id)
        except Exception as exc:
            settings.last_sync_status = "failed"
            settings.last_sync_error = (
                f"Vector store inaccessible ({vector_store_id}): {str(exc)[:400]}"
            )
            settings.last_sync_finished_at = datetime.utcnow()
            db.add(settings)
            db.commit()
            raise LookupError(settings.last_sync_error) from exc

        summary = KnowledgeSyncSummary(
            project_id=project_id,
            vector_store_id=vector_store_id,
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
        existing_file_ids = gateway.list_vector_store_file_ids(vector_store_id)

        logger.info(
            "knowledge_sync.start project_id=%s vector_store_id=%s scanned=%s",
            project_id, vector_store_id, summary.scanned,
        )

        for doc in active_docs:
            payload_text = _build_document_payload(project, doc)
            local_hash = _compute_hash(payload_text)
            doc.content_hash = local_hash
            effective_text = (doc.content_extracted_text or "").strip() or (doc.summary or "").strip()

            mapping = (
                db.query(ProjectKnowledgeSyncItem)
                .filter(
                    ProjectKnowledgeSyncItem.project_id == project_id,
                    ProjectKnowledgeSyncItem.knowledge_document_id == doc.id,
                    ProjectKnowledgeSyncItem.vector_store_id == vector_store_id,
                    ProjectKnowledgeSyncItem.is_active.is_(True),
                )
                .first()
            )
            known_openai_file_id = (
                (mapping.openai_file_id if mapping and mapping.openai_file_id else None)
                or (doc.openai_file_id or None)
            )

            if not effective_text:
                if known_openai_file_id and known_openai_file_id in existing_file_ids:
                    if mapping is None:
                        mapping = ProjectKnowledgeSyncItem(
                            project_id=project_id,
                            knowledge_document_id=doc.id,
                            vector_store_id=vector_store_id,
                            openai_file_id=known_openai_file_id,
                            openai_filename=doc.original_filename or doc.title,
                            content_hash_synced=local_hash,
                            sync_status="synced",
                            last_synced_at=doc.synced_at,
                            last_error=None,
                            is_active=True,
                            updated_at=datetime.utcnow(),
                        )
                        db.add(mapping)

                    doc.sync_status = "ignored"
                    doc.sync_error = None
                    db.add(doc)
                    summary.ignored += 1
                    summary.document_results.append({
                        "document_id": doc.id,
                        "title": doc.title,
                        "status": "ignored",
                        "message": "Document deja present dans le vector store cible.",
                    })
                    continue

                doc.sync_status = "error"
                doc.sync_error = "Aucun contenu textuel exploitable n'est disponible pour ce document."
                db.add(doc)
                summary.errors += 1
                summary.document_results.append({
                    "document_id": doc.id,
                    "title": doc.title,
                    "status": "error",
                    "message": doc.sync_error,
                })
                continue

            unchanged = (
                mapping is not None
                and mapping.content_hash_synced == local_hash
                and (mapping.openai_file_id or "") in existing_file_ids
            )
            if unchanged:
                doc.sync_status = "ignored"
                doc.sync_error = None
                db.add(doc)
                summary.ignored += 1
                summary.document_results.append({
                    "document_id": doc.id,
                    "title": doc.title,
                    "status": "ignored",
                    "message": "Document inchangé.",
                })
                continue

            try:
                filename = f"mepo-{project.id[:8]}-{doc.id[:8]}.txt"
                new_file_id = gateway.upload_text_file(filename, payload_text)
                gateway.attach_file_to_vector_store(vector_store_id, new_file_id)

                if mapping and mapping.openai_file_id and mapping.openai_file_id != new_file_id:
                    try:
                        gateway.remove_file_from_vector_store(vector_store_id, mapping.openai_file_id)
                    except Exception as exc:
                        logger.warning(
                            "knowledge_sync.remove_old_file_failed project_id=%s doc_id=%s file_id=%s error=%s",
                            project_id, doc.id, mapping.openai_file_id, exc,
                        )

                if not mapping:
                    mapping = ProjectKnowledgeSyncItem(
                        project_id=project_id,
                        knowledge_document_id=doc.id,
                        vector_store_id=vector_store_id,
                    )

                is_update = bool(mapping.openai_file_id)
                mapping.openai_file_id = new_file_id
                mapping.openai_filename = filename
                mapping.content_hash_synced = local_hash
                mapping.sync_status = "synced"
                mapping.last_synced_at = datetime.utcnow()
                mapping.last_error = None
                mapping.is_active = True
                mapping.updated_at = datetime.utcnow()
                db.add(mapping)

                doc.openai_file_id = new_file_id
                doc.sync_status = "updated" if is_update else "added"
                doc.synced_at = mapping.last_synced_at
                doc.sync_error = None
                db.add(doc)

                if is_update:
                    summary.updated += 1
                else:
                    summary.added += 1
                summary.document_results.append({
                    "document_id": doc.id,
                    "title": doc.title,
                    "status": doc.sync_status,
                    "message": "Document synchronisé.",
                })
            except Exception as exc:
                doc.sync_status = "error"
                doc.sync_error = str(exc)[:500]
                db.add(doc)
                if mapping:
                    mapping.sync_status = "error"
                    mapping.last_error = str(exc)[:500]
                    mapping.updated_at = datetime.utcnow()
                    db.add(mapping)
                summary.errors += 1
                summary.document_results.append({
                    "document_id": doc.id,
                    "title": doc.title,
                    "status": "error",
                    "message": doc.sync_error,
                })

        inactive_docs = (
            db.query(ProjectKnowledgeDocument)
            .filter(
                ProjectKnowledgeDocument.project_id == project_id,
                ProjectKnowledgeDocument.is_active.is_(False),
            )
            .all()
        )
        for doc in inactive_docs:
            mappings = (
                db.query(ProjectKnowledgeSyncItem)
                .filter(
                    ProjectKnowledgeSyncItem.project_id == project_id,
                    ProjectKnowledgeSyncItem.knowledge_document_id == doc.id,
                    ProjectKnowledgeSyncItem.vector_store_id == vector_store_id,
                    ProjectKnowledgeSyncItem.is_active.is_(True),
                )
                .all()
            )
            for mapping in mappings:
                try:
                    if mapping.openai_file_id:
                        gateway.remove_file_from_vector_store(vector_store_id, mapping.openai_file_id)
                    mapping.is_active = False
                    mapping.sync_status = "removed"
                    mapping.last_error = None
                    mapping.updated_at = datetime.utcnow()
                    db.add(mapping)

                    doc.sync_status = "removed"
                    doc.sync_error = None
                    db.add(doc)

                    summary.removed += 1
                    summary.document_results.append({
                        "document_id": doc.id,
                        "title": doc.title,
                        "status": "removed",
                        "message": "Document retiré du vector store cible.",
                    })
                except Exception as exc:
                    summary.errors += 1
                    mapping.sync_status = "error"
                    mapping.last_error = str(exc)[:500]
                    mapping.updated_at = datetime.utcnow()
                    db.add(mapping)
                    doc.sync_status = "error"
                    doc.sync_error = str(exc)[:500]
                    db.add(doc)

        settings.last_sync_status = "success" if summary.errors == 0 else "partial"
        settings.last_sync_finished_at = datetime.utcnow()
        settings.last_sync_error = None if summary.errors == 0 else "Certaines synchronisations ont échoué."
        summary.finished_at = settings.last_sync_finished_at
        settings.last_sync_summary_json = summary.to_dict()
        settings.updated_at = datetime.utcnow()
        db.add(settings)
        db.commit()
        invalidate_workspace_cache(project_id=project_id)

        logger.info(
            "knowledge_sync.finish project_id=%s vector_store_id=%s added=%s updated=%s ignored=%s removed=%s errors=%s",
            project_id, vector_store_id, summary.added, summary.updated, summary.ignored, summary.removed, summary.errors,
        )
        db.refresh(settings)
        return settings, summary
    except Exception:
        db.rollback()
        settings = (
            db.query(ProjectKnowledgeSettings)
            .filter(ProjectKnowledgeSettings.project_id == project_id)
            .first()
        )
        if settings:
            settings.last_sync_status = "failed"
            settings.last_sync_finished_at = datetime.utcnow()
            if not settings.last_sync_error:
                settings.last_sync_error = "La synchronisation a échoué."
            settings.updated_at = datetime.utcnow()
            db.add(settings)
            db.commit()
        raise
    finally:
        _release_project_lock(project_id)
