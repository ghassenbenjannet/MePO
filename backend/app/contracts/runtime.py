from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

SourceLevel = Literal[
    "mepo_objects",
    "topic_memory",
    "local_documents",
    "knowledge_documents",
    "vector_store",
]

RiskLevel = Literal["low", "medium", "high"]
ExpectedOutputType = Literal["answer", "ticket", "document", "comment", "artifact", "memory_update"]
PolicyCheckStatus = Literal["pending", "passed", "blocked"]
DuplicateCheckStatus = Literal["pending", "clear", "duplicate", "similar", "not_applicable"]


class RuntimeSessionInfo(BaseModel):
    contract_version: Literal["v1"] = "v1"
    project_id: str | None = Field(default=None, alias="projectId")
    space_id: str | None = Field(default=None, alias="spaceId")
    topic_id: str | None = Field(default=None, alias="topicId")
    conversation_turns: int = Field(default=0, alias="conversationTurns")
    shadow_runtime_mode: str = Field(default="mepo", alias="shadowRuntimeMode")

    model_config = {"populate_by_name": True}


class RuntimeRequest(BaseModel):
    contract_version: Literal["v1"] = "v1"
    user_request: str = Field(alias="userRequest")
    session: RuntimeSessionInfo
    mode_hint: str | None = Field(default=None, alias="modeHint")
    user_preferences: dict = Field(default_factory=dict, alias="userPreferences")
    compiled_skill_projection: str = Field(default="", alias="compiledSkillProjection")
    source_plan_seed: list[SourceLevel] = Field(default_factory=list, alias="sourcePlanSeed")

    model_config = {"populate_by_name": True}


class IntentDecision(BaseModel):
    contract_version: Literal["v1"] = "v1"
    mode: str
    confidence: str
    needs_retrieval: bool = Field(alias="needsRetrieval")
    retrieval_scope: list[SourceLevel] = Field(default_factory=list, alias="retrievalScope")
    needs_action_proposal: bool = Field(alias="needsActionProposal")
    risk_level: RiskLevel = Field(alias="riskLevel")
    expected_output_type: ExpectedOutputType = Field(alias="expectedOutputType")
    reasoning: str = ""

    model_config = {"populate_by_name": True}


class RetrievalPlanStep(BaseModel):
    order: int
    source: SourceLevel
    reason: str
    filters: dict = Field(default_factory=dict)


class RetrievalPlan(BaseModel):
    contract_version: Literal["v1"] = "v1"
    ordered_steps: list[RetrievalPlanStep] = Field(default_factory=list, alias="orderedSteps")
    allowed_sources: list[SourceLevel] = Field(default_factory=list, alias="allowedSources")
    stop_rule: str = Field(alias="stopRule")
    filters: dict = Field(default_factory=dict)
    fallback_policy: str = Field(alias="fallbackPolicy")
    max_evidence_budget: int = Field(default=12, alias="maxEvidenceBudget")

    model_config = {"populate_by_name": True}


class EvidenceItem(BaseModel):
    evidence_id: str = Field(alias="evidenceId")
    title: str
    source_level: SourceLevel = Field(alias="sourceLevel")
    relevance_score: float = Field(alias="relevanceScore")
    reliability_score: float = Field(alias="reliabilityScore")
    provenance: dict = Field(default_factory=dict)
    extracted_claims: list[str] = Field(default_factory=list, alias="extractedClaims")
    excerpt: str = ""

    model_config = {"populate_by_name": True}


class EvidencePack(BaseModel):
    contract_version: Literal["v1"] = "v1"
    evidence_items: list[EvidenceItem] = Field(default_factory=list, alias="evidenceItems")
    source_level: SourceLevel = Field(alias="sourceLevel")
    relevance_score: float = Field(default=0.0, alias="relevanceScore")
    reliability_score: float = Field(default=0.0, alias="reliabilityScore")
    provenance: list[dict] = Field(default_factory=list)
    extracted_claims: list[str] = Field(default_factory=list, alias="extractedClaims")

    model_config = {"populate_by_name": True}


class CompactObjectRef(BaseModel):
    kind: str
    id: str
    label: str
    summary: str
    relevance_reason: str = Field(alias="relevanceReason")
    source_level: SourceLevel = Field(alias="sourceLevel")

    model_config = {"populate_by_name": True}


class CompactEvidence(BaseModel):
    evidence_id: str = Field(alias="evidenceId")
    title: str
    source_level: SourceLevel = Field(alias="sourceLevel")
    summary: str
    relevance_reason: str = Field(alias="relevanceReason")
    provenance: dict = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class CountCharMetrics(BaseModel):
    before_count: int = Field(alias="beforeCount")
    after_count: int = Field(alias="afterCount")
    before_chars: int = Field(alias="beforeChars")
    after_chars: int = Field(alias="afterChars")

    model_config = {"populate_by_name": True}


class AssemblyMetrics(BaseModel):
    object_count_before: int = Field(alias="objectCountBefore")
    object_count_after: int = Field(alias="objectCountAfter")
    evidence_count_before: int = Field(alias="evidenceCountBefore")
    evidence_count_after: int = Field(alias="evidenceCountAfter")
    chars_before: int = Field(alias="charsBefore")
    chars_after: int = Field(alias="charsAfter")
    trimmed: bool = False
    trim_reasons: list[str] = Field(default_factory=list, alias="trimReasons")

    model_config = {"populate_by_name": True}


class PromptBudgetPolicy(BaseModel):
    mode: str
    max_skill_chars: int = Field(alias="maxSkillChars")
    max_object_count: int = Field(alias="maxObjectCount")
    max_object_chars: int = Field(alias="maxObjectChars")
    max_evidence_count: int = Field(alias="maxEvidenceCount")
    max_evidence_chars: int = Field(alias="maxEvidenceChars")
    max_total_chars: int = Field(alias="maxTotalChars")
    max_estimated_tokens: int = Field(alias="maxEstimatedTokens")

    model_config = {"populate_by_name": True}


class ContextPack(BaseModel):
    contract_version: Literal["v1"] = "v1"
    canonical_user_request: str = Field(alias="canonicalUserRequest")
    mode: str
    skill_projection: str = Field(default="", alias="skillProjection")
    object_summaries: list[CompactObjectRef] = Field(default_factory=list, alias="objectSummaries")
    evidence_items: list[CompactEvidence] = Field(default_factory=list, alias="evidenceItems")
    key_objects: list[dict] = Field(default_factory=list, alias="keyObjects")
    evidence_summary: str = Field(default="", alias="evidenceSummary")
    contradictions: list[str] = Field(default_factory=list)
    open_points: list[str] = Field(default_factory=list, alias="openPoints")
    output_contract: dict = Field(default_factory=dict, alias="outputContract")
    action_policy_projection: dict = Field(default_factory=dict, alias="actionPolicyProjection")
    assembly_metrics: AssemblyMetrics | None = Field(default=None, alias="assemblyMetrics")
    object_metrics: CountCharMetrics | None = Field(default=None, alias="objectMetrics")
    evidence_metrics: CountCharMetrics | None = Field(default=None, alias="evidenceMetrics")
    budget_policy: PromptBudgetPolicy | None = Field(default=None, alias="budgetPolicy")
    dropped_evidence: list[dict] = Field(default_factory=list, alias="droppedEvidence")
    dropped_objects: list[dict] = Field(default_factory=list, alias="droppedObjects")

    model_config = {"populate_by_name": True}


class ProposedAction(BaseModel):
    contract_version: Literal["v1"] = "v1"
    action_id: str = Field(alias="actionId")
    type: str
    target: dict = Field(default_factory=dict)
    payload: dict = Field(default_factory=dict)
    requires_confirmation: bool = Field(default=True, alias="requiresConfirmation")
    policy_check_status: PolicyCheckStatus = Field(default="pending", alias="policyCheckStatus")
    duplicate_check_status: DuplicateCheckStatus = Field(default="pending", alias="duplicateCheckStatus")

    model_config = {"populate_by_name": True}


class MemoryWrite(BaseModel):
    contract_version: Literal["v1"] = "v1"
    scope: Literal["turn", "session", "topic", "project"]
    type: str
    content: str
    provenance: dict = Field(default_factory=dict)
    confidence: str = "medium"
    stability_status: Literal["draft", "candidate", "stable"] = Field(alias="stabilityStatus")

    model_config = {"populate_by_name": True}
