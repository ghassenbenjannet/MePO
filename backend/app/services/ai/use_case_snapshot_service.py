"""Service de gestion des AIUseCaseSnapshot.

Un snapshot est créé pour chaque business_turn.
Les follow_up réutilisent le dernier snapshot actif de la conversation.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.ai_conversation import AIConversation
from app.models.ai_use_case_snapshot import AIUseCaseSnapshot


def get_last_snapshot(db: Session, conversation_id: str) -> AIUseCaseSnapshot | None:
    return (
        db.query(AIUseCaseSnapshot)
        .filter(AIUseCaseSnapshot.conversation_id == conversation_id)
        .order_by(AIUseCaseSnapshot.created_at.desc())
        .first()
    )


def create_snapshot(
    db: Session,
    conversation_id: str,
    use_case: str,
    trigger_message_id: str | None = None,
    topic_id: str | None = None,
    skill_version_id: str | None = None,
    corpus_version: str | None = None,
    related_object_ids: list | None = None,
    document_ids: list | None = None,
    summary_version: int = 1,
) -> AIUseCaseSnapshot:
    snapshot = AIUseCaseSnapshot(
        conversation_id=conversation_id,
        trigger_message_id=trigger_message_id,
        use_case=use_case,
        topic_id=topic_id,
        skill_version_id=skill_version_id,
        corpus_version=corpus_version,
        related_object_ids=related_object_ids or [],
        document_ids=document_ids or [],
        summary_version=summary_version,
    )
    db.add(snapshot)
    db.flush()

    conv = db.get(AIConversation, conversation_id)
    if conv:
        conv.last_use_case_snapshot_id = snapshot.id
        conv.active_use_case = use_case
        db.add(conv)

    return snapshot
