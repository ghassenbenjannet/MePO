from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Document, Project, Space, Ticket, Topic, TopicMemory
from app.models.project_knowledge_document import ProjectKnowledgeDocument
from app.models.project_knowledge_settings import ProjectKnowledgeSettings
from app.schemas.runtime import (
    DocumentRef,
    DocumentRegistryEntry,
    KnowledgeDocumentRef,
    MemoryEntry,
    TestRepositoryRef,
    TicketSummary,
    VectorStoreBinding,
    WorkspaceCacheStatus,
    WorkspaceContext,
    WorkspaceProjectContext,
    WorkspaceSpaceContext,
    WorkspaceTopicContext,
)
from app.services.ai.local_indexer import (
    build_document_chunks,
    build_source_registry,
    build_test_case_index,
)
from app.services.ai.workspace_cache import (
    build_workspace_cache_key,
    get_workspace_cache_entry,
    set_workspace_cache_entry,
)


def _memory_entries(memory: TopicMemory | None) -> list[MemoryEntry]:
    if not memory:
        return []
    entries: list[MemoryEntry] = []
    for section_name, items in (
        ("facts", memory.facts or []),
        ("decisions", memory.decisions or []),
        ("risks", memory.risks or []),
        ("dependencies", memory.dependencies or []),
        ("open_questions", memory.open_questions or []),
    ):
        for item in items:
            entries.append(MemoryEntry(section=section_name, content=str(item)))
    return entries


def _document_ref(doc: Document) -> DocumentRef:
    return DocumentRef(
        documentId=doc.id,
        title=doc.title,
        docType=doc.type,
        topicId=doc.topic_id,
        spaceId=doc.space_id,
        tags=[str(tag) for tag in (doc.tags or [])],
        updatedAt=doc.updated_at,
    )


def build_workspace_context(
    db: Session,
    *,
    project_id: str,
    space_id: str | None = None,
    topic_id: str | None = None,
) -> WorkspaceContext:
    cache_key = build_workspace_cache_key(project_id=project_id, space_id=space_id, topic_id=topic_id)
    cached_entry = get_workspace_cache_entry(cache_key)
    if cached_entry is not None:
        return cached_entry.value.model_copy(
            update={
                "cache_status": WorkspaceCacheStatus(
                    cacheKey=cache_key,
                    builtAt=cached_entry.built_at,
                    fromCache=True,
                )
            },
            deep=True,
        )

    project = db.get(Project, project_id)
    if not project:
        raise LookupError("Project not found")

    space = db.get(Space, space_id) if space_id else None
    topic = db.get(Topic, topic_id) if topic_id else None

    topic_tickets: list[TicketSummary] = []
    topic_memory: list[MemoryEntry] = []
    topic_document_rows: list[Document] = []
    if topic:
        tickets = db.query(Ticket).filter(Ticket.topic_id == topic.id).limit(25).all()
        topic_tickets = [
            TicketSummary(
                ticketId=t.id,
                title=t.title,
                type=t.type,
                status=t.status,
                priority=t.priority,
            )
            for t in tickets
        ]
        memory = db.query(TopicMemory).filter(TopicMemory.topic_id == topic.id).first()
        topic_memory = _memory_entries(memory)
        topic_document_rows = (
            db.query(Document)
            .filter(Document.topic_id == topic.id, Document.is_archived.is_(False))
            .limit(20)
            .all()
        )

    space_document_rows: list[Document] = []
    if space:
        query = (
            db.query(Document)
            .filter(Document.space_id == space.id, Document.is_archived.is_(False))
        )
        if topic:
            query = query.filter((Document.topic_id != topic.id) | (Document.topic_id.is_(None)))
        space_document_rows = query.limit(30).all()

    knowledge_doc_rows = (
        db.query(ProjectKnowledgeDocument)
        .filter(
            ProjectKnowledgeDocument.project_id == project.id,
            ProjectKnowledgeDocument.is_active.is_(True),
        )
        .limit(40)
        .all()
    )

    topic_documents = [_document_ref(doc) for doc in topic_document_rows]
    space_documents = [_document_ref(doc) for doc in space_document_rows]
    knowledge_documents = [
        KnowledgeDocumentRef(
            knowledgeDocumentId=doc.id,
            title=doc.title,
            category=doc.category,
            tags=[str(tag) for tag in (doc.tags or [])],
            syncStatus=doc.sync_status,
            updatedAt=doc.updated_at,
        )
        for doc in knowledge_doc_rows
    ]
    test_repositories = [
        TestRepositoryRef(
            knowledgeDocumentId=doc.id,
            title=doc.title,
            updatedAt=doc.updated_at,
        )
        for doc in knowledge_doc_rows
        if doc.category == "test_cases"
    ]

    source_registry = build_source_registry(
        project_id=project.id,
        local_documents=[*topic_document_rows, *space_document_rows],
        knowledge_documents=knowledge_doc_rows,
    )
    doc_registry = [
        DocumentRegistryEntry(
            sourceType=item.source_type,
            sourceId=item.source_id,
            title=item.title,
            category=item.category,
            priority=item.priority,
            reliabilityScore=item.reliability_score,
        )
        for item in source_registry
    ]
    document_index = build_document_chunks(
        project_id=project.id,
        local_documents=[*topic_document_rows, *space_document_rows],
        knowledge_documents=knowledge_doc_rows,
    )
    test_index = build_test_case_index(knowledge_doc_rows)

    knowledge_settings = (
        db.query(ProjectKnowledgeSettings)
        .filter(ProjectKnowledgeSettings.project_id == project.id)
        .first()
    )

    context = WorkspaceContext(
        projectContext=WorkspaceProjectContext(
            id=project.id,
            name=project.name,
            status=project.status,
            description=project.description,
        ),
        spaceContext=WorkspaceSpaceContext(
            id=space.id,
            name=space.name,
            status=space.status,
            description=space.description,
            start_date=str(space.start_date) if space and space.start_date else None,
            end_date=str(space.end_date) if space and space.end_date else None,
        ) if space else None,
        activeTopic=WorkspaceTopicContext(
            id=topic.id,
            title=topic.title,
            status=topic.status,
            priority=topic.priority,
            topic_nature=topic.topic_nature,
            description=topic.description,
        ) if topic else None,
        topicTickets=topic_tickets,
        topicMemory=topic_memory,
        topicDocuments=topic_documents,
        spaceDocuments=space_documents,
        knowledgeDocuments=knowledge_documents,
        testRepositories=test_repositories,
        docRegistry=doc_registry,
        testIndex=test_index,
        documentIndex=document_index,
        sourceRegistry=source_registry,
        vectorStoreBinding=VectorStoreBinding(
            vector_store_id=knowledge_settings.vector_store_id if knowledge_settings else None,
            last_sync_at=knowledge_settings.last_sync_finished_at if knowledge_settings else None,
            sync_status=knowledge_settings.last_sync_status if knowledge_settings else "never",
        ),
        cacheStatus=None,
    )

    cache_entry = set_workspace_cache_entry(cache_key, context.model_copy(update={"cache_status": None}, deep=True))
    return context.model_copy(
        update={
            "cache_status": WorkspaceCacheStatus(
                cacheKey=cache_key,
                builtAt=cache_entry.built_at,
                fromCache=False,
            )
        },
        deep=True,
    )
