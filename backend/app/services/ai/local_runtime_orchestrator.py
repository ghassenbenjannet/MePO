from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.contracts.runtime import (
    ContextPack,
    EvidenceItem,
    EvidencePack,
    IntentDecision,
    RetrievalPlan,
    RetrievalPlanStep,
    RuntimeRequest,
    RuntimeSessionInfo,
)
from app.models import ProjectKnowledgeDocument, ProjectKnowledgeSettings
from app.schemas.ai import AIChatRequest, ContextObject, IntentResult, KnowledgeDocRef, RuntimeInput
from app.schemas.runtime import (
    ContextAssembly,
    RetrievalPipelineTrace,
    RetrievalTrace,
    RetrievalTraceStep,
    SourcePlan,
    SufficiencyCheck,
    ToolExposureDecision,
    WorkspaceContext,
)
from app.services.ai.conversation_context import looks_like_test_feedback_material
from app.services.ai.context_builder import build_context_snapshot
from app.services.ai.context_assembler_v2 import ContextAssemblerV2
from app.services.ai.intent_router import detect_intent
from app.services.ai.knowledge_selector import needs_knowledge_docs, select_knowledge_docs
from app.services.ai.retrieval_pipeline import RetrievalPipelineResult, build_source_plan, execute_retrieval_pipeline
from app.services.ai.runtime_mode import ShadowRuntimeMode
from app.services.ai.skill_compiler import compile_skill_projection_for_turn
from app.services.ai.ticket_resolver import resolve_ticket
from app.services.ai.tool_exposure_policy import decide_tool_exposure
from app.services.ai.workspace_builder import build_workspace_context

logger = logging.getLogger(__name__)

_FILE_SEARCH_INCLUDE = ["file_search_call.results"]
_HYBRID_PIPELINE_BUDGET_MS = 1200


@dataclass
class LocalRuntimeArtifacts:
    runtime_request: RuntimeRequest
    intent_result: IntentResult
    intent_decision: IntentDecision
    retrieval_plan: RetrievalPlan
    evidence_pack: EvidencePack
    context_pack: ContextPack
    context_policy: str
    context_objects: list[ContextObject]
    pre_ticket_res: object | None
    vector_store_id: str | None
    project_runtime_text: str | None
    workspace_context: WorkspaceContext | None
    knowledge_docs: list[ProjectKnowledgeDocument]
    retrieval_trace: RetrievalTrace
    pipeline_trace: RetrievalPipelineTrace
    runtime_input: RuntimeInput
    tool_exposure: ToolExposureDecision
    file_ids: list[str]


class SessionResolver:
    def resolve(self, payload: AIChatRequest, *, runtime_mode: str) -> RuntimeSessionInfo:
        return RuntimeSessionInfo(
            projectId=payload.project_id,
            spaceId=payload.space_id,
            topicId=payload.topic_id,
            conversationTurns=len(payload.conversation_history or []),
            shadowRuntimeMode=runtime_mode,
        )


class IntentEngine:
    def decide(self, payload: AIChatRequest) -> tuple[IntentResult, IntentDecision]:
        result = detect_intent(payload.message)
        needs_retrieval = result.mode not in {"memoire"}
        if result.is_rewrite_existing:
            expected_output_type = "ticket"
        elif result.mode in {"redaction", "transformation"}:
            expected_output_type = "document"
        else:
            expected_output_type = "answer"
        if result.mode in {"impact", "analyse_technique"}:
            risk_level = "high"
        elif result.mode in {"analyse_fonctionnelle", "redaction", "transformation"}:
            risk_level = "medium"
        else:
            risk_level = "low"
        decision = IntentDecision(
            mode=result.mode,
            confidence=result.confidence,
            needsRetrieval=needs_retrieval,
            retrievalScope=[
                "mepo_objects",
                "topic_memory",
                "local_documents",
                "knowledge_documents",
                "vector_store",
            ],
            needsActionProposal=result.mode in {"redaction", "transformation", "memoire"},
            riskLevel=risk_level,
            expectedOutputType=expected_output_type,
            reasoning=result.reading_line,
        )
        return result, decision


class WorkspaceBuilderV2:
    def load(
        self,
        db: Session,
        *,
        payload: AIChatRequest,
        intent_mode: str,
        include_workspace: bool,
    ) -> tuple[str, list[ContextObject], object | None, str | None, WorkspaceContext | None]:
        context_policy, context_objects = build_context_snapshot(
            db=db,
            project_id=payload.project_id,
            space_id=payload.space_id,
            topic_id=payload.topic_id,
            intent_mode=intent_mode,
        )
        pre_ticket_res = None
        if intent_mode == "redaction" or detect_intent(payload.message).is_rewrite_existing:
            pre_ticket_res = resolve_ticket(
                payload.message,
                payload.message,
                context_objects,
                resolved_topic_id=payload.topic_id,
            )

        vector_store_id: str | None = None
        workspace_context: WorkspaceContext | None = None
        if payload.project_id:
            settings_obj = (
                db.query(ProjectKnowledgeSettings)
                .filter(ProjectKnowledgeSettings.project_id == payload.project_id)
                .first()
            )
            if settings_obj:
                vector_store_id = settings_obj.vector_store_id or None
            if include_workspace:
                workspace_context = build_workspace_context(
                    db,
                    project_id=payload.project_id,
                    space_id=payload.space_id,
                    topic_id=payload.topic_id,
                )
        return context_policy, context_objects, pre_ticket_res, vector_store_id, workspace_context


def _should_block_vector_store_for_redaction(
    *,
    user_message: str,
    intent_mode: str,
    context_objects: list[ContextObject],
    pre_ticket_res: object | None,
) -> tuple[bool, str | None]:
    if intent_mode != "redaction":
        return False, None
    if pre_ticket_res and getattr(pre_ticket_res, "match_status", None) in {"found_duplicate", "found_similar"}:
        return True, "Redaction: ticket cible existant et contexte local suffisant, vector store bloque."
    has_ticket = any(obj.kind == "ticket" for obj in context_objects)
    has_local_anchor = any(obj.kind in {"topic", "topic_memory", "document"} for obj in context_objects)
    if has_ticket and has_local_anchor and looks_like_test_feedback_material(user_message):
        return True, "Redaction: mail de tests + objets MePO + tickets existants suffisent, vector store bloque."
    return False, None


class RetrievalPlanner:
    def plan(self, *, intent_decision: IntentDecision, has_vector_store: bool) -> tuple[SourcePlan, RetrievalPlan]:
        source_plan = build_source_plan(mode=intent_decision.mode, has_vector_store=has_vector_store)
        allowed_sources = [step.level for step in source_plan.steps if step.allowed]
        retrieval_plan = RetrievalPlan(
            orderedSteps=[
                RetrievalPlanStep(
                    order=step.order,
                    source=step.level,
                    reason=step.reason,
                    filters={},
                )
                for step in source_plan.steps
            ],
            allowedSources=allowed_sources,
            stopRule=source_plan.stop_rule,
            filters={},
            fallbackPolicy="Stay local-first. Use vector_store only at last resort.",
            maxEvidenceBudget=12,
        )
        return source_plan, retrieval_plan


class SufficiencyChecker:
    def summarize(self, retrieval_trace: RetrievalTrace) -> str:
        used_step = next((step for step in reversed(retrieval_trace.steps) if step.used), None)
        if used_step:
            return used_step.reason
        return "Aucune evidence exploitable retenue."


class ContextAssembler:
    def __init__(self) -> None:
        self.v2 = ContextAssemblerV2()

    def assemble(
        self,
        *,
        payload: AIChatRequest,
        intent_decision: IntentDecision,
        context_objects: list[ContextObject],
        selected_knowledge_docs: list[ProjectKnowledgeDocument],
        retrieval_plan: RetrievalPlan,
        retrieval_result: RetrievalPipelineResult,
        skill_projection: str | None,
    ) -> tuple[EvidencePack, ContextPack]:
        evidence_items: list[EvidenceItem] = []
        relevance_by_kind = {
            "ticket": 0.98,
            "topic_memory": 0.95,
            "document": 0.92,
            "topic": 0.86,
            "space": 0.8,
            "project": 0.76,
        }
        for index, obj in enumerate(context_objects[:8], start=1):
            evidence_items.append(
                EvidenceItem(
                    evidenceId=f"context-{index}",
                    title=obj.label,
                    sourceLevel=(
                        "topic_memory" if obj.kind == "topic_memory"
                        else "local_documents" if obj.kind == "document"
                        else "mepo_objects"
                    ),
                    relevanceScore=relevance_by_kind.get(obj.kind, 0.75),
                    reliabilityScore=1.0,
                    provenance={"kind": obj.kind, "id": obj.id},
                    extractedClaims=[obj.label],
                    excerpt=str(obj.content)[:300],
                )
            )
        for index, doc in enumerate(selected_knowledge_docs[:4], start=1):
            evidence_items.append(
                EvidenceItem(
                    evidenceId=f"knowledge-{index}",
                    title=doc.title,
                    sourceLevel="knowledge_documents",
                    relevanceScore=0.75,
                    reliabilityScore=0.8,
                    provenance={"knowledge_document_id": doc.id, "category": doc.category},
                    extractedClaims=[doc.title],
                    excerpt=(doc.summary or doc.content_extracted_text or "")[:300],
                )
            )

        final_level = retrieval_result.retrieval_trace.final_level
        evidence_pack = EvidencePack(
            evidenceItems=evidence_items,
            sourceLevel=final_level,
            relevanceScore=max((item.relevance_score for item in evidence_items), default=0.0),
            reliabilityScore=max((item.reliability_score for item in evidence_items), default=0.0),
            provenance=[item.provenance for item in evidence_items],
            extractedClaims=[claim for item in evidence_items for claim in item.extracted_claims[:1]],
        )
        output_contract = {
            "expected_output_type": intent_decision.expected_output_type,
            "response_format": "json_strict",
            "markdown_only_answer": True,
        }
        action_policy_projection = {
            "requires_confirmation": True,
            "allowed_action_types": [
                "create_ticket",
                "create_document",
                "add_comment",
                "select_ticket_then_add_comment",
                "create_artifact",
                "update_memory",
                "create_topic_then_ticket",
                "select_topic_then_create_ticket",
            ],
            "retrieval_allowed_sources": retrieval_plan.allowed_sources,
        }
        context_pack = self.v2.assemble(
            user_request=payload.message,
            intent_decision=intent_decision,
            skill_projection=skill_projection or "",
            context_objects=context_objects,
            evidence_pack=evidence_pack,
            output_contract=output_contract,
            action_policy_projection=action_policy_projection,
            contradictions=[],
            to_confirm=[],
        )
        return evidence_pack, context_pack


class MemoryWriter:
    def prepare(self) -> None:
        return None


class LocalRuntimeOrchestrator:
    def __init__(self) -> None:
        self.session_resolver = SessionResolver()
        self.intent_engine = IntentEngine()
        self.workspace_builder = WorkspaceBuilderV2()
        self.retrieval_planner = RetrievalPlanner()
        self.sufficiency_checker = SufficiencyChecker()
        self.context_assembler = ContextAssembler()
        self.memory_writer = MemoryWriter()

    def _build_runtime_request(
        self,
        *,
        payload: AIChatRequest,
        session: RuntimeSessionInfo,
        compiled_skill_projection_text: str,
        retrieval_plan: RetrievalPlan,
    ) -> RuntimeRequest:
        return RuntimeRequest(
            userRequest=payload.message,
            session=session,
            modeHint=None,
            userPreferences={
                "response_style": payload.response_style,
                "detail_level": payload.detail_level,
                "show_confidence": payload.show_confidence,
                "show_suggestions": payload.show_suggestions,
            },
            compiledSkillProjection=compiled_skill_projection_text,
            sourcePlanSeed=retrieval_plan.allowed_sources,
        )

    def _project_skill(
        self,
        db: Session,
        *,
        payload: AIChatRequest,
        intent_decision: IntentDecision,
    ) -> str | None:
        projection, _ = compile_skill_projection_for_turn(
            db,
            project_id=payload.project_id,
            mode=intent_decision.mode,
            include_output_templates=intent_decision.expected_output_type in {"ticket", "document", "artifact"},
        )
        return projection.projection_text if projection else None

    def run_mepo_pipeline(self, db: Session, payload: AIChatRequest) -> LocalRuntimeArtifacts:
        session = self.session_resolver.resolve(payload, runtime_mode="mepo")
        intent_result, intent_decision = self.intent_engine.decide(payload)
        context_policy, context_objects, pre_ticket_res, vector_store_id, workspace_context = self.workspace_builder.load(
            db,
            payload=payload,
            intent_mode=intent_decision.mode,
            include_workspace=bool(payload.project_id),
        )

        knowledge_signal = bool(
            payload.project_id and needs_knowledge_docs(payload.message, intent_mode=intent_decision.mode)
        )
        block_vector_for_redaction, block_vector_reason = _should_block_vector_store_for_redaction(
            user_message=payload.message,
            intent_mode=intent_decision.mode,
            context_objects=context_objects,
            pre_ticket_res=pre_ticket_res,
        )
        stop_on_existing_mepo_object = bool(
            block_vector_for_redaction
            or (pre_ticket_res and pre_ticket_res.match_status in ("found_duplicate", "found_similar"))
        )
        allow_project_knowledge_selection = bool(
            payload.project_id and knowledge_signal and not stop_on_existing_mepo_object
        )
        selected_knowledge_docs = (
            select_knowledge_docs(
                db=db,
                project_id=payload.project_id,
                user_message=payload.message,
                topic_id=payload.topic_id,
            )
            if allow_project_knowledge_selection
            else []
        )
        selected_knowledge_refs = [
            KnowledgeDocRef(
                id=doc.id,
                title=doc.title,
                document_type=doc.category,
                openai_file_id=doc.openai_file_id,
            )
            for doc in selected_knowledge_docs
        ]
        _, retrieval_plan = self.retrieval_planner.plan(
            intent_decision=intent_decision,
            has_vector_store=bool(vector_store_id),
        )
        retrieval_result: RetrievalPipelineResult = execute_retrieval_pipeline(
            intent=intent_result,
            user_message=payload.message,
            workspace_context=workspace_context,
            context_objects=context_objects,
            selected_knowledge_docs=selected_knowledge_refs,
            needs_project_knowledge=knowledge_signal,
            has_vector_store=bool(vector_store_id),
            stop_on_mepo_objects=stop_on_existing_mepo_object,
        )
        knowledge_docs = selected_knowledge_docs if retrieval_result.use_knowledge_docs else []
        tool_exposure = decide_tool_exposure(
            configured_vector_store_id=vector_store_id,
            retrieval_trace=retrieval_result.retrieval_trace,
            stop_on_mepo_objects=stop_on_existing_mepo_object,
            stop_reason_override=block_vector_reason,
        )
        projected_skill_text = self._project_skill(db, payload=payload, intent_decision=intent_decision)
        runtime_request = self._build_runtime_request(
            payload=payload,
            session=session,
            compiled_skill_projection_text=projected_skill_text or "",
            retrieval_plan=retrieval_plan,
        )
        evidence_pack, context_pack = self.context_assembler.assemble(
            payload=payload,
            intent_decision=intent_decision,
            context_objects=context_objects,
            selected_knowledge_docs=knowledge_docs,
            retrieval_plan=retrieval_plan,
            retrieval_result=retrieval_result,
            skill_projection=projected_skill_text,
        )

        return LocalRuntimeArtifacts(
            runtime_request=runtime_request,
            intent_result=intent_result,
            intent_decision=intent_decision,
            retrieval_plan=retrieval_plan,
            evidence_pack=evidence_pack,
            context_pack=context_pack,
            context_policy=context_policy,
            context_objects=context_objects,
            pre_ticket_res=pre_ticket_res,
            vector_store_id=tool_exposure.vector_store_id,
            project_runtime_text=context_pack.skill_projection,
            workspace_context=workspace_context,
            knowledge_docs=knowledge_docs,
            retrieval_trace=retrieval_result.retrieval_trace,
            pipeline_trace=retrieval_result.pipeline_trace,
            runtime_input=retrieval_result.runtime_input,
            tool_exposure=tool_exposure,
            file_ids=[],
        )

    def run_openai_only_pipeline(self, db: Session, payload: AIChatRequest) -> LocalRuntimeArtifacts:
        session = self.session_resolver.resolve(payload, runtime_mode="openai_only")
        intent_result, intent_decision = self.intent_engine.decide(payload)
        context_policy, context_objects, pre_ticket_res, vector_store_id, _ = self.workspace_builder.load(
            db,
            payload=payload,
            intent_mode=intent_decision.mode,
            include_workspace=False,
        )
        block_vector_for_redaction, block_vector_reason = _should_block_vector_store_for_redaction(
            user_message=payload.message,
            intent_mode=intent_decision.mode,
            context_objects=context_objects,
            pre_ticket_res=pre_ticket_res,
        )
        _, retrieval_plan = self.retrieval_planner.plan(
            intent_decision=intent_decision,
            has_vector_store=bool(vector_store_id),
        )
        source_plan = build_source_plan(mode=intent_decision.mode, has_vector_store=bool(vector_store_id))
        vector_store_effective = bool(vector_store_id) and not block_vector_for_redaction
        final_level = "vector_store" if vector_store_effective else "mepo_objects"
        retrieval_trace = RetrievalTrace(
            mode=intent_decision.mode,
            finalLevel=final_level,
            vectorStoreAllowed=vector_store_effective,
            vectorStoreUsed=vector_store_effective,
            steps=[
                RetrievalTraceStep(
                    level="mepo_objects",
                    used=bool(context_objects),
                    reason="Contexte MePO leger injecte pour ce tour.",
                    itemCount=len(context_objects),
                ),
                RetrievalTraceStep(
                    level="topic_memory",
                    used=any(obj.kind == "topic_memory" for obj in context_objects),
                    reason="Memoire locale utilisee uniquement si deja injectee.",
                    itemCount=len([obj for obj in context_objects if obj.kind == "topic_memory"]),
                ),
                RetrievalTraceStep(
                    level="local_documents",
                    used=any(obj.kind == "document" for obj in context_objects),
                    reason="Documents locaux injectes sans planner local complet.",
                    itemCount=len([obj for obj in context_objects if obj.kind == "document"]),
                ),
                RetrievalTraceStep(
                    level="knowledge_documents",
                    used=False,
                    reason="Knowledge docs locaux non selectionnes en mode openai_only.",
                    itemCount=0,
                ),
                RetrievalTraceStep(
                    level="vector_store",
                    used=vector_store_effective,
                    reason=(
                        block_vector_reason
                        if block_vector_for_redaction
                        else "file_search expose avec le vector store configure."
                        if vector_store_effective
                        else "Aucun vector store configure pour ce projet."
                    ),
                    itemCount=1 if vector_store_effective else 0,
                ),
            ],
        )
        pipeline_trace = RetrievalPipelineTrace(
            intentMode=intent_decision.mode,
            selectedMode=intent_decision.mode,
            sourcePlan=source_plan,
            retrievalTrace=retrieval_trace,
            sufficiencyCheck=SufficiencyCheck(
                sufficient=True,
                stopLevel=final_level,
                reason=self.sufficiency_checker.summarize(retrieval_trace),
            ),
            contextAssembly=ContextAssembly(
                contextObjectCount=len(context_objects),
                topicTicketCount=0,
                topicDocumentCount=0,
                spaceDocumentCount=0,
                knowledgeDocumentCount=0,
                testCaseIndexCount=0,
                documentChunkCount=0,
            ),
        )
        runtime_input = RuntimeInput(
            userRequest=payload.message,
            intentMode=intent_decision.mode,
            sourcePlan=source_plan,
            workspaceContext=None,
            contextObjects=context_objects,
            selectedKnowledgeDocs=[],
            vectorStoreId=vector_store_id if vector_store_id else None,
        )
        tool_exposure = ToolExposureDecision(
            fileSearchEnabled=vector_store_effective,
            reason=(
                block_vector_reason
                if block_vector_for_redaction
                else "Mode openai_only: file_search expose avec le vector store configure."
                if vector_store_effective
                else "Mode openai_only sans vector store configure: file_search desactive."
            ),
            vectorStoreId=vector_store_id if vector_store_effective else None,
            include=_FILE_SEARCH_INCLUDE if vector_store_effective else [],
        )
        projected_skill_text = self._project_skill(db, payload=payload, intent_decision=intent_decision)
        runtime_request = self._build_runtime_request(
            payload=payload,
            session=session,
            compiled_skill_projection_text=projected_skill_text or "",
            retrieval_plan=retrieval_plan,
        )
        empty_result = RetrievalPipelineResult(
            source_plan=source_plan,
            use_knowledge_docs=False,
            use_vector_store=vector_store_effective,
            retrieval_trace=retrieval_trace,
            sufficiency_check=pipeline_trace.sufficiency_check,
            context_assembly=pipeline_trace.context_assembly,
            pipeline_trace=pipeline_trace,
            runtime_input=runtime_input,
        )
        evidence_pack, context_pack = self.context_assembler.assemble(
            payload=payload,
            intent_decision=intent_decision,
            context_objects=context_objects,
            selected_knowledge_docs=[],
            retrieval_plan=retrieval_plan,
            retrieval_result=empty_result,
            skill_projection=projected_skill_text,
        )
        return LocalRuntimeArtifacts(
            runtime_request=runtime_request,
            intent_result=intent_result,
            intent_decision=intent_decision,
            retrieval_plan=retrieval_plan,
            evidence_pack=evidence_pack,
            context_pack=context_pack,
            context_policy=context_policy,
            context_objects=context_objects,
            pre_ticket_res=pre_ticket_res,
            vector_store_id=vector_store_id,
            project_runtime_text=context_pack.skill_projection,
            workspace_context=None,
            knowledge_docs=[],
            retrieval_trace=retrieval_trace,
            pipeline_trace=pipeline_trace,
            runtime_input=runtime_input,
            tool_exposure=tool_exposure,
            file_ids=[],
        )

    def run_hybrid_pipeline(self, db: Session, payload: AIChatRequest) -> tuple[LocalRuntimeArtifacts, str | None, bool]:
        started_at = time.perf_counter()
        try:
            mepo_result = self.run_mepo_pipeline(db, payload)
            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
            if elapsed_ms > _HYBRID_PIPELINE_BUDGET_MS:
                return self.run_openai_only_pipeline(db, payload), (
                    f"Budget hybrid depasse ({elapsed_ms}ms > {_HYBRID_PIPELINE_BUDGET_MS}ms)."
                ), True
            return mepo_result, None, False
        except Exception as exc:
            logger.exception("Hybrid pipeline fallback to openai_only: %s", exc)
            return self.run_openai_only_pipeline(db, payload), f"Echec du pipeline MePO: {exc}", True
