"""AI Conversations — persistent chat history for Let's Chat.

Routes:
  GET    /ai/conversations              list conversations for a space or project
  POST   /ai/conversations              create a conversation (with optional first messages)
  GET    /ai/conversations/{id}         get full conversation with messages
  POST   /ai/conversations/{id}/messages append messages to an existing conversation
  PATCH  /ai/conversations/{id}         update title
  DELETE /ai/conversations/{id}         delete conversation + its messages
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ai_conversation import AIConversation
from app.models.ai_message import AIMessage
from app.models.project import Project
from app.services.ai.openai_conversations import create_openai_conversation
from app.services.ai.project_skill_versions import ensure_active_skill_version

router = APIRouter()

_MAX_ASSISTANT_ANSWER_CHARS = 12_000
_MAX_ASSISTANT_ANSWER_PREVIEW_CHARS = 1_200
_MAX_USER_CONTENT_PREVIEW_CHARS = 1_200
_MAX_UNDERSTANDING_CHARS = 1_000
_MAX_NEXT_ACTIONS = 4
_MAX_RELATED_OBJECTS = 8
_MAX_KNOWLEDGE_DOCS = 6
_MAX_GENERATED_OBJECTS = 4
_MAX_PROPOSED_ACTIONS = 6


def _truncate_text(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    clipped = text[:limit].rstrip()
    if " " in clipped:
        clipped = clipped.rsplit(" ", 1)[0]
    return f"{clipped}…"


def _is_truncated(value: Any, limit: int) -> bool:
    text = str(value or "").strip()
    return len(text) > limit


def _sanitize_related_objects(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    sanitized: list[dict[str, str]] = []
    for item in value[:_MAX_RELATED_OBJECTS]:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("kind") or item.get("type") or "").strip()
        object_id = str(item.get("id") or "").strip()
        label = str(item.get("label") or item.get("title") or "").strip()
        if not (kind and object_id and label):
            continue
        sanitized.append({"kind": kind, "id": object_id, "label": label})
    return sanitized


def _sanitize_knowledge_docs(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    sanitized: list[dict[str, Any]] = []
    for item in value[:_MAX_KNOWLEDGE_DOCS]:
        if not isinstance(item, dict):
            continue
        doc_id = str(item.get("id") or "").strip()
        title = str(item.get("title") or "").strip()
        if not (doc_id and title):
            continue
        sanitized.append(
            {
                "id": doc_id,
                "title": title,
                "document_type": str(item.get("document_type") or item.get("documentType") or "").strip(),
                "openai_file_id": item.get("openai_file_id") or item.get("openaiFileId"),
            }
        )
    return sanitized


def _sanitize_generated_objects(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    sanitized: list[dict[str, Any]] = []
    for item in value[:_MAX_GENERATED_OBJECTS]:
        if not isinstance(item, dict):
            continue
        obj_type = str(item.get("type") or "").strip()
        label = str(item.get("label") or "").strip()
        if not (obj_type and label):
            continue
        sanitized.append(
            {
                "type": obj_type,
                "label": label,
                "content": item.get("content") if isinstance(item.get("content"), dict) else {},
            }
        )
    return sanitized


def _sanitize_proposed_actions(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    sanitized: list[dict[str, Any]] = []
    for item in value[:_MAX_PROPOSED_ACTIONS]:
        if not isinstance(item, dict):
            continue
        action_id = str(item.get("action_id") or item.get("id") or "").strip()
        action_type = str(item.get("type") or "").strip()
        label = str(item.get("label") or "").strip()
        if not (action_id and action_type and label):
            continue
        payload = item.get("payload") if isinstance(item.get("payload"), dict) else {}
        target_label = str(
            payload.get("ticket_id")
            or payload.get("topic_id")
            or payload.get("title")
            or payload.get("label")
            or ""
        ).strip() or None
        sanitized.append(
            {
                "id": action_id,
                "type": action_type,
                "label": label,
                "requires_confirmation": bool(item.get("requires_confirmation", True)),
                "status": "pending",
                "target_label": target_label,
            }
        )
    return sanitized


def _sanitize_assistant_metadata(
    metadata: dict[str, Any] | None,
    *,
    answer_limit: int = _MAX_ASSISTANT_ANSWER_CHARS,
) -> dict[str, Any]:
    if not isinstance(metadata, dict):
        return {}
    sanitized: dict[str, Any] = {}
    if metadata.get("mode") is not None:
        sanitized["mode"] = str(metadata.get("mode"))
    if metadata.get("understanding") is not None:
        sanitized["understanding"] = _truncate_text(metadata.get("understanding"), _MAX_UNDERSTANDING_CHARS)
    if metadata.get("answer_markdown") is not None:
        sanitized["answer_markdown"] = _truncate_text(metadata.get("answer_markdown"), answer_limit)
    if isinstance(metadata.get("certainty"), dict):
        certainty = metadata["certainty"]
        sanitized["certainty"] = {
            "certain": [str(v) for v in certainty.get("certain", [])[:4]],
            "inferred": [str(v) for v in certainty.get("inferred", [])[:4]],
            "to_confirm": [str(v) for v in certainty.get("to_confirm", [])[:4]],
        }
    next_actions = metadata.get("next_actions")
    if isinstance(next_actions, list):
        sanitized["next_actions"] = [str(v) for v in next_actions[:_MAX_NEXT_ACTIONS]]
    related_objects = _sanitize_related_objects(metadata.get("related_objects"))
    if related_objects:
        sanitized["related_objects"] = related_objects
    knowledge_docs = _sanitize_knowledge_docs(metadata.get("knowledge_docs_used"))
    if knowledge_docs:
        sanitized["knowledge_docs_used"] = knowledge_docs
    generated_objects = _sanitize_generated_objects(metadata.get("generated_objects"))
    if generated_objects:
        sanitized["generated_objects"] = generated_objects
    proposed_actions = _sanitize_proposed_actions(metadata.get("proposed_actions"))
    if proposed_actions:
        sanitized["proposed_actions"] = proposed_actions
    return sanitized


def _extract_openai_response_id(metadata: dict[str, Any] | None) -> str | None:
    if not isinstance(metadata, dict):
        return None
    response_id = str(metadata.get("openai_response_id") or "").strip()
    return response_id or None


def _serialize_message(message: AIMessage, *, include_full_content: bool = False) -> MessageOut:
    metadata: dict[str, Any] = {}
    content = message.content
    is_truncated = False
    full_content_available = False

    if message.role == "assistant":
        answer_limit = _MAX_ASSISTANT_ANSWER_CHARS if include_full_content else _MAX_ASSISTANT_ANSWER_PREVIEW_CHARS
        metadata = _sanitize_assistant_metadata(message.payload_metadata, answer_limit=answer_limit)
        full_answer = str((message.payload_metadata or {}).get("answer_markdown") or "").strip()
        full_content_available = bool(full_answer)
        is_truncated = _is_truncated(full_answer, answer_limit)
    else:
        full_content_available = bool(message.content)
        if not include_full_content:
            content = _truncate_text(message.content, _MAX_USER_CONTENT_PREVIEW_CHARS)
            is_truncated = _is_truncated(message.content, _MAX_USER_CONTENT_PREVIEW_CHARS)

    return MessageOut(
        id=message.id,
        role=message.role,
        content=content,
        metadata=metadata,
        created_at=message.created_at,
        is_truncated=is_truncated,
        full_content_available=full_content_available,
        content_chars=len(message.content or ""),
        metadata_chars=len(str(message.payload_metadata or "")),
    )


# ─── Schemas ──────────────────────────────────────────────────────────────────

class MessageIn(BaseModel):
    role: str           # "user" | "assistant"
    content: str        # user text or answer_markdown
    metadata: dict = Field(default_factory=dict)   # full AI payload for assistant turns


class ConversationCreate(BaseModel):
    space_id: str
    project_id: str | None = None
    topic_id: str | None = None
    title: str = ""
    messages: list[MessageIn] = Field(default_factory=list)


class ConversationAppend(BaseModel):
    messages: list[MessageIn]


class ConversationPatch(BaseModel):
    title: str


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    metadata: dict
    created_at: datetime
    is_truncated: bool = False
    full_content_available: bool = False
    content_chars: int = 0
    metadata_chars: int = 0


class ConversationSummary(BaseModel):
    id: str
    title: str
    space_id: str
    project_id: str | None
    topic_id: str | None
    skill_version_id_snapshot: str | None = None
    openai_conversation_id: str | None = None
    openai_response_id: str | None = None
    message_count: int
    created_at: datetime
    updated_at: datetime | None


class ConversationDetail(ConversationSummary):
    messages: list[MessageOut]
    total_message_count: int = Field(alias="totalMessageCount")
    loaded_message_count: int = Field(alias="loadedMessageCount")
    has_more: bool = Field(alias="hasMore")
    next_offset: int | None = Field(default=None, alias="nextOffset")

    model_config = {"populate_by_name": True}


class ProposedActionCard(BaseModel):
    id: str
    type: str
    label: str
    requires_confirmation: bool
    status: str
    target_label: str | None = None


class MessagePreview(BaseModel):
    id: str
    role: str
    created_at: datetime
    preview_text: str
    is_truncated: bool
    has_detail: bool
    has_actions: bool
    state: str


class MessageDetailNode(BaseModel):
    id: str
    role: str
    created_at: datetime
    full_text: str
    rendered_answer: str | None = None
    certainty: dict[str, Any] | None = None
    related_objects: list[dict[str, str]] = Field(default_factory=list)
    actions: list[ProposedActionCard] = Field(default_factory=list)
    debug_available: bool = False


class ConversationPreviewNode(BaseModel):
    id: str
    title: str
    last_message_at: datetime
    status: str
    unread_count: int
    last_assistant_preview: str


class ConversationThreadNode(BaseModel):
    conversation: ConversationPreviewNode
    messages: list[MessagePreview]
    total_message_count: int = Field(alias="totalMessageCount")
    loaded_message_count: int = Field(alias="loadedMessageCount")
    has_more: bool = Field(alias="hasMore")
    next_offset: int | None = Field(default=None, alias="nextOffset")

    model_config = {"populate_by_name": True}


class ChatNodeAppendResult(BaseModel):
    conversation: ConversationPreviewNode
    appended_messages: list[MessagePreview]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _auto_title(messages: list[MessageIn], fallback: str = "Conversation") -> str:
    """Generate a title from the first user message (truncated)."""
    for m in messages:
        if m.role == "user" and m.content.strip():
            return m.content.strip()[:80]
    return fallback


def _build_message_preview(message: AIMessage) -> MessagePreview:
    metadata = _sanitize_assistant_metadata(message.payload_metadata, answer_limit=_MAX_ASSISTANT_ANSWER_PREVIEW_CHARS)
    if message.role == "assistant":
        full_text = str((message.payload_metadata or {}).get("answer_markdown") or "").strip()
        preview_text = str(metadata.get("answer_markdown") or message.content or "").strip()
        actions = metadata.get("proposed_actions") or []
        is_truncated = _is_truncated(full_text, _MAX_ASSISTANT_ANSWER_PREVIEW_CHARS)
        has_detail = bool(full_text)
        has_actions = bool(actions)
        state = "ready"
    else:
        preview_text = _truncate_text(message.content, _MAX_USER_CONTENT_PREVIEW_CHARS)
        is_truncated = _is_truncated(message.content, _MAX_USER_CONTENT_PREVIEW_CHARS)
        has_detail = bool(message.content)
        has_actions = False
        state = "ready"
    return MessagePreview(
        id=message.id,
        role=message.role,
        created_at=message.created_at,
        preview_text=preview_text,
        is_truncated=is_truncated,
        has_detail=has_detail,
        has_actions=has_actions,
        state=state,
    )


def _build_conversation_preview(
    conv: AIConversation,
    latest_message: AIMessage | None,
    *,
    include_assistant_preview: bool = True,
) -> ConversationPreviewNode:
    assistant_preview = ""
    last_message_at = conv.updated_at or conv.created_at
    if latest_message is not None:
        last_message_at = latest_message.created_at or last_message_at
        if include_assistant_preview and latest_message.role == "assistant":
            assistant_preview = _build_message_preview(latest_message).preview_text
    return ConversationPreviewNode(
        id=conv.id,
        title=conv.title,
        last_message_at=last_message_at,
        status="ready",
        unread_count=0,
        last_assistant_preview=assistant_preview,
    )


def _project_uses_openai_conversation(project: Project | None) -> bool:
    strategy = str(getattr(project, "openai_strategy", "") or "").strip().lower()
    return strategy.startswith("responses_plus_conversation")


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(
    space_id: str | None = None,
    project_id: str | None = None,
    limit: int = 30,
    db: Session = Depends(get_db),
):
    """List conversations filtered by space_id or project_id, newest first."""
    q = db.query(AIConversation)
    if space_id:
        q = q.filter(AIConversation.space_id == space_id)
    elif project_id:
        q = q.filter(AIConversation.project_id == project_id)
    convs = q.order_by(AIConversation.updated_at.desc().nullslast()).limit(limit).all()

    result = []
    for c in convs:
        count = db.query(AIMessage).filter(AIMessage.conversation_id == c.id).count()
        result.append(ConversationSummary(
            id=c.id, title=c.title,
            space_id=c.space_id, project_id=c.project_id, topic_id=c.topic_id,
            skill_version_id_snapshot=c.skill_version_id_snapshot,
            openai_conversation_id=c.openai_conversation_id,
            openai_response_id=c.openai_response_id,
            message_count=count,
            created_at=c.created_at, updated_at=c.updated_at,
        ))
    return result


@router.get("/chat-node/conversations", response_model=list[ConversationPreviewNode])
def list_chat_node_conversations(
    space_id: str | None = None,
    project_id: str | None = None,
    limit: int = 30,
    db: Session = Depends(get_db),
):
    q = db.query(AIConversation)
    if space_id:
        q = q.filter(AIConversation.space_id == space_id)
    elif project_id:
        q = q.filter(AIConversation.project_id == project_id)
    convs = q.order_by(AIConversation.updated_at.desc().nullslast()).limit(limit).all()

    previews: list[ConversationPreviewNode] = []
    for conv in convs:
        latest_message = (
            db.query(AIMessage)
            .filter(AIMessage.conversation_id == conv.id)
            .order_by(AIMessage.created_at.desc(), AIMessage.id.desc())
            .first()
        )
        previews.append(_build_conversation_preview(conv, latest_message))
    return previews


@router.post("/conversations", response_model=ConversationDetail, status_code=201)
def create_conversation(body: ConversationCreate, db: Session = Depends(get_db)):
    """Create a conversation, optionally with first messages."""
    now = datetime.utcnow()
    conversation_id = str(uuid.uuid4())
    title = body.title.strip() or _auto_title(body.messages, "Nouvelle conversation")
    project = db.get(Project, body.project_id) if body.project_id else None
    active_skill_version = ensure_active_skill_version(db, body.project_id)
    openai_conversation_id = None
    if _project_uses_openai_conversation(project):
        seed_items: list[dict] = []
        if active_skill_version and active_skill_version.compiled_runtime_text.strip():
            seed_items.append(
                {
                    "type": "message",
                    "role": "developer",
                    "content": active_skill_version.compiled_runtime_text.strip(),
                }
            )
        openai_conversation_id = create_openai_conversation(
            metadata={
                "mepo_project_id": str(body.project_id or ""),
                "mepo_space_id": str(body.space_id or ""),
                "mepo_topic_id": str(body.topic_id or ""),
                "mepo_conversation_id": conversation_id,
                "skill_version_id": str(active_skill_version.id if active_skill_version else ""),
            },
            items=seed_items or None,
        )
    conv = AIConversation(
        id=conversation_id,
        space_id=body.space_id,
        project_id=body.project_id,
        topic_id=body.topic_id,
        title=title,
        skill_version_id_snapshot=active_skill_version.id if active_skill_version else None,
        openai_conversation_id=openai_conversation_id,
        created_at=now,
        updated_at=now,
    )
    db.add(conv)
    db.flush()

    msgs_out: list[MessageOut] = []
    for index, m in enumerate(body.messages):
        message_time = now + timedelta(microseconds=index)
        if m.role == "assistant":
            conv.openai_response_id = _extract_openai_response_id(m.metadata) or conv.openai_response_id
        stored_metadata = _sanitize_assistant_metadata(m.metadata) if m.role == "assistant" else {}
        msg = AIMessage(
            id=str(uuid.uuid4()),
            conversation_id=conv.id,
            role=m.role,
            content=m.content,
            payload_metadata=stored_metadata,
            created_at=message_time,
        )
        db.add(msg)
        msgs_out.append(_serialize_message(msg))

    db.commit()
    return ConversationDetail(
        id=conv.id, title=conv.title,
        space_id=conv.space_id, project_id=conv.project_id, topic_id=conv.topic_id,
        skill_version_id_snapshot=conv.skill_version_id_snapshot,
        openai_conversation_id=conv.openai_conversation_id,
        openai_response_id=conv.openai_response_id,
        message_count=len(msgs_out),
        created_at=conv.created_at, updated_at=conv.updated_at,
        messages=msgs_out,
        totalMessageCount=len(msgs_out),
        loadedMessageCount=len(msgs_out),
        hasMore=False,
        nextOffset=None,
    )


@router.post("/chat-node/conversations", response_model=ConversationThreadNode, status_code=201)
def create_chat_node_conversation(body: ConversationCreate, db: Session = Depends(get_db)):
    detail = create_conversation(body, db)
    conv = db.get(AIConversation, detail.id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    latest_message = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conv.id)
        .order_by(AIMessage.created_at.desc(), AIMessage.id.desc())
        .first()
    )
    return ConversationThreadNode(
        conversation=_build_conversation_preview(conv, latest_message),
        messages=[
            _build_message_preview(message)
            for message in (
                db.query(AIMessage)
                .filter(AIMessage.conversation_id == conv.id)
                .order_by(AIMessage.created_at.asc(), AIMessage.id.asc())
                .all()
            )
        ],
        totalMessageCount=detail.total_message_count,
        loadedMessageCount=detail.loaded_message_count,
        hasMore=detail.has_more,
        nextOffset=detail.next_offset,
    )


@router.get("/conversations/{conv_id}", response_model=ConversationDetail)
def get_conversation(
    conv_id: str,
    offset: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    """Get a conversation page ordered chronologically.

    Pagination rule:
    - `offset=0` returns the latest `limit` messages
    - increasing offset walks backward in history
    """
    conv = db.get(AIConversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    total_count = db.query(AIMessage).filter(AIMessage.conversation_id == conv_id).count()
    safe_limit = max(1, min(limit, 50))
    safe_offset = max(0, offset)
    paged_desc = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conv_id)
        .order_by(AIMessage.created_at.desc(), AIMessage.id.desc())
        .offset(safe_offset)
        .limit(safe_limit)
        .all()
    )
    msgs = list(reversed(paged_desc))
    loaded_count = len(msgs)
    next_offset = safe_offset + loaded_count
    has_more = next_offset < total_count
    return ConversationDetail(
        id=conv.id, title=conv.title,
        space_id=conv.space_id, project_id=conv.project_id, topic_id=conv.topic_id,
        skill_version_id_snapshot=conv.skill_version_id_snapshot,
        openai_conversation_id=conv.openai_conversation_id,
        openai_response_id=conv.openai_response_id,
        message_count=total_count,
        created_at=conv.created_at, updated_at=conv.updated_at,
        messages=[
            _serialize_message(m, include_full_content=False)
            for m in msgs
        ],
        totalMessageCount=total_count,
        loadedMessageCount=loaded_count,
        hasMore=has_more,
        nextOffset=next_offset if has_more else None,
    )


@router.get("/conversations/{conv_id}/messages/{message_id}", response_model=MessageOut)
def get_conversation_message(
    conv_id: str,
    message_id: str,
    db: Session = Depends(get_db),
):
    conv = db.get(AIConversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    message = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conv_id, AIMessage.id == message_id)
        .one_or_none()
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message introuvable.")
    return _serialize_message(message, include_full_content=True)


@router.get("/chat-node/conversations/{conv_id}", response_model=ConversationThreadNode)
def get_chat_node_conversation(
    conv_id: str,
    offset: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    conv = db.get(AIConversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    total_count = db.query(AIMessage).filter(AIMessage.conversation_id == conv_id).count()
    safe_limit = max(1, min(limit, 50))
    safe_offset = max(0, offset)
    paged_desc = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conv_id)
        .order_by(AIMessage.created_at.desc(), AIMessage.id.desc())
        .offset(safe_offset)
        .limit(safe_limit)
        .all()
    )
    msgs = list(reversed(paged_desc))
    loaded_count = len(msgs)
    next_offset = safe_offset + loaded_count
    has_more = next_offset < total_count
    latest_message = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conv_id)
        .order_by(AIMessage.created_at.desc(), AIMessage.id.desc())
        .first()
    )
    return ConversationThreadNode(
        conversation=_build_conversation_preview(conv, latest_message, include_assistant_preview=False),
        messages=[_build_message_preview(message) for message in msgs],
        totalMessageCount=total_count,
        loadedMessageCount=loaded_count,
        hasMore=has_more,
        nextOffset=next_offset if has_more else None,
    )


@router.get("/chat-node/conversations/{conv_id}/messages/{message_id}", response_model=MessageDetailNode)
def get_chat_node_message_detail(
    conv_id: str,
    message_id: str,
    db: Session = Depends(get_db),
):
    conv = db.get(AIConversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    message = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conv_id, AIMessage.id == message_id)
        .one_or_none()
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message introuvable.")
    metadata = _sanitize_assistant_metadata(message.payload_metadata, answer_limit=_MAX_ASSISTANT_ANSWER_CHARS)
    full_answer = str((message.payload_metadata or {}).get("answer_markdown") or "").strip()
    actions = [ProposedActionCard(**action) for action in metadata.get("proposed_actions", [])]
    return MessageDetailNode(
        id=message.id,
        role=message.role,
        created_at=message.created_at,
        full_text=message.content if message.role == "user" else full_answer,
        rendered_answer=full_answer if message.role == "assistant" else None,
        certainty=metadata.get("certainty"),
        related_objects=metadata.get("related_objects", []),
        actions=actions,
        debug_available=False,
    )


@router.post("/conversations/{conv_id}/messages", response_model=ConversationDetail)
def append_messages(conv_id: str, body: ConversationAppend, db: Session = Depends(get_db)):
    """Append one or more messages to an existing conversation."""
    conv = db.get(AIConversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")

    now = datetime.utcnow()
    for index, m in enumerate(body.messages):
        message_time = now + timedelta(microseconds=index)
        if m.role == "assistant":
            conv.openai_response_id = _extract_openai_response_id(m.metadata) or conv.openai_response_id
        stored_metadata = _sanitize_assistant_metadata(m.metadata) if m.role == "assistant" else {}
        msg = AIMessage(
            id=str(uuid.uuid4()),
            conversation_id=conv.id,
            role=m.role,
            content=m.content,
            payload_metadata=stored_metadata,
            created_at=message_time,
        )
        db.add(msg)

    conv.updated_at = now
    db.commit()

    return get_conversation(conv_id, db=db)


@router.post("/chat-node/conversations/{conv_id}/messages", response_model=ChatNodeAppendResult)
def append_chat_node_messages(conv_id: str, body: ConversationAppend, db: Session = Depends(get_db)):
    append_messages(conv_id, body, db)
    conv = db.get(AIConversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    latest_message = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conv_id)
        .order_by(AIMessage.created_at.desc(), AIMessage.id.desc())
        .first()
    )
    appended = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conv_id)
        .order_by(AIMessage.created_at.desc(), AIMessage.id.desc())
        .limit(len(body.messages))
        .all()
    )
    appended_messages = list(reversed(appended))
    return ChatNodeAppendResult(
        conversation=_build_conversation_preview(conv, latest_message),
        appended_messages=[_build_message_preview(message) for message in appended_messages],
    )


@router.patch("/conversations/{conv_id}", response_model=ConversationSummary)
def rename_conversation(conv_id: str, body: ConversationPatch, db: Session = Depends(get_db)):
    """Rename a conversation."""
    conv = db.get(AIConversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    conv.title = body.title.strip() or conv.title
    conv.updated_at = datetime.utcnow()
    db.commit()
    count = db.query(AIMessage).filter(AIMessage.conversation_id == conv_id).count()
    return ConversationSummary(
        id=conv.id, title=conv.title,
        space_id=conv.space_id, project_id=conv.project_id, topic_id=conv.topic_id,
        skill_version_id_snapshot=conv.skill_version_id_snapshot,
        openai_conversation_id=conv.openai_conversation_id,
        openai_response_id=conv.openai_response_id,
        message_count=count, created_at=conv.created_at, updated_at=conv.updated_at,
    )


@router.delete("/conversations/{conv_id}", status_code=204)
def delete_conversation(conv_id: str, db: Session = Depends(get_db)):
    """Delete a conversation and all its messages."""
    conv = db.get(AIConversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    db.query(AIMessage).filter(AIMessage.conversation_id == conv_id).delete()
    db.delete(conv)
    db.commit()
