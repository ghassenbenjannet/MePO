"""LLM Gateway — two execution paths for Shadow PO.

• No knowledge files / no runtime tool exposure → Chat Completions API
• With knowledge files or runtime-enabled file_search → OpenAI Responses API

Uses skill_manager for the versioned system prompt.
The runtime decides whether file_search is exposed; the prompt alone never does.
"""
from __future__ import annotations

import json
import logging

from app.core.config import settings
from app.contracts.runtime import ContextPack
from app.schemas.ai import ContextObject, ConversationMessage, RuntimeInput
from app.services.ai.conversation_context import build_conversation_summary
from app.services.ai.context_builder import format_context_for_llm
from app.services.ai.prompt_runtime import build_prompt_runtime_parts
from app.services.ai.runtime_contracts import build_prompt_runtime_config
from app.services.ai.skill_manager import (
    get_file_search_authorized_block,
    get_json_retry_directive,
    get_skill,
    get_style_directive,
)

logger = logging.getLogger(__name__)

_CHAT_COMPLETION_BUDGETS = (2400, 4200)
_RESPONSES_OUTPUT_BUDGETS = (2400, 4200)
def _safe_response_dump(response: object) -> dict | None:
    try:
        if hasattr(response, "model_dump"):
            dumped = response.model_dump()
            return dumped if isinstance(dumped, dict) else None
    except Exception:
        return None
    return None


def _collect_file_search_results(node: object) -> list[dict]:
    results: list[dict] = []
    if isinstance(node, dict):
        if node.get("type") == "file_search_call" and isinstance(node.get("results"), list):
            results.append({"results": node.get("results", [])})
        for value in node.values():
            results.extend(_collect_file_search_results(value))
    elif isinstance(node, list):
        for item in node:
            results.extend(_collect_file_search_results(item))
    return results


def _extract_first_json_object(raw_text: str) -> str | None:
    start = raw_text.find("{")
    if start < 0:
        return None

    depth = 0
    in_string = False
    escape = False

    for index in range(start, len(raw_text)):
        char = raw_text[index]

        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return raw_text[start:index + 1]

    return None


def _repair_truncated_json_object(raw_text: str) -> str | None:
    start = raw_text.find("{")
    if start < 0:
        return None

    stack: list[str] = []
    in_string = False
    escape = False
    repaired = raw_text[start:]

    for char in repaired:
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            stack.append("}")
        elif char == "[":
            stack.append("]")
        elif char in {"}", "]"} and stack and char == stack[-1]:
            stack.pop()

    repaired = repaired.rstrip()
    if repaired.endswith(","):
        repaired = repaired[:-1].rstrip()

    if repaired.endswith(":"):
        repaired = f"{repaired} null"

    if in_string:
        if escape:
            repaired += "\\"
        repaired += '"'

    repaired += "".join(reversed(stack))
    return repaired


def _parse_repaired_json(raw_text: str, source: str) -> dict | None:
    repaired = _repair_truncated_json_object(raw_text)
    if not repaired:
        return None

    try:
        parsed = json.loads(repaired)
        if isinstance(parsed, dict):
            mode = parsed.get("mode")
            has_shadow_payload = any(
                key in parsed for key in ("answer_markdown", "understanding", "proposed_actions")
            )
            if not isinstance(mode, str) or not has_shadow_payload:
                return None
            logger.warning("Repaired truncated JSON from OpenAI output (%s)", source)
            return parsed
    except json.JSONDecodeError:
        return None

    return None


def _invalid_json_fallback(raw_text: str, exc: json.JSONDecodeError) -> dict:
    return {
        "mode": "cadrage",
        "understanding": "La reponse OpenAI n'a pas pu etre structuree correctement.",
        "related_objects": [],
        "answer_markdown": (
            "La reponse du modele est arrivee sous un format JSON incomplet ou invalide. "
            "Relance la demande ou reduis son perimetre."
        ),
        "certainty": {
            "certain": [],
            "inferred": [f"Reponse JSON invalide: {exc.msg}"],
            "to_confirm": [],
        },
        "next_actions": [
            "Relancer la demande",
            "Preciser un objectif ou un livrable plus cible si besoin",
        ],
        "proposed_actions": [],
        "generated_objects": [],
        "memory_updates": [],
        "__parse_error": {
            "reason": str(exc),
            "raw_excerpt": raw_text[:1000],
        },
    }


def _parse_llm_json_output(raw_text: str | None, source: str) -> dict:
    text = (raw_text or "").strip()
    if not text:
        return _invalid_json_fallback("", json.JSONDecodeError("Empty response", "", 0))

    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {"result": parsed}
    except json.JSONDecodeError as exc:
        candidate = _extract_first_json_object(text)
        if candidate and candidate != text:
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, dict):
                    logger.warning("Recovered malformed JSON from OpenAI output (%s)", source)
                    return parsed
            except json.JSONDecodeError:
                pass

        repaired = _parse_repaired_json(text, source)
        if repaired is not None:
            return repaired

        logger.warning("Invalid JSON returned by OpenAI (%s): %s", source, exc)
        return _invalid_json_fallback(text, exc)


def _has_parse_error(result: dict) -> bool:
    return isinstance(result, dict) and "__parse_error" in result


# ─── Stub fallback ────────────────────────────────────────────────────────────

def _stub_response(user_message: str) -> dict:
    return {
        "mode": "pilotage",
        "understanding": "Aucune clé API OpenAI configurée — mode démo.",
        "related_objects": [],
        "answer_markdown": (
            "**[Mode démo — aucune clé API configurée]**\n\n"
            f"Ta demande : *{user_message[:200]}*\n\n"
            "Pour activer Shadow Core, ajoute `OPENAI_API_KEY=sk-...` "
            "dans l'environnement du backend."
        ),
        "certainty": {"certain": ["Aucune clé API OpenAI détectée"], "inferred": [], "to_confirm": []},
        "next_actions": ["Configurer OPENAI_API_KEY dans le backend"],
        "proposed_actions": [],
        "generated_objects": [],
        "memory_updates": [],
    }


# ─── Path A: Chat Completions (no files) ─────────────────────────────────────

def _call_chat_completions(
    client: object,
    user_message: str,
    context_block: str,
    skill: dict,
    project_runtime_text: str | None = None,
    retrieval_trace=None,
    runtime_input: RuntimeInput | None = None,
    context_pack: ContextPack | None = None,
    history: list[ConversationMessage] | None = None,
    conversation_summary: str | None = None,
) -> dict:
    prompt_runtime_config = build_prompt_runtime_config(project_runtime_text)
    runtime_parts = build_prompt_runtime_parts(
        system_prompt=skill["system_prompt"],
        schema_note=skill.get("schema_note", ""),
        context_block=context_block,
        config=prompt_runtime_config,
        retrieval_trace=retrieval_trace,
        runtime_input=runtime_input,
        context_pack=context_pack,
        conversation_summary=conversation_summary,
    )
    messages: list[dict] = [{"role": "system", "content": part} for part in runtime_parts]

    messages.append({"role": "user", "content": user_message})

    for attempt_index, max_completion_tokens in enumerate(_CHAT_COMPLETION_BUDGETS):
        effective_messages = list(messages)
        if attempt_index > 0:
            effective_messages.append({"role": "system", "content": get_json_retry_directive()})

        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=effective_messages,
            response_format={"type": "json_object"},
            temperature=0.2,
            max_completion_tokens=max_completion_tokens,
        )
        raw_text = response.choices[0].message.content or "{}"
        parsed = _parse_llm_json_output(raw_text, "chat_completions")
        if not _has_parse_error(parsed) or attempt_index == len(_CHAT_COMPLETION_BUDGETS) - 1:
            return parsed

        logger.warning(
            "Retrying chat completions after invalid JSON output (attempt %d/%d, budget=%d)",
            attempt_index + 1,
            len(_CHAT_COMPLETION_BUDGETS),
            max_completion_tokens,
        )

    return _invalid_json_fallback("", json.JSONDecodeError("Empty response", "", 0))


# ─── Path B: Responses API (with knowledge files or vector store) ─────────────

def _call_responses_api(
    client: object,
    user_message: str,
    context_block: str,
    file_ids: list[str],
    skill: dict,
    project_runtime_text: str | None = None,
    retrieval_trace=None,
    runtime_input: RuntimeInput | None = None,
    context_pack: ContextPack | None = None,
    history: list[ConversationMessage] | None = None,
    vector_store_id: str | None = None,
    file_search_enabled: bool = False,
    response_include: list[str] | None = None,
    conversation_summary: str | None = None,
    openai_conversation_id: str | None = None,
    previous_response_id: str | None = None,
    metadata: dict[str, str] | None = None,
) -> dict:
    """Use OpenAI Responses API to send file_ids and runtime-approved tools."""
    prompt_runtime_config = build_prompt_runtime_config(project_runtime_text)
    instructions_parts = build_prompt_runtime_parts(
        system_prompt=skill["system_prompt"],
        schema_note=skill.get("schema_note", ""),
        context_block=context_block,
        config=prompt_runtime_config,
        retrieval_trace=retrieval_trace,
        runtime_input=runtime_input,
        context_pack=context_pack,
        conversation_summary=conversation_summary,
    )

    if file_search_enabled and vector_store_id:
        instructions_parts.append(get_file_search_authorized_block())

    instructions = "\n\n".join(instructions_parts)

    # User content: OpenAI Responses API requires the word "json" to appear in
    # input messages when text.format.type = "json_object".  The system prompt
    # is in `instructions` (not `input`), so we prepend a minimal reminder.
    user_content: list[dict] = [
        {"type": "input_text", "text": "Réponds uniquement en JSON valide selon les instructions."},
    ]
    user_content += [{"type": "input_file", "file_id": fid} for fid in file_ids]
    user_content.append({"type": "input_text", "text": user_message})

    # Build tools list — add file_search when a vector store is configured
    tools: list[dict] = []
    if settings.openai_skill:
        tools.append(
            {
                "type": "shell",
                "environment": {
                    "type": "container_auto",
                    "skills": [
                        {
                            "type": "skill_reference",
                            "skill_id": settings.openai_skill,
                        }
                    ],
                },
            }
        )
    if file_search_enabled and vector_store_id:
        tools.append({
            "type": "file_search",
            "vector_store_ids": [vector_store_id],
        })

    last_response_dump: dict | None = None
    last_create_kwargs: dict = {}
    for attempt_index, max_output_tokens in enumerate(_RESPONSES_OUTPUT_BUDGETS):
        effective_instructions = instructions
        if attempt_index > 0:
            effective_instructions = f"{instructions}\n\n{get_json_retry_directive()}"

        create_kwargs: dict = dict(
            model=settings.openai_model,
            instructions=effective_instructions,
            input=[{"role": "user", "content": user_content}],
            text={"format": {"type": "json_object"}},
            temperature=0.2,
            max_output_tokens=max_output_tokens,
        )
        if metadata:
            create_kwargs["metadata"] = metadata
        if openai_conversation_id:
            create_kwargs["conversation"] = openai_conversation_id
        elif previous_response_id:
            create_kwargs["previous_response_id"] = previous_response_id
        if tools:
            create_kwargs["tools"] = tools
        if file_search_enabled and response_include:
            create_kwargs["include"] = response_include

        response = client.responses.create(**create_kwargs)
        raw = getattr(response, "output_text", None) or "{}"
        parsed = _parse_llm_json_output(raw, "responses_api")
        response_dump = _safe_response_dump(response)
        last_response_dump = response_dump
        last_create_kwargs = create_kwargs

        if not _has_parse_error(parsed) or attempt_index == len(_RESPONSES_OUTPUT_BUDGETS) - 1:
            parsed["__response_api"] = {
                "response_id": getattr(response, "id", None),
                "tools": tools,
                "include": create_kwargs.get("include", []),
                "file_search_results": _collect_file_search_results(response_dump or {}),
            }
            parsed["__openai_response_id"] = getattr(response, "id", None)
            return parsed

        logger.warning(
            "Retrying responses API after invalid JSON output (attempt %d/%d, budget=%d)",
            attempt_index + 1,
            len(_RESPONSES_OUTPUT_BUDGETS),
            max_output_tokens,
        )

    fallback = _invalid_json_fallback("", json.JSONDecodeError("Empty response", "", 0))
    fallback["__response_api"] = {
        "response_id": (last_response_dump or {}).get("id") if isinstance(last_response_dump, dict) else None,
        "tools": tools,
        "include": last_create_kwargs.get("include", []),
        "file_search_results": _collect_file_search_results(last_response_dump or {}),
    }
    return fallback


# ─── Public entry point ───────────────────────────────────────────────────────

def call_shadow_core(
    user_message: str,
    context_objects: list[ContextObject] | None = None,
    file_ids: list[str] | None = None,
    skill_name: str = "shadow_po_v1",
    conversation_history: list[ConversationMessage] | None = None,
    response_style: str | None = None,
    detail_level: str | None = None,
    show_confidence: bool | None = None,
    show_suggestions: bool | None = None,
    vector_store_id: str | None = None,
    project_runtime_text: str | None = None,
    retrieval_trace=None,
    runtime_input: RuntimeInput | None = None,
    context_pack: ContextPack | None = None,
    file_search_enabled: bool = False,
    response_include: list[str] | None = None,
    conversation_summary: str | None = None,
    openai_conversation_id: str | None = None,
    previous_response_id: str | None = None,
    metadata: dict[str, str] | None = None,
    force_responses_api: bool = False,
) -> tuple[dict, bool]:
    """Call Shadow Core and return (result_dict, used_responses_api).

    - file_ids or runtime-enabled file_search → Responses API (Path B)
    - neither                                 → Chat Completions (Path A)

    response_style / detail_level are user preferences that get prepended to the
    user message as a compact directive block so the LLM adapts its output style.
    """
    api_key = settings.openai_api_key
    if not api_key:
        logger.warning("OPENAI_API_KEY not set — returning stub response")
        return _stub_response(user_message), False
    if not settings.openai_model:
        logger.error("OPENAI_MODEL not set")
        return {
            "mode": "cadrage",
            "understanding": "Configuration OpenAI incomplete.",
            "related_objects": [],
            "answer_markdown": (
                "**Configuration manquante**\n\n"
                "La variable d'environnement `OPENAI_MODEL` n'est pas renseignee cote backend."
            ),
            "certainty": {"certain": ["OPENAI_MODEL absent"], "inferred": [], "to_confirm": []},
            "next_actions": ["Renseigner OPENAI_MODEL dans le fichier .env du backend"],
            "proposed_actions": [],
            "generated_objects": [],
            "memory_updates": [],
        }, False

    skill = get_skill(skill_name)
    context_block = "" if context_pack else format_context_for_llm(context_objects or [])
    computed_conversation_summary = conversation_summary
    if computed_conversation_summary is None:
        computed_conversation_summary, _, _ = build_conversation_summary(conversation_history or [])
    compiled_skill_chars = len(project_runtime_text or "")
    context_objects_chars = len(context_block)
    context_pack_chars = len(
        json.dumps(context_pack.model_dump(by_alias=True), ensure_ascii=False, default=str)
    ) if context_pack else 0
    conversation_summary_chars = len(computed_conversation_summary or "")
    input_chars_total = len(user_message) + compiled_skill_chars + context_objects_chars + context_pack_chars + conversation_summary_chars
    estimated_prompt_tokens = max(1, input_chars_total // 4)

    # Build style directive and prepend it to the user message
    style_directive = get_style_directive(
        response_style, detail_level, show_confidence, show_suggestions
    )
    effective_message = style_directive + user_message if style_directive else user_message

    if style_directive:
        logger.info(
            "Shadow Core: style_directive active (response_style=%s, detail_level=%s, "
            "show_confidence=%s, show_suggestions=%s)",
            response_style, detail_level, show_confidence, show_suggestions,
        )
    logger.info(
        "Shadow Core input metrics: compiled_skill_chars=%d context_objects_chars=%d "
        "context_pack_chars=%d conversation_summary_chars=%d input_chars_total=%d estimated_prompt_tokens=%d",
        compiled_skill_chars,
        context_objects_chars,
        context_pack_chars,
        conversation_summary_chars,
        input_chars_total,
        estimated_prompt_tokens,
    )

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        use_responses = (
            bool(file_ids)
            or bool(file_search_enabled)
            or bool(openai_conversation_id)
            or bool(previous_response_id)
            or bool(force_responses_api)
        )
        if use_responses:
            if openai_conversation_id and previous_response_id:
                logger.warning(
                    "Shadow Core received both openai_conversation_id and previous_response_id; ignoring previous_response_id"
                )
            logger.info(
                "Shadow Core: Responses API, %d file(s), file_search=%s, vector_store=%s, skill=%s, openai_skill=%s, openai_conversation=%s",
                len(file_ids or []), file_search_enabled, vector_store_id, skill_name, bool(settings.openai_skill), bool(openai_conversation_id),
            )
            result = _call_responses_api(
                client, effective_message, context_block, file_ids or [], skill,
                project_runtime_text=project_runtime_text,
                retrieval_trace=retrieval_trace,
                runtime_input=runtime_input,
                context_pack=context_pack,
                history=None,
                conversation_summary=computed_conversation_summary,
                vector_store_id=vector_store_id,
                file_search_enabled=file_search_enabled,
                response_include=response_include,
                openai_conversation_id=openai_conversation_id,
                previous_response_id=previous_response_id,
                metadata=metadata,
            )
            used_responses = True
        else:
            logger.info(
                "Shadow Core: Chat Completions, skill=%s, history=%d turns",
                skill_name, len(conversation_history or []),
            )
            result = _call_chat_completions(
                client, effective_message, context_block, skill,
                project_runtime_text=project_runtime_text,
                retrieval_trace=retrieval_trace,
                runtime_input=runtime_input,
                context_pack=context_pack,
                history=None,
                conversation_summary=computed_conversation_summary,
            )
            used_responses = False

        return result, used_responses

    except ImportError:
        logger.error("openai package not installed")
        return _stub_response(user_message), False

    except Exception as exc:
        logger.exception("OpenAI API error: %s", exc)
        return {
            "mode": "cadrage",
            "understanding": "Erreur lors de l'appel à l'API OpenAI.",
            "related_objects": [],
            "answer_markdown": f"**Erreur OpenAI :** {exc}",
            "certainty": {"certain": [str(exc)], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [],
            "generated_objects": [],
            "memory_updates": [],
        }, False
