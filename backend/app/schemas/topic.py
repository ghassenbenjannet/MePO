from datetime import date, datetime

from pydantic import BaseModel


class TopicCreate(BaseModel):
    space_id: str
    title: str
    description: str | None = None
    status: str = "active"
    priority: str = "medium"
    topic_nature: str = "study_delivery"
    color: str | None = None
    roadmap_start_date: date | None = None
    roadmap_end_date: date | None = None
    owner: str | None = None
    teams: list[str] = []
    risks: list[str] = []
    dependencies: list[str] = []
    open_questions: list[str] = []
    tags: list[str] = []


class TopicUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    topic_nature: str | None = None
    color: str | None = None
    roadmap_start_date: date | None = None
    roadmap_end_date: date | None = None
    owner: str | None = None
    teams: list[str] | None = None
    risks: list[str] | None = None
    dependencies: list[str] | None = None
    open_questions: list[str] | None = None
    tags: list[str] | None = None


class TopicRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    space_id: str
    title: str
    description: str | None = None
    status: str
    priority: str
    topic_nature: str
    color: str
    roadmap_start_date: date | None = None
    roadmap_end_date: date | None = None
    owner: str | None = None
    teams: list[str] = []
    risks: list[str] = []
    dependencies: list[str] = []
    open_questions: list[str] = []
    tags: list[str] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None
