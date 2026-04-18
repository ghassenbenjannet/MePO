"""Action Engine — executes validated Shadow PO proposed actions.

Supported action types:
  create_ticket                    → insert a new Ticket row
  create_document                  → insert a new Document row (type=page)
  add_comment                      → append a timestamped comment entry to ticket_details
  create_artifact                  → save a text artifact (Document type=page, tagged 'artifact')
  update_memory                    → upsert TopicMemory fields
  create_topic_then_ticket         → create Topic then Ticket in one shot
  select_topic_then_create_ticket  → create Ticket under a user-selected existing topic
  select_ticket_then_add_comment   → let user pick a topic → ticket, then add a comment
"""
from __future__ import annotations

import copy
import html as _html_mod
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models import AuditLog, Document, Space, Ticket, Topic, TopicMemory
from app.schemas.ai import ActionExecuteRequest, ActionExecuteResponse
from app.services.ai.workspace_cache import invalidate_workspace_cache

log = logging.getLogger(__name__)

_NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


# ─── Markdown → Tiptap HTML converter ────────────────────────────────────────
# Tiptap (StarterKit) consumes HTML, not markdown.
# Documents created by the action engine arrive as markdown from the LLM —
# they must be converted before storage so the editor renders them correctly.

def _inline_md(text: str) -> str:
    """Convert inline markdown tokens to HTML (bold, italic, inline code)."""
    text = _html_mod.escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"__(.+?)__",     r"<strong>\1</strong>", text)
    text = re.sub(r"\*(.+?)\*",     r"<em>\1</em>",         text)
    text = re.sub(r"`(.+?)`",       r"<code>\1</code>",     text)
    return text


def _md_to_html(md: str) -> str:
    """Convert LLM markdown output to Tiptap-compatible HTML.

    Handles: headings (h1-h3), bullet/ordered lists, paragraphs, horizontal
    rules, fenced code blocks, and inline bold/italic/code.

    Tiptap expects:
      - <h1>…</h1>, <h2>…</h2>, <h3>…</h3>
      - <ul><li><p>…</p></li></ul>  (paragraph inside li is required)
      - <ol><li><p>…</p></li></ol>
      - <p>…</p>
      - <pre><code>…</code></pre>
      - <hr>

    If the content already looks like HTML (starts with '<'), it is returned
    unchanged so we never double-convert.
    """
    if not md:
        return ""
    stripped = md.strip()
    if stripped.startswith("<"):
        return md  # already HTML

    lines = stripped.split("\n")
    parts: list[str] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        t = line.strip()

        if not t:
            i += 1
            continue

        # ── Fenced code block ───────────────────────────────────────────────
        if t.startswith("```"):
            code_lines: list[str] = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1  # skip closing ```
            code = "\n".join(code_lines)
            parts.append(f"<pre><code>{_html_mod.escape(code)}</code></pre>")
            continue

        # ── Headings ────────────────────────────────────────────────────────
        if t.startswith("### "):
            parts.append(f"<h3>{_inline_md(t[4:])}</h3>")
            i += 1; continue
        if t.startswith("## "):
            parts.append(f"<h2>{_inline_md(t[3:])}</h2>")
            i += 1; continue
        if t.startswith("# ") and not t.startswith("## "):
            parts.append(f"<h1>{_inline_md(t[2:])}</h1>")
            i += 1; continue

        # ── Horizontal rule ─────────────────────────────────────────────────
        if re.match(r"^-{3,}$", t) or re.match(r"^\*{3,}$", t):
            parts.append("<hr>")
            i += 1; continue

        # ── Unordered list ──────────────────────────────────────────────────
        if re.match(r"^[-*•] ", t):
            items: list[str] = []
            while i < len(lines) and re.match(r"^[-*•] ", lines[i].strip()):
                items.append(f"<li><p>{_inline_md(lines[i].strip()[2:])}</p></li>")
                i += 1
            parts.append("<ul>" + "".join(items) + "</ul>")
            continue

        # ── Ordered list ────────────────────────────────────────────────────
        if re.match(r"^\d+[\.\)] ", t):
            items = []
            while i < len(lines) and re.match(r"^\d+[\.\)] ", lines[i].strip()):
                text = re.sub(r"^\d+[\.\)] ", "", lines[i].strip())
                items.append(f"<li><p>{_inline_md(text)}</p></li>")
                i += 1
            parts.append("<ol>" + "".join(items) + "</ol>")
            continue

        # ── Paragraph (collect until blank line or block element) ───────────
        para: list[str] = []
        while i < len(lines):
            pt = lines[i].strip()
            if not pt:
                break
            if (pt.startswith("#")
                    or pt.startswith("```")
                    or re.match(r"^[-*•] ", pt)
                    or re.match(r"^\d+[\.\)] ", pt)
                    or re.match(r"^-{3,}$", pt)):
                break
            para.append(pt)
            i += 1
        if para:
            parts.append(f"<p>{_inline_md(' '.join(para))}</p>")

    return "".join(parts)

_VALID_STATUSES = {"backlog", "todo", "in_progress", "review", "done", "blocked"}
_VALID_TYPES    = {"feature", "bug", "task", "analysis", "test"}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _new_id() -> str:
    return str(uuid.uuid4())


def _safe_list(value: Any) -> list:
    """Coerce any value to a list (empty list as default)."""
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value:
        return [value]
    return []


def _safe_status(value: Any) -> str:
    """Return the value if it's a valid ticket status, else 'backlog'."""
    return value if value in _VALID_STATUSES else "backlog"


def _safe_type(value: Any) -> str:
    """Return the value if it's a valid ticket type, else 'task'."""
    return value if value in _VALID_TYPES else "task"


def _write_audit_log(
    db: Session,
    *,
    action_type: str,
    object_type: str,
    object_id: str,
    old_state: dict | None = None,
    new_state: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            action_type=action_type,
            actor_id="mepo-user",
            object_type=object_type,
            object_id=object_id,
            old_state=old_state,
            new_state=new_state,
        )
    )


def _ensure_topic_context(
    db: Session,
    *,
    topic_id: str,
    project_id: str | None,
    space_id: str | None,
) -> Topic | None:
    topic = db.get(Topic, topic_id)
    if not topic:
        return None
    space = db.get(Space, topic.space_id)
    if not space:
        return None
    if project_id and space.project_id != project_id:
        return None
    if space_id and space.id != space_id:
        return None
    return topic


def _ensure_ticket_context(
    db: Session,
    *,
    ticket_id: str,
    project_id: str | None,
    space_id: str | None,
    topic_id: str | None,
) -> Ticket | None:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        return None
    topic = _ensure_topic_context(
        db,
        topic_id=ticket.topic_id,
        project_id=project_id,
        space_id=space_id,
    )
    if not topic:
        return None
    if topic_id and ticket.topic_id != topic_id:
        return None
    return ticket


def _ensure_linked_documents(
    db: Session,
    *,
    document_ids: list[str],
    project_id: str | None,
    space_id: str | None,
    topic_id: str | None,
) -> str | None:
    for document_id in document_ids:
        doc = db.get(Document, document_id)
        if not doc:
            return f"Document lié introuvable: {document_id}"
        if space_id and doc.space_id != space_id:
            return f"Le document {document_id} n'appartient pas à l'espace attendu."
        if topic_id and doc.topic_id not in (None, topic_id):
            return f"Le document {document_id} n'est pas rattaché au topic attendu."
        if project_id:
            space = db.get(Space, doc.space_id)
            if not space or space.project_id != project_id:
                return f"Le document {document_id} n'appartient pas au projet attendu."
    return None


def _find_duplicate_ticket(db: Session, *, topic_id: str, title: str) -> Ticket | None:
    normalized_title = " ".join((title or "").lower().split())
    if not normalized_title:
        return None
    tickets = db.query(Ticket).filter(Ticket.topic_id == topic_id).all()
    for ticket in tickets:
        if " ".join((ticket.title or "").lower().split()) == normalized_title:
            return ticket
    return None


# ─── Action handlers ──────────────────────────────────────────────────────────

def _create_ticket(db: Session, req: ActionExecuteRequest) -> ActionExecuteResponse:
    p = req.payload
    topic_id = p.get("topic_id") or req.topic_id
    if not topic_id:
        return ActionExecuteResponse(
            success=False,
            action_type="create_ticket",
            message="topic_id manquant dans le payload.",
        )
    topic = _ensure_topic_context(
        db,
        topic_id=topic_id,
        project_id=req.project_id,
        space_id=req.space_id,
    )
    if not topic:
        return ActionExecuteResponse(
            success=False,
            action_type="create_ticket",
            message="Le topic cible est introuvable ou hors du contexte projet/espace.",
        )

    title = p.get("title", "Nouveau ticket")
    duplicate = _find_duplicate_ticket(db, topic_id=topic.id, title=title)
    if duplicate:
        return ActionExecuteResponse(
            success=False,
            action_type="create_ticket",
            message=f"Doublon détecté: le ticket {duplicate.id} porte déjà ce titre dans le topic cible.",
        )

    linked_document_ids = [str(item) for item in _safe_list(p.get("linked_document_ids"))]
    link_error = _ensure_linked_documents(
        db,
        document_ids=linked_document_ids,
        project_id=req.project_id,
        space_id=req.space_id or topic.space_id,
        topic_id=topic.id,
    )
    if link_error:
        return ActionExecuteResponse(
            success=False,
            action_type="create_ticket",
            message=link_error,
        )

    # Merge ticket_details from payload — carries structured metadata like
    # environment, steps_to_reproduce, actual_behavior, expected_behavior.
    raw_details = p.get("ticket_details")
    ticket_details: dict | None = raw_details if isinstance(raw_details, dict) else None

    ticket = Ticket(
        id=_new_id(),
        topic_id=topic.id,
        title=title,
        description=p.get("description", ""),
        type=_safe_type(p.get("type")),
        status=_safe_status(p.get("status")),
        priority=p.get("priority", "medium"),
        assignee=p.get("assignee"),
        reporter=p.get("reporter"),
        estimate=p.get("estimate"),
        acceptance_criteria=_safe_list(p.get("acceptance_criteria")),
        tags=_safe_list(p.get("tags")),
        linked_document_ids=linked_document_ids,
        ticket_details=ticket_details,
    )
    db.add(ticket)
    _write_audit_log(
        db,
        action_type="create_ticket",
        object_type="ticket",
        object_id=ticket.id,
        new_state={"title": ticket.title, "topic_id": ticket.topic_id, "type": ticket.type},
    )
    db.commit()
    db.refresh(ticket)
    invalidate_workspace_cache(project_id=req.project_id, space_id=req.space_id or topic.space_id, topic_id=topic.id)
    log.info("Action Engine: created ticket %s (type=%s, priority=%s)", ticket.id, ticket.type, ticket.priority)
    return ActionExecuteResponse(
        success=True,
        action_type="create_ticket",
        created_id=ticket.id,
        message=f"Ticket « {ticket.title} » créé.",
        created_object={
            "id": ticket.id,
            "title": ticket.title,
            "type": ticket.type,
            "priority": ticket.priority,
            "topic_id": ticket.topic_id,
            "tags": ticket.tags or [],
        },
    )


def _resolve_space_id(db: Session, topic_id: str | None, space_id: str | None) -> str | None:
    """Resolve space_id from topic when not explicitly provided."""
    if space_id:
        return space_id
    if topic_id:
        topic = db.get(Topic, topic_id)
        if topic:
            return topic.space_id
    return None


def _create_document(db: Session, req: ActionExecuteRequest) -> ActionExecuteResponse:
    p = req.payload
    topic_id = p.get("topic_id") or req.topic_id
    space_id = _resolve_space_id(db, topic_id, p.get("space_id") or req.space_id)

    if not space_id:
        return ActionExecuteResponse(
            success=False,
            action_type="create_document",
            message="space_id introuvable — fournir space_id ou topic_id rattaché à un espace.",
        )

    if topic_id:
        topic = _ensure_topic_context(
            db,
            topic_id=topic_id,
            project_id=req.project_id,
            space_id=space_id,
        )
        if not topic:
            return ActionExecuteResponse(
                success=False,
                action_type="create_document",
                message="Le topic cible du document est invalide pour ce contexte.",
            )

    raw_content = p.get("content", "")
    doc = Document(
        id=_new_id(),
        topic_id=topic_id,
        space_id=space_id,
        title=p.get("title", "Nouveau document"),
        content=_md_to_html(raw_content),   # convert markdown → Tiptap HTML
        type="page",          # always "page" so the viewer can open it
        tags=_safe_list(p.get("tags")),
        is_archived=False,
    )
    db.add(doc)
    _write_audit_log(
        db,
        action_type="create_document",
        object_type="document",
        object_id=doc.id,
        new_state={"title": doc.title, "space_id": doc.space_id, "topic_id": doc.topic_id},
    )
    db.commit()
    db.refresh(doc)
    invalidate_workspace_cache(project_id=req.project_id, space_id=space_id, topic_id=topic_id)
    log.info("Action Engine: created document %s (content=%d chars)", doc.id, len(doc.content or ""))
    return ActionExecuteResponse(
        success=True,
        action_type="create_document",
        created_id=doc.id,
        message=f"Document « {doc.title} » créé.",
        created_object={
            "id": doc.id,
            "title": doc.title,
            "type": doc.type,
            "topic_id": doc.topic_id,
            "space_id": doc.space_id,
        },
    )


def _add_comment(db: Session, req: ActionExecuteRequest) -> ActionExecuteResponse:
    """Append a timestamped comment entry to ticket_details['shadow_po_comments'].

    V1 used to append to ticket.description which corrupted the structured field.
    Now we use a dedicated list in ticket_details so description stays intact.
    """
    p = req.payload
    ticket_id = p.get("ticket_id")
    comment_text = p.get("comment", p.get("content", "")).strip()

    if not ticket_id or not comment_text:
        return ActionExecuteResponse(
            success=False,
            action_type="add_comment",
            message="ticket_id et comment sont requis.",
        )

    ticket = _ensure_ticket_context(
        db,
        ticket_id=ticket_id,
        project_id=req.project_id,
        space_id=req.space_id,
        topic_id=req.topic_id,
    )
    if not ticket:
        return ActionExecuteResponse(
            success=False,
            action_type="add_comment",
            message=f"Ticket {ticket_id!r} introuvable ou hors du contexte autorisé.",
        )

    timestamp = _NOW().strftime("%Y-%m-%d %H:%M")

    # Use ticket_details["shadow_po_comments"] — a list of {ts, text} entries.
    # This leaves ticket.description completely intact.
    #
    # deepcopy is required: dict() is a shallow copy, which means the nested
    # "shadow_po_comments" list is shared between old and new values. SQLAlchemy
    # JSON dirty-tracking would then see identical objects and skip the UPDATE.
    details: dict = copy.deepcopy(ticket.ticket_details or {})
    comments: list = details.get("shadow_po_comments", [])
    comments.append({"ts": timestamp, "text": comment_text})
    details["shadow_po_comments"] = comments
    ticket.ticket_details = details
    # Explicit flag in case SQLAlchemy's change detection misses in-place JSON edits
    flag_modified(ticket, "ticket_details")
    ticket.updated_at = _NOW().replace(tzinfo=None)
    _write_audit_log(
        db,
        action_type="add_comment",
        object_type="ticket",
        object_id=ticket.id,
        new_state={"comment": comment_text[:300]},
    )
    db.commit()
    invalidate_workspace_cache(project_id=req.project_id, space_id=req.space_id, topic_id=ticket.topic_id)
    log.info("Action Engine: added comment to ticket %s", ticket_id)
    return ActionExecuteResponse(
        success=True,
        action_type="add_comment",
        created_id=ticket_id,
        message=f"Commentaire ajouté au ticket {ticket_id}.",
        created_object={"ticket_id": ticket_id, "ts": timestamp, "comment": comment_text[:120]},
    )


def _create_artifact(db: Session, req: ActionExecuteRequest) -> ActionExecuteResponse:
    """Save a Shadow PO generated artifact as a Document with type='page', tagged 'artifact'."""
    p = req.payload
    topic_id = p.get("topic_id") or req.topic_id
    space_id = _resolve_space_id(db, topic_id, p.get("space_id") or req.space_id)

    if not space_id:
        return ActionExecuteResponse(
            success=False,
            action_type="create_artifact",
            message="space_id introuvable — fournir space_id ou topic_id rattaché à un espace.",
        )

    if topic_id:
        topic = _ensure_topic_context(
            db,
            topic_id=topic_id,
            project_id=req.project_id,
            space_id=space_id,
        )
        if not topic:
            return ActionExecuteResponse(
                success=False,
                action_type="create_artifact",
                message="Le topic cible de l'artefact est invalide pour ce contexte.",
            )

    tags = ["artifact"] + _safe_list(p.get("tags"))
    raw_content = p.get("content", "")

    doc = Document(
        id=_new_id(),
        topic_id=topic_id,
        space_id=space_id,
        title=p.get("title", "Artefact Shadow PO"),
        content=_md_to_html(raw_content),   # convert markdown → Tiptap HTML
        type="page",
        tags=tags,
        is_archived=False,
    )
    db.add(doc)
    _write_audit_log(
        db,
        action_type="create_artifact",
        object_type="document",
        object_id=doc.id,
        new_state={"title": doc.title, "space_id": doc.space_id, "topic_id": doc.topic_id},
    )
    db.commit()
    db.refresh(doc)
    invalidate_workspace_cache(project_id=req.project_id, space_id=space_id, topic_id=topic_id)
    log.info("Action Engine: created artifact %s (content=%d chars)", doc.id, len(doc.content or ""))
    return ActionExecuteResponse(
        success=True,
        action_type="create_artifact",
        created_id=doc.id,
        message=f"Artefact « {doc.title} » sauvegardé.",
        created_object={"id": doc.id, "title": doc.title},
    )


def _update_memory(db: Session, req: ActionExecuteRequest) -> ActionExecuteResponse:
    """Upsert topic memory fields."""
    p = req.payload
    topic_id = p.get("topic_id") or req.topic_id
    if not topic_id:
        return ActionExecuteResponse(
            success=False,
            action_type="update_memory",
            message="topic_id manquant.",
        )

    topic = _ensure_topic_context(
        db,
        topic_id=topic_id,
        project_id=req.project_id,
        space_id=req.space_id,
    )
    if not topic:
        return ActionExecuteResponse(
            success=False,
            action_type="update_memory",
            message="Le topic cible est introuvable ou hors du contexte autorisé.",
        )

    memory = db.query(TopicMemory).filter(TopicMemory.topic_id == topic_id).first()
    if not memory:
        memory = TopicMemory(id=_new_id(), topic_id=topic_id)
        db.add(memory)

    _VALID_FIELDS = {"facts", "decisions", "risks", "dependencies", "open_questions"}
    updated_fields: list[str] = []

    def _append_text(existing: list[str] | None, new_text: str) -> list[str]:
        result = list(existing or [])
        result.extend([line.strip() for line in new_text.splitlines() if line.strip()])
        return result

    for field in _VALID_FIELDS:
        new_text = p.get(field, "")
        if new_text:
            existing = getattr(memory, field, None)
            setattr(memory, field, _append_text(existing, new_text))
            updated_fields.append(field)

    # Also handle list of {field, content} updates
    updates: list[dict[str, Any]] = p.get("updates", [])
    for upd in updates:
        field = upd.get("field", "")
        content = upd.get("content", "")
        if field in _VALID_FIELDS and content:
            existing = getattr(memory, field, None)
            setattr(memory, field, _append_text(existing, content))
            if field not in updated_fields:
                updated_fields.append(field)

    memory.updated_at = _NOW().replace(tzinfo=None)
    _write_audit_log(
        db,
        action_type="update_memory",
        object_type="topic_memory",
        object_id=memory.id,
        new_state={"topic_id": topic_id, "fields": updated_fields},
    )
    db.commit()
    invalidate_workspace_cache(project_id=req.project_id, space_id=req.space_id, topic_id=topic_id)
    log.info("Action Engine: updated memory for topic %s, fields=%s", topic_id, updated_fields)
    return ActionExecuteResponse(
        success=True,
        action_type="update_memory",
        created_id=memory.id,
        message=f"Mémoire du topic mise à jour ({', '.join(updated_fields) or 'aucun champ'}).",
    )


# ─── Topic-aware ticket creation ──────────────────────────────────────────────

def _resolve_space_for_topic(db: Session, req: ActionExecuteRequest) -> str | None:
    """Find a valid space_id: from payload → from req → from project's first space.

    Never falls back to a space from a different project.
    """
    p = req.payload
    # 1. Explicit space in payload or request
    space_id = p.get("space_id") or req.space_id
    if space_id:
        return space_id

    # 2. Resolve via existing topic_id in payload/req
    topic_id = p.get("topic_id") or req.topic_id
    if topic_id:
        topic = db.get(Topic, topic_id)
        if topic:
            return topic.space_id

    # 3. Fall back to project's first space (same project only)
    if req.project_id:
        space = db.query(Space).filter(Space.project_id == req.project_id).first()
        if space:
            return space.id

    # 4. No safe fallback — caller must handle None
    return None


def _create_topic_then_ticket(db: Session, req: ActionExecuteRequest) -> ActionExecuteResponse:
    """Create a new Topic and immediately attach a Ticket to it."""
    p = req.payload

    space_id = _resolve_space_for_topic(db, req)
    if not space_id:
        return ActionExecuteResponse(
            success=False,
            action_type="create_topic_then_ticket",
            message="space_id introuvable — impossible de créer le topic. Fournir project_id ou space_id.",
        )

    topic_name = p.get("new_topic_name") or p.get("title", "Nouveau topic")
    topic = Topic(
        id=_new_id(),
        space_id=space_id,
        title=topic_name,
        description=p.get("topic_description", ""),
        topic_nature=p.get("topic_nature", "study_delivery"),
        status="active",
        priority=p.get("priority", "medium"),
        tags=_safe_list(p.get("topic_tags")),
    )
    db.add(topic)
    db.flush()  # get topic.id before commit

    duplicate = _find_duplicate_ticket(db, topic_id=topic.id, title=p.get("title", "Nouveau ticket"))
    if duplicate:
        return ActionExecuteResponse(
            success=False,
            action_type="create_topic_then_ticket",
            message=f"Doublon détecté après création du topic: ticket {duplicate.id} déjà présent.",
        )

    raw_details = p.get("ticket_details")
    ticket = Ticket(
        id=_new_id(),
        topic_id=topic.id,
        title=p.get("title", "Nouveau ticket"),
        description=p.get("description", ""),
        type=_safe_type(p.get("type")),
        status=_safe_status(p.get("status")),
        priority=p.get("priority", "medium"),
        assignee=p.get("assignee"),
        estimate=p.get("estimate"),
        acceptance_criteria=_safe_list(p.get("acceptance_criteria")),
        tags=_safe_list(p.get("tags")),
        ticket_details=raw_details if isinstance(raw_details, dict) else None,
    )
    db.add(ticket)
    _write_audit_log(
        db,
        action_type="create_topic_then_ticket",
        object_type="topic",
        object_id=topic.id,
        new_state={"title": topic.title, "space_id": topic.space_id},
    )
    _write_audit_log(
        db,
        action_type="create_ticket",
        object_type="ticket",
        object_id=ticket.id,
        new_state={"title": ticket.title, "topic_id": ticket.topic_id},
    )
    db.commit()
    db.refresh(topic)
    db.refresh(ticket)
    invalidate_workspace_cache(project_id=req.project_id, space_id=space_id, topic_id=topic.id)

    log.info("Action Engine: created topic %s + ticket %s", topic.id, ticket.id)
    return ActionExecuteResponse(
        success=True,
        action_type="create_topic_then_ticket",
        created_id=ticket.id,
        message=f"Topic « {topic.title} » + ticket « {ticket.title} » créés.",
        created_object={
            "topic_id": topic.id,
            "topic_title": topic.title,
            "ticket_id": ticket.id,
            "ticket_title": ticket.title,
            "ticket_type": ticket.type,
            "ticket_priority": ticket.priority,
        },
    )


def _select_topic_then_create_ticket(db: Session, req: ActionExecuteRequest) -> ActionExecuteResponse:
    """Create a Ticket under an existing topic chosen by the user."""
    p = req.payload

    resolution = p.get("_resolution", {})
    topic_id = (
        p.get("selected_topic_id")
        or resolution.get("suggested_topic_id")
        or p.get("topic_id")
        or req.topic_id
    )

    if not topic_id:
        return ActionExecuteResponse(
            success=False,
            action_type="select_topic_then_create_ticket",
            message="Aucun topic sélectionné — fournir selected_topic_id dans le payload.",
        )

    topic = db.get(Topic, topic_id)
    if not topic:
        return ActionExecuteResponse(
            success=False,
            action_type="select_topic_then_create_ticket",
            message=f"Topic {topic_id!r} introuvable en base.",
        )
    if req.project_id or req.space_id:
        scoped_topic = _ensure_topic_context(
            db,
            topic_id=topic_id,
            project_id=req.project_id,
            space_id=req.space_id,
        )
        if not scoped_topic:
            return ActionExecuteResponse(
                success=False,
                action_type="select_topic_then_create_ticket",
                message="Le topic sélectionné est hors du contexte projet/espace.",
            )

    duplicate = _find_duplicate_ticket(db, topic_id=topic.id, title=p.get("title", "Nouveau ticket"))
    if duplicate:
        return ActionExecuteResponse(
            success=False,
            action_type="select_topic_then_create_ticket",
            message=f"Doublon détecté: le ticket {duplicate.id} existe déjà dans ce topic.",
        )

    raw_details = p.get("ticket_details")
    ticket = Ticket(
        id=_new_id(),
        topic_id=topic.id,
        title=p.get("title", "Nouveau ticket"),
        description=p.get("description", ""),
        type=_safe_type(p.get("type")),
        status=_safe_status(p.get("status")),
        priority=p.get("priority", "medium"),
        assignee=p.get("assignee"),
        estimate=p.get("estimate"),
        acceptance_criteria=_safe_list(p.get("acceptance_criteria")),
        tags=_safe_list(p.get("tags")),
        ticket_details=raw_details if isinstance(raw_details, dict) else None,
    )
    db.add(ticket)
    _write_audit_log(
        db,
        action_type="create_ticket",
        object_type="ticket",
        object_id=ticket.id,
        new_state={"title": ticket.title, "topic_id": ticket.topic_id},
    )
    db.commit()
    db.refresh(ticket)
    invalidate_workspace_cache(project_id=req.project_id, space_id=req.space_id or topic.space_id, topic_id=topic.id)

    log.info("Action Engine: created ticket %s under existing topic %s", ticket.id, topic_id)
    return ActionExecuteResponse(
        success=True,
        action_type="select_topic_then_create_ticket",
        created_id=ticket.id,
        message=f"Ticket « {ticket.title} » créé dans le topic « {topic.title} ».",
        created_object={
            "topic_id": topic.id,
            "topic_title": topic.title,
            "ticket_id": ticket.id,
            "ticket_title": ticket.title,
        },
    )


def _select_ticket_then_add_comment(db: Session, req: ActionExecuteRequest) -> ActionExecuteResponse:
    """Add a comment after the user has selected a topic + ticket.

    Expected payload:
      selected_ticket_id : str   — ticket chosen by the user in the UI
      comment            : str   — comment text (edited by user in UI)
    """
    p = req.payload
    ticket_id   = p.get("selected_ticket_id") or p.get("ticket_id")
    comment_text = p.get("comment", "").strip()

    if not ticket_id or not comment_text:
        return ActionExecuteResponse(
            success=False,
            action_type="select_ticket_then_add_comment",
            message="selected_ticket_id et comment sont requis.",
        )

    # Delegate to the shared add_comment logic
    return _add_comment(db, ActionExecuteRequest(
        action_type="add_comment",
        topic_id=req.topic_id,
        space_id=req.space_id,
        project_id=req.project_id,
        payload={"ticket_id": ticket_id, "comment": comment_text},
    ))


# ─── Public dispatcher ────────────────────────────────────────────────────────

_HANDLERS = {
    "create_ticket":                    _create_ticket,
    "create_document":                  _create_document,
    "add_comment":                      _add_comment,
    "create_artifact":                  _create_artifact,
    "update_memory":                    _update_memory,
    "create_topic_then_ticket":         _create_topic_then_ticket,
    "select_topic_then_create_ticket":  _select_topic_then_create_ticket,
    "select_ticket_then_add_comment":   _select_ticket_then_add_comment,
}


def execute_action(db: Session, req: ActionExecuteRequest) -> ActionExecuteResponse:
    """Dispatch the action to the appropriate handler."""
    # Support _override_action_type from the frontend (e.g. "comment instead" flow)
    action_type = req.payload.get("_override_action_type") or req.action_type
    handler = _HANDLERS.get(action_type)
    if not handler:
        return ActionExecuteResponse(
            success=False,
            action_type=action_type,
            message=f"Type d'action inconnu : {action_type!r}",
        )
    try:
        return handler(db, req)
    except Exception as exc:
        log.exception("Action Engine error for %s: %s", action_type, exc)
        return ActionExecuteResponse(
            success=False,
            action_type=action_type,
            message=f"Erreur lors de l'exécution : {exc}",
        )
