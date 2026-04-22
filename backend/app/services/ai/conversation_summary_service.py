"""Service de résumé de conversation.

Lit et persiste le modèle AIConversationSummary.
La génération automatique du résumé (via LLM) est prévue en T4.
Pour T1, expose les opérations CRUD sur le résumé.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.ai_conversation_summary import AIConversationSummary


def get_conversation_summary(db: Session, conversation_id: str) -> AIConversationSummary | None:
    return (
        db.query(AIConversationSummary)
        .filter(AIConversationSummary.conversation_id == conversation_id)
        .order_by(AIConversationSummary.summary_version.desc())
        .first()
    )


def get_summary_text(db: Session, conversation_id: str) -> str | None:
    summary = get_conversation_summary(db, conversation_id)
    if summary and summary.summary_text.strip():
        return summary.summary_text
    return None


def upsert_conversation_summary(
    db: Session,
    conversation_id: str,
    summary_text: str,
    last_message_id: str | None = None,
) -> AIConversationSummary:
    existing = get_conversation_summary(db, conversation_id)
    if existing:
        existing.summary_text = summary_text
        existing.summary_version += 1
        existing.last_message_id = last_message_id
        existing.updated_at = datetime.utcnow()
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    summary = AIConversationSummary(
        conversation_id=conversation_id,
        summary_text=summary_text,
        summary_version=1,
        last_message_id=last_message_id,
        updated_at=datetime.utcnow(),
    )
    db.add(summary)
    db.commit()
    db.refresh(summary)
    return summary
