from pydantic import BaseModel


class TicketRead(BaseModel):
    id: str
    topic_id: str
    type: str
    title: str
    description: str | None = None
    status: str
    priority: str
