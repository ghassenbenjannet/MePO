from __future__ import annotations

import hashlib
import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.ai_action_proposal import AIActionProposal
from app.schemas.ai import ProposedAction


def _canonical_payload(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def compute_payload_hash(*, action_type: str, payload: dict) -> str:
    raw = f"{action_type}:{_canonical_payload(payload)}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def register_proposed_actions(
    db: Session,
    *,
    project_id: str | None,
    space_id: str | None,
    topic_id: str | None,
    actions: list[ProposedAction],
) -> list[ProposedAction]:
    if not actions:
        return actions

    registered: list[ProposedAction] = []
    now = datetime.utcnow()
    for action in actions:
        payload_hash = compute_payload_hash(action_type=action.type, payload=action.payload)
        proposal = AIActionProposal(
            project_id=project_id,
            space_id=space_id,
            topic_id=topic_id,
            action_type=action.type,
            label=action.label[:255],
            payload_json=action.payload,
            payload_hash=payload_hash,
            status="proposed",
            created_at=now,
            updated_at=now,
        )
        db.add(proposal)
        db.flush()
        registered.append(
            action.model_copy(
                update={"action_id": proposal.id},
                deep=True,
            )
        )
    db.commit()
    return registered


def get_action_proposal(db: Session, action_id: str) -> AIActionProposal | None:
    return db.get(AIActionProposal, action_id)


def mark_action_executed(
    db: Session,
    *,
    proposal: AIActionProposal,
    success: bool,
    message: str,
    execution_result: dict | None = None,
) -> AIActionProposal:
    proposal.status = "executed" if success else "failed"
    proposal.execution_message = message
    proposal.execution_result = execution_result
    proposal.executed_at = datetime.utcnow()
    proposal.updated_at = proposal.executed_at
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal
