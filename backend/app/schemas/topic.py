from pydantic import BaseModel


class TopicRead(BaseModel):
    id: str
    space_id: str
    title: str
    description: str | None = None
    status: str
    priority: str
