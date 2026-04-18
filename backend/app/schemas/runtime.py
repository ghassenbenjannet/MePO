from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SourceLevel = Literal[
    "mepo_objects",
    "topic_memory",
    "local_documents",
    "knowledge_documents",
    "vector_store",
]


class SourcePriorityItem(BaseModel):
    rank: int
    level: SourceLevel
    label: str


class SourcePriorityPolicy(BaseModel):
    strict_order: bool = True
    items: list[SourcePriorityItem] = Field(default_factory=list)


class FeatureFlags(BaseModel):
    allow_raw_workspace_dump: bool = False
    allow_unplanned_document_search: bool = False
    allow_automatic_action_execution: bool = False
    allow_vector_store_auto_create: bool = False
    allow_full_space_prompt_injection: bool = False


class PromptRuntimeConfig(BaseModel):
    source_priority_policy: SourcePriorityPolicy
    feature_flags: FeatureFlags
    project_runtime_text: str | None = None


class ToolExposureDecision(BaseModel):
    file_search_enabled: bool = Field(alias="fileSearchEnabled")
    reason: str
    vector_store_id: str | None = Field(default=None, alias="vectorStoreId")
    include: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class VectorStoreBinding(BaseModel):
    vector_store_id: str | None = None
    last_sync_at: datetime | None = None
    sync_status: str = "never"


class WorkspaceProjectContext(BaseModel):
    id: str
    name: str
    status: str
    description: str | None = None


class WorkspaceSpaceContext(BaseModel):
    id: str
    name: str
    status: str
    description: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class WorkspaceTopicContext(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    topic_nature: str
    description: str | None = None


class TicketSummary(BaseModel):
    ticket_id: str = Field(alias="ticketId")
    title: str
    type: str
    status: str
    priority: str

    model_config = {"populate_by_name": True}


class MemoryEntry(BaseModel):
    section: str
    content: str


class DocumentRef(BaseModel):
    document_id: str = Field(alias="documentId")
    title: str
    doc_type: str = Field(alias="docType")
    topic_id: str | None = Field(default=None, alias="topicId")
    space_id: str | None = Field(default=None, alias="spaceId")
    tags: list[str] = Field(default_factory=list)
    updated_at: datetime | None = Field(default=None, alias="updatedAt")

    model_config = {"populate_by_name": True}


class KnowledgeDocumentRef(BaseModel):
    knowledge_document_id: str = Field(alias="knowledgeDocumentId")
    title: str
    category: str
    tags: list[str] = Field(default_factory=list)
    sync_status: str = Field(alias="syncStatus")
    updated_at: datetime | None = Field(default=None, alias="updatedAt")

    model_config = {"populate_by_name": True}


class TestRepositoryRef(BaseModel):
    knowledge_document_id: str = Field(alias="knowledgeDocumentId")
    title: str
    updated_at: datetime | None = Field(default=None, alias="updatedAt")

    model_config = {"populate_by_name": True}


class DocumentRegistryEntry(BaseModel):
    source_type: str = Field(alias="sourceType")
    source_id: str = Field(alias="sourceId")
    title: str
    category: str
    priority: int
    reliability_score: int = Field(alias="reliabilityScore")

    model_config = {"populate_by_name": True}


class TestCaseIndex(BaseModel):
    test_id: str = Field(alias="testId")
    title: str
    module: str | None = None
    keywords: list[str] = Field(default_factory=list)
    steps: list[str] = Field(default_factory=list)
    expected_results: list[str] = Field(default_factory=list, alias="expectedResults")
    source_file: str = Field(alias="sourceFile")
    status: str | None = None
    coverage_text: str = Field(alias="coverageText")

    model_config = {"populate_by_name": True}


class DocumentChunk(BaseModel):
    chunk_id: str = Field(alias="chunkId")
    document_id: str = Field(alias="documentId")
    title: str
    doc_type: str = Field(alias="docType")
    project_id: str = Field(alias="projectId")
    space_id: str | None = Field(default=None, alias="spaceId")
    topic_id: str | None = Field(default=None, alias="topicId")
    source_type: str = Field(alias="sourceType")
    tags: list[str] = Field(default_factory=list)
    priority: int
    reliability_score: int = Field(alias="reliabilityScore")
    version_label: str | None = Field(default=None, alias="versionLabel")
    content: str

    model_config = {"populate_by_name": True}


class SourceRegistryEntry(BaseModel):
    source_type: str = Field(alias="sourceType")
    source_id: str = Field(alias="sourceId")
    title: str
    category: str
    project_id: str = Field(alias="projectId")
    space_id: str | None = Field(default=None, alias="spaceId")
    topic_id: str | None = Field(default=None, alias="topicId")
    priority: int
    reliability_score: int = Field(alias="reliabilityScore")
    version_label: str | None = Field(default=None, alias="versionLabel")

    model_config = {"populate_by_name": True}


class WorkspaceCacheStatus(BaseModel):
    cache_key: str = Field(alias="cacheKey")
    built_at: datetime = Field(alias="builtAt")
    from_cache: bool = Field(alias="fromCache")

    model_config = {"populate_by_name": True}


class SourcePlanStep(BaseModel):
    order: int
    level: SourceLevel
    allowed: bool
    reason: str


class SourcePlan(BaseModel):
    mode: str
    stop_rule: str = Field(alias="stopRule")
    vector_store_eligible: bool = Field(alias="vectorStoreEligible")
    steps: list[SourcePlanStep] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class SufficiencyCheck(BaseModel):
    sufficient: bool
    stop_level: SourceLevel = Field(alias="stopLevel")
    reason: str

    model_config = {"populate_by_name": True}


class ContextAssembly(BaseModel):
    context_object_count: int = Field(alias="contextObjectCount")
    topic_ticket_count: int = Field(alias="topicTicketCount")
    topic_document_count: int = Field(alias="topicDocumentCount")
    space_document_count: int = Field(alias="spaceDocumentCount")
    knowledge_document_count: int = Field(alias="knowledgeDocumentCount")
    test_case_index_count: int = Field(alias="testCaseIndexCount")
    document_chunk_count: int = Field(alias="documentChunkCount")

    model_config = {"populate_by_name": True}


class WorkspaceContext(BaseModel):
    project_context: WorkspaceProjectContext = Field(alias="projectContext")
    space_context: WorkspaceSpaceContext | None = Field(default=None, alias="spaceContext")
    active_topic: WorkspaceTopicContext | None = Field(default=None, alias="activeTopic")
    topic_tickets: list[TicketSummary] = Field(default_factory=list, alias="topicTickets")
    topic_memory: list[MemoryEntry] = Field(default_factory=list, alias="topicMemory")
    topic_documents: list[DocumentRef] = Field(default_factory=list, alias="topicDocuments")
    space_documents: list[DocumentRef] = Field(default_factory=list, alias="spaceDocuments")
    knowledge_documents: list[KnowledgeDocumentRef] = Field(default_factory=list, alias="knowledgeDocuments")
    test_repositories: list[TestRepositoryRef] = Field(default_factory=list, alias="testRepositories")
    doc_registry: list[DocumentRegistryEntry] = Field(default_factory=list, alias="docRegistry")
    test_index: list[TestCaseIndex] = Field(default_factory=list, alias="testIndex")
    document_index: list[DocumentChunk] = Field(default_factory=list, alias="documentIndex")
    source_registry: list[SourceRegistryEntry] = Field(default_factory=list, alias="sourceRegistry")
    vector_store_binding: VectorStoreBinding = Field(alias="vectorStoreBinding")
    cache_status: WorkspaceCacheStatus | None = Field(default=None, alias="cacheStatus")

    model_config = {"populate_by_name": True}


class RetrievalTraceStep(BaseModel):
    level: SourceLevel
    used: bool
    reason: str
    item_count: int = Field(default=0, alias="itemCount")

    model_config = {"populate_by_name": True}


class RetrievalTrace(BaseModel):
    mode: str
    final_level: SourceLevel = Field(alias="finalLevel")
    vector_store_allowed: bool = Field(alias="vectorStoreAllowed")
    vector_store_used: bool = Field(alias="vectorStoreUsed")
    steps: list[RetrievalTraceStep] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class RetrievalPipelineTrace(BaseModel):
    intent_mode: str = Field(alias="intentMode")
    selected_mode: str = Field(alias="selectedMode")
    source_plan: SourcePlan = Field(alias="sourcePlan")
    retrieval_trace: RetrievalTrace = Field(alias="retrievalTrace")
    sufficiency_check: SufficiencyCheck = Field(alias="sufficiencyCheck")
    context_assembly: ContextAssembly = Field(alias="contextAssembly")

    model_config = {"populate_by_name": True}
