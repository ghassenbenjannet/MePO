from datetime import datetime

from pydantic import BaseModel


class DocumentCreate(BaseModel):
    space_id: str
    topic_id: str | None = None
    parent_id: str | None = None
    type: str = "page"          # folder | page | whiteboard | mermaid | file
    title: str
    content: str = ""
    tags: list[str] = []
    doc_metadata: dict = {}
    icon: str | None = None


class DocumentUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    topic_id: str | None = None
    parent_id: str | None = None
    tags: list[str] | None = None
    doc_metadata: dict | None = None
    icon: str | None = None
    is_archived: bool | None = None


class DocumentRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    space_id: str
    topic_id: str | None = None
    parent_id: str | None = None
    type: str
    title: str
    content: str
    tags: list[str] = []
    doc_metadata: dict = {}
    icon: str | None = None
    is_archived: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None
