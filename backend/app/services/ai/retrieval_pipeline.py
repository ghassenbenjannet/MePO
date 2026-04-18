from __future__ import annotations

from dataclasses import dataclass

from app.schemas.ai import ContextObject, IntentResult, KnowledgeDocRef, RuntimeInput
from app.schemas.runtime import (
    ContextAssembly,
    RetrievalPipelineTrace,
    RetrievalTrace,
    SourcePlan,
    SourcePlanStep,
    SufficiencyCheck,
    WorkspaceContext,
)
from app.services.ai.retrieval_orchestrator import build_retrieval_trace
from app.services.ai.runtime_contracts import get_mode_source_contract


@dataclass
class RetrievalPipelineResult:
    source_plan: SourcePlan
    use_knowledge_docs: bool
    use_vector_store: bool
    retrieval_trace: RetrievalTrace
    sufficiency_check: SufficiencyCheck
    context_assembly: ContextAssembly
    pipeline_trace: RetrievalPipelineTrace
    runtime_input: RuntimeInput


def build_source_plan(
    *,
    mode: str,
    has_vector_store: bool,
) -> SourcePlan:
    contract = get_mode_source_contract(mode)
    allowed_sources = set(contract["allowed_sources"])
    steps = [
        SourcePlanStep(
            order=index,
            level=level,
            allowed=level in allowed_sources,
            reason=(
                "Autorise par la politique du mode."
                if level in allowed_sources
                else "Interdit par la politique du mode."
            ),
        )
        for index, level in enumerate(
            [
                "mepo_objects",
                "topic_memory",
                "local_documents",
                "knowledge_documents",
                "vector_store",
            ],
            start=1,
        )
    ]
    return SourcePlan(
        mode=mode,
        stopRule=str(contract["stop_rule"]),
        vectorStoreEligible=("vector_store" in allowed_sources and has_vector_store),
        steps=steps,
    )


def _build_sufficiency_check(trace: RetrievalTrace) -> SufficiencyCheck:
    used_step = next((step for step in reversed(trace.steps) if step.used), trace.steps[0])
    return SufficiencyCheck(
        sufficient=True,
        stopLevel=trace.final_level,
        reason=used_step.reason,
    )


def _build_context_assembly(
    *,
    workspace_context: WorkspaceContext | None,
    context_objects: list[ContextObject],
    selected_knowledge_docs: list[KnowledgeDocRef],
) -> ContextAssembly:
    return ContextAssembly(
        contextObjectCount=len(context_objects),
        topicTicketCount=len(workspace_context.topic_tickets) if workspace_context else 0,
        topicDocumentCount=len(workspace_context.topic_documents) if workspace_context else 0,
        spaceDocumentCount=len(workspace_context.space_documents) if workspace_context else 0,
        knowledgeDocumentCount=len(selected_knowledge_docs),
        testCaseIndexCount=len(workspace_context.test_index) if workspace_context else 0,
        documentChunkCount=len(workspace_context.document_index) if workspace_context else 0,
    )


def execute_retrieval_pipeline(
    *,
    intent: IntentResult,
    user_message: str,
    workspace_context: WorkspaceContext | None,
    context_objects: list[ContextObject],
    selected_knowledge_docs: list[KnowledgeDocRef],
    needs_project_knowledge: bool,
    has_vector_store: bool,
    stop_on_mepo_objects: bool,
) -> RetrievalPipelineResult:
    source_plan = build_source_plan(mode=intent.mode, has_vector_store=has_vector_store)
    has_local_documents = any(obj.kind == "document" for obj in context_objects)
    use_knowledge_docs, use_vector_store, retrieval_trace = build_retrieval_trace(
        mode=intent.mode,
        has_local_documents=has_local_documents,
        needs_project_knowledge=needs_project_knowledge,
        selected_knowledge_docs_count=len(selected_knowledge_docs),
        has_vector_store=has_vector_store,
        stop_on_mepo_objects=stop_on_mepo_objects,
    )
    sufficiency_check = _build_sufficiency_check(retrieval_trace)
    effective_knowledge_docs = selected_knowledge_docs if use_knowledge_docs else []
    context_assembly = _build_context_assembly(
        workspace_context=workspace_context,
        context_objects=context_objects,
        selected_knowledge_docs=effective_knowledge_docs,
    )
    pipeline_trace = RetrievalPipelineTrace(
        intentMode=intent.mode,
        selectedMode=intent.mode,
        sourcePlan=source_plan,
        retrievalTrace=retrieval_trace,
        sufficiencyCheck=sufficiency_check,
        contextAssembly=context_assembly,
    )
    runtime_input = RuntimeInput(
        userRequest=user_message,
        intentMode=intent.mode,
        sourcePlan=source_plan,
        workspaceContext=workspace_context,
        contextObjects=context_objects,
        selectedKnowledgeDocs=effective_knowledge_docs,
        vectorStoreId=workspace_context.vector_store_binding.vector_store_id
        if workspace_context and use_vector_store
        else None,
    )
    return RetrievalPipelineResult(
        source_plan=source_plan,
        use_knowledge_docs=use_knowledge_docs,
        use_vector_store=use_vector_store,
        retrieval_trace=retrieval_trace,
        sufficiency_check=sufficiency_check,
        context_assembly=context_assembly,
        pipeline_trace=pipeline_trace,
        runtime_input=runtime_input,
    )
