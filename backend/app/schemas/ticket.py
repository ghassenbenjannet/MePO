from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, field_validator


def _coerce_list(v: Any) -> list:
    """Accept a list as-is; coerce anything else (e.g. empty string) to []."""
    if isinstance(v, list):
        return v
    return []


class TicketCreate(BaseModel):
    id: str | None = None  # e.g. "LIV-101" — auto-generated if omitted
    topic_id: str
    type: str = "task"
    title: str
    description: str | None = None
    status: str = "backlog"
    priority: str = "medium"
    assignee: str | None = None
    reporter: str | None = None
    tags: list[str] = []
    acceptance_criteria: list[str] = []
    due_date: date | None = None
    estimate: float | None = None
    dependencies: list[str] = []
    linked_document_ids: list[str] = []
    ticket_details: dict = {}


class TicketUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    type: str | None = None
    status: str | None = None
    priority: str | None = None
    assignee: str | None = None
    reporter: str | None = None
    tags: list[str] | None = None
    acceptance_criteria: list[str] | None = None
    due_date: date | None = None
    estimate: float | None = None
    dependencies: list[str] | None = None
    linked_document_ids: list[str] | None = None
    ticket_details: dict | None = None


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
    reporter: str | None = None
    tags: list[str] = []
    acceptance_criteria: list[str] = []
    due_date: date | None = None
    estimate: float | None = None
    dependencies: list[str] = []
    linked_document_ids: list[str] = []
    ticket_details: dict = {}
    created_at: datetime | None = None
    updated_at: datetime | None = None

    # ── Coerce legacy DB rows where JSON columns stored "" instead of [] ──────
    @field_validator("tags", "acceptance_criteria", "dependencies", "linked_document_ids", mode="before")
    @classmethod
    def coerce_list_fields(cls, v: Any) -> list:
        return _coerce_list(v)

    @field_validator("ticket_details", mode="before")
    @classmethod
    def coerce_dict_field(cls, v: Any) -> dict:
        if isinstance(v, dict):
            return v
        return {}
