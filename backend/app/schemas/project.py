from pydantic import BaseModel


class ProjectRead(BaseModel):
    id: str
    name: str
    description: str | None = None
