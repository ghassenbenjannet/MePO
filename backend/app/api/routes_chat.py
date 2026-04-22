"""Route standard unique d'envoi de tour de chat.

POST /ai/conversations/turns
  - crée la conversation si inexistante
  - classe le tour (micro_ack / follow_up / business_turn)
  - génère la réponse via Google LLM (sauf micro_ack)
  - persiste user + assistant dans la même transaction
  - retourne un payload compact

C'est le seul endpoint standard d'envoi de message chat.
"""
from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ai_conversation import AIConversation
from app.models.ai_message import AIMessage
from app.services.ai.chat_turn_service import process_turn

logger = logging.getLogger(__name__)
router = APIRouter()

UseCase = Literal[
    "analyse",
    "bogue",
    "recette",
    "question_generale",
    "redaction_besoin",
    "structuration_sujet",
]


# ─── Request ──────────────────────────────────────────────────────────────────

class ChatTurnRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=32000)
    use_case: UseCase
    space_id: str
    project_id: str | None = None
    topic_id: str | None = None
    conversation_id: str | None = None


# ─── Response ─────────────────────────────────────────────────────────────────

class SourceUsed(BaseModel):
    doc_id: str
    title: str
    role: str = "reference"


class TurnMeta(BaseModel):
    use_case: str
    turn_classification: str
    provider: str
    retrieval_used: bool
    persisted: bool
    snapshot_id: str | None = None
    retrieved_docs_count: int = 0
    retained_docs_count: int = 0
    evidence_count: int = 0
    corpus_status: str = "not_indexed"
    document_backed: bool = False
    evidence_level: str = "none"
    warning_no_docs: str | None = None


class MessagePreviewOut(BaseModel):
    id: str
    role: str
    preview_text: str
    created_at: str


class AssistantDetail(BaseModel):
    answer_markdown: str
    mode: str
    understanding: str
    proposed_actions: list
    related_objects: list
    next_actions: list
    sources_used: list[SourceUsed] = []
    evidence_level: str = "none"
    document_backed: bool = False


class ConversationPreviewOut(BaseModel):
    id: str
    title: str
    active_use_case: str | None


class ChatTurnResponse(BaseModel):
    conversation: ConversationPreviewOut
    appended_messages: list[MessagePreviewOut]
    assistant_detail: AssistantDetail
    turn_meta: TurnMeta


def _preview_text(content: str, max_chars: int = 300) -> str:
    text = content.strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + "…"


# ─── Route ────────────────────────────────────────────────────────────────────

@router.post("/conversations/turns", response_model=ChatTurnResponse)
def send_chat_turn(body: ChatTurnRequest, db: Session = Depends(get_db)) -> JSONResponse:
    try:
        result = process_turn(
            db,
            message=body.message,
            use_case=body.use_case,
            space_id=body.space_id,
            project_id=body.project_id,
            topic_id=body.topic_id,
            conversation_id=body.conversation_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("ChatTurn error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erreur interne: {exc}") from exc

    conv = db.get(AIConversation, result.conversation_id)
    user_msg = db.get(AIMessage, result.user_message_id)
    assistant_msg = db.get(AIMessage, result.assistant_message_id)

    conversation_out = ConversationPreviewOut(
        id=result.conversation_id,
        title=conv.title if conv else "",
        active_use_case=result.use_case,
    )

    appended = []
    for msg in [user_msg, assistant_msg]:
        if msg:
            content = msg.content
            if msg.role == "assistant":
                content = (msg.payload_metadata or {}).get("answer_markdown") or msg.content
            appended.append(MessagePreviewOut(
                id=msg.id,
                role=msg.role,
                preview_text=_preview_text(content),
                created_at=msg.created_at.isoformat(),
            ))

    assistant_detail = AssistantDetail(
        answer_markdown=result.answer_markdown,
        mode=result.mode,
        understanding=result.understanding,
        proposed_actions=result.proposed_actions,
        related_objects=result.related_objects,
        next_actions=result.next_actions,
        sources_used=[SourceUsed(**s) for s in (result.sources_used or []) if isinstance(s, dict)],
        evidence_level=result.evidence_level,
        document_backed=result.document_backed,
    )

    turn_meta = TurnMeta(
        use_case=result.use_case,
        turn_classification=result.turn_classification,
        provider=result.provider,
        retrieval_used=result.retrieval_used,
        persisted=result.persisted,
        snapshot_id=result.snapshot_id,
        retrieved_docs_count=result.retrieved_docs_count,
        retained_docs_count=result.retained_docs_count,
        evidence_count=result.evidence_count,
        corpus_status=result.corpus_status,
        document_backed=result.document_backed,
        evidence_level=result.evidence_level,
        warning_no_docs=result.warning_no_docs,
    )

    response = ChatTurnResponse(
        conversation=conversation_out,
        appended_messages=appended,
        assistant_detail=assistant_detail,
        turn_meta=turn_meta,
    )

    return JSONResponse(content=response.model_dump(mode="json"))
