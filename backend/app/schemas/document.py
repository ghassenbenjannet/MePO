from datetime import datetime

from pydantic import BaseModel


class DocumentCreate(BaseModel):
    space_id: str
    topic_id: str | None = None
    title: str
    content: str = ""
    parent_id: str | None = None


class DocumentUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    topic_id: str | None = None
    parent_id: str | None = None


class DocumentRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    space_id: str
    topic_id: str | None = None
    title: str
    content: str
    parent_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
