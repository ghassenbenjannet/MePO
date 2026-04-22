"""AI Conversations — chemin standard de lecture des conversations MePO.

Tous les endpoints sont sous /ai/conversations/* (préfixe unique sans "chat-node").
Le préfixe "chat-node" est supprimé du chemin standard.
L'écriture (envoi de message) passe uniquement par POST /ai/conversations/turns (routes_chat.py).

Routes :
  GET    /ai/conversations                          liste des conversations
  POST   /ai/conversations                          créer une conversation vide
  GET    /ai/conversations/{id}                     thread complet paginé
  PATCH  /ai/conversations/{id}                     renommer
  DELETE /ai/conversations/{id}                     supprimer + messages
  GET    /ai/conversations/{id}/messages/{msg_id}   détail d'un message
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ai_conversation import AIConversation
from app.models.ai_message import AIMessage
from app.models.project_knowledge_document import ProjectKnowledgeDocument

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


def _extract_json_string_value(text: str, key: str) -> str | None:
    """Extract the value of a JSON string field even when the text has literal newlines/unescaped chars.

    The JSON tokenizer (json.scanner.py_make_scanner) can't help us here, so we find the
    key, locate the opening quote of the value, then scan forward tracking JSON escapes
    to find the real closing quote.
    """
    search_key = f'"{key}"'
    idx = text.find(search_key)
    if idx == -1:
        return None
    # Skip past the key + colon + optional whitespace
    i = idx + len(search_key)
    while i < len(text) and text[i] in ' \t\r\n':
        i += 1
    if i >= len(text) or text[i] != ':':
        return None
    i += 1
    while i < len(text) and text[i] in ' \t\r\n':
        i += 1
    if i >= len(text) or text[i] != '"':
        return None
    i += 1  # skip opening quote
    # Scan for the real closing quote, respecting JSON escape sequences
    chars: list[str] = []
    while i < len(text):
        c = text[i]
        if c == '\\' and i + 1 < len(text):
            nc = text[i + 1]
            escape_map = {'"': '"', '\\': '\\', '/': '/', 'n': '\n', 'r': '\r', 't': '\t', 'b': '\b', 'f': '\f'}
            if nc in escape_map:
                chars.append(escape_map[nc])
                i += 2
                continue
            if nc == 'u' and i + 5 < len(text):
                try:
                    chars.append(chr(int(text[i + 2:i + 6], 16)))
                    i += 6
                    continue
                except ValueError:
                    pass
        elif c == '"':
            break  # real closing quote found
        chars.append(c)
        i += 1
    return ''.join(chars) if chars else None


def _truncate_text(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    clipped = text[:limit].rstrip()
    if " " in clipped:
        clipped = clipped.rsplit(" ", 1)[0]
    return f"{clipped}…"


def _is_truncated(value: Any, limit: int) -> bool:
    return len(str(value or "").strip()) > limit


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
        sanitized.append(
            {
                "id": action_id,
                "type": action_type,
                "label": label,
                "requires_confirmation": bool(item.get("requires_confirmation", True)),
                "status": "pending",
                "target_label": None,
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
        sanitized["mode"] = str(metadata["mode"])
    if metadata.get("understanding") is not None:
        sanitized["understanding"] = _truncate_text(metadata["understanding"], _MAX_UNDERSTANDING_CHARS)
    if metadata.get("answer_markdown") is not None:
        answer = str(metadata["answer_markdown"])
        # Unwrap recursively: Gemini sometimes nests the full JSON inside answer_markdown.
        for _ in range(5):
            if not answer.strip().startswith("{"):
                break
            try:
                inner = json.loads(answer)
                if not (isinstance(inner, dict) and "answer_markdown" in inner):
                    break
                answer = str(inner["answer_markdown"])
            except (json.JSONDecodeError, ValueError):
                # json.loads failed because outer json.loads already decoded escape
                # sequences (\n, \"), making the inner JSON invalid. Use the JSON
                # scanner to extract just the answer_markdown string value.
                extracted = _extract_json_string_value(answer, "answer_markdown")
                if extracted is not None:
                    answer = extracted
                break
        sanitized["answer_markdown"] = _truncate_text(answer, answer_limit)
    next_actions = metadata.get("next_actions")
    if isinstance(next_actions, list):
        sanitized["next_actions"] = [str(v) for v in next_actions[:_MAX_NEXT_ACTIONS]]
    related_objects = _sanitize_related_objects(metadata.get("related_objects"))
    if related_objects:
        sanitized["related_objects"] = related_objects
    proposed_actions = _sanitize_proposed_actions(metadata.get("proposed_actions"))
    if proposed_actions:
        sanitized["proposed_actions"] = proposed_actions
    return sanitized


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    space_id: str
    project_id: str | None = None
    topic_id: str | None = None
    title: str = ""


class ConversationPatch(BaseModel):
    title: str


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


class DocumentSourceNode(BaseModel):
    id: str
    title: str
    category: str | None = None


class SourceUsedNode(BaseModel):
    doc_id: str
    title: str
    role: str = "reference"


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
    document_sources: list[DocumentSourceNode] = Field(default_factory=list)
    sources_used: list[SourceUsedNode] = Field(default_factory=list)
    evidence_level: str = "none"
    document_backed: bool = False
    warning_no_docs: str | None = None
    retrieved_docs_count: int = 0
    retained_docs_count: int = 0
    evidence_count: int = 0
    corpus_status: str = "not_indexed"


class ConversationPreviewNode(BaseModel):
    id: str
    title: str
    active_use_case: str | None = None
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


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _build_message_preview(message: AIMessage) -> MessagePreview:
    metadata = _sanitize_assistant_metadata(
        message.payload_metadata, answer_limit=_MAX_ASSISTANT_ANSWER_PREVIEW_CHARS
    )
    if message.role == "assistant":
        full_text = str(metadata.get("answer_markdown") or "").strip()
        preview_text = str(metadata.get("answer_markdown") or "").strip()
        actions = metadata.get("proposed_actions") or []
        is_truncated = _is_truncated(full_text, _MAX_ASSISTANT_ANSWER_PREVIEW_CHARS)
        has_detail = bool(full_text)
        has_actions = bool(actions)
    else:
        preview_text = _truncate_text(message.content, _MAX_USER_CONTENT_PREVIEW_CHARS)
        is_truncated = _is_truncated(message.content, _MAX_USER_CONTENT_PREVIEW_CHARS)
        has_detail = bool(message.content)
        has_actions = False
    return MessagePreview(
        id=message.id,
        role=message.role,
        created_at=message.created_at,
        preview_text=preview_text,
        is_truncated=is_truncated,
        has_detail=has_detail,
        has_actions=has_actions,
        state="ready",
    )


def _build_conversation_preview(
    conv: AIConversation,
    latest_message: AIMessage | None,
) -> ConversationPreviewNode:
    assistant_preview = ""
    last_message_at = conv.updated_at or conv.created_at
    if latest_message is not None:
        last_message_at = latest_message.created_at or last_message_at
        if latest_message.role == "assistant":
            meta = _sanitize_assistant_metadata(
                latest_message.payload_metadata,
                answer_limit=_MAX_ASSISTANT_ANSWER_PREVIEW_CHARS,
            )
            assistant_preview = str(meta.get("answer_markdown") or "").strip()[:200]
    return ConversationPreviewNode(
        id=conv.id,
        title=conv.title,
        active_use_case=conv.active_use_case,
        last_message_at=last_message_at,
        status="ready",
        unread_count=0,
        last_assistant_preview=assistant_preview,
    )


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/conversations", response_model=list[ConversationPreviewNode])
def list_conversations(
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
        latest = (
            db.query(AIMessage)
            .filter(AIMessage.conversation_id == conv.id)
            .order_by(AIMessage.created_at.desc())
            .first()
        )
        previews.append(_build_conversation_preview(conv, latest))
    return previews


@router.post("/conversations", response_model=ConversationThreadNode, status_code=201)
def create_conversation(body: ConversationCreate, db: Session = Depends(get_db)):
    now = datetime.utcnow()
    conv = AIConversation(
        id=str(uuid.uuid4()),
        space_id=body.space_id,
        project_id=body.project_id,
        topic_id=body.topic_id,
        title=body.title.strip() or "Nouvelle conversation",
        created_at=now,
        updated_at=now,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ConversationThreadNode(
        conversation=_build_conversation_preview(conv, None),
        messages=[],
        totalMessageCount=0,
        loadedMessageCount=0,
        hasMore=False,
        nextOffset=None,
    )


@router.get("/conversations/{conv_id}", response_model=ConversationThreadNode)
def get_conversation(
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
    latest = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conv_id)
        .order_by(AIMessage.created_at.desc())
        .first()
    )
    return ConversationThreadNode(
        conversation=_build_conversation_preview(conv, latest),
        messages=[_build_message_preview(m) for m in msgs],
        totalMessageCount=total_count,
        loadedMessageCount=loaded_count,
        hasMore=has_more,
        nextOffset=next_offset if has_more else None,
    )


@router.patch("/conversations/{conv_id}", response_model=ConversationPreviewNode)
def rename_conversation(conv_id: str, body: ConversationPatch, db: Session = Depends(get_db)):
    conv = db.get(AIConversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    conv.title = body.title.strip() or conv.title
    conv.updated_at = datetime.utcnow()
    db.commit()
    latest = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conv_id)
        .order_by(AIMessage.created_at.desc())
        .first()
    )
    return _build_conversation_preview(conv, latest)


@router.delete("/conversations/{conv_id}", status_code=204)
def delete_conversation(conv_id: str, db: Session = Depends(get_db)):
    from app.models.ai_use_case_snapshot import AIUseCaseSnapshot
    conv = db.get(AIConversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    db.query(AIUseCaseSnapshot).filter(AIUseCaseSnapshot.conversation_id == conv_id).delete()
    db.query(AIMessage).filter(AIMessage.conversation_id == conv_id).delete()
    db.delete(conv)
    db.commit()


@router.get("/conversations/{conv_id}/messages/{message_id}", response_model=MessageDetailNode)
def get_message_detail(
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
    metadata = _sanitize_assistant_metadata(
        message.payload_metadata, answer_limit=_MAX_ASSISTANT_ANSWER_CHARS
    )
    full_answer = str(metadata.get("answer_markdown") or "").strip()
    actions = [ProposedActionCard(**action) for action in metadata.get("proposed_actions", [])]

    document_sources: list[DocumentSourceNode] = []
    raw_doc_ids = (message.payload_metadata or {}).get("document_ids", [])
    if isinstance(raw_doc_ids, list) and raw_doc_ids:
        docs = (
            db.query(ProjectKnowledgeDocument)
            .filter(ProjectKnowledgeDocument.id.in_(raw_doc_ids))
            .all()
        )
        document_sources = [
            DocumentSourceNode(id=doc.id, title=doc.title, category=doc.category)
            for doc in docs
        ]

    raw_sources = (message.payload_metadata or {}).get("sources_used") or []
    sources_used_nodes = [
        SourceUsedNode(
            doc_id=str(s.get("doc_id", "")),
            title=str(s.get("title", "")),
            role=str(s.get("role", "reference")),
        )
        for s in raw_sources
        if isinstance(s, dict) and s.get("doc_id")
    ]

    return MessageDetailNode(
        id=message.id,
        role=message.role,
        created_at=message.created_at,
        full_text=message.content if message.role == "user" else full_answer,
        rendered_answer=full_answer if message.role == "assistant" else None,
        certainty=None,
        related_objects=metadata.get("related_objects", []),
        actions=actions,
        debug_available=False,
        document_sources=document_sources,
        sources_used=sources_used_nodes,
        evidence_level=str((message.payload_metadata or {}).get("evidence_level") or "none"),
        document_backed=bool((message.payload_metadata or {}).get("document_backed", False)),
        warning_no_docs=(message.payload_metadata or {}).get("warning_no_docs"),
        retrieved_docs_count=int((message.payload_metadata or {}).get("retrieved_docs_count") or 0),
        retained_docs_count=int((message.payload_metadata or {}).get("retained_docs_count") or 0),
        evidence_count=int((message.payload_metadata or {}).get("evidence_count") or 0),
        corpus_status=str((message.payload_metadata or {}).get("corpus_status") or "not_indexed"),
    )
