from __future__ import annotations

import json

from app.contracts.runtime import ContextPack
from app.schemas.ai import RuntimeInput
from app.schemas.runtime import PromptRuntimeConfig, RetrievalTrace


def _render_source_priority_block(config: PromptRuntimeConfig) -> str:
    rows = [
        f"{item.rank}. {item.label} ({item.level})"
        for item in config.source_priority_policy.items
    ]
    return (
        "══ HIÉRARCHIE DE SOURCES CODÉE EN DUR ══\n"
        "Ordre strict non négociable. Le LLM n’a pas le droit d’inverser cet ordre.\n"
        + "\n".join(rows)
    )


def _render_feature_flags_block(config: PromptRuntimeConfig) -> str:
    flags = config.feature_flags
    return (
        "══ GARDE-FOUS ORCHESTRATEUR ══\n"
        f"- allow_raw_workspace_dump={str(flags.allow_raw_workspace_dump).lower()}\n"
        f"- allow_unplanned_document_search={str(flags.allow_unplanned_document_search).lower()}\n"
        f"- allow_automatic_action_execution={str(flags.allow_automatic_action_execution).lower()}\n"
        f"- allow_vector_store_auto_create={str(flags.allow_vector_store_auto_create).lower()}\n"
        f"- allow_full_space_prompt_injection={str(flags.allow_full_space_prompt_injection).lower()}"
    )


def _render_project_runtime_block(config: PromptRuntimeConfig) -> str | None:
    if not config.project_runtime_text:
        return None
    return (
        "══ CONFIGURATION RUNTIME PROJET ══\n"
        f"{config.project_runtime_text}\n"
        "══ FIN CONFIGURATION RUNTIME PROJET ══"
    )


def _render_retrieval_trace_block(retrieval_trace: RetrievalTrace | None) -> str | None:
    if not retrieval_trace:
        return None
    rows = [
        f"- {step.level}: used={str(step.used).lower()} count={step.item_count} reason={step.reason}"
        for step in retrieval_trace.steps
    ]
    return (
        "══ RETRIEVAL TRACE ══\n"
        f"mode={retrieval_trace.mode}\n"
        f"final_level={retrieval_trace.final_level}\n"
        f"vector_store_allowed={str(retrieval_trace.vector_store_allowed).lower()}\n"
        f"vector_store_used={str(retrieval_trace.vector_store_used).lower()}\n"
        + "\n".join(rows)
    )


def _render_context_pack_block(context_pack: ContextPack | None) -> str | None:
    if not context_pack:
        return None

    lines = [
        "== CONTEXT PACK COMPACT ==",
        f"mode={context_pack.mode}",
        f"user_request={context_pack.canonical_user_request}",
        "== OUTPUT CONTRACT ==",
        json.dumps(context_pack.output_contract, ensure_ascii=False, default=str),
    ]
    if context_pack.object_summaries:
        lines.append("== OBJECT SUMMARIES ==")
        for item in context_pack.object_summaries:
            lines.append(
                f"- [{item.source_level}] {item.kind} {item.id} | {item.label} | {item.summary}"
            )
    if context_pack.evidence_items:
        lines.append("== EVIDENCE ==")
        for item in context_pack.evidence_items:
            lines.append(
                f"- [{item.source_level}] {item.title} | {item.summary}"
            )
    if context_pack.contradictions:
        lines.append("== CONTRADICTIONS ==")
        lines.extend(f"- {item}" for item in context_pack.contradictions)
    if context_pack.open_points:
        lines.append("== TO CONFIRM ==")
        lines.extend(f"- {item}" for item in context_pack.open_points)
    return "\n".join(lines)


def _render_conversation_summary_block(conversation_summary: str | None) -> str | None:
    if not conversation_summary:
        return None
    return conversation_summary


def build_prompt_runtime_parts(
    *,
    system_prompt: str,
    schema_note: str | None,
    context_block: str,
    config: PromptRuntimeConfig,
    retrieval_trace: RetrievalTrace | None = None,
    runtime_input: RuntimeInput | None = None,
    context_pack: ContextPack | None = None,
    conversation_summary: str | None = None,
) -> list[str]:
    parts: list[str] = []
    if system_prompt:
        parts.append(system_prompt)
    parts.extend(
        [
            _render_source_priority_block(config),
            _render_feature_flags_block(config),
        ]
    )

    project_runtime_block = _render_project_runtime_block(config)
    if project_runtime_block:
        parts.append(project_runtime_block)

    retrieval_trace_block = _render_retrieval_trace_block(retrieval_trace)
    if retrieval_trace_block:
        parts.append(retrieval_trace_block)

    context_pack_block = _render_context_pack_block(context_pack)
    if context_pack_block:
        parts.append(context_pack_block)
    elif runtime_input:
        payload = json.dumps(runtime_input.model_dump(by_alias=True), ensure_ascii=False, default=str)
        parts.append(f"== RUNTIME INPUT MINIMAL ==\n{payload}")

    conversation_summary_block = _render_conversation_summary_block(conversation_summary)
    if conversation_summary_block:
        parts.append(conversation_summary_block)

    if context_block:
        parts.append(context_block)
    if schema_note:
        parts.append(schema_note)
    return parts
