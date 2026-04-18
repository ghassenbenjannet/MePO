"""Response Parser — tolerant validation of Shadow PO LLM JSON responses.

Parses the raw dict from the LLM into a validated AIChatResponse.
Falls back gracefully for missing/malformed fields rather than raising.

Post-processing rules enforced here (not delegated to the LLM):
  - answer_markdown must be markdown, never raw HTML:
    Any HTML tags leaked from the LLM are stripped before returning.
  - next_actions capped at 4, generic invented items filtered.
"""
from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from app.schemas.ai import (
    AIChatResponse,
    CertaintyBlock,
    ContextObject,
    GeneratedObject,
    KnowledgeDocRef,
    MemoryUpdate,
    ProposedAction,
    RelatedObject,
)

log = logging.getLogger(__name__)

# ─── HTML stripping ───────────────────────────────────────────────────────────
# answer_markdown must be pure markdown — never raw HTML.
# HTML is only allowed in payload.description (create_ticket) and payload.content (create_document).

_HTML_TAG_RE = re.compile(r"<[^>]{1,100}>")

def _strip_html(text: str) -> str:
    """Remove HTML tags from a string intended to be markdown."""
    if not text or "<" not in text:
        return text
    cleaned = _HTML_TAG_RE.sub("", text)
    # Collapse extra blank lines that result from removing block-level HTML
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


# ─── Generic next_action filter ───────────────────────────────────────────────
# These patterns indicate vague, invented actions that are never executable in MePO.

_GENERIC_NEXT_ACTION_PATTERNS = re.compile(
    r"\b("
    r"informer\s+l.équipe"
    r"|communiquer\s+(sur|à|les)"
    r"|surveiller\s+les\s+retours"
    r"|préparer\s+une\s+communication"
    r"|organiser\s+une\s+réunion"
    r"|faire\s+un\s+point\s+avec"
    r"|mettre\s+à\s+jour\s+les\s+parties\s+prenantes"
    r"|attendre\s+les\s+retours"
    r"|aligner\s+(les|l.équipe)"
    r"|sensibiliser"
    r")\b",
    re.IGNORECASE,
)


def _filter_next_actions(actions: list[str]) -> list[str]:
    """Remove generic invented actions that are not actionable in MePO."""
    return [a for a in actions if not _GENERIC_NEXT_ACTION_PATTERNS.search(a)]


# ─── Valid sets ───────────────────────────────────────────────────────────────

_VALID_MODES = {
    "cadrage", "impact", "pilotage", "analyse_fonctionnelle",
    "analyse_technique", "redaction", "transformation", "memoire",
}

_VALID_PROPOSED_ACTION_TYPES = {
    "create_ticket",
    "create_document",
    "add_comment",
    "select_ticket_then_add_comment",
    "create_artifact",
    "update_memory",
    "create_topic_then_ticket",
    "select_topic_then_create_ticket",
}

_VALID_GENERATED_OBJECT_TYPES = {
    "ticket", "document", "comment", "artifact",
}

_VALID_CERTAINTY_FIELDS = {"certain", "inferred", "to_confirm"}

_VALID_MEMORY_FIELDS = {
    "facts", "decisions", "risks", "dependencies", "open_questions",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _as_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value)


def _as_str_list(value: Any, max_items: int | None = None) -> list[str]:
    if not isinstance(value, list):
        return []
    result = [str(item) for item in value if item is not None]
    if max_items is not None:
        result = result[:max_items]
    return result


def _normalize_label(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _repair_related_object_id(
    *,
    raw_id: str,
    raw_label: str,
    context_objects: list[ContextObject] | None,
) -> tuple[str, str, str] | None:
    if not context_objects:
        return None
    if raw_id:
        for obj in context_objects:
            if obj.id == raw_id:
                return obj.kind, obj.id, obj.label
    normalized_label = _normalize_label(raw_label)
    if normalized_label:
        for obj in context_objects:
            if _normalize_label(obj.label) == normalized_label:
                return obj.kind, obj.id, obj.label
    return None


def _parse_related_objects(raw: Any, context_objects: list[ContextObject] | None = None) -> list[RelatedObject]:
    if not isinstance(raw, list):
        return []
    result: list[RelatedObject] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            raw_kind = _as_str(item.get("kind") or item.get("type"), "unknown")
            raw_id = _as_str(item.get("id"), "")
            raw_label = _as_str(item.get("label") or item.get("title"), "")
            repaired = _repair_related_object_id(
                raw_id=raw_id,
                raw_label=raw_label,
                context_objects=context_objects,
            )
            if repaired:
                kind, repaired_id, repaired_label = repaired
            else:
                kind, repaired_id, repaired_label = raw_kind, raw_id, raw_label
            if not repaired_id or not repaired_label:
                continue
            result.append(RelatedObject(
                kind=kind,
                id=repaired_id,
                label=repaired_label,
            ))
        except Exception:
            pass
    return result


def _parse_certainty(raw: Any) -> CertaintyBlock:
    if not isinstance(raw, dict):
        return CertaintyBlock()
    return CertaintyBlock(
        certain=_as_str_list(raw.get("certain"), 4),
        inferred=_as_str_list(raw.get("inferred"), 4),
        to_confirm=_as_str_list(raw.get("to_confirm"), 4),
    )


def _parse_proposed_actions(raw: Any) -> list[ProposedAction]:
    if not isinstance(raw, list):
        return []
    result: list[ProposedAction] = []
    for item in raw[:3]:
        if not isinstance(item, dict):
            continue
        action_type = _as_str(item.get("type"), "")
        if action_type not in _VALID_PROPOSED_ACTION_TYPES:
            log.debug("Skipping unknown proposed_action type: %r", action_type)
            continue
        try:
            if item.get("requires_confirmation") is False:
                log.warning(
                    "response_parser: forcing requires_confirmation=True for action %s",
                    action_type,
                )
            result.append(ProposedAction(
                actionId=_as_str(item.get("action_id") or item.get("actionId"), str(uuid.uuid4())),
                type=action_type,
                label=_as_str(item.get("label"), action_type),
                payload=item.get("payload") if isinstance(item.get("payload"), dict) else {},
                requires_confirmation=True,
            ))
        except Exception:
            pass
    return result


def _parse_generated_objects(raw: Any) -> list[GeneratedObject]:
    if not isinstance(raw, list):
        return []
    result: list[GeneratedObject] = []
    for item in raw[:2]:
        if not isinstance(item, dict):
            continue
        obj_type = _as_str(item.get("type"), "")
        if obj_type not in _VALID_GENERATED_OBJECT_TYPES:
            log.debug("Skipping unknown generated_object type: %r", obj_type)
            continue
        try:
            result.append(GeneratedObject(
                type=obj_type,
                label=_as_str(item.get("label"), obj_type),
                content=item.get("content") if isinstance(item.get("content"), dict) else {},
            ))
        except Exception:
            pass
    return result


def _parse_memory_updates(raw: Any) -> list[MemoryUpdate]:
    if not isinstance(raw, list):
        return []
    result: list[MemoryUpdate] = []
    for item in raw[:3]:
        if not isinstance(item, dict):
            continue
        field = _as_str(item.get("field"), "")
        if field not in _VALID_MEMORY_FIELDS:
            log.debug("Skipping unknown memory_update field: %r", field)
            continue
        content = _as_str(item.get("content"), "")
        if content:
            result.append(MemoryUpdate(field=field, content=content))
    return result


# ─── Public API ───────────────────────────────────────────────────────────────

def parse_shadow_po_response(
    raw: dict[str, Any],
    *,
    skill: str = "shadow_po_v1",
    knowledge_docs_used: list[KnowledgeDocRef] | None = None,
    valid_context_ids: set[str] | None = None,
    context_objects: list[ContextObject] | None = None,
    debug_info=None,
) -> AIChatResponse:
    """Parse raw LLM JSON dict into a validated AIChatResponse.

    Never raises — falls back gracefully for every field.

    valid_context_ids: if provided, any related_object whose id is not in this
    set is silently dropped (prevents hallucinated object references).
    """
    mode = _as_str(raw.get("mode"), "cadrage")
    if mode not in _VALID_MODES:
        log.warning("Unknown mode %r from LLM, defaulting to cadrage", mode)
        mode = "cadrage"

    understanding = _as_str(raw.get("understanding"), "")
    answer_markdown = _as_str(raw.get("answer_markdown"), "")

    # Fallback: if answer is in "answer" or "response" key
    if not answer_markdown:
        answer_markdown = _as_str(
            raw.get("answer") or raw.get("response") or raw.get("content"), ""
        )

    # Post-processing: answer_markdown must be pure markdown, never raw HTML.
    # Strip any HTML tags that slipped through the LLM despite instructions.
    if answer_markdown and "<" in answer_markdown:
        original_len = len(answer_markdown)
        answer_markdown = _strip_html(answer_markdown)
        if len(answer_markdown) != original_len:
            log.info(
                "response_parser: stripped HTML from answer_markdown (%d → %d chars)",
                original_len, len(answer_markdown),
            )

    related_objects = _parse_related_objects(raw.get("related_objects"), context_objects)

    # Guard: drop any related_object not present in the injected context
    if valid_context_ids is not None:
        before = len(related_objects)
        related_objects = [ro for ro in related_objects if ro.id in valid_context_ids]
        dropped = before - len(related_objects)
        if dropped:
            log.warning(
                "response_parser: dropped %d hallucinated related_object(s) not in context",
                dropped,
            )

    certainty = _parse_certainty(raw.get("certainty"))
    # next_actions: cap at 4, filter generic invented items
    next_actions = _filter_next_actions(_as_str_list(raw.get("next_actions"), 4))
    proposed_actions = _parse_proposed_actions(raw.get("proposed_actions"))
    generated_objects = _parse_generated_objects(raw.get("generated_objects"))
    memory_updates = _parse_memory_updates(raw.get("memory_updates"))

    return AIChatResponse(
        mode=mode,
        skill=skill,
        understanding=understanding,
        related_objects=related_objects,
        answer_markdown=answer_markdown,
        certainty=certainty,
        next_actions=next_actions,
        proposed_actions=proposed_actions,
        generated_objects=generated_objects,
        memory_updates=memory_updates,
        knowledge_docs_used=knowledge_docs_used or [],
        context_objects=context_objects or [],
        debug=debug_info,
    )
