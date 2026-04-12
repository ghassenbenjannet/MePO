from datetime import datetime

from pydantic import BaseModel


class TopicCreate(BaseModel):
    space_id: str
    title: str
    description: str | None = None
    status: str = "active"
    priority: str = "medium"
    owner: str | None = None
    teams: list[str] = []
    risks: list[str] = []
    open_questions: list[str] = []


class TopicUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    owner: str | None = None
    teams: list[str] | None = None
    risks: list[str] | None = None
    open_questions: list[str] | None = None


class TopicRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    space_id: str
    title: str
    description: str | None = None
    status: str
    priority: str
    owner: str | None = None
    teams: list[str] = []
    risks: list[str] = []
    open_questions: list[str] = []
    created_at: datetime | None = None
