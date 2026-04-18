"""AI chat route wired through the local runtime orchestrator."""
from __future__ import annotations

import logging
import json

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.feature_flags import AI_CHAT_INCLUDE_RUNTIME_DEBUG
from app.core.database import get_db
from app.models.ai_conversation import AIConversation
from app.schemas.ai import AIChatRequest, DebugInfo, KnowledgeDocRef
from app.services.ai.action_policy_engine import ActionPolicyEngine
from app.services.ai.conversation_context import build_conversation_summary, canonicalize_user_request, looks_like_test_feedback_material
from app.services.ai.context_builder import estimate_tokens, format_context_for_llm
from app.services.ai.llm_gateway import call_shadow_core
from app.services.ai.output_validator import OutputValidator
from app.services.ai.runtime_contracts import build_prompt_runtime_config
from app.services.ai.runtime_router import prepare_runtime_pipeline
from app.services.ai.project_skill_versions import get_project_skill_version
from app.services.ai.skill_manager import (
    build_rewrite_existing_ticket_directive,
    build_rewrite_mode_directive,
    build_test_feedback_redaction_directive,
)

logger = logging.getLogger(__name__)
router = APIRouter()
output_validator = OutputValidator()
action_policy_engine = ActionPolicyEngine()


@router.post("/chat")
def chat(payload: AIChatRequest, db: Session = Depends(get_db)) -> JSONResponse:
    try:
        previous_response_id = None
        openai_conversation_id = None
        conversation_skill_version_id = None
        if payload.conversation_id:
            conversation = db.get(AIConversation, payload.conversation_id)
            if conversation:
                openai_conversation_id = conversation.openai_conversation_id
                if not openai_conversation_id:
                    previous_response_id = conversation.openai_response_id
                conversation_skill_version_id = conversation.skill_version_id_snapshot

        canonical_message = canonicalize_user_request(payload.message)
        conversation_summary, conversation_summary_chars, raw_history_chars_dropped = build_conversation_summary(
            payload.conversation_history or []
        )
        effective_payload = payload.model_copy(update={"message": canonical_message})

        runtime = prepare_runtime_pipeline(db, effective_payload)
        intent = runtime.intent
        context_policy = runtime.context_policy
        context_objects = runtime.context_objects
        pre_ticket_res = runtime.pre_ticket_res
        project_runtime_text = runtime.project_runtime_text
        workspace_context = runtime.workspace_context
        knowledge_docs = runtime.knowledge_docs
        retrieval_trace = runtime.retrieval_trace
        tool_exposure = runtime.tool_exposure
        effective_vector_store_id = runtime.vector_store_id
        file_ids = runtime.file_ids
        context_pack = runtime.context_pack

        if conversation_skill_version_id:
            skill_version = get_project_skill_version(db, conversation_skill_version_id)
            if skill_version and skill_version.compiled_runtime_text:
                if openai_conversation_id:
                    project_runtime_text = None
                    if context_pack is not None:
                        context_pack.skill_projection = ""
                else:
                    project_runtime_text = skill_version.compiled_runtime_text
                    if context_pack is not None:
                        context_pack.skill_projection = skill_version.compiled_runtime_text

        if knowledge_docs:
            logger.info("Knowledge docs selected: %d docs", len(knowledge_docs))

        user_message_for_llm = effective_payload.message
        stop_on_existing_mepo_object = bool(
            pre_ticket_res and pre_ticket_res.match_status in ("found_duplicate", "found_similar")
        )

        if intent.is_rewrite_existing:
            if stop_on_existing_mepo_object:
                user_message_for_llm = build_rewrite_existing_ticket_directive(
                    getattr(pre_ticket_res, "suggested_ticket_title", None),
                    getattr(pre_ticket_res, "suggested_ticket_id", None),
                ) + effective_payload.message
            else:
                user_message_for_llm = build_rewrite_mode_directive(
                    "redaction",
                    intent.reading_line,
                    requires_payload_complete=False,
                ) + effective_payload.message
        elif intent.confidence == "high" and intent.mode in ("redaction", "transformation"):
            user_message_for_llm = build_rewrite_mode_directive(
                intent.mode,
                intent.reading_line,
                requires_payload_complete=True,
            ) + effective_payload.message

        if intent.mode == "redaction" and looks_like_test_feedback_material(effective_payload.message):
            user_message_for_llm = build_test_feedback_redaction_directive() + user_message_for_llm

        raw_result, used_responses_api = call_shadow_core(
            user_message=user_message_for_llm,
            context_objects=context_objects,
            file_ids=file_ids if file_ids else None,
            conversation_history=[],
            response_style=effective_payload.response_style,
            detail_level=effective_payload.detail_level,
            show_confidence=effective_payload.show_confidence,
            show_suggestions=effective_payload.show_suggestions,
            vector_store_id=effective_vector_store_id,
            project_runtime_text=project_runtime_text,
            retrieval_trace=retrieval_trace,
            runtime_input=runtime.runtime_input,
            context_pack=context_pack,
            file_search_enabled=tool_exposure.file_search_enabled,
            response_include=tool_exposure.include,
            conversation_summary=conversation_summary,
            openai_conversation_id=openai_conversation_id,
            previous_response_id=previous_response_id,
            metadata={
                key: value
                for key, value in {
                    "project_id": str(payload.project_id or ""),
                    "space_id": str(payload.space_id or ""),
                    "topic_id": str(payload.topic_id or ""),
                    "conversation_id": str(payload.conversation_id or ""),
                    "skill_version_id": str(conversation_skill_version_id or ""),
                    "runtime_mode": str(runtime.runtime_mode),
                }.items()
                if value
            },
            force_responses_api=bool(payload.conversation_id),
        )

        knowledge_refs = [
            KnowledgeDocRef(
                id=doc.id,
                title=doc.title,
                document_type=doc.category,
                openai_file_id=doc.openai_file_id,
            )
            for doc in knowledge_docs
        ]

        context_objects_chars = context_pack.object_metrics.after_chars if context_pack and context_pack.object_metrics else len(format_context_for_llm(context_objects))
        compiled_skill_chars = len(project_runtime_text or "")
        evidence_chars = context_pack.evidence_metrics.after_chars if context_pack and context_pack.evidence_metrics else sum(
            len(item.title) + len(item.excerpt) + sum(len(claim) for claim in item.extracted_claims)
            for item in (runtime.evidence_pack.evidence_items if runtime.evidence_pack else [])
        )
        input_chars_total = len(user_message_for_llm) + compiled_skill_chars + context_objects_chars + evidence_chars + conversation_summary_chars
        estimated_prompt_tokens = max(1, input_chars_total // 4)
        tokens_est = estimate_tokens(json.dumps((context_pack.model_dump(by_alias=True, mode="json") if context_pack else {}), ensure_ascii=False, default=str))
        parts: list[str] = []
        if effective_payload.project_id:
            parts.append(f"Projet:{effective_payload.project_id[:8]}")
        if effective_payload.space_id:
            parts.append(f"Espace:{effective_payload.space_id[:8]}")
        if effective_payload.topic_id:
            parts.append(f"Topic:{effective_payload.topic_id[:8]}")
        prompt_summary = (
            " / ".join(parts) + f" - {len(context_objects)} objets, {len(file_ids)} fichiers"
            if parts
            else f"{len(context_objects)} objets, {len(file_ids)} fichiers"
        )

        debug_info = DebugInfo(
            mode_detected=raw_result.get("mode", intent.mode),
            confidence=intent.confidence,
            reading_line=intent.reading_line,
            skill="shadow_po_v1",
            context_policy=context_policy,
            objects_injected=(
                context_pack.assembly_metrics.object_count_after
                if context_pack and context_pack.assembly_metrics
                else len(context_objects)
            ),
            tokens_estimate=tokens_est,
            prompt_summary=prompt_summary,
            context_objects=context_objects,
            knowledge_docs=knowledge_refs,
            file_ids_sent=file_ids,
            used_responses_api=used_responses_api,
            vector_store_id=effective_vector_store_id,
            runtime_mode=runtime.runtime_mode,
            pipeline_used=runtime.pipeline_used,
            fallback_triggered=runtime.fallback_triggered,
            fallback_reason=runtime.fallback_reason,
            file_search_exposed=tool_exposure.file_search_enabled,
            vector_store_used=tool_exposure.file_search_enabled,
            why_target_ticket_selected=(getattr(pre_ticket_res, "decision_reason", None) if pre_ticket_res else None),
            why_vector_store_blocked_or_used=tool_exposure.reason,
            retrieval_planned=runtime.retrieval_plan is not None,
            sources_allowed=list(runtime.retrieval_plan.allowed_sources) if runtime.retrieval_plan else [],
            sources_used=[step.level for step in retrieval_trace.steps if step.used],
            stop_reason=runtime.pipeline_trace.sufficiency_check.reason if runtime.pipeline_trace else None,
            validator_status="pending",
            input_chars_total=input_chars_total,
            compiled_skill_chars=compiled_skill_chars,
            context_objects_chars=context_objects_chars,
            evidence_chars=evidence_chars,
            conversation_summary_chars=conversation_summary_chars,
            raw_history_chars_dropped=raw_history_chars_dropped,
            estimated_prompt_tokens=estimated_prompt_tokens,
            budget_policy=context_pack.budget_policy.model_dump(by_alias=True, mode="json") if context_pack and context_pack.budget_policy else {},
            assembly_metrics=context_pack.assembly_metrics.model_dump(by_alias=True, mode="json") if context_pack and context_pack.assembly_metrics else {},
            object_metrics=context_pack.object_metrics.model_dump(by_alias=True, mode="json") if context_pack and context_pack.object_metrics else {},
            evidence_metrics=context_pack.evidence_metrics.model_dump(by_alias=True, mode="json") if context_pack and context_pack.evidence_metrics else {},
            budget_used={
                "compiled_skill_chars": compiled_skill_chars,
                "context_objects_chars": context_objects_chars,
                "evidence_chars": evidence_chars,
                "conversation_summary_chars": conversation_summary_chars,
                "input_chars_total": input_chars_total,
                "estimated_prompt_tokens": estimated_prompt_tokens,
            },
            context_pack=context_pack.model_dump(by_alias=True, mode="json") if context_pack else {},
            prompt_runtime_config=build_prompt_runtime_config(project_runtime_text),
            retrieval_trace=retrieval_trace,
            pipeline_trace=runtime.pipeline_trace,
            runtime_input=runtime.runtime_input,
            workspace_context=workspace_context,
            tool_exposure=tool_exposure,
            raw_llm_response=raw_result,
        )

        validation = output_validator.validate(
            raw_result,
            knowledge_refs=knowledge_refs,
            valid_context_ids={obj.id for obj in context_objects},
            context_objects=context_objects,
            debug_info=debug_info if payload.debug else None,
            user_request=effective_payload.message,
        )
        ai_response = validation.response

        policy_result = action_policy_engine.apply(
            db,
            ai_response=ai_response,
            payload=effective_payload,
            stop_on_existing_mepo_object=stop_on_existing_mepo_object,
            pre_ticket_res=pre_ticket_res,
        )
        ai_response = policy_result.response
        ai_response.openai_response_id = raw_result.get("__openai_response_id")
        include_runtime_debug = bool(payload.debug and AI_CHAT_INCLUDE_RUNTIME_DEBUG)
        if include_runtime_debug:
            ai_response.retrieval_trace = retrieval_trace
            ai_response.pipeline_trace = runtime.pipeline_trace
            ai_response.runtime_input = runtime.runtime_input
        else:
            ai_response.retrieval_trace = None
            ai_response.pipeline_trace = None
            ai_response.runtime_input = None
            ai_response.debug = None
        if ai_response.debug:
            ai_response.debug.validator_status = f"{validation.status}|{policy_result.status}"

        return JSONResponse(content=ai_response.model_dump(mode="json"))
    except Exception as exc:
        logger.exception("Shadow runtime route error: %s", exc)
        return JSONResponse(status_code=500, content={"detail": str(exc)})
