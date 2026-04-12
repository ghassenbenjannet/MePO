from pydantic import BaseModel


class DocumentRead(BaseModel):
    id: str
    space_id: str
    topic_id: str | None = None
    title: str
    content: str
    parent_id: str | None = None
