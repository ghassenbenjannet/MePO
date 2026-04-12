from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: str
    action_type: str
    actor_id: str
    object_type: str
    object_id: str
    old_state: dict | None = None
    new_state: dict | None = None
    created_at: str

