from pydantic import BaseModel, Field


class CommentRead(BaseModel):
    id: str
    author_id: str
    ticket_id: str | None = None
    document_id: str | None = None
    content: str
    created_at: str


class CommentCreate(BaseModel):
    ticket_id: str | None = None
    document_id: str | None = None
    content: str = Field(min_length=1)

