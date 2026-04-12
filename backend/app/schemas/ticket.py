from datetime import datetime

from pydantic import BaseModel


class TicketCreate(BaseModel):
    id: str | None = None  # e.g. "LIV-101" — auto-generated if omitted
    topic_id: str
    type: str = "task"
    title: str
    description: str | None = None
    status: str = "backlog"
    priority: str = "medium"
    assignee: str | None = None
    tags: list[str] = []
    acceptance_criteria: list[str] = []


class TicketUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    type: str | None = None
    status: str | None = None
    priority: str | None = None
    assignee: str | None = None
    tags: list[str] | None = None
    acceptance_criteria: list[str] | None = None


class TicketRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    topic_id: str
    type: str
    title: str
    description: str | None = None
    status: str
    priority: str
    assignee: str | None = None
    tags: list[str] = []
    acceptance_criteria: list[str] = []
    created_at: datetime | None = None
