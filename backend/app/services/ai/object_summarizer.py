from __future__ import annotations

import json

from app.contracts.runtime import CompactObjectRef, CountCharMetrics, SourceLevel
from app.schemas.ai import ContextObject

_KIND_PRIORITY = {
    "ticket": 0,
    "topic": 1,
    "topic_memory": 2,
    "document": 3,
    "space": 4,
    "project": 5,
}


def _truncate(value: str, limit: int) -> str:
    value = " ".join(value.split())
    if len(value) <= limit:
        return value
    clipped = value[:limit].rstrip()
    if " " in clipped:
        clipped = clipped.rsplit(" ", 1)[0]
    return f"{clipped}..."


def _source_level_for_kind(kind: str) -> SourceLevel:
    if kind == "topic_memory":
        return "topic_memory"
    if kind == "document":
        return "local_documents"
    return "mepo_objects"


def _priority_for_kind(kind: str) -> int:
    return _KIND_PRIORITY.get(kind, 99)


def _ticket_business_priority(content: dict) -> int:
    priority = str(content.get("priority") or "").lower()
    status = str(content.get("status") or "").lower()
    if priority == "critical" and status in {"in_progress", "active", "doing"}:
        return 0
    if priority in {"critical", "high"} and status in {"in_progress", "active", "doing", "review"}:
        return 1
    if priority == "critical":
        return 2
    if priority == "high":
        return 3
    return 4


def _sort_key_for_object(obj: ContextObject, summary: CompactObjectRef) -> tuple[int, int, int]:
    if obj.kind == "ticket":
        return (_ticket_business_priority(obj.content or {}), 0, len(summary.summary))
    return (_priority_for_kind(obj.kind), 0, len(summary.summary))


def _safe_json_len(value: object) -> int:
    return len(json.dumps(value, ensure_ascii=False, default=str))


class ObjectSummarizer:
    def summarize(self, obj: ContextObject) -> CompactObjectRef:
        content = obj.content or {}
        if obj.kind == "ticket":
            summary = _truncate(
                f"{content.get('type', '')} {content.get('status', '')} {content.get('priority', '')} "
                f"{content.get('description', '')}",
                150,
            )
            relevance = "Ticket MePO directement exploitable pour la reponse."
        elif obj.kind == "topic":
            summary = _truncate(
                f"{content.get('nature', '')} {content.get('priority', '')} {content.get('status', '')} "
                f"{content.get('description', '')}",
                140,
            )
            relevance = "Topic actif du contexte courant."
        elif obj.kind == "topic_memory":
            facts = ", ".join((content.get("facts") or [])[:2])
            decisions = ", ".join((content.get("decisions") or [])[:2])
            summary = _truncate(f"Faits: {facts}. Decisions: {decisions}.", 150)
            relevance = "Memoire stabilisee du topic."
        elif obj.kind == "document":
            summary = _truncate(
                f"{content.get('type', '')} {', '.join(content.get('tags') or [])} {content.get('excerpt', '')}",
                150,
            )
            relevance = "Document local lie au contexte."
        elif obj.kind == "space":
            summary = _truncate(
                f"{content.get('status', '')} {content.get('description', '')}",
                120,
            )
            relevance = "Espace de travail parent."
        elif obj.kind == "project":
            summary = _truncate(
                f"{content.get('status', '')} {content.get('description', '')}",
                120,
            )
            relevance = "Projet parent et source de verite."
        else:
            summary = _truncate(json.dumps(content, ensure_ascii=False, default=str), 140)
            relevance = "Objet de contexte utile."

        return CompactObjectRef(
            kind=obj.kind,
            id=obj.id,
            label=obj.label,
            summary=summary,
            relevanceReason=relevance,
            sourceLevel=_source_level_for_kind(obj.kind),
        )

    def reduce(
        self,
        objects: list[ContextObject],
        *,
        max_count: int,
        max_chars: int,
    ) -> tuple[list[CompactObjectRef], list[dict], CountCharMetrics]:
        before_count = len(objects)
        before_chars = sum(_safe_json_len(obj.model_dump(mode="json")) for obj in objects)

        deduped: dict[tuple[str, str], ContextObject] = {}
        dropped: list[dict] = []
        for obj in objects:
            key = (obj.kind, obj.id)
            if key in deduped:
                dropped.append({"id": obj.id, "kind": obj.kind, "reason": "duplicate_object"})
                continue
            deduped[key] = obj

        compact_with_source = [(obj, self.summarize(obj)) for obj in deduped.values()]
        compact_with_source.sort(key=lambda pair: _sort_key_for_object(pair[0], pair[1]))
        compact = [item for _, item in compact_with_source]

        while len(compact) > max_count:
            removed = compact.pop()
            dropped.append({"id": removed.id, "kind": removed.kind, "reason": "budget_object_count"})

        total_chars = sum(_safe_json_len(item.model_dump(by_alias=True, mode="json")) for item in compact)
        while compact and total_chars > max_chars:
            removed = compact.pop()
            dropped.append({"id": removed.id, "kind": removed.kind, "reason": "budget_object_chars"})
            total_chars = sum(_safe_json_len(item.model_dump(by_alias=True, mode="json")) for item in compact)

        metrics = CountCharMetrics(
            beforeCount=before_count,
            afterCount=len(compact),
            beforeChars=before_chars,
            afterChars=total_chars,
        )
        return compact, dropped, metrics


__all__ = ["ObjectSummarizer"]
