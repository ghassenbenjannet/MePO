"""Standard MePO chat turn service."""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from sqlalchemy.orm import Session

from app.models.ai_conversation import AIConversation
from app.models.ai_message import AIMessage
from app.services.ai.active_skill_service import ensure_active_skill_version
from app.services.ai.conversation_summary_service import get_summary_text
from app.services.ai.google_llm_service import call_google_llm
from app.services.ai.turn_classifier import TurnClassification, classify_turn
from app.services.ai.use_case_snapshot_service import create_snapshot, get_last_snapshot
from app.services.ai.source_rescue import rescue_sources
from app.services.ai.use_case_validator import validate_use_case_output
from app.services.documents.corpus_snapshot_service import build_project_corpus_snapshot

logger = logging.getLogger(__name__)

UseCase = Literal[
    "analyse",
    "bogue",
    "recette",
    "question_generale",
    "redaction_besoin",
    "structuration_sujet",
]

_MICRO_ACK_RESPONSES = [
    "D'accord, je continue.",
    "Bien note.",
    "Compris.",
    "Ok, je suis la si vous avez d'autres questions.",
]

_MICRO_ACK_ROTATING_INDEX = 0


def _micro_ack_response() -> str:
    global _MICRO_ACK_ROTATING_INDEX
    response = _MICRO_ACK_RESPONSES[_MICRO_ACK_ROTATING_INDEX % len(_MICRO_ACK_RESPONSES)]
    _MICRO_ACK_ROTATING_INDEX += 1
    return response


@dataclass
class ChatTurnResult:
    conversation_id: str
    use_case: str
    turn_classification: TurnClassification
    provider: str
    retrieval_used: bool
    persisted: bool
    user_message_id: str
    assistant_message_id: str
    answer_markdown: str
    understanding: str
    mode: str
    proposed_actions: list = field(default_factory=list)
    related_objects: list = field(default_factory=list)
    next_actions: list = field(default_factory=list)
    snapshot_id: str | None = None
    retrieved_docs_count: int = 0
    retained_docs_count: int = 0
    evidence_count: int = 0
    corpus_status: str = "not_indexed"
    sources_used: list = field(default_factory=list)
    evidence_level: str = "none"
    document_backed: bool = False
    warning_no_docs: str | None = None


def _get_conversation_history(db: Session, conversation_id: str, max_turns: int = 10) -> list[dict]:
    messages = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conversation_id)
        .order_by(AIMessage.created_at.desc())
        .limit(max_turns * 2)
        .all()
    )
    history = []
    for message in reversed(messages):
        content = message.content
        if message.role == "assistant":
            content = (message.payload_metadata or {}).get("answer_markdown") or message.content
        history.append({"role": message.role, "content": content})
    return history


def _persist_messages(
    db: Session,
    conversation_id: str,
    use_case: str,
    turn_classification: TurnClassification,
    user_content: str,
    assistant_content: str,
    assistant_metadata: dict,
    snapshot_id: str | None,
) -> tuple[str, str]:
    now = datetime.utcnow()
    user_id = str(uuid.uuid4())
    assistant_id = str(uuid.uuid4())

    user_message = AIMessage(
        id=user_id,
        conversation_id=conversation_id,
        role="user",
        content=user_content,
        use_case=use_case,
        turn_classification=turn_classification,
        use_case_snapshot_id=snapshot_id,
        payload_metadata={},
        created_at=now,
    )
    assistant_message = AIMessage(
        id=assistant_id,
        conversation_id=conversation_id,
        role="assistant",
        content=assistant_content,
        use_case=use_case,
        turn_classification=turn_classification,
        use_case_snapshot_id=snapshot_id,
        payload_metadata=assistant_metadata,
        created_at=now,
    )
    db.add(user_message)
    db.add(assistant_message)

    conversation = db.get(AIConversation, conversation_id)
    if conversation:
        conversation.updated_at = now
        conversation.active_use_case = use_case
        db.add(conversation)

    return user_id, assistant_id


def _get_or_create_conversation(
    db: Session,
    conversation_id: str | None,
    project_id: str | None,
    space_id: str,
    topic_id: str | None,
    use_case: str,
    first_message: str,
) -> AIConversation:
    if conversation_id:
        conversation = db.get(AIConversation, conversation_id)
        if conversation:
            return conversation

    now = datetime.utcnow()
    title = first_message.strip()[:80] or "Nouvelle conversation"
    conversation = AIConversation(
        id=str(uuid.uuid4()),
        project_id=project_id,
        space_id=space_id,
        topic_id=topic_id,
        title=title,
        active_use_case=use_case,
        created_at=now,
        updated_at=now,
    )
    db.add(conversation)
    db.flush()
    return conversation


def process_turn(
    db: Session,
    *,
    message: str,
    use_case: UseCase,
    space_id: str,
    project_id: str | None = None,
    topic_id: str | None = None,
    conversation_id: str | None = None,
) -> ChatTurnResult:
    conversation = _get_or_create_conversation(
        db,
        conversation_id=conversation_id,
        project_id=project_id,
        space_id=space_id,
        topic_id=topic_id,
        use_case=use_case,
        first_message=message,
    )

    has_history = bool(
        db.query(AIMessage.id)
        .filter(AIMessage.conversation_id == conversation.id)
        .first()
    )
    last_snapshot = get_last_snapshot(db, conversation.id)
    has_snapshot = last_snapshot is not None
    classification = classify_turn(
        message=message,
        has_recent_history=has_history,
        has_active_snapshot=has_snapshot,
    )

    logger.info(
        "ChatTurn - conv=%s use_case=%s classification=%s",
        conversation.id,
        use_case,
        classification,
    )

    snapshot_id: str | None = None
    provider = "local"
    retrieval_used = False
    document_ids: list[str] = []
    title_to_doc: dict = {}
    corpus_status = "not_indexed"

    if classification == "micro_ack":
        llm_result = {
            "answer_markdown": _micro_ack_response(),
            "mode": use_case,
            "understanding": "Accuse de reception.",
            "proposed_actions": [],
            "related_objects": [],
            "next_actions": [],
        }
    else:
        active_skill = ensure_active_skill_version(db, project_id) if project_id else None
        skill_context = active_skill.compiled_context_text if active_skill else None
        history = _get_conversation_history(db, conversation.id) if has_history else []
        summary_text = get_summary_text(db, conversation.id)

        retrieval_context = None
        corpus_version: str | None = None
        if project_id:
            corpus_snapshot = build_project_corpus_snapshot(db, project_id)
            document_ids = corpus_snapshot.document_ids
            corpus_version = corpus_snapshot.corpus_version
            corpus_status = corpus_snapshot.corpus_status
            title_to_doc = corpus_snapshot.title_to_doc

            if corpus_snapshot.is_ready:
                retrieval_context = corpus_snapshot.snapshot_text
                retrieval_used = True

            if classification == "follow_up" and last_snapshot:
                snapshot_id = last_snapshot.id

        llm_result = call_google_llm(
            message=message,
            use_case=use_case,
            skill_context=skill_context,
            corpus_context=retrieval_context,
            conversation_history=history,
            context_summary=summary_text,
        )
        provider = "google"

        if classification == "business_turn":
            snapshot = create_snapshot(
                db,
                conversation_id=conversation.id,
                use_case=use_case,
                topic_id=topic_id,
                skill_version_id=active_skill.id if active_skill else None,
                corpus_version=corpus_version,
                related_object_ids=[
                    obj["id"]
                    for obj in llm_result.get("related_objects", [])
                    if isinstance(obj, dict) and obj.get("id")
                ],
                document_ids=document_ids,
            )
            snapshot_id = snapshot.id
            conversation.skill_version_id_snapshot = active_skill.id if active_skill else None
            db.add(conversation)

    # Source rescue: scan answer_markdown for [source: Titre] citations and
    # back-fill sources_used entries that Gemini omitted from its JSON output.
    if title_to_doc:
        raw_sources = llm_result.get("sources_used") or []
        answer_md = str(llm_result.get("answer_markdown") or "")
        llm_result["sources_used"] = rescue_sources(
            answer_markdown=answer_md,
            existing_sources=raw_sources,
            title_to_doc=title_to_doc,
            corpus_doc_ids=document_ids,
        )

    # Validate and repair the LLM result against the strict use_case contract.
    # This derives document_backed / evidence_level from actual sources_used count
    # rather than trusting the LLM's own claim.
    validation = validate_use_case_output(
        llm_result,
        use_case=use_case,
        retrieved_doc_ids=document_ids,
    )
    sources_used = llm_result.get("sources_used") or []
    evidence_level = validation.evidence_level
    document_backed = validation.document_backed
    warning_no_docs = validation.warning_no_docs

    assistant_metadata = {
        "answer_markdown": llm_result.get("answer_markdown", ""),
        "mode": llm_result.get("mode", use_case),
        "understanding": llm_result.get("understanding", ""),
        "proposed_actions": llm_result.get("proposed_actions", []),
        "related_objects": llm_result.get("related_objects", []),
        "next_actions": llm_result.get("next_actions", []),
        "turn_classification": classification,
        "provider": provider,
        "retrieval_used": retrieval_used,
        "document_ids": document_ids,
        "sources_used": sources_used,
        "evidence_level": evidence_level,
        "document_backed": document_backed,
        "warning_no_docs": warning_no_docs,
        "retrieved_docs_count": validation.retrieved_docs_count,
        "retained_docs_count": validation.retained_docs_count,
        "evidence_count": validation.evidence_count,
        "corpus_status": corpus_status,
    }

    user_message_id, assistant_message_id = _persist_messages(
        db,
        conversation_id=conversation.id,
        use_case=use_case,
        turn_classification=classification,
        user_content=message,
        assistant_content=llm_result.get("answer_markdown", ""),
        assistant_metadata=assistant_metadata,
        snapshot_id=snapshot_id,
    )

    db.commit()

    return ChatTurnResult(
        conversation_id=conversation.id,
        use_case=use_case,
        turn_classification=classification,
        provider=provider,
        retrieval_used=retrieval_used,
        persisted=True,
        user_message_id=user_message_id,
        assistant_message_id=assistant_message_id,
        answer_markdown=llm_result.get("answer_markdown", ""),
        understanding=llm_result.get("understanding", ""),
        mode=llm_result.get("mode", use_case),
        proposed_actions=llm_result.get("proposed_actions", []),
        related_objects=llm_result.get("related_objects", []),
        next_actions=llm_result.get("next_actions", []),
        snapshot_id=snapshot_id,
        retrieved_docs_count=validation.retrieved_docs_count,
        retained_docs_count=validation.retained_docs_count,
        evidence_count=validation.evidence_count,
        corpus_status=corpus_status,
        sources_used=sources_used,
        evidence_level=evidence_level,
        document_backed=document_backed,
        warning_no_docs=warning_no_docs,
    )
