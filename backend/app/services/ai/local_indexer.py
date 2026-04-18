from __future__ import annotations

import re
from typing import Iterable

from app.models.document import Document
from app.models.project_knowledge_document import ProjectKnowledgeDocument
from app.schemas.runtime import DocumentChunk, SourceRegistryEntry, TestCaseIndex


_HTML_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", _HTML_RE.sub(" ", text)).strip()


def _split_chunks(content: str, max_chars: int = 900) -> list[str]:
    content = re.sub(r"\s+\n", "\n", content).strip()
    if not content:
        return []
    paragraphs = [part.strip() for part in re.split(r"\n{2,}", content) if part.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            chunks.append(current)
        if len(paragraph) <= max_chars:
            current = paragraph
        else:
            for i in range(0, len(paragraph), max_chars):
                chunks.append(paragraph[i : i + max_chars])
            current = ""
    if current:
        chunks.append(current)
    return chunks


def build_document_chunks(
    *,
    project_id: str,
    local_documents: Iterable[Document],
    knowledge_documents: Iterable[ProjectKnowledgeDocument],
) -> list[DocumentChunk]:
    chunks: list[DocumentChunk] = []

    for doc in local_documents:
        content = _strip_html(doc.content)
        for index, chunk in enumerate(_split_chunks(content), start=1):
            chunks.append(
                DocumentChunk(
                    chunkId=f"{doc.id}:{index}",
                    documentId=doc.id,
                    title=doc.title,
                    docType=doc.type,
                    projectId=project_id,
                    spaceId=doc.space_id,
                    topicId=doc.topic_id,
                    sourceType="local_document",
                    tags=[str(tag) for tag in (doc.tags or [])],
                    priority=3,
                    reliabilityScore=90,
                    versionLabel=doc.updated_at.isoformat() if doc.updated_at else None,
                    content=chunk,
                )
            )

    for doc in knowledge_documents:
        content = (doc.content_extracted_text or "").strip() or (doc.summary or "").strip()
        for index, chunk in enumerate(_split_chunks(content), start=1):
            chunks.append(
                DocumentChunk(
                    chunkId=f"{doc.id}:{index}",
                    documentId=doc.id,
                    title=doc.title,
                    docType=doc.category,
                    projectId=project_id,
                    spaceId=None,
                    topicId=(doc.linked_topic_ids or [None])[0],
                    sourceType="knowledge_document",
                    tags=[str(tag) for tag in (doc.tags or [])],
                    priority=4,
                    reliabilityScore=80,
                    versionLabel=doc.updated_at.isoformat() if doc.updated_at else None,
                    content=chunk,
                )
            )

    return chunks


def build_test_case_index(knowledge_documents: Iterable[ProjectKnowledgeDocument]) -> list[TestCaseIndex]:
    entries: list[TestCaseIndex] = []
    for doc in knowledge_documents:
        if doc.category != "test_cases":
            continue
        text = (doc.content_extracted_text or "").strip() or (doc.summary or "").strip()
        if not text:
            continue
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        steps = [line for line in lines if re.match(r"^(?:\d+[\.\)]|-|\*)\s+", line)]
        expected = [
            line.split(":", 1)[1].strip()
            for line in lines
            if ":" in line and line.lower().startswith(("expected", "resultat attendu", "résultat attendu"))
        ]
        keywords = sorted({word.lower() for word in re.findall(r"[A-Za-z0-9_-]{4,}", f"{doc.title} {doc.summary or ''}")})[:12]
        entries.append(
            TestCaseIndex(
                testId=doc.id,
                title=doc.title,
                module=(doc.tags or [None])[0],
                keywords=keywords,
                steps=steps[:12],
                expectedResults=expected[:12],
                sourceFile=doc.original_filename or doc.title,
                status="active" if doc.is_active else "inactive",
                coverageText=(doc.summary or text[:400]).strip(),
            )
        )
    return entries


def build_source_registry(
    *,
    project_id: str,
    local_documents: Iterable[Document],
    knowledge_documents: Iterable[ProjectKnowledgeDocument],
) -> list[SourceRegistryEntry]:
    registry: list[SourceRegistryEntry] = []
    for doc in local_documents:
        registry.append(
            SourceRegistryEntry(
                sourceType="local_document",
                sourceId=doc.id,
                title=doc.title,
                category=doc.type,
                projectId=project_id,
                spaceId=doc.space_id,
                topicId=doc.topic_id,
                priority=3,
                reliabilityScore=90,
                versionLabel=doc.updated_at.isoformat() if doc.updated_at else None,
            )
        )
    for doc in knowledge_documents:
        registry.append(
            SourceRegistryEntry(
                sourceType="knowledge_document",
                sourceId=doc.id,
                title=doc.title,
                category=doc.category,
                projectId=project_id,
                spaceId=None,
                topicId=(doc.linked_topic_ids or [None])[0],
                priority=4,
                reliabilityScore=80,
                versionLabel=doc.updated_at.isoformat() if doc.updated_at else None,
            )
        )
    return registry
