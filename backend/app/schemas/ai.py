"""AI schemas — Shadow PO V1 response model.

The full response structure is:
  mode + skill + understanding + related_objects + answer_markdown
  + certainty + next_actions + proposed_actions + generated_objects
  + memory_updates + knowledge_docs_used + [debug]
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.runtime import (
    PromptRuntimeConfig,
    RetrievalPipelineTrace,
    RetrievalTrace,
    SourcePlan,
    ToolExposureDecision,
    WorkspaceContext,
)


# ─── Context (injected from DB) ───────────────────────────────────────────────

class ContextObject(BaseModel):
    kind: str   # project | space | topic | ticket | document | topic_memory
    id: str
    label: str
    content: dict = Field(default_factory=dict)


# ─── Knowledge doc reference ──────────────────────────────────────────────────

class KnowledgeDocRef(BaseModel):
    id: str
    title: str
    document_type: str
    openai_file_id: str | None = None


# ─── Intent routing ───────────────────────────────────────────────────────────

class IntentResult(BaseModel):
    mode: str
    confidence: str  # high | medium | low
    reading_line: str  # one-line summary of what was understood
    is_rewrite_existing: bool = False  # True when user says "écris/refais/améliore la fiche"


# ─── Rich response fields ─────────────────────────────────────────────────────

class RelatedObject(BaseModel):
    """A real MePO object that is directly relevant to the answer."""
    kind: str   # ticket | topic | document | memory | knowledge_doc
    id: str
    label: str


class CertaintyBlock(BaseModel):
    certain: list[str] = Field(default_factory=list)
    inferred: list[str] = Field(default_factory=list)
    to_confirm: list[str] = Field(default_factory=list)


class ProposedAction(BaseModel):
    """An action the user can validate to trigger an operation in MePO."""
    action_id: str = Field(alias="actionId")
    type: Literal[
        "create_ticket",
        "create_document",
        "add_comment",
        "select_ticket_then_add_comment",
        "create_artifact",
        "update_memory",
        "create_topic_then_ticket",
        "select_topic_then_create_ticket",
    ]
    label: str
    payload: dict = Field(default_factory=dict)
    requires_confirmation: bool = True  # product rule: always true

    model_config = {"populate_by_name": True}


class GeneratedObject(BaseModel):
    """A fully formed object ready to be created, displayed for user review."""
    type: str   # ticket | document | comment | artifact
    label: str
    content: dict = Field(default_factory=dict)


class MemoryUpdate(BaseModel):
    """A proposed addition to the active topic's memory."""
    field: str  # facts | decisions | risks | dependencies | open_questions
    content: str


class RuntimeInput(BaseModel):
    user_request: str = Field(alias="userRequest")
    intent_mode: str = Field(alias="intentMode")
    source_plan: SourcePlan = Field(alias="sourcePlan")
    workspace_context: WorkspaceContext | None = Field(default=None, alias="workspaceContext")
    context_objects: list[ContextObject] = Field(default_factory=list, alias="contextObjects")
    selected_knowledge_docs: list[KnowledgeDocRef] = Field(default_factory=list, alias="selectedKnowledgeDocs")
    vector_store_id: str | None = Field(default=None, alias="vectorStoreId")

    model_config = {"populate_by_name": True}


# ─── Debug info ───────────────────────────────────────────────────────────────

class DebugInfo(BaseModel):
    mode_detected: str
    confidence: str = "medium"
    reading_line: str = ""
    skill: str = "shadow_po_v1"
    context_policy: str
    objects_injected: int
    tokens_estimate: int
    prompt_summary: str
    context_objects: list[ContextObject] = Field(default_factory=list)
    knowledge_docs: list[KnowledgeDocRef] = Field(default_factory=list)
    file_ids_sent: list[str] = Field(default_factory=list)
    used_responses_api: bool = False
    vector_store_id: str | None = None
    runtime_mode: str = "mepo"
    pipeline_used: str = "runMepoPipeline"
    fallback_triggered: bool = False
    fallback_reason: str | None = None
    file_search_exposed: bool = False
    vector_store_used: bool = False
    why_target_ticket_selected: str | None = None
    why_vector_store_blocked_or_used: str | None = None
    retrieval_planned: bool = False
    sources_allowed: list[str] = Field(default_factory=list)
    sources_used: list[str] = Field(default_factory=list)
    stop_reason: str | None = None
    validator_status: str = "not_run"
    input_chars_total: int = 0
    compiled_skill_chars: int = 0
    context_objects_chars: int = 0
    evidence_chars: int = 0
    conversation_summary_chars: int = 0
    raw_history_chars_dropped: int = 0
    estimated_prompt_tokens: int = 0
    budget_policy: dict = Field(default_factory=dict)
    assembly_metrics: dict = Field(default_factory=dict)
    object_metrics: dict = Field(default_factory=dict)
    evidence_metrics: dict = Field(default_factory=dict)
    budget_used: dict = Field(default_factory=dict)
    context_pack: dict = Field(default_factory=dict)
    prompt_runtime_config: PromptRuntimeConfig | None = None
    retrieval_trace: RetrievalTrace | None = None
    pipeline_trace: RetrievalPipelineTrace | None = None
    runtime_input: RuntimeInput | None = None
    workspace_context: WorkspaceContext | None = None
    tool_exposure: ToolExposureDecision | None = None
    raw_llm_response: dict = Field(default_factory=dict)


# ─── Conversation history ─────────────────────────────────────────────────────

class ConversationMessage(BaseModel):
    """A single turn in the conversation history (user or assistant)."""
    role: str   # user | assistant
    content: str


# ─── Request ──────────────────────────────────────────────────────────────────

class AIChatRequest(BaseModel):
    message: str
    project_id: str | None = None
    space_id: str | None = None
    topic_id: str | None = None
    conversation_id: str | None = None
    debug: bool = False
    conversation_history: list[ConversationMessage] = Field(default_factory=list)
    # User preferences — sent by the frontend from the authenticated user's profile
    response_style: str | None = None   # concise | balanced | detailed | expert
    detail_level: str | None = None     # minimal | normal | verbose
    # Display toggles — when False, instruct the LLM to skip these sections
    show_confidence: bool | None = None   # certainty block (certain/inferred/to_confirm)
    show_suggestions: bool | None = None  # proposed_actions


# ─── Response ─────────────────────────────────────────────────────────────────

class AIChatResponse(BaseModel):
    mode: str
    skill: str
    understanding: str
    related_objects: list[RelatedObject]
    answer_markdown: str
    certainty: CertaintyBlock
    next_actions: list[str]
    proposed_actions: list[ProposedAction]
    generated_objects: list[GeneratedObject]
    memory_updates: list[MemoryUpdate]
    knowledge_docs_used: list[KnowledgeDocRef]
    # Lightweight context snapshot always returned so the frontend can render
    # action pickers (e.g. select_ticket_then_add_comment) without debug mode.
    context_objects: list[ContextObject] = Field(default_factory=list)
    openai_response_id: str | None = None
    retrieval_trace: RetrievalTrace | None = None
    pipeline_trace: RetrievalPipelineTrace | None = None
    runtime_input: RuntimeInput | None = None
    debug: DebugInfo | None = None


# ─── Topic / Ticket resolution ───────────────────────────────────────────────

class TopicCandidate(BaseModel):
    id: str
    name: str
    nature: str
    score: int
    score_breakdown: str = ""   # human-readable "+3 titre +2 tags …"


class TopicResolution(BaseModel):
    match_status: str           # exact_match | possible_matches | no_match
    suggested_topic_id: str | None = None
    suggested_topic_name: str | None = None
    suggested_topic_nature: str | None = None
    candidate_topics: list[TopicCandidate] = Field(default_factory=list)
    top_score: int = 0
    decision_reason: str = ""   # human-readable explanation of the decision
    context_used: str = ""      # which context bias was applied (active_topic, single_topic, …)


class TicketResolution(BaseModel):
    # match_status: found_duplicate | found_similar | not_found
    match_status: str
    suggested_ticket_id: str | None = None
    suggested_ticket_title: str | None = None
    suggested_ticket_type: str | None = None
    suggested_ticket_priority: str | None = None
    duplicate_score: int = 0
    decision_reason: str = ""


# ─── Action execution ─────────────────────────────────────────────────────────

class ActionExecuteRequest(BaseModel):
    action_id: str | None = None
    action_type: str
    confirmed: bool = False
    topic_id: str | None = None
    space_id: str | None = None
    project_id: str | None = None
    payload: dict = Field(default_factory=dict)


class ActionExecuteResponse(BaseModel):
    success: bool
    action_id: str | None = None
    action_type: str
    created_id: str | None = None
    message: str
    created_object: dict | None = None


# ─── Legacy alias (kept for any stray imports) ────────────────────────────────

class AIContextSource(BaseModel):
    kind: str
    label: str
