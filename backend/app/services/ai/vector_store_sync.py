"""Legacy wrapper for knowledge sync.

This module intentionally delegates to the project knowledge sync service.
It must never create a vector store automatically.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from sqlalchemy.orm import Session

from app.services.knowledge.sync_service import sync_project_knowledge

@dataclass
class SyncResult:
    synced: int = 0
    skipped: int = 0
    no_file: int = 0
    errors: list[str] = field(default_factory=list)
    vector_store_id: str | None = None


def sync_docs_to_vector_store(
    db: Session,
    project_id: str,
) -> SyncResult:
    settings, summary = sync_project_knowledge(db=db, project_id=project_id)
    return SyncResult(
        synced=summary.added + summary.updated,
        skipped=summary.ignored,
        no_file=0,
        errors=[
            item["message"]
            for item in summary.document_results
            if item.get("status") == "error"
        ],
        vector_store_id=settings.vector_store_id,
    )
