from fastapi import APIRouter

from app.schemas.audit import AuditLogRead

router = APIRouter()


@router.get("", response_model=list[AuditLogRead])
def list_audit_logs() -> list[AuditLogRead]:
    return [
        AuditLogRead(
            id="audit-1",
            action_type="ticket.updated",
            actor_id="user-1",
            object_type="ticket",
            object_id="LIV-101",
            old_state={"status": "Todo"},
            new_state={"status": "In Progress"},
            created_at="2026-04-12T10:15:00Z",
        ),
        AuditLogRead(
            id="audit-2",
            action_type="memory.updated",
            actor_id="user-1",
            object_type="topic_memory",
            object_id="multi-establishments",
            old_state=None,
            new_state={"decisions": ["Utiliser un contexte topic-first."]},
            created_at="2026-04-12T10:30:00Z",
        ),
    ]

