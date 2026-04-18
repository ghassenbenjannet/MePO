"""Context Builder — queries real DB objects and formats them for the LLM.

Priority: topic-first > space-first > project-only > no context
Each level adds its parent objects and related entities automatically.
"""
from __future__ import annotations

import logging
import re

from sqlalchemy.orm import Session

from app.models import Document, Project, Space, Ticket, Topic, TopicMemory
from app.schemas.ai import ContextObject

logger = logging.getLogger(__name__)


# ─── Noise filter ─────────────────────────────────────────────────────────────

_NOISE_TITLES: frozenset[str] = frozenset({
    "test", "test ticket", "ticket test", "seed", "seeded ticket",
    "sample ticket", "exemple", "example", "demo", "test de ticket",
    "sample", "placeholder", "todo",
})


def _is_noise_ticket(t: Ticket) -> bool:
    """Return True for test/seed artifacts that pollute LLM context.

    Filtered patterns:
      - Exact match on known generic seed titles (case-insensitive)
      - type=test with a title starting with "test " or "seed "
      - Titles starting with "[TEST]" — these are Sprint/dev test records,
        not real work items, and clutter the context for pilotage/analyse modes
    """
    title_lower = (t.title or "").strip().lower()
    if title_lower in _NOISE_TITLES:
        return True
    # type=test with a very generic title (starts with "test " or "seed ")
    if t.type in ("test",) and (title_lower.startswith("test ") or title_lower.startswith("seed ")):
        return True
    # [TEST] prefix — technical test records created during development/sprints
    if title_lower.startswith("[test]"):
        return True
    return False


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _project_obj(p: Project) -> ContextObject:
    return ContextObject(
        kind="project",
        id=p.id,
        label=p.name,
        content={"status": p.status, "description": p.description or ""},
    )


def _space_obj(s: Space) -> ContextObject:
    return ContextObject(
        kind="space",
        id=s.id,
        label=s.name,
        content={
            "status": s.status,
            "description": s.description or "",
            "progress": s.progress,
            "start_date": str(s.start_date) if s.start_date else None,
            "end_date": str(s.end_date) if s.end_date else None,
        },
    )


def _topic_obj(t: Topic) -> ContextObject:
    return ContextObject(
        kind="topic",
        id=t.id,
        label=t.title,
        content={
            "status": t.status,
            "priority": t.priority,
            "nature": t.topic_nature,
            "owner": t.owner or "",
            "teams": t.teams,
            "risks": t.risks,
            "dependencies": t.dependencies,
            "open_questions": t.open_questions,
            "tags": t.tags,
            "description": t.description or "",
        },
    )


def _ticket_obj(t: Ticket) -> ContextObject:
    return ContextObject(
        kind="ticket",
        id=t.id,
        label=f"{t.id} — {t.title}",
        content={
            "topic_id": t.topic_id,  # required by ticket_resolver for +4 topic-match bonus
            "type": t.type,
            "status": t.status,
            "priority": t.priority,
            "assignee": t.assignee or "",
            "estimate": t.estimate,
            "acceptance_criteria": t.acceptance_criteria,
            "tags": t.tags,
            "description": (t.description or "")[:400],
        },
    )


def _document_obj(d: Document) -> ContextObject:
    return ContextObject(
        kind="document",
        id=d.id,
        label=d.title,
        content={
            "type": d.type,
            "tags": d.tags,
            # Strip HTML tags for a clean text excerpt to avoid sending raw markup to LLM.
            # 1500 chars gives ~375 tokens — enough to convey document substance.
            "excerpt": re.sub(r"<[^>]+>", " ", (d.content or ""))[:1500].strip(),
        },
    )


def _memory_obj(m: TopicMemory, topic_label: str) -> ContextObject:
    return ContextObject(
        kind="topic_memory",
        id=m.id,
        label=f"Mémoire — {topic_label}",
        content={
            "facts": m.facts,
            "decisions": m.decisions,
            "risks": m.risks,
            "dependencies": m.dependencies,
            "open_questions": m.open_questions,
        },
    )


# ─── Public API ───────────────────────────────────────────────────────────────

def build_context_snapshot(
    db: Session,
    project_id: str | None,
    space_id: str | None,
    topic_id: str | None,
    intent_mode: str | None = None,
) -> tuple[str, list[ContextObject]]:
    """Return (context_policy, context_objects) from real DB data.

    Objects are ordered from broadest to most specific so the LLM sees
    project → space → topics → tickets → documents → memory.

    intent_mode adjusts what gets loaded:
      memoire   → topic + memory only (no tickets/docs — saves tokens)
      pilotage  → exclude "done" tickets (focus on active work)
      others    → full load
    """
    objects: list[ContextObject] = []
    is_memoire   = intent_mode == "memoire"
    is_pilotage  = intent_mode == "pilotage"

    try:
        # ── Topic-first ───────────────────────────────────────────────────────
        if topic_id:
            topic = db.get(Topic, topic_id)
            if not topic:
                return "no persisted context", []

            # Walk up: topic → space → project
            space = db.get(Space, topic.space_id)
            if space:
                project = db.get(Project, space.project_id)
                if project:
                    objects.append(_project_obj(project))
                objects.append(_space_obj(space))
            objects.append(_topic_obj(topic))

            # Topic memory
            memory = db.query(TopicMemory).filter(TopicMemory.topic_id == topic_id).first()
            if memory:
                objects.append(_memory_obj(memory, topic.title))

            # memoire mode: stop here — no tickets or documents needed
            if is_memoire:
                return "topic-first memory-only context", objects

            # Tickets for this topic (max 10) — pilotage excludes "done"
            ticket_q = db.query(Ticket).filter(Ticket.topic_id == topic_id)
            if is_pilotage:
                ticket_q = ticket_q.filter(Ticket.status != "done")
            tickets = ticket_q.limit(10).all()
            for t in tickets:
                if not _is_noise_ticket(t):
                    objects.append(_ticket_obj(t))

            # Documents — hierarchy: topic docs first, then space docs if quota allows
            # Priority 1: docs linked to this specific topic (max 5)
            topic_docs = (
                db.query(Document)
                .filter(Document.topic_id == topic_id, Document.is_archived.is_(False))
                .limit(5)
                .all()
            )
            topic_doc_ids = {d.id for d in topic_docs}
            for d in topic_docs:
                objects.append(_document_obj(d))

            # Priority 2: docs from the same space not already included (max 3)
            # Provides context from sibling topics without blowing the window
            if space and len(topic_docs) < 5:
                space_docs = (
                    db.query(Document)
                    .filter(
                        Document.space_id == space.id,
                        Document.is_archived.is_(False),
                        Document.id.notin_(topic_doc_ids),
                    )
                    .limit(3)
                    .all()
                )
                for d in space_docs:
                    objects.append(_document_obj(d))

            return "topic-first deep context", objects

        # ── Space-first ───────────────────────────────────────────────────────
        if space_id:
            space = db.get(Space, space_id)
            if not space:
                return "no persisted context", []

            project = db.get(Project, space.project_id)
            if project:
                objects.append(_project_obj(project))
            objects.append(_space_obj(space))

            # Topics in this space (max 15)
            topics = (
                db.query(Topic)
                .filter(Topic.space_id == space_id)
                .limit(15)
                .all()
            )
            topic_ids = [t.id for t in topics]
            for t in topics:
                objects.append(_topic_obj(t))

            # memoire mode: add memories and stop — no tickets or docs
            if is_memoire:
                if topic_ids:
                    memories = (
                        db.query(TopicMemory)
                        .filter(TopicMemory.topic_id.in_(topic_ids[:5]))
                        .all()
                    )
                    topic_map = {t.id: t.title for t in topics}
                    for m in memories:
                        objects.append(_memory_obj(m, topic_map.get(m.topic_id, m.topic_id)))
                return "space-first memory-only context", objects

            # Tickets for all topics in space (max 20) — pilotage excludes "done"
            if topic_ids:
                ticket_q = db.query(Ticket).filter(Ticket.topic_id.in_(topic_ids))
                if is_pilotage:
                    ticket_q = ticket_q.filter(Ticket.status != "done")
                tickets = ticket_q.limit(20).all()
                for t in tickets:
                    if not _is_noise_ticket(t):
                        objects.append(_ticket_obj(t))

            # Documents in space (max 8)
            docs = (
                db.query(Document)
                .filter(Document.space_id == space_id, Document.is_archived.is_(False))
                .limit(8)
                .all()
            )
            for d in docs:
                objects.append(_document_obj(d))

            # Topic memories (max 5)
            if topic_ids:
                memories = (
                    db.query(TopicMemory)
                    .filter(TopicMemory.topic_id.in_(topic_ids[:5]))
                    .all()
                )
                topic_map = {t.id: t.title for t in topics}
                for m in memories:
                    objects.append(_memory_obj(m, topic_map.get(m.topic_id, m.topic_id)))

            return "space-first compact context", objects

        # ── Project-only ──────────────────────────────────────────────────────
        if project_id:
            project = db.get(Project, project_id)
            if not project:
                return "no persisted context", []
            objects.append(_project_obj(project))

            # List spaces (max 10)
            spaces = (
                db.query(Space)
                .filter(Space.project_id == project_id)
                .limit(10)
                .all()
            )
            for s in spaces:
                objects.append(_space_obj(s))

            return "project-only overview context", objects

    except Exception:
        logger.exception("context_builder error — returning empty context")
        return "no persisted context", []

    return "no persisted context", []


# ─── LLM context formatter ────────────────────────────────────────────────────

_KIND_HEADERS: dict[str, str] = {
    "project":      "PROJET",
    "space":        "ESPACE",
    "topic":        "TOPIC",
    "topic_memory": "MÉMOIRE TOPIC",
    "ticket":       "TICKET",
    "document":     "DOCUMENT",
}

_KIND_ORDER = ["project", "space", "topic", "topic_memory", "ticket", "document"]


def _render_object(obj: ContextObject) -> list[str]:
    """Render a single context object as readable lines."""
    header = _KIND_HEADERS.get(obj.kind, obj.kind.upper())
    lines = [f"┌── {header} : {obj.label}  [id={obj.id}]"]

    for key, val in obj.content.items():
        if val is None or val == "" or val == [] or val == {}:
            continue
        if isinstance(val, list):
            lines.append(f"│   {key}: {', '.join(str(v) for v in val)}")
        elif isinstance(val, dict):
            # Flatten one level
            parts = [f"{k}={v}" for k, v in val.items() if v]
            if parts:
                lines.append(f"│   {key}: {'; '.join(parts)}")
        else:
            lines.append(f"│   {key}: {val}")

    lines.append("└" + "─" * 60)
    return lines


def format_context_for_llm(objects: list[ContextObject]) -> str:
    """Convert context objects into a rich, readable block for the LLM.

    Objects are rendered grouped by kind, ordered from broadest to most specific:
    project → space → topic → topic_memory → tickets → documents
    """
    if not objects:
        return (
            "╔══ CONTEXTE SHADOW PO ══════════════════════════════════════╗\n"
            "  Aucun objet trouvé en base de données pour ce contexte.\n"
            "  Tu travailles sans backlog chargé.\n"
            "╚════════════════════════════════════════════════════════════╝"
        )

    lines: list[str] = [
        "╔══ CONTEXTE SHADOW PO — objets réels de la base de données ══╗",
        "  ⚠  Ne génère AUCUN ticket, topic, document ou règle absent de ce contexte.",
        "╚════════════════════════════════════════════════════════════════╝",
        "",
    ]

    # Group by kind in display order
    groups: dict[str, list[ContextObject]] = {k: [] for k in _KIND_ORDER}
    for obj in objects:
        if obj.kind in groups:
            groups[obj.kind].append(obj)
        else:
            groups.setdefault(obj.kind, []).append(obj)

    for kind in _KIND_ORDER:
        objs = groups.get(kind, [])
        for obj in objs:
            lines.extend(_render_object(obj))
            lines.append("")

    # Any kinds not in the default order
    for kind, objs in groups.items():
        if kind not in _KIND_ORDER:
            for obj in objs:
                lines.extend(_render_object(obj))
                lines.append("")

    lines.append("═══ FIN DU CONTEXTE ══════════════════════════════════════════")
    return "\n".join(lines)


def estimate_tokens(text: str) -> int:
    """Rough token estimate: 1 token ≈ 4 chars."""
    return max(1, len(text) // 4)
