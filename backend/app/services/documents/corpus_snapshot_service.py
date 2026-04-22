"""Build the project knowledge corpus snapshot injected into chat context.

Uses ProjectKnowledgeDocument records (active + synced) as the single source
of truth. Each document contributes its extracted text (capped per doc).
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models.project_knowledge_document import ProjectKnowledgeDocument


@dataclass
class CorpusSnapshot:
    project_id: str
    corpus_status: str
    corpus_version: str | None
    document_ids: list[str] = field(default_factory=list)
    snapshot_text: str = ""
    # title_to_doc: maps normalized title variants → {doc_id, title}
    # Used by the source rescue layer to auto-populate sources_used
    title_to_doc: dict[str, dict] = field(default_factory=dict)

    @property
    def is_ready(self) -> bool:
        return self.corpus_status == "ready" and bool(self.snapshot_text.strip())


_MAX_CHARS_PER_DOC = 200_000
_MAX_DOCUMENTS = 200


def _normalize_title(title: str) -> str:
    return title.strip().lower().replace(" ", "").replace("-", "").replace("_", "")


def build_project_corpus_snapshot(
    db: Session,
    project_id: str,
    *,
    max_documents: int = _MAX_DOCUMENTS,
) -> CorpusSnapshot:
    docs = (
        db.query(ProjectKnowledgeDocument)
        .filter(
            ProjectKnowledgeDocument.project_id == project_id,
            ProjectKnowledgeDocument.is_active.is_(True),
            ProjectKnowledgeDocument.sync_status.in_(["synced", "ignored"]),
        )
        .order_by(ProjectKnowledgeDocument.synced_at.desc())
        .limit(max_documents)
        .all()
    )

    if not docs:
        return CorpusSnapshot(project_id=project_id, corpus_status="not_indexed", corpus_version=None)

    blocks: list[str] = []
    document_ids: list[str] = []
    combined_hashes: list[str] = []
    title_to_doc: dict[str, dict] = {}

    for doc in docs:
        document_ids.append(doc.id)
        if doc.content_hash:
            combined_hashes.append(doc.content_hash)

        # Build title→doc_id index for source rescue (multiple variants)
        doc_entry = {"doc_id": doc.id, "title": doc.title}
        title_to_doc[_normalize_title(doc.title)] = doc_entry
        # Also index word subsets (first 3 words) for partial matching
        words = doc.title.strip().split()
        if len(words) >= 2:
            title_to_doc[_normalize_title(" ".join(words[:3]))] = doc_entry

        content = (doc.content_extracted_text or doc.summary or "").strip()
        if len(content) > _MAX_CHARS_PER_DOC:
            content = content[:_MAX_CHARS_PER_DOC].rstrip() + "..."

        # Format: make doc_id maximally visible so Gemini can extract it
        lines = [
            f"[DOCUMENT doc_id={doc.id}]",
            f"Titre: {doc.title}",
        ]
        if doc.category and doc.category != "reference":
            lines.append(f"Categorie: {doc.category}")
        lines.append("---")
        if content:
            lines.append(content)
        else:
            lines.append("(aucun contenu textuel extrait pour ce document)")
        lines.append(f"[/DOCUMENT doc_id={doc.id}]")
        blocks.append("\n".join(lines))

    corpus_version: str | None = None
    if combined_hashes:
        corpus_version = hashlib.md5("|".join(sorted(combined_hashes)).encode()).hexdigest()[:12]

    return CorpusSnapshot(
        project_id=project_id,
        corpus_status="ready",
        corpus_version=corpus_version,
        document_ids=document_ids,
        snapshot_text="\n\n".join(blocks).strip(),
        title_to_doc=title_to_doc,
    )
