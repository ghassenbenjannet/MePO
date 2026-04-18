from __future__ import annotations

import logging
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.contracts.runtime import ContextPack, EvidencePack, IntentDecision, RetrievalPlan, RuntimeRequest
from app.core.config import settings
from app.schemas.ai import AIChatRequest, ContextObject, IntentResult, RuntimeInput
from app.schemas.runtime import RetrievalPipelineTrace, RetrievalTrace, ToolExposureDecision, WorkspaceContext
from app.services.ai.local_runtime_orchestrator import LocalRuntimeOrchestrator
from app.services.ai.runtime_mode import ShadowRuntimeMode, resolve_shadow_runtime_mode

logger = logging.getLogger(__name__)


@dataclass
class RuntimePipelinePreparation:
    runtime_mode: ShadowRuntimeMode
    pipeline_used: str
    fallback_triggered: bool
    fallback_reason: str | None
    intent: IntentResult
    context_policy: str
    context_objects: list[ContextObject]
    pre_ticket_res: object | None
    vector_store_id: str | None
    project_runtime_text: str | None
    workspace_context: WorkspaceContext | None
    knowledge_docs: list
    retrieval_trace: RetrievalTrace
    pipeline_trace: RetrievalPipelineTrace
    runtime_input: RuntimeInput
    tool_exposure: ToolExposureDecision
    file_ids: list[str]
    runtime_request: RuntimeRequest | None = None
    intent_decision: IntentDecision | None = None
    retrieval_plan: RetrievalPlan | None = None
    evidence_pack: EvidencePack | None = None
    context_pack: ContextPack | None = None


def _map_artifacts(
    *,
    runtime_mode: ShadowRuntimeMode,
    pipeline_used: str,
    fallback_triggered: bool,
    fallback_reason: str | None,
    artifacts,
) -> RuntimePipelinePreparation:
    return RuntimePipelinePreparation(
        runtime_mode=runtime_mode,
        pipeline_used=pipeline_used,
        fallback_triggered=fallback_triggered,
        fallback_reason=fallback_reason,
        intent=artifacts.intent_result,
        context_policy=artifacts.context_policy,
        context_objects=artifacts.context_objects,
        pre_ticket_res=artifacts.pre_ticket_res,
        vector_store_id=artifacts.vector_store_id,
        project_runtime_text=artifacts.project_runtime_text,
        workspace_context=artifacts.workspace_context,
        knowledge_docs=artifacts.knowledge_docs,
        retrieval_trace=artifacts.retrieval_trace,
        pipeline_trace=artifacts.pipeline_trace,
        runtime_input=artifacts.runtime_input,
        tool_exposure=artifacts.tool_exposure,
        file_ids=artifacts.file_ids,
        runtime_request=artifacts.runtime_request,
        intent_decision=artifacts.intent_decision,
        retrieval_plan=artifacts.retrieval_plan,
        evidence_pack=artifacts.evidence_pack,
        context_pack=artifacts.context_pack,
    )


def run_mepo_pipeline(db: Session, payload: AIChatRequest) -> RuntimePipelinePreparation:
    orchestrator = LocalRuntimeOrchestrator()
    artifacts = orchestrator.run_mepo_pipeline(db, payload)
    return _map_artifacts(
        runtime_mode="mepo",
        pipeline_used="runMepoPipeline",
        fallback_triggered=False,
        fallback_reason=None,
        artifacts=artifacts,
    )


def run_openai_only_pipeline(db: Session, payload: AIChatRequest) -> RuntimePipelinePreparation:
    orchestrator = LocalRuntimeOrchestrator()
    artifacts = orchestrator.run_openai_only_pipeline(db, payload)
    return _map_artifacts(
        runtime_mode="openai_only",
        pipeline_used="runOpenAIOnlyPipeline",
        fallback_triggered=False,
        fallback_reason=None,
        artifacts=artifacts,
    )


def run_hybrid_pipeline(db: Session, payload: AIChatRequest) -> RuntimePipelinePreparation:
    import time

    started_at = time.perf_counter()
    try:
        mepo_result = run_mepo_pipeline(db, payload)
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        if elapsed_ms > 1200:
            fallback = run_openai_only_pipeline(db, payload)
            fallback.runtime_mode = "hybrid"
            fallback.pipeline_used = "runHybridPipeline:openai_only_fallback"
            fallback.fallback_triggered = True
            fallback.fallback_reason = f"Budget hybrid depasse ({elapsed_ms}ms > 1200ms)."
            return fallback
        mepo_result.runtime_mode = "hybrid"
        mepo_result.pipeline_used = "runHybridPipeline:mepo"
        return mepo_result
    except Exception as exc:
        fallback = run_openai_only_pipeline(db, payload)
        fallback.runtime_mode = "hybrid"
        fallback.pipeline_used = "runHybridPipeline:openai_only_fallback"
        fallback.fallback_triggered = True
        fallback.fallback_reason = f"Echec du pipeline MePO: {exc}"
        return fallback


def prepare_runtime_pipeline(db: Session, payload: AIChatRequest) -> RuntimePipelinePreparation:
    runtime_mode = resolve_shadow_runtime_mode(settings.shadow_runtime_mode)
    logger.info("Shadow runtime mode resolved: %s", runtime_mode)
    if runtime_mode == "openai_only":
        return run_openai_only_pipeline(db, payload)
    if runtime_mode == "hybrid":
        return run_hybrid_pipeline(db, payload)
    return run_mepo_pipeline(db, payload)
